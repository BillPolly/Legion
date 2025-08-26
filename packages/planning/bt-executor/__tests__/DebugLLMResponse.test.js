/**
 * Debug test to see EXACTLY what the LLM responds with
 */

import { Planner } from '@legion/planner';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry/src/integration/ToolRegistry.js';
import { BTValidator } from '@legion/bt-validator';

describe('Debug LLM Response', () => {
  let toolRegistry;
  let planner;
  let validator;

  beforeAll(async () => {
    const resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    toolRegistry = await ToolRegistry.getInstance();
    await toolRegistry.loadAllModules();
    
    // Create a debugging LLM client wrapper
    const realLLMClient = await resourceManager.get('llmClient');
    const debugLLMClient = {
      async complete(prompt, maxTokens = 4000) {
        console.log('\n=== PROMPT SENT TO LLM ===');
        console.log('Length:', prompt.length);
        
        // Show the tools section
        const toolsMatch = prompt.match(/## Available Tools[\s\S]*?## Tool Selection/);
        if (toolsMatch) {
          console.log('\n=== TOOLS SECTION ===');
          console.log(toolsMatch[0]);
        }
        
        // Call real LLM
        const response = await realLLMClient.complete(prompt, maxTokens);
        
        console.log('\n=== RAW LLM RESPONSE ===');
        console.log(response);
        console.log('=== END RESPONSE ===\n');
        
        // Try to parse as JSON
        try {
          const parsed = JSON.parse(response);
          console.log('\n=== PARSED RESPONSE ===');
          console.log(JSON.stringify(parsed, null, 2));
        } catch (e) {
          console.log('Failed to parse as JSON:', e.message);
        }
        
        return response;
      }
    };
    
    planner = new Planner({ llmClient: debugLLMClient });
    validator = new BTValidator();
  });

  afterAll(async () => {
    if (toolRegistry && toolRegistry.cleanup) {
      await toolRegistry.cleanup();
    }
  });

  test('debug hello world generation', async () => {
    console.log('=== DEBUGGING HELLO WORLD PLAN GENERATION ===');
    
    const tools = await toolRegistry.listTools();
    const fileWriteTool = tools.find(t => t.name === 'file_write');
    const runNodeTool = tools.find(t => t.name === 'run_node');
    
    console.log('\n=== TOOL SCHEMAS ===');
    console.log('file_write inputs:', fileWriteTool?.inputSchema?.properties);
    console.log('run_node inputs:', runNodeTool?.inputSchema?.properties ? Object.keys(runNodeTool.inputSchema.properties) : 'none');
    
    const availableTools = [fileWriteTool, runNodeTool].filter(Boolean);
    
    const goal = 'please write a simple hello world program in javascript';
    
    console.log('\n=== CALLING PLANNER ===');
    const planResult = await planner.makePlan(goal, availableTools);
    
    console.log('\n=== PLAN RESULT ===');
    console.log('Success:', planResult.success);
    console.log('Error:', planResult.error);
    
    if (planResult.data) {
      console.log('Attempts:', planResult.data.attempts);
      
      if (planResult.data.validation) {
        console.log('\n=== VALIDATION RESULT ===');
        console.log('Valid:', planResult.data.validation.valid);
        console.log('Errors:', planResult.data.validation.errors);
        console.log('Warnings:', planResult.data.validation.warnings);
      }
      
      if (planResult.data.lastPlan) {
        console.log('\n=== LAST PLAN ===');
        console.log(JSON.stringify(planResult.data.lastPlan, null, 2));
      }
    }
    
    if (planResult.success && planResult.data?.plan) {
      // Validate manually
      console.log('\n=== MANUAL VALIDATION ===');
      const validationResult = await validator.validate(planResult.data.plan, tools);
      console.log('Valid:', validationResult.valid);
      console.log('Errors:', validationResult.errors);
      console.log('Warnings:', validationResult.warnings);
    }
  }, 120000);
});