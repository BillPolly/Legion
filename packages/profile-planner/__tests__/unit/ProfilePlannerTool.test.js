/**
 * Unit tests for ProfilePlannerTool
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ProfilePlannerTool } from '../../src/tools/ProfilePlannerTool.js';
import { ProfileManager } from '../../src/ProfileManager.js';
import { createMockResourceManager, createMockLLMClient, testProfile, mockPlanResponse } from '../utils/mocks.js';

describe('ProfilePlannerTool', () => {
  let tool;
  let mockResourceManager;
  let mockProfileManager;
  let mockLLMClient;
  let mockPlanner;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockResourceManager = createMockResourceManager();
    mockLLMClient = createMockLLMClient();
    
    // Mock ProfileManager
    mockProfileManager = {
      initialize: jest.fn(),
      prepareProfile: jest.fn(),
      createPlanningContext: jest.fn(),
      listProfiles: jest.fn(),
      getProfile: jest.fn()
    };
    
    // Mock GenericPlanner
    mockPlanner = {
      createPlan: jest.fn()
    };
    
    tool = new ProfilePlannerTool({ resourceManager: mockResourceManager });
    
    // Replace the real ProfileManager with our mock
    tool.profileManager = mockProfileManager;
    
    // Mock the _createLLMClient method 
    tool._createLLMClient = jest.fn().mockResolvedValue(mockLLMClient);
  });

  describe('constructor', () => {
    test('should create tool with dependencies', () => {
      expect(tool.resourceManager).toBe(mockResourceManager);
      expect(tool.initialized).toBe(false);
    });
  });

  describe('initialize', () => {
    test('should initialize ProfileManager', async () => {
      await tool.initialize();
      
      expect(mockProfileManager.initialize).toHaveBeenCalled();
      expect(tool.initialized).toBe(true);
    });

    test('should not initialize twice', async () => {
      await tool.initialize();
      await tool.initialize();
      
      expect(mockProfileManager.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAllToolDescriptions', () => {
    test('should return all tool descriptions', () => {
      const descriptions = tool.getAllToolDescriptions();
      
      expect(descriptions).toHaveLength(3);
      expect(descriptions[0].function.name).toBe('plan_with_profile');
      expect(descriptions[1].function.name).toBe('profile_list');
      expect(descriptions[2].function.name).toBe('profile_info');
    });

    test('should have correct parameter schemas', () => {
      const descriptions = tool.getAllToolDescriptions();
      
      const planWithProfile = descriptions[0];
      expect(planWithProfile.function.parameters.properties).toHaveProperty('profile');
      expect(planWithProfile.function.parameters.properties).toHaveProperty('task');
      expect(planWithProfile.function.parameters.properties).toHaveProperty('saveAs');
      expect(planWithProfile.function.parameters.required).toEqual(['profile', 'task']);
      
      const profileInfo = descriptions[2];
      expect(profileInfo.function.parameters.properties).toHaveProperty('profile');
      expect(profileInfo.function.parameters.required).toEqual(['profile']);
    });
  });

  describe('invoke', () => {
    beforeEach(async () => {
      await tool.initialize();
    });

    test('should handle string arguments', async () => {
      const toolCall = {
        function: {
          name: 'profile_list',
          arguments: '{}'
        }
      };

      mockProfileManager.listProfiles.mockReturnValue([]);

      const result = await tool.invoke(toolCall);
      
      expect(result.success).toBe(true);
    });

    test('should handle object arguments', async () => {
      const toolCall = {
        function: {
          name: 'profile_list',
          arguments: {}
        }
      };

      mockProfileManager.listProfiles.mockReturnValue([]);

      const result = await tool.invoke(toolCall);
      
      expect(result.success).toBe(true);
    });

    test('should handle invalid JSON arguments', async () => {
      const toolCall = {
        function: {
          name: 'profile_list',
          arguments: 'invalid json'
        }
      };

      const result = await tool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid arguments');
    });

    test('should handle unknown function', async () => {
      const toolCall = {
        function: {
          name: 'unknown_function',
          arguments: '{}'
        }
      };

      const result = await tool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown function: unknown_function');
    });
  });

  describe('_planWithProfile', () => {
    beforeEach(async () => {
      await tool.initialize();
    });

    test('should create plan successfully', async () => {
      const args = {
        profile: 'javascript',
        task: 'Create a calculator function'
      };

      // Setup mocks
      mockProfileManager.prepareProfile.mockResolvedValue(testProfile);
      mockProfileManager.createPlanningContext.mockReturnValue({
        description: 'Test context',
        allowableActions: testProfile.allowableActions,
        maxSteps: 20
      });

      const mockPlan = {
        id: 'test-plan-123',
        toJSON: jest.fn().mockReturnValue(mockPlanResponse)
      };
      mockPlanner.createPlan.mockResolvedValue(mockPlan);
      
      // Mock GenericPlanner constructor
      const mockGenericPlannerConstructor = jest.fn().mockImplementation(() => mockPlanner);
      tool.GenericPlanner = mockGenericPlannerConstructor;

      const result = await tool._planWithProfile(args);

      expect(result.success).toBe(true);
      expect(result.profile).toBe('javascript');
      expect(result.plan).toEqual(mockPlanResponse);
      expect(result.planId).toBe('test-plan-123');
      expect(result).toHaveProperty('createdAt');
      expect(result.note).toContain('Make sure to load required modules first: test-module');
    });

    test('should handle profile not found', async () => {
      const args = {
        profile: 'nonexistent',
        task: 'Create something'
      };

      mockProfileManager.prepareProfile.mockResolvedValue(null);

      const result = await tool._planWithProfile(args);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Profile 'nonexistent' not found");
    });

    test('should handle planning errors', async () => {
      const args = {
        profile: 'javascript',
        task: 'Create a calculator function'
      };

      mockProfileManager.prepareProfile.mockResolvedValue(testProfile);
      mockProfileManager.createPlanningContext.mockReturnValue({
        description: 'Test context',
        allowableActions: testProfile.allowableActions,
        maxSteps: 20
      });
      mockPlanner.createPlan.mockRejectedValue(new Error('Planning failed'));

      const result = await tool._planWithProfile(args);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Planning failed: Planning failed');
    });

    test('should handle saveAs parameter', async () => {
      const args = {
        profile: 'javascript',
        task: 'Create a calculator function',
        saveAs: 'my-plan'
      };

      mockProfileManager.prepareProfile.mockResolvedValue(testProfile);
      mockProfileManager.createPlanningContext.mockReturnValue({
        description: 'Test context',
        allowableActions: testProfile.allowableActions,
        maxSteps: 20
      });

      const mockPlan = {
        id: 'test-plan-123',
        toJSON: jest.fn().mockReturnValue(mockPlanResponse)
      };
      mockPlanner.createPlan.mockResolvedValue(mockPlan);

      const result = await tool._planWithProfile(args);

      expect(result.success).toBe(true);
      expect(result.savedAs).toBe('my-plan');
      expect(result.saveNote).toContain('context saving not yet implemented');
    });
  });

  describe('_profileList', () => {
    beforeEach(async () => {
      await tool.initialize();
    });

    test('should return profile list', async () => {
      const mockProfiles = [
        { name: 'javascript', description: 'JS profile', actionCount: 5 },
        { name: 'python', description: 'Python profile', actionCount: 3 }
      ];

      mockProfileManager.listProfiles.mockReturnValue(mockProfiles);

      const result = await tool._profileList({});

      expect(result.success).toBe(true);
      expect(result.data.profiles).toEqual(mockProfiles);
      expect(result.data.count).toBe(2);
      expect(result.data.available).toEqual(['javascript', 'python']);
      expect(result.data.usage).toContain('Use plan_with_profile');
    });

    test('should handle errors', async () => {
      mockProfileManager.listProfiles.mockImplementation(() => {
        throw new Error('List failed');
      });

      const result = await tool._profileList({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to list profiles: List failed');
    });
  });

  describe('_profileInfo', () => {
    beforeEach(async () => {
      await tool.initialize();
    });

    test('should return profile information', async () => {
      const args = { profile: 'javascript' };

      mockProfileManager.getProfile.mockReturnValue(testProfile);

      const result = await tool._profileInfo(args);

      expect(result.success).toBe(true);
      expect(result.data.profile.name).toBe('test-profile');
      expect(result.data.profile.description).toBe('A test profile for unit testing');
      expect(result.data.profile.requiredModules).toEqual(['test-module']);
      expect(result.data.usage).toContain('plan_with_profile test-profile');
    });

    test('should handle profile not found', async () => {
      const args = { profile: 'nonexistent' };

      mockProfileManager.getProfile.mockReturnValue(null);

      const result = await tool._profileInfo(args);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Profile 'nonexistent' not found");
    });
  });

  describe('_createLLMClient', () => {
    beforeEach(async () => {
      await tool.initialize();
    });

    test('should return existing LLM client', async () => {
      const existingClient = { provider: 'anthropic' };
      mockResourceManager.get.mockReturnValueOnce(existingClient);

      const client = await tool._createLLMClient();

      expect(client).toBe(existingClient);
    });

    test('should create new LLM client', async () => {
      // First call throws (no existing client), second call returns API key
      mockResourceManager.get
        .mockImplementationOnce(() => { throw new Error('Not found'); })
        .mockReturnValueOnce('test-api-key');

      const client = await tool._createLLMClient();

      expect(LLMClient).toHaveBeenCalledWith({
        provider: 'anthropic',
        apiKey: 'test-api-key'
      });
      expect(mockResourceManager.register).toHaveBeenCalledWith('llmClient', client);
    });

    test('should throw error if API key not found', async () => {
      mockResourceManager.get.mockImplementation(() => { 
        throw new Error('Not found'); 
      });

      await expect(tool._createLLMClient()).rejects.toThrow('ANTHROPIC_API_KEY not found');
    });
  });
});