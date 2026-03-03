import { Router } from 'express';
import { Between, In } from 'typeorm';
import { AppDataSource } from '../config/data-source.js';
import { emitRepairCreated, emitRepairDeleted, emitRepairUpdate, emitWarrantyCreated } from '../config/socket.js';
import { Customer } from '../entities/Customer.js';
import { Part } from '../entities/Part.js';
import { Repair, RepairStatus, ServiceType } from '../entities/Repair.js';
import { Transaction } from '../entities/Transaction.js';
import { WarrantyClaim, WarrantyClaimStatus } from '../entities/WarrantyClaim.js';
import { getLineNotificationService } from '../services/line-notification.service.js';
import { normalizePhone } from '../utils/phone.js';

const router = Router();

const ALLOWED_WARRANTY_DAYS = [30, 90, 180, 365] as const;
function isAllowedWarrantyDays(v: unknown): v is (typeof ALLOWED_WARRANTY_DAYS)[number] {
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) && (ALLOWED_WARRANTY_DAYS as readonly number[]).includes(n);
}

// Helper function to generate warranty claim number (WRN-001, WRN-002, etc.)
async function generateClaimNumber(): Promise<string> {
  const warrantyRepository = AppDataSource.getRepository(WarrantyClaim);
  const claims = await warrantyRepository.find({
    order: { createdAt: 'DESC' },
    take: 1,
  });
  
  const lastClaim = claims[0];

  if (!lastClaim) {
    return 'WRN-001';
  }

  const match = lastClaim.claimNumber.match(/^WRN-(\d+)$/);
  if (match) {
    const num = parseInt(match[1], 10);
    return `WRN-${String(num + 1).padStart(3, '0')}`;
  }

  // Fallback if format doesn't match
  const allClaims = await warrantyRepository.find();
  return `WRN-${String(allClaims.length + 1).padStart(3, '0')}`;
}

// Helper function to create warranty claim automatically when customer picked up the repaired device
async function createAutoWarrantyClaim(repair: Repair): Promise<void> {
  try {
    const warrantyRepository = AppDataSource.getRepository(WarrantyClaim);
    
    // ตรวจสอบว่ามี warranty claim สำหรับ repair นี้อยู่แล้วหรือไม่
    const existingClaim = await warrantyRepository.findOne({
      where: { repairId: repair.id },
    });

    if (existingClaim) {
      console.log(`[Warranty] Warranty claim already exists for repair ${repair.repairNumber}, skipping auto-creation`);
      return;
    }

    // ตรวจสอบว่างานซ่อมมี serialNumber หรือไม่ (ถ้าไม่มีจะไม่สร้าง claim)
    if (!repair.serialNumber || !repair.serialNumber.trim()) {
      console.log(`[Warranty] Repair ${repair.repairNumber} has no serial number, skipping auto warranty claim creation`);
      return;
    }

    // สร้าง warranty claim อัตโนมัติ
    const claimNumber = await generateClaimNumber();
    
    // ใช้ข้อความเริ่มต้นสำหรับ warranty claim
    const deviceInfo = repair.deviceModel || repair.deviceType || 'อุปกรณ์';
    const claimReason = `Warranty coverage for ${deviceInfo} repair`;
    const claimReasonTh = `การรับประกันการซ่อม${deviceInfo}`;

    const newClaim = warrantyRepository.create({
      claimNumber,
      repairId: repair.id,
      serialNumber: repair.serialNumber,
      claimReason: claimReason.trim(),
      claimReasonTh: claimReasonTh.trim(),
      status: WarrantyClaimStatus.APPROVED, // เปลี่ยนเป็น APPROVED เพื่อให้ใช้งานได้ทันที
      // เริ่มนับประกัน/การเคลมเมื่อ "รับเครื่องแล้ว" (picked-up)
      claimDate: repair.pickedUpDate ?? new Date(),
    });

    const saved = await warrantyRepository.save(newClaim);
    console.log(`[Warranty] Auto-created warranty claim ${claimNumber} for repair ${repair.repairNumber} with status APPROVED`);

    // Emit socket event for real-time update (so Warranty page updates immediately)
    try {
      const claimWithRelations = await warrantyRepository.findOne({
        where: { id: saved.id },
        relations: ['repair', 'repair.customer'],
      });
      if (claimWithRelations) {
        emitWarrantyCreated(claimWithRelations);
      } else {
        // Fallback: emit minimal payload if relations not found for some reason
        emitWarrantyCreated(saved);
      }
    } catch (emitErr) {
      console.error('[Warranty] Error emitting warranty:created event:', emitErr);
    }
  } catch (error) {
    // ไม่ให้ error นี้ทำให้การอัพเดท repair ล้มเหลว
    console.error('[Warranty] Error creating auto warranty claim:', error);
  }
}

// Helper function to reduce stock for parts
async function reducePartStock(partIds: string[]): Promise<void> {
  if (!partIds || partIds.length === 0) return;
  
  const partRepository = AppDataSource.getRepository(Part);
  
  // Count occurrences of each part ID (in case same part is used multiple times)
  const partCounts: Record<string, number> = {};
  partIds.forEach(id => {
    partCounts[id] = (partCounts[id] || 0) + 1;
  });
  
  // Update stock for each unique part
  for (const [partId, quantity] of Object.entries(partCounts)) {
    const part = await partRepository.findOne({ where: { id: partId } });
    if (part) {
      const newStock = Math.max(0, part.stockQuantity - quantity); // Ensure stock doesn't go below 0
      part.stockQuantity = newStock;
      await partRepository.save(part);
      console.log(`[Stock] Reduced stock for part ${partId} by ${quantity}. New stock: ${newStock}`);
    }
  }
}

// Helper function to restore stock for parts
async function restorePartStock(partIds: string[]): Promise<void> {
  if (!partIds || partIds.length === 0) return;
  
  const partRepository = AppDataSource.getRepository(Part);
  
  // Count occurrences of each part ID
  const partCounts: Record<string, number> = {};
  partIds.forEach(id => {
    partCounts[id] = (partCounts[id] || 0) + 1;
  });
  
  // Restore stock for each unique part
  for (const [partId, quantity] of Object.entries(partCounts)) {
    const part = await partRepository.findOne({ where: { id: partId } });
    if (part) {
      part.stockQuantity = part.stockQuantity + quantity;
      await partRepository.save(part);
      console.log(`[Stock] Restored stock for part ${partId} by ${quantity}. New stock: ${part.stockQuantity}`);
    }
  }
}

