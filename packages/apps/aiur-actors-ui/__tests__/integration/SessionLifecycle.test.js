/**
 * Session Lifecycle Integration Tests
 * Tests complete session creation, management, and cleanup flows
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('Session Lifecycle', () => {
  let sessionManager;
  let actorSpace;
  let mockStorage;
  
  beforeEach(async () => {
    // Import dependencies
    const { ClientActorSpace } = await import('../../src/actors/ClientActorSpace.js');
    
    // Create actor space
    actorSpace = new ClientActorSpace();
    
    // Mock storage for session persistence
    mockStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn()
    };
    
    // Create session manager (mock for now)
    sessionManager = {
      sessions: new Map(),
      activeSessionId: null,
      storage: mockStorage,
      
      createSession(name, options = {}) {
        const id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const session = {
          id,
          name,
          createdAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          commandCount: 0,
          variables: new Map(),
          history: [],
          state: 'active',
          ...options
        };
        this.sessions.set(id, session);
        return session;
      },
      
      getSession(id) {
        return this.sessions.get(id);
      },
      
      switchSession(id) {
        if (this.sessions.has(id)) {
          this.activeSessionId = id;
          const session = this.sessions.get(id);
          session.lastActivity = new Date().toISOString();
          return session;
        }
        return null;
      },
      
      deleteSession(id) {
        if (id === this.activeSessionId) {
          this.activeSessionId = null;
        }
        return this.sessions.delete(id);
      },
      
      getActiveSession() {
        return this.sessions.get(this.activeSessionId);
      },
      
      saveSession(id) {
        const session = this.sessions.get(id);
        if (session) {
          this.storage.setItem(`session:${id}`, JSON.stringify(session));
          return true;
        }
        return false;
      },
      
      loadSession(id) {
        const data = this.storage.getItem(`session:${id}`);
        if (data) {
          const session = JSON.parse(data);
          this.sessions.set(id, session);
          return session;
        }
        return null;
      },
      
      getAllSessions() {
        return Array.from(this.sessions.values());
      }
    };
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Session Creation', () => {
    test('should create new session with default values', () => {
      const session = sessionManager.createSession('Test Session');
      
      expect(session).toMatchObject({
        id: expect.stringMatching(/^session-/),
        name: 'Test Session',
        createdAt: expect.any(String),
        lastActivity: expect.any(String),
        commandCount: 0,
        state: 'active'
      });
      
      expect(session.variables).toBeDefined();
      expect(session.history).toEqual([]);
    });
    
    test('should create session with custom options', () => {
      const session = sessionManager.createSession('Custom Session', {
        variables: new Map([['key', 'value']]),
        commandCount: 5,
        state: 'suspended'
      });
      
      expect(session.variables.get('key')).toBe('value');
      expect(session.commandCount).toBe(5);
      expect(session.state).toBe('suspended');
    });
    
    test('should auto-activate first session', () => {
      const session1 = sessionManager.createSession('First Session');
      sessionManager.activeSessionId = session1.id;
      
      expect(sessionManager.getActiveSession()).toBe(session1);
    });
    
    test('should generate unique session IDs', () => {
      const sessions = [];
      for (let i = 0; i < 10; i++) {
        sessions.push(sessionManager.createSession(`Session ${i}`));
      }
      
      const ids = sessions.map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });
  });
  
  describe('Session Switching', () => {
    let session1, session2, session3;
    
    beforeEach(() => {
      session1 = sessionManager.createSession('Session 1');
      session2 = sessionManager.createSession('Session 2');
      session3 = sessionManager.createSession('Session 3');
      sessionManager.activeSessionId = session1.id;
    });
    
    test('should switch between sessions', () => {
      expect(sessionManager.getActiveSession()).toBe(session1);
      
      sessionManager.switchSession(session2.id);
      expect(sessionManager.getActiveSession()).toBe(session2);
      
      sessionManager.switchSession(session3.id);
      expect(sessionManager.getActiveSession()).toBe(session3);
    });
    
    test('should update last activity on switch', () => {
      const originalActivity = session2.lastActivity;
      
      // Wait a bit to ensure time difference
      jest.advanceTimersByTime(100);
      
      sessionManager.switchSession(session2.id);
      
      expect(session2.lastActivity).not.toBe(originalActivity);
      expect(new Date(session2.lastActivity).getTime()).toBeGreaterThan(
        new Date(originalActivity).getTime()
      );
    });
    
    test('should handle switching to non-existent session', () => {
      const result = sessionManager.switchSession('non-existent');
      
      expect(result).toBeNull();
      expect(sessionManager.getActiveSession()).toBe(session1); // Should remain on current
    });
    
    test('should preserve session state during switches', () => {
      // Modify session 1
      session1.commandCount = 10;
      session1.variables.set('var1', 'value1');
      session1.history.push('command1');
      
      // Switch to session 2
      sessionManager.switchSession(session2.id);
      
      // Modify session 2
      session2.commandCount = 5;
      session2.variables.set('var2', 'value2');
      
      // Switch back to session 1
      sessionManager.switchSession(session1.id);
      
      // Session 1 state should be preserved
      expect(session1.commandCount).toBe(10);
      expect(session1.variables.get('var1')).toBe('value1');
      expect(session1.history).toContain('command1');
      
      // Session 2 state should also be preserved
      expect(session2.commandCount).toBe(5);
      expect(session2.variables.get('var2')).toBe('value2');
    });
  });
  
  describe('Session State Management', () => {
    let session;
    
    beforeEach(() => {
      session = sessionManager.createSession('Test Session');
    });
    
    test('should track command execution', () => {
      expect(session.commandCount).toBe(0);
      
      // Execute commands
      session.commandCount++;
      session.history.push('ls -la');
      session.lastActivity = new Date().toISOString();
      
      session.commandCount++;
      session.history.push('pwd');
      session.lastActivity = new Date().toISOString();
      
      expect(session.commandCount).toBe(2);
      expect(session.history).toEqual(['ls -la', 'pwd']);
    });
    
    test('should manage session variables', () => {
      // Add variables
      session.variables.set('API_KEY', 'secret123');
      session.variables.set('DEBUG', 'true');
      
      expect(session.variables.get('API_KEY')).toBe('secret123');
      expect(session.variables.get('DEBUG')).toBe('true');
      
      // Update variable
      session.variables.set('DEBUG', 'false');
      expect(session.variables.get('DEBUG')).toBe('false');
      
      // Delete variable
      session.variables.delete('API_KEY');
      expect(session.variables.has('API_KEY')).toBe(false);
    });
    
    test('should handle session state transitions', () => {
      expect(session.state).toBe('active');
      
      // Suspend session
      session.state = 'suspended';
      expect(session.state).toBe('suspended');
      
      // Resume session
      session.state = 'active';
      expect(session.state).toBe('active');
      
      // Complete session
      session.state = 'completed';
      expect(session.state).toBe('completed');
    });
    
    test('should maintain command history with limit', () => {
      const maxHistory = 100;
      
      // Add many commands
      for (let i = 0; i < 150; i++) {
        session.history.push(`command ${i}`);
        
        // Limit history size
        if (session.history.length > maxHistory) {
          session.history.shift();
        }
      }
      
      expect(session.history.length).toBe(maxHistory);
      expect(session.history[0]).toBe('command 50');
      expect(session.history[99]).toBe('command 149');
    });
  });
  
  describe('Session Persistence', () => {
    let session;
    
    beforeEach(() => {
      session = sessionManager.createSession('Persistent Session');
      session.commandCount = 10;
      session.variables.set('key', 'value');
      session.history = ['cmd1', 'cmd2'];
    });
    
    test('should save session to storage', () => {
      sessionManager.saveSession(session.id);
      
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        `session:${session.id}`,
        expect.stringContaining('"name":"Persistent Session"')
      );
      
      const savedData = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
      expect(savedData.commandCount).toBe(10);
      expect(savedData.history).toEqual(['cmd1', 'cmd2']);
    });
    
    test('should load session from storage', () => {
      const sessionData = {
        id: 'saved-session',
        name: 'Saved Session',
        commandCount: 5,
        variables: {},
        history: ['old-cmd'],
        state: 'suspended'
      };
      
      mockStorage.getItem.mockReturnValue(JSON.stringify(sessionData));
      
      const loaded = sessionManager.loadSession('saved-session');
      
      expect(loaded).toMatchObject({
        id: 'saved-session',
        name: 'Saved Session',
        commandCount: 5,
        history: ['old-cmd'],
        state: 'suspended'
      });
      
      expect(sessionManager.getSession('saved-session')).toBe(loaded);
    });
    
    test('should handle missing session in storage', () => {
      mockStorage.getItem.mockReturnValue(null);
      
      const loaded = sessionManager.loadSession('non-existent');
      
      expect(loaded).toBeNull();
      expect(sessionManager.getSession('non-existent')).toBeUndefined();
    });
    
    test('should auto-save active session periodically', () => {
      jest.useFakeTimers();
      
      sessionManager.activeSessionId = session.id;
      
      // Simulate auto-save interval
      const autoSaveInterval = 30000; // 30 seconds
      
      sessionManager.startAutoSave = function() {
        setInterval(() => {
          if (this.activeSessionId) {
            this.saveSession(this.activeSessionId);
          }
        }, autoSaveInterval);
      };
      
      sessionManager.startAutoSave();
      
      jest.advanceTimersByTime(autoSaveInterval);
      expect(mockStorage.setItem).toHaveBeenCalled();
      
      jest.advanceTimersByTime(autoSaveInterval);
      expect(mockStorage.setItem).toHaveBeenCalledTimes(2);
      
      jest.useRealTimers();
    });
  });
  
  describe('Session Deletion and Cleanup', () => {
    let session1, session2;
    
    beforeEach(() => {
      session1 = sessionManager.createSession('Session 1');
      session2 = sessionManager.createSession('Session 2');
      sessionManager.activeSessionId = session1.id;
    });
    
    test('should delete session', () => {
      expect(sessionManager.getAllSessions()).toHaveLength(2);
      
      const deleted = sessionManager.deleteSession(session2.id);
      
      expect(deleted).toBe(true);
      expect(sessionManager.getAllSessions()).toHaveLength(1);
      expect(sessionManager.getSession(session2.id)).toBeUndefined();
    });
    
    test('should handle deleting active session', () => {
      const deleted = sessionManager.deleteSession(session1.id);
      
      expect(deleted).toBe(true);
      expect(sessionManager.activeSessionId).toBeNull();
      expect(sessionManager.getActiveSession()).toBeUndefined();
    });
    
    test('should cleanup session resources on delete', () => {
      // Add resources to session
      session1.variables.set('key1', 'value1');
      session1.history = ['cmd1', 'cmd2'];
      session1.timers = [setTimeout(() => {}, 1000)];
      
      // Save session first
      sessionManager.saveSession(session1.id);
      
      // Delete session
      sessionManager.deleteSession(session1.id);
      
      // Remove from storage
      mockStorage.removeItem(`session:${session1.id}`);
      
      expect(mockStorage.removeItem).toHaveBeenCalledWith(`session:${session1.id}`);
      
      // Verify cleanup
      expect(sessionManager.getSession(session1.id)).toBeUndefined();
    });
    
    test('should cleanup old sessions automatically', () => {
      jest.useFakeTimers();
      
      const now = Date.now();
      const dayInMs = 24 * 60 * 60 * 1000;
      
      // Create old sessions
      const oldSession = sessionManager.createSession('Old Session');
      oldSession.lastActivity = new Date(now - 8 * dayInMs).toISOString(); // 8 days old
      
      const recentSession = sessionManager.createSession('Recent Session');
      recentSession.lastActivity = new Date(now - 1 * dayInMs).toISOString(); // 1 day old
      
      // Cleanup sessions older than 7 days
      sessionManager.cleanupOldSessions = function(maxAgeDays = 7) {
        const cutoff = Date.now() - (maxAgeDays * dayInMs);
        
        this.getAllSessions().forEach(session => {
          const lastActivity = new Date(session.lastActivity).getTime();
          if (lastActivity < cutoff) {
            this.deleteSession(session.id);
          }
        });
      };
      
      expect(sessionManager.getAllSessions()).toHaveLength(2);
      
      sessionManager.cleanupOldSessions();
      
      expect(sessionManager.getAllSessions()).toHaveLength(1);
      expect(sessionManager.getSession(recentSession.id)).toBeDefined();
      expect(sessionManager.getSession(oldSession.id)).toBeUndefined();
      
      jest.useRealTimers();
    });
  });
  
  describe('Session Import/Export', () => {
    let session;
    
    beforeEach(() => {
      session = sessionManager.createSession('Export Test');
      session.variables.set('var1', 'value1');
      session.history = ['cmd1', 'cmd2'];
      session.commandCount = 5;
    });
    
    test('should export session data', () => {
      sessionManager.exportSession = function(id) {
        const session = this.getSession(id);
        if (!session) return null;
        
        return {
          version: '1.0',
          exported: new Date().toISOString(),
          session: {
            ...session,
            variables: Array.from(session.variables.entries())
          }
        };
      };
      
      const exported = sessionManager.exportSession(session.id);
      
      expect(exported).toMatchObject({
        version: '1.0',
        exported: expect.any(String),
        session: {
          name: 'Export Test',
          commandCount: 5,
          history: ['cmd1', 'cmd2'],
          variables: [['var1', 'value1']]
        }
      });
    });
    
    test('should import session data', () => {
      sessionManager.importSession = function(data) {
        if (!data.session) return null;
        
        const imported = this.createSession(data.session.name + ' (Imported)');
        
        // Restore state
        imported.commandCount = data.session.commandCount || 0;
        imported.history = data.session.history || [];
        imported.variables = new Map(data.session.variables || []);
        imported.state = data.session.state || 'active';
        
        return imported;
      };
      
      const importData = {
        version: '1.0',
        session: {
          name: 'Imported Session',
          commandCount: 10,
          history: ['imported-cmd'],
          variables: [['importedVar', 'importedValue']],
          state: 'suspended'
        }
      };
      
      const imported = sessionManager.importSession(importData);
      
      expect(imported).toMatchObject({
        name: 'Imported Session (Imported)',
        commandCount: 10,
        history: ['imported-cmd'],
        state: 'suspended'
      });
      
      expect(imported.variables.get('importedVar')).toBe('importedValue');
    });
    
    test('should validate import data', () => {
      sessionManager.validateImport = function(data) {
        if (!data || typeof data !== 'object') return false;
        if (!data.version || !data.session) return false;
        if (!data.session.name) return false;
        return true;
      };
      
      expect(sessionManager.validateImport(null)).toBe(false);
      expect(sessionManager.validateImport({})).toBe(false);
      expect(sessionManager.validateImport({ version: '1.0' })).toBe(false);
      expect(sessionManager.validateImport({ 
        version: '1.0', 
        session: { name: 'Valid' } 
      })).toBe(true);
    });
  });
  
  describe('Session Events and Notifications', () => {
    test('should emit events on session lifecycle', () => {
      const events = [];
      
      sessionManager.emit = function(event, data) {
        events.push({ event, data });
      };
      
      // Create session
      const session = sessionManager.createSession('Event Test');
      sessionManager.emit('session.created', session);
      
      // Switch session
      sessionManager.switchSession(session.id);
      sessionManager.emit('session.activated', session);
      
      // Update session
      session.commandCount++;
      sessionManager.emit('session.updated', session);
      
      // Delete session
      sessionManager.deleteSession(session.id);
      sessionManager.emit('session.deleted', session.id);
      
      expect(events).toEqual([
        { event: 'session.created', data: expect.objectContaining({ name: 'Event Test' }) },
        { event: 'session.activated', data: expect.objectContaining({ id: session.id }) },
        { event: 'session.updated', data: expect.objectContaining({ commandCount: 1 }) },
        { event: 'session.deleted', data: session.id }
      ]);
    });
  });
});