/**
 * E2E Test 5.3: Backend Actor in ActorSpace
 *
 * Tests backend actors working through ActorSpace with MockWebSocket.
 * This demonstrates the ease of setting up actors for frontend-backend communication.
 *
 * NO MOCKS for ActorSpace - uses real ActorSpace with MockWebSocket!
 */

import { ActorSpace } from '@legion/actors';
import { ResourceManager } from '@legion/resource-manager';
import { MockWebSocket } from '../helpers/MockWebSocket.js';

describe('ActorSpace Backend Integration E2E', () => {
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  }, 30000);

  test('should register and communicate with backend actor via ActorSpace', async () => {
    // Register a counter actor in ResourceManager
    resourceManager.actors.register('counter-actorspace', {
      protocol: {
        name: 'CounterActor',
        state: {
          schema: {
            count: { type: 'number', default: 0 }
          }
        },
        messages: {
          receives: {
            'increment': {
              action: 'state.count++',
              returns: 'state.count'
            },
            'get-count': {
              returns: 'state.count'
            }
          }
        }
      }
    });

    // Create ActorSpace instances for server and client
    const serverSpace = new ActorSpace('server');
    const clientSpace = new ActorSpace('client');

    // Create MockWebSocket pair
    const { serverWs, clientWs } = MockWebSocket.createPair();

    // Spawn the counter actor on server side
    const counter = resourceManager.actors.spawn('counter-actorspace');
    serverSpace.register(counter, 'counter');

    // Add channels with MockWebSocket
    const serverChannel = serverSpace.addChannel(serverWs);
    const clientChannel = clientSpace.addChannel(clientWs);

    // Wait for WebSocket to be "open"
    await new Promise(resolve => setTimeout(resolve, 50));

    // Create remote proxy on client side
    const remoteCounter = clientChannel.makeRemote('counter');

    // Send message through ActorSpace
    const count1 = await remoteCounter.receive('get-count');
    expect(count1).toBe(0);

    const count2 = await remoteCounter.receive('increment');
    expect(count2).toBe(1);

    const count3 = await remoteCounter.receive('increment');
    expect(count3).toBe(2);

    // Verify state persisted on server
    const directCount = await counter.receive('get-count');
    expect(directCount).toBe(2);

    // Clean up
    await serverSpace.destroy();
    await clientSpace.destroy();
  });

  test('should support multiple actors in same ActorSpace', async () => {
    // Register two different actor types
    resourceManager.actors.register('counter-multi-1', {
      protocol: {
        name: 'Counter1',
        state: { schema: { count: { type: 'number', default: 0 } } },
        messages: {
          receives: {
            'increment': { action: 'state.count++', returns: 'state.count' },
            'get': { returns: 'state.count' }
          }
        }
      }
    });

    resourceManager.actors.register('counter-multi-2', {
      protocol: {
        name: 'Counter2',
        state: { schema: { count: { type: 'number', default: 100 } } },
        messages: {
          receives: {
            'increment': { action: 'state.count++', returns: 'state.count' },
            'get': { returns: 'state.count' }
          }
        }
      }
    });

    // Setup ActorSpaces
    const serverSpace = new ActorSpace('server');
    const clientSpace = new ActorSpace('client');
    const { serverWs, clientWs } = MockWebSocket.createPair();

    // Spawn multiple actors on server
    const counter1 = resourceManager.actors.spawn('counter-multi-1');
    const counter2 = resourceManager.actors.spawn('counter-multi-2');
    serverSpace.register(counter1, 'counter1');
    serverSpace.register(counter2, 'counter2');

    // Add channels
    const serverChannel = serverSpace.addChannel(serverWs);
    const clientChannel = clientSpace.addChannel(clientWs);

    await new Promise(resolve => setTimeout(resolve, 50));

    // Create remote proxies for both actors
    const remoteCounter1 = clientChannel.makeRemote('counter1');
    const remoteCounter2 = clientChannel.makeRemote('counter2');

    // Interact with both actors independently
    const count1a = await remoteCounter1.receive('get');
    expect(count1a).toBe(0);

    const count2a = await remoteCounter2.receive('get');
    expect(count2a).toBe(100);

    await remoteCounter1.receive('increment');
    await remoteCounter2.receive('increment');

    const count1b = await remoteCounter1.receive('get');
    const count2b = await remoteCounter2.receive('get');

    expect(count1b).toBe(1);
    expect(count2b).toBe(101);

    // Clean up
    await serverSpace.destroy();
    await clientSpace.destroy();
    resourceManager.actors.destroy('counter-multi-1');
    resourceManager.actors.destroy('counter-multi-2');
  });

  test('should handle class-based actors through ActorSpace', async () => {
    // Define class-based actor
    class CalculatorActor {
      constructor(config = {}) {
        this.state = { result: config.initialValue || 0 };
      }

      async receive(messageType, data) {
        switch (messageType) {
          case 'add':
            this.state.result += data;
            return this.state.result;
          case 'multiply':
            this.state.result *= data;
            return this.state.result;
          case 'get':
            return this.state.result;
          case 'reset':
            this.state.result = 0;
            return this.state.result;
          default:
            throw new Error(`Unknown message: ${messageType}`);
        }
      }
    }

    // Register and spawn
    resourceManager.actors.register('calculator-actorspace', CalculatorActor);
    const calculator = resourceManager.actors.spawn('calculator-actorspace', { initialValue: 10 });

    // Setup ActorSpaces
    const serverSpace = new ActorSpace('server');
    const clientSpace = new ActorSpace('client');
    const { serverWs, clientWs } = MockWebSocket.createPair();

    serverSpace.register(calculator, 'calc');
    const serverChannel = serverSpace.addChannel(serverWs);
    const clientChannel = clientSpace.addChannel(clientWs);

    await new Promise(resolve => setTimeout(resolve, 50));

    // Use from client
    const remoteCalc = clientChannel.makeRemote('calc');

    const result1 = await remoteCalc.receive('get');
    expect(result1).toBe(10);

    const result2 = await remoteCalc.receive('add', 5);
    expect(result2).toBe(15);

    const result3 = await remoteCalc.receive('multiply', 2);
    expect(result3).toBe(30);

    const result4 = await remoteCalc.receive('reset');
    expect(result4).toBe(0);

    // Clean up
    await serverSpace.destroy();
    await clientSpace.destroy();
    resourceManager.actors.destroy('calculator-actorspace');
  });
});
