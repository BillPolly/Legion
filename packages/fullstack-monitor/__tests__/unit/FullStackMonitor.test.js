/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FullStackMonitor } from '../../src/FullStackMonitor.js';
import { TestResourceManager } from '../utils/TestResourceManager.js';
import { MockSidewinderAgent } from '../utils/MockSidewinderAgent.js';
import { MockBrowserAgent } from '../utils/MockBrowserAgent.js';
import { killPort } from '../utils/killPort.js';

describe('FullStackMonitor Core', () => {
  let resourceManager;
  let monitor;
  
  beforeEach(async () => {
    // Ensure port is free before each test
    await killPort(9901);
    resourceManager = new TestResourceManager();
  });
  
  afterEach(async () => {
    if (monitor) {
      await monitor.cleanup();
      monitor = null;
      // Give time for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  });
  
  describe('Factory Pattern Creation', () => {
    it('should create instance via async factory with ResourceManager', async () => {
      monitor = await FullStackMonitor.create(resourceManager);
      
      expect(monitor).toBeDefined();
      expect(monitor).toBeInstanceOf(FullStackMonitor);
      expect(monitor.resourceManager).toBe(resourceManager);
    });
    
    it('should throw error if ResourceManager is not provided', async () => {
      await expect(FullStackMonitor.create()).rejects.toThrow('ResourceManager is required');
    });
    
    it('should start unified agent server on port 9901', async () => {
      monitor = await FullStackMonitor.create(resourceManager);
      
      expect(monitor.agentServer).toBeDefined();
      expect(monitor.agentServer.options.port).toBe(9901);
    });
    
    it('should handle agent server startup failure gracefully', async () => {
      // Create first monitor to occupy port
      const monitor1 = await FullStackMonitor.create(resourceManager);
      
      // Try to create second monitor on same port - should warn but not throw
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      monitor = await FullStackMonitor.create(resourceManager);
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to start agent server')
      );
      
      consoleWarnSpy.mockRestore();
      await monitor1.cleanup();
    });
    
    it('should create session in LogManager during initialization', async () => {
      monitor = await FullStackMonitor.create(resourceManager);
      
      // Check that monitor has session created
      expect(monitor.session).toBeDefined();
      expect(monitor.session.id).toBeDefined();
      expect(monitor.session.type).toBe('fullstack');
    });
    
    it('should initialize both LogStore and BrowserMonitor', async () => {
      monitor = await FullStackMonitor.create(resourceManager);
      
      expect(monitor.logStore).toBeDefined();
      expect(monitor.browserMonitor).toBeDefined();
      expect(monitor.session).toBeDefined();
      expect(monitor.session.id).toBeDefined();
    });
  });
  
  describe('Agent Client Management', () => {
    beforeEach(async () => {
      monitor = await FullStackMonitor.create(resourceManager);
    });
    
    it('should maintain separate client maps for each agent type', () => {
      expect(monitor.sidewinderClients).toBeDefined();
      expect(monitor.browserClients).toBeDefined();
      expect(monitor.sidewinderClients).toBeInstanceOf(Map);
      expect(monitor.browserClients).toBeInstanceOf(Map);
      expect(monitor.sidewinderClients).not.toBe(monitor.browserClients);
    });
    
    it('should track Sidewinder client connections', async () => {
      const agent = new MockSidewinderAgent();
      await agent.connect();
      
      // Give time for connection to register
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(monitor.sidewinderClients.size).toBe(1);
      
      await agent.disconnect();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(monitor.sidewinderClients.size).toBe(0);
    });
    
    it('should track Browser client connections', async () => {
      const agent = new MockBrowserAgent();
      await agent.connect();
      
      // Give time for connection to register
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(monitor.browserClients.size).toBe(1);
      
      await agent.disconnect();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(monitor.browserClients.size).toBe(0);
    });
  });
  
  describe('Correlation Tracking', () => {
    beforeEach(async () => {
      monitor = await FullStackMonitor.create(resourceManager);
    });
    
    it('should track correlations between backend and frontend', async () => {
      const correlationId = 'test-correlation-123';
      
      await monitor.trackCorrelation(correlationId, {
        backend: { message: 'Backend log', timestamp: Date.now() }
      });
      
      await monitor.trackCorrelation(correlationId, {
        frontend: { message: 'Frontend log', timestamp: Date.now() }
      });
      
      const correlation = monitor.getCorrelation(correlationId);
      expect(correlation).toBeDefined();
      expect(correlation.backend).toBeDefined();
      expect(correlation.frontend).toBeDefined();
    });
    
    it('should handle multiple backend events for same correlation', async () => {
      const correlationId = 'test-correlation-456';
      
      await monitor.trackCorrelation(correlationId, {
        backend: { message: 'Backend log 1' }
      });
      
      await monitor.trackCorrelation(correlationId, {
        backend: { message: 'Backend log 2' }
      });
      
      const correlation = monitor.getCorrelation(correlationId);
      expect(correlation.backend).toBeInstanceOf(Array);
      expect(correlation.backend.length).toBe(2);
    });
    
    it('should retrieve correlation by ID', () => {
      const correlationId = 'test-correlation-789';
      
      monitor.trackCorrelation(correlationId, {
        frontend: { url: '/api/test' }
      });
      
      const correlation = monitor.getCorrelation(correlationId);
      expect(correlation).toBeDefined();
      expect(correlation.id).toBe(correlationId);
      expect(correlation.frontend.url).toBe('/api/test');
    });
    
    it('should increment correlationsDetected counter', async () => {
      const initialCount = monitor.stats.correlationsDetected;
      
      await monitor.trackCorrelation('corr-1', { backend: {} });
      await monitor.trackCorrelation('corr-2', { frontend: {} });
      
      expect(monitor.stats.correlationsDetected).toBe(initialCount + 2);
    });
    
    it('should handle null/undefined correlation IDs gracefully', async () => {
      await expect(monitor.trackCorrelation(null, {})).resolves.not.toThrow();
      await expect(monitor.trackCorrelation(undefined, {})).resolves.not.toThrow();
      await expect(monitor.trackCorrelation('', {})).resolves.not.toThrow();
      
      // Should not create correlations for invalid IDs
      expect(monitor.correlations.has(null)).toBe(false);
      expect(monitor.correlations.has(undefined)).toBe(false);
      expect(monitor.correlations.has('')).toBe(false);
    });
  });
  
  describe('Statistics', () => {
    beforeEach(async () => {
      monitor = await FullStackMonitor.create(resourceManager);
    });
    
    it('should track debug scenarios run', () => {
      expect(monitor.stats.debugScenariosRun).toBe(0);
    });
    
    it('should track total steps executed', () => {
      expect(monitor.stats.totalStepsExecuted).toBe(0);
    });
    
    it('should provide aggregated statistics', async () => {
      const stats = await monitor.getStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.correlations).toBe(0);
      expect(stats.correlationsDetected).toBe(0);
      expect(stats.debugScenariosRun).toBe(0);
      expect(stats.totalStepsExecuted).toBe(0);
      expect(stats.activeBackends).toBe(0);
      expect(stats.activeBrowsers).toBe(0);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
    });
    
    it('should track active backends and browsers', async () => {
      // Simulate adding backends and browsers with proper process mock
      monitor.activeBackends.set('backend1', { 
        process: { 
          killed: false,
          kill: jest.fn()
        } 
      });
      monitor.activeBrowsers.set('browser1', { page: {} });
      
      const stats = await monitor.getStatistics();
      expect(stats.activeBackends).toBe(1);
      expect(stats.activeBrowsers).toBe(1);
    });
  });
  
  describe('Resource Cleanup', () => {
    beforeEach(async () => {
      monitor = await FullStackMonitor.create(resourceManager);
    });
    
    it('should close agent WebSocket server', async () => {
      const serverCloseSpy = jest.spyOn(monitor.agentServer, 'close');
      
      await monitor.cleanup();
      
      expect(serverCloseSpy).toHaveBeenCalled();
    });
    
    it('should close all client connections before server shutdown', async () => {
      // Connect agents
      const sidewinderAgent = new MockSidewinderAgent();
      const browserAgent = new MockBrowserAgent();
      
      await sidewinderAgent.connect();
      await browserAgent.connect();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(monitor.sidewinderClients.size).toBe(1);
      expect(monitor.browserClients.size).toBe(1);
      
      await monitor.cleanup();
      
      expect(monitor.sidewinderClients.size).toBe(0);
      expect(monitor.browserClients.size).toBe(0);
    });
    
    it('should clear correlation maps', async () => {
      monitor.correlations.set('test-1', {});
      monitor.correlations.set('test-2', {});
      
      expect(monitor.correlations.size).toBe(2);
      
      await monitor.cleanup();
      
      expect(monitor.correlations.size).toBe(0);
    });
    
    it('should handle cleanup errors gracefully', async () => {
      // Force an error in cleanup by making the close method throw
      monitor.agentServer.close = jest.fn(() => {
        throw new Error('Test error');
      });
      
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      await expect(monitor.cleanup()).resolves.not.toThrow();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Failed to stop agent server:'),
        expect.stringContaining('Test error')
      );
      
      consoleWarnSpy.mockRestore();
    });
  });
});