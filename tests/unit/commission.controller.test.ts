import { Request, Response } from 'express';

jest.mock('../../src/models/commission.model');
jest.mock('../../src/logger', () => ({ logger: { error: jest.fn() } }));

import { listCommissions, periodSummary, statusSummary, partyTypeSummary } from '../../src/controllers/commission';
import * as model from '../../src/models/commission.model';

const findCommissions = model.findCommissions as jest.MockedFunction<typeof model.findCommissions>;
const getPeriodSummary = model.getPeriodSummary as jest.MockedFunction<typeof model.getPeriodSummary>;
const getStatusSummary = model.getStatusSummary as jest.MockedFunction<typeof model.getStatusSummary>;
const getPartyTypeSummary = model.getPartyTypeSummary as jest.MockedFunction<typeof model.getPartyTypeSummary>;

function makeReq(query: Record<string, string> = {}): Request {
  return { query } as unknown as Request;
}

function makeRes() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res as unknown as Response & { status: jest.Mock; json: jest.Mock };
}

// ---------------------------------------------------------------------------
// listCommissions
// ---------------------------------------------------------------------------

describe('listCommissions controller', () => {
  beforeEach(() => jest.clearAllMocks());

  // --- positive ---

  it('calls findCommissions with parsed defaults and returns 200', async () => {
    const mockResult = {
      data: [],
      pagination: { page: 1, limit: 20, total: 0, total_pages: 0 },
    };
    findCommissions.mockResolvedValue(mockResult);

    const res = makeRes();
    await listCommissions(makeReq(), res);

    expect(findCommissions).toHaveBeenCalledTimes(1);
    expect(findCommissions).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockResult);
  });

  it('forwards team_id, status, and date filters to findCommissions', async () => {
    findCommissions.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });

    await listCommissions(
      makeReq({
        team_id: 'a1a1a1a1-0000-4000-8000-000000000001',
        status: 'finalized',
        date_from: '2025-03-01',
        date_to: '2025-03-31',
        page: '2',
        limit: '10',
      }),
      makeRes()
    );

    expect(findCommissions).toHaveBeenCalledWith(
      expect.objectContaining({
        team_id: 'a1a1a1a1-0000-4000-8000-000000000001',
        status: 'finalized',
        date_from: '2025-03-01',
        date_to: '2025-03-31',
        page: 2,
        limit: 10,
      })
    );
  });

  // --- negative ---

  it('returns 400 INVALID_PARAMS for an unrecognised status', async () => {
    const res = makeRes();
    await listCommissions(makeReq({ status: 'paid' }), res);

    expect(findCommissions).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_PARAMS' })
    );
  });

  it('returns 400 INVALID_PARAMS for a non-UUID team_id', async () => {
    const res = makeRes();
    await listCommissions(makeReq({ team_id: 'not-a-uuid' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_PARAMS' })
    );
  });

  it('returns 400 INVALID_PARAMS when date_from is after date_to', async () => {
    const res = makeRes();
    await listCommissions(
      makeReq({ date_from: '2025-12-31', date_to: '2025-01-01' }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 INVALID_PARAMS for page < 1', async () => {
    const res = makeRes();
    await listCommissions(makeReq({ page: '0' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_PARAMS' })
    );
  });

  it('returns 400 INVALID_PARAMS for limit > 100', async () => {
    const res = makeRes();
    await listCommissions(makeReq({ limit: '101' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 INTERNAL_ERROR when findCommissions throws', async () => {
    findCommissions.mockRejectedValue(new Error('DB connection lost'));

    const res = makeRes();
    await listCommissions(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INTERNAL_ERROR' })
    );
  });
});

// ---------------------------------------------------------------------------
// periodSummary
// ---------------------------------------------------------------------------

describe('periodSummary controller', () => {
  beforeEach(() => jest.clearAllMocks());

  const MOCK_SUMMARY = {
    period: { date_from: '2025-03-01', date_to: '2025-03-31' },
    commission_count: 9,
    total_gci_cents: 5220000,
    by_status: [],
    by_party_type: [],
  };

  // --- positive ---

  it('calls getPeriodSummary with parsed params and returns 200', async () => {
    getPeriodSummary.mockResolvedValue(MOCK_SUMMARY);

    const res = makeRes();
    await periodSummary(
      makeReq({ date_from: '2025-03-01', date_to: '2025-03-31' }),
      res
    );

    expect(getPeriodSummary).toHaveBeenCalledTimes(1);
    expect(getPeriodSummary).toHaveBeenCalledWith(
      expect.objectContaining({ date_from: '2025-03-01', date_to: '2025-03-31' })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(MOCK_SUMMARY);
  });

  it('forwards optional team_id to getPeriodSummary', async () => {
    getPeriodSummary.mockResolvedValue(MOCK_SUMMARY);

    await periodSummary(
      makeReq({
        date_from: '2025-03-01',
        date_to: '2025-03-31',
        team_id: 'a1a1a1a1-0000-4000-8000-000000000001',
      }),
      makeRes()
    );

    expect(getPeriodSummary).toHaveBeenCalledWith(
      expect.objectContaining({ team_id: 'a1a1a1a1-0000-4000-8000-000000000001' })
    );
  });

  // --- negative ---

  it('returns 400 INVALID_PARAMS when date_from is missing', async () => {
    const res = makeRes();
    await periodSummary(makeReq({ date_to: '2025-03-31' }), res);

    expect(getPeriodSummary).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_PARAMS' })
    );
  });

  it('returns 400 INVALID_PARAMS when date_to is missing', async () => {
    const res = makeRes();
    await periodSummary(makeReq({ date_from: '2025-03-01' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 INVALID_PARAMS when date_from is after date_to', async () => {
    const res = makeRes();
    await periodSummary(
      makeReq({ date_from: '2025-03-31', date_to: '2025-03-01' }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 INVALID_PARAMS for a non-UUID team_id', async () => {
    const res = makeRes();
    await periodSummary(
      makeReq({ date_from: '2025-03-01', date_to: '2025-03-31', team_id: 'bad' }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 INTERNAL_ERROR when getPeriodSummary throws', async () => {
    getPeriodSummary.mockRejectedValue(new Error('DB timeout'));

    const res = makeRes();
    await periodSummary(
      makeReq({ date_from: '2025-03-01', date_to: '2025-03-31' }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INTERNAL_ERROR' })
    );
  });
});

// ---------------------------------------------------------------------------
// statusSummary
// ---------------------------------------------------------------------------

describe('statusSummary controller', () => {
  beforeEach(() => jest.clearAllMocks());

  const MOCK_RESULT = {
    period: { date_from: '2025-03-01', date_to: '2025-03-31' },
    status: 'finalized' as const,
    count: 4,
    total_cents: 3240000,
  };

  // --- positive ---

  it('calls getStatusSummary with parsed params and returns 200', async () => {
    getStatusSummary.mockResolvedValue(MOCK_RESULT);

    const res = makeRes();
    await statusSummary(
      makeReq({ date_from: '2025-03-01', date_to: '2025-03-31', status: 'finalized' }),
      res
    );

    expect(getStatusSummary).toHaveBeenCalledTimes(1);
    expect(getStatusSummary).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'finalized', date_from: '2025-03-01' })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(MOCK_RESULT);
  });

  it('forwards optional team_id to getStatusSummary', async () => {
    getStatusSummary.mockResolvedValue(MOCK_RESULT);

    await statusSummary(
      makeReq({
        date_from: '2025-03-01',
        date_to: '2025-03-31',
        status: 'finalized',
        team_id: 'a1a1a1a1-0000-4000-8000-000000000001',
      }),
      makeRes()
    );

    expect(getStatusSummary).toHaveBeenCalledWith(
      expect.objectContaining({ team_id: 'a1a1a1a1-0000-4000-8000-000000000001' })
    );
  });

  // --- negative ---

  it('returns 400 INVALID_PARAMS when status is missing', async () => {
    const res = makeRes();
    await statusSummary(
      makeReq({ date_from: '2025-03-01', date_to: '2025-03-31' }),
      res
    );

    expect(getStatusSummary).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_PARAMS' })
    );
  });

  it('returns 400 INVALID_PARAMS for an unknown status', async () => {
    const res = makeRes();
    await statusSummary(
      makeReq({ date_from: '2025-03-01', date_to: '2025-03-31', status: 'paid' }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 INVALID_PARAMS when date_from is missing', async () => {
    const res = makeRes();
    await statusSummary(makeReq({ date_to: '2025-03-31', status: 'draft' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 INTERNAL_ERROR when getStatusSummary throws', async () => {
    getStatusSummary.mockRejectedValue(new Error('DB down'));

    const res = makeRes();
    await statusSummary(
      makeReq({ date_from: '2025-03-01', date_to: '2025-03-31', status: 'draft' }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INTERNAL_ERROR' })
    );
  });
});

// ---------------------------------------------------------------------------
// partyTypeSummary
// ---------------------------------------------------------------------------

describe('partyTypeSummary controller', () => {
  beforeEach(() => jest.clearAllMocks());

  const MOCK_RESULT = {
    period: { date_from: '2025-03-01', date_to: '2025-03-31' },
    party_type: 'team_member' as const,
    allocation_count: 9,
    total_cents: 2815500,
  };

  // --- positive ---

  it('calls getPartyTypeSummary with parsed params and returns 200', async () => {
    getPartyTypeSummary.mockResolvedValue(MOCK_RESULT);

    const res = makeRes();
    await partyTypeSummary(
      makeReq({ date_from: '2025-03-01', date_to: '2025-03-31', party_type: 'team_member' }),
      res
    );

    expect(getPartyTypeSummary).toHaveBeenCalledTimes(1);
    expect(getPartyTypeSummary).toHaveBeenCalledWith(
      expect.objectContaining({ party_type: 'team_member', date_from: '2025-03-01' })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(MOCK_RESULT);
  });

  it('forwards optional team_id to getPartyTypeSummary', async () => {
    getPartyTypeSummary.mockResolvedValue(MOCK_RESULT);

    await partyTypeSummary(
      makeReq({
        date_from: '2025-03-01',
        date_to: '2025-03-31',
        party_type: 'team_member',
        team_id: 'a1a1a1a1-0000-4000-8000-000000000001',
      }),
      makeRes()
    );

    expect(getPartyTypeSummary).toHaveBeenCalledWith(
      expect.objectContaining({ team_id: 'a1a1a1a1-0000-4000-8000-000000000001' })
    );
  });

  // --- negative ---

  it('returns 400 INVALID_PARAMS when party_type is missing', async () => {
    const res = makeRes();
    await partyTypeSummary(
      makeReq({ date_from: '2025-03-01', date_to: '2025-03-31' }),
      res
    );

    expect(getPartyTypeSummary).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_PARAMS' })
    );
  });

  it('returns 400 INVALID_PARAMS for an unknown party_type', async () => {
    const res = makeRes();
    await partyTypeSummary(
      makeReq({ date_from: '2025-03-01', date_to: '2025-03-31', party_type: 'franchise' }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 INVALID_PARAMS when date_to is missing', async () => {
    const res = makeRes();
    await partyTypeSummary(
      makeReq({ date_from: '2025-03-01', party_type: 'brokerage' }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 INTERNAL_ERROR when getPartyTypeSummary throws', async () => {
    getPartyTypeSummary.mockRejectedValue(new Error('DB down'));

    const res = makeRes();
    await partyTypeSummary(
      makeReq({ date_from: '2025-03-01', date_to: '2025-03-31', party_type: 'brokerage' }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INTERNAL_ERROR' })
    );
  });
});
