#!/usr/bin/env node

/**
 * Verify Pipeline Script
 * 
 * Comprehensive verification of the entire tool registry pipeline
 * Checks modules, tools, perspectives, embeddings, and vector index
 * 
 * Usage:
 *   node scripts/verify-pipeline.js                     # Verify everything
 *   node scripts/verify-pipeline.js --module Calculator # Verify specific module
 *   node scripts/verify-pipeline.js --fix              # Attempt to fix issues
 *   node scripts/verify-pipeline.js --report           # Generate detailed report
 */

import { ToolRegistry } from '../src/index.js';
import fs from 'fs/promises';
import path from 'path';

async function verifyPipeline(options = {}) {
  const { module, fix = false, report = false, verbose = false } = options;
  
  try {
    // Get ToolRegistry singleton
    const toolRegistry = await ToolRegistry.getInstance();
    
    console.log('🔬 Verifying complete pipeline...\n');
    
    const results = {
      modules: null,
      perspectives: null,
      pipeline: null,
      timestamp: new Date().toISOString()
    };
    
    // 1. Verify modules
    console.log('📦 Verifying modules...');
    results.modules = await toolRegistry.verifyModules({
      moduleName: module,
      verbose
    });
    
    console.log(`  Modules verified: ${results.modules.verified}`);
    console.log(`  Modules with issues: ${results.modules.issues}`);
    if (results.modules.errors?.length > 0 && verbose) {
      results.modules.errors.forEach(err => {
        console.log(`    ⚠️  ${err}`);
      });
    }
    
    // 2. Verify perspectives
    console.log('\n📝 Verifying perspectives...');
    results.perspectives = await toolRegistry.verifyPerspectives({
      moduleName: module,
      verbose
    });
    
    console.log(`  Tools with perspectives: ${results.perspectives.toolsWithPerspectives}`);
    console.log(`  Total perspectives: ${results.perspectives.totalPerspectives}`);
    console.log(`  Missing perspectives: ${results.perspectives.missingPerspectives}`);
    
    // 3. Verify complete pipeline
    console.log('\n🔄 Verifying complete pipeline...');
    results.pipeline = await toolRegistry.verifyPipeline({
      moduleName: module,
      fix,
      verbose
    });
    
    // Display pipeline results
    console.log('\n📊 Pipeline Verification Results:');
    console.log('\n  MongoDB:');
    console.log(`    Connected: ${results.pipeline.mongodb.connected ? '✅' : '❌'}`);
    console.log(`    Tools: ${results.pipeline.mongodb.tools}`);
    console.log(`    Modules: ${results.pipeline.mongodb.modules}`);
    console.log(`    Perspectives: ${results.pipeline.mongodb.perspectives}`);
    
    console.log('\n  Qdrant:');
    console.log(`    Connected: ${results.pipeline.qdrant.connected ? '✅' : '❌'}`);
    console.log(`    Collections: ${results.pipeline.qdrant.collections}`);
    console.log(`    Points: ${results.pipeline.qdrant.points}`);
    
    console.log('\n  Embeddings:');
    console.log(`    Tools with embeddings: ${results.pipeline.embeddings.toolsWithEmbeddings}`);
    console.log(`    Perspectives with embeddings: ${results.pipeline.embeddings.perspectivesWithEmbeddings}`);
    console.log(`    Missing embeddings: ${results.pipeline.embeddings.missingEmbeddings}`);
    
    // Overall health
    const health = results.pipeline.health || {};
    console.log('\n🏥 Overall Health:');
    console.log(`  Status: ${health.status || 'unknown'}`);
    console.log(`  Score: ${health.score || 0}/100`);
    
    if (health.issues?.length > 0) {
      console.log('\n  Issues found:');
      health.issues.forEach(issue => {
        console.log(`    ⚠️  ${issue}`);
      });
    }
    
    // Fix attempts
    if (fix && results.pipeline.fixes) {
      console.log('\n🔧 Fix Attempts:');
      console.log(`  Attempted: ${results.pipeline.fixes.attempted}`);
      console.log(`  Successful: ${results.pipeline.fixes.successful}`);
      console.log(`  Failed: ${results.pipeline.fixes.failed}`);
    }
    
    // Generate report if requested
    if (report) {
      const reportPath = path.join(process.cwd(), `pipeline-report-${Date.now()}.json`);
      await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
      console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    }
    
    // Final status
    const isHealthy = health.status === 'healthy' || health.score >= 80;
    if (isHealthy) {
      console.log('\n✅ Pipeline verification complete - All systems operational!');
    } else {
      console.log('\n⚠️  Pipeline verification complete - Issues detected');
      if (!fix) {
        console.log('   Run with --fix to attempt automatic repairs');
      }
    }
    
    process.exit(isHealthy ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Error verifying pipeline:', error.message);
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  module: null,
  fix: false,
  report: false,
  verbose: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--module' && args[i + 1]) {
    options.module = args[i + 1];
    i++;
  } else if (args[i] === '--fix') {
    options.fix = true;
  } else if (args[i] === '--report') {
    options.report = true;
  } else if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Verify Pipeline Script

Usage:
  node scripts/verify-pipeline.js [options]

Options:
  --module <name>    Verify specific module only
  --fix             Attempt to fix detected issues
  --report          Generate detailed JSON report
  --verbose, -v     Show detailed output
  --help, -h        Show this help message

Examples:
  node scripts/verify-pipeline.js
  node scripts/verify-pipeline.js --module Calculator
  node scripts/verify-pipeline.js --fix --report
  node scripts/verify-pipeline.js --verbose

Exit Codes:
  0 - Pipeline is healthy
  1 - Issues detected or error occurred
    `);
    process.exit(0);
  }
}

// Run the script
verifyPipeline(options).catch(console.error);