#!/usr/bin/env node

import { StorageActorServer } from './server/storage-actor-server.js';
import { ResourceManager } from '../tools/src/ResourceManager.js';

async function startServer() {
  console.log('🚀 Starting Storage Actor Server...');
  
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const server = new StorageActorServer({ 
    resourceManager,
    port: 3700 
  });
  
  await server.start();
  console.log('✅ Storage Actor Server running on ws://localhost:3700/storage');
  console.log('📡 Ready for connections from StorageBrowser frontend');
}

startServer().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});