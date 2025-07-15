/**
 * Simple WebSocket event streaming test for debugging
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { Agent } from '../../src/Agent.js';
import { AgentWebSocketServer } from '../../src/websocket-server.js';
import { Module } from '@jsenvoy/module-loader';
import WebSocket from 'ws';

// Simple test module
class TestModule extends Module {
  constructor() {
    super();
    this.name = 'TestModule';
  }
}

describe('WebSocket Event Streaming - Simple Test', () => {
  let agent;
  let server;
  let wsClient;
  const testPort = 3003;

  beforeEach(async () => {
    // Create agent
    agent = new Agent({
      name: 'SimpleTestAgent',
      bio: 'Simple test agent',
      modelConfig: {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        apiKey: 'test-key'
      }
    });

    // Create and start WebSocket server
    server = new AgentWebSocketServer(agent, { port: testPort });
    await server.start();
    
    // Give server time to start
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    // Close client connection
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.close();
    }
    
    // Stop server
    if (server) {
      await server.stop();
    }
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  test('should connect and subscribe to events', async () => {
    // Create WebSocket client
    wsClient = new WebSocket(`ws://localhost:${testPort}`);
    
    // Wait for connection
    await new Promise((resolve, reject) => {
      wsClient.on('open', resolve);
      wsClient.on('error', reject);
    });
    
    expect(wsClient.readyState).toBe(WebSocket.OPEN);
    
    // Subscribe to events
    const subscribePromise = new Promise((resolve) => {
      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.id === 'test-subscribe') {
          resolve(message);
        }
      });
    });
    
    wsClient.send(JSON.stringify({
      id: 'test-subscribe',
      type: 'subscribe-events'
    }));
    
    const response = await subscribePromise;
    
    expect(response).toMatchObject({
      id: 'test-subscribe',
      success: true,
      message: 'Successfully subscribed to events'
    });
  });

  test('should receive events after subscription', async () => {
    // Create WebSocket client
    wsClient = new WebSocket(`ws://localhost:${testPort}`);
    
    // Wait for connection
    await new Promise((resolve, reject) => {
      wsClient.on('open', resolve);
      wsClient.on('error', reject);
    });
    
    // Subscribe to events
    const subscribePromise = new Promise((resolve) => {
      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.id === 'test-subscribe') {
          resolve(message);
        }
      });
    });
    
    wsClient.send(JSON.stringify({
      id: 'test-subscribe',
      type: 'subscribe-events'
    }));
    
    await subscribePromise;
    
    // Now collect events - wait longer to see all events
    const eventPromise = new Promise((resolve) => {
      const events = [];
      
      const messageHandler = (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'event') {
            events.push(message);
          }
        } catch (error) {
          // Ignore parse errors
        }
      };
      
      wsClient.on('message', messageHandler);
      
      // Timeout after 1 second to collect all events
      setTimeout(() => {
        wsClient.removeListener('message', messageHandler);
        resolve(events);
      }, 1000);
    });
    
    // Create and register module
    const module = new TestModule();
    agent.registerModule(module);
    
    // Emit an event
    module.emitInfo('Test event message', { test: true });
    
    // Wait for events
    const events = await eventPromise;
    
    console.log('Received events:', JSON.stringify(events, null, 2));
    
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toMatchObject({
      type: 'event',
      event: {
        module: 'TestModule',
        message: 'Test event message',
        data: { test: true }
      }
    });
  });
});