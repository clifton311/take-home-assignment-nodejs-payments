import {
  parseCommissionListParams,
  parsePeriodSummaryParams,
  parseStatusSummaryParams,
  parsePartyTypeSummaryParams,
} from '../../src/utils/parseParams';

describe('parseCommissionListParams', () => {
  it('returns defaults for empty query', () => {
    const result = parseCommissionListParams({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.page).toBe(1);
    expect(result.value.limit).toBe(20);
    expect(result.value.team_id).toBeUndefined();
    expect(result.value.status).toBeUndefined();
  });

  it('accepts a valid UUID for team_id', () => {
    const result = parseCommissionListParams({
      team_id: 'a1a1a1a1-0000-4000-8000-000000000001',
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a non-UUID team_id', () => {
    const result = parseCommissionListParams({ team_id: 'not-a-uuid' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/team_id/);
  });

  it.each(['draft', 'pending_approval', 'approved', 'finalized'])(
    'accepts valid status: %s',
    status => {
      const result = parseCommissionListParams({ status });
      expect(result.ok).toBe(true);
    }
  );

  it('rejects an unknown status', () => {
    const result = parseCommissionListParams({ status: 'paid' });
    expect(result.ok).toBe(false);
  });

  it('accepts a valid date range', () => {
    const result = parseCommissionListParams({
      date_from: '2025-01-01',
      date_to: '2025-12-31',
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a non-ISO date format', () => {
    const result = parseCommissionListParams({ date_from: '01/01/2025' });
    expect(result.ok).toBe(false);
  });

  it('rejects when date_from is after date_to', () => {
    const result = parseCommissionListParams({
      date_from: '2025-12-31',
      date_to: '2025-01-01',
    });
    expect(result.ok).toBe(false);
  });

  it('parses page and limit', () => {
    const result = parseCommissionListParams({ page: '3', limit: '50' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.page).toBe(3);
    expect(result.value.limit).toBe(50);
  });

  it('rejects page < 1', () => {
    const result = parseCommissionListParams({ page: '0' });
    expect(result.ok).toBe(false);
  });

  it('rejects limit > 100', () => {
    const result = parseCommissionListParams({ limit: '101' });
    expect(result.ok).toBe(false);
  });

  it('rejects non-numeric page', () => {
    const result = parseCommissionListParams({ page: 'abc' });
    expect(result.ok).toBe(false);
  });

  it('accepts limit at lower boundary (1)', () => {
    const result = parseCommissionListParams({ limit: '1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.limit).toBe(1);
  });

  it('accepts limit at upper boundary (100)', () => {
    const result = parseCommissionListParams({ limit: '100' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.limit).toBe(100);
  });

  it('rejects limit of 0', () => {
    const result = parseCommissionListParams({ limit: '0' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/limit/);
  });

  it('rejects non-numeric limit', () => {
    const result = parseCommissionListParams({ limit: 'all' });
    expect(result.ok).toBe(false);
  });

  it('accepts date_from equal to date_to (single-day range)', () => {
    const result = parseCommissionListParams({
      date_from: '2025-03-05',
      date_to: '2025-03-05',
    });
    expect(result.ok).toBe(true);
  });

  it('accepts date_from without date_to', () => {
    const result = parseCommissionListParams({ date_from: '2025-01-01' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.date_from).toBe('2025-01-01');
    expect(result.value.date_to).toBeUndefined();
  });

  it('accepts date_to without date_from', () => {
    const result = parseCommissionListParams({ date_to: '2025-12-31' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.date_to).toBe('2025-12-31');
    expect(result.value.date_from).toBeUndefined();
  });
});

describe('parsePeriodSummaryParams', () => {
  it('accepts a valid date range', () => {
    const result = parsePeriodSummaryParams({
      date_from: '2025-03-01',
      date_to: '2025-03-31',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.date_from).toBe('2025-03-01');
    expect(result.value.date_to).toBe('2025-03-31');
  });

  it('rejects missing date_from', () => {
    const result = parsePeriodSummaryParams({ date_to: '2025-03-31' });
    expect(result.ok).toBe(false);
  });

  it('rejects missing date_to', () => {
    const result = parsePeriodSummaryParams({ date_from: '2025-03-01' });
    expect(result.ok).toBe(false);
  });

  it('rejects when date_from is after date_to', () => {
    const result = parsePeriodSummaryParams({
      date_from: '2025-03-31',
      date_to: '2025-03-01',
    });
    expect(result.ok).toBe(false);
  });

  it('accepts an optional team_id', () => {
    const result = parsePeriodSummaryParams({
      date_from: '2025-03-01',
      date_to: '2025-03-31',
      team_id: 'a1a1a1a1-0000-4000-8000-000000000001',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.team_id).toBe('a1a1a1a1-0000-4000-8000-000000000001');
  });

  it('rejects an invalid team_id UUID', () => {
    const result = parsePeriodSummaryParams({
      date_from: '2025-03-01',
      date_to: '2025-03-31',
      team_id: 'bad-id',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a non-ISO date format for date_from', () => {
    const result = parsePeriodSummaryParams({
      date_from: '2025-03',
      date_to: '2025-03-31',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/date_from/);
  });

  it('rejects a non-ISO date format for date_to', () => {
    const result = parsePeriodSummaryParams({
      date_from: '2025-03-01',
      date_to: '03/31/2025',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/date_to/);
  });

  it('accepts date_from equal to date_to (single-day range)', () => {
    const result = parsePeriodSummaryParams({
      date_from: '2025-03-05',
      date_to: '2025-03-05',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.date_from).toBe('2025-03-05');
    expect(result.value.date_to).toBe('2025-03-05');
  });
});

// ---------------------------------------------------------------------------
// parseStatusSummaryParams
// ---------------------------------------------------------------------------

describe('parseStatusSummaryParams', () => {
  const BASE = { date_from: '2025-03-01', date_to: '2025-03-31' };

  it.each(['draft', 'pending_approval', 'approved', 'finalized'])(
    'accepts valid status: %s',
    status => {
      const result = parseStatusSummaryParams({ ...BASE, status });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe(status);
      expect(result.value.date_from).toBe(BASE.date_from);
    }
  );

  it('accepts an optional team_id', () => {
    const result = parseStatusSummaryParams({
      ...BASE,
      status: 'finalized',
      team_id: 'a1a1a1a1-0000-4000-8000-000000000001',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.team_id).toBe('a1a1a1a1-0000-4000-8000-000000000001');
  });

  it('rejects missing status', () => {
    const result = parseStatusSummaryParams(BASE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/status/);
  });

  it('rejects an unknown status value', () => {
    const result = parseStatusSummaryParams({ ...BASE, status: 'paid' });
    expect(result.ok).toBe(false);
  });

  it('rejects missing date_from (inherited validation)', () => {
    const result = parseStatusSummaryParams({ date_to: '2025-03-31', status: 'draft' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/date_from/);
  });

  it('rejects missing date_to (inherited validation)', () => {
    const result = parseStatusSummaryParams({ date_from: '2025-03-01', status: 'draft' });
    expect(result.ok).toBe(false);
  });

  it('rejects an invalid team_id UUID', () => {
    const result = parseStatusSummaryParams({ ...BASE, status: 'draft', team_id: 'bad' });
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parsePartyTypeSummaryParams
// ---------------------------------------------------------------------------

describe('parsePartyTypeSummaryParams', () => {
  const BASE = { date_from: '2025-03-01', date_to: '2025-03-31' };

  it.each(['team_member', 'external_agent', 'brokerage'])(
    'accepts valid party_type: %s',
    party_type => {
      const result = parsePartyTypeSummaryParams({ ...BASE, party_type });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.party_type).toBe(party_type);
    }
  );

  it('accepts an optional team_id', () => {
    const result = parsePartyTypeSummaryParams({
      ...BASE,
      party_type: 'team_member',
      team_id: 'a1a1a1a1-0000-4000-8000-000000000001',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.team_id).toBe('a1a1a1a1-0000-4000-8000-000000000001');
  });

  it('rejects missing party_type', () => {
    const result = parsePartyTypeSummaryParams(BASE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/party_type/);
  });

  it('rejects an unknown party_type value', () => {
    const result = parsePartyTypeSummaryParams({ ...BASE, party_type: 'franchise' });
    expect(result.ok).toBe(false);
  });

  it('rejects missing date_from (inherited validation)', () => {
    const result = parsePartyTypeSummaryParams({ date_to: '2025-03-31', party_type: 'brokerage' });
    expect(result.ok).toBe(false);
  });

  it('rejects an invalid team_id UUID', () => {
    const result = parsePartyTypeSummaryParams({ ...BASE, party_type: 'brokerage', team_id: 'bad' });
    expect(result.ok).toBe(false);
  });
});

