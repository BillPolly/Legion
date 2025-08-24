#!/usr/bin/env node

/**
 * Generate Embeddings Script
 * 
 * Generates embeddings for existing perspectives (separate step)
 * Reports failures and validates embedding quality
 * 
 * Usage:
 *   node scripts/generate-embeddings.js                  # Generate for all perspectives
 *   node scripts/generate-embeddings.js --tool read_file # Generate for specific tool
 *   node scripts/generate-embeddings.js --module File    # Generate for module
 *   node scripts/generate-embeddings.js --force          # Force regeneration
 *   node scripts/generate-embeddings.js --validate       # Validate embeddings after generation
 */

import { ToolRegistry } from '../src/index.js';

async function generateEmbeddings(options = {}) {
  const { toolName, moduleName, force = false, verbose = false, validate = false } = options;
  
  try {
    // Get ToolRegistry singleton
    const toolRegistry = await ToolRegistry.getInstance();
    
    console.log('🚀 Starting embedding generation...\n');
    
    // Generate embeddings through the singleton
    const result = await toolRegistry.generateEmbeddings({
      toolName,
      moduleName,
      forceRegenerate: force,
      verbose,
      validate
    });
    
    // Display results
    console.log('\n📊 Embedding Generation Results:');
    console.log(`  Total perspectives: ${result.totalPerspectives || 0}`);
    console.log(`  Embeddings generated: ${result.generated || 0}`);
    console.log(`  Already had embeddings: ${result.skipped || 0}`);
    console.log(`  Failed: ${result.failed || 0}`);
    
    // Show failures if any
    if (result.failed > 0 && result.failures && result.failures.length > 0) {
      console.log('\n⚠️  Failed embeddings:');
      result.failures.forEach(f => {
        console.log(`  - ${f.perspectiveId}: ${f.error}`);
      });
    }
    
    // Validate embeddings if requested
    if (validate && result.generated > 0) {
      console.log('\n🔍 Validating embeddings...');
      const validationResult = await toolRegistry.validateEmbeddings({
        toolName,
        moduleName,
        verbose
      });
      
      console.log(`  Valid embeddings: ${validationResult.valid || 0}`);
      console.log(`  Invalid embeddings: ${validationResult.invalid || 0}`);
      console.log(`  Empty embeddings: ${validationResult.empty || 0}`);
      
      if (validationResult.invalid > 0 && verbose) {
        console.log('\n  Invalid embedding details:');
        validationResult.invalidDetails?.forEach(d => {
          console.log(`    - ${d.id}: ${d.reason}`);
        });
      }
    }
    
    // Success rate
    if (result.generated > 0 || result.failed > 0) {
      const successRate = ((result.generated / (result.generated + result.failed)) * 100).toFixed(1);
      console.log(`\n✅ Success rate: ${successRate}%`);
    } else if (result.totalPerspectives > 0 && result.skipped === result.totalPerspectives) {
      console.log(`\n✅ All perspectives already have embeddings (${result.skipped}/${result.totalPerspectives})`);
    }
    
    console.log('\n✅ Embedding generation complete!');
    
    // Exit successfully
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error generating embeddings:', error.message);
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
  validate: false
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
  } else if (args[i] === '--validate') {
    options.validate = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Generate Embeddings Script

Usage:
  node scripts/generate-embeddings.js [options]

Options:
  --tool <name>    Generate embeddings for specific tool's perspectives
  --module <name>  Generate embeddings for all tools in module
  --force          Force regeneration even if embeddings exist
  --validate       Validate embeddings after generation
  --verbose, -v    Show detailed output
  --help, -h       Show this help message

Examples:
  node scripts/generate-embeddings.js
  node scripts/generate-embeddings.js --tool read_file
  node scripts/generate-embeddings.js --module FileModule --validate
  node scripts/generate-embeddings.js --force --verbose
    `);
    process.exit(0);
  }
}

// Run the script
generateEmbeddings(options).catch(console.error);