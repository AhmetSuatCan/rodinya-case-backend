import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsBoolean,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Types } from 'mongoose';

export class CreateOrderDto {
  @ApiProperty({
    description: 'The ID of the stock item being ordered',
    example: '507f1f77bcf86cd799439013',
  })
  @IsNotEmpty()
  @IsString()
  stockId: string;

  @ApiProperty({
    description: 'Quantity of the product to order',
    example: 2,
    minimum: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: 'Price of the product at the time of purchase',
    example: 29.99,
    minimum: 0,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  priceAtPurchase: number;
}
