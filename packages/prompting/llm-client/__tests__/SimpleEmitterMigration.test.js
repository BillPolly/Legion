import { jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { LLMClient } from '../src/LLMClient.js';

describe('LLMClient SimpleEmitter Migration', () => {
  let client;
  let originalConsoleLog;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Suppress console.log during tests
    originalConsoleLog = console.log;
    console.log = jest.fn();
    
    client = new LLMClient({
      provider: 'mock',
      maxRetries: 1,
      baseDelay: 10
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  describe('SimpleEmitter integration', () => {
    it('should have SimpleEmitter composition instead of extending EventEmitter', () => {
      // Should not be an EventEmitter instance
      expect(client instanceof EventEmitter).toBe(false);
      
      // Should have SimpleEmitter composition
      expect(client.eventEmitter).toBeDefined();
      expect(typeof client.subscribe).toBe('function');
    });

    it('should emit interaction events through SimpleEmitter', async () => {
      const events = [];
      
      const unsubscribe = client.subscribe((eventName, eventData) => {
        if (eventName === 'interaction') {
          events.push(eventData);
        }
      });
      
      await client.complete('Test prompt', 100);
      
      unsubscribe();
      
      // Should have received request and response events
      expect(events.length).toBeGreaterThanOrEqual(2);
      
      const requestEvent = events.find(e => e.type === 'request');
      const responseEvent = events.find(e => e.type === 'response');
      
      expect(requestEvent).toBeDefined();
      expect(requestEvent.prompt).toBe('Test prompt');
      expect(requestEvent.model).toBeDefined();
      
      expect(responseEvent).toBeDefined();
      expect(responseEvent.response).toBeDefined();
      expect(responseEvent.prompt).toBe('Test prompt');
    });

    it('should handle multiple subscribers correctly', async () => {
      const events1 = [];
      const events2 = [];
      
      const unsubscribe1 = client.subscribe((eventName, eventData) => {
        if (eventName === 'interaction') {
          events1.push(eventData);
        }
      });
      
      const unsubscribe2 = client.subscribe((eventName, eventData) => {
        if (eventName === 'interaction') {
          events2.push(eventData);
        }
      });
      
      await client.complete('Test prompt', 100);
      
      unsubscribe1();
      unsubscribe2();
      
      // Both subscribers should have received the same events
      expect(events1.length).toBe(events2.length);
      expect(events1.length).toBeGreaterThanOrEqual(2);
      
      // Events should be identical
      expect(events1[0].type).toBe(events2[0].type);
      expect(events1[0].id).toBe(events2[0].id);
    });

    it('should handle unsubscribe correctly', async () => {
      const events = [];
      
      const unsubscribe = client.subscribe((eventName, eventData) => {
        if (eventName === 'interaction') {
          events.push(eventData);
        }
      });
      
      // First completion should trigger events
      await client.complete('Test 1', 100);
      const eventsAfterFirst = events.length;
      expect(eventsAfterFirst).toBeGreaterThan(0);
      
      // Unsubscribe
      unsubscribe();
      
      // Second completion should not add more events
      await client.complete('Test 2', 100);
      expect(events.length).toBe(eventsAfterFirst);
    });
  });

  describe('backward compatibility', () => {
    it('should maintain same event structure as before', async () => {
      const events = [];
      
      client.subscribe((eventName, eventData) => {
        if (eventName === 'interaction') {
          events.push(eventData);
        }
      });
      
      await client.complete('Test', 100);
      
      const requestEvent = events.find(e => e.type === 'request');
      const responseEvent = events.find(e => e.type === 'response');
      
      // Check request event structure
      expect(requestEvent).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          timestamp: expect.any(String),
          type: 'request',
          prompt: 'Test',
          model: expect.any(String),
          provider: 'mock',
          attempt: 1,
          maxTokens: 100
        })
      );
      
      // Check response event structure
      expect(responseEvent).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          timestamp: expect.any(String),
          type: 'response',
          prompt: 'Test',
          response: expect.any(String),
          model: expect.any(String),
          provider: 'mock',
          attempt: 1
        })
      );
    });
  });
});