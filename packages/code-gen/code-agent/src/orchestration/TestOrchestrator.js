/**
 * TestOrchestrator - Advanced test execution orchestration
 * 
 * Provides sophisticated orchestration capabilities:
 * - Dynamic test scheduling based on resources
 * - Intelligent test prioritization
 * - Adaptive parallelism based on system load
 * - Test dependency resolution with cycle detection
 * - Resource allocation and management
 * - Test execution optimization
 * - Failure recovery strategies
 * - Real-time execution monitoring
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import os from 'os';

/**
 * TestOrchestrator class for advanced test orchestration
 */
class TestOrchestrator extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = config;
    this.orchestrationConfig = config.orchestration || {
      maxParallelTests: os.cpus().length,
      adaptiveParallelism: true,
      priorityScheduling: true,
      resourceThresholds: {
        cpu: 80,
        memory: 85,
        disk: 90
      },
      retryStrategies: {
        maxRetries: 3,
        backoffMultiplier: 2,
        initialDelay: 1000
      }
    };
    
    // Orchestration state
    this.executionQueue = [];
    this.runningTests = new Map();
    this.completedTests = new Map();
    this.failedTests = new Map();
    this.resourceMonitor = null;
    
    // Execution metrics
    this.metrics = {
      totalTests: 0,
      executedTests: 0,
      queuedTests: 0,
      runningTests: 0,
      completedTests: 0,
      failedTests: 0,
      retriedTests: 0,
      averageExecutionTime: 0,
      resourceUtilization: {
        cpu: 0,
        memory: 0,
        disk: 0
      }
    };
    
    // Test priorities
    this.testPriorities = {
      critical: 1,
      high: 2,
      medium: 3,
      low: 4
    };
  }

  /**
   * Initialize the test orchestrator
   */
  async initialize() {
    this.emit('orchestrator-initializing', { timestamp: Date.now() });
    
    try {
      // Start resource monitoring
      this.startResourceMonitoring();
      
      // Initialize execution queue
      this.executionQueue = [];
      
      this.emit('orchestrator-initialized', { 
        maxParallelTests: this.orchestrationConfig.maxParallelTests,
        timestamp: Date.now() 
      });
      
    } catch (error) {
      this.emit('orchestrator-initialization-failed', { 
        error: error.message, 
        timestamp: Date.now() 
      });
      throw error;
    }
  }

  /**
   * Schedule tests for execution
   */
  async scheduleTests(tests, options = {}) {
    const schedulingId = randomUUID();
    
    this.emit('test-scheduling-started', { 
      schedulingId, 
      testCount: tests.length,
      timestamp: Date.now() 
    });
    
    try {
      // Analyze test dependencies
      const dependencyGraph = await this.analyzeDependencies(tests);
      
      // Check for dependency cycles
      if (this.hasCycles(dependencyGraph)) {
        throw new Error('Circular dependencies detected in test suite');
      }
      
      // Prioritize tests
      const prioritizedTests = this.prioritizeTests(tests, dependencyGraph, options);
      
      // Add to execution queue
      for (const test of prioritizedTests) {
        this.executionQueue.push({
          ...test,
          schedulingId,
          status: 'queued',
          queuedAt: Date.now(),
          retries: 0
        });
      }
      
      this.metrics.totalTests += tests.length;
      this.metrics.queuedTests += tests.length;
      
      this.emit('test-scheduling-completed', { 
        schedulingId,
        queuedTests: tests.length,
        timestamp: Date.now() 
      });
      
      // Start execution if not already running
      setImmediate(() => this.executeNext());
      
      return schedulingId;
      
    } catch (error) {
      this.emit('test-scheduling-failed', { 
        schedulingId,
        error: error.message,
        timestamp: Date.now() 
      });
      throw error;
    }
  }

  /**
   * Analyze test dependencies
   */
  async analyzeDependencies(tests) {
    const graph = new Map();
    
    for (const test of tests) {
      const node = {
        id: test.id,
        test,
        dependencies: test.dependencies || [],
        dependents: []
      };
      
      graph.set(test.id, node);
    }
    
    // Build dependent relationships
    for (const [testId, node] of graph) {
      for (const depId of node.dependencies) {
        const depNode = graph.get(depId);
        if (depNode) {
          depNode.dependents.push(testId);
        }
      }
    }
    
    return graph;
  }

  /**
   * Check for dependency cycles
   */
  hasCycles(graph) {
    const visited = new Set();
    const recursionStack = new Set();
    
    const hasCycleDFS = (nodeId) => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      
      const node = graph.get(nodeId);
      if (node) {
        for (const depId of node.dependencies) {
          if (!visited.has(depId)) {
            if (hasCycleDFS(depId)) return true;
          } else if (recursionStack.has(depId)) {
            return true;
          }
        }
      }
      
      recursionStack.delete(nodeId);
      return false;
    };
    
    for (const [nodeId] of graph) {
      if (!visited.has(nodeId)) {
        if (hasCycleDFS(nodeId)) return true;
      }
    }
    
    return false;
  }

  /**
   * Prioritize tests based on various factors
   */
  prioritizeTests(tests, dependencyGraph, options) {
    const prioritized = [...tests];
    
    prioritized.sort((a, b) => {
      // Priority 1: Explicit priority
      if (a.priority !== b.priority) {
        return (this.testPriorities[a.priority] || 999) - 
               (this.testPriorities[b.priority] || 999);
      }
      
      // Priority 2: Failed in previous run
      if (options.failedFirst) {
        const aFailed = this.failedTests.has(a.id);
        const bFailed = this.failedTests.has(b.id);
        if (aFailed !== bFailed) return aFailed ? -1 : 1;
      }
      
      // Priority 3: Dependency count (tests with no dependencies first)
      const aDeps = dependencyGraph.get(a.id)?.dependencies.length || 0;
      const bDeps = dependencyGraph.get(b.id)?.dependencies.length || 0;
      if (aDeps !== bDeps) return aDeps - bDeps;
      
      // Priority 4: Execution time (faster tests first)
      if (a.estimatedDuration !== b.estimatedDuration) {
        return (a.estimatedDuration || 0) - (b.estimatedDuration || 0);
      }
      
      return 0;
    });
    
    return prioritized;
  }

  /**
   * Execute next available test
   */
  async executeNext() {
    // Check resource availability
    const resources = await this.checkResourceAvailability();
    if (!resources.available) {
      this.emit('execution-throttled', { 
        reason: resources.reason,
        timestamp: Date.now() 
      });
      
      // Retry after delay
      setTimeout(() => this.executeNext(), 5000);
      return;
    }
    
    // Check parallel execution limit
    if (this.runningTests.size >= this.getCurrentParallelLimit()) {
      return;
    }
    
    // Find next executable test
    const nextTest = this.findNextExecutableTest();
    if (!nextTest) {
      // Check if all tests are complete
      if (this.executionQueue.length === 0 && this.runningTests.size === 0) {
        this.emit('all-tests-completed', { 
          metrics: this.metrics,
          timestamp: Date.now() 
        });
      }
      return;
    }
    
    // Execute test
    this.executeTest(nextTest).catch(error => {
      console.error('Test execution error:', error);
    });
    
    // Schedule next execution
    setImmediate(() => this.executeNext());
  }

  /**
   * Find next test that can be executed
   */
  findNextExecutableTest() {
    for (let i = 0; i < this.executionQueue.length; i++) {
      const test = this.executionQueue[i];
      
      // Check if dependencies are satisfied
      if (this.areDependenciesSatisfied(test)) {
        // Remove from queue
        this.executionQueue.splice(i, 1);
        return test;
      }
    }
    
    return null;
  }

  /**
   * Check if test dependencies are satisfied
   */
  areDependenciesSatisfied(test) {
    if (!test.dependencies || test.dependencies.length === 0) {
      return true;
    }
    
    for (const depId of test.dependencies) {
      const depTest = this.completedTests.get(depId);
      if (!depTest || depTest.status === 'failed') {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Execute a test
   */
  async executeTest(test) {
    const executionId = randomUUID();
    const startTime = Date.now();
    
    test.executionId = executionId;
    test.status = 'running';
    test.startTime = startTime;
    
    this.runningTests.set(test.id, test);
    this.metrics.runningTests++;
    this.metrics.queuedTests--;
    
    this.emit('test-execution-started', { 
      executionId,
      testId: test.id,
      testName: test.name,
      timestamp: startTime 
    });
    
    try {
      // Execute the test
      const result = await test.execute();
      
      // Test completed successfully
      test.status = 'completed';
      test.endTime = Date.now();
      test.duration = test.endTime - test.startTime;
      test.result = result;
      
      this.runningTests.delete(test.id);
      this.completedTests.set(test.id, test);
      
      this.metrics.runningTests--;
      this.metrics.completedTests++;
      this.metrics.executedTests++;
      
      // Update average execution time
      this.updateAverageExecutionTime(test.duration);
      
      this.emit('test-execution-completed', { 
        executionId,
        testId: test.id,
        duration: test.duration,
        result,
        timestamp: Date.now() 
      });
      
      // Continue execution
      this.executeNext();
      
    } catch (error) {
      // Test failed
      test.status = 'failed';
      test.endTime = Date.now();
      test.duration = test.endTime - test.startTime;
      test.error = error.message;
      
      this.runningTests.delete(test.id);
      
      // Check retry policy
      if (this.shouldRetry(test)) {
        await this.retryTest(test);
      } else {
        this.failedTests.set(test.id, test);
        this.metrics.runningTests--;
        this.metrics.failedTests++;
        
        this.emit('test-execution-failed', { 
          executionId,
          testId: test.id,
          error: error.message,
          retries: test.retries,
          timestamp: Date.now() 
        });
      }
      
      // Continue execution
      this.executeNext();
    }
  }

  /**
   * Check if test should be retried
   */
  shouldRetry(test) {
    return test.retries < this.orchestrationConfig.retryStrategies.maxRetries &&
           test.retryable !== false;
  }

  /**
   * Retry a failed test
   */
  async retryTest(test) {
    test.retries++;
    test.status = 'retrying';
    
    const delay = this.calculateRetryDelay(test.retries);
    
    this.metrics.retriedTests++;
    
    this.emit('test-retry-scheduled', { 
      testId: test.id,
      retry: test.retries,
      delay,
      timestamp: Date.now() 
    });
    
    // Re-queue after delay
    setTimeout(() => {
      test.status = 'queued';
      this.executionQueue.unshift(test); // Add to front of queue
      this.metrics.queuedTests++;
      this.executeNext();
    }, delay);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(retryCount) {
    const { initialDelay, backoffMultiplier } = this.orchestrationConfig.retryStrategies;
    return initialDelay * Math.pow(backoffMultiplier, retryCount - 1);
  }

  /**
   * Get current parallel execution limit
   */
  getCurrentParallelLimit() {
    if (!this.orchestrationConfig.adaptiveParallelism) {
      return this.orchestrationConfig.maxParallelTests;
    }
    
    // Adjust based on resource utilization
    const { cpu, memory } = this.metrics.resourceUtilization;
    
    if (cpu > 90 || memory > 90) {
      return Math.max(1, Math.floor(this.orchestrationConfig.maxParallelTests * 0.5));
    } else if (cpu > 70 || memory > 70) {
      return Math.max(2, Math.floor(this.orchestrationConfig.maxParallelTests * 0.75));
    }
    
    return this.orchestrationConfig.maxParallelTests;
  }

  /**
   * Check resource availability
   */
  async checkResourceAvailability() {
    const usage = await this.getResourceUsage();
    
    const { cpu, memory, disk } = this.orchestrationConfig.resourceThresholds;
    
    if (usage.cpu > cpu) {
      return { available: false, reason: `CPU usage ${usage.cpu}% exceeds threshold ${cpu}%` };
    }
    
    if (usage.memory > memory) {
      return { available: false, reason: `Memory usage ${usage.memory}% exceeds threshold ${memory}%` };
    }
    
    if (usage.disk > disk) {
      return { available: false, reason: `Disk usage ${usage.disk}% exceeds threshold ${disk}%` };
    }
    
    return { available: true };
  }

  /**
   * Get current resource usage
   */
  async getResourceUsage() {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    
    // Calculate CPU usage (simplified)
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const cpuUsage = 100 - Math.floor(totalIdle / totalTick * 100);
    const memoryUsage = Math.floor((totalMemory - freeMemory) / totalMemory * 100);
    
    this.metrics.resourceUtilization = {
      cpu: cpuUsage,
      memory: memoryUsage,
      disk: 0 // Simplified for now
    };
    
    return this.metrics.resourceUtilization;
  }

  /**
   * Start resource monitoring
   */
  startResourceMonitoring() {
    // Temporarily disable resource monitoring for tests
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    
    this.resourceMonitor = setInterval(async () => {
      await this.getResourceUsage();
      
      this.emit('resource-usage-updated', { 
        usage: this.metrics.resourceUtilization,
        timestamp: Date.now() 
      });
    }, 5000);
  }

  /**
   * Update average execution time
   */
  updateAverageExecutionTime(duration) {
    const totalTime = this.metrics.averageExecutionTime * (this.metrics.executedTests - 1);
    this.metrics.averageExecutionTime = (totalTime + duration) / this.metrics.executedTests;
  }

  /**
   * Get orchestration status
   */
  getStatus() {
    return {
      queue: {
        length: this.executionQueue.length,
        tests: this.executionQueue.map(t => ({
          id: t.id,
          name: t.name,
          priority: t.priority,
          dependencies: t.dependencies
        }))
      },
      running: {
        count: this.runningTests.size,
        tests: Array.from(this.runningTests.values()).map(t => ({
          id: t.id,
          name: t.name,
          duration: Date.now() - t.startTime
        }))
      },
      completed: {
        count: this.completedTests.size,
        tests: Array.from(this.completedTests.values()).map(t => ({
          id: t.id,
          name: t.name,
          duration: t.duration,
          status: t.status
        }))
      },
      failed: {
        count: this.failedTests.size,
        tests: Array.from(this.failedTests.values()).map(t => ({
          id: t.id,
          name: t.name,
          error: t.error,
          retries: t.retries
        }))
      },
      metrics: this.metrics
    };
  }

  /**
   * Cancel test execution
   */
  async cancelExecution(testId) {
    const test = this.runningTests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} is not currently running`);
    }
    
    this.emit('test-execution-cancelled', { 
      testId,
      timestamp: Date.now() 
    });
    
    // Cancel the test execution
    if (test.cancel) {
      await test.cancel();
    }
    
    // Remove from running tests
    this.runningTests.delete(testId);
    this.metrics.runningTests--;
    
    // Mark as cancelled
    test.status = 'cancelled';
    this.completedTests.set(testId, test);
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.emit('orchestrator-cleanup-started', { timestamp: Date.now() });
    
    // Stop resource monitoring
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
      this.resourceMonitor = null;
    }
    
    // Cancel all running tests
    for (const [testId] of this.runningTests) {
      await this.cancelExecution(testId);
    }
    
    // Clear queues
    this.executionQueue = [];
    this.runningTests.clear();
    this.completedTests.clear();
    this.failedTests.clear();
    
    // Reset metrics
    this.metrics = {
      totalTests: 0,
      executedTests: 0,
      queuedTests: 0,
      runningTests: 0,
      completedTests: 0,
      failedTests: 0,
      retriedTests: 0,
      averageExecutionTime: 0,
      resourceUtilization: {
        cpu: 0,
        memory: 0,
        disk: 0
      }
    };
    
    this.emit('orchestrator-cleanup-completed', { timestamp: Date.now() });
  }
}

export { TestOrchestrator };