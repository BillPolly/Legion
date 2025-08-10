/**
 * @jest-environment node
 */

import { StandaloneSessionManager } from '../../handlers/StandaloneSessionManager.js';

describe('StandaloneSessionManager', () => {
  let sessionManager;
  
  beforeEach(() => {
    sessionManager = new StandaloneSessionManager();
  });
  
  afterEach(async () => {
    if (sessionManager) {
      await sessionManager.endAllSessions();
    }
  });
  
  describe('initialization', () => {
    test('should create instance with default configuration', () => {
      expect(sessionManager).toBeInstanceOf(StandaloneSessionManager);
      expect(sessionManager.sessions.size).toBe(0);
      expect(sessionManager.monitors.size).toBe(0);
      expect(sessionManager.maxSessions).toBe(3);
    });
    
    test('should have default resource manager', () => {
      const rm = sessionManager.defaultResourceManager;
      expect(rm.get('BROWSER_TYPE')).toBe('puppeteer');
      expect(rm.get('BROWSER_HEADLESS')).toBe(true);
      expect(rm.get('LOG_LEVEL')).toBe('info');
    });
  });
  
  describe('session management', () => {
    test('should create new monitor session', async () => {
      const monitor = await sessionManager.getOrCreateMonitor('test-session');
      
      expect(monitor).toBeDefined();
      expect(sessionManager.hasSession('test-session')).toBe(true);
      expect(sessionManager.sessions.size).toBe(1);
      expect(sessionManager.monitors.size).toBe(1);
    });
    
    test('should return existing monitor for same session ID', async () => {
      const monitor1 = await sessionManager.getOrCreateMonitor('test-session');
      const monitor2 = await sessionManager.getOrCreateMonitor('test-session');
      
      expect(monitor1).toBe(monitor2);
      expect(sessionManager.sessions.size).toBe(1);
    });
    
    test('should enforce session limit', async () => {
      // Create max sessions
      await sessionManager.getOrCreateMonitor('session1');
      await sessionManager.getOrCreateMonitor('session2');
      await sessionManager.getOrCreateMonitor('session3');
      
      expect(sessionManager.sessions.size).toBe(3);
      
      // Creating 4th session should cleanup oldest
      await sessionManager.getOrCreateMonitor('session4');
      
      expect(sessionManager.sessions.size).toBe(3);
      expect(sessionManager.hasSession('session1')).toBe(false);
      expect(sessionManager.hasSession('session4')).toBe(true);
    });
    
    test('should get current monitor', async () => {
      await sessionManager.getOrCreateMonitor('test-session');
      
      const monitor = sessionManager.getCurrentMonitor('test-session');
      expect(monitor).toBeDefined();
    });
    
    test('should throw error for non-existent session', () => {
      expect(() => {
        sessionManager.getCurrentMonitor('non-existent');
      }).toThrow('No active monitoring session: non-existent');
    });
    
    test('should list active sessions', async () => {
      await sessionManager.getOrCreateMonitor('session1');
      await sessionManager.getOrCreateMonitor('session2');
      
      const sessions = sessionManager.getActiveSessions();
      
      expect(sessions).toHaveLength(2);
      expect(sessions[0]).toMatchObject({
        id: 'session1',
        active: true
      });
      expect(sessions[0].startTime).toBeInstanceOf(Date);
    });
    
    test('should end specific session', async () => {
      await sessionManager.getOrCreateMonitor('session1');
      await sessionManager.getOrCreateMonitor('session2');
      
      expect(sessionManager.sessions.size).toBe(2);
      
      await sessionManager.endSession('session1');
      
      expect(sessionManager.sessions.size).toBe(1);
      expect(sessionManager.hasSession('session1')).toBe(false);
      expect(sessionManager.hasSession('session2')).toBe(true);
    });
    
    test('should end all sessions', async () => {
      await sessionManager.getOrCreateMonitor('session1');
      await sessionManager.getOrCreateMonitor('session2');
      await sessionManager.getOrCreateMonitor('session3');
      
      expect(sessionManager.sessions.size).toBe(3);
      
      await sessionManager.endAllSessions();
      
      expect(sessionManager.sessions.size).toBe(0);
      expect(sessionManager.monitors.size).toBe(0);
    });
  });
  
  describe('statistics', () => {
    test('should get global statistics', async () => {
      await sessionManager.getOrCreateMonitor('session1');
      await sessionManager.getOrCreateMonitor('session2');
      
      const stats = sessionManager.getGlobalStatistics();
      
      expect(stats).toMatchObject({
        activeSessions: 2,
        totalSessions: 2,
        monitors: expect.any(Array)
      });
      
      expect(stats.monitors).toHaveLength(2);
      expect(stats.monitors[0]).toMatchObject({
        sessionId: expect.any(String),
        backend: expect.any(Object),
        frontend: expect.any(Object)
      });
    });
  });
  
  describe('cleanup', () => {
    test('should cleanup inactive sessions', async () => {
      await sessionManager.getOrCreateMonitor('session1');
      
      // Mock old session
      const session = sessionManager.sessions.get('session1');
      session.startTime = new Date(Date.now() - 40 * 60 * 1000); // 40 minutes ago
      
      await sessionManager.cleanupInactiveSessions(30 * 60 * 1000); // 30 minute threshold
      
      expect(sessionManager.hasSession('session1')).toBe(false);
    });
    
    test('should not cleanup active sessions within threshold', async () => {
      await sessionManager.getOrCreateMonitor('session1');
      
      await sessionManager.cleanupInactiveSessions(30 * 60 * 1000);
      
      expect(sessionManager.hasSession('session1')).toBe(true);
    });
  });
});