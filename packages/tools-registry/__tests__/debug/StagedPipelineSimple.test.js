/**
 * Simple debugging test for StagedPipeline to identify timeout issue
 */

import { LoadingManager } from '../../src/loading/LoadingManager.js';
import { ResourceManager } from '@legion/resource-manager';
import { MongoClient } from 'mongodb';

describe('StagedPipeline Debug Test', () => {
  let resourceManager;
  let mongoClient;
  let db;
  let originalEnvVars;
  
  beforeAll(async () => {
    console.log('🔍 Starting simple debug test...');
    
    // Store original environment variables
    originalEnvVars = {
      MONGODB_URL: process.env.MONGODB_URL,
      MONGODB_DATABASE: process.env.MONGODB_DATABASE,
      TOOLS_DATABASE_NAME: process.env.TOOLS_DATABASE_NAME
    };
    
    // Override environment to use test database
    process.env.MONGODB_URL = 'mongodb://localhost:27017/legion_tools_test';
    process.env.MONGODB_DATABASE = 'legion_tools_test';
    process.env.TOOLS_DATABASE_NAME = 'legion_tools_test';
    
    console.log('🔧 Environment variables set');
    
    // Clear ResourceManager singleton
    if (ResourceManager._instance) {
      ResourceManager._instance = null;
    }
    
    console.log('🔧 ResourceManager cleared');
    
    // Initialize ResourceManager
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    console.log('✅ ResourceManager initialized');
    
    // Test direct MongoDB connection
    const mongoUrl = resourceManager.get('env.MONGODB_URL');
    console.log('🔍 MongoDB URL:', mongoUrl);
    
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    db = mongoClient.db('legion_tools_test');
    
    console.log('✅ MongoDB connected');
    
    // Create a basic test module
    await db.collection('modules').deleteMany({});
    await db.collection('modules').insertOne({
      name: 'json',
      type: 'class',
      className: 'JsonModule',
      enabled: true,
      loadable: true,
      discoveryStatus: 'discovered'
    });
    
    console.log('✅ Test module inserted');
    
  }, 30000);
  
  afterAll(async () => {
    if (mongoClient) {
      await mongoClient.close();
    }
    
    // Restore environment variables
    if (originalEnvVars.MONGODB_URL !== undefined) {
      process.env.MONGODB_URL = originalEnvVars.MONGODB_URL;
    } else {
      delete process.env.MONGODB_URL;
    }
    
    if (originalEnvVars.MONGODB_DATABASE !== undefined) {
      process.env.MONGODB_DATABASE = originalEnvVars.MONGODB_DATABASE;
    } else {
      delete process.env.MONGODB_DATABASE;
    }
    
    if (originalEnvVars.TOOLS_DATABASE_NAME !== undefined) {
      process.env.TOOLS_DATABASE_NAME = originalEnvVars.TOOLS_DATABASE_NAME;
    } else {
      delete process.env.TOOLS_DATABASE_NAME;
    }
  });
  
  it('should create LoadingManager', async () => {
    console.log('🔍 Creating LoadingManager...');
    
    const loadingManager = new LoadingManager({
      verbose: true,
      resourceManager
    });
    
    console.log('🔍 Initializing LoadingManager...');
    await loadingManager.initialize();
    
    console.log('✅ LoadingManager created and initialized');
    
    // Verify we can find the test module
    const modules = await db.collection('modules').find({}).toArray();
    console.log('🔍 Modules in database:', modules.length);
    
    expect(modules.length).toBe(1);
    expect(modules[0].name).toBe('json');
    
    await loadingManager.close();
  }, 15000);
});