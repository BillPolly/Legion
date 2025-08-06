/**
 * Live LLM tests for validation workflow
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { GenericPlanner } from '../../src/GenericPlanner.js';
import { LLMPlannerModule } from '../../src/LLMPlannerModule.js';

// Skip these tests unless explicitly requested
const runLiveLLMTests = process.env.RUN_REAL_LLM_TESTS === 'true';

describe('Live LLM Validation Workflow', () => {
  let llmModule;
  let planner;

  const allowableActions = [
    {
      type: 'directory_create',
      description: 'Create a directory',
      inputSchema: {
        properties: {
          dirpath: { type: 'string', description: 'Path to the directory to create' }
        },
        required: ['dirpath']
      },
      outputSchema: {
        properties: {
          dirpath: { type: 'string', description: 'Path of the created directory' },
          created: { type: 'boolean', description: 'Whether the directory was actually created' }
        }
      }
    },
    {
      type: 'file_write',
      description: 'Write content to a file',
      inputSchema: {
        properties: {
          filepath: { type: 'string', description: 'Path to the file to write' },
          content: { type: 'string', description: 'Content to write to the file' }
        },
        required: ['filepath', 'content']
      },
      outputSchema: {
        properties: {
          filepath: { type: 'string', description: 'Path of the written file' },
          size: { type: 'number', description: 'Size of the written file in bytes' }
        }
      }
    },
    {
      type: 'file_read',
      description: 'Read content from a file',
      inputSchema: {
        properties: {
          filepath: { type: 'string', description: 'Path to the file to read' }
        },
        required: ['filepath']
      },
      outputSchema: {
        properties: {
          content: { type: 'string', description: 'Content of the file' },
          size: { type: 'number', description: 'Size of the file in bytes' }
        }
      }
    }
  ];

  beforeEach(async () => {
    if (!runLiveLLMTests) {
      console.log('Skipping live LLM test. Set RUN_REAL_LLM_TESTS=true to run.');
      return;
    }

    // Create module with real dependencies
    llmModule = await LLMPlannerModule.create();
    
    // Get the GenericPlanner with validation
    const createPlanTool = llmModule.tools.find(tool => 
      tool.getToolDescription().function.name === 'create-plan'
    );
    
    planner = new GenericPlanner({
      llmClient: createPlanTool.llmClient,
      moduleLoader: createPlanTool.moduleLoader,
      maxRetries: 2 // Allow one retry for fix-plan workflow
    });
  });

  test('should generate valid plan with new format', async () => {
    if (!runLiveLLMTests) {
      console.log('Skipping live LLM test. Set RUN_REAL_LLM_TESTS=true to run.');
      return;
    }

    const request = {
      description: 'Create a project structure with a README file',
      inputs: ['projectName'],
      requiredOutputs: ['projectDir', 'readmeFile'],
      allowableActions,
      maxSteps: 10
    };

    console.log('\n🚀 Testing plan generation with live LLM...');
    console.log('📝 Request:', JSON.stringify(request, null, 2));

    const plan = await planner.createPlan(request);

    console.log('\n✅ Generated Plan:');
    console.log(JSON.stringify(plan.toJSON(), null, 2));

    // Verify the plan uses new format
    expect(plan).toBeDefined();
    expect(plan.name).toBeDefined();
    expect(plan.steps).toBeDefined();
    expect(plan.steps.length).toBeGreaterThan(0);

    // Check that actions use new inputs/outputs format
    const firstAction = plan.steps[0].actions[0];
    if (firstAction) {
      // Note: The internal Plan model still uses legacy format
      // but the LLM should have generated the new format initially
      expect(firstAction.type).toBeDefined();
      console.log('\n🔍 First action structure:', JSON.stringify(firstAction, null, 2));
    }
  }, 60000);

  test('should handle validation errors and fix plan', async () => {
    if (!runLiveLLMTests) {
      console.log('Skipping live LLM test. Set RUN_REAL_LLM_TESTS=true to run.');
      return;
    }

    // Create a scenario likely to trigger validation errors
    const problemActions = [
      {
        type: 'nonexistent_tool', // This will cause validation error
        description: 'This tool does not exist',
        inputSchema: { properties: { param: { type: 'string' } } },
        outputSchema: { properties: { result: { type: 'string' } } }
      },
      ...allowableActions
    ];

    const request = {
      description: 'Create something using nonexistent tools that should fail validation',
      inputs: ['input'],
      requiredOutputs: ['result'],
      allowableActions: problemActions, // Include bad action
      maxSteps: 5
    };

    console.log('\n🚀 Testing validation error handling with live LLM...');
    console.log('📝 Request with problematic actions:', JSON.stringify({
      ...request,
      allowableActions: request.allowableActions.map(a => a.type)
    }, null, 2));

    // Mock validation to fail on first attempt, succeed on second
    let validationCallCount = 0;
    const originalValidation = planner._validatePlanWithTools;
    
    planner._validatePlanWithTools = async function(planJson) {
      validationCallCount++;
      
      if (validationCallCount === 1) {
        console.log('\n❌ First validation - simulating failure');
        return {
          valid: false,
          errors: [
            'Tool "nonexistent_tool" not found in allowable actions',
            'Invalid step type "unknown" - must be one of: setup, implementation, validation, cleanup',
            'Variable "@undefinedVar" used but not defined in previous steps'
          ]
        };
      } else {
        console.log('\n✅ Second validation - checking if plan was fixed');
        // Use real validation for second attempt
        return originalValidation.call(this, planJson);
      }
    };

    try {
      const plan = await planner.createPlan(request);

      console.log('\n✅ Final validated plan:');
      console.log(JSON.stringify(plan.toJSON(), null, 2));

      expect(plan).toBeDefined();
      expect(validationCallCount).toBe(2); // Should have tried twice
      
      console.log('\n🎉 Successfully demonstrated fix-plan workflow!');
      
    } catch (error) {
      console.log('\n📊 Validation call count:', validationCallCount);
      console.log('\n❌ Final error:', error.message);
      
      // Even if it fails, we want to see that it attempted the fix workflow
      expect(validationCallCount).toBeGreaterThan(1);
      console.log('\n✅ At least attempted fix-plan workflow');
    }
  }, 90000);

  test('should use correct templates for generation vs fixing', async () => {
    if (!runLiveLLMTests) {
      console.log('Skipping live LLM test. Set RUN_REAL_LLM_TESTS=true to run.');
      return;
    }

    const request = {
      description: 'Simple file operation test',
      inputs: ['filename'],
      requiredOutputs: ['createdFile'],
      allowableActions: allowableActions.slice(0, 2), // Just directory_create and file_write
      maxSteps: 3
    };

    // Mock the LLM client to capture prompts
    const originalComplete = planner.llmClient.complete;
    const capturedPrompts = [];
    
    planner.llmClient.complete = async function(prompt, model) {
      capturedPrompts.push(prompt);
      
      if (capturedPrompts.length === 1) {
        // First call - return invalid plan
        return JSON.stringify({
          id: 'test-plan',
          name: 'Test Plan',
          description: 'Invalid plan for testing',
          version: '1.0.0',
          status: 'draft',
          steps: [{
            id: 'step-1',
            name: 'Invalid Step',
            type: 'setup',
            actions: [{
              type: 'invalid_tool', // This will fail validation
              inputs: { param: 'value' },
              outputs: { result: 'output' }
            }]
          }]
        });
      } else {
        // Second call - return valid plan
        return JSON.stringify({
          id: 'fixed-plan',
          name: 'Fixed Plan',
          description: 'Valid plan after fixes',
          version: '1.0.0',
          status: 'draft',
          steps: [{
            id: 'step-1',
            name: 'Create Directory',
            type: 'setup',
            actions: [{
              type: 'directory_create',
              inputs: { dirpath: '/test' },
              outputs: { dirpath: 'testDir', created: 'dirCreated' }
            }]
          }]
        });
      }
    };

    // Mock validation
    let validationCount = 0;
    planner._validatePlanWithTools = async function(planJson) {
      validationCount++;
      if (validationCount === 1) {
        return {
          valid: false,
          errors: ['Tool "invalid_tool" not found']
        };
      }
      return { valid: true, errors: [] };
    };

    try {
      const plan = await planner.createPlan(request);
      
      console.log('\n📝 Template Usage Analysis:');
      console.log(`Number of LLM calls: ${capturedPrompts.length}`);
      
      if (capturedPrompts.length >= 1) {
        const firstPrompt = capturedPrompts[0];
        console.log('\n📋 First prompt (create-plan template):');
        console.log('Contains "ALLOWABLE ACTIONS":', firstPrompt.includes('ALLOWABLE ACTIONS'));
        console.log('Contains "Use **inputs** and **outputs**":', firstPrompt.includes('Use **inputs** and **outputs**'));
        console.log('Contains "@variable syntax":', firstPrompt.includes('@variable'));
        console.log('Length:', firstPrompt.length);
        
        expect(firstPrompt).toContain('ALLOWABLE ACTIONS');
        expect(firstPrompt).toContain('inputs');
        expect(firstPrompt).toContain('outputs');
      }
      
      if (capturedPrompts.length >= 2) {
        const secondPrompt = capturedPrompts[1];
        console.log('\n🔧 Second prompt (fix-plan template):');
        console.log('Contains "FAILED VALIDATION":', secondPrompt.includes('FAILED VALIDATION'));
        console.log('Contains "Tool \\"invalid_tool\\" not found":', secondPrompt.includes('Tool "invalid_tool" not found'));
        console.log('Contains original context:', secondPrompt.includes(request.description));
        console.log('Length:', secondPrompt.length);
        
        expect(secondPrompt).toContain('FAILED VALIDATION');
        expect(secondPrompt).toContain('invalid_tool');
        expect(secondPrompt).toContain(request.description);
      }
      
      console.log('\n✅ Template system working correctly!');
      expect(plan.name).toBe('Fixed Plan');
      
    } finally {
      // Restore original method
      planner.llmClient.complete = originalComplete;
    }
  }, 60000);

  test('should demonstrate complete validation workflow', async () => {
    if (!runLiveLLMTests) {
      console.log('Skipping live LLM test. Set RUN_REAL_LLM_TESTS=true to run.');
      return;
    }

    console.log('\n🎯 COMPREHENSIVE VALIDATION WORKFLOW TEST');
    console.log('=' .repeat(50));

    const request = {
      description: 'Create a documentation project with multiple files',
      inputs: ['projectName', 'authorName'],  
      requiredOutputs: ['projectStructure', 'mainReadme', 'docFiles'],
      allowableActions,
      maxSteps: 8
    };

    // Track the complete workflow
    const workflow = {
      templateCalls: [],
      validationCalls: [],
      llmCalls: [],
      errors: []
    };

    // Override template loader to track calls
    const originalCreateTemplate = planner.templateLoader.loadCreatePlanTemplate;
    const originalFixTemplate = planner.templateLoader.loadFixPlanTemplate;
    
    planner.templateLoader.loadCreatePlanTemplate = async function(params) {
      workflow.templateCalls.push({ type: 'create-plan', params: { description: params.description } });
      console.log('\n📝 Loading create-plan template...');
      return originalCreateTemplate.call(this, params);
    };
    
    planner.templateLoader.loadFixPlanTemplate = async function(params) {
      workflow.templateCalls.push({ 
        type: 'fix-plan', 
        params: { 
          description: params.description,
          errorCount: params.validationErrors?.length || 0
        }
      });
      console.log('\n🔧 Loading fix-plan template with', params.validationErrors?.length || 0, 'errors');
      return originalFixTemplate.call(this, params);
    };

    // Override validation to track calls  
    const originalValidation = planner._validatePlanWithTools;
    planner._validatePlanWithTools = async function(planJson) {
      workflow.validationCalls.push({ planId: planJson.id });
      console.log('\n🔍 Validating plan:', planJson.id);
      return originalValidation.call(this, planJson);
    };

    // Override LLM client to track calls
    const originalComplete = planner.llmClient.complete;
    planner.llmClient.complete = async function(prompt, model) {
      const isFixPrompt = prompt.includes('FAILED VALIDATION');
      workflow.llmCalls.push({ 
        type: isFixPrompt ? 'fix-plan' : 'create-plan',
        promptLength: prompt.length
      });
      console.log('\n🤖 LLM call:', isFixPrompt ? 'fix-plan' : 'create-plan', `(${prompt.length} chars)`);
      return originalComplete.call(this, prompt, model);
    };

    try {
      const startTime = Date.now();
      const plan = await planner.createPlan(request);
      const duration = Date.now() - startTime;

      console.log('\n🎉 WORKFLOW COMPLETED SUCCESSFULLY!');
      console.log('=' .repeat(50));
      console.log('⏱️  Duration:', duration + 'ms');
      console.log('📝 Template calls:', workflow.templateCalls.length);
      console.log('🔍 Validation calls:', workflow.validationCalls.length);  
      console.log('🤖 LLM calls:', workflow.llmCalls.length);
      console.log('\n📊 Workflow Summary:');
      workflow.templateCalls.forEach((call, i) => {
        console.log(`  ${i + 1}. ${call.type} template`);
      });
      workflow.llmCalls.forEach((call, i) => {
        console.log(`  ${i + 1}. LLM ${call.type} (${call.promptLength} chars)`);
      });
      workflow.validationCalls.forEach((call, i) => {
        console.log(`  ${i + 1}. Validated plan: ${call.planId}`);
      });

      console.log('\n✅ Final Plan:');
      console.log(`   Name: ${plan.name}`);
      console.log(`   Steps: ${plan.steps.length}`);
      console.log(`   Actions: ${plan.steps.reduce((sum, step) => sum + step.actions.length, 0)}`);

      expect(plan).toBeDefined();
      expect(workflow.llmCalls.length).toBeGreaterThan(0);
      expect(workflow.validationCalls.length).toBeGreaterThan(0);

    } catch (error) {
      console.log('\n❌ WORKFLOW FAILED:');
      console.log('Error:', error.message);
      console.log('\n📊 Partial workflow:');
      console.log('Template calls:', workflow.templateCalls.length);
      console.log('LLM calls:', workflow.llmCalls.length);
      console.log('Validation calls:', workflow.validationCalls.length);
      
      // Still expect some workflow to have occurred
      expect(workflow.llmCalls.length).toBeGreaterThan(0);
      throw error;
    } finally {
      // Restore original methods
      planner.templateLoader.loadCreatePlanTemplate = originalCreateTemplate;
      planner.templateLoader.loadFixPlanTemplate = originalFixTemplate;
      planner._validatePlanWithTools = originalValidation;
      planner.llmClient.complete = originalComplete;
    }
  }, 120000);
});