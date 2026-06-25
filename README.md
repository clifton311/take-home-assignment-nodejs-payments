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

**Example response**

```json
{
  "data": [
    {
      "id": "10000000-0000-4000-8000-000000000011",
      "team_id": "a1a1a1a1-0000-4000-8000-000000000001",
      "status": "finalized",
      "close_date": "2025-03-05",
      "total_cents": 850000,
      "currency": "USD",
      "created_at": "2025-03-02T10:00:00.000Z",
      "updated_at": "2025-03-05T14:00:00.000Z",
      "allocations": [
        { "id": "...", "party_id": "...", "party_type": "team_member", "percentage": "0.5000", "amount_cents": 425000 },
        { "id": "...", "party_id": "...", "party_type": "external_agent", "percentage": "0.3000", "amount_cents": 255000 },
        { "id": "...", "party_id": "...", "party_type": "brokerage", "percentage": "0.2000", "amount_cents": 170000 }
      ]
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 9, "total_pages": 1 }
}
```

---

### `GET /commissions/summary`

Returns aggregate totals for a time period. Both date params are required.

**Query parameters**

| Param | Type | Description |
|---|---|---|
| `date_from` | `YYYY-MM-DD` | Required. Period start (inclusive) |
| `date_to` | `YYYY-MM-DD` | Required. Period end (inclusive) |
| `team_id` | UUID | Optional. Scope to a single team |

**Example response**

```json
{
  "period": { "date_from": "2025-03-01", "date_to": "2025-03-31" },
  "commission_count": 9,
  "total_gci_cents": 5220000,
  "by_status": [
    { "status": "draft",            "count": 2, "total_cents": 650000  },
    { "status": "pending_approval", "count": 1, "total_cents": 400000  },
    { "status": "approved",         "count": 2, "total_cents": 930000  },
    { "status": "finalized",        "count": 4, "total_cents": 3240000 }
  ],
  "by_party_type": [
    { "party_type": "team_member",    "allocation_count": 9, "total_cents": 2815500 },
    { "party_type": "external_agent", "allocation_count": 5, "total_cents": 1051000 },
    { "party_type": "brokerage",      "allocation_count": 9, "total_cents": 1353500 }
  ]
}
```

All four statuses and all three party types are always present in the response — counts default to zero if no data exists for that bucket. A period with no matching commissions returns zeros, not an error.

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

**Page-based pagination over cursor-based.** Finance uses this for month-end batch review, not infinite scroll. They need "page 2 of March" semantics, so offset pagination fits. Cursor pagination would add complexity with no benefit here.

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

**Integration tests** (`tests/integration/commissions.test.ts`) spin up the real Express app against the Docker Compose database (no mocks). They assert exact values against the known seed data documented in `db/init.sql`, including:

- Correct commission counts and GCI totals for March 2025 (all teams and team_alpha)
- February 2025 — `draft` count is 0, not missing from the response
- A period with no data (2020) returns zeros, not an error
- Allocation data embedded correctly on a specific known commission
- All filter combinations and validation error paths

---

## What I'd improve with more time

- **Cursor-based pagination** for very large datasets where deep offsets get slow.
- **Request ID / structured logging** — attach a trace ID to every request and log it with errors so ops can correlate failures.
- **OpenAPI spec** — auto-generate docs and use them to validate request/response shapes in tests.
- **DB connection health check** — a `GET /health` that pings the pool before the load balancer sends traffic.
- **Separate test database** in `docker-compose.yml` with its own volume, so integration tests can truncate/reseed without affecting the dev DB.
# node.js_payments_routes
