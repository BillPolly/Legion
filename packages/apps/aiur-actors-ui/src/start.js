#!/usr/bin/env node

/**
 * Aiur Actors UI - Server Entry Point
 * Starts the static server to serve the UI application
 */

import { StaticServer } from './server/StaticServer.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const config = {
  port: process.env.UI_PORT || 3002,
  publicDir: join(__dirname, '../public'),
  srcDir: join(__dirname, '../src'),
  cors: true,
  corsOrigin: '*',
  compression: true,
  etag: true,
  caching: true,
  spa: true, // Single Page Application mode
  securityHeaders: true,
  mimeTypes: {
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  }
};

// Create and start server
const server = new StaticServer(config);

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Aiur Actors UI server...');
  server.stop(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  server.stop(() => {
    process.exit(0);
  });
});

// Start the server
async function start() {
  try {
    console.log('🚀 Starting Aiur Actors UI server...');
    console.log(`📁 Serving from: ${config.publicDir}`);
    
    await server.start();
    
    console.log(`✅ Aiur Actors UI is running at http://localhost:${config.port}`);
    console.log(`🔌 Expecting Aiur server at ws://localhost:8080/actors`);
    console.log('\nPress Ctrl+C to stop\n');
    
    // Log available routes
    console.log('Available routes:');
    console.log('  - http://localhost:' + config.port + '/ (Main UI)');
    console.log('  - http://localhost:' + config.port + '/app/* (Application modules)');
    console.log('  - http://localhost:' + config.port + '/components/* (UI components)');
    console.log('  - http://localhost:' + config.port + '/actors/* (Actor system)');
    console.log('  - http://localhost:' + config.port + '/services/* (Services)');
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Run the server
start();