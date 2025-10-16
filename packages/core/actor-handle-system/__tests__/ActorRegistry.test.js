/**
 * Unit tests for ActorRegistry
 * Tests backend actor registration and spawning
 */

import { ActorRegistry } from '../src/ActorRegistry.js';
import { Actor } from '@legion/actors';

// Test actor class for class-based registration
class TestActor extends Actor {
  constructor(config = {}) {
    super();
    this.config = config;
    this.callCount = 0;
  }

  async receive(messageType, data) {
    this.callCount++;
    if (messageType === 'get-count') {
      return this.callCount;
    }
    if (messageType === 'get-config') {
      return this.config;
    }
    return 'ok';
  }
}

describe('ActorRegistry - Class-based registration', () => {
  let registry;

  beforeEach(() => {
    registry = new ActorRegistry();
  });

  test('should register class-based actor', () => {
    registry.register('test-actor', TestActor);

    const types = registry.listTypes();
    expect(types).toContain('test-actor');
    expect(types).toHaveLength(1);
  });

  test('should spawn instance from registered class', () => {
    registry.register('test-actor', TestActor);

    const instance = registry.spawn('test-actor');

    expect(instance).toBeInstanceOf(TestActor);
    expect(instance).toBeInstanceOf(Actor);
  });

  test('should pass config to class constructor when spawning', () => {
    registry.register('test-actor', TestActor);

    const instance = registry.spawn('test-actor', { foo: 'bar', count: 42 });

    expect(instance.config).toEqual({ foo: 'bar', count: 42 });
  });

  test('should get spawned instance by actorId', async () => {
    registry.register('test-actor', TestActor);
    const spawned = registry.spawn('test-actor');

    const instance = registry.get('test-actor');

    expect(instance).toBe(spawned);

    // Verify it's the same instance
    await instance.receive('test');
    await instance.receive('test');
    const count = await instance.receive('get-count');
    expect(count).toBe(3); // 3 calls total (test, test, get-count)
  });

  test('should list registered types', () => {
    registry.register('actor1', TestActor);
    registry.register('actor2', TestActor);
    registry.register('actor3', TestActor);

    const types = registry.listTypes();

    expect(types).toHaveLength(3);
    expect(types).toContain('actor1');
    expect(types).toContain('actor2');
    expect(types).toContain('actor3');
  });

  test('should list spawned instances', () => {
    registry.register('actor1', TestActor);
    registry.register('actor2', TestActor);
    registry.register('actor3', TestActor);

    registry.spawn('actor1');
    registry.spawn('actor3');

    const instances = registry.listInstances();

    expect(instances).toHaveLength(2);
    expect(instances).toContain('actor1');
    expect(instances).toContain('actor3');
    expect(instances).not.toContain('actor2'); // Not spawned yet
  });
});

describe('ActorRegistry - Declarative registration', () => {
  let registry;

  beforeEach(() => {
    registry = new ActorRegistry();
  });

  test('should register declarative actor with protocol', () => {
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

    registry.register('counter', { protocol });

    const types = registry.listTypes();
    expect(types).toContain('counter');
  });

  test('should spawn DeclarativeActor instance from protocol', async () => {
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

    registry.register('counter', { protocol });
    const instance = registry.spawn('counter');

    expect(instance).toBeDefined();
    expect(instance.protocol).toBe(protocol);

    // Test that it works as a DeclarativeActor
    const result = await instance.receive('increment');
    expect(result).toBe(1);
  });

  test('should get spawned declarative actor instance', async () => {
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
          },
          'get-count': {
            returns: 'state.count'
          }
        }
      }
    };

    registry.register('counter', { protocol });
    registry.spawn('counter');

    const instance = registry.get('counter');

    await instance.receive('increment');
    await instance.receive('increment');
    const count = await instance.receive('get-count');

    expect(count).toBe(2);
  });

  test('should verify protocol is correctly passed to DeclarativeActor', () => {
    const protocol = {
      name: 'TestActor',
      state: {
        schema: {
          value: { type: 'string', default: 'test' }
        }
      },
      messages: {
        receives: {
          'test': {
            returns: 'state.value'
          }
        }
      }
    };

    registry.register('test', { protocol });
    const instance = registry.spawn('test');

    expect(instance.getProtocol()).toBe(protocol);
    expect(instance.state.value).toBe('test');
  });
});

describe('ActorRegistry - Edge cases', () => {
  let registry;

  beforeEach(() => {
    registry = new ActorRegistry();
  });

  test('should throw error for invalid definition', () => {
    expect(() => {
      registry.register('invalid', { foo: 'bar' }); // Not a class, no protocol
    }).toThrow('Invalid actor definition');
  });

  test('should throw error when spawning unregistered actor', () => {
    expect(() => {
      registry.spawn('not-registered');
    }).toThrow('Actor not registered: not-registered');
  });

  test('should return undefined for non-existent instance', () => {
    const instance = registry.get('does-not-exist');
    expect(instance).toBeUndefined();
  });

  test('should return empty array when no types registered', () => {
    const types = registry.listTypes();
    expect(types).toEqual([]);
  });

  test('should return empty array when no instances spawned', () => {
    registry.register('test', TestActor);
    const instances = registry.listInstances();
    expect(instances).toEqual([]);
  });

  test('should destroy instance', () => {
    registry.register('test', TestActor);
    registry.spawn('test');

    expect(registry.get('test')).toBeDefined();

    registry.destroy('test');

    expect(registry.get('test')).toBeUndefined();
    expect(registry.listInstances()).toEqual([]);
  });

  test('should allow re-spawning after destroy', () => {
    registry.register('test', TestActor);
    const first = registry.spawn('test');
    registry.destroy('test');
    const second = registry.spawn('test');

    expect(first).not.toBe(second);
    expect(registry.get('test')).toBe(second);
  });
});
