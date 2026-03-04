import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Customer } from './Customer.js';
import { Personnel } from './Personnel.js';
import { Part } from './Part.js';

export enum RepairStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in-progress',
  WAITING_PARTS = 'waiting_parts',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  PICKED_UP = 'picked-up',
  SCHEDULED_PICKUP = 'scheduled_pickup',
}

export enum ServiceType {
  WALK_IN = 'walk_in',
  DROP_OFF = 'drop_off',
}

@Entity('repairs')
export class Repair {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  repairNumber!: string; // e.g., "REP-2024-001"

  @Column({ type: 'uuid' })
  customerId!: string;

  @ManyToOne(() => Customer, (customer) => customer.repairs)
  @JoinColumn({ name: 'customerId' })
  // ใช้ any เพื่อเลี่ยง runtime circular metadata ระหว่าง Customer/Repair (TypeORM ยังรู้ type จาก callback)
  customer!: any;

  @Column({ type: 'uuid', nullable: true })
  assignedToId?: string;

  @ManyToOne(() => Personnel, (personnel) => personnel.repairs, { nullable: true })
  @JoinColumn({ name: 'assignedToId' })
  assignedTo?: Personnel;

  @Column({ type: 'uuid', nullable: true })
  selectedPartId?: string;

  @ManyToOne(() => Part, { nullable: true })
  @JoinColumn({ name: 'selectedPartId' })
  selectedPart?: Part;

  @Column({ type: 'text', nullable: true })
  selectedPartIds?: string; // JSON array of part IDs

  @Column({ type: 'text', nullable: true })
  additionalParts?: string; // JSON array of parts not in inventory: [{ name: string, nameTh?: string, price: number }]

  @Column({ type: 'varchar', length: 100 })
  deviceType!: string; // 'phone', 'tablet', 'laptop', etc.

  @Column({ type: 'varchar', length: 100, nullable: true })
  deviceBrand?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  deviceModel?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  deviceSerialNumber?: string;

  @Column({ type: 'varchar', length: 15, nullable: true })
  serialNumber?: string; // IMEI/Serial Number (15 digits) - ใช้สำหรับการรับประกัน (อนุญาตให้ซ้ำได้)

  @Column({ type: 'varchar', length: 50, nullable: true })
  deviceColor?: string; // สีเครื่อง

  @Column({ type: 'varchar', length: 50, nullable: true })
  screenLockCode?: string; // รหัสล็อคหน้าจอ

  @Column({ type: 'text' })
  problemDescription!: string;

  @Column({ type: 'text', nullable: true })
  problemSymptoms?: string; // อาการเสีย (ภาษาไทย)

  @Column({ type: 'text', nullable: true })
  diagnosis?: string;

  @Column({ type: 'text', nullable: true })
  repairNotes?: string;

  @Column({
    type: 'enum',
    enum: RepairStatus,
    default: RepairStatus.PENDING,
  })
  status!: RepairStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  laborCost!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  partsCost!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalCost!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: 0 })
  deposit?: number; // เงินมัดจำ

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimatedPrice?: number; // ราคาประมาณการ

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  repairSummaryPrice?: number; // ราคารวมการซ่อม

  @Column({
    type: 'enum',
    enum: ServiceType,
    nullable: true,
  })
  serviceType?: ServiceType; // walk_in หรือ drop_off

  @Column({ type: 'date', nullable: true })
  receiveDate?: Date; // วันที่รับเครื่อง (สำหรับ drop_off)

  @Column({ type: 'time', nullable: true })
  receiveTime?: string; // เวลารับเครื่อง (HH:mm)

  @Column({ type: 'timestamp', nullable: true })
  scheduledPickupTime?: Date; // วันเวลานัดรับเครื่อง

  @Column({ type: 'date', nullable: true })
  dateOfReport?: Date; // วันที่แจ้งซ่อม

  @Column({ type: 'time', nullable: true })
  timeOfReport?: string; // เวลาแจ้งซ่อม (HH:mm)

  @Column({ type: 'date', nullable: true })
  estimatedCompletionDate?: Date;

  @Column({ type: 'date', nullable: true })
  completedDate?: Date;

  @Column({ type: 'date', nullable: true })
  pickedUpDate?: Date; // วันที่ลูกค้ามารับเครื่อง (เริ่มนับประกัน)

  @Column({ type: 'text', nullable: true })
  warrantyInfo?: string;

  /** จำนวนวันรับประกัน (เริ่มนับจากวันที่รับเครื่องแล้ว / pickedUpDate) */
  @Column({ type: 'int', default: 90 })
  warrantyDays!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
