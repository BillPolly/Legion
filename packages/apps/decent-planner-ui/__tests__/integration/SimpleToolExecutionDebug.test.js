/**
 * Simplified debug test to isolate tool execution failure
 */

import { getToolRegistry } from '@legion/tools-registry';
import { ResourceManager } from '@legion/resource-manager';

describe('Simple Tool Execution Debug', () => {
  let toolRegistry;

  beforeAll(async () => {
    console.log('🔧 Getting tool registry...');
    toolRegistry = await getToolRegistry();
    console.log('✅ Tool registry obtained');
  }, 30000);

  test('Test direct tool execution: generate_javascript_module', async () => {
    console.log('\n🚀 Testing generate_javascript_module directly...\n');
    
    try {
      // Get the tool
      console.log('📍 Step 1: Getting tool from registry');
      const tool = await toolRegistry.getTool('generate_javascript_module');
      console.log('Tool found:', {
        exists: !!tool,
        name: tool?.name,
        hasExecute: typeof tool?.execute === 'function',
        keys: Object.keys(tool || {})
      });
      
      if (!tool) {
        throw new Error('Tool not found in registry');
      }
      
      if (typeof tool.execute !== 'function') {
        throw new Error('Tool has no execute method');
      }
      
      // Test simple execution
      console.log('\n📍 Step 2: Executing tool with simple parameters');
      const params = {
        name: 'hello',
        description: 'Simple Hello World program',
        mainFunction: 'console.log("Hello, World!");',
        includeMain: true
      };
      console.log('Parameters:', JSON.stringify(params, null, 2));
      
      const result = await tool.execute(params);
      console.log('\n✅ Execution result:');
      console.log('Success:', result.success);
      console.log('Data:', JSON.stringify(result.data, null, 2));
      console.log('Error:', result.error);
      
      if (!result.success) {
        console.error('❌ Tool execution failed!');
        console.error('Error details:', result.error);
      }
      
      expect(result).toBeDefined();
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      console.error('Error stack:', error.stack);
      throw error;
    }
  }, 30000);

  test('List all available generation tools', async () => {
    console.log('\n🔍 Listing all generation tools...\n');
    
    const allTools = await toolRegistry.listTools();
    console.log(`Total tools: ${allTools.length}`);
    
    const genTools = allTools.filter(tool => 
      tool.name.includes('generate') && 
      (tool.name.includes('javascript') || tool.name.includes('js'))
    );
    
    console.log(`\n🔧 JavaScript generation tools found: ${genTools.length}`);
    genTools.forEach((tool, i) => {
      console.log(`${i+1}. ${tool.name}`);
      console.log(`   Description: ${tool.description}`);
      console.log(`   Module: ${tool.moduleName}`);
      console.log(`   Category: ${tool.category}`);
    });
    
    expect(genTools.length).toBeGreaterThan(0);
  });
});