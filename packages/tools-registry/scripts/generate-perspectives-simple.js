#!/usr/bin/env node

/**
 * Simple perspective generation - creates perspectives in MongoDB without Qdrant
 */

import chalk from 'chalk';

async function main() {
  console.log(chalk.blue('🧠 Generating Tool Perspectives...'));
  
  // Connect to MongoDB
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('legion_tools');
  
  // Clear existing perspectives
  await db.collection('tool_perspectives').deleteMany({});
  console.log(chalk.yellow('✅ Cleared existing perspectives'));
  
  // Get all tools
  const tools = await db.collection('tools').find({}).toArray();
  console.log(chalk.blue(`📦 Found ${tools.length} tools to process`));
  
  let perspectiveCount = 0;
  
  for (const tool of tools) {
    // Generate multiple perspectives for each tool
    const perspectives = [
      {
        toolId: tool._id,
        toolName: tool.name,
        moduleName: tool.moduleName,
        category: tool.category || 'utility',
        perspectiveType: 'use_case',
        content: `Use ${tool.name} when you need to ${tool.description}`,
        keywords: extractKeywords(tool.name, tool.description),
        embedding: null, // Would be filled by semantic search
        createdAt: new Date()
      },
      {
        toolId: tool._id,
        toolName: tool.name,
        moduleName: tool.moduleName,
        category: tool.category || 'utility',
        perspectiveType: 'natural_language',
        content: `The ${tool.name} tool from ${tool.moduleName} module ${tool.description}. It is useful for ${tool.category || 'general'} tasks.`,
        keywords: extractKeywords(tool.name, tool.description),
        embedding: null,
        createdAt: new Date()
      },
      {
        toolId: tool._id,
        toolName: tool.name,
        moduleName: tool.moduleName,
        category: tool.category || 'utility',
        perspectiveType: 'task_oriented',
        content: `To ${inferTask(tool.name, tool.description)}, use the ${tool.name} tool which ${tool.description}`,
        keywords: extractKeywords(tool.name, tool.description),
        embedding: null,
        createdAt: new Date()
      },
      {
        toolId: tool._id,
        toolName: tool.name,
        moduleName: tool.moduleName,
        category: tool.category || 'utility',
        perspectiveType: 'capability',
        content: `${tool.moduleName} provides ${tool.name} capability for ${tool.description}`,
        keywords: extractKeywords(tool.name, tool.description),
        embedding: null,
        createdAt: new Date()
      }
    ];
    
    // Add perspectives to database
    await db.collection('tool_perspectives').insertMany(perspectives);
    perspectiveCount += perspectives.length;
    
    console.log(chalk.green(`  ✅ ${tool.name}: ${perspectives.length} perspectives`));
  }
  
  // Generate module-level perspectives
  const modules = await db.collection('modules').find({}).toArray();
  
  for (const module of modules) {
    const modulePerspective = {
      moduleId: module._id,
      moduleName: module.name,
      category: module.category || 'utility',
      perspectiveType: 'module_overview',
      content: `The ${module.name} module provides ${module.toolCount || 0} tools for ${module.category || 'general'} tasks. ${module.description || ''}`,
      keywords: [module.name, module.category, 'module'].filter(Boolean),
      embedding: null,
      createdAt: new Date()
    };
    
    await db.collection('tool_perspectives').insertOne(modulePerspective);
    perspectiveCount++;
  }
  
  console.log(chalk.blue('\n📊 Summary:'));
  console.log(chalk.green(`  ✅ Generated ${perspectiveCount} perspectives`));
  console.log(chalk.green(`  ✅ Covered ${tools.length} tools`));
  console.log(chalk.green(`  ✅ Covered ${modules.length} modules`));
  
  // Verify
  const count = await db.collection('tool_perspectives').countDocuments();
  console.log(chalk.blue('\n🔍 Verification:'));
  console.log(chalk.green(`  Perspectives in DB: ${count}`));
  
  await client.close();
  console.log(chalk.green('\n✅ Perspective generation complete!'));
}

function extractKeywords(name, description) {
  const words = `${name} ${description}`.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !['the', 'and', 'for', 'with', 'from', 'into'].includes(w));
  
  return [...new Set(words)].slice(0, 10);
}

function inferTask(name, description) {
  // Simple task inference from tool name
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
    'generate': 'generate content'
  };
  
  for (const [key, task] of Object.entries(taskMap)) {
    if (name.toLowerCase().includes(key)) {
      return task;
    }
  }
  
  return 'perform operations';
}

main().catch(error => {
  console.error(chalk.red('❌ Error:'), error);
  process.exit(1);
});