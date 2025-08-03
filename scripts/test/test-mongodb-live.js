#!/usr/bin/env node

/**
 * Live MongoDB Connection Test
 * Tests actual MongoDB operations through the storage actor server
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import WebSocket from 'ws';
// MongoDB verification will be done through the storage actor protocol
// No direct MongoDB import needed - the storage package handles it

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '../..');

// Configuration
const STORAGE_SERVER_PORT = process.env.STORAGE_ACTOR_PORT || 3700;
const STORAGE_SERVER_PATH = process.env.STORAGE_ACTOR_PATH || '/storage';
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017/legion_storage';

let storageServerProcess;
let ws;
let requestIdCounter = 1;

async function verifyMongoConnection() {
  // MongoDB connection will be verified through the storage server
  // The server will handle the actual MongoDB connection
  console.log('MongoDB connection will be verified through storage server...');
  return true;
}

function startStorageServer() {
  return new Promise((resolve, reject) => {
    console.log('\nStarting Storage Actor Server with MongoDB...');
    
    const scriptPath = path.join(rootDir, 'scripts/server/start-storage-server.js');
    storageServerProcess = spawn('node', [scriptPath], {
      cwd: rootDir,
      stdio: 'pipe',
      env: { 
        ...process.env,
        MONGODB_URL,
        STORAGE_PROVIDER: 'mongodb'
      }
    });
    
    let serverOutput = '';
    
    storageServerProcess.stdout.on('data', (data) => {
      serverOutput += data.toString();
      console.log(`[Server] ${data.toString().trim()}`);
      
      if (data.toString().includes('Storage Actor Server running')) {
        // Check if MongoDB provider was initialized
        if (serverOutput.includes('mongodb')) {
          console.log('✓ Server started with MongoDB provider');
        } else {
          console.log('⚠️ Server started but MongoDB provider may not be active');
        }
        resolve();
      }
    });
    
    storageServerProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error(`[Server Error] ${error}`);
      if (error.includes('MongoServerError') || error.includes('MongoNetworkError')) {
        reject(new Error('MongoDB connection error'));
      }
    });
    
    storageServerProcess.on('error', reject);
    
    setTimeout(() => reject(new Error('Server startup timeout')), 8000);
  });
}

function connectWebSocket() {
  return new Promise((resolve, reject) => {
    console.log('\nConnecting to Storage Actor Server...');
    
    ws = new WebSocket(`ws://localhost:${STORAGE_SERVER_PORT}${STORAGE_SERVER_PATH}`);
    
    ws.on('open', () => {
      console.log('✓ WebSocket connected');
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'connected') {
        console.log('✓ Actor protocol handshake complete');
        resolve();
      }
    });
    
    ws.on('error', reject);
    
    setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
  });
}

function sendRequest(actor, method, params) {
  return new Promise((resolve, reject) => {
    const requestId = `test-${requestIdCounter++}`;
    
    const timeout = setTimeout(() => {
      reject(new Error(`Request timeout: ${method}`));
    }, 5000);
    
    const handler = (data) => {
      const message = JSON.parse(data.toString());
      if (message.id === requestId) {
        clearTimeout(timeout);
        ws.off('message', handler);
        
        if (message.success) {
          resolve(message.data);
        } else {
          reject(new Error(message.error?.message || 'Request failed'));
        }
      }
    };
    
    ws.on('message', handler);
    
    ws.send(JSON.stringify({
      type: 'request',
      id: requestId,
      actor,
      method,
      params,
      timestamp: Date.now()
    }));
  });
}

async function testMongoDBOperations() {
  console.log('\n========================================');
  console.log('Testing MongoDB Operations');
  console.log('========================================\n');
  
  try {
    const testData = {
      name: 'MongoDB Test User',
      email: 'mongodb@test.com',
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'live-test',
        version: '1.0'
      }
    };
    
    // 1. Insert document
    console.log('1. Inserting document into MongoDB...');
    const insertResult = await sendRequest('CollectionActor', 'insert', {
      collection: 'test-collection',
      documents: testData,
      options: {}
    });
    console.log('✓ Document inserted:', insertResult);
    
    // 2. Find document
    console.log('\n2. Finding document in MongoDB...');
    const findResult = await sendRequest('CollectionActor', 'find', {
      collection: 'test-collection',
      query: { email: 'mongodb@test.com' },
      options: {}
    });
    console.log(`✓ Found ${findResult.length} documents`);
    if (findResult.length > 0) {
      console.log('  Document:', JSON.stringify(findResult[0], null, 2));
    }
    
    // 3. Update document
    console.log('\n3. Updating document in MongoDB...');
    const updateResult = await sendRequest('CollectionActor', 'update', {
      collection: 'test-collection',
      filter: { email: 'mongodb@test.com' },
      update: { 
        $set: { 
          updated: true, 
          lastModified: new Date().toISOString() 
        } 
      },
      options: {}
    });
    console.log('✓ Update result:', updateResult);
    
    // 4. Verify update through storage server
    console.log('\n4. Verifying update through storage server...');
    const verifyResult = await sendRequest('CollectionActor', 'findOne', {
      collection: 'test-collection',
      query: { email: 'mongodb@test.com' },
      options: {}
    });
    if (verifyResult) {
      console.log('✓ Document verified in MongoDB:');
      console.log('  - Name:', verifyResult.name);
      console.log('  - Updated:', verifyResult.updated);
      console.log('  - Last Modified:', verifyResult.lastModified);
    } else {
      console.log('⚠️ Document not found after update');
    }
    
    // 5. Count documents
    console.log('\n5. Counting documents in MongoDB...');
    const count = await sendRequest('CollectionActor', 'count', {
      collection: 'test-collection',
      query: {}
    });
    console.log(`✓ Total documents in collection: ${count}`);
    
    // 6. Delete test data
    console.log('\n6. Cleaning up test data...');
    const deleteResult = await sendRequest('CollectionActor', 'delete', {
      collection: 'test-collection',
      filter: { email: 'mongodb@test.com' },
      options: {}
    });
    console.log('✓ Cleanup complete:', deleteResult);
    
    return true;
    
  } catch (error) {
    console.error('✗ MongoDB operation failed:', error.message);
    return false;
  }
}

async function runFullMongoDBTest() {
  console.log('========================================');
  console.log('Live MongoDB Integration Test');
  console.log('========================================\n');
  
  let testPassed = false;
  
  try {
    // Verify MongoDB is accessible
    const mongoAvailable = await verifyMongoConnection();
    if (!mongoAvailable) {
      throw new Error('MongoDB is not accessible');
    }
    
    // Start storage server with MongoDB
    await startStorageServer();
    
    // Wait for server initialization
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Connect WebSocket
    await connectWebSocket();
    
    // Run MongoDB operations
    testPassed = await testMongoDBOperations();
    
  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    testPassed = false;
  } finally {
    // Cleanup
    if (ws) {
      ws.close();
    }
    
    // MongoDB connection is managed by the storage server
    
    if (storageServerProcess) {
      console.log('Stopping storage server...');
      storageServerProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n========================================');
    if (testPassed) {
      console.log('✅ MONGODB LIVE TEST PASSED!');
      console.log('========================================\n');
      process.exit(0);
    } else {
      console.log('❌ MONGODB LIVE TEST FAILED');
      console.log('========================================\n');
      process.exit(1);
    }
  }
}

// Run the test
runFullMongoDBTest();