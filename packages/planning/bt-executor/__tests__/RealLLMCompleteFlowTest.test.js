/**
 * REAL LLM COMPLETE END-TO-END TEST
 * Tests: REAL LLM → Plan Generation → Validation → BT Execution
 * This test MUST pass to prove the outputs format fix works with real AI generation
 */

import { Planner } from '@legion/planner';
import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import { BTValidator } from '@legion/bt-validator';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry/src/integration/ToolRegistry.js';
import fs from 'fs/promises';

describe('REAL LLM Complete Flow Test', () => {
  let planner;
  let executor;
  let validator;
  let toolRegistry;
  let resourceManager;

  beforeAll(async () => {
    console.log('=== INITIALIZING REAL LLM TEST ENVIRONMENT ===');
    
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
    
    // Get REAL LLM client from ResourceManager
    const llmClient = await resourceManager.get('llmClient');
    expect(llmClient).toBeDefined();
    console.log('✅ Got real LLM client from ResourceManager');
    
    planner = new Planner({ llmClient });
    validator = new BTValidator();
    executor = new DebugBehaviorTreeExecutor(toolRegistry);
    
    console.log('=== ALL COMPONENTS INITIALIZED WITH REAL LLM ===');
  }, 30000);

  afterAll(async () => {
    if (toolRegistry && toolRegistry.cleanup) {
      await toolRegistry.cleanup();
    }
  });

  beforeEach(async () => {
    // Clean up test files/dirs
    try {
      await fs.rm('test_real_llm_flow', { recursive: true, force: true });
    } catch (error) {
      // Ignore if doesn't exist
    }
  });

  test('REAL LLM: Generate → Validate → Execute → Verify artifacts mapping', async () => {
    console.log('=== STEP 1: REAL LLM GENERATES PLAN ===');
    
    const tools = await toolRegistry.listTools();
    const fileWriteTool = tools.find(t => t.name === 'file_write');
    const dirCreateTool = tools.find(t => t.name === 'directory_create');
    
    const testGoal = 'Create a directory called test_real_llm_flow and write a file greeting.txt with content "Real LLM generated this!" inside it';
    const availableTools = [dirCreateTool, fileWriteTool];
    
    const planResult = await planner.makePlan(testGoal, availableTools);
    
    console.log('Real LLM plan result:', { success: planResult.success, hasError: !!planResult.error });
    
    if (!planResult.success) {
      console.log('REAL LLM PLAN ERROR:', planResult.error);
      console.log('Full result:', planResult);
    }
    
    expect(planResult.success).toBe(true);
    expect(planResult.data).toBeDefined();
    expect(planResult.data.plan).toBeDefined();
    
    const behaviorTree = planResult.data.plan;
    console.log('Real LLM generated BT structure:');
    console.log(JSON.stringify(behaviorTree, null, 2));
    
    console.log('=== STEP 2: VALIDATE REAL LLM PLAN ===');
    
    // Validate the generated plan
    const validationResult = await validator.validate(behaviorTree, tools);
    
    console.log('Real LLM validation result:', {
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
    
    console.log('✅ Real LLM plan validation passed!');
    
    console.log('=== STEP 3: ANALYZE REAL LLM OUTPUTS FORMAT ===');
    
    // Find all action nodes and verify outputs format
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
    console.log(`Found ${actionNodes.length} action nodes from real LLM`);
    
    let dirCreateAction = null;
    let fileWriteAction = null;
    
    for (const action of actionNodes) {
      const tool = tools.find(t => t.name === action.tool);
      expect(tool).toBeDefined();
      action.tool_id = tool._id;
      console.log(`Real LLM action: ${action.tool} -> ${tool._id}`);
      
      if (action.tool === 'directory_create') {
        dirCreateAction = action;
      }
      if (action.tool === 'file_write') {
        fileWriteAction = action;
      }
      
      // CRITICAL: Verify the outputs format is correct
      if (action.outputs) {
        console.log(`Real LLM action ${action.id} outputs:`, action.outputs);
        
        if (action.tool === 'directory_create') {
          const outputKeys = Object.keys(action.outputs);
          console.log(`directory_create output keys: ${outputKeys.join(', ')}`);
          
          // Check if it uses actual tool data fields, not wrapper fields
          const hasToolFields = outputKeys.some(key => ['dirpath', 'created'].includes(key));
          const hasWrapperFields = outputKeys.some(key => ['success', 'message', 'data'].includes(key));
          
          if (hasToolFields && !hasWrapperFields) {
            console.log('✅ Real LLM uses correct directory_create output format!');
          } else if (hasWrapperFields) {
            console.log('❌ Real LLM still uses old wrapper format for directory_create');
            expect(hasWrapperFields).toBe(false);
          } else {
            console.log('⚠️ Real LLM uses unexpected output format for directory_create');
          }
        }
        
        if (action.tool === 'file_write') {
          const outputKeys = Object.keys(action.outputs);
          console.log(`file_write output keys: ${outputKeys.join(', ')}`);
          
          // Check if it uses actual tool data fields, not wrapper fields
          const hasToolFields = outputKeys.some(key => ['filepath', 'bytesWritten', 'created'].includes(key));
          const hasWrapperFields = outputKeys.some(key => ['success', 'message', 'data'].includes(key));
          
          if (hasToolFields && !hasWrapperFields) {
            console.log('✅ Real LLM uses correct file_write output format!');
          } else if (hasWrapperFields) {
            console.log('❌ Real LLM still uses old wrapper format for file_write');
            expect(hasWrapperFields).toBe(false);
          } else {
            console.log('⚠️ Real LLM uses unexpected output format for file_write');
          }
        }
      }
    }
    
    console.log('=== STEP 4: EXECUTE REAL LLM PLAN ===');
    
    executor.setMode('run');
    await executor.initializeTree(behaviorTree);
    
    const executionResult = await executor.execute();
    
    console.log('Real LLM execution result:', {
      complete: executionResult.complete,
      success: executionResult.success
    });
    console.log('Real LLM execution artifacts:', executor.executionContext.artifacts);
    
    expect(executionResult.complete).toBe(true);
    expect(executionResult.success).toBe(true);
    
    console.log('=== STEP 5: VERIFY REAL FILE SYSTEM RESULTS ===');
    
    // Verify the directory was created
    const dirExists = await fs.access('test_real_llm_flow')
      .then(() => true)
      .catch(() => false);
    expect(dirExists).toBe(true);
    console.log('✅ Real LLM created directory test_real_llm_flow');
    
    // Verify the file was created with correct content
    const fileContent = await fs.readFile('test_real_llm_flow/greeting.txt', 'utf8');
    expect(fileContent).toBe('Real LLM generated this!');
    console.log('✅ Real LLM created file greeting.txt with correct content');
    
    console.log('=== STEP 6: VERIFY REAL LLM ARTIFACT MAPPING ===');
    
    // Verify artifacts were correctly mapped from actual tool data fields
    const artifacts = executor.executionContext.artifacts;
    expect(Object.keys(artifacts).length).toBeGreaterThan(0);
    
    let foundCorrectMapping = false;
    let foundWrapperMapping = false;
    
    for (const [varName, value] of Object.entries(artifacts)) {
      console.log(`Real LLM artifact: ${varName} = ${JSON.stringify(value)}`);
      
      // Look for correct mapping from tool data fields
      if (typeof value === 'string' && value.includes('test_real_llm_flow')) {
        foundCorrectMapping = true;
        console.log('✅ Found correct directory path mapping from real LLM');
      }
      
      if (typeof value === 'number' && value > 0) {
        foundCorrectMapping = true;
        console.log('✅ Found correct bytes written mapping from real LLM');
      }
      
      // Should NOT have wrapper success values
      if (varName.toLowerCase().includes('success') && value === true) {
        foundWrapperMapping = true;
        console.log('❌ Found wrapper success field from real LLM - this should not happen');
      }
    }
    
    expect(foundCorrectMapping).toBe(true);
    expect(foundWrapperMapping).toBe(false);
    
    console.log('=== ✅ REAL LLM COMPLETE END-TO-END TEST PASSED! ===');
    console.log('✅ REAL LLM generated plan with correct outputs format');
    console.log('✅ REAL LLM plan passed BT validation');
    console.log('✅ REAL LLM BT executed successfully');
    console.log('✅ REAL LLM file system operations completed correctly');  
    console.log('✅ REAL LLM artifacts mapped to actual tool data fields');
    console.log('✅ NO wrapper field contamination from real LLM');
    
  }, 120000); // 2 minute timeout for real LLM calls
});