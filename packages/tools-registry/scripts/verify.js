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
    verbose: args.includes('--verbose') || args.includes('-v')
  };

  return options;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(chalk.blue.bold('Tool Registry Verification\n'));
  console.log('Simple wrapper around the Verifier class.');
  console.log('All verification logic is in src/verification/Verifier.js\n');
  
  console.log(chalk.yellow('Commands:'));
  console.log('  status                       Quick health check and counts');
  console.log('  health                       Full system verification');
  console.log('  help                         Show this help message\n');
  
  console.log(chalk.yellow('Options:'));
  console.log('  --verbose, -v                Show detailed output\n');
  
  console.log(chalk.yellow('Examples:'));
  console.log('  node verify.js status --verbose');
  console.log('  node verify.js health --verbose');
}

/**
 * Status command - quick health check
 */
async function statusCommand(options) {
  try {
    console.log(chalk.blue.bold('📊 Quick Status Check\n'));
    
    const toolRegistry = new ToolRegistry();
    await toolRegistry.initialize();
    const loader = toolRegistry.getLoader();
    
    if (!loader.verifier) {
      console.log(chalk.red('❌ Verifier not initialized - run pipeline first'));
      return;
    }
    
    const health = await loader.verifier.quickHealthCheck();
    
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
    
    const toolRegistry = new ToolRegistry();
    await toolRegistry.initialize();
    const loader = toolRegistry.getLoader();
    
    if (!loader.verifier) {
      console.log(chalk.red('❌ Verifier not initialized - run pipeline first'));
      return;
    }
    
    const verification = await loader.verifier.verifySystem();
    
    if (options.verbose) {
      loader.verifier.logResults(verification);
    } else {
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