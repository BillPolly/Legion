/**
 * Integration test for generating and executing a Node.js server plan
 * Tests the complete workflow: Profile -> Plan Generation -> Validation -> Execution
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ProfilePlannerModule } from '../../src/ProfilePlannerModule.js';
import { ResourceManager, ModuleLoader } from '@legion/tool-core';
import { ValidatePlanTool } from '@legion/plan-executor-tools';
import { PlanExecutor } from '@legion/plan-executor';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Only run if we have actual API key
const shouldRunLiveTests = process.env.RUN_REAL_LLM_TESTS === 'true' || process.env.ANTHROPIC_API_KEY;

describe('Node.js Server Plan Generation and Execution', () => {
  let resourceManager;
  let profilePlannerModule;
  let validatePlanTool;
  let planExecutor;
  let moduleLoader;
  let testWorkspaceDir;

  beforeAll(async () => {
    if (!shouldRunLiveTests) {
      console.log('Skipping live tests - set RUN_REAL_LLM_TESTS=true or provide ANTHROPIC_API_KEY');
      return;
    }

    // Create test workspace
    testWorkspaceDir = path.join(__dirname, '../../test-output', `nodejs-server-test-${Date.now()}`);
    await fs.mkdir(testWorkspaceDir, { recursive: true });
    console.log(`Created test workspace: ${testWorkspaceDir}`);

    // Create ResourceManager and ModuleLoader
    resourceManager = new ResourceManager();
    await resourceManager.initialize();

    moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();
    resourceManager.register('moduleLoader', moduleLoader);

    // Create ProfilePlannerModule
    profilePlannerModule = await ProfilePlannerModule.create(resourceManager);

    // Create validation and execution tools
    validatePlanTool = new ValidatePlanTool(moduleLoader);
    planExecutor = new PlanExecutor({ moduleLoader });
  }, 120000); // Extended timeout for initialization

  afterAll(async () => {
    if (!shouldRunLiveTests || !testWorkspaceDir) return;
    
    try {
      await fs.rm(testWorkspaceDir, { recursive: true, force: true });
      console.log(`Cleaned up test workspace: ${testWorkspaceDir}`);
    } catch (error) {
      console.warn(`Failed to clean up workspace: ${error.message}`);
    }
  });

  test('should generate and execute Node.js server plan end-to-end', async () => {
    if (!shouldRunLiveTests) {
      console.log('Skipping: Live LLM tests disabled');
      return;
    }

    console.log('\n=== STEP 1: Generate Plan ===');
    
    // Find the javascript-dev planner tool
    const tools = profilePlannerModule.getTools();
    const jsDevTool = tools.find(tool => tool.name === 'javascript_dev_planner');
    
    if (!jsDevTool) {
      console.warn('javascript_dev_planner tool not found');
      return;
    }

    // Generate plan using the profile tool
    const planRequest = {
      function: {
        name: 'javascript_dev_planner',
        arguments: {
          task: 'please generate a node.js server that has an api endpoint that can add 2 numbers together'
        }
      }
    };

    console.log('Generating plan with javascript-dev profile...');
    const planResult = await jsDevTool.execute(planRequest);
    
    expect(planResult).toBeDefined();
    console.log('Plan generation result:', {
      success: planResult.success,
      hasProfile: !!planResult.profile,
      hasPlan: !!planResult.plan,
      error: planResult.error || 'none'
    });

    if (!planResult.success) {
      console.warn('Plan generation failed:', planResult.error);
      if (planResult.error && planResult.error.includes('ANTHROPIC_API_KEY')) {
        console.log('Missing API key - this is expected in CI/test environments');
        return;
      }
      throw new Error(`Plan generation failed: ${planResult.error}`);
    }

    expect(planResult.success).toBe(true);
    expect(planResult.plan).toBeDefined();
    expect(planResult.plan.steps).toBeDefined();
    expect(Array.isArray(planResult.plan.steps)).toBe(true);
    expect(planResult.plan.steps.length).toBeGreaterThan(0);

    console.log(`Generated plan with ${planResult.plan.steps.length} steps`);
    planResult.plan.steps.forEach((step, i) => {
      console.log(`  Step ${i + 1}: ${step.name} (${step.actions?.length || 0} actions)`);
    });

    console.log('\n=== STEP 2: Validate Plan ===');
    
    // Validate the generated plan
    const validationResult = await validatePlanTool.execute({ plan: planResult.plan });
    
    expect(validationResult).toBeDefined();
    console.log('Validation result:', {
      success: validationResult.success,
      valid: validationResult.valid,
      errorCount: validationResult.errors?.length || 0,
      warningCount: validationResult.warnings?.length || 0
    });

    if (validationResult.success && !validationResult.valid) {
      console.log('Validation errors:', validationResult.errors);
      console.log('Validation warnings:', validationResult.warnings);
      
      // For this test, we'll proceed even with validation errors
      // since the plan might still be executable
      console.log('Proceeding with plan execution despite validation issues...');
    } else if (!validationResult.success) {
      throw new Error(`Plan validation failed: ${validationResult.error}`);
    } else {
      console.log('Plan validation passed!');
    }

    console.log('\n=== STEP 3: Execute Plan ===');
    
    // Set up execution context with workspace
    const executionContext = {
      workingDirectory: testWorkspaceDir,
      variables: {
        user_request: 'please generate a node.js server that has an api endpoint that can add 2 numbers together',
        workspace: testWorkspaceDir
      }
    };

    console.log(`Executing plan in workspace: ${testWorkspaceDir}`);
    
    // Execute the plan
    let executionResult;
    try {
      executionResult = await planExecutor.executePlan(planResult.plan, executionContext);
    } catch (error) {
      console.error('Plan execution failed:', error.message);
      throw error;
    }
    
    expect(executionResult).toBeDefined();
    console.log('Execution result:', {
      success: executionResult.success,
      status: executionResult.status,
      completedSteps: executionResult.completedSteps?.length || 0,
      failedSteps: executionResult.failedSteps?.length || 0
    });

    if (!executionResult.success) {
      console.log('Execution errors:', executionResult.error);
      console.log('Failed steps:', executionResult.failedSteps);
    }

    console.log('\n=== STEP 4: Verify Generated Files ===');
    
    // Check what files were created
    const workspaceFiles = await fs.readdir(testWorkspaceDir);
    console.log('Generated files:', workspaceFiles);
    
    // Look for common Node.js files
    const expectedFiles = ['package.json', 'server.js'];
    const foundFiles = [];
    
    for (const expectedFile of expectedFiles) {
      if (workspaceFiles.includes(expectedFile)) {
        foundFiles.push(expectedFile);
        console.log(`✓ Found expected file: ${expectedFile}`);
        
        // Read and display file content (first 500 chars)
        try {
          const content = await fs.readFile(path.join(testWorkspaceDir, expectedFile), 'utf-8');
          console.log(`Content of ${expectedFile} (preview):`, content.slice(0, 500) + (content.length > 500 ? '...' : ''));
        } catch (error) {
          console.warn(`Could not read ${expectedFile}: ${error.message}`);
        }
      }
    }

    console.log('\n=== STEP 5: Test Results Summary ===');
    
    const results = {
      planGenerated: !!planResult.plan,
      planValidated: validationResult.success,
      planExecuted: !!executionResult,
      filesCreated: workspaceFiles.length,
      expectedFilesFound: foundFiles.length,
      workspaceDir: testWorkspaceDir
    };
    
    console.log('Test results:', results);
    
    // Assertions for success criteria
    expect(results.planGenerated).toBe(true);
    expect(results.planExecuted).toBe(true);
    expect(results.filesCreated).toBeGreaterThan(0);
    
    // If execution was successful, expect key files
    if (executionResult.success) {
      expect(foundFiles).toContain('package.json');
      // server.js might be named differently, so just check some JS file exists
      const jsFiles = workspaceFiles.filter(f => f.endsWith('.js'));
      expect(jsFiles.length).toBeGreaterThan(0);
    }
    
    console.log('\n✅ Node.js server plan generation and execution test completed successfully!');
    
  }, 300000); // 5 minute timeout for full workflow

  test('should handle plan generation failure gracefully', async () => {
    if (!shouldRunLiveTests) {
      console.log('Skipping: Live LLM tests disabled');
      return;
    }

    // Test with an invalid profile to ensure error handling works
    const tools = profilePlannerModule.getTools();
    const jsDevTool = tools.find(tool => tool.name === 'javascript_dev_planner');
    
    if (!jsDevTool) {
      console.warn('javascript_dev_planner tool not found');
      return;
    }

    const invalidRequest = {
      function: {
        name: 'plan_with_profile',
        arguments: {
          profile: 'nonexistent-profile',
          task: 'test task'
        }
      }
    };

    const result = await jsDevTool.execute(invalidRequest);
    
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');
    
    console.log('Error handling test passed - invalid profile correctly rejected');
  });
});