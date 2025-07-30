/**
 * Memory Leak Tests
 * Tests for memory leaks and resource cleanup
 */

import { JestAgentWrapper } from '../../src/core/JestAgentWrapper.js';
import { EventCollector } from '../../src/core/EventCollector.js';
import { StorageEngine } from '../../src/storage/StorageEngine.js';
import { promises as fs } from 'fs';
import path from 'path';
import { TestDbHelper, setupTestDb, cleanupTestDb } from '../utils/test-db-helper.js';

describe('Memory Leak Tests', () => {
  let testDbPath;

  beforeAll(async () => {
    await setupTestDb();
  });

  let tempDir;

  beforeEach(async () => {
    testDbPath = TestDbHelper.getTempDbPath('memory');
    // Create temporary directory for test databases
    tempDir = path.join(process.cwd(), 'temp-memory-tests');
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, that's fine
    }
  });

  describe('Event Listener Cleanup', () => {
    test('properly removes event listeners on close', async () => {
      const testDbPath = path.join(tempDir, `memory-listeners-${Date.now()}.db`);
      
      const jaw = new JestAgentWrapper({
        dbPath: testDbPath,
        storage: 'sqlite'
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Add multiple event listeners
      const listenerCount = 50;
      const listeners = [];
      
      for (let i = 0; i < listenerCount; i++) {
        const listener = (test) => {
          listeners.push(test.name);
        };
        jaw.onTestStart(listener);
      }
      
      // Verify listeners are registered
      expect(jaw.listenerCount('testStart')).toBe(listenerCount);
      
      // Close JAW
      await jaw.close();
      
      // Verify listeners are cleaned up
      expect(jaw.listenerCount('testStart')).toBe(0);
      
      // Verify no memory leaks by checking that listeners array doesn't grow
      const initialLength = listeners.length;
      
      // Try to trigger events (should not work after close)
      try {
        jaw.collector.onTestStart({
          path: '/test.js',
          name: 'test after close',
          fullName: 'Test after close'
        });
      } catch (error) {
        // Expected - collector should not work after close
      }
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Listeners array should not have grown
      expect(listeners.length).toBe(initialLength);
    });

    test('handles multiple JAW instances without listener interference', async () => {
      const instances = [];
      const listenerCounts = [];
      
      // Create multiple JAW instances
      for (let i = 0; i < 5; i++) {
        const testDbPath = path.join(tempDir, `memory-multi-${i}-${Date.now()}.db`);
        
        const jaw = new JestAgentWrapper({
          dbPath: testDbPath,
          storage: 'sqlite'
        });
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Add listeners to each instance
        const instanceListeners = [];
        for (let j = 0; j < 10; j++) {
          const listener = (test) => {
            instanceListeners.push(`instance-${i}-${test.name}`);
          };
          jaw.onTestStart(listener);
        }
        
        instances.push(jaw);
        listenerCounts.push(instanceListeners);
      }
      
      // Verify each instance has its own listeners
      instances.forEach((jaw, index) => {
        expect(jaw.listenerCount('testStart')).toBe(10);
      });
      
      // Close instances one by one
      for (let i = 0; i < instances.length; i++) {
        await instances[i].close();
        
        // Verify this instance's listeners are cleaned up
        expect(instances[i].listenerCount('testStart')).toBe(0);
        
        // Verify other instances still have their listeners
        for (let j = i + 1; j < instances.length; j++) {
          expect(instances[j].listenerCount('testStart')).toBe(10);
        }
      }
    });

    test('prevents memory leaks with rapid listener addition/removal', async () => {
      const testDbPath = path.join(tempDir, `memory-rapid-${Date.now()}.db`);
      
      const jaw = new JestAgentWrapper({
        dbPath: testDbPath,
        storage: 'sqlite'
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const initialMemory = process.memoryUsage();
      
      // Rapidly add and remove listeners
      for (let cycle = 0; cycle < 100; cycle++) {
        const listeners = [];
        
        // Add listeners
        for (let i = 0; i < 20; i++) {
          const listener = (test) => {
            listeners.push(test.name);
          };
          jaw.onTestStart(listener);
        }
        
        // Simulate some events
        const session = await jaw.startSession({ testMatch: ['**/*.test.js'] });
        jaw.collector.onTestSuiteStart('/rapid-test.js');
        
        for (let i = 0; i < 5; i++) {
          const test = jaw.collector.onTestStart({
            path: '/rapid-test.js',
            name: `rapid test ${i}`,
            fullName: `Rapid rapid test ${i}`
          });
          
          if (test) {
            jaw.collector.onTestEnd(test, {
              status: 'passed',
              failureMessages: []
            });
          }
        }
        
        jaw.collector.onTestSuiteEnd('/rapid-test.js', {
          numFailingTests: 0,
          numPassingTests: 5
        });
        
        jaw.collector.endSession({
          numTotalTests: 5,
          numPassedTests: 5,
          numFailedTests: 0
        });
        
        // Remove listeners by closing and recreating (simulates cleanup)
        if (cycle < 99) { // Don't recreate on last cycle
          await jaw.close();
          
          const newJaw = new JestAgentWrapper({
            dbPath: testDbPath,
            storage: 'sqlite'
          });
          
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Replace the jaw reference
          Object.setPrototypeOf(jaw, Object.getPrototypeOf(newJaw));
          Object.assign(jaw, newJaw);
        }
      }
      
      await jaw.close();
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      console.log(`Rapid Listener Memory: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase after 100 cycles`);
    }, 30000); // 30 second timeout
  });

  describe('Database Connection Cleanup', () => {
    test('properly closes database connections', async () => {
      const testDbPath = path.join(tempDir, `memory-db-${Date.now()}.db`);
      
      const storage = new StorageEngine(testDbPath);
      await storage.initialize();
      
      // Verify database is open
      expect(storage.db).toBeDefined();
      expect(storage.db.open).toBe(true);
      expect(storage.initialized).toBe(true);
      
      // Close storage
      await storage.close();
      
      // Verify database is closed
      expect(storage.db).toBeNull();
      expect(storage.initialized).toBe(false);
    });

    test('handles multiple database connections without leaks', async () => {
      const connections = [];
      
      // Create multiple database connections
      for (let i = 0; i < 10; i++) {
        const testDbPath = path.join(tempDir, `memory-multi-db-${i}-${Date.now()}.db`);
        
        const storage = new StorageEngine(testDbPath);
        await storage.initialize();
        
        connections.push(storage);
      }
      
      // Verify all connections are open
      connections.forEach(storage => {
        expect(storage.db.open).toBe(true);
      });
      
      // Close connections one by one
      for (let i = 0; i < connections.length; i++) {
        await connections[i].close();
        
        // Verify this connection is closed
        expect(connections[i].db).toBeNull();
        expect(connections[i].initialized).toBe(false);
        
        // Verify other connections are still open
        for (let j = i + 1; j < connections.length; j++) {
          expect(connections[j].db.open).toBe(true);
          expect(connections[j].initialized).toBe(true);
        }
      }
    });

    test('prevents database connection leaks with rapid open/close', async () => {
      const initialMemory = process.memoryUsage();
      
      // Rapidly open and close database connections
      for (let i = 0; i < 50; i++) {
        const testDbPath = path.join(tempDir, `memory-rapid-db-${i}-${Date.now()}.db`);
        
        const storage = new StorageEngine(testDbPath);
        await storage.initialize();
        
        // Perform some operations
        const session = {
          id: `rapid-session-${i}`,
          startTime: new Date(),
          endTime: new Date(),
          status: 'completed',
          jestConfig: {},
          environment: {},
          summary: {}
        };
        
        await storage.storeSession(session);
        
        // Close immediately
        await storage.close();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 30MB)
      expect(memoryIncrease).toBeLessThan(30 * 1024 * 1024);
      
      console.log(`Rapid DB Memory: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase after 50 connections`);
    }, 20000); // 20 second timeout
  });

  describe('Object Reference Cleanup', () => {
    test('properly cleans up test case references', async () => {
      const testDbPath = path.join(tempDir, `memory-objects-${Date.now()}.db`);
      
      const jaw = new JestAgentWrapper({
        dbPath: testDbPath,
        storage: 'sqlite'
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const initialMemory = process.memoryUsage();
      
      // Create many test cases
      for (let cycle = 0; cycle < 10; cycle++) {
        const session = await jaw.startSession({
          testMatch: ['**/*.test.js']
        });
        
        jaw.collector.onTestSuiteStart(`/object-cleanup-${cycle}.test.js`);
        
        const tests = [];
        for (let i = 0; i < 100; i++) {
          const test = jaw.collector.onTestStart({
            path: `/object-cleanup-${cycle}.test.js`,
            name: `cleanup test ${i}`,
            fullName: `Object Cleanup ${cycle} cleanup test ${i}`
          });
          
          if (test) {
            tests.push(test);
            jaw.collector.onTestEnd(test, {
              status: 'passed',
              failureMessages: []
            });
          }
        }
        
        jaw.collector.onTestSuiteEnd(`/object-cleanup-${cycle}.test.js`, {
          numFailingTests: 0,
          numPassingTests: tests.length
        });
        
        jaw.collector.endSession({
          numTotalTests: tests.length,
          numPassedTests: tests.length,
          numFailedTests: 0
        });
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        // Check memory periodically
        if (cycle % 3 === 0) {
          const currentMemory = process.memoryUsage();
          const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
          
          // Memory should not grow excessively
          expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
        }
      }
      
      await jaw.close();
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Total memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(150 * 1024 * 1024);
      
      console.log(`Object Cleanup Memory: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase after 1000 test objects`);
    }, 25000); // 25 second timeout

    test('cleans up event collector state properly', async () => {
      const testDbPath = path.join(tempDir, `memory-collector-${Date.now()}.db`);
      
      const storage = new StorageEngine(testDbPath);
      await storage.initialize();
      
      const initialMemory = process.memoryUsage();
      
      // Create and destroy many event collectors
      for (let i = 0; i < 100; i++) {
        const collector = new EventCollector(storage);
        
        // Use the collector
        const session = collector.startSession({
          testMatch: ['**/*.test.js']
        });
        
        collector.onTestSuiteStart('/collector-test.js');
        
        for (let j = 0; j < 10; j++) {
          const test = collector.onTestStart({
            path: '/collector-test.js',
            name: `collector test ${j}`,
            fullName: `Collector collector test ${j}`
          });
          
          if (test) {
            collector.onTestEnd(test, {
              status: 'passed',
              failureMessages: []
            });
          }
        }
        
        collector.onTestSuiteEnd('/collector-test.js', {
          numFailingTests: 0,
          numPassingTests: 10
        });
        
        collector.endSession({
          numTotalTests: 10,
          numPassedTests: 10,
          numFailedTests: 0
        });
        
        // Collector should clean up its state
        expect(collector.currentSession).toBeNull();
        expect(collector.currentSuites.size).toBe(0);
        expect(collector.currentTests.size).toBe(0);
        expect(collector.consoleBuffer.length).toBe(0);
      }
      
      await storage.close();
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be minimal
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      console.log(`Collector Memory: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase after 100 collectors`);
    }, 20000); // 20 second timeout
  });

  describe('Long-running Session Memory Stability', () => {
    test('maintains stable memory usage over extended periods', async () => {
      const testDbPath = path.join(tempDir, `memory-longrun-${Date.now()}.db`);
      
      const jaw = new JestAgentWrapper({
        dbPath: testDbPath,
        storage: 'sqlite',
        eventBufferSize: 100 // Smaller buffer to test cleanup
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js']
      });
      
      const initialMemory = process.memoryUsage();
      const memorySnapshots = [];
      
      // Simulate long-running session with continuous test execution
      for (let hour = 0; hour < 5; hour++) { // Simulate 5 "hours" of testing
        jaw.collector.onTestSuiteStart(`/longrun-hour-${hour}.test.js`);
        
        // Each "hour" has many tests
        for (let i = 0; i < 200; i++) {
          const test = jaw.collector.onTestStart({
            path: `/longrun-hour-${hour}.test.js`,
            name: `longrun test ${i}`,
            fullName: `Long Run Hour ${hour} longrun test ${i}`
          });
          
          if (test) {
            // Add some complex data
            const assertion = {
              testId: test.id,
              timestamp: new Date(),
              type: 'expect',
              matcher: 'toBe',
              passed: i % 10 !== 0,
              actual: `value-${i}`,
              expected: `value-${i}`,
              message: `Assertion for test ${i}`
            };
            
            jaw.collector.onAssertion(assertion);
            
            const logEntry = {
              sessionId: session.id,
              testId: test.id,
              timestamp: new Date(),
              level: 'info',
              message: `Log for test ${i} in hour ${hour}`,
              source: 'test'
            };
            
            jaw.collector.onConsoleLog(logEntry);
            
            jaw.collector.onTestEnd(test, {
              status: i % 10 === 0 ? 'failed' : 'passed',
              failureMessages: i % 10 === 0 ? [`Test ${i} failed`] : []
            });
          }
        }
        
        jaw.collector.onTestSuiteEnd(`/longrun-hour-${hour}.test.js`, {
          numFailingTests: 20,
          numPassingTests: 180
        });
        
        // Take memory snapshot
        const currentMemory = process.memoryUsage();
        const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
        memorySnapshots.push({
          hour,
          memoryMB: memoryIncrease / 1024 / 1024
        });
        
        console.log(`Hour ${hour}: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB memory usage`);
        
        // Memory should not grow excessively
        expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024); // Less than 200MB
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        // Small delay to simulate time passing
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      jaw.collector.endSession({
        numTotalTests: 1000,
        numPassedTests: 900,
        numFailedTests: 100
      });
      
      await jaw.close();
      
      // Analyze memory growth pattern
      const finalMemory = memorySnapshots[memorySnapshots.length - 1].memoryMB;
      const initialMemorySnapshot = memorySnapshots[0].memoryMB;
      const memoryGrowth = finalMemory - initialMemorySnapshot;
      
      // Memory growth should be reasonable over time
      expect(memoryGrowth).toBeLessThan(100); // Less than 100MB growth
      
      console.log(`Long-run Memory Growth: ${memoryGrowth.toFixed(2)}MB over 5 hours simulation`);
    }, 30000); // 30 second timeout

    test('handles memory efficiently with continuous event processing', async () => {
      const testDbPath = path.join(tempDir, `memory-continuous-${Date.now()}.db`);
      
      const jaw = new JestAgentWrapper({
        dbPath: testDbPath,
        storage: 'sqlite',
        realTimeEvents: true,
        eventBufferSize: 50
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const eventsReceived = [];
      jaw.onTestStart((test) => {
        eventsReceived.push(test.name);
        
        // Simulate processing and cleanup
        if (eventsReceived.length > 1000) {
          eventsReceived.splice(0, 500); // Remove old events
        }
      });
      
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js']
      });
      
      const initialMemory = process.memoryUsage();
      
      // Continuous event processing
      for (let batch = 0; batch < 20; batch++) {
        jaw.collector.onTestSuiteStart(`/continuous-${batch}.test.js`);
        
        for (let i = 0; i < 100; i++) {
          const test = jaw.collector.onTestStart({
            path: `/continuous-${batch}.test.js`,
            name: `continuous test ${batch}-${i}`,
            fullName: `Continuous ${batch} continuous test ${i}`
          });
          
          if (test) {
            jaw.collector.onTestEnd(test, {
              status: 'passed',
              failureMessages: []
            });
          }
        }
        
        jaw.collector.onTestSuiteEnd(`/continuous-${batch}.test.js`, {
          numFailingTests: 0,
          numPassingTests: 100
        });
        
        // Check memory every few batches
        if (batch % 5 === 0) {
          const currentMemory = process.memoryUsage();
          const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
          
          // Memory should remain stable
          expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
          
          console.log(`Batch ${batch}: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB, Events: ${eventsReceived.length}`);
        }
      }
      
      jaw.collector.endSession({
        numTotalTests: 2000,
        numPassedTests: 2000,
        numFailedTests: 0
      });
      
      await jaw.close();
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Final memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(150 * 1024 * 1024);
      
      console.log(`Continuous Processing Memory: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase`);
    }, 25000); // 25 second timeout
  });

  describe('Garbage Collection Effectiveness', () => {
    test('properly releases memory after session completion', async () => {
      if (!global.gc) {
        console.log('Skipping GC test - garbage collection not available');
        return;
      }
      
      const testDbPath = path.join(tempDir, `memory-gc-${Date.now()}.db`);
      
      // Force initial garbage collection
      global.gc();
      const baselineMemory = process.memoryUsage();
      
      // Create and complete multiple sessions
      for (let sessionIndex = 0; sessionIndex < 5; sessionIndex++) {
        const jaw = new JestAgentWrapper({
          dbPath: testDbPath,
          storage: 'sqlite'
        });
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const session = await jaw.startSession({
          testMatch: ['**/*.test.js']
        });
        
        jaw.collector.onTestSuiteStart(`/gc-test-${sessionIndex}.test.js`);
        
        // Create substantial amount of data
        for (let i = 0; i < 500; i++) {
          const test = jaw.collector.onTestStart({
            path: `/gc-test-${sessionIndex}.test.js`,
            name: `gc test ${i}`,
            fullName: `GC Test ${sessionIndex} gc test ${i}`
          });
          
          if (test) {
            // Add complex data that should be garbage collected
            const complexData = {
              largeArray: Array.from({ length: 100 }, (_, idx) => ({
                id: idx,
                data: `test-data-${sessionIndex}-${i}-${idx}`,
                nested: { value: Math.random() }
              }))
            };
            
            jaw.collector.onTestEnd(test, {
              status: 'passed',
              failureMessages: [],
              metadata: complexData
            });
          }
        }
        
        jaw.collector.onTestSuiteEnd(`/gc-test-${sessionIndex}.test.js`, {
          numFailingTests: 0,
          numPassingTests: 500
        });
        
        jaw.collector.endSession({
          numTotalTests: 500,
          numPassedTests: 500,
          numFailedTests: 0
        });
        
        await jaw.close();
        
        // Force garbage collection
        global.gc();
        
        const currentMemory = process.memoryUsage();
        const memoryIncrease = currentMemory.heapUsed - baselineMemory.heapUsed;
        
        console.log(`Session ${sessionIndex}: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB after GC`);
        
        // Memory should not accumulate excessively
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      }
      
      // Final garbage collection
      global.gc();
      const finalMemory = process.memoryUsage();
      const totalMemoryIncrease = finalMemory.heapUsed - baselineMemory.heapUsed;
      
      // Total memory increase should be minimal after GC
      expect(totalMemoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      console.log(`GC Effectiveness: ${(totalMemoryIncrease / 1024 / 1024).toFixed(2)}MB final increase`);
    }, 30000); // 30 second timeout
  });
});
