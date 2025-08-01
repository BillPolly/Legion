/**
 * Session Management Integration Tests
 * Tests session creation, restoration, and cleanup with server integration
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('Session Management Integration', () => {
  let sessionManager;
  let bridgeActor;
  let storage;
  let mockWebSocket;
  
  beforeEach(async () => {
    // Mock storage backend
    storage = {
      sessions: new Map(),
      
      async save(sessionId, data) {
        this.sessions.set(sessionId, JSON.stringify(data));
        return true;
      },
      
      async load(sessionId) {
        const data = this.sessions.get(sessionId);
        return data ? JSON.parse(data) : null;
      },
      
      async delete(sessionId) {
        return this.sessions.delete(sessionId);
      },
      
      async list() {
        return Array.from(this.sessions.keys());
      },
      
      async clear() {
        this.sessions.clear();
        return true;
      }
    };
    
    // Mock WebSocket for server communication
    mockWebSocket = {
      readyState: 1, // OPEN
      send: jest.fn(),
      close: jest.fn()
    };
    
    // Create session manager
    sessionManager = {
      sessions: new Map(),
      activeSessionId: null,
      storage,
      bridgeActor: null,
      autoSaveInterval: null,
      
      async createSession(name, options = {}) {
        const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const session = {
          id: sessionId,
          name: name || `Session ${this.sessions.size + 1}`,
          createdAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          commandHistory: [],
          variables: new Map(),
          toolExecutions: [],
          state: 'active',
          metadata: {},
          ...options
        };
        
        this.sessions.set(sessionId, session);
        
        // Save to storage
        await this.storage.save(sessionId, session);
        
        // Notify bridge actor
        if (this.bridgeActor) {
          this.bridgeActor.receive({
            type: 'session.created',
            requestId: `auto-${Date.now()}`,
            session: this.serializeSession(session)
          });
        }
        
        // Auto-activate first session
        if (!this.activeSessionId) {
          await this.switchSession(sessionId);
        }
        
        return session;
      },
      
      async switchSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
          throw new Error(`Session not found: ${sessionId}`);
        }
        
        // Save current session before switching
        if (this.activeSessionId) {
          await this.saveSession(this.activeSessionId);
        }
        
        this.activeSessionId = sessionId;
        const session = this.sessions.get(sessionId);
        session.lastActivity = new Date().toISOString();
        
        // Load session data if needed
        if (!session.loaded) {
          await this.loadSessionData(sessionId);
        }
        
        return session;
      },
      
      async saveSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return false;
        
        const data = this.serializeSession(session);
        return await this.storage.save(sessionId, data);
      },
      
      async loadSession(sessionId) {
        const data = await this.storage.load(sessionId);
        if (!data) return null;
        
        const session = this.deserializeSession(data);
        this.sessions.set(sessionId, session);
        
        return session;
      },
      
      async loadSessionData(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return;
        
        // Load additional data from server
        if (this.bridgeActor) {
          const response = await this.bridgeActor.receive({
            type: 'session.getData',
            requestId: `load-${Date.now()}`,
            sessionId
          });
          
          if (response.data) {
            session.serverData = response.data;
          }
        }
        
        session.loaded = true;
      },
      
      async deleteSession(sessionId) {
        // Can't delete active session without switching first
        if (sessionId === this.activeSessionId) {
          // Switch to another session if available
          const otherSessions = Array.from(this.sessions.keys()).filter(id => id !== sessionId);
          if (otherSessions.length > 0) {
            await this.switchSession(otherSessions[0]);
          } else {
            this.activeSessionId = null;
          }
        }
        
        // Delete from storage
        await this.storage.delete(sessionId);
        
        // Delete from memory
        return this.sessions.delete(sessionId);
      },
      
      async restoreAllSessions() {
        const sessionIds = await this.storage.list();
        const restored = [];
        
        for (const sessionId of sessionIds) {
          const session = await this.loadSession(sessionId);
          if (session) {
            restored.push(session);
          }
        }
        
        // Activate most recent session
        if (restored.length > 0 && !this.activeSessionId) {
          const mostRecent = restored.sort((a, b) => 
            new Date(b.lastActivity) - new Date(a.lastActivity)
          )[0];
          await this.switchSession(mostRecent.id);
        }
        
        return restored;
      },
      
      async cleanupOldSessions(maxAgeDays = 30) {
        const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
        const toDelete = [];
        
        for (const [sessionId, session] of this.sessions) {
          const lastActivity = new Date(session.lastActivity).getTime();
          if (lastActivity < cutoff && sessionId !== this.activeSessionId) {
            toDelete.push(sessionId);
          }
        }
        
        for (const sessionId of toDelete) {
          await this.deleteSession(sessionId);
        }
        
        return toDelete.length;
      },
      
      startAutoSave(intervalMs = 30000) {
        this.stopAutoSave();
        
        this.autoSaveInterval = setInterval(async () => {
          if (this.activeSessionId) {
            await this.saveSession(this.activeSessionId);
          }
        }, intervalMs);
      },
      
      stopAutoSave() {
        if (this.autoSaveInterval) {
          clearInterval(this.autoSaveInterval);
          this.autoSaveInterval = null;
        }
      },
      
      serializeSession(session) {
        return {
          ...session,
          variables: session.variables ? Array.from(session.variables.entries()) : []
        };
      },
      
      deserializeSession(data) {
        return {
          ...data,
          variables: new Map(data.variables || [])
        };
      },
      
      getActiveSession() {
        return this.sessions.get(this.activeSessionId);
      },
      
      getAllSessions() {
        return Array.from(this.sessions.values());
      },
      
      async exportSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return null;
        
        return {
          version: '1.0',
          exported: new Date().toISOString(),
          session: this.serializeSession(session)
        };
      },
      
      async importSession(data) {
        if (!data.session) throw new Error('Invalid import data');
        
        const sessionId = `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const session = {
          ...data.session,
          id: sessionId,
          name: `${data.session.name} (Imported)`,
          imported: true,
          importedAt: new Date().toISOString()
        };
        
        this.sessions.set(sessionId, session);
        await this.storage.save(sessionId, this.serializeSession(session));
        
        return session;
      }
    };
    
    // Create bridge actor
    const { AiurBridgeActor } = await import('../../src/actors/AiurBridgeActor.js');
    bridgeActor = new AiurBridgeActor({
      channel: mockWebSocket
    });
    
    sessionManager.bridgeActor = bridgeActor;
  });
  
  afterEach(async () => {
    sessionManager.stopAutoSave();
    await storage.clear();
    jest.clearAllMocks();
  });
  
  describe('Session Creation', () => {
    test('should create new session with default values', async () => {
      const session = await sessionManager.createSession('Test Session');
      
      expect(session).toMatchObject({
        id: expect.stringMatching(/^session-/),
        name: 'Test Session',
        createdAt: expect.any(String),
        lastActivity: expect.any(String),
        state: 'active'
      });
      
      expect(session.commandHistory).toEqual([]);
      expect(session.variables).toBeInstanceOf(Map);
      expect(session.toolExecutions).toEqual([]);
    });
    
    test('should auto-generate session name if not provided', async () => {
      const session1 = await sessionManager.createSession();
      expect(session1.name).toBe('Session 1');
      
      const session2 = await sessionManager.createSession();
      expect(session2.name).toBe('Session 2');
    });
    
    test('should save session to storage on creation', async () => {
      const session = await sessionManager.createSession('Persistent Session');
      
      const saved = await storage.load(session.id);
      expect(saved).toBeDefined();
      expect(saved.name).toBe('Persistent Session');
    });
    
    test('should notify bridge actor of session creation', async () => {
      const receiveSpy = jest.spyOn(bridgeActor, 'receive');
      
      const session = await sessionManager.createSession('Bridge Test');
      
      expect(receiveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session.created',
          session: expect.objectContaining({
            name: 'Bridge Test'
          })
        })
      );
    });
    
    test('should auto-activate first session', async () => {
      expect(sessionManager.activeSessionId).toBeNull();
      
      const session = await sessionManager.createSession('First Session');
      
      expect(sessionManager.activeSessionId).toBe(session.id);
      expect(sessionManager.getActiveSession()).toBe(session);
    });
    
    test('should handle concurrent session creation', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(sessionManager.createSession(`Concurrent ${i}`));
      }
      
      const sessions = await Promise.all(promises);
      
      expect(sessions).toHaveLength(10);
      expect(new Set(sessions.map(s => s.id)).size).toBe(10); // All unique IDs
    });
  });
  
  describe('Session Switching', () => {
    let session1, session2, session3;
    
    beforeEach(async () => {
      session1 = await sessionManager.createSession('Session 1');
      session2 = await sessionManager.createSession('Session 2');
      session3 = await sessionManager.createSession('Session 3');
    });
    
    test('should switch between sessions', async () => {
      await sessionManager.switchSession(session2.id);
      expect(sessionManager.activeSessionId).toBe(session2.id);
      
      await sessionManager.switchSession(session3.id);
      expect(sessionManager.activeSessionId).toBe(session3.id);
      
      await sessionManager.switchSession(session1.id);
      expect(sessionManager.activeSessionId).toBe(session1.id);
    });
    
    test('should update last activity on switch', async () => {
      const originalActivity = session2.lastActivity;
      
      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await sessionManager.switchSession(session2.id);
      
      expect(session2.lastActivity).not.toBe(originalActivity);
    });
    
    test('should save current session before switching', async () => {
      // Modify active session
      session1.variables.set('test', 'value');
      session1.commandHistory.push('command1');
      
      // Switch to another session
      await sessionManager.switchSession(session2.id);
      
      // Check session was saved
      const saved = await storage.load(session1.id);
      expect(saved.variables).toContainEqual(['test', 'value']);
      expect(saved.commandHistory).toContain('command1');
    });
    
    test('should load session data on first switch', async () => {
      // Mock bridge actor response
      bridgeActor.receive = jest.fn().mockResolvedValue({
        data: { serverInfo: 'test data' }
      });
      
      await sessionManager.switchSession(session2.id);
      
      expect(session2.loaded).toBe(true);
      expect(session2.serverData).toEqual({ serverInfo: 'test data' });
    });
    
    test('should throw error for non-existent session', async () => {
      await expect(
        sessionManager.switchSession('non-existent')
      ).rejects.toThrow('Session not found: non-existent');
    });
  });
  
  describe('Session Persistence', () => {
    test('should save session with all data', async () => {
      const session = await sessionManager.createSession('Data Session');
      
      // Add data to session
      session.variables.set('API_KEY', 'secret123');
      session.variables.set('DEBUG', true);
      session.commandHistory.push('ls', 'pwd', 'git status');
      session.toolExecutions.push({
        tool: 'echo',
        params: { message: 'test' },
        result: 'test',
        timestamp: Date.now()
      });
      session.metadata.tags = ['important', 'development'];
      
      // Save session
      await sessionManager.saveSession(session.id);
      
      // Load from storage
      const loaded = await storage.load(session.id);
      
      expect(loaded.variables).toContainEqual(['API_KEY', 'secret123']);
      expect(loaded.variables).toContainEqual(['DEBUG', true]);
      expect(loaded.commandHistory).toEqual(['ls', 'pwd', 'git status']);
      expect(loaded.toolExecutions).toHaveLength(1);
      expect(loaded.metadata.tags).toEqual(['important', 'development']);
    });
    
    test('should load session from storage', async () => {
      // Save session directly to storage
      const sessionData = {
        id: 'stored-session',
        name: 'Stored Session',
        createdAt: '2024-01-01T00:00:00Z',
        lastActivity: '2024-01-01T12:00:00Z',
        variables: [['VAR1', 'value1'], ['VAR2', 'value2']],
        commandHistory: ['echo test'],
        state: 'suspended'
      };
      
      await storage.save('stored-session', sessionData);
      
      // Load session
      const loaded = await sessionManager.loadSession('stored-session');
      
      expect(loaded).toMatchObject({
        id: 'stored-session',
        name: 'Stored Session',
        state: 'suspended'
      });
      
      expect(loaded.variables.get('VAR1')).toBe('value1');
      expect(loaded.variables.get('VAR2')).toBe('value2');
      expect(loaded.commandHistory).toContain('echo test');
    });
    
    test('should restore all sessions from storage', async () => {
      // Create and save multiple sessions
      const session1 = await sessionManager.createSession('Restore 1');
      const session2 = await sessionManager.createSession('Restore 2');
      const session3 = await sessionManager.createSession('Restore 3');
      
      // Clear memory
      sessionManager.sessions.clear();
      sessionManager.activeSessionId = null;
      
      // Restore all sessions
      const restored = await sessionManager.restoreAllSessions();
      
      expect(restored).toHaveLength(3);
      expect(restored.map(s => s.name)).toContain('Restore 1');
      expect(restored.map(s => s.name)).toContain('Restore 2');
      expect(restored.map(s => s.name)).toContain('Restore 3');
      
      // Should activate most recent
      expect(sessionManager.activeSessionId).toBe(session3.id);
    });
    
    test('should handle corrupted session data', async () => {
      // Save corrupted data
      storage.sessions.set('corrupted', 'not-json');
      
      // Attempt to load
      const loaded = await sessionManager.loadSession('corrupted');
      
      expect(loaded).toBeNull();
    });
  });
  
  describe('Auto-Save Functionality', () => {
    test('should auto-save active session periodically', async () => {
      jest.useFakeTimers();
      
      const session = await sessionManager.createSession('Auto-Save Test');
      session.variables.set('counter', 0);
      
      const saveSpy = jest.spyOn(sessionManager, 'saveSession');
      
      // Start auto-save with 100ms interval
      sessionManager.startAutoSave(100);
      
      // Advance time
      jest.advanceTimersByTime(100);
      expect(saveSpy).toHaveBeenCalledTimes(1);
      
      // Modify session
      session.variables.set('counter', 1);
      
      jest.advanceTimersByTime(100);
      expect(saveSpy).toHaveBeenCalledTimes(2);
      
      // Stop auto-save
      sessionManager.stopAutoSave();
      
      jest.advanceTimersByTime(200);
      expect(saveSpy).toHaveBeenCalledTimes(2); // No more saves
      
      jest.useRealTimers();
    });
    
    test('should not auto-save when no active session', async () => {
      jest.useFakeTimers();
      
      sessionManager.activeSessionId = null;
      const saveSpy = jest.spyOn(sessionManager, 'saveSession');
      
      sessionManager.startAutoSave(100);
      
      jest.advanceTimersByTime(300);
      expect(saveSpy).not.toHaveBeenCalled();
      
      sessionManager.stopAutoSave();
      jest.useRealTimers();
    });
  });
  
  describe('Session Cleanup', () => {
    test('should delete session and its data', async () => {
      const session = await sessionManager.createSession('To Delete');
      const sessionId = session.id;
      
      // Add some data
      session.variables.set('test', 'value');
      await sessionManager.saveSession(sessionId);
      
      // Delete session
      const deleted = await sessionManager.deleteSession(sessionId);
      
      expect(deleted).toBe(true);
      expect(sessionManager.sessions.has(sessionId)).toBe(false);
      
      // Check storage
      const loaded = await storage.load(sessionId);
      expect(loaded).toBeNull();
    });
    
    test('should switch to another session when deleting active', async () => {
      const session1 = await sessionManager.createSession('Session 1');
      const session2 = await sessionManager.createSession('Session 2');
      
      // session2 is active
      expect(sessionManager.activeSessionId).toBe(session2.id);
      
      // Delete active session
      await sessionManager.deleteSession(session2.id);
      
      // Should switch to session1
      expect(sessionManager.activeSessionId).toBe(session1.id);
    });
    
    test('should clear active session when deleting last session', async () => {
      const session = await sessionManager.createSession('Only Session');
      expect(sessionManager.activeSessionId).toBe(session.id);
      
      await sessionManager.deleteSession(session.id);
      
      expect(sessionManager.activeSessionId).toBeNull();
      expect(sessionManager.sessions.size).toBe(0);
    });
    
    test('should cleanup old sessions', async () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);
      
      // Create old sessions
      const oldSession1 = await sessionManager.createSession('Old 1');
      oldSession1.lastActivity = new Date(now - 35 * 24 * 60 * 60 * 1000).toISOString();
      
      const oldSession2 = await sessionManager.createSession('Old 2');
      oldSession2.lastActivity = new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString();
      
      // Create recent session
      const recentSession = await sessionManager.createSession('Recent');
      recentSession.lastActivity = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString();
      
      // Cleanup sessions older than 30 days
      const deletedCount = await sessionManager.cleanupOldSessions(30);
      
      expect(deletedCount).toBe(2);
      expect(sessionManager.sessions.has(oldSession1.id)).toBe(false);
      expect(sessionManager.sessions.has(oldSession2.id)).toBe(false);
      expect(sessionManager.sessions.has(recentSession.id)).toBe(true);
      
      jest.useRealTimers();
    });
    
    test('should not cleanup active session even if old', async () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);
      
      const oldSession = await sessionManager.createSession('Old Active');
      oldSession.lastActivity = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();
      
      // Make it active
      sessionManager.activeSessionId = oldSession.id;
      
      const deletedCount = await sessionManager.cleanupOldSessions(30);
      
      expect(deletedCount).toBe(0);
      expect(sessionManager.sessions.has(oldSession.id)).toBe(true);
      
      jest.useRealTimers();
    });
  });
  
  describe('Session Import/Export', () => {
    test('should export session with all data', async () => {
      const session = await sessionManager.createSession('Export Test');
      
      // Add data
      session.variables.set('VAR1', 'value1');
      session.commandHistory.push('cmd1', 'cmd2');
      session.metadata.exported = true;
      
      const exported = await sessionManager.exportSession(session.id);
      
      expect(exported).toMatchObject({
        version: '1.0',
        exported: expect.any(String),
        session: expect.objectContaining({
          name: 'Export Test',
          variables: [['VAR1', 'value1']],
          commandHistory: ['cmd1', 'cmd2']
        })
      });
    });
    
    test('should import session from exported data', async () => {
      const exportData = {
        version: '1.0',
        exported: '2024-01-01T00:00:00Z',
        session: {
          name: 'Imported Session',
          variables: [['IMPORT_VAR', 'imported']],
          commandHistory: ['imported-cmd'],
          metadata: { source: 'external' }
        }
      };
      
      const imported = await sessionManager.importSession(exportData);
      
      expect(imported).toMatchObject({
        id: expect.stringMatching(/^imported-/),
        name: 'Imported Session (Imported)',
        imported: true,
        importedAt: expect.any(String)
      });
      
      expect(imported.variables.get('IMPORT_VAR')).toBe('imported');
      expect(imported.commandHistory).toContain('imported-cmd');
      expect(imported.metadata.source).toBe('external');
      
      // Should be saved to storage
      const saved = await storage.load(imported.id);
      expect(saved).toBeDefined();
    });
    
    test('should validate import data', async () => {
      await expect(
        sessionManager.importSession({})
      ).rejects.toThrow('Invalid import data');
      
      await expect(
        sessionManager.importSession({ version: '1.0' })
      ).rejects.toThrow('Invalid import data');
    });
    
    test('should handle import of session with same name', async () => {
      const existing = await sessionManager.createSession('Duplicate Name');
      
      const importData = {
        version: '1.0',
        session: {
          name: 'Duplicate Name',
          variables: []
        }
      };
      
      const imported = await sessionManager.importSession(importData);
      
      expect(imported.name).toBe('Duplicate Name (Imported)');
      expect(imported.id).not.toBe(existing.id);
    });
  });
  
  describe('Session State Management', () => {
    test('should track command execution in session', async () => {
      const session = await sessionManager.createSession('Command Tracking');
      
      // Add command execution helper
      sessionManager.executeCommand = function(command) {
        const activeSession = this.getActiveSession();
        if (!activeSession) return;
        
        activeSession.commandHistory.push(command);
        activeSession.lastActivity = new Date().toISOString();
        
        return {
          sessionId: activeSession.id,
          commandIndex: activeSession.commandHistory.length - 1
        };
      };
      
      const result1 = sessionManager.executeCommand('ls -la');
      const result2 = sessionManager.executeCommand('pwd');
      const result3 = sessionManager.executeCommand('git status');
      
      expect(session.commandHistory).toEqual(['ls -la', 'pwd', 'git status']);
      expect(result3.commandIndex).toBe(2);
    });
    
    test('should track tool executions in session', async () => {
      const session = await sessionManager.createSession('Tool Tracking');
      
      // Add tool execution helper
      sessionManager.recordToolExecution = function(toolId, params, result) {
        const activeSession = this.getActiveSession();
        if (!activeSession) return;
        
        const execution = {
          id: `exec-${Date.now()}`,
          toolId,
          params,
          result,
          timestamp: Date.now(),
          duration: result.duration || 0
        };
        
        activeSession.toolExecutions.push(execution);
        activeSession.lastActivity = new Date().toISOString();
        
        return execution.id;
      };
      
      sessionManager.recordToolExecution('echo', { message: 'test' }, { output: 'test' });
      sessionManager.recordToolExecution('transform', { text: 'hello' }, { result: 'HELLO' });
      
      expect(session.toolExecutions).toHaveLength(2);
      expect(session.toolExecutions[0].toolId).toBe('echo');
      expect(session.toolExecutions[1].toolId).toBe('transform');
    });
    
    test('should manage session variables', async () => {
      const session = await sessionManager.createSession('Variable Session');
      
      // Add variable management helpers
      sessionManager.setVariable = function(name, value, type = 'string') {
        const activeSession = this.getActiveSession();
        if (!activeSession) return false;
        
        activeSession.variables.set(name, { value, type, updatedAt: Date.now() });
        return true;
      };
      
      sessionManager.getVariable = function(name) {
        const activeSession = this.getActiveSession();
        if (!activeSession) return null;
        
        return activeSession.variables.get(name);
      };
      
      sessionManager.setVariable('API_URL', 'https://api.example.com');
      sessionManager.setVariable('DEBUG', true, 'boolean');
      sessionManager.setVariable('TIMEOUT', 5000, 'number');
      
      expect(sessionManager.getVariable('API_URL')).toMatchObject({
        value: 'https://api.example.com',
        type: 'string'
      });
      
      expect(sessionManager.getVariable('DEBUG')).toMatchObject({
        value: true,
        type: 'boolean'
      });
      
      expect(session.variables.size).toBe(3);
    });
    
    test('should handle session state transitions', async () => {
      const session = await sessionManager.createSession('State Session');
      
      expect(session.state).toBe('active');
      
      // Suspend session
      session.state = 'suspended';
      await sessionManager.saveSession(session.id);
      
      // Load and check state
      const loaded = await storage.load(session.id);
      expect(loaded.state).toBe('suspended');
      
      // Resume session
      session.state = 'active';
      
      // Complete session
      session.state = 'completed';
      session.completedAt = new Date().toISOString();
      
      expect(session.state).toBe('completed');
      expect(session.completedAt).toBeDefined();
    });
  });
  
  describe('Session Metadata and Tags', () => {
    test('should support session metadata', async () => {
      const session = await sessionManager.createSession('Metadata Session');
      
      session.metadata = {
        project: 'TestProject',
        environment: 'development',
        tags: ['important', 'debug'],
        customFields: {
          owner: 'user123',
          priority: 'high'
        }
      };
      
      await sessionManager.saveSession(session.id);
      
      const loaded = await storage.load(session.id);
      expect(loaded.metadata.project).toBe('TestProject');
      expect(loaded.metadata.tags).toContain('important');
      expect(loaded.metadata.customFields.priority).toBe('high');
    });
    
    test('should search sessions by metadata', async () => {
      // Create sessions with different metadata
      const session1 = await sessionManager.createSession('Project A');
      session1.metadata = { project: 'A', env: 'prod' };
      
      const session2 = await sessionManager.createSession('Project B');
      session2.metadata = { project: 'B', env: 'dev' };
      
      const session3 = await sessionManager.createSession('Project A Dev');
      session3.metadata = { project: 'A', env: 'dev' };
      
      // Add search helper
      sessionManager.findSessions = function(predicate) {
        return Array.from(this.sessions.values()).filter(predicate);
      };
      
      // Search by project
      const projectA = sessionManager.findSessions(s => s.metadata?.project === 'A');
      expect(projectA).toHaveLength(2);
      
      // Search by environment
      const devSessions = sessionManager.findSessions(s => s.metadata?.env === 'dev');
      expect(devSessions).toHaveLength(2);
      
      // Complex search
      const projectADev = sessionManager.findSessions(s => 
        s.metadata?.project === 'A' && s.metadata?.env === 'dev'
      );
      expect(projectADev).toHaveLength(1);
      expect(projectADev[0].name).toBe('Project A Dev');
    });
  });
});