/**
 * Unit tests for PlanningStrategy
 * Tests the migration of ProjectStructurePlanner component to TaskStrategy pattern
 * Phase 2.1 Migration Test
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';
import PlanningStrategy from '../../../../src/strategies/coding/PlanningStrategy.js';

describe('PlanningStrategy', () => {
  let resourceManager;
  let llmClient;
  let toolRegistry;
  let strategy;

  beforeEach(async () => {
    // Get real ResourceManager singleton and services
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    toolRegistry = await ToolRegistry.getInstance();
    
    // Create strategy instance
    strategy = new PlanningStrategy(llmClient, toolRegistry);
  });

  describe('Basic Properties', () => {
    test('should create strategy instance', () => {
      expect(strategy).toBeDefined();
      expect(strategy.getName()).toBe('Planning');
    });

    test('should accept LLM client and ToolRegistry in constructor', () => {
      expect(strategy.llmClient).toBe(llmClient);
      expect(strategy.toolRegistry).toBe(toolRegistry);
    });

    test('should initialize with default options', () => {
      expect(strategy.options.outputFormat).toBe('json');
      expect(strategy.options.validateResults).toBe(true);
    });

    test('should accept custom options', () => {
      const customStrategy = new PlanningStrategy(llmClient, toolRegistry, {
        outputFormat: 'text',
        validateResults: false
      });
      
      expect(customStrategy.options.outputFormat).toBe('text');
      expect(customStrategy.options.validateResults).toBe(false);
    });
  });

  describe('TaskStrategy Interface', () => {
    test('should implement getName method', () => {
      expect(typeof strategy.getName).toBe('function');
      expect(strategy.getName()).toBe('Planning');
    });

    test('should implement onParentMessage method', () => {
      expect(typeof strategy.onParentMessage).toBe('function');
    });

    test('should implement onChildMessage method', () => {
      expect(typeof strategy.onChildMessage).toBe('function');
    });
  });

  describe('Helper Methods', () => {
    test('should have extractRequirements helper method', () => {
      expect(typeof strategy._extractRequirements).toBe('function');
    });

    test('should have getProjectId helper method', () => {
      expect(typeof strategy._getProjectId).toBe('function');
    });

    test('should have context extraction helper', () => {
      expect(typeof strategy._getContextFromTask).toBe('function');
    });
  });

  describe('Message Handling', () => {
    test('should handle start message with requirements analysis artifact', async () => {
      const mockTask = {
        id: 'task-123',
        description: 'Create a calculator API',
        projectId: 'project-123',
        getAllArtifacts: () => ({
          'requirements-analysis': {
            content: {
              type: 'api',
              features: ['calculation endpoints', 'error handling'],
              constraints: ['secure', 'fast'],
              technologies: ['express', 'joi']
            },
            description: 'Requirements analysis',
            type: 'analysis'
          }
        }),
        addConversationEntry: jest.fn(),
        storeArtifact: jest.fn()
      };

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });
      
      // Should return successful result
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result.plan).toBeDefined();
      expect(result.result.structure).toBeDefined();
      expect(result.artifacts).toContain('project-plan');
      expect(result.artifacts).toContain('project-structure');
    }, 10000); // Allow time for plan generation

    test('should handle start message with description fallback', async () => {
      const mockTask = {
        id: 'task-456',
        description: 'Build a simple REST API',
        getAllArtifacts: () => ({}),
        addConversationEntry: jest.fn(),
        storeArtifact: jest.fn()
      };

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.result.plan).toBeDefined();
    }, 10000);

    test('should handle abort message', async () => {
      const mockTask = {};
      
      const result = await strategy.onParentMessage(mockTask, { type: 'abort' });
      
      expect(result.acknowledged).toBe(true);
      expect(result.aborted).toBe(true);
    });

    test('should handle unknown message types', async () => {
      const mockTask = {};
      
      const result = await strategy.onParentMessage(mockTask, { type: 'unknown' });
      
      expect(result.acknowledged).toBe(true);
    });

    test('should handle work message same as start', async () => {
      const mockTask = {
        id: 'task-789',
        description: 'Create CLI tool',
        getAllArtifacts: () => ({}),
        addConversationEntry: jest.fn(),
        storeArtifact: jest.fn()
      };

      const result = await strategy.onParentMessage(mockTask, { type: 'work' });
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    }, 10000);
  });

  describe('Requirements Extraction', () => {
    test('should extract requirements from requirements-analysis artifact', () => {
      const mockTask = {
        getAllArtifacts: () => ({
          'requirements-analysis': {
            content: {
              type: 'web',
              features: ['user interface', 'data storage'],
              technologies: ['react', 'node']
            }
          }
        })
      };

      const requirements = strategy._extractRequirements(mockTask);
      expect(requirements).toEqual({
        type: 'web',
        features: ['user interface', 'data storage'],
        technologies: ['react', 'node']
      });
    });

    test('should extract requirements from generic requirements artifact', () => {
      const mockTask = {
        getAllArtifacts: () => ({
          'requirements': {
            content: {
              type: 'cli',
              features: ['command parsing'],
              technologies: ['commander']
            }
          }
        })
      };

      const requirements = strategy._extractRequirements(mockTask);
      expect(requirements.type).toBe('cli');
      expect(requirements.features).toContain('command parsing');
    });

    test('should handle JSON description', () => {
      const jsonRequirements = {
        type: 'library',
        features: ['math utilities'],
        technologies: ['typescript']
      };
      
      const mockTask = {
        description: JSON.stringify(jsonRequirements),
        getAllArtifacts: () => ({})
      };

      const requirements = strategy._extractRequirements(mockTask);
      expect(requirements).toEqual(jsonRequirements);
    });

    test('should handle plain text description', () => {
      const mockTask = {
        description: 'Create a file processing utility',
        getAllArtifacts: () => ({})
      };

      const requirements = strategy._extractRequirements(mockTask);
      expect(requirements).toEqual({
        type: 'api',
        description: 'Create a file processing utility',
        features: [],
        constraints: [],
        technologies: []
      });
    });

    test('should return null when no requirements found', () => {
      const mockTask = {
        description: '',
        getAllArtifacts: () => ({})
      };

      const requirements = strategy._extractRequirements(mockTask);
      expect(requirements).toBeNull();
    });
  });

  describe('Project ID Extraction', () => {
    test('should use task projectId when available', () => {
      const mockTask = { projectId: 'existing-project-123' };
      const projectId = strategy._getProjectId(mockTask);
      expect(projectId).toBe('existing-project-123');
    });

    test('should generate projectId from task id', () => {
      const mockTask = { id: 'task-456' };
      const projectId = strategy._getProjectId(mockTask);
      expect(projectId).toBe('project-for-task-456');
    });

    test('should generate unique projectId when no identifiers', () => {
      const mockTask = {};
      const projectId = strategy._getProjectId(mockTask);
      expect(projectId).toMatch(/^project-\d+-[a-z0-9]+$/);
    });
  });

  describe('Context Extraction', () => {
    test('should extract basic context from task', () => {
      const mockTask = {
        id: 'task-123',
        description: 'Test task',
        workspaceDir: '/tmp/workspace'
      };

      const context = strategy._getContextFromTask(mockTask);
      expect(context.taskId).toBe('task-123');
      expect(context.description).toBe('Test task');
      expect(context.workspaceDir).toBe('/tmp/workspace');
    });

    test('should include artifacts in context', () => {
      const mockTask = {
        id: 'task-456',
        description: 'Test task',
        getAllArtifacts: () => ({
          'requirements': { content: 'data' },
          'config': { content: 'settings' }
        })
      };

      const context = strategy._getContextFromTask(mockTask);
      expect(context.existingArtifacts).toEqual(['requirements', 'config']);
    });

    test('should include conversation history in context', () => {
      const mockTask = {
        id: 'task-789',
        description: 'Test task',
        getConversationContext: () => [
          { role: 'user', content: 'Create project' },
          { role: 'assistant', content: 'Starting analysis' }
        ]
      };

      const context = strategy._getContextFromTask(mockTask);
      expect(context.conversationHistory).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing requirements gracefully', async () => {
      const mockTask = {
        description: '',
        getAllArtifacts: () => ({}),
        addConversationEntry: jest.fn()
      };

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });
      
      expect(result.success).toBe(false);
      expect(result.result).toBe('No requirements found for planning');
    });

    test('should handle component initialization errors', async () => {
      // Create strategy without required dependencies
      const invalidStrategy = new PlanningStrategy(null, null);
      
      const mockTask = {
        description: 'Test task',
        getAllArtifacts: () => ({}),
        addConversationEntry: jest.fn()
      };

      const result = await invalidStrategy.onParentMessage(mockTask, { type: 'start' });
      
      expect(result.success).toBe(false);
      expect(result.result).toMatch(/requires LLM client and ToolRegistry/);
    });
  });

  describe('Child Message Handling', () => {
    test('should acknowledge child completion messages', async () => {
      const mockChildTask = {
        parent: { id: 'parent-task' }
      };
      
      const result = await strategy.onChildMessage(mockChildTask, { type: 'completed' });
      
      expect(result.acknowledged).toBe(true);
    });

    test('should acknowledge child failure messages', async () => {
      const mockChildTask = {
        parent: { id: 'parent-task' }
      };
      
      const result = await strategy.onChildMessage(mockChildTask, { type: 'failed' });
      
      expect(result.acknowledged).toBe(true);
    });

    test('should require child task to have parent', async () => {
      const orphanChild = { parent: null };
      
      await expect(strategy.onChildMessage(orphanChild, { type: 'completed' }))
        .rejects.toThrow('Child task has no parent');
    });
  });
});