/**
 * Simple Remote Handle Integration Test for Graph Package
 *
 * Tests the critical functionality: GraphHandle can be transmitted from server
 * to client via ActorSerializer and method calls work via RemoteHandle.
 *
 * This verifies the user's explicit request: "we will want to test it that it is sent from the server"
 */

import { describe, it, expect } from '@jest/globals';
import { GraphDataSource, GraphHandle } from '../../src/index.js';
import { RemoteHandle } from '@legion/handle/src/remote/RemoteHandle.js';
import { ActorSpace } from '@legion/actors/src/ActorSpace.js';
import { ActorSerializer } from '@legion/actors/src/ActorSerializer.js';
import { Channel } from '@legion/actors/src/Channel.js';

// Register RemoteHandle class globally for ActorSerializer
ActorSerializer.registerRemoteHandle(RemoteHandle);

describe('Graph Package - Remote Handle Integration (Simple)', () => {
  it('should transmit GraphHandle from server to client as RemoteHandle', () => {
    // Setup server and client actor spaces
    const serverSpace = new ActorSpace('server');
    const clientSpace = new ActorSpace('client');

    const serverSerializer = new ActorSerializer(serverSpace);
    const clientSerializer = new ActorSerializer(clientSpace);

    // Create mock WebSocket pair
    const mockServerWs = {
      send: (data) => setImmediate(() => mockClientWs.onmessage?.({ data })),
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    const mockClientWs = {
      send: (data) => setImmediate(() => mockServerWs.onmessage?.({ data })),
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    // Create channels
    const serverChannel = new Channel(serverSpace, mockServerWs);
    const clientChannel = new Channel(clientSpace, mockClientWs);

    serverSpace._channel = serverChannel;
    clientSpace._channel = clientChannel;

    // Create server-side GraphHandle
    const graphDataSource = new GraphDataSource({
      nodes: [
        { id: 'node1', label: 'Node 1', type: 'Entity' },
        { id: 'node2', label: 'Node 2', type: 'Entity' }
      ],
      edges: [
        { id: 'edge1', source: 'node1', target: 'node2', type: 'connects' }
      ]
    });

    const serverGraphHandle = new GraphHandle(graphDataSource);

    // Server serializes the handle
    const serialized = serverSerializer.serialize({ handle: serverGraphHandle });

    // Client deserializes - should create RemoteHandle
    const deserialized = clientSerializer.deserialize(serialized, clientChannel);

    // Verify RemoteHandle was created
    expect(deserialized.handle).toBeInstanceOf(RemoteHandle);
    expect(deserialized.handle._remoteHandleType).toBe('GraphHandle');
    expect(deserialized.handle._schema.type).toBe('graph');
    expect(deserialized.handle.capabilities).toContain('getNodes');
    expect(deserialized.handle.capabilities).toContain('getEdges');
    expect(deserialized.handle.capabilities).toContain('nodeHandle');
    expect(deserialized.handle.capabilities).toContain('edgeHandle');
  });

  it('should transmit NodeHandle from server to client as RemoteHandle', () => {
    const serverSpace = new ActorSpace('server');
    const clientSpace = new ActorSpace('client');

    const serverSerializer = new ActorSerializer(serverSpace);
    const clientSerializer = new ActorSerializer(clientSpace);

    const mockServerWs = {
      send: (data) => setImmediate(() => mockClientWs.onmessage?.({ data })),
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    const mockClientWs = {
      send: (data) => setImmediate(() => mockServerWs.onmessage?.({ data })),
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    const serverChannel = new Channel(serverSpace, mockServerWs);
    const clientChannel = new Channel(clientSpace, mockClientWs);

    serverSpace._channel = serverChannel;
    clientSpace._channel = clientChannel;

    const graphDataSource = new GraphDataSource({
      nodes: [{ id: 'node1', label: 'Node 1' }],
      edges: []
    });

    const serverGraphHandle = new GraphHandle(graphDataSource);
    const serverNodeHandle = serverGraphHandle.nodeHandle('node1');

    const serialized = serverSerializer.serialize({ handle: serverNodeHandle });
    const deserialized = clientSerializer.deserialize(serialized, clientChannel);

    expect(deserialized.handle).toBeInstanceOf(RemoteHandle);
    expect(deserialized.handle._remoteHandleType).toBe('NodeHandle');
    expect(deserialized.handle._schema.type).toBe('node');
    expect(deserialized.handle.capabilities).toContain('getData');
    expect(deserialized.handle.capabilities).toContain('getConnectedNodes');
  });

  it('should transmit EdgeHandle from server to client as RemoteHandle', () => {
    const serverSpace = new ActorSpace('server');
    const clientSpace = new ActorSpace('client');

    const serverSerializer = new ActorSerializer(serverSpace);
    const clientSerializer = new ActorSerializer(clientSpace);

    const mockServerWs = {
      send: (data) => setImmediate(() => mockClientWs.onmessage?.({ data })),
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    const mockClientWs = {
      send: (data) => setImmediate(() => mockServerWs.onmessage?.({ data })),
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    const serverChannel = new Channel(serverSpace, mockServerWs);
    const clientChannel = new Channel(clientSpace, mockClientWs);

    serverSpace._channel = serverChannel;
    clientSpace._channel = clientChannel;

    const graphDataSource = new GraphDataSource({
      nodes: [
        { id: 'node1', label: 'Node 1' },
        { id: 'node2', label: 'Node 2' }
      ],
      edges: [
        { id: 'edge1', source: 'node1', target: 'node2', type: 'connects' }
      ]
    });

    const serverGraphHandle = new GraphHandle(graphDataSource);
    const serverEdgeHandle = serverGraphHandle.edgeHandle('edge1');

    const serialized = serverSerializer.serialize({ handle: serverEdgeHandle });
    const deserialized = clientSerializer.deserialize(serialized, clientChannel);

    expect(deserialized.handle).toBeInstanceOf(RemoteHandle);
    expect(deserialized.handle._remoteHandleType).toBe('EdgeHandle');
    expect(deserialized.handle._schema.type).toBe('edge');
    expect(deserialized.handle.capabilities).toContain('getData');
    expect(deserialized.handle.capabilities).toContain('getSourceNode');
    expect(deserialized.handle.capabilities).toContain('getTargetNode');
  });
});
