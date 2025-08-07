/**
 * Live LLM integration tests for ProfilePlannerModule
 * These tests make actual API calls to test real LLM integration via the module task interface
 * 
 * Follows the patterns from LiveGitHubIntegration.test.js and CLAUDE.md guidelines
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach, jest } from '@jest/globals';
import { ResourceManager } from '@legion/tool-system';
import { ProfilePlannerModule } from '../../src/ProfilePlannerModule.js';

describe('ProfilePlannerModule Live LLM Tests', () => {
  let resourceManager;
  let module;

  beforeAll(async () => {
    // Create real ResourceManager - this automatically loads .env file
    resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Verify API key is available - FAIL if not (don't skip!)
    try {
      const apiKey = resourceManager.env.ANTHROPIC_API_KEY;
      
      if (!apiKey || apiKey === 'test-key') {
        throw new Error('ANTHROPIC_API_KEY is missing or set to test value. Live tests require real API key in .env file!');
      }
      console.log('✅ Live LLM testing enabled - found ANTHROPIC_API_KEY');
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new Error('ANTHROPIC_API_KEY not found in .env file. Live tests require real API key to be configured!');
      }
      throw error;
    }
  });

  beforeEach(async () => {
    // Use the async factory pattern as documented in CLAUDE.md
    module = await ProfilePlannerModule.create(resourceManager);
  });

  afterEach(async () => {
    if (module) {
      await module.cleanup();
    }
  });

  describe('Real LLM Plan Generation via Module Interface', () => {
    test('should generate plan for simple JavaScript task', async () => {
      // Get the profile planner tool from the module
      const tools = module.getTools();
      expect(tools).toHaveLength(1);
      const tool = tools[0];
      expect(tool.name).toBe('profile_planner');

      // Test via the module task interface
      const result = await tool.invoke({
        function: {
          name: 'plan_with_profile',
          arguments: JSON.stringify({
            profile: 'javascript',
            task: 'Create a simple calculator function that can add and subtract numbers'
          })
        }
      });

      expect(result.success).toBe(true);
      expect(result.profile).toBe('javascript');
      expect(result.plan).toBeDefined();
      expect(result.plan.name).toBeDefined();
      expect(result.plan.description).toBeDefined();
      expect(result.plan.steps).toBeInstanceOf(Array);
      expect(result.plan.steps.length).toBeGreaterThan(0);
      expect(result.planId).toBeDefined();
      expect(result.createdAt).toBeDefined();

      // Verify plan structure matches Legion planning format
      const firstStep = result.plan.steps[0];
      expect(firstStep).toHaveProperty('id');
      expect(firstStep).toHaveProperty('name');
      expect(firstStep).toHaveProperty('type');
      expect(firstStep).toHaveProperty('actions');
      expect(firstStep.actions).toBeInstanceOf(Array);

      // Verify actions have proper structure for Legion tools
      if (firstStep.actions.length > 0) {
        const firstAction = firstStep.actions[0];
        expect(firstAction).toHaveProperty('type');
        expect(firstAction).toHaveProperty('parameters');
      }

      console.log(`✅ Generated plan: ${result.plan.name} with ${result.plan.steps.length} steps`);
    }, 30000); // 30 second timeout for LLM calls

    test('should generate plan for file creation task', async () => {
      // Get the profile planner tool from the module
      const tools = module.getTools();
      const tool = tools[0];

      const result = await tool.invoke({
        function: {
          name: 'plan_with_profile',
          arguments: JSON.stringify({
            profile: 'javascript',
            task: 'Create a utility function to format dates and write tests for it'
          })
        }
      });

      expect(result.success).toBe(true);
      expect(result.plan.steps).toBeInstanceOf(Array);

      // Should include file creation and testing steps
      const stepNames = result.plan.steps.map(step => step.name.toLowerCase());
      const hasFileCreation = stepNames.some(name => 
        name.includes('create') || name.includes('implement') || name.includes('write')
      );
      const hasTesting = stepNames.some(name => 
        name.includes('test') || name.includes('spec')
      );

      expect(hasFileCreation).toBe(true);
      expect(hasTesting).toBe(true);
    }, 30000);

    test('should generate plan with saveAs parameter', async () => {
      // Get the profile planner tool from the module
      const tools = module.getTools();
      const tool = tools[0];

      const result = await tool.invoke({
        function: {
          name: 'plan_with_profile',
          arguments: JSON.stringify({
            profile: 'javascript',
            task: 'Create a simple string validation library',
            saveAs: 'validation-plan'
          })
        }
      });

      expect(result.success).toBe(true);
      expect(result.savedAs).toBe('validation-plan');
      expect(result.saveNote).toContain('context saving not yet implemented');
    }, 30000);

    test('should handle complex multi-step task', async () => {
      // Get the profile planner tool from the module
      const tools = module.getTools();
      const tool = tools[0];

      const result = await tool.invoke({
        function: {
          name: 'plan_with_profile',
          arguments: JSON.stringify({
            profile: 'javascript',
            task: 'Build a REST API endpoint for user authentication with JWT tokens, including input validation, password hashing, and comprehensive error handling'
          })
        }
      });

      expect(result.success).toBe(true);
      expect(result.plan.steps.length).toBeGreaterThan(2); // Should be multiple steps
      
      // Check for logical step progression
      const stepTypes = result.plan.steps.map(step => step.type);
      expect(stepTypes).toContain('implementation');
      
      // Verify dependencies exist for multi-step plans
      const stepsWithDeps = result.plan.steps.filter(step => 
        step.dependencies && step.dependencies.length > 0
      );
      expect(stepsWithDeps.length).toBeGreaterThan(0);
    }, 45000); // Longer timeout for complex tasks
  });

  describe('LLM Error Handling', () => {
    test('should handle vague task descriptions gracefully', async () => {
      // Get the profile planner tool from the module
      const tools = module.getTools();
      const tool = tools[0];

      const result = await tool.invoke({
        function: {
          name: 'plan_with_profile',
          arguments: JSON.stringify({
            profile: 'javascript',
            task: 'do something'
          })
        }
      });

      // Even with vague input, should generate some plan
      expect(result.success).toBe(true);
      expect(result.plan.steps.length).toBeGreaterThan(0);
    }, 30000);

    test('should handle task requiring unavailable tools', async () => {
      // Get the profile planner tool from the module
      const tools = module.getTools();
      const tool = tools[0];

      const result = await tool.invoke({
        function: {
          name: 'plan_with_profile',
          arguments: JSON.stringify({
            profile: 'javascript', 
            task: 'Deploy a Kubernetes cluster and configure load balancing'
          })
        }
      });

      // Should still generate a plan, even if some steps might not be executable
      expect(result.success).toBe(true);
      expect(result.plan).toBeDefined();
    }, 30000);
  });

  describe('Profile Integration with LLM', () => {
    test('should respect profile context in plan generation', async () => {
      // Get the profile planner tool from the module
      const tools = module.getTools();
      const tool = tools[0];

      const result = await tool.invoke({
        function: {
          name: 'plan_with_profile',
          arguments: JSON.stringify({
            profile: 'javascript',
            task: 'Create a data processing script'
          })
        }
      });

      expect(result.success).toBe(true);
      
      // Should reference JavaScript-specific actions
      const allActions = result.plan.steps.flatMap(step => step.actions);
      const actionTypes = allActions.map(action => action.type);
      
      // Should contain JavaScript-related action types
      const hasJSActions = actionTypes.some(type => 
        type.includes('js') || 
        type.includes('javascript') ||
        type.includes('npm') ||
        type.includes('node')
      );
      
      expect(hasJSActions).toBe(true);
    }, 30000);

    test('should include profile notes in response', async () => {
      // Get the profile planner tool from the module
      const tools = module.getTools();
      const tool = tools[0];

      const result = await tool.invoke({
        function: {
          name: 'plan_with_profile',
          arguments: JSON.stringify({
            profile: 'javascript',
            task: 'Build a web scraper'
          })
        }
      });

      expect(result.success).toBe(true);
      expect(result.note).toBeDefined();
      expect(result.note).toContain('Make sure to load required modules first');
    }, 30000);
  });

  describe('LLM Response Validation', () => {
    test('should validate LLM response against expected schema', async () => {
      // Get the profile planner tool from the module
      const tools = module.getTools();
      const tool = tools[0];

      const result = await tool.invoke({
        function: {
          name: 'plan_with_profile',
          arguments: JSON.stringify({
            profile: 'javascript',
            task: 'Create a config parser'
          })
        }
      });

      expect(result.success).toBe(true);
      
      // Validate plan structure matches expected schema
      expect(result.plan).toMatchObject({
        name: expect.any(String),
        description: expect.any(String),
        steps: expect.any(Array)
      });

      // Validate each step has required fields
      result.plan.steps.forEach((step, index) => {
        expect(step).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          type: expect.any(String),
          actions: expect.any(Array)
        });

        // Validate actions
        step.actions.forEach((action, actionIndex) => {
          expect(action).toMatchObject({
            type: expect.any(String),
            parameters: expect.any(Object)
          });
        });
      });
    }, 30000);

    test('should handle unexpected LLM response format', async () => {
      // Mock a malformed response to test error handling
      const tools = module.getTools();
      const originalTool = tools[0];
      
      // Mock the LLM client to return malformed data
      const mockLLMClient = {
        completeWithStructuredResponse: jest.fn().mockResolvedValue({
          // Missing required fields
          invalid: 'response'
        })
      };
      
      // Temporarily replace the LLM client
      const originalCreateClient = originalTool._createLLMClient;
      originalTool._createLLMClient = jest.fn().mockResolvedValue(mockLLMClient);

      const result = await originalTool.invoke({
        function: {
          name: 'plan_with_profile',
          arguments: JSON.stringify({
            profile: 'javascript',
            task: 'Create something'
          })
        }
      });

      // Should handle gracefully
      expect(result.success).toBe(false);
      expect(result.error).toContain('Planning failed');

      // Restore original method
      originalTool._createLLMClient = originalCreateClient;
    }, 10000);
  });

  describe('Performance and Reliability', () => {
    test('should complete within reasonable time', async () => {
      // Get the profile planner tool from the module
      const tools = module.getTools();
      const tool = tools[0];

      const startTime = Date.now();
      
      const result = await tool.invoke({
        function: {
          name: 'plan_with_profile',
          arguments: JSON.stringify({
            profile: 'javascript',
            task: 'Create a simple logger utility'
          })
        }
      });

      const duration = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(25000); // Should complete in under 25 seconds
    }, 30000);

    test('should be consistent across multiple calls', async () => {
      // Get the profile planner tool from the module
      const tools = module.getTools();
      const tool = tools[0];

      const task = 'Create a basic email validator function';
      const results = [];

      // Make multiple calls with same task
      for (let i = 0; i < 2; i++) {
        const result = await tool.invoke({
          function: {
            name: 'plan_with_profile',
            arguments: JSON.stringify({
              profile: 'javascript',
              task
            })
          }
        });
        
        expect(result.success).toBe(true);
        results.push(result);
      }

      // All should succeed
      expect(results.every(r => r.success)).toBe(true);
      
      // All should have valid plan structures
      expect(results.every(r => r.plan && r.plan.steps && r.plan.steps.length > 0)).toBe(true);
    }, 60000);
  });
});

// Separate describe block for tests that run when no API key is available
describe('ProfilePlannerModule Live LLM Tests - No API Key', () => {
  const noApiKey = !process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'test-key';
  
  if (noApiKey) {
    test('should skip live tests when no API key available', () => {
      console.log('Skipping live LLM tests - no ANTHROPIC_API_KEY found');
      expect(true).toBe(true);
    });
  }
});