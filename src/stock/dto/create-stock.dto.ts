import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  IsMongoId,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStockDto {
  @ApiProperty({
    description: 'Product ID to create stock for',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  @IsMongoId()
  productId: string;

  @ApiPropertyOptional({
    description: 'Initial quantity of stock',
    example: 100,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  quantity?: number;
}
