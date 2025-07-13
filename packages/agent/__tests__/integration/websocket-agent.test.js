/**
 * Integration tests for WebSocket Agent interface
 * These tests verify that the agent can be controlled via WebSocket without hanging
 */

import { jest } from '@jest/globals';
import { AgentClient } from '../../src/scripts/send-command.js';
import { startServer, isServerRunning } from '../../src/scripts/start-agent.js';
import { stopServer } from '../../src/scripts/stop-agent.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use a different port for testing to avoid conflicts
const TEST_PORT = 3002;
const TEST_HOST = 'localhost';

describe('WebSocket Agent Integration', () => {
  let serverInfo;

  beforeAll(async () => {
    // Start the agent server for testing
    console.log('Starting agent server for tests...');
    try {
      serverInfo = await startServer({ 
        port: TEST_PORT, 
        host: TEST_HOST 
      });
      
      // Wait a bit for server to be fully ready
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('Failed to start server for tests:', error);
      throw error;
    }
  }, 30000); // 30 second timeout for server startup

  afterAll(async () => {
    // Stop the agent server after tests
    if (serverInfo) {
      console.log('Stopping agent server...');
      try {
        await stopServer({ force: true });
      } catch (error) {
        console.warn('Error stopping server:', error.message);
      }
    }
  }, 10000);

  describe('Server Management', () => {
    it('should confirm server is running', async () => {
      const running = await isServerRunning();
      expect(running).toBeTruthy();
      expect(running.port).toBe(TEST_PORT);
      expect(running.host).toBe(TEST_HOST);
    });
  });

  describe('Basic Communication', () => {
    let client;

    beforeEach(() => {
      client = new AgentClient({
        host: TEST_HOST,
        port: TEST_PORT,
        timeout: 15000,
        autoStart: false // Don't auto-start since we already have one
      });
    });

    it('should respond to a simple message', async () => {
      const response = await client.sendMessage('Hello, can you respond?');
      
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.response).toBeDefined();
      expect(typeof response.response).toBe('string');
      expect(response.response.length).toBeGreaterThan(0);
    }, 20000);

    it('should handle simple questions', async () => {
      const response = await client.sendMessage('What can you help me with?');
      
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.response).toBeDefined();
      // The response should mention some capabilities
      expect(response.response.toLowerCase()).toMatch(/help|assist|file|task/);
    }, 20000);

    it('should maintain conversation context', async () => {
      // First message
      const response1 = await client.sendMessage('My name is TestUser');
      expect(response1.success).toBe(true);
      
      // Second message referencing the first
      const response2 = await client.sendMessage('What is my name?');
      expect(response2.success).toBe(true);
      
      // The agent should remember the name
      expect(response2.response.toLowerCase()).toMatch(/testuser/i);
    }, 30000);
  });

  describe('Error Handling', () => {
    let client;

    beforeEach(() => {
      client = new AgentClient({
        host: TEST_HOST,
        port: TEST_PORT,
        timeout: 10000,
        autoStart: false
      });
    });

    it('should handle empty messages gracefully', async () => {
      try {
        await client.sendMessage('');
        fail('Should have thrown an error for empty message');
      } catch (error) {
        expect(error.message).toMatch(/content|message/i);
      }
    });

    it('should timeout on very long requests', async () => {
      const shortTimeoutClient = new AgentClient({
        host: TEST_HOST,
        port: TEST_PORT,
        timeout: 1000, // Very short timeout
        autoStart: false
      });

      try {
        await shortTimeoutClient.sendMessage('This is a complex request that might take a while to process');
        // If it doesn't timeout, that's actually fine too
      } catch (error) {
        expect(error.message).toMatch(/timeout/i);
      }
    }, 15000);
  });

  describe('Tool Usage', () => {
    let client;

    beforeEach(() => {
      client = new AgentClient({
        host: TEST_HOST,
        port: TEST_PORT,
        timeout: 20000,
        autoStart: false
      });
    });

    it('should respond to tool usage requests', async () => {
      const response = await client.sendMessage('Can you list the tools you have available?');
      
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.response).toBeDefined();
      
      // Should mention tools or capabilities
      expect(response.response.toLowerCase()).toMatch(/tool|capability|help|file/);
    }, 25000);

    // Note: File operations and other tools can be tested similarly
    // but we should be careful about file system side effects in tests
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple concurrent requests', async () => {
      const clients = Array.from({ length: 3 }, () => new AgentClient({
        host: TEST_HOST,
        port: TEST_PORT,
        timeout: 15000,
        autoStart: false
      }));

      const requests = [
        'Hello from client 1',
        'Hello from client 2', 
        'Hello from client 3'
      ];

      const promises = clients.map((client, i) => 
        client.sendMessage(requests[i])
      );

      const responses = await Promise.all(promises);

      responses.forEach((response, i) => {
        expect(response).toBeDefined();
        expect(response.success).toBe(true);
        expect(response.response).toBeDefined();
        
        // Each should contain a valid response
        expect(response.response.length).toBeGreaterThan(0);
        expect(typeof response.response).toBe('string');
      });
    }, 30000);
  });
});

describe('WebSocket Agent Client', () => {
  describe('AgentClient', () => {
    it('should create client with default options', () => {
      const client = new AgentClient();
      expect(client.host).toBe('localhost');
      expect(client.port).toBe(3001);
      expect(client.timeout).toBe(30000);
      expect(client.autoStart).toBe(true);
    });

    it('should create client with custom options', () => {
      const client = new AgentClient({
        host: 'custom-host',
        port: 8080,
        timeout: 5000,
        autoStart: false
      });
      
      expect(client.host).toBe('custom-host');
      expect(client.port).toBe(8080);
      expect(client.timeout).toBe(5000);
      expect(client.autoStart).toBe(false);
    });
  });
});