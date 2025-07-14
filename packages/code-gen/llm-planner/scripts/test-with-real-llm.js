#!/usr/bin/env node

/**
 * Test script to run llm-planner with real LLM integration
 * 
 * This script demonstrates the full capability of the llm-planner package
 * by creating actual plans using real LLM APIs using the ResourceManager pattern.
 */

import { ResourceManager } from '@jsenvoy/module-loader';
import { LLMClient } from '@jsenvoy/llm';
import { GenericPlanner } from '../src/GenericPlanner.js';
import { FlowValidator } from '../src/FlowValidator.js';
import { LLMPlannerModule } from '../src/LLMPlannerModule.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Setup ResourceManager and register LLM client
 */
async function setupResources() {
  // Initialize ResourceManager
  const resourceManager = new ResourceManager();
  await resourceManager.initialize(); // This loads .env file
  
  // Check for required environment variables
  const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY environment variable is required');
    console.log('Please set it in your .env file');
    process.exit(1);
  }
  
  // Create and register LLM client
  const llmClient = new LLMClient({
    provider: 'anthropic',
    apiKey: apiKey,
    model: 'claude-3-sonnet-20240229',
    maxRetries: 3,
    baseDelay: 1000
  });
  
  resourceManager.register('llmClient', llmClient);
  
  return { resourceManager, llmClient };
}

/**
 * Main test function
 */
