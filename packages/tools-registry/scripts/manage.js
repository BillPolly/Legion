#!/usr/bin/env node

/**
 * Tool Registry Management Script
 * 
 * Single script for all administrative operations using ToolManager singleton
 * 
 * Usage:
 *   node scripts/manage.js status                    # Show system status
 *   node scripts/manage.js status --verbose         # Show detailed status
 *   node scripts/manage.js discover                 # Discover modules with validation
 *   node scripts/manage.js clear                    # Clear tools and perspectives
 *   node scripts/manage.js clear --all              # Clear everything including registry
 *   node scripts/manage.js load                     # Load all discovered modules
 *   node scripts/manage.js load --module Calculator # Load specific module
 *   node scripts/manage.js perspectives             # Generate perspectives
 *   node scripts/manage.js embeddings               # Generate embeddings
 *   node scripts/manage.js vectors                  # Index vectors
 *   node scripts/manage.js pipeline                 # Run complete pipeline
 *   node scripts/manage.js search "file operations" # Test semantic search
 *   node scripts/manage.js verify                   # Verify system integrity
 */

import { getToolManager } from '../src/index.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || command === '--help' || command === '-h') {
    showHelp();
    process.exit(0);
  }
  
  try {
    // Get ToolManager singleton - this handles all administrative operations
    const toolManager = await getToolManager();
    
    switch (command.toLowerCase()) {
      case 'status':
        await handleStatus(toolManager, args.slice(1));
        break;
        
      case 'discover':
        await handleDiscover(toolManager, args.slice(1));
        break;
        
      case 'clear':
        await handleClear(toolManager, args.slice(1));
        break;
        
      case 'load':
        await handleLoad(toolManager, args.slice(1));
        break;
        
      case 'perspectives':
        await handlePerspectives(toolManager, args.slice(1));
        break;
        
      case 'embeddings':
        await handleEmbeddings(toolManager, args.slice(1));
        break;
        
      case 'vectors':
        await handleVectors(toolManager, args.slice(1));
        break;
        
      case 'pipeline':
        await handlePipeline(toolManager, args.slice(1));
        break;
        
      case 'search':
        await handleSearch(toolManager, args.slice(1));
        break;
        
      case 'verify':
        await handleVerify(toolManager, args.slice(1));
        break;
        
      default:
        console.error(`❌ Unknown command: ${command}`);
        console.error('Run "node scripts/manage.js --help" for available commands');
        process.exit(1);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    if (args.includes('--verbose') || args.includes('-v')) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

async function handleStatus(toolManager, args) {
  const verbose = args.includes('--verbose') || args.includes('-v');
  
  // Suppress console logs during initialization unless verbose
  const originalLog = console.log;
  if (!verbose) {
    console.log = () => {}; // Suppress all console.log output
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
  
  if (verbose) {
    console.log('\n📊 Database:');
    console.log(`  MongoDB: ${status.checks?.database ? '✅ Connected' : '❌ Disconnected'}`);
    
    console.log('\n💚 System Health:');
    console.log(`  Database: ${status.health?.database ? '✅' : '❌'}`);
    console.log(`  LLM Client: ${status.health?.llmClient ? '✅' : '❌'}`);
    console.log(`  Embedding Service: ${status.health?.embeddingService ? '✅' : '❌'}`);
    console.log(`  Vector Store: ${status.health?.vectorStore ? '✅' : '❌'}`);
  }
  
  console.log();
}

async function handleDiscover(toolManager, args) {
  const verbose = args.includes('--verbose') || args.includes('-v');
  const pathIndex = args.indexOf('--path');
  const searchPaths = pathIndex !== -1 && args[pathIndex + 1] ? [args[pathIndex + 1]] : ['packages'];
  
  console.log('🔍 Discovering modules with validation...\n');
  
  const result = await toolManager.discoverModules(searchPaths);
  
  console.log(`📦 Discovered ${result.discovered} modules`);
  
  if (verbose && result.modules?.length > 0) {
    console.log('\nModules found:');
    result.modules.forEach(m => {
      console.log(`  - ${m.name} (${m.validation?.toolsCount || 0} tools)`);
    });
  }
  
  if (result.errors?.length > 0) {
    console.log(`\n⚠️  ${result.errors.length} errors occurred`);
    if (verbose) {
      result.errors.forEach(error => {
        console.log(`  - ${error.path}: ${error.error}`);
      });
    }
  }
  
  console.log('\n✅ Discovery complete!');
}

async function handleClear(toolManager, args) {
  const includeRegistry = args.includes('--all') || args.includes('--include-registry');
  const force = args.includes('--force');
  
  if (!force) {
    console.log('🔄 Database Clear\n');
    console.log('===================================================');
    console.log('\n⚠️  This will clear:');
    console.log('  - tools collection');
    console.log('  - tool_perspectives collection');
    console.log('  - perspective_types collection (will be re-seeded)');
    
    if (includeRegistry) {
      console.log('  - module-registry collection');
    }
    
    console.log('\nPress Ctrl+C to cancel, or wait 3 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  console.log('🧹 Clearing...');
  
  const result = await toolManager.clearAllData({
    includeRegistry: includeRegistry,
    clearVectors: true
  });
  
  console.log(`✅ Cleared: ${result.cleared?.join(', ') || 'all data'}`);
  
  if (result.reseeded) {
    console.log('✅ Re-seeded perspective types');
  }
  
  console.log('\n✅ Clear complete!');
}

async function handleLoad(toolManager, args) {
  const moduleIndex = args.indexOf('--module');
  const moduleName = moduleIndex !== -1 && args[moduleIndex + 1] ? args[moduleIndex + 1] : null;
  
  if (moduleName) {
    console.log(`🔄 Loading module: ${moduleName}`);
    const result = await toolManager.loadModule(moduleName);
    
    if (result.success) {
      console.log(`✅ Module loaded: ${moduleName} (${result.toolCount || 0} tools)`);
    } else {
      console.error(`❌ Failed to load module: ${result.error}`);
      process.exit(1);
    }
  } else {
    console.log('🔄 Loading all discovered modules...');
    const result = await toolManager.loadAllModules();
    
    console.log(`✅ Loaded ${result.loaded} modules (${result.failed} failed)`);
    
    if (result.errors?.length > 0) {
      console.log('\n⚠️  Errors:');
      result.errors.forEach(error => {
        console.log(`  - ${error.module}: ${error.error}`);
      });
    }
  }
}

async function handlePerspectives(toolManager, args) {
  const verbose = args.includes('--verbose') || args.includes('-v');
  
  console.log('🔄 Generating perspectives...');
  
  const result = await toolManager.generatePerspectives({ verbose });
  
  console.log(`✅ Generated ${result.generated} perspectives`);
  
  if (result.failed > 0) {
    console.log(`⚠️  ${result.failed} failed`);
  }
}

async function handleEmbeddings(toolManager, args) {
  const verbose = args.includes('--verbose') || args.includes('-v');
  
  console.log('🔄 Generating embeddings...');
  
  const result = await toolManager.generateEmbeddings({ verbose });
  
  console.log(`✅ Generated ${result.generated} embeddings`);
  
  if (result.failed > 0) {
    console.log(`⚠️  ${result.failed} failed`);
  }
}

async function handleVectors(toolManager, args) {
  const verbose = args.includes('--verbose') || args.includes('-v');
  
  console.log('🔄 Indexing vectors...');
  
  const result = await toolManager.indexVectors({ verbose });
  
  console.log(`✅ Indexed ${result.indexed} vectors`);
  
  if (result.failed > 0) {
    console.log(`⚠️  ${result.failed} failed`);
  }
}

async function handlePipeline(toolManager, args) {
  const verbose = args.includes('--verbose') || args.includes('-v');
  
  console.log('🔄 Running complete pipeline...');
  
  const result = await toolManager.runCompletePipeline({ verbose });
  
  if (result.success) {
    console.log('✅ Pipeline completed successfully');
    
    if (result.steps?.length > 0) {
      console.log('\nSteps completed:');
      result.steps.forEach(step => {
        console.log(`  ✅ ${step}`);
      });
    }
  } else {
    console.error('❌ Pipeline failed');
    if (result.error) {
      console.error(`Error: ${result.error}`);
    }
    process.exit(1);
  }
}

async function handleSearch(toolManager, args) {
  const query = args.find(arg => !arg.startsWith('--'));
  const limit = parseInt(args[args.indexOf('--limit') + 1]) || 5;
  
  if (!query) {
    console.error('❌ Search query required');
    console.error('Usage: node scripts/manage.js search "your search query"');
    process.exit(1);
  }
  
  console.log(`🔍 Testing semantic search for: "${query}"`);
  
  const result = await toolManager.testSemanticSearch([query], { limit });
  
  if (result.success) {
    console.log(`\n📊 Search Results (${result.queriesRun} queries):`);
    
    if (result.results?.length > 0) {
      result.results.forEach((queryResult, i) => {
        console.log(`\n${i + 1}. Query: "${queryResult.query}"`);
        if (queryResult.topResult) {
          console.log(`   Best match: ${queryResult.topResult.name}`);
          console.log(`   Similarity: ${(queryResult.topResult.similarity * 100).toFixed(1)}%`);
          console.log(`   Module: ${queryResult.topResult.moduleName}`);
        } else {
          console.log('   No results found');
        }
      });
    }
  } else {
    console.error(`❌ Search failed: ${result.error}`);
    process.exit(1);
  }
}

async function handleVerify(toolManager, args) {
  const verbose = args.includes('--verbose') || args.includes('-v');
  
  console.log('🔍 Verifying system integrity...');
  
  const result = await toolManager.verifySystemIntegrity();
  
  if (result.success) {
    console.log('✅ System integrity verified');
  } else {
    console.error('❌ System integrity issues found');
    
    if (result.issues?.length > 0) {
      console.error('\nIssues:');
      result.issues.forEach(issue => {
        console.error(`  - ${issue}`);
      });
    }
    
    if (!verbose) {
      console.error('\nRun with --verbose for more details');
    }
    
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
Tool Registry Management Script

Usage:
  node scripts/manage.js <command> [options]

Commands:
  status [--verbose]           Show system status
  discover [--path <path>]     Discover modules with validation
  clear [--all] [--force]      Clear tools/perspectives (--all includes registry)
  load [--module <name>]       Load all modules or specific module
  perspectives [--verbose]     Generate perspectives for tools
  embeddings [--verbose]       Generate embeddings for perspectives
  vectors [--verbose]          Index vectors in vector store
  pipeline [--verbose]         Run complete initialization pipeline
  search <query> [--limit N]   Test semantic search
  verify [--verbose]           Verify system integrity

Options:
  --verbose, -v               Show detailed output
  --force                     Skip confirmation prompts
  --path <path>               Custom search path for discovery
  --module <name>             Specific module name for loading
  --all                       Include registry in clear operations
  --limit <N>                 Limit search results (default: 5)

Examples:
  node scripts/manage.js status
  node scripts/manage.js discover --verbose
  node scripts/manage.js clear --all
  node scripts/manage.js load --module Calculator
  node scripts/manage.js search "file operations" --limit 3
  node scripts/manage.js pipeline
  `);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error.message);
  process.exit(1);
});

// Run the script
main().catch(console.error);