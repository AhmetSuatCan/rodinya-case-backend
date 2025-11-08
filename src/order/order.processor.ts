import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bullmq';
import { Model } from 'mongoose';
import { ORDER_QUEUE_NAME } from './order.constants';
import { Order, OrderDocument, OrderStatus } from './entities/order.entity';
import { StockService } from '../stock/stock.service';
import { BusinessLogicError } from './order.errors';

export interface OrderPayload {
  userId: string;
  productId: string;
  stockId: string;
  quantity: number;
  priceAtPurchase: number;
  isVipOrder: boolean;
  orderId: string; // MongoDB ObjectId
}

@Injectable()
@Processor(ORDER_QUEUE_NAME)
export class OrderProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderProcessor.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly stockService: StockService,
  ) {
    super();
  }

  async process(job: Job<OrderPayload>): Promise<void> {
    this.logger.log(
      `Starting order processing for job ${job.id} with priority ${job.opts.priority}`,
    );

    const { orderId, stockId, quantity } = job.data;
    
    this.logger.log(
      `Processing order - OrderId: ${orderId}, StockId: ${stockId}, Quantity: ${quantity}`,
    );

    try {
      // Step 1: Atomically decrement stock with optimistic locking
      this.logger.log(
        `Attempting atomic stock decrement for stockId: ${stockId}, quantity: ${quantity}`,
      );

      const stockResult = await this.stockService.decrementStockAtomic(
        stockId,
        quantity,
      );

      if (!stockResult.success) {
        // Check if this is a transient error (version conflicts) or permanent error (business logic)
        if (stockResult.error?.includes('version conflicts') || stockResult.error?.includes('Database error')) {
          // Transient error - should retry
          throw new Error(stockResult.error || 'Transient stock operation failed');
        } else {
          // Permanent failure - business logic error (insufficient stock or stock not found)
          throw new BusinessLogicError(
            stockResult.error || 'Stock operation failed',
          );
        }
      }

      this.logger.log(
        `Stock decremented successfully. New quantity: ${stockResult.currentStock?.quantity}`,
      );

      try {
        // Step 2: Simulate potential transient failures (e.g., payment gateway)
        // In a real implementation, this would be actual external service calls
        if (Math.random() < 0.1) {
          // 10% chance of simulated network failure
          throw new Error('Payment gateway timeout - please retry');
        }

        // Step 3: Business logic passed - update order status to CONFIRMED
        this.logger.log(`Attempting to update order ${orderId} to CONFIRMED status`);
        
        const updatedOrder = await this.orderModel.findByIdAndUpdate(
          orderId,
          {
            status: OrderStatus.CONFIRMED,
            failureReason: '',
          },
          { new: true },
        );

        if (updatedOrder) {
          this.logger.log(
            `Order ${orderId} processed successfully and confirmed. New status: ${updatedOrder.status}`,
          );
        } else {
          this.logger.error(
            `CRITICAL: Order ${orderId} not found when trying to update to CONFIRMED status`,
          );
        }
      } catch (transientError) {
        // Rollback stock if order confirmation fails
        this.logger.warn(
          `Order confirmation failed, rolling back stock for order ${orderId}`,
        );

        const rollbackResult = await this.stockService.incrementStockAtomic(
          stockId,
          quantity,
        );
        if (!rollbackResult.success) {
          this.logger.error(
            `CRITICAL: Failed to rollback stock for order ${orderId}: ${rollbackResult.error}`,
          );
        } else {
          this.logger.log(`Stock rollback successful for order ${orderId}`);
        }

        // Re-throw the transient error to trigger retry
        throw transientError;
      }
    } catch (error) {
      if (error instanceof BusinessLogicError) {
        // Permanent failure - log as warning and move to failed without retry
        this.logger.warn(
          `Business logic error for order ${orderId}: ${error.message}`,
        );

        // Update order status to FAILED
        await this.orderModel.findByIdAndUpdate(
          orderId,
          {
            status: OrderStatus.FAILED,
            failureReason: error.message,
          },
          { new: true },
        );

        // Move job to failed state bypassing retries
        await job.moveToFailed(error, job.token || '0');

        // Do not re-throw - this prevents BullMQ from retrying
        return;
      } else {
        // Transient error - log as error and let BullMQ handle retry
        this.logger.error(
          `Transient error for order ${orderId}: ${error.message}`,
          error.stack,
        );

        // Re-throw to let BullMQ handle exponential backoff and retry
        throw error;
      }
    }
  }
}
