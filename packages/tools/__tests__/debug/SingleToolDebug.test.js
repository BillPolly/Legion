/**
 * Single Tool Debug Test
 * 
 * This test focuses on debugging a single tool retrieval to understand
 * exactly what's happening in the ToolRegistry.
 */

import { ToolRegistry } from '../../src/integration/ToolRegistry.js';
import { MongoDBToolRegistryProvider } from '../../src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/tools';

describe('Single Tool Debug', () => {
  let resourceManager;
  let provider;
  let toolRegistry;

  beforeAll(async () => {
    resourceManager = new ResourceManager();
    await resourceManager.initialize();

    provider = await MongoDBToolRegistryProvider.create(resourceManager, {
      enableSemanticSearch: false
    });

    toolRegistry = new ToolRegistry({ provider });
    await toolRegistry.initialize();
  });

  afterAll(async () => {
    if (provider) {
      await provider.disconnect();
    }
  });

  test('should debug calculator tool retrieval', async () => {
    console.log('\n' + '='.repeat(80));
    console.log('DEBUGGING: Calculator Tool Retrieval');
    console.log('='.repeat(80) + '\n');

    // Try to get the calculator tool
    console.log('Attempting to retrieve "calculator" tool via ToolRegistry...\n');
    const tool = await toolRegistry.getTool('calculator');
    
    console.log('\n' + '-'.repeat(80));
    console.log('RESULT:');
    console.log(`Tool retrieved: ${!!tool}`);
    if (tool) {
      console.log(`Tool name: ${tool.name}`);
      console.log(`Has execute: ${typeof tool.execute === 'function'}`);
    }
    console.log('-'.repeat(80) + '\n');
    
    expect(tool).toBeTruthy();
  });
});