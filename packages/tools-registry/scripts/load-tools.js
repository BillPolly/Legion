#!/usr/bin/env node

/**
 * Load Tools Script
 * 
 * Loads tools from modules into the tools collection
 * Part of the canonical tools-registry scripts
 * 
 * Usage:
 *   node scripts/load-tools.js                    # Load all tools
 *   node scripts/load-tools.js --module FileModule  # Load specific module
 *   node scripts/load-tools.js --clear            # Clear before loading
 */

import { ResourceManager } from '../../resource-manager/src/ResourceManager.js';
import { DatabaseStorage } from '../src/core/DatabaseStorage.js';
import { ModuleLoader } from '../src/core/ModuleLoader.js';
import { ModuleRegistry } from '../src/core/ModuleRegistry.js';

async function loadTools(options = {}) {
  const { moduleName, clear = false, verbose = false } = options;
  
  let resourceManager;
  let databaseStorage;
  let moduleLoader;
  let moduleRegistry;
  
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
    
    // Initialize ModuleLoader and Registry
    moduleLoader = new ModuleLoader({ resourceManager });
    moduleRegistry = new ModuleRegistry({ 
      resourceManager,
      databaseStorage 
    });
    
    if (clear) {
      console.log('🧹 Clearing existing tools...');
      await databaseStorage.db.collection('tools').deleteMany({});
    }
    
    // Get modules to load
    let modules = [];
    if (moduleName) {
      console.log(`📦 Loading tools from ${moduleName}...`);
      const module = await moduleLoader.loadModule(moduleName);
      if (module) {
        modules = [module];
      } else {
        throw new Error(`Module not found: ${moduleName}`);
      }
    } else {
      console.log('📦 Loading tools from all modules...');
      // Load some common modules from tools-collection
      const moduleNames = [
        '../tools-collection/src/file',
        '../tools-collection/src/calculator', 
        '../tools-collection/src/json',
        '../tools-collection/src/command-executor'
      ];
      
      for (const name of moduleNames) {
        try {
          const module = await moduleLoader.loadModule(name);
          if (module) {
            modules.push(module);
          }
        } catch (error) {
          if (verbose) {
            console.warn(`  ⚠️ Could not load ${name}: ${error.message}`);
          }
        }
      }
    }
    
    // Load tools from modules
    let totalTools = 0;
    for (const module of modules) {
      const moduleName = module.getName ? module.getName() : 'Unknown';
      console.log(`\n🔧 Processing ${moduleName}...`);
      
      if (module.getTools) {
        const tools = module.getTools();
        for (const tool of tools) {
          const toolDoc = {
            _id: `${moduleName.toLowerCase()}:${tool.name}`,
            name: tool.name,
            description: tool.description || '',
            moduleName: moduleName,
            inputSchema: tool.inputSchema || {},
            outputSchema: tool.outputSchema || {},
            category: tool.category || 'general',
            tags: tool.tags || [],
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          // Upsert tool
          await databaseStorage.db.collection('tools').replaceOne(
            { _id: toolDoc._id },
            toolDoc,
            { upsert: true }
          );
          
          if (verbose) {
            console.log(`  ✅ ${tool.name}`);
          }
          totalTools++;
        }
      }
    }
    
    console.log(`\n✅ Loaded ${totalTools} tools from ${modules.length} modules`);
    
    // Show statistics
    const stats = await databaseStorage.db.collection('tools').countDocuments();
    console.log(`📊 Total tools in database: ${stats}`);
    
  } catch (error) {
    console.error('❌ Error loading tools:', error.message);
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
  moduleName: null,
  clear: false,
  verbose: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--module' && args[i + 1]) {
    options.moduleName = args[i + 1];
    i++;
  } else if (args[i] === '--clear') {
    options.clear = true;
  } else if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Load Tools Script

Usage:
  node scripts/load-tools.js [options]

Options:
  --module <name>  Load tools from specific module
  --clear          Clear existing tools before loading
  --verbose, -v    Show detailed output
  --help, -h       Show this help message

Examples:
  node scripts/load-tools.js
  node scripts/load-tools.js --module FileModule
  node scripts/load-tools.js --clear --verbose
    `);
    process.exit(0);
  }
}

// Run the script
loadTools(options).catch(console.error);