import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateOrderDto } from './create-order.dto';
import { OrderStatus } from '../entities/order.entity';

export class UpdateOrderDto extends PartialType(CreateOrderDto) {
  @ApiPropertyOptional({
    description: 'Current status of the order',
    enum: OrderStatus,
    example: OrderStatus.CONFIRMED,
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    description: 'Reason for order failure (if status is FAILED)',
    example: 'Out of stock',
  })
  @IsOptional()
  @IsString()
  failureReason?: string;
}
