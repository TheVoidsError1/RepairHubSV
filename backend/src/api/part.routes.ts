import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AppDataSource } from '../config/data-source.js';
import { Part } from '../entities/Part.js';
import { Transaction } from '../entities/Transaction.js';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'uploads', 'parts');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-random-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `part-${uniqueSuffix}${ext}`);
  }
});

// File filter - only allow images
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Error handling middleware for multer
const handleMulterError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        message: 'File too large. Maximum size is 5MB',
      });
    }
    return res.status(400).json({
      status: 'error',
      message: err.message,
    });
  }
  if (err) {
    return res.status(400).json({
      status: 'error',
      message: err.message || 'File upload error',
    });
  }
  next();
};

// Validation helper functions
const validatePrice = (price: any): boolean => {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  return !isNaN(numPrice) && numPrice >= 0;
};

const validateInteger = (value: any): boolean => {
  const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
  return !isNaN(numValue) && Number.isInteger(numValue) && numValue >= 0;
};

// Get all parts
router.get('/', async (req, res) => {
  try {
    const partRepository = AppDataSource.getRepository(Part);
    const parts = await partRepository.find({
      order: { createdAt: 'DESC' },
    });

    res.json({
      status: 'success',
      data: parts,
    });
  } catch (error) {
    console.error('Get parts error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch parts',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get part by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const partRepository = AppDataSource.getRepository(Part);
    const part = await partRepository.findOne({ where: { id } });

    if (!part) {
      return res.status(404).json({
        status: 'error',
        message: 'Part not found',
      });
    }

    res.json({
      status: 'success',
      data: part,
    });
  } catch (error) {
    console.error('Get part by ID error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch part',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Upload image endpoint
router.post('/upload-image', upload.single('image'), handleMulterError, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No image file provided',
      });
    }

    const imageUrl = `/uploads/parts/${req.file.filename}`;

    res.json({
      status: 'success',
      data: {
        imageUrl: imageUrl,
        filename: req.file.filename,
      },
      message: 'Image uploaded successfully',
    });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to upload image',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Create part
router.post('/', upload.single('image'), handleMulterError, async (req: Request, res: Response) => {
  try {
    const { 
      name,
      nameTh,
      partNumber, 
      brand, 
      model, 
      description, 
      costPrice,
      price, 
      stockQuantity, 
      minStockLevel, 
      category,
      categoryTh,
      location, 
      notes 
    } = req.body;

    // Handle image upload
    let imageUrl: string | undefined = undefined;
    if (req.file) {
      imageUrl = `/uploads/parts/${req.file.filename}`;
    }

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Part name is required',
      });
    }

    if (price === undefined || price === null) {
      return res.status(400).json({
        status: 'error',
        message: 'Selling price is required',
      });
    }

    if (!validatePrice(price)) {
      return res.status(400).json({
        status: 'error',
        message: 'Selling price must be a valid number greater than or equal to 0',
      });
    }

    if (costPrice !== undefined && costPrice !== null && !validatePrice(costPrice)) {
      return res.status(400).json({
        status: 'error',
        message: 'Cost price must be a valid number greater than or equal to 0',
      });
    }

    if (stockQuantity !== undefined && stockQuantity !== null && !validateInteger(stockQuantity)) {
      return res.status(400).json({
        status: 'error',
        message: 'Stock quantity must be a valid integer greater than or equal to 0',
      });
    }

    if (minStockLevel !== undefined && minStockLevel !== null && !validateInteger(minStockLevel)) {
      return res.status(400).json({
        status: 'error',
        message: 'Minimum stock level must be a valid integer greater than or equal to 0',
      });
    }

    const partRepository = AppDataSource.getRepository(Part);
    
    // Check if partNumber already exists (if provided)
    if (partNumber && partNumber.trim()) {
      const existingPart = await partRepository.findOne({
        where: { partNumber: partNumber.trim() },
      });
      if (existingPart) {
        return res.status(400).json({
          status: 'error',
          message: 'Part number already exists',
        });
      }
    }

    const newPart = partRepository.create({
      name: name.trim(),
      nameTh: nameTh?.trim() || null,
      partNumber: partNumber?.trim() || null,
      brand: brand?.trim() || null,
      model: model?.trim() || null,
      description: description?.trim() || null,
      costPrice: costPrice !== undefined && costPrice !== null
        ? (typeof costPrice === 'string' ? parseFloat(costPrice) : costPrice)
        : 0,
      price: typeof price === 'string' ? parseFloat(price) : price,
      stockQuantity: stockQuantity !== undefined && stockQuantity !== null 
        ? (typeof stockQuantity === 'string' ? parseInt(stockQuantity, 10) : stockQuantity)
        : 0,
      minStockLevel: minStockLevel !== undefined && minStockLevel !== null
        ? (typeof minStockLevel === 'string' ? parseInt(minStockLevel, 10) : minStockLevel)
        : 10,
      category: category?.trim() || null,
      categoryTh: categoryTh?.trim() || null,
      location: location?.trim() || null,
      notes: notes?.trim() || null,
      imageUrl: imageUrl || undefined,
    });

    const savedPart = await partRepository.save(newPart);

    res.status(201).json({
      status: 'success',
      data: savedPart,
      message: 'Part created successfully',
    });
  } catch (error) {
    console.error('Create part error:', error);
    
    // Handle database constraint errors
    if (error instanceof Error && error.message.includes('duplicate')) {
      return res.status(400).json({
        status: 'error',
        message: 'Part with this information already exists',
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to create part',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update part
router.put('/:id', upload.single('image'), handleMulterError, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      name,
      nameTh,
      partNumber, 
      brand, 
      model, 
      description,
      costPrice,
      price, 
      stockQuantity, 
      minStockLevel, 
      category,
      categoryTh,
      location, 
      notes,
      imageUrl: imageUrlFromBody
    } = req.body;
    
    const partRepository = AppDataSource.getRepository(Part);
    const part = await partRepository.findOne({ where: { id } });

    if (!part) {
      return res.status(404).json({
        status: 'error',
        message: 'Part not found',
      });
    }

    // Validation
    if (name !== undefined && (!name || !name.trim())) {
      return res.status(400).json({
        status: 'error',
        message: 'Part name cannot be empty',
      });
    }

    if (price !== undefined && price !== null && !validatePrice(price)) {
      return res.status(400).json({
        status: 'error',
        message: 'Selling price must be a valid number greater than or equal to 0',
      });
    }

    if (costPrice !== undefined && costPrice !== null && !validatePrice(costPrice)) {
      return res.status(400).json({
        status: 'error',
        message: 'Cost price must be a valid number greater than or equal to 0',
      });
    }

    if (stockQuantity !== undefined && stockQuantity !== null && !validateInteger(stockQuantity)) {
      return res.status(400).json({
        status: 'error',
        message: 'Stock quantity must be a valid integer greater than or equal to 0',
      });
    }

    if (minStockLevel !== undefined && minStockLevel !== null && !validateInteger(minStockLevel)) {
      return res.status(400).json({
        status: 'error',
        message: 'Minimum stock level must be a valid integer greater than or equal to 0',
      });
    }

    // Check if partNumber already exists (excluding current part)
    if (partNumber && partNumber.trim() && partNumber !== part.partNumber) {
      const existingPart = await partRepository.findOne({
        where: { partNumber: partNumber.trim() },
      });
      if (existingPart) {
        return res.status(400).json({
          status: 'error',
          message: 'Part number already exists',
        });
      }
    }

    // Handle image upload - if new file is uploaded, delete old one
    if (req.file) {
      // Delete old image if exists
      if (part.imageUrl) {
        const oldImagePath = path.join(process.cwd(), part.imageUrl);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      part.imageUrl = `/uploads/parts/${req.file.filename}`;
    } else if (imageUrlFromBody !== undefined) {
      // If imageUrl is explicitly set to null/empty, delete the old image
      if (imageUrlFromBody === null || imageUrlFromBody === '') {
        if (part.imageUrl) {
          const oldImagePath = path.join(process.cwd(), part.imageUrl);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
        part.imageUrl = undefined;
      } else if (imageUrlFromBody !== part.imageUrl) {
        // If imageUrl is provided and different, update it
        part.imageUrl = imageUrlFromBody;
      }
    }

    // Update only provided fields
    if (name !== undefined) part.name = name.trim();
    if (nameTh !== undefined) part.nameTh = nameTh?.trim() || null;
    if (partNumber !== undefined) part.partNumber = partNumber?.trim() || null;
    if (brand !== undefined) part.brand = brand?.trim() || null;
    if (model !== undefined) part.model = model?.trim() || null;
    if (description !== undefined) part.description = description?.trim() || null;
    if (costPrice !== undefined && costPrice !== null) {
      part.costPrice = typeof costPrice === 'string' ? parseFloat(costPrice) : costPrice;
    }
    if (price !== undefined && price !== null) {
      part.price = typeof price === 'string' ? parseFloat(price) : price;
    }
    if (stockQuantity !== undefined && stockQuantity !== null) {
      part.stockQuantity = typeof stockQuantity === 'string' 
        ? parseInt(stockQuantity, 10) 
        : stockQuantity;
    }
    if (minStockLevel !== undefined && minStockLevel !== null) {
      part.minStockLevel = typeof minStockLevel === 'string' 
        ? parseInt(minStockLevel, 10) 
        : minStockLevel;
    }
    if (category !== undefined) part.category = category?.trim() || null;
    if (categoryTh !== undefined) part.categoryTh = categoryTh?.trim() || null;
    if (location !== undefined) part.location = location?.trim() || null;
    if (notes !== undefined) part.notes = notes?.trim() || null;

    const updatedPart = await partRepository.save(part);

    res.json({
      status: 'success',
      data: updatedPart,
      message: 'Part updated successfully',
    });
  } catch (error) {
    console.error('Update part error:', error);
    
    // Handle database constraint errors
    if (error instanceof Error && error.message.includes('duplicate')) {
      return res.status(400).json({
        status: 'error',
        message: 'Part with this information already exists',
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to update part',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Add stock to part (with transaction recording)
router.post('/:id/add-stock', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    // Validation
    if (!quantity || !validateInteger(quantity) || quantity <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Quantity must be a valid integer greater than 0',
      });
    }

    const partRepository = AppDataSource.getRepository(Part);
    const transactionRepository = AppDataSource.getRepository(Transaction);
    
    const part = await partRepository.findOne({ where: { id } });

    if (!part) {
      return res.status(404).json({
        status: 'error',
        message: 'Part not found',
      });
    }

    const quantityToAdd = typeof quantity === 'string' ? parseInt(quantity, 10) : quantity;
    const quantityBefore = part.stockQuantity;
    const quantityAfter = quantityBefore + quantityToAdd;

    // Generate transaction number
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    // Count today's transactions for sequential numbering
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    
    const todayCount = await transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.createdAt >= :start', { start: todayStart })
      .andWhere('transaction.createdAt < :end', { end: todayEnd })
      .getCount();
    
    const sequenceNumber = String(todayCount + 1).padStart(3, '0');
    const transactionNumber = `EXP-STOCK-${year}-${month}-${sequenceNumber}`;

    // Calculate total cost
    const costPerUnit = Number(part.costPrice);
    const totalCost = costPerUnit * quantityToAdd;

    // Update part stock
    part.stockQuantity = quantityAfter;
    await partRepository.save(part);

    // Create transaction record
    const partName = part.nameTh || part.name || 'Unknown';
    const transaction = transactionRepository.create({
      transactionNumber,
      partId: part.id,
      type: 'purchase',
      quantityAdded: quantityToAdd,
      totalCost,
      description: `Stock Purchase - ${part.name || 'Unknown'} (${quantityToAdd} units)`,
      descriptionTh: `ซื้อสต็อก - ${partName} จาก ${quantityBefore} เพิ่มเป็น ${quantityAfter} (${quantityToAdd} ชิ้น)`,
    });

    const savedTransaction = await transactionRepository.save(transaction);

    // Return with part details
    const transactionWithPart = await transactionRepository.findOne({
      where: { id: savedTransaction.id },
      relations: ['part'],
    });

    res.json({
      status: 'success',
      data: {
        part,
        transaction: transactionWithPart,
      },
      message: 'Stock added successfully',
    });
  } catch (error) {
    console.error('Add stock error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add stock',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete part
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const partRepository = AppDataSource.getRepository(Part);
    const part = await partRepository.findOne({ where: { id } });

    if (!part) {
      return res.status(404).json({
        status: 'error',
        message: 'Part not found',
      });
    }

    // Delete associated image file if exists
    if (part.imageUrl) {
      const imagePath = path.join(process.cwd(), part.imageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await partRepository.remove(part);

    res.json({
      status: 'success',
      message: 'Part deleted successfully',
    });
  } catch (error) {
    console.error('Delete part error:', error);
    
    // Handle foreign key constraint errors
    if (error instanceof Error && error.message.includes('foreign key')) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot delete part that is being used in repairs',
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to delete part',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

