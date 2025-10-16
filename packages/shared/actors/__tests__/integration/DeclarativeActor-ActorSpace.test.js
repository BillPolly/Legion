/**
 * Integration tests for DeclarativeActor with ActorSpace
 * Tests that DeclarativeActor works correctly when spawned in ActorSpace
 */

import { DeclarativeActor } from '../../src/DeclarativeActor.js';
import { ActorSpace } from '../../src/ActorSpace.js';

describe('DeclarativeActor in ActorSpace', () => {
  let actorSpace;

  beforeEach(() => {
    actorSpace = new ActorSpace('test-space');
  });

  afterEach(async () => {
    if (actorSpace) {
      await actorSpace.destroy();
    }
  });

  test('should spawn DeclarativeActor in ActorSpace', () => {
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
    const { id, actor: spawnedActor } = actorSpace.spawn(() => actor, 'counter-actor');

    expect(id).toBe('counter-actor');
    expect(spawnedActor).toBe(actor);
    expect(actorSpace.guidToObject.get('counter-actor')).toBe(actor);
  });

  test('should send messages to DeclarativeActor via ActorSpace', async () => {
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

    const actor = new DeclarativeActor(protocol);
    actorSpace.spawn(() => actor, 'counter-actor');

    // Send messages directly to actor
    const result1 = await actor.receive('increment');
    expect(result1).toBe(1);

    const result2 = await actor.receive('increment');
    expect(result2).toBe(2);

    const result3 = await actor.receive('get-count');
    expect(result3).toBe(2);
  });

  test('should handle multiple DeclarativeActors in same ActorSpace', async () => {
    const counterProtocol = {
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

    const greetProtocol = {
      name: 'GreeterActor',
      state: {
        schema: {
          name: { type: 'string', default: 'World' }
        }
      },
      messages: {
        receives: {
          'set-name': {
            action: 'state.name = data.name',
            returns: 'state.name'
          },
          'greet': {
            returns: '"Hello, " + state.name + "!"'
          }
        }
      }
    };

    const counter = new DeclarativeActor(counterProtocol);
    const greeter = new DeclarativeActor(greetProtocol);

    actorSpace.spawn(() => counter, 'counter');
    actorSpace.spawn(() => greeter, 'greeter');

    const count = await counter.receive('increment');
    expect(count).toBe(1);

    const name = await greeter.receive('set-name', { name: 'Alice' });
    expect(name).toBe('Alice');

    const greeting = await greeter.receive('greet');
    expect(greeting).toBe('Hello, Alice!');

    // Verify actors are independent
    expect(counter.state.count).toBe(1);
    expect(greeter.state.name).toBe('Alice');
  });

  test('should handle DeclarativeActor with complex state', async () => {
    const protocol = {
      name: 'TodoActor',
      state: {
        schema: {
          todos: { type: 'array', default: [] },
          nextId: { type: 'number', default: 1 }
        }
      },
      messages: {
        receives: {
          'add-todo': {
            action: `
              state.todos.push({ id: state.nextId, text: data.text, done: false });
              state.nextId++;
            `,
            returns: 'state.todos[state.todos.length - 1]'
          },
          'get-todos': {
            returns: 'state.todos'
          },
          'count-todos': {
            returns: 'state.todos.length'
          }
        }
      }
    };

    const actor = new DeclarativeActor(protocol);
    actorSpace.spawn(() => actor, 'todo-actor');

    const todo1 = await actor.receive('add-todo', { text: 'Learn actors' });
    expect(todo1).toEqual({ id: 1, text: 'Learn actors', done: false });

    const todo2 = await actor.receive('add-todo', { text: 'Build app' });
    expect(todo2).toEqual({ id: 2, text: 'Build app', done: false });

    const count = await actor.receive('count-todos');
    expect(count).toBe(2);

    const todos = await actor.receive('get-todos');
    expect(todos).toHaveLength(2);
    expect(todos[0].text).toBe('Learn actors');
    expect(todos[1].text).toBe('Build app');
  });
});
