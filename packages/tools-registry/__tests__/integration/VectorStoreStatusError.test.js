/**
 * VectorStore Status Error Test
 * Reproduces the "Cannot read properties of undefined (reading 'status')" error
 * Tests vector search operations to identify the exact failure point
 * NO MOCKS - Real VectorStore operations
 */

import { ResourceManager } from '@legion/resource-manager';
import { getToolRegistry } from '../../src/index.js';

describe('VectorStore Status Error Reproduction', () => {
  let resourceManager;
  let toolRegistry;
  
  beforeAll(async () => {
    console.log('\n🚀 Setting up VectorStore Status Error tests');
    resourceManager = await ResourceManager.getInstance();
    toolRegistry = await getToolRegistry();
    console.log('✅ ToolRegistry initialized for VectorStore testing');
  });

  test('should reproduce status property undefined error during vector search', async () => {
    console.log('\n🎯 Attempting to reproduce VectorStore status error');
    
    try {
      // This should trigger the vector search that causes the status error
      console.log('🔍 Performing vector search that triggers status error...');
      
      const searchResults = await toolRegistry.searchTools('javascript code generation', { 
        limit: 5,
        searchType: 'semantic' // Force semantic/vector search
      });
      
      console.log(`✅ Search completed successfully with ${searchResults.length} results`);
      
      // If we get here without error, the issue might be intermittent
      searchResults.forEach((result, idx) => {
        console.log(`   ${idx + 1}. ${result.name} (confidence: ${result.confidence})`);
      });
      
    } catch (error) {
      console.log(`🚨 REPRODUCED THE ERROR: ${error.message}`);
      
      if (error.message.includes('status')) {
        console.log('✅ Successfully reproduced the status property error!');
        console.log(`🔍 Error type: ${error.constructor.name}`);
        console.log(`🔍 Full error: ${error.stack}`);
        
        // This is the error we want to reproduce and fix
        expect(error.message).toContain('status');
      } else {
        console.log('❌ Different error occurred');
        throw error;
      }
    }
  }, 30000);

  test('should test vector search components individually', async () => {
    console.log('\n🔧 Testing vector search components individually');
    
    try {
      // Access internal components
      const serviceOrchestrator = toolRegistry.serviceOrchestrator;
      const searchService = serviceOrchestrator.searchService;
      
      console.log('🔍 Testing SearchService directly...');
      
      // Test semantic search specifically
      const results = await searchService.semanticSearch('javascript', {
        limit: 3,
        scoreThreshold: 0.1
      });
      
      console.log(`✅ Direct semantic search successful: ${results.length} results`);
      
    } catch (error) {
      console.log(`🚨 Direct semantic search failed: ${error.message}`);
      
      if (error.message.includes('status')) {
        console.log('✅ Found the status error in semantic search component!');
      }
      
      console.log(`🔍 Error stack: ${error.stack}`);
    }
  }, 30000);

  test('should test vector store operations directly', async () => {
    console.log('\n🎯 Testing VectorStore operations directly');
    
    try {
      const serviceOrchestrator = toolRegistry.serviceOrchestrator;
      const vectorStore = serviceOrchestrator.searchService?.vectorStore;
      
      if (vectorStore) {
        console.log('✅ VectorStore found, testing search...');
        
        // Test direct vector search
        const results = await vectorStore.search('test query', {
          limit: 2
        });
        
        console.log(`✅ Direct VectorStore search successful: ${results.length} results`);
        
      } else {
        console.log('⚠️ VectorStore not accessible');
      }
      
    } catch (error) {
      console.log(`🚨 VectorStore direct test failed: ${error.message}`);
      
      if (error.message.includes('status')) {
        console.log('✅ Found status error in VectorStore!');
        console.log('🔍 This is where we need to add status property validation');
      }
      
      console.log(`🔍 Stack: ${error.stack}`);
    }
  }, 30000);

  test('should test Qdrant client status handling', async () => {
    console.log('\n🔧 Testing Qdrant client status handling');
    
    try {
      // Get access to the Qdrant client if possible
      const serviceOrchestrator = toolRegistry.serviceOrchestrator;
      const qdrantClient = serviceOrchestrator.searchService?.vectorStore?.vectorDatabase?.client;
      
      if (qdrantClient) {
        console.log('✅ Qdrant client found');
        
        // Test client operations that might have status properties
        const collections = await qdrantClient.getCollections();
        console.log(`✅ Qdrant collections retrieved: ${collections?.collections?.length || 0}`);
        
        // Check if collections have status properties
        if (collections?.collections) {
          collections.collections.forEach((collection, idx) => {
            console.log(`   Collection ${idx + 1}: ${collection.name}`);
            console.log(`      Status: ${collection.status || 'undefined'}`);
            console.log(`      Properties: ${Object.keys(collection).join(', ')}`);
          });
        }
        
      } else {
        console.log('⚠️ Qdrant client not accessible');
      }
      
    } catch (error) {
      console.log(`🚨 Qdrant client test failed: ${error.message}`);
      
      if (error.message.includes('status')) {
        console.log('✅ Found status error in Qdrant client operations!');
      }
    }
  }, 30000);
});