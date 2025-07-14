#!/usr/bin/env node

/**
 * Show the JSON plan being created by the real LLM
 */

import { ResourceManager } from '@jsenvoy/module-loader';
import { LLMClient } from '@jsenvoy/llm';
import { GenericPlanner } from './src/GenericPlanner.js';

async function main() {
  console.log('🚀 LLM Planner JSON Demo\n');

  // Initialize ResourceManager
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();

  // Check for API key
  const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY not found in environment');
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

  // Define a planning request
  const request = {
    description: 'Create a React todo application with user authentication',
    inputs: ['requirements'],
    requiredOutputs: ['todo-app', 'auth-system'],
    allowableActions: [
      {
        type: 'create-file',
        inputs: ['file-content'],
        outputs: ['file-created']
      },
      {
        type: 'install-dependencies',
        inputs: ['package-list'],
        outputs: ['dependencies-installed']
      },
      {
        type: 'setup-database',
        inputs: ['db-config'],
        outputs: ['database-ready']
      },
      {
        type: 'implement-auth',
        inputs: ['auth-config'],
        outputs: ['auth-system']
      },
      {
        type: 'create-components',
        inputs: ['component-specs'],
        outputs: ['components-created']
      },
      {
        type: 'build-app',
        inputs: ['source-code'],
        outputs: ['todo-app']
      }
    ]
  };

  console.log('📋 Planning Request:');
  console.log(`Description: ${request.description}`);
  console.log(`Inputs: ${request.inputs.join(', ')}`);
  console.log(`Required Outputs: ${request.requiredOutputs.join(', ')}`);
  console.log(`Allowable Actions: ${request.allowableActions.map(a => a.type).join(', ')}`);

  try {
    console.log('\n🤖 Calling real LLM to generate hierarchical plan...');
    const plan = await planner.createPlan(request);

    console.log('\n✅ Plan generated successfully!');
    console.log(`Plan Name: ${plan.name}`);
    console.log(`Description: ${plan.description}`);
    console.log(`Steps: ${plan.steps.length}`);

    // Show validation results
    const validation = plan.validate();
    const flowValidation = plan.validateInputOutputFlow();
    
    console.log('\n🔍 Validation Results:');
    console.log(`Structure Valid: ${validation.isValid ? '✅' : '❌'}`);
    console.log(`Flow Valid: ${flowValidation.isValid ? '✅' : '❌'}`);
    
    if (!validation.isValid) {
      console.log('Structure Errors:', validation.errors);
    }
    
    if (!flowValidation.isValid) {
      console.log('Flow Errors:', flowValidation.errors);
    }

    // Show hierarchical structure
    console.log('\n🏗️  Plan Structure:');
    plan.steps.forEach((step, index) => {
      console.log(`${index + 1}. ${step.name} (${step.type})`);
      if (step.dependencies.length > 0) {
        console.log(`   Dependencies: ${step.dependencies.join(', ')}`);
      }
      if (step.actions.length > 0) {
        console.log(`   Actions: ${step.actions.map(a => a.type).join(', ')}`);
      }
      if (step.steps.length > 0) {
        console.log(`   Sub-steps: ${step.steps.length}`);
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the demo
main().catch(console.error);