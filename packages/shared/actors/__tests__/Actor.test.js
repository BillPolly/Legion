/**
 * Tests for Actor class and ActorSpace
 */

import { Actor, ActorSpace, makeActor } from '../src/index.js';

describe('Actor', () => {
  test('should have isActor property', () => {
    const actor = new Actor();
    expect(actor.isActor).toBe(true);
  });

  test('should have receive method', () => {
    const actor = new Actor();
    expect(typeof actor.receive).toBe('function');
  });

  test('should dispatch to methods via receive', () => {
    class TestActor {
      constructor() {
        this.isActor = true;
        this.messages = [];
      }

      testMethod(data) {
        this.messages.push(data);
        return 'success';
      }
    }

    const actor = new TestActor();
    // Use the monkey-patched Object.prototype.receive
    const result = actor.receive('testMethod', { value: 42 });

    expect(result).toBe('success');
    expect(actor.messages).toContainEqual({ value: 42 });
  });
});

describe('makeActor', () => {
  test('should create an actor from a function', () => {
    const fn = (messageType, data) => {
      return `Received ${messageType}`;
    };

    const actor = makeActor(fn);

    expect(actor.isActor).toBe(true);
    expect(typeof actor.receive).toBe('function');
    expect(actor.receive('test')).toBe('Received test');
  });

  test('should bind state to actor function', () => {
    const state = { count: 0 };
    const fn = function(messageType) {
      this.count++;
      return this.count;
    };

    const actor = makeActor(fn, state);

    expect(actor.receive('increment')).toBe(1);
    expect(actor.receive('increment')).toBe(2);
    expect(state.count).toBe(2);
  });
});

describe('ActorSpace', () => {
  let actorSpace;

  beforeEach(() => {
    actorSpace = new ActorSpace('test-space');
  });

  afterEach(async () => {
    await actorSpace.destroy();
  });

  test('should create actor space with ID', () => {
    expect(actorSpace.spaceId).toBe('test-space');
  });

  test('should spawn actors', () => {
    const actor = {
      isActor: true,
      receive() {}
    };

    const { id, actor: spawnedActor } = actorSpace.spawn(actor, 'test-actor');

    expect(id).toBe('test-actor');
    expect(spawnedActor).toBe(actor);
    expect(actorSpace.guidToObject.get('test-actor')).toBe(actor);
  });

  test('should auto-generate IDs for spawned actors', () => {
    const actor = { isActor: true, receive() {} };

    const { id } = actorSpace.spawn(actor);

    expect(id).toMatch(/test-space-\d+/);
  });

  test('should register actors', () => {
    const actor = { isActor: true, receive() {} };

    actorSpace.register(actor, 'registered-actor');

    expect(actorSpace.guidToObject.get('registered-actor')).toBe(actor);
    expect(actorSpace.objectToGuid.get(actor)).toBe('registered-actor');
  });
});