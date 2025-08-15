#!/usr/bin/env node

/**
 * Comprehensive database population script - loads ALL modules found in codebase
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
  
  // COMPREHENSIVE module definitions - ALL modules found
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
    { name: 'LegionLogManager', path: '../../log-manager/src/LegionLogManager.js', category: 'monitoring' },
    { name: 'EventAwareLogManager', path: '../../log-manager/src/EventAwareLogManager.js', category: 'monitoring' },
    { name: 'FullStackMonitor', path: '../../fullstack-monitor/src/FullStackMonitor.js', category: 'monitoring' },
    
    // AI and Planning
    { name: 'Planner', path: '../../planning/planner/src/index.js', category: 'ai' },
    { name: 'DecentPlanner', path: '../../planning/decent-planner/src/index.js', category: 'ai' },
    { name: 'BTValidator', path: '../../planning/bt-validator/src/index.js', category: 'ai' },
    
    // Resource management
    { name: 'ResourceManager', path: '../../resource-manager/src/index.js', category: 'system' },
    { name: 'ResourceModuleFactory', path: '../../resource-manager/src/integration/ResourceModuleFactory.js', category: 'system' },
    
    // Schema validation
    { name: 'Schema', path: '../../schema/src/index.js', category: 'data' },
    
    // Semantic search
    { name: 'SemanticSearch', path: '../../semantic-search/src/index.js', category: 'ai' },
    
    // SD (Stable Diffusion or Service Discovery)
    { name: 'SD', path: '../../sd/src/SDModule.js', category: 'integration' },
    
    // MCP Module
    { name: 'MCP', path: '../../aiur/src/modules/MCPModule.js', category: 'integration' },
    
    // Dynamic JSON Module
    { name: 'DynamicJson', path: '../../tools/src/loading/DynamicJsonModule.js', category: 'data' },
    
    // Deployment Manager and Monitoring System from Conan
    { name: 'DeploymentManager', path: '../../conan-the-deployer/src/DeploymentManager.js', category: 'deployment' },
    { name: 'MonitoringSystem', path: '../../conan-the-deployer/src/MonitoringSystem.js', category: 'monitoring' },
    
    // Browser Manager from Playwright
    { name: 'BrowserManager', path: '../../playwright/src/BrowserManager.js', category: 'automation' }
  ];
  
  const modules = [];
  const tools = [];
  const perspectives = [];
  let successCount = 0;
  let failCount = 0;
  
  console.log(chalk.blue(`📦 Loading ${moduleDefinitions.length} modules...`));
  
  for (const def of moduleDefinitions) {
    try {
      console.log(`  Loading ${def.name}...`);
      
      // Try to import the module
      let ModuleClass;
      try {
        const module = await import(def.path);
        ModuleClass = module.default || module[def.name + 'Module'] || module[def.name] || module;
      } catch (importError) {
        console.log(chalk.yellow(`    ⚠️ Import failed: ${importError.message}`));
        failCount++;
        continue;
      }
      
      // Check if it's a valid module
      let instance = null;
      let moduleTools = [];
      
      // Try to create instance if it's a class
      if (typeof ModuleClass === 'function') {
        try {
          // Try with ResourceManager first
          if (ModuleClass.create && typeof ModuleClass.create === 'function') {
            instance = await ModuleClass.create(rm);
          } else {
            // Try regular constructor
            instance = new ModuleClass();
            if (instance.initialize) {
              await instance.initialize();
            }
          }
        } catch (initError) {
          // Try without initialization
          try {
            instance = new ModuleClass({});
          } catch (err) {
            console.log(chalk.yellow(`    ⚠️ Couldn't instantiate: ${initError.message}`));
          }
        }
      } else if (typeof ModuleClass === 'object') {
        instance = ModuleClass;
      }
      
      // Try to get tools
      if (instance) {
        if (typeof instance.getTools === 'function') {
          try {
            moduleTools = instance.getTools() || [];
          } catch (e) {
            console.log(chalk.yellow(`    ⚠️ getTools() failed: ${e.message}`));
          }
        } else if (instance.tools) {
          moduleTools = Array.isArray(instance.tools) ? instance.tools : Object.values(instance.tools);
        }
      }
      
      // Save module even if no tools
      const moduleDoc = {
        name: def.name,
        description: instance?.description || `${def.name} module for Legion framework`,
        type: 'class',
        path: def.path.replace('../../', 'packages/'),
        className: def.name,
        category: def.category,
        status: 'active',
        toolCount: moduleTools.length,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await db.collection('modules').insertOne(moduleDoc);
      const moduleId = result.insertedId;
      modules.push(moduleDoc);
      
      // Save tools if any
      for (const tool of moduleTools) {
        try {
          // Extract schemas from tool.validator
          let inputSchema = {};
          let outputSchema = {};
          
          try {
            // Get the original Zod schema
            let zodSchema = null;
            if (tool.validator && tool.validator.zodSchema && tool.validator.zodSchema._def) {
              zodSchema = tool.validator.zodSchema;
            } else if (tool.validator && tool.validator.jsonSchema && tool.validator.jsonSchema._def) {
              zodSchema = tool.validator.jsonSchema;
            }
            
            if (zodSchema && zodSchema._def) {
              if (zodSchema._def.typeName === 'ZodObject' && zodSchema._def.shape) {
                // Parse Zod object schema
                const shape = zodSchema._def.shape();
                inputSchema = {
                  type: 'object',
                  properties: {},
                  required: []
                };
                
                for (const [key, fieldSchema] of Object.entries(shape)) {
                  const fieldDef = fieldSchema._def;
                  let fieldType = 'unknown';
                  let isOptional = false;
                  let description = '';
                  let defaultValue = undefined;
                  
                  // Handle ZodOptional wrapper
                  if (fieldDef.typeName === 'ZodOptional') {
                    isOptional = true;
                    const innerSchema = fieldDef.innerType;
                    fieldType = mapZodTypeToJsonType(innerSchema._def.typeName);
                    description = innerSchema._def.description || '';
                  } else if (fieldDef.typeName === 'ZodDefault') {
                    // Handle ZodDefault wrapper
                    const innerSchema = fieldDef.innerType;
                    fieldType = mapZodTypeToJsonType(innerSchema._def.typeName);
                    description = innerSchema._def.description || '';
                    defaultValue = fieldDef.defaultValue();
                  } else {
                    fieldType = mapZodTypeToJsonType(fieldDef.typeName);
                    description = fieldDef.description || '';
                  }
                  
                  const fieldInfo = {
                    type: fieldType,
                    description: description
                  };
                  
                  if (defaultValue !== undefined) {
                    fieldInfo.default = defaultValue;
                  }
                  
                  inputSchema.properties[key] = fieldInfo;
                  
                  if (!isOptional && fieldDef.typeName !== 'ZodDefault') {
                    inputSchema.required.push(key);
                  }
                }
              } else {
                // Simple schema (non-object)
                inputSchema = {
                  type: mapZodTypeToJsonType(zodSchema._def.typeName),
                  description: zodSchema._def.description || 'Input parameter'
                };
              }
            }
          } catch (e) {
            console.log(`      ⚠️ Could not parse input schema for ${tool.name}: ${e.message}`);
            inputSchema = { 
              error: 'Could not parse Zod schema', 
              message: e.message,
              hasValidator: !!tool.validator,
              validatorKeys: tool.validator ? Object.keys(tool.validator) : []
            };
          }
          
          // For now, most tools don't define output schemas explicitly
          outputSchema = {
            type: 'object',
            description: 'Tool execution result',
            properties: {
              result: {
                type: 'any',
                description: 'The main result of the tool execution'
              }
            }
          };

          const toolDoc = {
            name: tool.name || tool.constructor.name || 'unknown',
            description: tool.description || 'No description',
            moduleName: def.name,
            moduleId: moduleId,
            inputSchema: inputSchema,
            outputSchema: outputSchema,
            hasExecute: typeof tool.execute === 'function',
            category: def.category,
            tags: tool.tags || [],
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          await db.collection('tools').insertOne(toolDoc);
          tools.push(toolDoc);
          
          // Generate multiple perspectives for semantic search
          const perspectiveTypes = ['use_case', 'natural_language', 'task_oriented', 'capability'];
          for (const type of perspectiveTypes) {
            const perspective = {
              toolId: toolDoc._id,
              toolName: tool.name,
              moduleName: def.name,
              category: def.category,
              perspectiveType: type,
              content: generatePerspectiveContent(tool.name, tool.description, def.name, def.category, type),
              keywords: extractKeywords(tool.name, tool.description, def.name, def.category),
              createdAt: new Date()
            };
            
            await db.collection('tool_perspectives').insertOne(perspective);
            perspectives.push(perspective);
          }
        } catch (toolError) {
          console.log(chalk.yellow(`      ⚠️ Failed to save tool: ${toolError.message}`));
        }
      }
      
      console.log(chalk.green(`    ✅ ${def.name}: ${moduleTools.length} tools`));
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
  
  // Show module categories
  const categories = [...new Set(modules.map(m => m.category))];
  console.log(chalk.blue('\n📂 Module Categories:'));
  for (const cat of categories.sort()) {
    const count = modules.filter(m => m.category === cat).length;
    console.log(chalk.green(`  ${cat}: ${count} modules`));
  }
  
  await client.close();
  console.log(chalk.green('\n✅ Database population complete!'));
}

function mapZodTypeToJsonType(zodTypeName) {
  const typeMap = {
    'ZodString': 'string',
    'ZodNumber': 'number',
    'ZodBoolean': 'boolean',
    'ZodArray': 'array',
    'ZodObject': 'object',
    'ZodNull': 'null',
    'ZodUndefined': 'undefined',
    'ZodAny': 'any',
    'ZodUnion': 'union',
    'ZodEnum': 'string',
    'ZodLiteral': 'string',
    'ZodDate': 'string',
    'ZodUuid': 'string',
    'ZodEmail': 'string',
    'ZodUrl': 'string'
  };
  
  return typeMap[zodTypeName] || 'unknown';
}

function generatePerspectiveContent(toolName, description, moduleName, category, type) {
  switch(type) {
    case 'use_case':
      return `Use ${toolName} when you need to ${description}. This tool is part of the ${moduleName} module.`;
    case 'natural_language':
      return `The ${toolName} tool from ${moduleName} module ${description}. It is useful for ${category} tasks.`;
    case 'task_oriented':
      return `To ${inferTask(toolName, description)}, use the ${toolName} tool which ${description}`;
    case 'capability':
      return `${moduleName} provides ${toolName} capability for ${description} in the ${category} category`;
    default:
      return `${toolName} is a tool that ${description}`;
  }
}

function extractKeywords(name, description, moduleName, category) {
  const text = `${name} ${description} ${moduleName} ${category}`.toLowerCase();
  const words = text.split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !['the', 'and', 'for', 'with', 'from', 'into', 'this', 'that'].includes(w));
  
  return [...new Set(words)].slice(0, 15);
}

function inferTask(name, description) {
  const taskMap = {
    'read': 'read data',
    'write': 'write data',
    'create': 'create new items',
    'delete': 'remove items',
    'list': 'list items',
    'search': 'search for information',
    'parse': 'parse data',
    'validate': 'validate data',
    'execute': 'execute operations',
    'calculate': 'perform calculations',
    'generate': 'generate content',
    'monitor': 'monitor systems',
    'deploy': 'deploy applications',
    'analyze': 'analyze code',
    'test': 'run tests'
  };
  
  const nameLower = name.toLowerCase();
  for (const [key, task] of Object.entries(taskMap)) {
    if (nameLower.includes(key)) {
      return task;
    }
  }
  
  return 'perform operations';
}

main().catch(error => {
  console.error(chalk.red('❌ Error:'), error);
  process.exit(1);
});