import { OnQueueEvent } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bullmq';
import { Model } from 'mongoose';
import { ORDER_QUEUE_NAME } from './order.constants';
import { Order, OrderDocument, OrderStatus } from './entities/order.entity';

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
export class OrderDLQProcessor {
  private readonly logger = new Logger(OrderDLQProcessor.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
  ) {}

  /**
   * Listen for failed jobs and update corresponding orders to FAILED status
   */
  @OnQueueEvent('failed')
  async handleFailedJob(job: Job<OrderPayload>, error: Error): Promise<void> {
    this.logger.warn(
      `Job ${job.id} failed permanently. Updating order status to FAILED.`,
    );

    const { orderId } = job.data;

    try {
      // Update order status to FAILED with failure reason
      const updatedOrder = await this.orderModel.findByIdAndUpdate(
        orderId,
        {
          status: OrderStatus.FAILED,
          failureReason:
            error.message || 'Job processing failed after all retries',
        },
        { new: true },
      );

      if (updatedOrder) {
        this.logger.log(
          `Order ${orderId} status updated to FAILED due to job failure`,
        );
      } else {
        this.logger.error(
          `Order ${orderId} not found when trying to update status to FAILED`,
        );
      }
    } catch (updateError) {
      this.logger.error(
        `Failed to update order ${orderId} status to FAILED: ${updateError.message}`,
        updateError.stack,
      );
    }
  }

  /**
   * Listen for stalled jobs (jobs that have been running too long)
   */
  @OnQueueEvent('stalled')
  async handleStalledJob(job: Job<OrderPayload>): Promise<void> {
    this.logger.warn(
      `Job ${job.id} has stalled. Order ${job.data.orderId} may need attention.`,
    );

    // Optionally, you could implement logic to handle stalled jobs
    // For now, we'll just log it as BullMQ will retry stalled jobs automatically
  }

  /**
   * Listen for completed jobs (optional - for monitoring)
   */
  @OnQueueEvent('completed')
  async handleCompletedJob(job: Job<OrderPayload>): Promise<void> {
    this.logger.log(
      `Job ${job.id} completed successfully for order ${job.data.orderId}`,
    );
  }

  /**
   * Listen for jobs that are waiting in the queue (optional - for monitoring)
   */
  @OnQueueEvent('waiting')
  async handleWaitingJob(job: Job<OrderPayload>): Promise<void> {
    this.logger.debug(
      `Job ${job.id} is waiting in queue for order ${job.data.orderId}`,
    );
  }

  /**
   * Listen for active jobs (optional - for monitoring)
   */
  @OnQueueEvent('active')
  async handleActiveJob(job: Job<OrderPayload>): Promise<void> {
    this.logger.debug(
      `Job ${job.id} is now active, processing order ${job.data.orderId}`,
    );
  }
}
