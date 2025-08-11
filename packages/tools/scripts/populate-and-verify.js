#!/usr/bin/env node

/**
 * Script to populate database with all modules/tools and verify counts
 */

import { ResourceManager } from '@legion/tools';
import { MongoDBToolRegistryProvider } from '../src/providers/MongoDBToolRegistryProvider.js';
import { ToolRegistry } from '../src/integration/ToolRegistry.js';
import { ModuleLoader } from '../src/loading/ModuleLoader.js';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class DatabasePopulator {
  constructor() {
    this.resourceManager = null;
    this.provider = null;
    this.toolRegistry = null;
    this.moduleLoader = null;
    this.stats = {
      modules: { loaded: 0, inDb: 0, failed: [] },
      tools: { loaded: 0, inDb: 0, failed: [] }
    };
  }

  async initialize() {
    console.log(chalk.blue('🔧 Initializing ResourceManager and providers...\n'));
    
    // Initialize ResourceManager
    this.resourceManager = new ResourceManager();
    await this.resourceManager.initialize();
    
    // Initialize MongoDB provider
    this.provider = await MongoDBToolRegistryProvider.create(this.resourceManager, {
      enableSemanticSearch: false
    });
    
    // Initialize ToolRegistry with database provider
    this.toolRegistry = new ToolRegistry({ provider: this.provider });
    await this.toolRegistry.initialize();
    
    // Initialize ModuleLoader for loading modules directly
    this.moduleLoader = new ModuleLoader(this.resourceManager);
    await this.moduleLoader.initialize();
  }

  async clearDatabase() {
    console.log(chalk.yellow('🗑️  Clearing existing database entries...\n'));
    
    const db = this.provider.databaseService.mongoProvider.db;
    await db.collection('modules').deleteMany({});
    await db.collection('tools').deleteMany({});
    
    console.log(chalk.green('   ✅ Database cleared\n'));
  }

  async loadAllModules() {
    console.log(chalk.blue('📦 Loading all modules...\n'));
    
    const modules = [
      { name: 'Calculator', path: path.join(__dirname, '../../tools-collection/src/calculator') },
      { name: 'Json', path: path.join(__dirname, '../../tools-collection/src/json') },
      { name: 'System', path: path.join(__dirname, '../../tools-collection/src/system') },
      { name: 'File', path: path.join(__dirname, '../../tools-collection/src/file') },
      { name: 'GitHub', path: path.join(__dirname, '../../tools-collection/src/github') },
      { name: 'AIGeneration', path: path.join(__dirname, '../../tools-collection/src/ai-generation') },
      { name: 'Serper', path: path.join(__dirname, '../../tools-collection/src/serper') },
      { name: 'FileAnalysis', path: path.join(__dirname, '../../tools-collection/src/file-analysis') },
      { name: 'Voice', path: path.join(__dirname, '../../voice') },
      { name: 'JSGenerator', path: path.join(__dirname, '../../code-gen/js-generator') },
      { name: 'CodeAnalysis', path: path.join(__dirname, '../../code-gen/code-analysis') },
      { name: 'Railway', path: path.join(__dirname, '../../railway') },
      { name: 'NodeRunner', path: path.join(__dirname, '../../node-runner') },
      { name: 'CommandExecutor', path: path.join(__dirname, '../../tools-collection/src/command-executor') },
      { name: 'TestJsonModule', path: path.join(__dirname, '../../test-json-module') }
    ];

    const loadedModules = [];
    
    for (const module of modules) {
      try {
        console.log(`   Loading ${module.name}...`);
        const moduleInstance = await this.loadModule(module.path);
        
        if (moduleInstance) {
          const toolCount = moduleInstance.tools ? Object.keys(moduleInstance.tools).length : 0;
          loadedModules.push({
            name: module.name,
            instance: moduleInstance,
            toolCount: toolCount
          });
          this.stats.modules.loaded++;
          this.stats.tools.loaded += toolCount;
          console.log(chalk.green(`   ✅ ${module.name}: ${toolCount} tools`));
        }
      } catch (error) {
        console.log(chalk.red(`   ❌ ${module.name}: ${error.message}`));
        this.stats.modules.failed.push(module.name);
      }
    }
    
    console.log(chalk.blue(`\n📊 Loaded ${this.stats.modules.loaded} modules with ${this.stats.tools.loaded} tools total\n`));
    return loadedModules;
  }

  async loadModule(modulePath) {
    const moduleExports = await import(modulePath + '/index.js');
    const ModuleClass = moduleExports.default || moduleExports;
    
    if (!ModuleClass) {
      throw new Error('Module does not export a default class');
    }
    
    let instance;
    if (typeof ModuleClass.create === 'function') {
      instance = await ModuleClass.create(this.resourceManager);
    } else if (typeof ModuleClass === 'function') {
      instance = new ModuleClass();
      if (typeof instance.initialize === 'function') {
        await instance.initialize();
      }
    }
    
    return instance;
  }

  async populateDatabase(modules) {
    console.log(chalk.blue('💾 Populating database...\n'));
    
    const db = this.provider.databaseService.mongoProvider.db;
    
    for (const module of modules) {
      try {
        // Determine correct path based on module name
        let modulePath;
        if (['Calculator', 'Json', 'System', 'File', 'GitHub', 'AIGeneration', 'Serper', 'FileAnalysis', 'CommandExecutor'].includes(module.name)) {
          // tools-collection modules
          const subPath = module.name === 'AIGeneration' ? 'ai-generation' : 
                         module.name === 'FileAnalysis' ? 'file-analysis' :
                         module.name === 'CommandExecutor' ? 'command-executor' :
                         module.name === 'GitHub' ? 'github' :
                         module.name.toLowerCase();
          modulePath = `packages/tools-collection/src/${subPath}`;
        } else if (module.name === 'Voice') {
          modulePath = 'packages/voice';
        } else if (module.name === 'JSGenerator') {
          modulePath = 'packages/code-gen/js-generator';
        } else if (module.name === 'CodeAnalysis') {
          modulePath = 'packages/code-gen/code-analysis';
        } else if (module.name === 'Railway') {
          modulePath = 'packages/railway';
        } else if (module.name === 'NodeRunner') {
          modulePath = 'packages/node-runner';
        } else if (module.name === 'TestJsonModule') {
          modulePath = 'packages/test-json-module';
        } else {
          modulePath = `packages/${module.name.toLowerCase()}`;
        }
        
        // Save module
        const moduleDoc = {
          name: module.name,
          type: 'class',
          path: modulePath,
          className: module.name === 'TestJsonModule' ? 'TestJsonModule' :
                     module.name === 'CommandExecutor' ? 'CommandExecutorModule' :
                     module.name + (module.name.endsWith('Module') ? '' : 'Module'),
          toolCount: module.toolCount,
          initialized: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const result = await db.collection('modules').insertOne(moduleDoc);
        const moduleId = result.insertedId;
        this.stats.modules.inDb++;
        
        // Save tools
        if (module.instance.tools) {
          for (const [toolName, tool] of Object.entries(module.instance.tools)) {
            const toolDoc = {
              name: toolName,
              description: tool.description || '',
              moduleName: module.name,
              moduleId: moduleId,
              inputSchema: tool.inputSchema || {},
              hasExecute: typeof tool.execute === 'function',
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            await db.collection('tools').insertOne(toolDoc);
            this.stats.tools.inDb++;
          }
        }
        
        console.log(chalk.green(`   ✅ ${module.name}: saved to database`));
      } catch (error) {
        console.log(chalk.red(`   ❌ ${module.name}: ${error.message}`));
      }
    }
    
    console.log(chalk.blue(`\n📊 Database populated: ${this.stats.modules.inDb} modules, ${this.stats.tools.inDb} tools\n`));
  }

  async verifyDatabase() {
    console.log(chalk.blue('🔍 Verifying database contents...\n'));
    
    // Get counts from database
    const db = this.provider.databaseService.mongoProvider.db;
    const moduleCount = await db.collection('modules').countDocuments();
    const toolCount = await db.collection('tools').countDocuments();
    
    console.log(`   Modules in database: ${moduleCount}`);
    console.log(`   Tools in database: ${toolCount}`);
    
    // Test retrieving tools via ToolRegistry
    console.log(chalk.blue('\n🧪 Testing tool retrieval via ToolRegistry...\n'));
    
    const testTools = [
      'calculator', 'json_parse', 'file_write', 'github',
      'generate_image', 'module_list', 'railway_deploy',
      'run_node', 'command_executor', 'greet'
    ];
    
    let retrievalSuccess = 0;
    let retrievalFailed = 0;
    
    for (const toolName of testTools) {
      try {
        const tool = await this.toolRegistry.getTool(toolName);
        if (tool && typeof tool.execute === 'function') {
          console.log(chalk.green(`   ✅ ${toolName}: Retrieved and executable`));
          retrievalSuccess++;
        } else {
          console.log(chalk.yellow(`   ⚠️  ${toolName}: Retrieved but not executable`));
          retrievalFailed++;
        }
      } catch (error) {
        console.log(chalk.red(`   ❌ ${toolName}: Failed to retrieve`));
        retrievalFailed++;
      }
    }
    
    console.log(chalk.blue(`\n📊 Retrieval test: ${retrievalSuccess}/${testTools.length} successful\n`));
    
    return {
      moduleCount,
      toolCount,
      retrievalSuccess,
      retrievalFailed
    };
  }

  async generateReport() {
    console.log(chalk.blue('📋 Final Report\n'));
    console.log('=' .repeat(60));
    
    console.log(chalk.cyan('\nModule Statistics:'));
    console.log(`   Loaded from filesystem: ${this.stats.modules.loaded}`);
    console.log(`   Saved to database: ${this.stats.modules.inDb}`);
    if (this.stats.modules.failed.length > 0) {
      console.log(chalk.red(`   Failed to load: ${this.stats.modules.failed.join(', ')}`));
    }
    
    console.log(chalk.cyan('\nTool Statistics:'));
    console.log(`   Loaded from modules: ${this.stats.tools.loaded}`);
    console.log(`   Saved to database: ${this.stats.tools.inDb}`);
    
    // Get database stats
    const dbStats = await this.provider.getStats();
    console.log(chalk.cyan('\nDatabase Final State:'));
    console.log(`   Modules: ${dbStats.modules}`);
    console.log(`   Tools: ${dbStats.tools}`);
    
    // Check consistency
    console.log(chalk.cyan('\nConsistency Check:'));
    const modulesMatch = this.stats.modules.loaded === dbStats.modules;
    const toolsMatch = this.stats.tools.loaded === dbStats.tools;
    
    if (modulesMatch && toolsMatch) {
      console.log(chalk.green('   ✅ All modules and tools successfully populated!'));
    } else {
      if (!modulesMatch) {
        console.log(chalk.red(`   ❌ Module count mismatch: ${this.stats.modules.loaded} loaded vs ${dbStats.modules} in DB`));
      }
      if (!toolsMatch) {
        console.log(chalk.red(`   ❌ Tool count mismatch: ${this.stats.tools.loaded} loaded vs ${dbStats.tools} in DB`));
      }
    }
    
    console.log('\n' + '='.repeat(60));
  }

  async disconnect() {
    if (this.provider) {
      await this.provider.disconnect();
    }
  }
}

// Main execution
async function main() {
  const populator = new DatabasePopulator();
  
  try {
    await populator.initialize();
    
    // Clear database
    await populator.clearDatabase();
    
    // Load all modules
    const modules = await populator.loadAllModules();
    
    // Populate database
    await populator.populateDatabase(modules);
    
    // Verify database
    await populator.verifyDatabase();
    
    // Generate report
    await populator.generateReport();
    
  } catch (error) {
    console.error(chalk.red('\n❌ Fatal error:'), error);
    process.exit(1);
  } finally {
    await populator.disconnect();
  }
}

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});