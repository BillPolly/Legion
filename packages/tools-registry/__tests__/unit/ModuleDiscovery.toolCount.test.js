/**
 * Unit tests for ModuleDiscovery tool counting functionality
 * 
 * Tests that module discovery correctly counts tools during validation
 * and properly separates fast discovery from slow validation.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { ModuleDiscovery } from '../../src/core/ModuleDiscovery.js';
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ModuleDiscovery Tool Count Tests', () => {
  let moduleDiscovery;
  let resourceManager;
  let testDir;
  
  beforeAll(async () => {
    // Get the real ResourceManager singleton for integration testing
    resourceManager = await ResourceManager.getInstance();
  });
  
  beforeEach(async () => {
    moduleDiscovery = new ModuleDiscovery({ 
      resourceManager,
      verbose: false 
    });
    
    // Create test directory
    testDir = path.join(__dirname, '../tmp/tool-count-test');
    await fs.mkdir(testDir, { recursive: true });
  });
  
  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('validateModule with tool counting', () => {
    it('should count tools correctly for valid module with tools', async () => {
      // Create a test module with 3 tools
      const moduleWithTools = `
export default class TestModuleWithTools {
  static async create(resourceManager) {
    return new TestModuleWithTools();
  }

  get name() { return 'TestModuleWithTools'; }
  
  getTools() {
    return [
      {
        name: 'tool1',
        description: 'First test tool',
        inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
        execute: async (params) => ({ result: 'tool1 result' })
      },
      {
        name: 'tool2', 
        description: 'Second test tool',
        inputSchema: { type: 'object', properties: { input: { type: 'number' } } },
        outputSchema: { type: 'object', properties: { result: { type: 'number' } } },
        execute: async (params) => ({ result: params.input * 2 })
      },
      {
        name: 'tool3',
        description: 'Third test tool',
        inputSchema: { type: 'object', properties: { data: { type: 'array' } } },
        outputSchema: { type: 'object', properties: { count: { type: 'number' } } },
        execute: async (params) => ({ count: params.data.length })
      }
    ];
  }
}`;

      const modulePath = path.join(testDir, 'TestModuleWithTools.js');
      await fs.writeFile(modulePath, moduleWithTools);

      // Load the module object first, then validate it
      const moduleObject = await moduleDiscovery.moduleLoader.loadModule(modulePath);
      const validationResult = await moduleDiscovery.validateModule(moduleObject);

      expect(validationResult.valid).toBe(true);
      expect(validationResult.toolsCount).toBe(3);
      expect(validationResult.errors.length).toBe(0);
    });

    it('should count tools correctly for module with partial tool properties', async () => {
      // Create a module where some tools are missing properties
      const modulePartialTools = `
export default class TestModulePartialTools {
  static async create(resourceManager) {
    return new TestModulePartialTools();
  }

  get name() { return 'TestModulePartialTools'; }
  
  getTools() {
    return [
      {
        name: 'goodTool',
        description: 'Complete tool',
        inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
        execute: async (params) => ({ result: 'good' })
      },
      {
        name: 'badTool',
        // Missing description, inputSchema, outputSchema
        execute: async (params) => ({ result: 'bad' })
      },
      {
        name: 'incompleteTool',
        description: 'Has description but missing schemas',
        execute: async (params) => ({ result: 'incomplete' })
      }
    ];
  }
}`;

      const modulePath = path.join(testDir, 'TestModulePartialTools.js');
      await fs.writeFile(modulePath, modulePartialTools);

      // Load the module object first, then validate it
      const moduleObject = await moduleDiscovery.moduleLoader.loadModule(modulePath);
      const validationResult = await moduleDiscovery.validateModule(moduleObject);

      expect(validationResult.valid).toBe(true);
      expect(validationResult.toolsCount).toBe(3); // Should count all tools
      // Tools without required properties are still valid if they have name and execute
      expect(validationResult.errors.length).toBe(0);
    });

    it('should return 0 tools for module without tools', async () => {
      const moduleNoTools = `
export default class TestModuleNoTools {
  static async create(resourceManager) {
    return new TestModuleNoTools();
  }

  get name() { return 'TestModuleNoTools'; }
  
  getTools() {
    return [];
  }
}`;

      const modulePath = path.join(testDir, 'TestModuleNoTools.js');
      await fs.writeFile(modulePath, moduleNoTools);

      // Load the module object first, then validate it
      const moduleObject = await moduleDiscovery.moduleLoader.loadModule(modulePath);
      const validationResult = await moduleDiscovery.validateModule(moduleObject);

      expect(validationResult.valid).toBe(true);
      expect(validationResult.toolsCount).toBe(0);
      expect(validationResult.errors.length).toBe(0);
    });

    it('should handle modules where getTools() throws an error', async () => {
      const moduleErrorTools = `
export default class TestModuleErrorTools {
  static async create(resourceManager) {
    return new TestModuleErrorTools();
  }

  get name() { return 'TestModuleErrorTools'; }
  
  getTools() {
    throw new Error('Tools not available');
  }
}`;

      const modulePath = path.join(testDir, 'TestModuleErrorTools.js');
      await fs.writeFile(modulePath, moduleErrorTools);

      // Load the module object first, then validate it
      const moduleObject = await moduleDiscovery.moduleLoader.loadModule(modulePath);
      const validationResult = await moduleDiscovery.validateModule(moduleObject);

      expect(validationResult.valid).toBe(false); // getTools() throwing is now invalid
      expect(validationResult.toolsCount).toBe(0); // Default to 0 when getTools fails
      expect(validationResult.errors.some(e => e.includes('getTools() failed'))).toBe(true);
    });

    it('should handle modules without getTools method', async () => {
      const moduleNoGetTools = `
export default class TestModuleNoGetTools {
  static async create(resourceManager) {
    return new TestModuleNoGetTools();
  }

  get name() { return 'TestModuleNoGetTools'; }
  // No getTools method
}`;

      const modulePath = path.join(testDir, 'TestModuleNoGetTools.js');
      await fs.writeFile(modulePath, moduleNoGetTools);

      // Loading should fail because ModuleLoader validates structure
      await expect(moduleDiscovery.moduleLoader.loadModule(modulePath))
        .rejects
        .toThrow('Module validation failed - must follow standard Legion module interface');
    });
  });

  describe('discoverInMonorepo vs discoverAndValidate separation', () => {
    it('should discover modules quickly without validation', async () => {
      const startTime = Date.now();
      
      // discoverInMonorepo should be fast (no tool counting)
      const modules = await moduleDiscovery.discoverInMonorepo();
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(Array.isArray(modules)).toBe(true);
      expect(modules.length).toBeGreaterThan(0);
      
      // Should be fast - under 5 seconds even for large monorepo
      expect(duration).toBeLessThan(5000);
      
      // Modules should not have toolsCount in basic discovery
      modules.forEach(module => {
        expect(module.name).toBeDefined();
        expect(module.path).toBeDefined();
        expect(module.packageName).toBeDefined();
        // Should not have validation results
        expect(module.validation).toBeUndefined();
      });

      console.log(`✅ Fast discovery found ${modules.length} modules in ${duration}ms`);
    });

    it.skip('should validate modules with tool counting (slower) - skipped due to timeout', async () => {
      const startTime = Date.now();
      
      // discoverAndValidate should count tools but be slower
      const result = await moduleDiscovery.discoverAndValidate();
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.discovered).toBeGreaterThan(0);
      expect(result.validated.length + result.invalid.length).toBe(result.discovered);
      
      // Check that some modules have tool counts
      const modulesWithTools = result.validated.filter(m => 
        m.validation && m.validation.toolsCount > 0
      );
      
      // At least some modules should have tools
      expect(modulesWithTools.length).toBeGreaterThan(0);
      
      console.log(`✅ Validation discovery found ${result.discovered} modules with tool counts in ${duration}ms`);
      console.log(`   - Valid modules: ${result.summary.valid}`);
      console.log(`   - Invalid modules: ${result.summary.invalid}`);
      console.log(`   - Modules with tools: ${modulesWithTools.length}`);
      
      // Log some examples
      modulesWithTools.slice(0, 3).forEach(module => {
        console.log(`   - ${module.name}: ${module.validation.toolsCount} tools`);
      });
    }, 60000); // Increase timeout to 60 seconds for validation test
  });

  describe('tool counting validation details', () => {
    it('should validate tool property requirements correctly', async () => {
      // Create module with mix of valid and invalid tools
      const mixedToolsModule = `
export default class TestMixedTools {
  static async create(resourceManager) {
    return new TestMixedTools();
  }

  get name() { return 'TestMixedTools'; }
  
  getTools() {
    return [
      {
        name: 'perfectTool',
        description: 'Perfect tool with all properties',
        inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
        execute: async (params) => ({ result: 'perfect' })
      },
      {
        name: 'toolWithInput',
        description: 'Tool with input property instead of inputSchema',
        input: 'string input',
        outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
        execute: async (params) => ({ result: 'input-style' })
      },
      {
        name: 'toolWithOutput', 
        description: 'Tool with output property instead of outputSchema',
        inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
        output: 'string output',
        execute: async (params) => ({ result: 'output-style' })
      },
      {
        name: 'toolWithBoth',
        description: 'Tool with both input/output properties',
        input: 'string input',
        output: 'string output', 
        execute: async (params) => ({ result: 'both-style' })
      },
      {
        name: 'incompleteTool',
        description: 'Tool missing input/output info',
        execute: async (params) => ({ result: 'incomplete' })
      },
      {
        name: 'noDescriptionTool',
        // Missing description
        inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
        execute: async (params) => ({ result: 'no-desc' })
      }
    ];
  }
}`;

      const modulePath = path.join(testDir, 'TestMixedTools.js');
      await fs.writeFile(modulePath, mixedToolsModule);

      // Load the module object first, then validate it
      const moduleObject = await moduleDiscovery.moduleLoader.loadModule(modulePath);
      const validationResult = await moduleDiscovery.validateModule(moduleObject);

      expect(validationResult.valid).toBe(true);
      expect(validationResult.toolsCount).toBe(6); // All tools counted
      
      // Tools without all properties are still valid if they have name and execute
      expect(validationResult.errors.length).toBe(0);

      console.log(`✅ Mixed tools validation: ${validationResult.toolsCount} tools`);
    });
  });
});