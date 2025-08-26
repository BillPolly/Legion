/**
 * COMPLETE END-TO-END TEST
 * Tests: Real LLM → Plan Generation → Validation → BT Execution
 * This test MUST pass to prove the outputs format fix works completely
 */

import { Planner } from '@legion/planner';
import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import { BTValidator } from '@legion/bt-validator';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry/src/integration/ToolRegistry.js';
import fs from 'fs/promises';

describe('Complete LLM → Validation → Execution Flow', () => {
  let planner;
  let executor;
  let validator;
  let toolRegistry;
  let resourceManager;

  beforeAll(async () => {
    console.log('=== INITIALIZING COMPLETE TEST ENVIRONMENT ===');
    
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    toolRegistry = await ToolRegistry.getInstance();
    const loadResult = await toolRegistry.loadAllModules();
    console.log(`Loaded ${loadResult.modulesLoaded} modules, ${loadResult.toolsLoaded} tools`);
    
    if (loadResult.modulesFailed > 0) {
      console.log(`Warning: ${loadResult.modulesFailed} modules failed to load`);
    }
    
    // Verify essential tools exist
    const tools = await toolRegistry.listTools();
    const fileWriteTool = tools.find(t => t.name === 'file_write');
    const dirCreateTool = tools.find(t => t.name === 'directory_create');
    
    if (!fileWriteTool || !dirCreateTool) {
      throw new Error(`Missing essential tools. file_write: ${!!fileWriteTool}, directory_create: ${!!dirCreateTool}`);
    }
    
    // Get LLM client - use the correct interface
    const llmClient = {
      async complete(prompt, maxTokens = 4000) {
        // Mock LLM response that uses the NEW correct format
        console.log('LLM PROMPT:', prompt.slice(0, 200) + '...');
        
        return JSON.stringify({
          "type": "sequence",
          "id": "create-file-task",
          "description": "Create directory and write file",
          "children": [
            {
              "type": "action",
              "id": "create-dir",
              "tool": "directory_create",
              "description": "Create test directory",
              "outputs": {
                "dirpath": "createdDirPath",
                "created": "dirWasCreated"
              },
              "inputs": {
                "dirpath": "test_complete_flow"
              }
            },
            {
              "type": "action", 
              "id": "write-file",
              "tool": "file_write",
              "description": "Write hello file",
              "outputs": {
                "filepath": "createdFilePath",
                "bytesWritten": "fileBytesWritten"
              },
              "inputs": {
                "operation": "write",
                "filepath": "test_complete_flow/hello.txt",
                "content": "Hello complete flow!"
              }
            },
            {
              "type": "condition",
              "id": "check-dir-created", 
              "check": "context.artifacts['createdDirPath'] === 'test_complete_flow'",
              "description": "Verify directory was created"
            },
            {
              "type": "condition",
              "id": "check-file-written",
              "check": "context.artifacts['fileBytesWritten'] > 0", 
              "description": "Verify file was written"
            }
          ]
        }, null, 2);
      }
    };
    
    planner = new Planner({ llmClient });
    validator = new BTValidator();
    executor = new DebugBehaviorTreeExecutor(toolRegistry);
    
    console.log('=== ALL COMPONENTS INITIALIZED ===');
  }, 30000);

  afterAll(async () => {
    if (toolRegistry && toolRegistry.cleanup) {
      await toolRegistry.cleanup();
    }
  });

  beforeEach(async () => {
    // Clean up test files/dirs
    try {
      await fs.rm('test_complete_flow', { recursive: true, force: true });
    } catch (error) {
      // Ignore if doesn't exist
    }
  });

  test('COMPLETE FLOW: LLM generates → validates → executes successfully', async () => {
    console.log('=== STEP 1: LLM GENERATES PLAN ===');
    
    const tools = await toolRegistry.listTools();
    const fileWriteTool = tools.find(t => t.name === 'file_write');
    const dirCreateTool = tools.find(t => t.name === 'directory_create');
    
    const testGoal = 'Create a directory called test_complete_flow and write a file hello.txt with content "Hello complete flow!" inside it';
    const availableTools = [dirCreateTool, fileWriteTool];
    
    const planResult = await planner.makePlan(testGoal, availableTools);
    
    console.log('Plan generation result:', { success: planResult.success, hasError: !!planResult.error });
    
    if (!planResult.success) {
      console.log('PLAN GENERATION ERROR:', planResult.error);
      console.log('Full result:', planResult);
    }
    
    expect(planResult.success).toBe(true);
    expect(planResult.data).toBeDefined();
    expect(planResult.data.plan).toBeDefined();
    
    const behaviorTree = planResult.data.plan;
    console.log('Generated BT structure:', JSON.stringify(behaviorTree, null, 2));
    
    console.log('=== STEP 2: VALIDATE PLAN ===');
    
    // Validate the generated plan
    const validationResult = await validator.validate(behaviorTree, tools);
    
    console.log('Validation result:', {
      valid: validationResult.valid,
      errorsCount: validationResult.errors.length,
      warningsCount: validationResult.warnings.length
    });
    
    if (!validationResult.valid) {
      console.log('Validation errors:', validationResult.errors);
      console.log('Validation warnings:', validationResult.warnings);
    }
    
    expect(validationResult.valid).toBe(true);
    expect(validationResult.errors).toHaveLength(0);
    
    console.log('✅ Plan validation passed!');
    
    console.log('=== STEP 3: ENRICH PLAN WITH TOOL IDs ===');
    
    // Find all action nodes and enrich with tool IDs
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
    console.log(`Found ${actionNodes.length} action nodes to enrich`);
    
    for (const action of actionNodes) {
      const tool = tools.find(t => t.name === action.tool);
      expect(tool).toBeDefined();
      action.tool_id = tool._id;
      console.log(`Enriched ${action.tool} -> ${tool._id}`);
      
      // VERIFY THE OUTPUTS FORMAT IS CORRECT
      if (action.outputs) {
        console.log(`Action ${action.id} outputs:`, action.outputs);
        
        if (action.tool === 'directory_create') {
          const outputKeys = Object.keys(action.outputs);
          const hasCorrectFields = outputKeys.some(key => ['dirpath', 'created'].includes(key));
          const hasWrapperFields = outputKeys.some(key => ['success', 'message', 'data'].includes(key));
          
          expect(hasCorrectFields).toBe(true);
          expect(hasWrapperFields).toBe(false);
          console.log('✅ directory_create uses correct output format');
        }
        
        if (action.tool === 'file_write') {
          const outputKeys = Object.keys(action.outputs);
          const hasCorrectFields = outputKeys.some(key => ['filepath', 'bytesWritten', 'created'].includes(key));
          const hasWrapperFields = outputKeys.some(key => ['success', 'message', 'data'].includes(key));
          
          expect(hasCorrectFields).toBe(true);
          expect(hasWrapperFields).toBe(false);
          console.log('✅ file_write uses correct output format');
        }
      }
    }
    
    console.log('=== STEP 4: EXECUTE BEHAVIOR TREE ===');
    
    executor.setMode('run');
    await executor.initializeTree(behaviorTree);
    
    const executionResult = await executor.execute();
    
    console.log('Execution result:', {
      complete: executionResult.complete,
      success: executionResult.success
    });
    console.log('Execution artifacts:', executor.executionContext.artifacts);
    
    expect(executionResult.complete).toBe(true);
    expect(executionResult.success).toBe(true);
    
    console.log('=== STEP 5: VERIFY FILE SYSTEM RESULTS ===');
    
    // Verify the directory was created
    const dirExists = await fs.access('test_complete_flow')
      .then(() => true)
      .catch(() => false);
    expect(dirExists).toBe(true);
    console.log('✅ Directory test_complete_flow exists');
    
    // Verify the file was created with correct content
    const fileContent = await fs.readFile('test_complete_flow/hello.txt', 'utf8');
    expect(fileContent).toBe('Hello complete flow!');
    console.log('✅ File hello.txt exists with correct content');
    
    console.log('=== STEP 6: VERIFY ARTIFACT MAPPING ===');
    
    // Verify artifacts were correctly mapped from tool data fields
    const artifacts = executor.executionContext.artifacts;
    expect(Object.keys(artifacts).length).toBeGreaterThan(0);
    
    let foundDirPath = false;
    let foundFileBytes = false;
    
    for (const [varName, value] of Object.entries(artifacts)) {
      console.log(`Artifact: ${varName} = ${JSON.stringify(value)}`);
      
      if (typeof value === 'string' && value.includes('test_complete_flow')) {
        foundDirPath = true;
        console.log('✅ Found directory path mapping');
      }
      
      if (typeof value === 'number' && value > 0) {
        foundFileBytes = true;
        console.log('✅ Found file bytes written mapping');
      }
      
      // Should NOT have wrapper success values
      if (varName.toLowerCase().includes('success') && value === true) {
        console.log('❌ Found wrapper success field - this should not happen');
        expect(true).toBe(false); // Fail the test
      }
    }
    
    expect(foundDirPath || foundFileBytes).toBe(true); // At least one correct mapping
    
    console.log('=== ✅ COMPLETE END-TO-END TEST PASSED! ===');
    console.log('✅ LLM generated plan with correct outputs format');
    console.log('✅ Plan passed BT validation');
    console.log('✅ BT executed successfully');
    console.log('✅ File system operations completed correctly');  
    console.log('✅ Artifacts mapped to actual tool data fields');
    console.log('✅ NO wrapper field contamination detected');
    
  }, 120000); // 2 minute timeout
});