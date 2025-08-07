/**
 * Integration Test: Profile Planner → Unified Planner
 * 
 * Tests the integration between profile-planner and unified-planner packages:
 * 1. Profile-planner generates BT schemas (not legacy plans)
 * 2. Unified-planner can consume profile-planner output
 * 3. BT schemas have intelligent defaults applied
 * 4. Cross-package compatibility is maintained
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { ProfilePlannerModule } from '@legion/profile-planner';
import { PlannerEngine } from '@legion/unified-planner';
import { BTValidator } from '@legion/bt-validator';
import { LiveLLMTestSetup } from '../utils/LiveLLMTestSetup.js';

describe('Profile Planner → Unified Planner Integration', () => {
  let llmSetup;
  let profileModule;
  let unifiedPlanner;
  let btValidator;

  beforeAll(async () => {
    // Initialize live LLM setup
    llmSetup = new LiveLLMTestSetup();
    await llmSetup.initialize();

    console.log('🔗 Profile-Planner → Unified-Planner integration tests initialized');
  });

  beforeEach(async () => {
    const resourceManager = llmSetup.getResourceManager();

    // Initialize profile planner module
    profileModule = await ProfilePlannerModule.create(resourceManager);

    // Initialize unified planner
    unifiedPlanner = new PlannerEngine({
      llmClient: llmSetup.getLLMClient(),
      moduleLoader: resourceManager.moduleLoader
    });

    // Initialize BT validator for compatibility testing
    btValidator = new BTValidator();
  });

  afterEach(async () => {
    if (profileModule) {
      await profileModule.cleanup();
    }
  });

  describe('BT Schema Generation Compatibility', () => {
    test('should generate BT schemas compatible with unified planner', async () => {
      // Get profile planner tool
      const tools = profileModule.getTools();
      const profileTool = tools[0];

      console.log('📋 Generating plan via profile-planner...');
      
      // Generate plan using profile-planner
      const profileResult = await profileTool.execute({
        function: {
          name: 'plan_with_profile',
          arguments: JSON.stringify({
            profile: 'javascript-development',
            task: 'Create a simple utility function for string manipulation'
          })
        }
      });

      expect(profileResult.success).toBe(true);
      expect(profileResult.data.behaviorTree).toBeDefined();
      expect(profileResult.data.format).toBe('behavior_tree');

      const bt = profileResult.data.behaviorTree;

      // Verify BT schema structure
      expect(bt.id).toBeDefined();
      expect(bt.type).toBeDefined();
      expect(['sequence', 'selector', 'action', 'parallel'].includes(bt.type)).toBe(true);

      console.log(`✅ Profile-planner generated BT: ${bt.id} (${bt.type})`);

      // Verify BT can be validated by bt-validator
      const validationResult = await btValidator.validate(bt);
      expect(validationResult.valid).toBe(true);

      if (!validationResult.valid) {
        console.error('BT validation errors:', validationResult.errors);
        throw new Error('Profile-generated BT failed validation');
      }

      console.log('✅ Profile-generated BT passed validation');
    }, 45000);

    test('should apply intelligent defaults to BT schemas', async () => {
      const tools = profileModule.getTools();
      const profileTool = tools[0];

      const profileResult = await profileTool.execute({
        function: {
          name: 'plan_with_profile', 
          arguments: JSON.stringify({
            profile: 'javascript-development',
            task: 'Create multiple files for a project'
          })
        }
      });

      expect(profileResult.success).toBe(true);
      const bt = profileResult.data.behaviorTree;

      // Check for intelligent defaults application
      if (bt.children && bt.children.length > 0) {
        // Should default to 'sequence' for nodes with children
        expect(bt.type).toBe('sequence');
        console.log('✅ Intelligent default applied: sequence for multi-children node');
      } else if (bt.type === 'action') {
        // Should have action/tool property for action nodes
        expect(bt.action || bt.tool).toBeDefined();
        console.log('✅ Intelligent default applied: action node has tool/action');
      }

      // All child nodes should have IDs (intelligent default)
      const validateNodeDefaults = (node) => {
        expect(node.id).toBeDefined();
        if (node.children) {
          node.children.forEach(validateNodeDefaults);
        }
      };

      validateNodeDefaults(bt);
      console.log('✅ Intelligent defaults: All nodes have IDs');
    }, 45000);
  });

  describe('Cross-Package Tool Compatibility', () => {
    test('should handle profile tools in unified planner context', async () => {
      // Get a profile and its tools
      const tools = profileModule.getTools();
      const profileTool = tools[0];

      // Get profile info to understand available tools
      const profileInfo = await profileTool.execute({
        function: {
          name: 'profile_info',
          arguments: JSON.stringify({
            profile: 'javascript-development'
          })
        }
      });

      expect(profileInfo.success).toBe(true);
      const profile = profileInfo.data.profile;

      console.log(`📊 Profile: ${profile.name} with ${profile.actionCount} actions`);

      // Generate plan via profile-planner
      const profileResult = await profileTool.execute({
        function: {
          name: 'plan_with_profile',
          arguments: JSON.stringify({
            profile: 'javascript-development',
            task: 'Create a configuration parser'
          })
        }
      });

      expect(profileResult.success).toBe(true);
      const bt = profileResult.data.behaviorTree;

      // Verify the BT could theoretically be processed by unified planner
      // (We can't actually run unified planner on pre-generated BT, 
      //  but we can validate structure compatibility)
      
      const hasValidStructure = bt.id && bt.type && 
        (bt.children || bt.action || bt.tool);
      expect(hasValidStructure).toBe(true);

      console.log('✅ Profile-generated BT has unified-planner compatible structure');
    }, 45000);

    test('should maintain tool reference compatibility', async () => {
      const tools = profileModule.getTools();
      const profileTool = tools[0];

      const profileResult = await profileTool.execute({
        function: {
          name: 'plan_with_profile',
          arguments: JSON.stringify({
            profile: 'javascript-development',
            task: 'Write a file and create a directory'
          })
        }
      });

      expect(profileResult.success).toBe(true);
      const bt = profileResult.data.behaviorTree;

      // Extract all tool references from the BT
      const extractToolRefs = (node) => {
        const tools = [];
        
        if (node.action) tools.push(node.action);
        if (node.tool) tools.push(node.tool);
        
        if (node.children) {
          node.children.forEach(child => {
            tools.push(...extractToolRefs(child));
          });
        }
        
        return tools;
      };

      const toolRefs = extractToolRefs(bt);
      expect(toolRefs.length).toBeGreaterThan(0);

      // Tool references should follow naming conventions
      toolRefs.forEach(toolRef => {
        expect(typeof toolRef).toBe('string');
        expect(toolRef.length).toBeGreaterThan(0);
        // Should not have legacy format issues
        expect(toolRef).not.toContain('undefined');
        expect(toolRef).not.toContain('null');
      });

      console.log(`✅ Found ${toolRefs.length} valid tool references: ${toolRefs.join(', ')}`);
    }, 45000);
  });

  describe('Profile Context Integration', () => {
    test('should preserve profile context in BT generation', async () => {
      const tools = profileModule.getTools();
      const profileTool = tools[0];

      // Test with specific profile context
      const profileResult = await profileTool.execute({
        function: {
          name: 'plan_with_profile',
          arguments: JSON.stringify({
            profile: 'javascript-development',
            task: 'Create a web service endpoint'
          })
        }
      });

      expect(profileResult.success).toBe(true);
      expect(profileResult.data.profile).toBe('javascript-development');
      expect(profileResult.data.profileDescription).toBeDefined();

      // Should include profile-specific context
      const bt = profileResult.data.behaviorTree;
      expect(bt).toBeDefined();

      // Profile context should influence tool selection
      const extractedTools = llmSetup.extractActionsFromBT(bt);
      
      // JavaScript profile should prefer JS-related tools
      const hasJSRelevantTools = extractedTools.some(tool => 
        tool.includes('file_write') || 
        tool.includes('directory_create') ||
        tool.includes('javascript') ||
        tool.includes('npm') ||
        tool.includes('node')
      );

      expect(hasJSRelevantTools).toBe(true);
      console.log('✅ Profile context influenced tool selection');
    }, 45000);

    test('should handle profile-specific templates and defaults', async () => {
      const tools = profileModule.getTools();
      const profileTool = tools[0];

      const profileResult = await profileTool.execute({
        function: {
          name: 'plan_with_profile',
          arguments: JSON.stringify({
            profile: 'javascript-development',
            task: 'Create a new Node.js project with package.json'
          })
        }
      });

      expect(profileResult.success).toBe(true);
      
      // Should include profile-specific guidance
      if (profileResult.data.note) {
        expect(profileResult.data.note).toContain('required modules');
      }

      // BT should reflect profile requirements
      const bt = profileResult.data.behaviorTree;
      
      // For Node.js project, should likely include package.json creation
      const extractedTools = llmSetup.extractActionsFromBT(bt);
      const hasPackageCreation = extractedTools.some(tool => 
        tool.includes('file_write') || tool.includes('create')
      );
      
      expect(hasPackageCreation).toBe(true);
      console.log('✅ Profile templates influenced BT generation');
    }, 45000);
  });

  describe('Error Handling and Compatibility', () => {
    test('should handle invalid profile names gracefully', async () => {
      const tools = profileModule.getTools();
      const profileTool = tools[0];

      const profileResult = await profileTool.execute({
        function: {
          name: 'plan_with_profile',
          arguments: JSON.stringify({
            profile: 'nonexistent-profile',
            task: 'Create something'
          })
        }
      });

      expect(profileResult.success).toBe(false);
      expect(profileResult.error).toContain('not found');
      console.log('✅ Invalid profile handled gracefully');
    }, 30000);

    test('should maintain compatibility across package updates', async () => {
      // Test that current interface works as expected
      const tools = profileModule.getTools();
      const profileTool = tools[0];

      // Verify tool interface
      expect(profileTool.name).toBe('profile_planner');
      expect(typeof profileTool.execute).toBe('function');

      // Test all major functions
      const functions = ['plan_with_profile', 'profile_list', 'profile_info'];
      
      for (const funcName of functions) {
        try {
          const result = await profileTool.execute({
            function: {
              name: funcName,
              arguments: funcName === 'plan_with_profile' 
                ? JSON.stringify({ profile: 'javascript-development', task: 'test' })
                : funcName === 'profile_info'
                ? JSON.stringify({ profile: 'javascript-development' })
                : '{}'
            }
          });

          // Should not throw errors (may succeed or fail gracefully)
          expect(typeof result.success).toBe('boolean');
          console.log(`✅ Function ${funcName} interface compatible`);
        } catch (error) {
          throw new Error(`Function ${funcName} compatibility broken: ${error.message}`);
        }
      }
    }, 60000);
  });

  describe('Performance and Integration Efficiency', () => {
    test('should complete profile → unified planner handoff efficiently', async () => {
      const startTime = Date.now();

      // Profile planner generation
      const tools = profileModule.getTools();
      const profileTool = tools[0];

      const profileResult = await profileTool.execute({
        function: {
          name: 'plan_with_profile',
          arguments: JSON.stringify({
            profile: 'javascript-development',
            task: 'Create a simple logger utility'
          })
        }
      });

      expect(profileResult.success).toBe(true);

      // BT validation (unified planner compatibility check)
      const validationResult = await btValidator.validate(profileResult.data.behaviorTree);
      expect(validationResult.valid).toBe(true);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(35000); // Should complete in under 35 seconds

      console.log(`✅ Profile → Unified handoff completed in ${duration}ms`);
    }, 45000);
  });
});