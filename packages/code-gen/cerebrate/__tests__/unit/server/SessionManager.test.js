import { SessionManager } from '../../../src/server/SessionManager.js';

describe('SessionManager', () => {
  let sessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
  });

  afterEach(() => {
    sessionManager.cleanup();
  });

  describe('Session Creation and Initialization', () => {
    test('should create new session with valid ID', () => {
      const sessionId = sessionManager.createSession();
      
      expect(typeof sessionId).toBe('string');
      expect(sessionId).toMatch(/^session-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    test('should initialize session with correct default properties', () => {
      const sessionId = sessionManager.createSession();
      const session = sessionManager.getSession(sessionId);
      
      expect(session).toBeDefined();
      expect(session.id).toBe(sessionId);
      expect(session.created_at).toBeInstanceOf(Date);
      expect(session.expires_at).toBeInstanceOf(Date);
      expect(session.last_activity).toBeInstanceOf(Date);
      expect(session.capabilities).toEqual([
        'dom_inspection',
        'code_analysis',
        'error_debugging',
        'performance_audit'
      ]);
      expect(session.active_commands).toEqual([]);
      expect(session.connected).toBe(true);
    });

    test('should create session with custom capabilities', () => {
      const customCapabilities = ['custom_analysis', 'special_debugging'];
      const sessionId = sessionManager.createSession({ capabilities: customCapabilities });
      const session = sessionManager.getSession(sessionId);
      
      expect(session.capabilities).toEqual(customCapabilities);
    });

    test('should create session with custom expiration time', () => {
      const customExpirationMinutes = 120; // 2 hours
      const sessionId = sessionManager.createSession({ 
        expirationMinutes: customExpirationMinutes 
      });
      const session = sessionManager.getSession(sessionId);
      
      const expectedExpiration = new Date(session.created_at.getTime() + (customExpirationMinutes * 60 * 1000));
      expect(Math.abs(session.expires_at.getTime() - expectedExpiration.getTime())).toBeLessThan(1000);
    });

    test('should generate unique session IDs', () => {
      const sessionIds = new Set();
      for (let i = 0; i < 100; i++) {
        sessionIds.add(sessionManager.createSession());
      }
      
      expect(sessionIds.size).toBe(100);
    });
  });

  describe('Session Expiration Handling', () => {
    test('should identify expired sessions', () => {
      const sessionId = sessionManager.createSession({ expirationMinutes: -1 }); // Expired 1 minute ago
      
      expect(sessionManager.isSessionExpired(sessionId)).toBe(true);
    });

    test('should identify active sessions', () => {
      const sessionId = sessionManager.createSession({ expirationMinutes: 60 }); // Expires in 1 hour
      
      expect(sessionManager.isSessionExpired(sessionId)).toBe(false);
    });

    test('should extend session expiration on activity', async () => {
      const sessionId = sessionManager.createSession({ expirationMinutes: 60 });
      const originalExpiration = sessionManager.getSession(sessionId).expires_at;
      
      // Wait a small amount and update activity
      await new Promise(resolve => setTimeout(resolve, 10));
      
      sessionManager.updateActivity(sessionId);
      const session = sessionManager.getSession(sessionId);
      expect(session).not.toBeNull();
      
      const newExpiration = session.expires_at;
      expect(newExpiration.getTime()).toBeGreaterThan(originalExpiration.getTime());
    });

    test('should remove expired sessions during cleanup', () => {
      const expiredSessionId = sessionManager.createSession({ expirationMinutes: -1 });
      const activeSessionId = sessionManager.createSession({ expirationMinutes: 60 });
      
      sessionManager.cleanupExpiredSessions();
      
      expect(sessionManager.getSession(expiredSessionId)).toBeNull();
      expect(sessionManager.getSession(activeSessionId)).toBeDefined();
    });

    test('should handle cleanup of non-existent sessions gracefully', () => {
      expect(() => {
        sessionManager.cleanupExpiredSessions();
      }).not.toThrow();
    });
  });

  describe('Session Cleanup on Disconnect', () => {
    test('should mark session as disconnected', () => {
      const sessionId = sessionManager.createSession();
      
      sessionManager.disconnectSession(sessionId);
      const session = sessionManager.getSession(sessionId);
      
      expect(session.connected).toBe(false);
      expect(session.disconnected_at).toBeInstanceOf(Date);
    });

    test('should cleanup active commands on disconnect', () => {
      const sessionId = sessionManager.createSession();
      sessionManager.addActiveCommand(sessionId, 'cmd-001', 'inspect_element');
      sessionManager.addActiveCommand(sessionId, 'cmd-002', 'analyze_code');
      
      sessionManager.disconnectSession(sessionId);
      const session = sessionManager.getSession(sessionId);
      
      expect(session.active_commands).toEqual([]);
    });

    test('should handle disconnect of non-existent session gracefully', () => {
      expect(() => {
        sessionManager.disconnectSession('non-existent-session');
      }).not.toThrow();
    });

    test('should remove disconnected sessions after grace period', () => {
      const sessionId = sessionManager.createSession();
      sessionManager.disconnectSession(sessionId);
      
      // Mock expired grace period
      const session = sessionManager.getSession(sessionId);
      session.disconnected_at = new Date(Date.now() - (6 * 60 * 1000)); // 6 minutes ago
      
      sessionManager.cleanupDisconnectedSessions();
      
      expect(sessionManager.getSession(sessionId)).toBeNull();
    });
  });

  describe('Multi-Session Management', () => {
    test('should manage multiple active sessions', () => {
      const sessionIds = [];
      for (let i = 0; i < 5; i++) {
        sessionIds.push(sessionManager.createSession());
      }
      
      sessionIds.forEach(id => {
        expect(sessionManager.getSession(id)).toBeDefined();
      });
      
      expect(sessionManager.getActiveSessionCount()).toBe(5);
    });

    test('should return list of all active sessions', () => {
      const sessionId1 = sessionManager.createSession();
      const sessionId2 = sessionManager.createSession();
      
      const activeSessions = sessionManager.getActiveSessions();
      
      expect(activeSessions).toHaveLength(2);
      expect(activeSessions.map(s => s.id)).toContain(sessionId1);
      expect(activeSessions.map(s => s.id)).toContain(sessionId2);
    });

    test('should handle session isolation properly', () => {
      const sessionId1 = sessionManager.createSession();
      const sessionId2 = sessionManager.createSession();
      
      sessionManager.addActiveCommand(sessionId1, 'cmd-001', 'inspect_element');
      sessionManager.addActiveCommand(sessionId2, 'cmd-002', 'analyze_code');
      
      const session1 = sessionManager.getSession(sessionId1);
      const session2 = sessionManager.getSession(sessionId2);
      
      expect(session1.active_commands).toHaveLength(1);
      expect(session2.active_commands).toHaveLength(1);
      expect(session1.active_commands[0].command_id).toBe('cmd-001');
      expect(session2.active_commands[0].command_id).toBe('cmd-002');
    });

    test('should enforce maximum session limit', () => {
      const maxSessions = 10;
      sessionManager = new SessionManager({ maxSessions });
      
      // Create max sessions
      for (let i = 0; i < maxSessions; i++) {
        sessionManager.createSession();
      }
      
      // Try to create one more
      expect(() => {
        sessionManager.createSession();
      }).toThrow('Maximum session limit exceeded');
    });
  });

  describe('Command Tracking', () => {
    test('should add active command to session', () => {
      const sessionId = sessionManager.createSession();
      
      sessionManager.addActiveCommand(sessionId, 'cmd-001', 'inspect_element');
      const session = sessionManager.getSession(sessionId);
      
      expect(session.active_commands).toHaveLength(1);
      expect(session.active_commands[0]).toEqual({
        command_id: 'cmd-001',
        command_name: 'inspect_element',
        started_at: expect.any(Date)
      });
    });

    test('should remove completed command from session', () => {
      const sessionId = sessionManager.createSession();
      sessionManager.addActiveCommand(sessionId, 'cmd-001', 'inspect_element');
      
      sessionManager.completeCommand(sessionId, 'cmd-001');
      const session = sessionManager.getSession(sessionId);
      
      expect(session.active_commands).toHaveLength(0);
    });

    test('should enforce maximum concurrent commands limit', () => {
      const sessionId = sessionManager.createSession();
      
      // Add maximum concurrent commands (5)
      for (let i = 1; i <= 5; i++) {
        sessionManager.addActiveCommand(sessionId, `cmd-00${i}`, 'test_command');
      }
      
      // Try to add one more
      expect(() => {
        sessionManager.addActiveCommand(sessionId, 'cmd-006', 'test_command');
      }).toThrow('Maximum concurrent commands limit exceeded');
    });

    test('should get active command by ID', () => {
      const sessionId = sessionManager.createSession();
      sessionManager.addActiveCommand(sessionId, 'cmd-001', 'inspect_element');
      
      const command = sessionManager.getActiveCommand(sessionId, 'cmd-001');
      
      expect(command).toBeDefined();
      expect(command.command_id).toBe('cmd-001');
      expect(command.command_name).toBe('inspect_element');
    });
  });

  describe('Session Statistics and Monitoring', () => {
    test('should provide session statistics', () => {
      const sessionId1 = sessionManager.createSession();
      const sessionId2 = sessionManager.createSession();
      sessionManager.disconnectSession(sessionId2);
      
      const stats = sessionManager.getSessionStatistics();
      
      expect(stats.total_sessions).toBe(2);
      expect(stats.active_sessions).toBe(1);
      expect(stats.disconnected_sessions).toBe(1);
      expect(stats.expired_sessions).toBe(0);
    });

    test('should track session activity', async () => {
      const sessionId = sessionManager.createSession();
      const originalActivity = sessionManager.getSession(sessionId).last_activity;
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      sessionManager.updateActivity(sessionId);
      const session = sessionManager.getSession(sessionId);
      expect(session).not.toBeNull();
      
      const newActivity = session.last_activity;
      expect(newActivity.getTime()).toBeGreaterThan(originalActivity.getTime());
    });

    test('should provide command execution metrics', () => {
      const sessionId = sessionManager.createSession();
      sessionManager.addActiveCommand(sessionId, 'cmd-001', 'inspect_element');
      sessionManager.addActiveCommand(sessionId, 'cmd-002', 'analyze_code');
      
      const metrics = sessionManager.getCommandMetrics(sessionId);
      
      expect(metrics.active_commands).toBe(2);
      expect(metrics.total_commands_executed).toBe(0); // None completed yet
    });
  });
});