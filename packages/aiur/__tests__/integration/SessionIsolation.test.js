/**
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import { SessionManager } from '../../src/server/SessionManager.js';
import { PureLegionRequestHandler } from '../../src/server/PureLegionRequestHandler.js';
import WebSocket from 'ws';

// Mock ResourceManager and dependencies
jest.mock('@legion/module-loader', () => ({
  ResourceManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    register: jest.fn(),
    get: jest.fn((key) => {
      const mockValues = {
        'env.NODE_ENV': 'test',
        'LogManager': {
          info: jest.fn(),
          error: jest.fn(),
          debug: jest.fn()
        }
      };
      return mockValues[key];
    })
  }))
}));

// Increase timeout for integration tests
jest.setTimeout(30000);

describe('Session Isolation Integration Tests', () => {
  let sessionManager;
  let requestHandler;

  beforeEach(async () => {
    sessionManager = new SessionManager();
    requestHandler = new PureLegionRequestHandler(sessionManager);
  });

  afterEach(async () => {
    // Clean up all sessions
    if (sessionManager) {
      const sessions = Object.keys(sessionManager.sessions);
      for (const sessionId of sessions) {
        await sessionManager.destroySession(sessionId);
      }
    }
  });

  describe('Session Creation and Management', () => {
    test('should create isolated sessions with unique IDs', async () => {
      const session1 = await sessionManager.createSession();
      const session2 = await sessionManager.createSession();
      const session3 = await sessionManager.createSession();
      
      expect(session1.sessionId).toBeDefined();
      expect(session2.sessionId).toBeDefined();
      expect(session3.sessionId).toBeDefined();
      
      // Each session should have unique ID
      expect(session1.sessionId).not.toBe(session2.sessionId);
      expect(session2.sessionId).not.toBe(session3.sessionId);
      expect(session1.sessionId).not.toBe(session3.sessionId);
      
      // Each session should have independent components
      expect(session1.handleRegistry).not.toBe(session2.handleRegistry);
      expect(session1.contextManager).not.toBe(session2.contextManager);
      expect(session1.toolProvider).not.toBe(session2.toolProvider);
    });

    test('should track active sessions', async () => {
      expect(sessionManager.getActiveSessions()).toHaveLength(0);
      
      const session1 = await sessionManager.createSession();
      expect(sessionManager.getActiveSessions()).toHaveLength(1);
      
      const session2 = await sessionManager.createSession();
      expect(sessionManager.getActiveSessions()).toHaveLength(2);
      
      await sessionManager.destroySession(session1.sessionId);
      expect(sessionManager.getActiveSessions()).toHaveLength(1);
      
      await sessionManager.destroySession(session2.sessionId);
      expect(sessionManager.getActiveSessions()).toHaveLength(0);
    });

    test('should provide session info and statistics', async () => {
      const session = await sessionManager.createSession();
      
      const info = sessionManager.getSessionInfo(session.sessionId);
      expect(info).toEqual({
        sessionId: session.sessionId,
        createdAt: expect.any(Date),
        lastActivity: expect.any(Date),
        handleCount: 0,
        contextCount: 0,
        toolCount: expect.any(Number)
      });
      
      const stats = sessionManager.getSessionStatistics();
      expect(stats).toEqual({
        totalSessions: 1,
        activeSessions: 1,
        totalHandles: 0,
        totalContextItems: 0,
        memoryUsage: expect.any(Object)
      });
    });
  });

  describe('Handle Registry Isolation', () => {
    test('should maintain separate handle registries per session', async () => {
      const session1 = await sessionManager.createSession();
      const session2 = await sessionManager.createSession();
      
      // Add handles to different sessions
      const handle1 = session1.handleRegistry.create('test-data-1', 'test');
      const handle2 = session2.handleRegistry.create('test-data-2', 'test');
      
      expect(handle1).not.toBe(handle2);
      
      // Each session should only see its own handles
      expect(session1.handleRegistry.get(handle1)).toBe('test-data-1');
      expect(session1.handleRegistry.get(handle2)).toBeNull();
      
      expect(session2.handleRegistry.get(handle2)).toBe('test-data-2');
      expect(session2.handleRegistry.get(handle1)).toBeNull();
      
      // Session 1 should have 1 handle, session 2 should have 1 handle
      expect(session1.handleRegistry.list()).toHaveLength(1);
      expect(session2.handleRegistry.list()).toHaveLength(1);
    });

    test('should resolve handles within session context only', async () => {
      const session1 = await sessionManager.createSession();
      const session2 = await sessionManager.createSession();
      
      // Create handles in each session
      const handle1 = session1.handleRegistry.create({ message: 'from session 1' }, 'test');
      const handle2 = session2.handleRegistry.create({ message: 'from session 2' }, 'test');
      
      // Test handle resolution within sessions
      const request1 = {
        tool: 'test_tool',
        arguments: { data: `@${handle1}` }
      };
      
      const request2 = {
        tool: 'test_tool', 
        arguments: { data: `@${handle2}` }
      };
      
      // Resolve within session 1
      const resolved1 = await session1.handleResolver.resolveHandles(request1.arguments, session1.sessionId);
      expect(resolved1.data).toEqual({ message: 'from session 1' });
      
      // Resolve within session 2
      const resolved2 = await session2.handleResolver.resolveHandles(request2.arguments, session2.sessionId);
      expect(resolved2.data).toEqual({ message: 'from session 2' });
    });
  });

  describe('Context Manager Isolation', () => {
    test('should maintain separate context per session', async () => {
      const session1 = await sessionManager.createSession();
      const session2 = await sessionManager.createSession();
      
      // Add context to different sessions
      await session1.contextManager.add('config', { env: 'session1' }, 'Session 1 config');
      await session2.contextManager.add('config', { env: 'session2' }, 'Session 2 config');
      
      // Each session should only see its own context
      const context1 = await session1.contextManager.get('config');
      const context2 = await session2.contextManager.get('config');
      
      expect(context1.data).toEqual({ env: 'session1' });
      expect(context2.data).toEqual({ env: 'session2' });
      
      // List context items per session
      const list1 = await session1.contextManager.list();
      const list2 = await session2.contextManager.list();
      
      expect(list1).toHaveLength(1);
      expect(list2).toHaveLength(1);
      expect(list1[0].name).toBe('config');
      expect(list2[0].name).toBe('config');
      expect(list1[0].data).toEqual({ env: 'session1' });
      expect(list2[0].data).toEqual({ env: 'session2' });
    });

    test('should support context operations with session isolation', async () => {
      const session1 = await sessionManager.createSession();
      const session2 = await sessionManager.createSession();
      
      // Add different context items to each session
      await session1.contextManager.add('user', { id: 1, name: 'User 1' });
      await session1.contextManager.add('preferences', { theme: 'dark' });
      
      await session2.contextManager.add('user', { id: 2, name: 'User 2' });
      await session2.contextManager.add('settings', { language: 'es' });
      
      // Verify isolation
      const session1Context = await session1.contextManager.list();
      const session2Context = await session2.contextManager.list();
      
      expect(session1Context).toHaveLength(2);
      expect(session2Context).toHaveLength(2);
      
      const session1Names = session1Context.map(item => item.name).sort();
      const session2Names = session2Context.map(item => item.name).sort();
      
      expect(session1Names).toEqual(['preferences', 'user']);
      expect(session2Names).toEqual(['settings', 'user']);
      
      // Same name 'user' should have different data
      const user1 = await session1.contextManager.get('user');
      const user2 = await session2.contextManager.get('user');
      
      expect(user1.data.id).toBe(1);
      expect(user2.data.id).toBe(2);
    });
  });

  describe('Tool Provider Isolation', () => {
    test('should provide same tools to all sessions but maintain separate state', async () => {
      const session1 = await sessionManager.createSession();
      const session2 = await sessionManager.createSession();
      
      // Both sessions should have access to the same tools
      const tools1 = await session1.toolProvider.getAvailableTools();
      const tools2 = await session2.toolProvider.getAvailableTools();
      
      expect(tools1.length).toBeGreaterThan(0);
      expect(tools2.length).toBe(tools1.length);
      
      // Tool names should be the same
      const toolNames1 = tools1.map(tool => tool.name).sort();
      const toolNames2 = tools2.map(tool => tool.name).sort();
      
      expect(toolNames1).toEqual(toolNames2);
    });
  });

  describe('Session Timeout and Cleanup', () => {
    test('should handle session timeout', async () => {
      // Create session with short timeout
      sessionManager.defaultTimeout = 100; // 100ms for testing
      
      const session = await sessionManager.createSession();
      const sessionId = session.sessionId;
      
      expect(sessionManager.getSession(sessionId)).toBeDefined();
      
      // Wait for timeout + some buffer
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Session should still exist (timeout doesn't auto-destroy unless triggered)
      expect(sessionManager.getSession(sessionId)).toBeDefined();
      
      // Manually trigger cleanup
      await sessionManager.cleanupInactiveSessions();
      
      // Now session should be destroyed
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });

    test('should update last activity on session access', async () => {
      const session = await sessionManager.createSession();
      const initialActivity = session.lastActivity;
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Access session (should update activity)
      sessionManager.getSession(session.sessionId);
      const updatedActivity = sessionManager.getSession(session.sessionId).lastActivity;
      
      expect(updatedActivity.getTime()).toBeGreaterThan(initialActivity.getTime());
    });
  });

  describe('Request Handler Integration', () => {
    test('should route requests to correct session contexts', async () => {
      const session1 = await sessionManager.createSession();
      const session2 = await sessionManager.createSession();
      
      // Add context to session 1
      const contextAddRequest1 = {
        tool: 'context_add',
        arguments: {
          name: 'session_data',
          data: { sessionId: 1, value: 'session-1-data' },
          description: 'Session 1 data'
        }
      };
      
      // Add context to session 2  
      const contextAddRequest2 = {
        tool: 'context_add',
        arguments: {
          name: 'session_data',
          data: { sessionId: 2, value: 'session-2-data' },
          description: 'Session 2 data'
        }
      };
      
      // Execute requests in different sessions
      const result1 = await requestHandler.handleRequest(contextAddRequest1, session1.sessionId);
      const result2 = await requestHandler.handleRequest(contextAddRequest2, session2.sessionId);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      
      // Retrieve context from each session
      const getRequest = {
        tool: 'context_get',
        arguments: { name: 'session_data' }
      };
      
      const getResult1 = await requestHandler.handleRequest(getRequest, session1.sessionId);
      const getResult2 = await requestHandler.handleRequest(getRequest, session2.sessionId);
      
      expect(getResult1.success).toBe(true);
      expect(getResult2.success).toBe(true);
      
      expect(getResult1.data.data.sessionId).toBe(1);
      expect(getResult2.data.data.sessionId).toBe(2);
    });

    test('should handle concurrent requests across sessions', async () => {
      const session1 = await sessionManager.createSession();
      const session2 = await sessionManager.createSession();
      const session3 = await sessionManager.createSession();
      
      const requests = [
        // Session 1 requests
        requestHandler.handleRequest({
          tool: 'context_add',
          arguments: { name: 'data1', data: { value: 1 } }
        }, session1.sessionId),
        
        // Session 2 requests
        requestHandler.handleRequest({
          tool: 'context_add', 
          arguments: { name: 'data2', data: { value: 2 } }
        }, session2.sessionId),
        
        // Session 3 requests
        requestHandler.handleRequest({
          tool: 'context_add',
          arguments: { name: 'data3', data: { value: 3 } }
        }, session3.sessionId),
        
        // Cross-session list requests
        requestHandler.handleRequest({
          tool: 'context_list',
          arguments: {}
        }, session1.sessionId),
        
        requestHandler.handleRequest({
          tool: 'context_list', 
          arguments: {}
        }, session2.sessionId)
      ];
      
      const results = await Promise.all(requests);
      
      // All requests should succeed
      expect(results.every(result => result.success)).toBe(true);
      
      // List results should show isolation
      const listResult1 = results[3]; // session1 list
      const listResult2 = results[4]; // session2 list
      
      expect(listResult1.data.length).toBe(1);
      expect(listResult2.data.length).toBe(1);
      
      expect(listResult1.data[0].name).toBe('data1');
      expect(listResult2.data[0].name).toBe('data2');
    });
  });

  describe('Memory Management', () => {
    test('should track memory usage per session', async () => {
      const initialStats = sessionManager.getSessionStatistics();
      
      // Create multiple sessions with data
      const sessions = [];
      for (let i = 0; i < 5; i++) {
        const session = await sessionManager.createSession();
        sessions.push(session);
        
        // Add some context data
        await session.contextManager.add(`data_${i}`, { 
          large_data: new Array(1000).fill(`session_${i}_data`) 
        });
        
        // Add some handles
        session.handleRegistry.create({ session: i, data: new Array(500).fill(i) }, 'test');
      }
      
      const finalStats = sessionManager.getSessionStatistics();
      
      expect(finalStats.totalSessions).toBe(5);
      expect(finalStats.activeSessions).toBe(5);
      expect(finalStats.totalContextItems).toBe(5);
      expect(finalStats.totalHandles).toBe(5);
      
      // Memory usage should have increased
      expect(finalStats.memoryUsage.heapUsed).toBeGreaterThan(initialStats.memoryUsage.heapUsed);
    });

    test('should clean up memory when sessions are destroyed', async () => {
      const sessions = [];
      
      // Create sessions with significant data
      for (let i = 0; i < 3; i++) {
        const session = await sessionManager.createSession();
        sessions.push(session);
        
        await session.contextManager.add(`large_data_${i}`, {
          data: new Array(10000).fill(`large_data_${i}`)
        });
      }
      
      const beforeCleanup = sessionManager.getSessionStatistics();
      
      // Destroy all sessions
      for (const session of sessions) {
        await sessionManager.destroySession(session.sessionId);
      }
      
      const afterCleanup = sessionManager.getSessionStatistics();
      
      expect(afterCleanup.totalSessions).toBe(0);
      expect(afterCleanup.activeSessions).toBe(0);
      expect(afterCleanup.totalContextItems).toBe(0);
      expect(afterCleanup.totalHandles).toBe(0);
    });
  });
});