#!/usr/bin/env node

/**
 * Sync Tool Registry Script
 * 
 * This script syncs all tools from the module registry to the database
 * and displays statistics about available tools and their aliases.
 */

import { ModuleLoader } from '../src/ModuleLoader.js';
import { ResourceManager } from '../src/resources/ResourceManager.js';

async function main() {
  console.log('🔄 Legion Tool Registry Sync\n');
  
  try {
    // Initialize ResourceManager
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    console.log('✅ ResourceManager initialized');
    
    // Create ModuleLoader
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();
    console.log('✅ ModuleLoader initialized');
    
    // Sync tool registry
    console.log('\n📦 Syncing modules...\n');
    const syncResults = await moduleLoader.syncToolRegistry();
    
    // Display sync results
    console.log('\n📊 Sync Results:');
    console.log(`   Synced: ${syncResults.synced.length} modules`);
    console.log(`   Failed: ${syncResults.failed.length} modules`);
    
    if (syncResults.failed.length > 0) {
      console.log('\n❌ Failed modules:');
      syncResults.failed.forEach(({ module, error }) => {
        console.log(`   - ${module}: ${error}`);
      });
    }
    
    // Get and display statistics
    const stats = await moduleLoader.getToolStats();
    console.log('\n📈 Tool Registry Statistics:');
    console.log(`   Total Modules: ${stats.totalModules}`);
    console.log(`   Total Tools: ${stats.totalTools}`);
    console.log(`   Tool Aliases: ${stats.totalAliases || 0}`);
    
    console.log('\n🔧 Tools by Module:');
    Object.entries(stats.toolsByModule).forEach(([module, count]) => {
      console.log(`   ${module}: ${count} tools`);
    });
    
    // Get all tool names including aliases
    const allToolNames = await moduleLoader.getAllToolNames(true);
    console.log(`\n📋 Total Available Tool Names (including aliases): ${allToolNames.length}`);
    
    // Show some example aliases
    console.log('\n🔀 Example Tool Aliases:');
    const examples = [
      { alias: 'file_write', canonical: 'write_file' },
      { alias: 'node_run_command', canonical: 'execute_command' },
      { alias: 'directory_create', canonical: 'create_directory' }
    ];
    
    for (const { alias, canonical } of examples) {
      const exists = await moduleLoader.hasToolByNameOrAlias(alias);
      if (exists) {
        console.log(`   ✅ ${alias} → ${canonical}`);
      } else {
        console.log(`   ❌ ${alias} → not found`);
      }
    }
    
    // Test plan validation
    console.log('\n🧪 Testing Plan Validation:');
    const testPlan = {
      steps: [
        {
          id: 'test-1',
          actions: [
            { type: 'file_write', parameters: {} },
            { type: 'node_run_command', parameters: {} },
            { type: 'non_existent_tool', parameters: {} }
          ]
        }
      ]
    };
    
    const validation = await moduleLoader.validatePlanTools(testPlan);
    console.log(`   Valid: ${validation.valid ? '✅' : '❌'}`);
    if (!validation.valid) {
      console.log('   Errors:');
      validation.errors.forEach(error => {
        console.log(`     - ${error}`);
      });
      if (Object.keys(validation.suggestions).length > 0) {
        console.log('   Suggestions:');
        Object.entries(validation.suggestions).forEach(([tool, suggestions]) => {
          console.log(`     - ${tool}: Did you mean ${suggestions.join(' or ')}?`);
        });
      }
    }
    
    console.log('\n✅ Registry sync complete!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  // Ignore these errors - they're already handled in syncToolRegistry
});

// Run the script
main().catch(console.error).finally(() => {
  // Force exit to avoid hanging
  setTimeout(() => process.exit(0), 100);
});