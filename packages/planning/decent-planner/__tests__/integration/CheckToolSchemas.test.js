/**
 * Test to check what tool schemas contain from semantic search
 */

import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs';

describe('Check Tool Schemas', () => {
  let toolRegistry;
  
  beforeAll(async () => {
    const resourceManager = await ResourceManager.getInstance();
    const { getToolRegistry } = await import('@legion/tools-registry');
    toolRegistry = await getToolRegistry();
  }, 30000);

  test('check tool schemas from semantic search', async () => {
    console.log('=== CHECKING TOOL SCHEMAS FROM SEMANTIC SEARCH ===');
    
    // Search for JavaScript tools
    const searchResults = await toolRegistry.searchTools("javascript generate function", { limit: 10 });
    
    let logOutput = '=== TOOL SCHEMAS FROM SEMANTIC SEARCH ===\n\n';
    
    console.log(`Found ${searchResults.length} tools`);
    
    for (let i = 0; i < searchResults.length; i++) {
      const result = searchResults[i];
      const tool = result.tool;
      
      logOutput += `=== TOOL ${i + 1}: ${tool?.name} ===\n`;
      logOutput += `Description: ${tool?.description}\n`;
      logOutput += `Module: ${tool?.module?.name || 'unknown'}\n\n`;
      
      // Check input schema
      logOutput += 'INPUT SCHEMA:\n';
      if (tool?.inputSchema) {
        try {
          logOutput += JSON.stringify(tool.inputSchema, null, 2) + '\n\n';
        } catch (error) {
          logOutput += `Error serializing inputSchema: ${error.message}\n\n`;
        }
      } else {
        logOutput += 'No input schema defined\n\n';
      }
      
      // Check output schema
      logOutput += 'OUTPUT SCHEMA:\n';
      if (tool?.outputSchema) {
        try {
          logOutput += JSON.stringify(tool.outputSchema, null, 2) + '\n\n';
        } catch (error) {
          logOutput += `Error serializing outputSchema: ${error.message}\n\n`;
        }
      } else {
        logOutput += 'No output schema defined\n\n';
      }
      
      logOutput += '=' + '='.repeat(50) + '\n\n';
      
      console.log(`Tool ${i + 1}: ${tool?.name}`);
      console.log('  Has inputSchema:', !!tool?.inputSchema);
      console.log('  Has outputSchema:', !!tool?.outputSchema);
      console.log('  Input keys:', tool?.inputSchema ? Object.keys(tool.inputSchema.properties || {}) : 'none');
      console.log('  Output keys:', tool?.outputSchema ? Object.keys(tool.outputSchema.properties || {}) : 'none');
    }
    
    // Write to file for detailed inspection
    fs.writeFileSync('/tmp/tool-schemas.log', logOutput);
    console.log('Tool schemas logged to /tmp/tool-schemas.log');
    
    // Also test specific tools mentioned in behavior tree
    const specificTools = ['generate_javascript_function', 'run_node'];
    for (const toolName of specificTools) {
      console.log(`\n=== CHECKING SPECIFIC TOOL: ${toolName} ===`);
      try {
        const tool = await toolRegistry.getTool(toolName);
        console.log('Tool found:', !!tool);
        console.log('Tool type:', typeof tool);
        console.log('Tool name:', tool?.name);
        console.log('Has inputSchema:', !!tool?.inputSchema);
        console.log('Has outputSchema:', !!tool?.outputSchema);
        
        if (tool?.inputSchema?.properties) {
          console.log('Input properties:', Object.keys(tool.inputSchema.properties));
        }
        
        if (tool?.outputSchema?.properties) {
          console.log('Output properties:', Object.keys(tool.outputSchema.properties));
        }
        
      } catch (error) {
        console.log(`Error getting tool ${toolName}:`, error.message);
      }
    }
    
  }, 60000);
});