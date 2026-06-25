export type CommissionStatus = 'draft' | 'pending_approval' | 'approved' | 'finalized';
export type PartyType = 'team_member' | 'external_agent' | 'brokerage';

export const ALL_STATUSES: CommissionStatus[] = [
  'draft',
  'pending_approval',
  'approved',
  'finalized',
];
export const ALL_PARTY_TYPES: PartyType[] = ['team_member', 'external_agent', 'brokerage'];

// ---------- Domain objects ----------

export interface Allocation {
  id: string;
  party_id: string;
  party_type: PartyType;
  percentage: string;
  amount_cents: number;
}

export interface Commission {
  id: string;
  team_id: string;
  status: CommissionStatus;
  close_date: string;
  total_cents: number;
  currency: string;
  created_at: string;
  updated_at: string;
  allocations: Allocation[];
}

// ---------- Query params ----------

export interface CommissionListParams {
  team_id?: string;
  status?: CommissionStatus;
  date_from?: string;
  date_to?: string;
  page: number;
  limit: number;
}

export interface PeriodSummaryParams {
  date_from: string;
  date_to: string;
  team_id?: string;
}

// ---------- Response shapes ----------

export interface CommissionListResult {
  data: Commission[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface StatusBreakdown {
  status: CommissionStatus;
  count: number;
  total_cents: number;
}

export interface PartyTypeBreakdown {
  party_type: PartyType;
  allocation_count: number;
  total_cents: number;
}

export interface PeriodSummaryResult {
  period: { date_from: string; date_to: string };
  commission_count: number;
  total_gci_cents: number;
  by_status: StatusBreakdown[];
  by_party_type: PartyTypeBreakdown[];
}

// ---------- Error shape ----------

export interface ApiError {
  code: string;
  message: string;
}
