/**
 * Debug test to trace exactly why tool execution is failing in ChatAgent
 */

import { ToolUsingChatAgent } from '../../src/server/actors/tool-agent/ToolUsingChatAgent.js';
import { getToolRegistry } from '@legion/tools-registry';
import { ResourceManager } from '@legion/resource-manager';

describe('ChatAgent Tool Execution Debug', () => {
  let toolRegistry, llmClient, chatAgent;

  beforeAll(async () => {
    console.log('🔧 [DEBUG] Setting up test dependencies...');
    
    // Get real dependencies
    toolRegistry = await getToolRegistry();
    console.log('✅ [DEBUG] ToolRegistry obtained');
    
    const resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    console.log('✅ [DEBUG] LLMClient obtained');
    
    // Create chat agent with detailed logging
    chatAgent = new ToolUsingChatAgent(
      toolRegistry, 
      llmClient,
      (eventType, data) => {
        console.log(`🔔 [DEBUG] Event: ${eventType}`, data);
      }
    );
    console.log('✅ [DEBUG] ChatAgent created');
  }, 30000);

  test('Debug tool search and selection for hello world request', async () => {
    console.log('\n🚀 [DEBUG] Starting hello world debug test...\n');
    
    const userRequest = "please write a hello world program in node.js and run it";
    
    // Step 1: Test tool search
    console.log('📍 [DEBUG] STEP 1: Tool Search');
    const searchResults = await chatAgent.searchForTools(userRequest);
    console.log(`✅ [DEBUG] Found ${searchResults.length} tools from search`);
    searchResults.forEach((tool, i) => {
      console.log(`  ${i+1}. ${tool.name} - ${tool.description} (confidence: ${tool.confidence || 'unknown'})`);
    });
    
    expect(searchResults.length).toBeGreaterThan(0);
    
    // Step 2: Test tool selection/planning
    console.log('\n📍 [DEBUG] STEP 2: Tool Selection/Planning');
    const toolPlan = await chatAgent.selectToolSequence(searchResults, userRequest);
    console.log('✅ [DEBUG] Tool plan created:', JSON.stringify(toolPlan, null, 2));
    
    expect(toolPlan).toBeDefined();
    expect(toolPlan.type).toBeDefined();
    
    // Step 3: Test individual tool execution if plan exists
    if (toolPlan.type === 'single' || toolPlan.type === 'sequence') {
      console.log('\n📍 [DEBUG] STEP 3: Tool Execution');
      
      // Get the first tool to execute
      const toolToTest = toolPlan.type === 'single' ? toolPlan.tool : toolPlan.steps[0].tool;
      console.log(`🔧 [DEBUG] Testing tool: ${toolToTest}`);
      
      // Check if tool exists in registry
      console.log('📍 [DEBUG] STEP 3a: Tool Registry Lookup');
      try {
        const toolObject = await toolRegistry.getTool(toolToTest);
        console.log(`✅ [DEBUG] Tool object found:`, {
          name: toolObject?.name,
          hasExecute: typeof toolObject?.execute === 'function',
          type: typeof toolObject,
          keys: Object.keys(toolObject || {})
        });
        
        if (toolObject && typeof toolObject.execute === 'function') {
          console.log('\n📍 [DEBUG] STEP 3b: Direct Tool Execution Test');
          const testParams = toolPlan.type === 'single' ? toolPlan.inputs : toolPlan.steps[0].inputs;
          console.log('🔧 [DEBUG] Test parameters:', JSON.stringify(testParams, null, 2));
          
          try {
            const directResult = await toolObject.execute(testParams);
            console.log('✅ [DEBUG] Direct tool execution result:', JSON.stringify(directResult, null, 2));
          } catch (directError) {
            console.error('❌ [DEBUG] Direct tool execution failed:', directError);
            console.error('❌ [DEBUG] Error details:', {
              name: directError.name,
              message: directError.message,
              stack: directError.stack
            });
          }
        } else {
          console.error('❌ [DEBUG] Tool object has no execute method or is invalid');
        }
      } catch (registryError) {
        console.error('❌ [DEBUG] Tool registry lookup failed:', registryError);
      }
      
      // Step 4: Test via chat agent's execution pipeline
      console.log('\n📍 [DEBUG] STEP 4: ChatAgent Execution Pipeline');
      try {
        const executionResults = await chatAgent.executeToolPlan(toolPlan);
        console.log('✅ [DEBUG] ChatAgent execution results:', JSON.stringify(executionResults, null, 2));
        
        if (!executionResults.success) {
          console.error('❌ [DEBUG] ChatAgent execution failed');
          console.error('❌ [DEBUG] Errors:', executionResults.errors);
          executionResults.results.forEach((result, i) => {
            if (!result.success) {
              console.error(`❌ [DEBUG] Tool ${i+1} result:`, {
                success: result.success,
                error: result.error,
                tool: result.tool,
                data: result.data
              });
            }
          });
        }
      } catch (pipelineError) {
        console.error('❌ [DEBUG] ChatAgent pipeline error:', pipelineError);
      }
    } else {
      console.log(`⚠️ [DEBUG] Tool plan type '${toolPlan.type}' - skipping execution test`);
    }
    
  }, 60000);

  test('Debug tool registry state and available tools', async () => {
    console.log('\n🔍 [DEBUG] Testing tool registry state...\n');
    
    // Check tool registry methods
    console.log('📍 [DEBUG] Tool Registry Methods Available:');
    console.log('  listTools:', typeof toolRegistry.listTools);
    console.log('  getTool:', typeof toolRegistry.getTool);
    console.log('  searchTools:', typeof toolRegistry.searchTools);
    
    // List all available tools
    const allTools = await toolRegistry.listTools();
    console.log(`✅ [DEBUG] Total tools available: ${allTools.length}`);
    
    // Check for JavaScript generation tools specifically
    const jsTools = allTools.filter(tool => 
      tool.name.includes('javascript') || 
      tool.name.includes('generate') ||
      tool.name.includes('js')
    );
    
    console.log(`🔧 [DEBUG] JavaScript-related tools found: ${jsTools.length}`);
    jsTools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
      console.log(`    Module: ${tool.moduleName}, Category: ${tool.category}`);
    });
    
    // Test getting a specific tool
    try {
      const testTool = await toolRegistry.getTool('generate_javascript_module');
      console.log('✅ [DEBUG] generate_javascript_module tool details:', {
        exists: !!testTool,
        name: testTool?.name,
        hasExecute: typeof testTool?.execute === 'function',
        inputSchema: testTool?.inputSchema,
        outputSchema: testTool?.outputSchema
      });
    } catch (error) {
      console.error('❌ [DEBUG] Failed to get generate_javascript_module:', error);
    }
    
    expect(allTools.length).toBeGreaterThan(0);
  });
});