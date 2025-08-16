#!/usr/bin/env node

/**
 * Script to populate database with all modules/tools and verify counts
 * 
 * Demonstrates the new zero-configuration singleton pattern
 */

import toolRegistry from '../src/index.js';  // Import singleton instance
import chalk from 'chalk';

async function main() {
  console.log(chalk.blue.bold('\n🚀 Database Population and Verification Script\n'));
  console.log(chalk.gray('Using zero-configuration ToolRegistry singleton\n'));

  try {
    // Get the loader from the singleton ToolRegistry
    console.log(chalk.blue('📦 Getting loader from ToolRegistry singleton...'));
    const loader = await toolRegistry.getLoader();
    loader.verbose = true;  // Enable verbose output for this script
    
    // Run the full pipeline
    console.log(chalk.blue('\n🔄 Running full loading pipeline...\n'));
    const result = await loader.fullPipeline({
      clearFirst: true,
      includePerspectives: false,  // Skip perspectives for speed
      includeVectors: false        // Skip vectors for speed
    });
    
    // Display results
    console.log(chalk.green.bold('\n✅ Population Complete!\n'));
    console.log(chalk.white('📊 Results:'));
    console.log(chalk.white(`   • Modules loaded: ${result.loadResult?.modulesLoaded || 0}`));
    console.log(chalk.white(`   • Tools added: ${result.loadResult?.toolsAdded || 0}`));
    console.log(chalk.white(`   • Time taken: ${(result.totalTime / 1000).toFixed(2)}s`));
    
    // Verify by testing some tools
    console.log(chalk.blue('\n🧪 Verifying tool retrieval...\n'));
    
    const testTools = ['calculator', 'file_read', 'json_parse'];
    let successCount = 0;
    
    for (const toolName of testTools) {
      try {
        const tool = await toolRegistry.getTool(toolName);
        if (tool && typeof tool.execute === 'function') {
          console.log(chalk.green(`   ✅ ${toolName}: Retrieved successfully`));
          successCount++;
        } else {
          console.log(chalk.yellow(`   ⚠️  ${toolName}: Not found or not executable`));
        }
      } catch (error) {
        console.log(chalk.red(`   ❌ ${toolName}: Error - ${error.message}`));
      }
    }
    
    console.log(chalk.white(`\n📊 Verification: ${successCount}/${testTools.length} tools retrieved successfully`));
    
    // List all available tools
    console.log(chalk.blue('\n📋 Listing all available tools...\n'));
    const allTools = await toolRegistry.listTools();
    
    // Group by module
    const toolsByModule = {};
    for (const tool of allTools) {
      const moduleName = tool.moduleName || 'Unknown';
      if (!toolsByModule[moduleName]) {
        toolsByModule[moduleName] = [];
      }
      toolsByModule[moduleName].push(tool.name);
    }
    
    // Display grouped tools
    for (const [moduleName, tools] of Object.entries(toolsByModule)) {
      console.log(chalk.cyan(`   ${moduleName}: ${tools.length} tools`));
      if (tools.length <= 5) {
        console.log(chalk.gray(`     → ${tools.join(', ')}`));
      } else {
        console.log(chalk.gray(`     → ${tools.slice(0, 5).join(', ')}, ...`));
      }
    }
    
    console.log(chalk.green.bold('\n✅ Script completed successfully!\n'));
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Script failed:'), error);
    console.error(chalk.red(error.stack));
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error(chalk.red.bold('❌ Fatal error:'), error);
  process.exit(1);
});