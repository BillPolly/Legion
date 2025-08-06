/**
 * Integration tests for LLM planner validation workflow
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { GenericPlanner } from '../../src/GenericPlanner.js';
import { LLMPlannerModule } from '../../src/LLMPlannerModule.js';

describe('Validation Workflow Integration', () => {
  const mockLLMClient = {
    complete: jest.fn()
  };

  const mockModuleLoader = {
    getToolByNameOrAlias: jest.fn(),
    getToolSchema: jest.fn(),
    hasTool: jest.fn()
  };

  const allowableActions = [
    {
      type: 'file_write',
      description: 'Write content to a file',
      inputSchema: {
        properties: {
          filepath: { type: 'string', description: 'Path to file' },
          content: { type: 'string', description: 'Content to write' }
        },
        required: ['filepath', 'content']
      },
      outputSchema: {
        properties: {
          filepath: { type: 'string' },
          created: { type: 'boolean' }
        }
      }
    },
    {
      type: 'directory_create',
      description: 'Create a directory',
      inputSchema: {
        properties: {
          dirpath: { type: 'string', description: 'Directory path' }
        },
        required: ['dirpath']
      },
      outputSchema: {
        properties: {
          dirpath: { type: 'string' },
          created: { type: 'boolean' }
        }
      }
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Template System Integration', () => {
    test('should use create-plan template for initial generation', async () => {
      const validPlanResponse = JSON.stringify({
        id: 'test-plan',
        name: 'Test Plan',
        description: 'Test plan description',
        version: '1.0.0',
        status: 'draft',
        steps: [{
          id: 'step-1',
          name: 'Create Directory',
          type: 'setup',
          actions: [{
            type: 'directory_create',
            inputs: { dirpath: '/test' },
            outputs: { dirpath: 'testDir', created: 'dirCreated' }
          }]
        }]
      });

      mockLLMClient.complete.mockResolvedValue(validPlanResponse);
      
      const planner = new GenericPlanner({
        llmClient: mockLLMClient,
        moduleLoader: mockModuleLoader
      });

      // Mock validation to succeed
      jest.spyOn(planner, '_validatePlanWithTools').mockResolvedValue({
        valid: true,
        errors: []
      });

      const result = await planner.createPlan({
        description: 'Create a test directory',
        inputs: ['projectPath'],
        requiredOutputs: ['testDir'],
        allowableActions
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Plan');
      expect(mockLLMClient.complete).toHaveBeenCalledTimes(1);
      
      // Check that the prompt contains template elements
      const promptCall = mockLLMClient.complete.mock.calls[0][0];
      expect(promptCall).toContain('Create a test directory');
      expect(promptCall).toContain('ALLOWABLE ACTIONS');
      expect(promptCall).toContain('Use **inputs** and **outputs** fields');
      expect(promptCall).toContain('Use **@variable** syntax');
    });

    test('should use fix-plan template for validation failures', async () => {
      const invalidPlanResponse = JSON.stringify({
        id: 'invalid-plan',
        name: 'Invalid Plan',
        description: 'Plan with errors',
        version: '1.0.0',
        status: 'draft',
        steps: [{
          id: 'step-1',
          name: 'Invalid Step',
          type: 'setup',
          actions: [{
            type: 'nonexistent_tool',
            inputs: { param: 'value' },
            outputs: { result: 'output' }
          }]
        }]
      });

      const validPlanResponse = JSON.stringify({
        id: 'fixed-plan',
        name: 'Fixed Plan',
        description: 'Plan with errors fixed',
        version: '1.0.0',
        status: 'draft',
        steps: [{
          id: 'step-1',
          name: 'Fixed Step',
          type: 'setup',
          actions: [{
            type: 'directory_create',
            inputs: { dirpath: '/test' },
            outputs: { dirpath: 'testDir', created: 'dirCreated' }
          }]
        }]
      });

      mockLLMClient.complete
        .mockResolvedValueOnce(invalidPlanResponse)
        .mockResolvedValueOnce(validPlanResponse);
      
      const planner = new GenericPlanner({
        llmClient: mockLLMClient,
        moduleLoader: mockModuleLoader
      });

      // Mock validation to fail first, then succeed
      jest.spyOn(planner, '_validatePlanWithTools')
        .mockResolvedValueOnce({
          valid: false,
          errors: ['Tool nonexistent_tool not found', 'Invalid action type']
        })
        .mockResolvedValueOnce({
          valid: true,
          errors: []
        });

      const result = await planner.createPlan({
        description: 'Create something',
        inputs: ['projectPath'],
        requiredOutputs: ['testDir'],
        allowableActions
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Fixed Plan');
      expect(mockLLMClient.complete).toHaveBeenCalledTimes(2);

      // Check that the second call used the fix-plan template
      const secondPromptCall = mockLLMClient.complete.mock.calls[1][0];
      expect(secondPromptCall).toContain('You previously generated a plan that failed validation');
      expect(secondPromptCall).toContain('FAILED VALIDATION');
      expect(secondPromptCall).toContain('Tool nonexistent_tool not found');
      expect(secondPromptCall).toContain('Invalid action type');
    });
  });

  describe('Validation Integration', () => {
    test('should validate plans using plan-executor-tools', async () => {
      const validPlanResponse = JSON.stringify({
        id: 'valid-plan',
        name: 'Valid Plan',
        description: 'A valid plan',
        version: '1.0.0',
        status: 'draft',
        steps: [{
          id: 'step-1',
          name: 'Create File',
          type: 'setup',
          actions: [{
            type: 'file_write',
            inputs: { filepath: '/test.txt', content: 'test' },
            outputs: { filepath: 'createdFile', created: 'fileCreated' }
          }]
        }]
      });

      mockLLMClient.complete.mockResolvedValue(validPlanResponse);
      
      const planner = new GenericPlanner({
        llmClient: mockLLMClient,
        moduleLoader: mockModuleLoader
      });

      const validationSpy = jest.spyOn(planner, '_validatePlanWithTools').mockResolvedValue({
        valid: true,
        errors: []
      });

      await planner.createPlan({
        description: 'Create a test file',
        inputs: [],
        requiredOutputs: ['createdFile'],
        allowableActions
      });

      // Verify validation was called
      expect(validationSpy).toHaveBeenCalledTimes(1);
      expect(validationSpy).toHaveBeenCalledWith({
        id: 'valid-plan',
        name: 'Valid Plan',
        description: 'A valid plan',
        version: '1.0.0',
        status: 'draft',
        steps: expect.arrayContaining([
          expect.objectContaining({
            id: 'step-1',
            name: 'Create File',
            type: 'setup'
          })
        ])
      });
    });

    test('should handle validation errors gracefully', async () => {
      const invalidPlanResponse = JSON.stringify({
        id: 'invalid-plan',
        name: 'Invalid Plan',
        steps: [] // Missing required fields
      });

      mockLLMClient.complete.mockResolvedValue(invalidPlanResponse);
      
      const planner = new GenericPlanner({
        llmClient: mockLLMClient,
        moduleLoader: mockModuleLoader,
        maxRetries: 1
      });

      // Mock validation to always fail
      jest.spyOn(planner, '_validatePlanWithTools').mockResolvedValue({
        valid: false,
        errors: ['Missing required field: description', 'Missing required field: version']
      });

      await expect(planner.createPlan({
        description: 'Create something invalid',
        inputs: [],
        requiredOutputs: [],
        allowableActions
      })).rejects.toThrow('Plan validation failed: Missing required field: description, Missing required field: version');
    });
  });

  describe('LLMPlannerModule Integration', () => {
    test('should integrate with resource manager and module loader', async () => {
      const mockResourceManager = {
        get: jest.fn().mockImplementation((key) => {
          if (key === 'env.ANTHROPIC_API_KEY') return 'test-api-key';
          if (key === 'llmClient') throw new Error('Not found');
          if (key === 'moduleLoader') throw new Error('Not found');
          throw new Error(`Unknown key: ${key}`);
        }),
        register: jest.fn()
      };

      // Mock dynamic imports
      const mockLLMClient = { complete: jest.fn() };
      const mockModuleLoader = { initialize: jest.fn() };

      // Create module using the factory
      const module = await LLMPlannerModule.create(mockResourceManager);

      expect(module).toBeInstanceOf(LLMPlannerModule);
      expect(module.name).toBe('llm-planner');
      expect(module.tools).toHaveLength(2);
      
      const createPlanTool = module.tools.find(tool => tool.getToolDescription().function.name === 'create-plan');
      expect(createPlanTool).toBeDefined();
      expect(createPlanTool.llmClient).toBeDefined();
      expect(createPlanTool.moduleLoader).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle template loading errors', async () => {
      const planner = new GenericPlanner({
        llmClient: mockLLMClient,
        moduleLoader: mockModuleLoader
      });

      // Mock template loader to throw error
      jest.spyOn(planner.templateLoader, 'loadCreatePlanTemplate').mockRejectedValue(
        new Error('Template not found')
      );

      await expect(planner.createPlan({
        description: 'Test',
        allowableActions
      })).rejects.toThrow('Template not found');
    });

    test('should handle validation service errors', async () => {
      const validPlanResponse = JSON.stringify({
        id: 'test-plan',
        name: 'Test Plan',
        description: 'Test',
        version: '1.0.0',
        status: 'draft',
        steps: []
      });

      mockLLMClient.complete.mockResolvedValue(validPlanResponse);
      
      const planner = new GenericPlanner({
        llmClient: mockLLMClient,
        moduleLoader: mockModuleLoader,
        maxRetries: 1
      });

      // Mock validation to throw error
      jest.spyOn(planner, '_validatePlanWithTools').mockRejectedValue(
        new Error('Validation service unavailable')
      );

      await expect(planner.createPlan({
        description: 'Test',
        allowableActions
      })).rejects.toThrow('Validation failed: Validation service unavailable');
    });
  });
});