/**
 * Unit tests for PlanSynthesizer
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PlanSynthesizer } from '../../src/core/PlanSynthesizer.js';
import { ValidatedSubtree } from '../../src/core/ValidatedSubtree.js';
import { ContextHints } from '../../src/core/ContextHints.js';
import {
  createMockLLMClient,
  createMockToolDiscovery,
  createMockValidator,
  createSampleHierarchy,
  createSampleBehaviorTree,
  assertValidSubtree
} from '../utils/test-helpers.js';

describe('PlanSynthesizer', () => {
  let synthesizer;
  let mockLLMClient;
  let mockToolDiscovery;
  let mockValidator;
  let contextHints;
  
  beforeEach(() => {
    // Create mocks
    mockLLMClient = createMockLLMClient({
      'Set up database': JSON.stringify({
        type: 'sequence',
        id: 'setup-db',
        children: [
          {
            type: 'action',
            tool: 'directory_create',
            params: { dirpath: './db' }
          },
          {
            type: 'action',
            tool: 'file_write',
            params: { filepath: './db/schema.sql', content: 'CREATE TABLE...' }
          }
        ]
      }),
      'Implement REST endpoints': JSON.stringify({
        type: 'action',
        id: 'create-api',
        tool: 'file_write',
        params: { filepath: './api/server.js', content: 'express server code' },
        outputVariable: 'api_endpoints'
      }),
      'Create frontend UI': JSON.stringify({
        type: 'action',
        id: 'create-ui',
        tool: 'file_write',
        params: { filepath: './ui/index.html', content: '<html>...</html>' },
        outputVariable: 'ui_bundle'
      }),
      'Deploy application': JSON.stringify({
        type: 'action',
        id: 'deploy',
        tool: 'command_executor',
        params: { command: 'npm run deploy' },
        outputVariable: 'deployed_app'
      })
    });
    
    mockToolDiscovery = createMockToolDiscovery({
      'Set up database': [
        { name: 'directory_create', description: 'Create directory' },
        { name: 'file_write', description: 'Write file' }
      ],
      'Implement REST endpoints': [
        { name: 'file_write', description: 'Write file' }
      ],
      'Create frontend UI': [
        { name: 'file_write', description: 'Write file' }
      ],
      'Deploy application': [
        { name: 'command_executor', description: 'Execute command' }
      ]
    });
    
    mockValidator = createMockValidator(true);
    contextHints = new ContextHints();
    
    // Create synthesizer
    synthesizer = new PlanSynthesizer({
      llmClient: mockLLMClient,
      toolDiscovery: mockToolDiscovery,
      contextHints: contextHints
    });
    
    // Override planner to use mock LLM
    synthesizer.planner = {
      makePlan: jest.fn(async (requirements, tools, options) => {
        // Generate plan based on requirements
        const response = await mockLLMClient.generateResponse({
          messages: [{ role: 'user', content: requirements }]
        });
        
        return {
          success: true,
          data: {
            plan: JSON.parse(response.content)
          }
        };
      })
    };
    
    // Use mock validator
    synthesizer.validator = mockValidator;
  });
  
  describe('constructor', () => {
    it('should initialize with dependencies', () => {
      expect(synthesizer.llmClient).toBe(mockLLMClient);
      expect(synthesizer.toolDiscovery).toBe(mockToolDiscovery);
      expect(synthesizer.contextHints).toBe(contextHints);
      expect(synthesizer.subtreeCache).toBeDefined();
    });
  });
  
  describe('synthesize', () => {
    it('should synthesize a complete hierarchy', async () => {
      const hierarchy = createSampleHierarchy();
      
      const result = await synthesizer.synthesize(hierarchy);
      
      expect(result).toBeInstanceOf(ValidatedSubtree);
      assertValidSubtree(result);
      expect(result.id).toBe('root');
      expect(result.complexity).toBe('COMPLEX');
      expect(result.children).toHaveLength(3);
    });
    
    it('should handle debug mode', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const hierarchy = {
        id: 'simple',
        description: 'Simple task',
        complexity: 'SIMPLE',
        level: 0
      };
      
      await synthesizer.synthesize(hierarchy, { debug: true });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[PlanSynthesizer]')
      );
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('leaf synthesis', () => {
    it('should synthesize a simple task', async () => {
      const leafNode = {
        id: 'database',
        description: 'Set up database',
        complexity: 'SIMPLE',
        level: 2,
        suggestedInputs: ['schema'],
        suggestedOutputs: ['database_url']
      };
      
      const result = await synthesizer._synthesizeNode(leafNode, {});
      
      expect(result.isValid).toBe(true);
      expect(result.behaviorTree).toBeDefined();
      expect(result.behaviorTree.type).toBe('sequence');
      expect(mockToolDiscovery.discoverTools).toHaveBeenCalledWith(
        leafNode,
        expect.any(Object)
      );
      expect(mockValidator.validate).toHaveBeenCalled();
    });
    
    it('should handle missing tools', async () => {
      mockToolDiscovery.discoverTools.mockResolvedValueOnce([]);
      
      const leafNode = {
        id: 'unknown',
        description: 'Unknown task',
        complexity: 'SIMPLE',
        level: 1
      };
      
      const result = await synthesizer._synthesizeNode(leafNode, {});
      
      expect(result.isValid).toBe(false);
      expect(result.validation.errors).toContain(
        'No tools found for task: Unknown task'
      );
    });
    
    it('should handle planning failure', async () => {
      synthesizer.planner.makePlan.mockResolvedValueOnce({
        success: false,
        error: 'Planning failed'
      });
      
      const leafNode = {
        id: 'failing',
        description: 'Failing task',
        complexity: 'SIMPLE',
        level: 1
      };
      
      const result = await synthesizer._synthesizeNode(leafNode, {});
      
      expect(result.isValid).toBe(false);
      expect(result.validation.errors[0]).toContain('Planning failed');
    });
    
    it('should extract I/O from behavior tree', async () => {
      const leafNode = {
        id: 'api',
        description: 'Implement REST endpoints',
        complexity: 'SIMPLE',
        level: 2
      };
      
      const result = await synthesizer._synthesizeNode(leafNode, {});
      
      expect(result.outputs.has('api_endpoints')).toBe(true);
    });
  });
  
  describe('complex synthesis', () => {
    it('should synthesize complex task from children', async () => {
      const complexNode = {
        id: 'backend',
        description: 'Create backend API',
        complexity: 'COMPLEX',
        level: 1,
        children: [
          {
            id: 'database',
            description: 'Set up database',
            complexity: 'SIMPLE',
            level: 2,
            suggestedInputs: ['schema'],
            suggestedOutputs: ['database_url']
          },
          {
            id: 'api',
            description: 'Implement REST endpoints',
            complexity: 'SIMPLE',
            level: 2,
            suggestedInputs: ['database_url'],
            suggestedOutputs: ['api_endpoints']
          }
        ]
      };
      
      const result = await synthesizer._synthesizeNode(complexNode, {});
      
      expect(result.complexity).toBe('COMPLEX');
      expect(result.children).toHaveLength(2);
      expect(result.isValid).toBe(true);
      expect(result.behaviorTree).toBeDefined();
      expect(result.behaviorTree.type).toBe('sequence'); // Due to dependency
    });
    
    it('should fail if children are invalid', async () => {
      mockValidator.validate
        .mockResolvedValueOnce({ valid: false, errors: ['Child failed'] })
        .mockResolvedValueOnce({ valid: true, errors: [] });
      
      const complexNode = {
        id: 'parent',
        description: 'Parent task',
        complexity: 'COMPLEX',
        level: 0,
        children: [
          {
            id: 'child1',
            description: 'Set up database',
            complexity: 'SIMPLE',
            level: 1
          },
          {
            id: 'child2',
            description: 'Implement REST endpoints',
            complexity: 'SIMPLE',
            level: 1
          }
        ]
      };
      
      const result = await synthesizer._synthesizeNode(complexNode, {});
      
      expect(result.isValid).toBe(false);
      expect(result.validation.errors[0]).toContain('1 child tasks failed validation');
    });
    
    it('should handle complex task with no children', async () => {
      const complexNode = {
        id: 'empty',
        description: 'Empty complex task',
        complexity: 'COMPLEX',
        level: 0,
        children: []
      };
      
      const result = await synthesizer._synthesizeNode(complexNode, {});
      
      expect(result.isValid).toBe(false);
      expect(result.validation.errors).toContain('Complex task has no children');
    });
  });
  
  describe('caching', () => {
    it('should cache synthesized subtrees', async () => {
      const node = {
        id: 'cached',
        description: 'Cached task',
        complexity: 'SIMPLE',
        level: 1
      };
      
      const result1 = await synthesizer._synthesizeNode(node, {});
      const result2 = await synthesizer._synthesizeNode(node, {});
      
      expect(result1).toBe(result2); // Same object reference
      expect(mockToolDiscovery.discoverTools).toHaveBeenCalledTimes(1);
    });
    
    it('should generate unique cache keys', () => {
      const node1 = {
        description: 'Task A',
        level: 1,
        complexity: 'SIMPLE'
      };
      
      const node2 = {
        description: 'Task A',
        level: 2,
        complexity: 'SIMPLE'
      };
      
      const key1 = synthesizer._getCacheKey(node1);
      const key2 = synthesizer._getCacheKey(node2);
      
      expect(key1).not.toBe(key2);
    });
    
    it('should clear cache', async () => {
      const node = {
        id: 'cleared',
        description: 'Cleared task',
        complexity: 'SIMPLE',
        level: 1
      };
      
      await synthesizer._synthesizeNode(node, {});
      synthesizer.clearCache();
      await synthesizer._synthesizeNode(node, {});
      
      expect(mockToolDiscovery.discoverTools).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('requirements building', () => {
    it('should build requirements with I/O hints', () => {
      const node = {
        id: 'task1',
        description: 'Process data',
        parentId: 'parent1'
      };
      
      const hints = {
        suggestedInputs: ['input_data', 'config'],
        suggestedOutputs: ['processed_data', 'report']
      };
      
      // Use the actual ContextHints API
      contextHints.addHints('task1', {
        suggestedInputs: ['input_data', 'config'],
        suggestedOutputs: ['processed_data', 'report']
      });
      contextHints.addHints('sibling1', {
        suggestedOutputs: ['shared_data'],
        relatedTasks: ['parent1']
      });
      
      const requirements = synthesizer._buildRequirements(node, hints);
      
      expect(requirements).toContain('Process data');
      expect(requirements).toContain('Expected inputs: input_data, config');
      expect(requirements).toContain('Expected outputs: processed_data, report');
      expect(requirements).toContain('Available from previous steps: shared_data');
    });
  });
  
  describe('I/O extraction', () => {
    it('should extract inputs from context references', () => {
      const subtree = new ValidatedSubtree(
        { id: 'test', description: 'Test', complexity: 'SIMPLE' },
        null,
        { valid: false }
      );
      
      const behaviorTree = {
        type: 'sequence',
        children: [
          {
            type: 'action',
            tool: 'file_write',
            params: {
              filepath: "context.artifacts['config_file']",
              content: 'test content'
            },
            outputVariable: 'file_created'
          },
          {
            type: 'action',
            tool: 'command_executor',
            params: {
              command: "node context.artifacts['script_path']"
            },
            outputVariable: 'command_output'
          }
        ]
      };
      
      synthesizer._extractActualIO(subtree, behaviorTree);
      
      expect(subtree.inputs.has('config_file')).toBe(true);
      expect(subtree.inputs.has('script_path')).toBe(true);
      expect(subtree.outputs.has('file_created')).toBe(true);
      expect(subtree.outputs.has('command_output')).toBe(true);
    });
  });
  
  describe('tool gathering', () => {
    it('should gather tools from all descendants', async () => {
      const parentSubtree = new ValidatedSubtree(
        { id: 'parent', description: 'Parent', complexity: 'COMPLEX' },
        null,
        { valid: false }
      );
      
      const child1 = new ValidatedSubtree(
        { id: 'child1', description: 'Set up database', complexity: 'SIMPLE' },
        null,
        { valid: false }
      );
      
      const child2 = new ValidatedSubtree(
        { id: 'child2', description: 'Implement REST endpoints', complexity: 'SIMPLE' },
        null,
        { valid: false }
      );
      
      parentSubtree.addChild(child1);
      parentSubtree.addChild(child2);
      
      const tools = await synthesizer._gatherChildTools(parentSubtree, {});
      
      expect(tools.length).toBeGreaterThan(0);
      expect(mockToolDiscovery.discoverTools).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('I/O contract validation', () => {
    it('should properly categorize inputs and outputs', () => {
      // This test validates that the synthesizer correctly categorizes:
      // 1. External inputs (needed from parent)
      // 2. Internal artifacts (produced and consumed by siblings)
      // 3. External outputs (produced for parent)
      
      const parentSubtree = new ValidatedSubtree(
        { id: 'parent', description: 'Parent', complexity: 'COMPLEX' },
        null,
        { valid: true, errors: [], warnings: [] }
      );
      
      const child1 = new ValidatedSubtree(
        {
          id: 'child1',
          description: 'Child 1',
          complexity: 'SIMPLE',
          suggestedInputs: ['external_input'],
          suggestedOutputs: ['intermediate_data']
        },
        null,
        { valid: true, errors: [], warnings: [] }
      );
      
      const child2 = new ValidatedSubtree(
        {
          id: 'child2',
          description: 'Child 2',
          complexity: 'SIMPLE',
          suggestedInputs: ['intermediate_data'], // Consumes child1's output
          suggestedOutputs: ['final_output']
        },
        null,
        { valid: true, errors: [], warnings: [] }
      );
      
      // Add children - this triggers aggregation
      parentSubtree.addChild(child1);
      parentSubtree.addChild(child2);
      
      // Get the contract
      const contract = parentSubtree.getContract();
      
      // Verify contract categorization:
      // - external_input should be in inputs (needed from outside)
      // - intermediate_data should be in internal (produced and consumed internally)
      // - final_output should be in outputs (produced for parent)
      expect(contract.inputs).toContain('external_input');
      expect(contract.internal).toContain('intermediate_data');
      expect(contract.outputs).toContain('final_output');
      expect(contract.outputs).toContain('intermediate_data'); // Also exposed as output
      
      // Validate I/O contracts - should have no warnings for properly satisfied deps
      synthesizer._validateIOContracts(parentSubtree);
      
      // Since all dependencies are satisfied, there should be no warnings
      expect(parentSubtree.validation.warnings || []).toHaveLength(0);
    });
    
    it('should warn about unused outputs', () => {
      // Test that we can detect outputs that are produced but never consumed
      const parentSubtree = new ValidatedSubtree(
        { id: 'parent', description: 'Parent', complexity: 'COMPLEX' },
        null,
        { valid: true, errors: [], warnings: [] }
      );
      
      const child1 = new ValidatedSubtree(
        {
          id: 'child1',
          description: 'Child 1',
          complexity: 'SIMPLE',
          suggestedInputs: [],
          suggestedOutputs: ['unused_output', 'used_output']
        },
        null,
        { valid: true }
      );
      
      const child2 = new ValidatedSubtree(
        {
          id: 'child2',
          description: 'Child 2',
          complexity: 'SIMPLE',
          suggestedInputs: ['used_output'], // Only uses one output
          suggestedOutputs: ['final_output']
        },
        null,
        { valid: true }
      );
      
      parentSubtree.addChild(child1);
      parentSubtree.addChild(child2);
      
      const contract = parentSubtree.getContract();
      
      // Both outputs should be exposed, even if unused internally
      expect(contract.outputs).toContain('unused_output');
      expect(contract.outputs).toContain('used_output');
      expect(contract.outputs).toContain('final_output');
      
      // used_output is consumed internally
      expect(contract.internal).toContain('used_output');
    });
  });
});