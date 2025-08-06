import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ModuleLoader } from '../../src/ModuleLoader.js';
import { ResourceManager } from '../../src/resources/ResourceManager.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('ModuleLoader Tool Registry', () => {
  let resourceManager;
  let moduleLoader;
  let dbPath;
  
  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Set up test database path
    dbPath = path.join(os.tmpdir(), 'test-tool-registry.db');
  });
  
  beforeEach(async () => {
    // Clean up any existing test database
    try {
      await fs.unlink(dbPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
    
    // Create fresh ModuleLoader instance
    moduleLoader = new ModuleLoader(resourceManager);
  });
  
  afterEach(async () => {
    // Clean up db connections after each test
    if (moduleLoader && moduleLoader._dbProvider) {
      try {
        await moduleLoader._dbProvider.disconnect();
      } catch (error) {
        // Ignore disconnect errors
      }
    }
  });
  
  afterAll(async () => {
    // Clean up any open db connections
    if (moduleLoader && moduleLoader._dbProvider) {
      try {
        await moduleLoader._dbProvider.disconnect();
      } catch (error) {
        // Ignore disconnect errors
      }
    }
    
    // Clean up test database
    try {
      await fs.unlink(dbPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });
  
  describe('Tool Registry Initialization', () => {
    test('should initialize tool registry database', async () => {
      await moduleLoader.initialize();
      
      expect(moduleLoader._initialized).toBe(true);
      expect(moduleLoader._dbInitialized).toBe(true);
      expect(moduleLoader._storage).toBeDefined();
      expect(moduleLoader._toolsCollection).toBeDefined();
      expect(moduleLoader._modulesCollection).toBeDefined();
      expect(moduleLoader._aliasesCollection).toBeDefined();
    });
    
    test('should continue without database if storage package fails', async () => {
      // Mock storage import to fail
      const originalImport = moduleLoader._initializeToolRegistry;
      moduleLoader._initializeToolRegistry = async function() {
        // Simulate the warning that would be logged
        console.warn('[ModuleLoader] Could not initialize tool registry database:', 'Storage package not available');
        this._dbInitialized = false;
      };
      
      await moduleLoader.initialize();
      
      expect(moduleLoader._initialized).toBe(true);
      expect(moduleLoader._dbInitialized).toBe(false);
      
      // Restore original method
      moduleLoader._initializeToolRegistry = originalImport;
    });
  });
  
  describe('Tool Aliases', () => {
    test('should return correct aliases for known tools', async () => {
      await moduleLoader.initialize();
      
      const writeFileAliases = moduleLoader._getToolAliases('write_file');
      expect(writeFileAliases).toContain('file_write');
      expect(writeFileAliases).toContain('create_file');
      
      const executeCommandAliases = moduleLoader._getToolAliases('execute_command');
      expect(executeCommandAliases).toContain('node_run_command');
      expect(executeCommandAliases).toContain('run_command');
      
      const createDirectoryAliases = moduleLoader._getToolAliases('create_directory');
      expect(createDirectoryAliases).toContain('directory_create');
      expect(createDirectoryAliases).toContain('mkdir');
    });
    
    test('should return empty array for unknown tools', async () => {
      await moduleLoader.initialize();
      
      const unknownAliases = moduleLoader._getToolAliases('unknown_tool');
      expect(unknownAliases).toEqual([]);
    });
  });
  
  describe('Tool Registration', () => {
    test('should register tools from a module', async () => {
      await moduleLoader.initialize();
      
      // Create a mock module with tools
      const mockModule = {
        name: 'test-module',
        getTools: () => [
          {
            name: 'test_tool',
            description: 'A test tool',
            execute: async (args) => ({ success: true })
          },
          {
            name: 'another_tool',
            description: 'Another test tool',
            execute: async (args) => ({ success: true })
          }
        ]
      };
      
      await moduleLoader._registerModuleTools(mockModule, 'test-module');
      
      // Check tools are in registry
      expect(moduleLoader.hasTool('test_tool')).toBe(true);
      expect(moduleLoader.hasTool('another_tool')).toBe(true);
      
      const tool = moduleLoader.getTool('test_tool');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('test_tool');
      expect(tool.description).toBe('A test tool');
    });
    
    test('should handle async getTools method', async () => {
      await moduleLoader.initialize();
      
      const mockModule = {
        name: 'async-module',
        getTools: async () => {
          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, 10));
          return [
            {
              name: 'async_tool',
              description: 'An async tool',
              execute: async (args) => ({ success: true })
            }
          ];
        }
      };
      
      await moduleLoader._registerModuleTools(mockModule, 'async-module');
      
      expect(moduleLoader.hasTool('async_tool')).toBe(true);
    });
  });
  
  describe('Tool Lookup by Name or Alias', () => {
    beforeEach(async () => {
      await moduleLoader.initialize();
      
      // Register a test tool
      const mockModule = {
        getTools: () => [
          {
            name: 'write_file',
            description: 'Write a file',
            execute: async (args) => ({ success: true })
          }
        ]
      };
      
      await moduleLoader._registerModuleTools(mockModule, 'filesystem');
    });
    
    test('should find tool by canonical name', async () => {
      const tool = await moduleLoader.getToolByNameOrAlias('write_file');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('write_file');
    });
    
    test('should find tool by alias when DB is initialized', async () => {
      // Register the tool in DB to create aliases
      await moduleLoader._registerToolsInDb('filesystem', [{
        name: 'write_file',
        description: 'Write a file'
      }]);
      
      const tool = await moduleLoader.getToolByNameOrAlias('file_write');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('write_file');
    });
    
    test('should return null for non-existent tool', async () => {
      const tool = await moduleLoader.getToolByNameOrAlias('non_existent_tool');
      expect(tool).toBeNull();
    });
  });
  
  describe('Tool Validation', () => {
    beforeEach(async () => {
      await moduleLoader.initialize();
      
      // Register test tools
      const mockModule = {
        getTools: () => [
          {
            name: 'write_file',
            description: 'Write a file',
            execute: async (args) => ({ success: true })
          },
          {
            name: 'execute_command',
            description: 'Execute a command',
            execute: async (args) => ({ success: true })
          }
        ]
      };
      
      await moduleLoader._registerModuleTools(mockModule, 'test-module');
      await moduleLoader._registerToolsInDb('test-module', mockModule.getTools());
    });
    
    test('should validate plan with valid tools', async () => {
      const plan = {
        steps: [
          {
            id: 'step1',
            actions: [
              { type: 'write_file', parameters: {} },
              { type: 'execute_command', parameters: {} }
            ]
          }
        ]
      };
      
      const validation = await moduleLoader.validatePlanTools(plan);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
    
    test('should validate plan with tool aliases', async () => {
      const plan = {
        steps: [
          {
            id: 'step1',
            actions: [
              { type: 'file_write', parameters: {} },
              { type: 'node_run_command', parameters: {} }
            ]
          }
        ]
      };
      
      const validation = await moduleLoader.validatePlanTools(plan);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
    
    test('should detect invalid tools in plan', async () => {
      const plan = {
        steps: [
          {
            id: 'step1',
            actions: [
              { type: 'write_file', parameters: {} },
              { type: 'invalid_tool', parameters: {} }
            ]
          }
        ]
      };
      
      const validation = await moduleLoader.validatePlanTools(plan);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0]).toContain('invalid_tool');
    });
    
    test('should provide suggestions for similar tool names', async () => {
      const plan = {
        steps: [
          {
            id: 'step1',
            actions: [
              { type: 'write_files', parameters: {} }  // Typo: write_files instead of write_file
            ]
          }
        ]
      };
      
      const validation = await moduleLoader.validatePlanTools(plan);
      expect(validation.valid).toBe(false);
      expect(validation.suggestions['write_files']).toBeDefined();
      expect(validation.suggestions['write_files']).toContain('write_file');
    });
  });
  
  describe('Tool Execution', () => {
    beforeEach(async () => {
      await moduleLoader.initialize();
      
      // Register test tools
      const mockModule = {
        getTools: () => [
          {
            name: 'test_tool',
            execute: async (args) => ({ result: args.value * 2 })
          },
          {
            name: 'invoke_tool',
            invoke: async (toolCall) => {
              const args = JSON.parse(toolCall.function.arguments);
              return { invoked: true, args };
            }
          },
          {
            name: 'run_tool',
            run: async (args) => ({ ran: true, input: args.input })
          }
        ]
      };
      
      await moduleLoader._registerModuleTools(mockModule);
    });
    
    test('should execute tool with execute method', async () => {
      const result = await moduleLoader.executeTool('test_tool', { value: 5 });
      expect(result).toEqual({ result: 10 });
    });
    
    test('should execute tool with invoke method', async () => {
      const result = await moduleLoader.executeTool('invoke_tool', { test: 'value' });
      expect(result.invoked).toBe(true);
      expect(result.args).toEqual({ test: 'value' });
    });
    
    test('should execute tool with run method', async () => {
      const result = await moduleLoader.executeTool('run_tool', { input: 'test' });
      expect(result).toEqual({ ran: true, input: 'test' });
    });
    
    test('should throw error for non-existent tool', async () => {
      await expect(moduleLoader.executeTool('non_existent', {}))
        .rejects.toThrow('Tool not found: non_existent');
    });
    
    test('should throw error for tool without executable method', async () => {
      const badModule = {
        getTools: () => [{
          name: 'bad_tool',
          description: 'No execute method'
        }]
      };
      
      await moduleLoader._registerModuleTools(badModule);
      
      await expect(moduleLoader.executeTool('bad_tool', {}))
        .rejects.toThrow('Tool bad_tool has no execute/invoke/run method');
    });
  });
  
  describe('Tool Statistics', () => {
    test('should return correct tool statistics', async () => {
      await moduleLoader.initialize();
      
      // Register modules with tools
      const module1 = {
        name: 'module1',
        getTools: () => [
          { name: 'tool1', execute: async () => ({}) },
          { name: 'tool2', execute: async () => ({}) }
        ]
      };
      
      const module2 = {
        name: 'module2',
        getTools: () => [
          { name: 'tool3', execute: async () => ({}) }
        ]
      };
      
      moduleLoader.loadedModules.set('module1', module1);
      moduleLoader.loadedModules.set('module2', module2);
      await moduleLoader._registerModuleTools(module1, 'module1');
      await moduleLoader._registerModuleTools(module2, 'module2');
      
      const stats = await moduleLoader.getToolStats();
      
      expect(stats.totalModules).toBe(2);
      expect(stats.totalTools).toBe(3);
      expect(stats.toolsByModule['module1']).toBe(2);
      expect(stats.toolsByModule['module2']).toBe(1);
    });
  });
  
  describe('Required Modules for Plan', () => {
    test('should identify required modules for a plan', async () => {
      await moduleLoader.initialize();
      
      // Register tools in DB with module associations
      await moduleLoader._registerToolsInDb('filesystem-module', [
        { name: 'write_file', description: 'Write file' }
      ]);
      
      await moduleLoader._registerToolsInDb('command-module', [
        { name: 'execute_command', description: 'Execute command' }
      ]);
      
      const plan = {
        steps: [
          {
            id: 'step1',
            actions: [
              { type: 'write_file', parameters: {} },
              { type: 'execute_command', parameters: {} }
            ]
          },
          {
            id: 'step2',
            actions: [
              { type: 'file_write', parameters: {} }  // Alias of write_file
            ]
          }
        ]
      };
      
      const requiredModules = await moduleLoader.getRequiredModulesForPlan(plan);
      
      expect(requiredModules).toContain('filesystem-module');
      expect(requiredModules).toContain('command-module');
      expect(requiredModules).toHaveLength(2); // No duplicates
    });
  });
  
  describe('Module and Tool Inventory', () => {
    test('should generate comprehensive inventory', async () => {
      await moduleLoader.initialize();
      
      // Set up test modules
      const module1 = {
        name: 'Test Module 1',
        description: 'First test module',
        getTools: () => [
          {
            name: 'tool1',
            description: 'First tool',
            execute: async () => ({}),
            inputSchema: { type: 'object' }
          }
        ]
      };
      
      moduleLoader.loadedModules.set('module1', module1);
      await moduleLoader._registerModuleTools(module1);
      
      const inventory = moduleLoader.getModuleAndToolInventory();
      
      expect(inventory.moduleCount).toBe(1);
      expect(inventory.toolCount).toBe(1);
      expect(inventory.modules['module1']).toBeDefined();
      expect(inventory.modules['module1'].name).toBe('Test Module 1');
      expect(inventory.modules['module1'].toolCount).toBe(1);
      expect(inventory.tools['tool1']).toBeDefined();
      expect(inventory.tools['tool1'].hasExecute).toBe(true);
      expect(inventory.tools['tool1'].inputSchema).toBe('defined');
    });
  });
});