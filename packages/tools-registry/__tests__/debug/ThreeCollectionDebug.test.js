/**
 * Debug test for 3-collection architecture issues
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { MongoClient } from 'mongodb';
import { Perspectives } from '../../src/search/Perspectives.js';
import { DatabaseStorage } from '../../src/core/DatabaseStorage.js';

describe('3-Collection Debug', () => {
  let resourceManager;
  let mongoClient;
  let db;
  let testDbName;
  let perspectives;
  let databaseStorage;

  beforeEach(async () => {
    testDbName = `debug_3collection_${Date.now()}`;
    resourceManager = await ResourceManager.getResourceManager();
    
    const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    db = mongoClient.db(testDbName);
    
    databaseStorage = new DatabaseStorage({ db });
    await databaseStorage.initialize();
    
    resourceManager.set('databaseStorage', databaseStorage);
    resourceManager.set('llmClient', {
      sendMessage: async (prompt) => JSON.stringify([
        { content: 'Test perspective content' }
      ])
    });
    
    perspectives = new Perspectives({
      resourceManager,
      options: { verbose: true }
    });
  });

  afterEach(async () => {
    if (mongoClient) {
      await db.dropDatabase();
      await mongoClient.close();
    }
  });

  it('should debug perspective generation process', async () => {
    await perspectives.initialize();
    
    // Check perspective types
    const perspectiveTypes = await db.collection('perspective_types').find({}).toArray();
    console.log('Perspective types:', perspectiveTypes.length);
    console.log('Type names:', perspectiveTypes.map(t => t.name));
    
    // Create simple tool
    const tool = { name: 'test_tool', description: 'Test description' };
    await databaseStorage.saveTool(tool, 'TestModule');
    
    // Try to generate perspectives
    try {
      const result = await perspectives.generatePerspectivesForTool('test_tool');
      console.log('Success! Generated perspectives:', result.length);
      console.log('First perspective:', result[0]);
    } catch (error) {
      console.log('Error generating perspectives:', error.message);
      console.log('Full error:', error);
      
      // Try to check what would be saved
      const perspectiveTypes = await perspectives.perspectiveTypeManager.getAllPerspectiveTypes();
      const foundTool = await databaseStorage.findTool('test_tool');
      
      console.log('Found tool:', foundTool);
      console.log('Available perspective types:', perspectiveTypes.length);
      
      if (perspectiveTypes.length > 0 && foundTool) {
        const testDoc = {
          tool_name: foundTool.name,
          tool_id: foundTool._id,
          perspective_type_name: perspectiveTypes[0].name,
          perspective_type_id: perspectiveTypes[0]._id,
          content: 'Test content',
          keywords: ['test'],
          generated_at: new Date(),
          llm_model: 'test',
          batch_id: 'test_batch'
        };
        
        console.log('Test document structure:', testDoc);
        
        // Try direct save
        try {
          await db.collection('tool_perspectives').insertOne(testDoc);
          console.log('Direct insert succeeded');
        } catch (insertError) {
          console.log('Direct insert failed:', insertError.message);
        }
      }
    }
  });
});