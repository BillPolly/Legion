/**
 * ComponentStoreActor - WebSocket Integration Test
 *
 * Demonstrates CORRECT actor testing pattern using MockWebSocket
 * Tests that ComponentStoreActor messages can be properly serialized/deserialized
 * through WebSocket communication
 *
 * This follows the pattern from /packages/cli/__tests__/TESTING-NOTES.md
 */

import { MockWebSocket } from '@legion/actor-testing';
import { ComponentStoreActor } from '../../../src/components/component-editor/src/actors/ComponentStoreActor.js';

// In-memory database for testing
class InMemoryDatabase {
  constructor() {
    this.collections = new Map();
  }

  async insert(collection, data) {
    if (!this.collections.has(collection)) {
      this.collections.set(collection, []);
    }
    this.collections.get(collection).push(data);
    return data;
  }

  async findOne(collection, query) {
    if (!this.collections.has(collection)) {
      return null;
    }
    const items = this.collections.get(collection);
    return items.find(item => this._matches(item, query)) || null;
  }

  async find(collection, query = {}) {
    if (!this.collections.has(collection)) {
      return [];
    }
    const items = this.collections.get(collection);
    if (Object.keys(query).length === 0) {
      return [...items];
    }
    return items.filter(item => this._matches(item, query));
  }

  _matches(item, query) {
    return Object.entries(query).every(([key, value]) => item[key] === value);
  }

  clear() {
    this.collections.clear();
  }
}

