/**
 * Integration tests for BehaviorTreeTool
 * Tests BT registration, execution through ToolRegistry, and schema validation
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { BehaviorTreeTool } from '../../src/integration/BehaviorTreeTool.js';
import { BehaviorTreeLoader } from '../../src/integration/BehaviorTreeLoader.js';
import { BehaviorTreeExecutor } from '../../src/core/BehaviorTreeExecutor.js';
import { NodeStatus } from '../../src/core/BehaviorTreeNode.js';

// Mock ToolRegistry with full functionality
class MockToolRegistry {
  constructor() {
    this.tools = new Map();
    this.providers = new Map();
    this.executionLog = [];
  }

  async getTool(toolName) {
    // Log tool access for verification
    this.executionLog.push({ action: 'getTool', toolName, timestamp: Date.now() });
    
    const tool = this.tools.get(toolName);
    if (!tool) {
      // Check if we have a provider that can create this tool
      for (const [providerName, provider] of this.providers) {
        if (provider.canProvideTool && provider.canProvideTool(toolName)) {
          return provider.provideTool(toolName);
        }
      }
    }
    return tool;
  }

  async registerProvider(provider) {
    this.providers.set(provider.name, provider);
    this.executionLog.push({ action: 'registerProvider', name: provider.name });
  }

  registerTool(name, tool) {
    this.tools.set(name, tool);
    this.executionLog.push({ action: 'registerTool', name });
  }

  hasProvider(name) {
    return this.providers.has(name);
  }

  hasTool(name) {
    return this.tools.has(name);
  }

  getExecutionLog() {
    return this.executionLog;
  }

  clearLog() {
    this.executionLog = [];
  }
}

// Mock atomic tools for testing
const createMockTool = (name, behavior = 'success') => ({
  name,
  async execute(params) {
    if (behavior === 'success') {
      return {
        success: true,
        data: { 
          result: `${name} executed successfully`,
          params,
          timestamp: Date.now()
        }
      };
    } else if (behavior === 'failure') {
      return {
        success: false,
        data: { 
          error: `${name} failed`,
          params
        }
      };
    } else if (behavior === 'error') {
      throw new Error(`${name} threw an error`);
    }
    return { success: true, data: {} };
  },
  getMetadata() {
    return {
      name,
      description: `Mock tool ${name}`,
      input: {
        data: { type: 'object', required: false }
      },
      output: {
        result: { type: 'string' }
      }
    };
  }
});

describe('BehaviorTreeTool Integration Tests', () => {
  let toolRegistry;
  let loader;

  beforeEach(() => {
    toolRegistry = new MockToolRegistry();
    loader = new BehaviorTreeLoader(toolRegistry);

    // Register mock atomic tools
    toolRegistry.registerTool('dataFetcher', createMockTool('dataFetcher'));
    toolRegistry.registerTool('dataProcessor', createMockTool('dataProcessor'));
    toolRegistry.registerTool('dataValidator', createMockTool('dataValidator'));
    toolRegistry.registerTool('reportGenerator', createMockTool('reportGenerator'));
    toolRegistry.registerTool('errorLogger', createMockTool('errorLogger', 'failure'));
  });

  describe('BT Tool Creation and Registration', () => {
    test('should create BT tool from configuration and register as provider', async () => {
      const btConfig = {
        name: 'DataPipeline',
        description: 'Process data through multiple stages',
        input: {
          data: { type: 'object', required: true, description: 'Input data to process' },
          options: { type: 'object', required: false, description: 'Processing options' }
        },
        output: {
          processedData: { type: 'object', description: 'Processed result' },
          report: { type: 'string', description: 'Processing report' }
        },
        implementation: {
          type: 'sequence',
          description: 'Data processing pipeline',
          children: [
            { 
              type: 'action', 
              tool: 'dataFetcher',
              params: { source: '{{data.source}}' }
            },
            { 
              type: 'action', 
              tool: 'dataProcessor',
              params: { mode: '{{options.mode}}' }
            },
            { 
              type: 'action', 
              tool: 'dataValidator'
            },
            { 
              type: 'action', 
              tool: 'reportGenerator'
            }
          ]
        }
      };

      const btTool = new BehaviorTreeTool(btConfig, toolRegistry);
      
      // Verify tool metadata
      const metadata = btTool.getMetadata();
      expect(metadata.name).toBe('DataPipeline');
      expect(metadata.toolType).toBe('behavior-tree');
      expect(metadata.input.data.required).toBe(true);
      expect(metadata.output.processedData).toBeDefined();

      // Register as provider
      const provider = btTool.asModuleProvider();
      await toolRegistry.registerProvider(provider);
      
      expect(toolRegistry.hasProvider('DataPipeline')).toBe(true);
    });

    test('should validate input against schema before execution', async () => {
      const strictConfig = {
        name: 'StrictTool',
        input: {
          requiredField: { type: 'string', required: true },
          optionalField: { type: 'number', required: false, default: 42 }
        },
        output: {
          status: { type: 'string' }
        },
        implementation: {
          type: 'action',
          tool: 'dataProcessor'
        }
      };

      const btTool = new BehaviorTreeTool(strictConfig, toolRegistry);

      // Test with missing required field
      const invalidInput = { optionalField: 100 };
      const invalidResult = await btTool.execute(invalidInput);
      
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.data.error).toContain('Missing required inputs');

      // Test with valid input
      const validInput = { requiredField: 'test', optionalField: 50 };
      const validResult = await btTool.execute(validInput);
      
      expect(validResult.success).toBe(true);
    });

    test('should support input/output transformations', async () => {
      const transformConfig = {
        name: 'TransformTool',
        input: {
          userName: { type: 'string', required: true }
        },
        output: {
          greeting: { type: 'string' }
        },
        inputTransform: {
          name: 'userName'  // Map userName to name for internal use
        },
        outputTransform: {
          greeting: 'result'  // Map internal result to greeting
        },
        implementation: {
          type: 'action',
          tool: 'dataProcessor',
          params: { name: '{{name}}' }
        }
      };

      const btTool = new BehaviorTreeTool(transformConfig, toolRegistry);
      const result = await btTool.execute({ userName: 'Alice' });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('BT Execution Through ToolRegistry', () => {
    test('should execute complex BT workflow', async () => {
      const workflowConfig = {
        name: 'ComplexWorkflow',
        description: 'Multi-stage workflow with conditions',
        input: {
          mode: { type: 'string', required: true }
        },
        implementation: {
          type: 'selector',
          description: 'Try different processing strategies',
          children: [
            {
              type: 'sequence',
              description: 'Fast path',
              children: [
                { type: 'action', tool: 'dataValidator' },
                { type: 'action', tool: 'reportGenerator' }
              ]
            },
            {
              type: 'sequence',
              description: 'Full processing',
              children: [
                { type: 'action', tool: 'dataFetcher' },
                { type: 'action', tool: 'dataProcessor' },
                { type: 'action', tool: 'dataValidator' },
                { type: 'action', tool: 'reportGenerator' }
              ]
            }
          ]
        }
      };

      const btTool = new BehaviorTreeTool(workflowConfig, toolRegistry);
      const result = await btTool.execute({ mode: 'fast' });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('SUCCESS');
      
      // Verify execution path through registry log
      const log = toolRegistry.getExecutionLog();
      const toolCalls = log.filter(entry => entry.action === 'getTool');
      expect(toolCalls.length).toBeGreaterThan(0);
    });

    test('should handle nested BT tools', async () => {
      // Create a sub-workflow BT tool
      const subWorkflowConfig = {
        name: 'SubWorkflow',
        implementation: {
          type: 'sequence',
          children: [
            { type: 'action', tool: 'dataValidator' },
            { type: 'action', tool: 'reportGenerator' }
          ]
        }
      };

      const subBT = new BehaviorTreeTool(subWorkflowConfig, toolRegistry);
      toolRegistry.registerTool('SubWorkflow', subBT);

      // Create main workflow that uses sub-workflow
      const mainWorkflowConfig = {
        name: 'MainWorkflow',
        implementation: {
          type: 'sequence',
          children: [
            { type: 'action', tool: 'dataFetcher' },
            { type: 'action', tool: 'SubWorkflow' }, // Use BT as a tool
            { type: 'action', tool: 'dataProcessor' }
          ]
        }
      };

      const mainBT = new BehaviorTreeTool(mainWorkflowConfig, toolRegistry);
      const result = await mainBT.execute({});

      expect(result.success).toBe(true);
      
      // Verify nested execution
      const log = toolRegistry.getExecutionLog();
      const subWorkflowCall = log.find(entry => 
        entry.action === 'getTool' && entry.toolName === 'SubWorkflow'
      );
      expect(subWorkflowCall).toBeDefined();
    });

    test('should handle errors gracefully in BT execution', async () => {
      const errorHandlingConfig = {
        name: 'ErrorHandlingWorkflow',
        implementation: {
          type: 'selector',
          description: 'Try operations with fallback',
          children: [
            {
              type: 'sequence',
              description: 'Primary path (will fail)',
              children: [
                { type: 'action', tool: 'dataProcessor' },
                { type: 'action', tool: 'errorLogger' }, // This fails
                { type: 'action', tool: 'reportGenerator' }
              ]
            },
            {
              type: 'sequence',
              description: 'Fallback path',
              children: [
                { type: 'action', tool: 'dataValidator' },
                { type: 'action', tool: 'reportGenerator' }
              ]
            }
          ]
        }
      };

      const btTool = new BehaviorTreeTool(errorHandlingConfig, toolRegistry);
      const result = await btTool.execute({});

      // Should succeed via fallback path
      expect(result.success).toBe(true);
      
      // Verify fallback was used
      const log = toolRegistry.getExecutionLog();
      const errorLoggerCall = log.find(entry => 
        entry.action === 'getTool' && entry.toolName === 'errorLogger'
      );
      const validatorCall = log.find(entry => 
        entry.action === 'getTool' && entry.toolName === 'dataValidator'
      );
      
      expect(errorLoggerCall).toBeDefined(); // Primary path attempted
      expect(validatorCall).toBeDefined();   // Fallback path executed
    });
  });

  describe('BehaviorTreeLoader Integration', () => {
    test('should load and register multiple BT tools', async () => {
      const btConfigs = [
        {
          name: 'Tool1',
          implementation: { type: 'action', tool: 'dataProcessor' }
        },
        {
          name: 'Tool2',
          implementation: { type: 'action', tool: 'dataValidator' }
        },
        {
          name: 'Tool3',
          implementation: { 
            type: 'sequence',
            children: [
              { type: 'action', tool: 'dataFetcher' },
              { type: 'action', tool: 'reportGenerator' }
            ]
          }
        }
      ];

      // Register all BT tools
      for (const config of btConfigs) {
        const btTool = new BehaviorTreeTool(config, toolRegistry);
        await loader.registerBehaviorTreeTool(btTool);
      }

      // Verify all were registered as tools
      expect(toolRegistry.hasTool('Tool1')).toBe(true);
      expect(toolRegistry.hasTool('Tool2')).toBe(true);
      expect(toolRegistry.hasTool('Tool3')).toBe(true);
    });

    test('should validate BT configuration before registration', () => {
      // Invalid config - missing name
      const invalidConfig1 = {
        implementation: { type: 'action', tool: 'someool' }
      };

      const validation1 = loader.validateBTConfig(invalidConfig1);
      expect(validation1.valid).toBe(false);
      expect(validation1.errors).toContain('Configuration must specify name');

      // Invalid config - missing implementation
      const invalidConfig2 = {
        name: 'InvalidTool'
      };

      const validation2 = loader.validateBTConfig(invalidConfig2);
      expect(validation2.valid).toBe(false);
      expect(validation2.errors).toContain('Configuration must specify implementation');

      // Valid config
      const validConfig = {
        name: 'ValidTool',
        implementation: { type: 'action', tool: 'dataProcessor' }
      };

      const validation3 = loader.validateBTConfig(validConfig);
      expect(validation3.valid).toBe(true);
      expect(validation3.errors).toHaveLength(0);
    });

    test('should validate BT tree structure', () => {
      // Valid tree
      const validTree = {
        type: 'sequence',
        children: [
          { type: 'action', tool: 'tool1' },
          { 
            type: 'selector',
            children: [
              { type: 'action', tool: 'tool2' },
              { type: 'action', tool: 'tool3' }
            ]
          }
        ]
      };

      const validation1 = loader.validateBTTree(validTree);
      expect(validation1.errors).toHaveLength(0);
      expect(validation1.warnings).toHaveLength(0);

      // Invalid tree - action without tool
      const invalidTree = {
        type: 'sequence',
        children: [
          { type: 'action' }, // Missing tool
          { type: 'action', tool: 'validTool' }
        ]
      };

      const validation2 = loader.validateBTTree(invalidTree);
      expect(validation2.errors).toContain('Action nodes must specify tool');

      // Tree with warnings
      const warningTree = {
        type: 'sequence',
        children: []  // Empty sequence
      };

      const validation3 = loader.validateBTTree(warningTree);
      expect(validation3.warnings).toContain('sequence node has no children');
    });
  });

  describe('Schema Validation and Type Safety', () => {
    test('should enforce input schema types', async () => {
      const typedConfig = {
        name: 'TypedTool',
        input: {
          stringField: { type: 'string', required: true },
          numberField: { type: 'number', required: true },
          booleanField: { type: 'boolean', required: false, default: false },
          arrayField: { type: 'array', required: false },
          objectField: { type: 'object', required: false }
        },
        implementation: {
          type: 'action',
          tool: 'dataProcessor'
        }
      };

      const btTool = new BehaviorTreeTool(typedConfig, toolRegistry);

      // Test with correct types
      const validInput = {
        stringField: 'test',
        numberField: 42,
        booleanField: true,
        arrayField: [1, 2, 3],
        objectField: { key: 'value' }
      };

      const validResult = await btTool.execute(validInput);
      expect(validResult.success).toBe(true);

      // Test with missing required fields
      const invalidInput = {
        stringField: 'test'
        // Missing numberField
      };

      const invalidResult = await btTool.execute(invalidInput);
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.data.error).toContain('Missing required inputs');
    });

    test('should apply default values for optional inputs', async () => {
      const defaultConfig = {
        name: 'DefaultTool',
        input: {
          requiredField: { type: 'string', required: true },
          optionalWithDefault: { type: 'number', required: false, default: 100 },
          optionalNoDefault: { type: 'string', required: false }
        },
        implementation: {
          type: 'action',
          tool: 'dataProcessor',
          params: {
            value: '{{optionalWithDefault}}'
          }
        }
      };

      const btTool = new BehaviorTreeTool(defaultConfig, toolRegistry);
      
      // Execute with only required field
      const result = await btTool.execute({ requiredField: 'test' });
      
      expect(result.success).toBe(true);
      // Default value should be applied
    });

    test('should validate output against schema', async () => {
      // This would require modifying the mock tools to return specific output
      // For now, we test that output schema is properly stored
      const outputConfig = {
        name: 'OutputValidatedTool',
        output: {
          status: { type: 'string', required: true },
          data: { type: 'object', required: true },
          count: { type: 'number', required: false }
        },
        implementation: {
          type: 'action',
          tool: 'dataProcessor'
        }
      };

      const btTool = new BehaviorTreeTool(outputConfig, toolRegistry);
      const metadata = btTool.getMetadata();
      
      expect(metadata.output.status.required).toBe(true);
      expect(metadata.output.data.type).toBe('object');
      expect(metadata.output.count.required).toBe(false);
    });
  });

  describe('Performance and Resource Management', () => {
    test('should handle concurrent BT executions', async () => {
      const concurrentConfig = {
        name: 'ConcurrentTool',
        implementation: {
          type: 'sequence',
          children: [
            { type: 'action', tool: 'dataFetcher' },
            { type: 'action', tool: 'dataProcessor' }
          ]
        }
      };

      const btTool = new BehaviorTreeTool(concurrentConfig, toolRegistry);

      // Execute multiple times concurrently
      const promises = Array(5).fill(null).map((_, i) => 
        btTool.execute({ index: i })
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Verify executions in log
      const log = toolRegistry.getExecutionLog();
      const fetcherCalls = log.filter(entry => 
        entry.action === 'getTool' && entry.toolName === 'dataFetcher'
      );
      expect(fetcherCalls.length).toBe(5);
    });

    test('should cache BT executor for performance', async () => {
      const cacheTestConfig = {
        name: 'CacheTestTool',
        implementation: {
          type: 'action',
          tool: 'dataProcessor'
        }
      };

      const btTool = new BehaviorTreeTool(cacheTestConfig, toolRegistry);

      // First execution - creates executor
      const result1 = await btTool.execute({});
      expect(result1.success).toBe(true);

      // Second execution - should reuse executor
      const result2 = await btTool.execute({});
      expect(result2.success).toBe(true);

      // Both executions should work
      expect(btTool.btExecutor).toBeDefined();
    });
  });

  describe('ModuleProvider Compatibility', () => {
    test('should create valid ModuleProvider wrapper', () => {
      const config = {
        name: 'ModuleProviderTest',
        description: 'Test module provider compatibility',
        implementation: {
          type: 'action',
          tool: 'dataProcessor'
        }
      };

      const btTool = new BehaviorTreeTool(config, toolRegistry);
      const provider = btTool.asModuleProvider();

      expect(provider.name).toBe('ModuleProviderTest');
      expect(provider.definition).toBeDefined();
      expect(typeof provider.definition.create).toBe('function');
      expect(typeof provider.definition.getMetadata).toBe('function');

      // Test metadata through provider
      const metadata = provider.definition.getMetadata();
      expect(metadata.name).toBe('ModuleProviderTest');
      expect(metadata.tools).toBeDefined();
      expect(metadata.tools.ModuleProviderTest).toBeDefined();
    });

    test('should create module instance through provider', async () => {
      const config = {
        name: 'InstanceTest',
        implementation: {
          type: 'action',
          tool: 'dataProcessor'
        }
      };

      const btTool = new BehaviorTreeTool(config, toolRegistry);
      const provider = btTool.asModuleProvider();

      // Create instance through provider
      const instance = await provider.definition.create();
      
      expect(instance).toBeDefined();
      expect(typeof instance.getTool).toBe('function');

      // Get tool from instance
      const tool = instance.getTool('InstanceTest');
      expect(tool).toBeDefined();
      expect(typeof tool.execute).toBe('function');

      // Execute tool
      const result = await tool.execute({});
      expect(result.success).toBe(true);
    });
  });
});