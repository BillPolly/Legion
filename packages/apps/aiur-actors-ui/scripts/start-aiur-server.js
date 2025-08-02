#!/usr/bin/env node
/**
 * Start just the Aiur WebSocket server
 */
import { AiurServer } from '../../../aiur/src/server/AiurServer.js';

const PORT = 8080;
const HOST = 'localhost';

// Create and start server
const server = new AiurServer({ 
  port: PORT, 
  host: HOST 
});

server.start().then(() => {
  console.log(`AiurServer listening on http://${HOST}:${PORT}`);
  console.log(`WebSocket endpoint: ws://${HOST}:${PORT}/ws`);
  console.log(`Health check: http://${HOST}:${PORT}/health`);
}).catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.stop();
  process.exit(0);
});