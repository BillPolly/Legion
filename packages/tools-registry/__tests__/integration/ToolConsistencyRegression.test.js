/**
 * Tool Consistency Regression Test
 * Verifies that ALL tools returned by semantic search are proper Tool class instances
 * Tests each module's tool creation for consistency
 * NO MOCKS - Real tool registry operations
 */

import { ResourceManager } from '@legion/resource-manager';
import { getToolRegistry } from '../../src/index.js';
import { Tool } from '../../src/core/Tool.js';

describe('Tool Consistency Regression', () => {
  let resourceManager;
  let toolRegistry;
  
  beforeAll(async () => {
    console.log('\n🚀 Setting up Tool Consistency Regression tests');
    resourceManager = await ResourceManager.getInstance();
    toolRegistry = await getToolRegistry();
    console.log('✅ ToolRegistry initialized for consistency testing');
  });

  test('should verify ALL semantic search results are Tool instances', async () => {
    console.log('\n🎯 Testing semantic search tool consistency');
    
    const testQueries = [
      'javascript generation',
      'file operations', 
      'web tools',
      'testing framework',
      'code analysis'
    ];
    
    const allResults = [];
    const consistencyReport = {
      totalTools: 0,
      properTools: 0,
      brokenTools: 0,
      brokenToolDetails: []
    };
    
    for (const query of testQueries) {
      console.log(`\n🔍 Testing query: "${query}"`);
      
      try {
        const results = await toolRegistry.searchTools(query, { limit: 10 });
        console.log(`   📊 Found ${results.length} results`);
        
        allResults.push(...results);
        consistencyReport.totalTools += results.length;
        
        for (const result of results) {
          if (result.tool && result.tool instanceof Tool) {
            consistencyReport.properTools++;
            console.log(`   ✅ ${result.name} - Proper Tool instance`);
          } else {
            consistencyReport.brokenTools++;
            console.log(`   ❌ ${result.name} - BROKEN (${typeof result.tool})`);
            
            consistencyReport.brokenToolDetails.push({
              query,
              name: result.name,
              toolType: typeof result.tool,
              constructor: result.tool?.constructor?.name,
              hasExecute: typeof result.tool?.execute === 'function',
              properties: result.tool ? Object.keys(result.tool).slice(0, 5) : []
            });
          }
        }
        
      } catch (error) {
        console.log(`   ❌ Query "${query}" failed: ${error.message}`);
      }
    }
    
    console.log('\n📊 COMPREHENSIVE CONSISTENCY REPORT:');
    console.log(`   Total tools tested: ${consistencyReport.totalTools}`);
    console.log(`   Proper Tool instances: ${consistencyReport.properTools}`);
    console.log(`   Broken tools: ${consistencyReport.brokenTools}`);
    console.log(`   Success rate: ${Math.round((consistencyReport.properTools / consistencyReport.totalTools) * 100)}%`);
    
    if (consistencyReport.brokenTools > 0) {
      console.log('\n❌ BROKEN TOOLS ANALYSIS:');
      consistencyReport.brokenToolDetails.forEach((broken, idx) => {
        console.log(`\n   Broken tool ${idx + 1}: ${broken.name}`);
        console.log(`     Query: "${broken.query}"`);
        console.log(`     Type: ${broken.toolType}`);
        console.log(`     Constructor: ${broken.constructor}`);
        console.log(`     Has execute: ${broken.hasExecute}`);
        console.log(`     Properties: [${broken.properties.join(', ')}]`);
      });
      
      console.log(`\n🚨 CRITICAL: ${consistencyReport.brokenTools} tools violate consistency rule!`);
      console.log('Semantic search must NEVER return non-Tool instances');
    }
    
    // The consistency rule: ALL search results must be Tool instances
    expect(consistencyReport.brokenTools).toBe(0);
    expect(consistencyReport.properTools).toBeGreaterThan(0);
    
    console.log('\n✅ Tool consistency verification PASSED!');
  }, 120000);

  test('should test individual module tool creation', async () => {
    console.log('\n🔧 Testing individual module tool creation');
    
    const moduleNames = ['ClaudeToolsModule', 'JSGeneratorModule', 'CodeAgentModule'];
    
    for (const moduleName of moduleNames) {
      console.log(`\n--- Testing ${moduleName} tool creation ---`);
      
      try {
        let modulePath;
        switch (moduleName) {
          case 'ClaudeToolsModule':
            modulePath = '/Users/williampearson/Documents/p/agents/Legion/packages/modules/claude-tools/src/ClaudeToolsModule.js';
            break;
          case 'JSGeneratorModule':
            modulePath = '/Users/williampearson/Documents/p/agents/Legion/packages/modules/js-generator/src/JSGeneratorModule.js';
            break;
          case 'CodeAgentModule':
            modulePath = '/Users/williampearson/Documents/p/agents/Legion/packages/modules/code-agent/src/CodeAgentModule.js';
            break;
        }
        
        const moduleImport = await import(modulePath);
        const ModuleClass = moduleImport.default || moduleImport[moduleName];
        const moduleInstance = await ModuleClass.create(resourceManager);
        
        console.log(`✅ ${moduleName} instance created`);
        
        const tools = moduleInstance.getTools();
        console.log(`📊 ${moduleName} provides ${tools.length} tools:`);
        
        let properCount = 0;
        let brokenCount = 0;
        
        tools.forEach((tool, idx) => {
          const isProper = tool instanceof Tool;
          if (isProper) {
            properCount++;
            console.log(`   ${idx + 1}. ✅ ${tool.name} - Proper Tool instance`);
          } else {
            brokenCount++;
            console.log(`   ${idx + 1}. ❌ ${tool?.name || 'UNNAMED'} - BROKEN (${typeof tool})`);
            console.log(`        Constructor: ${tool?.constructor?.name}`);
            console.log(`        Has execute: ${typeof tool?.execute === 'function'}`);
          }
        });
        
        console.log(`📈 ${moduleName} consistency: ${properCount}/${tools.length} (${Math.round((properCount / tools.length) * 100)}%)`);
        
        if (brokenCount > 0) {
          console.log(`🚨 ${moduleName} has ${brokenCount} broken tools!`);
        }
        
      } catch (error) {
        console.log(`❌ ${moduleName} tool creation test failed: ${error.message}`);
      }
    }
  }, 90000);
});