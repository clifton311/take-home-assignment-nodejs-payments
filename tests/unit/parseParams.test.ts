import {
  parseCommissionListParams,
  parsePeriodSummaryParams,
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

  it('rejects a non-ISO date format', () => {
    const result = parsePeriodSummaryParams({
      date_from: '2025-03',
      date_to: '2025-03-31',
    });
    expect(result.ok).toBe(false);
  });
});
