/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FullStackMonitor } from '../../src/FullStackMonitor.js';
import { TestResourceManager } from '../utils/TestResourceManager.js';
import { MockSidewinderAgent } from '../utils/MockSidewinderAgent.js';

describe('Sidewinder Agent Integration', () => {
  let resourceManager;
  let monitor;
  let agent;
  
  beforeEach(async () => {
    resourceManager = new TestResourceManager();
    monitor = await FullStackMonitor.create(resourceManager);
    agent = new MockSidewinderAgent();
  });
  
  afterEach(async () => {
    if (agent) {
      await agent.disconnect();
    }
    if (monitor) {
      await monitor.cleanup();
    }
  });
  
  describe('Connection Lifecycle', () => {
    it('should establish WebSocket connection and receive welcome message', async () => {
      await agent.connect();
      
      const welcomeMessage = await agent.waitForMessage('connected');
      expect(welcomeMessage).toBeDefined();
      expect(welcomeMessage.type).toBe('connected');
      expect(welcomeMessage.clientId).toContain('sidewinder-');
      expect(welcomeMessage.timestamp).toBeDefined();
    });
    
    it('should handle identification message from agent', async () => {
      await agent.connect();
      await agent.identify();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check that monitor received and processed the identification
      expect(monitor.sidewinderClients.size).toBe(1);
    });
    
    it('should clean up connection on disconnect', async () => {
      await agent.connect();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(monitor.sidewinderClients.size).toBe(1);
      
      await agent.disconnect();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(monitor.sidewinderClients.size).toBe(0);
    });
    
    it('should handle multiple agent connections', async () => {
      const agent1 = new MockSidewinderAgent();
      const agent2 = new MockSidewinderAgent();
      
      await agent1.connect();
      await agent2.connect();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(monitor.sidewinderClients.size).toBe(2);
      
      await agent1.disconnect();
      await agent2.disconnect();
    });
  });
  
  describe('Message Processing', () => {
    beforeEach(async () => {
      await agent.connect();
    });
    
    it('should process console messages and store in log manager', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      
      await agent.sendConsole('log', 'Test message', 'arg2');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = storageProvider.logs.filter(l => l.source === 'sidewinder-console');
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].message).toContain('Test message arg2');
      expect(logs[0].level).toBe('info');
    });
    
    it('should process different console levels', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      
      await agent.sendConsole('error', 'Error message');
      await agent.sendConsole('warn', 'Warning message');
      await agent.sendConsole('debug', 'Debug message');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = storageProvider.logs.filter(l => l.source === 'sidewinder-console');
      expect(logs.length).toBe(3);
      
      const errorLog = logs.find(l => l.level === 'error');
      const warnLog = logs.find(l => l.level === 'warn');
      const debugLog = logs.find(l => l.level === 'debug');
      
      expect(errorLog).toBeDefined();
      expect(warnLog).toBeDefined();
      expect(debugLog).toBeDefined();
    });
    
    it('should track process lifecycle events', async () => {
      // Create agent with specific PID for this test
      const testAgent = new MockSidewinderAgent('ws://localhost:9901/sidewinder', { pid: 12345 });
      await testAgent.connect();
      
      const storageProvider = resourceManager.getStorageProvider();
      
      // Send process start
      await testAgent.sendProcessStart(['node', 'app.js'], '/app');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check process was added to session
      const processes = storageProvider.processes.get(monitor.session.id);
      expect(processes).toBeDefined();
      expect(processes.length).toBe(1);
      expect(processes[0].processId).toBe(12345);
      expect(processes[0].completed).toBe(false);
      
      // Send process exit
      await testAgent.sendProcessExit(0);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check process was marked as completed
      const updatedProcesses = storageProvider.processes.get(monitor.session.id);
      const process = updatedProcesses.find(p => p.processId === 12345);
      expect(process.completed).toBe(true);
      expect(process.exitCode).toBe(0);
      
      // Clean up test agent
      await testAgent.disconnect();
    });
    
    it('should handle server lifecycle events', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      
      // Send server listening event
      await agent.sendServerLifecycle('listening', 3000);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = storageProvider.logs.filter(l => l.source === 'sidewinder-server');
      expect(logs.length).toBe(1);
      expect(logs[0].message).toContain('listening');
      expect(logs[0].metadata.port).toBe(3000);
    });
    
    it('should capture and log uncaught exceptions', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      
      const testError = new Error('Test error');
      testError.code = 'ERR_TEST';
      testError.stack = 'Error: Test error\n    at Object.<anonymous>';
      
      await agent.sendError(testError);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = storageProvider.logs.filter(l => 
        l.source === 'sidewinder-uncaughtException' && l.level === 'error'
      );
      
      expect(logs.length).toBe(1);
      expect(logs[0].message).toContain('Test error');
      expect(logs[0].metadata.stack).toContain('Object.<anonymous>');
      expect(logs[0].metadata.code).toBe('ERR_TEST');
    });
  });
  
  describe('Correlation Tracking', () => {
    beforeEach(async () => {
      await agent.connect();
    });
    
    it('should extract and track correlation IDs from console messages', async () => {
      const correlationId = 'correlation-abc-123';
      
      await agent.sendConsole('log', `[${correlationId}] API call started`);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const correlation = monitor.getCorrelation(correlationId);
      expect(correlation).toBeDefined();
      expect(correlation.backend).toBeDefined();
      expect(Array.isArray(correlation.backend)).toBe(true);
      expect(correlation.backend.length).toBeGreaterThan(0);
      expect(correlation.backend[0].type).toBe('console');
    });
    
    it('should handle explicit correlation IDs in messages', async () => {
      const correlationId = 'explicit-correlation-456';
      
      await agent.sendWithCorrelation(correlationId, {
        type: 'console',
        method: 'log',
        args: ['Processing request']
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const correlation = monitor.getCorrelation(correlationId);
      expect(correlation).toBeDefined();
      expect(correlation.backend).toBeDefined();
      expect(correlation.id).toBe(correlationId);
    });
  });
  
  describe('Error Handling', () => {
    beforeEach(async () => {
      await agent.connect();
    });
    
    it('should handle malformed JSON messages gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Send invalid JSON
      agent.ws.send('invalid json');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process'),
        expect.any(Error)
      );
      
      // Connection should still be active
      expect(monitor.sidewinderClients.size).toBe(1);
      
      consoleErrorSpy.mockRestore();
    });
    
    it('should handle messages with missing required fields', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      
      // Send console message without method using send() directly
      await agent.send({
        type: 'console',
        args: ['Test message'],
        sessionId: monitor.session.id,
        timestamp: Date.now()
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should still be processed without throwing errors
      const logs = storageProvider.logs.filter(l => l.source === 'sidewinder-console');
      expect(logs.length).toBe(1);
    });
    
    it('should handle circular reference serialization', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      
      // Create circular object (this will be stringified by MockSidewinderAgent)
      const circularObj = {};
      circularObj.self = circularObj;
      
      await agent.sendConsole('log', circularObj);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should be handled gracefully
      const logs = storageProvider.logs.filter(l => l.source === 'sidewinder-console');
      expect(logs.length).toBe(1);
    });
  });
  
  describe('Performance and Stress Testing', () => {
    beforeEach(async () => {
      await agent.connect();
    });
    
    it('should handle rapid message bursts', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      const messageCount = 100;
      
      // Send rapid burst of messages
      const promises = [];
      for (let i = 0; i < messageCount; i++) {
        promises.push(agent.sendConsole('log', `Message ${i}`));
      }
      
      await Promise.all(promises);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const logs = storageProvider.logs.filter(l => l.source === 'sidewinder-console');
      expect(logs.length).toBe(messageCount);
    });
    
    it('should maintain connection stability over time', async () => {
      // Send messages periodically over a longer timespan
      for (let i = 0; i < 10; i++) {
        await agent.sendConsole('log', `Periodic message ${i}`);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Connection should still be active
      expect(monitor.sidewinderClients.size).toBe(1);
      expect(agent.ws.readyState).toBe(agent.ws.OPEN);
    });
  });
});