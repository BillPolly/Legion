/**
 * DatabaseManager unit tests
 * 
 * Following TDD approach - tests written before implementation
 */

import { jest } from '@jest/globals';
import { DatabaseManager } from '../../src/DatabaseManager.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = path.join(__dirname, 'test.db');

describe('DatabaseManager', () => {
  beforeEach(async () => {
    // Clean up test database before each test
    try {
      await fs.unlink(TEST_DB_PATH);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  afterEach(async () => {
    // Clean up test database after each test
    try {
      await fs.unlink(TEST_DB_PATH);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  describe('Database connection and initialization', () => {
    test('should create database file if not exists', async () => {
      const db = new DatabaseManager(TEST_DB_PATH);
      await db.initialize();

      // Check that database file was created
      const stats = await fs.stat(TEST_DB_PATH);
      expect(stats.isFile()).toBe(true);

      await db.close();
    });

    test('should connect to existing database', async () => {
      // Create database first
      const db1 = new DatabaseManager(TEST_DB_PATH);
      await db1.initialize();
      await db1.close();

      // Connect to existing database
      const db2 = new DatabaseManager(TEST_DB_PATH);
      await db2.initialize();
      
      // Should be able to perform operations
      const runId = await db2.createRun({ testPattern: '*.test.js' });
      expect(runId).toBeTruthy();
      expect(typeof runId).toBe('string');

      await db2.close();
    });

    test('should handle connection errors gracefully', async () => {
      // Use invalid path
      const db = new DatabaseManager('/invalid/path/to/database.db');
      
      await expect(db.initialize()).rejects.toThrow();
    });
  });

  describe('Schema creation and migrations', () => {
    test('should create all required tables', async () => {
      const db = new DatabaseManager(TEST_DB_PATH);
      await db.initialize();

      // Check tables exist
      const tables = await db.getTables();
      expect(tables).toContain('runs');
      expect(tables).toContain('events');
      expect(tables).toContain('tests');
      expect(tables).toContain('failures');
      expect(tables).toContain('console_logs');
      expect(tables).toContain('open_handles');

      await db.close();
    });

    test('should create indexes', async () => {
      const db = new DatabaseManager(TEST_DB_PATH);
      await db.initialize();

      // Check indexes exist
      const indexes = await db.getIndexes();
      expect(indexes).toContain('idx_runs_created');
      expect(indexes).toContain('idx_events_run_timestamp');
      expect(indexes).toContain('idx_tests_run_status');
      expect(indexes).toContain('idx_console_run_test');

      await db.close();
    });

    test('should handle schema already exists', async () => {
      const db = new DatabaseManager(TEST_DB_PATH);
      await db.initialize();
      
      // Initialize again - should not throw
      await expect(db.initialize()).resolves.not.toThrow();

      await db.close();
    });

    test('should validate schema version', async () => {
      const db = new DatabaseManager(TEST_DB_PATH);
      await db.initialize();

      const version = await db.getSchemaVersion();
      expect(version).toBe(1);

      await db.close();
    });
  });

  describe('Run management', () => {
    let db;

    beforeEach(async () => {
      db = new DatabaseManager(TEST_DB_PATH);
      await db.initialize();
    });

    afterEach(async () => {
      await db.close();
    });

    test('should create new run with UUID', async () => {
      const options = { testPattern: '*.test.js', coverage: true };
      const runId = await db.createRun(options);

      expect(runId).toBeTruthy();
      expect(runId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    test('should store run options as JSON', async () => {
      const options = { testPattern: '*.test.js', coverage: true, maxWorkers: 4 };
      const runId = await db.createRun(options);

      const run = await db.getRun(runId);
      expect(run.options).toEqual(options);
    });

    test('should update run status', async () => {
      const runId = await db.createRun({});
      
      await db.updateRunStatus(runId, 'running');
      let run = await db.getRun(runId);
      expect(run.status).toBe('running');

      await db.updateRunStatus(runId, 'completed');
      run = await db.getRun(runId);
      expect(run.status).toBe('completed');
    });

    test('should mark run as completed with summary', async () => {
      const runId = await db.createRun({});
      const summary = {
        totalTests: 10,
        passed: 8,
        failed: 2,
        duration: 1234
      };

      await db.completeRun(runId, summary);
      
      const run = await db.getRun(runId);
      expect(run.status).toBe('completed');
      expect(run.summary).toEqual(summary);
      expect(run.completed_at).toBeTruthy();
    });
  });

  describe('Event recording', () => {
    let db;
    let runId;

    beforeEach(async () => {
      db = new DatabaseManager(TEST_DB_PATH);
      await db.initialize();
      runId = await db.createRun({});
    });

    afterEach(async () => {
      await db.close();
    });

    test('should record run_start event', async () => {
      const event = {
        runId,
        type: 'run_start',
        timestamp: Date.now(),
        data: { numTotalTestSuites: 5 }
      };

      await db.recordEvent(event);

      const events = await db.getEvents(runId);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('run_start');
      expect(events[0].data).toEqual(event.data);
    });

    test('should record test_start event', async () => {
      const event = {
        runId,
        type: 'test_start',
        timestamp: Date.now(),
        testPath: '/path/to/test.js',
        data: {}
      };

      await db.recordEvent(event);

      const events = await db.getEvents(runId);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('test_start');
    });

    test('should record test_result event', async () => {
      const event = {
        runId,
        type: 'test_result',
        timestamp: Date.now(),
        data: {
          testPath: '/path/to/test.js',
          duration: 100,
          status: 'passed'
        }
      };

      await db.recordEvent(event);

      const events = await db.getEvents(runId);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('test_result');
    });

    test('should record run_complete event', async () => {
      const event = {
        runId,
        type: 'run_complete',
        timestamp: Date.now(),
        data: {
          numTotalTests: 10,
          numPassedTests: 8,
          numFailedTests: 2
        }
      };

      await db.recordEvent(event);

      const events = await db.getEvents(runId);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('run_complete');
    });

    test('should maintain event ordering by timestamp', async () => {
      const baseTime = Date.now();
      const events = [
        { runId, type: 'run_start', timestamp: baseTime, data: {} },
        { runId, type: 'test_start', timestamp: baseTime + 100, data: {} },
        { runId, type: 'test_result', timestamp: baseTime + 200, data: {} },
        { runId, type: 'run_complete', timestamp: baseTime + 300, data: {} }
      ];

      // Insert in random order
      await db.recordEvent(events[2]);
      await db.recordEvent(events[0]);
      await db.recordEvent(events[3]);
      await db.recordEvent(events[1]);

      const retrievedEvents = await db.getEvents(runId);
      expect(retrievedEvents).toHaveLength(4);
      
      // Check they're ordered by timestamp
      for (let i = 0; i < retrievedEvents.length - 1; i++) {
        expect(retrievedEvents[i].timestamp).toBeLessThanOrEqual(retrievedEvents[i + 1].timestamp);
      }
    });
  });
});