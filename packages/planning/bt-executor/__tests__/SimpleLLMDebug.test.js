/**
 * Minimal test to see LLM response for hello world
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

describe('Simple LLM Debug', () => {
  test('log LLM response for hello world', async () => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not found');
    }

    const llmClient = new LLMClient({
      provider: 'anthropic',
      apiKey: apiKey,
      model: 'claude-3-5-sonnet-20241022'
    });

    // Minimal tools needed
    const tools = [
      {
        name: 'file_write',
        description: 'Write content to a file',
        inputSchema: {
          type: 'object',
          properties: {
            filepath: { type: 'string', description: 'Path where file should be written' },
            content: { type: 'string', description: 'Content to write' }
          },
          required: ['filepath', 'content']
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

    console.log('\n=== Testing Hello World Generation ===\n');
    
    const goal = "please write a simple hello world program in javascript";
    
    // Try to generate plan with max 1 attempt
    const result = await planner.makePlan(goal, tools, {
      maxAttempts: 1
    });
    
    console.log('\n=== Result ===');
    console.log('Success:', result.success);
    if (result.error) {
      console.log('Error:', result.error);
    }
    if (result.data?.validation?.errors) {
      console.log('\nValidation errors:');
      result.data.validation.errors.forEach(err => {
        console.log(`  - ${err.type}: ${err.message}`);
        if (err.path) console.log(`    Path: ${err.path}`);
      });
    }
  }, 120000);
});