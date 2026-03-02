import { Router } from 'express';
import { In } from 'typeorm';
import { AppDataSource } from '../config/data-source.js';
import { Part } from '../entities/Part.js';
import { Repair, RepairStatus } from '../entities/Repair.js';
import { Transaction } from '../entities/Transaction.js';

const router = Router();

// Helper function to calculate date range based on time range
function getDateRange(timeRange: string): { startDate: Date; endDate: Date } {
  const endDate = new Date(); // ใช้เวลาปัจจุบัน
  const startDate = new Date();

  switch (timeRange) {
    case '1d':
      // รายวัน = วันนี้ตั้งแต่ 00:00 ถึงปัจจุบัน
      startDate.setHours(0, 0, 0, 0);
      break;
    case '1w':
      startDate.setDate(endDate.getDate() - 7);
      break;
    case '1m':
      startDate.setMonth(endDate.getMonth() - 1);
      break;
    case '3m':
      startDate.setMonth(endDate.getMonth() - 3);
      break;
    case '6m':
      startDate.setMonth(endDate.getMonth() - 6);
      break;
    case '1y':
      startDate.setFullYear(endDate.getFullYear() - 1);
      break;
    default:
      startDate.setMonth(endDate.getMonth() - 6);
  }

  // ตั้ง startDate ให้เป็นเวลาเริ่มต้นวัน
  startDate.setHours(0, 0, 0, 0);
  // ไม่ต้องเปลี่ยน endDate ให้ใช้เวลาปัจจุบัน (เพื่อให้ครอบคลุมถึงปัจจุบัน)
  // แต่ถ้าต้องการให้ครอบคลุมทั้งวัน ใช้ setHours(23, 59, 59, 999)

  return { startDate, endDate };
}

