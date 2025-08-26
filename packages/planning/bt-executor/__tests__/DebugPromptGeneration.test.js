/**
 * Debug test to see EXACTLY what prompt is sent to the LLM
 * This will show us what input parameter names the LLM is seeing
 */

import { Planner } from '@legion/planner';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry/src/integration/ToolRegistry.js';

describe('Debug Prompt Generation', () => {
  let toolRegistry;
  let planner;

  beforeAll(async () => {
    // Initialize components
    const resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    toolRegistry = await ToolRegistry.getInstance();
    await toolRegistry.loadAllModules();
    
    // Create a mock LLM client that just logs the prompt
    const mockLLMClient = {
      async complete(prompt, maxTokens = 4000) {
        console.log('\n\n=== EXACT PROMPT SENT TO LLM ===\n');
        console.log(prompt);
        console.log('\n=== END PROMPT ===\n\n');
        
        // Extract the tools section to see what the LLM sees
        const toolsMatch = prompt.match(/## Available Tools[\s\S]*?## Requirements/);
        if (toolsMatch) {
          console.log('\n=== TOOLS SECTION ONLY ===\n');
          console.log(toolsMatch[0]);
          console.log('\n=== END TOOLS SECTION ===\n');
        }
        
        // Return a dummy response
        return JSON.stringify({
          "type": "sequence",
          "id": "test",
          "description": "test",
          "children": []
        });
      }
    };
    
    planner = new Planner({ llmClient: mockLLMClient });
  });

  afterAll(async () => {
    if (toolRegistry && toolRegistry.cleanup) {
      await toolRegistry.cleanup();
    }
  });

  test('should show exact prompt with tool input parameters', async () => {
    console.log('=== STARTING PROMPT DEBUG TEST ===');
    
    // Get the exact same tools that failed
    const tools = await toolRegistry.listTools();
    const dirCreateTool = tools.find(t => t.name === 'directory_create');
    const fileWriteTool = tools.find(t => t.name === 'file_write');
    const runNodeTool = tools.find(t => t.name === 'run_node');
    const searchLogsTool = tools.find(t => t.name === 'search_logs');
    
    console.log('\n=== TOOL SCHEMAS ===');
    console.log('\ndirectory_create inputSchema:', JSON.stringify(dirCreateTool?.inputSchema, null, 2));
    console.log('\nfile_write inputSchema:', JSON.stringify(fileWriteTool?.inputSchema, null, 2));
    console.log('\nrun_node inputSchema:', JSON.stringify(runNodeTool?.inputSchema, null, 2));
    console.log('\nsearch_logs inputSchema:', JSON.stringify(searchLogsTool?.inputSchema, null, 2));
    
    const testTools = [dirCreateTool, fileWriteTool, runNodeTool, searchLogsTool].filter(Boolean);
    
    const goal = 'Create a directory called hello-world, write a file hello.js with console.log("Hello, World!"), run it with node, and search the logs for the output';
    
    // This will trigger our mock LLM client which will log the exact prompt
    await planner.makePlan(goal, testTools);
    
    console.log('=== TEST COMPLETE - CHECK THE PROMPT ABOVE ===');
  });
});