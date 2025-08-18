#!/usr/bin/env node

/**
 * Populate Initial Perspective Types
 * 
 * This script populates the perspective_types collection with the 10 hardcoded
 * perspective types that were previously defined in ToolIndexer.js
 */

import { MongoDBToolRegistryProvider } from '../src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';

const INITIAL_PERSPECTIVE_TYPES = [
  {
    type: 'name',
    name: 'Name Variations',
    description: 'Tool name and variations for direct name-based matching',
    condition: 'always',
    textTemplate: '${name} ${name.replace(/_/g, \' \')}',
    priority: 1,
    enabled: true
  },
  {
    type: 'description',
    name: 'Description',
    description: 'Direct tool description text for functional matching',
    condition: 'has_description',
    textTemplate: '${description}',
    priority: 2,
    enabled: true
  },
  {
    type: 'task',
    name: 'Task-Oriented',
    description: 'Task-focused perspective combining description with tool usage',
    condition: 'has_description',
    textTemplate: '${description} using ${name} tool',
    priority: 3,
    enabled: true
  },
  {
    type: 'capabilities',
    name: 'Combined Capabilities',
    description: 'All capabilities combined for broad capability matching',
    condition: 'has_capabilities',
    textTemplate: '${capabilities.join(\' \')} capability tool',
    priority: 4,
    enabled: true
  },
  {
    type: 'capability_single',
    name: 'Individual Capabilities',
    description: 'Individual capability entries for precise capability matching',
    condition: 'has_capabilities',
    textTemplate: '${cap} ${name} ${category}', // Note: ${cap} is provided per capability
    priority: 5,
    enabled: true
  },
  {
    type: 'examples',
    name: 'Usage Examples',
    description: 'Example usage scenarios for contextual matching',
    condition: 'has_examples',
    textTemplate: '${examples.join(\' \')}',
    priority: 6,
    enabled: true
  },
  {
    type: 'category',
    name: 'Category/Domain',
    description: 'Category and domain-based perspective for topical grouping',
    condition: 'always',
    textTemplate: '${category} operations ${tags.join(\' \')}',
    priority: 7,
    enabled: true
  },
  {
    type: 'inputs',
    name: 'Input Parameters',
    description: 'Input parameter names for technical parameter-based matching',
    condition: 'has_input_schema',
    textTemplate: 'accepts ${inputs} parameters input',
    priority: 8,
    enabled: true
  },
  {
    type: 'gloss',
    name: 'Combined Summary',
    description: 'Short combined summary of tool name, category and description',
    condition: 'always',
    textTemplate: '${name} ${category} ${description || \'\'}',
    priority: 9,
    enabled: true
  },
  {
    type: 'synonyms',
    name: 'Name Synonyms',
    description: 'Generated name variations and synonyms for fuzzy name matching',
    condition: 'has_name_variations',
    textTemplate: '${nameVariations.join(\' \')}',
    priority: 10,
    enabled: true
  }
];

async function populatePerspectiveTypes() {
  console.log('🔧 Populating initial perspective types...');
  
  const resourceManager = ResourceManager.getInstance();
  await resourceManager.initialize();
  
  const provider = await MongoDBToolRegistryProvider.create(resourceManager);
  
  try {
    // Check if already populated
    const existingCount = await provider.databaseService.mongoProvider.count('perspective_types', {});
    
    if (existingCount > 0) {
      console.log(`⚠️ Found ${existingCount} existing perspective types`);
      console.log('   Use --force to overwrite existing data');
      process.exit(0);
    }
    
    // Add timestamps to each record
    const now = new Date();
    const typesWithTimestamps = INITIAL_PERSPECTIVE_TYPES.map(type => ({
      ...type,
      createdAt: now,
      updatedAt: now
    }));
    
    // Insert all perspective types
    const result = await provider.databaseService.mongoProvider.insert('perspective_types', typesWithTimestamps);
    
    console.log(`✅ Successfully populated ${Object.keys(result.insertedIds).length} perspective types:`);
    
    for (const [index, type] of INITIAL_PERSPECTIVE_TYPES.entries()) {
      const id = Object.values(result.insertedIds)[index];
      console.log(`   ${type.type} (${type.condition}) -> ${id.toString().slice(-6)}...`);
    }
    
  } catch (error) {
    console.error('❌ Error populating perspective types:', error.message);
    process.exit(1);
  } finally {
    await provider.disconnect();
  }
}

// Handle command line args
const args = process.argv.slice(2);
const force = args.includes('--force');

if (force) {
  console.log('🚨 Force mode: will overwrite existing data');
}

populatePerspectiveTypes();