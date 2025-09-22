/**
 * Unit tests for QualityStrategy
 * Tests the migration of QualityController component to TaskStrategy pattern
 * Phase 4.3 Migration Test
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';
import QualityStrategy from '../../../../src/strategies/coding/QualityStrategy.js';

describe('QualityStrategy', () => {
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
    strategy = new QualityStrategy(llmClient, toolRegistry);
  });

  describe('Basic Properties', () => {
    test('should create strategy instance', () => {
      expect(strategy).toBeDefined();
      expect(strategy.getName()).toBe('Quality');
    });

    test('should accept llmClient and toolRegistry in constructor', () => {
      expect(strategy.llmClient).toBe(llmClient);
      expect(strategy.toolRegistry).toBe(toolRegistry);
    });

    test('should initialize with default options', () => {
      expect(strategy.options.validateResults).toBe(true);
      expect(strategy.options.qualityThreshold).toBe(7);
      expect(strategy.options.requireAllPhases).toBe(true);
    });

    test('should accept custom options', () => {
      const customStrategy = new QualityStrategy(llmClient, toolRegistry, {
        validateResults: false,
        qualityThreshold: 5,
        requireAllPhases: false
      });
      
      expect(customStrategy.options.validateResults).toBe(false);
      expect(customStrategy.options.qualityThreshold).toBe(5);
      expect(customStrategy.options.requireAllPhases).toBe(false);
    });
  });

  describe('TaskStrategy Interface', () => {
    test('should implement getName method', () => {
      expect(typeof strategy.getName).toBe('function');
      expect(strategy.getName()).toBe('Quality');
    });

    test('should implement onParentMessage method', () => {
      expect(typeof strategy.onParentMessage).toBe('function');
    });

    test('should implement onChildMessage method', () => {
      expect(typeof strategy.onChildMessage).toBe('function');
    });
  });

  describe('Component Wrapping', () => {
    test('should not initialize component until first use', () => {
      expect(strategy.qualityController).toBeNull();
    });

    test('should have component initialization method', () => {
      expect(typeof strategy._ensureComponentInitialized).toBe('function');
    });

    test('should have project data extraction helper', () => {
      expect(typeof strategy._extractProjectData).toBe('function');
    });

    test('should have context extraction helper', () => {
      expect(typeof strategy._getContextFromTask).toBe('function');
    });

    test('should have project validation method', () => {
      expect(typeof strategy._validateProject).toBe('function');
    });
  });

  describe('Message Handling', () => {
    test('should handle start message with execution result artifact', async () => {
      const mockTask = {
        id: 'task-123',
        description: 'Validate calculator API project quality',
        getAllArtifacts: () => ({
          'execution-result': {
            content: {
              success: true,
              projectId: 'calc-api-123',
              phases: [
                {
                  phase: 'setup',
                  success: true,
                  tasks: [
                    { id: 'setup-1', success: true, artifacts: [] }
                  ]
                },
                {
                  phase: 'core',
                  success: true,
                  tasks: [
                    { id: 'core-1', success: true, artifacts: [] }
                  ]
                }
              ],
              artifacts: [
                {
                  name: 'package.json',
                  path: 'package.json',
                  content: '{"name": "calc-api", "version": "1.0.0"}',
                  type: 'config'
                },
                {
                  name: 'server.js',
                  path: 'server.js',
                  content: 'const express = require("express"); const app = express();',
                  type: 'code'
                }
              ]
            },
            description: 'Project execution result',
            type: 'execution'
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
      expect(result.result.validation).toBeDefined();
      expect(result.result.passed).toBeDefined();
      expect(result.result.phasesValidated).toBeGreaterThanOrEqual(0);
      expect(result.artifacts).toContain('quality-validation');
      
      // Should add conversation entries
      expect(mockTask.addConversationEntry).toHaveBeenCalledTimes(2);
      expect(mockTask.storeArtifact).toHaveBeenCalled();
    });

    test('should handle start message with project artifacts', async () => {
      const mockTask = {
        id: 'task-456',
        description: 'Validate project with artifacts',
        getAllArtifacts: () => ({
          'project-plan': {
            content: {
              phases: [{ phase: 'setup', tasks: [] }]
            },
            type: 'plan'
          },
          'code-artifact': {
            content: 'function add(a, b) { return a + b; }',
            path: 'utils.js',
            type: 'code'
          }
        }),
        addConversationEntry: jest.fn(),
        storeArtifact: jest.fn()
      };

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.result.validation).toBeDefined();
    });

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
        description: 'Validate work project',
        getAllArtifacts: () => ({
          'execution-result': {
            content: {
              success: true,
              phases: [{ phase: 'test', success: true, tasks: [] }],
              artifacts: []
            }
          }
        }),
        addConversationEntry: jest.fn(),
        storeArtifact: jest.fn()
      };

      const result = await strategy.onParentMessage(mockTask, { type: 'work' });
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe('Project Data Extraction', () => {
    test('should extract project from execution-result artifact', () => {
      const projectData = {
        success: true,
        phases: [{ phase: 'setup', tasks: [] }],
        artifacts: []
      };
      
      const mockTask = {
        getAllArtifacts: () => ({
          'execution-result': { content: projectData }
        })
      };

      const project = strategy._extractProjectData(mockTask);
      expect(project).toEqual(projectData);
    });

    test('should extract project from project-result artifact', () => {
      const projectData = {
        phases: [{ phase: 'build', tasks: [] }]
      };
      
      const mockTask = {
        getAllArtifacts: () => ({
          'project-result': { content: projectData }
        })
      };

      const project = strategy._extractProjectData(mockTask);
      expect(project).toEqual(projectData);
    });

    test('should extract project from generic result artifact', () => {
      const projectData = {
        phases: [{ phase: 'deploy', tasks: [] }]
      };
      
      const mockTask = {
        getAllArtifacts: () => ({
          'result': { content: projectData }
        })
      };

      const project = strategy._extractProjectData(mockTask);
      expect(project).toEqual(projectData);
    });

    test('should extract project from task input', () => {
      const projectData = {
        phases: [{ phase: 'validation', tasks: [] }]
      };
      
      const mockTask = {
        getAllArtifacts: () => ({}),
        input: { project: projectData }
      };

      const project = strategy._extractProjectData(mockTask);
      expect(project).toEqual(projectData);
    });

    test('should construct project from available artifacts', () => {
      const mockTask = {
        getAllArtifacts: () => ({
          'package.json': {
            content: '{"name": "test"}',
            type: 'config',
            description: 'Package configuration'
          },
          'server.js': {
            content: 'const app = express();',
            type: 'code',
            description: 'Main server file'
          }
        })
      };

      const project = strategy._extractProjectData(mockTask);
      expect(project).toBeDefined();
      expect(project.artifacts).toHaveLength(2);
      expect(project.artifacts[0].name).toBe('package.json');
      expect(project.artifacts[1].name).toBe('server.js');
    });

    test('should handle JSON description with project structure', () => {
      const projectData = {
        phases: [{ phase: 'integration', tasks: [] }]
      };
      
      const mockTask = {
        description: JSON.stringify(projectData),
        getAllArtifacts: () => ({})
      };

      const project = strategy._extractProjectData(mockTask);
      expect(project).toEqual(projectData);
    });

    test('should return null when no project found', () => {
      const mockTask = {
        description: 'plain text description',
        getAllArtifacts: () => ({})
      };

      const project = strategy._extractProjectData(mockTask);
      expect(project).toBeNull();
    });
  });

  describe('Context Extraction', () => {
    test('should extract basic context from task', () => {
      const mockTask = {
        id: 'task-123',
        description: 'Test quality validation task',
        workspaceDir: '/tmp/workspace'
      };

      const context = strategy._getContextFromTask(mockTask);
      expect(context.taskId).toBe('task-123');
      expect(context.description).toBe('Test quality validation task');
      expect(context.workspaceDir).toBe('/tmp/workspace');
    });

    test('should include artifacts in context', () => {
      const mockTask = {
        id: 'task-456',
        description: 'Test task',
        getAllArtifacts: () => ({
          'validation': { content: 'data' },
          'report': { content: 'report' }
        })
      };

      const context = strategy._getContextFromTask(mockTask);
      expect(context.existingArtifacts).toEqual(['validation', 'report']);
    });

    test('should include conversation history in context', () => {
      const mockTask = {
        id: 'task-789',
        description: 'Test task',
        getConversationContext: () => [
          { role: 'user', content: 'Validate project' },
          { role: 'assistant', content: 'Starting validation' }
        ]
      };

      const context = strategy._getContextFromTask(mockTask);
      expect(context.conversationHistory).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing project data gracefully', async () => {
      const mockTask = {
        description: 'Validate project',
        getAllArtifacts: () => ({}),
        addConversationEntry: jest.fn()
      };

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });
      
      expect(result.success).toBe(false);
      expect(result.result).toBe('No project data found for quality validation');
    });

    test('should handle component initialization errors', async () => {
      // Create strategy without required dependencies
      const invalidStrategy = new QualityStrategy(null, null);
      
      const mockTask = {
        description: 'Test task',
        getAllArtifacts: () => ({
          'execution-result': {
            content: { phases: [] }
          }
        }),
        addConversationEntry: jest.fn()
      };

      const result = await invalidStrategy.onParentMessage(mockTask, { type: 'start' });
      
      expect(result.success).toBe(false);
      expect(result.result).toMatch(/requires LLM client and ToolRegistry/);
    });

    test('should handle validation errors gracefully', async () => {
      // Mock the quality controller to throw an error
      const mockTask = {
        description: 'Test failing validation',
        getAllArtifacts: () => ({
          'execution-result': {
            content: { phases: [] }
          }
        }),
        addConversationEntry: jest.fn()
      };

      // Override the validation method to throw
      jest.spyOn(strategy, '_validateProject').mockRejectedValue(new Error('Validation failed'));

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });
      
      expect(result.success).toBe(false);
      expect(result.result).toBe('Validation failed');
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

  describe('Component Initialization', () => {
    test('should initialize quality controller when needed', () => {
      expect(strategy.qualityController).toBeNull();
      
      strategy._ensureComponentInitialized();
      
      expect(strategy.qualityController).toBeDefined();
      expect(strategy.qualityController.constructor.name).toBe('QualityController');
    });

    test('should not reinitialize component if already created', () => {
      strategy._ensureComponentInitialized();
      const firstController = strategy.qualityController;
      
      strategy._ensureComponentInitialized();
      const secondController = strategy.qualityController;
      
      expect(firstController).toBe(secondController);
    });

    test('should throw error when initializing without required services', () => {
      const invalidStrategy = new QualityStrategy(null, null);
      
      expect(() => {
        invalidStrategy._ensureComponentInitialized();
      }).toThrow('QualityStrategy requires LLM client and ToolRegistry');
    });
  });

  describe('Project Validation', () => {
    test('should validate project with execution result', async () => {
      const project = {
        success: true,
        phases: [
          { phase: 'setup', success: true, tasks: [] }
        ],
        artifacts: []
      };
      
      const mockTask = {
        getAllArtifacts: () => ({
          'execution-result': {
            content: { success: true }
          }
        })
      };

      const result = await strategy._validateProject(project, mockTask);
      
      expect(result).toBeDefined();
      expect(result.passed).toBeDefined();
      expect(result.phases).toBeDefined();
      expect(result.overall).toBeDefined();
      expect(result.issues).toBeDefined();
    });

    test('should detect execution failure in validation', async () => {
      const project = {
        success: false,
        phases: [],
        artifacts: []
      };
      
      const mockTask = {
        getAllArtifacts: () => ({
          'execution-result': {
            content: { success: false }
          }
        })
      };

      const result = await strategy._validateProject(project, mockTask);
      
      expect(result.passed).toBe(false);
      expect(result.issues).toContain('Project execution failed');
    });

    test('should validate individual code artifacts', async () => {
      const project = {
        success: true,
        phases: [],
        artifacts: []
      };
      
      const mockTask = {
        getAllArtifacts: () => ({
          'server.js': {
            content: 'const express = require("express");',
            type: 'code'
          },
          'test.js': {
            content: 'describe("test", () => {});',
            type: 'test'
          }
        })
      };

      const result = await strategy._validateProject(project, mockTask);
      
      expect(result).toBeDefined();
      // Should attempt to validate code and test artifacts
    });

    test('should handle validation errors gracefully', async () => {
      const project = null; // Invalid project
      
      const result = await strategy._validateProject(project, {});
      
      expect(result.passed).toBe(false);
      expect(result.issues).toContain(expect.stringMatching(/Validation error/));
    });
  });
});