/**
 * @jest-environment node
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager } from '@jsenvoy/module-loader';
import { LLMClient } from '@jsenvoy/llm';
import GenericPlanner from '../../../../../llm-planner/src/GenericPlanner.js';

describe('Final Working Real LLM Test', () => {
  let resourceManager;
  let llmClient;
  let genericPlanner;
  
  beforeAll(async () => {
    console.log('🚀 Setting up final working test...');
    
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for real LLM tests');
    }
    
    llmClient = new LLMClient({
      provider: 'anthropic',
      apiKey: apiKey,
      model: 'claude-3-sonnet-20240229',
      maxRetries: 1
    });
    
    genericPlanner = new GenericPlanner({ llmClient });
    
    console.log('✅ Final working test initialized');
  });
  
  afterAll(async () => {
    console.log('🧹 Cleaning up final test resources...');
  });

  test('should successfully create and validate hierarchical plan with real LLM', async () => {
    
    console.log('🔍 Testing hierarchical plan creation with real LLM...');
    
    // Use simple actions that don't have complex input dependencies
    const allowableActions = [
      { 
        type: "analyze_project", 
        description: "Analyze the project requirements",
        inputs: ['requirements'],
        outputs: ['analysis_result']
      },
      { 
        type: "determine_complexity", 
        description: "Determine project complexity",
        inputs: ['analysis_result'],
        outputs: ['complexity_level']
      },
      { 
        type: "generate_summary", 
        description: "Generate final summary",
        inputs: ['analysis_result', 'complexity_level'],
        outputs: ['summary']
      }
    ];
    
    const planRequest = {
      description: "Create a hierarchical plan to analyze a todo list application",
      inputs: ['requirements'],
      requiredOutputs: ['summary'],
      allowableActions: allowableActions,
      maxSteps: 5
    };
    
    console.log('📋 Plan Request:');
    console.log('  Description:', planRequest.description);
    console.log('  Inputs:', planRequest.inputs);
    console.log('  Required Outputs:', planRequest.requiredOutputs);
    console.log('  Allowable Actions:', planRequest.allowableActions.map(a => a.type));
    
    try {
      console.log('\n🚀 Creating plan with real LLM...');
      const plan = await genericPlanner.createPlan(planRequest);
      
      console.log('\n✅ Plan created and validated successfully!');
      console.log('📄 Plan Summary:', {
        name: plan.name,
        description: plan.description,
        stepCount: plan.steps?.length || 0,
        inputs: plan.inputs,
        requiredOutputs: plan.requiredOutputs
      });
      
      // Verify plan structure
      expect(plan).toBeDefined();
      expect(plan.name).toBeDefined();
      expect(plan.steps).toBeDefined();
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.inputs).toEqual(['requirements']);
      expect(plan.requiredOutputs).toEqual(['summary']);
      
      // Check that hierarchical dependencies work
      console.log('\n📊 Plan Step Details:');
      const logStep = (step, indent = '  ') => {
        console.log(`${indent}Step: ${step.name} (${step.id})`);
        console.log(`${indent}  Actions: ${step.actions.map(a => a.type).join(', ')}`);
        console.log(`${indent}  Dependencies: ${step.dependencies?.join(', ') || 'none'}`);
        console.log(`${indent}  Inputs: ${step.getInputs().join(', ')}`);
        console.log(`${indent}  Outputs: ${step.getOutputs().join(', ')}`);
        
        if (step.steps && step.steps.length > 0) {
          console.log(`${indent}  Sub-steps:`);
          step.steps.forEach(substep => logStep(substep, indent + '    '));
        }
      };
      
      plan.steps.forEach(step => logStep(step));
      
      // Test hierarchical step lookup
      console.log('\n🔍 Testing hierarchical step lookup...');
      for (const step of plan.steps) {
        const foundStep = plan.getStep(step.id);
        expect(foundStep).toBeDefined();
        expect(foundStep.id).toBe(step.id);
        
        if (step.steps && step.steps.length > 0) {
          for (const substep of step.steps) {
            const foundSubstep = plan.getStep(substep.id);
            expect(foundSubstep).toBeDefined();
            expect(foundSubstep.id).toBe(substep.id);
            console.log(`    ✓ Found sub-step: ${substep.id}`);
          }
        }
      }
      
      console.log('\n🎉 Real LLM integration test passed completely!');
      console.log('✅ LLM API calls work');
      console.log('✅ Plan generation works');
      console.log('✅ Hierarchical validation works');
      console.log('✅ Step lookup works');
      console.log('✅ Input/output validation works');
      
    } catch (error) {
      console.log('\n❌ Test failed:', error.message);
      throw error;
    }
    
  }, 120000); // 2 minute timeout
});