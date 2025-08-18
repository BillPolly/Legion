#!/usr/bin/env node

/**
 * Full Loading Pipeline Script
 * 
 * Runs the complete module loading pipeline:
 * 1. Discover all modules in the repository
 * 2. Load modules from database
 * 3. Generate perspectives for semantic search
 * 4. Index vectors to Qdrant
 */

import { LoadingManager } from '../src/loading/LoadingManager.js';
import { ResourceManager } from '@legion/resource-manager';
import chalk from 'chalk';

async function runFullPipeline() {
  console.log(chalk.blue.bold('\n🚀 Full Loading Pipeline\n'));
  console.log(chalk.gray('This will run the complete module loading pipeline:'));
  console.log(chalk.gray('1. Discover all modules'));
  console.log(chalk.gray('2. Load modules to database'));
  console.log(chalk.gray('3. Generate perspectives'));
  console.log(chalk.gray('4. Index vectors to Qdrant\n'));
  
  const startTime = Date.now();
  
  try {
    // Initialize ResourceManager
    console.log(chalk.blue('📦 Initializing ResourceManager...'));
    const resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    // Create LoadingManager
    console.log(chalk.blue('📦 Creating LoadingManager...'));
    const loadingManager = new LoadingManager({
      verbose: true,
      resourceManager
    });
    
    await loadingManager.initialize();
    
    // Step 1: Discover modules
    console.log(chalk.blue.bold('\n🔍 Step 1: Module Discovery\n'));
    const discoveryResult = await loadingManager.discoverModules();
    console.log(chalk.green(`✅ Discovered ${discoveryResult.stats.discovered} modules`));
    console.log(chalk.green(`   Registered: ${discoveryResult.stats.registered}`));
    console.log(chalk.green(`   Updated: ${discoveryResult.stats.updated}`));
    
    // Step 2: Clear databases (optional)
    console.log(chalk.blue.bold('\n🧹 Step 2: Clear Databases\n'));
    const clearConfirm = process.argv.includes('--clear');
    const clearModules = process.argv.includes('--clear-modules');
    
    if (clearConfirm) {
      const clearResult = await loadingManager.clearForReload({
        clearVectors: true,
        clearModules: clearModules // Only clear modules if explicitly requested
      });
      console.log(chalk.green(`✅ Cleared ${clearResult.totalCleared} records`));
      if (!clearModules) {
        console.log(chalk.green('   Module discovery preserved'));
      }
    } else {
      console.log(chalk.yellow('⏭️ Skipping clear (use --clear flag to clear databases)'));
    }
    
    // Step 3: Load modules
    console.log(chalk.blue.bold('\n📦 Step 3: Load Modules\n'));
    const loadResult = await loadingManager.loadModules();
    console.log(chalk.green(`✅ Loaded ${loadResult.modulesLoaded} modules`));
    console.log(chalk.green(`   Tools extracted: ${loadResult.toolsAdded}`));
    
    // Step 4: Generate perspectives (optional)
    const skipPerspectives = process.argv.includes('--skip-perspectives');
    
    if (!skipPerspectives) {
      console.log(chalk.blue.bold('\n📝 Step 4: Generate Perspectives\n'));
      
      try {
        const perspectiveResult = await loadingManager.generatePerspectives();
        console.log(chalk.green(`✅ Generated ${perspectiveResult.perspectivesGenerated} perspectives`));
        console.log(chalk.green(`   Tools processed: ${perspectiveResult.toolsProcessed}`));
        if (perspectiveResult.toolsFailed > 0) {
          console.log(chalk.yellow(`   Tools failed: ${perspectiveResult.toolsFailed}`));
        }
      } catch (error) {
        console.log(chalk.red(`❌ Perspective generation failed: ${error.message}`));
        console.log(chalk.yellow('   This is expected if Qdrant is not running'));
      }
    } else {
      console.log(chalk.yellow('⏭️ Skipping perspective generation (--skip-perspectives flag set)'));
    }
    
    // Step 5: Index vectors (optional)
    const skipVectors = process.argv.includes('--skip-vectors');
    
    if (!skipVectors && !skipPerspectives) {
      console.log(chalk.blue.bold('\n🚀 Step 5: Index Vectors\n'));
      
      try {
        const vectorResult = await loadingManager.indexVectors();
        console.log(chalk.green(`✅ Indexed ${vectorResult.perspectivesIndexed} vectors`));
        console.log(chalk.green(`   Tools processed: ${vectorResult.toolsProcessed}`));
      } catch (error) {
        console.log(chalk.red(`❌ Vector indexing failed: ${error.message}`));
        console.log(chalk.yellow('   This is expected if perspectives were not generated'));
      }
    } else {
      console.log(chalk.yellow('⏭️ Skipping vector indexing'));
    }
    
    // Get pipeline state
    const pipelineState = loadingManager.getPipelineState();
    
    // Summary
    const totalTime = Date.now() - startTime;
    console.log(chalk.blue.bold('\n📊 Pipeline Summary'));
    console.log('═'.repeat(60));
    console.log(chalk.white(`Total time: ${(totalTime / 1000).toFixed(2)}s`));
    console.log(chalk.white(`Modules discovered: ${discoveryResult.stats.discovered}`));
    console.log(chalk.white(`Modules loaded: ${pipelineState.moduleCount}`));
    console.log(chalk.white(`Tools added: ${pipelineState.toolCount}`));
    
    if (!skipPerspectives) {
      console.log(chalk.white(`Perspectives generated: ${pipelineState.perspectiveCount}`));
    }
    
    if (!skipVectors && !skipPerspectives) {
      console.log(chalk.white(`Vectors indexed: ${pipelineState.vectorCount}`));
    }
    
    // Show errors if any
    if (pipelineState.errors.length > 0) {
      console.log(chalk.yellow('\n⚠️ Warnings:'));
      pipelineState.errors.forEach(err => {
        console.log(chalk.yellow(`   - ${err}`));
      });
    }
    
    // Show completion status
    console.log(chalk.blue.bold('\n✅ Pipeline Status'));
    console.log(chalk.green(`   Database cleared: ${pipelineState.cleared ? '✅' : '⏭️'}`));
    console.log(chalk.green(`   Modules loaded: ${pipelineState.modulesLoaded ? '✅' : '❌'}`));
    console.log(chalk.green(`   Perspectives generated: ${pipelineState.perspectivesGenerated ? '✅' : '⏭️'}`));
    console.log(chalk.green(`   Vectors indexed: ${pipelineState.vectorsIndexed ? '✅' : '⏭️'}`));
    
    // Cleanup
    await loadingManager.close();
    
    console.log(chalk.green.bold('\n✅ Full pipeline completed successfully!\n'));
    
    // Usage hints
    console.log(chalk.cyan('💡 Usage hints:'));
    console.log(chalk.gray('   • Use --clear flag to clear tools/perspectives (preserves modules)'));
    console.log(chalk.gray('   • Use --clear-modules flag with --clear to also clear module discovery'));
    console.log(chalk.gray('   • Use --skip-perspectives to skip perspective generation'));
    console.log(chalk.gray('   • Use --skip-vectors to skip vector indexing'));
    console.log(chalk.gray('   • Perspectives and vectors require Qdrant to be running\n'));
    
    process.exit(0);
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Pipeline failed:'), error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the pipeline
runFullPipeline().catch(console.error);