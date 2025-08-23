#!/usr/bin/env node

/**
 * Tool Registry Manager Script
 * 
 * Complete pipeline management using LoadingManager only.
 * Provides comprehensive management of the Legion tool registry system.
 * 
 * ARCHITECTURE: Only uses LoadingManager - NO direct database operations
 * 
 * Usage:
 *   node manager.js discover [--verbose]                    # Discover all modules
 *   node manager.js load [--module <name>] [--verbose]      # Load modules to database
 *   node manager.js clear [--module <name>] [--verbose]     # Clear database collections
 *   node manager.js pipeline [--clear] [--verbose]          # Run full pipeline
 *   node manager.js status [--verbose]                      # Check pipeline status
 */

import { ToolRegistry } from '../src/integration/ToolRegistry.js';
import chalk from 'chalk';

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  const options = {
    module: null,
    verbose: false,
    clear: false,
    confirm: false
  };
  
  // Parse flags
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--clear') {
      options.clear = true;
    } else if (arg === '--confirm') {
      options.confirm = true;
    } else if (arg === '--module' || arg === '-m') {
      options.module = args[i + 1];
      i++; // Skip next arg as it's the module name
    }
  }
  
  return { command, options };
}

/**
 * Display help information
 */
function showHelp() {
  console.log(chalk.cyan.bold('\n🚀 Tool Registry Manager\n'));
  console.log(chalk.white('Complete pipeline management using LoadingManager only.\n'));
  
  console.log(chalk.yellow.bold('Commands:'));
  console.log(chalk.white('  discover                     Discover all modules in repository'));
  console.log(chalk.white('  load                         Load modules to database'));
  console.log(chalk.white('  clear                        Clear database collections (preserves module_registry)'));
  console.log(chalk.white('  pipeline                     Run full pipeline (discover, load, perspectives, vectors)'));
  console.log(chalk.white('  status                       Check pipeline status'));
  console.log(chalk.white('  help                         Show this help'));
  
  console.log(chalk.yellow.bold('\nOptions:'));
  console.log(chalk.white('  --module <name>              Target specific module'));
  console.log(chalk.white('  --verbose, -v                Verbose output'));
  console.log(chalk.white('  --clear                      Clear before loading (pipeline only)'));
  console.log(chalk.white('  --confirm                    Confirm destructive operations'));
  
  console.log(chalk.yellow.bold('\nExamples:'));
  console.log(chalk.gray('  node manager.js discover --verbose'));
  console.log(chalk.gray('  node manager.js load --module calculator'));
  console.log(chalk.gray('  node manager.js clear --module calculator --verbose'));
  console.log(chalk.gray('  node manager.js clear --confirm --verbose'));
  console.log(chalk.gray('  node manager.js pipeline --clear --verbose'));
  console.log(chalk.gray('  node manager.js status --verbose'));
}

/**
 * Create ToolRegistry instance with error handling
 */
