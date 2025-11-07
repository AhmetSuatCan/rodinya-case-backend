import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product, ProductDocument } from './entities/product.entity';
import { Stock, StockDocument } from './entities/stock.entity';

@Injectable()
export class StockService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Stock.name) private stockModel: Model<StockDocument>,
  ) {}

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

  async updateProduct(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const product = await this.productModel.findByIdAndUpdate(
      id,
      updateProductDto,
      { new: true, runValidators: true }
    ).exec();
    
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async removeProduct(id: string): Promise<void> {
    // Check if product has associated stock
    const stock = await this.stockModel.findOne({ product: id }).exec();
    if (stock) {
      throw new ConflictException('Cannot delete product that has associated stock. Delete stock first.');
    }

    const result = await this.productModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
  }

  // Stock CRUD operations
  async createStock(createStockDto: CreateStockDto): Promise<Stock> {
    // Verify product exists
    const product = await this.findOneProduct(createStockDto.product);
    
    // Check if stock already exists for this product
    const existingStock = await this.stockModel.findOne({ product: createStockDto.product }).exec();
    if (existingStock) {
      throw new ConflictException('Stock already exists for this product');
    }

    const newStock = new this.stockModel(createStockDto);
    return await newStock.save();
  }

  async findAllStocks(): Promise<Stock[]> {
    return await this.stockModel.find().populate('product').exec();
  }

  async findOneStock(id: string): Promise<Stock> {
    const stock = await this.stockModel.findById(id).populate('product').exec();
    if (!stock) {
      throw new NotFoundException(`Stock with ID ${id} not found`);
    }
    return stock;
  }

  async findStockByProduct(productId: string): Promise<Stock> {
    const stock = await this.stockModel.findOne({ product: productId }).populate('product').exec();
    if (!stock) {
      throw new NotFoundException(`Stock for product ${productId} not found`);
    }
    return stock;
  }

  async updateStock(id: string, updateStockDto: UpdateStockDto): Promise<Stock> {
    const stock = await this.stockModel.findByIdAndUpdate(
      id,
      updateStockDto,
      { new: true, runValidators: true }
    ).populate('product').exec();
    
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
}
