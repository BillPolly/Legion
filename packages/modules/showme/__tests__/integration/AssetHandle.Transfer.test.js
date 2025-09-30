/**
 * Integration test for AssetHandle transfer from server to client
 * Tests that Handles serialize/deserialize correctly through actor messages
 */

import { ActorSpace, ActorSerializer } from '@legion/actors';
import { RemoteHandle } from '@legion/handle';
import { ShowMeServerActor } from '../../src/server/actors/ShowMeServerActor.js';
import { ShowMeClientActor } from '../../src/client/actors/ShowMeClientActor.js';
import { MockWebSocket } from '../helpers/MockWebSocket.js';

// Register RemoteHandle for Actor serialization
ActorSerializer.registerRemoteHandle(RemoteHandle);

describe('AssetHandle Transfer Integration Test', () => {
  let serverActorSpace;
  let clientActorSpace;
  let serverActor;
  let clientActor;
  let serverWs;
  let clientWs;
  let serverChannel;
  let clientChannel;

  beforeEach(async () => {
    // Create mock WebSocket pair
    const mockPair = MockWebSocket.createPair();
    serverWs = mockPair.serverWs;
    clientWs = mockPair.clientWs;

    // Create ActorSpaces
    serverActorSpace = new ActorSpace('server-test');
    clientActorSpace = new ActorSpace('client-test');

    // Create actors
    serverActor = new ShowMeServerActor(serverActorSpace, {});
    clientActor = new ShowMeClientActor();

    // Register actors
    serverActorSpace.register(serverActor, 'server-root');
    clientActorSpace.register(clientActor, 'client-root');

    // Create channels
    serverChannel = serverActorSpace.addChannel(serverWs);
    clientChannel = clientActorSpace.addChannel(clientWs);

    // Set up remote references
    const remoteClient = serverChannel.makeRemote('client-root');
    const remoteServer = clientChannel.makeRemote('server-root');

    await serverActor.setRemoteActor(remoteClient);
    clientActor.setRemoteActor(remoteServer);

    // Initialize client actor
    await clientActor.initialize();
  });

  test('should transfer AssetHandle from server to client', async () => {
    console.log('\n=== TEST: AssetHandle Transfer ===');

    // Track messages received by client
    const clientMessages = [];
    const originalReceive = clientActor.receive.bind(clientActor);
    clientActor.receive = function(messageType, data) {
      console.log(`[TEST] Client received: ${messageType}`);
      clientMessages.push({ messageType, data });
      return originalReceive(messageType, data);
    };

    // Server creates and sends Handle
    console.log('[TEST] Server creating Handle...');
    const { AssetHandle } = await import('../../src/handles/AssetHandleV2.js');
    const assetHandle = new AssetHandle({
      id: 'test-image-123',
      assetType: 'image',
      path: '/Users/maxximus/Documents/max-projects/pocs/Legion/packages/modules/showme/artifacts/dall-e-3-cat-scifi.png',
      title: 'Test Image',
      timestamp: Date.now()
    });

    console.log('[TEST] AssetHandle created:', assetHandle.constructor.name);
    console.log('[TEST] AssetHandle has getData:', typeof assetHandle.getData);

    // Server sends Handle to client
    console.log('[TEST] Server sending display-asset message...');
    serverActor.remoteActor.receive('display-asset', {
      asset: assetHandle,
      title: 'Test Image'
    });

    // Wait for message to be processed
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify client received display-asset message
    console.log('[TEST] Client messages received:', clientMessages.length);
    const displayAssetMsg = clientMessages.find(m => m.messageType === 'display-asset');
    expect(displayAssetMsg).toBeDefined();
    console.log('[TEST] display-asset message found');

    // Verify the asset is a Handle
    const receivedAsset = displayAssetMsg.data.asset;
    console.log('[TEST] Received asset type:', receivedAsset?.constructor.name);
    console.log('[TEST] Received asset isRemote:', receivedAsset?.isRemote);

    // The asset should be a RemoteHandle (if sent through actor channel)
    // OR an AssetHandle (if local)
    expect(receivedAsset).toBeDefined();

    // Try to call methods on it
    console.log('[TEST] Calling getMetadata on received asset...');
    const metadata = await receivedAsset.getMetadata();
    console.log('[TEST] Metadata received:', metadata);
    expect(metadata).toBeDefined();
    expect(metadata.id).toBe('test-image-123');
    expect(metadata.type).toBe('image'); // AssetDataSource returns 'type' not 'assetType'

    console.log('[TEST] ✓ Handle transfer successful!');
  }, 10000);

  test('should call getData on transferred Handle', async () => {
    console.log('\n=== TEST: Handle getData() ===');

    // Track what client does with the Handle
    let receivedHandle = null;
    const originalHandleDisplayAsset = clientActor.handleDisplayAsset.bind(clientActor);
    clientActor.handleDisplayAsset = async function(data) {
      console.log('[TEST] handleDisplayAsset called');
      receivedHandle = data.asset;
      // Don't call original - we just want to capture the Handle
    };

    // Server creates and sends Handle
    const { AssetHandle } = await import('../../src/handles/AssetHandleV2.js');
    const assetHandle = new AssetHandle({
      id: 'test-image-456',
      assetType: 'image',
      path: '/Users/maxximus/Documents/max-projects/pocs/Legion/packages/modules/showme/artifacts/dall-e-3-cat-scifi.png',
      title: 'Test Image 2',
      timestamp: Date.now()
    });

    serverActor.remoteActor.receive('display-asset', {
      asset: assetHandle,
      title: 'Test Image 2'
    });

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(receivedHandle).toBeDefined();
    console.log('[TEST] Handle captured');

    // Call getData
    console.log('[TEST] Calling getData...');
    const data = await receivedHandle.getData();
    console.log('[TEST] Data received, type:', typeof data);
    console.log('[TEST] Data structure:', data);
    expect(data).toBeDefined();
    expect(data).toEqual({
      id: 'test-image-456',
      assetType: 'image',
      path: '/Users/maxximus/Documents/max-projects/pocs/Legion/packages/modules/showme/artifacts/dall-e-3-cat-scifi.png',
      title: 'Test Image 2',
      timestamp: expect.any(Number)
    });

    console.log('[TEST] ✓ getData successful!');
  }, 10000);
});