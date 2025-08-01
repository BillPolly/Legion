/**
 * Tests for SessionPanelModel
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('SessionPanelModel', () => {
  let SessionPanelModel;
  let model;
  
  beforeEach(async () => {
    ({ SessionPanelModel } = await import('../../../../src/components/session-panel/SessionPanelModel.js'));
    model = new SessionPanelModel();
  });

  describe('Session Management', () => {
    test('should initialize with empty sessions list', () => {
      expect(model.sessions).toEqual([]);
      expect(model.currentSessionId).toBeNull();
      expect(model.searchQuery).toBe('');
    });

    test('should set sessions list', () => {
      const sessions = [
        { id: 'session1', name: 'Chat Session', type: 'chat', lastModified: Date.now() },
        { id: 'session2', name: 'Code Review', type: 'code', lastModified: Date.now() }
      ];
      
      model.setSessions(sessions);
      
      expect(model.sessions).toEqual(sessions);
      expect(model.getSessions()).toEqual(sessions);
    });

    test('should emit event when sessions are set', () => {
      const listener = jest.fn();
      model.subscribe(listener);
      
      const sessions = [{ id: 'test', name: 'Test Session' }];
      model.setSessions(sessions);
      
      expect(listener).toHaveBeenCalledWith('sessionsChanged', { sessions });
    });

    test('should handle empty sessions array', () => {
      model.setSessions([]);
      expect(model.sessions).toEqual([]);
    });

    test('should sort sessions by last modified date', () => {
      const now = Date.now();
      const sessions = [
        { id: 'old', name: 'Old Session', lastModified: now - 1000 },
        { id: 'new', name: 'New Session', lastModified: now },
        { id: 'older', name: 'Older Session', lastModified: now - 2000 }
      ];
      
      model.setSessions(sessions);
      
      const sorted = model.getSessions();
      expect(sorted[0].id).toBe('new');
      expect(sorted[1].id).toBe('old');
      expect(sorted[2].id).toBe('older');
    });
  });

  describe('Session Selection', () => {
    beforeEach(() => {
      model.setSessions([
        { id: 'session1', name: 'Session 1', type: 'chat' },
        { id: 'session2', name: 'Session 2', type: 'code' },
        { id: 'session3', name: 'Session 3', type: 'chat' }
      ]);
    });

    test('should select session by id', () => {
      model.selectSession('session2');
      
      expect(model.currentSessionId).toBe('session2');
      expect(model.getCurrentSession()).toEqual({ id: 'session2', name: 'Session 2', type: 'code' });
    });

    test('should emit event when session is selected', () => {
      const listener = jest.fn();
      model.subscribe(listener);
      
      model.selectSession('session1');
      
      expect(listener).toHaveBeenCalledWith('sessionSelected', {
        sessionId: 'session1',
        session: { id: 'session1', name: 'Session 1', type: 'chat' }
      });
    });

    test('should deselect session when null is passed', () => {
      model.selectSession('session1');
      model.selectSession(null);
      
      expect(model.currentSessionId).toBeNull();
      expect(model.getCurrentSession()).toBeNull();
    });

    test('should not select non-existent session', () => {
      model.selectSession('invalid-id');
      
      expect(model.currentSessionId).toBeNull();
      expect(model.getCurrentSession()).toBeNull();
    });

    test('should not emit event when selecting already selected session', () => {
      model.selectSession('session1');
      
      const listener = jest.fn();
      model.subscribe(listener);
      
      model.selectSession('session1');
      
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Session Creation', () => {
    test('should create new session', () => {
      const sessionData = {
        name: 'New Session',
        type: 'chat',
        description: 'A new chat session'
      };
      
      model.createSession(sessionData);
      
      expect(model.pendingSession).toEqual({
        ...sessionData,
        id: expect.any(String),
        created: expect.any(Number),
        lastModified: expect.any(Number)
      });
    });

    test('should emit event when session is created', () => {
      const listener = jest.fn();
      model.subscribe(listener);
      
      const sessionData = { name: 'Test Session', type: 'chat' };
      model.createSession(sessionData);
      
      expect(listener).toHaveBeenCalledWith('sessionCreated', {
        session: expect.objectContaining(sessionData)
      });
    });

    test('should generate unique session IDs', () => {
      model.createSession({ name: 'Session 1', type: 'chat' });
      const session1 = model.pendingSession;
      
      model.createSession({ name: 'Session 2', type: 'code' });
      const session2 = model.pendingSession;
      
      expect(session1.id).not.toBe(session2.id);
    });

    test('should validate required fields', () => {
      expect(() => {
        model.createSession({});
      }).toThrow('Session name is required');
      
      expect(() => {
        model.createSession({ name: 'Test' });
      }).toThrow('Session type is required');
    });
  });

  describe('Session Updates', () => {
    beforeEach(() => {
      model.setSessions([
        { id: 'session1', name: 'Session 1', type: 'chat', description: 'Chat session' }
      ]);
    });

    test('should update session details', () => {
      model.updateSession('session1', { name: 'Updated Session', description: 'Updated description' });
      
      const session = model.getSessionById('session1');
      expect(session.name).toBe('Updated Session');
      expect(session.description).toBe('Updated description');
      expect(session.lastModified).toBeGreaterThan(0);
    });

    test('should emit event when session is updated', () => {
      const listener = jest.fn();
      model.subscribe(listener);
      
      model.updateSession('session1', { name: 'Updated' });
      
      expect(listener).toHaveBeenCalledWith('sessionUpdated', {
        sessionId: 'session1',
        updates: { name: 'Updated' }
      });
    });

    test('should not update non-existent session', () => {
      const listener = jest.fn();
      model.subscribe(listener);
      
      model.updateSession('invalid', { name: 'Test' });
      
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Session Deletion', () => {
    beforeEach(() => {
      model.setSessions([
        { id: 'session1', name: 'Session 1', type: 'chat' },
        { id: 'session2', name: 'Session 2', type: 'code' }
      ]);
    });

    test('should delete session by id', () => {
      model.deleteSession('session1');
      
      expect(model.sessions).toHaveLength(1);
      expect(model.getSessionById('session1')).toBeNull();
    });

    test('should emit event when session is deleted', () => {
      const listener = jest.fn();
      model.subscribe(listener);
      
      model.deleteSession('session1');
      
      expect(listener).toHaveBeenCalledWith('sessionDeleted', {
        sessionId: 'session1'
      });
    });

    test('should deselect deleted session', () => {
      model.selectSession('session1');
      model.deleteSession('session1');
      
      expect(model.currentSessionId).toBeNull();
    });

    test('should handle deletion of non-existent session', () => {
      const originalLength = model.sessions.length;
      model.deleteSession('invalid');
      
      expect(model.sessions).toHaveLength(originalLength);
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      model.setSessions([
        { id: 'chat1', name: 'Daily Standup', type: 'chat', description: 'Team meeting' },
        { id: 'code1', name: 'Code Review', type: 'code', description: 'PR review session' },
        { id: 'chat2', name: 'Client Meeting', type: 'chat', description: 'Project discussion' },
        { id: 'debug1', name: 'Debug Session', type: 'debug', description: 'Bug investigation' }
      ]);
    });

    test('should set search query', () => {
      model.setSearchQuery('meeting');
      
      expect(model.searchQuery).toBe('meeting');
    });

    test('should emit event when search query changes', () => {
      const listener = jest.fn();
      model.subscribe(listener);
      
      model.setSearchQuery('code');
      
      expect(listener).toHaveBeenCalledWith('searchQueryChanged', { query: 'code' });
    });

    test('should filter sessions by name', () => {
      model.setSearchQuery('meeting');
      
      const filtered = model.getFilteredSessions();
      expect(filtered).toHaveLength(2);
      expect(filtered[0].name).toBe('Daily Standup');
      expect(filtered[1].name).toBe('Client Meeting');
    });

    test('should filter sessions by description', () => {
      model.setSearchQuery('review');
      
      const filtered = model.getFilteredSessions();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Code Review');
    });

    test('should filter sessions by type', () => {
      model.setSearchQuery('chat');
      
      const filtered = model.getFilteredSessions();
      expect(filtered).toHaveLength(2);
      expect(filtered.every(s => s.type === 'chat')).toBe(true);
    });

    test('should filter case-insensitively', () => {
      model.setSearchQuery('CODE');
      
      const filtered = model.getFilteredSessions();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Code Review');
    });

    test('should return all sessions when search is empty', () => {
      model.setSearchQuery('');
      
      const filtered = model.getFilteredSessions();
      expect(filtered).toHaveLength(4);
    });

    test('should trim search query', () => {
      model.setSearchQuery('  code  ');
      
      expect(model.searchQuery).toBe('code');
      const filtered = model.getFilteredSessions();
      expect(filtered).toHaveLength(1);
    });
  });

  describe('Session Types', () => {
    test('should group sessions by type', () => {
      model.setSessions([
        { id: 'chat1', name: 'Chat 1', type: 'chat' },
        { id: 'code1', name: 'Code 1', type: 'code' },
        { id: 'chat2', name: 'Chat 2', type: 'chat' },
        { id: 'debug1', name: 'Debug 1', type: 'debug' }
      ]);
      
      const grouped = model.getSessionsByType();
      
      expect(Object.keys(grouped)).toEqual(['chat', 'code', 'debug']);
      expect(grouped.chat).toHaveLength(2);
      expect(grouped.code).toHaveLength(1);
      expect(grouped.debug).toHaveLength(1);
    });

    test('should handle sessions without type', () => {
      model.setSessions([
        { id: 'typed', name: 'Typed Session', type: 'chat' },
        { id: 'untyped', name: 'Untyped Session' }
      ]);
      
      const grouped = model.getSessionsByType();
      
      expect(grouped.chat).toHaveLength(1);
      expect(grouped['Unknown']).toHaveLength(1);
    });

    test('should get available session types', () => {
      model.setSessions([
        { id: 'chat1', type: 'chat' },
        { id: 'code1', type: 'code' },
        { id: 'chat2', type: 'chat' }
      ]);
      
      const types = model.getSessionTypes();
      expect(types).toEqual(['chat', 'code']);
    });
  });

  describe('Session State', () => {
    test('should track session loading state', () => {
      model.setSessions([{ id: 'session1', name: 'Session 1' }]);
      
      model.setSessionLoading('session1', true);
      expect(model.isSessionLoading('session1')).toBe(true);
      
      model.setSessionLoading('session1', false);
      expect(model.isSessionLoading('session1')).toBe(false);
    });

    test('should emit event when session loading state changes', () => {
      model.setSessions([{ id: 'session1', name: 'Session 1' }]);
      
      const listener = jest.fn();
      model.subscribe(listener);
      
      model.setSessionLoading('session1', true);
      
      expect(listener).toHaveBeenCalledWith('sessionLoadingStateChanged', {
        sessionId: 'session1',
        loading: true
      });
    });

    test('should not track state for non-existent sessions', () => {
      model.setSessionLoading('invalid', true);
      expect(model.isSessionLoading('invalid')).toBe(false);
    });
  });

  describe('Session Details', () => {
    test('should get session by id', () => {
      const sessions = [
        { id: 'session1', name: 'Session 1' },
        { id: 'session2', name: 'Session 2' }
      ];
      model.setSessions(sessions);
      
      expect(model.getSessionById('session1')).toEqual(sessions[0]);
      expect(model.getSessionById('session2')).toEqual(sessions[1]);
      expect(model.getSessionById('invalid')).toBeNull();
    });

    test('should get recent sessions', () => {
      const now = Date.now();
      model.setSessions([
        { id: 'old', name: 'Old', lastModified: now - 10000 },
        { id: 'recent1', name: 'Recent 1', lastModified: now - 1000 },
        { id: 'recent2', name: 'Recent 2', lastModified: now - 500 },
        { id: 'ancient', name: 'Ancient', lastModified: now - 100000 }
      ]);
      
      const recent = model.getRecentSessions(2);
      expect(recent).toHaveLength(2);
      expect(recent[0].name).toBe('Recent 2');
      expect(recent[1].name).toBe('Recent 1');
    });
  });

  describe('Cleanup', () => {
    test('should clear all data on destroy', () => {
      model.setSessions([{ id: 'test', name: 'Test' }]);
      model.selectSession('test');
      model.setSearchQuery('query');
      
      model.destroy();
      
      expect(model.sessions).toEqual([]);
      expect(model.currentSessionId).toBeNull();
      expect(model.searchQuery).toBe('');
    });
  });
});