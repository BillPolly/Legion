/**
 * Unit tests for ProfileTool
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ProfileTool } from '../../src/tools/ProfileTool.js';
import { createMockResourceManager, createMockLLMClient, testProfile, mockPlanResponse } from '../utils/mocks.js';

describe('ProfileTool', () => {
  let tool;
  let mockResourceManager;
  let mockProfileManager;
  let mockLLMClient;
  let mockPlanner;
  let javascriptProfile;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockResourceManager = createMockResourceManager();
    mockLLMClient = createMockLLMClient();
    
    // Mock JavaScript profile
    javascriptProfile = {
      name: 'javascript',
      toolName: 'javascript_planner',
      description: 'Plan JavaScript and Node.js development tasks with testing',
      requiredModules: ['file', 'node-runner'],
      defaultInputs: ['user_request', 'project_context'],
      defaultOutputs: ['file_created', 'project_created', 'test_results'],
      maxSteps: 25,
      contextPrompts: ['You are working in a JavaScript/Node.js development environment.'],
      allowableActions: []
    };
    
    // Mock ProfileManager
    mockProfileManager = {
      createPlanningContext: jest.fn().mockReturnValue({
        description: 'Task: Create a calculator',
        inputs: ['user_request'],
        requiredOutputs: ['file_created'],
        allowableActions: [],
        maxSteps: 25,
        initialInputData: { user_request: 'Create a calculator' }
      })
    };
    
    // Create tool with JavaScript profile
    tool = new ProfileTool(javascriptProfile, mockProfileManager, mockResourceManager);
    
    // Mock the _createLLMClient method 
    tool._createLLMClient = jest.fn().mockResolvedValue(mockLLMClient);
  });

  describe('constructor', () => {
    test('should create tool with profile properties', () => {
      expect(tool.profile).toBe(javascriptProfile);
      expect(tool.name).toBe('javascript_planner');
      expect(tool.description).toBe('Plan JavaScript and Node.js development tasks with testing');
      expect(tool.resourceManager).toBe(mockResourceManager);
      expect(tool.profileManager).toBe(mockProfileManager);
    });
  });

  describe('getAllToolDescriptions', () => {
    test('should return tool description based on profile', () => {
      const descriptions = tool.getAllToolDescriptions();
      
      expect(descriptions).toHaveLength(1);
      expect(descriptions[0]).toEqual({
        type: 'function',
        function: {
          name: 'javascript_planner',
          description: 'Plan JavaScript and Node.js development tasks with testing',
          parameters: {
            type: 'object',
            properties: {
              task: {
                type: 'string',
                description: 'Natural language description of what needs to be accomplished using javascript profile'
              },
              saveAs: {
                type: 'string',
                description: 'Optional name to save the plan in context for later execution'
              }
            },
            required: ['task']
          }
        }
      });
    });
  });

  describe('invoke', () => {
    test('should handle valid function call', async () => {
      const mockPlan = {
        id: 'plan-123',
        name: 'Test Plan',
        toJSON: jest.fn().mockReturnValue({ id: 'plan-123', name: 'Test Plan' })
      };
      
      // Mock GenericPlanner through module mocking
      const GenericPlanner = jest.fn().mockImplementation(() => ({
        createPlan: jest.fn().mockResolvedValue(mockPlan)
      }));
      
      // Import after mocking
      const { GenericPlanner: ActualPlanner } = await import('@legion/llm-planner');
      jest.mocked(ActualPlanner).mockImplementation(GenericPlanner);
      
      const result = await tool.invoke({
        function: {
          name: 'javascript_planner',
          arguments: JSON.stringify({
            task: 'Create a calculator function'
          })
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.data.profile).toBe('javascript');
      expect(result.data.requiredModules).toEqual(['file', 'node-runner']);
      expect(mockProfileManager.createPlanningContext).toHaveBeenCalledWith(
        javascriptProfile,
        'Create a calculator function'
      );
    });

    test('should handle invalid function name', async () => {
      const result = await tool.invoke({
        function: {
          name: 'wrong_function',
          arguments: '{}'
        }
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown function: wrong_function');
    });

    test('should handle invalid JSON arguments', async () => {
      const result = await tool.invoke({
        function: {
          name: 'javascript_planner',
          arguments: 'invalid json'
        }
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid arguments');
    });

    test('should include saveAs in result when provided', async () => {
      const mockPlan = {
        id: 'plan-123',
        name: 'Test Plan',
        toJSON: jest.fn().mockReturnValue({ id: 'plan-123', name: 'Test Plan' })
      };
      
      const GenericPlanner = jest.fn().mockImplementation(() => ({
        createPlan: jest.fn().mockResolvedValue(mockPlan)
      }));
      
      const { GenericPlanner: ActualPlanner } = await import('@legion/llm-planner');
      jest.mocked(ActualPlanner).mockImplementation(GenericPlanner);
      
      const result = await tool.invoke({
        function: {
          name: 'javascript_planner',
          arguments: JSON.stringify({
            task: 'Create a calculator',
            saveAs: 'my_calculator_plan'
          })
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.data.savedAs).toBe('my_calculator_plan');
      expect(result.data.saveNote).toContain('context saving not yet implemented');
    });
  });
});