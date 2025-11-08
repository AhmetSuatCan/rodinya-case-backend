import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { StockService } from './stock.service';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@ApiTags('Stock Management')
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  // Product endpoints
  @Post('products')
  @ApiOperation({ summary: 'Create a new product' })
  @ApiBody({ type: CreateProductDto })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  createProduct(@Body() createProductDto: CreateProductDto) {
    return this.stockService.createProduct(createProductDto);
  }

  @Get('products')
  @ApiOperation({ summary: 'Get all products' })
  @ApiResponse({ status: 200, description: 'List of all products' })
  findAllProducts() {
    return this.stockService.findAllProducts();
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiParam({
    name: 'id',
    description: 'Product ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({ status: 200, description: 'Product found' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findOneProduct(@Param('id') id: string) {
    return this.stockService.findOneProduct(id);
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Update a product' })
  @ApiParam({
    name: 'id',
    description: 'Product ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  updateProduct(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.stockService.updateProduct(id, updateProductDto);
  }

  @Delete('products/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a product' })
  @ApiParam({
    name: 'id',
    description: 'Product ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({ status: 204, description: 'Product deleted successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete product with associated stock',
  })
  removeProduct(@Param('id') id: string) {
    return this.stockService.removeProduct(id);
  }

  // Stock endpoints
  @Post()
  @ApiOperation({ summary: 'Create stock for a product' })
  @ApiBody({ type: CreateStockDto })
  @ApiResponse({ status: 201, description: 'Stock created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({
    status: 409,
    description: 'Stock already exists for this product',
  })
  create(@Body() createStockDto: CreateStockDto) {
    return this.stockService.create(createStockDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all stock entries' })
  @ApiResponse({
    status: 200,
    description: 'List of all stock entries with populated product data',
  })
  findAll() {
    return this.stockService.findAll();
  }

  @Get('by-product/:productId')
  @ApiOperation({ summary: 'Get stock by product ID' })
  @ApiParam({
    name: 'productId',
    description: 'Product ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({ status: 200, description: 'Stock found for product' })
  @ApiResponse({ status: 404, description: 'Stock not found for product' })
  findStockByProduct(@Param('productId') productId: string) {
    return this.stockService.findStockByProduct(productId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get stock by ID' })
  @ApiParam({
    name: 'id',
    description: 'Stock ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({ status: 200, description: 'Stock found' })
  @ApiResponse({ status: 404, description: 'Stock not found' })
  findOne(@Param('id') id: string) {
    return this.stockService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update stock quantity' })
  @ApiParam({
    name: 'id',
    description: 'Stock ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiBody({ type: UpdateStockDto })
  @ApiResponse({ status: 200, description: 'Stock updated successfully' })
  @ApiResponse({ status: 404, description: 'Stock not found' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  update(@Param('id') id: string, @Body() updateStockDto: UpdateStockDto) {
    return this.stockService.update(id, updateStockDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete stock entry' })
  @ApiParam({
    name: 'id',
    description: 'Stock ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({ status: 204, description: 'Stock deleted successfully' })
  @ApiResponse({ status: 404, description: 'Stock not found' })
  remove(@Param('id') id: string) {
    return this.stockService.remove(id);
  }
}
