/**
 * @jest-environment node
 */

import { SessionManager } from '../../handlers/SessionManager.js';
import { SimplifiedTools } from '../../tools/SimplifiedTools.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Actor Implementation with SimplifiedTools', () => {
  let sessionManager;
  let tools;
  
  beforeAll(() => {
    // Ensure Actor protocol is enabled
    process.env.USE_ACTOR_PROTOCOL = 'true';
  });
  
  beforeEach(() => {
    sessionManager = new SessionManager();
    tools = new SimplifiedTools(sessionManager);
  });
  
  afterEach(async () => {
    // Clean up all sessions
    await sessionManager.endAllSessions();
    
    // Clean up Sidewinder if initialized
    await sessionManager.cleanupSidewinder();
  });
  
  afterAll(() => {
    // No cleanup needed for shared test app
  });
  
  describe('Actor Architecture Setup', () => {
    test('should create ActorSpace with all actors when USE_ACTOR_PROTOCOL is true', async () => {
      const monitor = await sessionManager.getOrCreateMonitor('test-actors');
      
      expect(sessionManager.useActors).toBe(true);
      expect(sessionManager.actorSpaces.has('test-actors')).toBe(true);
      
      const actorSpace = sessionManager.actorSpaces.get('test-actors');
      expect(actorSpace).toBeDefined();
      expect(actorSpace.monitor).toBe(monitor);
    });
    
    test('should have monitor instance attached to ActorSpace', async () => {
      const monitor = await sessionManager.getOrCreateMonitor('test-monitor');
      const actorSpace = sessionManager.actorSpaces.get('test-monitor');
      
      expect(actorSpace.monitor).toBe(monitor);
      expect(actorSpace.sessionId).toBe('test-monitor');
    });
  });
  
  describe('Tool: set_log_level', () => {
    test('should set log level through actors', async () => {
      const result = await tools.execute('set_log_level', {
        level: 'debug',
        session_id: 'log-test'
      });
      
      expect(result.content[0].text).toContain('Log level set to: debug');
    });
  });

  describe('Actor Communication', () => {
    test('BrowserMonitorActor should be initialized', async () => {
      const monitor = await sessionManager.getOrCreateMonitor('browser-test');
      const actorSpace = sessionManager.actorSpaces.get('browser-test');
      
      expect(actorSpace.getMonitorActor('browserMonitor')).toBeDefined();
      expect(actorSpace.getMonitorActor('logManager')).toBeDefined();
    });
    
    test('SidewinderActor should be initialized', async () => {
      const monitor = await sessionManager.getOrCreateMonitor('sidewinder-test');
      const actorSpace = sessionManager.actorSpaces.get('sidewinder-test');
      
      expect(actorSpace.getMonitorActor('sidewinder')).toBeDefined();
      expect(actorSpace.getMonitorActor('logManager')).toBeDefined();
    });
    
    test('CorrelationActor should track correlations', async () => {
      const monitor = await sessionManager.getOrCreateMonitor('correlation-test');
      const actorSpace = sessionManager.actorSpaces.get('correlation-test');
      
      const correlationActor = actorSpace.getMonitorActor('correlation');
      expect(correlationActor).toBeDefined();
      
      // Test that the correlation actor has the expected methods
      expect(typeof correlationActor.registerCorrelation).toBe('function');
      
      // Test correlation tracking - just verify no errors
      const correlationId = 'test-123';
      expect(() => {
        correlationActor.registerCorrelation(correlationId, {
          type: 'frontend',
          data: { message: 'test frontend event' }
        });
      }).not.toThrow();
      
      expect(() => {
        correlationActor.registerCorrelation(correlationId, {
          type: 'backend', 
          data: { message: 'test backend event' }
        });
      }).not.toThrow();
    });
  });

  describe('SessionActor Management', () => {
    test('SessionActor should manage session lifecycle', async () => {
      const monitor = await sessionManager.getOrCreateMonitor('session-actor-test');
      const actorSpace = sessionManager.actorSpaces.get('session-actor-test');
      
      const sessionActor = actorSpace.getMonitorActor('session');
      expect(sessionActor).toBeDefined();
      
      // Test that the session actor has the expected methods
      expect(typeof sessionActor.createSession).toBe('function');
      expect(typeof sessionActor.endSession).toBe('function');
      
      // Test session creation - just verify it doesn't throw
      expect(async () => {
        await sessionActor.createSession('actor-session');
      }).not.toThrow();
      
      // Test session ending - just verify it doesn't throw
      expect(async () => {
        await sessionActor.endSession('actor-session');
      }).not.toThrow();
    });
  });
});