import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { Model } from 'mongoose';
import { ORDER_QUEUE_NAME } from './order.constants';
import { Order, OrderDocument, OrderStatus } from './entities/order.entity';
import { StockService } from '../stock/stock.service';

export interface OrderPayload {
  userId: string;
  productId: string;
  stockId: string;
  quantity: number;
  priceAtPurchase: number;
  isVipOrder: boolean;
  orderId?: string; // MongoDB ObjectId (added when queuing)
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  private readonly PRIORITY_VIP = 1;
  // Normal users get no explicit priority (undefined = default priority)

  constructor(
    @InjectQueue(ORDER_QUEUE_NAME) private readonly orderQueue: Queue,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly stockService: StockService,
  ) {}

  async createOrder(
    orderData: OrderPayload,
    isVip: boolean,
  ): Promise<OrderDocument> {
    const priority = isVip ? this.PRIORITY_VIP : undefined;

    // Step 1: Fetch stock to get productId (without populating for better performance)
    const stock = await this.stockService.findOneStockWithoutPopulate(
      orderData.stockId,
    );
    const productId = stock.productId.toString();

    // Step 2: Create order document with PENDING status
    const orderDoc = new this.orderModel({
      userId: orderData.userId,
      productId: productId,
      stockId: orderData.stockId,
      quantity: orderData.quantity,
      priceAtPurchase: orderData.priceAtPurchase,
      status: OrderStatus.PENDING,
      isVipOrder: orderData.isVipOrder,
    });

    // Save order to database with PENDING status
    const savedOrder = await orderDoc.save();
    this.logger.log(`Order created in database with ID: ${savedOrder._id}`);

    try {
      // Step 3: Add job to queue - let BullMQ generate unique job ID
      const jobOptions = {
        priority,
        removeOnComplete: { count: 500 }, // Keep last 500 completed jobs for monitoring
        removeOnFail: { count: 10 },
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2 seconds
        },
      };

      const queuePayload = {
        ...orderData,
        productId: productId, // Add the fetched productId
        orderId: savedOrder._id.toString(),
      };

      const job = await this.orderQueue.add(
        'process-order',
        queuePayload,
        jobOptions,
      );
      this.logger.log(
        `Order job created successfully: ${job.id} with priority ${priority}`,
      );

      return savedOrder;
    } catch (error) {
      this.logger.error(
        `Failed to queue order job for order ${savedOrder._id}: ${error.message}`,
        error.stack,
      );

      // DO NOT delete the order - it remains PENDING
      // Dead-letter queue listener will handle failed jobs and update order status
      this.logger.warn(
        `Order ${savedOrder._id} remains PENDING - will be handled by dead-letter queue listener`,
      );

      throw error;
    }
  }

  async findOrdersByUserId(userId: string): Promise<OrderDocument[]> {
    this.logger.log(`Finding orders for user: ${userId}`);
    
    const orders = await this.orderModel
      .find({ userId })
      .populate('productId', 'name description')
      .populate('stockId', 'quantity')
      .sort({ createdAt: -1 }) // Most recent orders first
      .exec();

    this.logger.log(`Found ${orders.length} orders for user: ${userId}`);
    return orders;
  }

  async findOrderById(orderId: string): Promise<OrderDocument> {
    this.logger.log(`Finding order by ID: ${orderId}`);
    
    const order = await this.orderModel
      .findById(orderId)
      .populate('productId', 'name description')
      .populate('stockId', 'quantity')
      .exec();

    if (!order) {
      throw new Error(`Order with ID ${orderId} not found`);
    }

    return order;
  }
}
