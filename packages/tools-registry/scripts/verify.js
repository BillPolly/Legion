#!/usr/bin/env node

/**
 * Tool Registry Verification Script
 * 
 * Simple script wrapper around the Verifier class.
 * All verification logic is in src/verification/Verifier.js
 * 
 * Usage:
 *   node verify.js status [--verbose]       # Quick health check
 *   node verify.js health [--verbose]       # Full system verification
 *   node verify.js help                     # Show this help
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
    command,
    verbose: args.includes('--verbose') || args.includes('-v'),
    dryRun: args.includes('--dry-run'),
    repair: args.includes('--repair')
  };

  return options;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(chalk.blue.bold('Tool Registry Verification\n'));
  console.log('Centralized validation and consistency checking for tool registry data.');
  console.log('Uses the enhanced ToolRegistry API with comprehensive inconsistency detection.\n');
  
  console.log(chalk.yellow('Commands:'));
  console.log('  status                       Quick health check and counts');
  console.log('  health                       Full system verification');
  console.log('  inconsistencies              Comprehensive inconsistency detection');
  console.log('  validate                     Validate and optionally repair inconsistencies');
  console.log('  clearing                     Verify that database clearing worked correctly');
  console.log('  state                        Show current validation state');
  console.log('  help                         Show this help message\n');
  
  console.log(chalk.yellow('Options:'));
  console.log('  --verbose, -v                Show detailed output');
  console.log('  --dry-run                    Only detect issues, don\'t repair (validate command)');
  console.log('  --repair                     Apply safe repairs (validate command)\n');
  
  console.log(chalk.yellow('Examples:'));
  console.log('  node verify.js status --verbose');
  console.log('  node verify.js health --verbose');
  console.log('  node verify.js inconsistencies --verbose');
  console.log('  node verify.js validate --dry-run --verbose');
  console.log('  node verify.js validate --repair --verbose');
  console.log('  node verify.js clearing');
  console.log('  node verify.js state');
}

/**
 * Status command - quick health check
 */
