#!/usr/bin/env node

/**
 * Quick test to demonstrate real LLM integration
 */

import { ResourceManager } from '@jsenvoy/module-loader';
import { LLMClient } from '@jsenvoy/llm';
import { GenericPlanner } from './src/GenericPlanner.js';

async function main() {
  console.log('🚀 Quick LLM Planner Test\n');

  // Initialize ResourceManager
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();

  // Check for API key
  const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY not found in environment');
    console.log('Please set ANTHROPIC_API_KEY in your .env file');
    process.exit(1);
  }

  // Create LLM client
  const llmClient = new LLMClient({
    provider: 'anthropic',
    apiKey: apiKey,
    model: 'claude-3-sonnet-20240229',
    maxRetries: 1
  });

  // Create planner
  const planner = new GenericPlanner({ llmClient, maxRetries: 1 });

  // Simple request
  const request = {
    description: 'Create a simple hello world program',
    inputs: ['requirements'],
    requiredOutputs: ['hello-world-program'],
    allowableActions: [
      {
        type: 'create-file',
        inputs: ['file-content'],
        outputs: ['file-created']
      },
      {
        type: 'run-program',
        inputs: ['file-created'],
        outputs: ['hello-world-program']
      }
    ]
  };

  try {
    console.log('📋 Planning Request:');
    console.log(`Description: ${request.description}`);
    console.log(`Inputs: ${request.inputs.join(', ')}`);
    console.log(`Required Outputs: ${request.requiredOutputs.join(', ')}`);
    console.log(`Available Actions: ${request.allowableActions.length} actions\n`);

    console.log('🤖 Generating plan with real LLM...\n');
    const startTime = Date.now();
    const plan = await planner.createPlan(request);
    const duration = Date.now() - startTime;

    console.log(`✅ Plan Generated Successfully in ${duration}ms!\n`);
    console.log(`Plan Name: ${plan.name}`);
    console.log(`Description: ${plan.description}`);
    console.log(`Number of Steps: ${plan.steps.length}\n`);

    // Validate the plan
    const validation = plan.validate();
    const flowValidation = plan.validateInputOutputFlow();
    
    console.log('🔍 Validation Results:');
    console.log(`Structure Valid: ${validation.isValid ? '✅' : '❌'}`);
    console.log(`Flow Valid: ${flowValidation.isValid ? '✅' : '❌'}`);
    
    if (!validation.isValid) {
      console.log('Structure Errors:', validation.errors);
    }
    
    if (!flowValidation.isValid) {
      console.log('Flow Errors:', flowValidation.errors);
    }

    // Display each step
    console.log('\n📊 Plan Steps:');
    plan.steps.forEach((step, index) => {
      console.log(`${index + 1}. ${step.name} (${step.type})`);
      console.log(`   Dependencies: ${step.dependencies.join(', ') || 'None'}`);
      console.log(`   Inputs: ${step.inputs.join(', ')}`);
      console.log(`   Outputs: ${step.outputs.join(', ')}`);
      console.log(`   Actions: ${step.actions.length}`);
      step.actions.forEach(action => {
        console.log(`     - ${action.type}`);
      });
      console.log();
    });

    // Show execution order
    const executionOrder = plan.generateExecutionOrder();
    console.log('📋 Execution Order:');
    console.log(executionOrder.join(' → '));

    // Show final outputs
    console.log('\n📤 Final Outputs:');
    console.log(flowValidation.availableOutputs.join(', '));

    // Summary
    console.log('\n🎉 Summary:');
    console.log(`✅ Real LLM successfully generated a structured plan`);
    console.log(`✅ Plan has ${plan.steps.length} steps`);
    console.log(`✅ Structure validation: ${validation.isValid ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Flow validation: ${flowValidation.isValid ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Required outputs produced: ${flowValidation.availableOutputs.includes('hello-world-program') ? 'PASS' : 'FAIL'}`);

    if (validation.isValid && flowValidation.isValid && flowValidation.availableOutputs.includes('hello-world-program')) {
      console.log('\n🎯 SUCCESS: Real LLM integration is working perfectly!');
      process.exit(0);
    } else {
      console.log('\n❌ PARTIAL SUCCESS: LLM generated a plan but validation failed');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);