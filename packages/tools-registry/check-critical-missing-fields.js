#!/usr/bin/env node

/**
 * Check for Critical Missing Fields
 * 
 * Identifies tools that are missing critical fields:
 * 1. Description (CRITICAL for findability)
 * 2. Input Schema (CRITICAL for usability)
 * 3. Also checks for inappropriate "name variations" perspectives
 */

import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';

async function checkCriticalMissingFields() {
  console.log('🚨 Checking for tools with critical missing fields...\n');
  
  const resourceManager = ResourceManager.getInstance();
  await resourceManager.initialize();
  
  const provider = await MongoDBToolRegistryProvider.create(resourceManager, { 
    enableSemanticSearch: false 
  });
  
  try {
    // Check for tools without descriptions
    console.log('🔍 Checking for tools WITHOUT descriptions (CRITICAL)...');
    const toolsWithoutDescription = await provider.databaseService.mongoProvider.find('tools', {
      $or: [
        { description: null },
        { description: '' },
        { description: { $exists: false } }
      ]
    });
    
    if (toolsWithoutDescription.length > 0) {
      console.log(`\n🚨 CRITICAL: Found ${toolsWithoutDescription.length} tools WITHOUT descriptions!`);
      console.log('These tools will have TERRIBLE findability:\n');
      
      // Group by module
      const byModule = {};
      for (const tool of toolsWithoutDescription) {
        const moduleName = tool.moduleName || 'unknown';
        if (!byModule[moduleName]) {
          byModule[moduleName] = [];
        }
        byModule[moduleName].push(tool.name);
      }
      
      for (const [moduleName, toolNames] of Object.entries(byModule)) {
        console.log(`  Module: ${moduleName}`);
        for (const toolName of toolNames) {
          console.log(`    - ${toolName}`);
        }
      }
    } else {
      console.log('✅ All tools have descriptions!');
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Check for tools without input schemas
    console.log('\n🔍 Checking for tools WITHOUT input schemas...');
    const toolsWithoutInputSchema = await provider.databaseService.mongoProvider.find('tools', {
      $or: [
        { inputSchema: null },
        { inputSchema: { $exists: false } }
      ]
    });
    
    if (toolsWithoutInputSchema.length > 0) {
      console.log(`\n⚠️  Found ${toolsWithoutInputSchema.length} tools WITHOUT input schemas:`);
      
      // Group by module
      const byModule = {};
      for (const tool of toolsWithoutInputSchema) {
        const moduleName = tool.moduleName || 'unknown';
        if (!byModule[moduleName]) {
          byModule[moduleName] = [];
        }
        byModule[moduleName].push(tool.name);
      }
      
      for (const [moduleName, toolNames] of Object.entries(byModule)) {
        console.log(`  Module: ${moduleName}`);
        for (const toolName of toolNames) {
          console.log(`    - ${toolName}`);
        }
      }
    } else {
      console.log('✅ All tools have input schemas!');
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Check for tools with empty input schemas (no properties)
    console.log('\n🔍 Checking for tools with EMPTY input schemas (no arguments)...');
    const toolsWithEmptySchema = await provider.databaseService.mongoProvider.aggregate('tools', [
      {
        $match: {
          inputSchema: { $exists: true },
          $or: [
            { 'inputSchema.properties': { $exists: false } },
            { 'inputSchema.properties': {} },
            { 'inputSchema.properties': null }
          ]
        }
      },
      {
        $project: {
          name: 1,
          moduleName: 1,
          inputSchema: 1
        }
      }
    ]);
    
    if (toolsWithEmptySchema.length > 0) {
      console.log(`\n📋 Found ${toolsWithEmptySchema.length} tools with NO input properties (no arguments):`);
      console.log('(These probably shouldn\'t have "inputs" perspectives)\n');
      
      for (const tool of toolsWithEmptySchema.slice(0, 10)) {
        console.log(`  - ${tool.name} (${tool.moduleName})`);
      }
      if (toolsWithEmptySchema.length > 10) {
        console.log(`  ... and ${toolsWithEmptySchema.length - 10} more`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Check for inappropriate "name variations" perspectives
    console.log('\n🔍 Checking for inappropriate "name variations" perspectives...');
    
    // First, check if there's a perspective type for name variations
    const nameVariationType = await provider.databaseService.mongoProvider.findOne(
      'perspective_types',
      { type: { $in: ['name_variations', 'synonyms', 'name_variation'] } }
    );
    
    if (nameVariationType) {
      console.log(`\n⚠️  Found perspective type: "${nameVariationType.type}"`);
      console.log(`   Condition: ${nameVariationType.condition}`);
      
      // Count how many perspectives of this type exist
      const count = await provider.databaseService.mongoProvider.count(
        'tool_perspectives',
        { perspectiveType: nameVariationType.type }
      );
      
      console.log(`   Generated: ${count} perspectives`);
      
      if (count > 0) {
        console.log('\n   This type should probably be REMOVED as tools have fixed names!');
        
        // Sample a few
        const samples = await provider.databaseService.mongoProvider.find(
          'tool_perspectives',
          { perspectiveType: nameVariationType.type },
          { limit: 3 }
        );
        
        console.log('\n   Sample perspectives:');
        for (const sample of samples) {
          console.log(`     - Tool: ${sample.toolName}`);
          console.log(`       Text: "${sample.perspectiveText}"`);
        }
      }
    } else {
      console.log('✅ No "name variations" perspective type found (good!)');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    
    const totalTools = await provider.databaseService.mongoProvider.count('tools', {});
    
    console.log(`Total tools: ${totalTools}`);
    console.log(`Tools without descriptions: ${toolsWithoutDescription.length} ${toolsWithoutDescription.length > 0 ? '🚨 CRITICAL!' : '✅'}`);
    console.log(`Tools without input schemas: ${toolsWithoutInputSchema.length} ${toolsWithoutInputSchema.length > 0 ? '⚠️  WARNING' : '✅'}`);
    console.log(`Tools with empty input schemas: ${toolsWithEmptySchema.length}`);
    
    if (toolsWithoutDescription.length > 0) {
      console.log('\n🚨 CRITICAL ACTION REQUIRED:');
      console.log(`   ${toolsWithoutDescription.length} tools need descriptions added immediately!`);
      console.log('   These tools are essentially unfindable without descriptions.');
    }
    
    if (toolsWithoutInputSchema.length > 0) {
      console.log('\n⚠️  ACTION REQUIRED:');
      console.log(`   ${toolsWithoutInputSchema.length} tools need input schemas added.`);
      console.log('   Even if they take no arguments, they should have: { type: "object", properties: {} }');
    }
    
  } catch (error) {
    console.error('❌ Error during check:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await provider.disconnect();
  }
}

checkCriticalMissingFields().catch(console.error);