// Get financial summary
router.get('/summary', async (req, res) => {
  try {
    const { timeRange = '6m' } = req.query;
    const { startDate, endDate } = getDateRange(timeRange as string);

    const repairRepository = AppDataSource.getRepository(Repair);
    const partRepository = AppDataSource.getRepository(Part);
    const transactionRepository = AppDataSource.getRepository(Transaction);

    // Calculate total income from income transactions (created when repair is created)
    // This ensures all income is counted regardless of repair status
    const incomeTransactions = await transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.type = :type', { type: 'income' })
      .andWhere('transaction.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getMany();

    const totalIncome = incomeTransactions.reduce((sum, transaction) => {
      const amount = Number(transaction.totalCost || 0);
      return sum + amount;
    }, 0);

    // Get completed repairs within date range (for calculating parts cost and other metrics)
    // Use completedDate if available, otherwise use updatedAt when status changed to COMPLETED
    const completedRepairs = await repairRepository
      .createQueryBuilder('repair')
      .where('repair.status = :status', { status: RepairStatus.COMPLETED })
      .andWhere(
        '(repair.completedDate BETWEEN :startDate AND :endDate OR (repair.completedDate IS NULL AND repair.updatedAt BETWEEN :startDate AND :endDate))',
        { startDate, endDate }
      )
      .leftJoinAndSelect('repair.customer', 'customer')
      .getMany();

    // Get all parts used in repairs (from selectedPartIds)
    const allPartIds: string[] = [];
    completedRepairs.forEach((repair) => {
      if (repair.selectedPartIds) {
        try {
          const partIds = JSON.parse(repair.selectedPartIds);
          if (Array.isArray(partIds)) {
            allPartIds.push(...partIds);
          }
        } catch (error) {
          console.error('Error parsing selectedPartIds:', error);
        }
      } else if (repair.selectedPartId) {
        allPartIds.push(repair.selectedPartId);
      }
    });

    // คำนวณต้นทุนจริงของอะไหล่และกำไรจากอะไหล่
    // 1. totalPartsCost = ต้นทุนจริงที่จ่ายไป (costPrice) - ใช้สำหรับค่าใช้จ่ายรวม
    // 2. totalPartsSalePrice = ราคาที่ขายจริงในบิล/ใบแจ้งซ่อม (repairSummaryPrice หรือ totalCost)
    // 3. partsMarkup = กำไรจากอะไหล่ = totalPartsSalePrice - totalPartsCost
    
    let totalPartsCost = 0; // ต้นทุนจริงของอะไหล่ (costPrice) - ใช้สำหรับค่าใช้จ่าย
    let totalPartsSalePrice = 0; // ราคาขายรวมจากบิล/ใบแจ้งซ่อม
    
    // ดึงข้อมูล Part ทั้งหมดที่ใช้ในงานซ่อม
    if (allPartIds.length > 0) {
      const uniquePartIds = [...new Set(allPartIds)];
      const parts = await partRepository.find({
        where: { id: In(uniquePartIds) },
      });

      // สร้าง Map สำหรับเข้าถึงข้อมูล Part ได้เร็วขึ้น
      const partMap = new Map(parts.map(p => [p.id, p]));

      // Count occurrences of each part ID (นับจำนวนอะไหล่ที่ใช้ในแต่ละงาน)
      const partCounts: Record<string, number> = {};
      allPartIds.forEach((id) => {
        partCounts[id] = (partCounts[id] || 0) + 1;
      });

      // คำนวณต้นทุนจริง (costPrice) - ใช้เสมอ
      parts.forEach((part) => {
        const count = partCounts[part.id] || 0;
        const costPrice = Number(part.costPrice) || 0; // ต้นทุนจริง
        totalPartsCost += costPrice * count;
      });
    }

    // คำนวณต้นทุนสำหรับงานที่ไม่มีอะไหล่ที่ระบุในระบบ แต่มี partsCost
    // (กรณีซื้ออะไหล่จากภายนอก - ถือว่าไม่มีกำไรเพราะต้นทุน = ราคาขาย)
    for (const repair of completedRepairs) {
      const hasPartsInSystem = (repair.selectedPartIds && repair.selectedPartIds.trim() !== '') || 
                                repair.selectedPartId;
      const partsCostInRepair = Number(repair.partsCost || 0);
      
      if (!hasPartsInSystem && partsCostInRepair > 0) {
        // ถ้างานนี้ไม่มีอะไหล่ที่ระบุในระบบ แต่มี partsCost
        // นับเป็นต้นทุน (ถือว่าซื้อมาในราคาเท่ากับขาย - ไม่มีกำไร)
        totalPartsCost += partsCostInRepair;
      }
    }

    // คำนวณราคาขายอะไหล่ (partsCost จาก Repair)
    // ใช้ partsCost ที่ขายจริง ไม่ใช่ repairSummaryPrice (เพราะ repairSummaryPrice อาจรวมค่าแรงด้วย)
    for (const repair of completedRepairs) {
      const hasPartsInSystem = (repair.selectedPartIds && repair.selectedPartIds.trim() !== '') || 
                                repair.selectedPartId;
      const partsCostInRepair = Number(repair.partsCost || 0);
      
      if (hasPartsInSystem) {
        // ถ้ามีอะไหล่ในระบบ
        if (partsCostInRepair > 0) {
          // ถ้ามี partsCost บันทึกไว้ ให้ใช้เป็นราคาขายจริง
          totalPartsSalePrice += partsCostInRepair;
        } else {
          // ถ้าไม่มี partsCost ให้คำนวณจาก part.price
          try {
            const partIds = repair.selectedPartIds 
              ? JSON.parse(repair.selectedPartIds)
              : (repair.selectedPartId ? [repair.selectedPartId] : []);
            
            if (Array.isArray(partIds) && partIds.length > 0) {
              const uniquePartIds = [...new Set(partIds)];
              const parts = await partRepository.find({
                where: { id: In(uniquePartIds) },
              });
              
              // นับจำนวนแต่ละ part
              const partCounts: Record<string, number> = {};
              partIds.forEach((id: string) => {
                partCounts[id] = (partCounts[id] || 0) + 1;
              });
              
              // คำนวณราคาขายจาก part.price
              parts.forEach((part) => {
                const count = partCounts[part.id] || 0;
                const salePrice = Number(part.price) || 0;
                totalPartsSalePrice += salePrice * count;
              });
            }
          } catch (error) {
            console.error('Error calculating sale price from parts:', error);
          }
        }
      } else if (partsCostInRepair > 0) {
        // ถ้างานนี้ไม่มีอะไหล่ที่ระบุในระบบ แต่มี partsCost
        // นับเป็นราคาขาย (แต่ไม่มีกำไรเพราะต้นทุน = ราคาขาย)
        totalPartsSalePrice += partsCostInRepair;
      }
    }

    // Calculate total labor cost (ค่าแรง)
    const totalLaborCost = completedRepairs.reduce((sum, repair) => {
      return sum + Number(repair.laborCost || 0);
    }, 0);

    // คำนวณค่าใช้จ่ายรวมจากธุรกรรมล่าสุด (เอาธุรกรรมที่ type === 'expense')
    // ดึง transactions ทั้งหมดในช่วงเวลาที่กำหนด
    const transactions: any[] = [];

    // Get expense transactions from parts purchases
    const allPartsWithStock = await partRepository
      .createQueryBuilder('part')
      .where('part.stockQuantity > 0')
      .andWhere('part.costPrice > 0')
      .getMany();

    const partDateCounter = new Map<string, number>();
    allPartsWithStock.forEach((part) => {
      const partCreatedDate = new Date(part.createdAt);
      const partUpdatedDate = new Date(part.updatedAt);
      
      const isInTimeRange = 
        (partCreatedDate >= startDate && partCreatedDate <= endDate) ||
        (partUpdatedDate >= startDate && partUpdatedDate <= endDate);
      
      if (isInTimeRange) {
        const costPrice = Number(part.costPrice || 0);
        const stockQty = Number(part.stockQuantity || 0);
        const totalCost = costPrice * stockQty;
        
        if (totalCost > 0) {
          let transactionDate: Date;
          if (partCreatedDate >= startDate && partCreatedDate <= endDate) {
            transactionDate = partCreatedDate;
          } else {
            transactionDate = partUpdatedDate;
          }
          
          const dateStr = transactionDate.toISOString().split('T')[0];
          const dateKey = dateStr.replace(/-/g, '');
          const counter = (partDateCounter.get(dateKey) || 0) + 1;
          partDateCounter.set(dateKey, counter);
          
          transactions.push({
            type: 'expense',
            amount: parseFloat(totalCost.toFixed(2)),
          });
        }
      }
    });

    // Get expense transactions from parts used in repairs
    const allRepairs = await repairRepository
      .createQueryBuilder('repair')
      .where(
        '(repair.completedDate BETWEEN :startDate AND :endDate OR (repair.completedDate IS NULL AND repair.updatedAt BETWEEN :startDate AND :endDate))',
        { startDate, endDate }
      )
      .getMany();

    for (const repair of allRepairs) {
      let repairPartIds: string[] = [];
      if (repair.selectedPartIds) {
        try {
          const ids = JSON.parse(repair.selectedPartIds);
          if (Array.isArray(ids)) {
            repairPartIds = ids;
          }
        } catch (error) {
          console.error('Error parsing selectedPartIds:', error);
        }
      } else if (repair.selectedPartId) {
        repairPartIds = [repair.selectedPartId];
      }

      if (repairPartIds.length > 0) {
        const uniquePartIds = [...new Set(repairPartIds)];
        const parts = await partRepository.find({
          where: { id: In(uniquePartIds) },
        });

        const partCounts: Record<string, number> = {};
        repairPartIds.forEach((id) => {
          partCounts[id] = (partCounts[id] || 0) + 1;
        });

        parts.forEach((part) => {
          const count = partCounts[part.id] || 0;
          if (count > 0) {
            const costPrice = Number(part.costPrice || 0);
            const totalCost = costPrice * count;
            transactions.push({
              type: 'expense',
              amount: parseFloat(totalCost.toFixed(2)),
            });
          }
        });
      }
    }

    // คำนวณค่าใช้จ่ายรวมจาก transactions ที่ type === 'expense'
    const totalExpenses = transactions
      .filter(txn => txn.type === 'expense')
      .reduce((sum, txn) => sum + txn.amount, 0);

    // Net profit
    const netProfit = totalIncome - totalExpenses;

    // Calculate previous period for comparison
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - periodDays);
    const previousEndDate = new Date(startDate);

    // Get previous period income from transactions
    const previousIncomeTransactions = await transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.type = :type', { type: 'income' })
      .andWhere('transaction.createdAt BETWEEN :startDate AND :endDate', { 
        startDate: previousStartDate, 
        endDate: previousEndDate 
      })
      .getMany();

    const previousIncome = previousIncomeTransactions.reduce((sum, transaction) => {
      const amount = Number(transaction.totalCost || 0);
      return sum + amount;
    }, 0);

    // คำนวณค่าใช้จ่ายก่อนหน้าจากธุรกรรมล่าสุด (เอาธุรกรรมที่ type === 'expense')
    const previousTransactions: any[] = [];

    // Get previous period expense transactions from parts purchases
    const previousAllPartsWithStock = await partRepository
      .createQueryBuilder('part')
      .where('part.stockQuantity > 0')
      .andWhere('part.costPrice > 0')
      .getMany();

    const previousPartDateCounter = new Map<string, number>();
    previousAllPartsWithStock.forEach((part) => {
      const partCreatedDate = new Date(part.createdAt);
      const partUpdatedDate = new Date(part.updatedAt);
      
      const isInPreviousTimeRange = 
        (partCreatedDate >= previousStartDate && partCreatedDate <= previousEndDate) ||
        (partUpdatedDate >= previousStartDate && partUpdatedDate <= previousEndDate);
      
      if (isInPreviousTimeRange) {
        const costPrice = Number(part.costPrice || 0);
        const stockQty = Number(part.stockQuantity || 0);
        const totalCost = costPrice * stockQty;
        
        if (totalCost > 0) {
          previousTransactions.push({
            type: 'expense',
            amount: parseFloat(totalCost.toFixed(2)),
          });
        }
      }
    });

    // Get previous period expense transactions from parts used in repairs
    const previousAllRepairs = await repairRepository
      .createQueryBuilder('repair')
      .where(
        '(repair.completedDate BETWEEN :startDate AND :endDate OR (repair.completedDate IS NULL AND repair.updatedAt BETWEEN :startDate AND :endDate))',
        { startDate: previousStartDate, endDate: previousEndDate }
      )
      .getMany();

    for (const repair of previousAllRepairs) {
      let repairPartIds: string[] = [];
      if (repair.selectedPartIds) {
        try {
          const ids = JSON.parse(repair.selectedPartIds);
          if (Array.isArray(ids)) {
            repairPartIds = ids;
          }
        } catch (error) {
          console.error('Error parsing selectedPartIds:', error);
        }
      } else if (repair.selectedPartId) {
        repairPartIds = [repair.selectedPartId];
      }

      if (repairPartIds.length > 0) {
        const uniquePartIds = [...new Set(repairPartIds)];
        const parts = await partRepository.find({
          where: { id: In(uniquePartIds) },
        });

        const partCounts: Record<string, number> = {};
        repairPartIds.forEach((id) => {
          partCounts[id] = (partCounts[id] || 0) + 1;
        });

        parts.forEach((part) => {
          const count = partCounts[part.id] || 0;
          if (count > 0) {
            const costPrice = Number(part.costPrice || 0);
            const totalCost = costPrice * count;
            previousTransactions.push({
              type: 'expense',
              amount: parseFloat(totalCost.toFixed(2)),
            });
          }
        });
      }
    }

    // คำนวณค่าใช้จ่ายก่อนหน้าจาก transactions ที่ type === 'expense'
    const previousExpenses = previousTransactions
      .filter(txn => txn.type === 'expense')
      .reduce((sum, txn) => sum + txn.amount, 0);
    const previousProfit = previousIncome - previousExpenses;

    // Calculate percentage changes
    const incomeChange = previousIncome > 0 
      ? ((totalIncome - previousIncome) / previousIncome) * 100 
      : 0;
    const expensesChange = previousExpenses > 0 
      ? ((totalExpenses - previousExpenses) / previousExpenses) * 100 
      : 0;
    const profitChange = previousProfit !== 0 
      ? ((netProfit - previousProfit) / Math.abs(previousProfit)) * 100 
      : 0;

    // Calculate profit margin (อัตรากำไร)
    const profitMargin = totalIncome > 0 
      ? (netProfit / totalIncome) * 100 
      : 0;

    // Calculate stock value (มูลค่าสต็อกทั้งหมด)
    const allParts = await partRepository.find();
    const totalStockValue = allParts.reduce((sum, part) => {
      return sum + (Number(part.costPrice) * Number(part.stockQuantity));
    }, 0);

    // Calculate total stock quantity
    const totalStockQuantity = allParts.reduce((sum, part) => {
      return sum + Number(part.stockQuantity);
    }, 0);

    // Calculate average profit per repair
    const averageProfitPerRepair = completedRepairs.length > 0
      ? netProfit / completedRepairs.length
      : 0;

    // Calculate parts markup (กำไรจากอะไหล่ = ราคาขาย - ต้นทุนจริง)
    // คำนวณได้จากข้อมูลที่เรามีอยู่แล้ว
    const partsMarkup = totalPartsSalePrice - totalPartsCost;
    const partsMarkupPercentage = totalPartsCost > 0
      ? (partsMarkup / totalPartsCost) * 100
      : 0;

    res.json({
      status: 'success',
      data: {
        totalIncome: Number(totalIncome.toFixed(2)),
        totalExpenses: Number(totalExpenses.toFixed(2)),
        netProfit: Number(netProfit.toFixed(2)),
        totalPartsCost: Number(totalPartsCost.toFixed(2)), // ต้นทุนจริง
        totalPartsSalePrice: Number(totalPartsSalePrice.toFixed(2)), // ราคาขายอะไหล่
        partsMarkup: Number(partsMarkup.toFixed(2)), // กำไรจากอะไหล่
        partsMarkupPercentage: Number(partsMarkupPercentage.toFixed(2)), // % กำไรจากอะไหล่
        totalLaborCost: Number(totalLaborCost.toFixed(2)),
        incomeChange: Number(incomeChange.toFixed(1)),
        expensesChange: Number(expensesChange.toFixed(1)),
        profitChange: Number(profitChange.toFixed(1)),
        profitMargin: Number(profitMargin.toFixed(2)), // อัตรากำไร %
        totalStockValue: Number(totalStockValue.toFixed(2)), // มูลค่าสต็อก
        totalStockQuantity: totalStockQuantity, // จำนวนสต็อกทั้งหมด
        averageProfitPerRepair: Number(averageProfitPerRepair.toFixed(2)), // กำไรเฉลี่ยต่องาน
        totalRepairs: completedRepairs.length, // จำนวนงานที่เสร็จ
      },
    });
  } catch (error) {
    console.error('Get financial summary error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch financial summary',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get monthly income vs expenses chart data
router.get('/chart/income-expenses', async (req, res) => {
  try {
    const { timeRange = '6m' } = req.query;
    const { startDate, endDate } = getDateRange(timeRange as string);

    const repairRepository = AppDataSource.getRepository(Repair);
    const partRepository = AppDataSource.getRepository(Part);
    const transactionRepository = AppDataSource.getRepository(Transaction);

    // Generate month array
    const months: { month: string; monthTh: string; start: Date; end: Date }[] = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59, 999);
      
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthNamesTh = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      
      months.push({
        month: monthNames[current.getMonth()],
        monthTh: monthNamesTh[current.getMonth()],
        start: monthStart,
        end: monthEnd,
      });
      
      current.setMonth(current.getMonth() + 1);
    }

    // Calculate income and expenses for each month
    const chartData = await Promise.all(
      months.map(async (month) => {
        // Get completed repairs for this month
        const repairs = await repairRepository
          .createQueryBuilder('repair')
          .where('repair.status = :status', { status: RepairStatus.COMPLETED })
          .andWhere(
            '(repair.completedDate BETWEEN :startDate AND :endDate OR (repair.completedDate IS NULL AND repair.updatedAt BETWEEN :startDate AND :endDate))',
            { startDate: month.start, endDate: month.end }
          )
          .getMany();

        // Calculate income from transactions
        const monthIncomeTransactions = await transactionRepository
          .createQueryBuilder('transaction')
          .where('transaction.type = :type', { type: 'income' })
          .andWhere('transaction.createdAt BETWEEN :startDate AND :endDate', { 
            startDate: month.start, 
            endDate: month.end 
          })
          .getMany();

        const income = monthIncomeTransactions.reduce((sum: number, transaction: Transaction) => {
          const amount = Number(transaction.totalCost || 0);
          return sum + amount;
        }, 0);

        // คำนวณค่าใช้จ่ายรายเดือน (ต้นทุนจริงของอะไหล่ + ค่าแรง)
        // Get parts used in this month's repairs
        const monthPartIds: string[] = [];
        repairs.forEach((repair) => {
          if (repair.selectedPartIds) {
            try {
              const partIds = JSON.parse(repair.selectedPartIds);
              if (Array.isArray(partIds)) {
                monthPartIds.push(...partIds);
              }
            } catch (error) {
              console.error('Error parsing selectedPartIds:', error);
            }
          } else if (repair.selectedPartId) {
            monthPartIds.push(repair.selectedPartId);
          }
        });

        // คำนวณต้นทุนจริงของอะไหล่ที่ใช้ในเดือนนี้ (costPrice = ราคาทุนที่ซื้อมา)
        let monthPartsCost = 0;
        if (monthPartIds.length > 0) {
          const uniquePartIds = [...new Set(monthPartIds)];
          const monthParts = await partRepository.find({
            where: { id: In(uniquePartIds) },
          });

          const partCounts: Record<string, number> = {};
          monthPartIds.forEach((id) => {
            partCounts[id] = (partCounts[id] || 0) + 1;
          });

          monthParts.forEach((part) => {
            const count = partCounts[part.id] || 0;
            const partCost = Number(part.costPrice) || 0; // ใช้ costPrice (ต้นทุนจริง)
            monthPartsCost += partCost * count;
          });
        }

        // คำนวณจาก partsCost สำหรับงานที่ไม่มีอะไหล่ที่ระบุในระบบ
        repairs.forEach((repair) => {
          const hasPartsInSystem = (repair.selectedPartIds && repair.selectedPartIds.trim() !== '') || 
                                    repair.selectedPartId;
          
          if (!hasPartsInSystem) {
            const partsCost = Number(repair.partsCost || 0);
            monthPartsCost += partsCost;
          }
        });

        // ค่าแรงในเดือนนี้
        const monthLaborCost = repairs.reduce((sum, repair) => {
          return sum + Number(repair.laborCost || 0);
        }, 0);

        // คำนวณค่าใช้จ่ายจากการซื้ออะไหล่ในเดือนนี้
        const allPartsWithStock = await partRepository
          .createQueryBuilder('part')
          .where('part.stockQuantity > 0')
          .andWhere('part.costPrice > 0')
          .getMany();

        let monthPartsPurchaseCost = 0;
        allPartsWithStock.forEach((part) => {
          const partCreatedDate = new Date(part.createdAt);
          const partUpdatedDate = new Date(part.updatedAt);
          
          // ตรวจสอบว่าอะไหล่นี้สร้างหรืออัพเดทในเดือนนี้
          const isCreatedThisMonth = 
            partCreatedDate >= month.start && partCreatedDate <= month.end;
          const isUpdatedThisMonth = 
            partUpdatedDate >= month.start && partUpdatedDate <= month.end;
          
          if (isCreatedThisMonth || isUpdatedThisMonth) {
            const costPrice = Number(part.costPrice || 0);
            const stockQty = Number(part.stockQuantity || 0);
            const totalCost = costPrice * stockQty;
            
            if (totalCost > 0) {
              monthPartsPurchaseCost += totalCost;
            }
          }
        });

        // ค่าใช้จ่ายรวมของเดือน = ต้นทุนอะไหล่ที่ใช้ในงานซ่อม + ค่าแรง + ค่าใช้จ่ายจากการซื้ออะไหล่
        const expenses = monthPartsCost + monthLaborCost + monthPartsPurchaseCost;

        return {
          month: month.month,
          monthTh: month.monthTh,
          income: Number(income.toFixed(2)),
          expenses: Number(expenses.toFixed(2)),
        };
      })
    );

    res.json({
      status: 'success',
      data: chartData,
    });
  } catch (error) {
    console.error('Get income-expenses chart error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch chart data',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get expense breakdown (pie chart data)
router.get('/chart/expense-breakdown', async (req, res) => {
  try {
    const { timeRange = '6m' } = req.query;
    const { startDate, endDate } = getDateRange(timeRange as string);

    const repairRepository = AppDataSource.getRepository(Repair);
    const partRepository = AppDataSource.getRepository(Part);

    // Get completed repairs within date range
    const completedRepairs = await repairRepository
      .createQueryBuilder('repair')
      .where('repair.status = :status', { status: RepairStatus.COMPLETED })
      .andWhere(
        '(repair.completedDate BETWEEN :startDate AND :endDate OR (repair.completedDate IS NULL AND repair.updatedAt BETWEEN :startDate AND :endDate))',
        { startDate, endDate }
      )
      .getMany();

    // คำนวณต้นทุนจริงของอะไหล่ที่ใช้ในงานซ่อม (costPrice = ราคาทุนที่ซื้อมา)
    // สำหรับ expense breakdown ใช้ต้นทุนจริงในการคำนวณ
    const allPartIds: string[] = [];
    completedRepairs.forEach((repair) => {
      if (repair.selectedPartIds) {
        try {
          const partIds = JSON.parse(repair.selectedPartIds);
          if (Array.isArray(partIds)) {
            allPartIds.push(...partIds);
          }
        } catch (error) {
          console.error('Error parsing selectedPartIds:', error);
        }
      } else if (repair.selectedPartId) {
        allPartIds.push(repair.selectedPartId);
      }
    });

    let totalPartsCost = 0;
    if (allPartIds.length > 0) {
      const uniquePartIds = [...new Set(allPartIds)];
      const parts = await partRepository.find({
        where: { id: In(uniquePartIds) },
      });

      const partCounts: Record<string, number> = {};
      allPartIds.forEach((id) => {
        partCounts[id] = (partCounts[id] || 0) + 1;
      });

      parts.forEach((part) => {
        const count = partCounts[part.id] || 0;
        const partCost = Number(part.costPrice) || 0; // ใช้ costPrice (ต้นทุนจริง)
        totalPartsCost += partCost * count;
      });
    }

    // คำนวณจาก partsCost สำหรับงานที่ไม่มีอะไหล่ที่ระบุในระบบ
    completedRepairs.forEach((repair) => {
      const hasPartsInSystem = (repair.selectedPartIds && repair.selectedPartIds.trim() !== '') || 
                                repair.selectedPartId;
      
      if (!hasPartsInSystem) {
        const partsCost = Number(repair.partsCost || 0);
        totalPartsCost += partsCost;
      }
    });

    // Calculate total labor cost (ค่าแรง)
    const totalLaborCost = completedRepairs.reduce((sum, repair) => {
      return sum + Number(repair.laborCost || 0);
    }, 0);

    // ค่าใช้จ่ายรวม = ต้นทุนอะไหล่จริง + ค่าแรง
    const totalExpenses = totalPartsCost + totalLaborCost;

    // Calculate percentages
    const partsPercentage = totalExpenses > 0 
      ? (totalPartsCost / totalExpenses) * 100 
      : 0;
    const laborPercentage = totalExpenses > 0 
      ? (totalLaborCost / totalExpenses) * 100 
      : 0;

    // Expense breakdown - แสดงเฉพาะรายการที่มีค่ามากกว่า 0
    const breakdown = [];
    
    if (totalPartsCost > 0) {
      breakdown.push({
        name: 'partsCost',
        nameTh: 'ต้นทุนอะไหล่',
        value: Number(partsPercentage.toFixed(1)),
        amount: Number(totalPartsCost.toFixed(2)),
      });
    }
    
    if (totalLaborCost > 0) {
      breakdown.push({
        name: 'labor',
        nameTh: 'ค่าแรง',
        value: Number(laborPercentage.toFixed(1)),
        amount: Number(totalLaborCost.toFixed(2)),
      });
    }

    res.json({
      status: 'success',
      data: breakdown,
    });
  } catch (error) {
    console.error('Get expense breakdown error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch expense breakdown',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get recent transactions
router.get('/transactions', async (req, res) => {
  try {
    const { timeRange = '6m', type = 'all', limit = 50 } = req.query;
    const { startDate, endDate } = getDateRange(timeRange as string);

    const repairRepository = AppDataSource.getRepository(Repair);
    const partRepository = AppDataSource.getRepository(Part);
    const transactionRepository = AppDataSource.getRepository(Transaction);

    const transactions: any[] = [];

    // Get income transactions from Transaction table (created when repair is created)
    if (type === 'all' || type === 'income') {
      const incomeTransactions = await transactionRepository
        .createQueryBuilder('transaction')
        .where('transaction.type = :type', { type: 'income' })
        .andWhere('transaction.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
        .orderBy('transaction.createdAt', 'DESC')
        .take(Number(limit))
        .getMany();

      console.log(`[Transactions] Found ${incomeTransactions.length} income transactions`);

      incomeTransactions.forEach((transaction) => {
        const amount = Number(transaction.totalCost || 0);
        if (amount > 0) {
          const transactionDate = new Date(transaction.createdAt);
          
          // Extract repair number from descriptionTh (format: "เงินเข้า - อะไหล่ - REP-2026-XXX")
          let repairNumber = 'N/A';
          if (transaction.descriptionTh) {
            const match = transaction.descriptionTh.match(/REP-\d{4}-\d+/);
            if (match) {
              repairNumber = match[0];
            }
          }
          
          transactions.push({
            id: transaction.transactionNumber,
            type: 'income',
            description: transaction.description || `Income from Parts - ${repairNumber}`,
            descriptionTh: transaction.descriptionTh || `เงินเข้า - อะไหล่ - ${repairNumber}`,
            amount: parseFloat(amount.toFixed(2)),
            date: transactionDate.toISOString().split('T')[0],
            timestamp: transactionDate.getTime(), // Add timestamp for sorting
            method: 'Cash', // Default, you can add payment method to Repair entity later
            methodTh: 'เงินสด',
            repairId: repairNumber, // Store repair number for reference
          });
        }
      });
    }

    // Get parts purchases (expense transactions)
    // Note: Stock purchase transactions (type='purchase') are NOT shown in Finance transactions
    // They are only shown in Inventory page when adding stock
    if (type === 'all' || type === 'expense') {
      // Skip stock purchase transactions - they are only shown in Inventory page

      // 2. ดึงธุรกรรมจากอะไหล่ที่เพิ่มในคลัง (ราคาทุน) - สำหรับอะไหล่เก่าที่ยังไม่มีธุรกรรม
      // ดึงอะไหล่ทั้งหมดที่มีสต็อกและราคาทุน (ไม่จำกัดช่วงเวลา เพื่อให้มีข้อมูลแสดง)
      // แต่จะกรองตามวันที่สร้างหรืออัพเดท
      const allPartsWithStock = await partRepository
        .createQueryBuilder('part')
        .where('part.stockQuantity > 0')
        .andWhere('part.costPrice > 0')
        .orderBy('part.createdAt', 'DESC')
        .getMany();

      console.log(`[Transactions] Found ${allPartsWithStock.length} parts with stock`);

      // สร้าง transaction สำหรับอะไหล่ที่สร้างหรืออัพเดทในช่วงเวลาที่เลือก
      // หรือถ้าไม่มีอะไหล่ในช่วงเวลาที่เลือก ให้แสดงอะไหล่ทั้งหมดที่มีสต็อก (ใช้ createdAt เป็นวันที่)
      let partsInTimeRange = 0;
      allPartsWithStock.forEach((part) => {
        const partCreatedDate = new Date(part.createdAt);
        const partUpdatedDate = new Date(part.updatedAt);
        
        // ตรวจสอบว่าอะไหล่นี้สร้างหรืออัพเดทในช่วงเวลาที่เลือก
        const isInTimeRange = 
          (partCreatedDate >= startDate && partCreatedDate <= endDate) ||
          (partUpdatedDate >= startDate && partUpdatedDate <= endDate);
        
        if (isInTimeRange) {
          partsInTimeRange++;
        }
      });

      // ถ้ามีอะไหล่ในช่วงเวลาที่เลือก ให้แสดงเฉพาะอะไหล่ในช่วงเวลานั้น
      // ถ้าไม่มี ให้แสดงอะไหล่ทั้งหมดที่มีสต็อก (เพื่อให้มีข้อมูลแสดง)
      const partsToShow = partsInTimeRange > 0 
        ? allPartsWithStock.filter((part) => {
            const partCreatedDate = new Date(part.createdAt);
            const partUpdatedDate = new Date(part.updatedAt);
            return (partCreatedDate >= startDate && partCreatedDate <= endDate) ||
                   (partUpdatedDate >= startDate && partUpdatedDate <= endDate);
          })
        : allPartsWithStock.slice(0, 20); // แสดงสูงสุด 20 รายการถ้าไม่มีในช่วงเวลา

      console.log(`[Transactions] Showing ${partsToShow.length} parts (${partsInTimeRange} in time range)`);

      // ใช้ Map เพื่อนับลำดับของ transactions ต่อวัน
      const partDateCounter = new Map<string, number>();

      partsToShow.forEach((part) => {
        const costPrice = Number(part.costPrice || 0);
        const stockQty = Number(part.stockQuantity || 0);
        const totalCost = costPrice * stockQty;
        
        if (totalCost > 0) {
          const partName = part.nameTh || part.name;
          const partCreatedDate = new Date(part.createdAt);
          const partUpdatedDate = new Date(part.updatedAt);
          
          // ใช้วันที่ที่สร้างใหม่หรืออัพเดทล่าสุด
          let transactionDate: Date;
          if (partCreatedDate >= startDate && partCreatedDate <= endDate) {
            transactionDate = partCreatedDate;
          } else if (partUpdatedDate >= startDate && partUpdatedDate <= endDate) {
            transactionDate = partUpdatedDate;
          } else {
            // ถ้าไม่อยู่ในช่วงเวลา ให้ใช้ createdAt
            transactionDate = partCreatedDate;
          }
          
          // สร้าง Transaction ID ที่สั้นและอ่านง่าย (ใช้วันที่ + ลำดับ) รูปแบบเหมือน TXN-REP-2026-001
          const dateStr = transactionDate.toISOString().split('T')[0]; // YYYY-MM-DD
          const dateKey = dateStr.replace(/-/g, ''); // YYYYMMDD สำหรับนับลำดับ
          const counter = (partDateCounter.get(dateKey) || 0) + 1;
          partDateCounter.set(dateKey, counter);
          
          transactions.push({
            id: `PART-${dateStr}-${counter}`,
            type: 'expense',
            description: `Part Purchase - ${part.name} (${stockQty} units)`,
            descriptionTh: `ซื้ออะไหล่ - ${partName} (${stockQty} ชิ้น)`,
            amount: parseFloat(totalCost.toFixed(2)),
            date: transactionDate.toISOString().split('T')[0],
            timestamp: transactionDate.getTime(), // Add timestamp for sorting
            method: 'Transfer',
            methodTh: 'โอนเงิน',
            partId: part.id,
          });
        }
      });

      // 2. ดึงธุรกรรมจากอะไหล่ที่ใช้ในงานซ่อม (ต้นทุนจริง)
      const allRepairs = await repairRepository
        .createQueryBuilder('repair')
        .where(
          '(repair.completedDate BETWEEN :startDate AND :endDate OR (repair.completedDate IS NULL AND repair.updatedAt BETWEEN :startDate AND :endDate))',
          { startDate, endDate }
        )
        .orderBy('repair.completedDate', 'DESC', 'NULLS LAST')
        .addOrderBy('repair.updatedAt', 'DESC')
        .take(Number(limit))
        .getMany();

      // วนลูปผ่านงานซ่อมแต่ละงานเพื่อสร้าง transaction สำหรับอะไหล่ที่ใช้
      for (const repair of allRepairs) {
        const repairDate = repair.completedDate 
          ? new Date(repair.completedDate)
          : new Date(repair.updatedAt);
        
        let repairPartIds: string[] = [];
        if (repair.selectedPartIds) {
          try {
            const ids = JSON.parse(repair.selectedPartIds);
            if (Array.isArray(ids)) {
              repairPartIds = ids;
            }
          } catch (error) {
            console.error('Error parsing selectedPartIds:', error);
          }
        } else if (repair.selectedPartId) {
          repairPartIds = [repair.selectedPartId];
        }

        if (repairPartIds.length > 0) {
          const uniquePartIds = [...new Set(repairPartIds)];
          const parts = await partRepository.find({
            where: { id: In(uniquePartIds) },
          });

          const partCounts: Record<string, number> = {};
          repairPartIds.forEach((id) => {
            partCounts[id] = (partCounts[id] || 0) + 1;
          });

          // นับลำดับของ parts ที่ใช้ใน repair เดียวกัน
          let partIndex = 0;
          parts.forEach((part) => {
            const count = partCounts[part.id] || 0;
            if (count > 0) {
              partIndex++;
              const costPrice = Number(part.costPrice || 0);
              const totalCost = costPrice * count;
              const partName = part.nameTh || part.name;
              transactions.push({
                id: `EXP-${repair.repairNumber || 'N/A'}-${partIndex}`,
                type: 'expense',
                description: `Parts Used - ${part.name} (${count} units) - Repair ${repair.repairNumber || 'N/A'}`,
                descriptionTh: `อะไหล่ที่ใช้ - ${partName} (${count} ชิ้น) - งานซ่อม ${repair.repairNumber || 'N/A'}`,
                amount: parseFloat(totalCost.toFixed(2)),
                date: repairDate.toISOString().split('T')[0],
                timestamp: repairDate.getTime(), // Add timestamp for sorting
                method: 'Transfer',
                methodTh: 'โอนเงิน',
                partId: part.id,
                repairId: repair.id,
              });
            }
          });
        }
      }
    }

    // Sort by timestamp descending (newest first), then by date
    transactions.sort((a, b) => {
      // Use timestamp if available, otherwise fallback to date
      const timeA = a.timestamp || new Date(a.date).getTime();
      const timeB = b.timestamp || new Date(b.date).getTime();
      return timeB - timeA;
    });

    const limitedTransactions = transactions.slice(0, Number(limit));

    console.log(`[Transactions] Total transactions found: ${transactions.length}, returning ${limitedTransactions.length} transactions`);

    res.json({
      status: 'success',
      data: limitedTransactions,
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch transactions',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get today's revenue
router.get('/today', async (req, res) => {
  try {
    const transactionRepository = AppDataSource.getRepository(Transaction);

    // ตั้งเวลาวันนี้ (00:00:00 - 23:59:59)
    const today = new Date();
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    // ดึง Transaction ที่ type='income' และ createdAt เป็นวันนี้
    const todayIncomeTransactions = await transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.type = :type', { type: 'income' })
      .andWhere('transaction.createdAt BETWEEN :startDate AND :endDate', {
        startDate: startOfToday,
        endDate: endOfToday,
      })
      .getMany();

    // คำนวณรายได้วันนี้จาก Transaction
    const todayRevenue = todayIncomeTransactions.reduce((sum, transaction) => {
      const amount = Number(transaction.totalCost || 0);
      return sum + amount;
    }, 0);

    // ตั้งเวลาวันเมื่อวาน (00:00:00 - 23:59:59)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfYesterday = new Date(yesterday);
    startOfYesterday.setHours(0, 0, 0, 0);
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    // ดึง Transaction ที่ type='income' และ createdAt เป็นเมื่อวาน
    const yesterdayIncomeTransactions = await transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.type = :type', { type: 'income' })
      .andWhere('transaction.createdAt BETWEEN :startDate AND :endDate', {
        startDate: startOfYesterday,
        endDate: endOfYesterday,
      })
      .getMany();

    // คำนวณรายได้เมื่อวานจาก Transaction
    const yesterdayRevenue = yesterdayIncomeTransactions.reduce((sum, transaction) => {
      const amount = Number(transaction.totalCost || 0);
      return sum + amount;
    }, 0);

    // คำนวณเปอร์เซ็นต์การเปลี่ยนแปลง
    let revenueChange = 0;
    if (yesterdayRevenue > 0) {
      revenueChange = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
    } else if (todayRevenue > 0) {
      revenueChange = 100; // ถ้าเมื่อวานไม่มีรายได้ แต่วันนี้มี
    }

    console.log(`[Today Revenue] Today: ฿${todayRevenue.toFixed(2)} (${todayIncomeTransactions.length} transactions), Yesterday: ฿${yesterdayRevenue.toFixed(2)} (${yesterdayIncomeTransactions.length} transactions)`);

    res.json({
      status: 'success',
      data: {
        todayRevenue: Number(todayRevenue.toFixed(2)),
        yesterdayRevenue: Number(yesterdayRevenue.toFixed(2)),
        revenueChange: Number(revenueChange.toFixed(1)),
      },
    });
  } catch (error) {
    console.error('Get today revenue error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch today revenue',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get weekly income vs expenses chart data
router.get('/chart/weekly', async (req, res) => {
  try {
    const repairRepository = AppDataSource.getRepository(Repair);
    const partRepository = AppDataSource.getRepository(Part);
    const transactionRepository = AppDataSource.getRepository(Transaction);

    // คำนวณวันเริ่มต้นและสิ้นสุดของสัปดาห์นี้ (วันจันทร์ - วันอาทิตย์)
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // แปลงให้วันจันทร์เป็น 0
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - daysFromMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // สร้าง array ของวันในสัปดาห์
    const daysOfWeek = [];
    const dayNames = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
    const dayNamesEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      
      daysOfWeek.push({
        name: dayNames[i],
        nameEn: dayNamesEn[i],
        start: dayStart,
        end: dayEnd,
      });
    }

    // คำนวณรายได้และรายจ่ายสำหรับแต่ละวัน
    const chartData = await Promise.all(
      daysOfWeek.map(async (day) => {
        // ดึงงานซ่อมที่เสร็จแล้วในวันนี้
        const repairs = await repairRepository
          .createQueryBuilder('repair')
          .where('repair.status = :status', { status: RepairStatus.COMPLETED })
          .andWhere(
            '(repair.completedDate BETWEEN :startDate AND :endDate OR (repair.completedDate IS NULL AND repair.updatedAt BETWEEN :startDate AND :endDate))',
            { startDate: day.start, endDate: day.end }
          )
          .getMany();

        // คำนวณรายได้จาก transactions
        const dayIncomeTransactions = await transactionRepository
          .createQueryBuilder('transaction')
          .where('transaction.type = :type', { type: 'income' })
          .andWhere('transaction.createdAt BETWEEN :startDate AND :endDate', { 
            startDate: day.start, 
            endDate: day.end 
          })
          .getMany();

        const income = dayIncomeTransactions.reduce((sum, transaction) => {
          const amount = Number(transaction.totalCost || 0);
          return sum + amount;
        }, 0);

        // คำนวณรายจ่าย (ต้นทุนจริงของอะไหล่ + ค่าแรง)
        // ดึงอะไหล่ที่ใช้ในงานซ่อมของวันนี้
        const dayPartIds: string[] = [];
        repairs.forEach((repair) => {
          if (repair.selectedPartIds) {
            try {
              const partIds = JSON.parse(repair.selectedPartIds);
              if (Array.isArray(partIds)) {
                dayPartIds.push(...partIds);
              }
            } catch (error) {
              console.error('Error parsing selectedPartIds:', error);
            }
          } else if (repair.selectedPartId) {
            dayPartIds.push(repair.selectedPartId);
          }
        });

        // คำนวณต้นทุนจริงของอะไหล่ที่ใช้ในวันนี้
        let dayPartsCost = 0;
        if (dayPartIds.length > 0) {
          const uniquePartIds = [...new Set(dayPartIds)];
          const parts = await partRepository.find({
            where: { id: In(uniquePartIds) },
          });

          const partCounts: Record<string, number> = {};
          dayPartIds.forEach((id) => {
            partCounts[id] = (partCounts[id] || 0) + 1;
          });

          parts.forEach((part) => {
            const count = partCounts[part.id] || 0;
            const partCost = Number(part.costPrice) || 0;
            dayPartsCost += partCost * count;
          });
        }

        // คำนวณจาก partsCost สำหรับงานที่ไม่มีอะไหล่ที่ระบุในระบบ
        repairs.forEach((repair) => {
          const hasPartsInSystem = (repair.selectedPartIds && repair.selectedPartIds.trim() !== '') || 
                                    repair.selectedPartId;
          
          if (!hasPartsInSystem) {
            const partsCost = Number(repair.partsCost || 0);
            dayPartsCost += partsCost;
          }
        });

        // ค่าแรงในวันนี้
        const dayLaborCost = repairs.reduce((sum, repair) => {
          return sum + Number(repair.laborCost || 0);
        }, 0);

        // คำนวณค่าใช้จ่ายจากการซื้ออะไหล่ในวันนี้ (parts purchases)
        // ดึงอะไหล่ทั้งหมดที่มีสต็อกและราคาทุน แล้วกรองว่าสร้างหรืออัพเดทในวันนี้
        const allPartsWithStock = await partRepository
          .createQueryBuilder('part')
          .where('part.stockQuantity > 0')
          .andWhere('part.costPrice > 0')
          .getMany();

        let dayPartsPurchaseCost = 0;
        allPartsWithStock.forEach((part) => {
          const partCreatedDate = new Date(part.createdAt);
          const partUpdatedDate = new Date(part.updatedAt);
          
          // ตรวจสอบว่าอะไหล่นี้สร้างหรืออัพเดทในวันนี้
          const isCreatedToday = 
            partCreatedDate >= day.start && partCreatedDate <= day.end;
          const isUpdatedToday = 
            partUpdatedDate >= day.start && partUpdatedDate <= day.end;
          
          if (isCreatedToday || isUpdatedToday) {
            const costPrice = Number(part.costPrice || 0);
            const stockQty = Number(part.stockQuantity || 0);
            const totalCost = costPrice * stockQty;
            
            if (totalCost > 0) {
              // ถ้าสร้างในวันนี้ ใช้ stockQuantity ทั้งหมด
              // ถ้าอัพเดทในวันนี้ (แต่สร้างก่อนหน้า) ก็ใช้ stockQuantity ทั้งหมด
              // เพราะถือว่าเป็นการซื้ออะไหล่เพิ่มในวันนี้
              dayPartsPurchaseCost += totalCost;
            }
          }
        });

        // ค่าใช้จ่ายรวม = ต้นทุนอะไหล่ที่ใช้ในงานซ่อม + ค่าแรง + ค่าใช้จ่ายจากการซื้ออะไหล่
        const expenses = dayPartsCost + dayLaborCost + dayPartsPurchaseCost;

        return {
          name: day.name,
          nameEn: day.nameEn,
          income: Number(income.toFixed(2)),
          expenses: Number(expenses.toFixed(2)),
        };
      })
    );

    res.json({
      status: 'success',
      data: chartData,
    });
  } catch (error) {
    console.error('Get weekly income-expenses chart error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch weekly chart data',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get daily income vs expenses chart data
router.get('/chart/daily', async (req, res) => {
  try {
    const repairRepository = AppDataSource.getRepository(Repair);
    const partRepository = AppDataSource.getRepository(Part);
    const transactionRepository = AppDataSource.getRepository(Transaction);

    // คำนวณวันเริ่มต้นและสิ้นสุดของสัปดาห์นี้ (7 วันล่าสุด)
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const daysOfWeek = [];
    const dayNames = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
    const dayNamesEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    // สร้าง array ของ 7 วันล่าสุด
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayOfWeek = day.getDay();
      const dayNameIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // แปลงให้วันจันทร์เป็น 0
      
      daysOfWeek.push({
        name: dayNames[dayNameIndex],
        nameEn: dayNamesEn[dayNameIndex],
        date: day.toISOString().split('T')[0],
        start: dayStart,
        end: dayEnd,
      });
    }

    // คำนวณรายได้และรายจ่ายสำหรับแต่ละวัน
    const chartData = await Promise.all(
      daysOfWeek.map(async (day) => {
        // ดึงงานซ่อมที่เสร็จแล้วในวันนี้
        const repairs = await repairRepository
          .createQueryBuilder('repair')
          .where('repair.status = :status', { status: RepairStatus.COMPLETED })
          .andWhere(
            '(repair.completedDate BETWEEN :startDate AND :endDate OR (repair.completedDate IS NULL AND repair.updatedAt BETWEEN :startDate AND :endDate))',
            { startDate: day.start, endDate: day.end }
          )
          .getMany();

        // คำนวณรายได้จาก transactions
        const dayIncomeTransactions = await transactionRepository
          .createQueryBuilder('transaction')
          .where('transaction.type = :type', { type: 'income' })
          .andWhere('transaction.createdAt BETWEEN :startDate AND :endDate', { 
            startDate: day.start, 
            endDate: day.end 
          })
          .getMany();

        const income = dayIncomeTransactions.reduce((sum, transaction) => {
          const amount = Number(transaction.totalCost || 0);
          return sum + amount;
        }, 0);

        // คำนวณรายจ่าย (ต้นทุนจริงของอะไหล่ + ค่าแรง)
        // ดึงอะไหล่ที่ใช้ในงานซ่อมของวันนี้
        const dayPartIds: string[] = [];
        repairs.forEach((repair) => {
          if (repair.selectedPartIds) {
            try {
              const partIds = JSON.parse(repair.selectedPartIds);
              if (Array.isArray(partIds)) {
                dayPartIds.push(...partIds);
              }
            } catch (error) {
              console.error('Error parsing selectedPartIds:', error);
            }
          } else if (repair.selectedPartId) {
            dayPartIds.push(repair.selectedPartId);
          }
        });

        // คำนวณต้นทุนจริงของอะไหล่ที่ใช้ในวันนี้
        let dayPartsCost = 0;
        if (dayPartIds.length > 0) {
          const uniquePartIds = [...new Set(dayPartIds)];
          const parts = await partRepository.find({
            where: { id: In(uniquePartIds) },
          });

          const partCounts: Record<string, number> = {};
          dayPartIds.forEach((id) => {
            partCounts[id] = (partCounts[id] || 0) + 1;
          });

          parts.forEach((part) => {
            const count = partCounts[part.id] || 0;
            const partCost = Number(part.costPrice) || 0;
            dayPartsCost += partCost * count;
          });
        }

        // คำนวณจาก partsCost สำหรับงานที่ไม่มีอะไหล่ที่ระบุในระบบ
        repairs.forEach((repair) => {
          const hasPartsInSystem = (repair.selectedPartIds && repair.selectedPartIds.trim() !== '') || 
                                    repair.selectedPartId;
          
          if (!hasPartsInSystem) {
            const partsCost = Number(repair.partsCost || 0);
            dayPartsCost += partsCost;
          }
        });

        // ค่าแรงในวันนี้
        const dayLaborCost = repairs.reduce((sum, repair) => {
          return sum + Number(repair.laborCost || 0);
        }, 0);

        // คำนวณค่าใช้จ่ายจากการซื้ออะไหล่ในวันนี้ (parts purchases)
        const allPartsWithStock = await partRepository
          .createQueryBuilder('part')
          .where('part.stockQuantity > 0')
          .andWhere('part.costPrice > 0')
          .getMany();

        let dayPartsPurchaseCost = 0;
        allPartsWithStock.forEach((part) => {
          const partCreatedDate = new Date(part.createdAt);
          const partUpdatedDate = new Date(part.updatedAt);
          
          // ตรวจสอบว่าอะไหล่นี้สร้างหรืออัพเดทในวันนี้
          const isCreatedToday = 
            partCreatedDate >= day.start && partCreatedDate <= day.end;
          const isUpdatedToday = 
            partUpdatedDate >= day.start && partUpdatedDate <= day.end;
          
          if (isCreatedToday || isUpdatedToday) {
            const costPrice = Number(part.costPrice || 0);
            const stockQty = Number(part.stockQuantity || 0);
            const totalCost = costPrice * stockQty;
            
            if (totalCost > 0) {
              dayPartsPurchaseCost += totalCost;
            }
          }
        });

        // ค่าใช้จ่ายรวม = ต้นทุนอะไหล่ที่ใช้ในงานซ่อม + ค่าแรง + ค่าใช้จ่ายจากการซื้ออะไหล่
        const expenses = dayPartsCost + dayLaborCost + dayPartsPurchaseCost;

        return {
          name: day.name,
          nameEn: day.nameEn,
          date: day.date,
          income: Number(income.toFixed(2)),
          expenses: Number(expenses.toFixed(2)),
        };
      })
    );

    res.json({
      status: 'success',
      data: chartData,
    });
  } catch (error) {
    console.error('Get daily income-expenses chart error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch daily chart data',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
