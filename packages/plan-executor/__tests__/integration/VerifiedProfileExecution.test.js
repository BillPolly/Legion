/**
 * Integration test for executing plans generated with verified profiles
 * 
 * This test demonstrates the complete flow:
 * 1. Using a verified profile with real tool signatures
 * 2. Generating an executable plan  
 * 3. Executing the plan with real Legion tools
 */

import { jest } from '@jest/globals';
import { PlanExecutorModule } from '../../src/PlanExecutorModule.js';
import { ProfilePlannerModule } from '../../../profile-planner/src/ProfilePlannerModule.js';
import { ResourceManager, ModuleFactory } from '@legion/module-loader';
import FileModule from '../../../general-tools/src/file/FileModule.js';
import CommandExecutor from '../../../general-tools/src/command-executor/index.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Verified Profile Plan Execution', () => {
  let resourceManager;
  let moduleFactory;
  let profilePlannerModule;
  let planExecutorModule;
  let testDir;
  
  beforeAll(async () => {
    // Setup test directory
    testDir = path.join(os.tmpdir(), 'verified-profile-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    console.log(`\nTest directory: ${testDir}`);
    
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Create proper ModuleFactory
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
    // Cleanup test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });
  
  test('should generate and execute a JavaScript project plan', async () => {
    // Change to test directory
    const originalCwd = process.cwd();
    process.chdir(testDir);
    
    try {
      console.log(`\nWorking directory: ${process.cwd()}`);
      
      // Step 1: Generate a plan using the verified profile
      console.log('\n📋 Generating plan with verified profile...');
      
      const plannerTools = profilePlannerModule.getTools();
      const javascriptPlanner = plannerTools.find(t => t.name === 'javascript_dev_planner');
      
      expect(javascriptPlanner).toBeDefined();
      
      const planRequest = {
        function: {
          name: 'javascript_dev_planner',
          arguments: JSON.stringify({
            userRequest: 'Create a simple math utility module with add and subtract functions, and a test file that verifies both functions work correctly'
          })
        }
      };
      
      const planResult = await javascriptPlanner.invoke(planRequest);
      
      expect(planResult.success).toBe(true);
      expect(planResult.data.plan).toBeDefined();
      
      const plan = planResult.data.plan;
      console.log(`\nGenerated plan: ${plan.name}`);
      console.log(`Steps: ${plan.steps.length}`);
      console.log(`Total actions: ${plan.steps.reduce((sum, step) => sum + (step.actions?.length || 0), 0)}`);
      
      // Log the plan structure for debugging
      console.log('\nPlan structure:');
      for (const step of plan.steps) {
        console.log(`\nStep: ${step.name}`);
        if (step.actions) {
          for (const action of step.actions) {
            console.log(`  - Action: ${action.type}`);
            console.log(`    Tool: ${action.tool || 'N/A'}`);
            console.log(`    Function: ${action.function || 'N/A'}`);
          }
        }
      }
      
      // Step 2: Validate the plan
      console.log('\n✅ Validating plan...');
      
      const executorTools = planExecutorModule.getTools();
      const planInspectorTool = executorTools.find(t => t.name === 'plan_inspect');
      expect(planInspectorTool).toBeDefined();
      
      const validationRequest = {
        function: {
          name: 'plan_inspect',
          arguments: JSON.stringify({ 
            plan: plan,
            validateTools: true 
          })
        }
      };
      
      const validationResult = await planInspectorTool.invoke(validationRequest);
      
      console.log('Validation result:', validationResult.success);
      console.log('Plan is valid:', validationResult.data?.validation?.isValid);
      
      expect(validationResult.success).toBe(true);
      expect(validationResult.data.validation.isValid).toBe(true);
      
      // Mark plan as validated
      plan.status = 'validated';
      console.log('Plan marked as validated');
      
      // Step 3: Execute the plan
      console.log('\n🚀 Executing plan...');
      
      const planExecuteTool = executorTools.find(t => t.name === 'plan_execute');
      
      const executeRequest = {
        function: {
          name: 'plan_execute',
          arguments: JSON.stringify({ plan })
        }
      };
      
      const executeResult = await planExecuteTool.invoke(executeRequest);
      
      console.log(`\n📊 Execution Result:`);
      console.log(`Success: ${executeResult.success}`);
      if (executeResult.data) {
        console.log(`Status: ${executeResult.data.status}`);
        console.log(`Completed steps: ${executeResult.data.completedSteps}/${plan.steps.length}`);
      }
      
      if (!executeResult.success) {
        console.error('Error:', executeResult.error);
        console.error('Details:', JSON.stringify(executeResult.data, null, 2));
      }
      
      // Verify the execution succeeded
      expect(executeResult.success).toBe(true);
      expect(executeResult.data.status).toBe('completed');
      expect(executeResult.data.completedSteps).toBe(plan.steps.length);
      
      // Step 3: Verify the created files
      console.log('\n✅ Verifying created files...');
      
      // Check for created files and directories
      const entries = await fs.readdir(testDir);
      console.log('Created entries:', entries);
      
      // Should have created directories
      expect(entries.length).toBeGreaterThan(0);
      
      // Check if src directory exists
      expect(entries).toContain('src');
      
      // Check if test or tests directory exists
      const testDirName = entries.includes('test') ? 'test' : entries.includes('tests') ? 'tests' : null;
      expect(testDirName).toBeTruthy();
      
      // List files in src directory
      const srcFiles = await fs.readdir(path.join(testDir, 'src'));
      console.log('Files in src:', srcFiles);
      
      // List files in test directory
      const testFiles = await fs.readdir(path.join(testDir, testDirName));
      console.log(`Files in ${testDirName}:`, testFiles);
      
      // Find the main module file (could be calculator, math, etc)
      const moduleFile = srcFiles.find(f => f.endsWith('.js'));
      expect(moduleFile).toBeDefined();
      
      // Find the test file
      const testFile = testFiles.find(f => f.endsWith('.js'));
      expect(testFile).toBeDefined();
      
      // Read and verify module content
      if (moduleFile) {
        const moduleContent = await fs.readFile(path.join(testDir, 'src', moduleFile), 'utf8');
        console.log(`\n${moduleFile} content preview:`);
        console.log(moduleContent.substring(0, 200) + '...');
        
        // Should contain some function definitions
        expect(moduleContent).toMatch(/function|const.*=.*function|\w+\s*\(|\w+:\s*function/);
      }
      
      // Read and verify test file content
      if (testFile) {
        const testContent = await fs.readFile(path.join(testDir, testDirName, testFile), 'utf8');
        console.log(`\n${testFile} content preview:`);
        console.log(testContent.substring(0, 200) + '...');
        
        // Should contain test code
        expect(testContent).toMatch(/console\.log|test|require|import/);
      }
      
      // Step 4: Run the tests
      console.log('\n🧪 Running the generated tests...');
      
      const testCommand = `node ${testDirName}/${testFile}`;
      console.log(`Executing: ${testCommand}`);
      
      const commandExecutor = moduleFactory.createModule(CommandExecutor);
      const toolCall = {
        function: {
          name: 'command_executor_execute',
          arguments: JSON.stringify({ command: testCommand })
        }
      };
      const result = await commandExecutor.invoke(toolCall);
      
      console.log('\nTest output:');
      console.log(result.data.stdout);
      
      if (result.data.stderr) {
        console.log('Test errors:');
        console.log(result.data.stderr);
      }
      
      expect(result.success).toBe(true);
      // The output should contain test results (e.g., PASS, SUCCESS, or similar)
      expect(result.data.stdout.toLowerCase()).toMatch(/pass|success|✓|ok|test.*passed/);
      
    } finally {
      // Restore original working directory
      process.chdir(originalCwd);
    }
  }, 60000); // 60 second timeout for the complete flow
});