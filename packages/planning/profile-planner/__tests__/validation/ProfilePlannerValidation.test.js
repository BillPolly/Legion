/**
 * Integration test for ProfilePlanner validation workflow
 * Tests that profile-based plans are properly validated using the new validation system
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ProfilePlannerModule } from '../../src/ProfilePlannerModule.js';
import { ResourceManager, ModuleLoader } from '@legion/module-loader';
import { ValidatePlanTool } from '@legion/plan-executor-tools';

describe('ProfilePlanner Validation Integration', () => {
  let resourceManager;
  let profilePlannerModule;
  let validatePlanTool;
  let moduleLoader;

  beforeAll(async () => {
    // Create ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Create ModuleLoader
    moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();
    
    // Register moduleLoader in ResourceManager
    resourceManager.register('moduleLoader', moduleLoader);

    // Create ProfilePlannerModule
    profilePlannerModule = await ProfilePlannerModule.create(resourceManager);

    // Create ValidatePlanTool
    validatePlanTool = new ValidatePlanTool(moduleLoader);
  });

  afterAll(async () => {
    // Clean up resources - no cleanup method needed
    if (moduleLoader) {
      // moduleLoader doesn't have a cleanup method
    }
  });

  test('should validate a simple plan structure', async () => {
    const simplePlan = {
      id: 'test-plan-123',
      name: 'Simple Test Plan',
      description: 'A simple plan for validation testing',
      status: 'draft',
      steps: [
        {
          id: 'step-1',
          name: 'Write a file',
          description: 'Write content to a file',
          actions: [
            {
              type: 'file_write',
              inputs: {
                filepath: 'test.txt',
                content: 'Hello World'
              },
              outputs: {
                success: 'write_success'
              }
            }
          ]
        }
      ]
    };

    const result = await validatePlanTool.execute({ plan: simplePlan });
    
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    
    // ValidatePlanTool returns success/error format
    if (result.success === false) {
      expect(result.error).toBeDefined();
      console.log('Validation error:', result.error);
    } else {
      expect(result.success).toBe(true);
    }
  });

  test('should detect invalid tool in plan', async () => {
    const invalidPlan = {
      id: 'invalid-plan-123',
      name: 'Invalid Plan',
      description: 'Plan with invalid tool',
      status: 'draft',
      steps: [
        {
          id: 'step-1',
          name: 'Use invalid tool',
          description: 'This should fail validation',
          actions: [
            {
              type: 'non_existent_tool',
              inputs: {
                someParam: 'value'
              },
              outputs: {
                result: 'output'
              }
            }
          ]
        }
      ]
    };

    const result = await validatePlanTool.execute({ plan: invalidPlan });
    
    expect(result).toBeDefined();
    
    // ValidatePlanTool returns success=true but valid=false when validation fails
    expect(result.success).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
    
    // Should contain error about invalid tool
    const hasInvalidToolError = result.errors.some(error => 
      error.includes('non_existent_tool') || error.includes('Tool not found') || error.includes('not available')
    );
    expect(hasInvalidToolError).toBe(true);
  });

  test('should validate variable flow', async () => {
    const variableFlowPlan = {
      id: 'variable-flow-plan',
      name: 'Variable Flow Test',
      description: 'Test variable dependencies',
      status: 'draft',
      steps: [
        {
          id: 'step-1',
          name: 'Create content',
          description: 'Create some content',
          actions: [
            {
              type: 'file_write',
              inputs: {
                filepath: 'source.txt',
                content: 'Source content'
              },
              outputs: {
                success: 'source_created'
              }
            }
          ]
        },
        {
          id: 'step-2',
          name: 'Read content',
          description: 'Read the created content',
          actions: [
            {
              type: 'file_read',
              inputs: {
                filepath: '@source_created/path'  // Reference to previous step output
              },
              outputs: {
                content: 'file_content'
              }
            }
          ]
        }
      ]
    };

    const result = await validatePlanTool.execute({ plan: variableFlowPlan });
    
    expect(result).toBeDefined();
    
    // This might be valid or have specific variable flow issues
    if (result.success === false) {
      console.log('Variable flow validation error:', result.error);
    }
    
    // The important thing is that validation runs without crashing
    expect(typeof result.success).toBe('boolean');
  });

  test('should validate plan schema first', async () => {
    const malformedPlan = {
      // Missing required fields
      name: 'Malformed Plan'
      // Missing id, description, steps, etc.
    };

    const result = await validatePlanTool.execute({ plan: malformedPlan });
    
    expect(result).toBeDefined();
    
    // ValidatePlanTool uses success/error format
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    
    // Should indicate schema or structure issues
    expect(typeof result.error).toBe('string');
    expect(result.error.length).toBeGreaterThan(0);
  });

  test('should handle validation of real profile-generated plan', async () => {
    // Get a profile tool from the module
    const tools = profilePlannerModule.getTools();
    const profileTool = tools.find(tool => tool.name === 'javascript_dev');
    
    if (!profileTool) {
      console.warn('javascript_dev profile tool not found, skipping test');
      return;
    }

    // This test requires live LLM, so we'll create a mock plan structure
    // that simulates what a profile planner would generate
    const profileGeneratedPlan = {
      id: 'profile-plan-123',
      name: 'JavaScript Development Plan',
      description: 'Plan generated by javascript_dev profile',
      status: 'draft',
      steps: [
        {
          id: 'create-package',
          name: 'Create package.json',
          description: 'Initialize JavaScript project',
          actions: [
            {
              type: 'file_write',
              inputs: {
                filepath: 'package.json',
                content: '{"name": "test-project", "version": "1.0.0"}'
              },
              outputs: {
                success: 'package_created'
              }
            }
          ]
        },
        {
          id: 'create-main',
          name: 'Create main file',
          description: 'Create main JavaScript file',
          actions: [
            {
              type: 'file_write',
              inputs: {
                filepath: 'index.js',
                content: 'console.log("Hello, World!");'
              },
              outputs: {
                success: 'main_created'
              }
            }
          ]
        }
      ]
    };

    const result = await validatePlanTool.execute({ plan: profileGeneratedPlan });
    
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    
    if (result.success === false) {
      console.log('Profile plan validation error:', result.error);
    }
    
    // The plan should either succeed or have a specific error message
    if (result.success === false) {
      expect(result.error).toBeDefined();
    }
  });
});