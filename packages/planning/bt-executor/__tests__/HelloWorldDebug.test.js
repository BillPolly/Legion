/**
 * Debug test to capture raw LLM response for hello world program
 */

import { Planner } from '@legion/planner';
import { LLMClient } from '@legion/llm';
import toolRegistry from '@legion/tools-registry';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

describe('Hello World LLM Debug', () => {
  let planner;
  let llmClient;
  let tools;

  beforeAll(async () => {
    // Initialize real LLM client
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not found in environment');
    }

    llmClient = new LLMClient({
      provider: 'anthropic',
      apiKey: apiKey,
      model: 'claude-3-5-sonnet-20241022'
    });
    
    // Register the filesystem module (includes file_write, directory_create)
    const FileSystemModule = (await import('@legion/fs')).default;
    const fsModule = new FileSystemModule();
    await fsModule.initialize();
    
    // Register the code module (includes run_node)
    const CodeModule = (await import('@legion/code')).default;
    const codeModule = new CodeModule();
    await codeModule.initialize();
    
    // Get the tools
    tools = [
      toolRegistry.getTool('directory_create'),
      toolRegistry.getTool('file_write'),
      toolRegistry.getTool('run_node')
    ];

    // Create planner with real LLM
    planner = new Planner({
      llmClient: llmClient,
      tools: tools
    });
  });

  test('should generate valid plan for hello world program', async () => {
    console.log('\n=== Starting Hello World Plan Generation ===\n');
    
    const goal = "please write a simple hello world program in javascript";
    
    console.log('Goal:', goal);
    console.log('Available tools:', tools.map(t => t.name));
    
    // Generate plan - this will log the prompt and response
    const result = await planner.makePlan(goal, tools, {
      debug: true,
      maxAttempts: 1  // Just one attempt so we see the raw response
    });
    
    console.log('\n=== Plan Generation Result ===');
    console.log('Success:', result.success);
    if (!result.success) {
      console.log('Error:', result.error);
      console.log('Validation errors:', JSON.stringify(result.data?.validation?.errors, null, 2));
    } else {
      console.log('Generated plan:', JSON.stringify(result.data.plan, null, 2));
    }
    
    // Even if it fails, let's see what was generated
    if (result.data?.lastPlan) {
      console.log('\n=== Last Generated Plan (before validation) ===');
      console.log(JSON.stringify(result.data.lastPlan, null, 2));
    }
  }, 60000); // Long timeout for LLM
});