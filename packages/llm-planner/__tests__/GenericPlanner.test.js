/**
 * @jest-environment node
 */

import { describe, test, expect, jest } from '@jest/globals';
import { GenericPlanner } from '../src/GenericPlanner.js';
import { Plan } from '../src/models/Plan.js';

describe('GenericPlanner', () => {
  const allowableActions = [
    { type: 'create-file', inputs: ['file-content'], outputs: ['file-created'] },
    { type: 'run-command', inputs: ['command'], outputs: ['command-result'] },
    { type: 'deploy', inputs: ['deployment-config'], outputs: ['deployed-app'] }
  ];

  const mockLLMClient = {
    completeWithStructuredResponse: jest.fn(),
    complete: jest.fn()
  };

  const mockModuleLoader = {
    getToolByNameOrAlias: jest.fn(),
    getToolSchema: jest.fn(),
    hasTool: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should create planner with LLM client and moduleLoader', () => {
      const planner = new GenericPlanner({ 
        llmClient: mockLLMClient, 
        moduleLoader: mockModuleLoader 
      });
      
      expect(planner.llmClient).toBe(mockLLMClient);
      expect(planner.moduleLoader).toBe(mockModuleLoader);
      expect(planner.maxRetries).toBe(3);
      expect(planner.maxSteps).toBe(20);
    });

    test('should throw error if no LLM client provided', () => {
      expect(() => new GenericPlanner({ moduleLoader: mockModuleLoader })).toThrow('LLM client is required');
    });

    test('should throw error if no moduleLoader provided', () => {
      expect(() => new GenericPlanner({ llmClient: mockLLMClient })).toThrow('ModuleLoader is required for plan validation');
    });

    test('should accept custom options', () => {
      const planner = new GenericPlanner({ 
        llmClient: mockLLMClient,
        moduleLoader: mockModuleLoader,
        maxRetries: 5,
        maxSteps: 10
      });
      
      expect(planner.maxRetries).toBe(5);
      expect(planner.maxSteps).toBe(10);
    });
  });

  describe('createPlan', () => {
    test('should create plan with valid request', async () => {
      const validPlanResponse = `{
        "id": "simple-web-app",
        "name": "Simple Web App",
        "description": "Create a simple web application",
        "version": "1.0.0",
        "status": "draft",
        "steps": [
          {
            "id": "create-files",
            "name": "Create Files",
            "type": "setup",
            "dependencies": [],
            "actions": [
              {
                "type": "create-file",
                "inputs": { "file-content": "index.html content" },
                "outputs": { "file-created": "fileCreated" }
              }
            ]
          },
          {
            "id": "deploy-app",
            "name": "Deploy App",
            "type": "deployment",
            "dependencies": ["create-files"],
            "actions": [
              {
                "type": "deploy",
                "inputs": { "deployment-config": "@fileCreated" },
                "outputs": { "deployed-app": "deployedApp" }
              }
            ]
          }
        ]
      }`;

      mockLLMClient.complete.mockResolvedValue(validPlanResponse);
      
      // Mock the validation method to succeed
      const planner = new GenericPlanner({ 
        llmClient: mockLLMClient,
        moduleLoader: mockModuleLoader
      });
      
      // Override validation method to always pass
      jest.spyOn(planner, '_validatePlanWithTools').mockResolvedValue({
        valid: true,
        errors: []
      });
      const request = {
        description: 'Create a simple web application',
        inputs: ['requirements'],
        requiredOutputs: ['deployed-app'],
        allowableActions
      };

      const plan = await planner.createPlan(request);

      expect(plan).toBeInstanceOf(Plan);
      expect(plan.name).toBe('Simple Web App');
      expect(plan.steps).toHaveLength(2);
      expect(plan.steps[0].name).toBe('Create Files');
      expect(plan.steps[1].name).toBe('Deploy App');
    });

    test('should throw error if description is missing', async () => {
      const planner = new GenericPlanner({ 
        llmClient: mockLLMClient, 
        moduleLoader: mockModuleLoader 
      });
      
      await expect(planner.createPlan({ allowableActions })).rejects.toThrow('Description is required');
    });

    test('should throw error if allowable actions are missing', async () => {
      const planner = new GenericPlanner({ 
        llmClient: mockLLMClient, 
        moduleLoader: mockModuleLoader 
      });
      
      await expect(planner.createPlan({ description: 'Test' })).rejects.toThrow('Allowable actions are required');
    });

    test('should throw error if allowable actions are empty', async () => {
      const planner = new GenericPlanner({ 
        llmClient: mockLLMClient, 
        moduleLoader: mockModuleLoader 
      });
      
      await expect(planner.createPlan({ 
        description: 'Test',
        allowableActions: []
      })).rejects.toThrow('Allowable actions are required');
    });

    test('should handle JSON parsing errors', async () => {
      mockLLMClient.complete.mockResolvedValue('invalid json');

      const planner = new GenericPlanner({ 
        llmClient: mockLLMClient, 
        moduleLoader: mockModuleLoader,
        maxRetries: 1 
      });
      const request = {
        description: 'Create something',
        allowableActions
      };

      await expect(planner.createPlan(request)).rejects.toThrow('Failed to generate valid plan after 1 attempts');
    });

    test('should handle LLM client errors', async () => {
      mockLLMClient.complete.mockRejectedValue(new Error('LLM client error'));

      const planner = new GenericPlanner({ 
        llmClient: mockLLMClient, 
        moduleLoader: mockModuleLoader,
        maxRetries: 1 
      });
      const request = {
        description: 'Create something',
        allowableActions
      };

      await expect(planner.createPlan(request)).rejects.toThrow('Failed to generate valid plan after 1 attempts');
    });
  });

  describe('_parsePlanResponse', () => {
    test('should parse JSON response', () => {
      const planner = new GenericPlanner({ 
        llmClient: mockLLMClient, 
        moduleLoader: mockModuleLoader 
      });
      
      const response = JSON.stringify({
        id: 'test-plan',
        name: 'Test Plan',
        description: 'Test description',
        version: '1.0.0',
        steps: []
      });

      const plan = planner._parsePlanResponse(response, allowableActions, [], [], {});
      
      expect(plan).toBeInstanceOf(Plan);
      expect(plan.name).toBe('Test Plan');
      expect(plan.description).toBe('Test description');
    });

    test('should throw error for invalid JSON', () => {
      const planner = new GenericPlanner({ 
        llmClient: mockLLMClient, 
        moduleLoader: mockModuleLoader 
      });
      
      expect(() => planner._parsePlanResponse('invalid json', allowableActions, [], [], {})).toThrow('Failed to parse JSON response');
    });
  });
});