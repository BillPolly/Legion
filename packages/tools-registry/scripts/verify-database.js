#!/usr/bin/env node

/**
 * Verify Database Contents Script
 * 
 * Checks and displays current database state for tools, modules, and perspectives.
 * 
 * Usage:
 *   node scripts/verify-database.js                    # Show all statistics
 *   node scripts/verify-database.js --collection tools # Show specific collection
 *   node scripts/verify-database.js --sample           # Show sample records
 */

import { MongoDBToolRegistryProvider } from '../src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    collection: null,
    sample: args.includes('--sample'),
    verbose: args.includes('--verbose') || args.includes('-v')
  };
  
  // Check for specific collection
  const collectionIndex = args.indexOf('--collection');
  if (collectionIndex !== -1 && args[collectionIndex + 1]) {
    options.collection = args[collectionIndex + 1];
  }
  
  // Show help if requested
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Database Verification Script

Usage:
  node scripts/verify-database.js [options]

Options:
  --collection <name>    Show specific collection (modules, tools, tool_perspectives)
  --sample               Show sample records from collections
  --verbose, -v          Show detailed output
  --help, -h             Show this help message

Examples:
  node scripts/verify-database.js
  node scripts/verify-database.js --collection tools
  node scripts/verify-database.js --sample
`);
    process.exit(0);
  }
  
  console.log('🔍 Database Verification Script');
  console.log('═'.repeat(50));
  
  try {
    console.log('🔧 Connecting to database...');
    const resourceManager = ResourceManager.getInstance();
    if (!resourceManager.initialized) { await resourceManager.initialize(); }
    
    const provider = await MongoDBToolRegistryProvider.create(resourceManager, {
      enableSemanticSearch: false
    });
    
    console.log('✅ Connected to database\n');
    
    const db = provider.databaseService.mongoProvider.db;
    
    if (options.collection) {
      // Show specific collection
      await showCollectionDetails(db, options.collection, options);
    } else {
      // Show all collections
      await showAllCollections(db, options);
    }
    
    await provider.disconnect();
    
    console.log('\n✅ Database verification completed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

async function showAllCollections(db, options) {
  console.log('📊 Database Overview');
  console.log('━'.repeat(30));
  
  // Count documents in each collection
  const modules = await db.collection('modules').countDocuments();
  const tools = await db.collection('tools').countDocuments();
  const perspectives = await db.collection('tool_perspectives').countDocuments();
  
  console.log(`📁 modules: ${modules} documents`);
  console.log(`🔧 tools: ${tools} documents`);
  console.log(`📝 tool_perspectives: ${perspectives} documents`);
  
  if (modules > 0) {
    console.log('\n📦 Modules Summary:');
    const modulesSample = await db.collection('modules').find({}).limit(10).toArray();
    for (const module of modulesSample) {
      console.log(`   - ${module.name} (${module.type}) - ${module.toolCount || 0} tools`);
    }
  }
  
  if (tools > 0) {
    console.log('\n🔧 Tools by Module:');
    const toolsByModule = await db.collection('tools').aggregate([
      { $group: { _id: '$moduleName', count: { $sum: 1 }, tools: { $push: '$name' } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    for (const group of toolsByModule) {
      console.log(`   ${group._id}: ${group.count} tools`);
      if (options.verbose) {
        console.log(`      Tools: ${group.tools.join(', ')}`);
      }
    }
  }
  
  if (perspectives > 0) {
    console.log('\n📝 Perspectives Summary:');
    const perspectivesByType = await db.collection('tool_perspectives').aggregate([
      { $group: { _id: '$perspectiveType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    for (const group of perspectivesByType) {
      console.log(`   ${group._id}: ${group.count} perspectives`);
    }
    
    // Check embeddings
    const withEmbeddings = await db.collection('tool_perspectives').countDocuments({
      embedding: { $exists: true, $ne: null }
    });
    console.log(`\n🧠 Embeddings: ${withEmbeddings}/${perspectives} perspectives have embeddings`);
  }
  
  if (options.sample && perspectives > 0) {
    console.log('\n📋 Sample Perspectives:');
    const samples = await db.collection('tool_perspectives').find({}).limit(3).toArray();
    for (const sample of samples) {
      console.log(`   ${sample.toolName}/${sample.perspectiveType}:`);
      console.log(`      Text: "${sample.perspectiveText.substring(0, 60)}..."`);
      console.log(`      Has embedding: ${!!sample.embedding} (${sample.embedding?.length || 0}d)`);
      console.log(`      Model: ${sample.embeddingModel || 'unknown'}`);
      console.log('');
    }
  }
}

async function showCollectionDetails(db, collectionName, options) {
  console.log(`📋 Collection: ${collectionName}`);
  console.log('━'.repeat(30));
  
  try {
    const count = await db.collection(collectionName).countDocuments();
    console.log(`Total documents: ${count}`);
    
    if (count === 0) {
      console.log('Collection is empty.');
      return;
    }
    
    // Show sample documents
    const samples = await db.collection(collectionName).find({}).limit(5).toArray();
    console.log(`\nSample documents (showing ${Math.min(5, count)}):`);
    
    for (let i = 0; i < samples.length; i++) {
      const doc = samples[i];
      console.log(`\n${i + 1}. Document ID: ${doc._id}`);
      
      if (collectionName === 'modules') {
        console.log(`   Name: ${doc.name}`);
        console.log(`   Type: ${doc.type}`);
        console.log(`   Tool Count: ${doc.toolCount || 0}`);
        console.log(`   Status: ${doc.status}`);
      } else if (collectionName === 'tools') {
        console.log(`   Name: ${doc.name}`);
        console.log(`   Module: ${doc.moduleName}`);
        console.log(`   Category: ${doc.category}`);
        console.log(`   Has Schema: ${!!doc.inputSchema}`);
      } else if (collectionName === 'tool_perspectives') {
        console.log(`   Tool: ${doc.toolName}`);
        console.log(`   Type: ${doc.perspectiveType}`);
        console.log(`   Text: "${doc.perspectiveText.substring(0, 60)}..."`);
        console.log(`   Has Embedding: ${!!doc.embedding} (${doc.embedding?.length || 0}d)`);
        console.log(`   Model: ${doc.embeddingModel || 'unknown'}`);
      }
    }
    
    if (options.verbose && collectionName === 'tool_perspectives') {
      // Show perspective type distribution
      console.log('\nPerspective Type Distribution:');
      const typeDistribution = await db.collection('tool_perspectives').aggregate([
        { $group: { _id: '$perspectiveType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).toArray();
      
      for (const type of typeDistribution) {
        console.log(`   ${type._id}: ${type.count} perspectives`);
      }
    }
  } catch (error) {
    console.error(`Error querying ${collectionName}:`, error.message);
  }
}

// Run the main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});