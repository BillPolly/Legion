#!/usr/bin/env node

/**
 * Verify test data in legion_tests database
 */

import { ResourceManager } from '../../packages/module-loader/src/resources/ResourceManager.js';
import { StorageProvider } from '../../packages/storage/src/StorageProvider.js';

async function verifyTestData() {
  // Initialize ResourceManager
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  // Set MongoDB URL to legion_tests database
  resourceManager.register('env.MONGODB_URL', 'mongodb://localhost:27017/legion_tests');
  
  console.log('Connecting to legion_tests database...\n');
  
  let storageProvider;
  try {
    // Create StorageProvider
    storageProvider = await StorageProvider.create(resourceManager);
    const mongoProvider = storageProvider.getProvider('mongodb');
    
    if (!mongoProvider || !mongoProvider.client) {
      throw new Error('MongoDB provider not available');
    }
    
    const client = mongoProvider.client;
    const db = client.db('legion_tests');
    
    console.log('=== VERIFYING DATA IN legion_tests DATABASE ===\n');
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('Collections found:', collections.map(c => c.name).join(', '));
    console.log('');
    
    // Check test_collection
    console.log('--- test_collection ---');
    const testCollection = db.collection('test_collection');
    const testDocs = await testCollection.find({}).toArray();
    console.log(`Document count: ${testDocs.length}`);
    if (testDocs.length > 0) {
      console.log('Sample documents:');
      testDocs.forEach(doc => {
        console.log(`  - ${doc._id}: ${doc.name} (${doc.type}, ${doc.status})`);
      });
    }
    console.log('');
    
    // Check users collection
    console.log('--- users collection ---');
    const usersCollection = db.collection('users');
    const userDocs = await usersCollection.find({}).toArray();
    console.log(`Document count: ${userDocs.length}`);
    if (userDocs.length > 0) {
      console.log('Sample documents:');
      userDocs.forEach(doc => {
        console.log(`  - ${doc.username}: ${doc.email} (${doc.role})`);
      });
    }
    console.log('');
    
    // Check products collection
    console.log('--- products collection ---');
    const productsCollection = db.collection('products');
    const productDocs = await productsCollection.find({}).toArray();
    console.log(`Document count: ${productDocs.length}`);
    if (productDocs.length > 0) {
      console.log('Sample documents:');
      productDocs.forEach(doc => {
        console.log(`  - ${doc.sku}: ${doc.name} ($${doc.price}, stock: ${doc.stock})`);
      });
    }
    console.log('');
    
    // Now test using the StorageProvider's find method directly
    console.log('=== TESTING STORAGEPROVIDER FIND METHOD ===\n');
    
    // Make sure we're using the right database
    mongoProvider.db = client.db('legion_tests');
    mongoProvider.databaseName = 'legion_tests';
    
    console.log(`StorageProvider database: ${mongoProvider.db.databaseName}`);
    
    const providerResults = await mongoProvider.find('test_collection', {});
    console.log(`StorageProvider find() returned ${providerResults.length} documents from test_collection`);
    
    if (providerResults.length === 0) {
      console.log('\n⚠️  WARNING: StorageProvider returned 0 documents but direct query found documents!');
      console.log('This indicates the StorageProvider might not be using the correct database.');
    } else {
      console.log('\n✅ StorageProvider is correctly finding documents!');
    }
    
    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Database: legion_tests`);
    console.log(`Total collections: ${collections.length}`);
    console.log(`Total documents in test_collection: ${testDocs.length}`);
    console.log(`Total documents in users: ${userDocs.length}`);
    console.log(`Total documents in products: ${productDocs.length}`);
    
    if (testDocs.length === 0 && userDocs.length === 0 && productDocs.length === 0) {
      console.log('\n❌ No data found! You may need to run setup-test-database.js first.');
    } else {
      console.log('\n✅ Test data is present in the database!');
    }
    
  } catch (error) {
    console.error('Error verifying test data:', error);
    process.exit(1);
  } finally {
    if (storageProvider) {
      await storageProvider.cleanup();
    }
    console.log('\nConnection closed');
  }
}

// Run verification
verifyTestData().catch(console.error);