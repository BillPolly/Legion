#!/usr/bin/env node

/**
 * Utility script to check available tools from a Legion module
 * Usage: node scripts/utils/check-module-tools.js [module-name]
 */

import { ResourceManager, ModuleLoader } from '@legion/module-loader';

async function checkModuleTools(moduleName = 'file') {
  console.log(`\n📦 Checking tools from module: ${moduleName}\n`);
  console.log('=' . repeat(60));
  
  try {
    // Initialize ResourceManager
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    console.log('✓ ResourceManager initialized');
    
    // Initialize ModuleLoader
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();
    console.log('✓ ModuleLoader initialized');
    
    // Load the specified module
    console.log(`\n🔄 Loading module '${moduleName}'...`);
    await moduleLoader.loadModuleByName(moduleName);
    console.log(`✓ Module '${moduleName}' loaded successfully`);
    
    // Get all available tools
    const tools = await moduleLoader.getAllTools();
    
    if (!tools || tools.length === 0) {
      console.log(`\n⚠️  No tools found after loading module '${moduleName}'`);
      return;
    }
    
    console.log(`\n🛠️  Available tools (${tools.length}):\n`);
    
    // Display each tool with details
    for (const tool of tools) {
      console.log(`  📌 ${tool.name}`);
      
      if (tool.description) {
        console.log(`     Description: ${tool.description}`);
      }
      
      // Check if tool has input schema
      if (tool.inputSchema) {
        console.log(`     Has input schema: ✓`);
        
        // Show required parameters if available
        if (tool.inputSchema.shape) {
          const required = [];
          const optional = [];
          
          for (const [key, schema] of Object.entries(tool.inputSchema.shape)) {
            if (schema.isOptional && !schema.isOptional()) {
              required.push(key);
            } else {
              optional.push(key);
            }
          }
          
          if (required.length > 0) {
            console.log(`     Required params: ${required.join(', ')}`);
          }
          if (optional.length > 0) {
            console.log(`     Optional params: ${optional.join(', ')}`);
          }
        }
      }
      
      // Check for execute method
      if (typeof tool.execute === 'function') {
        console.log(`     Execute method: ✓`);
      }
      
      console.log(); // Empty line between tools
    }
    
    // Additional module information
    console.log('📊 Module Summary:');
    console.log(`  Module: ${moduleName}`);
    console.log(`  Total tools: ${tools.length}`);
    console.log(`  Tool names: ${tools.map(t => t.name).join(', ')}`);
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Main execution
async function main() {
  // Get module name from command line argument
  const moduleName = process.argv[2] || 'file';
  
  if (process.argv[2] === '--help' || process.argv[2] === '-h') {
    console.log('Usage: node scripts/utils/check-module-tools.js [module-name]');
    console.log('\nExamples:');
    console.log('  node scripts/utils/check-module-tools.js file');
    console.log('  node scripts/utils/check-module-tools.js command-executor');
    console.log('  node scripts/utils/check-module-tools.js ai-generation');
    process.exit(0);
  }
  
  await checkModuleTools(moduleName);
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});