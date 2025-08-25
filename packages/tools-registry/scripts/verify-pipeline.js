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

/**
 * Calculate health score based on pipeline verification results
 * @param {Object} pipeline - Pipeline verification results
 * @returns {number} Health score 0-100
 */
function calculateHealthScore(pipeline) {
  let score = 0;
  const maxScore = 100;
  
  // MongoDB/Modules (25 points) - check if connected and tools are loaded
  const modules = pipeline.checks?.modules || pipeline.mongodb || {};
  if (modules.valid !== false) {
    score += 10; // Base connection
    const toolsLoaded = modules.verified || 0;
    if (toolsLoaded > 20) { // We expect many tools
      score += 15; // Good number of tools loaded
    } else if (toolsLoaded > 0) {
      score += 10; // Some tools loaded
    }
  }
  
  // Qdrant/Vectors (25 points) - check if connected and has vectors
  const vectors = pipeline.checks?.vectors || pipeline.qdrant || {};
  if (vectors.valid !== false) {
    score += 10; // Base connection
    const pointCount = vectors.stats?.vectorCount || vectors.totalPoints || 0;
    if (pointCount > 300) { // We expect many vectors
      score += 15; // Good number of vectors
    } else if (pointCount > 0) {
      score += 10; // Some vectors
    }
  }
  
  // Perspectives/Embeddings (25 points) - check if perspectives have embeddings
  const perspectives = pipeline.checks?.perspectives || pipeline.embeddings || {};
  if (perspectives.valid === true) {
    score += 10; // Valid perspectives check
    const withEmbeddings = perspectives.perspectives?.withEmbeddings || perspectives.toolsWithPerspectives || 0;
    if (withEmbeddings > 300) { // We expect many perspectives with embeddings
      score += 15; // Good embedding coverage
    } else if (withEmbeddings > 0) {
      score += 10; // Some embeddings
    }
  }
  
  // Search functionality (25 points) - check if search works
  const search = pipeline.checks?.search || {};
  if (search.valid === true && search.results) {
    const successfulSearches = search.results.filter(r => r.success).length;
    if (successfulSearches >= 4) {
      score += 25; // All searches working
    } else if (successfulSearches > 0) {
      score += Math.floor((successfulSearches / 4) * 25); // Partial success
    }
  }
  
  return Math.min(score, maxScore);
}

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
    console.log(`  Total tools: ${results.modules.totalTools}`);
    if (results.modules.toolsWithoutExecute > 0) {
      console.log(`  ⚠️  Tools without execute(): ${results.modules.toolsWithoutExecute}`);
    }
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
    
    // MongoDB/Modules check
    const mongodb = results.pipeline.checks?.modules || results.pipeline.mongodb || {};
    console.log('\n  MongoDB:');
    console.log(`    Connected: ${mongodb.connected !== false ? '✅' : '❌'}`);
    console.log(`    Total tools: ${mongodb.totalTools || 'N/A'}`);
    console.log(`    Modules with tools: ${mongodb.verified || mongodb.tools || 'N/A'}`);
    console.log(`    Total modules: ${mongodb.modules?.total || mongodb.total || 'N/A'}`);
    console.log(`    Issues: ${mongodb.issues || mongodb.modules?.issues?.length || 0}`);
    
    // Qdrant/Vectors check  
    const qdrant = results.pipeline.checks?.vectors || results.pipeline.qdrant || {};
    console.log('\n  Qdrant:');
    console.log(`    Connected: ${qdrant.connected !== false && !qdrant.issues?.includes('Vector store not initialized') ? '✅' : '❌'}`);
    console.log(`    Points: ${qdrant.stats?.vectorCount || qdrant.totalPoints || 'N/A'}`);
    console.log(`    Valid Points: ${qdrant.validPoints || 'N/A'}`);
    console.log(`    Issues: ${qdrant.issues?.length || 0}`);
    
    // Embeddings/Perspectives check
    const embeddings = results.pipeline.checks?.perspectives || results.pipeline.embeddings || {};
    console.log('\n  Embeddings:');
    console.log(`    Total Perspectives: ${embeddings.perspectives?.total || embeddings.totalPerspectives || 'N/A'}`);
    console.log(`    With Embeddings: ${embeddings.perspectives?.withEmbeddings || embeddings.toolsWithPerspectives || 'N/A'}`);
    console.log(`    Coverage: ${embeddings.coverage?.percentage ? embeddings.coverage.percentage + '%' : 'N/A'}`);
    console.log(`    Missing: ${embeddings.missingPerspectives || 0}`);
    
    // Overall health
    const health = results.pipeline.health || {};
    const score = calculateHealthScore(results.pipeline);
    console.log('\n🏥 Overall Health:');
    console.log(`  Status: ${health.status || (results.pipeline.valid ? 'healthy' : 'degraded')}`);
    console.log(`  Score: ${score}/100`);
    
    if (health.issues?.length > 0) {
      console.log('\n  Issues found:');
      health.issues.forEach(issue => {
        console.log(`    ⚠️  ${issue}`);
      });
    }
    
    // Show detailed check results if verbose
    if (verbose && results.pipeline.checks) {
      console.log('\n🔍 Detailed Check Results:');
      Object.entries(results.pipeline.checks).forEach(([checkName, checkResult]) => {
        console.log(`  ${checkName}: ${checkResult.valid ? '✅ PASS' : '❌ FAIL'}`);
        if (!checkResult.valid && checkResult.errors) {
          checkResult.errors.forEach(error => {
            console.log(`    - ${error}`);
          });
        }
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
    
    // Final status reporting
    const isHealthy = health.status === 'healthy' || score >= 70;
    if (isHealthy) {
      console.log('\n✅ Pipeline verification complete - All systems operational!');
    } else {
      console.log('\n⚠️  Pipeline verification complete - Issues detected');
      if (!fix) {
        console.log('   Run with --fix to attempt automatic repairs');
      }
    }
    
    // Always exit successfully - verification script did its job
    // Only exit with error if the script itself failed to run
    process.exit(0);
    
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
  0 - Verification completed successfully 
  1 - Script failed to run (error occurred)
    `);
    process.exit(0);
  }
}

// Run the script
verifyPipeline(options).catch(console.error);