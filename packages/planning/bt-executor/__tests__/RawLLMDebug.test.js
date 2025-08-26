/**
 * Debug test to see RAW LLM prompt and response
 */

import { Planner } from '@legion/planner';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry/src/integration/ToolRegistry.js';

describe('Raw LLM Debug', () => {
  test('log exact prompt and response', async () => {
    const resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    const toolRegistry = await ToolRegistry.getInstance();
    await toolRegistry.loadAllModules();
    
    // Wrap the LLM client to log everything
    const realLLMClient = await resourceManager.get('llmClient');
    let promptSent = '';
    let responseReceived = '';
    
    const loggingLLMClient = {
      async complete(prompt, maxTokens = 4000) {
        promptSent = prompt;
        console.log('\n========== RAW PROMPT SENT TO LLM ==========\n');
        console.log(prompt);
        console.log('\n========== END PROMPT ==========\n');
        
        const response = await realLLMClient.complete(prompt, maxTokens);
        responseReceived = response;
        
        console.log('\n========== RAW LLM RESPONSE ==========\n');
        console.log(response);
        console.log('\n========== END RESPONSE ==========\n');
        
        // Try to extract JSON to see what the LLM generated
        try {
          // Look for JSON in the response
          const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                           response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const jsonStr = jsonMatch[1] || jsonMatch[0];
            const parsed = JSON.parse(jsonStr);
            console.log('\n========== PARSED JSON ==========\n');
            console.log(JSON.stringify(parsed, null, 2));
            
            // Check for run_node actions
            const checkNode = (node) => {
              if (node.type === 'action' && node.tool === 'run_node') {
                console.log('\n=== run_node action found ===');
                console.log('ID:', node.id);
                console.log('Inputs:', JSON.stringify(node.inputs, null, 2));
                console.log('Has projectPath?', node.inputs?.projectPath !== undefined);
                console.log('Has command?', node.inputs?.command !== undefined);
              }
              if (node.children) {
                node.children.forEach(checkNode);
              }
              if (node.child) {
                checkNode(node.child);
              }
            };
            checkNode(parsed);
          }
        } catch (e) {
          console.log('Could not parse JSON:', e.message);
        }
        
        return response;
      }
    };
    
    const planner = new Planner({ llmClient: loggingLLMClient });
    
    // Get tools
    const tools = await toolRegistry.listTools();
    const fileWriteTool = tools.find(t => t.name === 'file_write');
    const runNodeTool = tools.find(t => t.name === 'run_node');
    
    console.log('\n=== TOOLS BEING USED ===');
    console.log('file_write schema:', fileWriteTool?.inputSchema?.properties ? Object.keys(fileWriteTool.inputSchema.properties) : 'none');
    console.log('run_node schema:', runNodeTool?.inputSchema?.properties ? Object.keys(runNodeTool.inputSchema.properties) : 'none');
    
    const availableTools = [fileWriteTool, runNodeTool].filter(Boolean);
    
    const goal = 'please write a simple hello world program in javascript';
    
    console.log('\n=== CALLING PLANNER ===');
    const planResult = await planner.makePlan(goal, availableTools, { maxAttempts: 1 });
    
    console.log('\n=== PLAN RESULT ===');
    console.log('Success:', planResult.success);
    console.log('Error:', planResult.error);
    
    if (planResult.data?.validation) {
      console.log('\n=== VALIDATION ERRORS ===');
      planResult.data.validation.errors.forEach(err => {
        console.log(`- ${err.type}: ${err.message}`);
        if (err.nodeId) console.log(`  Node: ${err.nodeId}`);
        if (err.details) console.log(`  Details:`, err.details);
      });
    }
    
    // Save for analysis
    console.log('\n=== PROMPT LENGTH:', promptSent.length);
    console.log('=== RESPONSE LENGTH:', responseReceived.length);
  }, 60000);
});