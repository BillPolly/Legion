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

import toolRegistry from '../src/index.js';

async function checkStatus(options = {}) {
  const { verbose = false } = options;
  
  try {
    // toolRegistry is already the initialized singleton instance
    
    // Get system status through the singleton
    const status = await toolRegistry.getSystemStatus({ verbose });
    
    // Display status
    console.log('\n🔍 Tool Registry System Status');
    console.log('=' + '='.repeat(40));
    
    // Database connection
    console.log('\n📊 Database Connection:');
    console.log(`  MongoDB: ${status.database.connected ? '✅ Connected' : '❌ Disconnected'}`);
    
    // Collection counts
    console.log('\n📦 Collections:');
    console.log(`  Modules Loaded: ${status.collections.modules || 0}`);
    console.log(`  Modules Discovered: ${status.collections.moduleRegistry || 0}`);
    console.log(`  Tools: ${status.collections.tools || 0}`);
    console.log(`  Perspective Types: ${status.collections.perspectiveTypes || 0}`);
    console.log(`  Tool Perspectives: ${status.collections.toolPerspectives || 0}`);
    console.log(`  Perspectives with Embeddings: ${status.collections.perspectivesWithEmbeddings || 0}`);
    
    // Qdrant vector store
    if (status.qdrant) {
      console.log('\n🔮 Vector Store (Qdrant):');
      if (status.qdrant.connected) {
        console.log(`  Status: ✅ Connected`);
        console.log(`  Vectors Indexed: ${status.qdrant.vectors || 0}`);
        console.log(`  Dimensions: ${status.qdrant.dimensions || 768}`);
      } else {
        console.log(`  Status: ❌ Not connected`);
        if (status.qdrant.error) {
          console.log(`  Error: ${status.qdrant.error}`);
        }
      }
    }
    
    // Coverage statistics
    if (status.statistics.coverage) {
      console.log('\n📈 Coverage:');
      console.log(`  Tools with perspectives: ${status.statistics.coverage.toolsWithPerspectives}/${status.statistics.coverage.totalTools} (${status.statistics.coverage.percentage}%)`);
    }
    
    // Tools by module
    if (status.statistics.toolsByModule && status.statistics.toolsByModule.length > 0) {
      console.log('\n🔧 Tools by Module:');
      status.statistics.toolsByModule.forEach(item => {
        console.log(`  ${item._id}: ${item.count} tools`);
      });
    }
    
    // Perspectives by type
    if (status.statistics.perspectivesByType && status.statistics.perspectivesByType.length > 0) {
      console.log('\n📝 Perspectives by Type:');
      status.statistics.perspectivesByType.forEach(item => {
        console.log(`  ${item._id}: ${item.count}`);
      });
    }
    
    // System health
    console.log('\n💚 System Health:');
    console.log(`  Database: ${status.health.database ? '✅' : '❌'}`);
    console.log(`  LLM Client: ${status.health.llmClient ? '✅' : '❌'}`);
    console.log(`  Embedding Service: ${status.health.embeddingService ? '✅' : '❌'}`);
    console.log(`  Vector Store: ${status.health.vectorStore ? '✅' : '❌'}`);
    
    // Recommendations
    if (status.recommendations && status.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      status.recommendations.forEach(rec => {
        console.log(`  • ${rec}`);
      });
    }
    
    // Sample data if verbose
    if (verbose && status.samples) {
      if (status.samples.tools && status.samples.tools.length > 0) {
        console.log('\n📋 Sample Tools:');
        status.samples.tools.forEach(tool => {
          console.log(`  • ${tool.name} (${tool.moduleName}): ${tool.description?.substring(0, 60)}...`);
        });
      }
      
      if (status.samples.perspectives && status.samples.perspectives.length > 0) {
        console.log('\n📋 Sample Perspectives:');
        status.samples.perspectives.forEach(p => {
          console.log(`  • ${p.tool_name} - ${p.perspective_type_name}:`);
          console.log(`    "${p.content.substring(0, 80)}..."`);
        });
      }
    }
    
    console.log('\n' + '='.repeat(41) + '\n');
    
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