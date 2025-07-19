/**
 * ResourceCleanupManager Unit Tests
 * Phase 7.4: Resource cleanup and lifecycle management tests
 * 
 * Tests resource registration, cleanup strategies,
 * graceful shutdown, and resource lifecycle management.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ResourceCleanupManager from '../../../src/cleanup/ResourceCleanupManager.js';

describe('ResourceCleanupManager', () => {
  let cleanupManager;

  beforeEach(async () => {
    cleanupManager = new ResourceCleanupManager({
      enableAutoCleanup: true,
      cleanupTimeout: 1000,
      enableGracefulShutdown: true,
      enableMetrics: true,
      cleanupOnExit: false // Don't interfere with test process
    });
    
    await cleanupManager.initialize();
  });

  afterEach(async () => {
    if (cleanupManager) {
      await cleanupManager.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize cleanup manager', async () => {
      expect(cleanupManager.initialized).toBe(true);
      expect(cleanupManager.resources.size).toBe(0);
      expect(cleanupManager.cleanupHandlers.size).toBe(0);
    });

    test('should emit initialization event', async () => {
      const events = [];
      const newManager = new ResourceCleanupManager();
      
      newManager.on('initialized', (data) => events.push(data));
      await newManager.initialize();
      
      expect(events.length).toBe(1);
      expect(events[0]).toHaveProperty('config');
      expect(events[0]).toHaveProperty('timestamp');
      
      await newManager.cleanup();
    });

    test('should handle multiple initialization calls', async () => {
      const manager = new ResourceCleanupManager();
      await manager.initialize();
      await manager.initialize(); // Should not throw
      
      expect(manager.initialized).toBe(true);
      await manager.cleanup();
    });
  });

  describe('Resource Registration', () => {
    test('should register resources successfully', () => {
      const mockResource = { name: 'test-resource' };
      const result = cleanupManager.registerResource(
        'test-id',
        cleanupManager.resourceTypes.GIT_INTEGRATION,
        mockResource
      );
      
      expect(result.success).toBe(true);
      expect(result.id).toBe('test-id');
      expect(result.type).toBe(cleanupManager.resourceTypes.GIT_INTEGRATION);
      expect(result.registeredAt).toBeDefined();
      
      expect(cleanupManager.resources.size).toBe(1);
    });

    test('should register resource with custom cleanup handler', () => {
      const mockResource = { name: 'test-resource' };
      const customHandler = jest.fn();
      
      cleanupManager.registerResource(
        'test-id',
        cleanupManager.resourceTypes.TIMER,
        mockResource,
        customHandler
      );
      
      expect(cleanupManager.cleanupHandlers.has('test-id')).toBe(true);
      expect(cleanupManager.cleanupHandlers.get('test-id')).toBe(customHandler);
    });

    test('should emit resource registered event', () => {
      const events = [];
      cleanupManager.on('resource-registered', (data) => events.push(data));

      const mockResource = { name: 'test-resource' };
      cleanupManager.registerResource(
        'event-test',
        cleanupManager.resourceTypes.STREAM,
        mockResource
      );
      
      expect(events.length).toBe(1);
      expect(events[0]).toHaveProperty('id', 'event-test');
      expect(events[0]).toHaveProperty('type', cleanupManager.resourceTypes.STREAM);
    });

    test('should reject duplicate resource IDs', () => {
      const mockResource = { name: 'test-resource' };
      
      cleanupManager.registerResource('duplicate-id', 'timer', mockResource);
      
      expect(() => {
        cleanupManager.registerResource('duplicate-id', 'stream', mockResource);
      }).toThrow('Resource duplicate-id already registered');
    });

    test('should assign priorities based on resource type', () => {
      const mockResource = { name: 'test-resource' };
      
      cleanupManager.registerResource('process', cleanupManager.resourceTypes.PROCESS, mockResource);
      cleanupManager.registerResource('timer', cleanupManager.resourceTypes.TIMER, mockResource);
      
      const processResource = cleanupManager.resources.get('process');
      const timerResource = cleanupManager.resources.get('timer');
      
      expect(processResource.priority).toBe(1);
      expect(timerResource.priority).toBe(10);
    });

    test('should update metrics on registration', () => {
      const initialMetrics = cleanupManager.getMetrics();
      
      const mockResource = { name: 'test-resource' };
      cleanupManager.registerResource('metrics-test', 'timer', mockResource);
      
      const updatedMetrics = cleanupManager.getMetrics();
      expect(updatedMetrics.resourcesRegistered).toBe(initialMetrics.resourcesRegistered + 1);
    });

    test('should handle uninitialized registration', () => {
      const uninitializedManager = new ResourceCleanupManager();
      
      expect(() => {
        uninitializedManager.registerResource('test', 'timer', {});
      }).toThrow('ResourceCleanupManager not initialized');
    });
  });

  describe('Resource Unregistration', () => {
    test('should unregister resources', () => {
      const mockResource = { name: 'test-resource' };
      cleanupManager.registerResource('unregister-test', 'timer', mockResource);
      
      expect(cleanupManager.resources.size).toBe(1);
      
      const result = cleanupManager.unregisterResource('unregister-test');
      
      expect(result).toBe(true);
      expect(cleanupManager.resources.size).toBe(0);
    });

    test('should emit unregistered event', () => {
      const events = [];
      cleanupManager.on('resource-unregistered', (data) => events.push(data));

      const mockResource = { name: 'test-resource' };
      cleanupManager.registerResource('event-test', 'timer', mockResource);
      cleanupManager.unregisterResource('event-test');
      
      expect(events.length).toBe(1);
      expect(events[0]).toHaveProperty('id', 'event-test');
    });

    test('should return false for non-existent resource', () => {
      const result = cleanupManager.unregisterResource('non-existent');
      expect(result).toBe(false);
    });

    test('should remove custom cleanup handlers', () => {
      const mockResource = { name: 'test-resource' };
      const customHandler = jest.fn();
      
      cleanupManager.registerResource('handler-test', 'timer', mockResource, customHandler);
      expect(cleanupManager.cleanupHandlers.has('handler-test')).toBe(true);
      
      cleanupManager.unregisterResource('handler-test');
      expect(cleanupManager.cleanupHandlers.has('handler-test')).toBe(false);
    });
  });

  describe('Individual Resource Cleanup', () => {
    test('should cleanup resource with custom handler', async () => {
      const mockResource = { name: 'test-resource' };
      const customHandler = jest.fn().mockResolvedValue(undefined);
      
      cleanupManager.registerResource('custom-test', 'timer', mockResource, customHandler);
      
      const result = await cleanupManager.cleanupResource('custom-test');
      
      expect(result.success).toBe(true);
      expect(result.id).toBe('custom-test');
      expect(customHandler).toHaveBeenCalledWith(mockResource);
      
      const resourceInfo = cleanupManager.resources.get('custom-test');
      expect(resourceInfo.cleaned).toBe(true);
    });

    test('should cleanup resource with default strategy', async () => {
      const mockResource = { 
        cleanup: jest.fn().mockResolvedValue(undefined)
      };
      
      cleanupManager.registerResource(
        'default-test', 
        cleanupManager.resourceTypes.GIT_INTEGRATION, 
        mockResource
      );
      
      const result = await cleanupManager.cleanupResource('default-test');
      
      expect(result.success).toBe(true);
      expect(mockResource.cleanup).toHaveBeenCalled();
    });

    test('should handle cleanup failures', async () => {
      const mockResource = { name: 'test-resource' };
      const failingHandler = jest.fn().mockRejectedValue(new Error('Cleanup failed'));
      
      cleanupManager.registerResource('failing-test', 'timer', mockResource, failingHandler);
      
      const result = await cleanupManager.cleanupResource('failing-test');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cleanup failed');
      expect(result.attempt).toBe(1);
    });

    test('should emit cleanup events', async () => {
      const events = [];
      cleanupManager.on('cleanup-start', (data) => events.push({ type: 'start', data }));
      cleanupManager.on('cleanup-success', (data) => events.push({ type: 'success', data }));
      
      const mockResource = { cleanup: jest.fn() };
      cleanupManager.registerResource('event-test', 'git-integration', mockResource);
      
      await cleanupManager.cleanupResource('event-test');
      
      expect(events.length).toBe(2);
      expect(events[0].type).toBe('start');
      expect(events[1].type).toBe('success');
    });

    test('should skip already cleaned resources', async () => {
      const mockResource = { cleanup: jest.fn() };
      cleanupManager.registerResource('skip-test', 'git-integration', mockResource);
      
      // First cleanup
      await cleanupManager.cleanupResource('skip-test');
      expect(mockResource.cleanup).toHaveBeenCalledTimes(1);
      
      // Second cleanup should skip
      const result = await cleanupManager.cleanupResource('skip-test');
      expect(result.success).toBe(true);
      expect(result.message).toContain('already cleaned');
      expect(mockResource.cleanup).toHaveBeenCalledTimes(1);
    });

    test('should return error for non-existent resource', async () => {
      const result = await cleanupManager.cleanupResource('non-existent');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('should update metrics on cleanup', async () => {
      const mockResource = { cleanup: jest.fn() };
      cleanupManager.registerResource('metrics-test', 'git-integration', mockResource);
      
      const initialMetrics = cleanupManager.getMetrics();
      await cleanupManager.cleanupResource('metrics-test');
      const updatedMetrics = cleanupManager.getMetrics();
      
      expect(updatedMetrics.resourcesCleaned).toBe(initialMetrics.resourcesCleaned + 1);
    });
  });

  describe('Default Cleanup Strategies', () => {
    test('should cleanup git integration resources', async () => {
      const mockResource = { cleanup: jest.fn().mockResolvedValue(undefined) };
      cleanupManager.registerResource('git-test', cleanupManager.resourceTypes.GIT_INTEGRATION, mockResource);
      
      await cleanupManager.cleanupResource('git-test');
      
      expect(mockResource.cleanup).toHaveBeenCalled();
    });

    test('should cleanup file watchers', async () => {
      const mockResource = { close: jest.fn() };
      cleanupManager.registerResource('watcher-test', cleanupManager.resourceTypes.FILE_WATCHER, mockResource);
      
      await cleanupManager.cleanupResource('watcher-test');
      
      expect(mockResource.close).toHaveBeenCalled();
    });

    test('should cleanup processes', async () => {
      const mockProcess = { 
        kill: jest.fn(),
        killed: false,
        on: jest.fn()
      };
      
      cleanupManager.registerResource('process-test', cleanupManager.resourceTypes.PROCESS, mockProcess);
      
      await cleanupManager.cleanupResource('process-test');
      
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    test('should cleanup timers', async () => {
      // Mock global clearTimeout and clearInterval
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      const mockTimer = setTimeout(() => {}, 1000);
      cleanupManager.registerResource('timer-test', cleanupManager.resourceTypes.TIMER, mockTimer);
      
      await cleanupManager.cleanupResource('timer-test');
      
      expect(clearTimeoutSpy).toHaveBeenCalledWith(mockTimer);
      expect(clearIntervalSpy).toHaveBeenCalledWith(mockTimer);
      
      clearTimeoutSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    });

    test('should cleanup streams', async () => {
      const mockStream = { destroy: jest.fn() };
      cleanupManager.registerResource('stream-test', cleanupManager.resourceTypes.STREAM, mockStream);
      
      await cleanupManager.cleanupResource('stream-test');
      
      expect(mockStream.destroy).toHaveBeenCalled();
    });

    test('should cleanup with fallback methods', async () => {
      const mockResource = { 
        close: jest.fn().mockResolvedValue(undefined)
      };
      
      cleanupManager.registerResource('fallback-test', 'unknown-type', mockResource);
      
      await cleanupManager.cleanupResource('fallback-test');
      
      expect(mockResource.close).toHaveBeenCalled();
    });
  });

  describe('Cleanup by Type', () => {
    test('should cleanup resources by type', async () => {
      const resource1 = { cleanup: jest.fn() };
      const resource2 = { cleanup: jest.fn() };
      const resource3 = { cleanup: jest.fn() };
      
      cleanupManager.registerResource('git-1', cleanupManager.resourceTypes.GIT_INTEGRATION, resource1);
      cleanupManager.registerResource('git-2', cleanupManager.resourceTypes.GIT_INTEGRATION, resource2);
      cleanupManager.registerResource('timer-1', cleanupManager.resourceTypes.TIMER, resource3);
      
      const result = await cleanupManager.cleanupResourcesByType(cleanupManager.resourceTypes.GIT_INTEGRATION);
      
      expect(result.type).toBe(cleanupManager.resourceTypes.GIT_INTEGRATION);
      expect(result.totalResources).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      
      expect(resource1.cleanup).toHaveBeenCalled();
      expect(resource2.cleanup).toHaveBeenCalled();
      expect(resource3.cleanup).not.toHaveBeenCalled();
    });

    test('should handle mixed success and failure', async () => {
      const successResource = { cleanup: jest.fn() };
      const failResource = { cleanup: jest.fn().mockRejectedValue(new Error('Fail')) };
      
      cleanupManager.registerResource('success', 'git-integration', successResource);
      cleanupManager.registerResource('fail', 'git-integration', failResource);
      
      const result = await cleanupManager.cleanupResourcesByType('git-integration');
      
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  describe('Cleanup All Resources', () => {
    test('should cleanup all resources in priority order', async () => {
      const cleanupOrder = [];
      
      const processResource = { 
        cleanup: jest.fn().mockImplementation(() => cleanupOrder.push('process'))
      };
      const timerResource = { 
        cleanup: jest.fn().mockImplementation(() => cleanupOrder.push('timer'))
      };
      
      cleanupManager.registerResource('timer', cleanupManager.resourceTypes.TIMER, timerResource);
      cleanupManager.registerResource('process', cleanupManager.resourceTypes.PROCESS, processResource);
      
      const result = await cleanupManager.cleanupAllResources();
      
      expect(result.success).toBe(true);
      expect(result.graceful).toBe(true);
      expect(result.totalResources).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      
      // Process should be cleaned first (higher priority)
      expect(cleanupOrder).toEqual(['process', 'timer']);
    });

    test('should handle graceful shutdown timeout', async () => {
      const slowResource = {
        cleanup: jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 2000)))
      };
      
      cleanupManager.registerResource('slow', 'git-integration', slowResource);
      
      const result = await cleanupManager.cleanupAllResources(true);
      
      expect(result.graceful).toBe(false);
      expect(result.totalResources).toBe(1);
    });

    test('should emit cleanup all events', async () => {
      const events = [];
      cleanupManager.on('cleanup-all-start', (data) => events.push({ type: 'start', data }));
      cleanupManager.on('cleanup-all-complete', (data) => events.push({ type: 'complete', data }));
      
      const mockResource = { cleanup: jest.fn() };
      cleanupManager.registerResource('event-test', 'git-integration', mockResource);
      
      await cleanupManager.cleanupAllResources();
      
      expect(events.length).toBe(2);
      expect(events[0].type).toBe('start');
      expect(events[1].type).toBe('complete');
    });

    test('should handle shutdown in progress', async () => {
      cleanupManager.shutdownInProgress = true;
      
      const result = await cleanupManager.cleanupAllResources();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('already in progress');
    });

    test('should update metrics on cleanup all', async () => {
      const mockResource = { cleanup: jest.fn() };
      cleanupManager.registerResource('metrics-test', 'git-integration', mockResource);
      
      const initialMetrics = cleanupManager.getMetrics();
      await cleanupManager.cleanupAllResources();
      const updatedMetrics = cleanupManager.getMetrics();
      
      expect(updatedMetrics.gracefulShutdowns).toBe(initialMetrics.gracefulShutdowns + 1);
    });

    test('should skip already cleaned resources', async () => {
      const mockResource = { cleanup: jest.fn() };
      cleanupManager.registerResource('skip-test', 'git-integration', mockResource);
      
      // Pre-clean the resource
      await cleanupManager.cleanupResource('skip-test');
      mockResource.cleanup.mockClear();
      
      const result = await cleanupManager.cleanupAllResources();
      
      expect(result.totalResources).toBe(0); // Should skip already cleaned
      expect(mockResource.cleanup).not.toHaveBeenCalled();
    });
  });

  describe('Resource Information', () => {
    test('should get resource information', () => {
      const mockResource = { name: 'test-resource' };
      cleanupManager.registerResource('info-test', 'timer', mockResource);
      
      const info = cleanupManager.getResourceInfo('info-test');
      
      expect(info).toEqual({
        id: 'info-test',
        type: 'timer',
        registeredAt: expect.any(Date),
        priority: expect.any(Number),
        cleanupAttempts: 0,
        lastCleanupAttempt: null,
        cleaned: false
      });
    });

    test('should return null for non-existent resource', () => {
      const info = cleanupManager.getResourceInfo('non-existent');
      expect(info).toBeNull();
    });

    test('should list all resources', () => {
      const resource1 = { name: 'resource1' };
      const resource2 = { name: 'resource2' };
      
      cleanupManager.registerResource('test-1', 'timer', resource1);
      cleanupManager.registerResource('test-2', 'stream', resource2);
      
      const list = cleanupManager.listResources();
      
      expect(list.length).toBe(2);
      expect(list.map(r => r.id)).toContain('test-1');
      expect(list.map(r => r.id)).toContain('test-2');
    });
  });

  describe('Metrics and Monitoring', () => {
    test('should track comprehensive metrics', async () => {
      const successResource = { cleanup: jest.fn() };
      const failResource = { cleanup: jest.fn().mockRejectedValue(new Error('Fail')) };
      
      cleanupManager.registerResource('success', 'git-integration', successResource);
      cleanupManager.registerResource('fail', 'git-integration', failResource);
      
      await cleanupManager.cleanupResource('success');
      await cleanupManager.cleanupResource('fail');
      
      const metrics = cleanupManager.getMetrics();
      
      expect(metrics.resourcesRegistered).toBe(2);
      expect(metrics.resourcesCleaned).toBe(1);
      expect(metrics.cleanupFailures).toBe(1);
      expect(metrics.activeResources).toBe(2);
      expect(metrics.cleanedResources).toBe(1);
      expect(metrics.avgCleanupTime).toBeGreaterThanOrEqual(0);
      expect(metrics.successRate).toBe(50);
    });

    test('should reset metrics', () => {
      // Generate some metrics
      const mockResource = { cleanup: jest.fn() };
      cleanupManager.registerResource('metrics-test', 'timer', mockResource);
      
      let metrics = cleanupManager.getMetrics();
      expect(metrics.resourcesRegistered).toBeGreaterThan(0);
      
      cleanupManager.resetMetrics();
      metrics = cleanupManager.getMetrics();
      
      expect(metrics.resourcesRegistered).toBe(0);
      expect(metrics.resourcesCleaned).toBe(0);
      expect(metrics.cleanupFailures).toBe(0);
    });
  });

  describe('Process Event Handlers', () => {
    test('should setup process event handlers when enabled', async () => {
      const manager = new ResourceCleanupManager({ cleanupOnExit: true });
      
      const processOnSpy = jest.spyOn(process, 'on');
      await manager.initialize();
      
      expect(processOnSpy).toHaveBeenCalled();
      expect(manager.exitHandlers.length).toBeGreaterThan(0);
      
      await manager.cleanup();
      processOnSpy.mockRestore();
    });

    test('should remove process event handlers', async () => {
      const manager = new ResourceCleanupManager({ cleanupOnExit: true });
      
      const removeListenerSpy = jest.spyOn(process, 'removeListener');
      await manager.initialize();
      
      manager.removeProcessEventHandlers();
      
      expect(removeListenerSpy).toHaveBeenCalled();
      expect(manager.exitHandlers.length).toBe(0);
      
      await manager.cleanup();
      removeListenerSpy.mockRestore();
    });
  });

  describe('Force Shutdown', () => {
    test('should force shutdown immediately', async () => {
      const mockResource = { cleanup: jest.fn() };
      cleanupManager.registerResource('force-test', 'git-integration', mockResource);
      
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      await cleanupManager.forceShutdown();
      
      expect(mockResource.cleanup).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
      
      processExitSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    test('should handle force shutdown errors', async () => {
      const failingResource = { 
        cleanup: jest.fn().mockRejectedValue(new Error('Cleanup failed'))
      };
      cleanupManager.registerResource('failing', 'git-integration', failingResource);
      
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      await cleanupManager.forceShutdown();
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
      
      processExitSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    test('should handle registration errors', () => {
      const uninitializedManager = new ResourceCleanupManager();
      
      expect(() => {
        uninitializedManager.registerResource('test', 'timer', {});
      }).toThrow('ResourceCleanupManager not initialized');
    });

    test('should handle cleanup errors gracefully', async () => {
      const mockResource = { 
        cleanup: jest.fn().mockRejectedValue(new Error('Cleanup error'))
      };
      
      cleanupManager.registerResource('error-test', 'git-integration', mockResource);
      
      const result = await cleanupManager.cleanupResource('error-test');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cleanup error');
    });

    test('should handle process cleanup failures during process events', async () => {
      const mockResource = { 
        cleanup: jest.fn().mockImplementation(() => {
          throw new Error('Process cleanup failed');
        })
      };
      
      cleanupManager.registerResource('process-fail', 'process', mockResource);
      
      const result = await cleanupManager.cleanupAllResources(false);
      
      expect(result.failed).toBe(1);
    });
  });

  describe('Resource Type Management', () => {
    test('should have all expected resource types', () => {
      const expectedTypes = [
        'git-integration',
        'transaction-manager',
        'error-handler',
        'repository-recovery',
        'branch-manager',
        'commit-orchestrator',
        'github-operations',
        'file-watcher',
        'process',
        'timer',
        'stream',
        'temp-file',
        'temp-dir'
      ];
      
      expectedTypes.forEach(type => {
        expect(Object.values(cleanupManager.resourceTypes)).toContain(type);
      });
    });

    test('should have defined priorities for all resource types', () => {
      Object.values(cleanupManager.resourceTypes).forEach(type => {
        expect(cleanupManager.cleanupPriorities[type]).toBeDefined();
        expect(typeof cleanupManager.cleanupPriorities[type]).toBe('number');
      });
    });
  });
});