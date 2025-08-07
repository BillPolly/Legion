/**
 * Integration test for the artifact debugging system
 * Tests the full flow from backend to frontend including:
 * - ConfigurableActorSpace wiring
 * - Artifact event propagation
 * - Frontend UI updates
 */

import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { WebSocket as MockWebSocket, Server as MockWebSocketServer } from 'mock-socket';
import { ConfigurableActorSpace } from '../../../shared/actors/src/ConfigurableActorSpace.js';
import { ChatAgent } from '../../src/agents/ChatAgent.js';
import { TerminalAgent } from '../../src/agents/TerminalAgent.js';

// Set up JSDOM
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.WebSocket = MockWebSocket;
global.navigator = dom.window.navigator;

// Mock modules that use browser APIs
jest.mock('/Legion/components/window/index.js', () => ({
  Window: {
    create: jest.fn((options) => {
      const mockWindow = {
        contentElement: document.createElement('div'),
        show: jest.fn(),
        hide: jest.fn(),
        destroy: jest.fn(),
        options
      };
      return mockWindow;
    })
  }
}));

describe('Artifact Debug System Integration', () => {
  let mockServer;
  let serverUrl;
  let serverActorSpace;
  let frontendActorSpace;
  let chatAgent;
  let artifactDebugActor;
  let artifactDebugView;

  // Test actor configuration
  const testActorConfig = {
    actorPairs: [
      { name: 'chat', frontend: 'ChatActor', backend: 'ChatAgent' },
      { name: 'terminal', frontend: 'TerminalActor', backend: 'TerminalAgent' },
      { name: 'artifactDebug', frontend: 'ArtifactDebugActor', backend: 'ChatAgent' }
    ]
  };

  beforeEach(() => {
    // Create mock WebSocket server
    serverUrl = 'ws://localhost:8080';
    mockServer = new MockWebSocketServer(serverUrl);
    
    // Clear any existing DOM
    document.body.innerHTML = '<div id="app"></div>';
  });

  afterEach(() => {
    mockServer.stop();
    jest.clearAllMocks();
  });

  test('ConfigurableActorSpace properly wires actors', async () => {
    // Create server actor space
    class TestServerActorSpace extends ConfigurableActorSpace {
      async createActor(className, name) {
        switch (className) {
          case 'ChatAgent':
            if (name === 'artifactDebug' && this.getActor('chat')) {
              return this.getActor('chat'); // Reuse same instance
            }
            return new ChatAgent({ sessionId: this.spaceId });
          case 'TerminalAgent':
            return new TerminalAgent({});
          default:
            throw new Error(`Unknown actor: ${className}`);
        }
      }
    }

    serverActorSpace = new TestServerActorSpace('server-test', testActorConfig, {});
    await serverActorSpace.setupActors('backend');

    // Verify actors were created
    expect(serverActorSpace.getActor('chat')).toBeDefined();
    expect(serverActorSpace.getActor('terminal')).toBeDefined();
    expect(serverActorSpace.getActor('artifactDebug')).toBe(serverActorSpace.getActor('chat'));
    
    // Verify handshake data
    const handshakeData = serverActorSpace.getHandshakeData();
    expect(handshakeData).toEqual({
      chat: 'server-test-chat',
      terminal: 'server-test-terminal',
      artifactDebug: 'server-test-artifactDebug'
    });
  });

  test('Frontend and backend actor spaces connect and wire properly', async () => {
    let serverConnection;
    
    // Set up server handler
    mockServer.on('connection', async (ws) => {
      serverConnection = ws;
      
      // Create server actor space
      class TestServerActorSpace extends ConfigurableActorSpace {
        async createActor(className, name) {
          if (className === 'ChatAgent') {
            return new ChatAgent({ sessionId: this.spaceId });
          }
          return { receive: jest.fn() }; // Mock other actors
        }
      }
      
      serverActorSpace = new TestServerActorSpace('server-test', testActorConfig, {});
      await serverActorSpace.setupActors('backend');
      
      // Send handshake
      ws.send(JSON.stringify({
        type: 'actor_handshake',
        serverActors: serverActorSpace.getHandshakeData()
      }));
      
      // Listen for handshake ack
      ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.type === 'actor_handshake_ack') {
          // Create channel and wire actors
          const channel = {
            makeRemote: (guid) => ({
              guid,
              receive: jest.fn()
            })
          };
          serverActorSpace.addChannel = () => channel;
          serverActorSpace.wireActors(channel, msg.clientActors);
        }
      });
    });

    // Create frontend actor space
    const { FrontendActorSpace } = await import('../../../apps/aiur-ui/src/actors/FrontendActorSpace.js');
    const { ChatActor } = await import('../../../apps/aiur-ui/src/actors/ChatActor.js');
    const { ArtifactDebugActor } = await import('../../../apps/aiur-ui/src/actors/ArtifactDebugActor.js');
    
    // Mock actor imports
    jest.mock('../../../apps/aiur-ui/src/actors/ChatActor.js', () => ({
      ChatActor: jest.fn(() => ({
        setRemoteAgent: jest.fn(),
        receive: jest.fn()
      }))
    }));
    
    jest.mock('../../../apps/aiur-ui/src/actors/TerminalActor.js', () => ({
      TerminalActor: jest.fn(() => ({
        setRemoteAgent: jest.fn(),
        receive: jest.fn()
      }))
    }));

    frontendActorSpace = new FrontendActorSpace('frontend-test', testActorConfig);
    
    // Override createActor for testing
    frontendActorSpace.createActor = async (className, name) => {
      switch (className) {
        case 'ChatActor':
          return new ChatActor();
        case 'ArtifactDebugActor':
          return new ArtifactDebugActor();
        default:
          return { setRemoteAgent: jest.fn(), receive: jest.fn() };
      }
    };

    await frontendActorSpace.connect(serverUrl);

    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify actors are wired
    expect(frontendActorSpace.getActor('chat')).toBeDefined();
    expect(frontendActorSpace.getActor('artifactDebug')).toBeDefined();
  });

  test('Artifact events propagate from ChatAgent to ArtifactDebugActor', async () => {
    // Import required classes
    const { ArtifactDebugActor } = await import('../../../apps/aiur-ui/src/actors/ArtifactDebugActor.js');
    
    // Create mock ChatAgent
    chatAgent = new ChatAgent({ sessionId: 'test' });
    
    // Create ArtifactDebugActor
    artifactDebugActor = new ArtifactDebugActor();
    
    // Set up mock remote actors
    const mockRemoteActors = new Map();
    mockRemoteActors.set('artifactDebug', {
      receive: (payload) => {
        // Simulate sending to frontend
        artifactDebugActor.receive(payload);
      }
    });
    
    chatAgent.remoteActors = mockRemoteActors;
    
    // Set up artifact created handler
    const artifactCreatedHandler = jest.fn();
    artifactDebugActor.onArtifactCreated = artifactCreatedHandler;
    
    // Simulate artifact creation
    const testArtifacts = [
      {
        id: 'artifact-123',
        label: '@test-image',
        type: 'image',
        title: 'Test Image',
        description: 'A test image artifact',
        createdAt: new Date().toISOString()
      }
    ];
    
    // Send artifact event
    chatAgent.sendArtifactEventToDebugActor('artifact_created', {
      artifacts: testArtifacts,
      toolName: 'generate_image'
    });
    
    // Verify event was received
    expect(artifactCreatedHandler).toHaveBeenCalledWith(testArtifacts);
    
    // Verify artifact is stored in debug actor
    expect(artifactDebugActor.getArtifact('artifact-123')).toEqual(testArtifacts[0]);
    expect(artifactDebugActor.getArtifactByLabel('@test-image')).toEqual(testArtifacts[0]);
  });

  test('ArtifactDebugView updates when artifacts are created', async () => {
    // Import ArtifactDebugView
    const { ArtifactDebugView } = await import('../../../apps/aiur-ui/src/components/debug/ArtifactDebugView.js');
    
    // Create container
    const container = document.getElementById('app');
    
    // Create debug view
    artifactDebugView = new ArtifactDebugView(container, null);
    artifactDebugView.show();
    
    // Verify window was created
    const { Window } = await import('/Legion/components/window/index.js');
    expect(Window.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '🔍 Artifact Debug',
        width: 400,
        height: 600
      })
    );
    
    // Add test artifacts
    const testArtifacts = [
      {
        id: 'artifact-1',
        label: '@sci-fi-cat',
        type: 'image',
        title: 'Sci-Fi Cat',
        description: 'A cat with a laser gun',
        createdAt: new Date().toISOString(),
        size: 1024000,
        createdBy: 'generate_image'
      },
      {
        id: 'artifact-2',
        label: '@analysis-1',
        type: 'text',
        subtype: 'analysis',
        title: 'Image Analysis',
        description: 'Analysis of the sci-fi cat image',
        content: 'The image shows a futuristic cat...',
        createdAt: new Date().toISOString(),
        createdBy: 'analyze_file'
      }
    ];
    
    artifactDebugView.addArtifacts(testArtifacts);
    
    // Verify artifacts are stored
    expect(artifactDebugView.artifacts.size).toBe(2);
    expect(artifactDebugView.artifacts.get('artifact-1')).toEqual(testArtifacts[0]);
    expect(artifactDebugView.artifacts.get('artifact-2')).toEqual(testArtifacts[1]);
    
    // Update artifact list
    artifactDebugView.updateArtifactList();
    
    // Verify list items were created
    const listItems = artifactDebugView.artifactListElement.children;
    expect(listItems.length).toBe(2);
    
    // Test filtering
    artifactDebugView.filterText = 'cat';
    artifactDebugView.updateArtifactList();
    expect(artifactDebugView.artifactListElement.children.length).toBe(1);
    
    // Test sorting by label
    artifactDebugView.filterText = '';
    artifactDebugView.sortBy = 'label';
    artifactDebugView.updateArtifactList();
    const sortedItems = artifactDebugView.artifactListElement.children;
    expect(sortedItems.length).toBe(2);
  });

  test('Full end-to-end artifact flow', async () => {
    // This test simulates the complete flow from tool execution to UI update
    
    // 1. Create backend components
    const resourceManager = {
      get: jest.fn(),
      createLLMClient: jest.fn()
    };
    
    const artifactManager = {
      registerArtifact: jest.fn((artifact) => ({
        ...artifact,
        id: artifact.id || `artifact-${Date.now()}`
      })),
      getArtifactContext: jest.fn(() => 'Available artifacts:\n@test-image: "Test Image"')
    };
    
    // 2. Create ChatAgent with dependencies
    chatAgent = new ChatAgent({
      sessionId: 'test',
      resourceManager,
      artifactManager
    });
    
    // 3. Create ArtifactDebugActor
    const { ArtifactDebugActor } = await import('../../../apps/aiur-ui/src/actors/ArtifactDebugActor.js');
    artifactDebugActor = new ArtifactDebugActor();
    
    // 4. Wire actors
    const mockRemoteActors = new Map();
    mockRemoteActors.set('artifactDebug', {
      receive: (payload) => artifactDebugActor.receive(payload)
    });
    chatAgent.remoteActors = mockRemoteActors;
    
    // 5. Create ArtifactDebugView
    const { ArtifactDebugView } = await import('../../../apps/aiur-ui/src/components/debug/ArtifactDebugView.js');
    artifactDebugView = new ArtifactDebugView(document.getElementById('app'), null);
    artifactDebugView.show();
    
    // 6. Connect actor to view
    artifactDebugActor.onArtifactCreated = (artifacts) => {
      artifactDebugView.addArtifacts(artifacts);
    };
    
    // 7. Simulate tool execution creating artifact
    const toolResult = {
      success: true,
      filename: 'test-image.png',
      filePath: '/tmp/test-image.png',
      imageData: 'base64-data-here'
    };
    
    // 8. Process through ArtifactActor (mocked)
    const artifactResult = {
      success: true,
      artifactsStored: 1,
      artifacts: [{
        id: 'artifact-final',
        label: '@test-image',
        type: 'image',
        subtype: 'png',
        title: 'Test Generated Image',
        description: 'An image for testing the artifact system',
        path: '/tmp/test-image.png',
        createdAt: new Date().toISOString(),
        createdBy: 'generate_image'
      }]
    };
    
    // 9. Send artifact event
    chatAgent.sendArtifactEventToDebugActor('artifact_created', {
      artifacts: artifactResult.artifacts,
      toolName: 'generate_image'
    });
    
    // 10. Verify the complete chain
    // - ChatAgent sent event
    expect(mockRemoteActors.get('artifactDebug').receive).toHaveBeenCalled();
    
    // - ArtifactDebugActor received and stored artifact
    expect(artifactDebugActor.getArtifact('artifact-final')).toBeDefined();
    expect(artifactDebugActor.getArtifactByLabel('@test-image')).toBeDefined();
    
    // - ArtifactDebugView has the artifact
    expect(artifactDebugView.artifacts.size).toBe(1);
    expect(artifactDebugView.artifacts.get('artifact-final')).toBeDefined();
    
    // - UI was updated
    const listItems = artifactDebugView.artifactListElement.children;
    expect(listItems.length).toBe(1);
  });

  test('Actor configuration changes are reflected in wiring', async () => {
    // Test that changes to actor-config.json are properly handled
    
    const modifiedConfig = {
      actorPairs: [
        { name: 'chat', frontend: 'ChatActor', backend: 'ChatAgent' },
        { name: 'artifactDebug', frontend: 'ArtifactDebugActor', backend: 'ChatAgent' },
        // New actor pair
        { name: 'metrics', frontend: 'MetricsActor', backend: 'MetricsAgent' }
      ]
    };
    
    // Create actor space with modified config
    class TestActorSpace extends ConfigurableActorSpace {
      async createActor(className, name) {
        return {
          name: className,
          setRemoteAgent: jest.fn(),
          receive: jest.fn()
        };
      }
    }
    
    const actorSpace = new TestActorSpace('test', modifiedConfig);
    await actorSpace.setupActors('frontend');
    
    // Verify all actors were created
    expect(actorSpace.getActor('chat')).toBeDefined();
    expect(actorSpace.getActor('artifactDebug')).toBeDefined();
    expect(actorSpace.getActor('metrics')).toBeDefined();
    
    // Verify handshake includes all actors
    const handshake = actorSpace.getHandshakeData();
    expect(Object.keys(handshake)).toEqual(['chat', 'artifactDebug', 'metrics']);
  });
});