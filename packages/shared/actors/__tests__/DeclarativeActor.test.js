/**
 * Unit tests for DeclarativeActor
 * Tests protocol-based actor execution
 */

import { DeclarativeActor } from '../src/DeclarativeActor.js';

describe('DeclarativeActor', () => {
  describe('basic protocol execution', () => {
    test('should create actor with simple protocol', () => {
      const protocol = {
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
            }
          }
        }
      };

      const actor = new DeclarativeActor(protocol);

      expect(actor).toBeDefined();
      expect(actor.protocol).toBe(protocol);
      expect(actor.state).toBeDefined();
      expect(actor.state.count).toBe(0);
    });

    test('should execute increment message and update state', async () => {
      const protocol = {
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
            }
          }
        }
      };

      const actor = new DeclarativeActor(protocol);

      const result = await actor.receive('increment');

      expect(result).toBe(1);
      expect(actor.state.count).toBe(1);
    });

    test('should execute multiple increments', async () => {
      const protocol = {
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
            }
          }
        }
      };

      const actor = new DeclarativeActor(protocol);

      await actor.receive('increment');
      await actor.receive('increment');
      const result = await actor.receive('increment');

      expect(result).toBe(3);
      expect(actor.state.count).toBe(3);
    });

    test('should return state value without action', async () => {
      const protocol = {
        name: 'CounterActor',
        state: {
          schema: {
            count: { type: 'number', default: 5 }
          }
        },
        messages: {
          receives: {
            'get-count': {
              returns: 'state.count'
            }
          }
        }
      };

      const actor = new DeclarativeActor(protocol);

      const result = await actor.receive('get-count');

      expect(result).toBe(5);
    });
  });

  describe('edge cases', () => {
    test('should handle protocol with no state', () => {
      const protocol = {
        name: 'StatelessActor',
        messages: {
          receives: {
            'ping': {
              returns: '"pong"'
            }
          }
        }
      };

      const actor = new DeclarativeActor(protocol);

      expect(actor).toBeDefined();
      expect(actor.state).toEqual({});
    });

    test('should handle protocol with empty schema', () => {
      const protocol = {
        name: 'EmptySchemaActor',
        state: {
          schema: {}
        },
        messages: {
          receives: {
            'test': {
              returns: '"ok"'
            }
          }
        }
      };

      const actor = new DeclarativeActor(protocol);

      expect(actor.state).toEqual({});
    });

    test('should handle message with no action (only returns)', async () => {
      const protocol = {
        name: 'ReadOnlyActor',
        state: {
          schema: {
            value: { type: 'string', default: 'hello' }
          }
        },
        messages: {
          receives: {
            'get-value': {
              returns: 'state.value'
            }
          }
        }
      };

      const actor = new DeclarativeActor(protocol);

      const result = await actor.receive('get-value');

      expect(result).toBe('hello');
      expect(actor.state.value).toBe('hello');
    });

    test('should handle message with no return value (only action)', async () => {
      const protocol = {
        name: 'WriteOnlyActor',
        state: {
          schema: {
            count: { type: 'number', default: 0 }
          }
        },
        messages: {
          receives: {
            'increment': {
              action: 'state.count++'
            }
          }
        }
      };

      const actor = new DeclarativeActor(protocol);

      const result = await actor.receive('increment');

      expect(result).toBeUndefined();
      expect(actor.state.count).toBe(1);
    });

    test('should throw error for unknown message type', async () => {
      const protocol = {
        name: 'SimpleActor',
        state: {
          schema: {
            value: { type: 'string', default: 'test' }
          }
        },
        messages: {
          receives: {
            'known': {
              returns: 'state.value'
            }
          }
        }
      };

      const actor = new DeclarativeActor(protocol);

      await expect(actor.receive('unknown')).rejects.toThrow('Unknown message type: unknown');
    });

    test('should return protocol definition via getProtocol()', () => {
      const protocol = {
        name: 'TestActor',
        state: {
          schema: {
            count: { type: 'number', default: 0 }
          }
        },
        messages: {
          receives: {
            'test': {
              returns: 'state.count'
            }
          }
        }
      };

      const actor = new DeclarativeActor(protocol);

      const returnedProtocol = actor.getProtocol();

      expect(returnedProtocol).toBe(protocol);
      expect(returnedProtocol.name).toBe('TestActor');
    });

    test('should handle messages with data parameter', async () => {
      const protocol = {
        name: 'DataActor',
        state: {
          schema: {
            value: { type: 'string', default: '' }
          }
        },
        messages: {
          receives: {
            'set-value': {
              action: 'state.value = data.newValue',
              returns: 'state.value'
            }
          }
        }
      };

      const actor = new DeclarativeActor(protocol);

      const result = await actor.receive('set-value', { newValue: 'hello world' });

      expect(result).toBe('hello world');
      expect(actor.state.value).toBe('hello world');
    });
  });
});
