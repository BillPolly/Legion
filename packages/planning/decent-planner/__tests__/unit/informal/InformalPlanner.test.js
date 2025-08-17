/**
 * Unit tests for InformalPlanner orchestrator
 */

import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import { InformalPlanner } from '../../../src/core/informal/InformalPlanner.js';
import { TaskNode } from '../../../src/core/informal/types/TaskNode.js';

describe('InformalPlanner', () => {
  let planner;
  let mockLLMClient;
  let mockToolRegistry;

  beforeAll(() => {
    // Mock LLM client
    mockLLMClient = {
      complete: jest.fn(async (prompt) => {
        // Simple mock responses based on prompt content
        if (prompt.includes('Classify')) {
          return JSON.stringify({
            complexity: prompt.includes('Build') ? 'COMPLEX' : 'SIMPLE',
            reasoning: 'Mock classification'
          });
        }
        
        if (prompt.includes('Decompose') || prompt.includes('decompose')) {
          return JSON.stringify({
            task: 'Mock task',
            subtasks: [
              {
                id: 'sub-1',
                description: 'Subtask 1',
                suggestedInputs: [],
                suggestedOutputs: ['output1'],
                reasoning: 'Mock subtask'
              },
              {
                id: 'sub-2',
                description: 'Subtask 2',
                suggestedInputs: ['output1'],
                suggestedOutputs: ['final'],
                reasoning: 'Mock subtask'
              }
            ]
          });
        }
        
        return '{}';
      })
    };

    // Mock ToolRegistry
    mockToolRegistry = {
      searchTools: jest.fn(async (query) => {
        // Return mock tools based on query
        if (query.toLowerCase().includes('subtask')) {
          return [
            { name: 'mock_tool', description: 'Mock tool', confidence: 0.85 }
          ];
        }
        return [];
      })
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
    planner = new InformalPlanner(mockLLMClient, mockToolRegistry);
  });

  describe('initialization', () => {
    it('should require LLM client', () => {
      expect(() => new InformalPlanner()).toThrow('LLM client is required');
    });

    it('should require ToolRegistry', () => {
      expect(() => new InformalPlanner(mockLLMClient)).toThrow('ToolRegistry is required');
    });

    it('should initialize all components', () => {
      const planner = new InformalPlanner(mockLLMClient, mockToolRegistry);
      
      expect(planner.classifier).toBeDefined();
      expect(planner.decomposer).toBeDefined();
      expect(planner.feasibilityChecker).toBeDefined();
      expect(planner.validator).toBeDefined();
    });

    it('should accept configuration options', () => {
      const options = {
        maxDepth: 3,
        confidenceThreshold: 0.8,
        strictValidation: false
      };
      
      const planner = new InformalPlanner(mockLLMClient, mockToolRegistry, options);
      
      expect(planner.options.maxDepth).toBe(3);
      expect(planner.options.confidenceThreshold).toBe(0.8);
      expect(planner.options.strictValidation).toBe(false);
    });
  });

  describe('plan method', () => {
    it('should process simple tasks directly', async () => {
      mockLLMClient.complete.mockResolvedValueOnce(JSON.stringify({
        complexity: 'SIMPLE',
        reasoning: 'Direct task'
      }));
      
      mockToolRegistry.searchTools.mockResolvedValueOnce([
        { name: 'simple_tool', description: 'Tool for simple task', confidence: 0.9 }
      ]);

      const result = await planner.plan('Write to file');

      expect(result).toBeDefined();
      expect(result.hierarchy).toBeDefined();
      expect(result.hierarchy.complexity).toBe('SIMPLE');
      expect(result.hierarchy.tools).toBeDefined();
      expect(result.hierarchy.feasible).toBe(true);
    });

    it('should decompose complex tasks recursively', async () => {
      // Clear previous mocks and set up new ones in order
      mockLLMClient.complete.mockReset();
      
      // First classification - COMPLEX
      mockLLMClient.complete
        .mockResolvedValueOnce(JSON.stringify({
          complexity: 'COMPLEX',
          reasoning: 'Complex task'
        }))
        // Decomposition
        .mockResolvedValueOnce(JSON.stringify({
          task: 'Build system',
          subtasks: [
            { id: '1', description: 'Setup', suggestedInputs: [], suggestedOutputs: ['config'] },
            { id: '2', description: 'Process', suggestedInputs: ['config'], suggestedOutputs: ['result'] }
          ]
        }))
        // Classifications for subtasks - both SIMPLE  
        .mockResolvedValueOnce(JSON.stringify({
          complexity: 'SIMPLE',
          reasoning: 'Simple setup'
        }))
        .mockResolvedValueOnce(JSON.stringify({
          complexity: 'SIMPLE',
          reasoning: 'Simple process'
        }));
      
      // Tools for subtasks
      mockToolRegistry.searchTools
        .mockResolvedValueOnce([{ name: 'setup_tool', confidence: 0.85 }])
        .mockResolvedValueOnce([{ name: 'process_tool', confidence: 0.9 }]);

      const result = await planner.plan('Build system');

      expect(result).toBeDefined();
      expect(result.hierarchy.complexity).toBe('COMPLEX');
      expect(result.hierarchy.subtasks).toBeDefined();
      expect(result.hierarchy.subtasks.length).toBe(2);
      expect(result.validation.valid).toBeDefined();
    });

    it('should validate decomposition', async () => {
      const result = await planner.plan('Simple task');

      expect(result.validation).toBeDefined();
      expect(result.validation.structure).toBeDefined();
      expect(result.validation.dependencies).toBeDefined();
      expect(result.validation.completeness).toBeDefined();
      expect(result.validation.feasibility).toBeDefined();
    });

    it('should generate statistics', async () => {
      const result = await planner.plan('Task');

      expect(result.statistics).toBeDefined();
      expect(result.statistics.totalTasks).toBeGreaterThanOrEqual(1);
      expect(result.statistics.simpleTasks).toBeDefined();
      expect(result.statistics.complexTasks).toBeDefined();
      expect(result.statistics.maxDepth).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      mockLLMClient.complete.mockRejectedValueOnce(new Error('LLM error'));

      await expect(planner.plan('Task')).rejects.toThrow('LLM error');
    });

    it('should respect max depth limit', async () => {
      const planner = new InformalPlanner(mockLLMClient, mockToolRegistry, {
        maxDepth: 1
      });

      // Mock always returns COMPLEX to test depth limiting
      mockLLMClient.complete.mockImplementation(async (prompt) => {
        if (prompt.includes('Classify')) {
          return JSON.stringify({ complexity: 'COMPLEX', reasoning: 'Always complex' });
        }
        return JSON.stringify({
          task: 'Task',
          subtasks: [{ id: '1', description: 'Sub', suggestedInputs: [], suggestedOutputs: [] }]
        });
      });

      const result = await planner.plan('Deep task');

      // Should force leaf nodes to SIMPLE at max depth
      const leafNodes = [];
      const collectLeaves = (node) => {
        if (!node.subtasks || node.subtasks.length === 0) {
          leafNodes.push(node);
        } else {
          node.subtasks.forEach(collectLeaves);
        }
      };
      collectLeaves(result.hierarchy);

      leafNodes.forEach(leaf => {
        expect(leaf.complexity).toBe('SIMPLE');
      });
    });
  });

  describe('output structure', () => {
    it('should return complete output structure', async () => {
      const result = await planner.plan('Task');

      // Check main structure
      expect(result).toHaveProperty('hierarchy');
      expect(result).toHaveProperty('validation');
      expect(result).toHaveProperty('statistics');
      expect(result).toHaveProperty('metadata');

      // Check hierarchy
      expect(result.hierarchy).toHaveProperty('description');
      expect(result.hierarchy).toHaveProperty('complexity');

      // Check metadata
      expect(result.metadata).toHaveProperty('timestamp');
      expect(result.metadata).toHaveProperty('plannerVersion');
      expect(result.metadata).toHaveProperty('options');
    });

    it('should include tool annotations on SIMPLE tasks', async () => {
      mockLLMClient.complete.mockResolvedValueOnce(JSON.stringify({
        complexity: 'SIMPLE',
        reasoning: 'Simple task'
      }));

      mockToolRegistry.searchTools.mockResolvedValueOnce([
        { name: 'tool1', description: 'Tool 1', confidence: 0.9 },
        { name: 'tool2', description: 'Tool 2', confidence: 0.85 }
      ]);

      const result = await planner.plan('Simple operation');

      expect(result.hierarchy.complexity).toBe('SIMPLE');
      expect(result.hierarchy.tools).toBeDefined();
      expect(result.hierarchy.tools.length).toBeGreaterThan(0);
      expect(result.hierarchy.tools[0]).toHaveProperty('name');
      expect(result.hierarchy.tools[0]).toHaveProperty('confidence');
    });

    it('should include feasibility assessment', async () => {
      const result = await planner.plan('Task');

      if (result.hierarchy.complexity === 'SIMPLE') {
        expect(result.hierarchy).toHaveProperty('feasible');
      }

      expect(result.validation.feasibility).toBeDefined();
      expect(result.validation.feasibility).toHaveProperty('overallFeasible');
    });
  });

  describe('error handling', () => {
    it('should throw on empty goal', async () => {
      await expect(planner.plan('')).rejects.toThrow('Goal description is required');
    });

    it('should handle LLM failures', async () => {
      mockLLMClient.complete.mockRejectedValueOnce(new Error('LLM unavailable'));

      await expect(planner.plan('Task')).rejects.toThrow('LLM unavailable');
    });

    it('should handle ToolRegistry failures', async () => {
      mockToolRegistry.searchTools.mockRejectedValueOnce(new Error('Registry error'));
      
      mockLLMClient.complete.mockResolvedValueOnce(JSON.stringify({
        complexity: 'SIMPLE',
        reasoning: 'Simple'
      }));

      await expect(planner.plan('Task')).rejects.toThrow('Registry error');
    });

    it('should handle malformed LLM responses', async () => {
      mockLLMClient.complete.mockResolvedValueOnce('Invalid JSON');

      await expect(planner.plan('Task')).rejects.toThrow();
    });
  });
});