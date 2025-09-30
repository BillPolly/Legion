/**
 * Demo: ShowMe with Real Browser
 *
 * 1. Start server
 * 2. Wait for browser to connect
 * 3. Push image to browser
 */

import { ShowMeServer } from '../src/server/ShowMeServer.js';
import { ResourceManager } from '@legion/resource-manager';
import open from 'open';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3700;

async function demo() {
  console.log('\n🎨 ShowMe Browser Demo\n');

  // Initialize ResourceManager
  await ResourceManager.getInstance();

  // Start server
  console.log('Starting ShowMe server...');
  const server = new ShowMeServer({
    port: PORT,
    skipLegionPackages: false  // Need Legion packages for Actor framework
  });

  await server.initialize();
  await server.start();
  console.log(`✅ Server running on http://localhost:${PORT}\n`);

  // Open browser
  console.log('Opening browser...');
  await open(`http://localhost:${PORT}/simple-demo.html`);
  console.log('✅ Browser opened\n');

  // Wait for client to connect
  console.log('⏳ Waiting for browser to connect (10 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Check for connected clients
  const actorManager = server.actorManagers.get(PORT);
  if (!actorManager || actorManager.connections.size === 0) {
    console.log('❌ No client connected. Check browser console for errors.');
    console.log('   Server will keep running...\n');
  } else {
    const connections = Array.from(actorManager.connections.values());
    const connection = connections[0];
    const actors = Array.from(connection.actorSpace.guidToObject.values());
    const serverActor = actors.find(a => a.constructor.name === 'ShowMeServerActor');

    if (serverActor) {
      console.log('✅ Client connected!\n');

      // Load a nice image from artifacts
      const imagePath = path.resolve(__dirname, '../../../../artifacts/dalle3-2025-09-08T12-11-12.png');
      console.log(`📸 Loading image from: ${imagePath}\n`);

      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      console.log(`📦 Image loaded (${(imageBuffer.length / 1024).toFixed(2)} KB)\n`);

      // Register client
      await serverActor.handleClientConnect({
        clientId: 'browser-client',
        timestamp: Date.now()
      });

      // Push image!
      console.log('📤 Pushing image to browser...');
      await serverActor.handleDisplayAsset({
        assetId: 'demo-image',
        assetType: 'image',
        title: '🎨 Beautiful AI-Generated Art',
        asset: {
          type: 'image/png',
          data: `data:image/png;base64,${base64Image}`,
          width: 1024,
          height: 1024
        }
      });

      console.log('✅ Image pushed!\n');
      console.log('🎉 Check the browser - the image should appear!\n');
    }
  }

  console.log('Server running. Press Ctrl+C to stop.\n');

  // Keep running
  await new Promise(() => {});
}

demo().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});