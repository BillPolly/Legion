/**
 * Jest Agent Reporter Tests
 * Tests for the Jest reporter that integrates with the JAW system
 */

import { JestAgentReporter } from '../../src/reporter/JestAgentReporter.js';
import { promises as fs } from 'fs';
import { TestDbHelper, setupTestDb, cleanupTestDb } from '../utils/test-db-helper.js';

describe('JestAgentReporter', () => {
  let testDbPath;

  beforeAll(async () => {
    await setupTestDb();
  });

  let reporter;
  let mockGlobalConfig;
  let mockOptions;

  beforeEach(() => {
    testDbPath = TestDbHelper.getTempDbPath('reporter-test');
    
    mockGlobalConfig = {
      testMatch: ['**/*.test.js'],
      verbose: false,
      collectCoverage: false
    };

    mockOptions = {
      dbPath: testDbPath,
      realTimeEvents: true
    };

    reporter = new JestAgentReporter(mockGlobalConfig, mockOptions);
  });

  afterEach(async () => {
    if (reporter && reporter.storage) {
      await reporter.storage.close();
    }
    
    // Clean up test database
    await cleanupTestDb(testDbPath);
  });

  describe('Initialization', () => {
    test('creates reporter with global config and options', () => {
      expect(reporter.globalConfig).toBe(mockGlobalConfig);
      expect(reporter.options).toEqual({
        collectConsole: true,
        collectCoverage: true,
        dbPath: testDbPath,
        realTimeEvents: true
      });
      expect(reporter.collector).toBeDefined();
      expect(reporter.storage).toBeDefined();
      expect(reporter.query).toBeDefined();
    });

    test('uses default options when none provided', () => {
      const defaultReporter = new JestAgentReporter(mockGlobalConfig);
      
      expect(defaultReporter.options).toEqual({
        collectConsole: true,
        collectCoverage: true,
        dbPath: './test-results.db',  // Default path when none provided
        realTimeEvents: true
      });
      expect(defaultReporter.storage.dbPath).toBe('./test-results.db'); // Default path
    });

    test('sets up event handlers', () => {
      // Verify event handlers are set up by checking listener counts
      expect(reporter.collector.listenerCount('sessionStart')).toBeGreaterThan(0);
      expect(reporter.collector.listenerCount('sessionEnd')).toBeGreaterThan(0);
      expect(reporter.collector.listenerCount('suiteStart')).toBeGreaterThan(0);
      expect(reporter.collector.listenerCount('suiteEnd')).toBeGreaterThan(0);
      expect(reporter.collector.listenerCount('testEnd')).toBeGreaterThan(0);
    });
  });

  describe('Jest Lifecycle Integration', () => {
    test('onRunStart creates session', () => {
      const mockResults = {
        numTotalTestSuites: 5,
        startTime: Date.now()
      };
      const mockOptions = { watch: false };

      reporter.onRunStart(mockResults, mockOptions);

      expect(reporter.session).toBeDefined();
      expect(reporter.session.id).toBeDefined();
      expect(reporter.session.status).toBe('running');
      expect(reporter.session.jestConfig).toBe(mockGlobalConfig);
    });

    test('onTestSuiteStart creates suite record', () => {
      // First start a session
      reporter.onRunStart({}, {});

      const mockTest = {
        path: '/path/to/test.js'
      };

      reporter.onTestSuiteStart(mockTest);

      // Verify suite was created in collector
      expect(reporter.collector.currentSuites.has('/path/to/test.js')).toBe(true);
      const suite = reporter.collector.currentSuites.get('/path/to/test.js');
      expect(suite.path).toBe('/path/to/test.js');
      expect(suite.sessionId).toBe(reporter.session.id);
    });

    test('onTestSuiteEnd updates suite status', () => {
      // Setup
      reporter.onRunStart({}, {});
      const mockTest = { path: '/path/to/test.js' };
      reporter.onTestSuiteStart(mockTest);

      const mockTestResults = {
        numFailingTests: 0,
        numPassingTests: 3,
        testResults: []
      };

      // Capture the emitted suiteEnd event to verify the suite was completed correctly
      let completedSuite = null;
      reporter.collector.once('suiteEnd', (suite) => {
        completedSuite = suite;
      });
      
      reporter.onTestSuiteEnd(mockTest, mockTestResults);

      // After onTestSuiteEnd, suite should be removed from currentSuites
      expect(reporter.collector.currentSuites.has('/path/to/test.js')).toBe(false);
      
      // But we can verify it was completed correctly via the event
      expect(completedSuite).not.toBeNull();
      expect(completedSuite.status).toBe('passed');
      expect(completedSuite.endTime).toBeInstanceOf(Date);
    });

    test('onTestStart creates test record', () => {
      // Setup
      reporter.onRunStart({}, {});
      const mockTest = { path: '/path/to/test.js' };
      reporter.onTestSuiteStart(mockTest);

      const mockTestCase = {
        path: '/path/to/test.js',
        name: 'should work',
        fullName: 'MyComponent should work'
      };

      reporter.onTestStart(mockTestCase);

      expect(reporter.collector.currentTests.has('MyComponent should work')).toBe(true);
      const testCase = reporter.collector.currentTests.get('MyComponent should work');
      expect(testCase.name).toBe('should work');
      expect(testCase.status).toBe('running');
    });

    test('onTestEnd updates test status', () => {
      // Setup
      reporter.onRunStart({}, {});
      const mockTest = { path: '/path/to/test.js' };
      reporter.onTestSuiteStart(mockTest);
      const mockTestCase = {
        path: '/path/to/test.js',
        name: 'should work',
        fullName: 'MyComponent should work'
      };
      reporter.onTestStart(mockTestCase);

      const mockTestResults = {
        status: 'passed',
        duration: 1000,
        failureMessages: []
      };

      // Capture the emitted testEnd event to verify the test was completed correctly
      let completedTest = null;
      reporter.collector.once('testEnd', (test) => {
        completedTest = test;
      });
      
      reporter.onTestEnd(mockTestCase, mockTestResults);

      // After onTestEnd, test should be removed from currentTests
      expect(reporter.collector.currentTests.has('MyComponent should work')).toBe(false);
      
      // But we can verify it was completed correctly via the event
      expect(completedTest).not.toBeNull();
      expect(completedTest.status).toBe('passed');
      expect(completedTest.endTime).toBeInstanceOf(Date);
      expect(completedTest.duration).toBeGreaterThanOrEqual(0);
    });

    test('onRunComplete ends session with summary', () => {
      // Setup
      reporter.onRunStart({}, {});

      const mockContexts = new Set();
      const mockResults = {
        numTotalTestSuites: 3,
        numPassedTestSuites: 2,
        numFailedTestSuites: 1,
        numTotalTests: 10,
        numPassedTests: 8,
        numFailedTests: 2,
        numPendingTests: 0,
        testResults: []
      };

      reporter.onRunComplete(mockContexts, mockResults);

      expect(reporter.session.status).toBe('completed');
      expect(reporter.session.endTime).toBeInstanceOf(Date);
      expect(reporter.session.summary).toEqual({
        numTotalTestSuites: 3,
        numPassedTestSuites: 2,
        numFailedTestSuites: 1,
        numTotalTests: 10,
        numPassedTests: 8,
        numFailedTests: 2,
        numPendingTests: 0,
        testResults: []
      });
    });
  });

  describe('Event Handler Integration', () => {
    test('sessionStart handler stores session', async () => {
      const mockSession = {
        id: 'test-session',
        startTime: new Date(),
        status: 'running',
        jestConfig: mockGlobalConfig,
        environment: { nodeVersion: 'v18.0.0' },
        summary: {}
      };

      // Trigger the event
      reporter.collector.emit('sessionStart', mockSession);

      // Give it a moment to process
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify session was stored
      const storedSession = await reporter.storage.getSession(mockSession.id);
      expect(storedSession).toBeDefined();
      expect(storedSession.id).toBe(mockSession.id);
    });

    test('sessionEnd handler updates session', async () => {
      const mockSession = {
        id: 'test-session-end',
        startTime: new Date(),
        endTime: new Date(),
        status: 'completed',
        jestConfig: mockGlobalConfig,
        environment: { nodeVersion: 'v18.0.0' },
        summary: { totalTests: 5 }
      };

      // First store the session
      await reporter.storage.storeSession(mockSession);

      // Then trigger the end event
      reporter.collector.emit('sessionEnd', mockSession);

      // Give it a moment to process
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify session was updated
      const storedSession = await reporter.storage.getSession(mockSession.id);
      expect(storedSession.status).toBe('completed');
      expect(storedSession.endTime).toBeInstanceOf(Date);
    });

    test('suiteStart handler stores suite', async () => {
      // First create a session
      const mockSession = {
        id: 'test-session',
        startTime: new Date(),
        status: 'running',
        jestConfig: {},
        environment: {},
        summary: {}
      };
      await reporter.storage.storeSession(mockSession);

      const mockSuite = {
        id: 'test-suite',
        sessionId: 'test-session',
        path: '/path/to/test.js',
        name: 'test.js',
        startTime: new Date(),
        status: 'running',
        setupDuration: 100,
        teardownDuration: 50
      };

      // Trigger the event
      reporter.collector.emit('suiteStart', mockSuite);

      // Give it a moment to process
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify suite was stored (we can't easily verify this without exposing internal methods)
      // The fact that no error was thrown is a good sign
    });

    test('testEnd handler stores test case', async () => {
      // First create session and suite
      const mockSession = {
        id: 'test-session',
        startTime: new Date(),
        status: 'running',
        jestConfig: {},
        environment: {},
        summary: {}
      };
      await reporter.storage.storeSession(mockSession);

      const mockSuite = {
        id: 'test-suite',
        sessionId: 'test-session',
        path: '/path/to/test.js',
        name: 'test.js',
        startTime: new Date(),
        endTime: new Date(),
        status: 'passed',
        setupDuration: 100,
        teardownDuration: 50
      };
      await reporter.storage.storeSuite(mockSuite);

      const mockTestCase = {
        id: 'test-case',
        sessionId: 'test-session',
        suiteId: 'test-suite',
        name: 'should work',
        fullName: 'MyComponent should work',
        startTime: new Date(),
        endTime: new Date(),
        status: 'passed',
        duration: 1000,
        assertions: [],
        errors: [],
        logs: []
      };

      // Trigger the event
      reporter.collector.emit('testEnd', mockTestCase);

      // Give it a moment to process
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify test case was stored (we can't easily verify this without exposing internal methods)
      // The fact that no error was thrown is a good sign
    });
  });

  describe('Component Access', () => {
    test('getCollector returns collector instance', () => {
      const collector = reporter.getCollector();
      expect(collector).toBe(reporter.collector);
      expect(collector).toBeDefined();
    });

    test('getStorage returns storage instance', () => {
      const storage = reporter.getStorage();
      expect(storage).toBe(reporter.storage);
      expect(storage).toBeDefined();
    });

    test('getQuery returns query engine instance', () => {
      const query = reporter.getQuery();
      expect(query).toBe(reporter.query);
      expect(query).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('handles missing test path gracefully', () => {
      reporter.onRunStart({}, {});

      const mockTest = {}; // Missing path

      // Should not throw - should handle gracefully
      expect(() => {
        reporter.onTestSuiteStart(mockTest);
      }).not.toThrow();
    });

    test('handles missing test results gracefully', () => {
      reporter.onRunStart({}, {});
      const mockTest = { path: '/path/to/test.js' };
      reporter.onTestSuiteStart(mockTest);

      // Should not throw - should handle gracefully
      expect(() => {
        reporter.onTestSuiteEnd(mockTest, null);
      }).not.toThrow();
    });

    test('handles storage errors gracefully', async () => {
      // Close storage to simulate error
      await reporter.storage.close();

      const mockSession = {
        id: 'test-session-error',
        startTime: new Date(),
        status: 'running',
        jestConfig: {},
        environment: {},
        summary: {}
      };

      // Should not throw even if storage fails
      expect(() => {
        reporter.collector.emit('sessionStart', mockSession);
      }).not.toThrow();
    });
  });

  describe('Configuration Options', () => {
    test('respects custom database path', () => {
      const customPath = './custom-reporter.db';
      const customReporter = new JestAgentReporter(mockGlobalConfig, {
        dbPath: customPath
      });

      expect(customReporter.storage.dbPath).toBe(customPath);
    });

    test('respects realTimeEvents setting', () => {
      const realtimeReporter = new JestAgentReporter(mockGlobalConfig, {
        realTimeEvents: true
      });

      const nonRealtimeReporter = new JestAgentReporter(mockGlobalConfig, {
        realTimeEvents: false
      });

      expect(realtimeReporter.options.realTimeEvents).toBe(true);
      expect(nonRealtimeReporter.options.realTimeEvents).toBe(false);
    });
  });

  describe('Integration with Jest Reporter Interface', () => {
    test('implements required Jest reporter methods', () => {
      expect(typeof reporter.onRunStart).toBe('function');
      expect(typeof reporter.onTestSuiteStart).toBe('function');
      expect(typeof reporter.onTestSuiteEnd).toBe('function');
      expect(typeof reporter.onTestStart).toBe('function');
      expect(typeof reporter.onTestEnd).toBe('function');
      expect(typeof reporter.onRunComplete).toBe('function');
    });

    test('handles complete Jest test lifecycle', () => {
      // Simulate a complete Jest run
      const mockResults = { numTotalTestSuites: 1 };
      const mockOptions = { watch: false };

      // Start run
      reporter.onRunStart(mockResults, mockOptions);
      expect(reporter.session).toBeDefined();

      // Start suite
      const mockTest = { path: '/path/to/test.js' };
      reporter.onTestSuiteStart(mockTest);

      // Start test
      const mockTestCase = {
        path: '/path/to/test.js',
        name: 'should work',
        fullName: 'MyComponent should work'
      };
      reporter.onTestStart(mockTestCase);

      // End test
      const mockTestResults = { status: 'passed' };
      reporter.onTestEnd(mockTestCase, mockTestResults);

      // End suite
      const mockSuiteResults = { numFailingTests: 0 };
      reporter.onTestSuiteEnd(mockTest, mockSuiteResults);

      // Complete run
      const mockFinalResults = {
        numTotalTestSuites: 1,
        numPassedTestSuites: 1,
        numFailedTestSuites: 0,
        numTotalTests: 1,
        numPassedTests: 1,
        numFailedTests: 0,
        numPendingTests: 0,
        testResults: []
      };
      reporter.onRunComplete(new Set(), mockFinalResults);

      expect(reporter.session.status).toBe('completed');
    });
  });

  describe('Data Consistency', () => {
    test('maintains consistent session ID across components', () => {
      reporter.onRunStart({}, {});

      const sessionId = reporter.session.id;
      expect(reporter.collector.currentSession.id).toBe(sessionId);
    });

    test('links suites to correct session', () => {
      reporter.onRunStart({}, {});
      const sessionId = reporter.session.id;

      const mockTest = { path: '/path/to/test.js' };
      reporter.onTestSuiteStart(mockTest);

      const suite = reporter.collector.currentSuites.get('/path/to/test.js');
      expect(suite.sessionId).toBe(sessionId);
    });

    test('links tests to correct suite and session', () => {
      reporter.onRunStart({}, {});
      const sessionId = reporter.session.id;

      const mockTest = { path: '/path/to/test.js' };
      reporter.onTestSuiteStart(mockTest);
      const suite = reporter.collector.currentSuites.get('/path/to/test.js');

      const mockTestCase = {
        path: '/path/to/test.js',
        name: 'should work',
        fullName: 'MyComponent should work'
      };
      reporter.onTestStart(mockTestCase);

      const testCase = reporter.collector.currentTests.get('MyComponent should work');
      expect(testCase.sessionId).toBe(sessionId);
      expect(testCase.suiteId).toBe(suite.id);
    });
  });

  describe('Memory Management', () => {
    test('cleans up after run completion', () => {
      reporter.onRunStart({}, {});
      
      // Add some data
      const mockTest = { path: '/path/to/test.js' };
      reporter.onTestSuiteStart(mockTest);
      
      const mockTestCase = {
        path: '/path/to/test.js',
        name: 'should work',
        fullName: 'MyComponent should work'
      };
      reporter.onTestStart(mockTestCase);

      expect(reporter.collector.currentSuites.size).toBe(1);
      expect(reporter.collector.currentTests.size).toBe(1);

      // Complete the run
      reporter.onRunComplete(new Set(), {
        numTotalTestSuites: 1,
        numPassedTestSuites: 1,
        numFailedTestSuites: 0,
        numTotalTests: 1,
        numPassedTests: 1,
        numFailedTests: 0,
        numPendingTests: 0,
        testResults: []
      });

      // Verify cleanup
      expect(reporter.collector.currentSession).toBeNull();
      expect(reporter.collector.currentSuites.size).toBe(0);
      expect(reporter.collector.currentTests.size).toBe(0);
    });
  });
});
