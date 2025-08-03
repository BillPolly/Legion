#!/usr/bin/env node

/**
 * Setup test database with sample data for Storage Browser testing
 */

import { ResourceManager } from '../../packages/module-loader/src/resources/ResourceManager.js';
import { StorageProvider } from '../../packages/storage/src/StorageProvider.js';

async function setupTestDatabase() {
  // Initialize ResourceManager
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  // Override MongoDB URL to use legion_tests database
  resourceManager.register('env.MONGODB_URL', 'mongodb://localhost:27017/legion_tests');
  
  console.log('Creating StorageProvider for legion_tests database...');
  
  let storageProvider;
  try {
    // Create StorageProvider
    storageProvider = await StorageProvider.create(resourceManager);
    const mongoProvider = storageProvider.getProvider('mongodb');
    
    if (!mongoProvider || !mongoProvider.client) {
      throw new Error('MongoDB provider not available');
    }
    
    const client = mongoProvider.client;
    console.log('Connected to MongoDB');
    
    // Create or switch to legion_tests database
    const db = client.db('legion_tests');
    console.log('Using database: legion_tests');
    
    // Create test_collection
    const collection = db.collection('test_collection');
    
    // Clear existing data
    await collection.deleteMany({});
    console.log('Cleared existing data in test_collection');
    
    // Insert test documents
    const testDocuments = [
      {
        _id: 'test-001',
        name: 'Test Document 1',
        type: 'test',
        status: 'active',
        created: new Date(),
        data: {
          value: 42,
          description: 'This is a test document for Storage Browser'
        }
      },
      {
        _id: 'test-002', 
        name: 'Test Document 2',
        type: 'test',
        status: 'inactive',
        created: new Date(),
        data: {
          value: 100,
          description: 'Another test document'
        }
      },
      {
        _id: 'test-003',
        name: 'Test Document 3',
        type: 'demo',
        status: 'active',
        created: new Date(),
        tags: ['important', 'demo', 'storage-browser'],
        metrics: {
          views: 150,
          likes: 25
        }
      }
    ];
    
    const result = await collection.insertMany(testDocuments);
    console.log(`Inserted ${result.insertedCount} test documents`);
    
    // Create another collection with different data
    const usersCollection = db.collection('users');
    await usersCollection.deleteMany({});
    
    const testUsers = [
      {
        username: 'testuser1',
        email: 'test1@example.com',
        role: 'admin',
        active: true,
        lastLogin: new Date()
      },
      {
        username: 'testuser2',
        email: 'test2@example.com',
        role: 'user',
        active: true,
        preferences: {
          theme: 'dark',
          notifications: true
        }
      }
    ];
    
    const usersResult = await usersCollection.insertMany(testUsers);
    console.log(`Inserted ${usersResult.insertedCount} test users`);
    
    // Create a products collection
    const productsCollection = db.collection('products');
    await productsCollection.deleteMany({});
    
    const testProducts = [
      {
        sku: 'PROD-001',
        name: 'Widget A',
        price: 29.99,
        stock: 100,
        category: 'widgets'
      },
      {
        sku: 'PROD-002',
        name: 'Gadget B',
        price: 49.99,
        stock: 50,
        category: 'gadgets'
      }
    ];
    
    const productsResult = await productsCollection.insertMany(testProducts);
    console.log(`Inserted ${productsResult.insertedCount} test products`);
    
    // Verify the data
    console.log('\nVerifying data:');
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
    const docCount = await collection.countDocuments();
    console.log(`test_collection has ${docCount} documents`);
    
    const userCount = await usersCollection.countDocuments();
    console.log(`users collection has ${userCount} documents`);
    
    const productCount = await productsCollection.countDocuments();
    console.log(`products collection has ${productCount} documents`);
    
    // Show sample document
    const sampleDoc = await collection.findOne({ _id: 'test-001' });
    console.log('\nSample document from test_collection:');
    console.log(JSON.stringify(sampleDoc, null, 2));
    
    console.log('\n✅ Test database setup complete!');
    console.log('Database: legion_tests');
    console.log('Collections: test_collection, users, products');
    
  } catch (error) {
    console.error('Error setting up test database:', error);
    process.exit(1);
  } finally {
    // Cleanup StorageProvider
    if (storageProvider) {
      await storageProvider.cleanup();
    }
    console.log('MongoDB connection closed');
  }
}

// Run the setup
setupTestDatabase().catch(console.error);