/**
 * Test to debug what tool schemas are returned from the registry
 */

import { ToolRegistry } from '@legion/tools-registry/src/integration/ToolRegistry.js';

describe('Tool Schema Debug', () => {
  let toolRegistry;
  
  beforeAll(async () => {
    toolRegistry = await ToolRegistry.getInstance();
  });
  
  test('directory_create tool should have proper inputSchema', async () => {
    // Get the tool from registry
    const tool = await toolRegistry.getTool('directory_create');
    
    console.log('=== TOOL REGISTRY DEBUG ===');
    console.log('Tool found:', !!tool);
    console.log('Tool name:', tool?.name);
    console.log('Tool inputSchema:', JSON.stringify(tool?.inputSchema, null, 2));
    console.log('Tool schema:', JSON.stringify(tool?.schema, null, 2));
    console.log('Tool inputs:', JSON.stringify(tool?.inputs, null, 2));
    console.log('Full tool object:', JSON.stringify(tool, null, 2));
    
    // Assertions
    expect(tool).toBeTruthy();
    expect(tool.name).toBe('directory_create');
    expect(tool.inputSchema).toBeDefined();
    expect(tool.inputSchema.properties).toBeDefined();
    expect(tool.inputSchema.properties.dirpath).toBeDefined();
  });
  
  test('get all tools and check their schemas', async () => {
    const allTools = await toolRegistry.getAllTools();
    
    console.log('=== ALL TOOLS SCHEMA DEBUG ===');
    allTools.forEach(tool => {
      console.log(`\nTool: ${tool.name}`);
      console.log(`  inputSchema: ${tool.inputSchema ? 'DEFINED' : 'UNDEFINED'}`);
      if (tool.inputSchema?.properties) {
        console.log(`  properties: ${Object.keys(tool.inputSchema.properties).join(', ')}`);
      }
      if (tool.inputs) {
        console.log(`  inputs array: ${tool.inputs.map(i => i.name).join(', ')}`);
      }
    });
    
    // Find directory_create specifically
    const dirCreateTool = allTools.find(t => t.name === 'directory_create');
    expect(dirCreateTool).toBeTruthy();
    expect(dirCreateTool.inputSchema).toBeDefined();
  });
});