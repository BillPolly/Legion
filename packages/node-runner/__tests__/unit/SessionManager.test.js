/**
 * @fileoverview Unit tests for SessionManager class
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SessionManager } from '../../src/managers/SessionManager.js';

describe('SessionManager', () => {
  let sessionManager;
  let mockStorage;

  beforeEach(() => {
    mockStorage = {
      store: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(true)
    };
    sessionManager = new SessionManager(mockStorage);
  });

  describe('Session Creation', () => {
    it('should create SessionManager with storage dependency', () => {
      expect(sessionManager).toBeInstanceOf(SessionManager);
      expect(sessionManager.storage).toBe(mockStorage);
    });

    it('should create new session with metadata', async () => {
      const sessionData = {
        projectPath: '/path/to/project',
        command: 'npm start',
        description: 'Test session'
      };

      const session = await sessionManager.createSession(sessionData);

      expect(session).toHaveProperty('sessionId');
      expect(session).toHaveProperty('startTime');
      expect(session).toHaveProperty('status', 'active');
      expect(session.projectPath).toBe(sessionData.projectPath);
      expect(session.command).toBe(sessionData.command);
      expect(session.description).toBe(sessionData.description);

      // Should store session in storage
      expect(mockStorage.store).toHaveBeenCalledWith(
        'sessions',
        expect.objectContaining({
          sessionId: session.sessionId,
          status: 'active'
        })
      );
    });

    it('should generate unique session IDs', async () => {
      const session1 = await sessionManager.createSession({ projectPath: '/test1' });
      const session2 = await sessionManager.createSession({ projectPath: '/test2' });

      expect(session1.sessionId).not.toBe(session2.sessionId);
      expect(session1.sessionId).toBeTruthy();
      expect(session2.sessionId).toBeTruthy();
    });
  });

  describe('Session Retrieval', () => {
    it('should get session by ID', async () => {
      const mockSession = {
        sessionId: 'test-session-123',
        projectPath: '/test',
        status: 'active',
        startTime: new Date()
      };

      mockStorage.query.mockResolvedValueOnce([mockSession]);

      const result = await sessionManager.getSession('test-session-123');

      expect(result).toEqual(mockSession);
      expect(mockStorage.query).toHaveBeenCalledWith(
        'sessions',
        expect.objectContaining({
          sessionId: 'test-session-123'
        })
      );
    });

    it('should return null for non-existent session', async () => {
      mockStorage.query.mockResolvedValueOnce([]);

      const result = await sessionManager.getSession('non-existent');

      expect(result).toBeNull();
    });

    it('should list all sessions', async () => {
      const mockSessions = [
        { sessionId: 'session-1', status: 'active' },
        { sessionId: 'session-2', status: 'completed' }
      ];

      mockStorage.query.mockResolvedValueOnce(mockSessions);

      const result = await sessionManager.listSessions();

      expect(result).toEqual(mockSessions);
      expect(mockStorage.query).toHaveBeenCalledWith('sessions', {});
    });

    it('should list sessions with filters', async () => {
      const mockSessions = [
        { sessionId: 'session-1', status: 'active' }
      ];

      mockStorage.query.mockResolvedValueOnce(mockSessions);

      const result = await sessionManager.listSessions({ status: 'active' });

      expect(result).toEqual(mockSessions);
      expect(mockStorage.query).toHaveBeenCalledWith('sessions', { status: 'active' });
    });
  });

  describe('Session Updates', () => {
    it('should end session', async () => {
      const mockSession = {
        sessionId: 'test-session-123',
        projectPath: '/test',
        status: 'active',
        startTime: new Date()
      };

      mockStorage.query.mockResolvedValueOnce([mockSession]);

      const result = await sessionManager.endSession('test-session-123');

      expect(result).toBe(true);
      expect(mockStorage.store).toHaveBeenCalledWith(
        'sessions',
        expect.objectContaining({
          sessionId: 'test-session-123',
          status: 'completed',
          endTime: expect.any(Date)
        })
      );
    });

    it('should handle ending non-existent session', async () => {
      mockStorage.query.mockResolvedValueOnce([]);

      const result = await sessionManager.endSession('non-existent');

      expect(result).toBe(false);
      expect(mockStorage.store).not.toHaveBeenCalled();
    });

    it('should update session metadata', async () => {
      const mockSession = {
        sessionId: 'test-session-123',
        projectPath: '/test',
        status: 'active'
      };

      mockStorage.query.mockResolvedValueOnce([mockSession]);

      const updates = { 
        description: 'Updated description',
        tags: ['frontend', 'development']
      };

      const result = await sessionManager.updateSession('test-session-123', updates);

      expect(result).toBe(true);
      expect(mockStorage.store).toHaveBeenCalledWith(
        'sessions',
        expect.objectContaining({
          sessionId: 'test-session-123',
          description: 'Updated description',
          tags: ['frontend', 'development']
        })
      );
    });
  });

  describe('Session Cleanup', () => {
    it('should clean up old completed sessions', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 8); // 8 days ago

      const mockSessions = [
        { 
          sessionId: 'old-session',
          status: 'completed',
          endTime: oldDate
        },
        {
          sessionId: 'recent-session',
          status: 'completed',
          endTime: new Date()
        },
        {
          sessionId: 'active-session',
          status: 'active'
        }
      ];

      mockStorage.query.mockResolvedValueOnce(mockSessions);

      const cleaned = await sessionManager.cleanupOldSessions(7); // 7 days retention

      expect(cleaned).toBe(1);
      expect(mockStorage.delete).toHaveBeenCalledWith(
        'sessions',
        { sessionId: 'old-session' }
      );
    });

    it('should not clean up active sessions regardless of age', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 30); // 30 days ago

      const mockSessions = [
        { 
          sessionId: 'old-active-session',
          status: 'active',
          startTime: oldDate
        }
      ];

      mockStorage.query.mockResolvedValueOnce(mockSessions);

      const cleaned = await sessionManager.cleanupOldSessions(7);

      expect(cleaned).toBe(0);
      expect(mockStorage.delete).not.toHaveBeenCalled();
    });
  });

  describe('Session Metrics', () => {
    it('should get session statistics', async () => {
      const mockSessions = [
        { sessionId: 'session-1', status: 'active' },
        { sessionId: 'session-2', status: 'completed' },
        { sessionId: 'session-3', status: 'completed' },
        { sessionId: 'session-4', status: 'error' }
      ];

      mockStorage.query.mockResolvedValueOnce(mockSessions);

      const stats = await sessionManager.getSessionStats();

      expect(stats).toEqual({
        total: 4,
        active: 1,
        completed: 2,
        error: 1
      });
    });

    it('should handle empty session list', async () => {
      mockStorage.query.mockResolvedValueOnce([]);

      const stats = await sessionManager.getSessionStats();

      expect(stats).toEqual({
        total: 0,
        active: 0,
        completed: 0,
        error: 0
      });
    });
  });
});