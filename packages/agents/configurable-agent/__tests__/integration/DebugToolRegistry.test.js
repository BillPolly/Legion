/**
 * Debug test to inspect what's available in ToolRegistry
 */

import { ResourceManager } from '@legion/resource-manager';
import { getToolRegistry } from '@legion/tools-registry';

describe('Debug ToolRegistry Contents', () => {
  test('should list all available tools and modules', async () => {
    const resourceManager = await ResourceManager.getInstance();
    const toolRegistry = await getToolRegistry();
    
    console.log('\n=== ToolRegistry Debug Info ===\n');
    
    // List all tools
    const tools = await toolRegistry.listTools();
    console.log(`Total tools available: ${tools.length}`);
    console.log('\nTools by name:');
    tools.forEach(tool => {
      console.log(`  - ${tool.name} (module: ${tool.moduleName || tool.module || 'unknown'})`);
    });
    
    // Try to get calculator tool specifically
    console.log('\n=== Looking for calculator tools ===\n');
    
    const calculatorVariants = ['calculator', 'Calculator', 'calc'];
    for (const name of calculatorVariants) {
      try {
        const tool = await toolRegistry.getTool(name);
        if (tool) {
          console.log(`Found tool "${name}":`, tool.name);
        } else {
          console.log(`Tool "${name}" not found`);
        }
      } catch (error) {
        console.log(`Error getting tool "${name}":`, error.message);
      }
    }
    
    // Check if there are any calculator-related tools
    const calcTools = tools.filter(tool => 
      tool.name.toLowerCase().includes('calc') || 
      tool.name.toLowerCase().includes('add') || 
      tool.name.toLowerCase().includes('subtract') ||
      tool.name.toLowerCase().includes('multiply') ||
      tool.name.toLowerCase().includes('divide')
    );
    
    console.log('\n=== Calculator-related tools ===\n');
    if (calcTools.length > 0) {
      calcTools.forEach(tool => {
        console.log(`  - ${tool.name} (module: ${tool.moduleName || tool.module})`);
      });
    } else {
      console.log('No calculator-related tools found');
    }
    
    // Test if we can execute a tool
    if (tools.length > 0) {
      const firstTool = tools[0];
      console.log(`\n=== Testing tool execution for "${firstTool.name}" ===\n`);
      console.log(`Has execute function: ${typeof firstTool.execute === 'function'}`);
    }
    
    expect(tools.length).toBeGreaterThan(0);
  });
});