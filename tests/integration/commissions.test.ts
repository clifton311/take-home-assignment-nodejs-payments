import 'reflect-metadata';
import request from 'supertest';
import app from '../../src';
import { AppDataSource } from '../../src/db/datasource';

beforeAll(() => AppDataSource.initialize());
afterAll(() => AppDataSource.destroy());

// ---------------------------------------------------------------------------
// GET /api/v1/commissions — transaction detail
// ---------------------------------------------------------------------------

describe('GET /api/v1/commissions', () => {
  it('returns 25 total commissions with default pagination', async () => {
    const res = await request(app).get('/api/v1/commissions');
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(25);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(20);
    expect(res.body.pagination.total_pages).toBe(2);
    expect(res.body.data).toHaveLength(20);
  });

  it('respects page and limit', async () => {
    const res = await request(app).get('/api/v1/commissions').query({ page: 2, limit: 10 });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(10);
    expect(res.body.pagination.page).toBe(2);
  });

  it('embeds allocations on every commission', async () => {
    const res = await request(app).get('/api/v1/commissions').query({ limit: 5 });
    expect(res.status).toBe(200);
    for (const commission of res.body.data) {
      expect(Array.isArray(commission.allocations)).toBe(true);
      expect(commission.allocations.length).toBeGreaterThan(0);
    }
  });

  it('returns exact allocation data for a known commission (C01)', async () => {
    const res = await request(app).get('/api/v1/commissions').query({
      date_from: '2025-01-10',
      date_to: '2025-01-10',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);

    const commission = res.body.data[0];
    expect(commission.id).toBe('10000000-0000-4000-8000-000000000001');
    expect(commission.total_cents).toBe(500000);
    expect(commission.currency).toBe('USD');
    expect(commission.allocations).toHaveLength(3);

    const teamMember = commission.allocations.find((a: { party_type: string }) => a.party_type === 'team_member');
    expect(teamMember).toBeDefined();
    expect(teamMember.amount_cents).toBe(250000);
    expect(teamMember.percentage).toBe('0.5000');
  });

  it('filters to 9 commissions for March 2025 — all teams', async () => {
    const res = await request(app).get('/api/v1/commissions').query({
      date_from: '2025-03-01',
      date_to: '2025-03-31',
      limit: 100,
    });
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(9);
    expect(res.body.data).toHaveLength(9);
  });

  it('filters to 5 commissions for March 2025 — team_alpha', async () => {
    const res = await request(app).get('/api/v1/commissions').query({
      team_id: 'a1a1a1a1-0000-4000-8000-000000000001',
      date_from: '2025-03-01',
      date_to: '2025-03-31',
      limit: 100,
    });
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(5);
  });

  it('filters by team_id — all results belong to that team', async () => {
    const teamId = 'b2b2b2b2-0000-4000-8000-000000000002';
    const res = await request(app).get('/api/v1/commissions').query({ team_id: teamId, limit: 100 });
    expect(res.status).toBe(200);
    for (const c of res.body.data) {
      expect(c.team_id).toBe(teamId);
    }
  });

  it('filters by status — all results have that status', async () => {
    const res = await request(app).get('/api/v1/commissions').query({ status: 'finalized', limit: 100 });
    expect(res.status).toBe(200);
    for (const c of res.body.data) {
      expect(c.status).toBe('finalized');
    }
  });

  it('returns empty data for a date range with no commissions', async () => {
    const res = await request(app).get('/api/v1/commissions').query({
      date_from: '2020-01-01',
      date_to: '2020-12-31',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.pagination.total).toBe(0);
    expect(res.body.pagination.total_pages).toBe(0);
  });

  it('returns 400 for an invalid status value', async () => {
    const res = await request(app).get('/api/v1/commissions').query({ status: 'paid' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAMS');
    expect(res.body.message).toBeDefined();
  });

  it('returns 400 for a non-ISO date format', async () => {
    const res = await request(app).get('/api/v1/commissions').query({ date_from: '01-01-2025' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAMS');
  });

  it('returns 400 when date_from is after date_to', async () => {
    const res = await request(app).get('/api/v1/commissions').query({
      date_from: '2025-03-31',
      date_to: '2025-03-01',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAMS');
  });

  it('returns 400 for a non-UUID team_id', async () => {
    const res = await request(app).get('/api/v1/commissions').query({ team_id: 'bad-id' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAMS');
  });

  it('returns 400 for a non-numeric page', async () => {
    const res = await request(app).get('/api/v1/commissions').query({ page: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAMS');
  });

  it('returns 400 for a non-numeric limit', async () => {
    const res = await request(app).get('/api/v1/commissions').query({ limit: 'all' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAMS');
  });

  it('returns 400 for limit = 0', async () => {
    const res = await request(app).get('/api/v1/commissions').query({ limit: '0' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAMS');
  });

  it('returns 400 for limit > 100', async () => {
    const res = await request(app).get('/api/v1/commissions').query({ limit: '101' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAMS');
  });

  it('returns an empty page when requesting beyond total_pages', async () => {
    const res = await request(app).get('/api/v1/commissions').query({ page: 999, limit: 20 });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.pagination.page).toBe(999);
    expect(res.body.pagination.total).toBe(25);
  });

  it('respects limit = 1 (boundary)', async () => {
    const res = await request(app).get('/api/v1/commissions').query({ limit: 1 });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.limit).toBe(1);
    expect(res.body.pagination.total_pages).toBe(25);
  });

  it('returns results in close_date DESC order', async () => {
    const res = await request(app).get('/api/v1/commissions').query({ limit: 25 });
    expect(res.status).toBe(200);
    const dates: string[] = res.body.data.map((c: { close_date: string }) => c.close_date);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] <= dates[i - 1]).toBe(true);
    }
  });

  it('returns the correct response shape for each commission', async () => {
    const res = await request(app).get('/api/v1/commissions').query({ limit: 1 });
    expect(res.status).toBe(200);
    const c = res.body.data[0];
    expect(typeof c.id).toBe('string');
    expect(typeof c.team_id).toBe('string');
    expect(typeof c.status).toBe('string');
    expect(typeof c.close_date).toBe('string');
    expect(typeof c.total_cents).toBe('number');
    expect(typeof c.currency).toBe('string');
    expect(typeof c.created_at).toBe('string');
    expect(typeof c.updated_at).toBe('string');
    expect(Array.isArray(c.allocations)).toBe(true);

    const a = c.allocations[0];
    expect(typeof a.id).toBe('string');
    expect(typeof a.party_id).toBe('string');
    expect(typeof a.party_type).toBe('string');
    expect(typeof a.percentage).toBe('string');
    expect(typeof a.amount_cents).toBe('number');
  });

  it('returns a single commission for a single-day date range', async () => {
    const res = await request(app).get('/api/v1/commissions').query({
      date_from: '2025-03-05',
      date_to: '2025-03-05',
    });
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(1);
    expect(res.body.data[0].id).toBe('10000000-0000-4000-8000-000000000011');
    expect(res.body.data[0].total_cents).toBe(850000);
  });

  it('returns 404 for an unknown route', async () => {
    const res = await request(app).get('/api/v1/unknown');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/commissions/summary — period summary
// ---------------------------------------------------------------------------

describe('GET /api/v1/commissions/summary', () => {
  it('returns correct totals for March 2025 — all teams', async () => {
    const res = await request(app).get('/api/v1/commissions/summary').query({
      date_from: '2025-03-01',
      date_to: '2025-03-31',
    });
    expect(res.status).toBe(200);
    expect(res.body.commission_count).toBe(9);
    expect(res.body.total_gci_cents).toBe(5220000);
    expect(res.body.period).toEqual({ date_from: '2025-03-01', date_to: '2025-03-31' });
  });

  it('returns correct status breakdown for March 2025 — all teams', async () => {
    const res = await request(app).get('/api/v1/commissions/summary').query({
      date_from: '2025-03-01',
      date_to: '2025-03-31',
    });
    expect(res.status).toBe(200);

    const byStatus: Array<{ status: string; count: number; total_cents: number }> =
      res.body.by_status;

    expect(byStatus.find(s => s.status === 'draft')).toMatchObject({ count: 2, total_cents: 650000 });
    expect(byStatus.find(s => s.status === 'pending_approval')).toMatchObject({ count: 1, total_cents: 400000 });
    expect(byStatus.find(s => s.status === 'approved')).toMatchObject({ count: 2, total_cents: 930000 });
    expect(byStatus.find(s => s.status === 'finalized')).toMatchObject({ count: 4, total_cents: 3240000 });
  });

  it('returns correct party type breakdown for March 2025 — all teams', async () => {
    const res = await request(app).get('/api/v1/commissions/summary').query({
      date_from: '2025-03-01',
      date_to: '2025-03-31',
    });
    expect(res.status).toBe(200);

    const byParty: Array<{ party_type: string; allocation_count: number; total_cents: number }> =
      res.body.by_party_type;

    expect(byParty.find(p => p.party_type === 'team_member')).toMatchObject({
      allocation_count: 9,
      total_cents: 2815500,
    });
    expect(byParty.find(p => p.party_type === 'external_agent')).toMatchObject({
      allocation_count: 5,
      total_cents: 1051000,
    });
    expect(byParty.find(p => p.party_type === 'brokerage')).toMatchObject({
      allocation_count: 9,
      total_cents: 1353500,
    });
  });

  it('returns correct totals for March 2025 — team_alpha only', async () => {
    const res = await request(app).get('/api/v1/commissions/summary').query({
      date_from: '2025-03-01',
      date_to: '2025-03-31',
      team_id: 'a1a1a1a1-0000-4000-8000-000000000001',
    });
    expect(res.status).toBe(200);
    expect(res.body.commission_count).toBe(5);
    expect(res.body.total_gci_cents).toBe(2850000);
  });

  it('returns all four statuses for February 2025 — draft count is zero, not missing', async () => {
    const res = await request(app).get('/api/v1/commissions/summary').query({
      date_from: '2025-02-01',
      date_to: '2025-02-28',
    });
    expect(res.status).toBe(200);
    expect(res.body.commission_count).toBe(5);
    expect(res.body.total_gci_cents).toBe(2930000);

    const byStatus: Array<{ status: string; count: number; total_cents: number }> =
      res.body.by_status;
    expect(byStatus).toHaveLength(4);
    expect(byStatus.find(s => s.status === 'draft')).toMatchObject({ count: 0, total_cents: 0 });
  });

  it('returns zeros for a period with no data — not an error', async () => {
    const res = await request(app).get('/api/v1/commissions/summary').query({
      date_from: '2020-01-01',
      date_to: '2020-12-31',
    });
    expect(res.status).toBe(200);
    expect(res.body.commission_count).toBe(0);
    expect(res.body.total_gci_cents).toBe(0);

    const byStatus: Array<{ count: number }> = res.body.by_status;
    expect(byStatus).toHaveLength(4);
    byStatus.forEach(s => expect(s.count).toBe(0));

    const byParty: Array<{ allocation_count: number }> = res.body.by_party_type;
    expect(byParty).toHaveLength(3);
    byParty.forEach(p => expect(p.allocation_count).toBe(0));
  });

  it('returns 400 when date_from is missing', async () => {
    const res = await request(app)
      .get('/api/v1/commissions/summary')
      .query({ date_to: '2025-03-31' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAMS');
  });

  it('returns 400 when date_to is missing', async () => {
    const res = await request(app)
      .get('/api/v1/commissions/summary')
      .query({ date_from: '2025-03-01' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAMS');
  });

  it('returns 400 for a non-ISO date format', async () => {
    const res = await request(app).get('/api/v1/commissions/summary').query({
      date_from: '2025-03',
      date_to: '2025-03-31',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAMS');
  });

  it('returns 400 when date_from is after date_to', async () => {
    const res = await request(app).get('/api/v1/commissions/summary').query({
      date_from: '2025-03-31',
      date_to: '2025-03-01',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAMS');
  });

  it('returns 400 for a non-UUID team_id', async () => {
    const res = await request(app).get('/api/v1/commissions/summary').query({
      date_from: '2025-03-01',
      date_to: '2025-03-31',
      team_id: 'not-a-uuid',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAMS');
  });

  it('returns correct totals for a single-day range', async () => {
    const res = await request(app).get('/api/v1/commissions/summary').query({
      date_from: '2025-03-05',
      date_to: '2025-03-05',
    });
    expect(res.status).toBe(200);
    expect(res.body.commission_count).toBe(1);
    expect(res.body.total_gci_cents).toBe(850000);
  });

  it('returns correct totals for April 2025 — all teams', async () => {
    const res = await request(app).get('/api/v1/commissions/summary').query({
      date_from: '2025-04-01',
      date_to: '2025-04-30',
    });
    expect(res.status).toBe(200);
    expect(res.body.commission_count).toBe(6);
    expect(res.body.total_gci_cents).toBe(3720000);
  });

  it('returns correct totals for March 2025 — team_charlie only', async () => {
    const res = await request(app).get('/api/v1/commissions/summary').query({
      date_from: '2025-03-01',
      date_to: '2025-03-31',
      team_id: 'c3c3c3c3-0000-4000-8000-000000000003',
    });
    expect(res.status).toBe(200);
    expect(res.body.commission_count).toBe(2);
    expect(res.body.total_gci_cents).toBe(940000);
  });

  it('returns the correct response shape', async () => {
    const res = await request(app).get('/api/v1/commissions/summary').query({
      date_from: '2025-03-01',
      date_to: '2025-03-31',
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('period');
    expect(res.body).toHaveProperty('commission_count');
    expect(res.body).toHaveProperty('total_gci_cents');
    expect(Array.isArray(res.body.by_status)).toBe(true);
    expect(Array.isArray(res.body.by_party_type)).toBe(true);

    const s = res.body.by_status[0];
    expect(typeof s.status).toBe('string');
    expect(typeof s.count).toBe('number');
    expect(typeof s.total_cents).toBe('number');

    const p = res.body.by_party_type[0];
    expect(typeof p.party_type).toBe('string');
    expect(typeof p.allocation_count).toBe('number');
    expect(typeof p.total_cents).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/commissions/summary/by-status
// ---------------------------------------------------------------------------

describe('GET /api/v1/commissions/summary/by-status', () => {
  const BASE = { date_from: '2025-03-01', date_to: '2025-03-31' };

  it('returns correct count and total for finalized in March 2025', async () => {
    const res = await request(app)
      .get('/api/v1/commissions/summary/by-status')
      .query({ ...BASE, status: 'finalized' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('finalized');
    expect(res.body.count).toBe(4);
    expect(res.body.total_cents).toBe(3240000);
    expect(res.body.period).toEqual(BASE);
  });

  it('returns correct count and total for draft in March 2025', async () => {
    const res = await request(app)
      .get('/api/v1/commissions/summary/by-status')
      .query({ ...BASE, status: 'draft' });
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.total_cents).toBe(650000);
  });

  it('returns zeros for a status with no data in the period', async () => {
    const res = await request(app)
      .get('/api/v1/commissions/summary/by-status')
      .query({ date_from: '2025-02-01', date_to: '2025-02-28', status: 'draft' });
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.total_cents).toBe(0);
  });

  it('filters by team_id — team_alpha finalized in March 2025', async () => {
    const res = await request(app)
      .get('/api/v1/commissions/summary/by-status')
      .query({ ...BASE, status: 'finalized', team_id: 'a1a1a1a1-0000-4000-8000-000000000001' });
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.total_cents).toBe(1470000);
  });

  it('returns 400 when status is missing', async () => {
    const res = await request(app)
      .get('/api/v1/commissions/summary/by-status')
      .query(BASE);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAMS');
    expect(res.body.message).toMatch(/status/);
  });

  it('returns 400 for an unknown status value', async () => {
    const res = await request(app)
      .get('/api/v1/commissions/summary/by-status')
      .query({ ...BASE, status: 'paid' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAMS');
  });

  it('returns 400 when date_from is missing', async () => {
    const res = await request(app)
      .get('/api/v1/commissions/summary/by-status')
      .query({ date_to: '2025-03-31', status: 'draft' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAMS');
  });

  it('returns 400 when date_from is after date_to', async () => {
    const res = await request(app)
      .get('/api/v1/commissions/summary/by-status')
      .query({ date_from: '2025-03-31', date_to: '2025-03-01', status: 'draft' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAMS');
  });

  it('returns 400 for a non-UUID team_id', async () => {
    const res = await request(app)
      .get('/api/v1/commissions/summary/by-status')
      .query({ ...BASE, status: 'draft', team_id: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAMS');
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/commissions/summary/by-party-type
// ---------------------------------------------------------------------------

describe('GET /api/v1/commissions/summary/by-party-type', () => {
  const BASE = { date_from: '2025-03-01', date_to: '2025-03-31' };

  it('returns correct allocation_count and total for team_member in March 2025', async () => {
    const res = await request(app)
      .get('/api/v1/commissions/summary/by-party-type')
      .query({ ...BASE, party_type: 'team_member' });
    expect(res.status).toBe(200);
    expect(res.body.party_type).toBe('team_member');
    expect(res.body.allocation_count).toBe(9);
    expect(res.body.total_cents).toBe(2815500);
    expect(res.body.period).toEqual(BASE);
  });

  it('returns correct totals for external_agent in March 2025', async () => {
    const res = await request(app)
      .get('/api/v1/commissions/summary/by-party-type')
      .query({ ...BASE, party_type: 'external_agent' });
    expect(res.status).toBe(200);
    expect(res.body.allocation_count).toBe(5);
    expect(res.body.total_cents).toBe(1051000);
  });

  it('returns correct totals for brokerage in March 2025', async () => {
    const res = await request(app)
      .get('/api/v1/commissions/summary/by-party-type')
      .query({ ...BASE, party_type: 'brokerage' });
    expect(res.status).toBe(200);
    expect(res.body.allocation_count).toBe(9);
    expect(res.body.total_cents).toBe(1353500);
  });

  it('returns zeros for a period with no data', async () => {
    const res = await request(app)
      .get('/api/v1/commissions/summary/by-party-type')
      .query({ date_from: '2020-01-01', date_to: '2020-12-31', party_type: 'team_member' });
    expect(res.status).toBe(200);
    expect(res.body.allocation_count).toBe(0);
    expect(res.body.total_cents).toBe(0);
  });

  it('filters by team_id — team_alpha team_member in March 2025', async () => {
    const res = await request(app)
      .get('/api/v1/commissions/summary/by-party-type')
      .query({ ...BASE, party_type: 'team_member', team_id: 'a1a1a1a1-0000-4000-8000-000000000001' });
    expect(res.status).toBe(200);
    expect(res.body.allocation_count).toBe(5);
    expect(res.body.total_cents).toBe(1548500);
  });

  it('returns 400 when party_type is missing', async () => {
    const res = await request(app)
      .get('/api/v1/commissions/summary/by-party-type')
      .query(BASE);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAMS');
    expect(res.body.message).toMatch(/party_type/);
  });

  it('returns 400 for an unknown party_type value', async () => {
    const res = await request(app)
      .get('/api/v1/commissions/summary/by-party-type')
      .query({ ...BASE, party_type: 'franchise' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAMS');
  });

  it('returns 400 when date_to is missing', async () => {
    const res = await request(app)
      .get('/api/v1/commissions/summary/by-party-type')
      .query({ date_from: '2025-03-01', party_type: 'brokerage' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAMS');
  });

  it('returns 400 for a non-UUID team_id', async () => {
    const res = await request(app)
      .get('/api/v1/commissions/summary/by-party-type')
      .query({ ...BASE, party_type: 'brokerage', team_id: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAMS');
  });
});
