/**
 * Live test to generate a plan and execute it
 */

import { jest } from '@jest/globals';
import { PlanExecutorModule } from '../../src/PlanExecutorModule.js';
import { ProfilePlannerModule } from '../../../profile-planner/src/ProfilePlannerModule.js';
import { ResourceManager, ModuleFactory } from '@legion/module-loader';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Generate and Execute Plan', () => {
  let resourceManager;
  let moduleFactory;
  let profilePlannerModule;
  let planExecutorModule;
  let testDir;
  
  beforeAll(async () => {
    // Setup test directory - use fixed name so we can find it
    testDir = path.join(os.tmpdir(), 'generate-execute-plan-test');
    
    // Clean up any previous test run
    try {
      await fs.rm(testDir, { recursive: true, force: true });
      console.log(`\nCleaned up previous test directory`);
    } catch (err) {
      // Directory might not exist, that's fine
    }
    
    await fs.mkdir(testDir, { recursive: true });
    console.log(`\nTest directory: ${testDir}`);
    
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Create ModuleFactory
    moduleFactory = new ModuleFactory(resourceManager);
    
    // Initialize ProfilePlannerModule
    profilePlannerModule = new ProfilePlannerModule({ resourceManager });
    await profilePlannerModule.initialize();
    
    // Initialize PlanExecutorModule
    planExecutorModule = new PlanExecutorModule({ 
      resourceManager, 
      moduleFactory 
    });
  });
  
  afterAll(async () => {
    // Don't cleanup - leave files for inspection
    console.log(`\nTest files left in: ${testDir}`);
    console.log('You can inspect the generated files there.');
  });
  
  test('should generate and execute a real plan', async () => {
    // Change to test directory
    const originalCwd = process.cwd();
    process.chdir(testDir);
    
    try {
      // Step 1: Generate a plan
      console.log('\n=== Generating Plan ===');
      
      const plannerTools = profilePlannerModule.getTools();
      const javascriptPlanner = plannerTools.find(t => t.name === 'javascript_dev_planner');
      
      expect(javascriptPlanner).toBeDefined();
      
      const planRequest = {
        function: {
          name: 'javascript_dev_planner',
          arguments: JSON.stringify({
            userRequest: 'Create a Node.js module called utils.js with two functions: double(n) that returns n*2 and isEven(n) that returns true if n is even. Also create a test.js file that tests both functions.'
          })
        }
      };
      
      console.log('Calling planner...');
      const planResult = await javascriptPlanner.invoke(planRequest);
      
      if (!planResult.success) {
        console.error('Plan generation failed:', planResult.error);
        throw new Error('Failed to generate plan');
      }
      
      const plan = planResult.data.plan;
      console.log('\nGenerated plan:', plan.name);
      console.log('Plan ID:', plan.id);
      console.log('Total steps:', plan.steps.length);
      
      // Log plan structure
      console.log('\nPlan structure:');
      for (const step of plan.steps) {
        console.log(`\nStep ${step.id}: ${step.name}`);
        if (step.actions) {
          for (const action of step.actions) {
            console.log(`  Action: ${action.type}`);
            console.log(`    Tool: ${action.tool}`);
            console.log(`    Function: ${action.function}`);
            console.log(`    Parameters:`, JSON.stringify(action.parameters));
          }
        }
      }
      
      // Step 2: Execute the plan
      console.log('\n=== Executing Plan ===');
      
      const executorTools = planExecutorModule.getTools();
      const planExecuteTool = executorTools.find(t => t.name === 'plan_execute');
      
      expect(planExecuteTool).toBeDefined();
      
      const executeRequest = {
        function: {
          name: 'plan_execute',
          arguments: JSON.stringify({ plan })
        }
      };
      
      console.log('Calling executor...');
      const executeResult = await planExecuteTool.invoke(executeRequest);
      
      console.log('\nExecution result:');
      console.log('Success:', executeResult.success);
      console.log('Status:', executeResult.data.status);
      console.log('Completed steps:', executeResult.data.completedSteps);
      console.log('Failed steps:', executeResult.data.failedSteps);
      
      if (!executeResult.success) {
        console.error('\nExecution failed!');
        console.error('Error:', executeResult.error);
        console.error('Data:', JSON.stringify(executeResult.data, null, 2));
        throw new Error('Plan execution failed');
      }
      
      // Step 3: Verify the results
      console.log('\n=== Verifying Results ===');
      
      const entries = await fs.readdir(testDir);
      console.log('Created entries:', entries);
      
      // Check for expected directories
      const hasSource = entries.some(e => e === 'src' || e === 'lib');
      const hasTests = entries.some(e => e === 'test' || e === 'tests');
      
      console.log('Has source directory:', hasSource);
      console.log('Has test directory:', hasTests);
      
      expect(hasSource).toBe(true);
      expect(hasTests).toBe(true);
      
      // Find and verify files
      const sourceDir = entries.find(e => e === 'src' || e === 'lib');
      const testDirName = entries.find(e => e === 'test' || e === 'tests');
      
      const sourceFiles = await fs.readdir(path.join(process.cwd(), sourceDir));
      const testFiles = await fs.readdir(path.join(process.cwd(), testDirName));
      
      console.log(`\nFiles in ${sourceDir}:`, sourceFiles);
      console.log(`Files in ${testDirName}:`, testFiles);
      
      // Read and display a source file
      if (sourceFiles.length > 0) {
        const sourceFile = sourceFiles[0];
        const content = await fs.readFile(path.join(process.cwd(), sourceDir, sourceFile), 'utf8');
        console.log(`\nContent of ${sourceFile}:`);
        console.log(content.substring(0, 500) + (content.length > 500 ? '...' : ''));
        
        // Verify it contains some function definitions
        expect(content).toMatch(/function|const.*=|module\.exports/);
      }
      
      console.log('\n✅ Plan execution completed successfully!');
      
    } finally {
      // Restore original working directory
      process.chdir(originalCwd);
    }
  }, 60000); // 60 second timeout
});