/**
 * Visual test for ShowMe WebSocket asset display
 * This script starts the ShowMe server and displays an image via WebSocket
 */

import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log('Step 1: Starting ShowMe server...');

  const server = new ShowMeServer({
    port: 4567
  });

  await server.start();
  console.log('✅ Server started on http://localhost:4567');

  // Wait for browser to connect (manual or via MCP tool)
  console.log('\n📋 Next steps:');
  console.log('1. Open browser to: http://localhost:4567');
  console.log('2. Wait for WebSocket connection');
  console.log('3. Script will send test image after connection\n');

  // Wait for client connection
  console.log('Step 2: Waiting for client connection...');

  // Poll for connection
  let connected = false;
  let serverActor = null;

  while (!connected) {
    await new Promise(resolve => setTimeout(resolve, 500));

    const actorManager = server.actorManagers.get(4567);
    if (actorManager && actorManager.connections.size > 0) {
      const connections = Array.from(actorManager.connections.values());
      const connection = connections[0];
      serverActor = connection.serverActor;

      if (serverActor && serverActor.remoteActor) {
        connected = true;
        console.log('✅ Client connected');
      }
    }
  }

  // Step 3: Register the client
  console.log('Step 3: Registering client...');
  const clientId = 'visual-test-client-' + Date.now();
  await serverActor.handleClientConnect({ clientId, timestamp: Date.now() });
  console.log('✅ Client registered');

  // Step 4: Create test image
  console.log('Step 4: Creating test image...');
  const testImagePath = path.join(__dirname, 'test-image.jpg');

  // Create a simple test image if it doesn't exist
  if (!fs.existsSync(testImagePath)) {
    // Create a 100x100 red square as base64
    const redSquare = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    const base64Data = redSquare.split(',')[1];
    fs.writeFileSync(testImagePath, Buffer.from(base64Data, 'base64'));
  }

  const imageData = fs.readFileSync(testImagePath);
  const base64Image = imageData.toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64Image}`;

  console.log(`✅ Image loaded: ${imageData.length} bytes`);

  // Step 5: Display the asset
  console.log('Step 5: Sending image to browser...');

  const assetId = 'visual-test-image-' + Date.now();
  await serverActor.handleDisplayAsset({
    assetId,
    assetType: 'image',
    title: 'Visual Test Image',
    asset: {
      type: 'image',
      data: dataUrl,
      width: 100,
      height: 100
    }
  });

  console.log('✅ Image sent to browser');
  console.log('\n🎨 Check the browser window - you should see the test image!');
  console.log('📸 Take a screenshot to verify the image is displayed\n');

  // Keep server running
  console.log('Server will keep running. Press Ctrl+C to stop.');
}

run().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});