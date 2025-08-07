/**
 * Test for JSON Configuration System
 * Tests loading BT configurations from JSON files and using them as tools
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { BehaviorTreeTool } from '../src/integration/BehaviorTreeTool.js';
import { BehaviorTreeLoader } from '../src/integration/BehaviorTreeLoader.js';
import { BehaviorTreeExecutor } from '../src/core/BehaviorTreeExecutor.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for test files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock ToolRegistry
class MockToolRegistry {
  constructor() {
    this.tools = new Map();
    this.providers = new Map();
  }

  async getTool(toolName) {
    return this.tools.get(toolName);
  }

  async registerProvider(provider) {
    this.providers.set(provider.name, provider);
  }

  registerTool(name, tool) {
    this.tools.set(name, tool);
  }
}

// Mock tools for testing
const createMockTool = (name, behavior = 'success') => ({
  name,
  async execute(params) {
    console.log(`[MockTool:${name}] Executing with:`, params);
    
    if (behavior === 'success') {
      return {
        success: true,
        data: { 
          result: `${name} completed with params: ${JSON.stringify(params)}`,
          tool: name,
          params
        }
      };
    } else {
      return {
        success: false,
        data: { 
          error: `${name} failed`,
          tool: name
        }
      };
    }
  },
  getMetadata() {
    return {
      name,
      description: `Mock tool ${name}`,
      input: { content: { type: 'string' }, path: { type: 'string' } },
      output: { result: { type: 'string' } }
    };
  }
});

describe('JSON Configuration System', () => {
  let toolRegistry;
  let loader;

  beforeEach(() => {
    toolRegistry = new MockToolRegistry();
    loader = new BehaviorTreeLoader(toolRegistry);

    // Register mock tools that would be referenced in BT configs
    toolRegistry.registerTool('FileSystemModule.writeFile', createMockTool('writeFile'));
    toolRegistry.registerTool('codeGenerator', createMockTool('codeGenerator'));
    toolRegistry.registerTool('testGenerator', createMockTool('testGenerator'));
    toolRegistry.registerTool('testRunner', createMockTool('testRunner'));
    toolRegistry.registerTool('docGenerator', createMockTool('docGenerator'));
    toolRegistry.registerTool('staticAnalyzer', createMockTool('staticAnalyzer'));
  });

  describe('BehaviorTreeTool', () => {
    test('should create BT tool from simple configuration', () => {
      const config = {
        name: 'SimpleClassGen',
        description: 'Simple class generator',
        input: {
          className: { type: 'string', required: true }
        },
        output: {
          status: { type: 'string' },
          code: { type: 'string' }
        },
        implementation: {
          type: 'sequence',
          children: [
            { type: 'action', tool: 'codeGenerator', params: { name: '{{className}}' } }
          ]
        }
      };

      const btTool = new BehaviorTreeTool(config, toolRegistry);
      const metadata = btTool.getMetadata();

      expect(metadata.name).toBe('SimpleClassGen');
      expect(metadata.toolType).toBe('behavior-tree');
      expect(metadata.input.className.required).toBe(true);
    });

    test('should execute simple BT tool', async () => {
      const config = {
        name: 'SimpleTest',
        description: 'Simple test tool',
        input: {
          message: { type: 'string', required: true }
        },
        output: {
          status: { type: 'string' }
        },
        implementation: {
          type: 'action',
          tool: 'codeGenerator',
          params: {
            content: 'Hello {{message}}'
          }
        }
      };

      const btTool = new BehaviorTreeTool(config, toolRegistry);
      const result = await btTool.execute({ message: 'World' });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('SUCCESS');
    });

    test('should validate input against schema', async () => {
      const config = {
        name: 'ValidatedTool',
        input: {
          requiredField: { type: 'string', required: true },
          optionalField: { type: 'number', default: 42 }
        },
        implementation: {
          type: 'action',
          tool: 'codeGenerator'
        }
      };

      const btTool = new BehaviorTreeTool(config, toolRegistry);

      // Test valid input
      const validResult = btTool.validateInput({
        requiredField: 'test'
      });
      expect(validResult.valid).toBe(true);

      // Test invalid input (missing required field)
      const invalidResult = btTool.validateInput({
        optionalField: 100
      });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain('Missing required input: requiredField');
    });

    test('should transform input/output correctly', async () => {
      const config = {
        name: 'TransformTest',
        input: {
          userName: { type: 'string', required: true }
        },
        output: {
          generatedCode: { type: 'string' }
        },
        inputTransform: {
          className: 'userName'
        },
        outputTransform: {
          generatedCode: 'artifacts.code'
        },
        implementation: {
          type: 'action',
          tool: 'codeGenerator',
          params: {
            name: '{{className}}'
          }
        }
      };

      const btTool = new BehaviorTreeTool(config, toolRegistry);
      const result = await btTool.execute({ userName: 'TestUser' });

      expect(result.success).toBe(true);
      // The transformation should work even with mock implementation
    });

    test('should create ModuleProvider wrapper', () => {
      const config = {
        name: 'TestTool',
        implementation: { type: 'action', tool: 'codeGenerator' }
      };

      const btTool = new BehaviorTreeTool(config, toolRegistry);
      const moduleProvider = btTool.asModuleProvider();

      expect(moduleProvider.name).toBe('TestTool');
      expect(moduleProvider.definition).toBeDefined();
      expect(typeof moduleProvider.definition.create).toBe('function');
      expect(typeof moduleProvider.definition.getMetadata).toBe('function');
    });
  });

  describe('BehaviorTreeLoader', () => {
    test('should validate BT configuration', () => {
      // Valid configuration
      const validConfig = {
        name: 'ValidTool',
        implementation: {
          type: 'sequence',
          children: [
            { type: 'action', tool: 'codeGenerator' }
          ]
        }
      };

      const validResult = loader.validateBTConfig(validConfig);
      expect(validResult.valid).toBe(true);

      // Invalid configuration (missing name)
      const invalidConfig = {
        implementation: {
          type: 'action',
          tool: 'codeGenerator'
        }
      };

      const invalidResult = loader.validateBTConfig(invalidConfig);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain('Configuration must specify name');
    });

    test('should validate BT tree structure', () => {
      // Valid tree
      const validTree = {
        type: 'sequence',
        children: [
          { type: 'action', tool: 'codeGenerator' },
          { type: 'action', tool: 'testRunner' }
        ]
      };

      const validResult = loader.validateBTTree(validTree);
      expect(validResult.errors.length).toBe(0);

      // Invalid tree (action without tool)
      const invalidTree = {
        type: 'sequence',
        children: [
          { type: 'action' } // Missing tool
        ]
      };

      const invalidResult = loader.validateBTTree(invalidTree);
      expect(invalidResult.errors).toContain('Action nodes must specify tool');
    });

    test('should deep merge template configuration', () => {
      const template = {
        description: 'Base template',
        input: {
          baseField: { type: 'string' }
        },
        implementation: {
          type: 'sequence',
          children: []
        }
      };

      const config = {
        name: 'SpecificTool',
        input: {
          specificField: { type: 'number' }
        },
        implementation: {
          children: [
            { type: 'action', tool: 'codeGenerator' }
          ]
        }
      };

      const merged = loader.deepMerge(template, config);

      expect(merged.name).toBe('SpecificTool');
      expect(merged.description).toBe('Base template');
      expect(merged.input.baseField).toBeDefined();
      expect(merged.input.specificField).toBeDefined();
      expect(merged.implementation.type).toBe('sequence');
      expect(merged.implementation.children.length).toBe(1);
    });

    test('should create BT tool from JSON-like config', async () => {
      const jsonConfig = {
        name: 'JSONClassGen',
        description: 'JSON-defined class generator',
        input: {
          className: { type: 'string', required: true }
        },
        implementation: {
          type: 'sequence',
          children: [
            {
              type: 'action',
              tool: 'codeGenerator',
              params: { name: '{{className}}' }
            },
            {
              type: 'action', 
              tool: 'FileSystemModule.writeFile',
              params: {
                path: '{{className}}.js',
                content: '{{codeGenerator.result}}'
              }
            }
          ]
        }
      };

      // Simulate loading from JSON
      const btTool = new BehaviorTreeTool(jsonConfig, toolRegistry);
      
      const result = await btTool.execute({
        className: 'TestClass'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Integration with ToolRegistry', () => {
    test('should register BT tool and make it callable', async () => {
      const config = {
        name: 'IntegrationTest',
        description: 'Test BT integration with ToolRegistry',
        input: {
          input: { type: 'string', required: true }
        },
        implementation: {
          type: 'action',
          tool: 'codeGenerator',
          params: { data: '{{input}}' }
        }
      };

      const btTool = new BehaviorTreeTool(config, toolRegistry);
      
      // Register the tool
      await loader.registerBehaviorTreeTool(btTool);
      
      // Verify it was registered
      expect(toolRegistry.providers.has('IntegrationTest')).toBe(true);
      
      // Test the registration creates the expected provider structure
      const provider = toolRegistry.providers.get('IntegrationTest');
      expect(provider.definition).toBeDefined();
      
      const metadata = provider.definition.getMetadata();
      expect(metadata.name).toBe('IntegrationTest');
      expect(metadata.tools.IntegrationTest).toBeDefined();
    });
  });
});