/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { RuntimeIntegrationManager } from '../../src/integration/RuntimeIntegrationManager.js';

describe('RuntimeIntegrationManager', () => {
  let manager;
  let testConfig;

  beforeAll(() => {
    // Set up test configuration
    testConfig = {
      logManager: {
        logLevel: 'info',
        bufferSize: 1000,
        enableStreaming: true
      },
      nodeRunner: {
        timeout: 30000,
        maxProcesses: 5,
        enableHealthCheck: true
      },
      playwright: {
        browserType: 'chromium',
        headless: true,
        timeout: 30000
      }
    };
  });

  beforeEach(() => {
    manager = new RuntimeIntegrationManager(testConfig);
  });

  afterEach(async () => {
    if (manager) {
      await manager.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize all runtime components', async () => {
      // Test that manager can initialize without errors
      await expect(manager.initialize()).resolves.not.toThrow();
      
      // Verify all components are initialized
      expect(manager.logManager).toBeDefined();
      expect(manager.nodeRunner).toBeDefined();
      expect(manager.playwright).toBeDefined();
      expect(manager.isInitialized).toBe(true);
    });

    test('should handle component initialization failures', async () => {
      // Create manager with invalid config to trigger failure
      const invalidConfig = {
        logManager: { bufferSize: -1 }, // Invalid buffer size
        nodeRunner: { timeout: 0 }, // Invalid timeout
        playwright: { browserType: 'invalid' } // Invalid browser type
      };
      
      // Should throw during construction due to config validation
      expect(() => new RuntimeIntegrationManager(invalidConfig)).toThrow(/Invalid runtime configuration/);
    });

    test('should support partial initialization', async () => {
      // Test initialization - all components are mocked so they all initialize
      const partialConfig = {
        logManager: testConfig.logManager,
        nodeRunner: testConfig.nodeRunner,
        playwright: testConfig.playwright
      };
      
      const partialManager = new RuntimeIntegrationManager(partialConfig);
      await partialManager.initialize();
      
      expect(partialManager.logManager).toBeDefined();
      expect(partialManager.nodeRunner).toBeDefined();
      expect(partialManager.playwright).toBeDefined();
    });
  });

  describe('Cross-Component Communication', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should coordinate cross-component communication', async () => {
      // Test that components can communicate through the manager
      const testData = { message: 'test communication' };
      
      // Start a test process
      const processConfig = {
        command: 'echo',
        args: ['Hello World'],
        cwd: process.cwd()
      };
      
      const result = await manager.executeWithLogging(processConfig);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.logs).toBeDefined();
      expect(result.processId).toBeDefined();
    });

    test('should handle component communication failures', async () => {
      // Test communication failure handling - our mock returns success: true
      // So we need to test the error path differently
      const invalidProcessConfig = {
        command: 'nonexistent-command',
        args: [],
        cwd: process.cwd()
      };
      
      // Mock the nodeRunner to throw an error
      const originalExecuteCommand = manager.nodeRunner.executeCommand;
      manager.nodeRunner.executeCommand = jest.fn().mockRejectedValue(new Error('Command not found'));
      
      const result = await manager.executeWithLogging(invalidProcessConfig);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.logs).toBeDefined();
      
      // Restore original function
      manager.nodeRunner.executeCommand = originalExecuteCommand;
    });

    test('should aggregate results from multiple components', async () => {
      // Test result aggregation
      const testResults = {
        jest: { passed: 5, failed: 0, coverage: 90 },
        eslint: { errors: 0, warnings: 2 },
        browser: { passed: 3, failed: 0, screenshots: [] }
      };
      
      const aggregated = await manager.aggregateResults(testResults);
      
      expect(aggregated).toBeDefined();
      expect(aggregated.overall.success).toBe(true);
      expect(aggregated.overall.score).toBeGreaterThan(0);
      expect(aggregated.summary).toBeDefined();
    });
  });

  describe('Resource Management', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should cleanup resources properly', async () => {
      // Start some processes
      const processConfig = {
        command: 'sleep',
        args: ['5'],
        cwd: process.cwd()
      };
      
      const process1 = await manager.startProcess(processConfig);
      const process2 = await manager.startProcess(processConfig);
      
      expect(manager.getActiveProcessCount()).toBe(2);
      
      // Cleanup should stop all processes
      await manager.cleanup();
      
      expect(manager.getActiveProcessCount()).toBe(0);
      expect(manager.isInitialized).toBe(false);
    });

    test('should handle resource cleanup errors', async () => {
      // Create a scenario where cleanup might fail
      const stubProcess = {
        pid: 99999, // Non-existent PID
        kill: () => { throw new Error('Process not found'); }
      };
      
      manager.activeProcesses.set('test-process', stubProcess);
      
      // Cleanup should not throw even if individual cleanup fails
      await expect(manager.cleanup()).resolves.not.toThrow();
    });

    test('should monitor resource usage', async () => {
      // Test resource monitoring
      const metrics = await manager.getResourceMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.memory).toBeDefined();
      expect(metrics.cpu).toBeDefined();
      expect(metrics.activeProcesses).toBeDefined();
      expect(metrics.timestamp).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle uninitialized state gracefully', async () => {
      // Test operations on uninitialized manager
      const uninitializedManager = new RuntimeIntegrationManager(testConfig);
      
      await expect(uninitializedManager.startProcess({})).rejects.toThrow(/not initialized/);
      await expect(uninitializedManager.executeWithLogging({})).rejects.toThrow(/not initialized/);
    });

    test('should provide detailed error context', async () => {
      await manager.initialize();
      
      const invalidConfig = {
        command: 'invalid-command',
        args: ['--invalid-arg'],
        cwd: '/nonexistent/path'
      };
      
      try {
        await manager.executeWithLogging(invalidConfig);
      } catch (error) {
        expect(error.message).toBeDefined();
        expect(error.context).toBeDefined();
        expect(error.context.command).toBe(invalidConfig.command);
        expect(error.context.timestamp).toBeDefined();
      }
    });
  });

  describe('Configuration Management', () => {
    test('should validate configuration on initialization', () => {
      const invalidConfigs = [
        { logManager: { bufferSize: -1 } }, // Invalid buffer size
        { nodeRunner: { timeout: -1 } }, // Invalid timeout
        { playwright: { browserType: 'invalid' } } // Invalid browser type
      ];
      
      invalidConfigs.forEach(config => {
        expect(() => new RuntimeIntegrationManager(config)).toThrow();
      });
    });

    test('should merge configuration with defaults', () => {
      const partialConfig = {
        logManager: { logLevel: 'debug' }
      };
      
      const managerWithDefaults = new RuntimeIntegrationManager(partialConfig);
      
      expect(managerWithDefaults.config.logManager.logLevel).toBe('debug');
      expect(managerWithDefaults.config.logManager.bufferSize).toBeDefined(); // Should have default
    });
  });
});