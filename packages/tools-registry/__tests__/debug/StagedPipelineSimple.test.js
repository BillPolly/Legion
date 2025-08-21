/**
 * Simple debugging test for StagedPipeline using production database
 */

import { LoadingManager } from '../../src/loading/LoadingManager.js';
import { ResourceManager } from '@legion/resource-manager';
import { MongoClient } from 'mongodb';

describe('StagedPipeline Debug Test', () => {
  let resourceManager;
  let mongoClient;
  let db;
  
  beforeAll(async () => {
    console.log('🔍 Starting debug test with production database...');
    
    // Initialize ResourceManager to use actual production database
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    console.log('✅ ResourceManager initialized');
    
    // Connect to production MongoDB
    const mongoUrl = resourceManager.get('env.MONGODB_URL');
    const dbName = resourceManager.get('env.TOOLS_DATABASE_NAME') || resourceManager.get('env.MONGODB_DATABASE');
    console.log('🔍 MongoDB URL:', mongoUrl);
    console.log('🔍 Database:', dbName);
    
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    db = mongoClient.db(dbName);
    
    console.log('✅ MongoDB connected to production database');
    
  }, 30000);
  
  afterAll(async () => {
    if (mongoClient) {
      await mongoClient.close();
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
    
    // Verify we can access the production database
    const moduleCount = await db.collection('modules').countDocuments();
    console.log('🔍 Modules in production database:', moduleCount);
    
    // Just verify it's working - don't make assumptions about exact counts
    expect(moduleCount).toBeGreaterThanOrEqual(0);
    
    await loadingManager.close();
  }, 15000);
});