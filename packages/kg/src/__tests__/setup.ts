/**
 * Test setup for MongoDB Integration Tests
 */

// Global test configuration
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  
  // Configure MongoDB test settings
  if (!process.env.MONGODB_TEST_URL) {
    process.env.MONGODB_TEST_URL = 'mongodb://localhost:27017';
  }
  
  // Suppress console logs during tests (optional)
  if (process.env.SUPPRESS_TEST_LOGS === 'true') {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  }
});

// Global test cleanup
afterAll(() => {
  // Restore console if mocked
  if (process.env.SUPPRESS_TEST_LOGS === 'true') {
    jest.restoreAllMocks();
  }
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in tests, just log
});

// MongoDB connection helper for tests
export const isMongoDBAvailable = async (): Promise<boolean> => {
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_TEST_URL || 'mongodb://localhost:27017');
    await client.connect();
    await client.close();
    return true;
  } catch (error) {
    return false;
  }
};

// Test data cleanup helper
export const cleanupTestData = async (databaseName: string = 'kg_new_test'): Promise<void> => {
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_TEST_URL || 'mongodb://localhost:27017');
    await client.connect();
    
    const db = client.db(databaseName);
    await db.dropDatabase();
    
    await client.close();
    console.log(`✅ Cleaned up test database: ${databaseName}`);
  } catch (error) {
    console.warn(`⚠️  Could not cleanup test database: ${error}`);
  }
};
