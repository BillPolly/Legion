#!/usr/bin/env node

/**
 * Simple database population script without strict validation
 */

import { ResourceManager } from '../src/ResourceManager.js';
import { MongoDBToolRegistryProvider } from '../src/providers/MongoDBToolRegistryProvider.js';
import { ModuleLoader } from '../src/loading/ModuleLoader.js';
import chalk from 'chalk';

async function main() {
  const rm = new ResourceManager();
  await rm.initialize();
  
  console.log(chalk.blue('🔧 Connecting to MongoDB...'));
  
  // Get direct MongoDB connection
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('legion_tools');
  
  console.log(chalk.green('✅ Connected to MongoDB'));
  
  // Clear existing data
  console.log(chalk.yellow('🗑️ Clearing existing data...'));
  await db.collection('modules').deleteMany({});
  await db.collection('tools').deleteMany({});
  console.log(chalk.green('✅ Collections cleared'));
  
  // Load modules
  console.log(chalk.blue('📦 Loading modules...'));
  
  // Import modules directly
  const moduleImports = {
    Calculator: () => import('../../tools-collection/src/calculator/CalculatorModule.js'),
    Json: () => import('../../tools-collection/src/json/JsonModule.js'),
    System: () => import('../../tools-collection/src/system/SystemModule.js'),
    File: () => import('../../tools-collection/src/file/FileModule.js'),
    GitHub: () => import('../../tools-collection/src/github/GitHubModule.js'),
    Serper: () => import('../../tools-collection/src/serper/SerperModule.js'),
    JSGenerator: () => import('../../code-gen/js-generator/src/JSGeneratorModule.js')
  };
  
  const modules = [];
  const tools = [];
  
  for (const [name, importFn] of Object.entries(moduleImports)) {
    try {
      console.log(`  Loading ${name}...`);
      const module = await importFn();
      const ModuleClass = module.default || module[name + 'Module'];
      const instance = new ModuleClass();
      
      if (instance.initialize) {
        await instance.initialize();
      }
      
      // Save module (simplified schema)
      const moduleDoc = {
        name: name,
        description: `${name} module for Legion framework`,
        type: 'class',
        path: `packages/tools-collection/src/${name.toLowerCase()}`,
        className: `${name}Module`,
        status: 'active',
        toolCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await db.collection('modules').insertOne(moduleDoc);
      const moduleId = result.insertedId;
      
      console.log(chalk.green(`  ✅ ${name} module saved`));
      modules.push(moduleDoc);
      
      // Save tools
      let toolCount = 0;
      const toolsArray = instance.getTools ? instance.getTools() : [];
      
      for (const tool of toolsArray) {
        const toolDoc = {
          name: tool.name,
          description: tool.description || 'No description',
          moduleName: name,
          moduleId: moduleId,
          inputSchema: tool.inputSchema || {},
          hasExecute: typeof tool.execute === 'function',
          category: tool.category || 'utility',
          tags: tool.tags || [],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await db.collection('tools').insertOne(toolDoc);
        tools.push(toolDoc);
        toolCount++;
      }
      
      // Update module tool count
      await db.collection('modules').updateOne(
        { _id: moduleId },
        { $set: { toolCount } }
      );
      
      console.log(chalk.cyan(`    Added ${toolCount} tools`));
      
    } catch (error) {
      console.log(chalk.red(`  ❌ Failed to load ${name}: ${error.message}`));
    }
  }
  
  // Print summary
  console.log(chalk.blue('\n📊 Population Summary:'));
  console.log(chalk.green(`  ✅ ${modules.length} modules saved`));
  console.log(chalk.green(`  ✅ ${tools.length} tools saved`));
  
  // Verify data
  const moduleCount = await db.collection('modules').countDocuments();
  const toolCount = await db.collection('tools').countDocuments();
  
  console.log(chalk.blue('\n🔍 Database Verification:'));
  console.log(chalk.green(`  Modules in DB: ${moduleCount}`));
  console.log(chalk.green(`  Tools in DB: ${toolCount}`));
  
  // Test retrieval
  console.log(chalk.blue('\n🧪 Testing retrieval:'));
  const sampleTool = await db.collection('tools').findOne({ name: 'add' });
  if (sampleTool) {
    console.log(chalk.green(`  ✅ Retrieved tool: ${sampleTool.name} from ${sampleTool.moduleName}`));
  }
  
  await client.close();
  console.log(chalk.green('\n✅ Database population complete!'));
}

main().catch(error => {
  console.error(chalk.red('❌ Error:'), error);
  process.exit(1);
});