describe('ComponentStoreActor - WebSocket Communication Tests', () => {
  let database;
  let serverActor;
  let serverWs;
  let clientWs;

  beforeEach(async () => {
    database = new InMemoryDatabase();
    serverActor = new ComponentStoreActor(database);

    // Create paired WebSockets - THE CORRECT PATTERN!
    const pair = MockWebSocket.createPair();
    serverWs = pair.serverWs;
    clientWs = pair.clientWs;

    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 20));
  });

  afterEach(() => {
    if (serverWs) serverWs.close();
    if (clientWs) clientWs.close();
    database.clear();
  });

  describe('Message Serialization via WebSocket', () => {
    test('should handle component.create via WebSocket message flow', async () => {
      // This test demonstrates the CORRECT pattern:
      // Client sends JSON message -> WebSocket -> Server deserializes -> Actor processes -> Response

      const componentData = {
        name: 'TestComponent',
        dsl: 'TestComponent :: state => div',
        dataModel: {
          entityName: 'state',
          schema: {},
          sampleData: {}
        }
      };

      // Setup server to handle incoming WebSocket messages
      let serverResponse = null;
      serverWs.addEventListener('message', async (event) => {
        // Server receives serialized message
        const message = JSON.parse(event.data);

        // Route to actor
        if (message.messageType === 'component.create') {
          const result = await serverActor.receive(message.messageType, message.data);

          // Server sends response back via WebSocket
          const response = {
            messageId: message.messageId,
            result: result
          };
          serverWs.send(JSON.stringify(response));
        }
      });

      // Client sends message via WebSocket
      const messageId = 'test-message-1';
      const message = {
        messageId,
        messageType: 'component.create',
        data: componentData
      };

      // Setup client to receive response
      const responsePromise = new Promise((resolve) => {
        clientWs.addEventListener('message', (event) => {
          const response = JSON.parse(event.data);
          if (response.messageId === messageId) {
            resolve(response.result);
          }
        });
      });

      // Send via WebSocket (serialized as JSON)
      clientWs.send(JSON.stringify(message));

      // Wait for response
      const result = await responsePromise;

      // Verify result
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe('TestComponent');

      // Verify message was properly serialized/deserialized
      const sentMessages = clientWs.getSentMessages();
      expect(sentMessages.length).toBe(1);
      const sentMessage = JSON.parse(sentMessages[0]);
      expect(sentMessage.messageType).toBe('component.create');
      expect(sentMessage.data.name).toBe('TestComponent');
    });

    test('should handle complex nested data structures through JSON serialization', async () => {
      const complexData = {
        name: 'ComplexComponent',
        dsl: 'ComplexComponent :: state => div',
        dataModel: {
          entityName: 'state',
          schema: {
            properties: {
              nested: {
                type: 'object',
                properties: {
                  deeply: {
                    type: 'object',
                    properties: {
                      value: { type: 'string' }
                    }
                  }
                }
              },
              array: {
                type: 'array',
                items: { type: 'number' }
              }
            }
          },
          sampleData: {
            nested: {
              deeply: {
                value: 'test'
              }
            },
            array: [1, 2, 3, 4, 5]
          }
        }
      };

      // Setup message handling
      serverWs.addEventListener('message', async (event) => {
        const message = JSON.parse(event.data);
        if (message.messageType === 'component.create') {
          const result = await serverActor.receive(message.messageType, message.data);
          serverWs.send(JSON.stringify({ messageId: message.messageId, result }));
        }
      });

      // Send complex data via WebSocket
      const messageId = 'complex-test';
      clientWs.send(JSON.stringify({
        messageId,
        messageType: 'component.create',
        data: complexData
      }));

      // Wait for response
      const result = await new Promise((resolve) => {
        clientWs.addEventListener('message', (event) => {
          const response = JSON.parse(event.data);
          if (response.messageId === messageId) {
            resolve(response.result);
          }
        });
      });

      // Verify complex structure was preserved through serialization
      expect(result.dataModel.sampleData.nested.deeply.value).toBe('test');
      expect(result.dataModel.sampleData.array).toEqual([1, 2, 3, 4, 5]);
    });

    test('should handle special characters and escape sequences', async () => {
      const dataWithSpecialChars = {
        name: 'SpecialChars',
        dsl: 'Test :: s => div { "Quotes: \\"test\\" Newlines:\\n Tabs:\\t" }',
        dataModel: {
          entityName: 's',
          schema: {},
          sampleData: {
            text: 'Special: "quotes" \n newlines \t tabs \\ backslashes'
          }
        }
      };

      serverWs.addEventListener('message', async (event) => {
        const message = JSON.parse(event.data);
        if (message.messageType === 'component.create') {
          const result = await serverActor.receive(message.messageType, message.data);
          serverWs.send(JSON.stringify({ messageId: message.messageId, result }));
        }
      });

      const messageId = 'special-chars';
      clientWs.send(JSON.stringify({
        messageId,
        messageType: 'component.create',
        data: dataWithSpecialChars
      }));

      const result = await new Promise((resolve) => {
        clientWs.addEventListener('message', (event) => {
          const response = JSON.parse(event.data);
          if (response.messageId === messageId) {
            resolve(response.result);
          }
        });
      });

      // Verify special characters preserved
      expect(result.dsl).toContain('Quotes');
      expect(result.dataModel.sampleData.text).toContain('quotes');
    });
  });

  describe('WebSocket Message Flow Verification', () => {
    test('should verify messages are properly formatted JSON', () => {
      const message = {
        messageId: 'test-123',
        messageType: 'component.create',
        data: { name: 'Test', dsl: 'Test :: s => div', dataModel: { entityName: 's', schema: {}, sampleData: {} } }
      };

      // Send message
      clientWs.send(JSON.stringify(message));

      // Verify sent messages
      const sentMessages = clientWs.getSentMessages();
      expect(sentMessages.length).toBe(1);

      // Verify message is valid JSON
      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.messageId).toBe('test-123');
      expect(parsed.messageType).toBe('component.create');
      expect(parsed.data.name).toBe('Test');
    });

    test('should demonstrate why direct actor wiring is wrong', () => {
      // ❌ WRONG PATTERN - This is what we SHOULD NOT do:
      // const result = await serverActor.receive('component.create', data);
      //
      // Why it's wrong:
      // 1. Bypasses WebSocket layer completely
      // 2. No JSON serialization/deserialization
      // 3. Won't catch serialization errors
      // 4. Won't catch WebSocket routing issues
      // 5. Test passes but real browser fails!

      // ✅ CORRECT PATTERN - What we SHOULD do:
      // 1. Send via WebSocket: clientWs.send(JSON.stringify(message))
      // 2. Message serialized to JSON
      // 3. WebSocket delivers to server
      // 4. Server deserializes JSON
      // 5. Server calls actor.receive()
      // 6. Response serialized back to JSON
      // 7. WebSocket delivers to client
      // 8. Client deserializes response

      expect(true).toBe(true); // This test just documents the pattern
    });
  });
});
