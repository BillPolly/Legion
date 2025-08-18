#!/usr/bin/env node

/**
 * Verify Discovered Modules Script
 * 
 * Checks that all modules found by discovery actually exist and are accessible
 */

import { MongoDBToolRegistryProvider } from '../src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function verifyDiscoveredModules() {
  console.log(chalk.blue.bold('\n🔍 Verifying Discovered Modules\n'));
  
  try {
    // Initialize ResourceManager
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Initialize database provider
    const provider = await MongoDBToolRegistryProvider.create(resourceManager, {
      enableSemanticSearch: false
    });
    
    // Get all discovered modules from database
    const modules = await provider.databaseService.mongoProvider.find('modules', {});
    
    console.log(chalk.cyan(`📦 Found ${modules.length} modules in database`));
    console.log('');
    
    const results = {
      total: modules.length,
      accessible: 0,
      missing: 0,
      importable: 0,
      instantiable: 0,
      hasGetTools: 0,
      errors: []
    };
    
    // Get monorepo root from ResourceManager
    const monorepoRoot = resourceManager.get('env.MONOREPO_ROOT') || process.cwd();
    console.log(chalk.gray(`📁 Monorepo root: ${monorepoRoot}`));
    console.log('');
    
    for (const module of modules) {
      const moduleName = module.name || module.className || 'Unknown';
      console.log(chalk.blue(`🔧 Verifying: ${moduleName}`));
      console.log(chalk.gray(`   Path: ${module.filePath}`));
      
      // Check if file exists
      const fullPath = path.join(monorepoRoot, module.filePath);
      try {
        await fs.access(fullPath);
        console.log(chalk.green(`   ✅ File exists`));
        results.accessible++;
      } catch (error) {
        console.log(chalk.red(`   ❌ File missing: ${error.message}`));
        results.missing++;
        results.errors.push({
          module: moduleName,
          error: `File missing: ${module.filePath}`,
          type: 'missing_file'
        });
        continue;
      }
      
      // Try to import the module (skip JSON modules - they're handled differently)
      if (module.type === 'json') {
        console.log(chalk.green(`   ✅ JSON module - no import needed`));
        results.importable++;
        results.instantiable++;
        console.log(chalk.green(`   ✅ JSON tools available`));
        results.hasGetTools++;
        continue;
      }
      
      try {
        const importPath = path.resolve(fullPath);
        const moduleImport = await import(`file://${importPath}`);
        console.log(chalk.green(`   ✅ Importable`));
        results.importable++;
        
        // Check what's exported
        const exports = Object.keys(moduleImport);
        console.log(chalk.gray(`   Exports: ${exports.join(', ')}`));
        
        // Try to find the main class
        let ModuleClass = null;
        if (moduleImport.default) {
          ModuleClass = moduleImport.default;
        } else if (module.className && moduleImport[module.className]) {
          ModuleClass = moduleImport[module.className];
        } else {
          // Try to find any class that ends with 'Module'
          for (const exportName of exports) {
            if (exportName.endsWith('Module') && typeof moduleImport[exportName] === 'function') {
              ModuleClass = moduleImport[exportName];
              break;
            }
          }
        }
        
        if (ModuleClass && typeof ModuleClass === 'function') {
          console.log(chalk.green(`   ✅ Found module class: ${ModuleClass.name}`));
          
          // Try to instantiate
          try {
            let instance = null;
            
            // Try different instantiation methods
            if (ModuleClass.create && typeof ModuleClass.create === 'function') {
              instance = await ModuleClass.create(resourceManager);
              console.log(chalk.green(`   ✅ Instantiated via create()`));
            } else {
              try {
                instance = new ModuleClass();
                if (instance.initialize && typeof instance.initialize === 'function') {
                  await instance.initialize();
                }
                console.log(chalk.green(`   ✅ Instantiated via constructor`));
              } catch (e) {
                // Try with empty object
                instance = new ModuleClass({});
                console.log(chalk.green(`   ✅ Instantiated with empty config`));
              }
            }
            
            results.instantiable++;
            
            // Check for getTools method
            if (instance && typeof instance.getTools === 'function') {
              try {
                const tools = instance.getTools();
                const toolCount = Array.isArray(tools) ? tools.length : (tools ? Object.keys(tools).length : 0);
                console.log(chalk.green(`   ✅ Has getTools() method - ${toolCount} tools`));
                results.hasGetTools++;
              } catch (e) {
                console.log(chalk.yellow(`   ⚠️  getTools() method exists but failed: ${e.message}`));
              }
            } else {
              console.log(chalk.yellow(`   ⚠️  No getTools() method found`));
            }
            
          } catch (error) {
            console.log(chalk.yellow(`   ⚠️  Cannot instantiate: ${error.message}`));
            results.errors.push({
              module: moduleName,
              error: `Cannot instantiate: ${error.message}`,
              type: 'instantiation_error'
            });
          }
        } else {
          console.log(chalk.yellow(`   ⚠️  No module class found in exports`));
          results.errors.push({
            module: moduleName,
            error: `No module class found`,
            type: 'no_class'
          });
        }
        
      } catch (error) {
        console.log(chalk.red(`   ❌ Import failed: ${error.message}`));
        results.importable++;
        results.errors.push({
          module: moduleName,
          error: `Import failed: ${error.message}`,
          type: 'import_error'
        });
      }
      
      console.log('');
    }
    
    // Summary
    console.log(chalk.blue.bold('📊 Verification Summary'));
    console.log('═'.repeat(60));
    console.log(chalk.white(`Total modules: ${results.total}`));
    console.log(chalk.green(`✅ Files accessible: ${results.accessible}`));
    console.log(chalk.red(`❌ Files missing: ${results.missing}`));
    console.log(chalk.green(`✅ Importable: ${results.importable}`));
    console.log(chalk.green(`✅ Instantiable: ${results.instantiable}`));
    console.log(chalk.green(`✅ Have getTools(): ${results.hasGetTools}`));
    console.log('');
    
    // Success rate
    const accessRate = (results.accessible / results.total * 100).toFixed(1);
    const importRate = (results.importable / results.total * 100).toFixed(1);
    const instantiateRate = (results.instantiable / results.total * 100).toFixed(1);
    const toolsRate = (results.hasGetTools / results.total * 100).toFixed(1);
    
    console.log(chalk.cyan('📈 Success Rates:'));
    console.log(chalk.white(`   File accessibility: ${accessRate}%`));
    console.log(chalk.white(`   Import success: ${importRate}%`));
    console.log(chalk.white(`   Instantiation success: ${instantiateRate}%`));
    console.log(chalk.white(`   Has getTools(): ${toolsRate}%`));
    console.log('');
    
    // Error breakdown
    if (results.errors.length > 0) {
      console.log(chalk.yellow.bold('⚠️  Issues Found:'));
      console.log('━'.repeat(40));
      
      const errorsByType = {};
      results.errors.forEach(error => {
        if (!errorsByType[error.type]) {
          errorsByType[error.type] = [];
        }
        errorsByType[error.type].push(error);
      });
      
      for (const [type, errors] of Object.entries(errorsByType)) {
        console.log(chalk.yellow(`\n${type}: ${errors.length} modules`));
        errors.forEach(error => {
          console.log(chalk.gray(`   • ${error.module}: ${error.error}`));
        });
      }
    }
    
    await provider.disconnect();
    
    // Exit with appropriate code
    const criticalIssues = results.missing + results.errors.filter(e => e.type === 'import_error').length;
    if (criticalIssues > 0) {
      console.log(chalk.red(`\n❌ ${criticalIssues} critical issues found`));
      process.exit(1);
    } else {
      console.log(chalk.green('\n✅ All modules verified successfully!'));
      process.exit(0);
    }
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Verification failed:'), error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Removed findMonorepoRoot function - using ResourceManager instead

// Run the verification
verifyDiscoveredModules().catch(error => {
  console.error(chalk.red('❌ Fatal error:'), error);
  process.exit(1);
});