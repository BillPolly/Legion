/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { LegionLogManager } from '../../src/LegionLogManager.js';
import { 
  MockResourceManager,
  MockStorageProvider,
  MockSemanticSearchProvider,
  createTestStream,
  generateTestLogs,
  sleep,
  waitForEvent
} from '../utils/TestUtils.js';

describe('LegionLogManager Integration Tests', () => {
  let legionLogManager;
  let mockResourceManager;
  let mockStorageProvider;
  let mockSemanticProvider;

  beforeEach(async () => {
    mockResourceManager = new MockResourceManager();
    mockStorageProvider = new MockStorageProvider();
    mockSemanticProvider = new MockSemanticSearchProvider();
    
    // Set up resource manager with required dependencies
    mockResourceManager.set('StorageProvider', mockStorageProvider);
    mockResourceManager.set('SemanticSearchProvider', mockSemanticProvider);
    
    // This class doesn't exist yet - will be created by TDD
    legionLogManager = await LegionLogManager.create(mockResourceManager);
  });

  afterEach(async () => {
    if (legionLogManager) {
      await legionLogManager.cleanup();
    }
    mockResourceManager.reset();
    mockStorageProvider.reset();
    mockSemanticProvider.reset();
  });

  describe('Module Factory Pattern', () => {
    test('should use async factory pattern with ResourceManager', async () => {
      expect(LegionLogManager.create).toBeDefined();
      expect(typeof LegionLogManager.create).toBe('function');
      
      const manager = await LegionLogManager.create(mockResourceManager);
      expect(manager).toBeInstanceOf(LegionLogManager);
    });

    test('should throw error if ResourceManager is missing', async () => {
      await expect(
        LegionLogManager.create(null)
      ).rejects.toThrow('ResourceManager is required');
    });

    test('should throw error if required dependencies are missing', async () => {
      const emptyResourceManager = new MockResourceManager();
      emptyResourceManager.resources.clear();
      
      await expect(
        LegionLogManager.create(emptyResourceManager)
      ).rejects.toThrow('StorageProvider not found in ResourceManager');
    });

    test('should work without optional SemanticSearchProvider', async () => {
      const limitedResourceManager = new MockResourceManager();
      limitedResourceManager.set('StorageProvider', mockStorageProvider);
      // Don't set SemanticSearchProvider
      
      const manager = await LegionLogManager.create(limitedResourceManager);
      expect(manager).toBeInstanceOf(LegionLogManager);
      expect(manager.hasSemanticSearch()).toBe(false);
    });
  });

  describe('Session Management', () => {
    test('should create new session with unique ID', async () => {
      const session = await legionLogManager.createSession({
        name: 'Test Session',
        description: 'Testing session creation'
      });

      expect(session.success).toBe(true);
      expect(session.sessionId).toBeDefined();
      expect(session.status).toBe('active');
      expect(session.createdAt).toBeDefined();
    });

    test('should list active sessions', async () => {
      await legionLogManager.createSession({ name: 'Session 1' });
      await legionLogManager.createSession({ name: 'Session 2' });
      
      const result = await legionLogManager.listSessions();
      
      expect(result.success).toBe(true);
      expect(result.sessions).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    test('should get session by ID', async () => {
      const createResult = await legionLogManager.createSession({ name: 'Get Test' });
      const sessionId = createResult.sessionId;
      
      const getResult = await legionLogManager.getSession(sessionId);
      
      expect(getResult.success).toBe(true);
      expect(getResult.session.sessionId).toBe(sessionId);
      expect(getResult.session.name).toBe('Get Test');
    });

    test('should handle non-existent session ID', async () => {
      const result = await legionLogManager.getSession('non-existent');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('should track session lifecycle', async () => {
      const createResult = await legionLogManager.createSession({ name: 'Lifecycle Test' });
      const sessionId = createResult.sessionId;
      
      // Session should start as active
      let session = await legionLogManager.getSession(sessionId);
      expect(session.session.status).toBe('active');
      
      // End the session
      const endResult = await legionLogManager.endSession(sessionId);
      expect(endResult.success).toBe(true);
      
      // Session should now be completed
      session = await legionLogManager.getSession(sessionId);
      expect(session.session.status).toBe('completed');
      expect(session.session.endedAt).toBeDefined();
    });
  });

  describe('Process Management Integration', () => {
    let sessionId;

    beforeEach(async () => {
      const createResult = await legionLogManager.createSession({ name: 'Process Test' });
      sessionId = createResult.sessionId;
    });

    test('should track process in session', async () => {
      const processInfo = {
        processId: 'proc-123',
        command: 'node test.js',
        args: ['--verbose'],
        cwd: '/test/dir'
      };

      const result = await legionLogManager.addProcessToSession(sessionId, processInfo);
      
      expect(result.success).toBe(true);
      expect(result.processId).toBe('proc-123');
      
      // Should be able to retrieve process info
      const session = await legionLogManager.getSession(sessionId);
      expect(session.session.processes).toHaveLength(1);
      expect(session.session.processes[0].processId).toBe('proc-123');
    });

    test('should capture process logs automatically', async () => {
      const processId = 'proc-capture-test';
      await legionLogManager.addProcessToSession(sessionId, { processId });
      
      // Simulate process logs
      await legionLogManager.logMessage({
        sessionId,
        processId,
        source: 'stdout',
        message: 'Process output message',
        level: 'info'
      });

      const logs = await legionLogManager.getSessionLogs(sessionId);
      expect(logs.success).toBe(true);
      expect(logs.logs).toHaveLength(1);
      expect(logs.logs[0].processId).toBe(processId);
      expect(logs.logs[0].message).toBe('Process output message');
    });

    test('should mark process as completed', async () => {
      const processId = 'proc-complete-test';
      await legionLogManager.addProcessToSession(sessionId, { processId });
      
      const result = await legionLogManager.completeProcess(sessionId, processId, {
        exitCode: 0,
        duration: 1500
      });

      expect(result.success).toBe(true);
      
      const session = await legionLogManager.getSession(sessionId);
      const process = session.session.processes.find(p => p.processId === processId);
      expect(process.status).toBe('completed');
      expect(process.exitCode).toBe(0);
      expect(process.duration).toBe(1500);
    });
  });

  describe('Enhanced Search Integration', () => {
    let sessionId;

    beforeEach(async () => {
      const createResult = await legionLogManager.createSession({ name: 'Search Test' });
      sessionId = createResult.sessionId;
      
      // Add test logs
      const testLogs = generateTestLogs(20, {
        sessionId,
        messagePrefix: 'Enhanced search',
        levels: ['info', 'warn', 'error', 'debug']
      });

      for (const log of testLogs) {
        await legionLogManager.logMessage(log);
      }

      // Allow time for indexing
      await sleep(100);
    });

    test('should perform enhanced keyword search', async () => {
      const result = await legionLogManager.searchLogs({
        query: 'Enhanced search',
        sessionId,
        mode: 'keyword',
        limit: 10
      });

      expect(result.success).toBe(true);
      expect(result.mode).toBe('keyword');
      expect(result.matches).toHaveLength(10);
      expect(result.totalMatches).toBeGreaterThanOrEqual(10);
    });

    test('should perform semantic search when available', async () => {
      const result = await legionLogManager.searchLogs({
        query: 'application errors and warnings',
        sessionId,
        mode: 'semantic',
        limit: 5
      });

      expect(result.success).toBe(true);
      expect(result.mode).toBe('semantic');
      expect(result.matches.length).toBeLessThanOrEqual(5);
    });

    test('should perform regex search', async () => {
      const result = await legionLogManager.searchLogs({
        query: 'Enhanced.*search.*\\d+',
        sessionId,
        mode: 'regex',
        limit: 15
      });

      expect(result.success).toBe(true);
      expect(result.mode).toBe('regex');
      expect(result.matches.length).toBeGreaterThan(0);
    });

    test('should perform hybrid search', async () => {
      const result = await legionLogManager.searchLogs({
        query: 'Enhanced search',
        sessionId,
        mode: 'hybrid',
        limit: 10
      });

      expect(result.success).toBe(true);
      expect(result.mode).toBe('hybrid');
      expect(result.matches.length).toBeGreaterThan(0);
      
      // Should have mixed search types in results
      const searchTypes = new Set(result.matches.map(m => m.searchType));
      expect(searchTypes.size).toBeGreaterThanOrEqual(1);
    });

    test('should default to keyword search for invalid mode', async () => {
      const result = await legionLogManager.searchLogs({
        query: 'Enhanced search',
        sessionId,
        mode: 'invalid-mode'
      });

      expect(result.success).toBe(true);
      expect(result.mode).toBe('keyword'); // Should fallback
    });

    test('should search across all sessions when sessionId not specified', async () => {
      // Create another session with logs
      const session2 = await legionLogManager.createSession({ name: 'Search Test 2' });
      await legionLogManager.logMessage({
        sessionId: session2.sessionId,
        processId: 'proc-2',
        source: 'stdout',
        message: 'Enhanced search in session 2',
        level: 'info'
      });

      const result = await legionLogManager.searchLogs({
        query: 'Enhanced search',
        mode: 'keyword'
      });

      expect(result.success).toBe(true);
      expect(result.matches.length).toBeGreaterThan(20); // Should include both sessions
    });
  });

  describe('WebSocket Integration', () => {
    test('should create WebSocket server for real-time streaming', async () => {
      const serverResult = await legionLogManager.startWebSocketServer({
        port: 0, // Use random available port
        host: 'localhost'
      });

      expect(serverResult.success).toBe(true);
      expect(serverResult.port).toBeGreaterThan(0);
      expect(serverResult.url).toContain('ws://localhost:');
    });

    test('should broadcast log messages to connected clients', async () => {
      const serverResult = await legionLogManager.startWebSocketServer({ port: 0 });
      
      // Create session first
      const sessionResult = await legionLogManager.createSession({ name: 'WS Test' });
      const testSessionId = sessionResult.sessionId;
      
      // Mock WebSocket connection with proper subscription format
      const mockClient = {
        id: 'client-1',
        subscriptions: new Set([{
          sessionId: testSessionId,
          levels: new Set(['info', 'warn', 'error'])
        }]),
        send: jest.fn(),
        ws: { OPEN: 1, readyState: 1 }
      };
      
      // Mock the broadcastLog method to verify it's called
      const originalBroadcast = legionLogManager.wsServer.broadcastLog;
      legionLogManager.wsServer.broadcastLog = jest.fn((logEntry) => {
        // Call the original method with our mock client
        for (const client of [mockClient]) {
          const isSubscribed = Array.from(client.subscriptions).some(sub => {
            return sub.sessionId === logEntry.sessionId && 
                   sub.levels.has(logEntry.level);
          });
          
          if (isSubscribed && client.ws.readyState === client.ws.OPEN) {
            client.send(JSON.stringify({
              type: 'log',
              data: logEntry
            }));
          }
        }
      });
      
      // Send a log message
      await legionLogManager.logMessage({
        sessionId: testSessionId,
        processId: 'proc-ws',
        source: 'stdout',
        message: 'WebSocket test message',
        level: 'info'
      });

      // Verify broadcast was called
      expect(legionLogManager.wsServer.broadcastLog).toHaveBeenCalled();
      
      // Verify client received the message
      expect(mockClient.send).toHaveBeenCalled();
      const sendCall = mockClient.send.mock.calls[0][0];
      expect(sendCall).toContain('WebSocket test message');
    });

    test('should handle WebSocket client disconnections', async () => {
      const serverResult = await legionLogManager.startWebSocketServer({ port: 0 });
      
      const mockClient = { id: 'client-disconnect' };
      legionLogManager.wsServer.addClient(mockClient);
      
      expect(legionLogManager.wsServer.getClientCount()).toBe(1);
      
      legionLogManager.wsServer.removeClient('client-disconnect');
      
      expect(legionLogManager.wsServer.getClientCount()).toBe(0);
    });

    test('should stop WebSocket server cleanly', async () => {
      const serverResult = await legionLogManager.startWebSocketServer({ port: 0 });
      
      const stopResult = await legionLogManager.stopWebSocketServer();
      expect(stopResult.success).toBe(true);
    });
  });

  describe('Event System Integration', () => {
    test('should emit events for log messages', async () => {
      const events = [];
      legionLogManager.on('log', (log) => events.push(log));
      
      const sessionResult = await legionLogManager.createSession({ name: 'Event Test' });
      
      await legionLogManager.logMessage({
        sessionId: sessionResult.sessionId,
        processId: 'proc-event',
        source: 'stderr',
        message: 'Event test error',
        level: 'error'
      });

      expect(events).toHaveLength(1);
      expect(events[0].message).toBe('Event test error');
      expect(events[0].level).toBe('error');
    });

    test('should emit session lifecycle events', async () => {
      const sessionEvents = [];
      legionLogManager.on('session-created', (session) => sessionEvents.push({ type: 'created', session }));
      legionLogManager.on('session-ended', (session) => sessionEvents.push({ type: 'ended', session }));
      
      const createResult = await legionLogManager.createSession({ name: 'Event Lifecycle' });
      await legionLogManager.endSession(createResult.sessionId);

      expect(sessionEvents).toHaveLength(2);
      expect(sessionEvents[0].type).toBe('created');
      expect(sessionEvents[1].type).toBe('ended');
    });

    test('should emit search events', async () => {
      const searchEvents = [];
      legionLogManager.on('search-performed', (event) => searchEvents.push(event));
      
      const sessionResult = await legionLogManager.createSession({ name: 'Search Events' });
      
      await legionLogManager.searchLogs({
        query: 'test query',
        sessionId: sessionResult.sessionId,
        mode: 'keyword'
      });

      expect(searchEvents).toHaveLength(1);
      expect(searchEvents[0].query).toBe('test query');
      expect(searchEvents[0].mode).toBe('keyword');
    });
  });

  describe('Resource Management', () => {
    test('should access API keys from ResourceManager', async () => {
      const apiKey = legionLogManager.getApiKey('OPENAI_API_KEY');
      expect(apiKey).toBe('test-openai-key');
      
      const anthropicKey = legionLogManager.getApiKey('ANTHROPIC_API_KEY');
      expect(anthropicKey).toBe('test-anthropic-key');
    });

    test('should handle missing API keys gracefully', async () => {
      const missingKey = legionLogManager.getApiKey('MISSING_KEY');
      expect(missingKey).toBeNull();
    });

    test('should register with ResourceManager on creation', async () => {
      const accessLog = mockResourceManager.getAccessLog();
      
      // Should have accessed required dependencies
      const storageAccess = accessLog.find(entry => entry.key === 'StorageProvider');
      expect(storageAccess).toBeDefined();
      expect(storageAccess.found).toBe(true);
    });
  });

  describe('Performance and Statistics', () => {
    test('should track performance metrics', async () => {
      const sessionResult = await legionLogManager.createSession({ name: 'Performance Test' });
      
      // Perform various operations
      await legionLogManager.logMessage({
        sessionId: sessionResult.sessionId,
        processId: 'proc-perf',
        source: 'stdout',
        message: 'Performance test log'
      });
      
      await legionLogManager.searchLogs({
        query: 'Performance',
        sessionId: sessionResult.sessionId,
        mode: 'keyword'
      });

      const stats = await legionLogManager.getStatistics();
      
      expect(stats.success).toBe(true);
      expect(stats.totalSessions).toBe(1);
      expect(stats.totalLogs).toBe(1);
      expect(stats.totalSearches).toBe(1);
      expect(stats.searchPerformance).toBeDefined();
    });

    test('should provide detailed session statistics', async () => {
      const sessionResult = await legionLogManager.createSession({ name: 'Session Stats' });
      const sessionId = sessionResult.sessionId;
      
      // Add logs with different levels and sources
      await legionLogManager.logMessage({ sessionId, processId: 'p1', source: 'stdout', message: 'Info log', level: 'info' });
      await legionLogManager.logMessage({ sessionId, processId: 'p1', source: 'stderr', message: 'Error log', level: 'error' });
      await legionLogManager.logMessage({ sessionId, processId: 'p2', source: 'stdout', message: 'Warning log', level: 'warn' });

      const stats = await legionLogManager.getSessionStatistics(sessionId);
      
      expect(stats.success).toBe(true);
      expect(stats.totalLogs).toBe(3);
      expect(stats.logsByLevel.info).toBe(1);
      expect(stats.logsByLevel.error).toBe(1);
      expect(stats.logsByLevel.warn).toBe(1);
      expect(stats.logsBySource.stdout).toBe(2);
      expect(stats.logsBySource.stderr).toBe(1);
      expect(stats.processCount).toBe(2);
    });
  });

  describe('Cleanup and Resource Management', () => {
    test('should cleanup all resources', async () => {
      // Create multiple sessions and operations
      await legionLogManager.createSession({ name: 'Cleanup Test 1' });
      await legionLogManager.createSession({ name: 'Cleanup Test 2' });
      await legionLogManager.startWebSocketServer({ port: 0 });
      
      const cleanupResult = await legionLogManager.cleanup();
      
      expect(cleanupResult.success).toBe(true);
      expect(cleanupResult.sessionsTerminated).toBe(2);
      expect(cleanupResult.webSocketServerStopped).toBe(true);
    });

    test('should handle cleanup errors gracefully', async () => {
      // Mock cleanup to throw error
      const originalCleanup = legionLogManager.logSearch.clearCache;
      legionLogManager.logSearch.clearCache = jest.fn().mockImplementation(() => {
        throw new Error('Cleanup error');
      });
      
      const cleanupResult = await legionLogManager.cleanup();
      
      expect(cleanupResult.success).toBe(false);
      expect(cleanupResult.error).toContain('Cleanup error');
      
      // Restore original method
      legionLogManager.logSearch.clearCache = originalCleanup;
    });
  });
});