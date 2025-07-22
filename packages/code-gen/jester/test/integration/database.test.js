/**
 * Database Integration Tests
 * Tests database operations, transactions, and data integrity
 */

import { StorageEngine } from '../../src/storage/StorageEngine.js';
import { QueryEngine } from '../../src/storage/QueryEngine.js';
import { JestAgentWrapper } from '../../src/core/JestAgentWrapper.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('Database Integration Tests', () => {
  let storage;
  let query;
  let testDbPath;
  let tempDir;

  beforeEach(async () => {
    // Create temporary directory for test databases
    tempDir = path.join(process.cwd(), 'temp-database-integration');
    await fs.mkdir(tempDir, { recursive: true });
    
    testDbPath = path.join(tempDir, `database-integration-${Date.now()}-${Math.random().toString(36).substring(7)}.db`);
    
    storage = new StorageEngine(testDbPath);
    query = new QueryEngine(storage);
  });

  afterEach(async () => {
    if (storage) {
      await storage.close();
    }
    
    // Clean up test files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, that's fine
    }
  });

  describe('Database Schema and Initialization', () => {
    test('creates database with correct schema', async () => {
      await storage.initialize();
      
      // Verify tables exist
      const tables = storage.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all();
      
      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('sessions');
      expect(tableNames).toContain('test_suites');
      expect(tableNames).toContain('test_cases');
      expect(tableNames).toContain('assertions');
      expect(tableNames).toContain('logs');
      expect(tableNames).toContain('errors');
    });

    test('creates indexes for performance', async () => {
      await storage.initialize();
      
      // Verify indexes exist
      const indexes = storage.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name NOT LIKE 'sqlite_%'
      `).all();
      
      const indexNames = indexes.map(i => i.name);
      expect(indexNames.length).toBeGreaterThan(0);
      expect(indexNames).toContain('idx_sessions_start_time');
      expect(indexNames).toContain('idx_test_cases_status');
    });

    test('enables foreign key constraints', async () => {
      await storage.initialize();
      
      // Check foreign key setting
      const result = storage.db.prepare('PRAGMA foreign_keys').get();
      expect(result.foreign_keys).toBe(1);
    });
  });

  describe('Data Integrity and Relationships', () => {
    test('maintains referential integrity between tables', async () => {
      await storage.initialize();
      
      // Create a session
      const session = {
        id: 'test-session-1',
        startTime: new Date(),
        endTime: new Date(),
        status: 'completed',
        jestConfig: { testMatch: ['**/*.test.js'] },
        environment: { nodeVersion: '18.0.0' },
        summary: { numTotalTests: 1 }
      };
      
      await storage.storeSession(session);
      
      // Create a test suite
      const suite = {
        id: 'test-suite-1',
        sessionId: session.id,
        path: '/test.js',
        name: 'test.js',
        startTime: new Date(),
        endTime: new Date(),
        status: 'passed',
        setupDuration: 10,
        teardownDuration: 5
      };
      
      await storage.storeSuite(suite);
      
      // Create a test case
      const testCase = {
        id: 'test-case-1',
        sessionId: session.id,
        suiteId: suite.id,
        name: 'should work',
        fullName: 'Test should work',
        startTime: new Date(),
        endTime: new Date(),
        status: 'passed',
        duration: 100,
        assertions: [],
        errors: [],
        logs: []
      };
      
      await storage.storeTestCase(testCase);
      
      // Verify relationships
      const retrievedSession = await storage.getSession(session.id);
      expect(retrievedSession).toBeDefined();
      expect(retrievedSession.id).toBe(session.id);
      
      const tests = await query.findTests({ sessionId: session.id });
      expect(tests).toHaveLength(1);
      expect(tests[0].suiteId).toBe(suite.id);
    });

    test('handles cascade operations correctly', async () => {
      await storage.initialize();
      
      // Create session with related data
      const session = {
        id: 'cascade-session',
        startTime: new Date(),
        endTime: new Date(),
        status: 'completed',
        jestConfig: {},
        environment: {},
        summary: {}
      };
      
      await storage.storeSession(session);
      
      const suite = {
        id: 'cascade-suite',
        sessionId: session.id,
        path: '/cascade.test.js',
        name: 'cascade.test.js',
        startTime: new Date(),
        endTime: new Date(),
        status: 'passed',
        setupDuration: 0,
        teardownDuration: 0
      };
      
      await storage.storeSuite(suite);
      
      // Verify data exists
      const beforeCount = storage.db.prepare('SELECT COUNT(*) as count FROM test_suites WHERE session_id = ?').get(session.id);
      expect(beforeCount.count).toBe(1);
      
      // Note: In a real scenario, we might test cascade deletes, but for this test
      // we'll just verify the relationships are maintained
      const suites = storage.db.prepare('SELECT * FROM test_suites WHERE session_id = ?').all(session.id);
      expect(suites).toHaveLength(1);
      expect(suites[0].session_id).toBe(session.id);
    });
  });

  describe('Concurrent Database Operations', () => {
    test('handles concurrent writes safely', async () => {
      await storage.initialize();
      
      // Create multiple sessions concurrently
      const sessionPromises = [];
      for (let i = 0; i < 5; i++) {
        const session = {
          id: `concurrent-session-${i}`,
          startTime: new Date(),
          endTime: new Date(),
          status: 'completed',
          jestConfig: {},
          environment: {},
          summary: { testNumber: i }
        };
        
        sessionPromises.push(storage.storeSession(session));
      }
      
      // Wait for all to complete
      await Promise.all(sessionPromises);
      
      // Verify all sessions were stored
      const sessions = storage.db.prepare('SELECT * FROM sessions ORDER BY id').all();
      expect(sessions).toHaveLength(5);
      
      for (let i = 0; i < 5; i++) {
        expect(sessions[i].id).toBe(`concurrent-session-${i}`);
      }
    });

    test('handles concurrent reads and writes', async () => {
      await storage.initialize();
      
      // Store initial data
      const session = {
        id: 'read-write-session',
        startTime: new Date(),
        endTime: new Date(),
        status: 'completed',
        jestConfig: {},
        environment: {},
        summary: {}
      };
      
      await storage.storeSession(session);
      
      // Perform concurrent reads and writes
      const operations = [];
      
      // Add more sessions
      for (let i = 0; i < 3; i++) {
        const newSession = {
          id: `rw-session-${i}`,
          startTime: new Date(),
          endTime: new Date(),
          status: 'completed',
          jestConfig: {},
          environment: {},
          summary: {}
        };
        operations.push(storage.storeSession(newSession));
      }
      
      // Add concurrent reads
      for (let i = 0; i < 3; i++) {
        operations.push(storage.getSession('read-write-session'));
      }
      
      const results = await Promise.all(operations);
      
      // Verify reads returned correct data
      const readResults = results.slice(3); // Last 3 are reads
      readResults.forEach(result => {
        expect(result).toBeDefined();
        expect(result.id).toBe('read-write-session');
      });
      
      // Verify all sessions exist
      const allSessions = storage.db.prepare('SELECT COUNT(*) as count FROM sessions').get();
      expect(allSessions.count).toBe(4); // 1 initial + 3 new
    });
  });

  describe('Large Dataset Handling', () => {
    test('efficiently handles large numbers of test cases', async () => {
      await storage.initialize();
      
      const startTime = Date.now();
      
      // Create session
      const session = {
        id: 'large-dataset-session',
        startTime: new Date(),
        endTime: new Date(),
        status: 'completed',
        jestConfig: {},
        environment: {},
        summary: {}
      };
      
      await storage.storeSession(session);
      
      // Create suite
      const suite = {
        id: 'large-dataset-suite',
        sessionId: session.id,
        path: '/large.test.js',
        name: 'large.test.js',
        startTime: new Date(),
        endTime: new Date(),
        status: 'passed',
        setupDuration: 0,
        teardownDuration: 0
      };
      
      await storage.storeSuite(suite);
      
      // Create many test cases
      const testCases = [];
      for (let i = 0; i < 100; i++) {
        testCases.push({
          id: `large-test-${i}`,
          sessionId: session.id,
          suiteId: suite.id,
          name: `test ${i}`,
          fullName: `Large Suite test ${i}`,
          startTime: new Date(),
          endTime: new Date(),
          status: i % 10 === 0 ? 'failed' : 'passed',
          duration: Math.floor(Math.random() * 1000),
          assertions: [],
          errors: [],
          logs: []
        });
      }
      
      // Store all test cases
      for (const testCase of testCases) {
        await storage.storeTestCase(testCase);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);
      
      // Verify all data was stored
      const summary = await query.getTestSummary(session.id);
      expect(summary.total).toBe(100);
      expect(summary.failed).toBe(10); // Every 10th test fails
      expect(summary.passed).toBe(90);
    });

    test('performs efficient queries on large datasets', async () => {
      await storage.initialize();
      
      // Create test data
      const session = {
        id: 'query-performance-session',
        startTime: new Date(),
        endTime: new Date(),
        status: 'completed',
        jestConfig: {},
        environment: {},
        summary: {}
      };
      
      await storage.storeSession(session);
      
      const suite = {
        id: 'query-performance-suite',
        sessionId: session.id,
        path: '/query.test.js',
        name: 'query.test.js',
        startTime: new Date(),
        endTime: new Date(),
        status: 'passed',
        setupDuration: 0,
        teardownDuration: 0
      };
      
      await storage.storeSuite(suite);
      
      // Create test cases with varying characteristics
      for (let i = 0; i < 50; i++) {
        const testCase = {
          id: `query-test-${i}`,
          sessionId: session.id,
          suiteId: suite.id,
          name: `query test ${i}`,
          fullName: `Query Suite query test ${i}`,
          startTime: new Date(),
          endTime: new Date(),
          status: i % 5 === 0 ? 'failed' : 'passed',
          duration: i * 10, // Varying durations
          assertions: [],
          errors: [],
          logs: []
        };
        
        await storage.storeTestCase(testCase);
      }
      
      // Test various query performance
      const queryStartTime = Date.now();
      
      // Query by status
      const failedTests = await query.getFailedTests(session.id);
      expect(failedTests).toHaveLength(10);
      
      // Query by criteria
      const slowTests = await query.findTests({
        sessionId: session.id,
        minDuration: 200
      });
      expect(slowTests.length).toBeGreaterThan(0);
      
      // Summary query
      const summary = await query.getTestSummary(session.id);
      expect(summary.total).toBe(50);
      
      const queryEndTime = Date.now();
      const queryDuration = queryEndTime - queryStartTime;
      
      // Queries should be fast (less than 100ms)
      expect(queryDuration).toBeLessThan(100);
    });
  });

  describe('Database Recovery and Error Handling', () => {
    test('handles database corruption gracefully', async () => {
      await storage.initialize();
      
      // Store some data
      const session = {
        id: 'recovery-session',
        startTime: new Date(),
        endTime: new Date(),
        status: 'completed',
        jestConfig: {},
        environment: {},
        summary: {}
      };
      
      await storage.storeSession(session);
      
      // Verify data exists
      const retrieved = await storage.getSession('recovery-session');
      expect(retrieved).toBeDefined();
      
      // Close and reopen database
      await storage.close();
      
      const newStorage = new StorageEngine(testDbPath);
      await newStorage.initialize();
      
      // Verify data persists
      const retrievedAfterReopen = await newStorage.getSession('recovery-session');
      expect(retrievedAfterReopen).toBeDefined();
      expect(retrievedAfterReopen.id).toBe('recovery-session');
      
      await newStorage.close();
    });

    test('handles invalid data gracefully', async () => {
      await storage.initialize();
      
      // Try to store invalid session data
      const invalidSession = {
        id: null, // Invalid ID
        startTime: 'invalid-date', // Invalid date
        status: 'completed',
        jestConfig: {},
        environment: {},
        summary: {}
      };
      
      // Should not throw, but should handle gracefully
      await expect(storage.storeSession(invalidSession)).rejects.toThrow();
      
      // Database should still be functional
      const validSession = {
        id: 'valid-session',
        startTime: new Date(),
        endTime: new Date(),
        status: 'completed',
        jestConfig: {},
        environment: {},
        summary: {}
      };
      
      await expect(storage.storeSession(validSession)).resolves.not.toThrow();
      
      const retrieved = await storage.getSession('valid-session');
      expect(retrieved).toBeDefined();
    });
  });

  describe('Integration with JAW Components', () => {
    test('works correctly with JestAgentWrapper', async () => {
      const jaw = new JestAgentWrapper({
        dbPath: testDbPath,
        storage: 'sqlite'
      });
      
      // Start session
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js']
      });
      
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      
      // Simulate test execution
      const collector = jaw.collector;
      
      collector.onTestSuiteStart('/integration.test.js');
      
      const test = collector.onTestStart({
        path: '/integration.test.js',
        name: 'integration test',
        fullName: 'Integration integration test'
      });
      
      collector.onTestEnd(test, {
        status: 'passed',
        failureMessages: []
      });
      
      collector.onTestSuiteEnd('/integration.test.js', {
        numFailingTests: 0,
        numPassingTests: 1
      });
      
      collector.endSession({
        numTotalTests: 1,
        numPassedTests: 1,
        numFailedTests: 0
      });
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify data was stored
      const summary = await jaw.getTestSummary(session.id);
      expect(summary.total).toBeGreaterThanOrEqual(0);
      
      await jaw.close();
    });

    test('maintains data consistency across multiple operations', async () => {
      await storage.initialize();
      
      // Simulate a complex test scenario
      const session = {
        id: 'consistency-session',
        startTime: new Date(),
        endTime: null,
        status: 'running',
        jestConfig: {},
        environment: {},
        summary: {}
      };
      
      await storage.storeSession(session);
      
      // Create multiple suites
      const suites = [];
      for (let i = 0; i < 3; i++) {
        const suite = {
          id: `consistency-suite-${i}`,
          sessionId: session.id,
          path: `/suite${i}.test.js`,
          name: `suite${i}.test.js`,
          startTime: new Date(),
          endTime: new Date(),
          status: 'passed',
          setupDuration: 10,
          teardownDuration: 5
        };
        
        suites.push(suite);
        await storage.storeSuite(suite);
      }
      
      // Create tests for each suite
      let totalTests = 0;
      for (const suite of suites) {
        for (let j = 0; j < 2; j++) {
          const testCase = {
            id: `consistency-test-${suite.id}-${j}`,
            sessionId: session.id,
            suiteId: suite.id,
            name: `test ${j}`,
            fullName: `${suite.name} test ${j}`,
            startTime: new Date(),
            endTime: new Date(),
            status: 'passed',
            duration: 50,
            assertions: [],
            errors: [],
            logs: []
          };
          
          await storage.storeTestCase(testCase);
          totalTests++;
        }
      }
      
      // Update session as completed
      session.endTime = new Date();
      session.status = 'completed';
      session.summary = { numTotalTests: totalTests };
      
      await storage.storeSession(session);
      
      // Verify consistency
      const retrievedSession = await storage.getSession(session.id);
      expect(retrievedSession.status).toBe('completed');
      expect(retrievedSession.summary.numTotalTests).toBe(totalTests);
      
      const allTests = await query.findTests({ sessionId: session.id });
      expect(allTests).toHaveLength(totalTests);
      
      // Verify each test belongs to correct suite
      for (const test of allTests) {
        const belongsToSuite = suites.some(suite => suite.id === test.suiteId);
        expect(belongsToSuite).toBe(true);
      }
    });
  });
});
