/**
 * Simple Image Display Test
 * Actually displays a real image in Chrome
 */

import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout } from 'timers/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log('🚀 Simple Image Display Test\n');

  let server = null;

  try {
    // Initialize server
    console.log('Step 1: Starting ShowMe server...');
    server = new ShowMeServer({
      port: 3706,
      skipLegionPackages: false,
      browserOptions: {
        app: true,
        width: 1200,
        height: 800
      }
    });

    await server.initialize();
    await server.start();
    console.log(`✅ Server running on http://localhost:3706\n`);

    // Step 2: Add image asset to storage
    console.log('Step 2: Adding test image to asset storage...');
    const imagePath = path.join(__dirname, 'test-image.jpg');
    const assetId = `test-image-${Date.now()}`;

    // Store image asset directly on server
    server.assets.set(assetId, {
      id: assetId,
      type: 'image',
      data: imagePath, // For images, we store the path
      title: 'Test Image',
      timestamp: Date.now()
    });

    console.log(`✅ Image asset stored: ${assetId}`);
    console.log(`   Path: ${imagePath}\n`);

    // Step 3: Launch browser
    console.log('Step 3: Launching Chrome...');
    const url = `http://localhost:3706/showme?asset=${assetId}`;
    await server.launchBrowser(url);
    console.log(`✅ Chrome launched at: ${url}\n`);

    console.log('=====================================');
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