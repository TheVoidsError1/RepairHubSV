import { translations } from './translations';

export type RepairStatusValue = 
  | 'pending' 
  | 'in-progress' 
  | 'waiting_parts' 
  | 'completed' 
  | 'cancelled' 
  | 'picked-up' 
  | 'scheduled_pickup';

/**
 * Get status label in Thai or English
 */
export function getRepairStatusLabel(status: RepairStatusValue, language: 'th' | 'en' = 'th'): string {
  const t = translations[language];
  
  switch (status) {
    case 'pending':
      return language === 'th' ? 'รอดำเนินการ' : t.pending;
    case 'in-progress':
      return language === 'th' ? 'กำลังซ่อม' : t.inProgress;
    case 'waiting_parts':
      return language === 'th' ? 'รออะไหล่' : 'Waiting Parts';
    case 'completed':
      return language === 'th' ? 'ซ่อมเสร็จแล้ว' : t.completed;
    case 'cancelled':
      return language === 'th' ? 'ยกเลิกงานซ่อม' : t.cancelled;
    case 'picked-up':
      return language === 'th' ? 'รับเครื่องแล้ว' : t.pickedUp;
    case 'scheduled_pickup':
      return language === 'th' ? 'นัดรับเครื่อง' : 'Scheduled Pickup';
    default:
      return status;
  }
}

/**
 * Get status label for display (shorter version)
 */
export function getRepairStatusDisplayLabel(status: RepairStatusValue, language: 'th' | 'en' = 'th'): string {
  const t = translations[language];
  
  switch (status) {
    case 'pending':
      return language === 'th' ? 'รอดำเนินการ' : t.pending;
    case 'in-progress':
      return language === 'th' ? 'กำลังซ่อม' : t.inProgress;
    case 'waiting_parts':
      return language === 'th' ? 'รออะไหล่' : 'Waiting Parts';
    case 'completed':
      return language === 'th' ? 'เสร็จสิ้น' : t.completed;
    case 'cancelled':
      return language === 'th' ? 'ยกเลิก' : t.cancelled;
    case 'picked-up':
      return language === 'th' ? 'รับเครื่องแล้ว' : t.pickedUp;
    case 'scheduled_pickup':
      return language === 'th' ? 'นัดรับ' : 'Scheduled';
    default:
      return status;
  }
}
