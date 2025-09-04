/**
 * HelloWorldPlanExecution.test.js
 * 
 * Integration test to debug the exact plan execution flow that's failing in the UI
 * Uses the same prompt: "please write a hello world program in node js and run it"
 * Mocks the protocol communication to observe the complete execution flow
 */

import { jest } from '@jest/globals';
import { ToolUsingChatAgent } from '../../src/server/actors/tool-agent/ToolUsingChatAgent.js';
import { ResourceManager } from '@legion/resource-manager';
import { getToolRegistry } from '@legion/tools-registry';

describe('Hello World Plan Execution Debug', () => {
  let toolAgent;
  let toolRegistry;
  let resourceManager;

  beforeAll(async () => {
    // Get real instances - no mocks for integration testing
    resourceManager = await ResourceManager.getInstance();
    toolRegistry = await getToolRegistry();
    
    console.log('🧪 Integration Test Setup:');
    console.log('  ResourceManager:', !!resourceManager);
    console.log('  ToolRegistry:', !!toolRegistry);
    
    // Get LLM client from resource manager
    const llmClient = await resourceManager.get('llmClient');
    console.log('  LLMClient:', !!llmClient);
    
    // Initialize tool agent with proper constructor parameters
    toolAgent = new ToolUsingChatAgent(toolRegistry, llmClient);
    
    console.log('  ToolAgent initialized:', !!toolAgent);
    
    // Load tools search results for the test query
    const searchResults = await toolAgent.searchForTools("please write a hello world program in node js and run it");
    console.log('  Tool search results loaded:', searchResults?.length || 0);
    console.log('  Search results structure:', searchResults?.[0] ? Object.keys(searchResults[0]) : 'no results');
    console.log('  Current search results stored:', toolAgent.currentSearchResults?.length || 0);
  }, 30000);

  test('should execute complete hello world plan with file creation and execution', async () => {
    console.log('\n🚀 Starting Hello World Plan Execution Test');
    console.log('================================================');
    
    const userPrompt = "please write a hello world program in node js and run it";
    
    console.log('📝 User Request:', userPrompt);
    
    // Step 1: Check if tools are needed
    console.log('\n🧠 Step 1: Analyzing tool need...');
    const toolNeedResult = await toolAgent.analyzeToolNeed(userPrompt);
    console.log('  Tool need result:', toolNeedResult);
    expect(toolNeedResult.needsTools).toBe(true);
    
    // Step 2: Create tool plan  
    console.log('\n📋 Step 2: Creating tool plan...');
    const toolPlan = await toolAgent.selectToolSequence(toolAgent.currentSearchResults, userPrompt);
    console.log('  Tool plan:', JSON.stringify(toolPlan, null, 2));
    expect(toolPlan.type).toBe('sequence');
    expect(toolPlan.steps).toHaveLength(2);
    
    // Step 3: Execute the plan step by step
    console.log('\n⚙️ Step 3: Executing tool plan...');
    
    // Clear context to start fresh
    toolAgent.executionContext = { artifacts: {} };
    toolAgent.operationHistory = [];
    
    console.log('  Initial context:', toolAgent.executionContext);
    
    // Execute first step: generate_javascript_module
    console.log('\n🔧 Executing Step 1: generate_javascript_module');
    const step1 = toolPlan.steps[0];
    console.log('  Step 1 inputs:', step1.inputs);
    console.log('  Step 1 expected outputs:', step1.outputs);
    
    // Add projectPath to avoid file writing failure
    const step1Inputs = {
      ...step1.inputs,
      projectPath: '/Users/williampearson/Documents/p/agents/Legion/packages/apps/decent-planner-ui/__tests__/tmp'
    };
    
    const step1Result = await toolAgent.executeTool({
      selectedTool: step1.tool,
      parameters: step1Inputs,
      outputs: step1.outputs
    });
    
    console.log('  Step 1 result success:', step1Result?.success);
    console.log('  Step 1 result data:', step1Result?.data);
    console.log('  Context after step 1:', Object.keys(toolAgent.executionContext.artifacts));
    console.log('  hello_path variable:', toolAgent.executionContext.artifacts.hello_path);
    
    expect(step1Result.success).toBe(true);
    expect(toolAgent.executionContext.artifacts.hello_path).toBeDefined();
    
    // Execute second step: run_node
    console.log('\n🚀 Executing Step 2: run_node');
    const step2 = toolPlan.steps[1];
    console.log('  Step 2 inputs (before resolution):', step2.inputs);
    
    // Resolve parameters (this is where the bug occurs)
    const resolvedStep2Inputs = toolAgent.resolveParams(step2.inputs);
    console.log('  Step 2 inputs (after resolution):', resolvedStep2Inputs);
    console.log('  script parameter resolved to:', resolvedStep2Inputs.script);
    
    expect(resolvedStep2Inputs.script).toBeDefined();
    expect(resolvedStep2Inputs.script).not.toBe(undefined);
    
    const step2Result = await toolAgent.executeTool({
      selectedTool: step2.tool,
      parameters: step2.inputs,
      outputs: step2.outputs
    });
    
    console.log('  Step 2 result:', step2Result);
    console.log('  Final context:', toolAgent.executionContext.artifacts);
    console.log('  Operation history:', toolAgent.operationHistory.length, 'operations');
    
    expect(step2Result.success).toBe(true);
    
    console.log('\n✅ Test Complete - Both steps should have executed successfully');
    
  }, 60000);

  test('should debug variable storage and resolution specifically', async () => {
    console.log('\n🔍 Variable Resolution Debug Test');
    console.log('====================================');
    
    // Clear context
    toolAgent.executionContext = { artifacts: {} };
    
    // Simulate the exact first step execution
    const step1Inputs = {
      name: "hello",
      description: "Simple hello world program",
      writeToFile: true,
      outputPath: "hello.js",
      includeMain: true,
      mainFunction: "console.log('Hello, World!');"
      // Note: Missing projectPath - this causes written: false
    };
    
    console.log('📝 Executing generate_javascript_module with inputs:', step1Inputs);
    
    // Get the actual tool
    const searchResult = toolAgent.currentSearchResults.find(r => r.name === 'generate_javascript_module');
    expect(searchResult).toBeDefined();
    
    const tool = searchResult.tool;
    const result = await tool.execute(step1Inputs);
    
    console.log('🔧 Tool execution result:');
    console.log('  Success:', result.success);
    console.log('  Data keys:', Object.keys(result.data || {}));
    console.log('  Written:', result.data?.written);
    console.log('  FilePath:', result.data?.filePath);
    console.log('  Filename:', result.data?.filename);
    
    // Manual variable storage with different field mappings
    console.log('\n📦 Testing variable storage with different field mappings:');
    
    // Test 1: Store filePath (what the plan expects)
    if (result.data?.filePath) {
      toolAgent.executionContext.artifacts['hello_path'] = result.data.filePath;
      console.log('  ✅ Stored filePath:', result.data.filePath);
    } else {
      console.log('  ❌ No filePath field available');
    }
    
    // Test 2: Store filename as alternative
    if (result.data?.filename) {
      toolAgent.executionContext.artifacts['hello_filename'] = result.data.filename;
      console.log('  ✅ Stored filename:', result.data.filename);
    }
    
    // Test 3: Store entire result object
    toolAgent.executionContext.artifacts['hello_full_result'] = result.data;
    console.log('  ✅ Stored full result object');
    
    console.log('\n🧪 Testing variable resolution:');
    const testParams = {
      script: "@hello_path",
      scriptFromFilename: "@hello_filename", 
      scriptFromFullResult: "@hello_full_result"
    };
    
    const resolved = toolAgent.resolveParams(testParams);
    console.log('  Resolved @hello_path:', resolved.script);
    console.log('  Resolved @hello_filename:', resolved.scriptFromFilename);
    console.log('  Resolved @hello_full_result type:', typeof resolved.scriptFromFullResult);
    
    // The issue is that hello_path resolves to undefined because filePath isn't set when written:false
  });

  afterAll(async () => {
    console.log('\n🧹 Cleaning up test resources...');
    
    // Clean up any test files created
    const testDir = '/Users/williampearson/Documents/p/agents/Legion/packages/apps/decent-planner-ui/__tests__/tmp';
    try {
      const { promises: fs } = await import('fs');
      await fs.rm(testDir, { recursive: true, force: true });
      console.log('  Test directory cleaned');
    } catch (error) {
      console.log('  Test cleanup warning:', error.message);
    }
  });
});

/**
 * Helper function to extract JSON from LLM responses
 */
function extractJSON(response) {
  try {
    if (typeof response === 'object') {
      return response;
    }
    if (typeof response === 'string') {
      return JSON.parse(response);
    }
    throw new Error('Invalid response format');
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error.message}`);
  }
}