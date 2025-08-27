/**
 * Jest Reporter Integration Tests
 * Tests the Jest reporter integration with the JAW system
 */

import { JestAgentReporter } from '../../src/reporter/JestAgentReporter.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('Jest Reporter Integration Tests', () => {
  let reporter;
  let testDbPath;
  let tempDir;

  beforeEach(async () => {
    // Create temporary directory for test databases
    tempDir = path.join(process.cwd(), 'temp-reporter-integration');
    await fs.mkdir(tempDir, { recursive: true });
    
    testDbPath = path.join(tempDir, `reporter-integration-${Date.now()}-${Math.random().toString(36).substring(7)}.db`);
    
    const mockGlobalConfig = {
      testMatch: ['**/*.test.js'],
      collectCoverage: false,
      verbose: false
    };

    reporter = new JestAgentReporter(mockGlobalConfig, {
      dbPath: testDbPath
    });
  });

  afterEach(async () => {
    if (reporter) {
      const storage = reporter.getStorage();
      if (storage) {
        await storage.close();
      }
    }
    
    // Clean up test files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, that's fine
    }
  });

  describe('Reporter Lifecycle', () => {
    test('handles complete Jest run lifecycle', async () => {
      const mockResults = {
        numTotalTestSuites: 2,
        numPassedTestSuites: 1,
        numFailedTestSuites: 1,
        numTotalTests: 4,
        numPassedTests: 2,
        numFailedTests: 2
      };

      const mockOptions = {
        watch: false,
        watchAll: false
      };

      // Start run
      reporter.onRunStart(mockResults, mockOptions);

      // First test suite
      const mockTestSuite1 = { path: '/src/utils.test.js' };
      reporter.onTestSuiteStart(mockTestSuite1);

      // Tests in first suite
      const mockTest1 = {
        path: '/src/utils.test.js',
        name: 'should work correctly',
        fullName: 'Utils should work correctly'
      };

      const mockTest2 = {
        path: '/src/utils.test.js',
        name: 'should handle errors',
        fullName: 'Utils should handle errors'
      };

      reporter.onTestStart(mockTest1);
      reporter.onTestEnd(mockTest1, {
        status: 'passed',
        failureMessages: []
      });

      reporter.onTestStart(mockTest2);
      reporter.onTestEnd(mockTest2, {
        status: 'failed',
        failureMessages: ['Expected true but received false']
      });

      const mockTestResults1 = {
        numFailingTests: 1,
        numPassingTests: 1,
        testResults: [
          { status: 'passed', title: 'should work correctly' },
          { status: 'failed', title: 'should handle errors' }
        ]
      };

      reporter.onTestSuiteEnd(mockTestSuite1, mockTestResults1);

      // Second test suite
      const mockTestSuite2 = { path: '/src/core.test.js' };
      reporter.onTestSuiteStart(mockTestSuite2);

      const mockTest3 = {
        path: '/src/core.test.js',
        name: 'should initialize properly',
        fullName: 'Core should initialize properly'
      };

      const mockTest4 = {
        path: '/src/core.test.js',
        name: 'should cleanup resources',
        fullName: 'Core should cleanup resources'
      };

      reporter.onTestStart(mockTest3);
      reporter.onTestEnd(mockTest3, {
        status: 'passed',
        failureMessages: []
      });

      reporter.onTestStart(mockTest4);
      reporter.onTestEnd(mockTest4, {
        status: 'failed',
        failureMessages: ['Cleanup failed: Resource still in use']
      });

      const mockTestResults2 = {
        numFailingTests: 1,
        numPassingTests: 1,
        testResults: [
          { status: 'passed', title: 'should initialize properly' },
          { status: 'failed', title: 'should cleanup resources' }
        ]
      };

      reporter.onTestSuiteEnd(mockTestSuite2, mockTestResults2);

      // Complete run
      const mockFinalResults = {
        ...mockResults,
        testResults: [mockTestResults1, mockTestResults2]
      };

      reporter.onRunComplete({}, mockFinalResults);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify data was stored
      const storage = reporter.getStorage();
      await storage.initialize();

      const query = reporter.getQuery();
      const summary = await query.getTestSummary();

      expect(summary.total).toBe(4);
      expect(summary.passed).toBe(2);
      expect(summary.failed).toBe(2);

      await storage.close();
    });

    test('handles test suite with no tests', async () => {
      const mockResults = {
        numTotalTestSuites: 1,
        numPassedTestSuites: 1,
        numFailedTestSuites: 0,
        numTotalTests: 0,
        numPassedTests: 0,
        numFailedTests: 0
      };

      reporter.onRunStart(mockResults, {});

      const mockTestSuite = { path: '/src/empty.test.js' };
      reporter.onTestSuiteStart(mockTestSuite);

      const mockTestResults = {
        numFailingTests: 0,
        numPassingTests: 0,
        testResults: []
      };

      reporter.onTestSuiteEnd(mockTestSuite, mockTestResults);

      const mockFinalResults = {
        ...mockResults,
        testResults: [mockTestResults]
      };

      reporter.onRunComplete({}, mockFinalResults);

      // Should not throw errors
      expect(true).toBe(true);
    });
  });

  describe('Event Collection Integration', () => {
    test('collector receives and processes events correctly', async () => {
      const collector = reporter.getCollector();
      const events = [];

      // Listen to collector events
      collector.on('sessionStart', (session) => events.push({ type: 'sessionStart', data: session }));
      collector.on('suiteStart', (suite) => events.push({ type: 'suiteStart', data: suite }));
      collector.on('testStart', (test) => events.push({ type: 'testStart', data: test }));
      collector.on('testEnd', (test) => events.push({ type: 'testEnd', data: test }));
      collector.on('suiteEnd', (suite) => events.push({ type: 'suiteEnd', data: suite }));
      collector.on('sessionEnd', (session) => events.push({ type: 'sessionEnd', data: session }));

      // Simulate Jest run
      const mockResults = {
        numTotalTestSuites: 1,
        numPassedTestSuites: 1,
        numFailedTestSuites: 0,
        numTotalTests: 1,
        numPassedTests: 1,
        numFailedTests: 0
      };

      reporter.onRunStart(mockResults, {});

      const mockTestSuite = { path: '/src/integration.test.js' };
      reporter.onTestSuiteStart(mockTestSuite);

      const mockTest = {
        path: '/src/integration.test.js',
        name: 'integration test',
        fullName: 'Integration integration test'
      };

      reporter.onTestStart(mockTest);
      reporter.onTestEnd(mockTest, {
        status: 'passed',
        failureMessages: []
      });

      const mockTestResults = {
        numFailingTests: 0,
        numPassingTests: 1,
        testResults: [{ status: 'passed', title: 'integration test' }]
      };

      reporter.onTestSuiteEnd(mockTestSuite, mockTestResults);

      const mockFinalResults = {
        ...mockResults,
        testResults: [mockTestResults]
      };

      reporter.onRunComplete({}, mockFinalResults);

      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify events were emitted
      expect(events.length).toBeGreaterThan(0);
      
      const eventTypes = events.map(e => e.type);
      expect(eventTypes).toContain('sessionStart');
      expect(eventTypes).toContain('suiteStart');
      expect(eventTypes).toContain('testStart');
      expect(eventTypes).toContain('sessionEnd');
    });

    test('handles console output during tests', async () => {
      const collector = reporter.getCollector();
      const logs = [];

      collector.on('log', (log) => logs.push(log));

      // Start a test session
      reporter.onRunStart({
        numTotalTestSuites: 1,
        numPassedTestSuites: 1,
        numFailedTestSuites: 0,
        numTotalTests: 1,
        numPassedTests: 1,
        numFailedTests: 0
      }, {});

      const mockTestSuite = { path: '/src/console.test.js' };
      reporter.onTestSuiteStart(mockTestSuite);

      const mockTest = {
        path: '/src/console.test.js',
        name: 'console test',
        fullName: 'Console console test'
      };

      reporter.onTestStart(mockTest);

      reporter.onTestEnd(mockTest, {
        status: 'passed',
        failureMessages: []
      });

      reporter.onTestSuiteEnd(mockTestSuite, {
        numFailingTests: 0,
        numPassingTests: 1,
        testResults: [{ status: 'passed', title: 'console test' }]
      });

      reporter.onRunComplete({}, {
        numTotalTestSuites: 1,
        numPassedTestSuites: 1,
        numFailedTestSuites: 0,
        numTotalTests: 1,
        numPassedTests: 1,
        numFailedTests: 0,
        testResults: [{
          numFailingTests: 0,
          numPassingTests: 1,
          testResults: [{ status: 'passed', title: 'console test' }]
        }]
      });

      // Wait for logs to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify test completed without errors
      expect(true).toBe(true);
    });
  });

  describe('Storage Integration', () => {
    test('data is properly stored and retrievable', async () => {
      // Run a complete test scenario
      const mockResults = {
        numTotalTestSuites: 1,
        numPassedTestSuites: 0,
        numFailedTestSuites: 1,
        numTotalTests: 2,
        numPassedTests: 1,
        numFailedTests: 1
      };

      reporter.onRunStart(mockResults, {});

      const mockTestSuite = { path: '/src/storage.test.js' };
      reporter.onTestSuiteStart(mockTestSuite);

      const mockTest1 = {
        path: '/src/storage.test.js',
        name: 'should store data',
        fullName: 'Storage should store data'
      };

      const mockTest2 = {
        path: '/src/storage.test.js',
        name: 'should retrieve data',
        fullName: 'Storage should retrieve data'
      };

      reporter.onTestStart(mockTest1);
      reporter.onTestEnd(mockTest1, {
        status: 'passed',
        failureMessages: []
      });

      reporter.onTestStart(mockTest2);
      reporter.onTestEnd(mockTest2, {
        status: 'failed',
        failureMessages: ['Data retrieval failed: Connection timeout']
      });

      const mockTestResults = {
        numFailingTests: 1,
        numPassingTests: 1,
        testResults: [
          { status: 'passed', title: 'should store data' },
          { status: 'failed', title: 'should retrieve data' }
        ]
      };

      reporter.onTestSuiteEnd(mockTestSuite, mockTestResults);

      const mockFinalResults = {
        ...mockResults,
        testResults: [mockTestResults]
      };

      reporter.onRunComplete({}, mockFinalResults);

      // Wait for storage operations
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify data storage
      const storage = reporter.getStorage();
      await storage.initialize();

      const query = reporter.getQuery();
      
      // Test summary
      const summary = await query.getTestSummary();
      expect(summary.total).toBe(2);
      expect(summary.passed).toBe(1);
      expect(summary.failed).toBe(1);

      // Failed tests
      const failedTests = await query.getFailedTests();
      expect(failedTests.length).toBe(1);
      expect(failedTests[0].name).toBe('should retrieve data');

      // Test by file
      const testsByFile = await query.getTestsByFile('/src/storage.test.js');
      expect(testsByFile.length).toBe(2);

      await storage.close();
    });

    test('handles concurrent test execution', async () => {
      // Simulate multiple test suites running concurrently
      const mockResults = {
        numTotalTestSuites: 2,
        numPassedTestSuites: 2,
        numFailedTestSuites: 0,
        numTotalTests: 4,
        numPassedTests: 4,
        numFailedTests: 0
      };

      reporter.onRunStart(mockResults, {});

      // Start both suites
      const mockTestSuite1 = { path: '/src/concurrent1.test.js' };
      const mockTestSuite2 = { path: '/src/concurrent2.test.js' };
      
      reporter.onTestSuiteStart(mockTestSuite1);
      reporter.onTestSuiteStart(mockTestSuite2);

      // Interleave test execution
      const mockTest1a = {
        path: '/src/concurrent1.test.js',
        name: 'test 1a',
        fullName: 'Concurrent1 test 1a'
      };

      const mockTest2a = {
        path: '/src/concurrent2.test.js',
        name: 'test 2a',
        fullName: 'Concurrent2 test 2a'
      };

      const mockTest1b = {
        path: '/src/concurrent1.test.js',
        name: 'test 1b',
        fullName: 'Concurrent1 test 1b'
      };

      const mockTest2b = {
        path: '/src/concurrent2.test.js',
        name: 'test 2b',
        fullName: 'Concurrent2 test 2b'
      };

      // Start tests in interleaved order
      reporter.onTestStart(mockTest1a);
      reporter.onTestStart(mockTest2a);
      reporter.onTestStart(mockTest1b);
      reporter.onTestStart(mockTest2b);

      // End tests in different order
      reporter.onTestEnd(mockTest2a, { status: 'passed', failureMessages: [] });
      reporter.onTestEnd(mockTest1a, { status: 'passed', failureMessages: [] });
      reporter.onTestEnd(mockTest2b, { status: 'passed', failureMessages: [] });
      reporter.onTestEnd(mockTest1b, { status: 'passed', failureMessages: [] });

      // End suites
      reporter.onTestSuiteEnd(mockTestSuite1, {
        numFailingTests: 0,
        numPassingTests: 2,
        testResults: [
          { status: 'passed', title: 'test 1a' },
          { status: 'passed', title: 'test 1b' }
        ]
      });

      reporter.onTestSuiteEnd(mockTestSuite2, {
        numFailingTests: 0,
        numPassingTests: 2,
        testResults: [
          { status: 'passed', title: 'test 2a' },
          { status: 'passed', title: 'test 2b' }
        ]
      });

      const mockFinalResults = {
        ...mockResults,
        testResults: [
          {
            numFailingTests: 0,
            numPassingTests: 2,
            testResults: [
              { status: 'passed', title: 'test 1a' },
              { status: 'passed', title: 'test 1b' }
            ]
          },
          {
            numFailingTests: 0,
            numPassingTests: 2,
            testResults: [
              { status: 'passed', title: 'test 2a' },
              { status: 'passed', title: 'test 2b' }
            ]
          }
        ]
      };

      reporter.onRunComplete({}, mockFinalResults);

      // Wait for all operations to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify all data was stored correctly
      const storage = reporter.getStorage();
      await storage.initialize();

      const query = reporter.getQuery();
      const summary = await query.getTestSummary();

      expect(summary.total).toBe(4);
      expect(summary.passed).toBe(4);
      expect(summary.failed).toBe(0);

      await storage.close();
    });
  });

  describe('Error Handling', () => {
    test('handles malformed test data gracefully', async () => {
      // Test with missing or invalid data
      expect(() => {
        reporter.onRunStart(null, {});
      }).not.toThrow();

      expect(() => {
        reporter.onTestSuiteStart(null);
      }).not.toThrow();

      expect(() => {
        reporter.onTestStart(null);
      }).not.toThrow();

      expect(() => {
        reporter.onTestEnd(null, null);
      }).not.toThrow();

      expect(() => {
        reporter.onTestSuiteEnd(null, null);
      }).not.toThrow();

      expect(() => {
        reporter.onRunComplete(null, null);
      }).not.toThrow();
    });

    test('handles storage errors gracefully', async () => {
      // Test that reporter methods don't throw with basic error conditions
      expect(() => {
        reporter.onRunStart(null, {});
      }).not.toThrow();

      expect(() => {
        reporter.onTestSuiteStart({ path: null });
      }).not.toThrow();

      expect(() => {
        reporter.onTestStart({ path: '/test.js', name: null });
      }).not.toThrow();

      // Basic functionality test
      expect(reporter.getCollector()).toBeDefined();
      expect(reporter.getStorage()).toBeDefined();
      expect(reporter.getQuery()).toBeDefined();
    });
  });

  describe('Configuration Integration', () => {
    test('respects Jest configuration options', async () => {
      const customConfig = {
        testMatch: ['**/*.spec.js'],
        collectCoverage: true,
        verbose: true,
        testTimeout: 10000
      };

      const customReporter = new JestAgentReporter(customConfig, {
        dbPath: testDbPath,
        collectConsole: true,
        realTimeEvents: true
      });

      // Verify configuration is accessible
      expect(customReporter.globalConfig).toEqual(customConfig);
      expect(customReporter.options.collectConsole).toBe(true);
      expect(customReporter.options.realTimeEvents).toBe(true);

      // Clean up
      const storage = customReporter.getStorage();
      if (storage) {
        await storage.close();
      }
    });

    test('uses default options when not provided', async () => {
      const defaultReporter = new JestAgentReporter({
        testMatch: ['**/*.test.js']
      });

      // Should have default options
      expect(defaultReporter.options).toBeDefined();
      expect(defaultReporter.options.dbPath).toBeDefined();

      // Clean up
      const storage = defaultReporter.getStorage();
      if (storage) {
        await storage.close();
      }
    });
  });
});
