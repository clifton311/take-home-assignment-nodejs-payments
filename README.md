# Commission Reporting API

## Running locally

```bash
# 1. Start Postgres with seed data
docker compose up -d

# 2. Install dependencies
npm install

# 3. Start dev server (hot-reload)
npm run dev

# 4. Run all tests
npm test
```

The server defaults to `http://localhost:3000`. DB defaults match `docker-compose.yml` — no `.env` file needed for local development. Copy `.env.example` to `.env` to override.

---

## API Design

### `GET /commissions`

Returns a paginated list of commissions with allocations embedded on each record.

**Query parameters**

| Param | Type | Description |
|---|---|---|
| `team_id` | UUID | Filter by team |
| `status` | string | `draft`, `pending_approval`, `approved`, or `finalized` |
| `date_from` | `YYYY-MM-DD` | close_date ≥ this date (inclusive) |
| `date_to` | `YYYY-MM-DD` | close_date ≤ this date (inclusive) |
| `page` | integer ≥ 1 | Default: 1 |
| `limit` | integer 1–100 | Default: 20 |





---

### `GET /commissions/summary`

Returns aggregate totals for a time period. Both date params are required.

**Query parameters**

| Param | Type | Description |
|---|---|---|
| `date_from` | `YYYY-MM-DD` | Required. Period start (inclusive) |
| `date_to` | `YYYY-MM-DD` | Required. Period end (inclusive) |
| `team_id` | UUID | Optional. Scope to a single team |


All four statuses and all three party types are always present in the response — counts default to zero if no data exists for that bucket. A period with no matching commissions returns zeros, not an error.

---

### `GET /commissions/summary/by-status`

Returns totals for a single commission status within a time period.

**Query parameters**

| Param | Type | Description |
|---|---|---|
| `date_from` | `YYYY-MM-DD` | Required. Period start (inclusive) |
| `date_to` | `YYYY-MM-DD` | Required. Period end (inclusive) |
| `status` | string | Required. `draft`, `pending_approval`, `approved`, or `finalized` |
| `team_id` | UUID | Optional. Scope to a single team |


---

### `GET /commissions/summary/by-party-type`

Returns allocation totals for a single party type within a time period.

**Query parameters**

| Param | Type | Description |
|---|---|---|
| `date_from` | `YYYY-MM-DD` | Required. Period start (inclusive) |
| `date_to` | `YYYY-MM-DD` | Required. Period end (inclusive) |
| `party_type` | string | Required. `team_member`, `external_agent`, or `brokerage` |
| `team_id` | UUID | Optional. Scope to a single team |

**Example response**

```json
{
  "period": { "date_from": "2025-03-01", "date_to": "2025-03-31" },
  "party_type": "team_member",
  "allocation_count": 9,
  "total_cents": 2815500
}
```

Returns `allocation_count: 0, total_cents: 0` when no allocations exist for that party type in the period.

---

### Error responses

All errors share the same shape:

```json
{ "code": "INVALID_PARAMS", "message": "date_from must not be after date_to" }
```

| Status | Code | When |
|---|---|---|
| 400 | `INVALID_PARAMS` | Bad query params |
| 404 | `NOT_FOUND` | Unknown route |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## Design decisions

**Page-based pagination over cursor-based.** Opted for Page-based pagination based on the limited data seed data. However, in production Cursor pagination would be a potential refactor point.  Cursor pagination would add complexity with no benefit for this exercise.

**`date_from`/`date_to` required for summary, optional for list.** The summary endpoint powers a dashboard that always has a period in mind — requiring both bounds avoids accidentally aggregating all 25 commissions. The list endpoint allows open-ended browsing, so both bounds are optional.

**Allocations embedded in the list response.** Finance "shouldn't have to make a separate request per commission to see the splits." Fetching commissions then allocations separately (N+1) was the alternative; instead one `LEFT JOIN` + `json_agg` in a single query returns everything.

**`by_status` always enumerates all four statuses.** If the dashboard tries `response.by_status.find(s => s.status === 'draft')` and draft is absent, it would crash. Normalising to zero makes the client simpler and matches how finance dashboards actually work.

---

## Query approach

### `GET /commissions` — list query

Single query with a `LEFT JOIN allocations` and `json_agg(...) FILTER (WHERE a.id IS NOT NULL)` to aggregate all allocations per commission in one round-trip. `GROUP BY c.id` works because `id` is the primary key. A separate `COUNT(*)` query runs in parallel for the pagination total.

```sql
SELECT c.*, json_agg(...) AS allocations
FROM commissions c
LEFT JOIN allocations a ON a.commission_id = c.id
WHERE c.close_date >= $1 ...
GROUP BY c.id
ORDER BY c.close_date DESC, c.id
LIMIT $n OFFSET $m
```

### `GET /commissions/summary` — summary query

Three parallel queries:

1. `COUNT(*) + SUM(total_cents)` — overall totals
2. `GROUP BY status` on `commissions` — status breakdown
3. `JOIN commissions GROUP BY a.party_type` on `allocations` — party type breakdown

The results are normalised in application code: every `CommissionStatus` and `PartyType` enum value is always present, with zeros as the default.

### `GET /commissions/summary/by-status` — single-status focused query

Single query: `COUNT(*) + SUM(total_cents) WHERE status = $1`. Useful when the dashboard only needs numbers for one status (e.g. drilling into "all finalized this month") without paying for the full four-way breakdown.

### `GET /commissions/summary/by-party-type` — single-party-type focused query

Single query: `COUNT(*) + SUM(amount_cents) WHERE party_type = $1` joined to `commissions` for the date and optional team filter. Useful for viewing one party type's earnings in isolation.

### Indexes added

| Index | Rationale |
|---|---|
| `commissions(close_date)` | Primary filter + ORDER BY on list endpoint |
| `commissions(team_id, close_date)` | Covers the common team + date range filter in one index scan |
| `commissions(status)` | Status-only filter |
| `allocations(commission_id)` | FK join to commissions (PostgreSQL does not auto-create this) |
| `allocations(party_type)` | GROUP BY in summary party-type query |

---

## Testing strategy

**Unit tests** (`tests/unit/parseParams.test.ts`) cover the parameter validation layer in isolation — no DB, no HTTP. Every valid input variation and every error path is exercised.

**Integration tests** (`tests/integration/commissions.test.ts`) spin up the real Express app against the Docker Compose database (no mocks). They assert exact values against the known seed data documented in `db/init.sql`, including pagination totals, per-commission allocation data, filter correctness, sort order, response shapes, and zeros-not-errors for empty periods. Negative cases cover every invalid param combination for all four endpoints.

**Unit tests** for controllers (`tests/unit/commission.controller.test.ts`) mock the model layer to verify the HTTP layer in isolation: valid params → 200 with model called correctly, invalid params → 400 without touching the model, model throws → 500.

---

## What I'd improve with more time

- **Cursor-based pagination** for very large datasets where deep offsets get slow.
- **Request ID / structured logging** — attach a trace ID to every request and log it with errors so ops can correlate failures.
- **DB connection health check** — a `GET /health` that pings the pool before the load balancer sends traffic.


