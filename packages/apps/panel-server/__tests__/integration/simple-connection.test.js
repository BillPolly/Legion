/**
 * Simple integration test - just connect and receive connection-ready
 */

import { PanelServer } from '../../src/panel-server.js';
import { ActorSpace } from '@legion/actors';
import WebSocket from 'ws';

describe('Simple Connection Integration', () => {
  const TEST_PORT = 7891;
  const TEST_HOST = 'localhost';
  let server;
  let actorSpace;

  beforeEach(async () => {
    server = new PanelServer(TEST_PORT, TEST_HOST);
    await server.start();
  });

  afterEach(async () => {
    if (actorSpace) {
      await actorSpace.destroy();
      actorSpace = null;
    }
    if (server) {
      await server.stop();
      server = null;
    }
  });

  test('should receive connection-ready when process connects', async () => {
    const receivedMessages = [];

    // Create ActorSpace for test
    actorSpace = new ActorSpace('test-process');

    // Create actor that collects messages
    const testActor = {
      isActor: true,
      id: 'process-client',
      receive: async (messageType, data) => {
        receivedMessages.push({ messageType, data });
      },
    };

    // Register the actor
    actorSpace.register(testActor, 'process-client');

    // Create WebSocket
    const ws = new WebSocket(`ws://${TEST_HOST}:${TEST_PORT}/ws/process`);

    // Add error handler
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Add channel to ActorSpace BEFORE connection opens
    // This ensures we're ready to receive when server sends
    actorSpace.addChannel(ws, testActor);

    // Wait for connection
    await new Promise((resolve) => ws.once('open', resolve));

    // Wait for connection-ready message
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Verify we received connection-ready
    expect(receivedMessages.length).toBeGreaterThan(0);
    const connectionReady = receivedMessages.find((m) => m.messageType === 'connection-ready');
    expect(connectionReady).toBeDefined();
    expect(connectionReady.data.processId).toBeDefined();
    expect(connectionReady.data.processId).toMatch(/^process-/);

    // Close WebSocket
    ws.close();
  });
});
