/**
 * Integration tests for ProfilePlannerModule with Legion module loader
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ResourceManager, ModuleFactory } from '@legion/module-loader';
import { ProfilePlannerModule } from '../../src/ProfilePlannerModule.js';

describe('ProfilePlannerModule Integration', () => {
  let resourceManager;
  let moduleFactory;
  let module;

  beforeEach(async () => {
    // Create real ResourceManager for integration testing
    resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Register test API key
    resourceManager.register('env.ANTHROPIC_API_KEY', 'test-anthropic-key');

    // Create module factory
    moduleFactory = new ModuleFactory(resourceManager);
  });

  afterEach(async () => {
    if (module) {
      await module.cleanup();
    }
  });

  describe('Module Creation', () => {
    test('should create module via factory', () => {
      module = moduleFactory.createModule(ProfilePlannerModule);
      
      expect(module).toBeInstanceOf(ProfilePlannerModule);
      expect(module.name).toBe('ProfilePlannerModule');
      expect(module.dependencies).toBeDefined();
      expect(module.dependencies.resourceManager).toBe(resourceManager);
    });

    test('should initialize module successfully', async () => {
      module = moduleFactory.createModule(ProfilePlannerModule);
      
      await module.initialize();
      
      expect(module.initialized).toBe(true);
    });
  });

  describe('Tool Registration', () => {
    beforeEach(() => {
      module = moduleFactory.createModule(ProfilePlannerModule);
    });

    test('should provide tools after initialization', async () => {
      await module.initialize();
      
      const tools = module.getTools();
      
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('profile_planner');
      expect(tools[0].description).toContain('Profile-based planning');
    });

    test('should provide multiple tool descriptions', async () => {
      await module.initialize();
      
      const tools = module.getTools();
      const tool = tools[0];
      const descriptions = tool.getAllToolDescriptions();
      
      expect(descriptions).toHaveLength(3);
      expect(descriptions.map(d => d.function.name)).toEqual([
        'plan_with_profile',
        'profile_list', 
        'profile_info'
      ]);
    });
  });

  describe('Tool Invocation via Module', () => {
    beforeEach(async () => {
      module = moduleFactory.createModule(ProfilePlannerModule);
      await module.initialize();
    });

    test('should invoke profile_list successfully', async () => {
      const tools = module.getTools();
      const tool = tools[0];

      const result = await tool.invoke({
        function: {
          name: 'profile_list',
          arguments: '{}'
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.profiles).toBeInstanceOf(Array);
      expect(result.data.count).toBe(1); // Should have javascript profile
      expect(result.data.available).toContain('javascript');
    });

    test('should invoke profile_info successfully', async () => {
      const tools = module.getTools();
      const tool = tools[0];

      const result = await tool.invoke({
        function: {
          name: 'profile_info',
          arguments: JSON.stringify({ profile: 'javascript' })
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.profile.name).toBe('javascript');
      expect(result.data.profile.description).toContain('JavaScript');
      expect(result.data.profile.requiredModules).toBeInstanceOf(Array);
      expect(result.data.usage).toContain('plan_with_profile javascript');
    });

    test('should handle invalid profile gracefully', async () => {
      const tools = module.getTools();
      const tool = tools[0];

      const result = await tool.invoke({
        function: {
          name: 'profile_info',
          arguments: JSON.stringify({ profile: 'nonexistent' })
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Profile 'nonexistent' not found");
    });

    test('should handle malformed JSON arguments', async () => {
      const tools = module.getTools();
      const tool = tools[0];

      const result = await tool.invoke({
        function: {
          name: 'profile_list',
          arguments: 'invalid json'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid arguments');
    });
  });

  describe('Resource Management', () => {
    beforeEach(async () => {
      module = moduleFactory.createModule(ProfilePlannerModule);
      await module.initialize();
    });

    test('should access resources through ResourceManager', async () => {
      // Verify the module can access registered resources
      const tools = module.getTools();
      const tool = tools[0];

      // This should work because we registered the API key
      expect(() => tool.resourceManager.get('env.ANTHROPIC_API_KEY')).not.toThrow();
    });

    test('should handle missing resources gracefully', async () => {
      const tools = module.getTools();
      const tool = tools[0];

      // Try to access a non-existent resource
      expect(() => tool.resourceManager.get('nonexistent.key')).toThrow();
    });
  });

  describe('Event System Integration', () => {
    beforeEach(async () => {
      module = moduleFactory.createModule(ProfilePlannerModule);
      await module.initialize();
    });

    test('should emit events during tool execution', async () => {
      const tools = module.getTools();
      const tool = tools[0];

      const events = [];
      tool.on('progress', (data) => events.push({ type: 'progress', data }));
      tool.on('info', (data) => events.push({ type: 'info', data }));

      await tool.invoke({
        function: {
          name: 'profile_list',
          arguments: '{}'
        }
      });

      // Should have emitted at least one event
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('Module Lifecycle', () => {
    test('should handle module cleanup', async () => {
      module = moduleFactory.createModule(ProfilePlannerModule);
      await module.initialize();
      
      expect(module.initialized).toBe(true);
      
      await module.cleanup();
      
      // After cleanup, module should still be valid but reset
      expect(module).toBeDefined();
    });

    test('should prevent double initialization', async () => {
      module = moduleFactory.createModule(ProfilePlannerModule);
      
      await module.initialize();
      expect(module.initialized).toBe(true);
      
      // Second initialization should not break anything
      await module.initialize();
      expect(module.initialized).toBe(true);
    });
  });

  describe('Schema Validation Integration', () => {
    beforeEach(async () => {
      module = moduleFactory.createModule(ProfilePlannerModule);
      await module.initialize();
    });

    test('should validate tool parameters against schema', async () => {
      const tools = module.getTools();
      const tool = tools[0];

      // Test with missing required parameter
      const result = await tool.invoke({
        function: {
          name: 'profile_info',
          arguments: JSON.stringify({}) // Missing 'profile' parameter
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('profile');
    });

    test('should accept valid parameters', async () => {
      const tools = module.getTools();
      const tool = tools[0];

      const result = await tool.invoke({
        function: {
          name: 'profile_info',
          arguments: JSON.stringify({ profile: 'javascript' })
        }
      });

      expect(result.success).toBe(true);
    });
  });
});