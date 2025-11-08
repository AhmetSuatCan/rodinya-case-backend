const axios = require('axios');
const cluster = require('cluster');
const os = require('os');
const { performance } = require('perf_hooks');

class StressTester {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3000',
      authToken: config.authToken,
      stockId: config.stockId,
      productId: config.productId,
      workers: config.workers || os.cpus().length,
      duration: config.duration || 60, // seconds
      rampUpTime: config.rampUpTime || 10, // seconds
      maxRequestsPerSecond: config.maxRequestsPerSecond || 100,
      scenarios: config.scenarios || ['mixed']
    };
    
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: [],
      throughput: [],
      workerResults: []
    };
  }

  /**
   * Master process - coordinates workers
   */
  async runStressTest() {
    if (cluster.isMaster) {
      console.log('🚀 Starting stress test with configuration:');
      console.log(`   Workers: ${this.config.workers}`);
      console.log(`   Duration: ${this.config.duration}s`);
      console.log(`   Ramp-up: ${this.config.rampUpTime}s`);
      console.log(`   Max RPS: ${this.config.maxRequestsPerSecond}`);
      console.log(`   Scenarios: ${this.config.scenarios.join(', ')}`);
      
      return this.runMaster();
    } else {
      return this.runWorker();
    }
  }

  async runMaster() {
    const workers = [];
    const workerResults = [];
    
    // Fork workers
    for (let i = 0; i < this.config.workers; i++) {
      const worker = cluster.fork({
        WORKER_ID: i,
        CONFIG: JSON.stringify(this.config)
      });
      
      workers.push(worker);
      
      worker.on('message', (message) => {
        if (message.type === 'result') {
          workerResults.push(message.data);
        } else if (message.type === 'progress') {
          // Log progress from workers
          console.log(`Worker ${message.workerId}: ${message.message}`);
        }
      });
    }

    // Wait for all workers to complete
    await Promise.all(workers.map(worker => new Promise(resolve => {
      worker.on('exit', resolve);
    })));

    // Aggregate results
    this.aggregateResults(workerResults);
    this.generateStressTestReport();
    
    return this.results;
  }

  async runWorker() {
    const workerId = process.env.WORKER_ID;
    const config = JSON.parse(process.env.CONFIG);
    
    const workerResults = {
      workerId,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: []
    };

    const requestsPerWorker = Math.floor(config.maxRequestsPerSecond / config.workers);
    const testDuration = config.duration * 1000; // Convert to ms
    const rampUpDuration = config.rampUpTime * 1000;
    
    const startTime = Date.now();
    let currentRPS = 0;
    
    // Ramp up gradually
    const rampUpInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= rampUpDuration) {
        currentRPS = requestsPerWorker;
        clearInterval(rampUpInterval);
      } else {
        currentRPS = Math.floor((elapsed / rampUpDuration) * requestsPerWorker);
      }
    }, 1000);

    // Main test loop
    const testInterval = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed >= testDuration) {
        clearInterval(testInterval);
        clearInterval(rampUpInterval);
        
        // Send results back to master
        process.send({
          type: 'result',
          data: workerResults
        });
        
        process.exit(0);
        return;
      }

      // Execute requests for this second
      const requests = [];
      for (let i = 0; i < currentRPS; i++) {
        requests.push(this.executeScenario(config, workerResults));
      }
      
      await Promise.allSettled(requests);
      
      // Send progress update
      if (workerResults.totalRequests % 100 === 0) {
        process.send({
          type: 'progress',
          workerId,
          message: `Completed ${workerResults.totalRequests} requests`
        });
      }
    }, 1000);
  }

  async executeScenario(config, results) {
    const scenario = config.scenarios[Math.floor(Math.random() * config.scenarios.length)];
    
    switch (scenario) {
      case 'mixed':
        return this.executeMixedScenario(config, results);
      case 'concurrent_same_stock':
        return this.executeConcurrentSameStockScenario(config, results);
      case 'high_volume':
        return this.executeHighVolumeScenario(config, results);
      case 'vip_priority':
        return this.executeVipPriorityScenario(config, results);
      default:
        return this.executeMixedScenario(config, results);
    }
  }

  async executeMixedScenario(config, results) {
    const orderData = {
      stockId: config.stockId,
      productId: config.productId,
      quantity: Math.floor(Math.random() * 3) + 1, // 1-3 items
      priceAtPurchase: parseFloat((Math.random() * 500 + 10).toFixed(2))
    };

    return this.makeRequest(config, orderData, results);
  }

  async executeConcurrentSameStockScenario(config, results) {
    const orderData = {
      stockId: config.stockId,
      productId: config.productId,
      quantity: 1, // Always 1 to test race conditions
      priceAtPurchase: 99.99
    };

    return this.makeRequest(config, orderData, results);
  }

  async executeHighVolumeScenario(config, results) {
    const orderData = {
      stockId: config.stockId,
      productId: config.productId,
      quantity: Math.floor(Math.random() * 10) + 1, // 1-10 items
      priceAtPurchase: parseFloat((Math.random() * 1000 + 50).toFixed(2))
    };

    return this.makeRequest(config, orderData, results);
  }

  async executeVipPriorityScenario(config, results) {
    // Simulate VIP orders (would need VIP auth token in real scenario)
    const orderData = {
      stockId: config.stockId,
      productId: config.productId,
      quantity: Math.floor(Math.random() * 5) + 1,
      priceAtPurchase: parseFloat((Math.random() * 2000 + 100).toFixed(2))
    };

    return this.makeRequest(config, orderData, results);
  }

  async makeRequest(config, orderData, results) {
    const startTime = performance.now();
    results.totalRequests++;

    try {
      const response = await axios.post(`${config.baseUrl}/orders`, orderData, {
        headers: {
          'Authorization': `Bearer ${config.authToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      results.successfulRequests++;
      results.responseTimes.push(responseTime);

      return { success: true, responseTime, status: response.status };
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      results.failedRequests++;
      results.errors.push({
        message: error.message,
        status: error.response?.status,
        responseTime
      });

      return { success: false, error: error.message, responseTime };
    }
  }

  aggregateResults(workerResults) {
    this.results.workerResults = workerResults;
    
    for (const worker of workerResults) {
      this.results.totalRequests += worker.totalRequests;
      this.results.successfulRequests += worker.successfulRequests;
      this.results.failedRequests += worker.failedRequests;
      this.results.responseTimes.push(...worker.responseTimes);
      this.results.errors.push(...worker.errors);
    }
  }

  generateStressTestReport() {
    const avgResponseTime = this.results.responseTimes.length > 0 
      ? this.results.responseTimes.reduce((a, b) => a + b, 0) / this.results.responseTimes.length 
      : 0;

    const sortedTimes = this.results.responseTimes.sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);

    const successRate = (this.results.successfulRequests / this.results.totalRequests) * 100;
    const throughput = this.results.totalRequests / this.config.duration;

    console.log('\n🔥 STRESS TEST RESULTS');
    console.log('========================');
    console.log(`Duration: ${this.config.duration}s`);
    console.log(`Workers: ${this.config.workers}`);
    console.log(`Total Requests: ${this.results.totalRequests}`);
    console.log(`Successful: ${this.results.successfulRequests} (${successRate.toFixed(2)}%)`);
    console.log(`Failed: ${this.results.failedRequests} (${(100 - successRate).toFixed(2)}%)`);
    console.log(`Throughput: ${throughput.toFixed(2)} req/sec`);
    console.log(`Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    
    if (sortedTimes.length > 0) {
      console.log(`P95 Response Time: ${sortedTimes[p95Index]?.toFixed(2)}ms`);
      console.log(`P99 Response Time: ${sortedTimes[p99Index]?.toFixed(2)}ms`);
      console.log(`Min Response Time: ${Math.min(...sortedTimes).toFixed(2)}ms`);
      console.log(`Max Response Time: ${Math.max(...sortedTimes).toFixed(2)}ms`);
    }

    // Worker performance breakdown
    console.log('\n👥 WORKER PERFORMANCE:');
    this.results.workerResults.forEach(worker => {
      const workerSuccessRate = (worker.successfulRequests / worker.totalRequests) * 100;
      console.log(`   Worker ${worker.workerId}: ${worker.totalRequests} requests, ${workerSuccessRate.toFixed(1)}% success`);
    });

    // Error analysis
    if (this.results.errors.length > 0) {
      console.log('\n❌ ERROR ANALYSIS:');
      const errorCounts = {};
      this.results.errors.forEach(error => {
        const key = `${error.status || 'Unknown'}: ${error.message}`;
        errorCounts[key] = (errorCounts[key] || 0) + 1;
      });

      Object.entries(errorCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10) // Top 10 errors
        .forEach(([error, count]) => {
          console.log(`   ${error}: ${count} occurrences`);
        });
    }

    // Performance recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (successRate < 95) {
      console.log('   ⚠️  Success rate below 95% - consider scaling or optimizing');
    }
    if (avgResponseTime > 1000) {
      console.log('   ⚠️  High average response time - check for bottlenecks');
    }
    if (throughput < this.config.maxRequestsPerSecond * 0.8) {
      console.log('   ⚠️  Throughput below 80% of target - investigate performance issues');
    }
    if (successRate >= 99 && avgResponseTime < 500) {
      console.log('   ✅ Excellent performance! System handles stress well');
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('Usage: node stress-test.js <AUTH_TOKEN> <STOCK_ID> <PRODUCT_ID> [OPTIONS]');
    console.log('Options:');
    console.log('  --workers=N          Number of worker processes (default: CPU count)');
    console.log('  --duration=N         Test duration in seconds (default: 60)');
    console.log('  --ramp-up=N          Ramp-up time in seconds (default: 10)');
    console.log('  --max-rps=N          Maximum requests per second (default: 100)');
    console.log('  --scenarios=LIST     Comma-separated scenarios (default: mixed)');
    console.log('  --base-url=URL       Base URL (default: http://localhost:3000)');
    console.log('');
    console.log('Available scenarios: mixed, concurrent_same_stock, high_volume, vip_priority');
    process.exit(1);
  }

  const [authToken, stockId, productId] = args;
  
  // Parse options
  const config = {
    authToken,
    stockId,
    productId
  };

  args.slice(3).forEach(arg => {
    if (arg.startsWith('--workers=')) {
      config.workers = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--duration=')) {
      config.duration = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--ramp-up=')) {
      config.rampUpTime = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--max-rps=')) {
      config.maxRequestsPerSecond = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--scenarios=')) {
      config.scenarios = arg.split('=')[1].split(',');
    } else if (arg.startsWith('--base-url=')) {
      config.baseUrl = arg.split('=')[1];
    }
  });

  const tester = new StressTester(config);
  tester.runStressTest().catch(console.error);
}

module.exports = StressTester;
