#!/usr/bin/env node

/**
 * Script to diagnose exactly why each module is failing validation
 * This will show us the exact error for each failing module
 */

import { ResourceManager } from '@legion/resource-manager';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// List of modules that are failing
const failingModules = [
  'MongoQueryModule', 
  'PictureAnalysisModule',
  'SDModule',
  'AIGenerationModule',
  'EncodeModule',
  'FileAnalysisModule',
  'SerperModule',
  'ServerStarterModule',
  'SystemModule'
];

// Map module names to their package paths
const modulePackageMap = {
  'MongoQueryModule': '@legion/mongo-query',
  'PictureAnalysisModule': '@legion/picture-analysis',
  'SDModule': '@legion/sd',
  'AIGenerationModule': '../tools-collection/src/ai-generation',
  'EncodeModule': '../tools-collection/src/encode',
  'FileAnalysisModule': '../tools-collection/src/file-analysis',
  'SerperModule': '../tools-collection/src/serper',
  'ServerStarterModule': '../tools-collection/src/server-starter',
  'SystemModule': '../tools-collection/src/system'
};

async function diagnoseModule(moduleName, packagePath) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Diagnosing: ${moduleName}`);
  console.log('='.repeat(60));
  
  const errors = [];
  
  try {
    // Try to import the module
    let ModuleClass;
    try {
      if (packagePath.startsWith('@legion/')) {
        // It's a package import
        const pkg = await import(packagePath);
        ModuleClass = pkg.default || pkg[moduleName] || pkg;
      } else {
        // It's a relative path
        const fullPath = path.resolve(__dirname, '../..', packagePath, `${moduleName}.js`);
        const fileImport = await import(fullPath);
        ModuleClass = fileImport.default || fileImport[moduleName] || fileImport;
      }
    } catch (importError) {
      errors.push(`❌ Import failed: ${importError.message}`);
      console.log(errors[errors.length - 1]);
      return errors;
    }
    
    console.log(`✅ Module imported successfully`);
    console.log(`   Type: ${typeof ModuleClass}`);
    console.log(`   Constructor name: ${ModuleClass?.constructor?.name || 'N/A'}`);
    
    // Check if it's a constructor
    if (typeof ModuleClass !== 'function') {
      errors.push(`❌ Module is not a constructor (type: ${typeof ModuleClass})`);
      console.log(errors[errors.length - 1]);
      return errors;
    }
    
    // Check for standard interface
    const hasStaticCreate = typeof ModuleClass.create === 'function';
    console.log(`   Has static create: ${hasStaticCreate}`);
    
    // Try to create an instance
    const resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    let instance;
    try {
      if (hasStaticCreate) {
        console.log('   Creating with static create method...');
        instance = await ModuleClass.create(resourceManager);
      } else {
        console.log('   Creating with constructor...');
        instance = new ModuleClass();
        if (typeof instance.initialize === 'function') {
          instance.resourceManager = resourceManager;
          await instance.initialize();
        }
      }
    } catch (createError) {
      errors.push(`❌ Failed to create instance: ${createError.message}`);
      console.log(errors[errors.length - 1]);
      console.log(`   Stack: ${createError.stack?.split('\n')[1]}`);
      return errors;
    }
    
    console.log(`✅ Instance created successfully`);
    
    // Check interface
    const checks = {
      'has name property': typeof instance.name === 'string',
      'has getTools method': typeof instance.getTools === 'function',
      'has initialize method': typeof instance.initialize === 'function',
      'has cleanup method': typeof instance.cleanup === 'function',
      'extends EventEmitter': typeof instance.on === 'function' && typeof instance.emit === 'function'
    };
    
    console.log('\nInterface checks:');
    for (const [check, result] of Object.entries(checks)) {
      console.log(`   ${result ? '✅' : '❌'} ${check}`);
      if (!result) {
        errors.push(`❌ Missing: ${check}`);
      }
    }
    
    // Try to get tools
    if (typeof instance.getTools === 'function') {
      try {
        const tools = instance.getTools();
        console.log(`\n✅ getTools() returned ${Array.isArray(tools) ? tools.length : 'non-array'} tools`);
        if (!Array.isArray(tools)) {
          errors.push(`❌ getTools() did not return an array`);
        }
      } catch (getToolsError) {
        errors.push(`❌ getTools() threw error: ${getToolsError.message}`);
        console.log(errors[errors.length - 1]);
      }
    }
    
    // Cleanup
    if (typeof instance.cleanup === 'function') {
      try {
        await instance.cleanup();
      } catch (cleanupError) {
        console.warn(`Warning: Cleanup failed: ${cleanupError.message}`);
      }
    }
    
  } catch (error) {
    errors.push(`❌ Unexpected error: ${error.message}`);
    console.log(errors[errors.length - 1]);
    console.log(`   Stack: ${error.stack?.split('\n').slice(1, 3).join('\n')}`);
  }
  
  if (errors.length === 0) {
    console.log('\n✅ Module is valid and follows the standard interface!');
  } else {
    console.log(`\n❌ Module has ${errors.length} issue(s)`);
  }
  
  return errors;
}

async function main() {
  console.log('Diagnosing failing modules...\n');
  
  const results = {};
  
  for (const moduleName of failingModules) {
    const packagePath = modulePackageMap[moduleName];
    if (!packagePath) {
      console.log(`\n⚠️  Skipping ${moduleName} - package path not mapped`);
      continue;
    }
    
    const errors = await diagnoseModule(moduleName, packagePath);
    results[moduleName] = errors;
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  const needsFix = Object.entries(results).filter(([_, errors]) => errors.length > 0);
  const working = Object.entries(results).filter(([_, errors]) => errors.length === 0);
  
  if (working.length > 0) {
    console.log('\n✅ Working modules:');
    for (const [name] of working) {
      console.log(`   - ${name}`);
    }
  }
  
  if (needsFix.length > 0) {
    console.log('\n❌ Modules needing fixes:');
    for (const [name, errors] of needsFix) {
      console.log(`   - ${name}: ${errors[0]}`);
    }
  }
  
  process.exit(needsFix.length > 0 ? 1 : 0);
}

main().catch(console.error);