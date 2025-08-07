/**
 * Live integration test for generating executable plans
 * This test creates plans that can be directly executed using Legion tools
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ModuleLoader, ResourceManager } from '@legion/tool-core';
import { ProfilePlannerModule } from '../../src/ProfilePlannerModule.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Executable Plan Generation', () => {
  let moduleLoader;
  let resourceManager;
  let module;
  let tools;
  let outputDir;
  
  beforeAll(async () => {
    // Setup output directory
    outputDir = path.join(__dirname, '..', 'tmp', 'executable-plans');
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
    await fs.mkdir(outputDir, { recursive: true });
    console.log(`\nOutput directory prepared: ${outputDir}`);
    
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Check for API key
    const apiKey = resourceManager.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === 'test-key') {
      throw new Error('ANTHROPIC_API_KEY required for live tests');
    }
    
    // Initialize ModuleLoader
    moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();
    
    // Create ProfilePlannerModule
    module = await ProfilePlannerModule.create(resourceManager);
    
    // Get all tools
    tools = module.getTools();
    console.log(`\nLoaded ${tools.length} tools from ProfilePlannerModule`);
    
    // Find the executable planner tool
    const executableTool = tools.find(t => t.name === 'javascript_executable_planner');
    if (executableTool) {
      console.log(`  - Found executable planner: ${executableTool.description}`);
    }
  });
  
  describe('Simple Math Utility Plan', () => {
    test('should create executable plan for math utility', async () => {
      const tool = tools.find(t => t.name === 'javascript_executable_planner');
      expect(tool).toBeDefined();
      
      const request = {
        function: {
          name: 'javascript_executable_planner',
          arguments: JSON.stringify({
            task: 'Create a math utility module with add and subtract functions. Include a simple test file that tests both functions. The module should export the functions using module.exports.',
            saveAs: 'math_utility_plan'
          })
        }
      };
      
      console.log('\n📝 Generating executable plan for math utility...');
      const startTime = Date.now();
      
      const result = await tool.invoke(request);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Plan generated in ${duration}ms`);
      
      // Get the planning context
      const profile = tool.profile;
      const parsedArgs = JSON.parse(request.function.arguments);
      const planningContext = tool.profileManager.createPlanningContext(profile, parsedArgs.task);
      
      // Save complete output
      const output = {
        test: 'math_utility_executable_plan',
        timestamp: new Date().toISOString(),
        duration_ms: duration,
        user_request: request,
        planning_context: planningContext,
        response: result,
        analysis: {
          plan_valid: result.success,
          total_steps: result.success ? result.data.plan.steps.length : 0,
          total_actions: result.success ? result.data.plan.steps.reduce((sum, step) => sum + step.actions.length, 0) : 0,
          action_types: result.success ? [...new Set(result.data.plan.steps.flatMap(s => s.actions.map(a => a.type)))] : []
        }
      };
      
      const outputPath = path.join(outputDir, 'math_utility_plan.json');
      await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
      console.log(`📄 Plan saved to: ${outputPath}`);
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.plan).toBeDefined();
      expect(result.data.profile).toBe('javascript-executable');
      
      const plan = result.data.plan;
      expect(plan.steps).toBeInstanceOf(Array);
      expect(plan.steps.length).toBeGreaterThan(0);
      
      // Verify actions use executable types
      const allActions = plan.steps.flatMap(step => step.actions);
      const actionTypes = [...new Set(allActions.map(a => a.type))];
      console.log(`  Action types used: ${actionTypes.join(', ')}`);
      
      // Should use our executable action types
      const executableTypes = ['write_file', 'read_file', 'create_directory', 'run_command'];
      const usesExecutableTypes = actionTypes.every(type => executableTypes.includes(type));
      expect(usesExecutableTypes).toBe(true);
      
      // Log plan structure for inspection
      console.log(`\n📋 Plan Structure:`);
      console.log(`  - Name: ${plan.name}`);
      console.log(`  - Steps: ${plan.steps.length}`);
      plan.steps.forEach((step, idx) => {
        console.log(`  - Step ${idx + 1}: ${step.name} (${step.actions.length} actions)`);
        step.actions.forEach(action => {
          console.log(`    - ${action.type}: ${JSON.stringify(action.parameters)}`);
        });
      });
    }, 60000); // 60 second timeout
  });
  
  describe('Hello World Application Plan', () => {
    test('should create executable plan for hello world app', async () => {
      const tool = tools.find(t => t.name === 'javascript_executable_planner');
      expect(tool).toBeDefined();
      
      const request = {
        function: {
          name: 'javascript_executable_planner',
          arguments: JSON.stringify({
            task: 'Create a simple hello world Node.js application. Create an index.js file that prints "Hello, World!" to the console. Also create a package.json file.',
            saveAs: 'hello_world_plan'
          })
        }
      };
      
      console.log('\n📝 Generating executable plan for hello world app...');
      const startTime = Date.now();
      
      const result = await tool.invoke(request);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Plan generated in ${duration}ms`);
      
      // Save complete output
      const output = {
        test: 'hello_world_executable_plan',
        timestamp: new Date().toISOString(),
        duration_ms: duration,
        user_request: request,
        response: result
      };
      
      const outputPath = path.join(outputDir, 'hello_world_plan.json');
      await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
      console.log(`📄 Plan saved to: ${outputPath}`);
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.data.plan).toBeDefined();
      
      // The plan should be simple and executable
      const plan = result.data.plan;
      const actionCount = plan.steps.reduce((sum, step) => sum + step.actions.length, 0);
      console.log(`  Total actions: ${actionCount}`);
      expect(actionCount).toBeLessThanOrEqual(5); // Should be a simple plan
    }, 60000);
  });
  
  describe('Plan Analysis', () => {
    test('should analyze generated plans for executability', async () => {
      // Read all generated plans
      const files = await fs.readdir(outputDir);
      const planFiles = files.filter(f => f.endsWith('.json'));
      
      console.log(`\n📊 Analyzing ${planFiles.length} generated plans:`);
      
      for (const file of planFiles) {
        const content = await fs.readFile(path.join(outputDir, file), 'utf8');
        const data = JSON.parse(content);
        
        if (data.response.success) {
          const plan = data.response.data.plan;
          console.log(`\n  ${file}:`);
          console.log(`    - Steps: ${plan.steps.length}`);
          console.log(`    - Actions: ${plan.steps.reduce((sum, s) => sum + s.actions.length, 0)}`);
          
          // Check that all actions have required parameters
          let allValid = true;
          plan.steps.forEach(step => {
            step.actions.forEach(action => {
              if (action.type === 'file_write' && (!action.parameters.filepath || !action.parameters.content)) {
                console.log(`    ⚠️ Invalid file_write action: missing parameters`);
                allValid = false;
              }
              if (action.type === 'node_run_command' && !action.parameters.command) {
                console.log(`    ⚠️ Invalid node_run_command action: missing command`);
                allValid = false;
              }
            });
          });
          
          console.log(`    - All actions valid: ${allValid ? '✅' : '❌'}`);
        }
      }
      
      expect(planFiles.length).toBeGreaterThan(0);
    });
  });
});