async function createToolRegistry(options = {}) {
  try {
    const registry = new ToolRegistry();
    await registry.initialize();
    return registry;
  } catch (error) {
    console.error(chalk.red('❌ Failed to initialize ToolRegistry:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Discover command - Discover all modules in repository
 */
async function discoverCommand(options) {
  console.log(chalk.blue.bold('\n🔍 Discover Modules\n'));
  
  const registry = await createToolRegistry(options);
  
  try {
    const loader = await registry.getLoader();
    
    if (options.verbose) {
      console.log(chalk.cyan('Starting module discovery...'));
    }
    
    const result = await loader.discoverModules();
    
    console.log(chalk.green('✅ Module discovery completed successfully'));
    console.log(chalk.white(`   Modules discovered: ${result.stats.discovered}`));
    console.log(chalk.white(`   Modules validated: ${result.stats.validated}`));
    console.log(chalk.white(`   Modules failed: ${result.stats.failed}`));
    
    if (options.verbose && result.stats.failed > 0) {
      console.log(chalk.yellow('\n⚠️ Failed modules:'));
      result.failed.forEach(failure => {
        console.log(chalk.red(`  - ${failure.name}: ${failure.error}`));
      });
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Discovery failed:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    throw error;
  }
}

/**
 * Load command - Load modules to database
 */
async function loadCommand(options) {
  console.log(chalk.blue.bold('\n📦 Load Modules\n'));
  
  const registry = await createToolRegistry(options);
  
  try {
    if (options.module) {
      console.log(chalk.cyan(`Loading module: ${options.module}`));
      const result = await registry.loadModule(options.module, {
        verbose: options.verbose
      });
      
      console.log(chalk.green(`✅ Module '${options.module}' loaded successfully`));
      console.log(chalk.white(`   Tools loaded: ${result.toolsLoaded}`));
    } else {
      console.log(chalk.cyan('Loading all modules'));
      const result = await registry.loadAllModules({
        verbose: options.verbose
      });
      
      console.log(chalk.green('✅ All modules loaded successfully'));
      console.log(chalk.white(`   Modules loaded: ${result.modulesLoaded}`));
      console.log(chalk.white(`   Tools loaded: ${result.toolsLoaded}`));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Load operation failed:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    throw error;
  }
}

/**
 * Clear command - Clear database collections (preserves module_registry)
 */
async function clearCommand(options) {
  console.log(chalk.blue.bold('\n🧹 Clear Database Collections\n'));
  
  // Safety check for destructive operations
  if (!options.module && !options.confirm) {
    console.log(chalk.yellow('⚠️  This will clear ALL collections (except module_registry)'));
    console.log(chalk.yellow('   Use --confirm flag to proceed with clearing all data'));
    console.log(chalk.gray('   Or use --module <name> to clear a specific module'));
    return;
  }
  
  const registry = await createToolRegistry(options);
  
  try {
    let result;
    
    if (options.module) {
      console.log(chalk.cyan(`Clearing module: ${options.module}`));
      result = await registry.clearModule(options.module, {
        verbose: options.verbose
      });
      
      console.log(chalk.green(`✅ Module '${options.module}' cleared successfully`));
      console.log(chalk.white(`   Records cleared: ${result.recordsCleared}`));
    } else {
      console.log(chalk.cyan('Clearing all modules (preserving module_registry)'));
      result = await registry.clearAllModules({
        verbose: options.verbose
      });
      
      console.log(chalk.green('✅ All modules cleared successfully'));
      console.log(chalk.white(`   Records cleared: ${result.recordsCleared}`));
    }
    
    console.log(chalk.blue.bold('\n📊 Clear Summary:'));
    console.log('═'.repeat(60));
    console.log(chalk.white(`Target: ${options.module || 'all modules'}`));
    console.log(chalk.white(`Records cleared: ${result.recordsCleared}`));
    console.log(chalk.white(`Success: ${result.success ? '✅ Yes' : '❌ No'}`));
    console.log(chalk.gray('Note: module_registry collection is preserved as designed'));
    
  } catch (error) {
    console.error(chalk.red('❌ Clear operation failed:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    throw error;
  }
}

/**
 * Pipeline command - Run full pipeline
 */
async function pipelineCommand(options) {
  console.log(chalk.blue.bold('\n🚀 Full Pipeline Execution\n'));
  
  const registry = await createToolRegistry(options);
  
  try {
    const loader = await registry.getLoader();
    
    const pipelineOptions = {
      module: options.module || null,
      clearFirst: options.clear,
      includePerspectives: true,
      includeVectors: true,
      verbose: options.verbose
    };
    
    if (options.module) {
      console.log(chalk.cyan(`Running pipeline for module: ${options.module}`));
    } else {
      console.log(chalk.cyan('Running full pipeline for all modules'));
    }
    
    const result = await loader.runFullPipeline(pipelineOptions);
    
    console.log(chalk.green('✅ Pipeline executed successfully'));
    console.log(chalk.blue.bold('\n📊 Pipeline Summary:'));
    console.log('═'.repeat(60));
    console.log(chalk.white(`Target: ${options.module || 'all modules'}`));
    console.log(chalk.white(`Success: ${result.success ? '✅ Yes' : '❌ No'}`));
    console.log(chalk.white(`Total time: ${(result.totalTime / 1000).toFixed(2)}s`));
    
    if (result.counts) {
      console.log(chalk.white(`Modules: ${result.counts.modules || 0}`));
      console.log(chalk.white(`Tools: ${result.counts.tools || 0}`));
      console.log(chalk.white(`Perspectives: ${result.counts.perspectives || 0}`));
      console.log(chalk.white(`Vectors: ${result.counts.vectors || 0}`));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Pipeline failed:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    throw error;
  }
}

/**
 * Status command - Check pipeline status
 */
async function statusCommand(options) {
  console.log(chalk.blue.bold('\n📊 Pipeline Status\n'));
  
  const registry = await createToolRegistry(options);
  
  try {
    const loader = await registry.getLoader();
    const state = loader.getPipelineState();
    const progress = await loader.getPipelineProgress();
    
    console.log(chalk.yellow.bold('Current Pipeline State:'));
    console.log('─'.repeat(40));
    console.log(chalk.white(`Cleared: ${state.cleared ? '✅ Yes' : '❌ No'}`));
    console.log(chalk.white(`Modules Loaded: ${state.modulesLoaded ? '✅ Yes' : '❌ No'}`));
    console.log(chalk.white(`Perspectives Generated: ${state.perspectivesGenerated ? '✅ Yes' : '❌ No'}`));
    console.log(chalk.white(`Vectors Indexed: ${state.vectorsIndexed ? '✅ Yes' : '❌ No'}`));
    console.log(chalk.white(`Complete: ${state.isComplete ? '✅ Yes' : '❌ No'}`));
    
    if (state.lastModuleFilter) {
      console.log(chalk.white(`Last Module Filter: ${state.lastModuleFilter}`));
    }
    
    console.log(chalk.yellow.bold('\nCounts:'));
    console.log('─'.repeat(40));
    console.log(chalk.white(`Modules: ${state.moduleCount}`));
    console.log(chalk.white(`Tools: ${state.toolCount}`));
    console.log(chalk.white(`Perspectives: ${state.perspectiveCount}`));
    console.log(chalk.white(`Vectors: ${state.vectorCount}`));
    
    if (state.hasErrors) {
      console.log(chalk.yellow.bold('\n⚠️ Errors:'));
      console.log('─'.repeat(40));
      state.errors.forEach(error => {
        console.log(chalk.red(`  - ${error}`));
      });
    }
    
    if (progress && options.verbose) {
      console.log(chalk.yellow.bold('\nDetailed Progress:'));
      console.log('─'.repeat(40));
      console.log(JSON.stringify(progress, null, 2));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Status check failed:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    throw error;
  }
}

/**
 * Main execution function
 */
async function main() {
  const { command, options } = parseArgs();
  let registry = null;
  
  try {
    // Track if we need to cleanup registry
    const needsRegistry = ['discover', 'load', 'clear', 'pipeline', 'status'].includes(command);
    
    switch (command) {
      case 'discover':
        registry = await ToolRegistry.getInstance();
        await discoverCommand(options);
        break;
      case 'load':
        registry = await ToolRegistry.getInstance();
        await loadCommand(options);
        break;
      case 'clear':
        registry = await ToolRegistry.getInstance();
        await clearCommand(options);
        break;
      case 'pipeline':
        registry = await ToolRegistry.getInstance();
        await pipelineCommand(options);
        break;
      case 'status':
        registry = await ToolRegistry.getInstance();
        await statusCommand(options);
        break;
      case 'help':
      default:
        showHelp();
        break;
    }
    
    // Clean up registry connections
    if (registry) {
      await registry.cleanup();
    }
    
    // Exit successfully
    process.exit(0);
  } catch (error) {
    console.error(chalk.red('\n💥 Operation failed:'), error.message);
    
    // Try to cleanup even on error
    if (registry) {
      try {
        await registry.cleanup();
      } catch (cleanupError) {
        console.error(chalk.yellow('⚠️ Cleanup failed:'), cleanupError.message);
      }
    }
    
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error(chalk.red('💥 Unexpected error:'), error.message);
  process.exit(1);
});