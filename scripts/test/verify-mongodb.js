#!/usr/bin/env node

/**
 * Direct MongoDB Verification
 * Tests that MongoDB package is properly installed and can connect
 */

import { MongoClient } from '../../packages/storage/node_modules/mongodb/lib/index.js';

const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017/legion_storage';

async function testMongoDBDirect() {
  console.log('========================================');
  console.log('Direct MongoDB Connection Test');
  console.log('========================================\n');
  
  console.log(`Connecting to: ${MONGODB_URL}`);
  
  try {
    const client = new MongoClient(MONGODB_URL);
    await client.connect();
    console.log('✅ Successfully connected to MongoDB!');
    
    // Test database operations
    const db = client.db();
    const dbName = db.databaseName;
    console.log(`✅ Database: ${dbName}`);
    
    // List collections
    const collections = await db.listCollections().toArray();
    console.log(`✅ Collections: ${collections.length} found`);
    
    // Test collection
    const testCollection = db.collection('legion_test');
    
    // Insert test document
    const testDoc = {
      test: true,
      timestamp: new Date(),
      message: 'MongoDB is properly connected!'
    };
    
    const insertResult = await testCollection.insertOne(testDoc);
    console.log(`✅ Document inserted: ${insertResult.insertedId}`);
    
    // Find document
    const findResult = await testCollection.findOne({ test: true });
    console.log(`✅ Document found: ${findResult.message}`);
    
    // Clean up
    await testCollection.deleteOne({ test: true });
    console.log('✅ Test document cleaned up');
    
    await client.close();
    console.log('\n✅ MongoDB package is properly installed and working!');
    
    return true;
  } catch (error) {
    console.error('\n❌ MongoDB connection failed:', error.message);
    console.error('\nMake sure MongoDB is running locally on port 27017');
    return false;
  }
}

// Run test
testMongoDBDirect().then(success => {
  process.exit(success ? 0 : 1);
});