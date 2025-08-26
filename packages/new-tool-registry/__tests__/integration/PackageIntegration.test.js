/**
 * Package Integration Tests
 * 
 * Tests that the main package entry point works correctly and all exports
 * are functional when imported as a complete package.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';

// Import the main package
import * as ToolRegistryPackage from '../../src/index.js';

describe('Package Integration', () => {
  let resourceManager;
  let testDbName;

  beforeEach(async () => {
    testDbName = `test_package_integration_${Date.now()}`;
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Override database name for testing
    resourceManager.set('test.database.name', testDbName);
  });

  afterEach(async () => {
    if (resourceManager) {
      // Clean up test database
      try {
        const { DatabaseOperations } = ToolRegistryPackage;
        const dbOps = new DatabaseOperations(resourceManager);
        await dbOps.connect();
        await dbOps.client.db(testDbName).dropDatabase();
        await dbOps.disconnect();
      } catch (error) {
        console.warn('Database cleanup failed:', error.message);
      }
    }
  });

  describe('Package Exports', () => {
    it('should export all required classes', () => {
      expect(ToolRegistryPackage.ToolRegistry).toBeDefined();
      expect(ToolRegistryPackage.ModuleLoader).toBeDefined();
      expect(ToolRegistryPackage.ModuleDiscovery).toBeDefined();
      expect(ToolRegistryPackage.ModuleRegistry).toBeDefined();
      expect(ToolRegistryPackage.DatabaseOperations).toBeDefined();
      expect(ToolRegistryPackage.TextSearch).toBeDefined();
      expect(ToolRegistryPackage.Perspectives).toBeDefined();
      expect(ToolRegistryPackage.VectorStore).toBeDefined();
      expect(ToolRegistryPackage.LRUCache).toBeDefined();
    });

    it('should export error classes', () => {
      expect(ToolRegistryPackage.ModuleLoadError).toBeDefined();
      expect(ToolRegistryPackage.ToolExecutionError).toBeDefined();
      expect(ToolRegistryPackage.ValidationError).toBeDefined();
      expect(ToolRegistryPackage.DatabaseError).toBeDefined();
    });

    it('should export factory functions', () => {
      expect(typeof ToolRegistryPackage.createToolRegistry).toBe('function');
      expect(typeof ToolRegistryPackage.createModuleDiscovery).toBe('function');
      expect(typeof ToolRegistryPackage.createPerspectives).toBe('function');
      expect(typeof ToolRegistryPackage.createVectorStore).toBe('function');
    });
  });

  describe('Factory Functions', () => {
    it('should create ToolRegistry instance with factory function', async () => {
      const toolRegistry = await ToolRegistryPackage.createToolRegistry(resourceManager);
      
      expect(toolRegistry).toBeInstanceOf(ToolRegistryPackage.ToolRegistry);
      expect(typeof toolRegistry.getTool).toBe('function');
      expect(typeof toolRegistry.listTools).toBe('function');
      expect(typeof toolRegistry.searchTools).toBe('function');
      
      await toolRegistry.cleanup();
    });

    it('should create ModuleDiscovery instance with factory function', async () => {
      const discovery = await ToolRegistryPackage.createModuleDiscovery(resourceManager, ['/test/path']);
      
      expect(discovery).toBeInstanceOf(ToolRegistryPackage.ModuleDiscovery);
      expect(typeof discovery.discoverModules).toBe('function');
      expect(typeof discovery.saveToRegistry).toBe('function');
    });
  });

  describe('End-to-End Package Workflow', () => {
    it('should support complete tool registry workflow using package exports', async () => {
      // Create components using factory functions
      const toolRegistry = await ToolRegistryPackage.createToolRegistry(resourceManager);
      const discovery = await ToolRegistryPackage.createModuleDiscovery(resourceManager);

      // Test basic functionality
      const modules = await discovery.discoverModules([]);
      expect(Array.isArray(modules)).toBe(true);

      const tools = await toolRegistry.listTools();
      expect(Array.isArray(tools)).toBe(true);

      // Cleanup
      await toolRegistry.cleanup();
    });

    it('should handle errors properly through exported error classes', async () => {
      try {
        const moduleLoader = new ToolRegistryPackage.ModuleLoader();
        await moduleLoader.loadModule('/nonexistent/module.js');
      } catch (error) {
        expect(error).toBeInstanceOf(ToolRegistryPackage.ModuleLoadError);
        expect(error.message).toContain('Failed to load module');
      }
    });
  });

  describe('Package Import Verification', () => {
    it('should be importable as ES module', async () => {
      // Test dynamic import
      const imported = await import('../../src/index.js');
      expect(imported.ToolRegistry).toBeDefined();
      expect(imported.createToolRegistry).toBeDefined();
    });

    it('should maintain consistent API surface', () => {
      // Verify key exports match expected API
      const expectedExports = [
        'ToolRegistry',
        'ModuleLoader', 
        'ModuleDiscovery',
        'ModuleRegistry',
        'DatabaseOperations',
        'TextSearch',
        'Perspectives',
        'VectorStore',
        'LRUCache',
        'createToolRegistry',
        'createModuleDiscovery',
        'ModuleLoadError',
        'ToolExecutionError'
      ];

      for (const exportName of expectedExports) {
        expect(ToolRegistryPackage[exportName]).toBeDefined();
      }
    });
  });
});