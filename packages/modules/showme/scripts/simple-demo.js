/**
 * Simple ShowMe Demo - Exactly like the passing test
 */

import { ShowMeServer } from '../src/server/ShowMeServer.js';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function demo() {
  console.log('\n🎨 ShowMe Simple Demo\n');

  const port = 3700;

  // Start server
  console.log('Starting server...');
  const server = new ShowMeServer({ port, skipLegionPackages: true });
  await server.initialize();
  await server.start();
  console.log(`✅ Server running on http://localhost:${port}\n`);

  await sleep(500);

  // Connect client WebSocket
  console.log('Connecting WebSocket client...');
  const clientWs = new WebSocket(`ws://localhost:${port}/ws?route=/showme`);

  await new Promise((resolve) => clientWs.on('open', resolve));
  console.log('✅ WebSocket connected\n');

  // Listen for messages
  clientWs.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('📨 Received:', msg.payload ? msg.payload[0] : msg.type);
  });

  // Send handshake
  console.log('Sending handshake...');
  clientWs.send(JSON.stringify({
    type: 'actor_handshake',
    clientRootActor: 'client-root',
    route: '/showme'
  }));

  await sleep(1000);
  console.log('✅ Handshake complete\n');

  // Get server actor
  console.log('Getting server actor...');
  const actorManager = server.actorManagers.get(port);
  const connections = Array.from(actorManager.connections.values());
  const connection = connections[0];
  const actors = Array.from(connection.actorSpace.guidToObject.values());
  const serverActor = actors.find(a => a.constructor.name === 'ShowMeServerActor');
  console.log('✅ Got server actor\n');

  // Register client
  await serverActor.handleClientConnect({
    clientId: 'demo-client',
    timestamp: Date.now()
  });
  console.log('✅ Client registered\n');

  // Load image
  const imagePath = path.resolve(__dirname, '../../../../../artifacts/dalle3-2025-08-05T08-39-42.png');
  const imageData = fs.readFileSync(imagePath);
  const base64Image = imageData.toString('base64');
  console.log(`✅ Loaded image (${imageData.length} bytes)\n`);

  // Push asset!
  console.log('📤 Pushing asset to client...');
  await serverActor.handleDisplayAsset({
    assetId: 'demo-image',
    assetType: 'image',
    title: '🎨 DALL-E Image',
    asset: {
      type: 'image',
      data: `data:image/png;base64,${base64Image}`,
      width: 1024,
      height: 1024
    }
  });

  console.log('✅ Asset pushed!\n');
  console.log('🎉 Check the console above - you should see "display-asset" received!\n');
  console.log('Server running for 30 seconds...\n');

  await sleep(30000);

  clientWs.close();
  await server.stop();
  console.log('✅ Done!');
  process.exit(0);
}

demo().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});