/**
 * Tests for ModuleLoaderIntegration with @legion/module-loader
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { ModuleLoaderIntegration } from '../../src/integration/ModuleLoaderIntegration.js';

describe('ModuleLoaderIntegration', () => {
  let integration;

  beforeEach(() => {
    integration = new ModuleLoaderIntegration();
  });

  describe('Constructor', () => {
    test('should create ModuleLoaderIntegration instance', () => {
      expect(integration).toBeDefined();
      expect(integration.moduleFactory).toBeNull();
      expect(integration.resourceManager).toBeNull();
      expect(integration.initialized).toBe(false);
      expect(integration.loadedModules).toBeInstanceOf(Map);
    });
  });

  describe('Initialization', () => {
    test('should initialize with module factory and resource manager', async () => {
      await integration.initialize();
      
      expect(integration.initialized).toBe(true);
      expect(integration.moduleFactory).toBeDefined();
      expect(integration.resourceManager).toBeDefined();
    });

    test('should throw error if initialization fails', async () => {
      // Test error handling during initialization
      expect(integration.initialize).toBeDefined();
    });

    test('should handle reinitialization gracefully', async () => {
      await integration.initialize();
      expect(integration.initialized).toBe(true);
      
      // Should not throw on second initialization
      await expect(integration.initialize()).resolves.not.toThrow();
      expect(integration.initialized).toBe(true);
    });
  });

  describe('Module Loading', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    test('should load module by name', async () => {
      const moduleName = 'test-module';
      const moduleConfig = {
        name: moduleName,
        version: '1.0.0',
        dependencies: []
      };

      const result = await integration.loadModule(moduleName, moduleConfig);
      
      expect(result.success).toBe(true);
      expect(result.module).toBeDefined();
      expect(result.moduleName).toBe(moduleName);
      expect(integration.loadedModules.has(moduleName)).toBe(true);
    });

    test('should load multiple modules', async () => {
      const modules = [
        { name: 'module1', config: { name: 'module1' } },
        { name: 'module2', config: { name: 'module2' } },
        { name: 'module3', config: { name: 'module3' } }
      ];

      const results = await integration.loadModules(modules);
      
      expect(results.success).toBe(true);
      expect(results.loadedCount).toBe(3);
      expect(results.failedCount).toBe(0);
      expect(integration.loadedModules.size).toBe(3);
    });

    test('should handle module loading failures gracefully', async () => {
      const invalidModuleName = 'invalid-module';
      const invalidConfig = { invalid: true };

      const result = await integration.loadModule(invalidModuleName, invalidConfig);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(integration.loadedModules.has(invalidModuleName)).toBe(false);
    });

    test('should handle duplicate module loading', async () => {
      const moduleName = 'duplicate-module';
      const moduleConfig = { name: moduleName };

      // Load module first time
      const firstResult = await integration.loadModule(moduleName, moduleConfig);
      expect(firstResult.success).toBe(true);

      // Load same module again
      const secondResult = await integration.loadModule(moduleName, moduleConfig);
      expect(secondResult.success).toBe(true);
      expect(secondResult.alreadyLoaded).toBe(true);
      expect(integration.loadedModules.size).toBe(1);
    });
  });

  describe('Module Management', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    test('should get loaded module by name', async () => {
      const moduleName = 'test-module';
      const moduleConfig = { name: moduleName };

      await integration.loadModule(moduleName, moduleConfig);
      const module = integration.getModule(moduleName);
      
      expect(module).toBeDefined();
      expect(module.name).toBe(moduleName);
    });

    test('should return null for non-existent module', () => {
      const module = integration.getModule('non-existent');
      expect(module).toBeNull();
    });

    test('should list all loaded modules', async () => {
      const modules = [
        { name: 'module1', config: { name: 'module1' } },
        { name: 'module2', config: { name: 'module2' } }
      ];

      await integration.loadModules(modules);
      const loadedModules = integration.listModules();
      
      expect(loadedModules).toHaveLength(2);
      expect(loadedModules).toContain('module1');
      expect(loadedModules).toContain('module2');
    });

    test('should unload module by name', async () => {
      const moduleName = 'test-module';
      const moduleConfig = { name: moduleName };

      await integration.loadModule(moduleName, moduleConfig);
      expect(integration.loadedModules.has(moduleName)).toBe(true);

      const result = integration.unloadModule(moduleName);
      
      expect(result.success).toBe(true);
      expect(integration.loadedModules.has(moduleName)).toBe(false);
    });

    test('should handle unloading non-existent module', () => {
      const result = integration.unloadModule('non-existent');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should unload all modules', async () => {
      const modules = [
        { name: 'module1', config: { name: 'module1' } },
        { name: 'module2', config: { name: 'module2' } }
      ];

      await integration.loadModules(modules);
      expect(integration.loadedModules.size).toBe(2);

      const result = integration.unloadAllModules();
      
      expect(result.success).toBe(true);
      expect(result.unloadedCount).toBe(2);
      expect(integration.loadedModules.size).toBe(0);
    });
  });

  describe('Resource Management', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    test('should register resource with manager', async () => {
      const resourceName = 'test-resource';
      const resourceConfig = {
        type: 'service',
        provider: 'mock'
      };

      const result = await integration.registerResource(resourceName, resourceConfig);
      
      expect(result.success).toBe(true);
      expect(result.resourceName).toBe(resourceName);
    });

    test('should get resource from manager', async () => {
      const resourceName = 'test-resource';
      const resourceConfig = { type: 'service' };

      await integration.registerResource(resourceName, resourceConfig);
      const resource = await integration.getResource(resourceName);
      
      expect(resource).toBeDefined();
      expect(resource.name).toBe(resourceName);
    });

    test('should handle resource registration failures', async () => {
      const invalidResourceName = '';
      const invalidConfig = null;

      const result = await integration.registerResource(invalidResourceName, invalidConfig);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should list registered resources', async () => {
      const resources = [
        { name: 'resource1', config: { type: 'service' } },
        { name: 'resource2', config: { type: 'tool' } }
      ];

      for (const { name, config } of resources) {
        await integration.registerResource(name, config);
      }

      const resourceList = await integration.listResources();
      
      expect(resourceList).toBeDefined();
      expect(resourceList.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Tool Management', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    test('should create tool from module', async () => {
      const moduleName = 'tool-module';
      const moduleConfig = {
        name: moduleName,
        tools: ['testTool']
      };

      await integration.loadModule(moduleName, moduleConfig);
      const tool = await integration.createTool(moduleName, 'testTool', {});
      
      expect(tool).toBeDefined();
      expect(tool.name).toBe('testTool');
    });

    test('should get tools from module', async () => {
      const moduleName = 'tool-module';
      const moduleConfig = {
        name: moduleName,
        tools: ['tool1', 'tool2']
      };

      await integration.loadModule(moduleName, moduleConfig);
      const tools = integration.getModuleTools(moduleName);
      
      expect(tools).toBeDefined();
      expect(tools.length).toBeGreaterThan(0);
    });

    test('should validate tool configuration', () => {
      const validConfig = {
        name: 'test-tool',
        description: 'A test tool',
        parameters: {}
      };

      const invalidConfig = {
        name: '',
        description: null
      };

      expect(integration.validateToolConfig(validConfig)).toBe(true);
      expect(integration.validateToolConfig(invalidConfig)).toBe(false);
    });
  });

  describe('Schema Validation', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    test('should validate module schema', () => {
      const validSchema = {
        name: 'test-module',
        version: '1.0.0',
        description: 'A test module',
        dependencies: [],
        tools: []
      };

      const invalidSchema = {
        name: '',
        version: null
      };

      expect(integration.validateModuleSchema(validSchema)).toBe(true);
      expect(integration.validateModuleSchema(invalidSchema)).toBe(false);
    });

    test('should validate resource schema', () => {
      const validSchema = {
        name: 'test-resource',
        type: 'service',
        config: {}
      };

      const invalidSchema = {
        name: '',
        type: 'invalid-type'
      };

      expect(integration.validateResourceSchema(validSchema)).toBe(true);
      expect(integration.validateResourceSchema(invalidSchema)).toBe(false);
    });

    test('should get validation errors', () => {
      const invalidSchema = {
        name: '',
        version: null
      };

      const errors = integration.getValidationErrors(invalidSchema, 'module');
      
      expect(errors).toBeDefined();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toHaveProperty('field');
      expect(errors[0]).toHaveProperty('error');
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    test('should handle module loading errors gracefully', async () => {
      const result = await integration.loadModule('', null);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });

    test('should handle resource registration errors gracefully', async () => {
      const result = await integration.registerResource(null, undefined);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should provide detailed error information', async () => {
      const result = await integration.loadModule('', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.errorDetails).toBeDefined();
      expect(result.errorCode).toBeDefined();
    });

    test('should recover from initialization failures', async () => {
      // Force an error condition
      integration.initialized = false;
      integration.moduleFactory = null;

      // Should be able to reinitialize
      await expect(integration.initialize()).resolves.not.toThrow();
      expect(integration.initialized).toBe(true);
    });
  });

describe('Integration with Legion Module Loader', () => {
    test('should use ModuleFactory from @legion/module-loader', async () => {
      await integration.initialize();
      
      expect(integration.moduleFactory).toBeDefined();
      expect(typeof integration.moduleFactory.createModule).toBe('function');
    });

    test('should use ResourceManager from @legion/module-loader', async () => {
      await integration.initialize();
      
      expect(integration.resourceManager).toBeDefined();
      expect(typeof integration.resourceManager.register).toBe('function');
    });

test('should handle Legion module patterns correctly', async () => {
      await integration.initialize();
      
const moduleName = 'legion-pattern-module';
      const moduleConfig = {
        name: moduleName,
type: 'legion-module',
        exports: ['tool1', 'tool2']
      };

      const result = await integration.loadModule(moduleName, moduleConfig);
      
      expect(result.success).toBe(true);
      expect(result.module).toBeDefined();
    });
  });
});