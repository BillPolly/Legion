/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FullStackMonitor } from '../../src/FullStackMonitor.js';
import { TestResourceManager } from '../utils/TestResourceManager.js';
import { MockSidewinderAgent } from '../utils/MockSidewinderAgent.js';
import { MockBrowserAgent } from '../utils/MockBrowserAgent.js';
import { WebSocket } from 'ws';
import { killPort } from '../utils/killPort.js';

describe('Agent WebSocket Server', () => {
  let resourceManager;
  let monitor;
  
  beforeEach(async () => {
    // Kill any existing process on port 9901
    await killPort(9901);
    await new Promise(resolve => setTimeout(resolve, 200));
    
    resourceManager = new TestResourceManager();
    monitor = await FullStackMonitor.create(resourceManager);
  });
  
  afterEach(async () => {
    if (monitor) {
      await monitor.cleanup();
      monitor = null;
    }
    // Ensure cleanup completes
    await new Promise(resolve => setTimeout(resolve, 200));
  });
  
  describe('WebSocket Server Configuration', () => {
    it('should start WebSocket server on specified port', () => {
      expect(monitor.agentServer).toBeDefined();
      expect(monitor.agentServer.options.port).toBe(9901);
    });
    
    it('should accept connections at /sidewinder path', async () => {
      const agent = new MockSidewinderAgent();
      await agent.connect();
      
      const welcomeMessage = await agent.waitForMessage('connected');
      expect(welcomeMessage).toBeDefined();
      expect(welcomeMessage.type).toBe('connected');
      expect(welcomeMessage.clientId).toContain('sidewinder-');
      
      await agent.disconnect();
    });
    
    it('should accept connections at /browser path', async () => {
      const agent = new MockBrowserAgent();
      await agent.connect();
      
      const welcomeMessage = await agent.waitForMessage('connected');
      expect(welcomeMessage).toBeDefined();
      expect(welcomeMessage.type).toBe('connected');
      expect(welcomeMessage.clientId).toContain('browser-');
      
      await agent.disconnect();
    });
    
    it('should reject connections at unknown paths', async () => {
      const ws = new WebSocket('ws://localhost:9901/unknown');
      
      await new Promise((resolve) => {
        let connectionClosed = false;
        
        ws.on('close', () => {
          connectionClosed = true;
          resolve();
        });
        
        ws.on('error', () => resolve());
        
        ws.on('open', () => {
          // Connection opened, but should be closed immediately by server
          // Wait a bit to see if server closes it
          setTimeout(() => {
            if (connectionClosed) {
              resolve(); // Good, server closed it
            } else {
              resolve(); // We'll check the state after
            }
          }, 100);
        });
        
        setTimeout(() => resolve(), 2000); // Timeout fallback
      });
      
      // Connection should either never open or be closed quickly
      expect(ws.readyState).toBe(WebSocket.CLOSED);
    });
    
    it('should maintain separate client maps for each agent type', async () => {
      const sidewinder = new MockSidewinderAgent();
      const browser = new MockBrowserAgent();
      
      await sidewinder.connect();
      await browser.connect();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(monitor.sidewinderClients.size).toBe(1);
      expect(monitor.browserClients.size).toBe(1);
      
      const sidewinderClientId = Array.from(monitor.sidewinderClients.keys())[0];
      const browserClientId = Array.from(monitor.browserClients.keys())[0];
      
      expect(sidewinderClientId).toContain('sidewinder-');
      expect(browserClientId).toContain('browser-');
      expect(sidewinderClientId).not.toBe(browserClientId);
      
      await sidewinder.disconnect();
      await browser.disconnect();
    });
    
    it('should send welcome message to connected agents', async () => {
      const agent = new MockSidewinderAgent();
      await agent.connect(); // This now waits for the welcome message
      
      // After successful connection, the welcome message should be the first message
      const messages = agent.getReceivedMessages();
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].type).toBe('connected');
      expect(messages[0].clientId).toBeDefined();
      expect(messages[0].timestamp).toBeDefined();
      
      // The agent should also have stored its clientId from the welcome message
      expect(agent.clientId).toBe(messages[0].clientId);
      
      await agent.disconnect();
    });
    
    it('should handle concurrent connections from both agent types', async () => {
      const agents = [
        new MockSidewinderAgent(),
        new MockBrowserAgent(),
        new MockSidewinderAgent(),
        new MockBrowserAgent()
      ];
      
      // Connect all agents concurrently
      await Promise.all(agents.map(agent => agent.connect()));
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(monitor.sidewinderClients.size).toBe(2);
      expect(monitor.browserClients.size).toBe(2);
      
      // Disconnect all agents
      await Promise.all(agents.map(agent => agent.disconnect()));
    });
  });
  
  describe('Connection Management', () => {
    it('should generate unique client IDs for Sidewinder agents', async () => {
      const agent1 = new MockSidewinderAgent();
      const agent2 = new MockSidewinderAgent();
      
      await agent1.connect();
      await agent2.connect();
      
      const msg1 = await agent1.waitForMessage('connected');
      const msg2 = await agent2.waitForMessage('connected');
      
      expect(msg1.clientId).toContain('sidewinder-');
      expect(msg2.clientId).toContain('sidewinder-');
      expect(msg1.clientId).not.toBe(msg2.clientId);
      
      await agent1.disconnect();
      await agent2.disconnect();
    });
    
    it('should generate unique client IDs for Browser agents', async () => {
      const agent1 = new MockBrowserAgent();
      const agent2 = new MockBrowserAgent();
      
      await agent1.connect();
      await agent2.connect();
      
      const msg1 = await agent1.waitForMessage('connected');
      const msg2 = await agent2.waitForMessage('connected');
      
      expect(msg1.clientId).toContain('browser-');
      expect(msg2.clientId).toContain('browser-');
      expect(msg1.clientId).not.toBe(msg2.clientId);
      
      await agent1.disconnect();
      await agent2.disconnect();
    });
    
    it('should track multiple Sidewinder connections in sidewinderClients Map', async () => {
      const agents = [
        new MockSidewinderAgent(),
        new MockSidewinderAgent(),
        new MockSidewinderAgent()
      ];
      
      for (const agent of agents) {
        await agent.connect();
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(monitor.sidewinderClients.size).toBe(3);
      
      for (const agent of agents) {
        await agent.disconnect();
      }
    });
    
    it('should track multiple Browser connections in browserClients Map', async () => {
      const agents = [
        new MockBrowserAgent(),
        new MockBrowserAgent(),
        new MockBrowserAgent()
      ];
      
      for (const agent of agents) {
        await agent.connect();
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(monitor.browserClients.size).toBe(3);
      
      for (const agent of agents) {
        await agent.disconnect();
      }
    });
    
    it('should clean up on agent disconnection', async () => {
      const sidewinder = new MockSidewinderAgent();
      const browser = new MockBrowserAgent();
      
      await sidewinder.connect();
      await browser.connect();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(monitor.sidewinderClients.size).toBe(1);
      expect(monitor.browserClients.size).toBe(1);
      
      await sidewinder.disconnect();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(monitor.sidewinderClients.size).toBe(0);
      expect(monitor.browserClients.size).toBe(1);
      
      await browser.disconnect();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(monitor.browserClients.size).toBe(0);
    });
    
    it('should log agent connections and disconnections', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      const agent = new MockSidewinderAgent();
      await agent.connect();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Sidewinder agent connected')
      );
      
      await agent.disconnect();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Sidewinder agent disconnected')
      );
      
      consoleLogSpy.mockRestore();
    });
    
    it('should handle WebSocket errors without crashing', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Create agent and force an error
      const agent = new MockSidewinderAgent();
      await agent.connect();
      
      // Send invalid JSON to trigger error
      agent.ws.send('invalid json');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process'),
        expect.any(Error)
      );
      
      // Server should still be running
      expect(monitor.agentServer).toBeDefined();
      
      await agent.disconnect();
      consoleErrorSpy.mockRestore();
    });
  });
  
  describe('Message Routing', () => {
    it('should route Sidewinder messages to handleSidewinderMessage', async () => {
      const handleSpy = jest.spyOn(monitor, 'handleSidewinderMessage');
      
      const agent = new MockSidewinderAgent();
      await agent.connect();
      await agent.identify();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(handleSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'identify' }),
        expect.stringContaining('sidewinder-')
      );
      
      await agent.disconnect();
    });
    
    it('should route Browser messages to handleBrowserMessage', async () => {
      const handleSpy = jest.spyOn(monitor, 'handleBrowserMessage');
      
      const agent = new MockBrowserAgent();
      await agent.connect();
      await agent.identify();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(handleSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'identify' }),
        expect.stringContaining('browser-')
      );
      
      await agent.disconnect();
    });
  });
});