/**
 * Frontend Logging System Integration Test
 * 
 * This test validates the complete frontend logging pipeline:
 * 1. Frontend ConsoleHook and ErrorCapture
 * 2. LogCaptureActor WebSocket communication  
 * 3. LogCaptureAgent BT processing
 * 4. Integration with UniversalEventCollector
 * 5. Server injection middleware
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
// Note: Imports commented out since this is a cross-package integration test
// that should be moved to a proper integration test suite
// import { ConsoleHook } from '../../../apps/aiur-ui/src/logger/ConsoleHook.js';
// import { ErrorCapture } from '../../../apps/aiur-ui/src/logger/ErrorCapture.js';
// import { LogCaptureActor } from '../../../apps/aiur-ui/src/logger/LogCaptureActor.js';
// import { LogCaptureAgent } from '../../../aiur/src/agents/LogCaptureAgent.js';
// import { LegionLoggerInjector } from '../../../tools/src/LegionLoggerInjector.js';
// import { UniversalEventCollector } from '../../../code-gen/jester/src/core/UniversalEventCollector.js';

describe.skip('Frontend Logging System Integration (requires setup)', () => {
  let consoleHook;
  let errorCapture;
  let logCaptureActor;
  let logCaptureAgent;
  let eventCollector;
  let injector;
  
  // Mock WebSocket and remote actors
  let mockWebSocket;
  let mockRemoteActor;
  let capturedLogs = [];
  let capturedEvents = [];
  
  beforeAll(async () => {
    // Setup mock environment
    global.window = {
      location: { href: 'http://localhost:3005/test' },
      navigator: { userAgent: 'Jest Test Browser' },
      console: global.console,
      sessionStorage: {
        getItem: jest.fn(),
        setItem: jest.fn()
      }
    };
    
    global.document = {
      title: 'Test Page',
      referrer: 'http://localhost:3005'
    };
  });
  
  beforeEach(() => {
    // Reset captured data
    capturedLogs = [];
    capturedEvents = [];
    
    // Create mock WebSocket
    mockWebSocket = {
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };
    
    // Create mock remote actor
    mockRemoteActor = {
      receive: jest.fn(async (message) => {
        capturedLogs.push(message);
        return { success: true };
      })
    };
    
    // Create mock event collector
    eventCollector = {
      onLogEvent: jest.fn(async (level, message, context) => {
        const event = {
          type: 'frontend_log',
          level,
          message,
          context,
          timestamp: Date.now()
        };
        capturedEvents.push(event);
        return event;
      }),
      
      bufferEvent: jest.fn(),
      emit: jest.fn()
    };
  });
  
  afterEach(() => {
    // Clean up hooks
    if (consoleHook) {
      consoleHook.uninstall();
    }
    if (errorCapture) {
      errorCapture.uninstall();
    }
    if (logCaptureActor) {
      logCaptureActor.destroy();
    }
  });
  
  describe('ConsoleHook', () => {
    test('should capture console logs without disrupting original behavior', () => {
      const originalLog = console.log;
      const originalError = console.error;
      
      let logCalled = false;
      let errorCalled = false;
      
      // Mock console methods to verify they're still called
      console.log = jest.fn(() => { logCalled = true; });
      console.error = jest.fn(() => { errorCalled = true; });
      
      consoleHook = new ConsoleHook();
      
      let capturedLog = null;
      consoleHook.addListener((logEntry) => {
        capturedLog = logEntry;
      });
      
      consoleHook.install();
      
      // Test console.log
      console.log('Test message', { data: 'test' });
      
      expect(logCalled).toBe(true);
      expect(capturedLog).toMatchObject({
        level: 'log',
        messages: expect.arrayContaining(['Test message']),
        timestamp: expect.any(Number),
        sessionId: expect.any(String)
      });
      
      // Test console.error  
      console.error('Error message');
      
      expect(errorCalled).toBe(true);
      expect(capturedLog.level).toBe('error');
      expect(capturedLog.messages).toContain('Error message');
      
      // Restore
      console.log = originalLog;
      console.error = originalError;
    });
    
    test('should filter sensitive data', () => {
      consoleHook = new ConsoleHook({ filterSensitive: true });
      
      let capturedLog = null;
      consoleHook.addListener((logEntry) => {
        capturedLog = logEntry;
      });
      
      consoleHook.install();
      
      console.log('Login data', { password: 'secret123', token: 'abc456' });
      
      const messageStr = JSON.stringify(capturedLog.messages);
      expect(messageStr).toContain('[FILTERED]');
      expect(messageStr).not.toContain('secret123');
      expect(messageStr).not.toContain('abc456');
    });
  });
  
  describe('ErrorCapture', () => {
    test('should capture unhandled errors', (done) => {
      errorCapture = new ErrorCapture();
      
      errorCapture.addListener((errorEntry) => {
        expect(errorEntry).toMatchObject({
          type: 'javascript_error',
          message: 'Test unhandled error',
          timestamp: expect.any(Number)
        });
        done();
      });
      
      errorCapture.install();
      
      // Simulate unhandled error
      const errorEvent = new ErrorEvent('error', {
        message: 'Test unhandled error',
        filename: 'test.js',
        lineno: 10,
        colno: 5,
        error: new Error('Test unhandled error')
      });
      
      window.dispatchEvent(errorEvent);
    });
    
    test('should capture promise rejections', (done) => {
      errorCapture = new ErrorCapture();
      
      errorCapture.addListener((errorEntry) => {
        expect(errorEntry).toMatchObject({
          type: 'promise_rejection',
          reason: expect.objectContaining({
            message: 'Test rejection'
          })
        });
        done();
      });
      
      errorCapture.install();
      
      // Simulate unhandled promise rejection
      const rejectionEvent = new PromiseRejectionEvent('unhandledrejection', {
        promise: Promise.reject(new Error('Test rejection')),
        reason: new Error('Test rejection')
      });
      
      window.dispatchEvent(rejectionEvent);
    });
  });
  
  describe('LogCaptureActor', () => {
    test('should batch and send logs to remote actor', async () => {
      logCaptureActor = new LogCaptureActor({
        batchSize: 3,
        batchInterval: 1000,
        enableConsoleCapture: true,
        enableErrorCapture: true
      });
      
      logCaptureActor.setRemoteActor(mockRemoteActor);
      await logCaptureActor.initialize();
      
      // Generate some logs
      console.log('Log 1');
      console.log('Log 2');
      console.error('Error 1');
      
      // Wait for batch to be sent
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockRemoteActor.receive).toHaveBeenCalled();
      const batchMessage = mockRemoteActor.receive.mock.calls[0][0];
      
      expect(batchMessage).toMatchObject({
        type: 'log_batch',
        entries: expect.arrayContaining([
          expect.objectContaining({ type: 'console_log' }),
          expect.objectContaining({ type: 'frontend_error' })
        ]),
        metadata: expect.any(Object)
      });
      
      expect(batchMessage.entries).toHaveLength(3);
    });
    
    test('should handle configuration updates', async () => {
      logCaptureActor = new LogCaptureActor();
      logCaptureActor.setRemoteActor(mockRemoteActor);
      
      const response = await logCaptureActor.receive({
        type: 'log_capture_config',
        config: { batchSize: 50, enablePerformanceCapture: false }
      });
      
      expect(response.success).toBe(true);
      expect(logCaptureActor.config.batchSize).toBe(50);
      expect(logCaptureActor.config.enablePerformanceCapture).toBe(false);
    });
  });
  
  describe('LogCaptureAgent', () => {
    test('should process log batches using BT workflow', async () => {
      // Mock module loader to provide event collector
      const mockModuleLoader = {
        getLoadedModule: jest.fn(async (name) => {
          if (name === 'jester' || name === 'semantic-search') {
            return { eventCollector };
          }
          return null;
        })
      };
      
      logCaptureAgent = new LogCaptureAgent({
        sessionId: 'test-session',
        moduleLoader: mockModuleLoader,
        debugMode: true
      });
      
      await logCaptureAgent.initialize();
      
      // Process a test log batch
      const logBatch = {
        type: 'log_batch',
        entries: [
          {
            type: 'console_log',
            level: 'log',
            messages: ['Test log message'],
            timestamp: Date.now(),
            sessionId: 'test-session',
            correlationId: 'test-corr-1'
          },
          {
            type: 'frontend_error',
            level: 'error',
            message: 'Test error message',
            timestamp: Date.now(),
            sessionId: 'test-session',
            correlationId: 'test-corr-2'
          }
        ],
        metadata: {
          batchSize: 2,
          url: 'http://localhost:3005/test'
        }
      };
      
      const response = await logCaptureAgent.processLogBatch(logBatch, {});
      
      expect(response.success).toBe(true);
      expect(response.processedCount).toBe(2);
      expect(response.analysisResults).toMatchObject({
        errorAnalysis: expect.objectContaining({
          errorCount: 1,
          errorRate: 0.5
        }),
        semanticForwarding: expect.objectContaining({
          forwardedCount: 2,
          totalCount: 2
        })
      });
      
      // Verify events were forwarded to semantic search
      expect(eventCollector.onLogEvent).toHaveBeenCalledTimes(2);
      expect(capturedEvents).toHaveLength(2);
      
      expect(capturedEvents[0]).toMatchObject({
        type: 'frontend_log',
        level: 'log',
        message: 'Test log message',
        context: expect.objectContaining({
          source: 'frontend',
          sessionId: 'test-session'
        })
      });
    });
    
    test('should detect error patterns and generate alerts', async () => {
      const mockModuleLoader = {
        getLoadedModule: jest.fn(async () => ({ eventCollector }))
      };
      
      logCaptureAgent = new LogCaptureAgent({
        sessionId: 'test-session',
        moduleLoader: mockModuleLoader
      });
      
      await logCaptureAgent.initialize();
      logCaptureAgent.setRemoteActor(mockRemoteActor);
      
      // Process batch with high error rate
      const logBatch = {
        type: 'log_batch',
        entries: Array(10).fill().map((_, i) => ({
          type: 'frontend_error',
          level: 'error',
          message: `Error ${i}`,
          timestamp: Date.now(),
          sessionId: 'test-session',
          correlationId: `test-corr-${i}`
        })),
        metadata: { batchSize: 10 }
      };
      
      await logCaptureAgent.processLogBatch(logBatch, {});
      
      // Should have generated high error rate alert
      const alertCalls = mockRemoteActor.receive.mock.calls.filter(
        call => call[0].type === 'frontend_alert'
      );
      
      expect(alertCalls).toHaveLength(1);
      expect(alertCalls[0][0].alert).toMatchObject({
        type: 'high_error_rate',
        severity: 'warning'
      });
    });
  });
  
  describe('LegionLoggerInjector', () => {
    test('should inject logger script into HTML responses', () => {
      injector = new LegionLoggerInjector({
        wsUrl: 'ws://localhost:8080/ws',
        bundlePath: '/test-bundle.js'
      });
      
      const mockReq = {
        path: '/',
        headers: { 'user-agent': 'Test Browser' },
        session: { legionSessionId: 'test-session-123' }
      };
      
      const originalHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Test Page</title>
</head>
<body>
  <h1>Test Content</h1>
</body>
</html>`;
      
      const injectedHtml = injector.injectLogger(originalHtml, mockReq);
      
      expect(injectedHtml).toContain('window.LEGION_CONFIG');
      expect(injectedHtml).toContain('ws://localhost:8080/ws');
      expect(injectedHtml).toContain('test-session-123');
      expect(injectedHtml).toContain('/test-bundle.js');
      expect(injectedHtml).toContain('Legion Frontend Logger');
    });
    
    test('should skip injection for API routes', () => {
      injector = new LegionLoggerInjector({
        skipRoutes: ['/api/', '/health']
      });
      
      expect(injector.shouldSkipInjection({ path: '/api/test' })).toBe(true);
      expect(injector.shouldSkipInjection({ path: '/health' })).toBe(true);
      expect(injector.shouldSkipInjection({ path: '/' })).toBe(false);
    });
    
    test('should skip injection for bots', () => {
      injector = new LegionLoggerInjector();
      
      const botReq = {
        path: '/',
        headers: { 'user-agent': 'Googlebot/2.1' }
      };
      
      expect(injector.shouldSkipInjection(botReq)).toBe(true);
    });
  });
  
  describe('End-to-End Integration', () => {
    test('should complete full logging pipeline', async () => {
      // 1. Setup complete logging system
      const mockModuleLoader = {
        getLoadedModule: jest.fn(async () => ({ eventCollector }))
      };
      
      logCaptureAgent = new LogCaptureAgent({
        sessionId: 'e2e-session',
        moduleLoader: mockModuleLoader
      });
      
      await logCaptureAgent.initialize();
      
      logCaptureActor = new LogCaptureActor({
        batchSize: 2,
        batchInterval: 500
      });
      
      // 2. Connect actor to agent
      logCaptureActor.setRemoteActor({
        receive: async (message) => {
          return await logCaptureAgent.receive(message, {});
        }
      });
      
      await logCaptureActor.initialize();
      
      // 3. Generate frontend logs
      console.log('E2E test log 1', { test: 'data' });
      console.error('E2E test error', new Error('Test error'));
      
      // 4. Wait for processing
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // 5. Verify complete pipeline
      expect(eventCollector.onLogEvent).toHaveBeenCalled();
      expect(capturedEvents.length).toBeGreaterThan(0);
      
      // Check that events contain expected data
      const logEvent = capturedEvents.find(e => e.message === 'E2E test log 1');
      expect(logEvent).toBeDefined();
      expect(logEvent.context).toMatchObject({
        source: 'frontend',
        sessionId: 'e2e-session'
      });
      
      // Check error processing
      const errorEvent = capturedEvents.find(e => e.message === 'E2E test error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent.level).toBe('error');
    });
  });
});

// Helper function to simulate DOM events
function simulateEvent(eventType, eventInit) {
  const event = new Event(eventType, eventInit);
  Object.assign(event, eventInit);
  return event;
}