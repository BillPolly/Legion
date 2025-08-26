/**
 * Test hello world program generation and execution
 */

import { Planner } from '@legion/planner';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry/src/integration/ToolRegistry.js';
import { BTValidator } from '@legion/bt-validator';
import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import fs from 'fs/promises';

describe('Hello World Plan Test', () => {
  let planner;
  let toolRegistry;
  let validator;
  let executor;

  beforeAll(async () => {
    const resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    toolRegistry = await ToolRegistry.getInstance();
    await toolRegistry.loadAllModules();
    
    const llmClient = await resourceManager.get('llmClient');
    planner = new Planner({ llmClient });
    
    validator = new BTValidator();
    executor = new DebugBehaviorTreeExecutor(toolRegistry);
  }, 30000);

  afterAll(async () => {
    if (toolRegistry && toolRegistry.cleanup) {
      await toolRegistry.cleanup();
    }
    // Clean up any created directories
    for (const dir of ['hello-world', 'hello_world', 'test']) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch (error) {}
    }
  });

  test('should generate and execute hello world program', async () => {
    console.log('\n=== HELLO WORLD PROGRAM TEST ===\n');
    
    // Get tools
    const tools = await toolRegistry.listTools();
    const fileWriteTool = tools.find(t => t.name === 'file_write');
    const runNodeTool = tools.find(t => t.name === 'run_node');
    
    const availableTools = [fileWriteTool, runNodeTool].filter(Boolean);
    
    const goal = 'please write a simple hello world program in javascript';
    
    console.log('Goal:', goal);
    console.log('Available tools:', availableTools.map(t => t.name));
    
    // Generate plan
    const planResult = await planner.makePlan(goal, availableTools);
    expect(planResult.success).toBe(true);
    
    const behaviorTree = planResult.data.plan;
    console.log('\n=== GENERATED PLAN ===');
    console.log(JSON.stringify(behaviorTree, null, 2));
    
    // Check input parameters
    console.log('\n=== CHECKING PARAMETERS ===');
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
    
    for (const action of actionNodes) {
      console.log(`\n${action.tool}:`);
      console.log('  Inputs:', JSON.stringify(action.inputs, null, 2));
      
      if (action.tool === 'file_write') {
        expect(action.inputs).toHaveProperty('filepath');
        expect(action.inputs).toHaveProperty('content');
        console.log('  ✅ Correct parameters');
        
        // Check if it's hello world content
        const content = action.inputs.content?.toLowerCase() || '';
        expect(content).toMatch(/hello.*world|world.*hello/);
        console.log('  ✅ Contains hello world');
      }
      
      if (action.tool === 'run_node') {
        expect(action.inputs).toHaveProperty('projectPath');
        expect(action.inputs).toHaveProperty('command');
        console.log('  ✅ Correct parameters');
      }
    }
    
    // Validate
    console.log('\n=== VALIDATING ===');
    const validationResult = await validator.validate(behaviorTree, tools);
    
    if (!validationResult.valid) {
      console.log('Validation errors:', validationResult.errors);
      console.log('Validation warnings:', validationResult.warnings);
    }
    
    expect(validationResult.valid).toBe(true);
    console.log('✅ Validation passed');
    
    // Execute
    console.log('\n=== EXECUTING ===');
    
    // Enrich with tool IDs
    for (const action of actionNodes) {
      const tool = tools.find(t => t.name === action.tool);
      action.tool_id = tool._id;
    }
    
    executor.setMode('run');
    await executor.initializeTree(behaviorTree);
    const executionResult = await executor.execute();
    
    console.log('Result:', executionResult);
    console.log('Artifacts:', executor.executionContext.artifacts);
    
    expect(executionResult.complete).toBe(true);
    expect(executionResult.success).toBe(true);
    console.log('✅ Execution completed successfully');
    
    // Check if file was created
    let jsFile = null;
    for (const [key, value] of Object.entries(executor.executionContext.artifacts)) {
      if (typeof value === 'string' && value.endsWith('.js')) {
        jsFile = value;
        break;
      }
    }
    
    if (jsFile) {
      const content = await fs.readFile(jsFile, 'utf8');
      console.log(`\n✅ Created file: ${jsFile}`);
      console.log('Content:', content);
    }
    
    console.log('\n=== ✅ TEST PASSED ===');
  }, 60000);
});