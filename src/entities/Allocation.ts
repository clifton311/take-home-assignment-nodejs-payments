import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { PartyType } from '../types';
import { CommissionEntity } from './Commission';

@Entity('allocations')
export class AllocationEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @ManyToOne(() => CommissionEntity, (commission) => commission.allocations)
  @JoinColumn({ name: 'commission_id' })
  commission!: CommissionEntity;

  @Column({ name: 'party_id', type: 'uuid' })
  party_id!: string;

  @Column({ name: 'party_type', type: 'varchar', length: 30 })
  party_type!: PartyType;

  @Column({ type: 'decimal', precision: 6, scale: 4 })
  percentage!: string;

  @Column({ name: 'amount_cents', type: 'bigint' })
  amount_cents!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;
}
