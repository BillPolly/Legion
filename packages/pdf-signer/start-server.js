#!/usr/bin/env node

/**
 * PDF Signer Server Startup Script
 * 
 * Simple script to start the PDF Signer web application
 */

import { startPDFSignerServer } from './server/pdf-signer-server.js';

// Start the server
startPDFSignerServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});