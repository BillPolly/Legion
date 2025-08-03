#!/usr/bin/env node

/**
 * Storage Actor Server Startup Script
 * Starts the storage actor server for WebSocket-based storage operations
 */

import { ResourceManager } from '../../packages/module-loader/src/resources/ResourceManager.js';
import { StorageActorServer } from '../../packages/storage/server/storage-actor-server.js';

async function startStorageServer() {
  console.log('Starting Storage Actor Server...');
  
  try {
    // Initialize ResourceManager to load environment variables
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Log what MongoDB URL we have
    const mongoUrl = resourceManager.get('env.MONGODB_URL');
    if (mongoUrl) {
      console.log(`MongoDB URL found: ${mongoUrl}`);
    } else {
      console.log('Warning: No MongoDB URL found in environment');
    }
    
    // Get configuration from environment or use defaults
    const port = resourceManager.get('env.STORAGE_ACTOR_PORT') || 3700;
    const path = resourceManager.get('env.STORAGE_ACTOR_PATH') || '/storage';
    
    // Create and start server
    const server = new StorageActorServer({
      resourceManager,
      port,
      path
    });
    
    await server.start();
    
    console.log(`Storage Actor Server is running on ws://localhost:${port}${path}`);
    console.log('Press Ctrl+C to stop the server');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down Storage Actor Server...');
      await server.shutdown();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\nShutting down Storage Actor Server...');
      await server.shutdown();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Failed to start Storage Actor Server:', error);
    process.exit(1);
  }
}

// Start the server
startStorageServer();