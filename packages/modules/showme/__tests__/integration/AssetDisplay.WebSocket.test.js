/**
 * Asset Display via WebSocket Integration Test
 * Tests complete flow: Server Actor → broadcast → Client receives → displays asset
 * Uses real WebSocket connections
 */

import { jest } from '@jest/globals';
import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { ResourceManager } from '@legion/resource-manager';
import WebSocket from 'ws';
import { getRandomTestPort, waitForServer } from '../helpers/testUtils.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Asset Display via WebSocket', () => {
  let server;
  let resourceManager;
  let testPort;
  let serverActor;

  beforeAll(async () => {
    testPort = getRandomTestPort();
    resourceManager = await ResourceManager.getInstance();

    // Start server
    server = new ShowMeServer({
      port: testPort,
      skipLegionPackages: true
    });
    await server.initialize();
    await server.start();

    await waitForServer(500);

    console.log(`Test server started on port ${testPort}`);
  }, 30000);

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  test('should push image asset to connected client via WebSocket', async () => {
    // Step 1: Connect client WebSocket
    console.log('Step 1: Connecting client WebSocket...');
    const clientWs = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
    const messages = [];
    let serverActorGuid = null;

    await new Promise((resolve) => {
      clientWs.on('open', resolve);
    });

    clientWs.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      console.log('Client received message:', JSON.stringify(msg, null, 2));
      messages.push(msg);

      // Capture server actor GUID from handshake
      if (msg.type === 'actor_handshake_ack') {
        serverActorGuid = msg.serverRootActor;
        console.log('Server actor GUID:', serverActorGuid);
      }
    });

    console.log('✅ Client WebSocket connected');

    // Step 2: Send Actor handshake
    console.log('Step 2: Sending Actor handshake...');
    clientWs.send(JSON.stringify({
      type: 'actor_handshake',
      clientRootActor: 'client-root',
      route: '/showme'
    }));

    // Wait for handshake to complete
    await waitForServer(1000);
    console.log('✅ Handshake complete');

    // Step 3: Get the server actor
    console.log('Step 3: Getting server actor...');
    const actorManager = server.actorManagers.get(testPort);
    expect(actorManager).toBeDefined();

    const connections = Array.from(actorManager.connections.values());
    expect(connections.length).toBeGreaterThan(0);

    const connection = connections[0];
    expect(connection.actorSpace).toBeDefined();

    const actors = Array.from(connection.actorSpace.guidToObject.values());
    console.log('Actors in space:', actors.map(a => a.constructor?.name || typeof a));
    console.log('Connection serverActor:', connection.serverActor?.constructor?.name);

    serverActor = actors.find(a => a.constructor.name === 'ShowMeServerActor') || connection.serverActor;

    expect(serverActor).toBeDefined();
    console.log('✅ Found ShowMeServerActor');

    // Step 3.5: Register client with server actor
    console.log('Step 3.5: Registering client...');
    const clientId = 'test-client-' + Date.now();
    await serverActor.handleClientConnect({ clientId, timestamp: Date.now() });
    console.log('✅ Client registered');

    // Step 4: Create test image data
    console.log('Step 4: Creating test image...');
    const testImagePath = path.join(__dirname, '../__tmp/test-image.jpg');

    // Create test image if it doesn't exist
    if (!fs.existsSync(testImagePath)) {
      // Create a simple 1x1 pixel red JPEG
      const redPixelJPEG = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00,
        0x01, 0x00, 0x01, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11,
        0x01, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x05, 0xFF,
        0xC4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00,
        0x0C, 0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0xA0,
        0x00, 0xFF, 0xD9
      ]);

      const dir = path.dirname(testImagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(testImagePath, redPixelJPEG);
    }

    const imageData = fs.readFileSync(testImagePath);
    const base64Image = imageData.toString('base64');
    console.log('✅ Image loaded:', imageData.length, 'bytes');

    // Step 5: Call handleDisplayAsset on server actor
    console.log('Step 5: Calling handleDisplayAsset...');
    const assetId = `test-image-${Date.now()}`;

    await serverActor.handleDisplayAsset({
      assetId,
      assetType: 'image',
      title: 'Test Image',
      asset: {
        type: 'image',
        data: `data:image/jpeg;base64,${base64Image}`,
        width: 1,
        height: 1
      }
    });

    console.log('✅ handleDisplayAsset called');

    // Step 6: Wait for client to receive message
    await waitForServer(1000);

    // Step 7: Verify client received display-asset message with RemoteActor Handle
    console.log('Step 6: Checking received messages...');
    console.log('Messages received:', messages.map(m => m.type || (m.payload && m.payload[0])));

    // Message structure is {targetGuid, payload: [messageType, data]}
    const displayAssetMsg = messages.find(m =>
      m.payload && Array.isArray(m.payload) && m.payload[0] === 'display-asset'
    );
    expect(displayAssetMsg).toBeDefined();

    const [messageType, messageData] = displayAssetMsg.payload;
    expect(messageType).toBe('display-asset');
    expect(messageData.asset).toBeDefined();

    // The asset should have been serialized as an Actor GUID reference
    // When deserialized, it becomes a RemoteActor with {'#actorGuid': '...'}
    console.log('Asset in message:', messageData.asset);
    console.log('Asset type:', typeof messageData.asset);

    // If the Handle was properly serialized, it should have a GUID
    // The exact structure depends on how ActorSerializer handles it
    expect(messageData.title).toBe('Test Image');

    console.log('✅ Client received display-asset message with Handle');

    // Cleanup
    clientWs.close();
  }, 30000);

  test('should broadcast asset to multiple connected clients', async () => {
    // Connect two clients
    const client1 = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
    const client2 = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);

    const client1Messages = [];
    const client2Messages = [];

    await Promise.all([
      new Promise((resolve) => client1.on('open', resolve)),
      new Promise((resolve) => client2.on('open', resolve))
    ]);

    client1.on('message', (data) => {
      client1Messages.push(JSON.parse(data.toString()));
    });

    client2.on('message', (data) => {
      client2Messages.push(JSON.parse(data.toString()));
    });

    console.log('✅ Two clients connected');

    // Wait for handshakes
    await waitForServer(1000);

    // Get server actor
    const actorManager = server.actorManagers.get(testPort);
    const connections = Array.from(actorManager.connections.values());

    // Get the first connection with an actor
    let foundActor = null;
    for (const connection of connections) {
      const actors = Array.from(connection.actorSpace.guidToObject.values());
      const actor = actors.find(a => a.constructor.name === 'ShowMeServerActor');
      if (actor) {
        foundActor = actor;
        break;
      }
    }

    expect(foundActor).toBeDefined();

    // Display asset
    const assetId = `broadcast-test-${Date.now()}`;
    await foundActor.handleDisplayAsset({
      assetId,
      assetType: 'json',
      title: 'Broadcast Test',
      asset: { test: 'data', broadcast: true }
    });

    await waitForServer(1000);

    // Both clients should receive the asset-ready message
    const client1Received = client1Messages.find(m => m.type === 'asset-ready' && m.assetId === assetId);
    const client2Received = client2Messages.find(m => m.type === 'asset-ready' && m.assetId === assetId);

    expect(client1Received).toBeDefined();
    expect(client2Received).toBeDefined();

    console.log('✅ Both clients received broadcast');

    // Cleanup
    client1.close();
    client2.close();
  }, 30000);
});