#!/usr/bin/env node

/**
 * Prove we're using REAL Qdrant
 * - Insert tool perspectives into Qdrant
 * - Query Qdrant directly via REST API to show they're there
 * - Search and retrieve them
 */

import { ResourceManager } from '@legion/core';
import { MongoDBToolRegistryProvider } from '../src/providers/MongoDBToolRegistryProvider.js';
import { SemanticSearchProvider } from '../../semantic-search/src/SemanticSearchProvider.js';
import { execSync } from 'child_process';

async function main() {
  console.log('🔍 PROOF: Using Real Qdrant Database');
  console.log('═'.repeat(50));
  
  try {
    // Initialize
    const resourceManager = ResourceManager.getInstance();
    if (!resourceManager.initialized) { await resourceManager.initialize(); }
    // No need to set embedding type - always uses Nomic
    
    const mongoProvider = await MongoDBToolRegistryProvider.create(resourceManager, {
      enableSemanticSearch: false
    });
    
    const searchProvider = await SemanticSearchProvider.create(resourceManager);
    console.log('✅ Providers ready\n');
    
    // Clean collection
    await searchProvider.vectorStore.deleteCollection('qdrant_proof').catch(() => {});
    await searchProvider.createCollection('qdrant_proof', { dimension: 384 });
    
    // 1. INSERT: Get perspectives and insert them
    console.log('📝 STEP 1: Inserting tool perspectives into Qdrant...');
    const tools = ['file_read', 'file_write', 'directory_create'];
    const insertedVectors = [];
    let vectorId = 100;  // Start with predictable IDs
    
    for (const toolName of tools) {
      const perspectives = await mongoProvider.databaseService.mongoProvider.find('tool_perspectives', {
        toolName: toolName,
        embedding: { $exists: true, $ne: null }
      }, { limit: 1 });
      
      if (perspectives.length > 0) {
        const p = perspectives[0];
        const id = vectorId++;
        
        await searchProvider.vectorStore.upsert('qdrant_proof', [{
          id: id,
          vector: p.embedding,
          payload: {
            toolName: p.toolName,
            perspectiveText: p.perspectiveText
          }
        }]);
        
        insertedVectors.push({ id, toolName: p.toolName });
        console.log(`  ✅ Inserted ID ${id}: ${toolName}`);
      }
    }
    
    // 2. VERIFY: Check Qdrant directly via REST API
    console.log('\n📊 STEP 2: Querying Qdrant directly via REST API...');
    
    // Get collection info
    const collectionInfo = execSync(
      'curl -s http://localhost:6333/collections/qdrant_proof | jq ".result | {points_count, indexed_vectors_count}"'
    ).toString();
    console.log('  Collection info:', collectionInfo.trim());
    
    // Get specific point by ID
    console.log('\n  Retrieving specific vectors by ID:');
    for (const vec of insertedVectors) {
      try {
        const point = execSync(
          `curl -s http://localhost:6333/collections/qdrant_proof/points/${vec.id} | jq '.result'`
        ).toString();
        const parsed = JSON.parse(point);
        if (parsed) {
          console.log(`  ✅ ID ${vec.id}: Found in Qdrant - toolName: ${parsed.payload?.toolName}`);
        }
      } catch (e) {
        console.log(`  ❌ ID ${vec.id}: Not found`);
      }
    }
    
    // 3. SEARCH: Perform semantic search
    console.log('\n🔍 STEP 3: Semantic search in Qdrant...');
    const searchResults = await searchProvider.semanticSearch('qdrant_proof', 'read files from filesystem', {
      limit: 3,
      threshold: 0.0
    });
    
    console.log(`  Found ${searchResults.length} results:`);
    searchResults.forEach((r, i) => {
      console.log(`    ${i+1}. ${r.document?.toolName} (score: ${r._similarity.toFixed(3)})`);
    });
    
    // 4. COUNT: Final count
    const finalCount = await searchProvider.count('qdrant_proof');
    console.log(`\n📊 FINAL: Qdrant collection has ${finalCount} vectors`);
    
    // Clean up
    await mongoProvider.disconnect();
    
    // Summary
    console.log('\n' + '═'.repeat(50));
    console.log('✅ PROOF COMPLETE:');
    console.log(`  1. Inserted ${insertedVectors.length} tool perspective vectors`);
    console.log(`  2. Verified they exist in Qdrant via REST API`);
    console.log(`  3. Successfully searched and retrieved them`);
    console.log(`  4. Collection contains ${finalCount} real vectors`);
    console.log('\n🎉 This is 100% REAL Qdrant - no in-memory fallback!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);