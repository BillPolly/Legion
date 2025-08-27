#!/usr/bin/env node

/**
 * Verify Modules Script
 * 
 * Checks all modules for compliance with Legion standards
 * 
 * Usage:
 *   node scripts/verify-modules.js                    # Verify all modules
 *   node scripts/verify-modules.js --module calculator # Verify specific module
 *   node scripts/verify-modules.js --fix              # Auto-fix issues
 *   node scripts/verify-modules.js --report detailed  # Generate detailed report
 */

import { ResourceManager } from '@legion/resource-manager';
import { TestRunner, AutoFixer } from '../src/verification/index.js';
import { DatabaseStorage } from '../src/core/DatabaseStorage.js';

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    moduleFilter: null,
    fix: args.includes('--fix'),
    report: args.includes('--report') ? args[args.indexOf('--report') + 1] || 'summary' : 'summary',
    verbose: args.includes('--verbose'),
    dryRun: args.includes('--dry-run')
  };
  
  // Check for specific module
  const moduleIndex = args.indexOf('--module');
  if (moduleIndex !== -1 && args[moduleIndex + 1]) {
    options.moduleFilter = args[moduleIndex + 1];
  }
  
  console.log('🔍 Legion Module Verification Tool\n');
  
  try {
    // Initialize ResourceManager
    const resourceManager = await ResourceManager.getInstance();
    
    // Initialize DatabaseStorage if needed
    let databaseStorage = null;
    try {
      databaseStorage = new DatabaseStorage();
      await databaseStorage.initialize();
    } catch (error) {
      console.warn('⚠️  Database not available, running without persistence');
    }
    
    // Create TestRunner
    const testRunner = new TestRunner({
      resourceManager,
      databaseStorage,
      verbose: options.verbose,
      moduleFilter: options.moduleFilter,
      includePerformance: false, // Skip performance tests for verification
      includeIntegration: false  // Skip integration tests for verification
    });
    
    // Listen to events for progress
    if (options.verbose) {
      testRunner.on('discovery:start', () => console.log('📦 Discovering modules...'));
      testRunner.on('discovery:complete', (data) => console.log(`✅ Found ${data.total} modules`));
      testRunner.on('loading:module', (data) => console.log(`  Loading ${data.name}...`));
      testRunner.on('validation:start', () => console.log('\n🔍 Validating metadata...'));
      testRunner.on('validation:complete', (data) => console.log('✅ Validation complete'));
    }
    
    // Run discovery and validation only
    console.log('🚀 Starting module verification...\n');
    
    const modules = await testRunner.discoverModules();
    console.log(`📦 Discovered ${modules.length} modules\n`);
    
    const loadedModules = await testRunner.loadModules(modules);
    console.log(`✅ Loaded ${loadedModules.length} modules\n`);
    
    const validation = await testRunner.validateModules(loadedModules);
    
    // Display results
    console.log('📊 Validation Results:\n');
    console.log(`  Modules: ${validation.summary.totalModules} total, ${validation.summary.validModules} valid`);
    console.log(`  Tools: ${validation.summary.totalTools} total, ${validation.summary.validTools} valid`);
    console.log(`  Average Module Score: ${Math.round(validation.summary.averageModuleScore)}%`);
    console.log(`  Average Tool Score: ${Math.round(validation.summary.averageToolScore)}%\n`);
    
    // Show detailed module results
    if (options.report === 'detailed' || options.verbose) {
      console.log('📋 Module Details:\n');
      for (const module of validation.modules) {
        const status = module.validation.score >= 80 ? '✅' : '❌';
        console.log(`${status} ${module.name}: ${module.validation.score}% compliance`);
        
        if (module.validation.errors.length > 0) {
          console.log('  Errors:');
          for (const error of module.validation.errors) {
            console.log(`    - ${error.message || error}`);
          }
        }
        
        if (module.validation.warnings.length > 0) {
          console.log('  Warnings:');
          for (const warning of module.validation.warnings) {
            console.log(`    - ${warning}`);
          }
        }
      }
      console.log();
    }
    
    // Show tool issues
    const problematicTools = validation.tools.filter(t => t.combinedScore < 80);
    if (problematicTools.length > 0) {
      console.log('⚠️  Tools needing attention:\n');
      for (const tool of problematicTools) {
        console.log(`  ${tool.module}/${tool.name}: ${Math.round(tool.combinedScore)}%`);
        
        if (!tool.metadata.valid) {
          console.log(`    - Metadata issues: ${tool.metadata.errors.length} errors`);
        }
        if (!tool.interface.valid) {
          console.log(`    - Interface issues: ${tool.interface.errors.length} errors`);
        }
        if (!tool.schemas.valid) {
          console.log(`    - Schema issues: ${tool.schemas.errors.length} errors`);
        }
      }
      console.log();
    }
    
    // Auto-fix if requested
    if (options.fix) {
      console.log('🔧 Attempting to auto-fix issues...\n');
      
      const autoFixer = new AutoFixer({
        dryRun: options.dryRun,
        verbose: options.verbose
      });
      
      let fixedCount = 0;
      for (const module of modules) {
        const result = await autoFixer.fixModule(module.path);
        if (result.fixed) {
          fixedCount++;
          console.log(`✅ Fixed ${module.name}`);
          if (result.changes.length > 0) {
            console.log(`   Changes: ${result.changes.map(c => c.description).join(', ')}`);
          }
        } else if (result.errors.length > 0) {
          console.log(`❌ Could not fix ${module.name}: ${result.errors.join(', ')}`);
        }
      }
      
      console.log(`\n🎉 Fixed ${fixedCount}/${modules.length} modules`);
      
      if (options.dryRun) {
        console.log('\n📝 This was a dry run - no files were actually modified');
      }
    }
    
    // Generate report if requested
    if (options.report !== 'none') {
      const reportGenerator = testRunner.reportGenerator;
      const report = await reportGenerator.generateComprehensiveReport({
        modules,
        validation,
        timestamp: new Date().toISOString()
      });
      
      console.log('\n📄 Report generated and saved to ./reports/');
    }
    
    // Exit with appropriate code
    const exitCode = validation.summary.averageModuleScore >= 80 ? 0 : 1;
    
    if (exitCode !== 0) {
      console.log('\n❌ Verification failed - modules do not meet compliance standards');
    } else {
      console.log('\n✅ All modules meet compliance standards');
    }
    
    process.exit(exitCode);
    
  } catch (error) {
    console.error('❌ Error during verification:', error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);