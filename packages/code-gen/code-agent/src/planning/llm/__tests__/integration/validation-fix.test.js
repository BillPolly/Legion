/**
 * @jest-environment node
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ResourceManager } from '@jsenvoy/module-loader';
import { LLMClient } from '@jsenvoy/llm';
import GenericPlanner from '../../../../../llm-planner/src/GenericPlanner.js';

describe('Fix Validation Issues', () => {
  let resourceManager;
  let llmClient;
  let genericPlanner;
  
  beforeAll(async () => {
    console.log('🚀 Setting up validation fix test...');
    
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required');
    }
    
    llmClient = new LLMClient({
      provider: 'anthropic',
      apiKey: apiKey,
      model: 'claude-3-sonnet-20240229',
      maxRetries: 1
    });
    
    genericPlanner = new GenericPlanner({ llmClient });
    
    console.log('✅ Validation fix test setup complete');
  });

  test('should create simple plan with proper inputs/outputs', async () => {
    console.log('\n🔍 Testing simple plan with correct input/output flow...');
    
    // Define inputs that will be available
    const inputs = ['task_description', 'requirements'];
    
    // Define what we want the plan to produce
    const requiredOutputs = ['project_type', 'complexity'];
    
    // Define simple actions that use available inputs
    const allowableActions = [
      { 
        type: "analyze_requirements", 
        description: "Analyze project requirements",
        inputs: ['task_description', 'requirements'],
        outputs: ['project_type', 'complexity', 'features']
      }
    ];
    
    const planRequest = {
      description: "Analyze a simple todo list application",
      inputs: inputs,
      requiredOutputs: requiredOutputs,
      allowableActions: allowableActions,
      maxSteps: 3
    };
    
    console.log('📋 Plan Request:');
    console.log('  Description:', planRequest.description);
    console.log('  Inputs:', planRequest.inputs);
    console.log('  Required Outputs:', planRequest.requiredOutputs);
    console.log('  Allowable Actions:', planRequest.allowableActions.map(a => a.type));
    
    let plan;
    try {
      console.log('\n🚀 Creating plan...');
      plan = await genericPlanner.createPlan(planRequest);
      
      console.log('\n✅ Plan created successfully!');
      console.log('📄 Plan:', {
        name: plan.name,
        description: plan.description,
        stepCount: plan.steps?.length || 0
      });
      
      // Check plan structure
      expect(plan).toBeDefined();
      expect(plan.name).toBeDefined();
      expect(plan.steps).toBeDefined();
      expect(plan.steps.length).toBeGreaterThan(0);
      
      console.log('\n📊 Plan Details:');
      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        console.log(`  Step ${i + 1}: ${step.name}`);
        console.log(`    Actions: ${step.actions.map(a => a.type).join(', ')}`);
        console.log(`    Inputs: ${step.getInputs().join(', ')}`);
        console.log(`    Outputs: ${step.getOutputs().join(', ')}`);
      }
      
    } catch (error) {
      console.log('\n❌ Plan creation failed:', error.message);
      
      // Check if it's a validation error
      if (error.message.includes('Plan validation failed')) {
        console.log('\n🔍 Validation Error Details:');
        const errorParts = error.message.split('Plan validation failed: ')[1];
        console.log(errorParts);
        
        // This tells us exactly what validation is failing
        console.log('\n💡 This error shows us the exact validation issue to fix!');
      }
      
      throw error;
    }
    
  }, 60000);
});