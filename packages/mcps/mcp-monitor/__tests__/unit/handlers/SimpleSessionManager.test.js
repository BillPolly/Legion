/**
 * Unit tests for SimpleSessionManager
 */

import { jest } from '@jest/globals';
import { SimpleSessionManager } from '../../../handlers/SimpleSessionManager.js';
import { FullStackMonitor } from '@legion/fullstack-monitor';
import { ResourceManager } from '@legion/resource-manager';

// Mock the dependencies
jest.mock('@legion/fullstack-monitor');
jest.mock('@legion/resource-manager');

describe('SimpleSessionManager', () => {
  let sessionManager;
  let mockMonitor;
  let mockResourceManager;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock instances
    mockMonitor = {
      cleanup: jest.fn(),
      monitorFullStackApp: jest.fn(),
      openPage: jest.fn()
    };
    
    mockResourceManager = {
      initialize: jest.fn()
    };
    
    // Setup mock implementations
    ResourceManager.getInstance = jest.fn().mockReturnValue(mockResourceManager);
    FullStackMonitor.create = jest.fn().mockResolvedValue(mockMonitor);
    
    // Create session manager instance
    sessionManager = new SimpleSessionManager(9902);
  });

  describe('Constructor', () => {
    test('should initialize with default port', () => {
      const manager = new SimpleSessionManager();
      expect(manager.wsAgentPort).toBe(9901);
      expect(manager.monitor).toBeNull();
      expect(manager.activeSessions).toBeInstanceOf(Set);
    });

    test('should accept custom port', () => {
      const manager = new SimpleSessionManager(9999);
      expect(manager.wsAgentPort).toBe(9999);
    });
  });

  describe('getMonitor()', () => {
    test('should create monitor on first call', async () => {
      const monitor = await sessionManager.getMonitor();
      
      expect(ResourceManager.getInstance).toHaveBeenCalled();
      expect(FullStackMonitor.create).toHaveBeenCalledWith(
        mockResourceManager,
        { wsAgentPort: 9902 }
      );
      expect(monitor).toBe(mockMonitor);
    });

    test('should return same monitor on subsequent calls', async () => {
      const monitor1 = await sessionManager.getMonitor();
      const monitor2 = await sessionManager.getMonitor();
      
      expect(FullStackMonitor.create).toHaveBeenCalledTimes(1);
      expect(monitor1).toBe(monitor2);
    });

    test('should pass wsAgentPort to FullStackMonitor', async () => {
      await sessionManager.getMonitor();
      
      expect(FullStackMonitor.create).toHaveBeenCalledWith(
        mockResourceManager,
        { wsAgentPort: 9902 }
      );
    });
  });

  describe('Session Management', () => {
    test('should add session', () => {
      sessionManager.addSession('test-session-1');
      sessionManager.addSession('test-session-2');
      
      expect(sessionManager.activeSessions.size).toBe(2);
      expect(sessionManager.activeSessions.has('test-session-1')).toBe(true);
      expect(sessionManager.activeSessions.has('test-session-2')).toBe(true);
    });

    test('should remove session', () => {
      sessionManager.addSession('test-session-1');
      sessionManager.addSession('test-session-2');
      sessionManager.removeSession('test-session-1');
      
      expect(sessionManager.activeSessions.size).toBe(1);
      expect(sessionManager.activeSessions.has('test-session-1')).toBe(false);
      expect(sessionManager.activeSessions.has('test-session-2')).toBe(true);
    });

    test('should handle removing non-existent session', () => {
      sessionManager.addSession('test-session-1');
      sessionManager.removeSession('non-existent');
      
      expect(sessionManager.activeSessions.size).toBe(1);
      expect(sessionManager.activeSessions.has('test-session-1')).toBe(true);
    });
  });

  describe('listSessions()', () => {
    test('should return empty object when no sessions', () => {
      const sessions = sessionManager.listSessions();
      expect(sessions).toEqual({ active: [], count: 0 });
    });

    test('should return all active sessions', () => {
      sessionManager.addSession('session-1');
      sessionManager.addSession('session-2');
      sessionManager.addSession('session-3');
      
      const sessions = sessionManager.listSessions();
      expect(sessions.count).toBe(3);
      expect(sessions.active).toContain('session-1');
      expect(sessions.active).toContain('session-2');
      expect(sessions.active).toContain('session-3');
    });

    test('should reflect session removals', () => {
      sessionManager.addSession('session-1');
      sessionManager.addSession('session-2');
      sessionManager.removeSession('session-1');
      
      const sessions = sessionManager.listSessions();
      expect(sessions.count).toBe(1);
      expect(sessions.active).toContain('session-2');
    });
  });

  describe('endSession()', () => {
    test('should end existing session', async () => {
      sessionManager.addSession('test-session');
      
      const result = await sessionManager.endSession('test-session');
      
      expect(result).toBe(true);
      expect(sessionManager.activeSessions.has('test-session')).toBe(false);
    });

    test('should return false for non-existent session', async () => {
      const result = await sessionManager.endSession('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('endAllSessions()', () => {
    test('should clear all sessions and cleanup monitor', async () => {
      sessionManager.addSession('session-1');
      sessionManager.addSession('session-2');
      await sessionManager.getMonitor(); // Initialize monitor
      
      await sessionManager.endAllSessions();
      
      expect(sessionManager.activeSessions.size).toBe(0);
      expect(mockMonitor.cleanup).toHaveBeenCalled();
      expect(sessionManager.monitor).toBeNull();
    });

    test('should handle when no monitor exists', async () => {
      sessionManager.addSession('session-1');
      
      await sessionManager.endAllSessions();
      
      expect(sessionManager.activeSessions.size).toBe(0);
      expect(sessionManager.monitor).toBeNull();
    });
  });

  describe('hasSession()', () => {
    test('should return true for existing session', () => {
      sessionManager.addSession('test-session');
      expect(sessionManager.hasSession('test-session')).toBe(true);
    });

    test('should return false for non-existent session', () => {
      expect(sessionManager.hasSession('non-existent')).toBe(false);
    });

    test('should reflect session removals', () => {
      sessionManager.addSession('test-session');
      sessionManager.removeSession('test-session');
      expect(sessionManager.hasSession('test-session')).toBe(false);
    });
  });
});