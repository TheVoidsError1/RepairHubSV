import { Router } from 'express';
import { AppDataSource } from '../config/data-source.js';
import { Customer } from '../entities/Customer.js';
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
    const normalizedPhone = phone ? normalizePhone(phone.trim()) : null;
    
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
      phone: phone ? normalizePhone(phone.trim()) : null,
      lineId: lineId?.trim() || null,
      device: device?.trim() || null,
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

    // Check if email already exists (excluding current customer)


    // Update only provided fields
    if (firstName !== undefined) customer.firstName = firstName.trim();
    if (lastName !== undefined) customer.lastName = lastName.trim();
    if (phone !== undefined) customer.phone = phone ? normalizePhone(phone.trim()) : null;
    if (lineId !== undefined) customer.lineId = lineId?.trim() || null;
    if (device !== undefined) customer.device = device?.trim() || null;

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

    // Check if customer has repairs
    if (customer.repairs && customer.repairs.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot delete customer with existing repairs. Please delete or reassign repairs first.',
        repairsCount: customer.repairs.length,
      });
    }

    await customerRepository.remove(customer);

    res.json({
      status: 'success',
      message: 'Customer deleted successfully',
    });
  } catch (error) {
    console.error('Delete customer error:', error);
    
    // Handle foreign key constraint errors
    if (error instanceof Error && error.message.includes('foreign key')) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot delete customer with existing repairs',
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to delete customer',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

