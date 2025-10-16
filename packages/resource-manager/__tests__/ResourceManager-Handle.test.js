/**
 * Unit tests for ResourceManager as Handle
 * Tests that ResourceManager extends Handle and implements DataSource interface
 */

import { ResourceManager } from '../src/ResourceManager.js';
import { Handle } from '@legion/handle';

describe('ResourceManager - Handle Integration', () => {
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  }, 30000); // 30 second timeout for initialization

  test('should be instance of Handle', () => {
    expect(resourceManager).toBeInstanceOf(Handle);
  });

  test('should have query method inherited from Handle', () => {
    expect(typeof resourceManager.query).toBe('function');
  });

  test('should have subscribe method inherited from Handle', () => {
    expect(typeof resourceManager.subscribe).toBe('function');
  });

  test('should have value method inherited from Handle', () => {
    expect(typeof resourceManager.value).toBe('function');
  });

  test('should have dataSource with required methods', () => {
    // ResourceManager creates internal dataSource in constructor
    // Handle stores it as this.dataSource (not _dataSource)
    expect(resourceManager.dataSource).toBeDefined();
    expect(typeof resourceManager.dataSource.query).toBe('function');
    expect(typeof resourceManager.dataSource.subscribe).toBe('function');
    expect(typeof resourceManager.dataSource.getSchema).toBe('function');
    expect(typeof resourceManager.dataSource.queryBuilder).toBe('function');
  });
});

describe('ResourceManager - actors property', () => {
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  }, 30000); // 30 second timeout for initialization

  test('should have actors property', () => {
    expect(resourceManager.actors).toBeDefined();
  });

  test('actors should be ActorRegistry instance', () => {
    // ActorRegistry has these methods
    expect(typeof resourceManager.actors.register).toBe('function');
    expect(typeof resourceManager.actors.spawn).toBe('function');
    expect(typeof resourceManager.actors.get).toBe('function');
    expect(typeof resourceManager.actors.listTypes).toBe('function');
    expect(typeof resourceManager.actors.listInstances).toBe('function');
    expect(typeof resourceManager.actors.destroy).toBe('function');
  });

  test('should register actor via rm.actors.register()', () => {
    // Simple test actor class
    class TestActor {
      constructor() {
        this.state = { count: 0 };
      }
      async receive(messageType) {
        if (messageType === 'increment') {
          this.state.count++;
          return this.state.count;
        }
        return null;
      }
    }

    // Register should not throw
    expect(() => {
      resourceManager.actors.register('test-actor-rm', TestActor);
    }).not.toThrow();

    // Should appear in listTypes
    const types = resourceManager.actors.listTypes();
    expect(types).toContain('test-actor-rm');
  });

  test('should spawn actor via rm.actors.spawn()', async () => {
    // Spawn the test actor we registered above
    const actor = resourceManager.actors.spawn('test-actor-rm');

    expect(actor).toBeDefined();
    expect(typeof actor.receive).toBe('function');

    // Test the actor works
    const result = await actor.receive('increment');
    expect(result).toBe(1);
  });
});
