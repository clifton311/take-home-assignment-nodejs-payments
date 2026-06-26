import {
  Entity,
  PrimaryColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CommissionStatus } from '../types';
import { AllocationEntity } from './Allocation';

@Entity('commissions')
export class CommissionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'team_id', type: 'uuid' })
  team_id!: string;

  @Column({ type: 'varchar', length: 30 })
  status!: CommissionStatus;

  @Column({ name: 'close_date', type: 'date' })
  close_date!: string;

  @Column({ name: 'total_cents', type: 'bigint' })
  total_cents!: string;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at!: Date;

  @OneToMany(() => AllocationEntity, (allocation) => allocation.commission)
  allocations!: AllocationEntity[];
}
