import { AppDataSource } from '../db/datasource';
import { CommissionEntity } from '../entities/Commission';
import { AllocationEntity } from '../entities/Allocation';
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
  StatusSummaryParams,
  StatusSummaryResult,
  PartyTypeSummaryParams,
  PartyTypeSummaryResult,
} from '../types';

export async function findCommissions(
  params: CommissionListParams
): Promise<CommissionListResult> {
  const { page, limit, team_id, status, date_from, date_to } = params;

  const qb = AppDataSource.getRepository(CommissionEntity)
    .createQueryBuilder('commission')
    .leftJoinAndSelect('commission.allocations', 'allocation')
    .orderBy('commission.close_date', 'DESC')
    .addOrderBy('commission.id', 'ASC')
    .addOrderBy('allocation.created_at', 'ASC')
    .skip((page - 1) * limit)
    .take(limit);

  if (team_id)   qb.andWhere('commission.team_id = :team_id',   { team_id });
  if (status)    qb.andWhere('commission.status = :status',      { status });
  if (date_from) qb.andWhere('commission.close_date >= :date_from', { date_from });
  if (date_to)   qb.andWhere('commission.close_date <= :date_to',   { date_to });

  const [entities, total] = await qb.getManyAndCount();
  console.log({ entities, total }, 'findCommissions result');

  const data: Commission[] = entities.map(entity => ({
    id: entity.id,
    team_id: entity.team_id,
    status: entity.status as CommissionStatus,
    close_date:
      typeof entity.close_date === 'string'
        ? entity.close_date
        : (entity.close_date as unknown as Date).toISOString().split('T')[0],
    total_cents: Number(entity.total_cents),
    currency: entity.currency,
    created_at: entity.created_at.toISOString(),
    updated_at: entity.updated_at.toISOString(),
    allocations: entity.allocations.map(allocation => ({
      id: allocation.id,
      party_id: allocation.party_id,
      party_type: allocation.party_type as PartyType,
      percentage: allocation.percentage,
      amount_cents: Number(allocation.amount_cents),
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
  params: PeriodSummaryParams
): Promise<PeriodSummaryResult> {
  const { date_from, date_to, team_id } = params;
  const dateParams = { date_from, date_to };

  const commissionRepo = AppDataSource.getRepository(CommissionEntity);
  const allocationRepo = AppDataSource.getRepository(AllocationEntity);

  const totalQuery = commissionRepo
    .createQueryBuilder('commission')
    .select('COUNT(*)', 'commission_count')
    .addSelect('COALESCE(SUM(commission.total_cents), 0)', 'total_gci_cents')
    .where('commission.close_date >= :date_from AND commission.close_date <= :date_to', dateParams);

  const statusQuery = commissionRepo
    .createQueryBuilder('commission')
    .select('commission.status', 'status')
    .addSelect('COUNT(*)', 'count')
    .addSelect('COALESCE(SUM(commission.total_cents), 0)', 'total_cents')
    .where('commission.close_date >= :date_from AND commission.close_date <= :date_to', dateParams)
    .groupBy('commission.status');

  const partyQuery = allocationRepo
    .createQueryBuilder('allocation')
    .innerJoin('allocation.commission', 'commission')
    .select('allocation.party_type', 'party_type')
    .addSelect('COUNT(*)', 'allocation_count')
    .addSelect('COALESCE(SUM(allocation.amount_cents), 0)', 'total_cents')
    .where('commission.close_date >= :date_from AND commission.close_date <= :date_to', dateParams)
    .groupBy('allocation.party_type');

  if (team_id) {
    totalQuery.andWhere('commission.team_id = :team_id', { team_id });
    statusQuery.andWhere('commission.team_id = :team_id', { team_id });
    partyQuery.andWhere('commission.team_id = :team_id', { team_id });
  }

  type TotalRow  = { commission_count: string; total_gci_cents: string };
  type StatusRow = { status: string; count: string; total_cents: string };
  type PartyRow  = { party_type: string; allocation_count: string; total_cents: string };

  const [totalRow, statusRows, partyRows] = await Promise.all([
    totalQuery.getRawOne<TotalRow>(),
    statusQuery.getRawMany<StatusRow>(),
    partyQuery.getRawMany<PartyRow>(),
  ]);

  const statusMap = new Map<string, { count: number; total_cents: number }>();
  for (const row of statusRows) {
    statusMap.set(row.status, {
      count: parseInt(row.count, 10),
      total_cents: Number(row.total_cents),
    });
  }

  const partyMap = new Map<string, { allocation_count: number; total_cents: number }>();
  for (const row of partyRows) {
    partyMap.set(row.party_type, {
      allocation_count: parseInt(row.allocation_count, 10),
      total_cents: Number(row.total_cents),
    });
  }

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
    commission_count: parseInt(totalRow!.commission_count, 10),
    total_gci_cents: Number(totalRow!.total_gci_cents),
    by_status,
    by_party_type,
  };
}

export async function getStatusSummary(
  params: StatusSummaryParams
): Promise<StatusSummaryResult> {
  const { date_from, date_to, status, team_id } = params;

  const qb = AppDataSource.getRepository(CommissionEntity)
    .createQueryBuilder('commission')
    .select('COUNT(*)', 'count')
    .addSelect('COALESCE(SUM(commission.total_cents), 0)', 'total_cents')
    .where('commission.close_date >= :date_from AND commission.close_date <= :date_to', { date_from, date_to })
    .andWhere('commission.status = :status', { status });

  if (team_id) qb.andWhere('commission.team_id = :team_id', { team_id });

  type Row = { count: string; total_cents: string };
  const row = await qb.getRawOne<Row>();

  return {
    period: { date_from, date_to },
    status,
    count: parseInt(row!.count, 10),
    total_cents: Number(row!.total_cents),
  };
}

export async function getPartyTypeSummary(
  params: PartyTypeSummaryParams
): Promise<PartyTypeSummaryResult> {
  const { date_from, date_to, party_type, team_id } = params;

  const qb = AppDataSource.getRepository(AllocationEntity)
    .createQueryBuilder('allocation')
    .innerJoin('allocation.commission', 'commission')
    .select('COUNT(*)', 'allocation_count')
    .addSelect('COALESCE(SUM(allocation.amount_cents), 0)', 'total_cents')
    .where('commission.close_date >= :date_from AND commission.close_date <= :date_to', { date_from, date_to })
    .andWhere('allocation.party_type = :party_type', { party_type });

  if (team_id) qb.andWhere('commission.team_id = :team_id', { team_id });

  type Row = { allocation_count: string; total_cents: string };
  const row = await qb.getRawOne<Row>();

  return {
    period: { date_from, date_to },
    party_type,
    allocation_count: parseInt(row!.allocation_count, 10),
    total_cents: Number(row!.total_cents),
  };
}
