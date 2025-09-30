/**
 * WebSocket Asset Push Test
 * Properly uses Actor protocol to push asset via WebSocket
 */

import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout } from 'timers/promises';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log('🚀 WebSocket Asset Push Test\n');

  let server = null;

  try {
    // Step 1: Start server
    console.log('Step 1: Starting ShowMe server...');
    server = new ShowMeServer({
      port: 3708,
      skipLegionPackages: false,
      browserOptions: {
        app: true,
        width: 1200,
        height: 800
      }
    });

    await server.initialize();
    await server.start();
    console.log(`✅ Server running on http://localhost:3708\n`);

    // Step 2: Launch browser FIRST (so client connects)
    console.log('Step 2: Launching browser...');
    const url = `http://localhost:3708/showme`;
    await server.launchBrowser(url);
    console.log(`✅ Browser launched\n`);

    // Step 3: Wait for client to connect
    console.log('Step 3: Waiting for client connection...');
    await setTimeout(5000); // Give client time to connect and initialize

    // Step 4: Get the server actor and push asset via Actor protocol
    console.log('Step 4: Finding server actor...');

    // Get the ActorSpaceManager for our port
    const actorSpaceManager = server.actorManagers.get(3708);

    if (!actorSpaceManager) {
      throw new Error('No ActorSpaceManager found for port 3708');
    }

    console.log(`✅ Found ActorSpaceManager`);

    const actorSpaces = Array.from(actorSpaceManager.actorSpaces.values());
    console.log(`Found ${actorSpaces.length} actor spaces`);

    if (actorSpaces.length === 0) {
      throw new Error('No client connected - no actor spaces');
    }

    // Get the first actor space (should be our client)
    const space = actorSpaces[0];
    console.log(`Using actor space: ${space.spaceId}`);

    // Find the ShowMeServerActor
    const actors = Array.from(space.guidToObject.values());
    const serverActor = actors.find(a => a.constructor.name === 'ShowMeServerActor');

    if (!serverActor) {
      throw new Error('ShowMeServerActor not found');
    }

    console.log(`✅ Found ShowMeServerActor\n`);

    // Step 5: Read the test image
    console.log('Step 5: Reading test image...');
    const imagePath = path.join(__dirname, 'test-image.jpg');
    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString('base64');

    console.log(`✅ Image loaded: ${imageData.length} bytes\n`);

    // Step 6: Call handleDisplayAsset on the server actor
    console.log('Step 6: Pushing asset via Actor protocol...');
    const assetId = `image-${Date.now()}`;

    await serverActor.handleDisplayAsset({
      assetId,
      assetType: 'image',
      title: 'Test Image from WebSocket',
      asset: {
        type: 'image',
        data: `data:image/jpeg;base64,${base64Image}`,
        width: 400,
        height: 300
      }
    });

    console.log(`✅ Asset pushed: ${assetId}\n`);

    console.log('=====================================');
    console.log('✅ Image should now be visible!');
    console.log('✅ Check the browser window');
    console.log('=====================================\n');
    console.log('Keeping server alive for 60 seconds...\n');

    await setTimeout(60000);

    console.log('\n⏱️  Time expired. Shutting down...');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (server && server.isRunning) {
      console.log('\n🧹 Stopping server...');
      await server.stop();
      console.log('✅ Server stopped');
    }
  }

  console.log('\n✅ Test completed!');
  process.exit(0);
}

process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Received SIGINT, shutting down...');
  process.exit(0);
});

run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});