#!/usr/bin/env node

/**
 * Clean Duplicate Modules Script
 * 
 * Finds and removes duplicate modules from the database,
 * keeping only the most recent version of each module.
 */

import { ResourceManager } from '@legion/resource-manager';
import { MongoDBToolRegistryProvider } from '../src/providers/MongoDBToolRegistryProvider.js';
import chalk from 'chalk';

async function cleanDuplicates() {
  console.log(chalk.blue.bold('\n🧹 Cleaning Duplicate Modules\n'));
  
  const rm = ResourceManager.getInstance();
  await rm.initialize();

  const provider = await MongoDBToolRegistryProvider.create(rm, {
    enableSemanticSearch: false
  });

  try {
    // Get all modules
    const modules = await provider.databaseService.mongoProvider.find('modules', {});
    console.log(chalk.cyan(`Found ${modules.length} total modules in database`));

    // Group by unique identifier (name + className + filePath)
    const moduleGroups = {};
    
    for (const module of modules) {
      // Create a unique key for this module
      const key = `${module.name}|${module.className}|${module.filePath}`;
      
      if (!moduleGroups[key]) {
        moduleGroups[key] = [];
      }
      moduleGroups[key].push(module);
    }

    // Find duplicates
    let duplicateCount = 0;
    let deletedCount = 0;
    
    console.log(chalk.blue('\n📋 Checking for duplicates...\n'));
    
    for (const [key, mods] of Object.entries(moduleGroups)) {
      if (mods.length > 1) {
        duplicateCount++;
        const [name, className] = key.split('|');
        
        console.log(chalk.yellow(`\nDuplicate found: ${name || '(unnamed)'} (${className})`));
        console.log(chalk.gray(`  Found ${mods.length} copies:`));
        
        // Sort by update date (most recent first)
        mods.sort((a, b) => {
          const dateA = new Date(a.updatedAt || a.createdAt || a.discoveredAt || 0);
          const dateB = new Date(b.updatedAt || b.createdAt || b.discoveredAt || 0);
          return dateB - dateA;
        });
        
        // Display all copies
        for (let i = 0; i < mods.length; i++) {
          const mod = mods[i];
          const date = mod.updatedAt || mod.createdAt || mod.discoveredAt;
          const status = i === 0 ? chalk.green('✅ KEEP') : chalk.red('❌ DELETE');
          console.log(`    ${status} ID: ${mod._id.toString().slice(-8)}... Updated: ${date ? new Date(date).toISOString() : 'unknown'}`);
        }
        
        // Delete all but the most recent
        for (let i = 1; i < mods.length; i++) {
          await provider.databaseService.mongoProvider.delete('modules', { _id: mods[i]._id });
          deletedCount++;
        }
      }
    }
    
    if (duplicateCount === 0) {
      console.log(chalk.green('✅ No duplicates found!\n'));
    } else {
      console.log(chalk.green(`\n✅ Cleaned ${deletedCount} duplicate modules\n`));
    }
    
    // Final count
    const finalCount = await provider.databaseService.mongoProvider.count('modules', {});
    console.log(chalk.blue.bold('📊 Final Summary'));
    console.log('═'.repeat(40));
    console.log(chalk.white(`Original module count: ${modules.length}`));
    console.log(chalk.white(`Duplicates removed: ${deletedCount}`));
    console.log(chalk.green(`Final module count: ${finalCount}`));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  } finally {
    await provider.disconnect();
  }
}

// Run the cleanup
cleanDuplicates().catch(console.error);