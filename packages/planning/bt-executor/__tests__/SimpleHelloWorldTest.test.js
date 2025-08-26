/**
 * Simple test with mock LLM to generate hello world
 */

import { Planner } from '@legion/planner';
import { BTValidator } from '@legion/bt-validator';
import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import { ToolRegistry } from '@legion/tools-registry/src/integration/ToolRegistry.js';
import fs from 'fs/promises';

describe('Simple Hello World Test', () => {
  let executor;
  let validator;
  let toolRegistry;

  beforeAll(async () => {
    toolRegistry = await ToolRegistry.getInstance();
    await toolRegistry.loadAllModules();
    
    validator = new BTValidator();
    executor = new DebugBehaviorTreeExecutor(toolRegistry);
  }, 30000);

  afterAll(async () => {
    if (toolRegistry && toolRegistry.cleanup) {
      await toolRegistry.cleanup();
    }
  });

  beforeEach(async () => {
    try {
      await fs.rm('hello.js', { force: true });
    } catch (error) {}
  });

  test('should execute a correct hello world plan', async () => {
    console.log('\n=== HELLO WORLD EXECUTION TEST ===\n');
    
    // Create the correct plan directly
    const behaviorTree = {
      "type": "sequence",
      "id": "hello-world-program",
      "description": "Create and run a hello world JavaScript program",
      "children": [
        {
          "type": "action",
          "id": "write-hello-world",
          "tool": "file_write",
          "description": "Write hello world program to file",
          "outputs": {
            "filepath": "jsFilePath",
            "bytesWritten": "fileBytes",
            "created": "fileCreated"
          },
          "inputs": {
            "filepath": "hello.js",
            "content": "console.log('Hello, World!');"
          }
        },
        {
          "type": "condition",
          "id": "check-file-created",
          "check": "context.artifacts['fileCreated'] === true",
          "description": "Verify file was created"
        },
        {
          "type": "action",
          "id": "run-hello-world",
          "tool": "run_node",
          "description": "Execute the hello world program",
          "outputs": {
            "stdout": "programOutput",
            "exitCode": "programExitCode"
          },
          "inputs": {
            "projectPath": ".",
            "command": "node hello.js"
          }
        },
        {
          "type": "condition",
          "id": "check-execution",
          "check": "context.artifacts['programExitCode'] === 0",
          "description": "Verify program ran successfully"
        }
      ]
    };
    
    console.log('Plan structure:', JSON.stringify(behaviorTree, null, 2));
    
    // Get tools
    const tools = await toolRegistry.listTools();
    
    // Validate
    console.log('\n=== VALIDATING ===');
    const validationResult = await validator.validate(behaviorTree, tools);
    
    if (!validationResult.valid) {
      console.log('Validation errors:', validationResult.errors);
      console.log('Validation warnings:', validationResult.warnings);
    }
    
    expect(validationResult.valid).toBe(true);
    console.log('✅ Validation passed');
    
    // Enrich with tool IDs
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
      const tool = tools.find(t => t.name === action.tool);
      if (tool) {
        action.tool_id = tool._id;
        console.log(`Enriched ${action.tool} with ID ${tool._id}`);
      }
    }
    
    // Execute
    console.log('\n=== EXECUTING ===');
    executor.setMode('run');
    await executor.initializeTree(behaviorTree);
    const executionResult = await executor.execute();
    
    console.log('\nExecution result:', executionResult);
    console.log('Artifacts:', executor.executionContext.artifacts);
    
    expect(executionResult.complete).toBe(true);
    expect(executionResult.success).toBe(true);
    
    // Verify file was created
    const fileContent = await fs.readFile('hello.js', 'utf8');
    console.log('\nCreated file content:', fileContent);
    expect(fileContent).toBe("console.log('Hello, World!');");
    
    console.log('\n=== ✅ TEST PASSED ===');
  }, 60000);
});