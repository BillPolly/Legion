#!/usr/bin/env node

/**
 * Capture detailed LLM plan generation output including full JSON response
 */

import { ResourceManager } from '@jsenvoy/module-loader';
import { LLMClient } from '@jsenvoy/llm';
import { GenericPlanner } from './src/GenericPlanner.js';
import fs from 'fs';

async function main() {
  console.log('🚀 Capturing Real LLM Plan Generation\n');

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

  // More complex request to showcase LLM capabilities
  const request = {
    description: 'Create a Node.js web server with user authentication and a REST API for managing tasks',
    inputs: ['project-requirements', 'user-stories'],
    requiredOutputs: ['web-server', 'api-endpoints', 'authentication-system'],
    allowableActions: [
      {
        type: 'create-directory',
        inputs: ['directory-name'],
        outputs: ['directory-created']
      },
      {
        type: 'create-file',
        inputs: ['file-path', 'file-content'],
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
        type: 'implement-authentication',
        inputs: ['auth-strategy'],
        outputs: ['authentication-system']
      },
      {
        type: 'create-api-routes',
        inputs: ['route-definitions'],
        outputs: ['api-endpoints']
      },
      {
        type: 'configure-middleware',
        inputs: ['middleware-config'],
        outputs: ['middleware-configured']
      },
      {
        type: 'start-server',
        inputs: ['server-config'],
        outputs: ['web-server']
      },
      {
        type: 'run-tests',
        inputs: ['test-suite'],
        outputs: ['test-results']
      }
    ]
  };

  try {
    console.log('📋 Planning Request:');
    console.log(`Description: ${request.description}`);
    console.log(`Inputs: ${request.inputs.join(', ')}`);
    console.log(`Required Outputs: ${request.requiredOutputs.join(', ')}`);
    console.log(`Available Actions: ${request.allowableActions.length} actions\n`);

    console.log('🤖 Generating plan with real Anthropic Claude API...\n');
    const startTime = Date.now();
    const plan = await planner.createPlan(request);
    const duration = Date.now() - startTime;

    console.log(`✅ Plan Generated Successfully in ${duration}ms!\n`);

    // Save the full plan JSON to file
    const planJson = plan.toJSON();
    fs.writeFileSync('generated-plan-full.json', JSON.stringify(planJson, null, 2));
    console.log('💾 Full plan JSON saved to: generated-plan-full.json\n');

    console.log('📊 GENERATED PLAN DETAILS:');
    console.log('=' .repeat(60));
    console.log(`Plan ID: ${plan.id}`);
    console.log(`Plan Name: ${plan.name}`);
    console.log(`Description: ${plan.description}`);
    console.log(`Version: ${plan.version}`);
    console.log(`Created: ${plan.metadata.createdAt}`);
    console.log(`Complexity: ${plan.metadata.complexity}`);
    console.log(`Total Steps: ${plan.steps.length}`);
    console.log();

    // Show each step in detail
    console.log('📋 PLAN STEPS:');
    console.log('=' .repeat(60));
    plan.steps.forEach((step, index) => {
      console.log(`\n${index + 1}. ${step.name}`);
      console.log(`   ID: ${step.id}`);
      console.log(`   Type: ${step.type}`);
      console.log(`   Status: ${step.status}`);
      console.log(`   Dependencies: ${step.dependencies.join(', ') || 'None'}`);
      console.log(`   Inputs: ${step.inputs.join(', ') || 'None'}`);
      console.log(`   Outputs: ${step.outputs.join(', ') || 'None'}`);
      console.log(`   Actions (${step.actions.length}):`);
      step.actions.forEach((action, actionIndex) => {
        console.log(`     ${actionIndex + 1}. ${action.type}`);
        if (action.inputs && action.inputs.length > 0) {
          console.log(`        Inputs: ${action.inputs.join(', ')}`);
        }
        if (action.outputs && action.outputs.length > 0) {
          console.log(`        Outputs: ${action.outputs.join(', ')}`);
        }
      });
    });

    // Validation results
    console.log('\n🔍 VALIDATION RESULTS:');
    console.log('=' .repeat(60));
    const validation = plan.validate();
    const flowValidation = plan.validateInputOutputFlow();
    
    console.log(`Structure Valid: ${validation.isValid ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Flow Valid: ${flowValidation.isValid ? '✅ PASS' : '❌ FAIL'}`);
    
    if (!validation.isValid) {
      console.log('Structure Errors:');
      validation.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (!flowValidation.isValid) {
      console.log('Flow Errors:');
      flowValidation.errors.forEach(error => console.log(`  - ${error}`));
    }

    // Execution analysis
    console.log('\n📊 EXECUTION ANALYSIS:');
    console.log('=' .repeat(60));
    const executionOrder = plan.generateExecutionOrder();
    console.log(`Execution Order: ${executionOrder.join(' → ')}`);
    
    const parallelGroups = plan.getParallelExecutionGroups();
    console.log(`\nParallel Execution Groups: ${parallelGroups.length}`);
    parallelGroups.forEach((group, index) => {
      console.log(`  Group ${index + 1}: ${group.join(', ')}`);
    });

    console.log(`\nCircular Dependencies: ${plan.hasCircularDependencies() ? '❌ Found' : '✅ None'}`);

    // Final outputs
    console.log('\n📤 FINAL OUTPUTS:');
    console.log('=' .repeat(60));
    console.log(`Available Outputs: ${flowValidation.availableOutputs.join(', ')}`);
    console.log(`Required Outputs: ${request.requiredOutputs.join(', ')}`);
    
    const allRequiredProduced = request.requiredOutputs.every(output => 
      flowValidation.availableOutputs.includes(output)
    );
    console.log(`All Required Outputs Produced: ${allRequiredProduced ? '✅ YES' : '❌ NO'}`);

    // Summary
    console.log('\n🎯 SUMMARY:');
    console.log('=' .repeat(60));
    console.log(`✅ Real LLM (Anthropic Claude) successfully generated a structured plan`);
    console.log(`✅ Plan contains ${plan.steps.length} well-defined steps`);
    console.log(`✅ Structure validation: ${validation.isValid ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Flow validation: ${flowValidation.isValid ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Required outputs: ${allRequiredProduced ? 'ALL PRODUCED' : 'MISSING SOME'}`);
    console.log(`✅ Generation time: ${duration}ms`);

    if (validation.isValid && flowValidation.isValid && allRequiredProduced) {
      console.log('\n🎉 SUCCESS: Complete LLM-generated plan validation passed!');
      process.exit(0);
    } else {
      console.log('\n⚠️  PARTIAL SUCCESS: Plan generated but validation issues found');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the capture
main().catch(console.error);