#!/usr/bin/env node

/**
 * Debug Tool Data
 * 
 * Shows exactly what tool data is being generated before insertion
 */

import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';
import { DatabasePopulator } from './src/loading/DatabasePopulator.js';
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';

async function debugToolData() {
  console.log('🔍 Debug Tool Data Generation\n');
  
  try {
    const rm = new ResourceManager();
    await rm.initialize();
    
    // Create provider 
    const provider = await MongoDBToolRegistryProvider.create(rm, { enableSemanticSearch: false });
    
    // Clear data
    await provider.databaseService.mongoProvider.delete('modules', {});
    await provider.databaseService.mongoProvider.delete('tools', {});
    console.log('✅ Cleared existing data');
    
    // Import the Calculator module 
    const monorepoRoot = rm.get('env.MONOREPO_ROOT') || '/Users/maxximus/Documents/max/pocs/Legion';
    const modulePath = path.resolve(monorepoRoot, 'packages/tools-collection/src/calculator/CalculatorModule.js');
    
    const { default: CalculatorModule } = await import(modulePath);
    const moduleInstance = new CalculatorModule();
    
    console.log('✅ Module imported and instantiated');
    const tools = moduleInstance.getTools();
    const tool = tools[0]; // Get the calculator tool
    
    console.log('\n🔧 Tool Analysis:');
    console.log('  Tool name:', tool.name);
    console.log('  Tool description:', tool.description);
    console.log('  Description length:', tool.description.length);
    console.log('  Tool constructor:', tool.constructor.name);
    console.log('  Tool properties:', Object.getOwnPropertyNames(tool));
    
    // Create a fake saved module to get a moduleId
    const savedModule = await provider.databaseService.mongoProvider.insert('modules', {
      name: 'Calculator',
      type: 'class',
      path: 'packages/tools-collection/src/calculator',
      description: 'Calculator module for testing'
    });
    const moduleId = savedModule.insertedIds[0];
    console.log('✅ Test module saved with ID:', moduleId);
    
    // Now manually construct the tool data the same way DatabasePopulator does
    const moduleName = moduleInstance.name || 'Calculator';
    
    // Extract schemas
    let inputSchema = {};
    let outputSchema = null;
    
    if (tool.inputSchema) {
      inputSchema = tool.inputSchema;
    }
    if (tool.outputSchema) {
      outputSchema = tool.outputSchema;
    }
    
    // Ensure description meets validation requirements (min 10 chars)
    let description = tool.description;
    if (!description || description.length < 10) {
      description = `${tool.name} tool from ${moduleName} module provides ${tool.name} functionality`;
    }
    if (description.length > 1000) {
      description = description.substring(0, 997) + '...';
    }
    
    const toolData = {
      name: tool.name,
      moduleId: moduleId,
      moduleName: moduleName,
      description: description,
      inputSchema: inputSchema,
      outputSchema: outputSchema,
      category: 'execute', // Simple default
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log('\n📋 Generated Tool Data:');
    console.log('  name:', toolData.name, '(type:', typeof toolData.name, ')');
    console.log('  moduleId:', toolData.moduleId, '(type:', typeof toolData.moduleId, ')');
    console.log('  moduleName:', toolData.moduleName, '(type:', typeof toolData.moduleName, ')');
    console.log('  description:', toolData.description.substring(0, 100) + '...', '(length:', toolData.description.length, ')');
    console.log('  inputSchema:', !!toolData.inputSchema, '(type:', typeof toolData.inputSchema, ')');
    console.log('  outputSchema:', !!toolData.outputSchema, '(type:', typeof toolData.outputSchema, ')');
    console.log('  category:', toolData.category, '(type:', typeof toolData.category, ')');
    console.log('  status:', toolData.status, '(type:', typeof toolData.status, ')');
    console.log('  createdAt:', toolData.createdAt instanceof Date, '(type:', typeof toolData.createdAt, ')');
    console.log('  updatedAt:', toolData.updatedAt instanceof Date, '(type:', typeof toolData.updatedAt, ')');
    
    console.log('\n🧪 Testing direct tool insertion...');
    
    try {
      const insertResult = await provider.databaseService.mongoProvider.insert('tools', toolData);
      console.log('✅ Direct tool insertion succeeded!');
      console.log('  Tool ID:', insertResult.insertedIds[0]);
    } catch (insertError) {
      console.error('❌ Direct tool insertion failed:', insertError.message);
      console.error('  Code:', insertError.code);
      if (insertError.errInfo) {
        console.error('  Validation details:', JSON.stringify(insertError.errInfo, null, 2));
      }
    }
    
    await provider.disconnect();
    
  } catch (error) {
    console.error('\n❌ Critical error:', error.message);
    console.error('  Stack:', error.stack);
  }
}

debugToolData().catch(console.error);