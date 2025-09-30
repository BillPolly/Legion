/**
 * Simple ShowMe server for visual testing
 */

// Set test environment
process.env.NODE_ENV = 'test';

import { ShowMeServer } from '../../src/server/ShowMeServer.js';

const server = new ShowMeServer({ port: 4567 });

await server.initialize();
await server.start();

console.log('\n✅ ShowMe Server started on http://localhost:4567');
console.log('📱 Open browser to: http://localhost:4567');
console.log('🔌 WebSocket endpoint: ws://localhost:4567/ws?route=/showme\n');
console.log('Press Ctrl+C to stop');

// Keep server running
process.on('SIGINT', async () => {
  console.log('\n\nShutting down...');
  await server.stop();
  process.exit(0);
});