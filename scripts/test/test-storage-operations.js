#!/usr/bin/env node

/**
 * Storage Operations Test
 * Tests CRUD operations through the actor protocol
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import WebSocket from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '../..');

// Configuration
const STORAGE_SERVER_PORT = process.env.STORAGE_ACTOR_PORT || 3700;
const STORAGE_SERVER_PATH = process.env.STORAGE_ACTOR_PATH || '/storage';

let storageServerProcess;
let ws;
let requestIdCounter = 1;

function startStorageServer() {
  return new Promise((resolve, reject) => {
    console.log('Starting Storage Actor Server...');
    
    const scriptPath = path.join(rootDir, 'scripts/server/start-storage-server.js');
    storageServerProcess = spawn('node', [scriptPath], {
      cwd: rootDir,
      stdio: 'pipe',
      env: { ...process.env }
    });
    
    storageServerProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Storage Actor Server running')) {
        resolve();
      }
    });
    
    storageServerProcess.stderr.on('data', (data) => {
      console.error(`[Server Error] ${data.toString()}`);
    });
    
    storageServerProcess.on('error', reject);
    
    setTimeout(() => reject(new Error('Server startup timeout')), 5000);
  });
}

function connectWebSocket() {
  return new Promise((resolve, reject) => {
    console.log('\nConnecting to WebSocket...');
    
    ws = new WebSocket(`ws://localhost:${STORAGE_SERVER_PORT}${STORAGE_SERVER_PATH}`);
    
    ws.on('open', () => {
      console.log('✓ Connected to server');
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'connected') {
        console.log('✓ Handshake complete');
        resolve();
      }
    });
    
    ws.on('error', reject);
    
    setTimeout(() => reject(new Error('Connection timeout')), 5000);
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

async function testCRUDOperations() {
  console.log('\n========================================');
  console.log('Testing CRUD Operations');
  console.log('========================================\n');
  
  try {
    // 1. List collections
    console.log('1. Listing collections...');
    const collections = await sendRequest('CollectionActor', 'listCollections', {
      provider: 'memory'
    });
    console.log(`✓ Found ${collections.length} collections:`, collections);
    
    // 2. Create document
    console.log('\n2. Creating test document...');
    const createResult = await sendRequest('CollectionActor', 'insert', {
      collection: 'test-collection',
      documents: { 
        name: 'Test User', 
        email: 'test@example.com',
        age: 30,
        created: new Date().toISOString()
      }
    });
    console.log('✓ Document created:', createResult);
    
    // 3. Find documents
    console.log('\n3. Finding documents...');
    const findResult = await sendRequest('CollectionActor', 'find', {
      collection: 'test-collection',
      query: {},
      options: {}
    });
    console.log(`✓ Found ${findResult.length} documents`);
    
    // 4. Update document
    console.log('\n4. Updating document...');
    const updateResult = await sendRequest('CollectionActor', 'update', {
      collection: 'test-collection',
      filter: { name: 'Test User' },
      update: { $set: { age: 31, updated: true } },
      options: {}
    });
    console.log('✓ Document updated:', updateResult);
    
    // 5. Count documents
    console.log('\n5. Counting documents...');
    const count = await sendRequest('CollectionActor', 'count', {
      collection: 'test-collection',
      query: {}
    });
    console.log(`✓ Document count: ${count}`);
    
    // 6. Delete document
    console.log('\n6. Deleting document...');
    const deleteResult = await sendRequest('CollectionActor', 'delete', {
      collection: 'test-collection',
      filter: { name: 'Test User' },
      options: {}
    });
    console.log('✓ Document deleted:', deleteResult);
    
    // 7. Verify deletion
    console.log('\n7. Verifying deletion...');
    const finalCount = await sendRequest('CollectionActor', 'count', {
      collection: 'test-collection',
      query: {}
    });
    console.log(`✓ Final document count: ${finalCount}`);
    
    return true;
    
  } catch (error) {
    console.error('✗ CRUD test failed:', error.message);
    return false;
  }
}

async function runFullTest() {
  console.log('========================================');
  console.log('Storage Operations Full Test');
  console.log('========================================\n');
  
  let testPassed = false;
  
  try {
    // Start server
    await startStorageServer();
    console.log('✓ Server started');
    
    // Wait for server to fully initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Connect WebSocket
    await connectWebSocket();
    
    // Run CRUD tests
    testPassed = await testCRUDOperations();
    
  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    testPassed = false;
  } finally {
    // Cleanup
    if (ws) {
      ws.close();
    }
    
    if (storageServerProcess) {
      console.log('\nStopping server...');
      storageServerProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n========================================');
    if (testPassed) {
      console.log('✅ ALL TESTS PASSED!');
      console.log('========================================\n');
      process.exit(0);
    } else {
      console.log('❌ TESTS FAILED');
      console.log('========================================\n');
      process.exit(1);
    }
  }
}

// Run the test
runFullTest();