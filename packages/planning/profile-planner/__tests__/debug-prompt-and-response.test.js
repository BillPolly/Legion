/**
 * DEBUG: Check exactly what prompt is sent to LLM and what comes back
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ProfilePlannerModule } from '../src/ProfilePlannerModule.js';
import { ResourceManager, ModuleLoader } from '@legion/tool-core';

describe('DEBUG Prompt and Response', () => {
  let profilePlannerModule;

  beforeAll(async () => {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();

    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();
    resourceManager.register('moduleLoader', moduleLoader);

    profilePlannerModule = await ProfilePlannerModule.create(resourceManager);
  }, 60000);

  test('EXAMINE EXACT PROMPT AND RESPONSE', async () => {
    if (!process.env.ANTHROPIC_API_KEY && process.env.RUN_REAL_LLM_TESTS !== 'true') {
      console.log('Skipping - need API key');
      return;
    }

    const tools = profilePlannerModule.getTools();
    const jsDevTool = tools.find(tool => tool.name === 'javascript_dev_working_planner') || 
                      tools.find(tool => tool.name === 'javascript_dev_planner');
    
    console.log('\n🔍 INTERCEPTING PROMPT AND RESPONSE...\n');
    
    // Get the profile and create planning context manually to see what's passed
    const profile = profilePlannerModule.profileManager.getProfile(jsDevTool.profile.name);
    const planningContext = await profilePlannerModule.profileManager.createPlanningContext(profile, 'create a simple Node.js server with an API endpoint that adds two numbers');
    
    console.log('=== PLANNING CONTEXT ===');
    console.log('Description:', planningContext.description);
    console.log('Allowable actions count:', planningContext.allowableActions.length);
    console.log('Allowable actions:');
    planningContext.allowableActions.forEach((action, i) => {
      console.log(`  ${i + 1}. ${action.type}: ${action.description}`);
    });
    
    // Create LLM client manually 
    const resourceManager = profilePlannerModule.profileManager.resourceManager;
    const anthropicKey = resourceManager.env.ANTHROPIC_API_KEY;
    const { LLMClient } = await import('@legion/llm');
    const llmClient = new LLMClient({
      provider: 'anthropic',
      apiKey: anthropicKey,
      model: 'claude-3-5-sonnet-20241022'
    });
    
    // Create GenericPlanner to see the actual prompt
    const { GenericPlanner } = await import('@legion/llm-planner');
    const planner = new GenericPlanner({
      llmClient: llmClient,
      moduleLoader: resourceManager.moduleLoader,
      maxSteps: planningContext.maxSteps
    });
    
    // Intercept the prompt by overriding the template loader
    const originalTemplateLoader = planner.templateLoader;
    planner.templateLoader = {
      async loadCreatePlanTemplate(params) {
        const prompt = await originalTemplateLoader.loadCreatePlanTemplate(params);
        
        console.log('\n=== EXACT PROMPT SENT TO LLM ===');
        console.log('='.repeat(80));
        console.log(prompt);
        console.log('='.repeat(80));
        console.log(`Prompt length: ${prompt.length} characters\n`);
        
        return prompt;
      },
      async loadFixPlanTemplate(params) {
        return await originalTemplateLoader.loadFixPlanTemplate(params);
      }
    };
    
    // Intercept LLM response
    const originalComplete = llmClient.complete.bind(llmClient);
    llmClient.complete = async (prompt, model) => {
      const response = await originalComplete(prompt, model);
      
      console.log('\n=== EXACT LLM RESPONSE ===');
      console.log('='.repeat(80));
      console.log(response);
      console.log('='.repeat(80));
      console.log(`Response length: ${response.length} characters\n`);
      
      return response;
    };
    
    try {
      const plan = await planner.createPlan(planningContext);
      console.log('✅ Plan created successfully');
    } catch (error) {
      console.log('❌ Plan creation failed:', error.message);
      
      // Show validation details if it's a validation error
      if (error.message.includes('Plan validation failed')) {
        const errorLines = error.message.split('\n');
        console.log('\n=== VALIDATION ERRORS ===');
        errorLines.forEach(line => {
          if (line.includes(' - at ')) {
            console.log('  ' + line.trim());
          }
        });
      }
    }
  }, 180000);
});