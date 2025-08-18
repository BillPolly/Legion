#!/usr/bin/env node

/**
 * Tool Registry Manager Script
 * 
 * Comprehensive management script for the tool registry system.
 * Replaces multiple individual scripts with a single, capable interface.
 * 
 * ARCHITECTURE: Only uses LoadingManager - NO direct database operations
 * 
 * Usage:
 *   node manager.js discover [--verbose]                      # Discover modules
 *   node manager.js load [--module <name>] [--verbose]        # Load modules
 *   node manager.js clear [--modules] [--vectors] [--confirm] # Clear data
 *   node manager.js pipeline [options]                        # Full pipeline
 * 
 * Pipeline Options:
 *   --clear               Clear tools/perspectives before loading
 *   --clear-modules       Also clear module discovery
 *   --skip-perspectives   Skip perspective generation
 *   --skip-vectors        Skip vector indexing
 *   --module <name>       Process single module only
 *   --verbose             Show detailed output
 *   --confirm             Skip confirmation prompts
 */

import { LoadingManager } from '../src/loading/LoadingManager.js';
import { ResourceManager } from '@legion/resource-manager';
import chalk from 'chalk';
import readline from 'readline';

/**
 * Ask user for confirmation
 */
async function askConfirmation(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

/**
 * Parse command line arguments into structured options
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  const options = {
    command,
    verbose: args.includes('--verbose') || args.includes('-v'),
    confirm: args.includes('--confirm'),
    module: null,
    // Clear options
    clearModules: args.includes('--clear-modules'),
    clearVectors: args.includes('--clear-vectors') || args.includes('--clear'),
    clear: args.includes('--clear'),
    // Pipeline options
    skipPerspectives: args.includes('--skip-perspectives'),
    skipVectors: args.includes('--skip-vectors')
  };
  
  // Extract module name
  const moduleIndex = args.indexOf('--module');
  if (moduleIndex !== -1 && args[moduleIndex + 1]) {
    options.module = args[moduleIndex + 1];
  }
  
  return options;
}

/**
 * Show help information
 */
function showHelp() {
  console.log(chalk.blue.bold('\nTool Registry Manager\n'));
  console.log(chalk.gray('Comprehensive management script for the tool registry system.'));
  console.log(chalk.gray('Only uses LoadingManager - enforces proper architecture.\n'));
  
  console.log(chalk.cyan('Commands:'));
  console.log(chalk.white('  discover                     Discover all modules in repository'));
  console.log(chalk.white('  load                         Load modules and populate database'));
  console.log(chalk.white('  clear                        Clear database collections'));
  console.log(chalk.white('  pipeline                     Run complete loading pipeline'));
  console.log(chalk.white('  status                       Show pipeline status'));
  console.log(chalk.white('  help                         Show this help message\n'));
  
  console.log(chalk.cyan('Global Options:'));
  console.log(chalk.white('  --module <name>              Process single module only'));
  console.log(chalk.white('  --verbose, -v                Show detailed output'));
  console.log(chalk.white('  --confirm                    Skip confirmation prompts\n'));
  
  console.log(chalk.cyan('Clear Options:'));
  console.log(chalk.white('  --clear                      Clear tools and perspectives'));
  console.log(chalk.white('  --clear-modules              Also clear module discovery'));
  console.log(chalk.white('  --clear-vectors              Clear vector indexes\n'));
  
  console.log(chalk.cyan('Pipeline Options:'));
  console.log(chalk.white('  --skip-perspectives          Skip perspective generation'));
  console.log(chalk.white('  --skip-vectors               Skip vector indexing\n'));
  
  console.log(chalk.cyan('Examples:'));
  console.log(chalk.gray('  node manager.js discover --verbose'));
  console.log(chalk.gray('  node manager.js load --module file'));
  console.log(chalk.gray('  node manager.js clear --clear --confirm'));
  console.log(chalk.gray('  node manager.js pipeline --clear --verbose'));
  console.log(chalk.gray('  node manager.js pipeline --module calculator --skip-vectors\n'));
}

/**
 * Initialize LoadingManager with options
 */
async function createLoadingManager(options) {
  const resourceManager = ResourceManager.getInstance();
  await resourceManager.initialize();
  
  const loadingManager = new LoadingManager({
    verbose: options.verbose,
    resourceManager
  });
  
  await loadingManager.initialize();
  return loadingManager;
}

/**
 * Discover modules command
 */
async function discoverCommand(options) {
  console.log(chalk.blue.bold('\n🔍 Module Discovery\n'));
  
  const loadingManager = await createLoadingManager(options);
  
  try {
    const result = await loadingManager.discoverModules();
    
    console.log(chalk.green(`✅ Discovery completed successfully!`));
    console.log(chalk.white(`   Modules discovered: ${result.stats.discovered}`));
    console.log(chalk.white(`   Modules registered: ${result.stats.registered}`));
    console.log(chalk.white(`   Modules updated: ${result.stats.updated}`));
    
    if (result.stats.errors > 0) {
      console.log(chalk.yellow(`   Errors: ${result.stats.errors}`));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Discovery failed:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    throw error;
  } finally {
    await loadingManager.close();
  }
}

/**
 * Load modules command
 */
async function loadCommand(options) {
  console.log(chalk.blue.bold('\n📦 Module Loading\n'));
  
  if (options.module) {
    console.log(chalk.cyan(`Target: Single module (${options.module})`));
  } else {
    console.log(chalk.cyan('Target: All discovered modules'));
  }
  
  const loadingManager = await createLoadingManager(options);
  
  try {
    const result = await loadingManager.loadModules(options.module ? { module: options.module } : {});
    
    console.log(chalk.green(`✅ Loading completed successfully!`));
    console.log(chalk.white(`   Modules loaded: ${result.modulesLoaded}`));
    console.log(chalk.white(`   Tools extracted: ${result.toolsAdded}`));
    
  } catch (error) {
    console.error(chalk.red('❌ Loading failed:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    throw error;
  } finally {
    await loadingManager.close();
  }
}

/**
 * Clear data command
 */
async function clearCommand(options) {
  console.log(chalk.blue.bold('\n🧹 Database Clear\n'));
  
  const clearOptions = {
    clearVectors: options.clearVectors || options.clear,
    clearModules: options.clearModules
  };
  
  // Show what will be cleared
  console.log(chalk.cyan('Clear options:'));
  console.log(chalk.white(`   Tools and perspectives: ${clearOptions.clearVectors ? '✅' : '⏭️'}`));
  console.log(chalk.white(`   Module discovery: ${clearOptions.clearModules ? '✅' : '⏭️'}`));
  console.log(chalk.white(`   Vector indexes: ${clearOptions.clearVectors ? '✅' : '⏭️'}`));
  console.log('');
  
  // Confirmation
  if (!options.confirm) {
    const confirmed = await askConfirmation('⚠️  This will permanently delete data. Continue? (y/N): ');
    if (!confirmed) {
      console.log(chalk.yellow('Operation cancelled.'));
      return;
    }
  }
  
  const loadingManager = await createLoadingManager(options);
  
  try {
    const result = await loadingManager.clearForReload(clearOptions);
    
    console.log(chalk.green(`✅ Clear completed successfully!`));
    console.log(chalk.white(`   Records cleared: ${result.totalCleared}`));
    
    if (!clearOptions.clearModules) {
      console.log(chalk.cyan('   Module discovery preserved'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Clear failed:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    throw error;
  } finally {
    await loadingManager.close();
  }
}

/**
 * Full pipeline command
 */
async function pipelineCommand(options) {
  console.log(chalk.blue.bold('\n🚀 Full Loading Pipeline\n'));
  console.log(chalk.gray('Running complete module loading pipeline:'));
  console.log(chalk.gray('1. Discover modules'));
  console.log(chalk.gray('2. Load modules to database'));
  console.log(chalk.gray('3. Generate perspectives'));
  console.log(chalk.gray('4. Index vectors to Qdrant\n'));
  
  const startTime = Date.now();
  const loadingManager = await createLoadingManager(options);
  
  try {
    // Step 1: Discovery
    console.log(chalk.blue.bold('🔍 Step 1: Module Discovery\n'));
    const discoveryResult = await loadingManager.discoverModules();
    console.log(chalk.green(`✅ Discovered ${discoveryResult.stats.discovered} modules`));
    console.log(chalk.green(`   Registered: ${discoveryResult.stats.registered}`));
    console.log(chalk.green(`   Updated: ${discoveryResult.stats.updated}\n`));
    
    // Step 2: Clear (default: always clear vectors for consistency)
    console.log(chalk.blue.bold('🧹 Step 2: Clear Databases\n'));
    const clearResult = await loadingManager.clearForReload({
      clearVectors: true,  // Always clear vectors to prevent accumulation
      clearModules: options.clearModules
    });
    console.log(chalk.green(`✅ Cleared ${clearResult.totalCleared} records`));
    if (!options.clearModules) {
      console.log(chalk.green('   Module discovery preserved\n'));
    }
    
    // Step 3: Load modules
    console.log(chalk.blue.bold('📦 Step 3: Load Modules\n'));
    const loadResult = await loadingManager.loadModules(options.module ? { module: options.module } : {});
    console.log(chalk.green(`✅ Loaded ${loadResult.modulesLoaded} modules`));
    console.log(chalk.green(`   Tools extracted: ${loadResult.toolsAdded}\n`));
    
    // Step 4: Generate perspectives
    if (!options.skipPerspectives) {
      console.log(chalk.blue.bold('📝 Step 4: Generate Perspectives\n'));
      try {
        const perspectiveResult = await loadingManager.generatePerspectives(options.module ? { module: options.module } : {});
        console.log(chalk.green(`✅ Generated ${perspectiveResult.perspectivesGenerated} perspectives`));
        console.log(chalk.green(`   Tools processed: ${perspectiveResult.toolsProcessed}`));
        if (perspectiveResult.toolsFailed > 0) {
          console.log(chalk.yellow(`   Tools failed: ${perspectiveResult.toolsFailed}\n`));
        }
      } catch (error) {
        console.log(chalk.red(`❌ Perspective generation failed: ${error.message}`));
        console.log(chalk.yellow('   This is expected if LLM services are not available\n'));
      }
    } else {
      console.log(chalk.yellow('⏭️ Step 4: Skipping perspective generation (--skip-perspectives flag)\n'));
    }
    
    // Step 5: Index vectors
    if (!options.skipVectors && !options.skipPerspectives) {
      console.log(chalk.blue.bold('🚀 Step 5: Index Vectors\n'));
      try {
        const vectorResult = await loadingManager.indexVectors(options.module ? { module: options.module } : {});
        console.log(chalk.green(`✅ Indexed ${vectorResult.perspectivesIndexed} vectors`));
        console.log(chalk.green(`   Tools processed: ${vectorResult.toolsProcessed}\n`));
      } catch (error) {
        console.log(chalk.red(`❌ Vector indexing failed: ${error.message}`));
        console.log(chalk.yellow('   This is expected if Qdrant is not running\n'));
      }
    } else {
      console.log(chalk.yellow('⏭️ Step 5: Skipping vector indexing\n'));
    }
    
    // Summary
    const totalTime = Date.now() - startTime;
    const pipelineState = loadingManager.getPipelineState();
    
    console.log(chalk.blue.bold('📊 Pipeline Summary'));
    console.log('═'.repeat(60));
    console.log(chalk.white(`Total time: ${(totalTime / 1000).toFixed(2)}s`));
    console.log(chalk.white(`Modules discovered: ${discoveryResult.stats.discovered}`));
    console.log(chalk.white(`Modules loaded: ${pipelineState.moduleCount}`));
    console.log(chalk.white(`Tools extracted: ${pipelineState.toolCount}`));
    
    if (!options.skipPerspectives) {
      console.log(chalk.white(`Perspectives generated: ${pipelineState.perspectiveCount}`));
    }
    
    if (!options.skipVectors && !options.skipPerspectives) {
      console.log(chalk.white(`Vectors indexed: ${pipelineState.vectorCount}`));
    }
    
    // Show errors
    if (pipelineState.errors.length > 0) {
      console.log(chalk.yellow('\n⚠️ Warnings:'));
      pipelineState.errors.forEach(err => {
        console.log(chalk.yellow(`   - ${err}`));
      });
    }
    
    // Status indicators
    console.log(chalk.blue.bold('\n✅ Pipeline Status'));
    console.log(chalk.green(`   Database cleared: ${pipelineState.cleared ? '✅' : '⏭️'}`));
    console.log(chalk.green(`   Modules loaded: ${pipelineState.modulesLoaded ? '✅' : '❌'}`));
    console.log(chalk.green(`   Perspectives generated: ${pipelineState.perspectivesGenerated ? '✅' : '⏭️'}`));
    console.log(chalk.green(`   Vectors indexed: ${pipelineState.vectorsIndexed ? '✅' : '⏭️'}`));
    
    console.log(chalk.green.bold('\n✅ Full pipeline completed successfully!\n'));
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Pipeline failed:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    throw error;
  } finally {
    await loadingManager.close();
  }
}

/**
 * Status command
 */
async function statusCommand(options) {
  console.log(chalk.blue.bold('\n📊 Pipeline Status\n'));
  
  const loadingManager = await createLoadingManager(options);
  
  try {
    const pipelineState = loadingManager.getPipelineState();
    
    console.log(chalk.cyan('Current Pipeline State:'));
    console.log(chalk.white(`   Modules loaded: ${pipelineState.modulesLoaded ? '✅' : '❌'}`));
    console.log(chalk.white(`   Perspectives generated: ${pipelineState.perspectivesGenerated ? '✅' : '❌'}`));
    console.log(chalk.white(`   Vectors indexed: ${pipelineState.vectorsIndexed ? '✅' : '❌'}`));
    console.log(chalk.white(`   Database cleared: ${pipelineState.cleared ? '✅' : '❌'}`));
    console.log('');
    
    console.log(chalk.cyan('Counts:'));
    console.log(chalk.white(`   Modules: ${pipelineState.moduleCount}`));
    console.log(chalk.white(`   Tools: ${pipelineState.toolCount}`));
    console.log(chalk.white(`   Perspectives: ${pipelineState.perspectiveCount}`));
    console.log(chalk.white(`   Vectors: ${pipelineState.vectorCount}`));
    
    if (pipelineState.errors.length > 0) {
      console.log(chalk.yellow('\nErrors:'));
      pipelineState.errors.forEach(err => {
        console.log(chalk.yellow(`   - ${err}`));
      });
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Status check failed:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    throw error;
  } finally {
    await loadingManager.close();
  }
}

/**
 * Main function
 */
async function main() {
  try {
    const options = parseArgs();
    
    switch (options.command) {
      case 'discover':
        await discoverCommand(options);
        break;
        
      case 'load':
        await loadCommand(options);
        break;
        
      case 'clear':
        await clearCommand(options);
        break;
        
      case 'pipeline':
        await pipelineCommand(options);
        break;
        
      case 'status':
        await statusCommand(options);
        break;
        
      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;
        
      default:
        console.log(chalk.red(`Unknown command: ${options.command}`));
        console.log(chalk.gray('Use "node manager.js help" for available commands.'));
        process.exit(1);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Operation failed:'), error.message);
    if (process.argv.includes('--verbose')) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});