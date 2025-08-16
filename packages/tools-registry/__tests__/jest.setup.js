/**
 * Jest Global Setup for tools-registry Tests
 * 
 * This file runs once before all tests to verify that required resources
 * are available. If any resource is missing, tests will FAIL immediately.
 * 
 * NO MOCKS, NO FALLBACKS - Real resources only!
 */

console.log('🔍 SETUP: Loading global setup file...');

import { ResourceManager } from '@legion/core';
import { MongoClient } from 'mongodb';
import fetch from 'node-fetch';
import chalk from 'chalk';

console.log('🔍 SETUP: Imports completed');

// Global test state
global.testResourceManager = null;
global.testMongoClient = null;
global.testMongoDb = null;
global.qdrantAvailable = false;

/**
 * Verify MongoDB is available
 * FAILS if MongoDB is not running
 */
async function verifyMongoDB() {
  console.log(chalk.blue('🔍 Verifying MongoDB connection...'));
  
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  
  try {
    global.testMongoClient = new MongoClient(mongoUri);
    await global.testMongoClient.connect();
    
    // Verify we can access the test database
    global.testMongoDb = global.testMongoClient.db('legion_tools_test');
    await global.testMongoDb.admin().ping();
    
    console.log(chalk.green('✅ MongoDB connected successfully'));
    return true;
  } catch (error) {
    console.error(chalk.red('❌ MongoDB connection FAILED:'), error.message);
    console.error(chalk.red('   MongoDB must be running for tests to execute'));
    console.error(chalk.red(`   Connection string: ${mongoUri}`));
    throw new Error('MongoDB is required but not available. Tests cannot run.');
  }
}

/**
 * Verify Qdrant is available
 * FAILS if Qdrant is required but not running
 */
async function verifyQdrant() {
  console.log(chalk.blue('🔍 Verifying Qdrant connection...'));
  
  const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
  
  try {
    const response = await fetch(`${qdrantUrl}/collections`);
    if (response.ok) {
      global.qdrantAvailable = true;
      console.log(chalk.green('✅ Qdrant connected successfully'));
      return true;
    }
    throw new Error(`Qdrant returned status ${response.status}`);
  } catch (error) {
    console.error(chalk.yellow('⚠️  Qdrant connection failed:'), error.message);
    console.error(chalk.yellow('   Semantic search tests will FAIL'));
    console.error(chalk.yellow(`   Expected Qdrant at: ${qdrantUrl}`));
    
    // For semantic search tests, this will cause failures
    // But we don't block all tests since some don't need Qdrant
    global.qdrantAvailable = false;
    return false;
  }
}

/**
 * Initialize ResourceManager
 * FAILS if .env file is missing or invalid
 */
async function initializeResourceManager() {
  console.log(chalk.blue('🔍 Initializing ResourceManager...'));
  
  try {
    global.testResourceManager = ResourceManager.getInstance();
    await global.testResourceManager.initialize();
    
    // Verify critical environment variables
    const requiredVars = ['MONGODB_URI', 'MONGODB_DATABASE'];
    const missing = [];
    
    for (const varName of requiredVars) {
      if (!global.testResourceManager.get(`env.${varName}`)) {
        missing.push(varName);
      }
    }
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    console.log(chalk.green('✅ ResourceManager initialized with environment variables'));
    return true;
  } catch (error) {
    console.error(chalk.red('❌ ResourceManager initialization FAILED:'), error.message);
    console.error(chalk.red('   Ensure .env file exists with required variables'));
    throw new Error('ResourceManager initialization failed. Tests cannot run.');
  }
}

/**
 * Clear test database collections
 * Ensures clean state for tests
 */
async function clearTestDatabase() {
  console.log(chalk.blue('🧹 Clearing test database...'));
  
  try {
    const collections = ['modules', 'tools', 'tool_perspectives'];
    
    for (const collectionName of collections) {
      try {
        await global.testMongoDb.collection(collectionName).drop();
        console.log(chalk.gray(`   Dropped collection: ${collectionName}`));
      } catch (error) {
        // Collection might not exist, that's ok
        if (error.code !== 26) { // 26 = NamespaceNotFound
          throw error;
        }
      }
    }
    
    console.log(chalk.green('✅ Test database cleared'));
  } catch (error) {
    console.error(chalk.red('❌ Failed to clear test database:'), error.message);
    throw error;
  }
}

/**
 * Global setup function - runs once before all tests
 */
async function globalSetup() {
  console.log('🔍 SETUP: globalSetup function called');
  console.log(chalk.bold.blue('\n🚀 Tools Registry Test Suite - Global Setup\n'));
  console.log(chalk.gray('Policy: NO MOCKS, NO FALLBACKS - Real resources only!\n'));
  
  try {
    // 1. Initialize ResourceManager (required)
    await initializeResourceManager();
    
    // 2. Verify MongoDB (required)
    await verifyMongoDB();
    
    // 3. Verify Qdrant (optional but will cause semantic test failures)
    await verifyQdrant();
    
    // 4. Clear test database
    await clearTestDatabase();
    
    console.log(chalk.bold.green('\n✅ Global setup complete - ready to run tests\n'));
  } catch (error) {
    console.error(chalk.bold.red('\n❌ GLOBAL SETUP FAILED - TESTS CANNOT RUN\n'));
    console.error(chalk.red(error.message));
    console.error(chalk.red('\nPlease ensure all required services are running:'));
    console.error(chalk.red('  1. MongoDB (required)'));
    console.error(chalk.red('  2. Qdrant (required for semantic tests)'));
    console.error(chalk.red('  3. .env file with valid configuration'));
    
    // Exit with error code to prevent tests from running
    process.exit(1);
  }
  
  // Return a teardown function
  return async () => {
    console.log(chalk.blue('\n🧹 Global teardown...'));
    
    // Clean up test database
    try {
      await clearTestDatabase();
    } catch (error) {
      console.error(chalk.yellow('Warning: Failed to clean test database:'), error.message);
    }
    
    // Close MongoDB connection
    if (global.testMongoClient) {
      await global.testMongoClient.close();
      console.log(chalk.green('✅ MongoDB connection closed'));
    }
    
    console.log(chalk.green('✅ Global teardown complete\n'));
  };
}

// Export the setup function
export default globalSetup;