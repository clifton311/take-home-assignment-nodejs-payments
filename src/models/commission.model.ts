import { Pool } from 'pg';
import {
  CommissionListParams,
  CommissionListResult,
  Commission,
  CommissionStatus,
  PartyType,
  PeriodSummaryParams,
  PeriodSummaryResult,
  StatusBreakdown,
  PartyTypeBreakdown,
  ALL_STATUSES,
  ALL_PARTY_TYPES,
} from '../types';



interface WhereClause {
  sql: string;
  values: unknown[];
  nextIdx: number;
}

function buildCommissionWhere(
  params: Pick<CommissionListParams, 'team_id' | 'status' | 'date_from' | 'date_to'>,
  alias = 'c',
  startIdx = 1
): WhereClause {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = startIdx;

  if (params.team_id) {
    conditions.push(`${alias}.team_id = $${idx++}`);
    values.push(params.team_id);
  }
  if (params.status) {
    conditions.push(`${alias}.status = $${idx++}`);
    values.push(params.status);
  }
  if (params.date_from) {
    conditions.push(`${alias}.close_date >= $${idx++}`);
    values.push(params.date_from);
  }
  if (params.date_to) {
    conditions.push(`${alias}.close_date <= $${idx++}`);
    values.push(params.date_to);
  }

  return {
    sql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
    nextIdx: idx,
  };
}

// ---------------------------------------------------------------------------
// Model functions
// ---------------------------------------------------------------------------

export async function findCommissions(
  pool: Pool,
  params: CommissionListParams
): Promise<CommissionListResult> {
  const { page, limit } = params;
  const offset = (page - 1) * limit;
  const { sql: where, values, nextIdx } = buildCommissionWhere(params);

  // Run count and data fetch in parallel — single JOIN with json_agg avoids N+1
  const [countResult, dataResult] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS count FROM commissions c ${where}`, values),
    pool.query(
      `SELECT
         c.id,
         c.team_id,
         c.status,
         c.close_date::text        AS close_date,
         c.total_cents,
         c.currency,
         c.created_at,
         c.updated_at,
         COALESCE(
           json_agg(
             json_build_object(
               'id',           a.id,
               'party_id',     a.party_id,
               'party_type',   a.party_type,
               'percentage',   a.percentage::text,
               'amount_cents', a.amount_cents
             ) ORDER BY a.created_at
           ) FILTER (WHERE a.id IS NOT NULL),
           '[]'::json
         ) AS allocations
       FROM commissions c
       LEFT JOIN allocations a ON a.commission_id = c.id
       ${where}
       GROUP BY c.id
       ORDER BY c.close_date DESC, c.id
       LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
      [...values, limit, offset]
    ),
  ]);

  const total = parseInt(countResult.rows[0].count as string, 10);

  const data: Commission[] = dataResult.rows.map(row => ({
    id: row.id as string,
    team_id: row.team_id as string,
    status: row.status as CommissionStatus,
    close_date: row.close_date as string,
    total_cents: Number(row.total_cents),
    currency: row.currency as string,
    created_at: (row.created_at as Date).toISOString(),
    updated_at: (row.updated_at as Date).toISOString(),
    allocations: (
      row.allocations as Array<{
        id: string;
        party_id: string;
        party_type: string;
        percentage: string;
        amount_cents: number;
      }>
    ).map(a => ({
      id: a.id,
      party_id: a.party_id,
      party_type: a.party_type as PartyType,
      percentage: a.percentage,
      amount_cents: Number(a.amount_cents),
    })),
  }));

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
}

export async function getPeriodSummary(
  pool: Pool,
  params: PeriodSummaryParams
): Promise<PeriodSummaryResult> {
  const { date_from, date_to, team_id } = params;

  // Fixed positional params: $1=date_from, $2=date_to, optional $3=team_id
  const baseValues: unknown[] = [date_from, date_to];
  const teamCondition = team_id ? 'AND c.team_id = $3' : '';
  if (team_id) baseValues.push(team_id);

  const dateRange = 'c.close_date >= $1 AND c.close_date <= $2';

  const [totalResult, statusResult, partyResult] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*)                        AS commission_count,
         COALESCE(SUM(c.total_cents), 0) AS total_gci_cents
       FROM commissions c
       WHERE ${dateRange} ${teamCondition}`,
      baseValues
    ),
    pool.query(
      `SELECT
         c.status,
         COUNT(*)                        AS count,
         COALESCE(SUM(c.total_cents), 0) AS total_cents
       FROM commissions c
       WHERE ${dateRange} ${teamCondition}
       GROUP BY c.status`,
      baseValues
    ),
    pool.query(
      `SELECT
         a.party_type,
         COUNT(*)                         AS allocation_count,
         COALESCE(SUM(a.amount_cents), 0) AS total_cents
       FROM allocations a
       JOIN commissions c ON c.id = a.commission_id
       WHERE ${dateRange} ${teamCondition}
       GROUP BY a.party_type`,
      baseValues
    ),
  ]);

  const statusMap = new Map<string, { count: number; total_cents: number }>();
  for (const row of statusResult.rows) {
    statusMap.set(row.status as string, {
      count: parseInt(row.count as string, 10),
      total_cents: Number(row.total_cents),
    });
  }

  const partyMap = new Map<string, { allocation_count: number; total_cents: number }>();
  for (const row of partyResult.rows) {
    partyMap.set(row.party_type as string, {
      allocation_count: parseInt(row.allocation_count as string, 10),
      total_cents: Number(row.total_cents),
    });
  }

  // Always include every status/party type even if count is zero
  const by_status: StatusBreakdown[] = ALL_STATUSES.map(status => ({
    status,
    count: statusMap.get(status)?.count ?? 0,
    total_cents: statusMap.get(status)?.total_cents ?? 0,
  }));

  const by_party_type: PartyTypeBreakdown[] = ALL_PARTY_TYPES.map(party_type => ({
    party_type,
    allocation_count: partyMap.get(party_type)?.allocation_count ?? 0,
    total_cents: partyMap.get(party_type)?.total_cents ?? 0,
  }));

  return {
    period: { date_from, date_to },
    commission_count: parseInt(totalResult.rows[0].commission_count as string, 10),
    total_gci_cents: Number(totalResult.rows[0].total_gci_cents),
    by_status,
    by_party_type,
  };
}
