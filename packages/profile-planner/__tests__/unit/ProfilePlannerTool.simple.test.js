/**
 * Simplified unit tests for ProfilePlannerTool
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ProfilePlannerTool } from '../../src/tools/ProfilePlannerTool.js';
import { createMockResourceManager, testProfile, mockPlanResponse } from '../utils/mocks.js';

describe('ProfilePlannerTool (Simplified)', () => {
  let tool;
  let mockResourceManager;

  beforeEach(() => {
    mockResourceManager = createMockResourceManager();
    tool = new ProfilePlannerTool({ resourceManager: mockResourceManager });
  });

  describe('constructor', () => {
    test('should create tool with dependencies', () => {
      expect(tool.resourceManager).toBe(mockResourceManager);
      expect(tool.name).toBe('profile_planner');
      expect(tool.description).toContain('Profile-based planning');
      expect(tool.initialized).toBe(false);
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
    test('should handle string arguments', async () => {
      // Mock profile manager
      const mockProfileManager = {
        listProfiles: jest.fn().mockReturnValue([])
      };
      tool.profileManager = mockProfileManager;
      tool.initialized = true;

      const toolCall = {
        function: {
          name: 'profile_list',
          arguments: '{}'
        }
      };

      const result = await tool.invoke(toolCall);
      
      expect(result.success).toBe(true);
    });

    test('should handle object arguments', async () => {
      // Mock profile manager
      const mockProfileManager = {
        listProfiles: jest.fn().mockReturnValue([])
      };
      tool.profileManager = mockProfileManager;
      tool.initialized = true;

      const toolCall = {
        function: {
          name: 'profile_list',
          arguments: {}
        }
      };

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

  describe('_profileList', () => {
    test('should return profile list', async () => {
      const mockProfiles = [
        { name: 'javascript', description: 'JS profile', actionCount: 5 },
        { name: 'python', description: 'Python profile', actionCount: 3 }
      ];

      // Mock profile manager
      const mockProfileManager = {
        listProfiles: jest.fn().mockReturnValue(mockProfiles)
      };
      tool.profileManager = mockProfileManager;
      tool.initialized = true;

      const result = await tool._profileList({});

      expect(result.success).toBe(true);
      expect(result.data.profiles).toEqual(mockProfiles);
      expect(result.data.count).toBe(2);
      expect(result.data.available).toEqual(['javascript', 'python']);
      expect(result.data.usage).toContain('Use plan_with_profile');
    });

    test('should handle errors', async () => {
      // Mock profile manager
      const mockProfileManager = {
        listProfiles: jest.fn(() => {
          throw new Error('List failed');
        })
      };
      tool.profileManager = mockProfileManager;
      tool.initialized = true;

      const result = await tool._profileList({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to list profiles: List failed');
    });
  });

  describe('_profileInfo', () => {
    test('should return profile information', async () => {
      const args = { profile: 'test-profile' };

      // Mock profile manager
      const mockProfileManager = {
        getProfile: jest.fn().mockReturnValue(testProfile)
      };
      tool.profileManager = mockProfileManager;
      tool.initialized = true;

      const result = await tool._profileInfo(args);

      expect(result.success).toBe(true);
      expect(result.data.profile.name).toBe('test-profile');
      expect(result.data.profile.description).toBe('A test profile for unit testing');
      expect(result.data.profile.requiredModules).toEqual(['test-module']);
      expect(result.data.usage).toContain('plan_with_profile test-profile');
    });

    test('should handle profile not found', async () => {
      const args = { profile: 'nonexistent' };

      // Mock profile manager
      const mockProfileManager = {
        getProfile: jest.fn().mockReturnValue(null)
      };
      tool.profileManager = mockProfileManager;
      tool.initialized = true;

      const result = await tool._profileInfo(args);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Profile 'nonexistent' not found");
    });
  });

  describe('initialize', () => {
    test('should initialize successfully', async () => {
      await tool.initialize();
      
      expect(tool.initialized).toBe(true);
      expect(tool.profileManager).toBeDefined();
    });

    test('should not initialize twice', async () => {
      await tool.initialize();
      expect(tool.initialized).toBe(true);
      
      // Call again
      await tool.initialize();
      expect(tool.initialized).toBe(true);
    });
  });
});