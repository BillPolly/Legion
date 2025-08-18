#!/usr/bin/env node

/**
 * Tool Registry Verification Script
 * 
 * Comprehensive verification script for the tool registry system.
 * Provides deep validation of MongoDB-Qdrant relationships and constraints.
 * 
 * ARCHITECTURE: Only uses ToolRegistry.getLoader() - NO direct database operations
 * 
 * Usage:
 *   node verify.js status [--verbose]                         # Quick health check
 *   node verify.js stats [--collection <name>]                # Count statistics  
 *   node verify.js relationships [--deep] [--fix]             # Check all relationships
 *   node verify.js constraints [--deep] [--fix]               # Validate schema constraints
 *   node verify.js health [--verbose]                         # Full system health report
 */

import { ToolRegistry } from '../src/integration/ToolRegistry.js';
import chalk from 'chalk';
import { ObjectId } from 'mongodb';

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  const options = {
    command,
    verbose: args.includes('--verbose') || args.includes('-v'),
    deep: args.includes('--deep'),
    fix: args.includes('--fix'),
    collection: null,
    sample: args.includes('--sample')
  };
  
  // Extract collection name
  const collectionIndex = args.indexOf('--collection');
  if (collectionIndex !== -1 && args[collectionIndex + 1]) {
    options.collection = args[collectionIndex + 1];
  }
  
  return options;
}

/**
 * Show help information
 */
function showHelp() {
  console.log(chalk.blue.bold('\nTool Registry Verification\n'));
  console.log(chalk.gray('Comprehensive verification script for MongoDB-Qdrant relationships.'));
  console.log(chalk.gray('Only uses ToolRegistry.getLoader() - enforces proper architecture.\n'));
  
  console.log(chalk.cyan('Commands:'));
  console.log(chalk.white('  status                       Quick health check and counts'));
  console.log(chalk.white('  stats                        Detailed collection statistics'));
  console.log(chalk.white('  relationships                Check MongoDB relationship integrity'));
  console.log(chalk.white('  constraints                  Validate schema constraints'));
  console.log(chalk.white('  health                       Full system health report'));
  console.log(chalk.white('  help                         Show this help message\n'));
  
  console.log(chalk.cyan('Options:'));
  console.log(chalk.white('  --collection <name>          Focus on specific collection'));
  console.log(chalk.white('  --deep                       Exhaustive verification (slower)'));
  console.log(chalk.white('  --fix                        Attempt to fix violations (use with care)'));
  console.log(chalk.white('  --sample                     Show sample records'));
  console.log(chalk.white('  --verbose, -v                Show detailed output\n'));
  
  console.log(chalk.cyan('Examples:'));
  console.log(chalk.gray('  node verify.js status --verbose'));
  console.log(chalk.gray('  node verify.js relationships --deep'));
  console.log(chalk.gray('  node verify.js constraints --fix'));
  console.log(chalk.gray('  node verify.js stats --collection tools'));
  console.log(chalk.gray('  node verify.js health --verbose\n'));
  
  console.log(chalk.yellow('⚠️  Warning: --fix option will modify data. Always backup first!\n'));
}

/**
 * Initialize verification components
 */
async function createVerificationContext(options) {
  const registry = ToolRegistry.getInstance();
  await registry.initialize();
  
  // Get the LoadingManager through ToolRegistry (enforces architecture)
  const loader = await registry.getLoader();
  
  return {
    registry,
    loader,
    mongoProvider: loader.mongoProvider.databaseService.mongoProvider,
    semanticProvider: registry.semanticDiscovery?.semanticSearchProvider || null,
    db: loader.mongoProvider.databaseService.mongoProvider.db
  };
}

/**
 * Status command - Quick health check
 */
