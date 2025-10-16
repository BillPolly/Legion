/**
 * E2E Test 5.5: Multi-Client ActorSpace Scenarios
 *
 * Tests complex scenarios with multiple clients, multiple actors,
 * and concurrent operations through ActorSpace.
 */

import { ActorSpace } from '@legion/actors';
import { ResourceManager } from '@legion/resource-manager';
import { MockWebSocket } from '../helpers/MockWebSocket.js';

describe('ActorSpace Multi-Client E2E', () => {
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  }, 30000);

  test('should handle multiple clients with independent state actors', async () => {
    // Session actor that maintains per-client state
    class SessionActor {
      constructor(userId) {
        this.userId = userId;
        this.state = { sessionData: {}, loginTime: Date.now() };
      }

      async receive(messageType, data) {
        switch (messageType) {
          case 'set-data':
            this.state.sessionData = { ...this.state.sessionData, ...data };
            return this.state.sessionData;
          case 'get-data':
            return this.state.sessionData;
          case 'get-user-id':
            return this.userId;
          default:
            throw new Error(`Unknown message: ${messageType}`);
        }
      }
    }

    // Backend with multiple session actors
    const backend = new ActorSpace('backend');

    // Spawn separate session actors for different users
    const session1 = new SessionActor('user1');
    const session2 = new SessionActor('user2');
    backend.register(session1, 'session-user1');
    backend.register(session2, 'session-user2');

    // Create two frontend clients
    const frontend1 = new ActorSpace('frontend1');
    const frontend2 = new ActorSpace('frontend2');

    const { serverWs: serverWs1, clientWs: clientWs1 } = MockWebSocket.createPair();
    const { serverWs: serverWs2, clientWs: clientWs2 } = MockWebSocket.createPair();

    backend.addChannel(serverWs1);
    backend.addChannel(serverWs2);
    const channel1 = frontend1.addChannel(clientWs1);
    const channel2 = frontend2.addChannel(clientWs2);

    await new Promise(resolve => setTimeout(resolve, 50));

    // Each frontend connects to its own session
    const remoteSession1 = channel1.makeRemote('session-user1');
    const remoteSession2 = channel2.makeRemote('session-user2');

    // Set data independently
    await remoteSession1.receive('set-data', { name: 'Alice', role: 'admin' });
    await remoteSession2.receive('set-data', { name: 'Bob', role: 'user' });

    // Verify independent state
    const data1 = await remoteSession1.receive('get-data');
    const data2 = await remoteSession2.receive('get-data');

    expect(data1).toEqual({ name: 'Alice', role: 'admin' });
    expect(data2).toEqual({ name: 'Bob', role: 'user' });

    const userId1 = await remoteSession1.receive('get-user-id');
    const userId2 = await remoteSession2.receive('get-user-id');

    expect(userId1).toBe('user1');
    expect(userId2).toBe('user2');

    await backend.destroy();
    await frontend1.destroy();
    await frontend2.destroy();
  });

  test('should support concurrent operations from multiple clients', async () => {
    // Shared counter with operation log
    class ConcurrentCounter {
      constructor() {
        this.count = 0;
        this.operations = [];
      }

      async receive(messageType, data) {
        switch (messageType) {
          case 'increment':
            this.count++;
            this.operations.push({ type: 'increment', client: data, count: this.count });
            return this.count;
          case 'get':
            return this.count;
          case 'get-operations':
            return this.operations;
          default:
            throw new Error(`Unknown message: ${messageType}`);
        }
      }
    }

    // Backend
    const backend = new ActorSpace('backend');
    const counter = new ConcurrentCounter();
    backend.register(counter, 'counter');

    // Three concurrent clients
    const clients = await Promise.all([1, 2, 3].map(async (i) => {
      const frontend = new ActorSpace(`frontend${i}`);
      const { serverWs, clientWs } = MockWebSocket.createPair();
      backend.addChannel(serverWs);
      const channel = frontend.addChannel(clientWs);
      await new Promise(resolve => setTimeout(resolve, 50));
      const remote = channel.makeRemote('counter');
      return { frontend, remote, id: `client${i}` };
    }));

    // All clients increment concurrently
    const results = await Promise.all(
      clients.map(({ remote, id }) => remote.receive('increment', id))
    );

    // All should get different counts (1, 2, 3 in some order)
    expect(new Set(results).size).toBe(3);
    expect(Math.max(...results)).toBe(3);
    expect(Math.min(...results)).toBe(1);

    // Final count should be 3
    const finalCount = await clients[0].remote.receive('get');
    expect(finalCount).toBe(3);

    // All operations should be logged
    const operations = await clients[0].remote.receive('get-operations');
    expect(operations).toHaveLength(3);

    // Clean up
    await backend.destroy();
    for (const { frontend } of clients) {
      await frontend.destroy();
    }
  });

  test('should handle client disconnection and reconnection', async () => {
    // Stateful service
    resourceManager.actors.register('persistent-service', {
      protocol: {
        name: 'PersistentService',
        state: { schema: { value: { type: 'number', default: 0 } } },
        messages: {
          receives: {
            'set': { action: 'state.value = data', returns: 'state.value' },
            'get': { returns: 'state.value' }
          }
        }
      }
    });

    const service = resourceManager.actors.spawn('persistent-service');
    const backend = new ActorSpace('backend');
    backend.register(service, 'service');

    // Client 1 connects
    const frontend1 = new ActorSpace('frontend1');
    const { serverWs: serverWs1, clientWs: clientWs1 } = MockWebSocket.createPair();
    backend.addChannel(serverWs1);
    const channel1 = frontend1.addChannel(clientWs1);
    await new Promise(resolve => setTimeout(resolve, 50));

    const remote1 = channel1.makeRemote('service');
    await remote1.receive('set', 42);

    // Client 1 disconnects
    await frontend1.destroy();

    // Client 2 connects to SAME backend service
    const frontend2 = new ActorSpace('frontend2');
    const { serverWs: serverWs2, clientWs: clientWs2 } = MockWebSocket.createPair();
    backend.addChannel(serverWs2);
    const channel2 = frontend2.addChannel(clientWs2);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Client 2 should see the state from client 1
    const remote2 = channel2.makeRemote('service');
    const value = await remote2.receive('get');
    expect(value).toBe(42);

    await backend.destroy();
    await frontend2.destroy();
    resourceManager.actors.destroy('persistent-service');
  });

  test('should support multiple backends with frontend routing', async () => {
    // Two separate backend services
    const backend1 = new ActorSpace('backend1');
    const backend2 = new ActorSpace('backend2');

    resourceManager.actors.register('service-a', {
      protocol: {
        name: 'ServiceA',
        state: { schema: { name: { type: 'string', default: 'Service A' } } },
        messages: { receives: { 'get-name': { returns: 'state.name' } } }
      }
    });

    resourceManager.actors.register('service-b', {
      protocol: {
        name: 'ServiceB',
        state: { schema: { name: { type: 'string', default: 'Service B' } } },
        messages: { receives: { 'get-name': { returns: 'state.name' } } }
      }
    });

    const serviceA = resourceManager.actors.spawn('service-a');
    const serviceB = resourceManager.actors.spawn('service-b');

    backend1.register(serviceA, 'service');
    backend2.register(serviceB, 'service');

    // Frontend connects to BOTH backends
    const frontend = new ActorSpace('frontend');

    const { serverWs: serverWs1, clientWs: clientWs1 } = MockWebSocket.createPair();
    const { serverWs: serverWs2, clientWs: clientWs2 } = MockWebSocket.createPair();

    backend1.addChannel(serverWs1);
    backend2.addChannel(serverWs2);

    const channel1 = frontend.addChannel(clientWs1);
    const channel2 = frontend.addChannel(clientWs2);

    await new Promise(resolve => setTimeout(resolve, 50));

    // Frontend can route to either backend
    const remoteA = channel1.makeRemote('service');
    const remoteB = channel2.makeRemote('service');

    const nameA = await remoteA.receive('get-name');
    const nameB = await remoteB.receive('get-name');

    expect(nameA).toBe('Service A');
    expect(nameB).toBe('Service B');

    await backend1.destroy();
    await backend2.destroy();
    await frontend.destroy();
    resourceManager.actors.destroy('service-a');
    resourceManager.actors.destroy('service-b');
  });
});
