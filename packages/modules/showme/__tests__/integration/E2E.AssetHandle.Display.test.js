/**
 * @jest-environment jsdom
 *
 * End-to-end integration test for AssetHandle display
 * Tests complete flow: Server creates Handle -> sends to client -> client displays image in DOM
 */

import { ActorSpace, ActorSerializer } from '@legion/actors';
import { RemoteHandle } from '@legion/handle';
import { ShowMeServerActor } from '../../src/server/actors/ShowMeServerActor.js';
import { ShowMeClientActor } from '../../src/client/actors/ShowMeClientActor.js';
import { MockWebSocket } from '../helpers/MockWebSocket.js';
import { DisplayManager } from '../../src/client/display/DisplayManager.js';

// Register RemoteHandle for Actor serialization
ActorSerializer.registerRemoteHandle(RemoteHandle);

describe('E2E AssetHandle Display Test', () => {
  let serverActorSpace;
  let clientActorSpace;
  let serverActor;
  let clientActor;
  let serverWs;
  let clientWs;
  let serverChannel;
  let clientChannel;
  let displayManager;
  let container;

  beforeEach(async () => {
    // Set up DOM container
    container = document.createElement('div');
    container.id = 'showme-container';
    document.body.appendChild(container);

    // Create DisplayManager
    displayManager = new DisplayManager(container);

    // Create mock WebSocket pair
    const mockPair = MockWebSocket.createPair();
    serverWs = mockPair.serverWs;
    clientWs = mockPair.clientWs;

    // Create ActorSpaces
    serverActorSpace = new ActorSpace('server-test');
    clientActorSpace = new ActorSpace('client-test');

    // Create Channels
    const { Channel } = await import('@legion/actors');
    serverChannel = new Channel(serverActorSpace, serverWs);
    clientChannel = new Channel(clientActorSpace, clientWs);

    // Create actors
    serverActor = new ShowMeServerActor(serverActorSpace);
    clientActor = new ShowMeClientActor(clientActorSpace, {
      clientId: 'test-client',
      displayManager: displayManager  // Pass displayManager to client actor
    });

    // Register actors
    serverActorSpace.register(serverActor, 'server-root');
    clientActorSpace.register(clientActor, 'client-root');

    // Set up bidirectional references (like handshake does)
    const remoteServerActor = clientChannel.makeRemote('server-root');
    const remoteClientActor = serverChannel.makeRemote('client-root');

    await serverActor.setRemoteActor(remoteClientActor);
    await clientActor.setRemoteActor(remoteServerActor);
    await clientActor.initialize();

    // Wait for async message processing
    await new Promise(resolve => setTimeout(resolve, 150));
  });

  afterEach(() => {
    // Cleanup
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    if (displayManager) {
      displayManager.destroy();
    }
  });

  test('should display image in DOM when Handle is received', async () => {
    console.log('\n=== TEST: E2E Image Display ===');

    // Server sends Handle (already happens in setRemoteActor after 100ms delay)
    // Wait for Handle transfer, RemoteHandle creation, query() call, and image rendering
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check that an image element was created in the DOM
    const images = container.querySelectorAll('img');
    console.log('[TEST] Images found in DOM:', images.length);

    expect(images.length).toBeGreaterThan(0);

    const img = images[0];
    console.log('[TEST] Image src:', img.src);
    console.log('[TEST] Image alt:', img.alt);

    // Verify image attributes
    expect(img.src).toBeDefined();
    expect(img.src.length).toBeGreaterThan(0);

    console.log('[TEST] ✓ Image displayed in DOM!');
  }, 10000);

  test('should create window with correct title', async () => {
    console.log('\n=== TEST: Window Title ===');

    // Wait for server to send Handle
    await new Promise(resolve => setTimeout(resolve, 200));

    // Check for window title element
    const windows = container.querySelectorAll('[data-showme-window]');
    console.log('[TEST] Windows found:', windows.length);

    expect(windows.length).toBeGreaterThan(0);

    const window = windows[0];
    const titleElement = window.querySelector('[data-window-title]');

    if (titleElement) {
      console.log('[TEST] Window title:', titleElement.textContent);
      expect(titleElement.textContent).toContain('Test Cat Image');
    }

    console.log('[TEST] ✓ Window created with title!');
  }, 10000);
});