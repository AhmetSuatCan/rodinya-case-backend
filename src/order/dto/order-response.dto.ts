import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../entities/order.entity';

export class OrderResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the order',
    example: '507f1f77bcf86cd799439013',
  })
  _id: string;

  @ApiProperty({
    description: 'The ID of the user who placed the order',
    example: '507f1f77bcf86cd799439011',
  })
  userId: string;

  @ApiProperty({
    description: 'The ID of the product being ordered',
    example: '507f1f77bcf86cd799439012',
  })
  productId: string;

  @ApiProperty({
    description: 'The ID of the stock item being ordered',
    example: '507f1f77bcf86cd799439013',
  })
  stockId: string;

  @ApiProperty({
    description: 'Quantity of the product ordered',
    example: 2,
  })
  quantity: number;

  @ApiProperty({
    description: 'Price of the product at the time of purchase',
    example: 29.99,
  })
  priceAtPurchase: number;

  @ApiProperty({
    description: 'Current status of the order',
    enum: OrderStatus,
    example: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @ApiProperty({
    description: 'Whether this is a VIP order',
    example: false,
  })
  isVipOrder: boolean;

  @ApiProperty({
    description: 'Reason for order failure (empty if not failed)',
    example: '',
  })
  failureReason: string;

  @ApiProperty({
    description: 'When the order was created',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When the order was last updated',
    example: '2024-01-15T10:35:00.000Z',
  })
  updatedAt: Date;
}
