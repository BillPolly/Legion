#!/usr/bin/env node

/**
 * List All Modules Script
 * 
 * Shows all modules in the database grouped by className
 */

import { ResourceManager } from '@legion/resource-manager';
import { MongoDBToolRegistryProvider } from '../src/providers/MongoDBToolRegistryProvider.js';
import chalk from 'chalk';

async function listModules() {
  const rm = ResourceManager.getInstance();
  await rm.initialize();

  const provider = await MongoDBToolRegistryProvider.create(rm, {
    enableSemanticSearch: false
  });

  try {
    // Get all modules
    const modules = await provider.databaseService.mongoProvider.find('modules', {});
    
    console.log(chalk.blue.bold('\n📋 All Modules in Database\n'));
    console.log(chalk.cyan(`Total: ${modules.length} modules\n`));
    
    // Group by className
    const byClass = {};
    const byName = {};
    
    for (const m of modules) {
      const className = m.className || 'NO_CLASS';
      const name = m.name || '(unnamed)';
      
      if (!byClass[className]) byClass[className] = [];
      byClass[className].push(m);
      
      if (!byName[name]) byName[name] = [];
      byName[name].push(m);
    }
    
    // Check for class duplicates
    console.log(chalk.yellow('Modules grouped by className:'));
    for (const [className, mods] of Object.entries(byClass)) {
      if (mods.length > 1) {
        console.log(chalk.red(`\n${className} (${mods.length} variations):`));
        for (const m of mods) {
          console.log(`  - Name: ${chalk.cyan(m.name || '(no name)')}, Path: ${m.path}`);
        }
      }
    }
    
    // Check for name duplicates
    console.log(chalk.yellow('\nModules grouped by name:'));
    for (const [name, mods] of Object.entries(byName)) {
      if (mods.length > 1) {
        console.log(chalk.red(`\n${name} (${mods.length} variations):`));
        for (const m of mods) {
          console.log(`  - Class: ${chalk.cyan(m.className)}, Path: ${m.path}`);
        }
      }
    }
    
    // List unique modules
    console.log(chalk.green('\n\nUnique modules (expected 26):'));
    const unique = new Set();
    for (const m of modules) {
      unique.add(m.className || m.name);
    }
    console.log('Count:', unique.size);
    console.log([...unique].sort().join(', '));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  } finally {
    await provider.disconnect();
  }
}

// Run
listModules().catch(console.error);