/**
 * Debug schema validation issues
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { MongoClient } from 'mongodb';
import { DatabaseStorage } from '../../src/core/DatabaseStorage.js';

describe('Schema Validation Debug', () => {
  let resourceManager;
  let mongoClient;
  let db;
  let testDbName;
  let databaseStorage;

  beforeEach(async () => {
    testDbName = `debug_schema_${Date.now()}`;
    resourceManager = await ResourceManager.getResourceManager();
    
    const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    db = mongoClient.db(testDbName);
    
    databaseStorage = new DatabaseStorage({ db });
    await databaseStorage.initialize();
  });

  afterEach(async () => {
    if (mongoClient) {
      await db.dropDatabase();
      await mongoClient.close();
    }
  });

  it('should debug tool ID format and validation', async () => {
    // Save a tool and check its ID format
    const tool = { name: 'test_tool', description: 'Test tool' };
    await databaseStorage.saveTool(tool, 'TestModule');
    
    const savedTool = await databaseStorage.findTool('test_tool');
    console.log('Saved tool:', savedTool);
    console.log('Tool ID type:', typeof savedTool._id);
    console.log('Tool ID value:', savedTool._id);
    
    // Get perspective types
    const perspectiveTypes = await db.collection('perspective_types').find({}).toArray();
    console.log('First perspective type:', perspectiveTypes[0]);
    console.log('Perspective type ID type:', typeof perspectiveTypes[0]._id);
    
    // Try creating a valid document manually
    const testDoc = {
      tool_name: savedTool.name,
      tool_id: savedTool._id,  // This might be the issue - string vs ObjectId
      perspective_type_name: perspectiveTypes[0].name,
      perspective_type_id: perspectiveTypes[0]._id,
      content: 'Valid test content',
      keywords: ['test'],
      generated_at: new Date(),
      llm_model: 'test-model',
      batch_id: 'test-batch-123'
    };
    
    console.log('Test document for validation:', testDoc);
    console.log('tool_id type in doc:', typeof testDoc.tool_id);
    console.log('perspective_type_id type in doc:', typeof testDoc.perspective_type_id);
    
    try {
      await db.collection('tool_perspectives').insertOne(testDoc);
      console.log('✅ Direct insert succeeded');
    } catch (error) {
      console.log('❌ Direct insert failed:', error.message);
      
      // Try with ObjectId import
      try {
        const { ObjectId } = await import('mongodb');
        const testDoc2 = {
          ...testDoc,
          tool_id: new ObjectId(), // Try with proper ObjectId
        };
        
        await db.collection('tool_perspectives').insertOne(testDoc2);
        console.log('✅ Insert with ObjectId succeeded');
      } catch (error2) {
        console.log('❌ Insert with ObjectId also failed:', error2.message);
      }
    }
  });
});