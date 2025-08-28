/**
 * Multi-Session Support Tests
 * Tests for testRunId, clearPrevious, and multi-session query functionality
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { JestAgentWrapper } from '../../src/core/JestAgentWrapper.js';
import { TestDbHelper, setupTestDb, cleanupTestDb } from '../utils/test-db-helper.js';
import fs from 'fs/promises';
import path from 'path';

describe('Multi-Session Support', () => {
  let testDbPath;
  let jaw;

  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(() => {
    testDbPath = TestDbHelper.getTempDbPath('multi-session');
  });

  afterEach(async () => {
    if (jaw) {
      await jaw.close();
    }
    await cleanupTestDb(testDbPath);
  });

  describe('Test Run ID Support', () => {
    test('should use provided testRunId as session ID', async () => {
      const testRunId = 'sprint-15-integration';
      
      jaw = new JestAgentWrapper({
        dbPath: testDbPath,
        testRunId: testRunId
      });
      
      const session = await jaw.startSession();
      
      expect(session.id).toBe(testRunId);
      expect(session.metadata.testRunId).toBe(testRunId);
    });

    test('should generate session ID when testRunId not provided', async () => {
      jaw = new JestAgentWrapper({
        dbPath: testDbPath
      });
      
      const session = await jaw.startSession();
      
      expect(session.id).toBeDefined();
      expect(session.id).not.toBe('');
      expect(session.metadata.testRunId).toBeNull();
    });

    test('should store session metadata', async () => {
      jaw = new JestAgentWrapper({
        dbPath: testDbPath,
        testRunId: 'metadata-test'
      });
      
      const session = await jaw.startSession({
        name: 'Test Run with Metadata',
        description: 'Testing metadata storage',
        tags: ['unit', 'metadata']
      });
      
      expect(session.metadata.name).toBe('Test Run with Metadata');
      expect(session.metadata.description).toBe('Testing metadata storage');
      expect(session.metadata.tags).toEqual(['unit', 'metadata']);
    });
  });

  describe('Clear Previous Functionality', () => {
    test('should clear database when clearPrevious is true', async () => {
      // Create first session
      jaw = new JestAgentWrapper({
        dbPath: testDbPath,
        testRunId: 'first-run'
      });
      
      await jaw.startSession();
      await jaw.stopSession();
      
      // Verify session exists
      const firstSessions = await jaw.getAllSessions();
      expect(firstSessions.length).toBe(1);
      
      await jaw.close();
      
      // Create second wrapper with clearPrevious
      jaw = new JestAgentWrapper({
        dbPath: testDbPath,
        testRunId: 'second-run',
        clearPrevious: true
      });
      
      // Give it time to clear
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const sessions = await jaw.getAllSessions();
      expect(sessions.length).toBe(0);
    });

    test('should preserve data when clearPrevious is false', async () => {
      // Create first session
      jaw = new JestAgentWrapper({
        dbPath: testDbPath,
        testRunId: 'first-run',
        clearPrevious: false
      });
      
      await jaw.startSession();
      await jaw.stopSession();
      await jaw.close();
      
      // Create second session without clearing
      jaw = new JestAgentWrapper({
        dbPath: testDbPath,
        testRunId: 'second-run',
        clearPrevious: false
      });
      
      await jaw.startSession();
      await jaw.stopSession();
      
      const sessions = await jaw.getAllSessions();
      expect(sessions.length).toBe(2);
      expect(sessions.some(s => s.id === 'first-run')).toBe(true);
      expect(sessions.some(s => s.id === 'second-run')).toBe(true);
    });

    test('should default to keeping history', async () => {
      // Create first session
      jaw = new JestAgentWrapper({
        dbPath: testDbPath,
        testRunId: 'first-run'
      });
      
      await jaw.startSession();
      await jaw.stopSession();
      await jaw.close();
      
      // Create second session with no clearPrevious specified
      jaw = new JestAgentWrapper({
        dbPath: testDbPath,
        testRunId: 'second-run'
      });
      
      const sessions = await jaw.getAllSessions();
      expect(sessions.length).toBe(1);
      expect(sessions[0].id).toBe('first-run');
    });
  });

  describe('Session Management Methods', () => {
    beforeEach(async () => {
      jaw = new JestAgentWrapper({
        dbPath: testDbPath
      });
      
      // Create multiple test sessions
      for (let i = 1; i <= 3; i++) {
        // Use jaw.config to set testRunId for this session
        jaw.config.testRunId = `run-${i}`;
        
        const session = await jaw.startSession({
          name: `Test Run ${i}`,
          description: `Description for run ${i}`
        });
        
        // Create suite first (required for foreign key)
        await jaw.storage.storeSuite({
          id: `suite-${i}`,
          sessionId: `run-${i}`,  // Use the explicit run ID
          path: `/test/suite-${i}.test.js`,
          name: `Suite ${i}`,
          startTime: new Date(),
          endTime: new Date(),
          status: 'completed'
        });
        
        // Then create test data
        await jaw.storage.storeTestCase({
          id: `test-${i}-1`,
          sessionId: `run-${i}`,  // Use the explicit run ID
          suiteId: `suite-${i}`,
          name: `Test ${i}`,
          fullName: `Suite ${i} > Test ${i}`,
          startTime: new Date(),
          endTime: new Date(),
          status: i === 2 ? 'failed' : 'passed',
          duration: 100 * i
        });
        
        await jaw.stopSession();
      }
    });

    test('getAllSessions should return all sessions', async () => {
      const sessions = await jaw.getAllSessions();
      
      expect(sessions.length).toBe(3);
      expect(sessions[0].id).toBe('run-3'); // Most recent first
      expect(sessions[1].id).toBe('run-2');
      expect(sessions[2].id).toBe('run-1');
    });

    test('getSession should return specific session', async () => {
      const session = await jaw.getSession('run-2');
      
      expect(session).toBeDefined();
      expect(session.id).toBe('run-2');
      expect(session.metadata.name).toBe('Test Run 2');
    });

    test('clearSession should remove specific session', async () => {
      await jaw.clearSession('run-2');
      
      const sessions = await jaw.getAllSessions();
      expect(sessions.length).toBe(2);
      expect(sessions.some(s => s.id === 'run-2')).toBe(false);
      
      // Verify related data is also deleted
      const tests = await jaw.findTests({ sessionId: 'run-2' });
      expect(tests.length).toBe(0);
    });

    test('clearAllSessions should remove all sessions', async () => {
      await jaw.clearAllSessions();
      
      const sessions = await jaw.getAllSessions();
      expect(sessions.length).toBe(0);
      
      // Verify all test data is deleted
      const tests = await jaw.findTests({});
      expect(tests.length).toBe(0);
    });
  });

  describe('Multi-Session Query Methods', () => {
    beforeEach(async () => {
      jaw = new JestAgentWrapper({
        dbPath: testDbPath
      });
      
      // Create test sessions with varying results
      const configs = [
        { id: 'run-a', passed: 8, failed: 2, duration: 1000 },
        { id: 'run-b', passed: 10, failed: 0, duration: 800 },
        { id: 'run-c', passed: 5, failed: 5, duration: 1200 }
      ];
      
      for (const config of configs) {
        // Set testRunId in config before starting session
        jaw.config.testRunId = config.id;
        await jaw.startSession();
        
        // Create suite first
        await jaw.storage.storeSuite({
          id: `suite-${config.id}`,
          sessionId: config.id,
          path: `/test/suite.test.js`,
          name: 'Suite',
          startTime: new Date(),
          endTime: new Date(),
          status: 'completed'
        });
        
        // Create test cases
        for (let i = 0; i < config.passed; i++) {
          await jaw.storage.storeTestCase({
            id: `${config.id}-pass-${i}`,
            sessionId: config.id,
            suiteId: `suite-${config.id}`,
            name: `Test ${i}`,
            fullName: `Suite > Test ${i}`,
            startTime: new Date(),
            endTime: new Date(),
            status: 'passed',
            duration: config.duration / (config.passed + config.failed)
          });
        }
        
        for (let i = 0; i < config.failed; i++) {
          await jaw.storage.storeTestCase({
            id: `${config.id}-fail-${i}`,
            sessionId: config.id,
            suiteId: `suite-${config.id}`,
            name: `Test ${config.passed + i}`,
            fullName: `Suite > Test ${config.passed + i}`,
            startTime: new Date(),
            endTime: new Date(),
            status: 'failed',
            duration: config.duration / (config.passed + config.failed)
          });
        }
        
        await jaw.stopSession();
      }
    });

    test('compareSessions should compare multiple sessions', async () => {
      const comparison = await jaw.compareSessions(['run-a', 'run-b', 'run-c']);
      
      expect(comparison.length).toBe(3);
      
      const runA = comparison.find(c => c.sessionId === 'run-a');
      expect(runA.stats.total).toBe(10);
      expect(runA.stats.passed).toBe(8);
      expect(runA.stats.failed).toBe(2);
      expect(runA.stats.passRate).toBe(80);
      
      const runB = comparison.find(c => c.sessionId === 'run-b');
      expect(runB.stats.total).toBe(10);
      expect(runB.stats.passed).toBe(10);
      expect(runB.stats.failed).toBe(0);
      expect(runB.stats.passRate).toBe(100);
      
      const runC = comparison.find(c => c.sessionId === 'run-c');
      expect(runC.stats.total).toBe(10);
      expect(runC.stats.passed).toBe(5);
      expect(runC.stats.failed).toBe(5);
      expect(runC.stats.passRate).toBe(50);
    });

    test('getTestTrends should track test across sessions', async () => {
      // Add same test with different results across sessions
      const testName = 'Flaky Test';
      
      await jaw.storage.storeTestCase({
        id: 'trend-1',
        sessionId: 'run-a',
        suiteId: 'suite-run-a',
        name: testName,
        fullName: `Suite > ${testName}`,
        startTime: new Date('2024-01-01'),
        endTime: new Date('2024-01-01'),
        status: 'passed',
        duration: 100
      });
      
      await jaw.storage.storeTestCase({
        id: 'trend-2',
        sessionId: 'run-b',
        suiteId: 'suite-run-b',
        name: testName,
        fullName: `Suite > ${testName}`,
        startTime: new Date('2024-01-02'),
        endTime: new Date('2024-01-02'),
        status: 'failed',
        duration: 150
      });
      
      await jaw.storage.storeTestCase({
        id: 'trend-3',
        sessionId: 'run-c',
        suiteId: 'suite-run-c',
        name: testName,
        fullName: `Suite > ${testName}`,
        startTime: new Date('2024-01-03'),
        endTime: new Date('2024-01-03'),
        status: 'passed',
        duration: 120
      });
      
      const trends = await jaw.getTestTrends(testName);
      
      expect(trends.length).toBe(3);
      expect(trends[0].sessionId).toBe('run-c'); // Most recent first
      expect(trends[0].status).toBe('passed');
      expect(trends[1].sessionId).toBe('run-b');
      expect(trends[1].status).toBe('failed');
      expect(trends[2].sessionId).toBe('run-a');
      expect(trends[2].status).toBe('passed');
    });
  });

  describe('Default Database Path', () => {
    test('should use fixed default path for persistence', () => {
      jaw = new JestAgentWrapper({});
      
      expect(jaw.config.dbPath).toBe('./test-results.db');
      expect(jaw.config.clearPrevious).toBe(false);
    });

    test('should respect custom database path', () => {
      jaw = new JestAgentWrapper({
        dbPath: './custom-path.db'
      });
      
      expect(jaw.config.dbPath).toBe('./custom-path.db');
    });
  });
});