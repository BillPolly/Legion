/**
 * Test that generates a plan, executes it, and saves all results
 */

import { jest } from '@jest/globals';
import { PlanExecutorModule } from '../../src/PlanExecutorModule.js';
import { ProfilePlannerModule } from '../../../profile-planner/src/ProfilePlannerModule.js';
import { ResourceManager, ModuleFactory } from '@legion/module-loader';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Plan Generation and Execution', () => {
  let resourceManager;
  let moduleFactory;
  let profilePlannerModule;
  let planExecutorModule;
  let tmpDir;
  
  beforeAll(async () => {
    // Setup tmp directory within test folder
    tmpDir = path.join(__dirname, '..', 'tmp', 'plan-execution-test');
    
    // Clean up any previous test run
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
      console.log(`\nCleaned up previous test directory`);
    } catch (err) {
      // Directory might not exist, that's fine
    }
    
    // Create fresh tmp directory
    await fs.mkdir(tmpDir, { recursive: true });
    console.log(`\nTest directory: ${tmpDir}`);
    
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
    console.log(`\n📁 Test artifacts saved in: ${tmpDir}`);
    console.log('You can inspect:');
    console.log('  - generated-plan.json (the plan)');
    console.log('  - execution-result.json (execution results)');
    console.log('  - project/ (generated code)');
    console.log('  - test-output.txt (test execution output)');
  });
  
  test('should generate a plan, execute it, and save all results', async () => {
    // Create project directory within tmp
    const projectDir = path.join(tmpDir, 'project');
    await fs.mkdir(projectDir, { recursive: true });
    
    // Change to project directory for execution
    const originalCwd = process.cwd();
    process.chdir(projectDir);
    
    try {
      // Step 1: Generate a plan
      console.log('\n=== Step 1: Generating Plan ===');
      
      const plannerTools = profilePlannerModule.getTools();
      const javascriptPlanner = plannerTools.find(t => t.name === 'javascript_dev_planner');
      
      expect(javascriptPlanner).toBeDefined();
      
      const planRequest = {
        function: {
          name: 'javascript_dev_planner',
          arguments: JSON.stringify({
            userRequest: 'Create a Node.js utility module with two functions: double(n) that returns n*2 and isEven(n) that returns true if n is even. Create the module in src/utils.js. Also create a test file test/utils.test.js that tests both functions with multiple test cases.'
          })
        }
      };
      
      console.log('Generating plan for:', JSON.parse(planRequest.function.arguments).userRequest);
      const planResult = await javascriptPlanner.invoke(planRequest);
      
      expect(planResult.success).toBe(true);
      
      const plan = planResult.data.plan;
      console.log(`\nGenerated plan: ${plan.name}`);
      console.log(`Plan ID: ${plan.id}`);
      console.log(`Total steps: ${plan.steps.length}`);
      console.log(`Total actions: ${plan.steps.reduce((sum, step) => sum + (step.actions?.length || 0), 0)}`);
      
      // Save the plan
      const planPath = path.join(tmpDir, 'generated-plan.json');
      await fs.writeFile(planPath, JSON.stringify(plan, null, 2));
      console.log(`\nPlan saved to: generated-plan.json`);
      
      // Step 2: Validate the plan
      console.log('\n=== Step 2: Validating Plan ===');
      
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
      
      console.log('Validating plan...');
      const validationResult = await planInspectorTool.invoke(validationRequest);
      
      console.log('Validation result:', validationResult.success);
      expect(validationResult.success).toBe(true);
      expect(validationResult.data.validation.isValid).toBe(true);
      
      // Mark plan as validated
      plan.status = 'validated';
      console.log('Plan marked as validated');
      
      // Step 3: Execute the plan
      console.log('\n=== Step 3: Executing Plan ===');
      
      const planExecuteTool = executorTools.find(t => t.name === 'plan_execute');
      
      expect(planExecuteTool).toBeDefined();
      
      const executeRequest = {
        function: {
          name: 'plan_execute',
          arguments: JSON.stringify({ plan })
        }
      };
      
      console.log('Executing plan...');
      const executeResult = await planExecuteTool.invoke(executeRequest);
      
      // Log execution summary
      console.log('\n📊 Execution Summary:');
      console.log(`Success: ${executeResult.success}`);
      console.log(`Status: ${executeResult.data.status}`);
      console.log(`Completed steps: ${executeResult.data.completedSteps}/${plan.steps.length}`);
      console.log(`Failed steps: ${executeResult.data.failedSteps}`);
      
      // Save execution result
      const resultPath = path.join(tmpDir, 'execution-result.json');
      await fs.writeFile(resultPath, JSON.stringify(executeResult, null, 2));
      console.log(`\nExecution result saved to: execution-result.json`);
      
      // With the fixed profile, execution should now succeed
      if (!executeResult.success) {
        console.log('\n🚨 Plan execution failed!');
        console.log('Error:', executeResult.error);
        console.log('Failed steps:', executeResult.data.failedSteps);
      }
      expect(executeResult.success).toBe(true);
      expect(executeResult.data.status).toBe('completed');
      
      // Step 4: Verify generated files
      console.log('\n=== Step 4: Verifying Generated Files ===');
      
      const files = await fs.readdir(projectDir);
      console.log('Project root contains:', files);
      
      // Check for expected directories
      expect(files).toContain('src');
      const hasTests = files.includes('test') || files.includes('tests');
      expect(hasTests).toBe(true);
      
      // List all generated files
      const srcFiles = await fs.readdir(path.join(projectDir, 'src'));
      const testDir = files.includes('test') ? 'test' : 'tests';
      const testFiles = await fs.readdir(path.join(projectDir, testDir));
      
      console.log('\nGenerated files:');
      console.log('  src/', srcFiles);
      console.log(`  ${testDir}/`, testFiles);
      
      // Step 4: Run the generated tests and save output
      console.log('\n=== Step 4: Running Generated Tests ===');
      
      // Find test file
      const testFile = testFiles.find(f => f.endsWith('.test.js'));
      expect(testFile).toBeDefined();
      
      // Run the test using command executor
      const commandExecutor = moduleFactory.createModule((await import('../../../general-tools/src/command-executor/index.js')).default);
      const testCommand = `node ${testDir}/${testFile}`;
      
      console.log(`Running: ${testCommand}`);
      
      const toolCall = {
        function: {
          name: 'command_executor_execute',
          arguments: JSON.stringify({ command: testCommand })
        }
      };
      
      const testResult = await commandExecutor.invoke(toolCall);
      
      // Save test output
      const testOutputPath = path.join(tmpDir, 'test-output.txt');
      const testOutput = `Command: ${testCommand}\n\nOutput:\n${testResult.data.stdout}\n\nErrors:\n${testResult.data.stderr || 'None'}\n\nExit Code: ${testResult.data.exitCode}`;
      await fs.writeFile(testOutputPath, testOutput);
      console.log(`\nTest output saved to: test-output.txt`);
      
      // Display test results
      console.log('\n📝 Test Results:');
      console.log(testResult.data.stdout);
      
      expect(testResult.success).toBe(true);
      expect(testResult.data.stdout).toContain('PASS');
      
      // Step 5: Create summary report
      console.log('\n=== Step 5: Creating Summary Report ===');
      
      const summary = {
        timestamp: new Date().toISOString(),
        plan: {
          id: plan.id,
          name: plan.name,
          totalSteps: plan.steps.length,
          totalActions: plan.steps.reduce((sum, step) => sum + (step.actions?.length || 0), 0)
        },
        execution: {
          success: executeResult.success,
          status: executeResult.data.status,
          completedSteps: executeResult.data.completedSteps,
          failedSteps: executeResult.data.failedSteps,
          executionTime: executeResult.data.statistics.executionTime
        },
        generatedFiles: {
          src: srcFiles,
          test: testFiles
        },
        testResults: {
          success: testResult.success,
          exitCode: testResult.data.exitCode,
          outputPreview: testResult.data.stdout.substring(0, 200) + '...'
        }
      };
      
      const summaryPath = path.join(tmpDir, 'summary.json');
      await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
      console.log(`\nSummary saved to: summary.json`);
      
      console.log('\n✅ All steps completed successfully!');
      
    } finally {
      // Restore original working directory
      process.chdir(originalCwd);
    }
  }, 60000); // 60 second timeout
});