/**
 * Direct Image Push Test
 * Pushes asset directly via server actor after client connects
 */

import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout } from 'timers/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log('🚀 Direct Image Push Test\n');

  let server = null;
  let serverActor = null;

  try {
    // Initialize server
    console.log('Step 1: Starting ShowMe server...');
    server = new ShowMeServer({
      port: 3707,
      skipLegionPackages: false,
      browserOptions: {
        app: true,
        width: 1200,
        height: 800
      }
    });

    await server.initialize();
    await server.start();
    console.log(`✅ Server running on http://localhost:3707\n`);

    // Step 2: Add test image
    console.log('Step 2: Adding test image...');
    const imagePath = path.join(__dirname, 'test-image.jpg');
    const assetId = `test-image-${Date.now()}`;

    server.assets.set(assetId, {
      id: assetId,
      type: 'image',
      data: imagePath,
      title: 'Test Image',
      timestamp: Date.now()
    });

    console.log(`✅ Image stored: ${assetId}\n`);

    // Step 3: Get the server actor
    console.log('Step 3: Getting server actor...');
    // Wait a moment for actor to initialize
    await setTimeout(1000);

    // The server actor is created when a client connects
    // We'll launch browser first, then push the asset when client connects

    // Step 4: Launch browser
    console.log('Step 4: Launching Chrome...');
    const url = `http://localhost:3707/showme`;
    await server.launchBrowser(url);
    console.log(`✅ Chrome launched\n`);

    // Step 5: Wait for client connection then push asset
    console.log('Step 5: Waiting for client connection...');
    await setTimeout(3000); // Wait for client to connect

    // Find the server actor from the actor space manager
    const actorSpaceManager = server.actorSpaceManager;
    if (!actorSpaceManager) {
      throw new Error('No ActorSpaceManager found');
    }

    console.log('Step 6: Broadcasting asset to all clients...');

    // Get all actor spaces
    const actorSpaces = Array.from(actorSpaceManager.actorSpaces.values());
    console.log(`Found ${actorSpaces.length} actor spaces`);

    for (const space of actorSpaces) {
      // Get the server actor from this space
      const actors = Array.from(space.guidToObject.values());
      const serverActors = actors.filter(a => a.constructor.name === 'ShowMeServerActor');

      console.log(`  Space ${space.spaceId}: ${serverActors.length} server actors`);

      for (const actor of serverActors) {
        console.log(`  Broadcasting asset via actor...`);

        // Send asset-data message directly
        await actor.broadcast('asset-data', {
          assetId,
          asset: {
            type: 'image',
            url: `/assets/temp/${path.basename(imagePath)}`,
            path: imagePath
          },
          assetType: 'image',
          title: 'Test Image'
        });

        console.log(`  ✅ Asset broadcasted!`);
      }
    }

    console.log('\n=====================================');
    console.log('✅ Image should now be visible!');
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