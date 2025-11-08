import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Job } from 'bullmq';
import { Model, Types } from 'mongoose';
import { OrderDLQProcessor, OrderPayload } from './order-dlq.processor';
import { Order, OrderDocument, OrderStatus } from './entities/order.entity';

describe('OrderDLQProcessor', () => {
  let processor: OrderDLQProcessor;
  let orderModel: jest.Mocked<Model<OrderDocument>>;

  const mockOrderPayload: OrderPayload = {
    userId: '507f1f77bcf86cd799439011',
    productId: '507f1f77bcf86cd799439012',
    stockId: '507f1f77bcf86cd799439013',
    quantity: 2,
    priceAtPurchase: 99.99,
    isVipOrder: false,
    orderId: '507f1f77bcf86cd799439014',
  };

  const mockJob = {
    id: 'job-123',
    data: mockOrderPayload,
  } as Job<OrderPayload>;

  const mockUpdatedOrder = {
    _id: new Types.ObjectId(mockOrderPayload.orderId),
    status: OrderStatus.FAILED,
    failureReason: 'Job processing failed after all retries',
  } as Partial<OrderDocument>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderDLQProcessor,
        {
          provide: getModelToken(Order.name),
          useValue: {
            findByIdAndUpdate: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get<OrderDLQProcessor>(OrderDLQProcessor);
    orderModel = module.get(getModelToken(Order.name));

    jest.clearAllMocks();
  });

  describe('handleFailedJob', () => {
    it('should update order status to FAILED when job fails permanently', async () => {
      // Arrange
      const error = new Error('Payment gateway unreachable');
      orderModel.findByIdAndUpdate.mockResolvedValue(mockUpdatedOrder);

      // Act
      await processor.handleFailedJob(mockJob, error);

      // Assert
      expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockOrderPayload.orderId,
        {
          status: OrderStatus.FAILED,
          failureReason: 'Payment gateway unreachable',
        },
        { new: true },
      );
    });

    it('should handle missing error message gracefully', async () => {
      // Arrange
      const error = new Error(); // Error without message
      orderModel.findByIdAndUpdate.mockResolvedValue(mockUpdatedOrder);

      // Act
      await processor.handleFailedJob(mockJob, error);

      // Assert
      expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockOrderPayload.orderId,
        {
          status: OrderStatus.FAILED,
          failureReason: 'Job processing failed after all retries',
        },
        { new: true },
      );
    });

    it('should handle case when order is not found', async () => {
      // Arrange
      const error = new Error('Test error');
      orderModel.findByIdAndUpdate.mockResolvedValue(null);

      // Act
      await processor.handleFailedJob(mockJob, error);

      // Assert
      expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockOrderPayload.orderId,
        {
          status: OrderStatus.FAILED,
          failureReason: 'Test error',
        },
        { new: true },
      );
    });

    it('should handle database update errors gracefully', async () => {
      // Arrange
      const jobError = new Error('Original job error');
      const updateError = new Error('Database connection failed');
      orderModel.findByIdAndUpdate.mockRejectedValue(updateError);

      // Act
      await processor.handleFailedJob(mockJob, jobError);

      // Assert
      expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockOrderPayload.orderId,
        {
          status: OrderStatus.FAILED,
          failureReason: 'Original job error',
        },
        { new: true },
      );
    });
  });

  describe('handleStalledJob', () => {
    it('should log stalled job information', async () => {
      // Arrange
      const loggerSpy = jest.spyOn(processor['logger'], 'warn');

      // Act
      await processor.handleStalledJob(mockJob);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        `Job ${mockJob.id} has stalled. Order ${mockOrderPayload.orderId} may need attention.`,
      );
    });
  });

  describe('handleCompletedJob', () => {
    it('should log completed job information', async () => {
      // Arrange
      const loggerSpy = jest.spyOn(processor['logger'], 'log');

      // Act
      await processor.handleCompletedJob(mockJob);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        `Job ${mockJob.id} completed successfully for order ${mockOrderPayload.orderId}`,
      );
    });
  });

  describe('handleWaitingJob', () => {
    it('should log waiting job information', async () => {
      // Arrange
      const loggerSpy = jest.spyOn(processor['logger'], 'debug');

      // Act
      await processor.handleWaitingJob(mockJob);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        `Job ${mockJob.id} is waiting in queue for order ${mockOrderPayload.orderId}`,
      );
    });
  });

  describe('handleActiveJob', () => {
    it('should log active job information', async () => {
      // Arrange
      const loggerSpy = jest.spyOn(processor['logger'], 'debug');

      // Act
      await processor.handleActiveJob(mockJob);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        `Job ${mockJob.id} is now active, processing order ${mockOrderPayload.orderId}`,
      );
    });
  });

});
