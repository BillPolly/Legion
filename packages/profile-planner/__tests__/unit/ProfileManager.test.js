/**
 * Unit tests for ProfileManager
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ProfileManager } from '../../src/ProfileManager.js';
import { createMockResourceManager, testProfile } from '../utils/mocks.js';

describe('ProfileManager', () => {
  let profileManager;
  let mockResourceManager;

  beforeEach(() => {
    mockResourceManager = createMockResourceManager();
    profileManager = new ProfileManager(mockResourceManager);
  });

  describe('constructor', () => {
    test('should create ProfileManager with resource manager', () => {
      expect(profileManager.resourceManager).toBe(mockResourceManager);
      expect(profileManager.profiles).toBeInstanceOf(Map);
      expect(profileManager.initialized).toBe(false);
    });
  });

  describe('registerProfile', () => {
    test('should register a valid profile', async () => {
      await profileManager.registerProfile(testProfile);
      
      expect(profileManager.profiles.has('test-profile')).toBe(true);
      expect(profileManager.getProfile('test-profile')).toEqual(testProfile);
    });

    test('should reject invalid profile - missing name', async () => {
      const invalidProfile = { ...testProfile };
      delete invalidProfile.name;

      await expect(profileManager.registerProfile(invalidProfile))
        .rejects.toThrow('Profile must have a string name');
    });

    test('should reject invalid profile - missing description', async () => {
      const invalidProfile = { ...testProfile };
      delete invalidProfile.description;

      await expect(profileManager.registerProfile(invalidProfile))
        .rejects.toThrow('Profile must have a string description');
    });

    test('should reject invalid profile - non-array requiredModules', async () => {
      const invalidProfile = { ...testProfile, requiredModules: 'not-array' };

      await expect(profileManager.registerProfile(invalidProfile))
        .rejects.toThrow('requiredModules must be an array');
    });

    test('should reject invalid profile - non-array allowableActions', async () => {
      const invalidProfile = { ...testProfile, allowableActions: 'not-array' };

      await expect(profileManager.registerProfile(invalidProfile))
        .rejects.toThrow('allowableActions must be an array');
    });

    test('should reject invalid profile - action missing type', async () => {
      const invalidProfile = {
        ...testProfile,
        allowableActions: [{ inputs: [], outputs: [] }]
      };

      await expect(profileManager.registerProfile(invalidProfile))
        .rejects.toThrow('allowableActions[0] must have a string type');
    });

    test('should reject invalid profile - non-array contextPrompts', async () => {
      const invalidProfile = { ...testProfile, contextPrompts: 'not-array' };

      await expect(profileManager.registerProfile(invalidProfile))
        .rejects.toThrow('contextPrompts must be an array');
    });

    test('should reject invalid profile - invalid maxSteps', async () => {
      const invalidProfile = { ...testProfile, maxSteps: -1 };

      await expect(profileManager.registerProfile(invalidProfile))
        .rejects.toThrow('maxSteps must be a positive number');
    });
  });

  describe('getProfile', () => {
    beforeEach(async () => {
      await profileManager.registerProfile(testProfile);
    });

    test('should return profile by name', () => {
      const profile = profileManager.getProfile('test-profile');
      expect(profile).toEqual(testProfile);
    });

    test('should return null for non-existent profile', () => {
      const profile = profileManager.getProfile('non-existent');
      expect(profile).toBe(null);
    });
  });

  describe('listProfiles', () => {
    beforeEach(async () => {
      await profileManager.registerProfile(testProfile);
      await profileManager.registerProfile({
        ...testProfile,
        name: 'another-profile',
        toolName: 'another_profile_planner',
        description: 'Another test profile',
        allowableActions: [
          { type: 'action1', inputs: {}, outputs: {}, description: 'Action 1' },
          { type: 'action2', inputs: {}, outputs: {}, description: 'Action 2' }
        ]
      });
    });

    test('should return list of profile summaries', () => {
      const profiles = profileManager.listProfiles();
      
      expect(profiles).toHaveLength(2);
      expect(profiles[0]).toEqual({
        name: 'test-profile',
        description: 'A test profile for unit testing',
        requiredModules: ['test-module'],
        actionCount: 1
      });
      expect(profiles[1]).toEqual({
        name: 'another-profile',
        description: 'Another test profile',
        requiredModules: ['test-module'],
        actionCount: 2
      });
    });
  });

  describe('prepareProfile', () => {
    beforeEach(async () => {
      await profileManager.registerProfile(testProfile);
    });

    test('should prepare existing profile', async () => {
      const prepared = await profileManager.prepareProfile('test-profile');
      
      expect(prepared.name).toBe('test-profile');
      expect(prepared.description).toBe('A test profile for unit testing');
      expect(prepared).toHaveProperty('preparedAt');
    });

    test('should throw error for non-existent profile', async () => {
      await expect(profileManager.prepareProfile('non-existent'))
        .rejects.toThrow("Profile 'non-existent' not found");
    });
  });

  describe('createPlanningContext', () => {
    test('should create planning context from profile', () => {
      const profile = {
        ...testProfile,
        contextPrompts: ['Context 1', 'Context 2'],
        defaultInputs: ['input1', 'input2'],
        defaultOutputs: ['output1'],
        maxSteps: 15
      };

      const context = profileManager.createPlanningContext(profile, 'Test task');

      expect(context).toEqual({
        description: 'Context 1\nContext 2\n\nTask: Test task',
        inputs: ['input1', 'input2'],
        requiredOutputs: ['output1'],
        allowableActions: [
          {
            type: 'test_action',
            description: 'A test action',
            inputs: ['input1'],
            outputs: ['output1']
          }
        ],
        maxSteps: 15,
        initialInputData: {
          user_request: 'Test task',
          profile_context: 'Context 1\nContext 2'
        }
      });
    });

    test('should use defaults when profile properties are missing', () => {
      const minimalProfile = {
        name: 'minimal',
        description: 'Minimal profile'
      };

      const context = profileManager.createPlanningContext(minimalProfile, 'Test task');

      expect(context).toEqual({
        description: 'Test task',
        inputs: ['user_request'],
        requiredOutputs: ['completed_task'],
        allowableActions: [],
        maxSteps: 20,
        initialInputData: {
          user_request: 'Test task',
          profile_context: ''
        }
      });
    });
  });

  describe('validateProfile', () => {
    test('should validate a correct profile', () => {
      const validation = profileManager.validateProfile(testProfile);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    test('should collect all validation errors', () => {
      const invalidProfile = {
        name: 123, // Should be string
        description: null, // Should be string
        requiredModules: 'not-array', // Should be array
        allowableActions: 'not-array', // Should be array
        contextPrompts: 'not-array', // Should be array
        maxSteps: -5 // Should be positive
      };

      const validation = profileManager.validateProfile(invalidProfile);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Profile must have a string name');
      expect(validation.errors).toContain('Profile must have a string description');
      expect(validation.errors).toContain('requiredModules must be an array');
      expect(validation.errors).toContain('allowableActions must be an array and is required');
      expect(validation.errors).toContain('contextPrompts must be an array');
      expect(validation.errors).toContain('maxSteps must be a positive number');
    });
  });

  describe('initialize', () => {
    test('should initialize successfully', async () => {
      await profileManager.initialize();
      
      expect(profileManager.initialized).toBe(true);
    });

    test('should not initialize twice', async () => {
      await profileManager.initialize();
      expect(profileManager.initialized).toBe(true);
      
      // Call again
      await profileManager.initialize();
      expect(profileManager.initialized).toBe(true);
    });
  });
});