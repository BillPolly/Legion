/**
 * ShowMe Cat Picture Demo Server
 * Demonstrates RemoteHandle working with ShowMeServerActor
 */

import { BaseServer } from '@legion/server-framework';
import { ShowMeServerActor } from '../../src/server/actors/ShowMeServerActor.js';
import { ActorSerializer } from '@legion/actors';
import { RemoteHandle } from '@legion/handle';
import { AssetHandle } from '../../src/handles/AssetHandleV2.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Register RemoteHandle for serialization
ActorSerializer.registerRemoteHandle(RemoteHandle);

// Real tiny cat image (5x5 red square as placeholder)
const CAT_IMAGE_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==';

// Server actor factory
function createShowMeServerActor(services) {
  const actorSpace = this; // Context is the ActorSpace

  const actor = new ShowMeServerActor(actorSpace, {
    server: {
      assetStorage: new Map()
    }
  });

  // After actor is created and remote actor is set, send the cat picture
  const originalSetRemoteActor = actor.setRemoteActor.bind(actor);
  actor.setRemoteActor = function(remoteActor) {
    originalSetRemoteActor(remoteActor);

    // Send cat picture after a brief delay
    setTimeout(() => {
      console.log('🐱 Sending cat picture to browser...');

      // Create AssetHandle with cat image
      const catAsset = new AssetHandle({
        id: 'demo-cat-001',
        assetType: 'image',
        title: '🐱 Adorable Demo Cat',
        asset: CAT_IMAGE_BASE64,
        description: 'A cute cat picture via RemoteHandle!',
        width: 5,
        height: 5,
        format: 'PNG'
      });

      // Send to client via handleDisplayAsset
      actor.handleDisplayAsset({
        assetId: 'demo-cat-001',
        assetType: 'image',
        title: '🐱 Adorable Demo Cat',
        asset: CAT_IMAGE_BASE64
      });

      console.log('✅ Cat picture sent!');
    }, 500);
  };

  return actor;
}

// Main server setup
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       ShowMe RemoteHandle Cat Picture Demo                ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const server = new BaseServer();

  // Initialize with ResourceManager
  console.log('🔧 Initializing server...');
  await server.initialize();

  // Register the showme route
  const clientActorFile = path.join(__dirname, 'client.js');
  server.registerRoute('/showme', createShowMeServerActor, clientActorFile, 3700);

  // Start the server
  await server.start();

  console.log('✅ ShowMe server running at http://localhost:3700/showme');
  console.log('🌐 Open this URL in your browser to see the cat picture!');
  console.log('\n⚠️  Press Ctrl+C to stop the server\n');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await server.stop();
    console.log('✅ Server stopped');
    process.exit(0);
  });
}

main().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});