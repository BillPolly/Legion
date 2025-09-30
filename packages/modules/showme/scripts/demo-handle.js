/**
 * Demo script showing how ShowMe displays images through Handle/RemoteHandle pattern
 *
 * Architecture:
 * 1. Server creates AssetHandle for the image
 * 2. Server sends AssetHandle through actor channel to client
 * 3. Client receives RemoteHandle (proxy to server's AssetHandle)
 * 4. Client calls RemoteHandle methods (getData, getType, etc)
 * 5. RemoteHandle proxies calls to server's AssetHandle
 * 6. Display manager renders the image
 */

import { ShowMeServer } from '../src/server/ShowMeServer.js';
import { AssetHandle } from '../src/handles/AssetHandleV2.js';
import { ActorSerializer, RemoteHandle } from '@legion/handle';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function demo() {
  console.log('🎨 ShowMe Handle Demo');
  console.log('====================\n');

  try {
    // Register RemoteHandle for actor serialization
    ActorSerializer.registerRemoteHandle(RemoteHandle);

    // Start ShowMe server
    console.log('Starting ShowMe server...');
    const server = new ShowMeServer({
      port: 3700,
      skipLegionPackages: true
    });

    await server.initialize();
    await server.start();
    console.log('✅ ShowMe server started on port 3700\n');

    // Path to an image in the artifacts folder
    const imagePath = path.resolve(__dirname, '../../../artifacts/dalle3-2025-08-05T08-39-42.png');
    console.log(`📁 Image path: ${imagePath}`);

    // Read image as base64
    const imageBuffer = await fs.readFile(imagePath);
    const imageBase64 = `data:image/png;base64,${imageBuffer.toString('base64')}`;
    console.log(`📦 Image size: ${imageBuffer.length} bytes\n`);

    // Create AssetHandle for the image (server-side Handle)
    const assetData = {
      id: `asset-${Date.now()}`,
      assetType: 'image',
      title: 'Demo Image from Artifacts',
      asset: imageBase64,
      timestamp: Date.now()
    };

    const assetHandle = new AssetHandle(assetData);
    console.log('✅ AssetHandle created');
    console.log(`   Asset ID: ${assetHandle.assetId}`);
    console.log(`   Asset Type: ${assetHandle.assetType}`);
    console.log(`   Title: ${assetHandle.title}\n`);

    // Store the handle in server's asset storage
    server.assetStorage.set(assetData.id, assetHandle);
    console.log('✅ AssetHandle stored in server\n');

    // When this Handle is sent through actor channel to client,
    // it will be automatically serialized and the client will receive a RemoteHandle
    console.log('📡 Actor Communication Flow:');
    console.log('   1. Server has AssetHandle (real Handle with DataSource)');
    console.log('   2. Server sends Handle through WebSocket/Actor channel');
    console.log('   3. ActorSerializer serializes Handle with metadata + GUID');
    console.log('   4. Client deserializes and creates RemoteHandle');
    console.log('   5. Client RemoteHandle proxies all calls back to server');
    console.log('   6. Display manager calls RemoteHandle.getData()');
    console.log('   7. Image data flows from server → client → display\n');

    // URL for browser to connect
    const url = `http://localhost:3700`;
    console.log(`🌐 Opening browser at: ${url}`);
    console.log('   Browser will connect via WebSocket');
    console.log('   Server will send AssetHandle');
    console.log('   Browser receives RemoteHandle');
    console.log('   Image will be displayed!\n');

    // Launch browser
    await open(url, {
      app: {
        name: 'google chrome',
        arguments: ['--new-window']
      }
    });

    // Keep server running
    console.log('⏳ Server running... (Press Ctrl+C to exit)');
    await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minutes

  } catch (error) {
    console.error('\n❌ Demo failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

demo();