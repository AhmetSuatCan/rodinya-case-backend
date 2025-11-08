import {
  Controller,
  Post,
  Get,
  Body,
  HttpStatus,
  HttpCode,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OrderService, OrderPayload } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('orders')
@Controller('orders')
export class OrderController {
  private readonly logger = new Logger(OrderController.name);

  constructor(private readonly orderService: OrderService) { }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new order',
    description:
      'Creates a new order and adds it to the processing queue with appropriate priority based on VIP status. The product ID is automatically fetched from the stock. Requires authentication.',
  })
  @ApiBody({ type: CreateOrderDto })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully and added to queue',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async createOrder(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser() user: User,
  ): Promise<OrderResponseDto> {
    const startTime = Date.now();

    // Extract user info from JWT token
    const userId = (user as any)._id.toString();
    const isVip = user.isVIP;

    this.logger.log(
      `Incoming order request - User: ${userId}, VIP: ${isVip}, Stock: ${createOrderDto.stockId}, Quantity: ${createOrderDto.quantity}`,
    );

    try {
      // Create the order payload - no custom orderId, MongoDB will generate _id
      // productId will be fetched from stock in the service
      const orderPayload: OrderPayload = {
        userId: userId,
        productId: '', // Will be populated by OrderService from stock
        stockId: createOrderDto.stockId,
        quantity: createOrderDto.quantity,
        priceAtPurchase: createOrderDto.priceAtPurchase,
        isVipOrder: isVip,
      };

      this.logger.debug(
        `Order payload created - ${JSON.stringify({
          userId,
          stockId: createOrderDto.stockId,
          quantity: createOrderDto.quantity,
          priceAtPurchase: createOrderDto.priceAtPurchase,
          isVipOrder: isVip,
        })}`,
      );

      // Create the order using the service (now returns the created order document)
      this.logger.log(`Creating order for user ${userId} with stock ${createOrderDto.stockId}`);

      const createdOrder = await this.orderService.createOrder(
        orderPayload,
        isVip,
      );

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `Order created successfully - OrderId: ${createdOrder._id}, UserId: ${userId}, ProductId: ${createdOrder.productId}, Status: ${createdOrder.status}, ProcessingTime: ${processingTime}ms`,
      );

      // Populate the created order to get product and stock details
      const populatedOrder = await this.orderService.findOrderById(createdOrder._id.toString());

      // Return the created order with user-friendly format
      return {
        _id: populatedOrder._id.toString(),
        userId: populatedOrder.userId.toString(),
        productName: (populatedOrder.productId as any).name,
        productDescription: (populatedOrder.productId as any).description,
        availableStock: (populatedOrder.stockId as any).quantity,
        quantity: populatedOrder.quantity,
        priceAtPurchase: populatedOrder.priceAtPurchase,
        status: populatedOrder.status,
        isVipOrder: populatedOrder.isVipOrder,
        failureReason: populatedOrder.failureReason,
        createdAt: populatedOrder.createdAt,
        updatedAt: populatedOrder.updatedAt,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(
        `Order creation failed - UserId: ${userId}, StockId: ${createOrderDto.stockId}, Error: ${error.message}, ProcessingTime: ${processingTime}ms`,
        error.stack,
      );

      // Re-throw the error to let NestJS handle the HTTP response
      throw error;
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user orders',
    description: 'Retrieves all orders for the authenticated user with product details and current stock information, sorted by creation date (most recent first).',
  })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully',
    type: [OrderResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getUserOrders(@CurrentUser() user: User): Promise<OrderResponseDto[]> {
    const startTime = Date.now();
    const userId = (user as any)._id.toString();

    this.logger.log(`Fetching orders for user: ${userId}`);

    try {
      const orders = await this.orderService.findOrdersByUserId(userId);

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `Orders retrieved successfully - UserId: ${userId}, Count: ${orders.length}, ProcessingTime: ${processingTime}ms`,
      );

      // Transform orders to response DTOs
      return orders.map(order => ({
        _id: order._id.toString(),
        userId: order.userId.toString(),
        productName: (order.productId as any).name,
        productDescription: (order.productId as any).description,
        availableStock: (order.stockId as any).quantity,
        quantity: order.quantity,
        priceAtPurchase: order.priceAtPurchase,
        status: order.status,
        isVipOrder: order.isVipOrder,
        failureReason: order.failureReason,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      }));
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(
        `Failed to retrieve orders - UserId: ${userId}, Error: ${error.message}, ProcessingTime: ${processingTime}ms`,
        error.stack,
      );

      throw error;
    }
  }
}
