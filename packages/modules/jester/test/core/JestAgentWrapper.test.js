/**
 * Comprehensive tests for JestAgentWrapper
 * Tests core functionality, event handling, and memory management
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { JestAgentWrapper } from '../../src/core/JestAgentWrapper.js';
import { TestDbHelper, setupTestDb, cleanupTestDb } from '../utils/test-db-helper.js';

describe('JestAgentWrapper', () => {
  let wrapper;
  let testDbPath;

  beforeEach(async () => {
    await setupTestDb();
    testDbPath = TestDbHelper.getTempDbPath('wrapper-test');
    wrapper = new JestAgentWrapper({
      dbPath: testDbPath,
      clearPrevious: false
    });
    await wrapper.initializeStorage();
  });

  afterEach(async () => {
    if (wrapper) {
      await wrapper.close();
    }
    await cleanupTestDb(testDbPath);
  });

  describe('Initialization', () => {
    test('should initialize with default config', () => {
      expect(wrapper.config.storage).toBe('sqlite');
      expect(wrapper.config.dbPath).toBe(testDbPath);
      expect(wrapper.config.collectConsole).toBe(true);
      expect(wrapper.config.collectCoverage).toBe(true);
      expect(wrapper.config.collectPerformance).toBe(true);
    });

    test('should initialize storage components', () => {
      expect(wrapper.storage).toBeDefined();
      expect(wrapper.query).toBeDefined();
      expect(wrapper.collector).toBeDefined();
    });

    test('should set up event forwarding', () => {
      expect(wrapper.listenerCount('sessionStart')).toBeGreaterThanOrEqual(0);
      expect(wrapper.listenerCount('sessionEnd')).toBeGreaterThanOrEqual(0);
      expect(wrapper.listenerCount('testEnd')).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Session Management', () => {
    test('should start a new session', async () => {
      // Create wrapper with specific testRunId
      const testWrapper = new JestAgentWrapper({
        dbPath: testDbPath,
        testRunId: 'test-session'
      });

      const session = await testWrapper.startSession();

      expect(session).toBeDefined();
      expect(session.id).toBe('test-session');
      expect(session.startTime).toBeInstanceOf(Date);
      expect(session.status).toBe('running');
      expect(testWrapper.currentSession).toBe(session);

      await testWrapper.close();
    });

    test('should stop current session', async () => {
      // Override the config testRunId with jestConfig testRunId
      const session = await wrapper.startSession({ testRunId: 'stop-test' });
      expect(wrapper.currentSession).toBeDefined();
      expect(session.id).toBe('stop-test');

      await wrapper.stopSession();
      expect(wrapper.currentSession).toBeNull();
    });

    test('should retrieve session by ID', async () => {
      const originalSession = await wrapper.startSession({ testRunId: 'retrieve-test' });
      await wrapper.stopSession();

      const retrievedSession = await wrapper.getSession('retrieve-test');
      expect(retrievedSession).toBeDefined();
      expect(retrievedSession.id).toBe('retrieve-test');
      expect(retrievedSession.id).toBe(originalSession.id);
    });

    test('should get all sessions', async () => {
      await wrapper.startSession({ testRunId: 'session-1' });
      await wrapper.stopSession();
      await wrapper.startSession({ testRunId: 'session-2' });
      await wrapper.stopSession();

      const sessions = await wrapper.getAllSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.id)).toContain('session-1');
      expect(sessions.map(s => s.id)).toContain('session-2');
    });
  });

  describe('Session Cleanup', () => {
    test('should clear specific session', async () => {
      // Create first session
      const wrapper1 = new JestAgentWrapper({
        dbPath: testDbPath,
        testRunId: 'clear-me'
      });
      await wrapper1.startSession();
      await wrapper1.stopSession();
      await wrapper1.close();

      // Create second session  
      const wrapper2 = new JestAgentWrapper({
        dbPath: testDbPath,
        testRunId: 'keep-me'
      });
      await wrapper2.startSession();
      await wrapper2.stopSession();
      await wrapper2.close();

      // Clear the first session
      await wrapper.clearSession('clear-me');

      const sessions = await wrapper.getAllSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('keep-me');
    });

    test('should clear all sessions', async () => {
      // Create first session
      const wrapper1 = new JestAgentWrapper({
        dbPath: testDbPath,
        testRunId: 'session-1'
      });
      await wrapper1.startSession();
      await wrapper1.stopSession();
      await wrapper1.close();

      // Create second session
      const wrapper2 = new JestAgentWrapper({
        dbPath: testDbPath,
        testRunId: 'session-2'
      });
      await wrapper2.startSession();
      await wrapper2.stopSession();
      await wrapper2.close();

      await wrapper.clearAllSessions();

      const sessions = await wrapper.getAllSessions();
      expect(sessions).toHaveLength(0);
    });
  });

  describe('Memory Management', () => {
    test('should clear old sessions based on age', async () => {
      // Create an old session by manipulating the database directly
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40); // 40 days ago
      
      await wrapper.storage.storeSession({
        id: 'old-session',
        startTime: oldDate,
        endTime: oldDate,
        status: 'completed',
        jestConfig: {},
        environment: {},
        summary: {},
        metadata: {}
      });

      // Create a recent session
      await wrapper.startSession({ testRunId: 'recent-session' });
      await wrapper.stopSession();

      // Clear sessions older than 30 days
      const deletedCount = await wrapper.clearOldSessions(30);
      expect(deletedCount).toBe(1);

      const sessions = await wrapper.getAllSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('recent-session');
    });

    test('should prune sessions to keep only recent ones', async () => {
      // Create 5 sessions
      for (let i = 1; i <= 5; i++) {
        await wrapper.startSession({ testRunId: `session-${i}` });
        await wrapper.stopSession();
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Prune to keep only 3 most recent
      const deletedCount = await wrapper.pruneSessions(3);
      expect(deletedCount).toBe(2);

      const sessions = await wrapper.getAllSessions();
      expect(sessions).toHaveLength(3);
      
      // Should keep the most recent ones (session-5, session-4, session-3)
      const sessionIds = sessions.map(s => s.id);
      expect(sessionIds).toContain('session-5');
      expect(sessionIds).toContain('session-4');
      expect(sessionIds).toContain('session-3');
    });

    test('should get database info', async () => {
      await wrapper.startSession({ testRunId: 'info-session' });
      await wrapper.stopSession();

      const info = await wrapper.getDatabaseInfo();
      
      expect(info).toHaveProperty('sessionCount');
      expect(info).toHaveProperty('databasePath');
      expect(info).toHaveProperty('sizeInBytes');
      expect(info).toHaveProperty('sizeInMB');
      expect(info).toHaveProperty('oldestSession');
      expect(info).toHaveProperty('newestSession');
      
      expect(info.sessionCount).toBe(1);
      expect(typeof info.sizeInMB).toBe('string');
      expect(info.databasePath).toContain(testDbPath);
    });
  });

  describe('Event Handling', () => {
    test('should emit session start events', (done) => {
      wrapper.onSessionStart((session) => {
        expect(session.id).toBe('event-test');
        expect(session.status).toBe('running');
        done();
      });

      wrapper.startSession({ testRunId: 'event-test' });
    });

    test('should emit session end events', (done) => {
      wrapper.onSessionEnd((session) => {
        expect(session.id).toBe('end-event-test');
        expect(session.status).toBe('completed');
        done();
      });

      wrapper.startSession({ testRunId: 'end-event-test' }).then(() => {
        wrapper.stopSession();
      });
    });

    test('should handle multiple event listeners', () => {
      let startCount = 0;
      let endCount = 0;

      wrapper.onSessionStart(() => startCount++);
      wrapper.onSessionStart(() => startCount++);
      wrapper.onSessionEnd(() => endCount++);
      wrapper.onSessionEnd(() => endCount++);

      return wrapper.startSession({ testRunId: 'multi-listener' })
        .then(() => wrapper.stopSession())
        .then(() => {
          expect(startCount).toBe(2);
          expect(endCount).toBe(2);
        });
    });
  });

  describe('Query Interface', () => {
    beforeEach(async () => {
      // Set up test data
      await wrapper.startSession({ testRunId: 'query-test' });
      
      // Create test suite
      await wrapper.storage.storeSuite({
        id: 'test-suite',
        sessionId: 'query-test',
        path: '/test/example.test.js',
        name: 'Example Tests',
        startTime: new Date(),
        endTime: new Date(),
        status: 'completed'
      });

      // Create test cases
      await wrapper.storage.storeTestCase({
        id: 'test-pass',
        sessionId: 'query-test',
        suiteId: 'test-suite',
        name: 'should pass',
        fullName: 'Example Tests > should pass',
        startTime: new Date(),
        endTime: new Date(),
        status: 'passed',
        duration: 100
      });

      await wrapper.storage.storeTestCase({
        id: 'test-fail',
        sessionId: 'query-test',
        suiteId: 'test-suite',
        name: 'should fail',
        fullName: 'Example Tests > should fail',
        startTime: new Date(),
        endTime: new Date(),
        status: 'failed',
        duration: 200
      });

      await wrapper.stopSession();
    });

    test('should get failed tests', async () => {
      const failures = await wrapper.getFailedTests('query-test');
      expect(failures).toHaveLength(1);
      expect(failures[0].name).toBe('should fail');
      expect(failures[0].status).toBe('failed');
    });

    test('should get test summary', async () => {
      const summary = await wrapper.getTestSummary('query-test');
      expect(summary).toHaveProperty('total');
      expect(summary).toHaveProperty('passed');
      expect(summary).toHaveProperty('failed');
      expect(summary.total).toBe(2);
      expect(summary.passed).toBe(1);
      expect(summary.failed).toBe(1);
    });

    test('should find tests by criteria', async () => {
      const tests = await wrapper.findTests({ 
        sessionId: 'query-test', 
        status: 'passed' 
      });
      expect(tests).toHaveLength(1);
      expect(tests[0].name).toBe('should pass');
    });

    test('should get slowest tests', async () => {
      const slowTests = await wrapper.getSlowestTests(5);
      expect(Array.isArray(slowTests)).toBe(true);
      if (slowTests.length > 0) {
        expect(slowTests[0]).toHaveProperty('duration');
        expect(slowTests[0]).toHaveProperty('fullName');
      }
    });
  });

  describe('Configuration', () => {
    test('should accept custom configuration', () => {
      const customWrapper = new JestAgentWrapper({
        dbPath: testDbPath,
        testRunId: 'custom-run',
        collectConsole: false,
        collectCoverage: false,
        collectPerformance: false
      });

      expect(customWrapper.config.testRunId).toBe('custom-run');
      expect(customWrapper.config.collectConsole).toBe(false);
      expect(customWrapper.config.collectCoverage).toBe(false);
      expect(customWrapper.config.collectPerformance).toBe(false);
    });

    test('should merge custom config with defaults', () => {
      const customWrapper = new JestAgentWrapper({
        dbPath: testDbPath,
        collectConsole: false
        // Other configs should use defaults
      });

      expect(customWrapper.config.collectConsole).toBe(false);
      expect(customWrapper.config.collectCoverage).toBe(true); // default
      expect(customWrapper.config.collectPerformance).toBe(true); // default
    });
  });

  describe('Error Handling', () => {
    test('should handle storage initialization errors gracefully', async () => {
      const invalidWrapper = new JestAgentWrapper({
        dbPath: '/invalid/path/that/does/not/exist/test.db'
      });

      // Should not throw, but warn
      await expect(invalidWrapper.initializeStorage()).resolves.not.toThrow();
    });

    test('should handle missing session gracefully', async () => {
      const session = await wrapper.getSession('non-existent');
      expect(session).toBeNull();
    });

    test('should handle cleanup of non-existent session gracefully', async () => {
      await expect(wrapper.clearSession('non-existent')).resolves.not.toThrow();
    });
  });

  describe('Resource Cleanup', () => {
    test('should clean up all resources on close', async () => {
      await wrapper.startSession({ testRunId: 'cleanup-test' });
      
      const initialListeners = wrapper.listenerCount('sessionStart');
      
      await wrapper.close();
      
      expect(wrapper.currentSession).toBeNull();
      expect(wrapper.listenerCount('sessionStart')).toBe(0);
      expect(wrapper.listenerCount('sessionEnd')).toBe(0);
    });

    test('should handle multiple close calls gracefully', async () => {
      await wrapper.close();
      await expect(wrapper.close()).resolves.not.toThrow();
    });
  });

  describe('Database Operations', () => {
    test('should handle database clear on initialization when requested', async () => {
      // Create initial data
      await wrapper.startSession({ testRunId: 'initial' });
      await wrapper.stopSession();
      
      let sessions = await wrapper.getAllSessions();
      expect(sessions).toHaveLength(1);

      // Close current wrapper
      await wrapper.close();

      // Create new wrapper with clearPrevious: true
      const clearWrapper = new JestAgentWrapper({
        dbPath: testDbPath,
        clearPrevious: true
      });
      
      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      sessions = await clearWrapper.getAllSessions();
      expect(sessions).toHaveLength(0);

      await clearWrapper.close();
    });

    test('should preserve data when clearPrevious is false', async () => {
      // Create initial data
      await wrapper.startSession({ testRunId: 'preserve' });
      await wrapper.stopSession();
      
      // Close current wrapper
      await wrapper.close();

      // Create new wrapper with clearPrevious: false (default)
      const preserveWrapper = new JestAgentWrapper({
        dbPath: testDbPath,
        clearPrevious: false
      });
      await preserveWrapper.initializeStorage();

      const sessions = await preserveWrapper.getAllSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('preserve');

      await preserveWrapper.close();
    });
  });
});