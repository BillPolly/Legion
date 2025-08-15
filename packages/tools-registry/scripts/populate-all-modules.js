#!/usr/bin/env node

/**
 * Comprehensive database population script - loads ALL modules
 */

import { ResourceManager } from '../src/ResourceManager.js';
import chalk from 'chalk';
import { ObjectId } from 'mongodb';

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
  await db.collection('tool_perspectives').deleteMany({});
  console.log(chalk.green('✅ Collections cleared'));
  
  // ALL module definitions
  const moduleDefinitions = [
    // Tools Collection modules
    { name: 'Calculator', path: '../../tools-collection/src/calculator/CalculatorModule.js', category: 'utility' },
    { name: 'Json', path: '../../tools-collection/src/json/JsonModule.js', category: 'data' },
    { name: 'System', path: '../../tools-collection/src/system/SystemModule.js', category: 'system' },
    { name: 'File', path: '../../tools-collection/src/file/FileModule.js', category: 'filesystem' },
    { name: 'GitHub', path: '../../tools-collection/src/github/GitHubModule.js', category: 'integration' },
    { name: 'Serper', path: '../../tools-collection/src/serper/SerperModule.js', category: 'integration' },
    { name: 'AIGeneration', path: '../../tools-collection/src/ai-generation/AIGenerationModule.js', category: 'ai' },
    { name: 'FileAnalysis', path: '../../tools-collection/src/file-analysis/FileAnalysisModule.js', category: 'ai' },
    { name: 'CommandExecutor', path: '../../tools-collection/src/command-executor/CommandExecutorModule.js', category: 'system' },
    
    // Code generation modules
    { name: 'JSGenerator', path: '../../code-gen/js-generator/src/JSGeneratorModule.js', category: 'development' },
    { name: 'CodeAnalysis', path: '../../code-gen/code-analysis/src/CodeAnalysisModule.js', category: 'development' },
    { name: 'Jester', path: '../../code-gen/jester/src/JesterModule.js', category: 'testing' },
    
    // Infrastructure modules
    { name: 'NodeRunner', path: '../../node-runner/src/NodeRunnerModule.js', category: 'deployment' },
    { name: 'Railway', path: '../../railway/src/RailwayModule.js', category: 'deployment' },
    { name: 'ConanTheDeployer', path: '../../conan-the-deployer/src/ConanTheDeployer.js', category: 'deployment' },
    
    // Voice and media
    { name: 'Voice', path: '../../voice/src/VoiceModule.js', category: 'media' },
    
    // Browser automation
    { name: 'Playwright', path: '../../playwright/src/PlaywrightWrapper.js', category: 'automation' },
    { name: 'BrowserMonitor', path: '../../browser-monitor/src/BrowserMonitor.js', category: 'monitoring' },
    
    // Monitoring and logging
    { name: 'LogManager', path: '../../log-manager/src/LogManager.js', category: 'monitoring' },
    { name: 'FullStackMonitor', path: '../../fullstack-monitor/src/FullStackMonitor.js', category: 'monitoring' },
    
    // AI and Planning
    { name: 'Planner', path: '../../planning/planner/src/index.js', category: 'ai' },
    { name: 'DecentPlanner', path: '../../planning/decent-planner/src/index.js', category: 'ai' },
    { name: 'BTValidator', path: '../../planning/bt-validator/src/index.js', category: 'ai' },
    
    // Resource management
    { name: 'ResourceManager', path: '../../resource-manager/src/index.js', category: 'system' },
    
    // Schema validation
    { name: 'Schema', path: '../../schema/src/index.js', category: 'data' },
    
    // Semantic search
    { name: 'SemanticSearch', path: '../../semantic-search/src/index.js', category: 'ai' }
  ];
  
  const modules = [];
  const tools = [];
  const perspectives = [];
  let successCount = 0;
  let failCount = 0;
  
  console.log(chalk.blue('📦 Loading modules...'));
  
  for (const def of moduleDefinitions) {
    try {
      console.log(`  Loading ${def.name}...`);
      
      // Try to import the module
      let ModuleClass;
      try {
        const module = await import(def.path);
        ModuleClass = module.default || module[def.name + 'Module'] || module[def.name];
      } catch (importError) {
        console.log(chalk.yellow(`    ⚠️ Import failed, skipping: ${importError.message}`));
        failCount++;
        continue;
      }
      
      // Create instance if it's a class
      let instance;
      if (typeof ModuleClass === 'function') {
        try {
          instance = new ModuleClass();
          if (instance.initialize) {
            await instance.initialize();
          }
        } catch (initError) {
          console.log(chalk.yellow(`    ⚠️ Initialization failed, skipping: ${initError.message}`));
          failCount++;
          continue;
        }
      } else {
        instance = ModuleClass;
      }
      
      // Save module
      const moduleDoc = {
        name: def.name,
        description: instance.description || `${def.name} module for Legion framework`,
        type: 'class',
        path: def.path.replace('../../', 'packages/'),
        className: `${def.name}Module`,
        category: def.category,
        status: 'active',
        toolCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await db.collection('modules').insertOne(moduleDoc);
      const moduleId = result.insertedId;
      modules.push(moduleDoc);
      
      // Save tools
      let toolCount = 0;
      const toolsArray = instance.getTools ? instance.getTools() : 
                       instance.tools ? Object.values(instance.tools) : [];
      
      for (const tool of toolsArray) {
        const toolDoc = {
          name: tool.name || tool.constructor.name,
          description: tool.description || 'No description',
          moduleName: def.name,
          moduleId: moduleId,
          inputSchema: tool.inputSchema || {},
          outputSchema: tool.outputSchema || {},
          hasExecute: typeof tool.execute === 'function',
          category: def.category,
          tags: tool.tags || [],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await db.collection('tools').insertOne(toolDoc);
        tools.push(toolDoc);
        toolCount++;
        
        // Generate perspective for semantic search
        const perspective = {
          toolId: toolDoc._id,
          toolName: tool.name,
          moduleName: def.name,
          category: def.category,
          naturalLanguageDescription: `${tool.name} is a tool that ${tool.description}. It belongs to the ${def.name} module in the ${def.category} category.`,
          useCases: [
            `Use ${tool.name} when you need to ${tool.description}`,
            `The ${tool.name} tool helps with ${def.category} tasks`,
            `${def.name} module provides ${tool.name} for ${tool.description}`
          ],
          keywords: [
            tool.name,
            def.name,
            def.category,
            ...(tool.tags || [])
          ],
          examples: tool.examples || [],
          createdAt: new Date()
        };
        
        await db.collection('tool_perspectives').insertOne(perspective);
        perspectives.push(perspective);
      }
      
      // Update module tool count
      await db.collection('modules').updateOne(
        { _id: moduleId },
        { $set: { toolCount } }
      );
      
      console.log(chalk.green(`    ✅ ${def.name}: ${toolCount} tools`));
      successCount++;
      
    } catch (error) {
      console.log(chalk.red(`    ❌ Failed to load ${def.name}: ${error.message}`));
      failCount++;
    }
  }
  
  // Print summary
  console.log(chalk.blue('\n📊 Population Summary:'));
  console.log(chalk.green(`  ✅ ${successCount} modules loaded successfully`));
  console.log(chalk.yellow(`  ⚠️ ${failCount} modules failed to load`));
  console.log(chalk.green(`  ✅ ${modules.length} modules saved`));
  console.log(chalk.green(`  ✅ ${tools.length} tools saved`));
  console.log(chalk.green(`  ✅ ${perspectives.length} perspectives generated`));
  
  // Verify data
  const moduleCount = await db.collection('modules').countDocuments();
  const toolCount = await db.collection('tools').countDocuments();
  const perspectiveCount = await db.collection('tool_perspectives').countDocuments();
  
  console.log(chalk.blue('\n🔍 Database Verification:'));
  console.log(chalk.green(`  Modules in DB: ${moduleCount}`));
  console.log(chalk.green(`  Tools in DB: ${toolCount}`));
  console.log(chalk.green(`  Perspectives in DB: ${perspectiveCount}`));
  
  // Show sample data
  console.log(chalk.blue('\n📝 Sample Data:'));
  const sampleTool = await db.collection('tools').findOne({ name: 'calculator' });
  if (sampleTool) {
    console.log(chalk.green(`  Tool: ${sampleTool.name} from ${sampleTool.moduleName}`));
  }
  
  const samplePerspective = await db.collection('tool_perspectives').findOne();
  if (samplePerspective) {
    console.log(chalk.green(`  Perspective: ${samplePerspective.toolName} - ${samplePerspective.naturalLanguageDescription.slice(0, 50)}...`));
  }
  
  await client.close();
  console.log(chalk.green('\n✅ Database population complete!'));
}

main().catch(error => {
  console.error(chalk.red('❌ Error:'), error);
  process.exit(1);
});