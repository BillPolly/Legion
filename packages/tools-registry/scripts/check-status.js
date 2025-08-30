#!/usr/bin/env node

/**
 * Check Status Script
 * 
 * Shows the current status of the 3-collection perspective system
 * Displays statistics, coverage, and sample data
 * 
 * Usage:
 *   node scripts/check-status.js           # Show basic status
 *   node scripts/check-status.js --verbose # Show detailed status with samples
 */

import { getToolManager } from '../src/index.js';

async function checkStatus(options = {}) {
  const { verbose = false } = options;
  
  try {
    // Suppress console logs during initialization unless verbose
    const originalLog = console.log;
    if (!verbose) {
      console.log = () => {}; // Suppress all console.log output
    }
    
    // Get ToolManager singleton for administrative operations
    const toolManager = await getToolManager();
    
    // Restore console.log
    console.log = originalLog;
    
    // Get system status through the singleton (suppress logs unless verbose)
    if (!verbose) {
      console.log = () => {}; // Suppress again during getSystemStatus
    }
    const status = await toolManager.getSystemStatus({ verbose });
    console.log = originalLog; // Restore console.log
    
    // Simple collection counts display
    console.log('\n📊 Collection Counts:');
    console.log(`  📦 Modules Discovered: ${status.statistics?.modules?.totalDiscovered || 0}`);
    console.log(`  🔧 Tools Discovered: ${status.statistics?.modules?.totalToolsDiscovered || 0}`);
    console.log(`  📋 Modules Loaded: ${status.statistics?.modules?.totalLoaded || 0}`);
    console.log(`  ⚙️  Tools Loaded: ${status.statistics?.tools?.total || 0}`);
    console.log(`  📝 Perspectives Generated: ${status.statistics?.search?.perspectivesGenerated || 0}`);
    console.log(`  🎯 With Embeddings: ${status.statistics?.search?.perspectivesWithEmbeddings || 0}`);
    
    // Vector store info - test Qdrant connection directly
    console.log('\n🔮 Vector Index:');
    
    // Test direct Qdrant connection independent of collections/content
    let qdrantStatus = '❌ Disconnected';
    let vectorCount = 0;
    
    try {
      const { QdrantClient } = await import('@qdrant/js-client-rest');
      const client = new QdrantClient({ url: 'http://localhost:6333' });
      const collections = await client.getCollections();
      qdrantStatus = '✅ Connected';
      
      // Check if tools collection exists and get count
      const hasToolsCollection = collections.collections.some(c => c.name === 'tools');
      if (hasToolsCollection) {
        const info = await client.getCollection('tools');
        vectorCount = info.vectors_count || 0;
      }
    } catch (e) {
      qdrantStatus = '❌ Disconnected (not reachable)';
    }
    
    console.log(`  Status: ${qdrantStatus}`);
    console.log(`  Vectors: ${vectorCount}`);
    
    // Only show detailed info if verbose
    if (verbose) {
      // Database connection
      console.log('\n📊 Database:');
      console.log(`  MongoDB: ${status.checks?.database ? '✅ Connected' : '❌ Disconnected'}`);
      
      // System health
      console.log('\n💚 System Health:');
      console.log(`  Database: ${status.health?.database ? '✅' : '❌'}`);
      console.log(`  LLM Client: ${status.health?.llmClient ? '✅' : '❌'}`);
      console.log(`  Embedding Service: ${status.health?.embeddingService ? '✅' : '❌'}`);
      console.log(`  Vector Store: ${status.health?.vectorStore ? '✅' : '❌'}`);
      
      // Tools by module
      if (status.statistics?.toolsByModule && status.statistics.toolsByModule.length > 0) {
        console.log('\n🔧 Tools by Module:');
        status.statistics.toolsByModule.forEach(item => {
          console.log(`  ${item._id}: ${item.count} tools`);
        });
      }
      
      // Sample data
      if (status.samples?.tools && status.samples.tools.length > 0) {
        console.log('\n📋 Sample Tools:');
        status.samples.tools.slice(0, 3).forEach(tool => {
          console.log(`  • ${tool.name} (${tool.moduleName})`);
        });
      }
    }
    
    console.log();
    
    // Exit successfully
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error checking status:', error.message);
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  verbose: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Check Status Script

Usage:
  node scripts/check-status.js [options]

Options:
  --verbose, -v    Show detailed output with samples
  --help, -h       Show this help message

Examples:
  node scripts/check-status.js
  node scripts/check-status.js --verbose
    `);
    process.exit(0);
  }
}

// Run the script
checkStatus(options).catch(console.error);