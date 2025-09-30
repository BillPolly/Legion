/**
 * Send image via server actor to connected browser
 */
process.env.NODE_ENV = 'test';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ShowMeServer } from '../../src/server/ShowMeServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Connecting to running ShowMe server on port 4567...');

// We need to access the running server instance
// The server is running in another process, so we need to use WebSocket to send commands
// OR we can connect as a node client and get the actor directly

// Actually, let me just import and get the singleton server instance
const existingServers = global.showMeServerInstances || {};

// Wait, the server is in a different process. Let me think...
// The MCP browser is connected to port 4567
// I need to get that server's actor and call handleDisplayAsset

// The only way is to connect via WebSocket as a client and send the message
// OR access the server process directly

console.log('ERROR: Cannot access server actor from different process');
console.log('Need to either:');
console.log('1. Export server instance globally');
console.log('2. Connect via WebSocket as admin client');
console.log('3. Use IPC to communicate with server process');

process.exit(1);