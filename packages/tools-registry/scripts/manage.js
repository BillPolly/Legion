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
    // For status command, suppress logging during initialization unless verbose requested
    let originalLog, originalInfo, originalWarn, originalError;
    const isStatusCommand = command.toLowerCase() === 'status';
    const isVerbose = args.includes('--verbose') || args.includes('-v');
    
    // REMOVED: No console suppression - let errors show through
    
    // Get ToolManager singleton - this handles all administrative operations
    const toolManager = await getToolManager();
    
    // REMOVED: Console suppression removed
    
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
        
      case 'vectors:load':
        await handleVectorsLoad(toolManager, args.slice(1));
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
        
      case 'add':
        await handleAdd(toolManager, args.slice(1));
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
  
  // Get status (logging is already suppressed at main level for non-verbose)
  const status = await toolManager.getSystemStatus({ verbose: false });
  
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
    
    // Check if tool_vectors collection exists and get count  
    const hasToolVectorsCollection = collections.collections.some(c => c.name === 'tool_vectors');
    if (hasToolVectorsCollection) {
      const info = await client.getCollection('tool_vectors');
      vectorCount = info.points_count || 0;
    } else {
      throw new Error('Expected tool_vectors collection not found in Qdrant');
    }
  } catch (e) {
    qdrantStatus = '❌ Disconnected (not reachable)';
  }
  
  console.log(`  Status: ${qdrantStatus}`);
  console.log(`  Vectors: ${vectorCount}`);

  // Test semantic search functionality if vectors are available
  if (vectorCount > 0) {
    console.log('\n🔍 Semantic Search Test:');
    await testSemanticSearchFunctionality(toolManager, verbose);
  }
  
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
  
  // Clear ONLY the perspectives collection, not all data
  console.log('🧹 Clearing existing perspectives only...');
  
  // Import ResourceManager and MongoClient to clear perspectives directly
  const { ResourceManager } = await import('@legion/resource-manager');
  const { MongoClient } = await import('mongodb');
  
  const resourceManager = await ResourceManager.getInstance();
  const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
  
  const client = new MongoClient(mongoUrl);
  await client.connect();
  const db = client.db('legion_tools');
  
  const result = await db.collection('tool_perspectives').deleteMany({});
  console.log(`✅ Cleared ${result.deletedCount} existing perspectives (kept tools)`);
  
  await client.close();
  
  console.log('🔄 Generating perspectives...');
  
  const perspectiveResult = await toolManager.generatePerspectives({ 
    verbose,
    forceRegenerate: true  // Always regenerate perspectives by default
  });
  
  console.log(`✅ Generated ${perspectiveResult.generated} perspectives`);
  
  if (perspectiveResult.failed > 0) {
    console.log(`⚠️  ${perspectiveResult.failed} failed`);
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

async function handleVectorsLoad(toolManager, args) {
  const verbose = args.includes('--verbose') || args.includes('-v');
  const noClear = args.includes('--no-clear');
  
  console.log('🔄 Loading vectors from perspectives (with clear)...');
  
  const result = await toolManager.loadVectors({ 
    verbose, 
    clearFirst: !noClear // Default to clearing unless --no-clear is specified
  });
  
  console.log(`✅ Loaded ${result.loaded} vectors`);
  
  if (result.cleared > 0) {
    console.log(`🧹 Cleared ${result.cleared} existing vectors`);
  }
  
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

async function handleAdd(toolManager, args) {
  const verbose = args.includes('--verbose') || args.includes('-v');
  const complete = args.includes('--complete') || args.includes('-c');
  const modulePath = args.find(arg => !arg.startsWith('--'));
  
  if (!modulePath) {
    console.error('❌ Module path required');
    console.error('Usage: node scripts/manage.js add <module-path> [--complete] [--verbose]');
    process.exit(1);
  }
  
  try {
    // Get ToolRegistry singleton for addModule methods
    const { getToolRegistry } = await import('../src/index.js');
    const toolRegistry = await getToolRegistry();
    
    if (complete) {
      console.log(`🔄 Adding module with complete pipeline: ${modulePath}`);
      
      const result = await toolRegistry.addModuleComplete(modulePath, {
        generatePerspectives: true,
        generateEmbeddings: true,
        indexVectors: true,
        verbose
      });
      
      if (result.success) {
        console.log(`✅ Module added successfully: ${result.module.moduleName}`);
        console.log(`   Tools: ${result.module.toolCount}`);
        
        if (result.perspectives) {
          console.log(`   Perspectives: ${result.perspectives.generated} generated`);
        }
        
        if (result.embeddings) {
          console.log(`   Embeddings: ${result.embeddings.embedded} embedded`);
        }
        
        if (result.vectors) {
          console.log(`   Vectors: ${result.vectors.indexed} indexed`);
        }
        
        console.log('\n📊 Pipeline Steps:');
        result.steps.forEach(step => {
          const status = step.success ? '✅' : '❌';
          console.log(`   ${status} ${step.name}`);
        });
        
      } else {
        console.error(`❌ Module addition failed`);
        if (result.errors?.length > 0) {
          console.error('Errors:');
          result.errors.forEach(error => {
            console.error(`  - ${error}`);
          });
        }
        process.exit(1);
      }
      
    } else {
      console.log(`🔄 Adding module: ${modulePath}`);
      
      const result = await toolRegistry.addModule(modulePath, { verbose });
      
      if (result.success) {
        console.log(`✅ Module added: ${result.moduleName}`);
        console.log(`   Tools: ${result.toolCount}`);
        console.log(`   Module ID: ${result.moduleId}`);
        
        if (result.alreadyExists) {
          console.log('   Status: Already existed in database');
        } else {
          console.log('   Status: Newly discovered and added');
        }
        
        console.log('\n💡 To add perspectives, embeddings, and vectors, use --complete flag');
        
      } else {
        console.error(`❌ Module addition failed: ${result.error}`);
        process.exit(1);
      }
    }
    
  } catch (error) {
    console.error(`❌ Error adding module: ${error.message}`);
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

async function testSemanticSearchFunctionality(toolManager, verbose = false) {
  try {
    // Get the ToolRegistry to access database operations
    const { getToolRegistry } = await import('../src/index.js');
    const toolRegistry = await getToolRegistry();
    
    // Get a sample perspective from the database to use as test query
    const samplePerspective = await getSamplePerspective(toolRegistry);
    
    if (!samplePerspective) {
      console.log('  ⚠️  No perspectives found in database');
      return;
    }
    
    const testQuery = samplePerspective.content;
    const expectedToolName = samplePerspective.tool_name;
    
    // Perform semantic search (suppress all output during search)
    const originalLog = console.log;
    const originalInfo = console.info;
    const originalWarn = console.warn;
    const originalError = console.error;
    
    console.log = () => {};
    console.info = () => {};
    console.warn = () => {};
    console.error = () => {};
    
    const searchResults = await toolManager.testSemanticSearch([testQuery], { limit: 3 });
    
    // Restore console methods
    console.log = originalLog;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
    
    if (!searchResults || !searchResults.results || searchResults.results.length === 0) {
      console.log('  ❌ Search failed or no results');
      return;
    }
    
    const queryResult = searchResults.results[0];
    const topResult = queryResult.topResult;
    
    if (!topResult) {
      console.log('  ❌ No top result found');
      return;
    }
    
    // Get the actual tool to show its description
    let toolDescription = 'No description available';
    try {
      const tool = await toolRegistry.getTool(topResult.name);
      if (tool && tool.description) {
        toolDescription = tool.description;
      }
    } catch (error) {
      // Fallback to topResult description if available
      if (topResult.description) {
        toolDescription = topResult.description;
      }
    }
    
    // Check if the search found the expected tool
    const foundExpectedTool = topResult.name === expectedToolName;
    const confidence = (topResult.similarity * 100).toFixed(1);
    
    console.log(`  Perspective: "${testQuery}"`);
    console.log(`  Found Tool: ${topResult.name}`);
    console.log(`  Description: ${toolDescription}`);
    console.log(`  Confidence: ${confidence}%`);
    console.log(`  Match: ${foundExpectedTool ? '✅ Correct' : '❌ Incorrect'}`);
    
    // Try to get and execute the found tool
    if (foundExpectedTool) {
      await testToolExecution(toolManager, topResult.name, verbose);
    }
    
  } catch (error) {
    console.log(`  ❌ Test failed: ${error.message}`);
    if (verbose) {
      console.log(`  Error details: ${error.stack}`);
    }
  }
}

async function getSamplePerspective(toolRegistry) {
  try {
    // Access the toolRepository through serviceOrchestrator to get perspectives with embeddings
    const serviceOrchestrator = toolRegistry.serviceOrchestrator;
    const toolRepository = serviceOrchestrator.systemService.databaseService;
    
    // Get all perspectives with embeddings
    const perspectives = await toolRepository.getPerspectivesWithEmbeddings();
    
    if (!perspectives || perspectives.length === 0) {
      return null;
    }
    
    // Return the first perspective as our sample
    return perspectives[0];
  } catch (error) {
    console.log(`  ⚠️  Failed to get sample perspective: ${error.message}`);
    return null;
  }
}

async function testToolExecution(toolManager, toolName, verbose = false) {
  try {
    console.log(`  Tool Execution Test:`);
    
    // Get the tool
    const { getToolRegistry } = await import('../src/index.js');
    const toolRegistry = await getToolRegistry();
    const tool = await toolRegistry.getTool(toolName);
    
    if (!tool) {
      console.log(`    ❌ Tool not found: ${toolName}`);
      return;
    }
    
    console.log(`    Tool Found: ✅ ${tool.name}`);
    console.log(`    Has Execute Method: ${typeof tool.execute === 'function' ? '✅' : '❌'}`);
    
    if (typeof tool.execute === 'function') {
      // Try to execute with minimal/safe parameters based on tool name
      let testParams = getTestParametersForTool(toolName);
      
      if (testParams) {
        if (verbose) {
          console.log(`    Test Parameters: ${JSON.stringify(testParams)}`);
        }
        
        const result = await tool.execute(testParams);
        const executionSuccess = result && (result.success !== false);
        
        console.log(`    Execution: ${executionSuccess ? '✅ Success' : '❌ Failed'}`);
        
        if (verbose && result) {
          console.log(`    Result: ${JSON.stringify(result, null, 2).substring(0, 200)}...`);
        }
      } else {
        console.log(`    ⚠️  No safe test parameters available for ${toolName}`);
      }
    }
    
  } catch (error) {
    console.log(`    ❌ Execution test failed: ${error.message}`);
  }
}

function getTestParametersForTool(toolName) {
  // Safe test parameters for common tools
  const safeTestParams = {
    // Calculator tools
    'calculator': { expression: '2 + 2' },
    'add': { a: 2, b: 3 },
    'subtract': { a: 5, b: 2 },
    'multiply': { a: 3, b: 4 },
    'divide': { a: 10, b: 2 },
    
    // JSON tools
    'json_parse': { jsonString: '{"test": "value"}' },
    'json_stringify': { object: { test: 'value' } },
    
    // Text tools
    'text_length': { text: 'hello world' },
    'text_uppercase': { text: 'hello' },
    'text_lowercase': { text: 'HELLO' },
    
    // Utility tools
    'uuid_generate': {},
    'timestamp': {},
    'random_number': { min: 1, max: 10 },
    
    // Code analysis tools
    'validate_javascript': { code: 'const x = 42; console.log(x);' },
    'lint_javascript': { code: 'const unused = 1;' },
    'format_javascript': { code: 'const x=42;console.log(x)' }
  };
  
  return safeTestParams[toolName] || null;
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
  add <module-path> [--complete] Add single module incrementally
  perspectives [--verbose]     Generate perspectives for tools
  embeddings [--verbose]       Generate embeddings for perspectives
  vectors [--verbose]          Index vectors in vector store
  vectors:load [--verbose]     Load vectors from perspectives (clears first)
  pipeline [--verbose]         Run complete initialization pipeline
  search <query> [--limit N]   Test semantic search
  verify [--verbose]           Verify system integrity

Options:
  --verbose, -v               Show detailed output
  --force                     Skip confirmation prompts
  --path <path>               Custom search path for discovery
  --module <name>             Specific module name for loading
  --complete, -c              Run complete pipeline for add command
  --all                       Include registry in clear operations
  --limit <N>                 Limit search results (default: 5)

Examples:
  node scripts/manage.js status
  node scripts/manage.js discover --verbose
  node scripts/manage.js clear --all
  node scripts/manage.js load --module Calculator
  node scripts/manage.js add ./packages/modules/new-module/NewModule.js
  node scripts/manage.js add ./packages/modules/new-module/NewModule.js --complete
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