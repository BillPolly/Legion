#!/usr/bin/env node

/**
 * Verify Perspectives Script
 * 
 * Comprehensive verification of generated perspectives for integration testing.
 * Checks database integrity, content quality, and perspective completeness.
 * 
 * Usage:
 *   node scripts/verify-perspectives.js           # Basic verification
 *   node scripts/verify-perspectives.js --verbose # Show detailed content
 *   node scripts/verify-perspectives.js --samples # Show content samples
 */

import { ResourceManager } from '../../resource-manager/src/ResourceManager.js';
import { DatabaseStorage } from '../src/core/DatabaseStorage.js';
import { Perspectives } from '../src/search/Perspectives.js';

async function verifyPerspectives(options = {}) {
  const { verbose = false, samples = false } = options;
  
  let resourceManager;
  let databaseStorage;
  let perspectives;
  
  try {
    // Initialize ResourceManager singleton
    resourceManager = await ResourceManager.getResourceManager();
    
    // Initialize DatabaseStorage
    databaseStorage = new DatabaseStorage({ 
      resourceManager,
      databaseName: 'legion_tools'
    });
    await databaseStorage.initialize();
    
    // Register with ResourceManager
    resourceManager.set('databaseStorage', databaseStorage);
    
    console.log('🔍 Verify Generated Perspectives\n');
    console.log('=' + '='.repeat(50));
    
    // Try to initialize Perspectives for statistics (optional)
    try {
      perspectives = new Perspectives({
        resourceManager,
        options: { verbose: false }
      });
      await perspectives.initialize();
    } catch (error) {
      if (verbose) {
        console.log('ℹ️  Perspectives system initialization skipped (LLM client not required for verification)');
      }
    }
    
    const db = databaseStorage.db;
    
    // 1. Basic Database Integrity
    console.log('\n🗄️  Database Integrity Check:');
    const perspectiveTypesCount = await db.collection('perspective_types').countDocuments();
    const toolsCount = await db.collection('tools').countDocuments();
    const perspectivesCount = await db.collection('tool_perspectives').countDocuments();
    
    console.log(`  Perspective Types: ${perspectiveTypesCount}`);
    console.log(`  Tools: ${toolsCount}`);
    console.log(`  Tool Perspectives: ${perspectivesCount}`);
    
    // Verify basic requirements
    const checks = {
      perspectiveTypes: perspectiveTypesCount >= 4, // Should have at least 4 canonical types
      tools: toolsCount >= 1, // Should have at least 1 tool
      perspectives: perspectivesCount >= 1 // Should have at least 1 perspective
    };
    
    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`  ${passed ? '✅' : '❌'} ${check}: ${passed ? 'PASS' : 'FAIL'}`);
    });
    
    if (!checks.perspectives) {
      console.log('\n❌ ERROR: No perspectives found!');
      console.log('Run: node scripts/generate-real-perspectives.js');
      process.exit(1);
    }
    
    // 2. Coverage Analysis
    console.log('\n📊 Coverage Analysis:');
    
    // Get all tools and check which have perspectives
    const allTools = await db.collection('tools').find({}).toArray();
    const toolsWithPerspectives = await db.collection('tool_perspectives').distinct('tool_name');
    
    const coverage = toolsCount > 0 ? (toolsWithPerspectives.length / toolsCount * 100).toFixed(1) : '0.0';
    console.log(`  Tool Coverage: ${toolsWithPerspectives.length}/${toolsCount} tools (${coverage}%)`);
    
    // Check coverage per tool
    for (const tool of allTools) {
      const toolPerspectives = await db.collection('tool_perspectives')
        .find({ tool_name: tool.name })
        .toArray();
      
      const expectedPerspectives = perspectiveTypesCount;
      const actualPerspectives = toolPerspectives.length;
      const toolCoverage = expectedPerspectives > 0 ? (actualPerspectives / expectedPerspectives * 100).toFixed(1) : '0.0';
      
      console.log(`  ${tool.name}: ${actualPerspectives}/${expectedPerspectives} perspectives (${toolCoverage}%)`);
      
      if (verbose && toolPerspectives.length > 0) {
        const types = toolPerspectives.map(p => p.perspective_type_name);
        console.log(`    Types: ${types.join(', ')}`);
      }
    }
    
    // 3. Content Quality Verification
    console.log('\n✏️  Content Quality Check:');
    
    const sampleSize = Math.min(10, perspectivesCount);
    const samplePerspectives = await db.collection('tool_perspectives')
      .aggregate([{ $sample: { size: sampleSize } }])
      .toArray();
    
    let qualityResults = {
      withContent: 0,
      withKeywords: 0,
      withBatchId: 0,
      withTimestamp: 0,
      contentLength: [],
      keywordCount: []
    };
    
    for (const perspective of samplePerspectives) {
      if (perspective.content && perspective.content.trim().length > 0) {
        qualityResults.withContent++;
        qualityResults.contentLength.push(perspective.content.length);
      }
      
      if (perspective.keywords && Array.isArray(perspective.keywords) && perspective.keywords.length > 0) {
        qualityResults.withKeywords++;
        qualityResults.keywordCount.push(perspective.keywords.length);
      }
      
      if (perspective.batch_id) {
        qualityResults.withBatchId++;
      }
      
      if (perspective.generated_at) {
        qualityResults.withTimestamp++;
      }
    }
    
    // Calculate quality metrics
    const contentRate = (qualityResults.withContent / sampleSize * 100).toFixed(1);
    const keywordRate = (qualityResults.withKeywords / sampleSize * 100).toFixed(1);
    const batchIdRate = (qualityResults.withBatchId / sampleSize * 100).toFixed(1);
    const timestampRate = (qualityResults.withTimestamp / sampleSize * 100).toFixed(1);
    
    console.log(`  Content Present: ${qualityResults.withContent}/${sampleSize} (${contentRate}%)`);
    console.log(`  Keywords Present: ${qualityResults.withKeywords}/${sampleSize} (${keywordRate}%)`);
    console.log(`  Batch IDs Present: ${qualityResults.withBatchId}/${sampleSize} (${batchIdRate}%)`);
    console.log(`  Timestamps Present: ${qualityResults.withTimestamp}/${sampleSize} (${timestampRate}%)`);
    
    if (qualityResults.contentLength.length > 0) {
      const avgLength = Math.round(qualityResults.contentLength.reduce((a, b) => a + b, 0) / qualityResults.contentLength.length);
      const minLength = Math.min(...qualityResults.contentLength);
      const maxLength = Math.max(...qualityResults.contentLength);
      console.log(`  Content Length: avg ${avgLength}, min ${minLength}, max ${maxLength} chars`);
    }
    
    if (qualityResults.keywordCount.length > 0) {
      const avgKeywords = Math.round(qualityResults.keywordCount.reduce((a, b) => a + b, 0) / qualityResults.keywordCount.length);
      console.log(`  Keywords per Perspective: avg ${avgKeywords}`);
    }
    
    // 4. Batch Analysis
    console.log('\n📦 Batch Analysis:');
    
    const batches = await db.collection('tool_perspectives')
      .aggregate([
        { $group: { _id: '$batch_id', count: { $sum: 1 }, tools: { $addToSet: '$tool_name' } } },
        { $sort: { count: -1 } }
      ])
      .toArray();
    
    console.log(`  Total Batches: ${batches.length}`);
    
    if (verbose && batches.length > 0) {
      batches.slice(0, 5).forEach(batch => {
        console.log(`    Batch ${batch._id}: ${batch.count} perspectives, ${batch.tools.length} tools`);
      });
    }
    
    // 5. Perspective Type Distribution
    console.log('\n📈 Perspective Type Distribution:');
    
    const typeDistribution = await db.collection('tool_perspectives')
      .aggregate([
        { $group: { _id: '$perspective_type_name', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
      .toArray();
    
    typeDistribution.forEach(dist => {
      console.log(`  ${dist._id}: ${dist.count} perspectives`);
    });
    
    // 6. Sample Content Display
    if (samples && perspectivesCount > 0) {
      console.log('\n📝 Sample Perspective Content:');
      
      const contentSamples = await db.collection('tool_perspectives')
        .aggregate([
          { $sample: { size: Math.min(3, perspectivesCount) } },
          { $lookup: {
            from: 'tools',
            let: { toolName: '$tool_name' },
            pipeline: [{ $match: { $expr: { $eq: ['$name', '$$toolName'] } } }],
            as: 'tool'
          }}
        ])
        .toArray();
      
      contentSamples.forEach((sample, index) => {
        console.log(`\n  📌 Sample ${index + 1}: ${sample.tool_name} - ${sample.perspective_type_name}`);
        console.log(`     Tool Description: ${sample.tool[0]?.description || 'N/A'}`);
        console.log(`     Perspective Content:`);
        
        const content = sample.content || 'No content';
        const preview = content.length > 300 ? content.substring(0, 300) + '...' : content;
        console.log(`     ${preview.split('\n').join('\n     ')}`);
        
        if (sample.keywords && sample.keywords.length > 0) {
          console.log(`     Keywords: ${sample.keywords.slice(0, 8).join(', ')}${sample.keywords.length > 8 ? '...' : ''}`);
        }
        
        console.log(`     Batch ID: ${sample.batch_id || 'N/A'}`);
        console.log(`     Generated: ${sample.generated_at || 'N/A'}`);
      });
    }
    
    // 7. Overall Assessment
    console.log('\n🎯 Overall Assessment:');
    
    const overallScore = [
      checks.perspectiveTypes ? 1 : 0,
      checks.tools ? 1 : 0,
      checks.perspectives ? 1 : 0,
      parseFloat(contentRate) >= 90 ? 1 : 0,
      parseFloat(keywordRate) >= 70 ? 1 : 0,
      parseFloat(coverage) >= 100 ? 1 : 0
    ].reduce((a, b) => a + b, 0);
    
    const maxScore = 6;
    const scorePercentage = (overallScore / maxScore * 100).toFixed(1);
    
    console.log(`  Overall Score: ${overallScore}/${maxScore} (${scorePercentage}%)`);
    
    if (overallScore === maxScore) {
      console.log('  🎉 EXCELLENT - All verification checks passed!');
    } else if (overallScore >= 4) {
      console.log('  ✅ GOOD - Most verification checks passed');
    } else {
      console.log('  ⚠️  NEEDS IMPROVEMENT - Some verification checks failed');
    }
    
    // 8. Recommendations
    console.log('\n💡 Recommendations:');
    
    if (!checks.perspectiveTypes) {
      console.log('  - Initialize perspective types: node scripts/reset-database.js --all');
    }
    if (!checks.tools) {
      console.log('  - Load tools: node scripts/load-calculator-module.js');
    }
    if (!checks.perspectives) {
      console.log('  - Generate perspectives: node scripts/generate-real-perspectives.js');
    }
    if (parseFloat(coverage) < 100) {
      console.log('  - Generate missing perspectives: node scripts/generate-real-perspectives.js');
    }
    if (parseFloat(contentRate) < 90) {
      console.log('  - Regenerate perspectives with better LLM prompts');
    }
    if (overallScore === maxScore) {
      console.log('  ✅ System is fully functional and ready for use!');
    }
    
    console.log('\n✅ Perspective verification complete!');
    
    // Exit with appropriate code
    if (overallScore < 4) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error verifying perspectives:', error.message);
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    if (databaseStorage) {
      await databaseStorage.close();
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  verbose: false,
  samples: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--samples' || args[i] === '-s') {
    options.samples = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Verify Perspectives Script

Usage:
  node scripts/verify-perspectives.js [options]

Options:
  --verbose, -v    Show detailed verification information
  --samples, -s    Display sample perspective content
  --help, -h       Show this help message

Description:
  Comprehensive verification of generated perspectives for integration testing.
  
  This script performs the following checks:
  - Database integrity (collections exist with expected data)
  - Coverage analysis (all tools have perspectives)
  - Content quality (perspectives have meaningful content and keywords)
  - Batch analysis (perspectives were generated in proper batches)
  - Type distribution (all perspective types are represented)
  
  The script provides an overall assessment and recommendations for improvement.

Examples:
  node scripts/verify-perspectives.js
  node scripts/verify-perspectives.js --verbose --samples
    `);
    process.exit(0);
  }
}

// Run the script
verifyPerspectives(options).catch(console.error);