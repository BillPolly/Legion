/**
 * ParallelTestExecutor - Advanced parallel test execution
 * 
 * Provides sophisticated parallel execution capabilities:
 * - Worker pool management
 * - Dynamic worker allocation
 * - Test distribution strategies
 * - Load balancing across workers
 * - Worker health monitoring
 * - Failure isolation
 * - Resource-aware execution
 * - Test affinity and grouping
 */

import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import { randomUUID } from 'crypto';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ParallelTestExecutor class for managing parallel test execution
 */
class ParallelTestExecutor extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = config;
    this.parallelConfig = config.parallel || {
      maxWorkers: os.cpus().length,
      minWorkers: 1,
      workerIdleTimeout: 30000,
      testTimeout: 120000,
      retryOnWorkerCrash: true,
      loadBalancing: 'round-robin', // 'round-robin', 'least-loaded', 'random'
      affinityGroups: true
    };
    
    // Worker pool
    this.workers = new Map();
    this.availableWorkers = [];
    this.busyWorkers = new Map();
    this.workerStats = new Map();
    
    // Test queue and execution
    this.testQueue = [];
    this.runningTests = new Map();
    this.completedTests = new Map();
    this.testGroups = new Map();
    
    // Execution metrics
    this.metrics = {
      totalWorkers: 0,
      activeWorkers: 0,
      idleWorkers: 0,
      testsExecuted: 0,
      testsInProgress: 0,
      averageExecutionTime: 0,
      workerUtilization: new Map(),
      loadDistribution: new Map()
    };
    
    // Worker script path
    this.workerScript = path.join(__dirname, 'TestWorker.js');
  }

  /**
   * Initialize the parallel test executor
   */
  async initialize() {
    this.emit('parallel-executor-initializing', { timestamp: Date.now() });
    
    try {
      // Create initial worker pool
      await this.createWorkerPool(this.parallelConfig.minWorkers);
      
      // Start worker monitoring
      this.startWorkerMonitoring();
      
      this.emit('parallel-executor-initialized', { 
        workers: this.workers.size,
        timestamp: Date.now() 
      });
      
    } catch (error) {
      this.emit('parallel-executor-initialization-failed', { 
        error: error.message, 
        timestamp: Date.now() 
      });
      throw error;
    }
  }

  /**
   * Create worker pool
   */
  async createWorkerPool(workerCount) {
    const promises = [];
    
    for (let i = 0; i < workerCount; i++) {
      promises.push(this.createWorker());
    }
    
    await Promise.all(promises);
  }

  /**
   * Create a new worker
   */
  async createWorker() {
    const workerId = randomUUID();
    
    return new Promise((resolve, reject) => {
      const worker = new Worker(this.workerScript, {
        workerData: {
          workerId,
          config: this.config
        }
      });
      
      const workerInfo = {
        id: workerId,
        worker,
        status: 'initializing',
        currentTest: null,
        testsExecuted: 0,
        totalExecutionTime: 0,
        lastActivity: Date.now(),
        errors: 0
      };
      
      // Set up worker event handlers
      worker.on('online', () => {
        workerInfo.status = 'idle';
        this.workers.set(workerId, workerInfo);
        this.availableWorkers.push(workerId);
        this.metrics.totalWorkers++;
        this.metrics.idleWorkers++;
        
        this.emit('worker-created', { 
          workerId, 
          timestamp: Date.now() 
        });
        
        resolve(workerInfo);
      });
      
      worker.on('message', (message) => {
        this.handleWorkerMessage(workerId, message);
      });
      
      worker.on('error', (error) => {
        this.handleWorkerError(workerId, error);
        reject(error);
      });
      
      worker.on('exit', (code) => {
        this.handleWorkerExit(workerId, code);
      });
      
      // Initialize worker stats
      this.workerStats.set(workerId, {
        testsExecuted: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        errorRate: 0,
        lastError: null
      });
    });
  }

  /**
   * Execute tests in parallel
   */
  async executeTests(tests, options = {}) {
    const executionId = randomUUID();
    
    this.emit('parallel-execution-started', { 
      executionId, 
      testCount: tests.length,
      workers: this.workers.size,
      timestamp: Date.now() 
    });
    
    try {
      // Group tests if affinity is enabled
      if (this.parallelConfig.affinityGroups) {
        this.groupTestsByAffinity(tests);
      }
      
      // Add tests to queue
      for (const test of tests) {
        this.testQueue.push({
          ...test,
          executionId,
          queuedAt: Date.now(),
          retries: 0
        });
      }
      
      // Scale workers if needed
      await this.scaleWorkers(tests.length);
      
      // Start processing queue
      this.processQueue();
      
      // Wait for completion if requested
      if (options.waitForCompletion) {
        await this.waitForCompletion(executionId);
      }
      
      return executionId;
      
    } catch (error) {
      this.emit('parallel-execution-failed', { 
        executionId,
        error: error.message,
        timestamp: Date.now() 
      });
      throw error;
    }
  }

  /**
   * Group tests by affinity
   */
  groupTestsByAffinity(tests) {
    this.testGroups.clear();
    
    for (const test of tests) {
      const group = test.affinityGroup || 'default';
      
      if (!this.testGroups.has(group)) {
        this.testGroups.set(group, []);
      }
      
      this.testGroups.get(group).push(test);
    }
  }

  /**
   * Scale worker pool based on load
   */
  async scaleWorkers(testCount) {
    const currentWorkers = this.workers.size;
    const desiredWorkers = Math.min(
      this.parallelConfig.maxWorkers,
      Math.max(this.parallelConfig.minWorkers, Math.ceil(testCount / 10))
    );
    
    if (desiredWorkers > currentWorkers) {
      const workersToAdd = desiredWorkers - currentWorkers;
      
      this.emit('scaling-workers-up', { 
        current: currentWorkers,
        target: desiredWorkers,
        adding: workersToAdd,
        timestamp: Date.now() 
      });
      
      await this.createWorkerPool(workersToAdd);
    }
  }

  /**
   * Process test queue
   */
  processQueue() {
    // Continue processing while there are tests and available workers
    while (this.testQueue.length > 0 && this.availableWorkers.length > 0) {
      const test = this.testQueue.shift();
      const workerId = this.selectWorker(test);
      
      if (workerId) {
        this.assignTestToWorker(test, workerId);
      } else {
        // No suitable worker, put test back
        this.testQueue.unshift(test);
        break;
      }
    }
    
    // Schedule next processing cycle
    if (this.testQueue.length > 0) {
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * Select worker based on load balancing strategy
   */
  selectWorker(test) {
    if (this.availableWorkers.length === 0) {
      return null;
    }
    
    let workerId;
    
    switch (this.parallelConfig.loadBalancing) {
      case 'least-loaded':
        workerId = this.selectLeastLoadedWorker();
        break;
        
      case 'random':
        workerId = this.selectRandomWorker();
        break;
        
      case 'round-robin':
      default:
        workerId = this.availableWorkers.shift();
        break;
    }
    
    return workerId;
  }

  /**
   * Select least loaded worker
   */
  selectLeastLoadedWorker() {
    let leastLoadedWorker = null;
    let minLoad = Infinity;
    
    for (const workerId of this.availableWorkers) {
      const stats = this.workerStats.get(workerId);
      const load = stats.averageExecutionTime * stats.testsExecuted;
      
      if (load < minLoad) {
        minLoad = load;
        leastLoadedWorker = workerId;
      }
    }
    
    if (leastLoadedWorker) {
      const index = this.availableWorkers.indexOf(leastLoadedWorker);
      this.availableWorkers.splice(index, 1);
    }
    
    return leastLoadedWorker;
  }

  /**
   * Select random worker
   */
  selectRandomWorker() {
    const index = Math.floor(Math.random() * this.availableWorkers.length);
    return this.availableWorkers.splice(index, 1)[0];
  }

  /**
   * Assign test to worker
   */
  assignTestToWorker(test, workerId) {
    const worker = this.workers.get(workerId);
    if (!worker) return;
    
    const testId = test.id || randomUUID();
    const startTime = Date.now();
    
    // Update worker state
    worker.status = 'busy';
    worker.currentTest = testId;
    worker.lastActivity = startTime;
    
    // Move to busy workers
    this.busyWorkers.set(workerId, worker);
    this.metrics.activeWorkers++;
    this.metrics.idleWorkers--;
    
    // Track running test
    this.runningTests.set(testId, {
      ...test,
      workerId,
      startTime,
      status: 'running'
    });
    
    this.metrics.testsInProgress++;
    
    // Send test to worker
    worker.worker.postMessage({
      type: 'execute-test',
      testId,
      test: {
        id: test.id,
        name: test.name,
        path: test.path,
        type: test.type,
        config: test.config
      }
    });
    
    this.emit('test-assigned-to-worker', { 
      testId,
      workerId,
      testName: test.name,
      timestamp: startTime 
    });
  }

  /**
   * Handle worker message
   */
  handleWorkerMessage(workerId, message) {
    const worker = this.workers.get(workerId);
    if (!worker) return;
    
    switch (message.type) {
      case 'test-started':
        this.handleTestStarted(workerId, message);
        break;
        
      case 'test-progress':
        this.handleTestProgress(workerId, message);
        break;
        
      case 'test-completed':
        this.handleTestCompleted(workerId, message);
        break;
        
      case 'test-failed':
        this.handleTestFailed(workerId, message);
        break;
        
      case 'worker-stats':
        this.updateWorkerStats(workerId, message.stats);
        break;
        
      default:
        this.emit('unknown-worker-message', { 
          workerId, 
          type: message.type,
          timestamp: Date.now() 
        });
    }
  }

  /**
   * Handle test started
   */
  handleTestStarted(workerId, message) {
    const { testId, testName } = message;
    
    this.emit('worker-test-started', { 
      workerId,
      testId,
      testName,
      timestamp: Date.now() 
    });
  }

  /**
   * Handle test progress
   */
  handleTestProgress(workerId, message) {
    const { testId, progress } = message;
    
    this.emit('worker-test-progress', { 
      workerId,
      testId,
      progress,
      timestamp: Date.now() 
    });
  }

  /**
   * Handle test completed
   */
  handleTestCompleted(workerId, message) {
    const { testId, result, duration } = message;
    const test = this.runningTests.get(testId);
    
    if (test) {
      // Update test status
      test.status = 'completed';
      test.result = result;
      test.duration = duration;
      test.endTime = Date.now();
      
      // Move to completed
      this.runningTests.delete(testId);
      this.completedTests.set(testId, test);
      
      // Update metrics
      this.metrics.testsExecuted++;
      this.metrics.testsInProgress--;
      this.updateAverageExecutionTime(duration);
      
      // Update worker stats
      const stats = this.workerStats.get(workerId);
      if (stats) {
        stats.testsExecuted++;
        stats.totalExecutionTime += duration;
        stats.averageExecutionTime = stats.totalExecutionTime / stats.testsExecuted;
      }
      
      // Free up worker
      this.freeWorker(workerId);
      
      this.emit('worker-test-completed', { 
        workerId,
        testId,
        testName: test.name,
        duration,
        timestamp: Date.now() 
      });
      
      // Process next test
      this.processQueue();
    }
  }

  /**
   * Handle test failed
   */
  handleTestFailed(workerId, message) {
    const { testId, error } = message;
    const test = this.runningTests.get(testId);
    
    if (test) {
      test.status = 'failed';
      test.error = error;
      test.endTime = Date.now();
      test.duration = test.endTime - test.startTime;
      
      // Check retry policy
      if (test.retries < 3 && this.parallelConfig.retryOnWorkerCrash) {
        test.retries++;
        test.status = 'retrying';
        
        // Re-queue test
        this.testQueue.unshift(test);
        this.runningTests.delete(testId);
        
        this.emit('test-retry-scheduled', { 
          testId,
          retry: test.retries,
          timestamp: Date.now() 
        });
      } else {
        // Move to completed with failed status
        this.runningTests.delete(testId);
        this.completedTests.set(testId, test);
        
        this.metrics.testsInProgress--;
        
        // Update worker error stats
        const stats = this.workerStats.get(workerId);
        if (stats) {
          stats.errorRate = (stats.errorRate * stats.testsExecuted + 1) / 
                           (stats.testsExecuted + 1);
          stats.lastError = error;
        }
      }
      
      // Free up worker
      this.freeWorker(workerId);
      
      this.emit('worker-test-failed', { 
        workerId,
        testId,
        error,
        timestamp: Date.now() 
      });
      
      // Process next test
      this.processQueue();
    }
  }

  /**
   * Handle worker error
   */
  handleWorkerError(workerId, error) {
    const worker = this.workers.get(workerId);
    if (!worker) return;
    
    worker.errors++;
    
    this.emit('worker-error', { 
      workerId,
      error: error.message,
      errorCount: worker.errors,
      timestamp: Date.now() 
    });
    
    // If worker has current test, reschedule it
    if (worker.currentTest) {
      const test = this.runningTests.get(worker.currentTest);
      if (test) {
        test.retries = (test.retries || 0) + 1;
        this.testQueue.unshift(test);
        this.runningTests.delete(worker.currentTest);
      }
    }
    
    // Restart worker if too many errors
    if (worker.errors > 3) {
      this.restartWorker(workerId);
    }
  }

  /**
   * Handle worker exit
   */
  handleWorkerExit(workerId, code) {
    const worker = this.workers.get(workerId);
    if (!worker) return;
    
    this.emit('worker-exited', { 
      workerId,
      code,
      timestamp: Date.now() 
    });
    
    // Clean up worker
    this.workers.delete(workerId);
    this.availableWorkers = this.availableWorkers.filter(id => id !== workerId);
    this.busyWorkers.delete(workerId);
    this.workerStats.delete(workerId);
    
    this.metrics.totalWorkers--;
    if (worker.status === 'idle') {
      this.metrics.idleWorkers--;
    } else {
      this.metrics.activeWorkers--;
    }
    
    // Restart worker if needed
    if (this.workers.size < this.parallelConfig.minWorkers) {
      this.createWorker();
    }
  }

  /**
   * Free worker after test completion
   */
  freeWorker(workerId) {
    const worker = this.workers.get(workerId);
    if (!worker) return;
    
    worker.status = 'idle';
    worker.currentTest = null;
    worker.lastActivity = Date.now();
    
    // Move back to available
    this.busyWorkers.delete(workerId);
    this.availableWorkers.push(workerId);
    
    this.metrics.activeWorkers--;
    this.metrics.idleWorkers++;
  }

  /**
   * Restart worker
   */
  async restartWorker(workerId) {
    const worker = this.workers.get(workerId);
    if (!worker) return;
    
    this.emit('worker-restarting', { 
      workerId,
      timestamp: Date.now() 
    });
    
    // Terminate old worker
    await worker.worker.terminate();
    
    // Create new worker
    await this.createWorker();
  }

  /**
   * Update average execution time
   */
  updateAverageExecutionTime(duration) {
    const totalTime = this.metrics.averageExecutionTime * (this.metrics.testsExecuted - 1);
    this.metrics.averageExecutionTime = (totalTime + duration) / this.metrics.testsExecuted;
  }

  /**
   * Update worker stats
   */
  updateWorkerStats(workerId, stats) {
    this.workerStats.set(workerId, {
      ...this.workerStats.get(workerId),
      ...stats
    });
  }

  /**
   * Wait for execution completion
   */
  async waitForCompletion(executionId) {
    return new Promise((resolve) => {
      const checkCompletion = () => {
        const allTestsCompleted = this.testQueue.length === 0 && 
                                 this.runningTests.size === 0;
        
        if (allTestsCompleted) {
          this.emit('parallel-execution-completed', { 
            executionId,
            testsExecuted: this.metrics.testsExecuted,
            timestamp: Date.now() 
          });
          resolve();
        } else {
          setTimeout(checkCompletion, 100);
        }
      };
      
      checkCompletion();
    });
  }

  /**
   * Start worker monitoring
   */
  startWorkerMonitoring() {
    // Skip monitoring in test environment
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    
    this.monitoringInterval = setInterval(() => {
      const now = Date.now();
      
      // Check for idle workers
      for (const [workerId, worker] of this.workers) {
        if (worker.status === 'idle' && 
            now - worker.lastActivity > this.parallelConfig.workerIdleTimeout) {
          
          // Scale down if above minimum
          if (this.workers.size > this.parallelConfig.minWorkers) {
            this.terminateWorker(workerId);
          }
        }
      }
      
      // Update metrics
      this.updateLoadDistribution();
      
      this.emit('worker-monitoring-update', { 
        metrics: this.getMetrics(),
        timestamp: now 
      });
    }, 5000);
  }

  /**
   * Update load distribution metrics
   */
  updateLoadDistribution() {
    this.metrics.loadDistribution.clear();
    
    for (const [workerId, stats] of this.workerStats) {
      this.metrics.loadDistribution.set(workerId, {
        testsExecuted: stats.testsExecuted,
        utilization: stats.testsExecuted / this.metrics.testsExecuted || 0,
        averageExecutionTime: stats.averageExecutionTime
      });
    }
  }

  /**
   * Terminate worker
   */
  async terminateWorker(workerId) {
    const worker = this.workers.get(workerId);
    if (!worker || worker.status !== 'idle') return;
    
    this.emit('worker-terminating', { 
      workerId,
      timestamp: Date.now() 
    });
    
    await worker.worker.terminate();
  }

  /**
   * Get execution metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      workerUtilization: this.calculateWorkerUtilization(),
      queueLength: this.testQueue.length,
      completedTests: this.completedTests.size
    };
  }

  /**
   * Calculate worker utilization
   */
  calculateWorkerUtilization() {
    const utilization = new Map();
    
    for (const [workerId, worker] of this.workers) {
      const stats = this.workerStats.get(workerId);
      utilization.set(workerId, {
        status: worker.status,
        testsExecuted: stats.testsExecuted,
        utilization: worker.status === 'busy' ? 100 : 0,
        efficiency: stats.averageExecutionTime > 0 
          ? (1000 / stats.averageExecutionTime) * 100 
          : 100
      });
    }
    
    return utilization;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.emit('parallel-executor-cleanup-started', { timestamp: Date.now() });
    
    // Stop monitoring
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    // Terminate all workers
    const terminationPromises = [];
    for (const [workerId, worker] of this.workers) {
      terminationPromises.push(worker.worker.terminate());
    }
    
    await Promise.all(terminationPromises);
    
    // Clear all data
    this.workers.clear();
    this.availableWorkers = [];
    this.busyWorkers.clear();
    this.workerStats.clear();
    this.testQueue = [];
    this.runningTests.clear();
    this.completedTests.clear();
    this.testGroups.clear();
    
    // Reset metrics
    this.metrics = {
      totalWorkers: 0,
      activeWorkers: 0,
      idleWorkers: 0,
      testsExecuted: 0,
      testsInProgress: 0,
      averageExecutionTime: 0,
      workerUtilization: new Map(),
      loadDistribution: new Map()
    };
    
    this.emit('parallel-executor-cleanup-completed', { timestamp: Date.now() });
  }
}

export { ParallelTestExecutor };