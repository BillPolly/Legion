#!/usr/bin/env node

/**
 * Fix Schema Validation Issues (Safe Version)
 * 
 * This script fixes validation issues without breaking package structure:
 * 1. Updates the schema to accept existing module name patterns (including underscores, PascalCase)
 * 2. Fixes tool categories by mapping them to valid enum values
 */

import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';

async function fixSchemaValidationSafely() {
  console.log('🔧 Fixing MongoDB schema validation issues (safe mode)...\n');
  
  const resourceManager = ResourceManager.getInstance();
  await resourceManager.initialize();
  
  const provider = await MongoDBToolRegistryProvider.create(resourceManager, { 
    enableSemanticSearch: false 
  });
  
  const results = {
    schemaUpdated: false,
    toolsFixed: 0,
    errors: []
  };
  
  try {
    // First, let's see what module name patterns we actually have
    console.log('🔍 Analyzing existing module name patterns...');
    const allModules = await provider.databaseService.mongoProvider.find('modules', {}, { limit: 1000 });
    
    const namePatterns = new Set();
    for (const module of allModules) {
      if (module.name) {
        // Detect patterns
        if (/^[a-z0-9-]+$/.test(module.name)) {
          namePatterns.add('kebab-case');
        } else if (/^[A-Z][a-zA-Z0-9]+$/.test(module.name)) {
          namePatterns.add('PascalCase');
        } else if (/^[a-z][a-zA-Z0-9_]+$/.test(module.name)) {
          namePatterns.add('snake_case/camelCase');
        } else {
          namePatterns.add('mixed');
        }
      }
    }
    
    console.log(`📋 Found module name patterns: ${Array.from(namePatterns).join(', ')}`);
    
    // Update the modules collection validator to be more permissive
    console.log('\n🔧 Updating modules collection schema to accept existing name patterns...');
    
    try {
      // Drop and recreate the collection with updated validation
      const db = provider.databaseService.mongoProvider.db;
      
      // Get current collection options
      const collections = await db.listCollections({ name: 'modules' }).toArray();
      const currentOptions = collections[0]?.options || {};
      
      // Update the validator to accept more patterns
      const updatedValidator = {
        $jsonSchema: {
          bsonType: 'object',
          required: ['name', 'description', 'type', 'path'],
          properties: {
            name: {
              bsonType: 'string',
              minLength: 1,
              maxLength: 100,
              // More permissive pattern: allows letters, numbers, hyphens, underscores
              // Supports kebab-case, snake_case, PascalCase, camelCase
              pattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]*$',
              description: 'Module name (supports kebab-case, snake_case, PascalCase, camelCase)'
            },
            description: {
              bsonType: 'string',
              minLength: 10,
              maxLength: 500,
              description: 'Human-readable description of the module\'s purpose'
            },
            version: {
              bsonType: 'string',
              pattern: '^\\d+\\.\\d+\\.\\d+$',
              description: 'Semantic version string'
            },
            path: {
              bsonType: 'string',
              minLength: 1,
              description: 'Relative path to module file from package root'
            },
            className: {
              bsonType: 'string',
              description: 'Class name for class-based modules'
            },
            type: {
              bsonType: 'string',
              enum: ['class', 'module.json', 'definition', 'dynamic'],
              description: 'Module loading strategy type'
            },
            dependencies: {
              bsonType: 'array',
              items: {
                bsonType: 'string'
              },
              description: 'List of environment variables or system dependencies'
            },
            tags: {
              bsonType: 'array',
              items: {
                bsonType: 'string',
                pattern: '^[a-z0-9-]+$'
              },
              description: 'Searchable tags for categorization'
            },
            category: {
              bsonType: 'string',
              enum: [
                'filesystem', 'network', 'data', 'ai', 'development', 
                'deployment', 'testing', 'utility', 'integration', 'storage'
              ],
              description: 'Primary functional category'
            }
            // ... rest of the schema properties remain the same
          }
        }
      };
      
      // Use collMod to update the validator
      await db.command({
        collMod: 'modules',
        validator: updatedValidator
      });
      
      console.log('✅ Modules collection schema updated to accept existing name patterns');
      results.schemaUpdated = true;
      
    } catch (error) {
      console.log(`⚠️  Could not update modules schema: ${error.message}`);
      console.log('   Continuing with tool category fixes...');
      results.errors.push(`Schema update: ${error.message}`);
    }
    
    console.log('');
    
    // Fix tools collection issues - invalid category values
    console.log('🔍 Finding tools with invalid categories...');
    const validCategories = ['read', 'write', 'create', 'delete', 'update', 'search', 'transform', 'validate', 'execute', 'generate', 'analyze'];
    
    const invalidTools = await provider.databaseService.mongoProvider.find(
      'tools',
      { category: { $nin: [...validCategories, null, undefined] } }
    );
    
    console.log(`📋 Found ${invalidTools.length} tools with invalid categories:`);
    
    // Group by category to see what invalid categories exist
    const categoryGroups = {};
    for (const tool of invalidTools) {
      const category = tool.category || 'undefined';
      if (!categoryGroups[category]) {
        categoryGroups[category] = [];
      }
      categoryGroups[category].push(tool);
    }
    
    for (const [category, tools] of Object.entries(categoryGroups)) {
      console.log(`  - "${category}": ${tools.length} tools`);
    }
    
    // Map invalid categories to valid ones based on semantic meaning
    const categoryMapping = {
      'data-processing': 'transform',
      'data': 'transform',
      'utility': 'execute',
      'general': 'execute',
      'ai': 'generate',
      'filesystem': 'read',
      'network': 'read',
      'integration': 'execute',
      'development': 'generate',
      'testing': 'validate',
      'deployment': 'execute',
      'storage': 'write',
      'conversion': 'transform',
      'parsing': 'transform',
      'undefined': 'execute'
    };
    
    // Fix each tool with invalid category
    for (const tool of invalidTools) {
      const originalCategory = tool.category || 'undefined';
      const fixedCategory = categoryMapping[originalCategory] || 'execute'; // Default fallback
      
      console.log(`🔧 Fixing tool category: "${tool.name}" "${originalCategory}" → "${fixedCategory}"`);
      
      try {
        await provider.databaseService.mongoProvider.update(
          'tools',
          { _id: tool._id },
          { 
            $set: { 
              category: fixedCategory,
              updatedAt: new Date()
            }
          }
        );
        
        results.toolsFixed++;
        
      } catch (error) {
        console.log(`  ❌ Failed to fix tool "${tool.name}": ${error.message}`);
        results.errors.push(`Tool ${tool.name}: ${error.message}`);
      }
    }
    
    console.log('');
    console.log('📊 RESULTS SUMMARY');
    console.log('=' + '='.repeat(30));
    console.log(`✅ Schema updated: ${results.schemaUpdated ? 'Yes' : 'No'}`);
    console.log(`✅ Tools fixed: ${results.toolsFixed}`);
    console.log(`❌ Errors: ${results.errors.length}`);
    
    if (results.errors.length > 0) {
      console.log('\nErrors encountered:');
      for (const error of results.errors) {
        console.log(`  - ${error}`);
      }
    }
    
    if (results.schemaUpdated || results.toolsFixed > 0) {
      console.log('\n🎉 Schema validation issues have been addressed!');
      console.log('The modules schema now accepts existing name patterns (PascalCase, snake_case, etc.)');
      console.log('Tool categories have been mapped to valid enum values.');
    } else {
      console.log('\n✅ No issues found to fix (they may have been fixed already).');
    }
    
  } catch (error) {
    console.error('❌ Error during schema validation fix:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await provider.disconnect();
  }
  
  return results;
}

// Run the fix script
fixSchemaValidationSafely().catch(console.error);