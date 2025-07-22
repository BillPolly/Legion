/**
 * Storage Engine Tests
 * Tests for SQLite database operations and data persistence
 */

import { StorageEngine } from '../../src/storage/StorageEngine.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('StorageEngine', () => {
  let storage;
  const testDbPath = './test-storage-engine.db';

  beforeEach(async () => {
    // Clean up any existing test database
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // File doesn't exist, that's fine
    }
    
    storage = new StorageEngine(testDbPath);
  });

  afterEach(async () => {
    if (storage) {
      await storage.close();
    }
    
    // Clean up test database
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // File doesn't exist, that's fine
    }
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
});
