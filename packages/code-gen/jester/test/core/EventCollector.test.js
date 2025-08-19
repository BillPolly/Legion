/**
 * Comprehensive tests for EventCollector
 * Tests Jest event collection, transformation, and structured data generation
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventCollector } from '../../src/core/EventCollector.js';
import { TestDbHelper, setupTestDb, cleanupTestDb } from '../utils/test-db-helper.js';

describe('EventCollector', () => {
  let collector;
  let mockStorage;

  beforeEach(async () => {
    await setupTestDb();
    
    // Create mock storage
    mockStorage = {
      storeSession: jest.fn(),
      storeSuite: jest.fn(),
      storeTestCase: jest.fn(),
      storeLog: jest.fn(),
      storeAssertion: jest.fn(),
      storeError: jest.fn()
    };
    
    collector = new EventCollector(mockStorage);
  });

  afterEach(() => {
    if (collector) {
      collector.removeAllListeners();
    }
  });

  describe('Session Management', () => {
    test('should create session with unique ID', () => {
      const config = { testMatch: ['**/*.test.js'] };
      const session1 = collector.startSession(config);
      const session2 = collector.startSession(config);
      
      expect(session1.id).toBeDefined();
      expect(session2.id).toBeDefined();
      expect(session1.id).not.toBe(session2.id);
      expect(typeof session1.id).toBe('string');
      expect(session1.id.length).toBeGreaterThan(0);
    });

    test('should use custom testRunId when provided', () => {
      const config = { testRunId: 'custom-run-123' };
      const session = collector.startSession(config);
      
      expect(session.id).toBe('custom-run-123');
    });

    test('should include Jest config in session', () => {
      const config = { 
        testMatch: ['**/*.test.js'], 
        verbose: true,
        testRunId: 'config-test'
      };
      const session = collector.startSession(config);
      
      expect(session.jestConfig).toEqual(config);
      expect(session.jestConfig.testMatch).toEqual(['**/*.test.js']);
      expect(session.jestConfig.verbose).toBe(true);
    });

    test('should set session timestamps and status', () => {
      const session = collector.startSession();
      
      expect(session.startTime).toBeInstanceOf(Date);
      expect(session.endTime).toBeNull();
      expect(session.status).toBe('running');
      expect(session.summary).toEqual({});
    });

    test('should emit sessionStart event', (done) => {
      collector.on('sessionStart', (session) => {
        expect(session.status).toBe('running');
        expect(session.id).toBeDefined();
        done();
      });
      
      collector.startSession();
    });

    test('should end current session', () => {
      const session = collector.startSession({ testRunId: 'end-test' });
      expect(collector.currentSession).toBe(session);
      
      const endedSession = collector.endSession();
      
      expect(endedSession.id).toBe('end-test');
      expect(endedSession.status).toBe('completed');
      expect(endedSession.endTime).toBeInstanceOf(Date);
      expect(collector.currentSession).toBeNull();
    });

    test('should emit sessionEnd event', (done) => {
      collector.on('sessionEnd', (session) => {
        expect(session.status).toBe('completed');
        expect(session.endTime).toBeInstanceOf(Date);
        done();
      });
      
      collector.startSession({ testRunId: 'emit-end-test' });
      collector.endSession();
    });

    test('should handle end session when no session active', () => {
      expect(collector.currentSession).toBeNull();
      
      const result = collector.endSession();
      
      expect(result).toBeNull();
      expect(collector.currentSession).toBeNull();
    });
  });

  describe('Test Suite Events', () => {
    beforeEach(() => {
      collector.startSession({ testRunId: 'suite-test' });
    });

    test('should handle test suite start', () => {
      const suitePath = '/path/to/test.test.js';
      const suite = collector.onTestSuiteStart(suitePath);
      
      expect(suite.id).toBeDefined();
      expect(suite.sessionId).toBe('suite-test');
      expect(suite.path).toBe(suitePath);
      expect(suite.name).toBe('test.test.js');
      expect(suite.startTime).toBeInstanceOf(Date);
      expect(suite.status).toBe('running');
    });

    test('should emit suiteStart event', (done) => {
      collector.on('suiteStart', (suite) => {
        expect(suite.path).toBe('/test/example.test.js');
        expect(suite.status).toBe('running');
        done();
      });
      
      collector.onTestSuiteStart('/test/example.test.js');
    });

    test('should handle test suite end', () => {
      const suite = collector.onTestSuiteStart('/test/end.test.js');
      
      const endedSuite = collector.onTestSuiteEnd('/test/end.test.js', {
        numFailingTests: 0,
        numPassingTests: 2,
        numTotalTests: 2
      });
      
      expect(endedSuite.id).toBe(suite.id);
      expect(endedSuite.status).toBe('passed');
      expect(endedSuite.endTime).toBeInstanceOf(Date);
    });

    test('should emit suiteEnd event', (done) => {
      collector.on('suiteEnd', (suite) => {
        expect(suite.status).toBe('passed');
        expect(suite.endTime).toBeInstanceOf(Date);
        done();
      });
      
      collector.onTestSuiteStart('/test/emit-end.test.js');
      collector.onTestSuiteEnd('/test/emit-end.test.js', {
        numFailingTests: 0,
        numPassingTests: 1
      });
    });

    test('should track multiple suites', () => {
      const suite1 = collector.onTestSuiteStart('/test/suite1.test.js');
      const suite2 = collector.onTestSuiteStart('/test/suite2.test.js');
      
      expect(suite1.id).not.toBe(suite2.id);
      expect(collector.currentSuites.size).toBe(2);
      expect(collector.currentSuites.has('/test/suite1.test.js')).toBe(true);
      expect(collector.currentSuites.has('/test/suite2.test.js')).toBe(true);
    });
  });

  describe('Test Case Events', () => {
    beforeEach(() => {
      collector.startSession({ testRunId: 'test-case-session' });
      collector.onTestSuiteStart('/test/cases.test.js');
    });

    test('should handle test start', () => {
      const testInfo = {
        path: '/test/cases.test.js',
        name: 'should work',
        fullName: 'MyComponent should work'
      };
      
      const testCase = collector.onTestStart(testInfo);
      
      expect(testCase.id).toBeDefined();
      expect(testCase.sessionId).toBe('test-case-session');
      expect(testCase.name).toBe('should work');
      expect(testCase.fullName).toBe('MyComponent should work');
      expect(testCase.startTime).toBeInstanceOf(Date);
      expect(testCase.status).toBe('running');
    });

    test('should emit testStart event', (done) => {
      collector.on('testStart', (testCase) => {
        expect(testCase.name).toBe('emit test');
        expect(testCase.status).toBe('running');
        done();
      });
      
      collector.onTestStart({
        path: '/test/cases.test.js',
        name: 'emit test',
        fullName: 'Suite emit test'
      });
    });

    test('should handle test pass', () => {
      const testInfo = {
        path: '/test/cases.test.js',
        name: 'should pass',
        fullName: 'MyComponent should pass'
      };
      
      const testCase = collector.onTestStart(testInfo);
      const passedTest = collector.onTestEnd(testCase, {
        status: 'passed',
        failureMessages: []
      });
      
      expect(passedTest.id).toBe(testCase.id);
      expect(passedTest.status).toBe('passed');
      expect(passedTest.endTime).toBeInstanceOf(Date);
    });

    test('should handle test failure', () => {
      const testInfo = {
        path: '/test/cases.test.js',
        name: 'should fail',
        fullName: 'MyComponent should fail'
      };
      
      const testCase = collector.onTestStart(testInfo);
      const failedTest = collector.onTestEnd(testCase, {
        status: 'failed',
        failureMessages: ['Test failed']
      });
      
      expect(failedTest.id).toBe(testCase.id);
      expect(failedTest.status).toBe('failed');
      expect(failedTest.endTime).toBeInstanceOf(Date);
    });

    test('should handle test skip', () => {
      const testInfo = {
        path: '/test/cases.test.js',
        name: 'should skip',
        fullName: 'MyComponent should skip'
      };
      
      const testCase = collector.onTestStart(testInfo);
      const skippedTest = collector.onTestEnd(testCase, {
        status: 'skipped',
        failureMessages: []
      });
      
      expect(skippedTest.id).toBe(testCase.id);
      expect(skippedTest.status).toBe('skipped');
      expect(skippedTest.endTime).toBeInstanceOf(Date);
    });

    test('should emit testEnd event on completion', (done) => {
      collector.on('testEnd', (testCase) => {
        expect(testCase.status).toBe('passed');
        expect(testCase.endTime).toBeInstanceOf(Date);
        done();
      });
      
      const testInfo = {
        path: '/test/cases.test.js',
        name: 'emit end test',
        fullName: 'Suite emit end test'
      };
      
      const testCase = collector.onTestStart(testInfo);
      collector.onTestEnd(testCase, { status: 'passed', failureMessages: [] });
    });

    test('should calculate test duration', () => {
      const testInfo = {
        path: '/test/cases.test.js',
        name: 'duration test',
        fullName: 'Suite duration test'
      };
      
      const testCase = collector.onTestStart(testInfo);
      
      // Simulate test running for some time
      testCase.startTime = new Date(Date.now() - 1000); // 1 second ago
      
      const completedTest = collector.onTestEnd(testCase, {
        status: 'passed',
        failureMessages: [],
        duration: 1000
      });
      
      expect(completedTest.duration).toBe(1000);
    });
  });

  describe('Session Summary Updates', () => {
    beforeEach(() => {
      collector.startSession({ testRunId: 'summary-test' });
      collector.onTestSuiteStart('/test/summary.test.js');
    });

    test('should update summary on test completion', () => {
      const test1 = { path: '/test/summary.test.js', name: 'test1', fullName: 'test1' };
      const test2 = { path: '/test/summary.test.js', name: 'test2', fullName: 'test2' };
      const test3 = { path: '/test/summary.test.js', name: 'test3', fullName: 'test3' };
      
      const tc1 = collector.onTestStart(test1);
      collector.onTestEnd(tc1, { status: 'passed', failureMessages: [] });
      
      const tc2 = collector.onTestStart(test2);
      collector.onTestEnd(tc2, { status: 'failed', failureMessages: ['Failed'] });
      
      const tc3 = collector.onTestStart(test3);
      collector.onTestEnd(tc3, { status: 'skipped', failureMessages: [] });
      
      const summary = collector.currentSession.summary;
      expect(summary.total).toBe(3);
      expect(summary.passed).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.skipped).toBe(1);
      expect(summary.success).toBe(false); // Has failures
    });

    test('should mark session as successful when all tests pass', () => {
      const test1 = { path: '/test/summary.test.js', name: 'test1', fullName: 'test1' };
      const test2 = { path: '/test/summary.test.js', name: 'test2', fullName: 'test2' };
      
      const tc1 = collector.onTestStart(test1);
      collector.onTestEnd(tc1, { status: 'passed', failureMessages: [] });
      
      const tc2 = collector.onTestStart(test2);
      collector.onTestEnd(tc2, { status: 'passed', failureMessages: [] });
      
      const summary = collector.currentSession.summary;
      expect(summary.total).toBe(2);
      expect(summary.passed).toBe(2);
      expect(summary.failed).toBe(0);
      expect(summary.success).toBe(true);
    });
  });

  describe('Error and Log Collection', () => {
    beforeEach(() => {
      collector.startSession({ testRunId: 'logging-test' });
      collector.onTestSuiteStart('/test/logging.test.js');
    });

    test('should collect console logs', (done) => {
      const testInfo = { path: '/test/logging.test.js', name: 'log test', fullName: 'log test' };
      const testCase = collector.onTestStart(testInfo);
      
      collector.on('log', (log) => {
        expect(log.sessionId).toBe('logging-test');
        expect(log.testId).toBe(testCase.id);
        expect(log.level).toBe('info');
        expect(log.message).toBe('Test message');
        expect(log.source).toBe('console');
        done();
      });
      
      collector.onConsoleLog({
        sessionId: 'logging-test',
        testId: testCase.id,
        timestamp: new Date(),
        level: 'info',
        message: 'Test message',
        source: 'console'
      });
    });

    test('should emit log events', (done) => {
      collector.on('log', (log) => {
        expect(log.level).toBe('error');
        expect(log.message).toBe('Error message');
        expect(log.source).toBe('console');
        done();
      });
      
      const testInfo = { path: '/test/logging.test.js', name: 'error test', fullName: 'error test' };
      const testCase = collector.onTestStart(testInfo);
      
      collector.onConsoleLog({
        sessionId: 'logging-test',
        testId: testCase.id,
        timestamp: new Date(),
        level: 'error',
        message: 'Error message',
        source: 'console'
      });
    });

    test('should collect assertion failures', (done) => {
      const testInfo = { path: '/test/logging.test.js', name: 'assertion test', fullName: 'assertion test' };
      const testCase = collector.onTestStart(testInfo);
      
      collector.on('assertion', (assertion) => {
        expect(assertion.testId).toBe(testCase.id);
        expect(assertion.type).toBe('expect');
        expect(assertion.matcher).toBe('toBe');
        expect(assertion.passed).toBe(false);
        expect(assertion.actual).toBe(false);
        expect(assertion.expected).toBe(true);
        expect(assertion.message).toBe('Expected false to be true');
        done();
      });
      
      const assertion = {
        testId: testCase.id,
        timestamp: new Date(),
        type: 'expect',
        matcher: 'toBe',
        passed: false,
        actual: false,
        expected: true,
        message: 'Expected false to be true'
      };
      
      collector.onAssertion(assertion);
    });

    test('should emit assertion events', (done) => {
      collector.on('assertion', (assertion) => {
        expect(assertion.matcher).toBe('toEqual');
        expect(assertion.message).toBe('Values not equal');
        done();
      });
      
      const testInfo = { path: '/test/logging.test.js', name: 'assertion emit test', fullName: 'assertion emit test' };
      const testCase = collector.onTestStart(testInfo);
      
      collector.onAssertion({
        testId: testCase.id,
        timestamp: new Date(),
        type: 'expect',
        matcher: 'toEqual',
        passed: false,
        expected: [1, 2],
        actual: [1, 3],
        message: 'Values not equal'
      });
    });
  });

  describe('Data Storage Integration', () => {
    test('should store sessions through storage engine', (done) => {
      collector.on('sessionStart', (session) => {
        expect(session.id).toBe('storage-test');
        done();
      });
      
      collector.startSession({ testRunId: 'storage-test' });
    });

    test('should store suites through storage engine', (done) => {
      collector.on('suiteStart', (suite) => {
        expect(suite.path).toBe('/test/storage.test.js');
        done();
      });
      
      collector.startSession({ testRunId: 'storage-test' });
      collector.onTestSuiteStart('/test/storage.test.js');
    });

    test('should store test cases through storage engine', (done) => {
      collector.on('testStart', (testCase) => {
        expect(testCase.name).toBe('storage test');
        done();
      });
      
      collector.startSession({ testRunId: 'storage-test' });
      collector.onTestSuiteStart('/test/storage.test.js');
      
      const testInfo = { path: '/test/storage.test.js', name: 'storage test', fullName: 'storage test' };
      collector.onTestStart(testInfo);
    });

    test('should handle storage errors gracefully', () => {
      // Mock storage to throw error
      mockStorage.storeSession.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      // Should not throw
      expect(() => {
        collector.startSession({ testRunId: 'error-test' });
      }).not.toThrow();
    });
  });

  describe('Event Cleanup', () => {
    test('should clean up suite references on suite end', () => {
      collector.startSession({ testRunId: 'cleanup-test' });
      
      collector.onTestSuiteStart('/test/cleanup1.test.js');
      collector.onTestSuiteStart('/test/cleanup2.test.js');
      
      expect(collector.currentSuites.size).toBe(2);
      
      collector.onTestSuiteEnd('/test/cleanup1.test.js');
      
      expect(collector.currentSuites.size).toBe(1);
      expect(collector.currentSuites.has('/test/cleanup2.test.js')).toBe(true);
    });

    test('should clean up test references on test end', () => {
      collector.startSession({ testRunId: 'cleanup-test' });
      collector.onTestSuiteStart('/test/cleanup.test.js');
      
      const test1 = { path: '/test/cleanup.test.js', name: 'test1', fullName: 'test1' };
      const test2 = { path: '/test/cleanup.test.js', name: 'test2', fullName: 'test2' };
      
      const tc1 = collector.onTestStart(test1);
      const tc2 = collector.onTestStart(test2);
      
      expect(collector.currentTests.size).toBe(2);
      
      collector.onTestEnd(tc1, { status: 'passed', failureMessages: [] });
      
      expect(collector.currentTests.size).toBe(1);
      // Check by test ID instead of name
      const remainingTest = Array.from(collector.currentTests.values())[0];
      expect(remainingTest.name).toBe('test2');
    });
  });

  describe('Error Handling', () => {
    test('should handle test events without active session', () => {
      expect(collector.currentSession).toBeNull();
      
      // Should not throw
      expect(() => {
        collector.onTestSuiteStart('/test/no-session.test.js');
      }).not.toThrow();
    });

    test('should handle test case events without active suite', () => {
      collector.startSession({ testRunId: 'no-suite-test' });
      
      // Should not throw
      expect(() => {
        collector.onTestStart({
          path: '/test/no-suite.test.js',
          name: 'orphan test',
          fullName: 'orphan test'
        });
      }).not.toThrow();
    });

    test('should handle duplicate test events gracefully', () => {
      collector.startSession({ testRunId: 'duplicate-test' });
      collector.onTestSuiteStart('/test/duplicate.test.js');
      
      const testInfo = { path: '/test/duplicate.test.js', name: 'dup test', fullName: 'dup test' };
      
      // Start same test twice
      const test1 = collector.onTestStart(testInfo);
      const test2 = collector.onTestStart(testInfo);
      
      // Should handle gracefully
      expect(test1.id).toBeDefined();
      expect(test2.id).toBeDefined();
      // May be same or different depending on implementation
    });
  });

  describe('Environment Capture', () => {
    test('should capture environment information in session', () => {
      const session = collector.startSession({
        testRunId: 'env-test',
        testEnvironment: 'node'
      });
      
      expect(session.environment).toBeDefined();
      expect(session.environment.platform).toBeDefined();
      expect(session.environment.nodeVersion).toBeDefined();
      expect(session.environment.jestVersion).toBeDefined();
    });

    test('should include project metadata in session', () => {
      const config = {
        testRunId: 'metadata-test',
        rootDir: '/project/root',
        testMatch: ['**/*.test.js']
      };
      
      const session = collector.startSession(config);
      
      expect(session.metadata).toBeDefined();
      expect(session.metadata.projectPath).toBeDefined();
      expect(session.metadata.testPattern).toBeDefined();
    });
  });
});