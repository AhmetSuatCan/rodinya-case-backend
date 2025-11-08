import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Job } from 'bullmq';
import { Model, Types } from 'mongoose';
import { OrderProcessor, OrderPayload } from './order.processor';
import { Order, OrderDocument, OrderStatus } from './entities/order.entity';
import { StockService } from '../stock/stock.service';
import { BusinessLogicError } from './order.errors';

describe('OrderProcessor', () => {
    let processor: OrderProcessor;
    let orderModel: jest.Mocked<Model<OrderDocument>>;
    let stockService: jest.Mocked<StockService>;

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
        opts: { priority: 5 },
        token: 'token-123',
        moveToFailed: jest.fn(),
    } as unknown as Job<OrderPayload>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OrderProcessor,
                {
                    provide: getModelToken(Order.name),
                    useValue: {
                        findByIdAndUpdate: jest.fn(),
                    },
                },
                {
                    provide: StockService,
                    useValue: {
                        decrementStockAtomic: jest.fn(),
                        incrementStockAtomic: jest.fn(),
                    },
                },
            ],
        }).compile();

        processor = module.get<OrderProcessor>(OrderProcessor);
        orderModel = module.get(getModelToken(Order.name));
        stockService = module.get(StockService);

        // Reset all mocks
        jest.clearAllMocks();
    });

    describe('process', () => {
        it('should successfully process an order with sufficient stock', async () => {
            // Arrange
            const mockStockResult = {
                success: true,
                currentStock: {
                    productId: new Types.ObjectId('507f1f77bcf86cd799439012'),
                    quantity: 8
                },
            };

            stockService.decrementStockAtomic.mockResolvedValue(mockStockResult);
            orderModel.findByIdAndUpdate.mockResolvedValue({} as OrderDocument);

            // Mock Math.random to avoid simulated failure
            jest.spyOn(Math, 'random').mockReturnValue(0.5); // > 0.1, so no simulated failure

            // Act
            await processor.process(mockJob);

            // Assert
            expect(stockService.decrementStockAtomic).toHaveBeenCalledWith(
                mockOrderPayload.stockId,
                mockOrderPayload.quantity,
            );
            expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
                mockOrderPayload.orderId,
                {
                    status: OrderStatus.CONFIRMED,
                    failureReason: '',
                },
                { new: true },
            );
            expect(stockService.incrementStockAtomic).not.toHaveBeenCalled();
        });

        it('should handle insufficient stock gracefully', async () => {
            // Arrange
            const mockStockResult = {
                success: false,
                error: 'Insufficient stock',
            };

            stockService.decrementStockAtomic.mockResolvedValue(mockStockResult);

            // Act
            await processor.process(mockJob);

            // Assert
            expect(stockService.decrementStockAtomic).toHaveBeenCalledWith(
                mockOrderPayload.stockId,
                mockOrderPayload.quantity,
            );
            expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
                mockOrderPayload.orderId,
                {
                    status: OrderStatus.FAILED,
                    failureReason: 'Insufficient stock',
                },
                { new: true },
            );
            expect(mockJob.moveToFailed).toHaveBeenCalled();
            expect(stockService.incrementStockAtomic).not.toHaveBeenCalled();
        });

        it('should rollback stock on transient order confirmation failure', async () => {
            // Arrange
            const mockStockResult = {
                success: true,
                currentStock: {
                    productId: new Types.ObjectId('507f1f77bcf86cd799439012'),
                    quantity: 8
                },
            };

            stockService.decrementStockAtomic.mockResolvedValue(mockStockResult);
            orderModel.findByIdAndUpdate.mockRejectedValue(
                new Error('Database connection failed'),
            );

            const mockRollbackResult = {
                success: true,
                currentStock: {
                    productId: new Types.ObjectId('507f1f77bcf86cd799439012'),
                    quantity: 10
                },
            };
            stockService.incrementStockAtomic.mockResolvedValue(mockRollbackResult);

            // Act & Assert
            await expect(processor.process(mockJob)).rejects.toThrow(
                'Database connection failed',
            );

            expect(stockService.decrementStockAtomic).toHaveBeenCalledWith(
                mockOrderPayload.stockId,
                mockOrderPayload.quantity,
            );
            expect(stockService.incrementStockAtomic).toHaveBeenCalledWith(
                mockOrderPayload.stockId,
                mockOrderPayload.quantity,
            );
        });

        it('should handle simulated payment gateway failure with rollback', async () => {
            // Arrange
            const mockStockResult = {
                success: true,
                currentStock: {
                    productId: new Types.ObjectId('507f1f77bcf86cd799439012'),
                    quantity: 8
                },
            };

            stockService.decrementStockAtomic.mockResolvedValue(mockStockResult);

            // Mock Math.random to trigger simulated failure
            jest.spyOn(Math, 'random').mockReturnValue(0.05); // < 0.1, triggers failure

            const mockRollbackResult = {
                success: true,
                currentStock: {
                    productId: new Types.ObjectId('507f1f77bcf86cd799439012'),
                    quantity: 10
                },
            };
            stockService.incrementStockAtomic.mockResolvedValue(mockRollbackResult);

            // Act & Assert
            await expect(processor.process(mockJob)).rejects.toThrow(
                'Payment gateway timeout - please retry',
            );

            expect(stockService.decrementStockAtomic).toHaveBeenCalledWith(
                mockOrderPayload.stockId,
                mockOrderPayload.quantity,
            );
            expect(stockService.incrementStockAtomic).toHaveBeenCalledWith(
                mockOrderPayload.stockId,
                mockOrderPayload.quantity,
            );
        });

        it('should handle rollback failure gracefully', async () => {
            // Arrange
            const mockStockResult = {
                success: true,
                currentStock: {
                    productId: new Types.ObjectId('507f1f77bcf86cd799439012'),
                    quantity: 8
                },
            };

            stockService.decrementStockAtomic.mockResolvedValue(mockStockResult);
            orderModel.findByIdAndUpdate.mockRejectedValue(
                new Error('Database connection failed'),
            );

            const mockRollbackResult = {
                success: false,
                error: 'Rollback failed',
            };
            stockService.incrementStockAtomic.mockResolvedValue(mockRollbackResult);

            // Act & Assert
            await expect(processor.process(mockJob)).rejects.toThrow(
                'Database connection failed',
            );

            expect(stockService.decrementStockAtomic).toHaveBeenCalledWith(
                mockOrderPayload.stockId,
                mockOrderPayload.quantity,
            );
            expect(stockService.incrementStockAtomic).toHaveBeenCalledWith(
                mockOrderPayload.stockId,
                mockOrderPayload.quantity,
            );
        });

        it('should handle stock not found error', async () => {
            // Arrange
            const mockStockResult = {
                success: false,
                error: 'Stock not found',
            };

            stockService.decrementStockAtomic.mockResolvedValue(mockStockResult);

            // Act
            await processor.process(mockJob);

            // Assert
            expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
                mockOrderPayload.orderId,
                {
                    status: OrderStatus.FAILED,
                    failureReason: 'Stock not found',
                },
                { new: true },
            );
            expect(mockJob.moveToFailed).toHaveBeenCalled();
        });

        it('should handle version conflict (optimistic locking failure)', async () => {
            // Arrange
            const mockStockResult = {
                success: false,
                error: 'Version conflict - stock was modified by another operation',
            };

            stockService.decrementStockAtomic.mockResolvedValue(mockStockResult);

            // Act
            await processor.process(mockJob);

            // Assert
            expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
                mockOrderPayload.orderId,
                {
                    status: OrderStatus.FAILED,
                    failureReason:
                        'Version conflict - stock was modified by another operation',
                },
                { new: true },
            );
            expect(mockJob.moveToFailed).toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        it('should distinguish between business logic and transient errors', async () => {
            // Test business logic error
            const businessError = new BusinessLogicError('Insufficient stock');
            stockService.decrementStockAtomic.mockRejectedValue(businessError);

            await processor.process(mockJob);

            expect(mockJob.moveToFailed).toHaveBeenCalledWith(
                businessError,
                'token-123',
            );
            expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
                mockOrderPayload.orderId,
                {
                    status: OrderStatus.FAILED,
                    failureReason: 'Insufficient stock',
                },
                { new: true },
            );
        });

        it('should re-throw transient errors for retry', async () => {
            // Test transient error
            const transientError = new Error('Network timeout');
            stockService.decrementStockAtomic.mockRejectedValue(transientError);

            await expect(processor.process(mockJob)).rejects.toThrow(
                'Network timeout',
            );
            expect(mockJob.moveToFailed).not.toHaveBeenCalled();
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });
});
