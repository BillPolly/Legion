/**
 * Simple integration test for Planner with real LLM
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { Planner } from '../../src/core/Planner.js';
import { ResourceManager } from '@legion/resource-manager';
import { Anthropic } from '@anthropic-ai/sdk';

describe('Planner Integration', () => {
  let planner;
  let tools;

  beforeAll(async () => {
    // Initialize ResourceManager (loads .env automatically)
    const resourceManager = await ResourceManager.getResourceManager();
    
    // Get API key and create LLM client
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not found in .env');
    }
    
    // Create a simple LLM client wrapper
    const anthropic = new Anthropic({ apiKey });
    const llmClient = {
      complete: async (prompt, options = {}) => {
        const response = await anthropic.messages.create({
          model: options.model || 'claude-3-5-sonnet-20241022',
          max_tokens: options.maxTokens || 4000,
          temperature: options.temperature || 0.2,
          system: options.system || '',
          messages: [{ role: 'user', content: prompt }]
        });
        return response.content[0].text;
      }
    };
    
    // Get tools from ToolRegistry singleton - check what's available
    const { ToolRegistry } = await import('@legion/tools-registry');
    const toolRegistry = await ToolRegistry.getInstance();
    
    // Check available tools first
    const allTools = await toolRegistry.listTools();
    console.log('Available tools:', allTools.map(t => t.name));
    
    // Try to get file_write first, if not available, use a mock
    let fileWriteTool = await toolRegistry.getTool('file_write');
    
    if (!fileWriteTool) {
      console.log('file_write tool not found, using mock tool');
      // Create a simple mock tool for testing
      fileWriteTool = {
        name: 'file_write',
        description: 'Write content to a file',
        inputSchema: {
          type: 'object',
          properties: {
            filepath: { type: 'string', description: 'Path to the file' },
            content: { type: 'string', description: 'Content to write' }
          },
          required: ['filepath', 'content']
        }
      };
    }
    
    tools = [fileWriteTool];
    
    // Create planner with real LLM client
    planner = new Planner({ 
      llmClient,
      tools 
    });
  });

  it('should create a plan to write hello world to a file', async () => {
    const requirements = 'Write "Hello, World!" to a file called hello.txt';
    
    // Call the planner
    const result = await planner.makePlan(requirements, tools);
    
    // Check result structure
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.plan).toBeDefined();
    expect(result.error).toBe(null);
    
    // Check plan structure
    const plan = result.data.plan;
    expect(plan.type).toBeDefined();
    expect(plan.id).toBeDefined();
    
    // Should have created a plan with file_write action
    const hasFileWrite = JSON.stringify(plan).includes('file_write');
    expect(hasFileWrite).toBe(true);
    
    // Should reference hello.txt
    const hasHelloTxt = JSON.stringify(plan).includes('hello.txt');
    expect(hasHelloTxt).toBe(true);
    
    // Should include the content
    const hasContent = JSON.stringify(plan).includes('Hello, World!') || 
                      JSON.stringify(plan).includes('Hello World');
    expect(hasContent).toBe(true);
    
    // Log the plan for inspection
    console.log('\n=== Generated Plan ===');
    console.log(JSON.stringify(plan, null, 2));
    console.log('=== Plan Metadata ===');
    console.log(`Attempts: ${result.data.attempts}`);
    console.log(`Node count: ${result.data.nodeCount}`);
  }, 30000); // 30 second timeout for LLM call
});