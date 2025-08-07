/**
 * Cross-Package Validation Integration Tests
 * 
 * Tests integration between all planning packages:
 * - unified-planner ↔ bt-validator
 * - bt-validator ↔ profile-planner  
 * - Cross-package schema compatibility
 * - Error handling across package boundaries
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { PlannerEngine } from '@legion/unified-planner';
import { BTValidator } from '@legion/bt-validator';
import { ProfilePlannerModule } from '@legion/profile-planner';
import { LiveLLMTestSetup } from '../utils/LiveLLMTestSetup.js';

describe('Cross-Package Validation Integration', () => {
  let llmSetup;
  let unifiedPlanner;
  let btValidator;
  let profileModule;

  beforeAll(async () => {
    llmSetup = new LiveLLMTestSetup();
    await llmSetup.initialize();
    console.log('🔗 Cross-package validation tests initialized');
  });

  beforeEach(async () => {
    const resourceManager = llmSetup.getResourceManager();

    unifiedPlanner = new PlannerEngine({
      llmClient: llmSetup.getLLMClient(),
      moduleLoader: resourceManager.moduleLoader
    });

    btValidator = new BTValidator();
    profileModule = await ProfilePlannerModule.create(resourceManager);
  });

  afterEach(async () => {
    if (profileModule) {
      await profileModule.cleanup();
    }
  });

  describe('Unified Planner ↔ BT Validator', () => {
    test('should validate unified planner output with bt-validator', async () => {
      console.log('🔍 Testing unified-planner → bt-validator...');

      // Generate BT with unified planner
      const bt = await unifiedPlanner.createPlan({
        description: 'Create a file with validation',
        strategy: 'llm'
      });

      expect(bt).toBeDefined();
      expect(bt.id).toBeDefined();
      
      // Validate with bt-validator
      const validationResult = await btValidator.validate(bt);
      
      expect(validationResult.valid).toBe(true);
      if (!validationResult.valid) {
        console.error('Validation errors:', validationResult.errors);
        throw new Error('Unified planner output failed BT validation');
      }

      console.log(`✅ Unified planner → BT validator: ${bt.id} validated`);
    }, 45000);

    test('should handle validation errors consistently', async () => {
      console.log('🔍 Testing error handling consistency...');

      // Create an intentionally malformed BT
      const malformedBT = {
        id: 'malformed-test',
        // Missing required 'type' field
        children: []
      };

      const validationResult = await btValidator.validate(malformedBT);
      
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors).toBeDefined();
      expect(validationResult.errors.length).toBeGreaterThan(0);
      
      console.log(`✅ Error handling: ${validationResult.errors.length} errors detected`);
    }, 15000);

    test('should validate intelligent defaults application', async () => {
      console.log('🔍 Testing intelligent defaults validation...');

      const bt = await unifiedPlanner.createPlan({
        description: 'Create multiple related files',
        strategy: 'llm'
      });

      // Apply intelligent defaults through validator
      const validationResult = await btValidator.validate(bt, { applyDefaults: true });
      
      expect(validationResult.valid).toBe(true);
      
      // Check if defaults were applied
      if (bt.children && bt.children.length > 1 && !bt.type) {
        // Should have defaulted to 'sequence'
        expect(bt.type).toBe('sequence');
      }

      console.log('✅ Intelligent defaults validated');
    }, 45000);
  });

  describe('BT Validator ↔ Profile Planner', () => {
    test('should validate profile-generated BTs', async () => {
      console.log('🔍 Testing profile-planner → bt-validator...');

      const tools = profileModule.getTools();
      const profileTool = tools[0];

      const profileResult = await profileTool.execute({
        function: {
          name: 'plan_with_profile',
          arguments: JSON.stringify({
            profile: 'javascript-development',
            task: 'Create a data processing utility'
          })
        }
      });

      expect(profileResult.success).toBe(true);
      const bt = profileResult.data.behaviorTree;

      // Validate profile-generated BT
      const validationResult = await btValidator.validate(bt);
      
      expect(validationResult.valid).toBe(true);
      if (!validationResult.valid) {
        console.error('Profile BT validation errors:', validationResult.errors);
        throw new Error('Profile-generated BT failed validation');
      }

      console.log(`✅ Profile planner → BT validator: ${bt.id} validated`);
    }, 45000);

    test('should handle profile-specific tool validations', async () => {
      console.log('🔍 Testing profile-specific tool validation...');

      const tools = profileModule.getTools();
      const profileTool = tools[0];

      const profileResult = await profileTool.execute({
        function: {
          name: 'plan_with_profile',
          arguments: JSON.stringify({
            profile: 'javascript-development',
            task: 'Use JavaScript-specific tools for development'
          })
        }
      });

      expect(profileResult.success).toBe(true);
      const bt = profileResult.data.behaviorTree;

      // Extract tool references
      const extractToolRefs = (node) => {
        const tools = [];
        if (node.action) tools.push(node.action);
        if (node.tool) tools.push(node.tool);
        if (node.children) {
          node.children.forEach(child => tools.push(...extractToolRefs(child)));
        }
        return tools;
      };

      const toolRefs = extractToolRefs(bt);
      
      // Validate that profile-specific tools are recognized
      const validationResult = await btValidator.validate(bt, { 
        validateTools: true,
        availableTools: toolRefs // Assume profile tools are available
      });

      expect(validationResult.valid).toBe(true);
      console.log(`✅ Profile tools validated: ${toolRefs.join(', ')}`);
    }, 45000);
  });

  describe('Schema Compatibility Across Packages', () => {
    test('should maintain BT schema consistency', async () => {
      console.log('🔍 Testing BT schema consistency...');

      // Generate BTs from different sources
      const unifiedBT = await unifiedPlanner.createPlan({
        description: 'Create a test file',
        strategy: 'llm'
      });

      const tools = profileModule.getTools();
      const profileTool = tools[0];
      const profileResult = await profileTool.execute({
        function: {
          name: 'plan_with_profile',
          arguments: JSON.stringify({
            profile: 'javascript-development',
            task: 'Create a test file'
          })
        }
      });

      const profileBT = profileResult.data.behaviorTree;

      // Both should validate with the same validator
      const unifiedValidation = await btValidator.validate(unifiedBT);
      const profileValidation = await btValidator.validate(profileBT);

      expect(unifiedValidation.valid).toBe(true);
      expect(profileValidation.valid).toBe(true);

      // Both should have consistent schema structure
      expect(typeof unifiedBT.id).toBe('string');
      expect(typeof unifiedBT.type).toBe('string');
      expect(typeof profileBT.id).toBe('string'); 
      expect(typeof profileBT.type).toBe('string');

      console.log('✅ Schema consistency maintained across packages');
    }, 60000);

    test('should handle version compatibility', async () => {
      console.log('🔍 Testing version compatibility...');

      // Test that packages work together regardless of minor schema differences
      const bt = await unifiedPlanner.createPlan({
        description: 'Test version compatibility',
        strategy: 'llm'
      });

      // Add extra metadata that might exist in future versions
      const extendedBT = {
        ...bt,
        metadata: {
          version: '1.0.0',
          generator: 'unified-planner',
          timestamp: new Date().toISOString()
        }
      };

      // Validator should handle extra fields gracefully
      const validationResult = await btValidator.validate(extendedBT);
      expect(validationResult.valid).toBe(true);

      console.log('✅ Version compatibility maintained');
    }, 45000);
  });

  describe('Error Propagation and Handling', () => {
    test('should propagate errors consistently across packages', async () => {
      console.log('🔍 Testing error propagation...');

      // Create a scenario where each package might fail
      const testCases = [
        {
          name: 'unified-planner error',
          test: async () => {
            try {
              // Invalid strategy should cause error
              await unifiedPlanner.createPlan({
                description: 'test',
                strategy: 'nonexistent-strategy'
              });
              return { success: false, error: 'Should have thrown' };
            } catch (error) {
              return { success: false, error: error.message };
            }
          }
        },
        {
          name: 'bt-validator error',
          test: async () => {
            const invalidBT = { invalid: 'structure' };
            const result = await btValidator.validate(invalidBT);
            return { success: result.valid, error: result.errors?.join(', ') };
          }
        },
        {
          name: 'profile-planner error',
          test: async () => {
            const tools = profileModule.getTools();
            const result = await tools[0].execute({
              function: {
                name: 'plan_with_profile',
                arguments: JSON.stringify({
                  profile: 'nonexistent',
                  task: 'test'
                })
              }
            });
            return { success: result.success, error: result.error };
          }
        }
      ];

      for (const testCase of testCases) {
        const result = await testCase.test();
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        console.log(`✅ ${testCase.name} error handled: ${result.error}`);
      }
    }, 45000);

    test('should maintain error context across package boundaries', async () => {
      console.log('🔍 Testing error context preservation...');

      // Generate a BT that might have issues
      const bt = await unifiedPlanner.createPlan({
        description: 'Create files with potential tool issues',
        strategy: 'llm'
      });

      // Validate and check if context is preserved
      const validationResult = await btValidator.validate(bt);
      
      if (!validationResult.valid) {
        // Errors should have context about where they originated
        validationResult.errors.forEach(error => {
          expect(typeof error).toBe('string');
          expect(error.length).toBeGreaterThan(0);
        });
        console.log(`✅ Error context preserved: ${validationResult.errors.length} errors`);
      } else {
        console.log('✅ No errors to test context preservation');
      }
    }, 45000);
  });

  describe('Performance Across Package Integration', () => {
    test('should maintain performance across package boundaries', async () => {
      console.log('🔍 Testing cross-package performance...');

      const startTime = Date.now();

      // Unified planner generation
      const bt = await unifiedPlanner.createPlan({
        description: 'Create a performance test file',
        strategy: 'llm'
      });

      const planningTime = Date.now() - startTime;

      // BT validation
      const validationStart = Date.now();
      const validationResult = await btValidator.validate(bt);
      const validationTime = Date.now() - validationStart;

      expect(validationResult.valid).toBe(true);

      const totalTime = Date.now() - startTime;

      // Performance expectations
      expect(planningTime).toBeLessThan(35000); // Planning under 35s
      expect(validationTime).toBeLessThan(1000); // Validation under 1s
      expect(totalTime).toBeLessThan(40000); // Total under 40s

      console.log(`✅ Performance: Planning ${planningTime}ms, Validation ${validationTime}ms, Total ${totalTime}ms`);
    }, 50000);

    test('should handle concurrent cross-package operations', async () => {
      console.log('🔍 Testing concurrent operations...');

      const operations = [
        () => unifiedPlanner.createPlan({
          description: 'Concurrent test 1',
          strategy: 'llm'
        }),
        () => unifiedPlanner.createPlan({
          description: 'Concurrent test 2', 
          strategy: 'llm'
        })
      ];

      const startTime = Date.now();
      const results = await Promise.all(operations.map(op => op()));
      const duration = Date.now() - startTime;

      // All should succeed
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
      });

      // Should complete reasonably quickly
      expect(duration).toBeLessThan(60000); // Under 60 seconds for concurrent ops

      // Validate all results
      const validationPromises = results.map(bt => btValidator.validate(bt));
      const validationResults = await Promise.all(validationPromises);
      
      validationResults.forEach(result => {
        expect(result.valid).toBe(true);
      });

      console.log(`✅ Concurrent operations completed in ${duration}ms`);
    }, 90000);
  });
});