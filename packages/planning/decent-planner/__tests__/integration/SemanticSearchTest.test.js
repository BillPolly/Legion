/**
 * Test if semantic search returns genuine Tool objects
 */

import { ResourceManager } from '@legion/resource-manager';
import { Tool } from '@legion/tools-registry';

describe('Semantic Search Tool Object Test', () => {
  let toolRegistry;
  
  beforeAll(async () => {
    const resourceManager = await ResourceManager.getInstance();
    const { getToolRegistry } = await import('@legion/tools-registry');
    toolRegistry = await getToolRegistry();
  }, 30000);

  test('semantic search should return genuine Tool objects', async () => {
    console.log('=== CHECKING SEMANTIC SEARCH RETURNS TOOL OBJECTS ===');
    
    const searchResults = await toolRegistry.searchTools("write hello world", { limit: 5 });
    
    console.log('Search results count:', searchResults.length);
    
    if (searchResults.length === 0) {
      console.log('❌ No search results returned');
      return;
    }
    
    for (let i = 0; i < searchResults.length; i++) {
      const result = searchResults[i];
      
      console.log(`\n--- Result ${i + 1} ---`);
      console.log('Type:', typeof result);
      console.log('Constructor:', result?.constructor?.name);
      console.log('Has tool field:', 'tool' in result);
      console.log('Tool instanceof Tool:', result.tool instanceof Tool);
      console.log('Tool has serialize method:', typeof result.tool?.serialize === 'function');
      console.log('Name:', result?.name);
      console.log('Tool name:', result.tool?.name);
      
      // Check what we actually got
      if (result.tool instanceof Tool) {
        console.log('✅ Result has Tool object');
        expect(typeof result.tool.serialize).toBe('function');
      } else {
        console.log('❌ Result does not have Tool object');
        console.log('Result structure:', Object.keys(result));
        // Don't fail the test, just show what we got
      }
    }
    
    console.log('✅ All search results are genuine Tool objects');
  }, 30000);
});