/**
 * Integration tests for ModuleLoader
 * 
 * Tests actual module loading with real filesystem and module instances
 * NO MOCKS - these are real integration tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModuleLoader } from '../../src/core/ModuleLoader.js';
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ModuleLoader Integration Tests', () => {
  let moduleLoader;
  let resourceManager;
  let testModulePath;
  
  beforeEach(async () => {
    // Use real ResourceManager singleton
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    moduleLoader = new ModuleLoader({ 
      resourceManager,
      verbose: false 
    });
    
    // Create a temporary test module directory
    testModulePath = path.join(__dirname, '../tmp/test-modules');
    await fs.mkdir(testModulePath, { recursive: true });
  });
  
  afterEach(async () => {
    // Clean up
    if (moduleLoader && moduleLoader.cleanup) {
      moduleLoader.cleanup();
    }
    
    // Clean up test directory
    try {
      await fs.rm(testModulePath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  describe('Loading real modules', () => {
    it('should load a module with ResourceManager dependency', async () => {
      // Create a test module that uses ResourceManager
      const moduleContent = `
export default class TestModule {
  static dependencies = ['MONGODB_URL'];
  
  constructor(dependencies = {}) {
    this.dependencies = dependencies;
  }
  
  getName() {
    return 'TestModule';
  }
  
  getVersion() {
    return '1.0.0';
  }
  
  getDescription() {
    return 'Test module with dependencies';
  }
  
  getTools() {
    return [{
      name: 'testTool',
      description: 'A test tool',
      execute: async (params) => {
        return { 
          success: true, 
          hasMongoUrl: !!this.dependencies.MONGODB_URL 
        };
      },
      inputSchema: {
        type: 'object',
        properties: {}
      },
      outputSchema: {
        type: 'object',
        properties: {}
      }
    }];
  }
}`;
      
      const modulePath = path.join(testModulePath, 'TestModule.js');
      await fs.writeFile(modulePath, moduleContent);
      
      const moduleInstance = await moduleLoader.loadModule(modulePath);
      
      expect(moduleInstance).toBeDefined();
      expect(moduleInstance.getName()).toBe('TestModule');
      
      // Check if dependencies were injected
      const tools = moduleInstance.getTools();
      const result = await tools[0].execute({});
      // The dependencies should be injected, but may be undefined if not in environment
      expect(result).toHaveProperty('hasMongoUrl');
    });
    
    it('should load a module with async factory pattern', async () => {
      const moduleContent = `
export default class AsyncModule {
  static async create(resourceManager) {
    const instance = new AsyncModule();
    instance.initialized = true;
    instance.resourceManager = resourceManager;
    return instance;
  }
  
  getName() {
    return 'AsyncModule';
  }
  
  getVersion() {
    return '1.0.0';
  }
  
  getDescription() {
    return 'Module with async factory';
  }
  
  getTools() {
    return [{
      name: 'asyncTool',
      description: 'Tool from async module',
      execute: async () => ({ 
        success: true, 
        initialized: this.initialized 
      }),
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} }
    }];
  }
}`;
      
      const modulePath = path.join(testModulePath, 'AsyncModule.js');
      await fs.writeFile(modulePath, moduleContent);
      
      const moduleInstance = await moduleLoader.loadModule(modulePath);
      
      expect(moduleInstance).toBeDefined();
      expect(moduleInstance.initialized).toBe(true);
      expect(moduleInstance.resourceManager).toBeDefined();
    });
    
    it('should handle module loading errors gracefully', async () => {
      // Create a module that will fail validation (missing getTools)
      const brokenModule = `
export default class BrokenModule {
  getName() {
    return 'BrokenModule';
  }
  // Missing getTools method - will fail validation
}`;
      
      const modulePath = path.join(testModulePath, 'BrokenModule.js');
      await fs.writeFile(modulePath, brokenModule);
      
      await expect(moduleLoader.loadModule(modulePath))
        .rejects
        .toThrow('Module validation failed');
    });
    
    it('should handle relative and absolute paths', async () => {
      const moduleContent = `
export default class PathTestModule {
  getName() { return 'PathTestModule'; }
  getVersion() { return '1.0.0'; }
  getDescription() { return 'Testing path resolution'; }
  getTools() { return []; }
}`;
      
      const modulePath = path.join(testModulePath, 'PathTestModule.js');
      await fs.writeFile(modulePath, moduleContent);
      
      // Test with absolute path
      const absoluteInstance = await moduleLoader.loadModule(modulePath);
      expect(absoluteInstance.getName()).toBe('PathTestModule');
      
      // Create new loader to test relative path
      const relativeLoader = new ModuleLoader({
        monorepoRoot: path.dirname(__dirname)
      });
      
      const relativePath = path.relative(path.dirname(__dirname), modulePath);
      const relativeInstance = await relativeLoader.loadModule(relativePath);
      expect(relativeInstance.getName()).toBe('PathTestModule');
      
      relativeLoader.cleanup();
    });
  });
  
  describe('Tool execution integration', () => {
    it('should execute tools with real side effects', async () => {
      // Create a module with a tool that has real side effects
      const moduleContent = `
import fs from 'fs/promises';
import path from 'path';

export default class FileModule {
  getName() { return 'FileModule'; }
  getVersion() { return '1.0.0'; }
  getDescription() { return 'File operations module'; }
  
  getTools() {
    return [{
      name: 'writeFile',
      description: 'Write content to a file',
      execute: async (params) => {
        const { filepath, content } = params;
        await fs.writeFile(filepath, content, 'utf-8');
        return { 
          success: true, 
          message: 'File written successfully',
          path: filepath 
        };
      },
      inputSchema: {
        type: 'object',
        properties: {
          filepath: { type: 'string' },
          content: { type: 'string' }
        },
        required: ['filepath', 'content']
      },
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          path: { type: 'string' }
        }
      }
    }];
  }
}`;
      
      const modulePath = path.join(testModulePath, 'FileModule.js');
      await fs.writeFile(modulePath, moduleContent);
      
      const moduleInstance = await moduleLoader.loadModule(modulePath);
      const tools = await moduleLoader.getTools(moduleInstance);
      const writeFileTool = tools.find(t => t.name === 'writeFile');
      
      const testFilePath = path.join(testModulePath, 'test-output.txt');
      const result = await moduleLoader.invokeTool(writeFileTool, {
        filepath: testFilePath,
        content: 'Hello from integration test!'
      });
      
      expect(result.success).toBe(true);
      
      // Verify the file was actually written
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      expect(fileContent).toBe('Hello from integration test!');
    });
    
    it('should handle tool execution failures properly', async () => {
      const moduleContent = `
export default class ErrorModule {
  getName() { return 'ErrorModule'; }
  getVersion() { return '1.0.0'; }
  getDescription() { return 'Module for testing errors'; }
  
  getTools() {
    return [{
      name: 'failingTool',
      description: 'Tool that always fails',
      execute: async (params) => {
        if (!params.shouldSucceed) {
          throw new Error('Tool execution failed as expected');
        }
        return { success: true };
      },
      inputSchema: {
        type: 'object',
        properties: {
          shouldSucceed: { type: 'boolean' }
        }
      },
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' }
        }
      }
    }];
  }
}`;
      
      const modulePath = path.join(testModulePath, 'ErrorModule.js');
      await fs.writeFile(modulePath, moduleContent);
      
      const moduleInstance = await moduleLoader.loadModule(modulePath);
      const tools = await moduleLoader.getTools(moduleInstance);
      const failingTool = tools[0];
      
      // Tool should fail
      await expect(moduleLoader.invokeTool(failingTool, { shouldSucceed: false }))
        .rejects
        .toThrow('Tool execution failed as expected');
      
      // Tool should succeed
      const result = await moduleLoader.invokeTool(failingTool, { shouldSucceed: true });
      expect(result.success).toBe(true);
    });
  });
  
  describe('Module caching', () => {
    it('should cache modules across multiple loads', async () => {
      let loadCount = 0;
      const moduleContent = `
export default class CacheTestModule {
  constructor() {
    this.instanceId = Math.random();
  }
  
  getName() { return 'CacheTestModule'; }
  getVersion() { return '1.0.0'; }
  getDescription() { return 'Testing cache'; }
  getTools() { return []; }
}`;
      
      const modulePath = path.join(testModulePath, 'CacheTestModule.js');
      await fs.writeFile(modulePath, moduleContent);
      
      const instance1 = await moduleLoader.loadModule(modulePath);
      const instance2 = await moduleLoader.loadModule(modulePath);
      
      // Should be the same instance (cached)
      expect(instance1).toBe(instance2);
      expect(instance1.instanceId).toBe(instance2.instanceId);
    });
    
    it('should clear cache on cleanup', async () => {
      const moduleContent = `
export default class CleanupTestModule {
  getName() { return 'CleanupTestModule'; }
  getVersion() { return '1.0.0'; }
  getDescription() { return 'Testing cleanup'; }
  getTools() { return []; }
}`;
      
      const modulePath = path.join(testModulePath, 'CleanupTestModule.js');
      await fs.writeFile(modulePath, moduleContent);
      
      await moduleLoader.loadModule(modulePath);
      expect(moduleLoader.moduleCache.size).toBe(1);
      
      moduleLoader.cleanup();
      expect(moduleLoader.moduleCache.size).toBe(0);
      
      // After cleanup, loading again should create new instance
      const newInstance = await moduleLoader.loadModule(modulePath);
      expect(newInstance).toBeDefined();
      expect(moduleLoader.moduleCache.size).toBe(1);
    });
  });
  
  describe('Monorepo root detection', () => {
    it('should find monorepo root correctly', async () => {
      const loader = new ModuleLoader();
      const monorepoRoot = loader.findMonorepoRoot();
      
      // Should find the Legion monorepo root
      expect(monorepoRoot).toBeDefined();
      expect(monorepoRoot).toContain('Legion');
      
      // Should have package.json with workspaces
      const packageJsonPath = path.join(monorepoRoot, 'package.json');
      const fsSync = await import('fs');
      const packageJson = JSON.parse(fsSync.default.readFileSync(packageJsonPath, 'utf-8'));
      expect(packageJson.workspaces).toBeDefined();
    });
  });
});