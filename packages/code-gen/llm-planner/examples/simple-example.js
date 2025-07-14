#!/usr/bin/env node

/**
 * Simple example demonstrating llm-planner with ResourceManager
 */

import { ResourceManager } from '@jsenvoy/module-loader';
import { LLMClient } from '@jsenvoy/llm';
import { GenericPlanner } from '../src/GenericPlanner.js';

async function main() {
  console.log('🚀 LLM Planner Simple Example\n');

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
    model: 'claude-3-sonnet-20240229'
  });

  // Create planner
  const planner = new GenericPlanner({ llmClient });

  // Define a simple planning request
  const request = {
    description: 'Create a simple REST API server with user authentication',
    inputs: ['api-requirements', 'database-schema'],
    requiredOutputs: ['api-server', 'api-documentation'],
    allowableActions: [
      {
        type: 'create-directory',
        inputs: ['directory-name'],
        outputs: ['directory-created']
      },
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
        inputs: ['database-config'],
        outputs: ['database-ready']
      },
      {
        type: 'implement-auth',
        inputs: ['auth-strategy'],
        outputs: ['auth-system']
      },
      {
        type: 'create-routes',
        inputs: ['route-definitions'],
        outputs: ['routes-implemented']
      },
      {
        type: 'generate-docs',
        inputs: ['code-base'],
        outputs: ['api-documentation']
      }
    ]
  };

  console.log('📋 Planning Request:');
  console.log(`Description: ${request.description}`);
  console.log(`Inputs: ${request.inputs.join(', ')}`);
  console.log(`Required Outputs: ${request.requiredOutputs.join(', ')}`);
  console.log(`Available Actions: ${request.allowableActions.length}\n`);

  try {
    console.log('🤖 Generating plan with LLM...\n');
    const plan = await planner.createPlan(request);

    console.log('✅ Plan Generated Successfully!\n');
    console.log(`Plan Name: ${plan.name}`);
    console.log(`Description: ${plan.description}`);
    console.log(`Number of Steps: ${plan.steps.length}\n`);

    // Display each step
    plan.steps.forEach((step, index) => {
      console.log(`Step ${index + 1}: ${step.name}`);
      console.log(`  Type: ${step.type}`);
      console.log(`  Dependencies: ${step.dependencies.join(', ') || 'None'}`);
      console.log(`  Inputs: ${step.inputs.join(', ')}`);
      console.log(`  Outputs: ${step.outputs.join(', ')}`);
      console.log(`  Actions: ${step.actions.length}`);
      step.actions.forEach(action => {
        console.log(`    - ${action.type}`);
      });
      console.log();
    });

    // Validate the plan
    const validation = plan.validate();
    console.log('🔍 Plan Validation:', validation.isValid ? '✅ Valid' : '❌ Invalid');
    if (!validation.isValid) {
      console.log('Errors:', validation.errors);
    }

    // Check input/output flow
    const flowValidation = plan.validateInputOutputFlow();
    console.log('🔄 Flow Validation:', flowValidation.isValid ? '✅ Valid' : '❌ Invalid');
    if (!flowValidation.isValid) {
      console.log('Flow Errors:', flowValidation.errors);
    }

    // Show execution order
    const executionOrder = plan.generateExecutionOrder();
    console.log('\n📊 Execution Order:', executionOrder.join(' → '));

    // Show parallel execution groups
    const parallelGroups = plan.getParallelExecutionGroups();
    console.log('\n🚦 Parallel Execution Groups:');
    parallelGroups.forEach((group, index) => {
      console.log(`  Group ${index + 1}: ${group.join(', ')}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the example
main().catch(console.error);