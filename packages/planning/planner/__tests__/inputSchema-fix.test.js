/**
 * Test that verifies tools passed to planner have inputSchema
 */

import { ToolRegistry } from '@legion/tools-registry/src/integration/ToolRegistry.js';
import { Planner } from '../src/core/Planner.js';
import { LLMClient } from '@legion/llm';

describe('Planner InputSchema Fix', () => {
  let toolRegistry;
  let llmClient;
  let planner;
  
  beforeAll(async () => {
    toolRegistry = await ToolRegistry.getInstance();
    
    // Mock LLM client
    llmClient = {
      complete: async (prompt) => {
        // Store the prompt for inspection
        llmClient.lastPrompt = prompt;
        return '{"type": "action", "tool": "directory_create", "params": {"dirpath": "./test"}}';
      }
    };
    
    planner = new Planner({ llmClient });
  });
  
  test('directory_create tool should have inputSchema when passed to planner', async () => {
    // Check what tools are available first
    const allTools = await toolRegistry.listTools();
    console.log('Available tools:', allTools.map(t => t.name));
    
    // Try to get directory_create tool from registry  
    let tool = await toolRegistry.getTool('directory_create');
    
    if (!tool) {
      console.log('directory_create tool not found in registry, using mock tool');
      // Create a mock tool with proper inputSchema for testing
      tool = {
        name: 'directory_create',
        description: 'Create a directory at the specified path',
        inputSchema: {
          type: 'object',
          properties: {
            dirpath: { 
              type: 'string', 
              description: 'Path where the directory should be created' 
            }
          },
          required: ['dirpath']
        },
        execute: async (params) => ({ success: true, path: params.dirpath })
      };
    }
    
    console.log('=== REGISTRY TOOL DEBUG ===');
    console.log('Tool name:', tool.name);
    console.log('Has inputSchema:', !!tool.inputSchema);
    console.log('inputSchema:', JSON.stringify(tool.inputSchema, null, 2));
    
    expect(tool).toBeTruthy();
    expect(tool.inputSchema).toBeDefined();
    expect(tool.inputSchema.properties.dirpath).toBeDefined();
    
    // Create tools array as would be passed to planner
    const tools = [tool];
    
    try {
      await planner.makePlan('create a directory', tools);
    } catch (error) {
      // Ignore plan failures, we just want to check the prompt
    }
    
    const promptSent = llmClient.lastPrompt;
    
    console.log('=== PROMPT SENT TO LLM ===');
    console.log('Prompt length:', promptSent.length);
    
    // Check if directory_create section has proper inputs
    const dirCreateSection = promptSent.split('### directory_create')[1]?.split('### ')[0];
    console.log('=== DIRECTORY_CREATE SECTION ===');
    console.log(dirCreateSection);
    
    // The critical test - should NOT say "Inputs: None"
    expect(dirCreateSection).toBeDefined();
    expect(dirCreateSection).not.toContain('Inputs**: None');
    expect(dirCreateSection).toContain('dirpath');
  });
});