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
    completeWithStructuredResponse: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should create planner with LLM client', () => {
      const planner = new GenericPlanner({ llmClient: mockLLMClient });
      
      expect(planner.llmClient).toBe(mockLLMClient);
      expect(planner.maxRetries).toBe(3);
      expect(planner.maxSteps).toBe(20);
    });

    test('should throw error if no LLM client provided', () => {
      expect(() => new GenericPlanner()).toThrow('LLM client is required');
    });

    test('should accept custom options', () => {
      const planner = new GenericPlanner({ 
        llmClient: mockLLMClient,
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
        "name": "Simple Web App",
        "description": "Create a simple web application",
        "steps": [
          {
            "id": "create-files",
            "name": "Create Files",
            "type": "setup",
            "dependencies": [],
            "inputs": ["requirements"],
            "outputs": ["file-content"],
            "actions": [
              {
                "type": "create-file",
                "parameters": { "filePath": "index.html" }
              }
            ]
          },
          {
            "id": "deploy-app",
            "name": "Deploy App",
            "type": "deployment",
            "dependencies": ["create-files"],
            "inputs": ["file-content"],
            "outputs": ["deployed-app"],
            "actions": [
              {
                "type": "deploy",
                "parameters": { "target": "production" }
              }
            ]
          }
        ]
      }`;

      mockLLMClient.completeWithStructuredResponse.mockResolvedValue(validPlanResponse);

      const planner = new GenericPlanner({ llmClient: mockLLMClient });
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
      const planner = new GenericPlanner({ llmClient: mockLLMClient });
      
      await expect(planner.createPlan({ allowableActions })).rejects.toThrow('Description is required');
    });

    test('should throw error if allowable actions are missing', async () => {
      const planner = new GenericPlanner({ llmClient: mockLLMClient });
      
      await expect(planner.createPlan({ description: 'Test' })).rejects.toThrow('Allowable actions are required');
    });

    test('should throw error if allowable actions are empty', async () => {
      const planner = new GenericPlanner({ llmClient: mockLLMClient });
      
      await expect(planner.createPlan({ 
        description: 'Test',
        allowableActions: []
      })).rejects.toThrow('Allowable actions are required');
    });

    test('should retry on validation failure', async () => {
      const invalidPlanResponse = `{
        "name": "Invalid Plan",
        "description": "This plan has invalid actions",
        "steps": [
          {
            "id": "invalid-step",
            "name": "Invalid Step",
            "type": "setup",
            "actions": [
              {
                "type": "invalid-action",
                "parameters": {}
              }
            ]
          }
        ]
      }`;

      const validPlanResponse = `{
        "name": "Valid Plan",
        "description": "This plan has valid actions",
        "steps": [
          {
            "id": "valid-step",
            "name": "Valid Step",
            "type": "setup",
            "inputs": ["requirements"],
            "outputs": ["file-created"],
            "actions": [
              {
                "type": "create-file",
                "parameters": {}
              }
            ]
          }
        ]
      }`;

      mockLLMClient.completeWithStructuredResponse
        .mockResolvedValueOnce(invalidPlanResponse)
        .mockResolvedValueOnce(validPlanResponse);

      const planner = new GenericPlanner({ llmClient: mockLLMClient });
      const request = {
        description: 'Create something',
        inputs: ['requirements'],
        requiredOutputs: ['file-created'],
        allowableActions
      };

      const plan = await planner.createPlan(request);

      expect(plan.name).toBe('Valid Plan');
      expect(mockLLMClient.completeWithStructuredResponse).toHaveBeenCalledTimes(2);
    });

    test('should fail after max retries', async () => {
      const invalidPlanResponse = `{
        "name": "Invalid Plan",
        "description": "This plan will always fail",
        "steps": [
          {
            "id": "invalid-step",
            "name": "Invalid Step",
            "type": "setup",
            "actions": [
              {
                "type": "invalid-action",
                "parameters": {}
              }
            ]
          }
        ]
      }`;

      mockLLMClient.completeWithStructuredResponse.mockResolvedValue(invalidPlanResponse);

      const planner = new GenericPlanner({ llmClient: mockLLMClient, maxRetries: 2 });
      const request = {
        description: 'Create something',
        inputs: ['requirements'],
        requiredOutputs: ['file-created'],
        allowableActions
      };

      await expect(planner.createPlan(request)).rejects.toThrow('Failed to generate valid plan after 2 attempts');
      expect(mockLLMClient.completeWithStructuredResponse).toHaveBeenCalledTimes(2);
    });

    test('should handle JSON parsing errors', async () => {
      mockLLMClient.completeWithStructuredResponse.mockResolvedValue('invalid json');

      const planner = new GenericPlanner({ llmClient: mockLLMClient, maxRetries: 1 });
      const request = {
        description: 'Create something',
        allowableActions
      };

      await expect(planner.createPlan(request)).rejects.toThrow('Failed to generate valid plan after 1 attempts');
    });

    test('should handle LLM client errors', async () => {
      mockLLMClient.completeWithStructuredResponse.mockRejectedValue(new Error('LLM client error'));

      const planner = new GenericPlanner({ llmClient: mockLLMClient, maxRetries: 1 });
      const request = {
        description: 'Create something',
        allowableActions
      };

      await expect(planner.createPlan(request)).rejects.toThrow('Failed to generate valid plan after 1 attempts');
    });
  });

  describe('_buildPrompt', () => {
    test('should build comprehensive prompt', () => {
      const planner = new GenericPlanner({ llmClient: mockLLMClient });
      
      const prompt = planner._buildPrompt(
        'Create a web app',
        ['requirements'],
        ['deployed-app'],
        allowableActions,
        10
      );

      expect(prompt).toContain('Create a web app');
      expect(prompt).toContain('Available inputs: requirements');
      expect(prompt).toContain('Required outputs: deployed-app');
      expect(prompt).toContain('Maximum steps: 10');
      expect(prompt).toContain('create-file: inputs=[file-content], outputs=[file-created]');
      expect(prompt).toContain('run-command: inputs=[command], outputs=[command-result]');
      expect(prompt).toContain('deploy: inputs=[deployment-config], outputs=[deployed-app]');
      expect(prompt).toContain('ALLOWABLE ACTIONS');
      expect(prompt).toContain('PLAN STRUCTURE');
      expect(prompt).toContain('hierarchical plan');
    });
  });

  describe('_validatePlan', () => {
    test('should validate plan with correct actions', () => {
      const planner = new GenericPlanner({ llmClient: mockLLMClient });
      
      const plan = new Plan({
        name: 'Test Plan',
        inputs: ['input1'],
        requiredOutputs: ['file-created']
      }, allowableActions);
      
      // Mock the plan to have valid input/output flow
      jest.spyOn(plan, 'validateInputOutputFlow').mockReturnValue({
        isValid: true,
        errors: [],
        availableOutputs: ['file-created']
      });

      const validation = planner._validatePlan(plan, ['input1'], ['file-created'], allowableActions);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    test('should detect invalid action types', () => {
      const planner = new GenericPlanner({ llmClient: mockLLMClient });
      
      // Create a plan with invalid action (we'll mock this)
      const plan = new Plan({ name: 'Test Plan' }, allowableActions);
      
      // Mock getAllActions to return invalid action
      jest.spyOn(planner, '_getAllActionsFromPlan').mockReturnValue([
        { type: 'invalid-action' }
      ]);

      const validation = planner._validatePlan(plan, [], [], allowableActions);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Invalid action type: invalid-action');
    });
  });

  describe('_getPlanSchema', () => {
    test('should return valid JSON schema', () => {
      const planner = new GenericPlanner({ llmClient: mockLLMClient });
      
      const schema = planner._getPlanSchema();
      
      expect(schema.type).toBe('object');
      expect(schema.properties.name).toBeDefined();
      expect(schema.properties.description).toBeDefined();
      expect(schema.properties.steps).toBeDefined();
      expect(schema.required).toEqual(['name', 'description', 'steps']);
    });
  });

  describe('_parsePlanResponse', () => {
    test('should parse JSON response', () => {
      const planner = new GenericPlanner({ llmClient: mockLLMClient });
      
      const response = JSON.stringify({
        name: 'Test Plan',
        description: 'Test description',
        steps: []
      });

      const plan = planner._parsePlanResponse(response, allowableActions);
      
      expect(plan).toBeInstanceOf(Plan);
      expect(plan.name).toBe('Test Plan');
      expect(plan.description).toBe('Test description');
    });

    test('should parse JSON wrapped in code blocks', () => {
      const planner = new GenericPlanner({ llmClient: mockLLMClient });
      
      const response = `\`\`\`json
{
  "name": "Test Plan",
  "description": "Test description",
  "steps": []
}
\`\`\``;

      const plan = planner._parsePlanResponse(response, allowableActions);
      
      expect(plan).toBeInstanceOf(Plan);
      expect(plan.name).toBe('Test Plan');
    });

    test('should throw error for invalid JSON', () => {
      const planner = new GenericPlanner({ llmClient: mockLLMClient });
      
      expect(() => planner._parsePlanResponse('invalid json', allowableActions)).toThrow('Failed to parse JSON response');
    });
  });
});