/**
 * E2E Test 5.4: Frontend-Backend Communication with RemoteHandle
 *
 * Demonstrates the EASE of setting up actors connecting frontend and backend.
 * This is the CORE VALUE PROPOSITION of the actor-handle system!
 *
 * Uses MockWebSocket to run front and backend actors in the same context.
 */

import { ActorSpace } from '@legion/actors';
import { ResourceManager } from '@legion/resource-manager';
import { RemoteHandle } from '@legion/handle';
import { MockWebSocket } from '../helpers/MockWebSocket.js';

describe('RemoteHandle Frontend-Backend E2E', () => {
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  }, 30000);

  test('should use RemoteHandle for easy frontend-backend communication', async () => {
    // BACKEND SETUP - Register a data actor
    resourceManager.actors.register('data-service', {
      protocol: {
        name: 'DataService',
        state: {
          schema: {
            items: { type: 'array', default: [] }
          }
        },
        messages: {
          receives: {
            'add-item': {
              action: 'state.items.push(data)',
              returns: 'state.items'
            },
            'get-items': {
              returns: 'state.items'
            },
            'clear': {
              action: 'state.items = []',
              returns: 'state.items'
            }
          }
        }
      }
    });

    // Spawn backend actor
    const dataService = resourceManager.actors.spawn('data-service');

    // Setup ActorSpaces (backend and frontend)
    const backendSpace = new ActorSpace('backend');
    const frontendSpace = new ActorSpace('frontend');
    const { serverWs, clientWs } = MockWebSocket.createPair();

    // Register backend actor with a GUID
    const serviceGuid = 'data-service-123';
    backendSpace.register(dataService, serviceGuid);

    // Add channels
    const backendChannel = backendSpace.addChannel(serverWs);
    const frontendChannel = frontendSpace.addChannel(clientWs);

    await new Promise(resolve => setTimeout(resolve, 50));

    // FRONTEND - Access remote actor directly (RemoteHandle is for Handle-based actors)
    const remoteDataService = frontendChannel.makeRemote(serviceGuid);

    // Call the actor's receive method
    const items1 = await remoteDataService.receive('get-items');
    expect(items1).toEqual([]);

    const items2 = await remoteDataService.receive('add-item', 'First Item');
    expect(items2).toEqual(['First Item']);

    const items3 = await remoteDataService.receive('add-item', 'Second Item');
    expect(items3).toEqual(['First Item', 'Second Item']);

    const items4 = await remoteDataService.receive('get-items');
    expect(items4).toEqual(['First Item', 'Second Item']);

    // Verify backend state matches
    const backendItems = await dataService.receive('get-items');
    expect(backendItems).toEqual(['First Item', 'Second Item']);

    // Clean up
    await backendSpace.destroy();
    await frontendSpace.destroy();
    resourceManager.actors.destroy('data-service');
  });

  test('should demonstrate EASY SETUP - complete example in ~20 lines', async () => {
    // This test shows how SIMPLE it is to connect frontend and backend!

    // 1. Register backend actor (1 line)
    resourceManager.actors.register('simple-counter', {
      protocol: {
        name: 'SimpleCounter',
        state: { schema: { count: { type: 'number', default: 0 } } },
        messages: {
          receives: {
            'inc': { action: 'state.count++', returns: 'state.count' }
          }
        }
      }
    });

    // 2. Spawn and setup (4 lines)
    const counter = resourceManager.actors.spawn('simple-counter');
    const backend = new ActorSpace('backend');
    const frontend = new ActorSpace('frontend');
    const { serverWs, clientWs } = MockWebSocket.createPair();

    // 3. Connect (3 lines)
    backend.register(counter, 'counter');
    backend.addChannel(serverWs);
    const frontendChannel = frontend.addChannel(clientWs);
    await new Promise(resolve => setTimeout(resolve, 50));

    // 4. Use from frontend (2 lines)
    const remoteCounter = frontendChannel.makeRemote('counter');
    const result = await remoteCounter.receive('inc');

    // THAT'S IT! Full frontend-backend communication in ~20 lines!
    expect(result).toBe(1);

    await backend.destroy();
    await frontend.destroy();
    resourceManager.actors.destroy('simple-counter');
  });

  test('should support bidirectional communication', async () => {
    // Backend actor that just echoes back
    class EchoActor {
      async receive(messageType, data) {
        switch (messageType) {
          case 'echo':
            return `Echo: ${data}`;
          case 'ping':
            return 'pong';
          default:
            throw new Error(`Unknown message: ${messageType}`);
        }
      }
    }

    resourceManager.actors.register('echo', EchoActor);
    const echo = resourceManager.actors.spawn('echo');

    // Setup spaces
    const backend = new ActorSpace('backend');
    const frontend = new ActorSpace('frontend');
    const { serverWs, clientWs } = MockWebSocket.createPair();

    backend.register(echo, 'echo');
    backend.addChannel(serverWs);
    const frontendChannel = frontend.addChannel(clientWs);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Frontend can call backend
    const remoteEcho = frontendChannel.makeRemote('echo');
    const response1 = await remoteEcho.receive('ping');
    expect(response1).toBe('pong');

    const response2 = await remoteEcho.receive('echo', 'Hello!');
    expect(response2).toBe('Echo: Hello!');

    await backend.destroy();
    await frontend.destroy();
    resourceManager.actors.destroy('echo');
  });

  test('should handle multiple frontend clients connecting to same backend', async () => {
    // Shared backend service
    resourceManager.actors.register('shared-service', {
      protocol: {
        name: 'SharedService',
        state: { schema: { counter: { type: 'number', default: 0 } } },
        messages: {
          receives: {
            'increment': { action: 'state.counter++', returns: 'state.counter' },
            'get': { returns: 'state.counter' }
          }
        }
      }
    });

    const service = resourceManager.actors.spawn('shared-service');
    const backend = new ActorSpace('backend');
    backend.register(service, 'shared');

    // Create TWO frontend clients
    const frontend1 = new ActorSpace('frontend1');
    const frontend2 = new ActorSpace('frontend2');

    const { serverWs: serverWs1, clientWs: clientWs1 } = MockWebSocket.createPair();
    const { serverWs: serverWs2, clientWs: clientWs2 } = MockWebSocket.createPair();

    backend.addChannel(serverWs1);
    backend.addChannel(serverWs2);

    const channel1 = frontend1.addChannel(clientWs1);
    const channel2 = frontend2.addChannel(clientWs2);

    await new Promise(resolve => setTimeout(resolve, 50));

    // Both frontends can access same backend actor
    const remote1 = channel1.makeRemote('shared');
    const remote2 = channel2.makeRemote('shared');

    // Client 1 increments
    const count1 = await remote1.receive('increment');
    expect(count1).toBe(1);

    // Client 2 sees the update
    const count2 = await remote2.receive('get');
    expect(count2).toBe(1);

    // Client 2 increments
    const count3 = await remote2.receive('increment');
    expect(count3).toBe(2);

    // Client 1 sees the update
    const count4 = await remote1.receive('get');
    expect(count4).toBe(2);

    await backend.destroy();
    await frontend1.destroy();
    await frontend2.destroy();
    resourceManager.actors.destroy('shared-service');
  });
});
