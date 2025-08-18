/**
 * Unit tests for TaskDecomposer
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { TaskDecomposer } from '../../../src/core/informal/TaskDecomposer.js';
import { TaskNode } from '../../../src/core/informal/types/TaskNode.js';
import { TaskHierarchy } from '../../../src/core/informal/types/TaskHierarchy.js';

describe('TaskDecomposer', () => {
  let decomposer;
  let mockLLMClient;
  let mockClassifier;

  beforeAll(() => {
    // Mock LLM client for unit tests
    mockLLMClient = {
      complete: async (prompt) => {
        // Extract task from markdown template
        let task = '';
        let originalTask = '';
        
        // Look for the task in the markdown format: "## Task to Decompose\n{taskDescription}"
        const lines = prompt.split('\n');
        let foundTaskSection = false;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i] === '## Task to Decompose') {
            foundTaskSection = true;
          } else if (foundTaskSection && lines[i].trim() && !lines[i].startsWith('##') && !lines[i].startsWith('{{')) {
            originalTask = lines[i];
            task = lines[i].toLowerCase();
            break;
          }
        }
        
        // Fallback to searching for other patterns
        if (!task) {
          const taskMatch = prompt.match(/Task to decompose: ([^\n]+)/);
          if (taskMatch) {
            originalTask = taskMatch[1];
            task = taskMatch[1].toLowerCase();
          } else {
            originalTask = 'Unknown';
            task = 'unknown';
          }
        }
        
        // Return different decompositions based on task
        if (task.includes('rest api')) {
          return JSON.stringify({
            task: originalTask,
            subtasks: [
              {
                id: 'subtask-1',
                description: 'Initialize Node.js project',
                suggestedInputs: ['project name'],
                suggestedOutputs: ['package.json', 'project structure'],
                reasoning: 'Set up the project foundation'
              },
              {
                id: 'subtask-2',
                description: 'Set up database layer',
                suggestedInputs: ['database requirements'],
                suggestedOutputs: ['database connection', 'models'],
                reasoning: 'Create data persistence layer'
              },
              {
                id: 'subtask-3',
                description: 'Create API endpoints',
                suggestedInputs: ['models', 'requirements'],
                suggestedOutputs: ['API routes', 'handlers'],
                reasoning: 'Implement the API functionality'
              }
            ]
          });
        }
        
        if (task.includes('authentication')) {
          return JSON.stringify({
            task: originalTask,
            subtasks: [
              {
                id: 'auth-1',
                description: 'Set up JWT configuration',
                suggestedInputs: ['secret key'],
                suggestedOutputs: ['JWT service'],
                reasoning: 'Configure token generation'
              },
              {
                id: 'auth-2',
                description: 'Create user model',
                suggestedInputs: ['user requirements'],
                suggestedOutputs: ['user schema', 'user model'],
                reasoning: 'Define user data structure'
              }
            ]
          });
        }
        
        // Default simple decomposition
        return JSON.stringify({
          task: originalTask,
          subtasks: [
            {
              id: 'default-1',
              description: 'Perform the task',
              suggestedInputs: ['input'],
              suggestedOutputs: ['output'],
              reasoning: 'Execute the main operation'
            }
          ]
        });
      }
    };

    // Mock classifier
    mockClassifier = {
      classify: async (description) => {
        const desc = description.toLowerCase();
        
        // Complex tasks
        if (desc.includes('build') && (desc.includes('api') || desc.includes('rest')) ||
            desc.includes('set up database') ||
            desc.includes('create api')) {
          return { complexity: 'COMPLEX', reasoning: 'Multiple components' };
        }
        
        // Simple tasks
        if (desc.includes('initialize') || 
            desc.includes('set up jwt') ||
            desc.includes('create') && desc.includes('model') ||
            desc.includes('perform')) {
          return { complexity: 'SIMPLE', reasoning: 'Focused task' };
        }
        
        return { complexity: 'SIMPLE', reasoning: 'Default' };
      }
    };

    decomposer = new TaskDecomposer(mockLLMClient, mockClassifier);
  });

  describe('single-level decomposition', () => {
    it('should decompose a task into subtasks', async () => {
      const result = await decomposer.decompose('Build REST API');
      
      expect(result).toBeDefined();
      expect(result.task).toBe('Build REST API');
      expect(result.subtasks).toBeDefined();
      expect(Array.isArray(result.subtasks)).toBe(true);
      expect(result.subtasks.length).toBeGreaterThan(0);
    });

    it('should include I/O hints in subtasks', async () => {
      const result = await decomposer.decompose('Build REST API');
      
      result.subtasks.forEach(subtask => {
        expect(subtask.suggestedInputs).toBeDefined();
        expect(subtask.suggestedOutputs).toBeDefined();
        expect(Array.isArray(subtask.suggestedInputs)).toBe(true);
        expect(Array.isArray(subtask.suggestedOutputs)).toBe(true);
      });
    });

    it('should classify each subtask', async () => {
      const result = await decomposer.decompose('Build REST API');
      
      for (const subtask of result.subtasks) {
        expect(subtask.complexity).toBeDefined();
        expect(subtask.complexity).toMatch(/^(SIMPLE|COMPLEX)$/);
        expect(subtask.reasoning).toBeDefined();
      }
    });

    it('should handle context in decomposition', async () => {
      const context = {
        domain: 'web-development',
        parentOutputs: ['database_connection']
      };
      
      const result = await decomposer.decompose('Create authentication', context);
      
      expect(result).toBeDefined();
      expect(result.subtasks).toBeDefined();
    });
  });

  describe('recursive decomposition', () => {
    it('should decompose recursively until all tasks are SIMPLE', async () => {
      const hierarchy = await decomposer.decomposeRecursively('Build REST API');
      
      expect(hierarchy).toBeDefined();
      expect(hierarchy.description).toBe('Build REST API');
      expect(hierarchy.complexity).toBe('COMPLEX');
      expect(hierarchy.subtasks).toBeDefined();
      
      // Check that all leaf nodes are SIMPLE
      const checkLeaves = (node) => {
        if (!node.subtasks || node.subtasks.length === 0) {
          expect(node.complexity).toBe('SIMPLE');
        } else {
          node.subtasks.forEach(checkLeaves);
        }
      };
      
      checkLeaves(hierarchy);
    });

    it('should respect max depth limit', async () => {
      const hierarchy = await decomposer.decomposeRecursively(
        'Build REST API',
        {},
        { maxDepth: 2 }
      );
      
      // Check depth doesn't exceed limit
      const checkDepth = (node, depth = 0) => {
        expect(depth).toBeLessThanOrEqual(2);
        if (node.subtasks) {
          node.subtasks.forEach(child => checkDepth(child, depth + 1));
        }
      };
      
      checkDepth(hierarchy);
    });

    it('should create TaskNode instances', async () => {
      const hierarchy = await decomposer.decomposeRecursively('Build REST API');
      
      expect(hierarchy).toBeInstanceOf(TaskNode);
      
      const checkNodes = (node) => {
        expect(node).toBeInstanceOf(TaskNode);
        if (node.subtasks) {
          node.subtasks.forEach(checkNodes);
        }
      };
      
      checkNodes(hierarchy);
    });

    it('should handle depth limit by forcing SIMPLE', async () => {
      // Create a decomposer that would normally recurse deeply
      const deepMockClassifier = {
        classify: async () => ({ complexity: 'COMPLEX', reasoning: 'Always complex' })
      };
      
      const deepDecomposer = new TaskDecomposer(mockLLMClient, deepMockClassifier);
      
      const hierarchy = await deepDecomposer.decomposeRecursively(
        'Complex task',
        {},
        { maxDepth: 1 }
      );
      
      // At max depth, subtasks should be forced to SIMPLE
      if (hierarchy.subtasks) {
        hierarchy.subtasks.forEach(subtask => {
          expect(subtask.complexity).toBe('SIMPLE');
        });
      }
    });
  });

  describe('prompt generation', () => {
    it('should generate decomposition prompt', () => {
      const prompt = decomposer.generateDecompositionPrompt('Build REST API');
      
      expect(prompt).toContain('Build REST API');
      expect(prompt).toContain('subtasks');
      expect(prompt).toContain('inputs');
      expect(prompt).toContain('outputs');
    });

    it('should include context in prompt', () => {
      const context = {
        domain: 'e-commerce',
        parentOutputs: ['user_model', 'database']
      };
      
      const prompt = decomposer.generateDecompositionPrompt('Create checkout', context);
      
      expect(prompt).toContain('e-commerce');
      expect(prompt).toContain('user_model');
      expect(prompt).toContain('database');
    });
  });

  describe('response parsing', () => {
    it('should parse valid decomposition response', () => {
      const response = JSON.stringify({
        task: 'Test task',
        subtasks: [
          {
            id: 'sub-1',
            description: 'Subtask 1',
            suggestedInputs: ['input1'],
            suggestedOutputs: ['output1'],
            reasoning: 'Test reason'
          }
        ]
      });
      
      const result = decomposer.parseDecompositionResponse(response);
      
      expect(result.task).toBe('Test task');
      expect(result.subtasks).toHaveLength(1);
      expect(result.subtasks[0].description).toBe('Subtask 1');
    });

    it('should handle missing optional fields', () => {
      const response = JSON.stringify({
        task: 'Test task',
        subtasks: [
          {
            description: 'Subtask without ID'
          }
        ]
      });
      
      const result = decomposer.parseDecompositionResponse(response);
      
      expect(result.subtasks[0].description).toBe('Subtask without ID');
      expect(result.subtasks[0].id).toBeDefined(); // Should generate ID
      expect(result.subtasks[0].suggestedInputs).toEqual([]);
      expect(result.subtasks[0].suggestedOutputs).toEqual([]);
    });

    it('should throw error for invalid response', () => {
      // Test invalid JSON - should throw
      let errorThrown = false;
      try {
        decomposer.parseDecompositionResponse('Invalid JSON');
      } catch (error) {
        errorThrown = true;
        expect(error.message).toContain('Failed to parse decomposition response');
      }
      expect(errorThrown).toBe(true);
      
      // Test missing subtasks
      expect(() => {
        decomposer.parseDecompositionResponse('{}');
      }).toThrow('Invalid decomposition response: missing subtasks');
    });
  });

  describe('error handling', () => {
    it('should throw error if LLM client not provided', () => {
      expect(() => {
        new TaskDecomposer();
      }).toThrow('LLM client is required');
    });

    it('should throw error if classifier not provided', () => {
      expect(() => {
        new TaskDecomposer(mockLLMClient);
      }).toThrow('Complexity classifier is required');
    });

    it('should throw error for empty task', async () => {
      await expect(decomposer.decompose('')).rejects.toThrow('Task description is required');
    });

    it('should handle LLM failure', async () => {
      const failingLLM = {
        complete: async () => {
          throw new Error('LLM service unavailable');
        }
      };
      
      const failingDecomposer = new TaskDecomposer(failingLLM, mockClassifier);
      
      await expect(failingDecomposer.decompose('Test')).rejects.toThrow('LLM service unavailable');
    });
  });
});