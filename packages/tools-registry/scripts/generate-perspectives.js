#!/usr/bin/env node

/**
 * Generate Perspectives Script
 * 
 * Generates perspectives for tools using the 3-collection architecture
 * Generates ALL perspective types for each tool in a single LLM call
 * 
 * Usage:
 *   node scripts/generate-perspectives.js                     # Generate for all tools
 *   node scripts/generate-perspectives.js --tool read_file    # Generate for specific tool
 *   node scripts/generate-perspectives.js --module FileModule # Generate for module
 *   node scripts/generate-perspectives.js --force            # Force regeneration
 */

import { ToolRegistry } from '../src/index.js';

async function generatePerspectives(options = {}) {
  const { toolName, moduleName, force = false, verbose = false, dryRun = false } = options;
  
  try {
    // Get ToolRegistry singleton
    const toolRegistry = await ToolRegistry.getInstance();
    
    console.log('🚀 Starting perspective generation...\n');
    
    // Generate perspectives through the singleton
    const result = await toolRegistry.generatePerspectives({
      toolName,
      moduleName,
      forceRegenerate: force,
      verbose,
      dryRun
    });
    
    // Display results
    if (result.generated > 0) {
      console.log(`\n✅ Generated ${result.generated} perspectives`);
    }
    if (result.skipped > 0) {
      console.log(`⏭️  Skipped ${result.skipped} existing perspectives`);
    }
    if (result.failed > 0) {
      console.log(`❌ Failed to generate ${result.failed} perspectives`);
      if (result.failures && result.failures.length > 0 && verbose) {
        console.log('\n⚠️  Failures:');
        result.failures.forEach(f => {
          console.log(`  - ${f.toolName}: ${f.error}`);
        });
      }
    }
    
    console.log('\n✅ Perspective generation complete!');
    
  } catch (error) {
    console.error('❌ Error generating perspectives:', error.message);
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  toolName: null,
  moduleName: null,
  force: false,
  verbose: false,
  dryRun: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--tool' && args[i + 1]) {
    options.toolName = args[i + 1];
    i++;
  } else if (args[i] === '--module' && args[i + 1]) {
    options.moduleName = args[i + 1];
    i++;
  } else if (args[i] === '--force') {
    options.force = true;
  } else if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--dry-run') {
    options.dryRun = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Generate Perspectives Script

Usage:
  node scripts/generate-perspectives.js [options]

Options:
  --tool <name>    Generate perspectives for specific tool
  --module <name>  Generate perspectives for all tools in module
  --force          Force regeneration even if perspectives exist
  --verbose, -v    Show detailed output
  --dry-run        Show what would be generated without doing it
  --help, -h       Show this help message

Examples:
  node scripts/generate-perspectives.js
  node scripts/generate-perspectives.js --tool read_file
  node scripts/generate-perspectives.js --module FileModule --force
  node scripts/generate-perspectives.js --verbose --dry-run
    `);
    process.exit(0);
  }
}

// Run the script
generatePerspectives(options).catch(console.error);