/**
 * GraphEditor Pan/Zoom Integration Test
 * Tests pan and zoom functionality with REAL actor framework + JSDOM
 *
 * Uses:
 * ✅ MockWebSocket (tests serialization)
 * ✅ ActorSpace.addChannel() (tests actor protocol)
 * ✅ REAL BrowserCLIClientActor
 * ✅ REAL CLISessionActor
 * ✅ JSDOM verification of pan/zoom
 */

import { describe, test, expect, beforeAll, afterEach, beforeEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { ResourceManager } from '@legion/resource-manager';
import { GraphDataSource } from '../../../shared/data/graph/src/GraphDataSource.js';
import { GraphHandle } from '../../../shared/data/graph/src/GraphHandle.js';
import { CLISessionActor } from '../../src/actors/CLISessionActor.js';
import { MockWebSocket } from '../helpers/MockWebSocket.js';
import { ActorSpace, ActorSerializer } from '@legion/actors';
import { RemoteHandle } from '@legion/handle/remote';

// Register RemoteHandle class globally for ActorSerializer
ActorSerializer.registerRemoteHandle(RemoteHandle);

describe('GraphEditor Pan/Zoom Integration', () => {
  let resourceManager;
  let dom;
  let serverSpace;
  let clientSpace;
  let serverActor;
  let clientActor;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  }, 10000);

  beforeEach(() => {
    // Create JSDOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head><title>Graph Pan/Zoom Test</title></head>
        <body>
          <div id="app">
            <div id="terminal"></div>
            <div id="asset-container"></div>
          </div>
        </body>
      </html>
    `, {
      url: 'http://localhost:5500/cli',
      runScripts: 'outside-only',
      resources: 'usable'
    });

    // Set up global DOM
    global.window = dom.window;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;
    global.SVGElement = dom.window.SVGElement;
    global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
    global.cancelAnimationFrame = (id) => clearTimeout(id);

    // Mock document.elementFromPoint for JSDOM (used by hit testing)
    global.document.elementFromPoint = (x, y) => {
      // Return null for background hits
      return null;
    };

    // Set window dimensions for positioning
    global.window.innerWidth = 1920;
    global.window.innerHeight = 1080;
  });

  afterEach(async () => {
    if (serverActor) {
      await serverActor.cleanup?.();
    }
  });

  test('should render graph with pan and zoom via actor framework', async () => {
    console.log('[TEST] Setting up actors with MockWebSocket');

    // Create MockWebSocket pair
    const { serverWs, clientWs } = MockWebSocket.createPair();

    // Create ActorSpaces
    serverSpace = new ActorSpace('test-server');
    clientSpace = new ActorSpace('test-client');

    // Create server actor (CLISessionActor)
    serverActor = new CLISessionActor({
      resourceManager,
      sessionId: 'test-session-panzoom',
      useColors: false
    });

    // Import REAL BrowserCLIClientActor
    const { default: BrowserCLIClientActor } = await import('../../apps/cli-ui/src/client/BrowserCLIClientActor.js');

    // Create client actor (BrowserCLIClientActor)
    clientActor = new BrowserCLIClientActor();

    // Register actors in their spaces
    serverSpace.register(serverActor, 'server-session');
    clientSpace.register(clientActor, 'client-root');

    console.log('[TEST] Creating channels (wires WebSocket to actor protocol)');

    // Create channels - THIS IS CRITICAL!
    const serverChannel = serverSpace.addChannel(serverWs, serverActor);
    const clientChannel = clientSpace.addChannel(clientWs, clientActor);

    // Trigger connection
    serverWs.simulateOpen();
    clientWs.simulateOpen();

    // Wait for actor protocol handshake
    await new Promise(resolve => setTimeout(resolve, 100));

    // Set up remote actor references
    const remoteClientActor = serverChannel.makeRemote('client-root');
    await serverActor.setRemoteActor(remoteClientActor);

    console.log('[TEST] Actors connected and remote references set');

    // Create test graph
    const testGraphData = {
      nodes: [
        { id: 'node1', label: 'Test Node 1', type: 'Entity', position: { x: 100, y: 100 } },
        { id: 'node2', label: 'Test Node 2', type: 'Entity', position: { x: 300, y: 100 } },
        { id: 'node3', label: 'Test Node 3', type: 'Concept', position: { x: 200, y: 300 } }
      ],
      edges: [
        { id: 'edge1', source: 'node1', target: 'node2', type: 'relatesTo', label: 'connects' },
        { id: 'edge2', source: 'node1', target: 'node3', type: 'hasProperty', label: 'owns' }
      ]
    };

    const graphDataSource = new GraphDataSource(testGraphData);
    const testGraphHandle = new GraphHandle(graphDataSource);

    // Mock ResourceManager
    const originalCreate = resourceManager.createHandleFromURI;
    resourceManager.createHandleFromURI = async (uri) => testGraphHandle;

    try {
      console.log('[TEST] Executing /show command via actor protocol');

      // CLIENT creates remote reference to SERVER actor
      const remoteServerActor = clientChannel.makeRemote('server-session');

      // Execute command via actor protocol over WebSocket
      remoteServerActor.receive('execute-command', {
        command: '/show legion://test/graph'
      }).catch(err => {
        console.log('[TEST] Execute-command response error (expected):', err.message);
      });

      // Wait for async rendering
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('[TEST] Verifying graph rendered in JSDOM');

      // Verify SVG graph exists
      const svg = document.querySelector('svg');
      console.log('[TEST] SVG found:', !!svg);
      expect(svg).toBeTruthy();

      // Verify nodes rendered
      const nodeElements = svg.querySelectorAll('g[data-node-id]');
      console.log('[TEST] Found', nodeElements.length, 'node elements');
      expect(nodeElements.length).toBe(3);

      // Get the main group that has the transform
      const mainGroup = svg.querySelector('g');
      expect(mainGroup).toBeTruthy();

      // Get initial transform
      const initialTransform = mainGroup.getAttribute('transform');
      console.log('[TEST] Initial transform:', initialTransform);

      console.log('[TEST] ===== Testing WHEEL ZOOM =====');

      // Test zoom: Simulate wheel event on SVG
      const wheelEvent = new dom.window.WheelEvent('wheel', {
        bubbles: true,
        deltaY: -100, // Zoom in
        clientX: 400,
        clientY: 300
      });

      svg.dispatchEvent(wheelEvent);

      // Wait for zoom to process
      await new Promise(resolve => setTimeout(resolve, 100));

      const afterZoomTransform = mainGroup.getAttribute('transform');
      console.log('[TEST] After zoom transform:', afterZoomTransform);

      // Verify transform changed (zoom happened)
      expect(afterZoomTransform).not.toBe(initialTransform);

      console.log('[TEST] ✅ Zoom functionality working!');

      console.log('[TEST] ===== Testing BACKGROUND DRAG PAN =====');

      // Test pan: Simulate drag on empty background
      // CRITICAL: GraphEditorView listens to events on the .graph-editor container,
      // NOT on svg.parentElement! In real browser, structure is:
      // .graph-editor → .graph-editor-renderer → svg
      const container = document.querySelector('.graph-editor');
      if (!container) {
        throw new Error('Could not find .graph-editor container! DOM structure may not match real browser.');
      }

      // Get SVG dimensions
      const svgRect = { left: 0, top: 0, width: 800, height: 600 };

      // Mock getBoundingClientRect for JSDOM
      container.getBoundingClientRect = () => svgRect;

      // Find empty space (away from nodes)
      const emptyX = 600;
      const emptyY = 500;

      // Mousedown on empty background
      const mouseDown = new dom.window.MouseEvent('mousedown', {
        bubbles: true,
        clientX: emptyX,
        clientY: emptyY,
        button: 0
      });
      container.dispatchEvent(mouseDown);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Mousemove to drag (dispatch on container)
      const mouseMove = new dom.window.MouseEvent('mousemove', {
        bubbles: true,
        clientX: emptyX + 100,
        clientY: emptyY + 50,
        button: 0,
        buttons: 1
      });
      container.dispatchEvent(mouseMove);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Mouseup to end drag (dispatch on container)
      const mouseUp = new dom.window.MouseEvent('mouseup', {
        bubbles: true,
        clientX: emptyX + 100,
        clientY: emptyY + 50,
        button: 0
      });
      container.dispatchEvent(mouseUp);

      await new Promise(resolve => setTimeout(resolve, 50));

      const afterPanTransform = mainGroup.getAttribute('transform');
      console.log('[TEST] After pan transform:', afterPanTransform);

      // Verify transform changed (pan happened)
      expect(afterPanTransform).not.toBe(afterZoomTransform);

      console.log('[TEST] ✅ Pan functionality working!');
      console.log('[TEST] ✅ Graph rendered with pan and zoom via actor framework!');

    } finally {
      resourceManager.createHandleFromURI = originalCreate;
    }
  }, 20000);
});
