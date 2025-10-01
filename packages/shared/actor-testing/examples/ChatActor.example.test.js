/**
 * Example: Complete Chat Actor Testing
 *
 * This example demonstrates all features of @legion/actor-testing:
 * - ProtocolActor definition
 * - Manual unit tests
 * - Auto-generated protocol tests
 * - Integration tests with ActorTestHarness
 * - DOM testing with JSDOM
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { ProtocolActor } from '@legion/actors';
import {
  ProtocolTestSuite,
  ActorTestHarness,
  MockWebSocket,
  TestDataGenerator
} from '@legion/actor-testing';

// ===================================================================
// 1. Define Protocol Actor
// ===================================================================

class ChatServerActor extends ProtocolActor {
  constructor() {
    super();
    this.messages = [];
    this.users = new Map();
  }

  getProtocol() {
    return {
      name: 'ChatServerActor',
      version: '1.0.0',
      state: {
        schema: {
          roomName: { type: 'string', required: true },
          userCount: { type: 'integer', required: true }
        },
        initial: {
          roomName: 'general',
          userCount: 0
        }
      },
      messages: {
        receives: {
          'user-join': {
            schema: {
              username: { type: 'string', minLength: 3, required: true },
              userId: { type: 'string', required: true }
            },
            postconditions: ['state.userCount > 0']
          },
          'send-message': {
            schema: {
              userId: { type: 'string', required: true },
              text: { type: 'string', minLength: 1, required: true }
            },
            preconditions: ['state.userCount > 0']
          },
          'user-leave': {
            schema: {
              userId: { type: 'string', required: true }
            },
            postconditions: ['state.userCount >= 0']
          }
        },
        sends: {
          'message-broadcast': {
            schema: {
              from: { type: 'string', required: true },
              text: { type: 'string', required: true },
              timestamp: { type: 'string', required: true }
            },
            preconditions: ['state.userCount > 0']
          },
          'user-joined': {
            schema: {
              username: { type: 'string', required: true },
              userCount: { type: 'integer', required: true }
            }
          }
        }
      }
    };
  }

  handleMessage(messageType, data) {
    switch (messageType) {
      case 'user-join':
        this.users.set(data.userId, data.username);
        this.state.userCount = this.users.size;
        return {
          success: true,
          userCount: this.state.userCount
        };

      case 'send-message':
        const username = this.users.get(data.userId);
        if (!username) {
          throw new Error('User not found');
        }
        const message = {
          id: Date.now().toString(),
          from: username,
          text: data.text,
          timestamp: new Date().toISOString()
        };
        this.messages.push(message);
        return { success: true, message };

      case 'user-leave':
        this.users.delete(data.userId);
        this.state.userCount = this.users.size;
        return { success: true, userCount: this.state.userCount };

      default:
        throw new Error(`Unknown message type: ${messageType}`);
    }
  }

  doSend(messageType, data) {
    // In real implementation, would send via WebSocket/Channel
    return Promise.resolve({ sent: true, messageType, data });
  }
}

class ChatClientActor extends ProtocolActor {
  constructor(options = {}) {
    super();
    this.username = options.username || 'Anonymous';
    this.userId = options.userId || `user-${Date.now()}`;
    this.receivedMessages = [];
  }

  getProtocol() {
    return {
      name: 'ChatClientActor',
      version: '1.0.0',
      state: {
        schema: {
          connected: { type: 'boolean', required: true },
          username: { type: 'string', required: true }
        },
        initial: {
          connected: false,
          username: 'Anonymous'
        }
      },
      messages: {
        receives: {
          'message-broadcast': {
            schema: {
              from: { type: 'string', required: true },
              text: { type: 'string', required: true },
              timestamp: { type: 'string', required: true }
            }
          },
          'user-joined': {
            schema: {
              username: { type: 'string', required: true },
              userCount: { type: 'integer', required: true }
            }
          }
        },
        sends: {
          'user-join': {
            schema: {
              username: { type: 'string', minLength: 3, required: true },
              userId: { type: 'string', required: true }
            },
            preconditions: ['state.connected === false'],
            postconditions: ['state.connected === true']
          },
          'send-message': {
            schema: {
              userId: { type: 'string', required: true },
              text: { type: 'string', minLength: 1, required: true }
            },
            preconditions: ['state.connected === true']
          }
        }
      }
    };
  }

  handleMessage(messageType, data) {
    switch (messageType) {
      case 'message-broadcast':
        this.receivedMessages.push(data);
        return { success: true };

      case 'user-joined':
        return { success: true, userCount: data.userCount };

      default:
        throw new Error(`Unknown message type: ${messageType}`);
    }
  }

  doSend(messageType, data) {
    return Promise.resolve({ sent: true, messageType, data });
  }

  async connect() {
    const result = await this.send('user-join', {
      username: this.username,
      userId: this.userId
    });
    this.state.connected = true;
    this.state.username = this.username;
    return result;
  }

  async sendMessage(text) {
    return await this.send('send-message', {
      userId: this.userId,
      text
    });
  }
}

// ===================================================================
// 2. Auto-Generated Protocol Tests
// ===================================================================

describe('ChatServerActor Protocol Tests', () => {
  ProtocolTestSuite.generateTests(ChatServerActor, {
    includeIntegrationTests: true,
    testPostconditions: true
  });
});

describe('ChatClientActor Protocol Tests', () => {
  ProtocolTestSuite.generateTests(ChatClientActor, {
    includeIntegrationTests: true,
    testPostconditions: true
  });
});

// ===================================================================
// 3. Manual Unit Tests
// ===================================================================

describe('ChatServerActor Unit Tests', () => {
  let server;

  beforeEach(() => {
    server = new ChatServerActor();
  });

  test('should handle user join', async () => {
    const result = await server.receive('user-join', {
      username: 'Alice',
      userId: 'user-1'
    });

    expect(result.success).toBe(true);
    expect(result.userCount).toBe(1);
    expect(server.state.userCount).toBe(1);
  });

  test('should handle message sending', async () => {
    // First join
    await server.receive('user-join', {
      username: 'Alice',
      userId: 'user-1'
    });

    // Then send message
    const result = await server.receive('send-message', {
      userId: 'user-1',
      text: 'Hello everyone!'
    });

    expect(result.success).toBe(true);
    expect(result.message.from).toBe('Alice');
    expect(result.message.text).toBe('Hello everyone!');
    expect(server.messages).toHaveLength(1);
  });

  test('should handle user leave', async () => {
    // Join
    await server.receive('user-join', {
      username: 'Alice',
      userId: 'user-1'
    });

    // Leave
    const result = await server.receive('user-leave', {
      userId: 'user-1'
    });

    expect(result.success).toBe(true);
    expect(result.userCount).toBe(0);
    expect(server.state.userCount).toBe(0);
  });

  test('should reject message from unknown user', async () => {
    await expect(
      server.receive('send-message', {
        userId: 'unknown',
        text: 'Hello'
      })
    ).rejects.toThrow('User not found');
  });
});

// ===================================================================
// 4. Integration Tests with ActorTestHarness
// ===================================================================

describe('Chat System Integration Tests', () => {
  let harness;

  beforeEach(async () => {
    harness = new ActorTestHarness({
      serverActor: ChatServerActor,
      clientActor: ChatClientActor,
      clientActorOptions: {
        username: 'TestUser',
        userId: 'test-user-1'
      }
    });
    await harness.setup();
  });

  afterEach(async () => {
    await harness.teardown();
  });

  test('should connect client to server', async () => {
    const response = await harness.serverSend('user-join', {
      username: 'TestUser',
      userId: 'test-user-1'
    });

    expect(response.success).toBe(true);
    expect(response.userCount).toBe(1);
  });

  test('should send message through system', async () => {
    // First join
    await harness.serverSend('user-join', {
      username: 'TestUser',
      userId: 'test-user-1'
    });

    // Then send message
    const response = await harness.serverSend('send-message', {
      userId: 'test-user-1',
      text: 'Integration test message'
    });

    expect(response.success).toBe(true);
    expect(response.message.from).toBe('TestUser');
    expect(response.message.text).toBe('Integration test message');
  });

  test('should track message history', async () => {
    // Join
    await harness.serverSend('user-join', {
      username: 'TestUser',
      userId: 'test-user-1'
    });

    // Send messages
    await harness.serverSend('send-message', {
      userId: 'test-user-1',
      text: 'Message 1'
    });

    await harness.serverSend('send-message', {
      userId: 'test-user-1',
      text: 'Message 2'
    });

    expect(harness.serverActor.messages).toHaveLength(2);
  });
});

// ===================================================================
// 5. MockWebSocket Direct Testing
// ===================================================================

describe('MockWebSocket Chat Tests', () => {
  test('should create paired WebSockets for bidirectional chat', async () => {
    const { clientWs, serverWs } = MockWebSocket.createPair();

    const clientMessages = [];
    const serverMessages = [];

    clientWs.addEventListener('message', (event) => {
      clientMessages.push(event.data);
    });

    serverWs.addEventListener('message', (event) => {
      serverMessages.push(event.data);
    });

    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 20));

    // Client sends to server
    clientWs.send('Hello from client');
    expect(serverMessages).toContain('Hello from client');

    // Server sends to client
    serverWs.send('Hello from server');
    expect(clientMessages).toContain('Hello from server');
  });

  test('should handle WebSocket lifecycle', async () => {
    const ws = new MockWebSocket('ws://test');

    const events = [];
    ws.addEventListener('open', () => events.push('open'));
    ws.addEventListener('close', () => events.push('close'));

    // Wait for open
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(events).toContain('open');

    // Close
    ws.close();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(events).toContain('close');
  });
});

// ===================================================================
// 6. Test Data Generator Usage
// ===================================================================

describe('Test Data Generation for Chat', () => {
  test('should generate valid user-join data', () => {
    const schema = {
      username: { type: 'string', minLength: 3, required: true },
      userId: { type: 'string', required: true }
    };

    const data = TestDataGenerator.generateValidData(schema);

    expect(data.username).toBeDefined();
    expect(data.username.length).toBeGreaterThanOrEqual(3);
    expect(data.userId).toBeDefined();
  });

  test('should generate invalid data for validation testing', () => {
    const schema = {
      username: { type: 'string', minLength: 3, required: true }
    };

    const invalidData = TestDataGenerator.generateInvalidData(schema);

    // Should violate type constraint
    expect(typeof invalidData.username).not.toBe('string');
  });
});
