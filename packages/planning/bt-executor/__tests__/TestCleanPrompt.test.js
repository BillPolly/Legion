/**
 * Test the cleaned up prompt and save debug files
 */

import { Planner } from '@legion/planner';
import { LLMClient } from '@legion/llm';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables from monorepo root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPath = path.resolve(__dirname, '../../../../.env');
dotenv.config({ path: rootPath });

describe('Clean Prompt Test', () => {
  test('generate plan with cleaned prompt and save debug files', async () => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not found');
    }

    const llmClient = new LLMClient({
      provider: 'anthropic',
      apiKey: apiKey,
      model: 'claude-3-5-sonnet-20241022'
    });

    // Simple tools with the names we actually have
    const tools = [
      {
        name: 'file_writer',
        description: 'Write content to a file',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Path where file should be written' },
            content: { type: 'string', description: 'Content to write' }
          },
          required: ['filePath', 'content']
        }
      },
      {
        name: 'run_node',
        description: 'Execute JavaScript file using Node.js',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: { type: 'string', description: 'Project directory path' },
            command: { type: 'string', description: 'Command to execute' }
          },
          required: ['projectPath', 'command']
        }
      }
    ];

    const planner = new Planner({
      llmClient: llmClient,
      tools: tools
    });

    console.log('\n=== Testing Clean Prompt ===\n');
    
    const goal = "please write a simple hello world program in javascript";
    
    // Generate plan with debug file saving
    const result = await planner.makePlan(goal, tools, {
      maxAttempts: 1,
      saveDebugFiles: true  // This will save prompt and response to files
    });
    
    console.log('\n=== Result ===');
    console.log('Success:', result.success);
    
    if (result.success) {
      console.log('\n=== Generated Plan ===');
      console.log(JSON.stringify(result.data.plan, null, 2));
      
      // Check the structure
      const plan = result.data.plan;
      expect(plan.type).toBe('sequence');
      expect(plan.children).toBeDefined();
      expect(plan.children.length).toBeGreaterThan(0);
      
      // Check that it's using the correct tool names
      const actions = [];
      function collectActions(node) {
        if (node.type === 'action') {
          actions.push(node);
        }
        if (node.children) {
          node.children.forEach(collectActions);
        }
      }
      collectActions(plan);
      
      console.log('\n=== Actions Found ===');
      actions.forEach(action => {
        console.log(`- ${action.id}: tool=${action.tool}`);
        console.log(`  inputs:`, action.inputs);
        if (action.outputs) {
          console.log(`  outputs:`, action.outputs);
        }
      });
      
      // Verify tool names
      actions.forEach(action => {
        expect(['file_writer', 'run_node']).toContain(action.tool);
      });
      
      console.log('\n✅ Plan generated successfully with correct tool names');
    } else {
      console.log('Error:', result.error);
      if (result.data?.validation?.errors) {
        console.log('\nValidation errors:');
        result.data.validation.errors.forEach(err => {
          console.log(`  - ${err.type}: ${err.message}`);
        });
      }
    }
    
    expect(result.success).toBe(true);
  }, 60000);
});