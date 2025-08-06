/**
 * @jest-environment node
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ResourceManager } from '@legion/module-loader';
import { LLMClient } from '@legion/llm';
import { GenericPlanner } from '../../src/GenericPlanner.js';
import { Plan } from '../../src/models/Plan.js';

describe('Real LLM Integration Tests', () => {
  let llmClient;
  let planner;
  
  const shouldRunTests = process.env.RUN_REAL_LLM_TESTS === 'true';
  
  beforeAll(async () => {
    if (!shouldRunTests) {
      return;
    }
    
    // Initialize ResourceManager
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for real LLM tests');
    }
    
    // Create real LLM client
    llmClient = new LLMClient({
      provider: 'anthropic',
      apiKey: apiKey,
      model: 'claude-3-sonnet-20240229',
      maxRetries: 2
    });
    
    // Create planner with moduleLoader for validation
    const { ModuleLoader } = await import('@legion/module-loader');
    const moduleLoader = new ModuleLoader();
    await moduleLoader.initialize();
    
    planner = new GenericPlanner({ 
      llmClient,
      moduleLoader,
      maxRetries: 2
    });
  });
  
  test('should create hierarchical plan with user-provided actions', async () => {
    if (!shouldRunTests) {
      console.log('Skipping real LLM test. Set RUN_REAL_LLM_TESTS=true to run.');
      return;
    }
    
    const request = {
      description: 'Create a simple web application with user registration',
      inputs: ['requirements'],
      requiredOutputs: ['web-app', 'user-system'],
      allowableActions: [
        {
          type: 'create-file',
          inputs: ['file-content'],
          outputs: ['file-created']
        },
        {
          type: 'setup-database',
          inputs: ['db-config'],
          outputs: ['database-ready']
        },
        {
          type: 'implement-auth',
          inputs: ['auth-strategy'],
          outputs: ['user-system']
        },
        {
          type: 'create-ui',
          inputs: ['ui-design'],
          outputs: ['ui-created']
        },
        {
          type: 'deploy-app',
          inputs: ['deployment-config'],
          outputs: ['web-app']
        }
      ]
    };
    
    console.log('🚀 Testing real LLM with hierarchical plan generation...');
    const startTime = Date.now();
    
    const plan = await planner.createPlan(request);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Plan generated in ${duration}ms`);
    
    // Verify plan structure
    expect(plan).toBeInstanceOf(Plan);
    expect(plan.name).toBeTruthy();
    expect(plan.description).toBeTruthy();
    expect(plan.steps.length).toBeGreaterThan(0);
    
    // Verify all actions use only allowable action types
    const allActions = [];
    for (const step of plan.steps) {
      allActions.push(...step.getAllActions());
    }
    
    const allowableTypes = request.allowableActions.map(a => a.type);
    for (const action of allActions) {
      expect(allowableTypes).toContain(action.type);
    }
    
    // Verify plan validation
    const structureValidation = plan.validate();
    expect(structureValidation.isValid).toBe(true);
    
    const flowValidation = plan.validateInputOutputFlow();
    expect(flowValidation.isValid).toBe(true);
    
    // Verify required outputs are produced
    expect(flowValidation.availableOutputs).toContain('web-app');
    expect(flowValidation.availableOutputs).toContain('user-system');
    
    // Log plan details
    console.log(`\\n📋 Generated Plan: ${plan.name}`);
    console.log(`Description: ${plan.description}`);
    console.log(`Steps: ${plan.steps.length}`);
    console.log(`Total Actions: ${allActions.length}`);
    
    // Log hierarchical structure
    console.log('\\n🏗️  Plan Structure:');
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
        step.steps.forEach((subStep, subIndex) => {
          console.log(`     ${subIndex + 1}. ${subStep.name}`);
        });
      }
    });
    
  }, 60000); // 60 second timeout
  
  test('should create simple action sequence', async () => {
    if (!shouldRunTests) {
      console.log('Skipping real LLM test. Set RUN_REAL_LLM_TESTS=true to run.');
      return;
    }
    
    const request = {
      description: 'Create a hello world program',
      inputs: ['source-code'],
      requiredOutputs: ['running-program'],
      allowableActions: [
        {
          type: 'create-file',
          inputs: ['source-code'],
          outputs: ['file-created']
        },
        {
          type: 'compile-program',
          inputs: ['file-created'],
          outputs: ['executable-created']
        },
        {
          type: 'run-program',
          inputs: ['executable-created'],
          outputs: ['running-program']
        }
      ]
    };
    
    console.log('🚀 Testing simple action sequence...');
    
    const plan = await planner.createPlan(request);
    
    expect(plan).toBeInstanceOf(Plan);
    expect(plan.name).toBeTruthy();
    
    // Verify action sequence
    const allActions = [];
    for (const step of plan.steps) {
      allActions.push(...step.getAllActions());
    }
    
    expect(allActions.length).toBeGreaterThan(0);
    
    // Verify only allowable actions are used
    const allowableTypes = request.allowableActions.map(a => a.type);
    for (const action of allActions) {
      expect(allowableTypes).toContain(action.type);
    }
    
    // Verify flow validation
    const flowValidation = plan.validateInputOutputFlow();
    expect(flowValidation.isValid).toBe(true);
    expect(flowValidation.availableOutputs).toContain('running-program');
    
    console.log(`✅ Simple plan: ${plan.name} with ${allActions.length} actions`);
    
  }, 30000); // 30 second timeout
  
  test('should handle complex dependencies', async () => {
    if (!shouldRunTests) {
      console.log('Skipping real LLM test. Set RUN_REAL_LLM_TESTS=true to run.');
      return;
    }
    
    const request = {
      description: 'Build a microservices system with API gateway',
      inputs: ['requirements'],
      requiredOutputs: ['microservices-system'],
      allowableActions: [
        {
          type: 'create-service',
          inputs: ['service-spec'],
          outputs: ['service-created']
        },
        {
          type: 'setup-database',
          inputs: ['db-config'],
          outputs: ['database-ready']
        },
        {
          type: 'setup-api-gateway',
          inputs: ['gateway-config'],
          outputs: ['api-gateway-ready']
        },
        {
          type: 'configure-routing',
          inputs: ['service-created', 'api-gateway-ready'],
          outputs: ['routing-configured']
        },
        {
          type: 'deploy-system',
          inputs: ['service-created', 'database-ready', 'routing-configured'],
          outputs: ['microservices-system']
        }
      ]
    };
    
    console.log('🚀 Testing complex dependencies...');
    
    const plan = await planner.createPlan(request);
    
    expect(plan).toBeInstanceOf(Plan);
    
    // Verify dependencies are handled correctly
    const validation = plan.validate();
    expect(validation.isValid).toBe(true);
    
    const flowValidation = plan.validateInputOutputFlow();
    expect(flowValidation.isValid).toBe(true);
    
    // Verify execution order is valid
    const executionOrder = plan.generateExecutionOrder();
    expect(executionOrder.length).toBeGreaterThan(0);
    
    // Verify no circular dependencies
    expect(plan.hasCircularDependencies()).toBe(false);
    
    console.log(`✅ Complex plan: ${plan.name} with ${plan.steps.length} steps`);
    
  }, 45000); // 45 second timeout
});