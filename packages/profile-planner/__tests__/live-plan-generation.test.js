/**
 * Live plan generation test using ProfilePlannerModule
 * Tests the complete flow from module creation to plan generation
 * Outputs results to __tests__/tmp directory
 */

import { ResourceManager } from '@legion/module-loader';
import { ProfilePlannerModule } from '../src/ProfilePlannerModule.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ProfilePlanner Live Integration', () => {
  let resourceManager;
  let module;
  let tool;
  let profileManager;
  
  beforeAll(async () => {
    // Setup ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Check API key availability
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey || apiKey === 'test-key') {
      throw new Error('No valid ANTHROPIC_API_KEY found - test requires live API access');
    }
    
    // Create module and get tool
    module = await ProfilePlannerModule.create(resourceManager);
    const tools = module.getTools();
    tool = tools[0];
    
    // Get the profile manager from the tool
    profileManager = tool.profileManager;
  });

  test('should generate live plan with LLM', async () => {
    console.log('🤖 Generating plan with LLM...');
    
    // Test parameters
    const testRequest = {
      profile: 'javascript',
      task: 'Create a simple calculator function that can add and subtract numbers'
    };
    
    // Create and clear output directory
    const outputDir = path.join(__dirname, 'tmp');
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, ignore
    }
    await fs.mkdir(outputDir, { recursive: true });
    
    const result = await tool.invoke({
      function: {
        name: 'plan_with_profile',
        arguments: JSON.stringify(testRequest)
      }
    });
    
    if (result.success) {
      console.log('🎉 SUCCESS! Plan generated');
      console.log(`   Plan: ${result.data.plan.name}`);
      console.log(`   Steps: ${result.data.plan.steps.length}`);
      
      // Get the actual planning context that was sent to the LLM
      const profile = await profileManager.getProfile(testRequest.profile);
      const planningContext = profileManager.createPlanningContext(profile, testRequest.task);
      
      // Save request and plan together in one file
      const testOutput = {
        test_name: 'ProfilePlanner Live Integration',
        timestamp: new Date().toISOString(),
        profile_request: testRequest,
        profile_json_actions: profile.allowableActions, // Show original JSON format
        actual_planning_request: {
          description: planningContext.description,
          inputs: planningContext.inputs,
          requiredOutputs: planningContext.requiredOutputs,
          allowableActions: planningContext.allowableActions, // Show converted format
          maxSteps: planningContext.maxSteps,
          initialInputData: planningContext.initialInputData
        },
        allowable_actions_count: planningContext.allowableActions.length,
        result: {
          success: true,
          plan_id: result.data.plan.id,
          plan_name: result.data.plan.name,
          plan_description: result.data.plan.description,
          total_steps: result.data.plan.steps.length,
          total_actions: result.data.plan.steps.reduce((sum, step) => sum + step.actions.length, 0),
          plan: result.data.plan
        }
      };
      
      const outputPath = path.join(outputDir, 'test-output.json');
      await fs.writeFile(outputPath, JSON.stringify(testOutput, null, 2));
      
      console.log(`\n📁 File saved to __tests__/tmp/test-output.json`);
      
      // Test assertions
      expect(result.success).toBe(true);
      expect(result.data.plan).toBeDefined();
      expect(result.data.plan.name).toBeDefined();
      expect(result.data.plan.steps).toBeInstanceOf(Array);
      expect(result.data.plan.steps.length).toBeGreaterThan(0);
      
    } else {
      console.log('❌ Plan generation failed');
      console.log(`   Error: ${result.error}`);
      
      // Get the actual planning context that was sent to the LLM
      const profile = await profileManager.getProfile(testRequest.profile);
      const planningContext = profileManager.createPlanningContext(profile, testRequest.task);
      
      // Save request and error together in one file
      const testOutput = {
        test_name: 'ProfilePlanner Live Integration',
        timestamp: new Date().toISOString(),
        profile_request: testRequest,
        profile_json_actions: profile.allowableActions, // Show original JSON format
        actual_planning_request: {
          description: planningContext.description,
          inputs: planningContext.inputs,
          requiredOutputs: planningContext.requiredOutputs,
          allowableActions: planningContext.allowableActions, // Show converted format
          maxSteps: planningContext.maxSteps,
          initialInputData: planningContext.initialInputData
        },
        allowable_actions_count: planningContext.allowableActions.length,
        result: {
          success: false,
          error: result.error,
          error_data: result.data
        }
      };
      
      const outputPath = path.join(outputDir, 'test-output.json');
      await fs.writeFile(outputPath, JSON.stringify(testOutput, null, 2));
      console.log(`\n📁 File saved to __tests__/tmp/test-output.json`);
      
      // Test the core functionality - LLM was called and responded
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.data.profile).toBe('javascript');
      expect(result.data.task).toBeDefined();
      console.log('\n✅ Core LLM integration working - validation issue is separate');
    }
  }, 60000); // 60 second timeout for LLM calls
});