// Get all repairs
router.get('/', async (req, res) => {
  try {
    const repairRepository = AppDataSource.getRepository(Repair);
    const partRepository = AppDataSource.getRepository(Part);
    
    // Get pagination parameters from query string
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 8;
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalCount = await repairRepository.count();

    // Get repairs with pagination
    const repairs = await repairRepository.find({
      relations: ['customer', 'assignedTo', 'selectedPart'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    // ดึงข้อมูล parts ทั้งหมดจาก selectedPartIds สำหรับแต่ละ repair
    const repairsWithParts = await Promise.all(
      repairs.map(async (repair) => {
        if (repair.selectedPartIds) {
          try {
            const partIds = JSON.parse(repair.selectedPartIds);
            if (Array.isArray(partIds) && partIds.length > 0) {
              const selectedParts = await partRepository.find({
                where: { id: In(partIds) },
              });
              return {
                ...repair,
                selectedParts,
              };
            }
          } catch (error) {
            console.error('Error parsing selectedPartIds for repair:', repair.id, error);
          }
        }
        // ถ้าไม่มี selectedPartIds แต่มี selectedPart ให้แปลงเป็น array
        if (repair.selectedPart) {
          return {
            ...repair,
            selectedParts: [repair.selectedPart],
          };
        }
        return repair;
      })
    );

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      status: 'success',
      data: repairsWithParts,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Get repairs error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch repairs',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get repair by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const repairRepository = AppDataSource.getRepository(Repair);
    const partRepository = AppDataSource.getRepository(Part);
    
    // Check if id is a valid UUID format (8-4-4-4-12 hex characters)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUUID = uuidRegex.test(id);
    
    let repair;
    if (isUUID) {
      // If it's a UUID, search by id
      repair = await repairRepository.findOne({
        where: { id },
        relations: ['customer', 'assignedTo', 'selectedPart'],
      });
    } else {
      // If it's not a UUID, it's likely a repairNumber
      repair = await repairRepository.findOne({
        where: { repairNumber: id },
        relations: ['customer', 'assignedTo', 'selectedPart'],
      });
    }

    if (!repair) {
      return res.status(404).json({
        status: 'error',
        message: 'Repair not found',
      });
    }

    // ดึงข้อมูล parts ทั้งหมดจาก selectedPartIds (ถ้ามี)
    let selectedParts = null;
    if (repair.selectedPartIds) {
      try {
        const partIds = JSON.parse(repair.selectedPartIds);
        if (Array.isArray(partIds) && partIds.length > 0) {
          selectedParts = await partRepository.find({
            where: { id: In(partIds) },
          });
        }
      } catch (error) {
        console.error('Error parsing selectedPartIds:', error);
      }
    }

    // Parse additionalParts (ถ้ามี)
    let additionalParts = null;
    if (repair.additionalParts) {
      try {
        additionalParts = JSON.parse(repair.additionalParts);
      } catch (error) {
        console.error('Error parsing additionalParts:', error);
      }
    }

    // เพิ่ม selectedParts และ additionalParts ลงใน response
    const responseData = {
      ...repair,
      selectedParts: selectedParts || (repair.selectedPart ? [repair.selectedPart] : []),
      additionalParts: additionalParts || [],
    };

    res.json({
      status: 'success',
      data: responseData,
    });
  } catch (error) {
    console.error('Get repair by ID error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch repair',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Create repair with customer
router.post('/', async (req, res) => {
  try {
    const repairRepository = AppDataSource.getRepository(Repair);
    const customerRepository = AppDataSource.getRepository(Customer);

    // Extract customer data from request
    const {
      customer: customerName,
      phone,
      phoneBackup,
      lineId,
      lineIdRes,
      // Repair data
      serialNumber,
      model,
      color,
      screenLockCode,
      problemSymptoms,
      deposit,
      estimatedPrice,
      repairSummaryPrice,
      dateOfReport,
      timeOfReport,
      scheduledPickupTime,
      service_type,
      receive_date,
      receive_time,
      selectedPartId, // Keep for backward compatibility
      selectedPartIds, // New: array of part IDs
      additionalParts, // Array of parts not in inventory: [{ name: string, nameTh?: string, price: number }]
      deviceType = 'phone',
      deviceBrand,
      deviceModel,
      deviceSerialNumber,
      deviceColor,
      problemDescription,
      diagnosis,
      repairNotes,
      status = RepairStatus.IN_PROGRESS,
      laborCost = 0,
      partsCost = 0,
      totalCost = 0,
      warrantyInfo,
      warrantyDays,
    } = req.body;

    // Validate required fields
    if (!customerName || !customerName.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Customer name is required',
      });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Phone number is required',
      });
    }

    // Validate Serial Number: must not exceed 15 characters (allows letters and numbers)
    if (serialNumber) {
      const trimmedSerial = serialNumber.trim();
      if (trimmedSerial && trimmedSerial.length > 15) {
        return res.status(400).json({
          status: 'error',
          message: 'Serial Number must not exceed 15 characters',
        });
      }
    }

    // Validate warrantyDays if provided (only allow fixed options)
    if (warrantyDays !== undefined) {
      if (!isAllowedWarrantyDays(warrantyDays)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid warrantyDays. Must be one of: 30, 90, 180, 365',
        });
      }
    }

    // Find or create customer
    // Check if customer exists with both phone AND name (to avoid updating existing customers)
    const trimmedCustomerName = customerName.trim();
    // Normalize phone number (convert +66 to 0, etc.)
    const normalizedPhone = normalizePhone(phone.trim());
    const trimmedPhone = normalizedPhone;
    
    // Parse customer name - support both fullName and firstName/lastName
    const nameParts = trimmedCustomerName.split(/\s+/);
    const firstName = nameParts[0] || trimmedCustomerName;
    const lastName = nameParts.slice(1).join(' ') || '';
    
    // Try to find customer - search by normalized phone first, then try to find by name
    // This handles cases where phone in DB might not be normalized yet
    let customer = await customerRepository.findOne({
      where: { 
        phone: trimmedPhone,
        fullName: trimmedCustomerName,
      },
    });
    
    // If not found by fullName, try to match by firstName + lastName with normalized phone
    if (!customer) {
      customer = await customerRepository.findOne({
        where: { 
          phone: trimmedPhone,
          firstName: firstName,
          lastName: lastName || undefined,
        },
      });
    }
    
    // If still not found, try searching by name only (in case phone format differs)
    // This helps when phone in DB is not normalized (e.g., 00954225845 vs 0954225845)
    if (!customer) {
      // Find all customers with matching name
      const customersByName = await customerRepository.find({
        where: [
          { fullName: trimmedCustomerName },
          { firstName: firstName, lastName: lastName || undefined },
        ],
      });
      
      // Check if any of them have a phone that normalizes to the same number
      for (const c of customersByName) {
        if (c.phone) {
          const normalizedDbPhone = normalizePhone(c.phone);
          if (normalizedDbPhone === trimmedPhone) {
            customer = c;
            break;
          }
        }
      }
    }
    
    // If still not found, create a new customer
    if (!customer) {
      customer = customerRepository.create({
        firstName: firstName,
        lastName: lastName || undefined,
        fullName: trimmedCustomerName,
        phone: trimmedPhone,
        phoneBackup: phoneBackup ? normalizePhone(phoneBackup.trim()) : undefined,
        lineId: lineId?.trim() || undefined,
        lineIdRes: lineIdRes?.trim() || undefined,
      });
      customer = await customerRepository.save(customer);
    } else {
      // If customer found, update phoneBackup, lineId and lineIdRes if provided
      if (phoneBackup !== undefined) {
        customer.phoneBackup = phoneBackup ? normalizePhone(phoneBackup.trim()) : undefined;
      }
      if (lineId !== undefined) {
        customer.lineId = lineId?.trim() || undefined;
      }
      if (lineIdRes !== undefined) {
        customer.lineIdRes = lineIdRes?.trim() || undefined;
      }
      customer = await customerRepository.save(customer);
    }

    // Generate repair number if not provided (REP-YYYY-001, REP-YYYY-002, ...)
    let repairNumber = req.body.repairNumber;
    if (!repairNumber) {
      const currentYear = new Date().getFullYear();
      // Count repairs created in the current year
      const startOfYear = new Date(currentYear, 0, 1);
      const endOfYear = new Date(currentYear + 1, 0, 1);
      const count = await repairRepository.count({
        where: {
          createdAt: Between(startOfYear, endOfYear),
        },
      });
      repairNumber = `REP-${currentYear}-${String(count + 1).padStart(3, '0')}`;
    }

    // Parse dates
    let parsedDateOfReport: Date | undefined;
    if (dateOfReport) {
      // Support multiple date formats
      if (dateOfReport.includes('/')) {
        const [day, month, year] = dateOfReport.split('/').map(Number);
        parsedDateOfReport = new Date(year > 2500 ? year - 543 : year, month - 1, day);
      } else if (dateOfReport.includes('-')) {
        parsedDateOfReport = new Date(dateOfReport);
      } else {
        parsedDateOfReport = new Date(dateOfReport);
      }
      if (isNaN(parsedDateOfReport.getTime())) {
        parsedDateOfReport = undefined;
      }
    }

    let parsedReceiveDate: Date | undefined;
    if (receive_date) {
      parsedReceiveDate = new Date(receive_date);
      if (isNaN(parsedReceiveDate.getTime())) {
        parsedReceiveDate = undefined;
      }
    }

    let parsedScheduledPickupTime: Date | undefined;
    if (scheduledPickupTime) {
      parsedScheduledPickupTime = new Date(scheduledPickupTime);
      if (isNaN(parsedScheduledPickupTime.getTime())) {
        parsedScheduledPickupTime = undefined;
      }
    }

    // คำนวณ partsCost, laborCost, totalCost อัตโนมัติจาก selectedPartIds
    let calculatedPartsCost = parseFloat(String(partsCost)) || 0;
    let calculatedLaborCost = parseFloat(String(laborCost)) || 0;
    
    // ถ้ามี selectedPartIds ให้คำนวณราคาอะไหล่จาก Part entity
    if (selectedPartIds && Array.isArray(selectedPartIds) && selectedPartIds.length > 0) {
      try {
        const partRepository = AppDataSource.getRepository(Part);
        const parts = await partRepository.findByIds(selectedPartIds);
        
        // นับจำนวนแต่ละ part (กรณีเลือก part เดียวกันหลายครั้ง)
        const partCounts: Record<string, number> = {};
        selectedPartIds.forEach((id: string) => {
          partCounts[id] = (partCounts[id] || 0) + 1;
        });
        
        // คำนวณราคารวมของอะไหล่
        let autoPartsCost = 0;
        parts.forEach((part: any) => {
          const count = partCounts[part.id] || 1;
          const partPrice = Number(part.price) || 0;
          autoPartsCost += partPrice * count;
        });
        
        // ใช้ค่าที่คำนวณได้ ถ้า Frontend ไม่ได้ส่งมา
        if (calculatedPartsCost === 0 && autoPartsCost > 0) {
          calculatedPartsCost = autoPartsCost;
        }
      } catch (error) {
        console.error('Error calculating parts cost:', error);
      }
    }
    
    // คำนวณ totalCost (ไม่รวมภาษี)
    const subtotal = calculatedPartsCost + calculatedLaborCost;
    const calculatedTotalCost = subtotal;

    // Create repair
    const repairData: any = {
      repairNumber,
      customerId: customer.id,
      deviceType,
      deviceBrand: deviceBrand || undefined,
      deviceModel: deviceModel || model || undefined,
      deviceSerialNumber: deviceSerialNumber || undefined,
      serialNumber: serialNumber || undefined,
      deviceColor: deviceColor || color || undefined,
      screenLockCode: screenLockCode || undefined,
      problemDescription: problemDescription || problemSymptoms || '',
      problemSymptoms: problemSymptoms || undefined,
      diagnosis: diagnosis || undefined,
      repairNotes: repairNotes || undefined,
      status,
      laborCost: calculatedLaborCost,
      partsCost: calculatedPartsCost,
      totalCost: calculatedTotalCost,
      deposit: deposit ? parseFloat(String(deposit)) : undefined,
      estimatedPrice: estimatedPrice ? parseFloat(String(estimatedPrice)) : undefined,
      repairSummaryPrice: repairSummaryPrice ? parseFloat(String(repairSummaryPrice)) : undefined,
      serviceType: service_type || ServiceType.WALK_IN,
      receiveDate: parsedReceiveDate,
      receiveTime: receive_time || undefined,
      scheduledPickupTime: parsedScheduledPickupTime,
      dateOfReport: parsedDateOfReport,
      timeOfReport: timeOfReport || undefined,
      selectedPartId: selectedPartIds && selectedPartIds.length > 0 ? selectedPartIds[0] : (selectedPartId || undefined), // Use first part ID for backward compatibility
      selectedPartIds: selectedPartIds && selectedPartIds.length > 0 ? JSON.stringify(selectedPartIds) : undefined, // Store as JSON string
      additionalParts: additionalParts && Array.isArray(additionalParts) && additionalParts.length > 0 ? JSON.stringify(additionalParts) : undefined, // Store as JSON string
      warrantyInfo: warrantyInfo || undefined,
      warrantyDays: warrantyDays !== undefined ? Number(warrantyDays) : undefined,
    };

    const newRepair = repairRepository.create(repairData);
    const savedRepair = await repairRepository.save(newRepair);
    
    // Reduce stock for selected parts
    const partsToDeduct: string[] = [];
    if (selectedPartIds && Array.isArray(selectedPartIds) && selectedPartIds.length > 0) {
      partsToDeduct.push(...selectedPartIds);
    } else if (selectedPartId) {
      partsToDeduct.push(selectedPartId);
    }
    
    if (partsToDeduct.length > 0) {
      try {
        await reducePartStock(partsToDeduct);
      } catch (error) {
        console.error('Error reducing part stock:', error);
        // Continue even if stock reduction fails
      }
    }
    
    // Load relations - handle both single entity and array cases
    const repairId = Array.isArray(savedRepair) 
      ? (savedRepair[0] as Repair).id 
      : (savedRepair as Repair).id;
    const repairWithRelations = await repairRepository.findOne({
      where: { id: repairId },
      relations: ['customer', 'assignedTo', 'selectedPart'],
    });

    // ดึงข้อมูล parts ทั้งหมดจาก selectedPartIds (ถ้ามี)
    let selectedParts = null;
    if (repairWithRelations?.selectedPartIds) {
      try {
        const partIds = JSON.parse(repairWithRelations.selectedPartIds);
        if (Array.isArray(partIds) && partIds.length > 0) {
          const partRepository = AppDataSource.getRepository(Part);
          selectedParts = await partRepository.find({
            where: { id: In(partIds) },
          });
        }
      } catch (error) {
        console.error('Error parsing selectedPartIds:', error);
      }
    }

    // เพิ่ม selectedParts ลงใน response
    const responseData = {
      ...repairWithRelations,
      selectedParts: selectedParts || (repairWithRelations?.selectedPart ? [repairWithRelations.selectedPart] : null),
    };

    // สร้างธุรกรรม (income) ทันทีเมื่อสร้างใบแจ้งซ่อม
    if (calculatedPartsCost > 0 || calculatedTotalCost > 0) {
      try {
        const transactionRepository = AppDataSource.getRepository(Transaction);
        
        // สร้าง transaction number
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        
        // นับจำนวน transaction ของวันนี้
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        
        const todayCount = await transactionRepository
          .createQueryBuilder('transaction')
          .where('transaction.createdAt >= :start', { start: todayStart })
          .andWhere('transaction.createdAt < :end', { end: todayEnd })
          .getCount();
        
        const sequenceNumber = String(todayCount + 1).padStart(3, '0');
        const transactionNumber = `TXN-REP-${year}-${month}-${sequenceNumber}`;
        
        // ใช้ partsCost ถ้ามี ไม่เช่นนั้นใช้ totalCost
        const transactionAmount = calculatedPartsCost > 0 ? calculatedPartsCost : calculatedTotalCost;
        
        // หา partId แรกถ้ามี selectedPartIds หรือ selectedPartId
        let firstPartId: string | undefined = undefined;
        if (selectedPartIds && Array.isArray(selectedPartIds) && selectedPartIds.length > 0) {
          firstPartId = selectedPartIds[0];
        } else if (selectedPartId) {
          firstPartId = selectedPartId;
        }
        
        // สร้าง transaction
        const transaction = transactionRepository.create({
          transactionNumber,
          type: 'income',
          partId: firstPartId, // บันทึก partId แรกถ้ามี
          totalCost: transactionAmount,
          description: `Income from Parts - ${repairNumber}`,
          descriptionTh: `เงินเข้า - อะไหล่ - ${repairNumber}`,
        });
        
        await transactionRepository.save(transaction);
        console.log(`[Repair] Created income transaction ${transactionNumber} for repair ${repairNumber}${firstPartId ? ` with partId: ${firstPartId}` : ''}`);
      } catch (error) {
        console.error('Error creating transaction for repair:', error);
        // Continue even if transaction creation fails
      }
    }

    // ส่ง LINE notification เมื่อสร้างใบแจ้งซ่อม (สำหรับลูกค้าที่มี LINE ID)
    if (repairWithRelations?.customer?.lineIdRes) {
      try {
        const lineService = getLineNotificationService();
        if (lineService) {
          const customerData = repairWithRelations.customer;
          const customerName = customerData.fullName || 
                              `${customerData.firstName} ${customerData.lastName || ''}`.trim();
          // ใช้ deviceModel หรือ deviceType เป็น fallback
          const deviceType = repairWithRelations.deviceModel || repairWithRelations.deviceType || 'อุปกรณ์';
          
          // ส่งแจ้งเตือนว่าสร้างใบแจ้งซ่อมแล้ว และสถานะเป็น "กำลังซ่อม"
          await lineService.notifyRepairStatusChange(
            customerData.lineIdRes,
            customerName,
            repairNumber,
            'in-progress', // สถานะกำลังซ่อม
            deviceType,
            repairWithRelations.problemSymptoms || repairWithRelations.problemDescription // Optional additional info
          );
          console.log(`[LINE] Notification sent for new repair ${repairNumber} (in-progress) to customer ${customerName}`);
        }
      } catch (lineError) {
        // Don't fail the request if LINE notification fails
        console.error('[LINE] Error sending notification for new repair:', lineError);
      }
    } else {
      console.log(`[LINE] Customer does not have LINE User ID, skipping notification for repair ${repairNumber}`);
    }

    // Emit socket event for real-time update
    emitRepairCreated(responseData);

    res.status(201).json({
      status: 'success',
      data: responseData,
      message: 'Repair created successfully',
    });
  } catch (error) {
    console.error('Create repair error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create repair',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update repair
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const repairRepository = AppDataSource.getRepository(Repair);
    
    console.log(`[Update Repair] Looking for repair with id/repairNumber: ${id}`);
    
    // Check if id is a valid UUID format (8-4-4-4-12 hex characters)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUUID = uuidRegex.test(id);
    
    let repair;
    if (isUUID) {
      // If it's a UUID, search by id
      repair = await repairRepository.findOne({ where: { id } });
    } else {
      // If it's not a UUID, it's likely a repairNumber
      repair = await repairRepository.findOne({ where: { repairNumber: id } });
    }

    if (!repair) {
      console.log(`[Update Repair] Repair not found: ${id}`);
      return res.status(404).json({
        status: 'error',
        message: 'Repair not found',
      });
    }

    console.log(`[Update Repair] Found repair: ${repair.id} (${repair.repairNumber}), current status: ${repair.status}`);
    console.log(`[Update Repair] Request body:`, JSON.stringify(req.body, null, 2));

    // Store old status for comparison (to send LINE notification)
    const oldStatus = repair.status;

    // Get old part IDs before updating (for stock restoration)
    const oldPartIds: string[] = [];
    if (repair.selectedPartIds) {
      try {
        const parsed = JSON.parse(repair.selectedPartIds);
        if (Array.isArray(parsed)) {
          oldPartIds.push(...parsed);
        }
      } catch (error) {
        console.error('Error parsing old selectedPartIds:', error);
      }
    } else if (repair.selectedPartId) {
      oldPartIds.push(repair.selectedPartId);
    }

    // Validate status if provided
    if (req.body.status !== undefined) {
      const validStatuses = Object.values(RepairStatus);
      if (!validStatuses.includes(req.body.status)) {
        console.log(`[Update Repair] Invalid status: ${req.body.status}, valid: ${validStatuses.join(', ')}`);
        return res.status(400).json({
          status: 'error',
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        });
      }
      repair.status = req.body.status as RepairStatus;
      console.log(`[Update Repair] Setting status to: ${repair.status}`);
      
      // ตั้งค่า completedDate เมื่อสถานะเปลี่ยนเป็น completed
      if (repair.status === RepairStatus.COMPLETED && oldStatus !== RepairStatus.COMPLETED) {
        repair.completedDate = new Date();
        console.log(`[Update Repair] Setting completedDate to: ${repair.completedDate}`);
      }

      // ตั้งค่า pickedUpDate เมื่อสถานะเปลี่ยนเป็น picked-up (รับเครื่องแล้ว)
      if (repair.status === RepairStatus.PICKED_UP && oldStatus !== RepairStatus.PICKED_UP) {
        repair.pickedUpDate = new Date();
        console.log(`[Update Repair] Setting pickedUpDate to: ${repair.pickedUpDate}`);
      }
    }

    // Validate warrantyDays if provided (only allow fixed options)
    if (req.body.warrantyDays !== undefined) {
      if (!isAllowedWarrantyDays(req.body.warrantyDays)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid warrantyDays. Must be one of: 30, 90, 180, 365',
        });
      }
      req.body.warrantyDays = Number(req.body.warrantyDays);
    }

    // Update other fields (excluding status which we already handled)
    const { status, selectedPartIds: newSelectedPartIds, selectedPartId: newSelectedPartId, additionalParts: newAdditionalParts, ...otherFields } = req.body;
    
    // Handle additionalParts update
    if (newAdditionalParts !== undefined) {
      if (newAdditionalParts && Array.isArray(newAdditionalParts) && newAdditionalParts.length > 0) {
        repair.additionalParts = JSON.stringify(newAdditionalParts);
      } else {
        repair.additionalParts = undefined;
      }
    }
    
    // Handle selectedPartIds update
    if (newSelectedPartIds !== undefined || newSelectedPartId !== undefined) {
      if (newSelectedPartIds && Array.isArray(newSelectedPartIds) && newSelectedPartIds.length > 0) {
        repair.selectedPartIds = JSON.stringify(newSelectedPartIds);
        repair.selectedPartId = newSelectedPartIds[0]; // For backward compatibility
      } else if (newSelectedPartId) {
        repair.selectedPartId = newSelectedPartId;
        repair.selectedPartIds = JSON.stringify([newSelectedPartId]);
      }
    }
    
    // คำนวณ partsCost, laborCost, totalCost อัตโนมัติ (ถ้ามีการเปลี่ยนแปลง selectedPartIds หรือ additionalParts)
    const shouldRecalculateCost = (newSelectedPartIds !== undefined || newSelectedPartId !== undefined) || 
                                   (newAdditionalParts !== undefined);
    
    if (shouldRecalculateCost) {
      try {
        let autoPartsCost = 0;
        
        // คำนวณราคาจาก selectedParts (ชิ้นส่วนที่มีในคลังสินค้า)
        if (newSelectedPartIds !== undefined || newSelectedPartId !== undefined) {
          // ใช้ selectedPartIds ใหม่ถ้ามี ถ้าไม่มีให้ใช้ selectedPartId หรือใช้ค่าที่มีอยู่แล้ว
          let partIdsToCalculate: string[] = [];
          
          if (newSelectedPartIds && Array.isArray(newSelectedPartIds) && newSelectedPartIds.length > 0) {
            partIdsToCalculate = newSelectedPartIds;
          } else if (newSelectedPartId) {
            partIdsToCalculate = [newSelectedPartId];
          } else if (repair.selectedPartIds) {
            // ถ้าไม่ได้ส่งมาใหม่ ให้ใช้ค่าที่มีอยู่แล้ว
            try {
              const parsed = JSON.parse(repair.selectedPartIds);
              if (Array.isArray(parsed)) {
                partIdsToCalculate = parsed;
              }
            } catch (error) {
              console.error('[Update Repair] Error parsing existing selectedPartIds:', error);
            }
          } else if (repair.selectedPartId) {
            partIdsToCalculate = [repair.selectedPartId];
          }
          
          if (partIdsToCalculate.length > 0) {
            const partRepository = AppDataSource.getRepository(Part);
            const parts = await partRepository.findByIds(partIdsToCalculate);
            
            // นับจำนวนแต่ละ part
            const partCounts: Record<string, number> = {};
            partIdsToCalculate.forEach((partId: string) => {
              partCounts[partId] = (partCounts[partId] || 0) + 1;
            });
            
            // คำนวณราคารวมของอะไหล่
            parts.forEach((part: any) => {
              const count = partCounts[part.id] || 1;
              const partPrice = Number(part.price) || 0;
              autoPartsCost += partPrice * count;
            });
            
            console.log(`[Update Repair] Calculated parts cost from ${partIdsToCalculate.length} parts: ฿${autoPartsCost}`);
          }
        } else {
          // ถ้าไม่ได้อัพเดท selectedPartIds ให้ใช้ราคาเดิม
          autoPartsCost = Number(repair.partsCost) || 0;
        }
        
        // คำนวณราคาจาก additionalParts (ชิ้นส่วนที่ไม่มีในคลังสินค้า)
        let additionalPartsCost = 0;
        if (newAdditionalParts !== undefined && Array.isArray(newAdditionalParts) && newAdditionalParts.length > 0) {
          additionalPartsCost = newAdditionalParts.reduce((sum: number, part: any) => {
            return sum + (Number(part.price) || 0);
          }, 0);
        } else if (repair.additionalParts) {
          // ถ้าไม่ได้อัพเดท additionalParts ให้ใช้ราคาเดิม
          try {
            const existingAdditionalParts = JSON.parse(repair.additionalParts);
            if (Array.isArray(existingAdditionalParts)) {
              additionalPartsCost = existingAdditionalParts.reduce((sum: number, part: any) => {
                return sum + (Number(part.price) || 0);
              }, 0);
            }
          } catch (error) {
            console.error('[Update Repair] Error parsing existing additionalParts:', error);
          }
        }
        
        // รวมราคาทั้งหมด
        const totalPartsCost = autoPartsCost + additionalPartsCost;
        
        // อัพเดท partsCost
        otherFields.partsCost = totalPartsCost;
        
        // คำนวณ totalCost ใหม่ (ไม่รวมภาษี)
        const currentLaborCost = otherFields.laborCost !== undefined ? Number(otherFields.laborCost) : Number(repair.laborCost || 0);
        const subtotal = totalPartsCost + currentLaborCost;
        otherFields.totalCost = subtotal;
        
        console.log(`[Update Repair] Recalculated costs - Parts: ฿${totalPartsCost}, Labor: ฿${currentLaborCost}, Total: ฿${subtotal}`);
        
        // อัพเดท repairSummaryPrice ถ้าไม่ได้ส่งมา
        if (otherFields.repairSummaryPrice === undefined) {
          otherFields.repairSummaryPrice = totalPartsCost;
        }
      } catch (error) {
        console.error('[Update Repair] Error calculating parts cost on update:', error);
      }
    }
    
    if (Object.keys(otherFields).length > 0) {
      Object.assign(repair, otherFields);
    }
    
    // คำนวณ totalCost อัตโนมัติ (ไม่รวมภาษี) ถ้ามีการเปลี่ยนแปลง partsCost หรือ laborCost โดยตรง
    // หรือถ้า totalCost ไม่ได้ถูกส่งมา และไม่ได้คำนวณไปแล้วในบล็อก shouldRecalculateCost
    if (!shouldRecalculateCost && (otherFields.partsCost !== undefined || otherFields.laborCost !== undefined || otherFields.totalCost === undefined)) {
      const finalPartsCost = otherFields.partsCost !== undefined ? Number(otherFields.partsCost) : Number(repair.partsCost || 0);
      const finalLaborCost = otherFields.laborCost !== undefined ? Number(otherFields.laborCost) : Number(repair.laborCost || 0);
      const subtotal = finalPartsCost + finalLaborCost;
      repair.totalCost = subtotal;
      console.log(`[Update Repair] Recalculated totalCost from direct fields - Parts: ฿${finalPartsCost}, Labor: ฿${finalLaborCost}, Total: ฿${subtotal}`);
    }
    
    // อัพเดท Transaction เมื่อมีการเปลี่ยนแปลง partsCost หรือ totalCost
    const hasCostChange = shouldRecalculateCost || otherFields.partsCost !== undefined || otherFields.totalCost !== undefined;
    if (hasCostChange) {
      try {
        const transactionRepository = AppDataSource.getRepository(Transaction);
        const finalPartsCost = otherFields.partsCost !== undefined ? Number(otherFields.partsCost) : Number(repair.partsCost || 0);
        const finalTotalCost = otherFields.totalCost !== undefined ? Number(otherFields.totalCost) : Number(repair.totalCost || 0);
        
        // ใช้ partsCost ถ้ามี ไม่เช่นนั้นใช้ totalCost
        const transactionAmount = finalPartsCost > 0 ? finalPartsCost : finalTotalCost;
        
        if (transactionAmount > 0) {
          // หา partId แรกจาก selectedPartIds ที่อัพเดทหรือที่มีอยู่
          // ใช้ repair.selectedPartIds ที่อัพเดทแล้ว (อัพเดทที่บรรทัด 820) หรือ newSelectedPartIds
          let firstPartId: string | undefined = undefined;
          
          // ใช้ repair.selectedPartIds ที่อัพเดทแล้วก่อน (เพราะมันถูกอัพเดทที่บรรทัด 820 แล้ว)
          if (repair.selectedPartIds) {
            try {
              const parsed = JSON.parse(repair.selectedPartIds);
              if (Array.isArray(parsed) && parsed.length > 0) {
                firstPartId = parsed[0];
              }
            } catch (error) {
              console.error('[Update Repair] Error parsing selectedPartIds for transaction:', error);
            }
          }
          
          // ถ้ายังไม่มี ให้ลองใช้ newSelectedPartIds หรือ newSelectedPartId
          if (!firstPartId) {
            if (newSelectedPartIds && Array.isArray(newSelectedPartIds) && newSelectedPartIds.length > 0) {
              firstPartId = newSelectedPartIds[0];
            } else if (newSelectedPartId) {
              firstPartId = newSelectedPartId;
            } else if (repair.selectedPartId) {
              firstPartId = repair.selectedPartId;
            }
          }
          
          console.log(`[Update Repair] Found firstPartId for transaction: ${firstPartId || 'none'}`);
          
          // หา Transaction ที่เชื่อมกับ repair นี้
          const existingTransaction = await transactionRepository.findOne({
            where: {
              descriptionTh: `เงินเข้า - อะไหล่ - ${repair.repairNumber}`,
            },
          });
          
          if (existingTransaction) {
            // อัพเดท Transaction ที่มีอยู่
            existingTransaction.totalCost = transactionAmount;
            // อัพเดท partId เสมอ (ถ้ามี partId ใหม่ให้อัพเดท ถ้าไม่มีให้ลบออก)
            existingTransaction.partId = firstPartId || undefined;
            await transactionRepository.save(existingTransaction);
            console.log(`[Update Repair] Updated transaction ${existingTransaction.transactionNumber} for repair ${repair.repairNumber} - New amount: ฿${transactionAmount}${firstPartId ? `, partId: ${firstPartId}` : ', partId: removed'}`);
          } else {
            // ถ้ายังไม่มี Transaction ให้สร้างใหม่
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            
            const todayCount = await transactionRepository
              .createQueryBuilder('transaction')
              .where('transaction.createdAt >= :start', { start: todayStart })
              .andWhere('transaction.createdAt < :end', { end: todayEnd })
              .getCount();
            
            const sequenceNumber = String(todayCount + 1).padStart(3, '0');
            const transactionNumber = `TXN-REP-${year}-${month}-${sequenceNumber}`;
            
            // ใช้ createdAt ของ repair เพื่อให้วันที่ถูกต้อง
            const repairCreatedAt = new Date(repair.createdAt);
            
            const newTransaction = transactionRepository.create({
              transactionNumber,
              type: 'income',
              partId: firstPartId, // บันทึก partId แรกถ้ามี
              totalCost: transactionAmount,
              description: `Income from Parts - ${repair.repairNumber}`,
              descriptionTh: `เงินเข้า - อะไหล่ - ${repair.repairNumber}`,
            });
            
            const savedTransaction = await transactionRepository.save(newTransaction);
            
            // อัพเดท createdAt ให้ตรงกับวันที่สร้าง repair
            await AppDataSource.query(
              'UPDATE transactions SET "createdAt" = $1 WHERE id = $2',
              [repairCreatedAt, savedTransaction.id]
            );
            
            console.log(`[Update Repair] Created new transaction ${transactionNumber} for repair ${repair.repairNumber} - Amount: ฿${transactionAmount}${firstPartId ? `, partId: ${firstPartId}` : ''}`);
          }
        }
      } catch (error) {
        console.error('[Update Repair] Error updating transaction:', error);
        // Continue even if transaction update fails
      }
    }
    
    // Handle stock updates: restore old parts, deduct new parts
    // Get new part IDs from the updated repair data
    let newPartIds: string[] = [];
    if (newSelectedPartIds && Array.isArray(newSelectedPartIds) && newSelectedPartIds.length > 0) {
      newPartIds = [...newSelectedPartIds];
    } else if (newSelectedPartId) {
      newPartIds = [newSelectedPartId];
    } else if (repair.selectedPartIds) {
      // If not explicitly updated, use existing value
      try {
        const parsed = JSON.parse(repair.selectedPartIds);
        if (Array.isArray(parsed)) {
          newPartIds = [...parsed];
        }
      } catch (error) {
        console.error('Error parsing existing selectedPartIds:', error);
      }
    } else if (repair.selectedPartId) {
      newPartIds = [repair.selectedPartId];
    }

    // Calculate difference: count occurrences of each part ID
    const oldCounts: Record<string, number> = {};
    oldPartIds.forEach(id => {
      oldCounts[id] = (oldCounts[id] || 0) + 1;
    });

    const newCounts: Record<string, number> = {};
    newPartIds.forEach(id => {
      newCounts[id] = (newCounts[id] || 0) + 1;
    });

    // Calculate parts to restore (old - new, only positive differences)
    const partsToRestore: string[] = [];
    for (const [partId, oldCount] of Object.entries(oldCounts)) {
      const newCount = newCounts[partId] || 0;
      const diff = oldCount - newCount;
      if (diff > 0) {
        // Need to restore this many units
        for (let i = 0; i < diff; i++) {
          partsToRestore.push(partId);
        }
      }
    }

    // Calculate parts to deduct (new - old, only positive differences)
    const partsToDeduct: string[] = [];
    for (const [partId, newCount] of Object.entries(newCounts)) {
      const oldCount = oldCounts[partId] || 0;
      const diff = newCount - oldCount;
      if (diff > 0) {
        // Need to deduct this many units
        for (let i = 0; i < diff; i++) {
          partsToDeduct.push(partId);
        }
      }
    }

    // Restore stock for parts that were removed or reduced
    if (partsToRestore.length > 0) {
      try {
        await restorePartStock(partsToRestore);
      } catch (error) {
        console.error('Error restoring part stock:', error);
      }
    }

    // Deduct stock for parts that were added or increased
    if (partsToDeduct.length > 0) {
      try {
        await reducePartStock(partsToDeduct);
      } catch (error) {
        console.error('Error reducing part stock:', error);
      }
    }
    
    console.log(`[Update Repair] Saving repair with status: ${repair.status}`);
    const updatedRepair = await repairRepository.save(repair);
    console.log(`[Update Repair] Saved successfully: ${updatedRepair.id}`);
    
    // สร้าง warranty claim อัตโนมัติเมื่อสถานะเปลี่ยนเป็น picked-up (เริ่มนับประกันเมื่อรับเครื่องแล้ว)
    if (req.body.status !== undefined && 
        oldStatus !== RepairStatus.PICKED_UP && 
        updatedRepair.status === RepairStatus.PICKED_UP) {
      console.log(`[Warranty] Repair ${updatedRepair.repairNumber} picked-up, creating auto warranty claim...`);
      await createAutoWarrantyClaim(updatedRepair);
    }
    
    // Send LINE notification if status changed
    if (req.body.status !== undefined && oldStatus !== updatedRepair.status) {
      try {
        // Load customer data with lineIdRes
        const repairWithCustomer = await repairRepository.findOne({
          where: { id: updatedRepair.id },
          relations: ['customer'],
        });

        if (repairWithCustomer?.customer?.lineIdRes) {
          const lineService = getLineNotificationService();
          if (lineService) {
            const customerName = repairWithCustomer.customer.fullName || 
                                `${repairWithCustomer.customer.firstName} ${repairWithCustomer.customer.lastName || ''}`.trim();
            // ใช้ deviceModel หรือ deviceType เป็น fallback
            const deviceType = repairWithCustomer.deviceModel || repairWithCustomer.deviceType;

            // Send notification
            await lineService.notifyRepairStatusChange(
              repairWithCustomer.customer.lineIdRes,
              customerName,
              repairWithCustomer.repairNumber,
              updatedRepair.status,
              deviceType,
              req.body.repairNotes // Optional additional info
            );
            console.log(`[LINE] Notification sent for repair ${repairWithCustomer.repairNumber} status change to ${updatedRepair.status}`);
          }
        } else {
          console.log(`[LINE] Customer does not have LINE User ID, skipping notification`);
        }
      } catch (lineError) {
        // Don't fail the request if LINE notification fails
        console.error('[LINE] Error sending notification:', lineError);
      }
    }
    
    // Load relations
    const repairWithRelations = await repairRepository.findOne({
      where: { id: updatedRepair.id },
      relations: ['customer', 'assignedTo'],
    });

    // Emit socket event for real-time update
    emitRepairUpdate(repairWithRelations);

    res.json({
      status: 'success',
      data: repairWithRelations,
      message: 'Repair updated successfully',
    });
  } catch (error) {
    console.error('[Update Repair] Error details:', error);
    if (error instanceof Error) {
      console.error('[Update Repair] Error message:', error.message);
      console.error('[Update Repair] Error stack:', error.stack);
    }
    res.status(500).json({
      status: 'error',
      message: 'Failed to update repair',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Create transaction for repair that doesn't have one yet
router.post('/:id/create-transaction', async (req, res) => {
  try {
    const { id } = req.params;
    const repairRepository = AppDataSource.getRepository(Repair);
    const transactionRepository = AppDataSource.getRepository(Transaction);
    
    // Find repair by ID or repairNumber
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUUID = uuidRegex.test(id);
    
    let repair;
    if (isUUID) {
      repair = await repairRepository.findOne({ where: { id } });
    } else {
      repair = await repairRepository.findOne({ where: { repairNumber: id } });
    }

    if (!repair) {
      return res.status(404).json({
        status: 'error',
        message: 'Repair not found',
      });
    }

    // ตรวจสอบว่ามี transaction สำหรับ repair นี้อยู่แล้วหรือไม่
    const existingTransaction = await transactionRepository.findOne({
      where: {
        descriptionTh: `เงินเข้า - อะไหล่ - ${repair.repairNumber}`,
      },
    });

    if (existingTransaction) {
      return res.status(400).json({
        status: 'error',
        message: 'Transaction already exists for this repair',
        data: existingTransaction,
      });
    }

    // คำนวณจำนวนเงินจาก partsCost หรือ totalCost
    const partsCost = Number(repair.partsCost || 0);
    const totalCost = Number(repair.totalCost || 0);
    const transactionAmount = partsCost > 0 ? partsCost : totalCost;

    if (transactionAmount <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot create transaction: repair has no cost',
      });
    }

    // สร้าง transaction number
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    // นับจำนวน transaction ของวันนี้
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    
    const todayCount = await transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.createdAt >= :start', { start: todayStart })
      .andWhere('transaction.createdAt < :end', { end: todayEnd })
      .getCount();
    
    const sequenceNumber = String(todayCount + 1).padStart(3, '0');
    const transactionNumber = `TXN-REP-${year}-${month}-${sequenceNumber}`;

    // หา partId แรกจาก selectedPartIds หรือ selectedPartId
    let firstPartId: string | undefined = undefined;
    if (repair.selectedPartIds) {
      try {
        const parsed = JSON.parse(repair.selectedPartIds);
        if (Array.isArray(parsed) && parsed.length > 0) {
          firstPartId = parsed[0];
        }
      } catch (error) {
        console.error('[Create Transaction] Error parsing selectedPartIds:', error);
      }
    } else if (repair.selectedPartId) {
      firstPartId = repair.selectedPartId;
    }
    
    // สร้าง transaction โดยใช้ createdAt ของ repair เพื่อให้วันที่ถูกต้อง
    const repairCreatedAt = new Date(repair.createdAt);
    const transaction = transactionRepository.create({
      transactionNumber,
      type: 'income',
      partId: firstPartId, // บันทึก partId แรกถ้ามี
      totalCost: transactionAmount,
      description: `Income from Parts - ${repair.repairNumber}`,
      descriptionTh: `เงินเข้า - อะไหล่ - ${repair.repairNumber}`,
    });

    // บันทึก transaction และอัพเดท createdAt โดยใช้ raw query
    const savedTransaction = await transactionRepository.save(transaction);
    await AppDataSource.query(
      'UPDATE transactions SET "createdAt" = $1 WHERE id = $2',
      [repairCreatedAt, savedTransaction.id]
    );

    // ดึง transaction ที่อัพเดทแล้ว
    const updatedTransaction = await transactionRepository.findOne({
      where: { id: savedTransaction.id },
    });

    console.log(`[Repair] Created income transaction ${transactionNumber} for repair ${repair.repairNumber}`);

    res.json({
      status: 'success',
      data: updatedTransaction,
      message: 'Transaction created successfully',
    });
  } catch (error) {
    console.error('Error creating transaction for repair:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create transaction',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete repair
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const repairRepository = AppDataSource.getRepository(Repair);
    const warrantyRepository = AppDataSource.getRepository(WarrantyClaim);
    
    console.log(`[Delete Repair] Attempting to delete repair with id: ${id}`);
    
    // Find repair by ID or repairNumber
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUUID = uuidRegex.test(id);
    
    let repair;
    if (isUUID) {
      repair = await repairRepository.findOne({ where: { id } });
    } else {
      repair = await repairRepository.findOne({ where: { repairNumber: id } });
    }

    if (!repair) {
      console.log(`[Delete Repair] Repair not found: ${id}`);
      return res.status(404).json({
        status: 'error',
        message: 'Repair not found',
      });
    }

    console.log(`[Delete Repair] Found repair: ${repair.id} (${repair.repairNumber})`);

    // ลบ Bills ที่เชื่อมกับ Repair นี้ก่อน (ใช้ raw query เพราะไม่มี Bill entity)
    try {
      const billsResult = await AppDataSource.query(
        'SELECT id FROM bills WHERE "repairId" = $1',
        [repair.id]
      );
      if (billsResult && billsResult.length > 0) {
        console.log(`[Delete Repair] Found ${billsResult.length} bill(s) to delete`);
        await AppDataSource.query('DELETE FROM bills WHERE "repairId" = $1', [repair.id]);
        console.log(`[Delete Repair] Deleted ${billsResult.length} bill(s) associated with repair ${repair.id}`);
      }
    } catch (error) {
      console.error('[Delete Repair] Error deleting bills:', error);
      // Continue with repair deletion even if bill deletion fails
    }

    // ลบ WarrantyClaim ที่เชื่อมกับ Repair นี้ก่อน (เพื่อหลีกเลี่ยง foreign key constraint error)
    try {
      const warrantyClaims = await warrantyRepository.find({
        where: { repairId: repair.id },
      });
      if (warrantyClaims.length > 0) {
        console.log(`[Delete Repair] Found ${warrantyClaims.length} warranty claim(s) to delete`);
        // ใช้ delete() แทน remove() เพื่อให้ TypeORM จัดการ foreign keys
        await warrantyRepository.delete({ repairId: repair.id });
        console.log(`[Delete Repair] Deleted ${warrantyClaims.length} warranty claim(s) associated with repair ${repair.id}`);
      }
    } catch (error) {
      console.error('[Delete Repair] Error deleting warranty claims:', error);
      // Continue with repair deletion even if warranty claim deletion fails
    }

    // ลบ Transaction ที่เชื่อมกับ Repair นี้ก่อน (transaction ที่สร้างจาก repair นี้)
    try {
      const transactionRepository = AppDataSource.getRepository(Transaction);
      // ค้นหา transaction ที่มี repairNumber ใน descriptionTh
      const relatedTransactions = await transactionRepository.find({
        where: {
          descriptionTh: `เงินเข้า - อะไหล่ - ${repair.repairNumber}`,
        },
      });
      if (relatedTransactions.length > 0) {
        console.log(`[Delete Repair] Found ${relatedTransactions.length} transaction(s) to delete`);
        await transactionRepository.remove(relatedTransactions);
        console.log(`[Delete Repair] Deleted ${relatedTransactions.length} transaction(s) associated with repair ${repair.repairNumber}`);
      }
    } catch (error) {
      console.error('[Delete Repair] Error deleting transactions:', error);
      // Continue with repair deletion even if transaction deletion fails
    }

    // Restore stock for parts used in this repair
    const partIdsToRestore: string[] = [];
    if (repair.selectedPartIds) {
      try {
        const parsed = JSON.parse(repair.selectedPartIds);
        if (Array.isArray(parsed)) {
          partIdsToRestore.push(...parsed);
        }
      } catch (error) {
        console.error('[Delete Repair] Error parsing selectedPartIds for deletion:', error);
      }
    } else if (repair.selectedPartId) {
      partIdsToRestore.push(repair.selectedPartId);
    }

    if (partIdsToRestore.length > 0) {
      try {
        console.log(`[Delete Repair] Restoring stock for ${partIdsToRestore.length} part(s)`);
        await restorePartStock(partIdsToRestore);
        console.log(`[Delete Repair] Stock restored successfully`);
      } catch (error) {
        console.error('[Delete Repair] Error restoring part stock on delete:', error);
        // Continue with deletion even if stock restoration fails
      }
    }

    // ใช้ delete() แทน remove() เพื่อให้ TypeORM จัดการ foreign keys อัตโนมัติ
    console.log(`[Delete Repair] Deleting repair ${repair.id}...`);
    const deletedRepairId = repair.id;
    await repairRepository.delete(repair.id);
    console.log(`[Delete Repair] Repair deleted successfully: ${repair.id}`);

    // Emit socket event for real-time update
    emitRepairDeleted(deletedRepairId);

    res.json({
      status: 'success',
      message: 'Repair deleted successfully',
    });
  } catch (error) {
    console.error('[Delete Repair] Error details:', error);
    if (error instanceof Error) {
      console.error('[Delete Repair] Error message:', error.message);
      console.error('[Delete Repair] Error stack:', error.stack);
    }
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete repair',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;


