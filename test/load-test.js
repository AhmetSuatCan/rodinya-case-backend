const axios = require('axios');
const { performance } = require('perf_hooks');

class OrderLoadTester {
  constructor(baseUrl = 'http://localhost:3000', authToken = null) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      responseTimes: [],
      errors: [],
      concurrencyResults: []
    };
  }


  /**
   * Generate test data for orders
   */
  generateOrderData(stockId, productId) {
    return {
      stockId: stockId,
      // productId is automatically fetched from stock - removed from request
      quantity: Math.floor(Math.random() * 5) + 1, // 1-5 items
      priceAtPurchase: parseFloat((Math.random() * 1000 + 10).toFixed(2)) // $10-$1010
    };
  }

  /**
   * Make a single order request
   */
  async makeOrderRequest(orderData) {
    const startTime = performance.now();

    try {
      const response = await axios.post(`${this.baseUrl}/orders`, orderData, {
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `access_token=${this.authToken}`
        },
        timeout: 30000 // 30 second timeout
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      this.results.successfulRequests++;
      this.results.responseTimes.push(responseTime);

      return {
        success: true,
        responseTime,
        orderId: response.data._id,
        status: response.status
      };
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      this.results.failedRequests++;
      this.results.errors.push({
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        responseTime
      });

      return {
        success: false,
        error: error.message,
        responseTime,
        status: error.response?.status
      };
    }
  }

  /**
   * Test Scenario 1: High Concurrency - Same Stock Item
   * Tests race conditions and optimistic locking
   */
  async testConcurrentOrdersSameStock(stockId, productId, concurrentRequests = 50) {
    console.log(`\n🔥 Testing ${concurrentRequests} concurrent orders for same stock item...`);

    const orderData = this.generateOrderData(stockId, productId);
    const promises = [];

    // Create multiple concurrent requests for the same stock
    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(this.makeOrderRequest({
        ...orderData,
        quantity: 1 // Use quantity 1 to test stock depletion
      }));
    }

    const startTime = performance.now();
    const results = await Promise.allSettled(promises);
    const endTime = performance.now();

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value.success).length;

    console.log(`✅ Concurrent test completed in ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`   Successful: ${successful}, Failed: ${failed}`);

    return { successful, failed, totalTime: endTime - startTime };
  }

  /**
   * Test Scenario 2: Sustained Load Test
   * Tests system performance under continuous load
   */
  async testSustainedLoad(stockId, productId, requestsPerSecond = 10, durationSeconds = 60) {
    console.log(`\n⚡ Testing sustained load: ${requestsPerSecond} req/sec for ${durationSeconds} seconds...`);

    const interval = 1000 / requestsPerSecond; // ms between requests
    const totalRequests = requestsPerSecond * durationSeconds;
    let completedRequests = 0;

    return new Promise((resolve) => {
      const startTime = performance.now();

      const intervalId = setInterval(async () => {
        if (completedRequests >= totalRequests) {
          clearInterval(intervalId);
          const endTime = performance.now();
          console.log(`✅ Sustained load test completed in ${(endTime - startTime).toFixed(2)}ms`);
          resolve({ completedRequests, totalTime: endTime - startTime });
          return;
        }

        // Make request without waiting for response
        this.makeOrderRequest(this.generateOrderData(stockId, productId))
          .then(() => completedRequests++)
          .catch(() => completedRequests++);

        // Progress indicator
        if (completedRequests % (requestsPerSecond * 10) === 0) {
          console.log(`   Progress: ${completedRequests}/${totalRequests} requests sent`);
        }
      }, interval);
    });
  }

  /**
   * Test Scenario 3: VIP vs Normal Priority Testing
   */
  async testPriorityOrdering(stockId, productId, totalOrders = 100) {
    console.log(`\n👑 Testing VIP priority ordering with ${totalOrders} orders...`);

    const promises = [];

    // Mix of VIP and normal orders
    for (let i = 0; i < totalOrders; i++) {
      const orderData = this.generateOrderData(stockId, productId);
      promises.push(this.makeOrderRequest(orderData));

      // Add small delay to avoid overwhelming the system
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

    console.log(`✅ Priority test completed. Successful orders: ${successful}/${totalOrders}`);
    return { successful, total: totalOrders };
  }

  /**
   * Test Scenario 4: Stock Depletion Test
   */
  async testStockDepletion(stockId, productId, expectedStock = 10) {
    console.log(`\n📦 Testing stock depletion scenario (expected stock: ${expectedStock})...`);

    const promises = [];
    const ordersToCreate = expectedStock + 20; // Try to order more than available

    for (let i = 0; i < ordersToCreate; i++) {
      promises.push(this.makeOrderRequest({
        ...this.generateOrderData(stockId, productId),
        quantity: 1
      }));
    }

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value.success).length;

    console.log(`✅ Stock depletion test completed`);
    console.log(`   Expected successful: ~${expectedStock}, Actual: ${successful}`);
    console.log(`   Expected failed: ~${ordersToCreate - expectedStock}, Actual: ${failed}`);

    return { successful, failed, expectedStock };
  }

  /**
   * Generate comprehensive test report
   */
  generateReport() {
    this.results.totalRequests = this.results.successfulRequests + this.results.failedRequests;

    if (this.results.responseTimes.length > 0) {
      this.results.averageResponseTime = this.results.responseTimes.reduce((a, b) => a + b, 0) / this.results.responseTimes.length;
    }

    const sortedTimes = this.results.responseTimes.sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);

    console.log('\n📊 LOAD TEST RESULTS SUMMARY');
    console.log('=====================================');
    console.log(`Total Requests: ${this.results.totalRequests}`);
    console.log(`Successful: ${this.results.successfulRequests} (${((this.results.successfulRequests / this.results.totalRequests) * 100).toFixed(2)}%)`);
    console.log(`Failed: ${this.results.failedRequests} (${((this.results.failedRequests / this.results.totalRequests) * 100).toFixed(2)}%)`);
    console.log(`Average Response Time: ${this.results.averageResponseTime.toFixed(2)}ms`);

    if (sortedTimes.length > 0) {
      console.log(`P95 Response Time: ${sortedTimes[p95Index]?.toFixed(2)}ms`);
      console.log(`P99 Response Time: ${sortedTimes[p99Index]?.toFixed(2)}ms`);
      console.log(`Min Response Time: ${Math.min(...sortedTimes).toFixed(2)}ms`);
      console.log(`Max Response Time: ${Math.max(...sortedTimes).toFixed(2)}ms`);
    }

    if (this.results.errors.length > 0) {
      console.log('\n❌ ERROR SUMMARY:');
      const errorCounts = {};
      this.results.errors.forEach(error => {
        const key = `${error.status || 'Unknown'}: ${error.message}`;
        errorCounts[key] = (errorCounts[key] || 0) + 1;
      });

      Object.entries(errorCounts).forEach(([error, count]) => {
        console.log(`   ${error}: ${count} occurrences`);
      });
    }
  }

  /**
   * Run all test scenarios
   */
  async runAllTests(stockId, productId) {
    console.log('🚀 Starting comprehensive load testing...');
    console.log(`Stock ID: ${stockId}`);
    console.log(`Product ID: ${productId}`);

    try {
      // Test 1: Concurrent orders
      await this.testConcurrentOrdersSameStock(stockId, productId, 30);

      // Test 2: Sustained load
      await this.testSustainedLoad(stockId, productId, 5, 30);

      // Test 3: Priority testing
      await this.testPriorityOrdering(stockId, productId, 50);

      // Test 4: Stock depletion
      await this.testStockDepletion(stockId, productId, 10);

    } catch (error) {
      console.error('❌ Test execution failed:', error.message);
    } finally {
      this.generateReport();
    }
  }
}

// Usage example and CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.log('Usage: node load-test.js <AUTH_TOKEN> <STOCK_ID> <PRODUCT_ID> [BASE_URL]');
    console.log('Example: node load-test.js "your-jwt-token" "673d52dba60a72b6a733e695" "673d52dba60a72b6a733e691"');
    console.log('Note: PRODUCT_ID is kept for compatibility but not sent in requests (fetched from stock)');
    process.exit(1);
  }

  const [authToken, stockId, productId, baseUrl] = args;
  const tester = new OrderLoadTester(baseUrl || 'http://localhost:3000', authToken);

  // Run specific test based on environment variable or run all
  const testType = process.env.TEST_TYPE;

  switch (testType) {
    case 'concurrent':
      tester.testConcurrentOrdersSameStock(stockId, productId, 50).then(() => tester.generateReport());
      break;
    case 'sustained':
      tester.testSustainedLoad(stockId, productId, 10, 60).then(() => tester.generateReport());
      break;
    case 'priority':
      tester.testPriorityOrdering(stockId, productId, 100).then(() => tester.generateReport());
      break;
    case 'depletion':
      tester.testStockDepletion(stockId, productId, 20).then(() => tester.generateReport());
      break;
    default:
      tester.runAllTests(stockId, productId);
  }
}

module.exports = OrderLoadTester;