async function statusCommand(options) {
  try {
    console.log(chalk.blue.bold('📊 Quick Status Check\n'));
    
    const toolRegistry = ToolRegistry.getInstance();
    await toolRegistry.initialize();
    
    // Use centralized validation API instead of direct loader access
    const health = await toolRegistry.quickHealthCheck();
    
    console.log(chalk.blue('📋 Counts:'));
    Object.entries(health.counts).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    
    if (health.ratios && Object.keys(health.ratios).length > 0) {
      console.log(chalk.blue('\n📈 Key Ratios:'));
      Object.entries(health.ratios).forEach(([key, value]) => {
        console.log(`   ${key}: ${value.toFixed(2)}`);
      });
    }
    
    console.log(`\n📊 Overall Status: ${health.healthy ? chalk.green('✅ HEALTHY') : chalk.red('❌ ISSUES FOUND')}`);
    
    if (health.issues.length > 0) {
      console.log(chalk.red('\n❌ Issues:'));
      health.issues.forEach(issue => console.log(`   • ${issue}`));
    }
    
  } catch (error) {
    console.error(chalk.red(`❌ Status check failed: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Health command - full system verification
 */
async function healthCommand(options) {
  try {
    console.log(chalk.blue.bold('🏥 Full System Verification\n'));
    
    const toolRegistry = ToolRegistry.getInstance();
    await toolRegistry.initialize();
    
    // Use centralized validation API instead of direct loader access
    const verification = await toolRegistry.verifySystem({ 
      verbose: options.verbose 
    });
    
    if (!options.verbose) {
      // Show summary only
      console.log(chalk.blue('📊 Summary:'));
      console.log(`   Overall Status: ${verification.success ? chalk.green('✅ PASS') : chalk.red('❌ FAIL')}`);
      console.log(`   Tools: ${verification.counts.tools}`);
      console.log(`   Perspectives: ${verification.counts.perspectives}`);
      console.log(`   Vectors: ${verification.counts.vectors}`);
      console.log(`   Ratio (perspectives/tool): ${verification.ratios.perspectivesPerTool?.toFixed(2) || 'N/A'}`);
      
      if (verification.errors.length > 0) {
        console.log(chalk.red(`\n❌ Errors: ${verification.errors.length}`));
        verification.errors.forEach(error => console.log(`   • ${error}`));
      }
      
      if (verification.warnings.length > 0) {
        console.log(chalk.yellow(`\n⚠️ Warnings: ${verification.warnings.length}`));
        if (!options.verbose) {
          console.log('   Use --verbose to see details');
        }
      }
    }
    
    if (!verification.success) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error(chalk.red(`❌ Health check failed: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Inconsistencies command - comprehensive inconsistency detection
 */
async function inconsistenciesCommand(options) {
  try {
    console.log(chalk.blue.bold('🔍 Comprehensive Inconsistency Detection\n'));
    
    const toolRegistry = ToolRegistry.getInstance();
    await toolRegistry.initialize();
    
    // Run comprehensive inconsistency detection
    const report = await toolRegistry.detectInconsistencies({ 
      verbose: options.verbose 
    });
    
    if (!options.verbose) {
      // Show summary only
      console.log(chalk.blue('📊 Inconsistency Summary:'));
      console.log(`   Overall Status: ${report.success ? chalk.green('✅ CLEAN') : chalk.red('❌ ISSUES FOUND')}`);
      console.log(`   Total Issues: ${report.summary.totalIssues}`);
      console.log(`   Critical Issues: ${report.summary.criticalIssues}`);
      console.log(`   Warning Issues: ${report.summary.warningIssues}`);
      
      if (report.summary.totalIssues > 0) {
        console.log(chalk.blue('\n📊 Issues by Category:'));
        Object.entries(report.summary.categoryCounts).forEach(([category, count]) => {
          if (count > 0) {
            console.log(`   ${category}: ${count}`);
          }
        });
      }
      
      if (report.repairRecommendations.length > 0) {
        console.log(chalk.yellow('\n🔧 Repair Recommendations:'));
        report.repairRecommendations.forEach(rec => {
          console.log(`   [${rec.priority.toUpperCase()}] ${rec.description} (${rec.affectedRecords} records)`);
        });
        console.log('\n   Use --verbose to see detailed issues');
        console.log('   Use "node verify.js validate --dry-run" to see repair plan');
      }
    }
    
    if (!report.success) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error(chalk.red(`❌ Inconsistency detection failed: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Validate command - validate and optionally repair inconsistencies
 */
async function validateCommand(options) {
  try {
    const action = options.repair ? 'Repair' : 'Validation';
    console.log(chalk.blue.bold(`🔧 Database ${action}\n`));
    
    const toolRegistry = ToolRegistry.getInstance();
    await toolRegistry.initialize();
    
    // Run validation and repair
    const result = await toolRegistry.validateAndRepair({ 
      dryRun: !options.repair,
      verbose: options.verbose
    });
    
    console.log(chalk.blue('📊 Validation Summary:'));
    console.log(`   Detection Status: ${result.detectionReport.success ? chalk.green('✅ CLEAN') : chalk.red('❌ ISSUES FOUND')}`);
    console.log(`   Total Issues Found: ${result.detectionReport.summary.totalIssues}`);
    console.log(`   Critical Issues: ${result.detectionReport.summary.criticalIssues}`);
    console.log(`   Warning Issues: ${result.detectionReport.summary.warningIssues}`);
    
    if (options.repair) {
      console.log(`   Repairs Attempted: ${result.repairsAttempted.length}`);
      console.log(`   Repairs Successful: ${result.repairsSuccessful.length}`);
      console.log(`   Repairs Failed: ${result.repairsFailed.length}`);
    } else {
      console.log(`   Mode: ${chalk.yellow('DRY RUN')} - no changes made`);
    }
    
    if (result.detectionReport.repairRecommendations.length > 0) {
      console.log(chalk.yellow('\n🔧 Recommended Actions:'));
      result.detectionReport.repairRecommendations.forEach(rec => {
        const status = options.repair ? '🔧' : '📋';
        console.log(`   ${status} [${rec.priority.toUpperCase()}] ${rec.description} (${rec.affectedRecords} records)`);
      });
      
      if (!options.repair) {
        console.log(chalk.blue('\n💡 To apply safe repairs, run:'));
        console.log('   node verify.js validate --repair --verbose');
      }
    }
    
    if (result.detectionReport.summary.criticalIssues > 0 && !options.repair) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error(chalk.red(`❌ Validation failed: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Clearing command - verify that database clearing worked correctly
 */
async function clearingCommand(options) {
  try {
    console.log(chalk.blue.bold('🧹 Database Clearing Verification\n'));
    
    const toolRegistry = ToolRegistry.getInstance();
    await toolRegistry.initialize();
    
    // Verify clearing worked
    const clearingResult = await toolRegistry.verifyClearingWorked();
    const moduleResult = await toolRegistry.verifyModulesUnloaded();
    
    console.log(chalk.blue('📊 Clearing Verification:'));
    console.log(`   Overall Status: ${clearingResult.success && moduleResult.success ? chalk.green('✅ SUCCESS') : chalk.red('❌ FAILED')}`);
    
    console.log(chalk.blue('\n📋 Cleared Counts:'));
    Object.entries(clearingResult.clearedCounts).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    
    console.log(chalk.blue('\n📋 Module Status:'));
    if (moduleResult.moduleStats) {
      Object.entries(moduleResult.moduleStats).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });
    }
    
    if (clearingResult.errors.length > 0) {
      console.log(chalk.red('\n❌ Clearing Issues:'));
      clearingResult.errors.forEach(error => console.log(`   • ${error}`));
    }
    
    if (moduleResult.errors.length > 0) {
      console.log(chalk.red('\n❌ Module Status Issues:'));
      moduleResult.errors.forEach(error => console.log(`   • ${error}`));
    }
    
    if (!clearingResult.success || !moduleResult.success) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error(chalk.red(`❌ Clearing verification failed: ${error.message}`));
    process.exit(1);
  }
}

/**
 * State command - show current validation state
 */
async function stateCommand(options) {
  try {
    console.log(chalk.blue.bold('📊 Current Validation State\n'));
    
    const toolRegistry = ToolRegistry.getInstance();
    await toolRegistry.initialize();
    
    // Get current validation state
    const state = await toolRegistry.getValidationState();
    
    console.log(chalk.blue('📋 Current Counts:'));
    Object.entries(state.counts).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    
    console.log(chalk.blue('\n📈 Key Ratios:'));
    Object.entries(state.ratios).forEach(([key, value]) => {
      console.log(`   ${key}: ${value.toFixed(2)}`);
    });
    
    console.log(`\n📊 Health Status: ${state.healthy ? chalk.green('✅ HEALTHY') : chalk.red('❌ ISSUES DETECTED')}`);
    console.log(`📅 Timestamp: ${state.timestamp}`);
    
    if (!state.healthy) {
      console.log(chalk.yellow('\n💡 Run detailed checks:'));
      console.log('   node verify.js health --verbose');
      console.log('   node verify.js inconsistencies --verbose');
    }
    
  } catch (error) {
    console.error(chalk.red(`❌ State check failed: ${error.message}`));
    process.exit(1);
  }
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
        
      case 'health':
        await healthCommand(options);
        break;
        
      case 'inconsistencies':
        await inconsistenciesCommand(options);
        break;
        
      case 'validate':
        await validateCommand(options);
        break;
        
      case 'clearing':
        await clearingCommand(options);
        break;
        
      case 'state':
        await stateCommand(options);
        break;
        
      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;
        
      default:
        console.error(chalk.red(`Unknown command: ${options.command}`));
        console.log('Use "node verify.js help" for available commands.');
        process.exit(1);
    }
    
  } catch (error) {
    console.error(chalk.red(`Verification failed: ${error.message}`));
    process.exit(1);
  }
}

main();