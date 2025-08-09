/**
 * @fileoverview Unit tests for NodeRunnerModule creation and initialization
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NodeRunnerModule } from '../../src/NodeRunnerModule.js';

describe('NodeRunnerModule', () => {
  describe('Module Creation', () => {
    it('should create NodeRunnerModule instance with required dependencies', () => {
      const mockDependencies = {
        processManager: {},
        serverManager: {},
        packageManager: {},
        logStorage: {},
        logSearch: {},
        sessionManager: {},
        frontendInjector: {}
      };

      const module = new NodeRunnerModule(mockDependencies);
      
      expect(module).toBeInstanceOf(NodeRunnerModule);
      expect(module.name).toBe('node-runner');
      expect(module.processManager).toBe(mockDependencies.processManager);
      expect(module.serverManager).toBe(mockDependencies.serverManager);
      expect(module.packageManager).toBe(mockDependencies.packageManager);
      expect(module.logStorage).toBe(mockDependencies.logStorage);
      expect(module.logSearch).toBe(mockDependencies.logSearch);
      expect(module.sessionManager).toBe(mockDependencies.sessionManager);
      expect(module.frontendInjector).toBe(mockDependencies.frontendInjector);
    });

    it('should extend Module base class', () => {
      const mockDependencies = {
        processManager: {},
        serverManager: {},
        packageManager: {},
        logStorage: {},
        logSearch: {},
        sessionManager: {},
        frontendInjector: {}
      };

      const module = new NodeRunnerModule(mockDependencies);
      
      // Should have Module base functionality
      expect(typeof module.getTools).toBe('function');
      expect(module.name).toBe('node-runner');
    });
  });

  describe('Module Initialization', () => {
    it('should have async create factory method', () => {
      expect(typeof NodeRunnerModule.create).toBe('function');
    });

    it('should create module with ResourceManager integration', async () => {
      // Mock ResourceManager
      const mockResourceManager = {
        get: jest.fn().mockImplementation((key) => {
          switch (key) {
            case 'StorageProvider':
              return { create: jest.fn().mockResolvedValue({}) };
            case 'SemanticSearchProvider':
              return { create: jest.fn().mockResolvedValue({}) };
            default:
              return {};
          }
        })
      };

      const module = await NodeRunnerModule.create(mockResourceManager);
      
      expect(module).toBeInstanceOf(NodeRunnerModule);
      expect(mockResourceManager.get).toHaveBeenCalledWith('StorageProvider');
      expect(mockResourceManager.get).toHaveBeenCalledWith('SemanticSearchProvider');
    });
  });

  describe('Dependency Injection', () => {
    it('should inject all required manager dependencies', () => {
      const mockDependencies = {
        processManager: { type: 'ProcessManager' },
        serverManager: { type: 'ServerManager' },
        packageManager: { type: 'PackageManager' },
        logStorage: { type: 'LogStorage' },
        logSearch: { type: 'LogSearch' },
        sessionManager: { type: 'SessionManager' },
        frontendInjector: { type: 'FrontendLogInjector' }
      };

      const module = new NodeRunnerModule(mockDependencies);

      // Verify all dependencies are properly injected
      Object.keys(mockDependencies).forEach(key => {
        expect(module[key]).toBe(mockDependencies[key]);
      });
    });

    it('should handle missing dependencies gracefully', () => {
      expect(() => {
        new NodeRunnerModule({});
      }).not.toThrow();
    });
  });

  describe('Tool Registration', () => {
    it('should return array of tools from getTools()', () => {
      const mockDependencies = {
        processManager: {},
        serverManager: {},
        packageManager: {},
        logStorage: {},
        logSearch: {},
        sessionManager: {},
        frontendInjector: {}
      };

      const module = new NodeRunnerModule(mockDependencies);
      const tools = module.getTools();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register all expected tools', () => {
      const mockDependencies = {
        processManager: {},
        serverManager: {},
        packageManager: {},
        logStorage: {},
        logSearch: {},
        sessionManager: {},
        frontendInjector: {}
      };

      const module = new NodeRunnerModule(mockDependencies);
      const tools = module.getTools();
      const toolNames = tools.map(tool => tool.name);

      // Expected tools from design document
      expect(toolNames).toContain('run_node');
      expect(toolNames).toContain('stop_node');
      expect(toolNames).toContain('search_logs');
      expect(toolNames).toContain('list_sessions');
      expect(toolNames).toContain('server_health');
    });
  });
});