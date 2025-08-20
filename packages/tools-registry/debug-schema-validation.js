#!/usr/bin/env node

/**
 * Debug Schema Validation Issues
 * 
 * This script checks for MongoDB schema validation errors in the tool registry collections.
 * It inspects documents that might be failing validation and reports specific issues.
 */

import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';
import { 
  ToolRegistryCollections 
} from './src/database/schemas/ToolRegistrySchemas.js';

async function debugSchemaValidation() {
  console.log('🔍 Debugging MongoDB schema validation issues...\n');
  
  const resourceManager = ResourceManager.getInstance();
  await resourceManager.initialize();
  
  const provider = await MongoDBToolRegistryProvider.create(resourceManager, { 
    enableSemanticSearch: false 
  });
  
  const results = {
    collections: [],
    totalIssues: 0,
    summary: {}
  };
  
  try {
    // Check each collection defined in our schemas
    for (const [collectionName, schema] of Object.entries(ToolRegistryCollections)) {
      console.log(`📋 Checking collection: ${collectionName}`);
      
      const collectionResult = {
        name: collectionName,
        exists: false,
        documentCount: 0,
        validationErrors: [],
        sampleInvalidDocs: [],
        issues: []
      };
      
      try {
        // Check if collection exists
        const collections = await provider.databaseService.mongoProvider.db.collections();
        const exists = collections.some(col => col.collectionName === collectionName);
        collectionResult.exists = exists;
        
        if (!exists) {
          collectionResult.issues.push(`Collection ${collectionName} does not exist`);
          console.log(`  ❌ Collection does not exist`);
          results.collections.push(collectionResult);
          continue;
        }
        
        // Get collection info including validation rules
        const collection = provider.databaseService.mongoProvider.db.collection(collectionName);
        const collectionInfo = await collection.options();
        
        console.log(`  📊 Collection exists with validation: ${!!collectionInfo.validator}`);
        
        // Count total documents
        const documentCount = await provider.databaseService.mongoProvider.count(collectionName, {});
        collectionResult.documentCount = documentCount;
        console.log(`  📄 Total documents: ${documentCount}`);
        
        if (documentCount === 0) {
          console.log(`  ℹ️  Collection is empty`);
          results.collections.push(collectionResult);
          continue;
        }
        
        // Try to validate documents by attempting to insert a sample document
        // This will trigger validation errors if the schema is problematic
        try {
          // Get a few sample documents
          const sampleDocs = await provider.databaseService.mongoProvider.find(
            collectionName, 
            {}, 
            { limit: 5 }
          );
          
          console.log(`  🔍 Analyzing ${sampleDocs.length} sample documents...`);
          
          // Check each sample document against the schema requirements
          for (const doc of sampleDocs) {
            const docIssues = await validateDocumentAgainstSchema(doc, schema, collectionName);
            if (docIssues.length > 0) {
              collectionResult.validationErrors.push({
                documentId: doc._id.toString(),
                issues: docIssues
              });
              collectionResult.sampleInvalidDocs.push({
                _id: doc._id.toString(),
                sample: Object.keys(doc).reduce((acc, key) => {
                  // Include just the keys and types for debugging, not full content
                  acc[key] = typeof doc[key] === 'object' ? 
                    (Array.isArray(doc[key]) ? `Array(${doc[key].length})` : 'Object') : 
                    typeof doc[key];
                  return acc;
                }, {})
              });
            }
          }
          
        } catch (validationError) {
          collectionResult.issues.push(`Validation check failed: ${validationError.message}`);
          console.log(`  ❌ Validation check failed: ${validationError.message}`);
        }
        
        console.log(`  📋 Found ${collectionResult.validationErrors.length} validation errors`);
        results.totalIssues += collectionResult.validationErrors.length;
        
      } catch (error) {
        collectionResult.issues.push(`Collection check failed: ${error.message}`);
        console.log(`  ❌ Collection check failed: ${error.message}`);
      }
      
      results.collections.push(collectionResult);
      console.log('');
    }
    
    // Generate summary
    results.summary = {
      totalCollections: results.collections.length,
      existingCollections: results.collections.filter(c => c.exists).length,
      collectionsWithIssues: results.collections.filter(c => 
        c.validationErrors.length > 0 || c.issues.length > 0
      ).length,
      totalValidationErrors: results.totalIssues,
      documentsChecked: results.collections.reduce((sum, c) => sum + c.documentCount, 0)
    };
    
    // Print detailed report
    console.log('🔍 SCHEMA VALIDATION REPORT');
    console.log('=' + '='.repeat(50));
    console.log(`📊 Total Collections: ${results.summary.totalCollections}`);
    console.log(`📁 Existing Collections: ${results.summary.existingCollections}`);
    console.log(`⚠️  Collections with Issues: ${results.summary.collectionsWithIssues}`);
    console.log(`❌ Total Validation Errors: ${results.summary.totalValidationErrors}`);
    console.log(`📄 Documents Checked: ${results.summary.documentsChecked}`);
    console.log('');
    
    // Detail issues by collection
    for (const collection of results.collections) {
      if (collection.validationErrors.length > 0 || collection.issues.length > 0) {
        console.log(`🔴 ${collection.name}:`);
        
        for (const issue of collection.issues) {
          console.log(`  ❌ ${issue}`);
        }
        
        for (const error of collection.validationErrors) {
          console.log(`  📄 Document ${error.documentId.slice(-6)}...:`);
          for (const issue of error.issues) {
            console.log(`    - ${issue}`);
          }
        }
        console.log('');
      }
    }
    
    if (results.summary.totalValidationErrors === 0 && results.summary.collectionsWithIssues === 0) {
      console.log('✅ No schema validation issues found!');
    } else {
      console.log(`⚠️  Found ${results.summary.totalValidationErrors} validation errors across ${results.summary.collectionsWithIssues} collections`);
    }
    
  } catch (error) {
    console.error('❌ Error during schema validation check:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await provider.disconnect();
  }
  
  return results;
}

/**
 * Validate a document against schema requirements
 */
async function validateDocumentAgainstSchema(document, schema, collectionName) {
  const issues = [];
  const validator = schema.validator?.$jsonSchema;
  
  if (!validator) {
    return issues;
  }
  
  // Check required fields
  if (validator.required && Array.isArray(validator.required)) {
    for (const requiredField of validator.required) {
      if (!(requiredField in document) || document[requiredField] === null || document[requiredField] === undefined) {
        issues.push(`Missing required field: ${requiredField}`);
      }
    }
  }
  
  // Check property constraints
  if (validator.properties) {
    for (const [fieldName, fieldSchema] of Object.entries(validator.properties)) {
      const fieldValue = document[fieldName];
      
      if (fieldValue !== undefined && fieldValue !== null) {
        const fieldIssues = validateFieldValue(fieldValue, fieldSchema, fieldName);
        issues.push(...fieldIssues);
      }
    }
  }
  
  return issues;
}

/**
 * Validate a field value against its schema definition
 */
function validateFieldValue(value, fieldSchema, fieldName) {
  const issues = [];
  
  // Type checking
  if (fieldSchema.bsonType) {
    const expectedType = fieldSchema.bsonType;
    const actualType = getBsonType(value);
    
    if (expectedType !== actualType) {
      // Special case: int can be number in JavaScript
      if (!(expectedType === 'int' && actualType === 'number' && Number.isInteger(value))) {
        issues.push(`${fieldName}: expected ${expectedType}, got ${actualType}`);
      }
    }
  }
  
  // String constraints
  if (fieldSchema.bsonType === 'string' && typeof value === 'string') {
    if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
      issues.push(`${fieldName}: string too short (${value.length} < ${fieldSchema.minLength})`);
    }
    if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
      issues.push(`${fieldName}: string too long (${value.length} > ${fieldSchema.maxLength})`);
    }
    if (fieldSchema.pattern && !new RegExp(fieldSchema.pattern).test(value)) {
      issues.push(`${fieldName}: does not match pattern ${fieldSchema.pattern}`);
    }
    if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
      issues.push(`${fieldName}: "${value}" not in allowed values [${fieldSchema.enum.join(', ')}]`);
    }
  }
  
  // Number constraints
  if ((fieldSchema.bsonType === 'int' || fieldSchema.bsonType === 'double') && typeof value === 'number') {
    if (fieldSchema.minimum !== undefined && value < fieldSchema.minimum) {
      issues.push(`${fieldName}: ${value} < minimum ${fieldSchema.minimum}`);
    }
    if (fieldSchema.maximum !== undefined && value > fieldSchema.maximum) {
      issues.push(`${fieldName}: ${value} > maximum ${fieldSchema.maximum}`);
    }
  }
  
  // Array constraints
  if (fieldSchema.bsonType === 'array' && Array.isArray(value)) {
    if (fieldSchema.minItems && value.length < fieldSchema.minItems) {
      issues.push(`${fieldName}: array too short (${value.length} < ${fieldSchema.minItems})`);
    }
    if (fieldSchema.maxItems && value.length > fieldSchema.maxItems) {
      issues.push(`${fieldName}: array too long (${value.length} > ${fieldSchema.maxItems})`);
    }
  }
  
  return issues;
}

/**
 * Get BSON type name for a JavaScript value
 */
function getBsonType(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'double';
  if (typeof value === 'boolean') return 'bool';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  if (value.constructor && value.constructor.name === 'ObjectId') return 'objectId';
  if (typeof value === 'object') return 'object';
  return 'unknown';
}

// Run the debug script
debugSchemaValidation().catch(console.error);