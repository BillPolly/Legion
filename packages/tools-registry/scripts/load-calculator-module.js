#!/usr/bin/env node

/**
 * Load Calculator Module Script
 * 
 * Loads ONLY the calculator module from tools-collection for integration testing.
 * This ensures a clean, controlled test environment with exactly one module.
 * 
 * Usage:
 *   node scripts/load-calculator-module.js           # Load calculator module
 *   node scripts/load-calculator-module.js --verbose # Show detailed output
 *   node scripts/load-calculator-module.js --verify  # Verify after loading
 */

import { ResourceManager } from '../../resource-manager/src/ResourceManager.js';
import { DatabaseStorage } from '../src/core/DatabaseStorage.js';
import { ModuleLoader } from '../src/core/ModuleLoader.js';

async function loadCalculatorModule(options = {}) {
  const { verbose = false, verify = false } = options;
  
  let resourceManager;
  let databaseStorage;
  let moduleLoader;
  
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
    
    // Initialize ModuleLoader
    moduleLoader = new ModuleLoader({ resourceManager });
    
    console.log('📦 Load Calculator Module for Integration Tests\n');
    console.log('=' + '='.repeat(50));
    
    // Check current state
    const db = databaseStorage.db;
    const existingTools = await db.collection('tools').countDocuments();
    
    console.log('\n📊 Current State:');
    console.log(`  Existing tools: ${existingTools}`);
    
    if (existingTools > 0) {
      console.log('\n⚠️  WARNING: Database already contains tools!');
      console.log('   Consider running: node scripts/reset-database-for-tests.js');
      console.log('   to ensure a clean test environment.');
    }
    
    // Load calculator module
    console.log('\n🔧 Loading Calculator Module...');
    const calculatorModulePath = '../tools-collection/src/calculator';
    
    if (verbose) {
      console.log(`  Module path: ${calculatorModulePath}`);
    }
    
    // Load the module
    const module = await moduleLoader.loadModule(calculatorModulePath);
    
    if (!module) {
      throw new Error('Failed to load calculator module');
    }
    
    // Get module metadata
    const metadata = await moduleLoader.getModuleMetadata(module);
    console.log(`  ✅ Loaded module: ${metadata.name} v${metadata.version}`);
    console.log(`  📝 Description: ${metadata.description}`);
    
    // Get tools from module
    const tools = await moduleLoader.getTools(module);
    console.log(`  🔧 Found ${tools.length} tools`);
    
    if (verbose) {
      tools.forEach(tool => {
        console.log(`    - ${tool.name}: ${tool.description}`);
      });
    }
    
    // Save tools to database
    console.log('\n💾 Saving tools to database...');
    let savedCount = 0;
    
    for (const tool of tools) {
      const toolDoc = {
        _id: `${metadata.name.toLowerCase()}:${tool.name}`,
        name: tool.name,
        description: tool.description || '',
        moduleName: metadata.name,
        inputSchema: tool.inputSchema || {},
        outputSchema: tool.outputSchema || {},
        category: tool.category || 'general',
        tags: tool.tags || [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Upsert tool
      await db.collection('tools').replaceOne(
        { _id: toolDoc._id },
        toolDoc,
        { upsert: true }
      );
      
      if (verbose) {
        console.log(`  ✅ Saved: ${tool.name}`);
      }
      savedCount++;
    }
    
    console.log(`  ✅ Saved ${savedCount} tools to database`);
    
    // Verify if requested
    if (verify) {
      console.log('\n🔍 Verification:');
      
      // Check database state
      const finalToolCount = await db.collection('tools').countDocuments();
      const calculatorTools = await db.collection('tools')
        .find({ moduleName: metadata.name })
        .toArray();
      
      console.log(`  Total tools in database: ${finalToolCount}`);
      console.log(`  Calculator module tools: ${calculatorTools.length}`);
      
      // Verify calculator tool exists and has proper structure
      const calculatorTool = calculatorTools.find(t => t.name === 'calculator');
      if (calculatorTool) {
        console.log('  ✅ Calculator tool found with:');
        console.log(`    - Name: ${calculatorTool.name}`);
        console.log(`    - Description: ${calculatorTool.description}`);
        console.log(`    - Input schema: ${calculatorTool.inputSchema ? 'Present' : 'Missing'}`);
        console.log(`    - Output schema: ${calculatorTool.outputSchema ? 'Present' : 'Missing'}`);
        
        // Test tool execution
        try {
          console.log('\n🧪 Testing tool execution...');
          const result = await moduleLoader.invokeTool(
            tools.find(t => t.name === 'calculator'), 
            { expression: '2 + 2' }
          );
          console.log(`  ✅ Test execution successful: ${result.expression} = ${result.result}`);
        } catch (error) {
          console.log(`  ❌ Test execution failed: ${error.message}`);
        }
      } else {
        console.log('  ❌ Calculator tool not found!');
      }
    }
    
    // Show final statistics
    console.log('\n📊 Final State:');
    const perspectiveTypesCount = await db.collection('perspective_types').countDocuments();
    const finalToolsCount = await db.collection('tools').countDocuments();
    const perspectivesCount = await db.collection('tool_perspectives').countDocuments();
    
    console.log(`  Perspective Types: ${perspectiveTypesCount}`);
    console.log(`  Tools: ${finalToolsCount}`);
    console.log(`  Tool Perspectives: ${perspectivesCount}`);
    
    console.log('\n✅ Calculator module loading complete!');
    
    // Suggest next steps
    console.log('\n💡 Next Steps:');
    if (perspectivesCount === 0) {
      console.log('  1. Generate perspectives: node scripts/generate-real-perspectives.js');
      console.log('  2. Verify results: node scripts/verify-perspectives.js');
    } else {
      console.log('  1. Verify existing perspectives: node scripts/verify-perspectives.js');
    }
    
  } catch (error) {
    console.error('❌ Error loading calculator module:', error.message);
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
  verify: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--verify') {
    options.verify = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Load Calculator Module Script

Usage:
  node scripts/load-calculator-module.js [options]

Options:
  --verbose, -v    Show detailed output
  --verify         Verify module loading and test tool execution
  --help, -h       Show this help message

Description:
  Loads ONLY the calculator module from tools-collection for integration testing.
  This ensures a clean, controlled test environment with exactly one module.
  
  The script will:
  - Load the calculator module from ../tools-collection/src/calculator
  - Extract tools and metadata
  - Save tools to the database
  - Optionally verify the loading and test tool execution

Examples:
  node scripts/load-calculator-module.js
  node scripts/load-calculator-module.js --verbose --verify
    `);
    process.exit(0);
  }
}

// Run the script
loadCalculatorModule(options).catch(console.error);