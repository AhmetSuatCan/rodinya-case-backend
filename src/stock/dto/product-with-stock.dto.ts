import { ApiProperty } from '@nestjs/swagger';
import { Types } from 'mongoose';

export class ProductWithStockDto {
  @ApiProperty({
    description: 'Product ID',
    example: '507f1f77bcf86cd799439011',
  })
  productId: Types.ObjectId;

  @ApiProperty({
    description: 'Stock ID',
    example: '507f1f77bcf86cd799439012',
  })
  stockId: Types.ObjectId;

  @ApiProperty({
    description: 'Product name',
    example: 'iPhone 15 Pro',
  })
  name: string;

  @ApiProperty({
    description: 'Product price',
    example: 999.99,
  })
  price: number;

  @ApiProperty({
    description: 'Product description',
    example: 'Latest iPhone with advanced camera system',
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: 'Product images',
    example: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
    required: false,
    type: [String],
  })
  images?: string[];

  @ApiProperty({
    description: 'Available stock quantity',
    example: 25,
  })
  availableStock: number;

  @ApiProperty({
    description: 'Product creation date',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Product last update date',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt: Date;
}
