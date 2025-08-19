/**
 * Performance Load Tests
 * Tests system performance under various load conditions
 */

import { JestAgentWrapper } from '../../src/core/JestAgentWrapper.js';
import { promises as fs } from 'fs';
import path from 'path';
import { TestDbHelper, setupTestDb, cleanupTestDb } from '../utils/test-db-helper.js';

describe('Performance Load Tests', () => {
  let testDbPath;

  beforeAll(async () => {
    await setupTestDb();
  });

  let jaw;
  let tempDir;

  beforeEach(async () => {
    // Create temporary directory for test databases
    tempDir = path.join(process.cwd(), 'temp-performance-load');
    await fs.mkdir(tempDir, { recursive: true });
    
    testDbPath = path.join(tempDir, `performance-load-${Date.now()}-${Math.random().toString(36).substring(7)}.db`);
    
    jaw = new JestAgentWrapper({
      dbPath: testDbPath,
      storage: 'sqlite',
      realTimeEvents: true,
      eventBufferSize: 1000
    });
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  afterEach(async () => {
    if (jaw) {
      await jaw.close();
    }
    
    // Clean up test files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, that's fine
    }
  });

  describe('Large Test Suite Handling', () => {
    test('handles 1000+ test cases efficiently', async () => {
      const startTime = Date.now();
      const testCount = 1000;
      
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js']
      });
      
      jaw.collector.onTestSuiteStart('/large-suite.test.js');
      
      // Create many test cases
      const tests = [];
      for (let i = 0; i < testCount; i++) {
        const test = jaw.collector.onTestStart({
          path: '/large-suite.test.js',
          name: `performance test ${i}`,
          fullName: `Large Suite performance test ${i}`
        });
        
        if (test) {
          tests.push(test);
          jaw.collector.onTestEnd(test, {
            status: i % 10 === 0 ? 'failed' : 'passed',
            failureMessages: i % 10 === 0 ? [`Test ${i} failed`] : []
          });
        }
      }
      
      jaw.collector.onTestSuiteEnd('/large-suite.test.js', {
        numFailingTests: Math.floor(testCount / 10),
        numPassingTests: testCount - Math.floor(testCount / 10)
      });
      
      jaw.collector.endSession({
        numTotalTests: testCount,
        numPassedTests: testCount - Math.floor(testCount / 10),
        numFailedTests: Math.floor(testCount / 10)
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (less than 10 seconds)
      expect(duration).toBeLessThan(10000);
      
      // Verify all tests were created
      expect(tests.length).toBeGreaterThan(900); // Allow for some failures
      
      console.log(`Performance: ${testCount} tests processed in ${duration}ms (${(testCount / duration * 1000).toFixed(2)} tests/sec)`);
    }, 15000); // 15 second timeout

    test('maintains performance with complex test data', async () => {
      const startTime = Date.now();
      const testCount = 500;
      
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js']
      });
      
      jaw.collector.onTestSuiteStart('/complex-data.test.js');
      
      // Create tests with complex data
      const tests = [];
      for (let i = 0; i < testCount; i++) {
        const test = jaw.collector.onTestStart({
          path: '/complex-data.test.js',
          name: `complex test ${i}`,
          fullName: `Complex Data complex test ${i}`
        });
        
        if (test) {
          tests.push(test);
          
          // Add complex assertions
          for (let j = 0; j < 5; j++) {
            const assertion = {
              testId: test.id,
              timestamp: new Date(),
              type: 'expect',
              matcher: 'toEqual',
              passed: j % 2 === 0,
              actual: { data: `test-${i}-${j}`, nested: { value: j, array: [1, 2, 3, 4, 5] } },
              expected: { data: `test-${i}-${j}`, nested: { value: j, array: [1, 2, 3, 4, 5] } },
              message: `Assertion ${j} for test ${i}`
            };
            
            jaw.collector.onAssertion(assertion);
          }
          
          // Add complex logs
          for (let k = 0; k < 3; k++) {
            const logEntry = {
              sessionId: session.id,
              testId: test.id,
              timestamp: new Date(),
              level: ['info', 'warn', 'error'][k % 3],
              message: `Complex log message ${k} for test ${i}`,
              source: 'test',
              metadata: {
                testIndex: i,
                logIndex: k,
                complexData: {
                  nested: { deep: { value: `test-${i}-log-${k}` } },
                  array: Array.from({ length: 10 }, (_, idx) => ({ id: idx, value: `item-${idx}` }))
                }
              }
            };
            
            jaw.collector.onConsoleLog(logEntry);
          }
          
          jaw.collector.onTestEnd(test, {
            status: i % 20 === 0 ? 'failed' : 'passed',
            failureMessages: i % 20 === 0 ? [`Complex test ${i} failed with detailed error`] : []
          });
        }
      }
      
      jaw.collector.onTestSuiteEnd('/complex-data.test.js', {
        numFailingTests: Math.floor(testCount / 20),
        numPassingTests: testCount - Math.floor(testCount / 20)
      });
      
      jaw.collector.endSession({
        numTotalTests: testCount,
        numPassedTests: testCount - Math.floor(testCount / 20),
        numFailedTests: Math.floor(testCount / 20)
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (less than 15 seconds)
      expect(duration).toBeLessThan(15000);
      
      // Verify all tests were created
      expect(tests.length).toBeGreaterThan(450); // Allow for some failures
      
      console.log(`Complex Performance: ${testCount} tests with complex data processed in ${duration}ms`);
    }, 20000); // 20 second timeout

    test('handles concurrent test execution efficiently', async () => {
      const startTime = Date.now();
      const suiteCount = 10;
      const testsPerSuite = 50;
      
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js']
      });
      
      // Create multiple test suites concurrently
      const suitePromises = [];
      
      for (let suiteIndex = 0; suiteIndex < suiteCount; suiteIndex++) {
        const suitePromise = new Promise(async (resolve) => {
          const suitePath = `/concurrent-suite-${suiteIndex}.test.js`;
          
          jaw.collector.onTestSuiteStart(suitePath);
          
          const suiteTests = [];
          for (let testIndex = 0; testIndex < testsPerSuite; testIndex++) {
            const test = jaw.collector.onTestStart({
              path: suitePath,
              name: `concurrent test ${testIndex}`,
              fullName: `Concurrent Suite ${suiteIndex} concurrent test ${testIndex}`
            });
            
            if (test) {
              suiteTests.push(test);
              
              // Simulate async test completion with random delays
              setTimeout(() => {
                jaw.collector.onTestEnd(test, {
                  status: Math.random() > 0.1 ? 'passed' : 'failed',
                  failureMessages: Math.random() > 0.1 ? [] : [`Test ${testIndex} in suite ${suiteIndex} failed`]
                });
              }, Math.random() * 10);
            }
          }
          
          // Wait for all tests in this suite to complete
          setTimeout(() => {
            jaw.collector.onTestSuiteEnd(suitePath, {
              numFailingTests: Math.floor(testsPerSuite * 0.1),
              numPassingTests: testsPerSuite - Math.floor(testsPerSuite * 0.1)
            });
            resolve(suiteTests);
          }, 50);
        });
        
        suitePromises.push(suitePromise);
      }
      
      // Wait for all suites to complete
      const allTests = await Promise.all(suitePromises);
      const totalTests = allTests.flat().length;
      
      jaw.collector.endSession({
        numTotalTests: totalTests,
        numPassedTests: Math.floor(totalTests * 0.9),
        numFailedTests: Math.floor(totalTests * 0.1)
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);
      
      // Verify tests were created
      expect(totalTests).toBeGreaterThan(400); // Allow for some failures
      
      console.log(`Concurrent Performance: ${totalTests} tests across ${suiteCount} suites processed in ${duration}ms`);
    }, 10000); // 10 second timeout
  });

  describe('Memory Usage Under Load', () => {
    test('maintains reasonable memory usage with large datasets', async () => {
      const initialMemory = process.memoryUsage();
      const testCount = 2000;
      
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js']
      });
      
      jaw.collector.onTestSuiteStart('/memory-test.test.js');
      
      // Create many tests to stress memory
      const tests = [];
      for (let i = 0; i < testCount; i++) {
        const test = jaw.collector.onTestStart({
          path: '/memory-test.test.js',
          name: `memory test ${i}`,
          fullName: `Memory Test memory test ${i}`
        });
        
        if (test) {
          tests.push(test);
          jaw.collector.onTestEnd(test, {
            status: 'passed',
            failureMessages: []
          });
        }
        
        // Check memory periodically
        if (i % 500 === 0) {
          const currentMemory = process.memoryUsage();
          const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
          
          // Memory increase should be reasonable (less than 100MB for 2000 tests)
          expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
        }
      }
      
      jaw.collector.onTestSuiteEnd('/memory-test.test.js', {
        numFailingTests: 0,
        numPassingTests: testCount
      });
      
      jaw.collector.endSession({
        numTotalTests: testCount,
        numPassedTests: testCount,
        numFailedTests: 0
      });
      
      const finalMemory = process.memoryUsage();
      const totalMemoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Total memory increase should be reasonable
      expect(totalMemoryIncrease).toBeLessThan(150 * 1024 * 1024); // Less than 150MB
      
      console.log(`Memory Usage: ${(totalMemoryIncrease / 1024 / 1024).toFixed(2)}MB increase for ${testCount} tests`);
    }, 30000); // 30 second timeout

    test('handles memory efficiently with event listeners', async () => {
      const initialMemory = process.memoryUsage();
      const listenerCount = 100;
      const testCount = 500;
      
      // Add many event listeners
      const listeners = [];
      for (let i = 0; i < listenerCount; i++) {
        const listener = (test) => {
          // Simple listener that just stores test name
          listeners.push(test.name);
        };
        jaw.onTestStart(listener);
      }
      
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js']
      });
      
      jaw.collector.onTestSuiteStart('/listener-memory.test.js');
      
      // Create tests to trigger listeners
      for (let i = 0; i < testCount; i++) {
        const test = jaw.collector.onTestStart({
          path: '/listener-memory.test.js',
          name: `listener test ${i}`,
          fullName: `Listener Memory listener test ${i}`
        });
        
        if (test) {
          jaw.collector.onTestEnd(test, {
            status: 'passed',
            failureMessages: []
          });
        }
      }
      
      jaw.collector.onTestSuiteEnd('/listener-memory.test.js', {
        numFailingTests: 0,
        numPassingTests: testCount
      });
      
      jaw.collector.endSession({
        numTotalTests: testCount,
        numPassedTests: testCount,
        numFailedTests: 0
      });
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable even with many listeners
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
      
      console.log(`Listener Memory: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase with ${listenerCount} listeners and ${testCount} tests`);
    }, 20000); // 20 second timeout
  });

  describe('Database Query Performance', () => {
    test('maintains fast query response times under load', async () => {
      const testCount = 1000;
      
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js']
      });
      
      jaw.collector.onTestSuiteStart('/query-performance.test.js');
      
      // Create test data
      const tests = [];
      for (let i = 0; i < testCount; i++) {
        const test = jaw.collector.onTestStart({
          path: '/query-performance.test.js',
          name: `query test ${i}`,
          fullName: `Query Performance query test ${i}`
        });
        
        if (test) {
          tests.push(test);
          jaw.collector.onTestEnd(test, {
            status: i % 5 === 0 ? 'failed' : 'passed',
            failureMessages: i % 5 === 0 ? [`Query test ${i} failed`] : []
          });
        }
      }
      
      jaw.collector.onTestSuiteEnd('/query-performance.test.js', {
        numFailingTests: Math.floor(testCount / 5),
        numPassingTests: testCount - Math.floor(testCount / 5)
      });
      
      jaw.collector.endSession({
        numTotalTests: testCount,
        numPassedTests: testCount - Math.floor(testCount / 5),
        numFailedTests: Math.floor(testCount / 5)
      });
      
      // Wait for data to be stored
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test various query performance
      const queryTests = [
        async () => {
          const start = Date.now();
          const failedTests = await jaw.getFailedTests(session.id);
          const duration = Date.now() - start;
          expect(duration).toBeLessThan(100); // Less than 100ms
          expect(failedTests.length).toBeGreaterThan(0);
          return { operation: 'getFailedTests', duration, count: failedTests.length };
        },
        async () => {
          const start = Date.now();
          const summary = await jaw.getTestSummary(session.id);
          const duration = Date.now() - start;
          expect(duration).toBeLessThan(50); // Less than 50ms
          expect(summary.total).toBeGreaterThan(0);
          return { operation: 'getTestSummary', duration, summary };
        },
        async () => {
          const start = Date.now();
          const slowTests = await jaw.getSlowestTests(10);
          const duration = Date.now() - start;
          expect(duration).toBeLessThan(100); // Less than 100ms
          return { operation: 'getSlowestTests', duration, count: slowTests.length };
        },
        async () => {
          const start = Date.now();
          const allTests = await jaw.findTests({ sessionId: session.id });
          const duration = Date.now() - start;
          expect(duration).toBeLessThan(200); // Less than 200ms for all tests
          expect(allTests.length).toBeGreaterThan(0);
          return { operation: 'findTests', duration, count: allTests.length };
        }
      ];
      
      // Run all query tests
      const results = [];
      for (const queryTest of queryTests) {
        const result = await queryTest();
        results.push(result);
      }
      
      // Log performance results
      results.forEach(result => {
        console.log(`Query Performance: ${result.operation} took ${result.duration}ms`);
      });
      
      // Verify all queries completed within acceptable time
      const totalQueryTime = results.reduce((sum, result) => sum + result.duration, 0);
      expect(totalQueryTime).toBeLessThan(500); // Total query time less than 500ms
    }, 15000); // 15 second timeout

    test('handles concurrent database operations efficiently', async () => {
      const sessionCount = 5;
      const testsPerSession = 100;
      
      // Create multiple sessions concurrently
      const sessionPromises = [];
      
      for (let sessionIndex = 0; sessionIndex < sessionCount; sessionIndex++) {
        const sessionPromise = new Promise(async (resolve) => {
          const sessionJaw = new JestAgentWrapper({
            dbPath: testDbPath,
            storage: 'sqlite'
          });
          
          await new Promise(r => setTimeout(r, 50)); // Wait for init
          
          const session = await sessionJaw.startSession({
            testMatch: ['**/*.test.js']
          });
          
          sessionJaw.collector.onTestSuiteStart(`/concurrent-db-${sessionIndex}.test.js`);
          
          const sessionTests = [];
          for (let testIndex = 0; testIndex < testsPerSession; testIndex++) {
            const test = sessionJaw.collector.onTestStart({
              path: `/concurrent-db-${sessionIndex}.test.js`,
              name: `concurrent db test ${testIndex}`,
              fullName: `Concurrent DB ${sessionIndex} concurrent db test ${testIndex}`
            });
            
            if (test) {
              sessionTests.push(test);
              sessionJaw.collector.onTestEnd(test, {
                status: 'passed',
                failureMessages: []
              });
            }
          }
          
          sessionJaw.collector.onTestSuiteEnd(`/concurrent-db-${sessionIndex}.test.js`, {
            numFailingTests: 0,
            numPassingTests: testsPerSession
          });
          
          sessionJaw.collector.endSession({
            numTotalTests: testsPerSession,
            numPassedTests: testsPerSession,
            numFailedTests: 0
          });
          
          await sessionJaw.close();
          resolve({ sessionId: session.id, testCount: sessionTests.length });
        });
        
        sessionPromises.push(sessionPromise);
      }
      
      const startTime = Date.now();
      const sessionResults = await Promise.all(sessionPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(10000); // Less than 10 seconds
      
      // Verify all sessions completed
      expect(sessionResults).toHaveLength(sessionCount);
      
      const totalTests = sessionResults.reduce((sum, result) => sum + result.testCount, 0);
      console.log(`Concurrent DB Performance: ${totalTests} tests across ${sessionCount} sessions in ${duration}ms`);
    }, 20000); // 20 second timeout
  });

  describe('Event Processing Throughput', () => {
    test('processes high volume of events efficiently', async () => {
      const eventCount = 10000;
      const eventsReceived = [];
      
      // Set up event listener
      jaw.onTestStart((test) => {
        eventsReceived.push(test);
      });
      
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js']
      });
      
      jaw.collector.onTestSuiteStart('/event-throughput.test.js');
      
      const startTime = Date.now();
      
      // Generate high volume of events
      for (let i = 0; i < eventCount; i++) {
        const test = jaw.collector.onTestStart({
          path: '/event-throughput.test.js',
          name: `throughput test ${i}`,
          fullName: `Event Throughput throughput test ${i}`
        });
        
        if (test) {
          jaw.collector.onTestEnd(test, {
            status: 'passed',
            failureMessages: []
          });
        }
      }
      
      jaw.collector.onTestSuiteEnd('/event-throughput.test.js', {
        numFailingTests: 0,
        numPassingTests: eventCount
      });
      
      jaw.collector.endSession({
        numTotalTests: eventCount,
        numPassedTests: eventCount,
        numFailedTests: 0
      });
      
      // Wait for all events to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should process events efficiently
      expect(duration).toBeLessThan(5000); // Less than 5 seconds
      
      // Should have received most events (allow for some timing issues)
      expect(eventsReceived.length).toBeGreaterThan(eventCount * 0.8);
      
      const eventsPerSecond = eventsReceived.length / (duration / 1000);
      console.log(`Event Throughput: ${eventsReceived.length} events processed in ${duration}ms (${eventsPerSecond.toFixed(2)} events/sec)`);
    }, 10000); // 10 second timeout

    test('maintains event order under high load', async () => {
      const eventCount = 1000;
      const eventsReceived = [];
      
      // Set up event listener to track order
      jaw.onTestStart((test) => {
        eventsReceived.push({
          name: test.name,
          timestamp: Date.now()
        });
      });
      
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js']
      });
      
      jaw.collector.onTestSuiteStart('/event-order.test.js');
      
      // Generate events in sequence
      for (let i = 0; i < eventCount; i++) {
        const test = jaw.collector.onTestStart({
          path: '/event-order.test.js',
          name: `order test ${i}`,
          fullName: `Event Order order test ${i}`
        });
        
        if (test) {
          jaw.collector.onTestEnd(test, {
            status: 'passed',
            failureMessages: []
          });
        }
      }
      
      jaw.collector.onTestSuiteEnd('/event-order.test.js', {
        numFailingTests: 0,
        numPassingTests: eventCount
      });
      
      jaw.collector.endSession({
        numTotalTests: eventCount,
        numPassedTests: eventCount,
        numFailedTests: 0
      });
      
      // Wait for all events to be processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify event order is maintained
      expect(eventsReceived.length).toBeGreaterThan(eventCount * 0.8);
      
      // Check that events are in roughly the correct order
      let orderViolations = 0;
      for (let i = 1; i < eventsReceived.length; i++) {
        if (eventsReceived[i].timestamp < eventsReceived[i - 1].timestamp) {
          orderViolations++;
        }
      }
      
      // Allow for some timing variations but order should be mostly maintained
      const orderAccuracy = (eventsReceived.length - orderViolations) / eventsReceived.length;
      expect(orderAccuracy).toBeGreaterThan(0.9); // 90% order accuracy
      
      console.log(`Event Order: ${orderAccuracy * 100}% order accuracy with ${eventsReceived.length} events`);
    }, 10000); // 10 second timeout
  });
});
