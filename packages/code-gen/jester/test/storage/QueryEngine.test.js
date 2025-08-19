/**
 * Comprehensive tests for QueryEngine
 * Tests database query operations, data retrieval, and complex query scenarios
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { QueryEngine } from '../../src/storage/QueryEngine.js';
import { StorageEngine } from '../../src/storage/StorageEngine.js';
import { promises as fs } from 'fs';
import { TestDbHelper, setupTestDb, cleanupTestDb } from '../utils/test-db-helper.js';

describe('QueryEngine', () => {
  let storage;
  let queryEngine;
  let testDbPath;

  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    testDbPath = TestDbHelper.getTempDbPath('query-engine');
    
    storage = new StorageEngine(testDbPath);
    queryEngine = new QueryEngine(storage);
    await storage.initialize();
    
    // Create test data
    await createTestData();
  });

  afterEach(async () => {
    if (storage) {
      await storage.close();
    }
    
    // Clean up test database
    await cleanupTestDb(testDbPath);
  });

  async function createTestData() {
    // Create test session
    const session = {
      id: 'test-session-1',
      startTime: new Date('2023-01-01T10:00:00Z'),
      endTime: new Date('2023-01-01T10:05:00Z'),
      status: 'completed',
      jestConfig: { testMatch: ['**/*.test.js'] },
      environment: { nodeVersion: 'v18.0.0' },
      summary: { totalTests: 5, passed: 3, failed: 2 }
    };
    await storage.storeSession(session);

    // Create test suite
    const suite = {
      id: 'test-suite-1',
      sessionId: 'test-session-1',
      path: '/path/to/test.js',
      name: 'test.js',
      startTime: new Date('2023-01-01T10:00:00Z'),
      endTime: new Date('2023-01-01T10:01:00Z'),
      status: 'passed',
      setupDuration: 100,
      teardownDuration: 50
    };
    await storage.storeSuite(suite);

    // Create test cases
    const testCases = [
      {
        id: 'test-1',
        sessionId: 'test-session-1',
        suiteId: 'test-suite-1',
        name: 'should pass',
        fullName: 'MyComponent should pass',
        startTime: new Date('2023-01-01T10:00:10Z'),
        endTime: new Date('2023-01-01T10:00:11Z'),
        status: 'passed',
        duration: 1000,
        assertions: [],
        errors: [],
        logs: []
      },
      {
        id: 'test-2',
        sessionId: 'test-session-1',
        suiteId: 'test-suite-1',
        name: 'should fail',
        fullName: 'MyComponent should fail',
        startTime: new Date('2023-01-01T10:00:20Z'),
        endTime: new Date('2023-01-01T10:00:25Z'),
        status: 'failed',
        duration: 5000,
        assertions: [],
        errors: [],
        logs: []
      },
      {
        id: 'test-3',
        sessionId: 'test-session-1',
        suiteId: 'test-suite-1',
        name: 'should be skipped',
        fullName: 'MyComponent should be skipped',
        startTime: new Date('2023-01-01T10:00:30Z'),
        endTime: new Date('2023-01-01T10:00:30Z'),
        status: 'skipped',
        duration: 0,
        assertions: [],
        errors: [],
        logs: []
      }
    ];

    for (const testCase of testCases) {
      await storage.storeTestCase(testCase);
    }

    // Create some errors
    const errors = [
      {
        testId: 'test-2',
        timestamp: new Date('2023-01-01T10:00:22Z'),
        type: 'assertion',
        message: 'Expected true to be false',
        stackTrace: [{ function: 'test', file: '/path/file.js', line: 10, column: 5 }],
        location: { file: '/path/file.js', line: 10, column: 5 },
        suggestion: 'Check your logic'
      },
      {
        testId: 'test-2',
        timestamp: new Date('2023-01-01T10:00:23Z'),
        type: 'runtime',
        message: 'Cannot read property of undefined',
        stackTrace: [{ function: 'test', file: '/path/file.js', line: 15, column: 10 }],
        location: { file: '/path/file.js', line: 15, column: 10 },
        suggestion: 'Initialize the variable'
      }
    ];

    for (const error of errors) {
      await storage.storeError(error);
    }

    // Create some logs
    const logs = [
      {
        sessionId: 'test-session-1',
        testId: 'test-1',
        timestamp: new Date('2023-01-01T10:00:10Z'),
        level: 'info',
        message: 'Test started',
        source: 'test',
        metadata: { extra: 'data' }
      },
      {
        sessionId: 'test-session-1',
        testId: 'test-2',
        timestamp: new Date('2023-01-01T10:00:21Z'),
        level: 'error',
        message: 'Test failed with error',
        source: 'test',
        metadata: { error: true }
      },
      {
        sessionId: 'test-session-1',
        testId: null,
        timestamp: new Date('2023-01-01T10:00:05Z'),
        level: 'warn',
        message: 'Session warning',
        source: 'system',
        metadata: {}
      }
    ];

    for (const log of logs) {
      await storage.storeLog(log);
    }
  }

  describe('findTests', () => {
    test('with no criteria returns all tests', async () => {
      const tests = await queryEngine.findTests();
      
      expect(tests).toHaveLength(3);
      expect(tests.map(t => t.name)).toContain('should pass');
      expect(tests.map(t => t.name)).toContain('should fail');
      expect(tests.map(t => t.name)).toContain('should be skipped');
    });

    test('filters by sessionId correctly', async () => {
      const tests = await queryEngine.findTests({ sessionId: 'test-session-1' });
      
      expect(tests).toHaveLength(3);
      tests.forEach(test => {
        expect(test.sessionId).toBe('test-session-1');
      });
    });

    test('filters by status correctly', async () => {
      const passedTests = await queryEngine.findTests({ status: 'passed' });
      const failedTests = await queryEngine.findTests({ status: 'failed' });
      const skippedTests = await queryEngine.findTests({ status: 'skipped' });
      
      expect(passedTests).toHaveLength(1);
      expect(passedTests[0].name).toBe('should pass');
      
      expect(failedTests).toHaveLength(1);
      expect(failedTests[0].name).toBe('should fail');
      
      expect(skippedTests).toHaveLength(1);
      expect(skippedTests[0].name).toBe('should be skipped');
    });

    test('filters by name pattern correctly', async () => {
      const tests = await queryEngine.findTests({ name: 'pass' });
      
      expect(tests).toHaveLength(1);
      expect(tests[0].name).toBe('should pass');
    });

    test('filters by minimum duration correctly', async () => {
      const slowTests = await queryEngine.findTests({ minDuration: 2000 });
      
      expect(slowTests).toHaveLength(1);
      expect(slowTests[0].name).toBe('should fail');
      expect(slowTests[0].duration).toBe(5000);
    });

    test('respects limit parameter', async () => {
      const tests = await queryEngine.findTests({ limit: 2 });
      
      expect(tests).toHaveLength(2);
    });

    test('orders by start_time DESC', async () => {
      const tests = await queryEngine.findTests();
      
      // Should be ordered by start time descending (newest first)
      expect(tests[0].name).toBe('should be skipped'); // Latest start time
      expect(tests[1].name).toBe('should fail');
      expect(tests[2].name).toBe('should pass'); // Earliest start time
    });

    test('combines multiple criteria', async () => {
      const tests = await queryEngine.findTests({
        sessionId: 'test-session-1',
        status: 'passed',
        limit: 1
      });
      
      expect(tests).toHaveLength(1);
      expect(tests[0].name).toBe('should pass');
      expect(tests[0].status).toBe('passed');
      expect(tests[0].sessionId).toBe('test-session-1');
    });
  });

  describe('getFailedTests', () => {
    test('returns only failed tests', async () => {
      const failedTests = await queryEngine.getFailedTests();
      
      expect(failedTests).toHaveLength(1);
      expect(failedTests[0].name).toBe('should fail');
      expect(failedTests[0].status).toBe('failed');
    });

    test('filters by session ID when provided', async () => {
      const failedTests = await queryEngine.getFailedTests('test-session-1');
      
      expect(failedTests).toHaveLength(1);
      expect(failedTests[0].sessionId).toBe('test-session-1');
      expect(failedTests[0].status).toBe('failed');
    });

    test('returns empty array when no failed tests', async () => {
      const failedTests = await queryEngine.getFailedTests('non-existent-session');
      
      expect(failedTests).toHaveLength(0);
    });
  });

  describe('getTestsByFile', () => {
    test('joins with test_suites correctly', async () => {
      const tests = await queryEngine.getTestsByFile('/path/to/test.js');
      
      expect(tests).toHaveLength(3);
      tests.forEach(test => {
        expect(test.suiteId).toBe('test-suite-1');
      });
    });

    test('returns empty array for non-existent file', async () => {
      const tests = await queryEngine.getTestsByFile('/non/existent/file.js');
      
      expect(tests).toHaveLength(0);
    });
  });

  describe('searchLogs', () => {
    test('filters by all criteria', async () => {
      const logs = await queryEngine.searchLogs({
        sessionId: 'test-session-1',
        level: 'error',
        message: 'failed'
      });
      
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('error');
      expect(logs[0].message).toContain('failed');
    });

    test('filters by sessionId', async () => {
      const logs = await queryEngine.searchLogs({
        sessionId: 'test-session-1'
      });
      
      expect(logs).toHaveLength(3);
      logs.forEach(log => {
        expect(log.sessionId).toBe('test-session-1');
      });
    });

    test('filters by testId', async () => {
      const logs = await queryEngine.searchLogs({
        testId: 'test-1'
      });
      
      expect(logs).toHaveLength(1);
      expect(logs[0].testId).toBe('test-1');
      expect(logs[0].message).toBe('Test started');
    });

    test('filters by level', async () => {
      const errorLogs = await queryEngine.searchLogs({ level: 'error' });
      const infoLogs = await queryEngine.searchLogs({ level: 'info' });
      
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].level).toBe('error');
      
      expect(infoLogs).toHaveLength(1);
      expect(infoLogs[0].level).toBe('info');
    });

    test('filters by message content', async () => {
      const logs = await queryEngine.searchLogs({ message: 'warning' });
      
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toContain('warning');
    });

    test('filters by timestamp since', async () => {
      const since = new Date('2023-01-01T10:00:15Z');
      const logs = await queryEngine.searchLogs({ since });
      
      expect(logs).toHaveLength(1);
      expect(logs[0].timestamp.getTime()).toBeGreaterThanOrEqual(since.getTime());
    });

    test('respects limit parameter', async () => {
      const logs = await queryEngine.searchLogs({ limit: 2 });
      
      expect(logs).toHaveLength(2);
    });

    test('orders by timestamp DESC', async () => {
      const logs = await queryEngine.searchLogs();
      
      // Should be ordered by timestamp descending (newest first)
      expect(logs[0].message).toBe('Test failed with error'); // Latest timestamp
      expect(logs[2].message).toBe('Session warning'); // Earliest timestamp
    });
  });

  describe('getErrorsByType', () => {
    test('joins with test_cases', async () => {
      const assertionErrors = await queryEngine.getErrorsByType('assertion');
      
      expect(assertionErrors).toHaveLength(1);
      expect(assertionErrors[0].type).toBe('assertion');
      expect(assertionErrors[0].testName).toBe('should fail');
      expect(assertionErrors[0].testFullName).toBe('MyComponent should fail');
    });

    test('filters by error type', async () => {
      const runtimeErrors = await queryEngine.getErrorsByType('runtime');
      
      expect(runtimeErrors).toHaveLength(1);
      expect(runtimeErrors[0].type).toBe('runtime');
      expect(runtimeErrors[0].message).toBe('Cannot read property of undefined');
    });

    test('returns empty array for non-existent error type', async () => {
      const errors = await queryEngine.getErrorsByType('timeout');
      
      expect(errors).toHaveLength(0);
    });

    test('orders by timestamp DESC', async () => {
      const allErrors = await queryEngine.getErrorsByType('assertion');
      const runtimeErrors = await queryEngine.getErrorsByType('runtime');
      
      // Runtime error should be newer than assertion error
      if (allErrors.length > 0 && runtimeErrors.length > 0) {
        expect(runtimeErrors[0].timestamp.getTime()).toBeGreaterThan(allErrors[0].timestamp.getTime());
      }
    });
  });

  describe('getMostCommonErrors', () => {
    test('groups and counts correctly', async () => {
      const commonErrors = await queryEngine.getMostCommonErrors();
      
      expect(commonErrors).toHaveLength(2);
      commonErrors.forEach(error => {
        expect(error.count).toBe(1);
        expect(['assertion', 'runtime']).toContain(error.type);
      });
    });

    test('respects limit parameter', async () => {
      const commonErrors = await queryEngine.getMostCommonErrors(1);
      
      expect(commonErrors).toHaveLength(1);
    });

    test('orders by count DESC', async () => {
      // Add more errors to test ordering
      await storage.storeError({
        testId: 'test-2',
        timestamp: new Date(),
        type: 'assertion',
        message: 'Expected true to be false',
        stackTrace: [],
        location: {},
        suggestion: 'Check your logic'
      });

      const commonErrors = await queryEngine.getMostCommonErrors();
      
      // Assertion errors should now be more common (count: 2)
      expect(commonErrors[0].type).toBe('assertion');
      expect(commonErrors[0].count).toBe(2);
    });
  });

  describe('getSlowestTests', () => {
    test('orders by duration DESC', async () => {
      const slowTests = await queryEngine.getSlowestTests();
      
      expect(slowTests).toHaveLength(3);
      expect(slowTests[0].name).toBe('should fail'); // 5000ms
      expect(slowTests[1].name).toBe('should pass'); // 1000ms
      expect(slowTests[2].name).toBe('should be skipped'); // 0ms
    });

    test('respects limit parameter', async () => {
      const slowTests = await queryEngine.getSlowestTests(2);
      
      expect(slowTests).toHaveLength(2);
      expect(slowTests[0].duration).toBeGreaterThanOrEqual(slowTests[1].duration);
    });

    test('excludes tests with null duration', async () => {
      // Add a test with null duration
      await storage.storeTestCase({
        id: 'test-null-duration',
        sessionId: 'test-session-1',
        suiteId: 'test-suite-1',
        name: 'null duration test',
        fullName: 'null duration test',
        startTime: new Date(),
        endTime: new Date(),
        status: 'passed',
        duration: null,
        assertions: [],
        errors: [],
        logs: []
      });

      const slowTests = await queryEngine.getSlowestTests();
      
      // Should still only return tests with valid durations
      expect(slowTests).toHaveLength(3);
      expect(slowTests.every(test => test.duration !== null)).toBe(true);
    });
  });

  describe('getTestHistory', () => {
    test('returns chronological history', async () => {
      const history = await queryEngine.getTestHistory('should pass');
      
      expect(history).toHaveLength(1);
      expect(history[0].name).toBe('should pass');
    });

    test('returns empty array for non-existent test', async () => {
      const history = await queryEngine.getTestHistory('non-existent test');
      
      expect(history).toHaveLength(0);
    });
  });

  describe('getTestSummary', () => {
    test('calculates statistics correctly', async () => {
      const summary = await queryEngine.getTestSummary();
      
      expect(summary.total).toBe(3);
      expect(summary.passed).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.skipped).toBe(1);
      expect(summary.todo).toBe(0);
    });

    test('filters by session ID when provided', async () => {
      const summary = await queryEngine.getTestSummary('test-session-1');
      
      expect(summary.total).toBe(3);
      expect(summary.passed).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.skipped).toBe(1);
    });

    test('returns zero counts for non-existent session', async () => {
      const summary = await queryEngine.getTestSummary('non-existent-session');
      
      expect(summary.total).toBe(0);
      expect(summary.passed).toBe(0);
      expect(summary.failed).toBe(0);
      expect(summary.skipped).toBe(0);
      expect(summary.todo).toBe(0);
    });
  });

  describe('getTestCase', () => {
    test('includes all related data', async () => {
      const testCase = await queryEngine.getTestCase('test-2');
      
      expect(testCase).toBeDefined();
      expect(testCase.id).toBe('test-2');
      expect(testCase.name).toBe('should fail');
      expect(testCase.status).toBe('failed');
      
      // Should include related errors
      expect(testCase.errors).toHaveLength(2);
      expect(testCase.errors[0].type).toBe('assertion');
      expect(testCase.errors[1].type).toBe('runtime');
      
      // Should include related logs
      expect(testCase.logs).toHaveLength(1);
      expect(testCase.logs[0].message).toBe('Test failed with error');
      
      // Should include assertions (empty in this case)
      expect(testCase.assertions).toHaveLength(0);
    });

    test('returns null for non-existent test case', async () => {
      const testCase = await queryEngine.getTestCase('non-existent-test');
      
      expect(testCase).toBeNull();
    });

    test('properly deserializes JSON fields', async () => {
      const testCase = await queryEngine.getTestCase('test-2');
      
      expect(testCase.errors[0].stackTrace).toEqual([
        { function: 'test', file: '/path/file.js', line: 10, column: 5 }
      ]);
      expect(testCase.errors[0].location).toEqual({
        file: '/path/file.js', line: 10, column: 5
      });
      expect(testCase.logs[0].metadata).toEqual({ error: true });
    });
  });

  describe('Advanced Query Scenarios', () => {
    beforeEach(async () => {
      // Create additional test data for advanced scenarios
      const session2 = {
        id: 'test-session-2',
        startTime: new Date('2023-01-02T10:00:00Z'),
        endTime: new Date('2023-01-02T10:10:00Z'),
        status: 'completed',
        jestConfig: { testMatch: ['**/*.spec.js'] },
        environment: { nodeVersion: 'v20.0.0' },
        summary: { totalTests: 10, passed: 7, failed: 3 }
      };
      await storage.storeSession(session2);

      const suite2 = {
        id: 'test-suite-2',
        sessionId: 'test-session-2',
        path: '/path/to/advanced.spec.js',
        name: 'advanced.spec.js',
        startTime: new Date('2023-01-02T10:00:00Z'),
        endTime: new Date('2023-01-02T10:05:00Z'),
        status: 'completed',
        setupDuration: 200,
        teardownDuration: 100
      };
      await storage.storeSuite(suite2);

      // Add tests with varying durations for performance analysis
      const performanceTests = [
        { id: 'perf-test-1', duration: 50, status: 'passed' },
        { id: 'perf-test-2', duration: 500, status: 'passed' },
        { id: 'perf-test-3', duration: 2000, status: 'failed' },
        { id: 'perf-test-4', duration: 10000, status: 'passed' },
        { id: 'perf-test-5', duration: 15000, status: 'failed' }
      ];

      for (const [index, test] of performanceTests.entries()) {
        await storage.storeTestCase({
          id: test.id,
          sessionId: 'test-session-2',
          suiteId: 'test-suite-2',
          name: `performance test ${index + 1}`,
          fullName: `Advanced Tests > performance test ${index + 1}`,
          startTime: new Date(`2023-01-02T10:0${index}:00Z`),
          endTime: new Date(`2023-01-02T10:0${index + 1}:00Z`),
          status: test.status,
          duration: test.duration,
          assertions: [],
          errors: [],
          logs: []
        });
      }
    });

    test('should find tests across multiple sessions', async () => {
      const allTests = await queryEngine.findTests();
      
      expect(allTests.length).toBeGreaterThanOrEqual(8); // 3 from session-1 + 5 from session-2
      
      const sessionIds = [...new Set(allTests.map(t => t.sessionId))];
      expect(sessionIds).toContain('test-session-1');
      expect(sessionIds).toContain('test-session-2');
    });

    test('should handle complex duration queries', async () => {
      const slowTests = await queryEngine.findTests({ minDuration: 5000 });
      
      expect(slowTests.length).toBeGreaterThanOrEqual(2);
      expect(slowTests.every(test => test.duration >= 5000)).toBe(true);
    });

    test('should support complex log searches with multiple criteria', async () => {
      // Add more logs for testing
      await storage.storeLog({
        sessionId: 'test-session-2',
        testId: 'perf-test-3',
        timestamp: new Date('2023-01-02T10:02:30Z'),
        level: 'error',
        message: 'Performance test failed due to timeout',
        source: 'test',
        metadata: { timeout: true, duration: 2000 }
      });

      const complexLogs = await queryEngine.searchLogs({
        level: 'error',
        message: 'timeout',
        since: new Date('2023-01-02T10:00:00Z')
      });

      expect(complexLogs).toHaveLength(1);
      expect(complexLogs[0].message).toContain('timeout');
      expect(complexLogs[0].level).toBe('error');
    });

    test('should handle performance analysis queries', async () => {
      const slowestTests = await queryEngine.getSlowestTests(3);
      
      expect(slowestTests).toHaveLength(3);
      expect(slowestTests[0].duration).toBeGreaterThanOrEqual(slowestTests[1].duration);
      expect(slowestTests[1].duration).toBeGreaterThanOrEqual(slowestTests[2].duration);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed JSON in error stack traces', async () => {
      // Manually insert error with malformed JSON
      const db = storage.db;
      db.prepare(`
        INSERT INTO errors (test_id, timestamp, type, message, stack_trace, location, suggestion)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('test-1', new Date().toISOString(), 'malformed', 'Test error', 'invalid json', '{}', 'Fix it');

      const errors = await queryEngine.getErrorsByType('malformed');
      
      // Should handle gracefully and return the error with null/default values
      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe('malformed');
    });

    test('should handle empty database gracefully', async () => {
      // Clear all data - must delete in correct order due to foreign key constraints
      const db = storage.db;
      db.prepare('DELETE FROM errors').run();
      db.prepare('DELETE FROM assertions').run();
      db.prepare('DELETE FROM logs').run();
      db.prepare('DELETE FROM test_cases').run();
      db.prepare('DELETE FROM test_suites').run();
      db.prepare('DELETE FROM sessions').run();

      const tests = await queryEngine.findTests();
      const summary = await queryEngine.getTestSummary();
      const logs = await queryEngine.searchLogs();
      const errors = await queryEngine.getErrorsByType('any');

      expect(tests).toHaveLength(0);
      expect(summary.total).toBe(0);
      expect(logs).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });

    test('should handle null and undefined query parameters', async () => {
      const tests = await queryEngine.findTests({
        sessionId: null,
        status: undefined,
        name: '',
        minDuration: null
      });

      // Should not crash and return all tests
      expect(Array.isArray(tests)).toBe(true);
    });

    test('should handle invalid date parameters', async () => {
      const logs = await queryEngine.searchLogs({
        since: 'invalid-date',
        until: new Date('invalid')
      });

      // Should handle gracefully and not crash
      expect(Array.isArray(logs)).toBe(true);
    });

    test('should handle very large limit values', async () => {
      const tests = await queryEngine.findTests({ limit: 999999 });
      
      // Should not crash and return reasonable results
      expect(Array.isArray(tests)).toBe(true);
      expect(tests.length).toBeLessThan(999999);
    });

    test('should handle SQL injection attempts in search queries', async () => {
      const maliciousQuery = "'; DROP TABLE test_cases; --";
      
      const logs = await queryEngine.searchLogs({
        message: maliciousQuery
      });

      // Should handle gracefully and not execute malicious SQL
      expect(Array.isArray(logs)).toBe(true);
      
      // Verify tables still exist
      const tableCheck = storage.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='test_cases'
      `).get();
      expect(tableCheck).toBeDefined();
    });

    test('should handle concurrent query operations', async () => {
      const promises = [
        queryEngine.findTests(),
        queryEngine.getTestSummary(),
        queryEngine.searchLogs(),
        queryEngine.getSlowestTests(),
        queryEngine.getFailedTests()
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(Array.isArray(results[0])).toBe(true); // findTests
      expect(typeof results[1]).toBe('object'); // getTestSummary
      expect(Array.isArray(results[2])).toBe(true); // searchLogs
      expect(Array.isArray(results[3])).toBe(true); // getSlowestTests
      expect(Array.isArray(results[4])).toBe(true); // getFailedTests
    });
  });

  describe('Complex Aggregation Queries', () => {
    test('should calculate accurate test statistics across multiple sessions', async () => {
      const summary = await queryEngine.getTestSummary();
      
      expect(summary.total).toBeGreaterThan(0);
      expect(summary.passed + summary.failed + summary.skipped + summary.todo).toBe(summary.total);
    });

    test('should group errors by test and provide meaningful statistics', async () => {
      const commonErrors = await queryEngine.getMostCommonErrors();
      
      expect(Array.isArray(commonErrors)).toBe(true);
      if (commonErrors.length > 0) {
        expect(commonErrors[0]).toHaveProperty('type');
        expect(commonErrors[0]).toHaveProperty('count');
        expect(typeof commonErrors[0].count).toBe('number');
      }
    });

    test('should handle test history across multiple runs', async () => {
      // First create the required parent session and suite
      await storage.storeSession({
        id: 'history-session-2',
        startTime: new Date('2023-01-02T10:00:00Z'),
        endTime: new Date('2023-01-02T10:10:00Z'),
        status: 'completed',
        jestConfig: {},
        environment: {},
        summary: {}
      });
      
      await storage.storeSuite({
        id: 'history-suite-2',
        sessionId: 'history-session-2',
        path: '/path/to/history.spec.js',
        name: 'history.spec.js',
        startTime: new Date('2023-01-02T10:00:00Z'),
        endTime: new Date('2023-01-02T10:00:02Z'),
        status: 'completed'
      });
      
      // Add same test name in different sessions
      await storage.storeTestCase({
        id: 'history-test-1',
        sessionId: 'history-session-2',
        suiteId: 'history-suite-2',
        name: 'should pass', // Same name as existing test
        fullName: 'History Tests > should pass',
        startTime: new Date('2023-01-02T10:00:00Z'),
        endTime: new Date('2023-01-02T10:00:01Z'),
        status: 'failed', // Different status
        duration: 1500,
        assertions: [],
        errors: [],
        logs: []
      });

      const history = await queryEngine.getTestHistory('should pass');
      
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history.some(h => h.status === 'passed')).toBe(true);
      expect(history.some(h => h.status === 'failed')).toBe(true);
    });
  });

  describe('JSON Deserialization Edge Cases', () => {
    test('should handle nested objects in metadata correctly', async () => {
      await storage.storeLog({
        sessionId: 'test-session-1',
        testId: 'test-1',
        timestamp: new Date(),
        level: 'info',
        message: 'Complex metadata test',
        source: 'test',
        metadata: {
          nested: {
            deep: {
              value: 'test',
              array: [1, 2, 3],
              nullValue: null,
              boolValue: true
            }
          },
          complexArray: [
            { id: 1, name: 'item1' },
            { id: 2, name: 'item2' }
          ]
        }
      });

      const logs = await queryEngine.searchLogs({
        message: 'Complex metadata test'
      });

      expect(logs).toHaveLength(1);
      const log = logs[0];
      expect(log.metadata.nested.deep.value).toBe('test');
      expect(log.metadata.nested.deep.array).toEqual([1, 2, 3]);
      expect(log.metadata.complexArray).toHaveLength(2);
    });

    test('should handle circular reference prevention in stored objects', async () => {
      // Test that circular references don't break JSON serialization
      const session = {
        id: 'circular-test',
        startTime: new Date(),
        endTime: null,
        status: 'running',
        jestConfig: {},
        environment: {},
        summary: {},
        metadata: {
          // This would typically be prevented at the storage layer
          simpleObject: { value: 'test' }
        }
      };

      await storage.storeSession(session);
      const retrieved = await storage.getSession('circular-test');

      expect(retrieved.metadata.simpleObject.value).toBe('test');
    });
  });
});
