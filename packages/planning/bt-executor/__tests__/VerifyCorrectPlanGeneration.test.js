/**
 * Test to verify LLM generates plans with correct input parameter names
 */

import { Planner } from '@legion/planner';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry/src/integration/ToolRegistry.js';
import { BTValidator } from '@legion/bt-validator';
import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import fs from 'fs/promises';

describe('Verify Correct Plan Generation', () => {
  let planner;
  let toolRegistry;
  let validator;
  let executor;

  beforeAll(async () => {
    // Initialize components
    const resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    toolRegistry = await ToolRegistry.getInstance();
    await toolRegistry.loadAllModules();
    
    // Get REAL LLM client
    const llmClient = await resourceManager.get('llmClient');
    planner = new Planner({ llmClient });
    
    validator = new BTValidator();
    executor = new DebugBehaviorTreeExecutor(toolRegistry);
  }, 30000);

  afterAll(async () => {
    if (toolRegistry && toolRegistry.cleanup) {
      await toolRegistry.cleanup();
    }
  });

  beforeEach(async () => {
    // Clean up test files/dirs - clean up any common directory names
    const dirsToClean = ['test_correct_params', 'hello-world', 'hello_world', 'test'];
    for (const dir of dirsToClean) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch (error) {
        // Ignore if doesn't exist
      }
    }
  });

  test('LLM should generate plan with correct input parameter names', async () => {
    console.log('=== TESTING HELLO WORLD PROGRAM GENERATION ===');
    
    // Get all available tools for a complete hello world program
    const tools = await toolRegistry.listTools();
    const dirCreateTool = tools.find(t => t.name === 'directory_create');
    const fileWriteTool = tools.find(t => t.name === 'file_write');
    const runNodeTool = tools.find(t => t.name === 'run_node');
    const searchLogsTool = tools.find(t => t.name === 'search_logs');
    
    const availableTools = [dirCreateTool, fileWriteTool, runNodeTool, searchLogsTool].filter(Boolean);
    
    const goal = 'please write a simple hello world program in javascript';
    
    console.log('=== STEP 1: Generate plan with real LLM ===');
    const planResult = await planner.makePlan(goal, availableTools);
    
    expect(planResult.success).toBe(true);
    const behaviorTree = planResult.data.plan;
    
    console.log('Generated plan:', JSON.stringify(behaviorTree, null, 2));
    
    console.log('=== STEP 2: Verify input parameter names ===');
    
    // Find all action nodes
    const findActionNodes = (node) => {
      const actions = [];
      if (node.type === 'action') {
        actions.push(node);
      }
      if (node.children) {
        for (const child of node.children) {
          actions.push(...findActionNodes(child));
        }
      }
      if (node.child) {
        actions.push(...findActionNodes(node.child));
      }
      return actions;
    };
    
    const actionNodes = findActionNodes(behaviorTree);
    let allCorrect = true;
    
    for (const action of actionNodes) {
      console.log(`\nChecking ${action.tool}:`);
      console.log('Inputs:', action.inputs);
      
      if (action.tool === 'directory_create') {
        // Should have 'dirpath', not 'path'
        expect(action.inputs).toHaveProperty('dirpath');
        expect(action.inputs).not.toHaveProperty('path');
        console.log('✅ directory_create uses correct input: dirpath');
      }
      
      if (action.tool === 'file_write') {
        // Should have 'filepath' and 'content'
        expect(action.inputs).toHaveProperty('filepath');
        expect(action.inputs).toHaveProperty('content');
        console.log('✅ file_write uses correct inputs: filepath, content');
      }
      
      if (action.tool === 'search_logs') {
        // Should have 'query', not 'pattern'
        expect(action.inputs).toHaveProperty('query');
        expect(action.inputs).not.toHaveProperty('pattern');
        console.log('✅ search_logs uses correct input: query');
      }
      
      if (action.tool === 'run_node') {
        // Should have 'projectPath' and 'command'
        expect(action.inputs).toHaveProperty('projectPath');
        expect(action.inputs).toHaveProperty('command');
        console.log('✅ run_node uses correct inputs: projectPath, command');
      }
    }
    
    console.log('=== STEP 3: Validate plan ===');
    const validationResult = await validator.validate(behaviorTree, tools);
    
    expect(validationResult.valid).toBe(true);
    console.log('✅ Plan validation passed!');
    
    console.log('=== STEP 4: Execute plan ===');
    
    // Enrich with tool IDs
    for (const action of actionNodes) {
      const tool = tools.find(t => t.name === action.tool);
      action.tool_id = tool._id;
    }
    
    executor.setMode('run');
    await executor.initializeTree(behaviorTree);
    const executionResult = await executor.execute();
    
    console.log('Execution result:', {
      complete: executionResult.complete,
      success: executionResult.success
    });
    
    expect(executionResult.complete).toBe(true);
    expect(executionResult.success).toBe(true);
    
    console.log('=== STEP 5: Verify execution results ===');
    
    // Check execution artifacts to see what was created
    const artifacts = executor.executionContext.artifacts;
    console.log('Execution artifacts:', artifacts);
    
    // Find any created file paths in artifacts
    let createdFilePath = null;
    for (const [key, value] of Object.entries(artifacts)) {
      if (typeof value === 'string' && value.includes('.js')) {
        createdFilePath = value;
        console.log(`Found JavaScript file: ${createdFilePath}`);
        break;
      }
    }
    
    if (createdFilePath) {
      // Check if file exists
      const fileExists = await fs.access(createdFilePath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
      console.log(`✅ JavaScript file created: ${createdFilePath}`);
      
      // Read and display the content
      const fileContent = await fs.readFile(createdFilePath, 'utf8');
      console.log('File content:', fileContent);
      
      // Verify it's a hello world program
      expect(fileContent.toLowerCase()).toMatch(/hello|world/);
      console.log('✅ File contains hello world code');
    }
    
    console.log('\n=== ✅ ALL TESTS PASSED! ===');
    console.log('✅ LLM generated plan with CORRECT input parameter names');
    console.log('✅ Plan validated successfully');
    console.log('✅ Plan executed successfully');
    console.log('✅ File system operations completed');
  }, 60000);
});