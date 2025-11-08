import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Queue } from 'bullmq';
import request from 'supertest';
import { OrderModule } from '../src/order/order.module';
import { StockModule } from '../src/stock/stock.module';
import { AuthModule } from '../src/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { ORDER_QUEUE_NAME } from '../src/order/order.constants';
import { OrderStatus } from '../src/order/entities/order.entity';

describe('Order Integration (e2e)', () => {
  let app: INestApplication;
  let orderQueue: Queue;
  let authToken: string;
  let testStockId: string;
  let testProductId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test', // Use test environment
        }),
        MongooseModule.forRoot(
          process.env.MONGODB_URI || 'mongodb://localhost:27017/ordering-test',
        ),
        OrderModule,
        StockModule,
        AuthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get queue instance for monitoring
    orderQueue = app.get(`BullQueue_${ORDER_QUEUE_NAME}`);

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  beforeEach(async () => {
    // Clear queue before each test
    await orderQueue.obliterate({ force: true });
  });

  async function setupTestData() {
    // Create test user and get auth token
    const userResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        isVip: false,
      });

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    authToken = loginResponse.body.access_token;

    // Create test product and stock
    const productResponse = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
      });

    testProductId = productResponse.body._id;

    const stockResponse = await request(app.getHttpServer())
      .post('/stocks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        productId: testProductId,
        quantity: 100,
        location: 'Test Warehouse',
      });

    testStockId = stockResponse.body._id;
  }

  async function cleanupTestData() {
    // Clean up test data
    await request(app.getHttpServer())
      .delete(`/stocks/${testStockId}`)
      .set('Authorization', `Bearer ${authToken}`);

    await request(app.getHttpServer())
      .delete(`/products/${testProductId}`)
      .set('Authorization', `Bearer ${authToken}`);
  }

  describe('Order Creation and Processing Flow', () => {
    it('should create and process a single order successfully', async () => {
      // Create order
      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          stockId: testStockId,
          quantity: 5,
          priceAtPurchase: 99.99,
        })
        .expect(201);

      const orderId = orderResponse.body._id;
      expect(orderResponse.body.status).toBe(OrderStatus.PENDING);

      // Wait for queue processing
      await waitForJobCompletion(orderId);

      // Verify order status
      const orderStatusResponse = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(orderStatusResponse.body.status).toBe(OrderStatus.CONFIRMED);

      // Verify stock was decremented
      const stockResponse = await request(app.getHttpServer())
        .get(`/stocks/${testStockId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(stockResponse.body.quantity).toBe(95); // 100 - 5
    });

    it('should handle concurrent orders for the same stock item', async () => {
      const concurrentOrders = 10;
      const orderQuantity = 2;
      const promises: any[] = [];

      // Create multiple concurrent orders
      for (let i = 0; i < concurrentOrders; i++) {
        promises.push(
          request(app.getHttpServer())
            .post('/orders')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              stockId: testStockId,
              quantity: orderQuantity,
              priceAtPurchase: 99.99,
            }),
        );
      }

      const responses = await Promise.allSettled(promises);
      const successfulOrders = responses
        .filter((r) => r.status === 'fulfilled' && r.value.status === 201)
        .map((r) => (r as any).value.body._id);

      // Wait for all jobs to complete
      await Promise.all(
        successfulOrders.map((orderId) => waitForJobCompletion(orderId)),
      );

      // Verify final stock quantity
      const stockResponse = await request(app.getHttpServer())
        .get(`/stocks/${testStockId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const expectedStock = 100 - successfulOrders.length * orderQuantity;
      expect(stockResponse.body.quantity).toBe(expectedStock);

      // Verify all orders are confirmed
      for (const orderId of successfulOrders) {
        const orderResponse = await request(app.getHttpServer())
          .get(`/orders/${orderId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(orderResponse.body.status).toBe(OrderStatus.CONFIRMED);
      }
    });

    it('should handle stock depletion correctly', async () => {
      // First, reduce stock to a small amount
      await request(app.getHttpServer())
        .put(`/stocks/${testStockId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity: 5,
        });

      const promises: Promise<any>[] = [];
      const orderQuantity = 2;
      const ordersToCreate = 5; // This will exceed available stock

      // Create orders that exceed available stock
      for (let i = 0; i < ordersToCreate; i++) {
        promises.push(
          request(app.getHttpServer())
            .post('/orders')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              stockId: testStockId,
              quantity: orderQuantity,
              priceAtPurchase: 99.99,
            }),
        );
      }

      const responses = await Promise.allSettled(promises);
      const orderIds = responses
        .filter((r) => r.status === 'fulfilled' && r.value.status === 201)
        .map((r) => (r as any).value.body._id);

      // Wait for all jobs to complete
      await Promise.all(
        orderIds.map((orderId) => waitForJobCompletion(orderId)),
      );

      // Count confirmed vs failed orders
      let confirmedCount = 0;
      let failedCount = 0;

      for (const orderId of orderIds) {
        const orderResponse = await request(app.getHttpServer())
          .get(`/orders/${orderId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        if (orderResponse.body.status === OrderStatus.CONFIRMED) {
          confirmedCount++;
        } else if (orderResponse.body.status === OrderStatus.FAILED) {
          failedCount++;
        }
      }

      // Should have some confirmed and some failed orders
      expect(confirmedCount).toBeGreaterThan(0);
      expect(failedCount).toBeGreaterThan(0);
      expect(confirmedCount + failedCount).toBe(orderIds.length);

      // Stock should be depleted or very low
      const stockResponse = await request(app.getHttpServer())
        .get(`/stocks/${testStockId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(stockResponse.body.quantity).toBeLessThanOrEqual(1);
    });

    it('should handle VIP priority orders correctly', async () => {
      // Create VIP user
      const vipUserResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'vip@example.com',
          password: 'password123',
          isVip: true,
        });

      const vipLoginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'vip@example.com',
          password: 'password123',
        });

      const vipToken = vipLoginResponse.body.access_token;

      // Create VIP order
      const vipOrderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${vipToken}`)
        .send({
          stockId: testStockId,
          quantity: 1,
          priceAtPurchase: 99.99,
        })
        .expect(201);

      // Create regular order
      const regularOrderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          stockId: testStockId,
          quantity: 1,
          priceAtPurchase: 99.99,
        })
        .expect(201);

      // Wait for processing
      await waitForJobCompletion(vipOrderResponse.body._id);
      await waitForJobCompletion(regularOrderResponse.body._id);

      // Both should be confirmed, but VIP should have higher priority in queue
      const vipOrder = await request(app.getHttpServer())
        .get(`/orders/${vipOrderResponse.body._id}`)
        .set('Authorization', `Bearer ${vipToken}`)
        .expect(200);

      const regularOrder = await request(app.getHttpServer())
        .get(`/orders/${regularOrderResponse.body._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(vipOrder.body.status).toBe(OrderStatus.CONFIRMED);
      expect(regularOrder.body.status).toBe(OrderStatus.CONFIRMED);
      expect(vipOrder.body.isVipOrder).toBe(true);
      expect(regularOrder.body.isVipOrder).toBe(false);
    });
  });

  describe('Queue Monitoring and Metrics', () => {
    it('should provide queue statistics', async () => {
      // Create some orders
      const orderPromises: Promise<any>[] = [];
      for (let i = 0; i < 5; i++) {
        orderPromises.push(
          request(app.getHttpServer())
            .post('/orders')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              stockId: testStockId,
              quantity: 1,
              priceAtPurchase: 99.99,
            }),
        );
      }

      await Promise.all(orderPromises);

      // Get queue stats
      const waiting = await orderQueue.getWaiting();
      const active = await orderQueue.getActive();
      const completed = await orderQueue.getCompleted();
      const failed = await orderQueue.getFailed();

      expect(
        waiting.length + active.length + completed.length + failed.length,
      ).toBeGreaterThan(0);
    });

    it('should handle job retries on transient failures', async () => {
      // This test would require mocking external services to simulate failures
      // For now, we'll verify the retry configuration
      const job = await orderQueue.add('test-job', {
        userId: 'test',
        productId: testProductId,
        stockId: testStockId,
        quantity: 1,
        priceAtPurchase: 99.99,
        isVipOrder: false,
        orderId: 'test-order-id',
      });

      expect(job.opts.attempts).toBe(5);
      expect(job.opts.backoff).toEqual({
        type: 'exponential',
        delay: 2000,
      });
    });
  });

  // Helper function to wait for job completion
  async function waitForJobCompletion(
    orderId: string,
    timeoutMs: number = 10000,
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const orderResponse = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      if (orderResponse.body.status !== OrderStatus.PENDING) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Order ${orderId} did not complete within ${timeoutMs}ms`);
  }
});
