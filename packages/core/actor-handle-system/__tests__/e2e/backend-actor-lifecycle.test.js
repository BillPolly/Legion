/**
 * E2E Test: Backend Actor Lifecycle
 *
 * Tests the complete backend actor lifecycle:
 * - Get ResourceManager singleton
 * - Register declarative actor
 * - Spawn instance
 * - Send multiple messages
 * - Verify state persists across messages
 *
 * Uses REAL ResourceManager - NO MOCKS
 */

import { ResourceManager } from '@legion/resource-manager';

describe('Backend Actor Lifecycle E2E', () => {
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  }, 30000);

  test('should register and spawn declarative counter actor', async () => {
    // Register declarative actor with counter protocol
    resourceManager.actors.register('counter-e2e', {
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
            'decrement': {
              action: 'state.count--',
              returns: 'state.count'
            },
            'get-count': {
              returns: 'state.count'
            },
            'reset': {
              action: 'state.count = 0',
              returns: 'state.count'
            }
          }
        }
      }
    });

    // Verify actor is registered
    const types = resourceManager.actors.listTypes();
    expect(types).toContain('counter-e2e');

    // Spawn instance
    const counter = resourceManager.actors.spawn('counter-e2e');
    expect(counter).toBeDefined();
    expect(typeof counter.receive).toBe('function');
  });

  test('should send messages and verify state persists', async () => {
    // Get the spawned counter instance
    const counter = resourceManager.actors.get('counter-e2e');
    expect(counter).toBeDefined();

    // Initial state should be 0
    let count = await counter.receive('get-count');
    expect(count).toBe(0);

    // Increment - state should be 1
    count = await counter.receive('increment');
    expect(count).toBe(1);

    // Increment again - state should persist and be 2
    count = await counter.receive('increment');
    expect(count).toBe(2);

    // Increment again - state should be 3
    count = await counter.receive('increment');
    expect(count).toBe(3);

    // Verify state persisted - should still be 3
    count = await counter.receive('get-count');
    expect(count).toBe(3);

    // Decrement - should be 2
    count = await counter.receive('decrement');
    expect(count).toBe(2);

    // Reset - should be 0
    count = await counter.receive('reset');
    expect(count).toBe(0);

    // Verify reset worked
    count = await counter.receive('get-count');
    expect(count).toBe(0);
  });

  test('should support multiple registered actor types with independent state', async () => {
    // Register first todo list actor type
    resourceManager.actors.register('todo-list-e2e-1', {
      protocol: {
        name: 'TodoListActor1',
        state: {
          schema: {
            todos: { type: 'array', default: [] }
          }
        },
        messages: {
          receives: {
            'add-todo': {
              action: 'state.todos.push(data)',
              returns: 'state.todos'
            },
            'get-todos': {
              returns: 'state.todos'
            },
            'clear': {
              action: 'state.todos = []',
              returns: 'state.todos'
            }
          }
        }
      }
    });

    // Register second todo list actor type
    resourceManager.actors.register('todo-list-e2e-2', {
      protocol: {
        name: 'TodoListActor2',
        state: {
          schema: {
            todos: { type: 'array', default: [] }
          }
        },
        messages: {
          receives: {
            'add-todo': {
              action: 'state.todos.push(data)',
              returns: 'state.todos'
            },
            'get-todos': {
              returns: 'state.todos'
            }
          }
        }
      }
    });

    // Spawn independent instances (one per registered type)
    const todoList1 = resourceManager.actors.spawn('todo-list-e2e-1');
    const todoList2 = resourceManager.actors.spawn('todo-list-e2e-2');

    // Add different todos to each instance
    await todoList1.receive('add-todo', 'Buy milk');
    await todoList1.receive('add-todo', 'Walk dog');

    await todoList2.receive('add-todo', 'Write code');
    await todoList2.receive('add-todo', 'Review PR');

    // Verify independent state
    const todos1 = await todoList1.receive('get-todos');
    const todos2 = await todoList2.receive('get-todos');

    expect(todos1).toEqual(['Buy milk', 'Walk dog']);
    expect(todos2).toEqual(['Write code', 'Review PR']);

    // Clean up
    resourceManager.actors.destroy('todo-list-e2e-1');
    resourceManager.actors.destroy('todo-list-e2e-2');
  });

  test('should register and spawn class-based actor', async () => {
    // Define a class-based actor
    class TestClassActor {
      constructor(config = {}) {
        this.config = config;
        this.state = { value: config.initialValue || 0 };
      }

      async receive(messageType, data) {
        switch (messageType) {
          case 'set':
            this.state.value = data;
            return this.state.value;
          case 'get':
            return this.state.value;
          case 'multiply':
            this.state.value *= data;
            return this.state.value;
          default:
            throw new Error(`Unknown message: ${messageType}`);
        }
      }
    }

    // Register class-based actor
    resourceManager.actors.register('class-actor-e2e', TestClassActor);

    // Verify registered
    const types = resourceManager.actors.listTypes();
    expect(types).toContain('class-actor-e2e');

    // Spawn with config
    const actor = resourceManager.actors.spawn('class-actor-e2e', { initialValue: 10 });

    // Test actor functionality
    let value = await actor.receive('get');
    expect(value).toBe(10);

    value = await actor.receive('multiply', 3);
    expect(value).toBe(30);

    value = await actor.receive('set', 100);
    expect(value).toBe(100);

    // Clean up
    resourceManager.actors.destroy('class-actor-e2e');
  });

  test('should list registered types and spawned instances', async () => {
    // Get all registered types
    const types = resourceManager.actors.listTypes();

    // Should include actors we registered
    expect(types).toContain('counter-e2e');
    expect(types).toContain('todo-list-e2e-1');
    expect(types).toContain('todo-list-e2e-2');

    // Get all spawned instances
    const instances = resourceManager.actors.listInstances();

    // Should include the counter instance we spawned
    expect(instances).toContain('counter-e2e');
  });
});
