#!/usr/bin/env node

/**
 * Aiur Server - Standalone backend server entry point
 * 
 * Can be run independently or spawned by the MCP stub
 */

import { AiurServer } from './AiurServer.js';

// Create and start server
const server = new AiurServer({
  port: process.env.AIUR_SERVER_PORT || 8080,
  host: process.env.AIUR_SERVER_HOST || 'localhost',
  sessionTimeout: parseInt(process.env.AIUR_SESSION_TIMEOUT) || 3600000
});

// Handle process signals
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

// Start the server
server.start().catch(async (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});