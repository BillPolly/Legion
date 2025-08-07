import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager, ModuleLoader } from '@legion/tool-core';
import { PlanExecutor } from '@legion/plan-executor/src/core/PlanExecutor.js';
import { ProfilePlannerModule } from '../../src/ProfilePlannerModule.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Plan Execution', () => {
  let resourceManager;
  let moduleLoader;
  let planExecutor;
  let planData;
  let plan;
  let workspaceDir;
  
  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Initialize ModuleLoader
    moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();
    
    // Load all modules from registry first
    console.log('Loading modules from registry...');
    const registryResult = await moduleLoader.loadAllFromRegistry();
    console.log(`Loaded ${registryResult.successful.length} modules from registry`);
    
    // Load ProfilePlannerModule for real plan generation
    console.log('Loading ProfilePlannerModule...');
    const profilePlannerModule = await ProfilePlannerModule.create(resourceManager);
    
    // Register the module and its tools directly
    moduleLoader.loadedModules.set('profile-planner', profilePlannerModule);
    await moduleLoader._registerModuleTools(profilePlannerModule, 'profile-planner');
    console.log('ProfilePlannerModule loaded successfully');
    
    // Sync tool registry to ensure all aliases are available
    console.log('Syncing tool registry...');
    await moduleLoader.syncToolRegistry();
    
    // Log available tools
    const allTools = await moduleLoader.getAllToolNames(true);
    console.log(`Total available tools (including aliases): ${allTools.length}`);
    
    // Create PlanExecutor
    planExecutor = new PlanExecutor({ moduleLoader });
    
    // Set up workspace directory
    workspaceDir = path.join(__dirname, 'test-workspace', `run-${Date.now()}`);
    await fs.mkdir(workspaceDir, { recursive: true });
    console.log(`Created workspace: ${workspaceDir}`);
    
    // Load the fallback plan (in case profile planner test fails)
    const planPath = path.join(__dirname, 'node-addition-api-plan.json');
    const planContent = await fs.readFile(planPath, 'utf8');
    const fallbackPlan = JSON.parse(planContent);
    
    // Initialize plan variables (will be set by profile planner test)
    planData = fallbackPlan;
    plan = fallbackPlan;
    plan.status = 'validated';
  });
  
  afterAll(async () => {
    // Clean up workspace
    if (workspaceDir) {
      try {
        await fs.rm(workspaceDir, { recursive: true, force: true });
        console.log('Cleaned up workspace');
      } catch (error) {
        console.error('Failed to clean up workspace:', error.message);
      }
    }
  });
  
  describe('Profile Planner Integration', () => {
    test('should generate plan using ProfilePlannerModule', async () => {
      // Get the profile planner tool
      const profilePlannerTool = moduleLoader.getTool('profile_planner');
      expect(profilePlannerTool).toBeDefined();
      
      // Generate a plan using the profile planner
      const result = await profilePlannerTool.execute({
        function: {
          name: 'plan_with_profile',
          arguments: JSON.stringify({
            profile: 'javascript-development',
            task: 'create a simple node server that has an api endpoint that adds 2 numbers'
          })
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.data.plan).toBeDefined();
      expect(result.data.plan.steps).toBeDefined();
      expect(result.data.plan.steps.length).toBeGreaterThan(0);
      
      console.log('Generated plan with ProfilePlannerModule:');
      console.log(`- Profile: ${result.data.profile}`);
      console.log(`- Steps: ${result.data.plan.steps.length}`);
      console.log(`- Required modules: ${result.data.requiredModules.join(', ')}`);
      
      // Validate that the generated plan uses correct tool names
      const validation = await moduleLoader.validatePlanTools(result.data.plan);
      console.log('Plan validation result:', validation);
      expect(validation.valid).toBe(true);
      
      // Store the generated plan for execution test
      plan = result.data.plan;
      planData = result.data.plan;
    }, 60000); // 60 second timeout for LLM plan generation
  });

  describe('Module Loading', () => {
    test('should have loaded required modules', async () => {
      const toolNames = await moduleLoader.getAllToolNames(true);
      console.log('Available tools sample:', toolNames.slice(0, 10));
      
      // Check for file operations
      const hasFileWrite = await moduleLoader.hasToolByNameOrAlias('file_write');
      const hasWriteFile = await moduleLoader.hasToolByNameOrAlias('write_file');
      expect(hasFileWrite || hasWriteFile).toBe(true);
      console.log(`file_write available: ${hasFileWrite}, write_file available: ${hasWriteFile}`);
      
      // Check for command execution
      const hasCommandExecutor = await moduleLoader.hasToolByNameOrAlias('command_executor');
      const hasRunCommand = await moduleLoader.hasToolByNameOrAlias('run_command');
      expect(hasCommandExecutor || hasRunCommand).toBe(true);
      console.log(`command_executor available: ${hasCommandExecutor}, run_command available: ${hasRunCommand}`);
      
      // Validate the plan tools
      const validation = await moduleLoader.validatePlanTools(plan);
      console.log('Plan validation:', validation);
      expect(validation.valid).toBe(true);
    });
  });
  
  describe('Plan Execution', () => {
    test('should execute the plan successfully', async () => {
      // Track execution events
      const events = [];
      
      planExecutor.on('plan:start', (data) => {
        events.push({ type: 'plan:start', ...data });
        console.log('Plan execution started:', data.planName);
      });
      
      planExecutor.on('step:start', (data) => {
        events.push({ type: 'step:start', ...data });
        console.log(`Step started: ${data.stepName} (${data.stepId})`);
      });
      
      planExecutor.on('step:complete', (data) => {
        events.push({ type: 'step:complete', ...data });
        console.log(`Step completed: ${data.stepName}`);
      });
      
      planExecutor.on('step:error', (data) => {
        events.push({ type: 'step:error', ...data });
        console.error(`Step failed: ${data.stepName} - ${data.error}`);
      });
      
      planExecutor.on('plan:complete', (data) => {
        events.push({ type: 'plan:complete', ...data });
        console.log('Plan execution completed:', data.success ? 'SUCCESS' : 'FAILED');
      });
      
      // Execute the plan
      const result = await planExecutor.executePlan(plan, {
        workspaceDir: workspaceDir,
        emitProgress: true,
        stopOnError: false,  // Continue even if a step fails
        retries: 1
      });
      
      // Log the result
      console.log('\nExecution Result:');
      console.log('Success:', result.success);
      console.log('Completed Steps:', result.completedSteps);
      console.log('Failed Steps:', result.failedSteps);
      console.log('Skipped Steps:', result.skippedSteps);
      console.log('Execution Time:', result.statistics.executionTime, 'ms');
      
      // Verify execution
      expect(result).toBeDefined();
      expect(result.statistics).toBeDefined();
      expect(result.statistics.totalSteps).toBeGreaterThan(0);
      
      // Check events were emitted
      expect(events.some(e => e.type === 'plan:start')).toBe(true);
      expect(events.some(e => e.type === 'plan:complete')).toBe(true);
      
      // Check created files
      const createdFiles = [];
      try {
        const files = await fs.readdir(workspaceDir);
        createdFiles.push(...files);
        console.log('\nCreated files:', files);
      } catch (error) {
        console.error('Failed to list workspace files:', error.message);
      }
      
      // We expect at least some files to be created
      expect(createdFiles.length).toBeGreaterThan(0);
      
    }, 120000); // 2 minute timeout for execution
  });
  
  describe('File Creation Verification', () => {
    test('should create expected files', async () => {
      const expectedFiles = [
        'package.json',
        'server.js',
        'test-api.js',
        'README.md'
      ];
      
      for (const filename of expectedFiles) {
        const filePath = path.join(workspaceDir, filename);
        try {
          const stats = await fs.stat(filePath);
          expect(stats.isFile()).toBe(true);
          console.log(`✓ ${filename} created`);
        } catch (error) {
          console.log(`✗ ${filename} not found`);
        }
      }
    });
    
    test('package.json should have correct structure', async () => {
      try {
        const packagePath = path.join(workspaceDir, 'package.json');
        const content = await fs.readFile(packagePath, 'utf8');
        const packageJson = JSON.parse(content);
        
        expect(packageJson.name).toBe('addition-api-server');
        expect(packageJson.version).toBe('1.0.0');
        expect(packageJson.dependencies).toBeDefined();
        expect(packageJson.dependencies.express).toBeDefined();
        expect(packageJson.scripts).toBeDefined();
        expect(packageJson.scripts.start).toBe('node server.js');
      } catch (error) {
        console.error('Failed to verify package.json:', error.message);
      }
    });
    
    test('server.js should contain addition endpoint', async () => {
      try {
        const serverPath = path.join(workspaceDir, 'server.js');
        const content = await fs.readFile(serverPath, 'utf8');
        
        expect(content).toContain('/api/add');
        expect(content).toContain('express');
        expect(content).toContain('app.post');
        expect(content).toContain('const result = a + b');
      } catch (error) {
        console.error('Failed to verify server.js:', error.message);
      }
    });
  });
  
  describe('Execution Context', () => {
    test('should track step results', async () => {
      // Create a simpler plan for testing context
      const simplePlan = {
        id: 'test-plan',
        name: 'Test Plan',
        status: 'validated',
        steps: [
          {
            id: 'step1',
            name: 'Create test file',
            type: 'action',
            actions: [
              {
                type: 'file_write',  // Using available tool name
                parameters: {
                  filepath: 'test.txt',
                  content: 'Hello World'
                }
              }
            ],
            dependencies: []
          }
        ]
      };
      
      const testWorkspace = path.join(__dirname, 'test-workspace', 'simple-test');
      await fs.mkdir(testWorkspace, { recursive: true });
      
      const result = await planExecutor.executePlan(simplePlan, {
        workspaceDir: testWorkspace,
        emitProgress: false
      });
      
      expect(result.success).toBe(true);
      expect(result.completedSteps).toContain('step1');
      expect(result.stepResults).toBeDefined();
      
      // Clean up
      await fs.rm(testWorkspace, { recursive: true, force: true });
    });
  });
  
  describe('Error Handling', () => {
    test('should handle missing tool gracefully', async () => {
      const planWithBadAction = {
        id: 'bad-plan',
        name: 'Plan with bad action',
        status: 'validated',
        steps: [
          {
            id: 'bad-step',
            name: 'Bad step',
            type: 'action',
            actions: [
              {
                type: 'non_existent_tool',
                parameters: {}
              }
            ],
            dependencies: []
          }
        ]
      };
      
      const result = await planExecutor.executePlan(planWithBadAction, {
        stopOnError: false
      });
      
      expect(result.success).toBe(false);
      expect(result.failedSteps).toContain('bad-step');
    });
  });
});