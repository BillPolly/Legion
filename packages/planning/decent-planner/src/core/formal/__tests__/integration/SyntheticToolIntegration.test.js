/**
 * Integration test for synthetic tool creation
 * Uses real planner to generate BT, then transforms to synthetic tool
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { SyntheticToolFactory } from '../../SyntheticToolFactory.js';
import { Planner } from '@legion/planner';
import { ResourceManager } from '@legion/resource-manager';
import { Anthropic } from '@anthropic-ai/sdk';

describe('Synthetic Tool Integration', () => {
  let factory;
  let planner;
  let resourceManager;
  let llmClient;

  beforeAll(async () => {
    // NEW API: getInstance() is now async and returns fully initialized instance
    resourceManager = await ResourceManager.getInstance();
    
    // Get API key and create LLM client
    const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      console.log('Skipping integration test - no ANTHROPIC_API_KEY');
      return;
    }
    
    const anthropic = new Anthropic({ apiKey: anthropicKey });
    llmClient = {
      complete: async (prompt) => {
        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2000,
          temperature: 0.2,
          messages: [{ role: 'user', content: prompt }]
        });
        return response.content[0].text;
      }
    };
    
    // Initialize components
    factory = new SyntheticToolFactory();
    planner = new Planner({ llmClient });
  });

  it('should create synthetic tool from real planner output', async () => {
    if (!llmClient) {
      console.log('Test skipped - no LLM available');
      return;
    }
    
    // Create a simple task that the planner can handle
    const taskDescription = 'Write the text "Hello World" to a file named output.txt';
    
    // Define available tools for the planner
    const availableTools = [
      {
        name: 'file_write',
        description: 'Write content to a file',
        inputSchema: {
          filepath: { type: 'string', required: true },
          content: { type: 'string', required: true }
        },
        outputSchema: {
          success: { type: 'boolean' },
          filepath: { type: 'string' }
        }
      },
      {
        name: 'directory_create',
        description: 'Create a directory',
        inputSchema: {
          path: { type: 'string', required: true }
        },
        outputSchema: {
          success: { type: 'boolean' },
          path: { type: 'string' }
        }
      }
    ];
    
    // Generate BT using real planner
    console.log('Generating BT with real planner...');
    const planResult = await planner.makePlan(taskDescription, availableTools);
    
    console.log('Plan result:', { 
      success: planResult.success, 
      error: planResult.error,
      hasData: !!planResult.data 
    });
    
    if (!planResult.success) {
      console.error('Plan failed:', planResult.error);
    }
    expect(planResult.success).toBe(true);
    
    if (!planResult.data) {
      console.error('No data in plan result:', planResult);
    }
    expect(planResult.data).toBeDefined();
    
    const behaviorTree = planResult.data?.plan || planResult.data;
    console.log('Generated BT type:', behaviorTree?.type);
    console.log('Generated BT keys:', behaviorTree ? Object.keys(behaviorTree) : 'undefined');
    
    // Verify BT structure
    expect(behaviorTree).toBeDefined();
    expect(behaviorTree.type).toBeDefined();
    
    // Create task node to represent this as a reusable component
    const taskNode = {
      id: 'write-hello-world',
      description: 'Write Hello World to file',
      level: 1,
      complexity: 'SIMPLE'
    };
    
    // Transform BT to synthetic tool
    const syntheticTool = factory.createFromBT(behaviorTree, taskNode);
    
    console.log('Created synthetic tool:', {
      name: syntheticTool.name,
      inputs: Object.keys(syntheticTool.inputSchema),
      outputs: Object.keys(syntheticTool.outputSchema)
    });
    
    // Validate synthetic tool
    expect(syntheticTool).toBeDefined();
    expect(syntheticTool.name).toContain('write-hello-world');
    expect(syntheticTool.type).toBe('synthetic');
    expect(syntheticTool.executionPlan).toBe(behaviorTree);
    
    // Validate the tool structure
    const validation = syntheticTool.validate();
    expect(validation.valid).toBe(true);
    
    // The tool should be ready to use at a parent level
    expect(syntheticTool.description).toBe('Write Hello World to file');
    expect(syntheticTool.metadata.sourceTaskId).toBe('write-hello-world');
  }, 30000);
  
  it('should handle complex BT with multiple outputs', async () => {
    if (!llmClient) {
      console.log('Test skipped - no LLM available');
      return;
    }
    
    // Create a more complex task
    const taskDescription = 'Create a directory called "data", then write a JSON config file in it';
    
    const availableTools = [
      {
        name: 'directory_create',
        description: 'Create a directory',
        inputSchema: { path: { type: 'string', required: true } },
        outputSchema: { success: { type: 'boolean' }, path: { type: 'string' } }
      },
      {
        name: 'json_write',
        description: 'Write JSON data to a file',
        inputSchema: {
          filepath: { type: 'string', required: true },
          data: { type: 'object', required: true }
        },
        outputSchema: {
          success: { type: 'boolean' },
          filepath: { type: 'string' }
        }
      }
    ];
    
    // Generate BT
    console.log('Generating complex BT...');
    const planResult = await planner.makePlan(taskDescription, availableTools);
    
    expect(planResult.success).toBe(true);
    const behaviorTree = planResult.data?.plan || planResult.data;
    
    // Create task node
    const taskNode = {
      id: 'setup-data-dir',
      description: 'Set up data directory with config',
      level: 2,
      complexity: 'SIMPLE'
    };
    
    // Transform to synthetic tool
    const syntheticTool = factory.createFromBT(behaviorTree, taskNode);
    
    console.log('Complex synthetic tool:', {
      name: syntheticTool.name,
      inputs: Object.keys(syntheticTool.inputSchema),
      outputs: Object.keys(syntheticTool.outputSchema),
      hasMultipleActions: behaviorTree.children?.length > 1
    });
    
    // Validate
    expect(syntheticTool).toBeDefined();
    expect(syntheticTool.executionPlan).toBe(behaviorTree);
    
    // Should have extracted outputs from the BT
    const outputs = Object.keys(syntheticTool.outputSchema);
    expect(outputs.length).toBeGreaterThan(0);
    
    // Validate structure
    const validation = syntheticTool.validate();
    if (!validation.valid) {
      console.log('Validation errors:', validation.errors);
    }
    expect(validation.valid).toBe(true);
  }, 30000);
});