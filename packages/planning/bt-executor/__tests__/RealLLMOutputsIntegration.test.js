/**
 * REAL END-TO-END INTEGRATION TEST
 * Tests the complete flow: Real LLM -> Plan Generation -> Validation -> BT Execution
 * NO MOCKS - everything must work with real components
 */

import { DecentPlanner } from '@legion/decent-planner';
import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import { BTValidator } from '@legion/bt-validator';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry/src/integration/ToolRegistry.js';
import fs from 'fs/promises';
import path from 'path';

describe('REAL LLM Outputs Integration Test', () => {
  let planner;
  let executor;
  let validator;
  let toolRegistry;
  let resourceManager;

  beforeAll(async () => {
    console.log('=== INITIALIZING REAL COMPONENTS ===');
    
    // Initialize real resource manager
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    // Initialize real tool registry
    toolRegistry = await ToolRegistry.getInstance();
    const loadResult = await toolRegistry.loadAllModules();
    console.log(`Loaded ${loadResult.modulesLoaded} modules, ${loadResult.toolsLoaded} tools`);
    
    if (loadResult.modulesFailed > 0) {
      console.log(`Warning: ${loadResult.modulesFailed} modules failed to load:`, loadResult.errors);
      // Don't fail the test - just ensure we have the core tools we need
    }
    
    // Verify we have the essential tools
    const tools = await toolRegistry.listTools();
    const hasFileWrite = tools.some(t => t.name === 'file_write');
    const hasDirCreate = tools.some(t => t.name === 'directory_create');
    
    if (!hasFileWrite || !hasDirCreate) {
      throw new Error(`Missing essential tools. file_write: ${hasFileWrite}, directory_create: ${hasDirCreate}`);
    }

    // Initialize REAL planner with refactored architecture
    planner = new DecentPlanner({
      maxDepth: 5,
      confidenceThreshold: 0.5,
      enableFormalPlanning: true,
      validateBehaviorTrees: true
    });
    
    await planner.initialize();
    planner.toolRegistry = toolRegistry;

    // Initialize BT components
    validator = new BTValidator();
    executor = new DebugBehaviorTreeExecutor(toolRegistry);
    
    console.log('=== ALL REAL COMPONENTS INITIALIZED ===');
  }, 60000); // 60 second timeout for initialization

  afterAll(async () => {
    if (toolRegistry && toolRegistry.cleanup) {
      await toolRegistry.cleanup();
    }
  });

  beforeEach(async () => {
    // Clean up any test files before each test
    const testFiles = ['integration_test_file.txt', 'test_directory'];
    for (const file of testFiles) {
      try {
        const stats = await fs.stat(file);
        if (stats.isDirectory()) {
          await fs.rmdir(file, { recursive: true });
        } else {
          await fs.unlink(file);
        }
      } catch (error) {
        // Ignore if file doesn't exist
      }
    }
  });

  test('REAL LLM should generate plan with correct outputs format and execute successfully', async () => {
    const testGoal = 'Create a directory called test_directory and write a file called hello.txt with content "Hello World!" inside it';
    
    console.log('=== STEP 1: GENERATING PLAN WITH REAL LLM ===');
    console.log('Goal:', testGoal);
    
    const planResult = await planner.plan(testGoal);
    
    expect(planResult.success).toBe(true);
    expect(planResult.formal).toBeDefined();
    expect(planResult.formal.behaviorTrees).toHaveLength(1);
    
    const behaviorTree = planResult.formal.behaviorTrees[0];
    console.log('Generated BT:', JSON.stringify(behaviorTree, null, 2));
    
    console.log('=== STEP 2: FINDING AND CHECKING ACTION NODES ===');
    
    // Find all action nodes recursively
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
    console.log(`Found ${actionNodes.length} action nodes`);
    
    // Check that action nodes use correct outputs format
    for (const action of actionNodes) {
      console.log(`\nChecking action: ${action.id}, tool: ${action.tool}`);
      
      if (action.outputs) {
        console.log(`Outputs:`, action.outputs);
        
        // Verify outputs use actual tool field names, not wrapper fields
        const outputKeys = Object.keys(action.outputs);
        
        if (action.tool === 'directory_create') {
          // Should have dirpath and/or created, NOT success/message/data
          const hasCorrectFields = outputKeys.some(key => ['dirpath', 'created'].includes(key));
          const hasWrapperFields = outputKeys.some(key => ['success', 'message', 'data'].includes(key));
          
          expect(hasCorrectFields).toBe(true);
          expect(hasWrapperFields).toBe(false);
          
          console.log(`✅ directory_create uses correct field names:`, outputKeys);
        }
        
        if (action.tool === 'file_write') {
          // Should have filepath, bytesWritten, created, NOT success/message/data
          const hasCorrectFields = outputKeys.some(key => ['filepath', 'bytesWritten', 'created'].includes(key));
          const hasWrapperFields = outputKeys.some(key => ['success', 'message', 'data'].includes(key));
          
          expect(hasCorrectFields).toBe(true);
          expect(hasWrapperFields).toBe(false);
          
          console.log(`✅ file_write uses correct field names:`, outputKeys);
        }
      }
    }
    
    console.log('=== STEP 3: VALIDATING BEHAVIOR TREE ===');
    
    const tools = await toolRegistry.listTools();
    const validationResult = await validator.validate(behaviorTree, tools);
    
    console.log('Validation result:', {
      valid: validationResult.valid,
      errors: validationResult.errors,
      warnings: validationResult.warnings
    });
    
    expect(validationResult.valid).toBe(true);
    expect(validationResult.errors).toHaveLength(0);
    
    console.log('=== STEP 4: ENRICHING TREE WITH TOOL IDs ===');
    
    // Enrich action nodes with tool IDs
    for (const action of actionNodes) {
      const tool = tools.find(t => t.name === action.tool);
      expect(tool).toBeDefined();
      action.tool_id = tool._id;
      console.log(`Enriched ${action.tool} -> ${tool._id}`);
    }
    
    console.log('=== STEP 5: EXECUTING BEHAVIOR TREE ===');
    
    executor.setMode('run');
    await executor.initializeTree(behaviorTree);
    
    const executionResult = await executor.execute();
    
    console.log('Execution result:', executionResult);
    console.log('Execution artifacts:', executor.executionContext.artifacts);
    
    expect(executionResult.complete).toBe(true);
    expect(executionResult.success).toBe(true);
    
    console.log('=== STEP 6: VERIFYING ACTUAL FILE SYSTEM RESULTS ===');
    
    // Verify the directory was actually created
    const dirExists = await fs.access('test_directory')
      .then(() => true)
      .catch(() => false);
    expect(dirExists).toBe(true);
    console.log('✅ Directory test_directory was created');
    
    // Verify the file was actually created with correct content
    const fileContent = await fs.readFile('test_directory/hello.txt', 'utf8');
    expect(fileContent).toBe('Hello World!');
    console.log('✅ File hello.txt was created with correct content');
    
    console.log('=== STEP 7: VERIFYING ARTIFACT MAPPING ===');
    
    // Check that artifacts were mapped correctly using actual tool output fields
    const artifacts = executor.executionContext.artifacts;
    expect(Object.keys(artifacts).length).toBeGreaterThan(0);
    
    // Should have variables mapped from actual tool outputs, not wrapper fields
    let foundCorrectMapping = false;
    
    for (const [varName, value] of Object.entries(artifacts)) {
      console.log(`Artifact: ${varName} = ${JSON.stringify(value)}`);
      
      // If we find a dirpath value, it should be the actual directory path
      if (typeof value === 'string' && value.includes('test_directory')) {
        foundCorrectMapping = true;
        console.log('✅ Found correct directory path mapping');
      }
      
      // If we find a filepath value, it should be the actual file path
      if (typeof value === 'string' && value.includes('hello.txt')) {
        foundCorrectMapping = true;
        console.log('✅ Found correct file path mapping');
      }
      
      // Should NOT have wrapper values like boolean true for "success"
      if (varName.includes('Success') && value === true) {
        console.log('❌ Found wrapper success field mapping - this should not happen');
        expect(true).toBe(false); // Fail the test
      }
    }
    
    expect(foundCorrectMapping).toBe(true);
    
    console.log('=== ✅ FULL INTEGRATION TEST PASSED ===');
    console.log('✅ Real LLM generated correct outputs format');
    console.log('✅ BT validation passed');
    console.log('✅ BT execution succeeded');
    console.log('✅ File system operations completed');
    console.log('✅ Artifacts mapped correctly');
    
  }, 120000); // 2 minute timeout for full integration test

  test('REAL LLM should handle file operations with correct outputs mapping', async () => {
    const testGoal = 'Write a JavaScript file named script.js with the content "console.log(\\"Integration test\\");"';
    
    console.log('=== TESTING FILE WRITE WITH REAL LLM ===');
    
    const planResult = await planner.plan(testGoal);
    
    expect(planResult.success).toBe(true);
    expect(planResult.formal.behaviorTrees).toHaveLength(1);
    
    const behaviorTree = planResult.formal.behaviorTrees[0];
    
    // Find file_write action
    const findFileWriteAction = (node) => {
      if (node.type === 'action' && node.tool === 'file_write') {
        return node;
      }
      if (node.children) {
        for (const child of node.children) {
          const found = findFileWriteAction(child);
          if (found) return found;
        }
      }
      if (node.child) {
        return findFileWriteAction(node.child);
      }
      return null;
    };
    
    const fileWriteAction = findFileWriteAction(behaviorTree);
    expect(fileWriteAction).toBeDefined();
    
    console.log('file_write action outputs:', fileWriteAction.outputs);
    
    // Verify it uses actual file_write output fields
    if (fileWriteAction.outputs) {
      const outputKeys = Object.keys(fileWriteAction.outputs);
      const hasFileWriteFields = outputKeys.some(key => ['filepath', 'bytesWritten', 'created'].includes(key));
      const hasWrapperFields = outputKeys.some(key => ['success', 'message', 'data'].includes(key));
      
      expect(hasFileWriteFields).toBe(true);
      expect(hasWrapperFields).toBe(false);
    }
    
    // Execute and verify
    const tools = await toolRegistry.listTools();
    const fileWriteTool = tools.find(t => t.name === 'file_write');
    fileWriteAction.tool_id = fileWriteTool._id;
    
    executor.setMode('run');
    await executor.initializeTree(behaviorTree);
    
    const result = await executor.execute();
    
    expect(result.complete).toBe(true);
    expect(result.success).toBe(true);
    
    // Verify file was created
    const fileContent = await fs.readFile('script.js', 'utf8');
    expect(fileContent).toBe('console.log("Integration test");');
    
    // Clean up
    await fs.unlink('script.js').catch(() => {});
    
    console.log('✅ File write integration test passed');
    
  }, 90000);
});