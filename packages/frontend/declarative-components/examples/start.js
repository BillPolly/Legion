#!/usr/bin/env node

/**
 * Start script for Declarative Components Examples Server
 * Simple launcher for the examples server
 */

import { ExamplesServer } from './server/index.js';

async function start() {
  console.log('🚀 Starting Declarative Components Examples Server...\n');
  
  try {
    const server = new ExamplesServer();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down Examples Server...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down Examples Server...');
      await server.stop();
      process.exit(0);
    });

    // Start server
    await server.initialize();
    await server.start();
    
    console.log('\n✅ Examples Server is ready!');
    console.log('📖 Browse examples at: http://localhost:3800');
    console.log('🛠️ API endpoints at: http://localhost:3800/api');
    console.log('\nPress Ctrl+C to stop the server');
    
  } catch (error) {
    console.error('❌ Failed to start Examples Server:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

start().catch(error => {
  console.error('❌ Startup error:', error);
  process.exit(1);
});