/**
 * Tool Consistency Debug Test
 * Tests semantic search vs tool loading consistency
 * NO MOCKS - Debug real tool registry issues
 */

import { DecentPlanner } from '@legion/decent-planner';
import { ResourceManager } from '@legion/resource-manager';
import { Tool } from '@legion/tools-registry/src/core/Tool.js';

describe('Tool Consistency Debug', () => {
  let resourceManager;
  let realPlanner;
  
  beforeAll(async () => {
    console.log('\n🚀 Setting up Tool Consistency Debug');
    
    resourceManager = await ResourceManager.getInstance();
    const llmClient = await resourceManager.get('llmClient');
    if (!llmClient) {
      throw new Error('LLM client required for tool consistency test - no fallbacks');
    }
    console.log('✅ LLM client available');
  });
  
  beforeEach(async () => {
    realPlanner = new DecentPlanner({
      maxDepth: 3,
      formalPlanning: { enabled: false }
    });
    await realPlanner.initialize();
    console.log('✅ DecentPlanner initialized');
  });
  
  afterEach(() => {
    if (realPlanner) {
      realPlanner.cancel();
    }
  });
  
  test('should verify semantic search results are all loadable as Tool instances', async () => {
    console.log('\n🔍 Testing semantic search vs tool loading consistency');
    
    const searchQuery = 'javascript';
    console.log(`🔍 Searching for: "${searchQuery}"`);
    
    // Get direct access to tool registry
    const toolRegistry = realPlanner.dependencies.toolRegistry;
    
    console.log('\n📋 Step 1: Direct semantic search');
    const searchResults = await toolRegistry.searchTools(searchQuery, { limit: 20 });
    
    console.log(`📊 Semantic search found ${searchResults.length} results:`);
    searchResults.forEach((result, idx) => {
      console.log(`   ${idx + 1}. ${result.name} (confidence: ${result.confidence})`);
      console.log(`       Description: ${result.description}`);
      console.log(`       Tool object type: ${typeof result.tool}`);
      console.log(`       Tool constructor: ${result.tool?.constructor?.name || 'undefined'}`);
      console.log(`       Is Tool instance: ${result.tool instanceof Tool}`);
    });
    
    console.log('\n🔧 Step 2: Verify each search result is a proper Tool instance');
    
    const properTools = [];
    const brokenTools = [];
    
    for (let i = 0; i < searchResults.length; i++) {
      const result = searchResults[i];
      console.log(`\n   Checking result ${i + 1}: ${result.name}`);
      
      if (result.tool && result.tool instanceof Tool) {
        console.log(`     ✅ PROPER: ${result.name} is a valid Tool instance`);
        properTools.push(result);
        
        // Verify Tool methods and properties
        expect(typeof result.tool.execute).toBe('function');
        expect(result.tool.name).toBeDefined();
        expect(result.tool.description).toBeDefined();
        expect(result.tool.inputSchema).toBeDefined();
        expect(result.tool.outputSchema).toBeDefined();
        
      } else {
        console.log(`     ❌ BROKEN: ${result.name} is NOT a proper Tool instance`);
        console.log(`          Type: ${typeof result.tool}`);
        console.log(`          Constructor: ${result.tool?.constructor?.name}`);
        if (result.tool && typeof result.tool === 'object') {
          console.log(`          Properties: ${Object.keys(result.tool).join(', ')}`);
        }
        brokenTools.push(result);
      }
    }
    
    console.log('\n📊 CONSISTENCY ANALYSIS:');
    console.log(`   Total search results: ${searchResults.length}`);
    console.log(`   Proper Tool instances: ${properTools.length}`);
    console.log(`   Broken/invalid tools: ${brokenTools.length}`);
    console.log(`   Success rate: ${Math.round((properTools.length / searchResults.length) * 100)}%`);
    
    if (brokenTools.length > 0) {
      console.log('\n❌ CRITICAL ISSUE: Semantic search returned tools that are not proper Tool instances!');
      console.log('This violates the consistency rule: "tools from semantic search must be loadable"');
      
      brokenTools.forEach((broken, idx) => {
        console.log(`\n   Broken tool ${idx + 1}: ${broken.name}`);
        console.log(`     Expected: Tool instance with execute method`);
        console.log(`     Actual: ${typeof broken.tool} (${broken.tool?.constructor?.name})`);
      });
      
      // This should never happen - fail the test
      expect(brokenTools.length).toBe(0);
    }
    
    // Verify we found some tools
    expect(searchResults.length).toBeGreaterThan(0);
    expect(properTools.length).toBeGreaterThan(0);
    
    console.log('\n✅ CONSISTENCY VERIFIED: All search results are proper Tool instances!');
    
  }, 60000);
  
  test('should debug individual tool loading failures', async () => {
    console.log('\n🔧 Testing individual tool loading to identify failures');
    
    const toolRegistry = realPlanner.dependencies.toolRegistry;
    
    // Test loading specific tools that we saw failing in the previous test
    const problematicToolNames = [
      'generate_javascript_function',
      'validate_javascript',
      'validate_javascript_syntax',
      'generate_html_page'
    ];
    
    console.log(`\n🎯 Testing ${problematicToolNames.length} problematic tools:`);
    
    for (const toolName of problematicToolNames) {
      console.log(`\n   Testing tool: ${toolName}`);
      
      try {
        // Try to get the tool directly
        const tool = await toolRegistry.getTool(toolName);
        
        if (tool instanceof Tool) {
          console.log(`     ✅ SUCCESS: ${toolName} loaded as proper Tool instance`);
          console.log(`          Name: ${tool.name}`);
          console.log(`          Description: ${tool.description}`);
          console.log(`          Has execute: ${typeof tool.execute === 'function'}`);
        } else {
          console.log(`     ❌ FAILURE: ${toolName} loaded but not a Tool instance`);
          console.log(`          Type: ${typeof tool}`);
          console.log(`          Constructor: ${tool?.constructor?.name}`);
        }
        
      } catch (error) {
        console.log(`     ❌ ERROR: ${toolName} failed to load: ${error.message}`);
        
        // Check if this tool exists in the database but fails to load
        try {
          const searchResults = await toolRegistry.searchTools(toolName, { limit: 1 });
          if (searchResults.length > 0) {
            console.log(`          🔍 Found in search but failed direct loading!`);
            console.log(`          Search result type: ${typeof searchResults[0].tool}`);
          } else {
            console.log(`          🔍 Not found in search either`);
          }
        } catch (searchError) {
          console.log(`          🔍 Search also failed: ${searchError.message}`);
        }
      }
    }
    
    console.log('\n📊 Individual tool loading test completed');
    
  }, 90000);
  
  test('should verify DecentPlanner tool discovery creates proper Tool instances', async () => {
    console.log('\n🎯 Testing DecentPlanner tool discovery consistency');
    
    const goal = 'write javascript code';
    console.log(`📋 Goal: "${goal}"`);
    
    // Do task decomposition first
    const decompResult = await realPlanner.planTaskDecompositionOnly(goal);
    expect(decompResult.success).toBe(true);
    
    console.log('✅ Task decomposition completed');
    
    // Now do tool discovery
    console.log('\n🔍 Starting tool discovery...');
    
    const toolResult = await realPlanner.discoverToolsForCurrentPlan((msg) => {
      console.log(`📢 ${msg}`);
    });
    
    console.log(`Tool discovery result: success=${toolResult.success}`);
    console.log(`Tool discovery error: ${toolResult.error || 'none'}`);
    
    // Get tools regardless of success/failure status
    let discoveredTools = [];
    if (toolResult.success && toolResult.data?.rootTask?.tools) {
      discoveredTools = toolResult.data.rootTask.tools;
    } else if (realPlanner.currentPlan?.rootTask?.tools) {
      discoveredTools = realPlanner.currentPlan.rootTask.tools;
    }
    
    console.log(`\n🔧 Discovered ${discoveredTools.length} tools via DecentPlanner:`);
    
    const properTools = [];
    const brokenTools = [];
    
    discoveredTools.forEach((tool, idx) => {
      console.log(`\n   Tool ${idx + 1}: ${tool?.name || 'UNNAMED'}`);
      
      if (tool instanceof Tool) {
        console.log(`     ✅ PROPER Tool instance`);
        console.log(`          Execute: ${typeof tool.execute === 'function'}`);
        console.log(`          Schema: ${!!tool.inputSchema}`);
        properTools.push(tool);
      } else {
        console.log(`     ❌ BROKEN - not a Tool instance`);
        console.log(`          Type: ${typeof tool}`);
        console.log(`          Constructor: ${tool?.constructor?.name}`);
        if (tool && typeof tool === 'object') {
          console.log(`          Properties: ${Object.keys(tool).slice(0, 5).join(', ')}${Object.keys(tool).length > 5 ? '...' : ''}`);
        }
        brokenTools.push(tool);
      }
    });
    
    console.log(`\n📊 DecentPlanner Tool Discovery Analysis:`);
    console.log(`   Total tools: ${discoveredTools.length}`);
    console.log(`   Proper Tool instances: ${properTools.length}`);
    console.log(`   Broken tools: ${brokenTools.length}`);
    
    if (brokenTools.length > 0) {
      console.log('\n❌ CRITICAL: DecentPlanner returned broken Tool objects!');
      console.log('Root cause analysis needed in tool registry search/loading');
    }
    
    // Verify we have at least some proper tools
    expect(discoveredTools.length).toBeGreaterThan(0);
    expect(properTools.length).toBeGreaterThan(0);
    
    console.log('\n✅ DecentPlanner tool discovery verification completed');
    
  }, 120000);
});