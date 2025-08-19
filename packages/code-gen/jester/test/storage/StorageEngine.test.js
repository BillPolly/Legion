/**
 * Comprehensive tests for StorageEngine
 * Tests SQLite database operations, data persistence, and edge cases
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { StorageEngine } from '../../src/storage/StorageEngine.js';
import { promises as fs } from 'fs';
import path from 'path';
import { TestDbHelper, setupTestDb, cleanupTestDb } from '../utils/test-db-helper.js';

describe('StorageEngine', () => {
  let storage;
  let testDbPath;

  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    testDbPath = TestDbHelper.getTempDbPath('storage-engine');
    storage = new StorageEngine(testDbPath);
  });

  afterEach(async () => {
    if (storage) {
      await storage.close();
    }
    
    // Clean up test database
    await cleanupTestDb(testDbPath);
  });

  describe('Database Initialization', () => {
    test('creates all tables', async () => {
      await storage.initialize();
      
      // Check that all tables exist
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

    test('creates all indexes', async () => {
      await storage.initialize();
      
      // Check that indexes exist
      const indexes = storage.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name NOT LIKE 'sqlite_%'
      `).all();
      
      const indexNames = indexes.map(i => i.name);
      expect(indexNames).toContain('idx_sessions_start_time');
      expect(indexNames).toContain('idx_test_cases_status');
      expect(indexNames).toContain('idx_test_cases_session');
      expect(indexNames).toContain('idx_logs_timestamp');
      expect(indexNames).toContain('idx_logs_level');
      expect(indexNames).toContain('idx_errors_type');
    });

    test('enables foreign key constraints', async () => {
      await storage.initialize();
      
      const result = storage.db.prepare('PRAGMA foreign_keys').get();
      expect(result.foreign_keys).toBe(1);
    });

    test('enables WAL mode for performance', async () => {
      await storage.initialize();
      
      const result = storage.db.prepare('PRAGMA journal_mode').get();
      expect(result.journal_mode).toBe('wal');
    });
  });

  describe('Session Storage', () => {
    beforeEach(async () => {
      await storage.initialize();
    });

    test('stores session data correctly', async () => {
      const session = {
        id: 'test-session-1',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T10:05:00Z'),
        status: 'completed',
        jestConfig: { testMatch: ['**/*.test.js'] },
        environment: { nodeVersion: 'v18.0.0' },
        summary: { totalTests: 10, passed: 8, failed: 2 }
      };

      await storage.storeSession(session);

      const stored = storage.db.prepare('SELECT * FROM sessions WHERE id = ?').get(session.id);
      expect(stored).toBeDefined();
      expect(stored.id).toBe(session.id);
      expect(stored.status).toBe(session.status);
      expect(JSON.parse(stored.config)).toEqual(session.jestConfig);
      expect(JSON.parse(stored.environment)).toEqual(session.environment);
      expect(JSON.parse(stored.summary)).toEqual(session.summary);
    });

    test('retrieves session by ID', async () => {
      const session = {
        id: 'test-session-2',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T10:05:00Z'),
        status: 'completed',
        jestConfig: { testMatch: ['**/*.test.js'] },
        environment: { nodeVersion: 'v18.0.0' },
        summary: { totalTests: 5 }
      };

      await storage.storeSession(session);
      const retrieved = await storage.getSession(session.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(session.id);
      expect(retrieved.status).toBe(session.status);
      expect(retrieved.startTime).toEqual(session.startTime);
      expect(retrieved.endTime).toEqual(session.endTime);
      expect(retrieved.jestConfig).toEqual(session.jestConfig);
      expect(retrieved.environment).toEqual(session.environment);
      expect(retrieved.summary).toEqual(session.summary);
    });

    test('returns null for non-existent session ID', async () => {
      const result = await storage.getSession('non-existent-id');
      expect(result).toBeNull();
    });

    test('handles session without end time', async () => {
      const session = {
        id: 'test-session-3',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: null,
        status: 'running',
        jestConfig: {},
        environment: {},
        summary: {}
      };

      await storage.storeSession(session);
      const retrieved = await storage.getSession(session.id);

      expect(retrieved.endTime).toBeNull();
      expect(retrieved.status).toBe('running');
    });
  });

  describe('Test Suite Storage', () => {
    beforeEach(async () => {
      await storage.initialize();
      
      // Create parent session first
      const session = {
        id: 'session-1',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T10:05:00Z'),
        status: 'completed',
        jestConfig: {},
        environment: {},
        summary: {}
      };
      await storage.storeSession(session);
    });

    test('stores suite data correctly', async () => {
      const suite = {
        id: 'suite-1',
        sessionId: 'session-1',
        path: '/path/to/test.js',
        name: 'test.js',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T10:01:00Z'),
        status: 'passed',
        setupDuration: 100,
        teardownDuration: 50
      };

      await storage.storeSuite(suite);

      const stored = storage.db.prepare('SELECT * FROM test_suites WHERE id = ?').get(suite.id);
      expect(stored).toBeDefined();
      expect(stored.id).toBe(suite.id);
      expect(stored.session_id).toBe(suite.sessionId);
      expect(stored.path).toBe(suite.path);
      expect(stored.name).toBe(suite.name);
      expect(stored.status).toBe(suite.status);
      expect(stored.setup_duration).toBe(suite.setupDuration);
      expect(stored.teardown_duration).toBe(suite.teardownDuration);
    });
  });

  describe('Test Case Storage', () => {
    beforeEach(async () => {
      await storage.initialize();
      
      // Create parent session and suite first
      const session = {
        id: 'session-1',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T10:05:00Z'),
        status: 'completed',
        jestConfig: {},
        environment: {},
        summary: {}
      };
      await storage.storeSession(session);
      
      const suite = {
        id: 'suite-1',
        sessionId: 'session-1',
        path: '/path/to/test.js',
        name: 'test.js',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T10:01:00Z'),
        status: 'passed',
        setupDuration: 100,
        teardownDuration: 50
      };
      await storage.storeSuite(suite);
    });

    test('stores test case data correctly', async () => {
      const testCase = {
        id: 'test-1',
        sessionId: 'session-1',
        suiteId: 'suite-1',
        name: 'should work correctly',
        fullName: 'MyComponent should work correctly',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T10:00:01Z'),
        status: 'passed',
        duration: 1000,
        assertions: [],
        errors: [],
        logs: []
      };

      await storage.storeTestCase(testCase);

      const stored = storage.db.prepare('SELECT * FROM test_cases WHERE id = ?').get(testCase.id);
      expect(stored).toBeDefined();
      expect(stored.id).toBe(testCase.id);
      expect(stored.session_id).toBe(testCase.sessionId);
      expect(stored.suite_id).toBe(testCase.suiteId);
      expect(stored.name).toBe(testCase.name);
      expect(stored.full_name).toBe(testCase.fullName);
      expect(stored.status).toBe(testCase.status);
      expect(stored.duration).toBe(testCase.duration);
    });

    test('stores test case with assertions', async () => {
      const testCase = {
        id: 'test-2',
        sessionId: 'session-1',
        suiteId: 'suite-1',
        name: 'should have assertions',
        fullName: 'MyComponent should have assertions',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T10:00:01Z'),
        status: 'passed',
        duration: 1000,
        assertions: [{
          testId: 'test-2',
          timestamp: new Date('2023-01-01T10:00:00.5Z'),
          type: 'expect',
          matcher: 'toBe',
          passed: true,
          actual: 'hello',
          expected: 'hello',
          message: 'Expected hello to be hello',
          stackTrace: []
        }],
        errors: [],
        logs: []
      };

      await storage.storeTestCase(testCase);

      const assertions = storage.db.prepare('SELECT * FROM assertions WHERE test_id = ?').all(testCase.id);
      expect(assertions).toHaveLength(1);
      expect(assertions[0].test_id).toBe(testCase.id);
      expect(assertions[0].type).toBe('expect');
      expect(assertions[0].matcher).toBe('toBe');
      expect(assertions[0].passed).toBe(1); // SQLite stores boolean as integer
    });
  });

  describe('Assertion Storage', () => {
    beforeEach(async () => {
      await storage.initialize();
      
      // Create parent session, suite, and test case first
      const session = {
        id: 'session-1',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T10:05:00Z'),
        status: 'completed',
        jestConfig: {},
        environment: {},
        summary: {}
      };
      await storage.storeSession(session);
      
      const suite = {
        id: 'suite-1',
        sessionId: 'session-1',
        path: '/path/to/test.js',
        name: 'test.js',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T10:01:00Z'),
        status: 'passed',
        setupDuration: 100,
        teardownDuration: 50
      };
      await storage.storeSuite(suite);
      
      const testCase = {
        id: 'test-1',
        sessionId: 'session-1',
        suiteId: 'suite-1',
        name: 'should work correctly',
        fullName: 'MyComponent should work correctly',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T10:00:01Z'),
        status: 'passed',
        duration: 1000,
        assertions: [],
        errors: [],
        logs: []
      };
      await storage.storeTestCase(testCase);
    });

    test('stores assertion data correctly', async () => {
      const assertion = {
        testId: 'test-1',
        timestamp: new Date('2023-01-01T10:00:00Z'),
        type: 'expect',
        matcher: 'toEqual',
        passed: false,
        actual: { a: 1 },
        expected: { a: 2 },
        message: 'Objects do not match',
        stackTrace: [{ function: 'test', file: '/path/file.js', line: 10, column: 5 }]
      };

      await storage.storeAssertion(assertion);

      const stored = storage.db.prepare('SELECT * FROM assertions WHERE test_id = ?').get(assertion.testId);
      expect(stored).toBeDefined();
      expect(stored.test_id).toBe(assertion.testId);
      expect(stored.type).toBe(assertion.type);
      expect(stored.matcher).toBe(assertion.matcher);
      expect(stored.passed).toBe(0); // false as integer
      expect(JSON.parse(stored.actual)).toEqual(assertion.actual);
      expect(JSON.parse(stored.expected)).toEqual(assertion.expected);
      expect(stored.message).toBe(assertion.message);
      expect(JSON.parse(stored.stack_trace)).toEqual(assertion.stackTrace);
    });
  });

  describe('Log Storage', () => {
    beforeEach(async () => {
      await storage.initialize();
      
      // Create parent session first
      const session = {
        id: 'session-1',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T10:05:00Z'),
        status: 'completed',
        jestConfig: {},
        environment: {},
        summary: {}
      };
      await storage.storeSession(session);
    });

    test('stores log data correctly', async () => {
      const log = {
        sessionId: 'session-1',
        testId: null, // Make testId null to avoid foreign key constraint
        timestamp: new Date('2023-01-01T10:00:00Z'),
        level: 'info',
        message: 'Test log message',
        source: 'test',
        metadata: { extra: 'data' }
      };

      await storage.storeLog(log);

      const stored = storage.db.prepare('SELECT * FROM logs WHERE session_id = ?').get(log.sessionId);
      expect(stored).toBeDefined();
      expect(stored.session_id).toBe(log.sessionId);
      expect(stored.test_id).toBe(log.testId);
      expect(stored.level).toBe(log.level);
      expect(stored.message).toBe(log.message);
      expect(stored.source).toBe(log.source);
      expect(JSON.parse(stored.metadata)).toEqual(log.metadata);
    });
  });

  describe('Error Storage', () => {
    beforeEach(async () => {
      await storage.initialize();
      
      // Create parent session, suite, and test case first
      const session = {
        id: 'session-1',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T10:05:00Z'),
        status: 'completed',
        jestConfig: {},
        environment: {},
        summary: {}
      };
      await storage.storeSession(session);
      
      const suite = {
        id: 'suite-1',
        sessionId: 'session-1',
        path: '/path/to/test.js',
        name: 'test.js',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T10:01:00Z'),
        status: 'passed',
        setupDuration: 100,
        teardownDuration: 50
      };
      await storage.storeSuite(suite);
      
      const testCase = {
        id: 'test-1',
        sessionId: 'session-1',
        suiteId: 'suite-1',
        name: 'should work correctly',
        fullName: 'MyComponent should work correctly',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T10:00:01Z'),
        status: 'passed',
        duration: 1000,
        assertions: [],
        errors: [],
        logs: []
      };
      await storage.storeTestCase(testCase);
    });

    test('stores error data correctly', async () => {
      const error = {
        testId: 'test-1',
        timestamp: new Date('2023-01-01T10:00:00Z'),
        type: 'assertion',
        message: 'Test failed',
        stackTrace: [{ function: 'test', file: '/path/file.js', line: 10, column: 5 }],
        location: { file: '/path/file.js', line: 10, column: 5 },
        suggestion: 'Check your logic'
      };

      await storage.storeError(error);

      const stored = storage.db.prepare('SELECT * FROM errors WHERE test_id = ?').get(error.testId);
      expect(stored).toBeDefined();
      expect(stored.test_id).toBe(error.testId);
      expect(stored.type).toBe(error.type);
      expect(stored.message).toBe(error.message);
      expect(JSON.parse(stored.stack_trace)).toEqual(error.stackTrace);
      expect(JSON.parse(stored.location)).toEqual(error.location);
      expect(stored.suggestion).toBe(error.suggestion);
    });
  });

  describe('Database Connection Management', () => {
    test('initializes only once', async () => {
      expect(storage.initialized).toBe(false);
      
      await storage.initialize();
      expect(storage.initialized).toBe(true);
      
      // Second call should not reinitialize
      await storage.initialize();
      expect(storage.initialized).toBe(true);
    });

    test('closes database connection properly', async () => {
      await storage.initialize();
      expect(storage.db).toBeDefined();
      expect(storage.initialized).toBe(true);
      
      await storage.close();
      expect(storage.db).toBeNull();
      expect(storage.initialized).toBe(false);
    });
  });

  describe('JSON Serialization/Deserialization', () => {
    beforeEach(async () => {
      await storage.initialize();
    });

    test('handles complex objects in session config', async () => {
      const session = {
        id: 'complex-session',
        startTime: new Date(),
        endTime: null,
        status: 'running',
        jestConfig: {
          testMatch: ['**/*.test.js'],
          setupFiles: ['./setup.js'],
          moduleNameMapping: {
            '^@/(.*)$': '<rootDir>/src/$1'
          },
          transform: {
            '^.+\\.js$': 'babel-jest'
          }
        },
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          env: { NODE_ENV: 'test' }
        },
        summary: {}
      };

      await storage.storeSession(session);
      const retrieved = await storage.getSession(session.id);

      expect(retrieved.jestConfig).toEqual(session.jestConfig);
      expect(retrieved.environment).toEqual(session.environment);
    });

    test('handles null and undefined values', async () => {
      // Create parent records first
      const session = {
        id: 'session-null',
        startTime: new Date(),
        endTime: null,
        status: 'running',
        jestConfig: {},
        environment: {},
        summary: {}
      };
      await storage.storeSession(session);
      
      const suite = {
        id: 'suite-null',
        sessionId: 'session-null',
        path: '/path/to/test.js',
        name: 'test.js',
        startTime: new Date(),
        endTime: new Date(),
        status: 'passed',
        setupDuration: 100,
        teardownDuration: 50
      };
      await storage.storeSuite(suite);
      
      const testCase = {
        id: 'test-null',
        sessionId: 'session-null',
        suiteId: 'suite-null',
        name: 'should work correctly',
        fullName: 'MyComponent should work correctly',
        startTime: new Date(),
        endTime: new Date(),
        status: 'passed',
        duration: 1000,
        assertions: [],
        errors: [],
        logs: []
      };
      await storage.storeTestCase(testCase);

      const assertion = {
        testId: 'test-null',
        timestamp: new Date(),
        type: 'expect',
        matcher: 'toBe',
        passed: true,
        actual: null,
        expected: undefined,
        message: 'Testing null/undefined',
        stackTrace: []
      };

      await storage.storeAssertion(assertion);

      const stored = storage.db.prepare('SELECT * FROM assertions WHERE test_id = ?').get(assertion.testId);
      expect(JSON.parse(stored.actual)).toBeNull();
      expect(JSON.parse(stored.expected)).toBeNull(); // JSON.stringify(undefined) becomes "null"
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid database path gracefully', async () => {
      const invalidStorage = new StorageEngine('/invalid/path/that/does/not/exist/test.db');
      
      // Should not throw during construction
      expect(invalidStorage).toBeDefined();
      
      // Should handle initialization error gracefully
      await expect(invalidStorage.initialize()).rejects.toThrow();
    });

    test('should handle duplicate session ID insertion', async () => {
      await storage.initialize();
      
      const session = {
        id: 'duplicate-session',
        startTime: new Date(),
        endTime: null,
        status: 'running',
        jestConfig: {},
        environment: {},
        summary: {}
      };

      // First insertion should succeed
      await storage.storeSession(session);

      // Second insertion with same ID should update (INSERT OR REPLACE)
      await storage.storeSession(session);
      
      // Verify the session was updated, not duplicated
      const sessions = await storage.getAllSessions();
      const duplicateSessions = sessions.filter(s => s.id === 'duplicate-session');
      expect(duplicateSessions).toHaveLength(1);
    });

    test('should handle foreign key constraint violations', async () => {
      // Create a fresh storage instance to ensure clean state
      const freshDbPath = TestDbHelper.getTempDbPath('fk-test-' + Date.now());
      const freshStorage = new StorageEngine(freshDbPath);
      
      try {
        await freshStorage.initialize();
        
        // Ensure foreign keys are enabled
        const fkStatus = freshStorage.db.prepare('PRAGMA foreign_keys').get();
        expect(fkStatus.foreign_keys).toBe(1);
        
        // Try to manually insert a test case with a non-existent session_id using raw SQL
        // This bypasses the StorageEngine's INSERT OR REPLACE logic
        const testCaseId = 'orphan-test-' + Date.now();
        const nonExistentSessionId = 'non-existent-session-' + Date.now();
        const nonExistentSuiteId = 'non-existent-suite-' + Date.now();
        
        const insertStmt = freshStorage.db.prepare(`
          INSERT INTO test_cases 
          (id, session_id, suite_id, name, full_name, start_time, end_time, status, duration)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // Should throw due to foreign key constraint
        expect(() => {
          insertStmt.run(
            testCaseId,
            nonExistentSessionId,
            nonExistentSuiteId,
            'orphan test',
            'orphan test',
            new Date().toISOString(),
            new Date().toISOString(),
            'passed',
            100
          );
        }).toThrow(/FOREIGN KEY constraint failed/);
      } finally {
        // Clean up
        await freshStorage.close();
        await cleanupTestDb(freshDbPath);
      }
    });

    test('should handle malformed JSON data', async () => {
      await storage.initialize();
      
      // Create a session with valid data first
      const session = {
        id: 'json-test-session',
        startTime: new Date(),
        endTime: null,
        status: 'running',
        jestConfig: {},
        environment: {},
        summary: {}
      };
      await storage.storeSession(session);

      // Manually corrupt JSON data in database
      storage.db.prepare(`
        UPDATE sessions 
        SET config = 'invalid json' 
        WHERE id = ?
      `).run(session.id);

      // Should handle gracefully when retrieving
      await expect(storage.getSession(session.id)).rejects.toThrow();
    });

    test('should handle very large data objects', async () => {
      await storage.initialize();
      
      // Create a large configuration object
      const largeConfig = {
        testMatch: Array(1000).fill('**/*.test.js'),
        setupFiles: Array(100).fill('./setup.js'),
        moduleNameMapping: {}
      };
      
      // Fill with many mappings
      for (let i = 0; i < 100; i++) {
        largeConfig.moduleNameMapping[`^@alias${i}/(.*)$`] = `<rootDir>/src/module${i}/$1`;
      }

      const session = {
        id: 'large-session',
        startTime: new Date(),
        endTime: null,
        status: 'running',
        jestConfig: largeConfig,
        environment: { nodeVersion: 'v18.0.0' },
        summary: {}
      };

      await storage.storeSession(session);
      const retrieved = await storage.getSession(session.id);

      expect(retrieved.jestConfig).toEqual(largeConfig);
    });

    test('should handle concurrent database operations', async () => {
      await storage.initialize();
      
      // Create multiple sessions concurrently
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const session = {
          id: `concurrent-session-${i}`,
          startTime: new Date(),
          endTime: null,
          status: 'running',
          jestConfig: {},
          environment: {},
          summary: {}
        };
        promises.push(storage.storeSession(session));
      }

      await Promise.all(promises);

      // Verify all sessions were stored
      for (let i = 0; i < 10; i++) {
        const retrieved = await storage.getSession(`concurrent-session-${i}`);
        expect(retrieved).toBeDefined();
        expect(retrieved.id).toBe(`concurrent-session-${i}`);
      }
    });
  });

  describe('Database Schema Validation', () => {
    test('should create all required tables with proper structure', async () => {
      await storage.initialize();
      
      // Verify sessions table structure
      const sessionsInfo = storage.db.prepare(`PRAGMA table_info(sessions)`).all();
      const sessionColumns = sessionsInfo.map(col => col.name);
      expect(sessionColumns).toContain('id');
      expect(sessionColumns).toContain('start_time');
      expect(sessionColumns).toContain('end_time');
      expect(sessionColumns).toContain('status');
      expect(sessionColumns).toContain('config');
      expect(sessionColumns).toContain('environment');
      expect(sessionColumns).toContain('summary');
      expect(sessionColumns).toContain('metadata');

      // Verify test_cases table structure
      const testCasesInfo = storage.db.prepare(`PRAGMA table_info(test_cases)`).all();
      const testCaseColumns = testCasesInfo.map(col => col.name);
      expect(testCaseColumns).toContain('id');
      expect(testCaseColumns).toContain('session_id');
      expect(testCaseColumns).toContain('suite_id');
      expect(testCaseColumns).toContain('name');
      expect(testCaseColumns).toContain('full_name');
      expect(testCaseColumns).toContain('start_time');
      expect(testCaseColumns).toContain('end_time');
      expect(testCaseColumns).toContain('status');
      expect(testCaseColumns).toContain('duration');
    });

    test('should have proper foreign key constraints', async () => {
      await storage.initialize();
      
      // Check foreign key constraints
      const foreignKeys = storage.db.prepare(`PRAGMA foreign_key_list(test_cases)`).all();
      expect(foreignKeys.length).toBeGreaterThan(0);
      
      const tableNames = foreignKeys.map(fk => fk.table);
      expect(tableNames).toContain('sessions');
      expect(tableNames).toContain('test_suites');
    });
  });

  describe('Performance and Memory Management', () => {
    test('should handle cleanup of large datasets efficiently', async () => {
      await storage.initialize();
      
      // Create a large number of test records
      const baseSession = {
        id: 'perf-session',
        startTime: new Date(),
        endTime: new Date(),
        status: 'completed',
        jestConfig: {},
        environment: {},
        summary: {}
      };
      await storage.storeSession(baseSession);

      const baseSuite = {
        id: 'perf-suite',
        sessionId: 'perf-session',
        path: '/test/perf.test.js',
        name: 'perf.test.js',
        startTime: new Date(),
        endTime: new Date(),
        status: 'completed',
        setupDuration: 100,
        teardownDuration: 50
      };
      await storage.storeSuite(baseSuite);

      // Create many test cases
      const testCasePromises = [];
      for (let i = 0; i < 100; i++) {
        const testCase = {
          id: `perf-test-${i}`,
          sessionId: 'perf-session',
          suiteId: 'perf-suite',
          name: `performance test ${i}`,
          fullName: `Performance Tests > performance test ${i}`,
          startTime: new Date(),
          endTime: new Date(),
          status: i % 10 === 0 ? 'failed' : 'passed',
          duration: Math.random() * 1000,
          assertions: [],
          errors: [],
          logs: []
        };
        testCasePromises.push(storage.storeTestCase(testCase));
      }

      await Promise.all(testCasePromises);

      // Verify data was stored
      const count = storage.db.prepare(`SELECT COUNT(*) as count FROM test_cases WHERE session_id = ?`).get('perf-session');
      expect(count.count).toBe(100);
    });

    test('should handle database vacuum operations', async () => {
      await storage.initialize();
      
      // Get initial database size
      const initialSize = storage.db.prepare(`PRAGMA page_count`).get().page_count;
      
      // Add and remove data to create fragmentation
      for (let i = 0; i < 50; i++) {
        const session = {
          id: `temp-session-${i}`,
          startTime: new Date(),
          endTime: new Date(),
          status: 'completed',
          jestConfig: {},
          environment: {},
          summary: {}
        };
        await storage.storeSession(session);
      }

      // Delete half the sessions
      for (let i = 0; i < 25; i++) {
        storage.db.prepare(`DELETE FROM sessions WHERE id = ?`).run(`temp-session-${i}`);
      }

      // Run vacuum to reclaim space
      storage.db.prepare(`VACUUM`).run();

      // Database should still be functional
      const remaining = storage.db.prepare(`SELECT COUNT(*) as count FROM sessions WHERE id LIKE 'temp-session-%'`).get();
      expect(remaining.count).toBe(25);
    });
  });
});
