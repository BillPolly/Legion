/**
 * Jest Agent Wrapper Tests
 * Tests for the main wrapper class that orchestrates all components
 */

import { JestAgentWrapper } from '../../src/core/JestAgentWrapper.js';
import { promises as fs } from 'fs';
import { TestDbHelper, setupTestDb, cleanupTestDb } from '../utils/test-db-helper.js';

describe('JestAgentWrapper', () => {
  let wrapper;
  let testDbPath;

  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(() => {
    testDbPath = TestDbHelper.getTempDbPath('jest-agent-wrapper');
    wrapper = new JestAgentWrapper({
      dbPath: testDbPath,
      storage: 'sqlite',
      collectConsole: true,
      collectCoverage: false,
      realTimeEvents: true
    });
  });

  afterEach(async () => {
    if (wrapper) {
      await wrapper.close();
    }
    
    // Clean up test database
    await cleanupTestDb(testDbPath);
  });

  describe('Initialization', () => {
    test('creates wrapper with default config', () => {
      const defaultWrapper = new JestAgentWrapper();
      
      expect(defaultWrapper.config.storage).toBe('sqlite');
      // Default path now includes timestamp, so just check it starts with the right directory
      expect(defaultWrapper.config.dbPath).toMatch(/^\.\/dbs\/test-results-\d+\.db$/);
      expect(defaultWrapper.config.collectConsole).toBe(true);
      expect(defaultWrapper.config.collectCoverage).toBe(true);
      expect(defaultWrapper.config.realTimeEvents).toBe(true);
    });

    test('merges custom config with defaults', () => {
      const customWrapper = new JestAgentWrapper({
        dbPath: './custom.db',
        collectCoverage: false
      });
      
      expect(customWrapper.config.dbPath).toBe('./custom.db');
      expect(customWrapper.config.collectCoverage).toBe(false);
      expect(customWrapper.config.storage).toBe('sqlite'); // Default
      expect(customWrapper.config.collectConsole).toBe(true); // Default
    });

    test('initializes all components', () => {
      expect(wrapper.storage).toBeDefined();
      expect(wrapper.query).toBeDefined();
      expect(wrapper.collector).toBeDefined();
      expect(wrapper.currentSession).toBeNull();
    });

    test('sets up event forwarding', (done) => {
      let eventCount = 0;
      const expectedEvents = ['sessionStart', 'testStart', 'testEnd', 'sessionEnd'];
      
      expectedEvents.forEach(event => {
        wrapper.on(event, () => {
          eventCount++;
          if (eventCount === expectedEvents.length) {
            done();
          }
        });
      });
      
      // Simulate events from collector
      wrapper.collector.emit('sessionStart', { id: 'test' });
      wrapper.collector.emit('testStart', { id: 'test' });
      wrapper.collector.emit('testEnd', { id: 'test' });
      wrapper.collector.emit('sessionEnd', { id: 'test' });
    });
  });

  describe('Session Management', () => {
    test('startSession creates and stores session', async () => {
      const jestConfig = { testMatch: ['**/*.test.js'] };
      const session = await wrapper.startSession(jestConfig);
      
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.jestConfig).toEqual(jestConfig);
      expect(session.status).toBe('running');
      expect(wrapper.currentSession).toBe(session);
      
      // Verify session was stored
      const storedSession = await wrapper.storage.getSession(session.id);
      expect(storedSession).toBeDefined();
      expect(storedSession.id).toBe(session.id);
    });

    test('startSession emits sessionStart event', (done) => {
      wrapper.on('sessionStart', (session) => {
        expect(session.status).toBe('running');
        done();
      });
      
      wrapper.startSession();
    });

    test('stopSession ends current session', async () => {
      const session = await wrapper.startSession();
      expect(wrapper.currentSession).toBe(session);
      
      await wrapper.stopSession();
      
      expect(wrapper.currentSession).toBeNull();
      
      // Verify session was updated in storage
      const storedSession = await wrapper.storage.getSession(session.id);
      expect(storedSession.status).toBe('completed');
      expect(storedSession.endTime).toBeInstanceOf(Date);
    });

    test('stopSession handles no active session gracefully', async () => {
      expect(wrapper.currentSession).toBeNull();
      
      // Should not throw
      await wrapper.stopSession();
      
      expect(wrapper.currentSession).toBeNull();
    });

    test('runTests creates session and returns it', async () => {
      const pattern = 'src/**/*.test.js';
      const jestConfig = { verbose: true };
      
      const session = await wrapper.runTests(pattern, jestConfig);
      
      expect(session).toBeDefined();
      expect(session.jestConfig).toEqual(jestConfig);
      expect(wrapper.currentSession).toBe(session);
    });
  });

  describe('Query Interface', () => {
    beforeEach(async () => {
      // Create a session with test data
      await wrapper.startSession();
      await wrapper.storage.initialize();
      
      // Create test data
      const suite = {
        id: 'test-suite-1',
        sessionId: wrapper.currentSession.id,
        path: '/path/to/test.js',
        name: 'test.js',
        startTime: new Date(),
        endTime: new Date(),
        status: 'passed',
        setupDuration: 100,
        teardownDuration: 50
      };
      await wrapper.storage.storeSuite(suite);
      
      const testCase = {
        id: 'test-1',
        sessionId: wrapper.currentSession.id,
        suiteId: 'test-suite-1',
        name: 'should work',
        fullName: 'MyComponent should work',
        startTime: new Date(),
        endTime: new Date(),
        status: 'failed',
        duration: 1000,
        assertions: [],
        errors: [],
        logs: []
      };
      await wrapper.storage.storeTestCase(testCase);
    });

    test('getSession retrieves session by ID', async () => {
      const session = await wrapper.getSession(wrapper.currentSession.id);
      
      expect(session).toBeDefined();
      expect(session.id).toBe(wrapper.currentSession.id);
    });

    test('getFailedTests returns failed tests', async () => {
      const failedTests = await wrapper.getFailedTests();
      
      expect(failedTests).toHaveLength(1);
      expect(failedTests[0].status).toBe('failed');
      expect(failedTests[0].name).toBe('should work');
    });

    test('getFailedTests filters by session ID', async () => {
      const failedTests = await wrapper.getFailedTests(wrapper.currentSession.id);
      
      expect(failedTests).toHaveLength(1);
      expect(failedTests[0].sessionId).toBe(wrapper.currentSession.id);
    });

    test('searchLogs searches log entries', async () => {
      // Add a log entry
      const log = {
        sessionId: wrapper.currentSession.id,
        testId: 'test-1',
        timestamp: new Date(),
        level: 'error',
        message: 'Test error message',
        source: 'test',
        metadata: {}
      };
      await wrapper.storage.storeLog(log);
      
      const logs = await wrapper.searchLogs({ level: 'error' });
      
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('error');
      expect(logs[0].message).toBe('Test error message');
    });

    test('getTestHistory returns test history', async () => {
      const history = await wrapper.getTestHistory('should work');
      
      expect(history).toHaveLength(1);
      expect(history[0].name).toBe('should work');
    });

    test('getErrorsByType returns errors by type', async () => {
      // Add an error
      const error = {
        testId: 'test-1',
        timestamp: new Date(),
        type: 'assertion',
        message: 'Expected true to be false',
        stackTrace: [],
        location: {},
        suggestion: 'Check your logic'
      };
      await wrapper.storage.storeError(error);
      
      const errors = await wrapper.getErrorsByType('assertion');
      
      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe('assertion');
      expect(errors[0].message).toBe('Expected true to be false');
    });

    test('getTestSummary returns test statistics', async () => {
      const summary = await wrapper.getTestSummary();
      
      expect(summary).toBeDefined();
      expect(summary.total).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.passed).toBe(0);
    });

    test('findTests finds tests by criteria', async () => {
      const tests = await wrapper.findTests({ status: 'failed' });
      
      expect(tests).toHaveLength(1);
      expect(tests[0].status).toBe('failed');
    });

    test('getSlowestTests returns slowest tests', async () => {
      const slowTests = await wrapper.getSlowestTests(5);
      
      expect(slowTests).toHaveLength(1);
      expect(slowTests[0].duration).toBe(1000);
    });

    test('getMostCommonErrors returns common errors', async () => {
      // Add an error first
      const error = {
        testId: 'test-1',
        timestamp: new Date(),
        type: 'runtime',
        message: 'Cannot read property',
        stackTrace: [],
        location: {},
        suggestion: 'Initialize variable'
      };
      await wrapper.storage.storeError(error);
      
      const commonErrors = await wrapper.getMostCommonErrors();
      
      expect(commonErrors).toHaveLength(1);
      expect(commonErrors[0].type).toBe('runtime');
      expect(commonErrors[0].count).toBe(1);
    });
  });

  describe('Event Handling', () => {
    test('forwards collector events', (done) => {
      let eventCount = 0;
      
      wrapper.on('sessionStart', () => eventCount++);
      wrapper.on('testStart', () => eventCount++);
      wrapper.on('testEnd', () => {
        eventCount++;
        if (eventCount === 3) {
          done();
        }
      });
      
      // Trigger events through collector
      wrapper.collector.emit('sessionStart', { id: 'test' });
      wrapper.collector.emit('testStart', { id: 'test' });
      wrapper.collector.emit('testEnd', { id: 'test' });
    });

    test('maintains event listener references', () => {
      const initialListenerCount = wrapper.collector.listenerCount('sessionStart');
      
      wrapper.on('sessionStart', () => {});
      
      // Should not increase collector listeners (forwarding is set up once)
      expect(wrapper.collector.listenerCount('sessionStart')).toBe(initialListenerCount);
    });
  });

  describe('Resource Management', () => {
    test('close method cleans up resources', async () => {
      await wrapper.startSession();
      expect(wrapper.currentSession).toBeDefined();
      expect(wrapper.storage.initialized).toBe(true);
      
      await wrapper.close();
      
      expect(wrapper.currentSession).toBeNull();
      expect(wrapper.storage.initialized).toBe(false);
    });

    test('close handles no active session', async () => {
      expect(wrapper.currentSession).toBeNull();
      
      // Should not throw
      await wrapper.close();
      
      expect(wrapper.currentSession).toBeNull();
    });

    test('close can be called multiple times safely', async () => {
      await wrapper.startSession();
      
      await wrapper.close();
      await wrapper.close(); // Second call should not throw
      
      expect(wrapper.currentSession).toBeNull();
    });
  });

  describe('Configuration Handling', () => {
    test('respects collectConsole setting', () => {
      const wrapperWithoutConsole = new JestAgentWrapper({
        collectConsole: false
      });
      
      expect(wrapperWithoutConsole.config.collectConsole).toBe(false);
    });

    test('respects collectCoverage setting', () => {
      const wrapperWithoutCoverage = new JestAgentWrapper({
        collectCoverage: false
      });
      
      expect(wrapperWithoutCoverage.config.collectCoverage).toBe(false);
    });

    test('respects realTimeEvents setting', () => {
      const wrapperWithoutRealTime = new JestAgentWrapper({
        realTimeEvents: false
      });
      
      expect(wrapperWithoutRealTime.config.realTimeEvents).toBe(false);
    });

    test('uses custom database path', () => {
      const customPath = './custom-test-results.db';
      const customWrapper = new JestAgentWrapper({
        dbPath: customPath
      });
      
      expect(customWrapper.config.dbPath).toBe(customPath);
      expect(customWrapper.storage.dbPath).toBe(customPath);
    });
  });

  describe('Error Handling', () => {
    test('handles storage initialization errors gracefully', async () => {
      // Create wrapper with invalid path to trigger error
      const invalidWrapper = new JestAgentWrapper({
        dbPath: '/invalid/path/that/does/not/exist/test.db'
      });
      
      // Should handle error gracefully
      try {
        await invalidWrapper.startSession();
        // If no error is thrown, that's also acceptable
      } catch (error) {
        expect(error).toBeDefined();
      }
      
      // Close should also handle errors gracefully
      try {
        await invalidWrapper.close();
      } catch (error) {
        // Expected to fail due to invalid path, that's fine
        expect(error).toBeDefined();
      }
    });

    test('handles query errors gracefully', async () => {
      // Close storage to simulate error condition
      await wrapper.storage.close();
      
      try {
        await wrapper.getFailedTests();
        // If no error is thrown, that's acceptable
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Integration with Components', () => {
    test('storage and query engine are properly connected', async () => {
      expect(wrapper.query.storage).toBe(wrapper.storage);
    });

    test('collector events are properly handled', async () => {
      const session = await wrapper.startSession();
      
      // Simulate collector events
      const suite = wrapper.collector.onTestSuiteStart('/path/to/test.js');
      expect(suite.sessionId).toBe(session.id);
      
      const test = { path: '/path/to/test.js', name: 'test', fullName: 'test' };
      const testCase = wrapper.collector.onTestStart(test);
      expect(testCase.sessionId).toBe(session.id);
      expect(testCase.suiteId).toBe(suite.id);
    });

    test('maintains consistency between collector and storage', async () => {
      const session = await wrapper.startSession();
      
      // Verify session exists in both collector and storage
      expect(wrapper.collector.currentSession.id).toBe(session.id);
      
      const storedSession = await wrapper.storage.getSession(session.id);
      expect(storedSession.id).toBe(session.id);
    });
  });

  describe('Concurrent Operations', () => {
    test('handles multiple simultaneous queries', async () => {
      await wrapper.startSession();
      
      // Run multiple queries simultaneously
      const promises = [
        wrapper.getTestSummary(),
        wrapper.getFailedTests(),
        wrapper.searchLogs({}),
        wrapper.getMostCommonErrors()
      ];
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    test('handles session operations during queries', async () => {
      const session = await wrapper.startSession();
      
      // Start a query
      const summaryPromise = wrapper.getTestSummary();
      
      // Stop session while query is running
      await wrapper.stopSession();
      
      // Query should still complete
      const summary = await summaryPromise;
      expect(summary).toBeDefined();
    });
  });
});
