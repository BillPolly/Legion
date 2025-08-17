#!/usr/bin/env node

/**
 * PDF Signer Server Application
 * 
 * This server application uses the Legion Server Framework to host the PDF Signer
 * functionality as a web application with client and server actors.
 */

import { BaseServer } from '@legion/server-framework';
import { createServerActorFactory } from '../src/index.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Main server startup function
 */
async function startPDFSignerServer() {
  console.log('🚀 Starting PDF Signer Server...');

  try {
    // Create server instance
    const server = new BaseServer();
    
    // Initialize with ResourceManager singleton
    await server.initialize();
    console.log('✅ Server initialized with ResourceManager');

    // Get server actor factory
    const serverActorFactory = createServerActorFactory();
    
    // Path to client actor file
    const clientActorPath = join(__dirname, '../src/client/PDFSignerClientActor.js');
    
    // Register PDF Signer route
    server.registerRoute(
      '/pdf-signer',           // Route path
      serverActorFactory,      // Server actor factory function
      clientActorPath,         // Client actor file path  
      8080                     // Port (default)
    );
    
    console.log('✅ PDF Signer route registered at /pdf-signer');

    // Register static assets if needed
    const staticPath = join(__dirname, '../static');
    try {
      server.registerStaticRoute('/pdf-assets', staticPath);
      console.log('✅ Static assets registered at /pdf-assets');
    } catch (error) {
      console.log('ℹ️  No static assets directory found, skipping');
    }

    // Start the server
    await server.start();
    
    console.log('🎉 PDF Signer Server started successfully!');
    console.log('');
    console.log('📱 Web Interface:');
    console.log('   http://localhost:8080/pdf-signer');
    console.log('');
    console.log('🔍 Health Check:');
    console.log('   http://localhost:8080/health');
    console.log('');
    console.log('📡 WebSocket Endpoint:');
    console.log('   ws://localhost:8080/ws');
    console.log('');
    console.log('🛑 Press Ctrl+C to stop the server');

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start PDF Signer Server:', error.message);
    console.error('🐛 Error details:', error);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startPDFSignerServer();
}

export { startPDFSignerServer };