async function runPlannerTests() {
  console.log('🚀 Starting LLM Planner Integration Tests\n');

  // Setup resources
  const { resourceManager, llmClient } = await setupResources();

  // Create planner using the LLM client
  const planner = new GenericPlanner({ 
    llmClient,
    maxRetries: 2
  });

  // Create validator
  const validator = new FlowValidator();
  
  // Also test the module pattern
  console.log('📦 Testing LLMPlannerModule integration...\n');
  const plannerModule = new LLMPlannerModule({ llmClient });
  console.log('Module name:', plannerModule.name);
  console.log('Module description:', plannerModule.description);
  const tools = plannerModule.getTools();
  console.log('Available tools:', tools.map(t => t.getToolDescription().function.name));

  // Test cases
  const testCases = [
    {
      name: 'Simple Web Server',
      description: 'Create a REST API server with basic CRUD operations',
      inputs: ['api-requirements'],
      requiredOutputs: ['api-server'],
      allowableActions: [
        {
          type: 'create-file',
          inputs: ['file-content'],
          outputs: ['file-created']
        },
        {
          type: 'create-directory',
          inputs: ['directory-name'],
          outputs: ['directory-created']
        },
        {
          type: 'install-dependencies',
          inputs: ['package-list'],
          outputs: ['dependencies-installed']
        },
        {
          type: 'configure-server',
          inputs: ['server-config'],
          outputs: ['server-configured']
        },
        {
          type: 'create-routes',
          inputs: ['route-definitions'],
          outputs: ['routes-implemented']
        },
        {
          type: 'run-tests',
          inputs: ['test-suite'],
          outputs: ['test-results']
        }
      ]
    },
    {
      name: 'React Application',
      description: 'Build a React application with TypeScript, routing, and state management',
      inputs: ['project-requirements', 'ui-designs'],
      requiredOutputs: ['react-app', 'test-suite'],
      allowableActions: [
        {
          type: 'create-react-app',
          inputs: ['app-name'],
          outputs: ['react-project']
        },
        {
          type: 'setup-typescript',
          inputs: ['typescript-config'],
          outputs: ['typescript-configured']
        },
        {
          type: 'install-dependencies',
          inputs: ['package-list'],
          outputs: ['dependencies-installed']
        },
        {
          type: 'setup-routing',
          inputs: ['route-config'],
          outputs: ['routing-configured']
        },
        {
          type: 'setup-state-management',
          inputs: ['state-config'],
          outputs: ['state-management-ready']
        },
        {
          type: 'create-components',
          inputs: ['component-specs'],
          outputs: ['components-created']
        },
        {
          type: 'implement-features',
          inputs: ['feature-specs'],
          outputs: ['features-implemented']
        },
        {
          type: 'write-tests',
          inputs: ['test-specs'],
          outputs: ['tests-written']
        },
        {
          type: 'setup-build',
          inputs: ['build-config'],
          outputs: ['build-configured']
        }
      ]
    },
    {
      name: 'Microservices System',
      description: 'Create a microservices architecture with API gateway, user service, and notification service',
      inputs: ['system-requirements', 'architecture-specs'],
      requiredOutputs: ['microservices-system', 'api-gateway', 'monitoring-setup'],
      allowableActions: [
        {
          type: 'create-service',
          inputs: ['service-spec'],
          outputs: ['service-created']
        },
        {
          type: 'setup-database',
          inputs: ['database-config'],
          outputs: ['database-ready']
        },
        {
          type: 'configure-api-gateway',
          inputs: ['gateway-config'],
          outputs: ['api-gateway']
        },
        {
          type: 'setup-message-queue',
          inputs: ['queue-config'],
          outputs: ['message-queue-ready']
        },
        {
          type: 'implement-service-discovery',
          inputs: ['discovery-config'],
          outputs: ['service-discovery-ready']
        },
        {
          type: 'setup-monitoring',
          inputs: ['monitoring-config'],
          outputs: ['monitoring-setup']
        },
        {
          type: 'configure-load-balancer',
          inputs: ['lb-config'],
          outputs: ['load-balancer-ready']
        },
        {
          type: 'setup-security',
          inputs: ['security-config'],
          outputs: ['security-configured']
        },
        {
          type: 'create-deployment-scripts',
          inputs: ['deployment-specs'],
          outputs: ['deployment-scripts']
        }
      ]
    }
  ];

  let results = [];

  for (const testCase of testCases) {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log(`Description: ${testCase.description}`);
    console.log(`Inputs: ${testCase.inputs.join(', ')}`);
    console.log(`Required Outputs: ${testCase.requiredOutputs.join(', ')}`);
    console.log(`Allowable Actions: ${testCase.allowableActions.length} actions`);

    try {
      const startTime = Date.now();
      
      // Create the plan
      const plan = await planner.createPlan(testCase);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`\n✅ Plan created successfully in ${duration}ms`);
      console.log(`Plan Name: ${plan.name}`);
      console.log(`Plan Description: ${plan.description}`);
      console.log(`Number of Steps: ${plan.steps.length}`);

      // Validate the plan
      const validation = plan.validate();
      const flowValidation = validator.validate(plan);

      console.log(`\n🔍 Validation Results:`);
      console.log(`Structure Valid: ${validation.isValid ? '✅' : '❌'}`);
      console.log(`Flow Valid: ${flowValidation.isValid ? '✅' : '❌'}`);

      if (!validation.isValid) {
        console.log(`Structure Errors: ${validation.errors.join(', ')}`);
      }

      if (!flowValidation.isValid) {
        console.log(`Flow Errors: ${flowValidation.errors.join(', ')}`);
      }

      if (flowValidation.warnings && flowValidation.warnings.length > 0) {
        console.log(`Flow Warnings: ${flowValidation.warnings.join(', ')}`);
      }

      // Log step information
      console.log(`\n📊 Step Analysis:`);
      const stepTypes = {};
      plan.steps.forEach(step => {
        stepTypes[step.type] = (stepTypes[step.type] || 0) + 1;
      });
      
      Object.entries(stepTypes).forEach(([type, count]) => {
        console.log(`  ${type}: ${count} steps`);
      });

      // Check for dependencies
      const stepsWithDeps = plan.steps.filter(step => step.dependencies && step.dependencies.length > 0);
      console.log(`Steps with Dependencies: ${stepsWithDeps.length}`);

      // Check for circular dependencies
      const hasCircular = plan.hasCircularDependencies();
      console.log(`Circular Dependencies: ${hasCircular ? '❌ Found' : '✅ None'}`);

      // Generate execution order
      const executionOrder = plan.generateExecutionOrder();
      console.log(`Execution Order: ${executionOrder.length} steps`);

      // Generate parallel execution groups
      const parallelGroups = plan.getParallelExecutionGroups();
      console.log(`Parallel Groups: ${parallelGroups.length} groups`);

      // Store result
      results.push({
        testCase: testCase.name,
        success: true,
        duration,
        plan: plan.toJSON(),
        validation: validation.isValid,
        flowValidation: flowValidation.isValid,
        stepCount: plan.steps.length,
        hasCircularDependencies: hasCircular,
        parallelGroups: parallelGroups.length
      });

    } catch (error) {
      console.log(`\n❌ Test failed: ${error.message}`);
      
      results.push({
        testCase: testCase.name,
        success: false,
        error: error.message,
        duration: 0
      });
    }
  }

  // Save results
  const outputPath = path.join(__dirname, '..', 'test-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  console.log(`\n📄 Test results saved to: ${outputPath}`);

  // Summary
  console.log(`\n📊 Test Summary:`);
  const successful = results.filter(r => r.success).length;
  console.log(`✅ Successful: ${successful}/${results.length}`);
  console.log(`❌ Failed: ${results.length - successful}/${results.length}`);

  if (successful > 0) {
    const avgDuration = results.filter(r => r.success).reduce((acc, r) => acc + r.duration, 0) / successful;
    console.log(`⏱️  Average Duration: ${Math.round(avgDuration)}ms`);
  }

  // Exit with proper code
  process.exit(successful === results.length ? 0 : 1);
}

// Run the tests
runPlannerTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});