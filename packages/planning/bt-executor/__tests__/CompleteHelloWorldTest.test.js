/**
 * Complete test for "please write a simple hello world program in javascript"
 * This MUST generate a valid plan and execute successfully
 */

import { Planner } from '@legion/planner';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry/src/integration/ToolRegistry.js';
import { BTValidator } from '@legion/bt-validator';
import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import fs from 'fs/promises';

describe('Complete Hello World Test', () => {
  let planner;
  let toolRegistry;
  let validator;
  let executor;
  let resourceManager;

  beforeAll(async () => {
    console.log('=== INITIALIZING TEST ENVIRONMENT ===');
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    toolRegistry = await ToolRegistry.getInstance();
    const loadResult = await toolRegistry.loadAllModules();
    console.log(`Loaded ${loadResult.modulesLoaded} modules, ${loadResult.toolsLoaded} tools`);
    
    const llmClient = await resourceManager.get('llmClient');
    planner = new Planner({ llmClient });
    
    validator = new BTValidator();
    executor = new DebugBehaviorTreeExecutor(toolRegistry);
  }, 30000);

  afterAll(async () => {
    if (toolRegistry && toolRegistry.cleanup) {
      await toolRegistry.cleanup();
    }
    // Clean up created files
    const filesToClean = ['hello.js', 'hello-world.js', 'helloworld.js', 'index.js', 'app.js'];
    for (const file of filesToClean) {
      try {
        await fs.rm(file, { force: true });
      } catch (error) {}
    }
  });

  test('MUST generate valid plan for "please write a simple hello world program in javascript"', async () => {
    const goal = 'please write a simple hello world program in javascript';
    console.log('\n=== GOAL ===');
    console.log(goal);
    
    // Get relevant tools
    const tools = await toolRegistry.listTools();
    const fileWriteTool = tools.find(t => t.name === 'file_write');
    const runNodeTool = tools.find(t => t.name === 'run_node');
    
    expect(fileWriteTool).toBeDefined();
    expect(runNodeTool).toBeDefined();
    
    const availableTools = [fileWriteTool, runNodeTool];
    console.log('\n=== AVAILABLE TOOLS ===');
    console.log('- file_write');
    console.log('- run_node');
    
    // Generate plan
    console.log('\n=== STEP 1: GENERATE PLAN ===');
    const planResult = await planner.makePlan(goal, availableTools, { debug: true });
    
    if (!planResult.success) {
      console.log('Plan generation failed!');
      console.log('Error:', planResult.error);
      if (planResult.data?.validation) {
        console.log('Validation errors:', planResult.data.validation.errors);
      }
    }
    
    expect(planResult.success).toBe(true);
    const behaviorTree = planResult.data.plan;
    
    console.log('\n=== GENERATED PLAN ===');
    console.log(JSON.stringify(behaviorTree, null, 2));
    
    // Verify correct input parameters
    console.log('\n=== STEP 2: VERIFY INPUT PARAMETERS ===');
    const findActionNodes = (node) => {
      const actions = [];
      if (node.type === 'action') actions.push(node);
      if (node.children) {
        for (const child of node.children) {
          actions.push(...findActionNodes(child));
        }
      }
      if (node.child) actions.push(...findActionNodes(node.child));
      return actions;
    };
    
    const actionNodes = findActionNodes(behaviorTree);
    let hasFileWrite = false;
    let hasRunNode = false;
    
    for (const action of actionNodes) {
      console.log(`\nAction: ${action.tool}`);
      console.log('Inputs:', action.inputs);
      console.log('Outputs:', action.outputs);
      
      if (action.tool === 'file_write') {
        hasFileWrite = true;
        expect(action.inputs).toHaveProperty('filepath');
        expect(action.inputs).toHaveProperty('content');
        expect(action.inputs.content.toLowerCase()).toMatch(/hello.*world/);
        console.log('✅ file_write has correct parameters and hello world content');
      }
      
      if (action.tool === 'run_node') {
        hasRunNode = true;
        expect(action.inputs).toHaveProperty('projectPath');
        expect(action.inputs).toHaveProperty('command');
        console.log('✅ run_node has correct parameters');
      }
    }
    
    expect(hasFileWrite).toBe(true);
    console.log('✅ Plan includes file_write action');
    
    // Validate plan
    console.log('\n=== STEP 3: VALIDATE PLAN ===');
    const validationResult = await validator.validate(behaviorTree, tools);
    
    if (!validationResult.valid) {
      console.log('Validation errors:', validationResult.errors);
      console.log('Warnings:', validationResult.warnings);
    }
    
    expect(validationResult.valid).toBe(true);
    console.log('✅ Plan validation passed');
    
    // Enrich with tool IDs
    for (const action of actionNodes) {
      const tool = tools.find(t => t.name === action.tool);
      action.tool_id = tool._id;
    }
    
    // Execute plan
    console.log('\n=== STEP 4: EXECUTE PLAN ===');
    executor.setMode('run');
    await executor.initializeTree(behaviorTree);
    const executionResult = await executor.execute();
    
    console.log('Execution complete:', executionResult.complete);
    console.log('Execution success:', executionResult.success);
    console.log('Artifacts:', executor.executionContext.artifacts);
    
    expect(executionResult.complete).toBe(true);
    expect(executionResult.success).toBe(true);
    console.log('✅ Plan executed successfully');
    
    // Verify file was created
    console.log('\n=== STEP 5: VERIFY RESULTS ===');
    let createdFile = null;
    
    // Find the created JavaScript file from artifacts
    for (const [key, value] of Object.entries(executor.executionContext.artifacts)) {
      if (typeof value === 'string' && value.endsWith('.js')) {
        createdFile = value;
        break;
      }
    }
    
    if (createdFile) {
      const fileExists = await fs.access(createdFile)
        .then(() => true)
        .catch(() => false);
      
      expect(fileExists).toBe(true);
      console.log(`✅ JavaScript file created: ${createdFile}`);
      
      const content = await fs.readFile(createdFile, 'utf8');
      console.log('File content:', content);
      
      expect(content.toLowerCase()).toMatch(/hello.*world/);
      console.log('✅ File contains hello world');
      
      // If run_node was executed, check if it ran successfully
      if (hasRunNode && executor.executionContext.artifacts.programOutput) {
        console.log('Program output:', executor.executionContext.artifacts.programOutput);
        expect(executor.executionContext.artifacts.programOutput.toLowerCase()).toMatch(/hello.*world/);
        console.log('✅ Program output contains hello world');
      }
    } else {
      // Even if no file path in artifacts, check if any .js file was created
      const possibleFiles = ['hello.js', 'hello-world.js', 'helloworld.js', 'index.js', 'app.js'];
      for (const file of possibleFiles) {
        const exists = await fs.access(file).then(() => true).catch(() => false);
        if (exists) {
          createdFile = file;
          const content = await fs.readFile(file, 'utf8');
          console.log(`✅ Found created file: ${file}`);
          console.log('Content:', content);
          expect(content.toLowerCase()).toMatch(/hello.*world/);
          break;
        }
      }
    }
    
    expect(createdFile).not.toBeNull();
    
    console.log('\n=== ✅✅✅ ALL TESTS PASSED ✅✅✅ ===');
    console.log('✅ Generated valid plan for: "please write a simple hello world program in javascript"');
    console.log('✅ Plan uses correct input parameters');
    console.log('✅ Plan validated successfully');
    console.log('✅ Plan executed successfully');
    console.log('✅ Hello world JavaScript file created');
  }, 120000); // 2 minute timeout for LLM
});