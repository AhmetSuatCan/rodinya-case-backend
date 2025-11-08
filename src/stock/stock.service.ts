import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductWithStockDto } from './dto/product-with-stock.dto';
import { Product, ProductDocument } from './entities/product.entity';
import { Stock, StockDocument } from './entities/stock.entity';

@Injectable()
export class StockService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Stock.name) private stockModel: Model<StockDocument>,
  ) { }

  // Product CRUD operations
  async createProduct(createProductDto: CreateProductDto): Promise<Product> {
    const newProduct = new this.productModel(createProductDto);
    return await newProduct.save();
  }

  async findAllProducts(): Promise<Product[]> {
    return await this.productModel.find().exec();
  }

  async findOneProduct(id: string): Promise<Product> {
    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async updateProduct(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.productModel
      .findByIdAndUpdate(id, updateProductDto, {
        new: true,
        runValidators: true,
      })
      .exec();

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async removeProduct(id: string): Promise<void> {
    // Check if product has associated stock
    const stock = await this.stockModel.findOne({ productId: id }).exec();
    if (stock) {
      throw new ConflictException(
        'Cannot delete product that has associated stock. Delete stock first.',
      );
    }

    const result = await this.productModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
  }

  // Stock CRUD operations
  async createStock(createStockDto: CreateStockDto): Promise<Stock> {
    // Verify product exists
    const product = await this.findOneProduct(createStockDto.productId);

    // Check if stock already exists for this product
    const existingStock = await this.stockModel
      .findOne({ productId: createStockDto.productId })
      .exec();
    if (existingStock) {
      throw new ConflictException('Stock already exists for this product');
    }

    const newStock = new this.stockModel(createStockDto);
    return await newStock.save();
  }

  async findAllStocks(): Promise<Stock[]> {
    return await this.stockModel.find().populate('productId').exec();
  }

  async findOneStock(id: string): Promise<Stock> {
    const stock = await this.stockModel
      .findById(id)
      .populate('productId')
      .exec();
    if (!stock) {
      throw new NotFoundException(`Stock with ID ${id} not found`);
    }
    return stock;
  }

  async findOneStockWithoutPopulate(id: string): Promise<Stock> {
    const stock = await this.stockModel.findById(id).exec();
    if (!stock) {
      throw new NotFoundException(`Stock with ID ${id} not found`);
    }
    return stock;
  }

  async findStockByProduct(productId: string): Promise<Stock> {
    const stock = await this.stockModel
      .findOne({ productId: productId })
      .populate('productId')
      .exec();
    if (!stock) {
      throw new NotFoundException(`Stock for product ${productId} not found`);
    }
    return stock;
  }

  async updateStock(
    id: string,
    updateStockDto: UpdateStockDto,
  ): Promise<Stock> {
    const stock = await this.stockModel
      .findByIdAndUpdate(id, updateStockDto, { new: true, runValidators: true })
      .populate('productId')
      .exec();

    if (!stock) {
      throw new NotFoundException(`Stock with ID ${id} not found`);
    }
    return stock;
  }

  async removeStock(id: string): Promise<void> {
    const result = await this.stockModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Stock with ID ${id} not found`);
    }
  }

  // Legacy methods (keeping for backward compatibility)
  create(createStockDto: CreateStockDto) {
    return this.createStock(createStockDto);
  }

  findAll() {
    return this.findAllStocks();
  }

  findOne(id: string) {
    return this.findOneStock(id);
  }

  update(id: string, updateStockDto: UpdateStockDto) {
    return this.updateStock(id, updateStockDto);
  }

  remove(id: string) {
    return this.removeStock(id);
  }

  /**
   * Get all products with their available stock information
   * Returns products that have stock entries only
   */
  async findProductsWithStock(): Promise<ProductWithStockDto[]> {
    const stocksWithProducts = await this.stockModel
      .find()
      .populate('productId')
      .exec();

    return stocksWithProducts.map((stock) => {
      const product = stock.productId as Product;
      return {
        productId: product._id!,
        stockId: stock._id!,
        name: product.name,
        price: product.price,
        description: product.description,
        images: product.images,
        availableStock: stock.quantity,
        createdAt: product.createdAt!,
        updatedAt: product.updatedAt!,
      };
    });
  }

  /**
   * Get a specific product with its stock information
   */
  async findProductWithStock(productId: string): Promise<ProductWithStockDto> {
    const stock = await this.stockModel
      .findOne({ productId: productId })
      .populate('productId')
      .exec();

    if (!stock) {
      throw new NotFoundException(`Stock for product ${productId} not found`);
    }

    const product = stock.productId as Product;
    return {
      productId: product._id!,
      stockId: stock._id!,
      name: product.name,
      price: product.price,
      description: product.description,
      images: product.images,
      availableStock: stock.quantity,
      createdAt: product.createdAt!,
      updatedAt: product.updatedAt!,
    };
  }

  /**
   * Atomically decrements stock quantity using optimistic locking with MongoDB's __v field
   * Returns true if successful, false if insufficient stock or version conflict
   */
  async decrementStockAtomic(
    stockId: string,
    quantity: number,
  ): Promise<{ success: boolean; currentStock?: Stock; error?: string }> {
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        // Get current stock with MongoDB's built-in version (__v)
        const currentStock = await this.stockModel.findById(stockId).exec();
        if (!currentStock) {
          return { success: false, error: 'Stock not found' };
        }

        // Check if sufficient stock is available
        if (currentStock.quantity < quantity) {
          return {
            success: false,
            currentStock,
            error: `Insufficient stock. Available: ${currentStock.quantity}, Requested: ${quantity}`,
          };
        }

        // Attempt atomic update with __v version check (optimistic locking)
        const updatedStock = await this.stockModel
          .findOneAndUpdate(
            {
              _id: stockId,
              __v: currentStock.__v, // Use MongoDB's built-in version field
            },
            {
              $inc: {
                quantity: -quantity, // Decrement quantity (__v auto-incremented by Mongoose)
              },
            },
            {
              new: true,
              runValidators: true,
            },
          )
          .populate('productId')
          .exec();

        if (!updatedStock) {
          // Version conflict - another process updated the stock
          retryCount++;
          continue;
        }

        return { success: true, currentStock: updatedStock };
      } catch (error) {
        return { success: false, error: `Database error: ${error.message}` };
      }
    }

    return {
      success: false,
      error: 'Max retries exceeded due to version conflicts',
    };
  }

  /**
   * Atomically increments stock quantity (for rollbacks) - __v auto-incremented by Mongoose
   */
  async incrementStockAtomic(
    stockId: string,
    quantity: number,
  ): Promise<{ success: boolean; currentStock?: Stock; error?: string }> {
    try {
      const updatedStock = await this.stockModel
        .findByIdAndUpdate(
          stockId,
          {
            $inc: {
              quantity: quantity, // Increment quantity (__v auto-incremented by Mongoose)
            },
          },
          {
            new: true,
            runValidators: true,
          },
        )
        .populate('productId')
        .exec();

      if (!updatedStock) {
        return { success: false, error: 'Stock not found' };
      }

      return { success: true, currentStock: updatedStock };
    } catch (error) {
      return { success: false, error: `Database error: ${error.message}` };
    }
  }
}
