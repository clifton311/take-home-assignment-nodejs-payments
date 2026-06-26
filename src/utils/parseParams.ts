import {
  CommissionStatus,
  CommissionListParams,
  PartyType,
  PartyTypeSummaryParams,
  PeriodSummaryParams,
  StatusSummaryParams,
} from '../types';

const VALID_STATUSES = new Set<string>([
  'draft',
  'pending_approval',
  'approved',
  'finalized',
]);

const VALID_PARTY_TYPES = new Set<string>([
  'team_member',
  'external_agent',
  'brokerage',
]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseCommissionListParams(
  query: Record<string, unknown>
): ParseResult<CommissionListParams> {
  const { team_id, status, date_from, date_to, page: pageStr, limit: limitStr } = query;

  if (team_id !== undefined && (typeof team_id !== 'string' || !UUID_RE.test(team_id))) {
    return { ok: false, error: 'team_id must be a valid UUID' };
  }
  if (status !== undefined && (typeof status !== 'string' || !VALID_STATUSES.has(status))) {
    return {
      ok: false,
      error: 'status must be one of: draft, pending_approval, approved, finalized',
    };
  }
  if (date_from !== undefined && (typeof date_from !== 'string' || !DATE_RE.test(date_from))) {
    return { ok: false, error: 'date_from must be a date in YYYY-MM-DD format' };
  }
  if (date_to !== undefined && (typeof date_to !== 'string' || !DATE_RE.test(date_to))) {
    return { ok: false, error: 'date_to must be a date in YYYY-MM-DD format' };
  }
  if (typeof date_from === 'string' && typeof date_to === 'string' && date_from > date_to) {
    return { ok: false, error: 'date_from must not be after date_to' };
  }

  const page = pageStr !== undefined ? parseInt(pageStr as string, 10) : 1;
  const limit = limitStr !== undefined ? parseInt(limitStr as string, 10) : 20;

  if (isNaN(page) || page < 1) {
    return { ok: false, error: 'page must be a positive integer' };
  }
  if (isNaN(limit) || limit < 1 || limit > 100) {
    return { ok: false, error: 'limit must be between 1 and 100' };
  }

  return {
    ok: true,
    value: {
      team_id: team_id as string | undefined,
      status: status as CommissionStatus | undefined,
      date_from: date_from as string | undefined,
      date_to: date_to as string | undefined,
      page,
      limit,
    },
  };
}

export function parsePeriodSummaryParams(
  query: Record<string, unknown>
): ParseResult<PeriodSummaryParams> {
  const { date_from, date_to, team_id } = query;

  if (!date_from || typeof date_from !== 'string' || !DATE_RE.test(date_from)) {
    return { ok: false, error: 'date_from is required and must be a date in YYYY-MM-DD format' };
  }
  if (!date_to || typeof date_to !== 'string' || !DATE_RE.test(date_to)) {
    return { ok: false, error: 'date_to is required and must be a date in YYYY-MM-DD format' };
  }
  if (date_from > date_to) {
    return { ok: false, error: 'date_from must not be after date_to' };
  }
  if (team_id !== undefined && (typeof team_id !== 'string' || !UUID_RE.test(team_id))) {
    return { ok: false, error: 'team_id must be a valid UUID' };
  }

  return {
    ok: true,
    value: {
      date_from,
      date_to,
      team_id: team_id as string | undefined,
    },
  };
}

export function parseStatusSummaryParams(
  query: Record<string, unknown>
): ParseResult<StatusSummaryParams> {
  const base = parsePeriodSummaryParams(query);
  if (!base.ok) return base;

  const { status } = query;
  if (!status || typeof status !== 'string' || !VALID_STATUSES.has(status)) {
    return {
      ok: false,
      error: 'status is required and must be one of: draft, pending_approval, approved, finalized',
    };
  }

  return {
    ok: true,
    value: { ...base.value, status: status as CommissionStatus },
  };
}

export function parsePartyTypeSummaryParams(
  query: Record<string, unknown>
): ParseResult<PartyTypeSummaryParams> {
  const base = parsePeriodSummaryParams(query);
  if (!base.ok) return base;

  const { party_type } = query;
  if (!party_type || typeof party_type !== 'string' || !VALID_PARTY_TYPES.has(party_type)) {
    return {
      ok: false,
      error: 'party_type is required and must be one of: team_member, external_agent, brokerage',
    };
  }

  return {
    ok: true,
    value: { ...base.value, party_type: party_type as PartyType },
  };
}
