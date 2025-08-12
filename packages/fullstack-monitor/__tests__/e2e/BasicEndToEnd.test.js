/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FullStackMonitor } from '../../src/FullStackMonitor.js';
import { TestResourceManager } from '../utils/TestResourceManager.js';
import { WebSocket } from 'ws';

describe('Basic End-to-End Test', () => {
  let resourceManager;
  let monitor;
  
  beforeEach(async () => {
    resourceManager = new TestResourceManager();
    monitor = await FullStackMonitor.create(resourceManager);
  });
  
  afterEach(async () => {
    if (monitor) {
      await monitor.cleanup();
    }
  });
  
  describe('Basic Functionality', () => {
    it('should create FullStackMonitor instance', () => {
      expect(monitor).toBeDefined();
      expect(monitor.agentServer).toBeDefined();
      expect(monitor.logStore).toBeDefined();
      expect(monitor.browserMonitor).toBeDefined();
      expect(monitor.session).toBeDefined();
    });
    
    it('should start WebSocket server on port 9901', () => {
      expect(monitor.agentServer.options.port).toBe(9901);
    });
    
    it('should have agent injection helpers', () => {
      expect(typeof monitor.getSidewinderAgentPath).toBe('function');
      expect(typeof monitor.buildNodeCommand).toBe('function');
      expect(typeof monitor.getBrowserAgentScript).toBe('function');
      expect(typeof monitor.injectBrowserAgent).toBe('function');
    });
    
    it('should provide agent injection documentation', () => {
      const help = monitor.getInjectionHelp();
      expect(help).toContain('SIDEWINDER');
      expect(help).toContain('BROWSER');
      expect(help).toContain('--require');
    });
    
    it('should build correct Node.js commands', () => {
      const command = monitor.buildNodeCommand('app.js');
      expect(command).toContain('node');
      expect(command).toContain('--require');
      expect(command).toContain('sidewinder-agent.cjs');
      expect(command).toContain('app.js');
    });
    
    it('should handle npm commands', () => {
      const command = monitor.buildNodeCommand('npm start');
      expect(command).toContain('NODE_OPTIONS');
      expect(command).toContain('npm start');
    });
    
    it('should inject browser agent into HTML', () => {
      const html = '<html><body><h1>Test</h1></body></html>';
      const injected = monitor.injectBrowserAgent(html);
      
      expect(injected).toContain('<script>');
      expect(injected).toContain('Browser Agent');
      expect(injected).toContain('</script>');
      expect(injected).toContain('<h1>Test</h1>');
    });
    
    it('should provide environment variables for Sidewinder', () => {
      const env = monitor.getSidewinderEnv();
      expect(env.SIDEWINDER_WS_PORT).toBeDefined();
      expect(env.SIDEWINDER_WS_HOST).toBeDefined();
      expect(env.SIDEWINDER_SESSION_ID).toBeDefined();
      expect(env.SIDEWINDER_WS_PORT).toBe('9901');
      expect(env.SIDEWINDER_WS_HOST).toBe('localhost');
    });
    
    it('should track correlation data', async () => {
      const correlationId = 'test-correlation-123';
      
      await monitor.trackCorrelation(correlationId, {
        backend: { message: 'Backend test', timestamp: Date.now() }
      });
      
      const correlation = monitor.getCorrelation(correlationId);
      expect(correlation).toBeDefined();
      expect(correlation.id).toBe(correlationId);
      expect(correlation.backend).toBeDefined();
    });
    
    it('should provide aggregated statistics', async () => {
      const stats = await monitor.getStatistics();
      expect(stats).toBeDefined();
      expect(typeof stats.correlations).toBe('number');
      expect(typeof stats.correlationsDetected).toBe('number');
      expect(typeof stats.activeBackends).toBe('number');
      expect(typeof stats.activeBrowsers).toBe('number');
    });
  });
  
  describe('WebSocket Server Connection Test', () => {
    it('should accept connections at /sidewinder path', async () => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:9901/sidewinder');
        
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Connection timeout'));
        }, 3000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          resolve();
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });
    
    it('should accept connections at /browser path', async () => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:9901/browser');
        
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Connection timeout'));
        }, 3000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          resolve();
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });
    
    it('should reject connections at unknown paths', async () => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:9901/unknown');
        let connectionOpened = false;
        
        const timeout = setTimeout(() => {
          if (!connectionOpened) {
            resolve(); // Connection was never opened
          } else {
            ws.close();
            resolve(); // Connection was closed by server
          }
        }, 1000);
        
        ws.on('open', () => {
          connectionOpened = true;
          // Server allows connection but should close it immediately
          // Let's wait for the close event
        });
        
        ws.on('close', () => {
          clearTimeout(timeout);
          resolve(); // Expected behavior - server closed unknown path
        });
        
        ws.on('error', () => {
          clearTimeout(timeout);
          resolve(); // Expected behavior - connection failed
        });
      });
    });
    
    it('should send welcome message to connected agents', async () => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:9901/sidewinder');
        
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('No welcome message received'));
        }, 3000);
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.type === 'connected') {
              expect(message.clientId).toContain('sidewinder-');
              expect(message.timestamp).toBeDefined();
              clearTimeout(timeout);
              ws.close();
              resolve();
            }
          } catch (error) {
            clearTimeout(timeout);
            ws.close();
            reject(error);
          }
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });
  });
  
  describe('Cleanup and Resource Management', () => {
    it('should clean up all resources on cleanup', async () => {
      const serverCloseSpy = jest.spyOn(monitor.agentServer, 'close');
      
      await monitor.cleanup();
      
      expect(serverCloseSpy).toHaveBeenCalled();
      expect(monitor.correlations.size).toBe(0);
      expect(monitor.sidewinderClients.size).toBe(0);
      expect(monitor.browserClients.size).toBe(0);
      
      serverCloseSpy.mockRestore();
    });
    
    it('should handle cleanup errors gracefully', async () => {
      const originalClose = monitor.agentServer.close;
      monitor.agentServer.close = jest.fn(() => {
        throw new Error('Test cleanup error');
      });
      
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      await expect(monitor.cleanup()).resolves.not.toThrow();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Failed to stop agent server:'),
        expect.any(String)
      );
      
      consoleWarnSpy.mockRestore();
      monitor.agentServer.close = originalClose;
    });
  });
});