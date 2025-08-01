/**
 * Tests for Actor class
 */

import { Actor, ActorSystem } from '../src/index.js';

describe('Actor', () => {
  test('should create an actor with a name', () => {
    const actor = new Actor('test-actor');
    expect(actor.name).toBe('test-actor');
    expect(actor.state).toEqual({});
  });

  test('should send and receive messages', async () => {
    const actor = new Actor('test-actor');
    const message = { type: 'test', data: 'hello' };
    
    const result = await actor.send(message);
    
    expect(result).toEqual({
      status: 'received',
      actor: 'test-actor',
      message
    });
  });
});

describe('ActorSystem', () => {
  test('should create and manage actors', () => {
    const system = new ActorSystem();
    const actor = system.createActor('test-actor');
    
    expect(actor).toBeInstanceOf(Actor);
    expect(actor.name).toBe('test-actor');
    expect(system.getActor('test-actor')).toBe(actor);
  });

  test('should broadcast messages to all actors', async () => {
    const system = new ActorSystem();
    system.createActor('actor1');
    system.createActor('actor2');
    
    const message = { type: 'broadcast', data: 'hello all' };
    const results = await system.broadcast(message);
    
    expect(results).toHaveLength(2);
    expect(results[0].actor).toBe('actor1');
    expect(results[1].actor).toBe('actor2');
    expect(results[0].message).toEqual(message);
    expect(results[1].message).toEqual(message);
  });
});