import { Router } from 'express';
import { AppDataSource } from '../config/data-source.js';
import { Customer } from '../entities/Customer.js';
import { Repair } from '../entities/Repair.js';
import { WarrantyClaim } from '../entities/WarrantyClaim.js';
import { Transaction } from '../entities/Transaction.js';
import { Like } from 'typeorm';
import { normalizePhone, validatePhone } from '../utils/phone.js';

const router = Router();

// Validation helper functions
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Get all customers
router.get('/', async (req, res) => {
  try {
    const customerRepository = AppDataSource.getRepository(Customer);
    const customers = await customerRepository.find({
      order: { createdAt: 'DESC' },
    });

    res.json({
      status: 'success',
      data: customers,
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch customers',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Search customers by name or phone (if no query, return all customers)
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    const customerRepository = AppDataSource.getRepository(Customer);
    
    // If no query or empty query, return all customers (limited to 20)
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      const customers = await customerRepository.find({
        relations: ['repairs'],
        order: { createdAt: 'DESC' },
        take: 20, // Limit to 20 results
      });

      return res.json({
        status: 'success',
        data: customers,
        count: customers.length,
      });
    }

    const searchTerm = q.trim();
    
    // Try to normalize phone number if it's a valid phone format
    // This allows searching with +66 format to find normalized phone (0)
    let normalizedSearchTerm = searchTerm;
    if (validatePhone(searchTerm)) {
      normalizedSearchTerm = normalizePhone(searchTerm);
    }
    
    // Search by name (firstName, lastName, fullName) or phone
    // Search both original and normalized phone to support both formats
    const customers = await customerRepository.find({
      where: [
        { firstName: Like(`%${searchTerm}%`) },
        { lastName: Like(`%${searchTerm}%`) },
        { fullName: Like(`%${searchTerm}%`) },
        { phone: Like(`%${searchTerm}%`) },
        ...(normalizedSearchTerm !== searchTerm ? [{ phone: Like(`%${normalizedSearchTerm}%`) }] : []),
      ],
      relations: ['repairs'],
      order: { createdAt: 'DESC' },
      take: 20, // Limit to 20 results
    });

    res.json({
      status: 'success',
      data: customers,
      count: customers.length,
    });
  } catch (error) {
    console.error('Search customers error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to search customers',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get customer by ID with all repair history
router.get('/:id/with-repairs', async (req, res) => {
  try {
    const { id } = req.params;
    const customerRepository = AppDataSource.getRepository(Customer);
    const customer = await customerRepository.findOne({
      where: { id },
      relations: ['repairs'],
    });

    if (!customer) {
      return res.status(404).json({
        status: 'error',
        message: 'Customer not found',
      });
    }

    // Sort repairs by creation date (newest first)
    if (customer.repairs) {
      customer.repairs.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    res.json({
      status: 'success',
      data: customer,
    });
  } catch (error) {
    console.error('Get customer with repairs error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch customer with repairs',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get customer by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const customerRepository = AppDataSource.getRepository(Customer);
    const customer = await customerRepository.findOne({
      where: { id },
      relations: ['repairs'],
    });

    if (!customer) {
      return res.status(404).json({
        status: 'error',
        message: 'Customer not found',
      });
    }

    res.json({
      status: 'success',
      data: customer,
    });
  } catch (error) {
    console.error('Get customer by ID error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch customer',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Create customer
router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, phone, email, lineId, device } = req.body;

    // Validation
    if (!firstName || !firstName.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'First name is required',
      });
    }

    if (!lastName || !lastName.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Last name is required',
      });
    }

    if (email && !validateEmail(email)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid email format',
      });
    }

    if (phone && !validatePhone(phone)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid phone number format (should be 9-10 digits)',
      });
    }

    const customerRepository = AppDataSource.getRepository(Customer);
    
    // Normalize phone number if provided
    const normalizedPhone = phone ? normalizePhone(phone.trim()) : undefined;
    
    // Check if phone already exists
    if (normalizedPhone) {
      const existingCustomer = await customerRepository.findOne({
        where: { phone: normalizedPhone },
      });
      if (existingCustomer) {
        return res.status(400).json({
          status: 'error',
          message: 'Phone number already exists',
        });
      }
    }

    const newCustomer = customerRepository.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone ? normalizePhone(phone.trim()) : undefined,
      lineId: lineId?.trim() || undefined,
      device: device?.trim() || undefined,
    });

    const savedCustomer = await customerRepository.save(newCustomer);

    res.status(201).json({
      status: 'success',
      data: savedCustomer,
      message: 'Customer created successfully',
    });
  } catch (error) {
    console.error('Create customer error:', error);
    
    // Handle database constraint errors
    if (error instanceof Error && error.message.includes('duplicate')) {
      return res.status(400).json({
        status: 'error',
        message: 'Customer with this information already exists',
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to create customer',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update customer
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, email, lineId, device } = req.body;
    
    const customerRepository = AppDataSource.getRepository(Customer);
    const customer = await customerRepository.findOne({ where: { id } });

    if (!customer) {
      return res.status(404).json({
        status: 'error',
        message: 'Customer not found',
      });
    }

    // Validation
    if (firstName !== undefined && (!firstName || !firstName.trim())) {
      return res.status(400).json({
        status: 'error',
        message: 'First name cannot be empty',
      });
    }

    if (lastName !== undefined && (!lastName || !lastName.trim())) {
      return res.status(400).json({
        status: 'error',
        message: 'Last name cannot be empty',
      });
    }

    if (email && !validateEmail(email)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid email format',
      });
    }

    if (phone && !validatePhone(phone)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid phone number format (should be 9-10 digits)',
      });
    }

    // Normalize phone number if provided
    const normalizedPhone = phone ? normalizePhone(phone.trim()) : undefined;
    
    // Check if phone already exists (excluding current customer)
    if (normalizedPhone) {
      // Find customers with the same normalized phone (handles different formats)
      const allCustomers = await customerRepository.find({
        where: {},
      });
      
      // Check if any other customer has a phone that normalizes to the same number
      const duplicateCustomer = allCustomers.find(c => {
        if (c.id === id) return false; // Skip current customer
        if (!c.phone) return false;
        const normalizedDbPhone = normalizePhone(c.phone);
        return normalizedDbPhone === normalizedPhone;
      });
      
      if (duplicateCustomer) {
        return res.status(400).json({
          status: 'error',
          message: 'Phone number already exists',
        });
      }
    }

    // Update only provided fields
    if (firstName !== undefined) customer.firstName = firstName.trim();
    if (lastName !== undefined) customer.lastName = lastName.trim();
    if (phone !== undefined) customer.phone = phone ? normalizePhone(phone.trim()) : undefined;
    if (lineId !== undefined) customer.lineId = lineId?.trim() || undefined;
    if (device !== undefined) customer.device = device?.trim() || undefined;

    const updatedCustomer = await customerRepository.save(customer);

    res.json({
      status: 'success',
      data: updatedCustomer,
      message: 'Customer updated successfully',
    });
  } catch (error) {
    console.error('Update customer error:', error);
    
    // Handle database constraint errors
    if (error instanceof Error && error.message.includes('duplicate')) {
      return res.status(400).json({
        status: 'error',
        message: 'Customer with this information already exists',
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to update customer',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete customer
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const customerRepository = AppDataSource.getRepository(Customer);
    const repairRepository = AppDataSource.getRepository(Repair);
    const warrantyRepository = AppDataSource.getRepository(WarrantyClaim);
    const transactionRepository = AppDataSource.getRepository(Transaction);
    
    const customer = await customerRepository.findOne({ 
      where: { id },
      relations: ['repairs'],
    });

    if (!customer) {
      return res.status(404).json({
        status: 'error',
        message: 'Customer not found',
      });
    }

    console.log(`[Delete Customer] Attempting to delete customer ${id} (${customer.firstName} ${customer.lastName || ''})`);

    // Get all repairs for this customer
    const repairs = await repairRepository.find({
      where: { customerId: id },
    });

    console.log(`[Delete Customer] Found ${repairs.length} repair(s) to delete`);

    // Delete all related data for each repair
    for (const repair of repairs) {
      console.log(`[Delete Customer] Processing repair ${repair.repairNumber}...`);

      // 1. Delete Bills associated with this repair
      try {
        const billsResult = await AppDataSource.query(
          'SELECT id FROM bills WHERE "repairId" = $1',
          [repair.id]
        );
        if (billsResult && billsResult.length > 0) {
          console.log(`[Delete Customer] Found ${billsResult.length} bill(s) for repair ${repair.repairNumber}`);
          await AppDataSource.query('DELETE FROM bills WHERE "repairId" = $1', [repair.id]);
          console.log(`[Delete Customer] Deleted ${billsResult.length} bill(s) for repair ${repair.repairNumber}`);
        }
      } catch (error) {
        console.error(`[Delete Customer] Error deleting bills for repair ${repair.repairNumber}:`, error);
      }

      // 2. Delete WarrantyClaims associated with this repair
      try {
        const warrantyClaims = await warrantyRepository.find({
          where: { repairId: repair.id },
        });
        if (warrantyClaims.length > 0) {
          console.log(`[Delete Customer] Found ${warrantyClaims.length} warranty claim(s) for repair ${repair.repairNumber}`);
          await warrantyRepository.delete({ repairId: repair.id });
          console.log(`[Delete Customer] Deleted ${warrantyClaims.length} warranty claim(s) for repair ${repair.repairNumber}`);
        }
      } catch (error) {
        console.error(`[Delete Customer] Error deleting warranty claims for repair ${repair.repairNumber}:`, error);
      }

      // 3. Delete Transactions associated with this repair
      try {
        const relatedTransactions = await transactionRepository.find({
          where: {
            descriptionTh: `เงินเข้า - อะไหล่ - ${repair.repairNumber}`,
          },
        });
        if (relatedTransactions.length > 0) {
          console.log(`[Delete Customer] Found ${relatedTransactions.length} transaction(s) for repair ${repair.repairNumber}`);
          await transactionRepository.remove(relatedTransactions);
          console.log(`[Delete Customer] Deleted ${relatedTransactions.length} transaction(s) for repair ${repair.repairNumber}`);
        }
      } catch (error) {
        console.error(`[Delete Customer] Error deleting transactions for repair ${repair.repairNumber}:`, error);
      }

      // 4. Restore stock for parts used in this repair
      try {
        const partIdsToRestore: string[] = [];
        if (repair.selectedPartIds) {
          try {
            const parsed = JSON.parse(repair.selectedPartIds);
            if (Array.isArray(parsed)) {
              partIdsToRestore.push(...parsed);
            }
          } catch (error) {
            console.error(`[Delete Customer] Error parsing selectedPartIds for repair ${repair.repairNumber}:`, error);
          }
        } else if (repair.selectedPartId) {
          partIdsToRestore.push(repair.selectedPartId);
        }

        if (partIdsToRestore.length > 0) {
          const { Part } = await import('../entities/Part.js');
          const partRepository = AppDataSource.getRepository(Part);
          
          const partCounts: Record<string, number> = {};
          partIdsToRestore.forEach(id => {
            partCounts[id] = (partCounts[id] || 0) + 1;
          });

          for (const [partId, quantity] of Object.entries(partCounts)) {
            const part = await partRepository.findOne({ where: { id: partId } });
            if (part) {
              part.stockQuantity = part.stockQuantity + quantity;
              await partRepository.save(part);
              console.log(`[Delete Customer] Restored stock for part ${partId} by ${quantity}. New stock: ${part.stockQuantity}`);
            }
          }
        }
      } catch (error) {
        console.error(`[Delete Customer] Error restoring stock for repair ${repair.repairNumber}:`, error);
      }
    }

    // 5. Delete all repairs for this customer
    if (repairs.length > 0) {
      try {
        await repairRepository.delete({ customerId: id });
        console.log(`[Delete Customer] Deleted ${repairs.length} repair(s) for customer ${id}`);
      } catch (error) {
        console.error(`[Delete Customer] Error deleting repairs:`, error);
        throw error;
      }
    }

    // 6. Finally, delete the customer
    await customerRepository.delete(id);
    console.log(`[Delete Customer] Successfully deleted customer ${id}`);

    res.json({
      status: 'success',
      message: 'Customer and all related data deleted successfully',
      deletedCounts: {
        repairs: repairs.length,
      },
    });
  } catch (error) {
    console.error('[Delete Customer] Error details:', error);
    if (error instanceof Error) {
      console.error('[Delete Customer] Error message:', error.message);
      console.error('[Delete Customer] Error stack:', error.stack);
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to delete customer',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

