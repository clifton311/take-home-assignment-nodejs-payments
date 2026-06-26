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

    const c = res.body.data[0];
    expect(c.id).toBe('10000000-0000-4000-8000-000000000001');
    expect(c.total_cents).toBe(500000);
    expect(c.currency).toBe('USD');
    expect(c.allocations).toHaveLength(3);

    const teamMember = c.allocations.find((a: { party_type: string }) => a.party_type === 'team_member');
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
});