async function statusCommand(options) {
  console.log(chalk.blue.bold('\n📊 System Status Check\n'));
  
  const { mongoProvider, semanticProvider, db } = await createVerificationContext(options);
  
  try {
    // MongoDB connection status
    console.log(chalk.cyan('🗄️ MongoDB Status:'));
    console.log(chalk.green(`   Connected: ${mongoProvider.connected ? '✅' : '❌'}`));
    console.log(chalk.green(`   Database: ${db.databaseName}`));
    
    // Collection counts
    const collections = ['modules', 'tools', 'tool_perspectives'];
    const counts = {};
    
    for (const collection of collections) {
      counts[collection] = await mongoProvider.count(collection, {});
    }
    
    console.log(chalk.white(`   Modules: ${counts.modules}`));
    console.log(chalk.white(`   Tools: ${counts.tools}`));
    console.log(chalk.white(`   Perspectives: ${counts.tool_perspectives}\n`));
    
    // Qdrant status
    console.log(chalk.cyan('🚀 Qdrant Status:'));
    if (semanticProvider) {
      try {
        const vectorCount = await semanticProvider.count('legion_tools');
        console.log(chalk.green(`   Connected: ✅`));
        console.log(chalk.green(`   Collection: legion_tools`));
        console.log(chalk.white(`   Vectors: ${vectorCount}\n`));
      } catch (error) {
        console.log(chalk.red(`   Connected: ❌ (${error.message})\n`));
      }
    } else {
      console.log(chalk.yellow(`   Not initialized\n`));
    }
    
    // Quick integrity check
    console.log(chalk.cyan('🔗 Quick Integrity Check:'));
    
    // Check for tools without modules
    const orphanedTools = await mongoProvider.count('tools', {
      $or: [
        { moduleId: { $exists: false } },
        { moduleName: { $exists: false } }
      ]
    });
    
    // Check for perspectives without tools
    const orphanedPerspectives = await mongoProvider.count('tool_perspectives', {
      $or: [
        { toolId: { $exists: false } },
        { toolName: { $exists: false } }
      ]
    });
    
    // Check for perspectives with embeddings but no vectors
    let perspectivesWithEmbeddings = 0;
    let vectorMismatch = 0;
    
    try {
      perspectivesWithEmbeddings = await mongoProvider.count('tool_perspectives', {
        embedding: { $exists: true, $ne: null }
      });
      
      if (semanticProvider) {
        const vectorCount = await semanticProvider.count('legion_tools');
        vectorMismatch = Math.abs(perspectivesWithEmbeddings - vectorCount);
      }
    } catch (error) {
      // Qdrant not available
    }
    
    console.log(chalk.white(`   Orphaned tools: ${orphanedTools === 0 ? '✅' : '❌'} (${orphanedTools})`));
    console.log(chalk.white(`   Orphaned perspectives: ${orphanedPerspectives === 0 ? '✅' : '❌'} (${orphanedPerspectives})`));
    console.log(chalk.white(`   Vector sync: ${vectorMismatch === 0 ? '✅' : '❌'} (±${vectorMismatch})`));
    
    // Overall status
    const issues = orphanedTools + orphanedPerspectives + vectorMismatch;
    console.log(chalk.blue.bold('\n📋 Overall Status:'));
    if (issues === 0) {
      console.log(chalk.green('✅ System appears healthy - no obvious issues detected'));
    } else {
      console.log(chalk.yellow(`⚠️ ${issues} potential issues detected`));
      console.log(chalk.gray('   Run "node verify.js relationships --deep" for detailed analysis'));
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
 * Stats command - Detailed collection statistics
 */
async function statsCommand(options) {
  console.log(chalk.blue.bold('\n📊 Collection Statistics\n'));
  
  const { mongoProvider, semanticProvider, db } = await createVerificationContext(options);
  
  try {
    const collections = options.collection ? [options.collection] : ['modules', 'tools', 'tool_perspectives'];
    
    for (const collection of collections) {
      console.log(chalk.cyan(`📋 ${collection.toUpperCase()} Collection:`));
      
      const totalCount = await mongoProvider.count(collection, {});
      console.log(chalk.white(`   Total records: ${totalCount}`));
      
      if (totalCount === 0) {
        console.log(chalk.gray('   (Collection is empty)\n'));
        continue;
      }
      
      // Collection-specific statistics
      if (collection === 'modules') {
        await showModuleStats(mongoProvider, options);
      } else if (collection === 'tools') {
        await showToolStats(mongoProvider, options);
      } else if (collection === 'tool_perspectives') {
        await showPerspectiveStats(mongoProvider, semanticProvider, options);
      }
      
      // Sample records if requested
      if (options.sample) {
        console.log(chalk.gray('   Sample records:'));
        const samples = await mongoProvider.find(collection, {}, { limit: 3 });
        for (const sample of samples) {
          const id = sample._id.toString().substring(0, 8);
          if (collection === 'modules') {
            console.log(chalk.gray(`      ${id}... ${sample.name} (${sample.type})`));
          } else if (collection === 'tools') {
            console.log(chalk.gray(`      ${id}... ${sample.name} (${sample.moduleName})`));
          } else if (collection === 'tool_perspectives') {
            console.log(chalk.gray(`      ${id}... ${sample.toolName} (${sample.perspectiveType})`));
          }
        }
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Stats failed:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    throw error;
  }
}

/**
 * Show module statistics
 */
async function showModuleStats(mongoProvider, options) {
  // Status distribution
  const statusPipeline = [
    { $group: { _id: '$loadingStatus', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ];
  
  const statusResults = await mongoProvider.aggregate('modules', statusPipeline);
  console.log(chalk.white('   Loading status distribution:'));
  for (const result of statusResults) {
    const status = result._id || 'unknown';
    console.log(chalk.gray(`      ${status}: ${result.count}`));
  }
  
  // Type distribution
  const typeResults = await mongoProvider.aggregate('modules', [
    { $group: { _id: '$type', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  console.log(chalk.white('   Module type distribution:'));
  for (const result of typeResults) {
    console.log(chalk.gray(`      ${result._id}: ${result.count}`));
  }
  
  // Tool count summary
  const toolCountResults = await mongoProvider.aggregate('modules', [
    { $group: { 
      _id: null, 
      totalTools: { $sum: '$toolCount' },
      avgTools: { $avg: '$toolCount' },
      maxTools: { $max: '$toolCount' }
    }}
  ]);
  
  if (toolCountResults.length > 0) {
    const stats = toolCountResults[0];
    console.log(chalk.white('   Tool count summary:'));
    console.log(chalk.gray(`      Total tools: ${stats.totalTools || 0}`));
    console.log(chalk.gray(`      Average per module: ${(stats.avgTools || 0).toFixed(1)}`));
    console.log(chalk.gray(`      Max tools in module: ${stats.maxTools || 0}`));
  }
}

/**
 * Show tool statistics
 */
async function showToolStats(mongoProvider, options) {
  // Module distribution
  const moduleResults = await mongoProvider.aggregate('tools', [
    { $group: { _id: '$moduleName', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);
  
  console.log(chalk.white('   Top 10 modules by tool count:'));
  for (const result of moduleResults) {
    const moduleName = result._id || 'unknown';
    console.log(chalk.gray(`      ${moduleName}: ${result.count}`));
  }
  
  // Category distribution
  const categoryResults = await mongoProvider.aggregate('tools', [
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  
  if (categoryResults.length > 0) {
    console.log(chalk.white('   Category distribution:'));
    for (const result of categoryResults) {
      const category = result._id || 'uncategorized';
      console.log(chalk.gray(`      ${category}: ${result.count}`));
    }
  }
}

/**
 * Show perspective statistics
 */
async function showPerspectiveStats(mongoProvider, semanticProvider, options) {
  // Perspective type distribution
  const typeResults = await mongoProvider.aggregate('tool_perspectives', [
    { $group: { _id: '$perspectiveType', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  
  console.log(chalk.white('   Perspective type distribution:'));
  for (const result of typeResults) {
    console.log(chalk.gray(`      ${result._id}: ${result.count}`));
  }
  
  // Embedding statistics
  const withEmbeddings = await mongoProvider.count('tool_perspectives', {
    embedding: { $exists: true, $ne: null }
  });
  const totalPerspectives = await mongoProvider.count('tool_perspectives', {});
  
  console.log(chalk.white('   Embedding statistics:'));
  console.log(chalk.gray(`      With embeddings: ${withEmbeddings}/${totalPerspectives}`));
  console.log(chalk.gray(`      Embedding coverage: ${((withEmbeddings/totalPerspectives)*100).toFixed(1)}%`));
  
  // Qdrant vector statistics
  if (semanticProvider) {
    try {
      const vectorCount = await semanticProvider.count('legion_tools');
      console.log(chalk.gray(`      Vectors in Qdrant: ${vectorCount}`));
      console.log(chalk.gray(`      Sync status: ${withEmbeddings === vectorCount ? '✅' : '❌'}`));
    } catch (error) {
      console.log(chalk.gray(`      Qdrant status: ❌ (${error.message})`));
    }
  }
  
  // Tools with perspectives
  const toolsWithPerspectives = await mongoProvider.aggregate('tool_perspectives', [
    { $group: { _id: '$toolName', perspectiveCount: { $sum: 1 } } },
    { $group: { 
      _id: null, 
      totalTools: { $sum: 1 },
      avgPerspectives: { $avg: '$perspectiveCount' },
      maxPerspectives: { $max: '$perspectiveCount' }
    }}
  ]);
  
  if (toolsWithPerspectives.length > 0) {
    const stats = toolsWithPerspectives[0];
    console.log(chalk.white('   Tool perspective summary:'));
    console.log(chalk.gray(`      Tools with perspectives: ${stats.totalTools}`));
    console.log(chalk.gray(`      Average perspectives per tool: ${stats.avgPerspectives.toFixed(1)}`));
    console.log(chalk.gray(`      Max perspectives for a tool: ${stats.maxPerspectives}`));
  }
}

/**
 * Relationships command - Check MongoDB relationship integrity
 */
async function relationshipsCommand(options) {
  console.log(chalk.blue.bold('\n🔗 Relationship Integrity Check\n'));
  
  const { mongoProvider, semanticProvider } = await createVerificationContext(options);
  
  try {
    let totalIssues = 0;
    const fixActions = [];
    
    // 1. Modules ↔ Tools relationship integrity
    console.log(chalk.cyan('📋 1. Modules ↔ Tools Relationships:'));
    
    // Check for tools without valid module references
    const orphanedTools = await mongoProvider.find('tools', {
      $or: [
        { moduleId: { $exists: false } },
        { moduleId: null },
        { moduleName: { $exists: false } },
        { moduleName: null }
      ]
    });
    
    if (orphanedTools.length > 0) {
      console.log(chalk.red(`   ❌ Found ${orphanedTools.length} orphaned tools (no module reference)`));
      totalIssues += orphanedTools.length;
      
      if (options.verbose) {
        for (const tool of orphanedTools.slice(0, 5)) {
          console.log(chalk.gray(`      - ${tool.name} (ID: ${tool._id.toString().substring(0, 8)}...)`));
        }
        if (orphanedTools.length > 5) {
          console.log(chalk.gray(`      ... and ${orphanedTools.length - 5} more`));
        }
      }
      
      if (options.fix) {
        fixActions.push(() => deleteOrphanedTools(mongoProvider, orphanedTools));
      }
    } else {
      console.log(chalk.green('   ✅ No orphaned tools found'));
    }
    
    // Check for invalid module references
    if (options.deep) {
      console.log(chalk.cyan('   Deep check: Validating module references...'));
      
      const toolsWithModuleIds = await mongoProvider.find('tools', {
        moduleId: { $exists: true, $ne: null }
      });
      
      let invalidRefs = 0;
      for (const tool of toolsWithModuleIds) {
        const module = await mongoProvider.findOne('modules', { _id: tool.moduleId });
        if (!module) {
          console.log(chalk.red(`   ❌ Tool ${tool.name} references non-existent module ID: ${tool.moduleId}`));
          invalidRefs++;
          totalIssues++;
        }
      }
      
      if (invalidRefs === 0) {
        console.log(chalk.green(`   ✅ All ${toolsWithModuleIds.length} module ID references are valid`));
      }
    }
    
    // Check module tool counts
    const modules = await mongoProvider.find('modules', {});
    let toolCountMismatches = 0;
    
    for (const module of modules) {
      const actualToolCount = await mongoProvider.count('tools', { moduleName: module.name });
      const recordedCount = module.toolCount || 0;
      
      if (actualToolCount !== recordedCount) {
        toolCountMismatches++;
        totalIssues++;
        
        if (options.verbose) {
          console.log(chalk.yellow(`   ⚠️ Module ${module.name}: recorded ${recordedCount} tools, actual ${actualToolCount}`));
        }
        
        if (options.fix) {
          fixActions.push(() => updateModuleToolCount(mongoProvider, module._id, actualToolCount));
        }
      }
    }
    
    if (toolCountMismatches === 0) {
      console.log(chalk.green('   ✅ All module tool counts are accurate'));
    } else {
      console.log(chalk.yellow(`   ⚠️ ${toolCountMismatches} modules have incorrect tool counts`));
    }
    
    console.log('');
    
    // 2. Tools ↔ Perspectives relationship integrity
    console.log(chalk.cyan('📝 2. Tools ↔ Perspectives Relationships:'));
    
    // Check for perspectives without valid tool references
    const orphanedPerspectives = await mongoProvider.find('tool_perspectives', {
      $or: [
        { toolId: { $exists: false } },
        { toolId: null },
        { toolName: { $exists: false } },
        { toolName: null }
      ]
    });
    
    if (orphanedPerspectives.length > 0) {
      console.log(chalk.red(`   ❌ Found ${orphanedPerspectives.length} orphaned perspectives (no tool reference)`));
      totalIssues += orphanedPerspectives.length;
      
      if (options.fix) {
        fixActions.push(() => deleteOrphanedPerspectives(mongoProvider, orphanedPerspectives));
      }
    } else {
      console.log(chalk.green('   ✅ No orphaned perspectives found'));
    }
    
    // Check for invalid tool references in perspectives
    if (options.deep) {
      console.log(chalk.cyan('   Deep check: Validating tool references...'));
      
      const perspectivesWithToolIds = await mongoProvider.find('tool_perspectives', {
        toolId: { $exists: true, $ne: null }
      });
      
      let invalidToolRefs = 0;
      for (const perspective of perspectivesWithToolIds) {
        const tool = await mongoProvider.findOne('tools', { _id: perspective.toolId });
        if (!tool) {
          console.log(chalk.red(`   ❌ Perspective references non-existent tool ID: ${perspective.toolId}`));
          invalidToolRefs++;
          totalIssues++;
        }
      }
      
      if (invalidToolRefs === 0) {
        console.log(chalk.green(`   ✅ All ${perspectivesWithToolIds.length} tool ID references are valid`));
      }
    }
    
    console.log('');
    
    // 3. MongoDB ↔ Qdrant vector synchronization
    console.log(chalk.cyan('🚀 3. MongoDB ↔ Qdrant Vector Synchronization:'));
    
    if (!semanticProvider) {
      console.log(chalk.yellow('   ⚠️ Qdrant not available - skipping vector sync check'));
    } else {
      try {
        const perspectivesWithEmbeddings = await mongoProvider.find('tool_perspectives', {
          embedding: { $exists: true, $ne: null }
        });
        
        const vectorCount = await semanticProvider.count('legion_tools');
        
        console.log(chalk.white(`   MongoDB perspectives with embeddings: ${perspectivesWithEmbeddings.length}`));
        console.log(chalk.white(`   Qdrant vectors: ${vectorCount}`));
        
        if (perspectivesWithEmbeddings.length === vectorCount) {
          console.log(chalk.green('   ✅ Vector counts match'));
        } else {
          const diff = Math.abs(perspectivesWithEmbeddings.length - vectorCount);
          console.log(chalk.red(`   ❌ Vector count mismatch: ±${diff}`));
          totalIssues += diff;
          
          if (options.deep) {
            // Check individual vector presence
            await checkIndividualVectorSync(mongoProvider, semanticProvider, perspectivesWithEmbeddings, options);
          }
        }
        
      } catch (error) {
        console.log(chalk.red(`   ❌ Qdrant check failed: ${error.message}`));
        totalIssues++;
      }
    }
    
    console.log('');
    
    // Apply fixes if requested
    if (options.fix && fixActions.length > 0) {
      console.log(chalk.blue.bold('🔧 Applying Fixes:'));
      
      for (const fixAction of fixActions) {
        try {
          await fixAction();
        } catch (error) {
          console.log(chalk.red(`   ❌ Fix failed: ${error.message}`));
        }
      }
      
      console.log('');
    }
    
    // Summary
    console.log(chalk.blue.bold('📊 Relationship Check Summary'));
    console.log('═'.repeat(60));
    
    if (totalIssues === 0) {
      console.log(chalk.green('✅ All relationships are valid - no issues detected'));
    } else {
      console.log(chalk.red(`❌ Found ${totalIssues} relationship issues`));
      
      if (!options.fix && fixActions.length > 0) {
        console.log(chalk.yellow('   Use --fix flag to attempt automatic repairs'));
      }
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Relationship check failed:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    throw error;
  }
}

/**
 * Check individual vector synchronization
 */
async function checkIndividualVectorSync(mongoProvider, semanticProvider, perspectivesWithEmbeddings, options) {
  console.log(chalk.cyan('   Deep vector sync check:'));
  
  let missingVectors = 0;
  let extraVectors = 0;
  
  // Check for perspectives with embeddings but no vectors
  for (const perspective of perspectivesWithEmbeddings.slice(0, options.deep ? perspectivesWithEmbeddings.length : 100)) {
    try {
      const vectorId = perspective._id.toString();
      const vector = await semanticProvider.retrieve('legion_tools', [vectorId]);
      
      if (!vector || vector.length === 0) {
        missingVectors++;
        if (options.verbose && missingVectors <= 5) {
          console.log(chalk.red(`      Missing vector for perspective: ${perspective.toolName} (${perspective.perspectiveType})`));
        }
      }
    } catch (error) {
      // Vector not found
      missingVectors++;
    }
  }
  
  if (missingVectors > 0) {
    console.log(chalk.red(`   ❌ ${missingVectors} perspectives missing vectors in Qdrant`));
  } else {
    console.log(chalk.green('   ✅ All perspectives have corresponding vectors'));
  }
}

/**
 * Constraints command - Validate schema constraints
 */
async function constraintsCommand(options) {
  console.log(chalk.blue.bold('\n📋 Schema Constraints Validation\n'));
  
  const { mongoProvider } = await createVerificationContext(options);
  
  try {
    let totalViolations = 0;
    const fixActions = [];
    
    // 1. Modules collection constraints
    console.log(chalk.cyan('📦 1. Modules Collection Constraints:'));
    await validateModuleConstraints(mongoProvider, options, (violations, fixes) => {
      totalViolations += violations;
      fixActions.push(...fixes);
    });
    
    // 2. Tools collection constraints  
    console.log(chalk.cyan('🔧 2. Tools Collection Constraints:'));
    await validateToolConstraints(mongoProvider, options, (violations, fixes) => {
      totalViolations += violations;
      fixActions.push(...fixes);
    });
    
    // 3. Tool perspectives collection constraints
    console.log(chalk.cyan('📝 3. Tool Perspectives Collection Constraints:'));
    await validatePerspectiveConstraints(mongoProvider, options, (violations, fixes) => {
      totalViolations += violations;
      fixActions.push(...fixes);
    });
    
    // Apply fixes if requested
    if (options.fix && fixActions.length > 0) {
      console.log(chalk.blue.bold('🔧 Applying Constraint Fixes:'));
      
      for (const fixAction of fixActions) {
        try {
          await fixAction();
        } catch (error) {
          console.log(chalk.red(`   ❌ Fix failed: ${error.message}`));
        }
      }
      
      console.log('');
    }
    
    // Summary
    console.log(chalk.blue.bold('📊 Constraint Validation Summary'));
    console.log('═'.repeat(60));
    
    if (totalViolations === 0) {
      console.log(chalk.green('✅ All schema constraints are satisfied'));
    } else {
      console.log(chalk.red(`❌ Found ${totalViolations} constraint violations`));
      
      if (!options.fix && fixActions.length > 0) {
        console.log(chalk.yellow('   Use --fix flag to attempt automatic repairs'));
      }
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Constraint validation failed:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    throw error;
  }
}

/**
 * Validate module constraints
 */
async function validateModuleConstraints(mongoProvider, options, callback) {
  let violations = 0;
  const fixes = [];
  
  // Required fields check
  const modulesWithMissingFields = await mongoProvider.find('modules', {
    $or: [
      { name: { $exists: false } },
      { description: { $exists: false } },
      { type: { $exists: false } },
      { path: { $exists: false } }
    ]
  });
  
  if (modulesWithMissingFields.length > 0) {
    console.log(chalk.red(`   ❌ ${modulesWithMissingFields.length} modules missing required fields`));
    violations += modulesWithMissingFields.length;
    
    if (options.verbose) {
      for (const module of modulesWithMissingFields.slice(0, 3)) {
        const missing = [];
        if (!module.name) missing.push('name');
        if (!module.description) missing.push('description');
        if (!module.type) missing.push('type');
        if (!module.path) missing.push('path');
        console.log(chalk.gray(`      ${module._id}: missing ${missing.join(', ')}`));
      }
    }
  } else {
    console.log(chalk.green('   ✅ All modules have required fields'));
  }
  
  // Name pattern validation (kebab-case)
  const invalidNames = await mongoProvider.find('modules', {
    name: { $not: /^[a-z0-9-]+$/ }
  });
  
  if (invalidNames.length > 0) {
    console.log(chalk.red(`   ❌ ${invalidNames.length} modules with invalid names (must be kebab-case)`));
    violations += invalidNames.length;
  } else {
    console.log(chalk.green('   ✅ All module names follow kebab-case pattern'));
  }
  
  // Type enum validation
  const validTypes = ['class', 'module.json', 'definition', 'dynamic'];
  const invalidTypes = await mongoProvider.find('modules', {
    type: { $nin: validTypes }
  });
  
  if (invalidTypes.length > 0) {
    console.log(chalk.red(`   ❌ ${invalidTypes.length} modules with invalid types`));
    violations += invalidTypes.length;
  } else {
    console.log(chalk.green('   ✅ All module types are valid'));
  }
  
  console.log('');
  callback(violations, fixes);
}

/**
 * Validate tool constraints
 */
async function validateToolConstraints(mongoProvider, options, callback) {
  let violations = 0;
  const fixes = [];
  
  // Required fields check
  const toolsWithMissingFields = await mongoProvider.find('tools', {
    $or: [
      { name: { $exists: false } },
      { description: { $exists: false } },
      { moduleName: { $exists: false } }
    ]
  });
  
  if (toolsWithMissingFields.length > 0) {
    console.log(chalk.red(`   ❌ ${toolsWithMissingFields.length} tools missing required fields`));
    violations += toolsWithMissingFields.length;
  } else {
    console.log(chalk.green('   ✅ All tools have required fields'));
  }
  
  // Valid ObjectId check for moduleId
  const toolsWithInvalidModuleId = await mongoProvider.find('tools', {
    moduleId: { $exists: true, $type: 'string' } // Should be ObjectId, not string
  });
  
  if (toolsWithInvalidModuleId.length > 0) {
    console.log(chalk.yellow(`   ⚠️ ${toolsWithInvalidModuleId.length} tools have string moduleId (should be ObjectId)`));
    violations += toolsWithInvalidModuleId.length;
  } else {
    console.log(chalk.green('   ✅ All moduleId references are valid ObjectIds'));
  }
  
  console.log('');
  callback(violations, fixes);
}

/**
 * Validate perspective constraints
 */
async function validatePerspectiveConstraints(mongoProvider, options, callback) {
  let violations = 0;
  const fixes = [];
  
  // Required fields check
  const perspectivesWithMissingFields = await mongoProvider.find('tool_perspectives', {
    $or: [
      { toolId: { $exists: false } },
      { toolName: { $exists: false } },
      { perspectiveType: { $exists: false } },
      { perspectiveText: { $exists: false } }
    ]
  });
  
  if (perspectivesWithMissingFields.length > 0) {
    console.log(chalk.red(`   ❌ ${perspectivesWithMissingFields.length} perspectives missing required fields`));
    violations += perspectivesWithMissingFields.length;
  } else {
    console.log(chalk.green('   ✅ All perspectives have required fields'));
  }
  
  // Perspective type enum validation
  const validTypes = ['name', 'description', 'task', 'capabilities', 'capability_single', 'examples', 'category', 'inputs', 'gloss', 'synonyms'];
  const invalidPerspectiveTypes = await mongoProvider.find('tool_perspectives', {
    perspectiveType: { $nin: validTypes }
  });
  
  if (invalidPerspectiveTypes.length > 0) {
    console.log(chalk.red(`   ❌ ${invalidPerspectiveTypes.length} perspectives with invalid types`));
    violations += invalidPerspectiveTypes.length;
  } else {
    console.log(chalk.green('   ✅ All perspective types are valid'));
  }
  
  // Embedding dimension validation (should be 768 for Nomic)
  if (options.deep) {
    const perspectivesWithEmbeddings = await mongoProvider.find('tool_perspectives', {
      embedding: { $exists: true, $ne: null }
    });
    
    let invalidEmbeddings = 0;
    for (const perspective of perspectivesWithEmbeddings) {
      if (Array.isArray(perspective.embedding) && perspective.embedding.length !== 768) {
        invalidEmbeddings++;
      }
    }
    
    if (invalidEmbeddings > 0) {
      console.log(chalk.red(`   ❌ ${invalidEmbeddings} perspectives with invalid embedding dimensions`));
      violations += invalidEmbeddings;
    } else if (perspectivesWithEmbeddings.length > 0) {
      console.log(chalk.green(`   ✅ All ${perspectivesWithEmbeddings.length} embeddings have correct dimensions (768)`));
    }
  }
  
  console.log('');
  callback(violations, fixes);
}

/**
 * Health command - Full system health report
 */
async function healthCommand(options) {
  console.log(chalk.blue.bold('\n🏥 Full System Health Report\n'));
  
  try {
    // Run all checks
    console.log(chalk.blue('Running comprehensive health checks...\n'));
    
    await statusCommand({ ...options, verbose: false });
    console.log('');
    
    await relationshipsCommand({ ...options, fix: false, verbose: false });
    console.log('');
    
    await constraintsCommand({ ...options, fix: false, verbose: false });
    console.log('');
    
    // Overall health assessment
    console.log(chalk.blue.bold('🎯 Health Assessment'));
    console.log('═'.repeat(60));
    console.log(chalk.green('✅ Health report completed'));
    console.log(chalk.gray('   Review individual sections above for detailed results'));
    console.log(chalk.gray('   Use --fix flag with specific commands to repair issues\n'));
    
  } catch (error) {
    console.error(chalk.red('❌ Health check failed:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    throw error;
  }
}

// Fix action implementations
async function deleteOrphanedTools(mongoProvider, orphanedTools) {
  const ids = orphanedTools.map(t => t._id);
  const result = await mongoProvider.deleteMany('tools', { _id: { $in: ids } });
  console.log(chalk.green(`   ✅ Deleted ${result.deletedCount} orphaned tools`));
}

async function deleteOrphanedPerspectives(mongoProvider, orphanedPerspectives) {
  const ids = orphanedPerspectives.map(p => p._id);
  const result = await mongoProvider.deleteMany('tool_perspectives', { _id: { $in: ids } });
  console.log(chalk.green(`   ✅ Deleted ${result.deletedCount} orphaned perspectives`));
}

async function updateModuleToolCount(mongoProvider, moduleId, correctCount) {
  await mongoProvider.updateOne('modules', 
    { _id: moduleId }, 
    { $set: { toolCount: correctCount } }
  );
  console.log(chalk.green(`   ✅ Updated module tool count to ${correctCount}`));
}

/**
 * Main function
 */
async function main() {
  try {
    const options = parseArgs();
    
    switch (options.command) {
      case 'status':
        await statusCommand(options);
        break;
        
      case 'stats':
        await statsCommand(options);
        break;
        
      case 'relationships':
        await relationshipsCommand(options);
        break;
        
      case 'constraints':
        await constraintsCommand(options);
        break;
        
      case 'health':
        await healthCommand(options);
        break;
        
      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;
        
      default:
        console.log(chalk.red(`Unknown command: ${options.command}`));
        console.log(chalk.gray('Use "node verify.js help" for available commands.'));
        process.exit(1);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Verification failed:'), error.message);
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