/**
 * Integration tests for the debug UI server
 */

import { createServer } from '../../src/server/index.js';
import { WebSocket, WebSocketServer } from 'ws';
import request from 'supertest';

describe('Debug UI Server Integration', () => {
  let debugServer;
  let mockMcpServer;
  let debugServerPort;
  let mockMcpPort;
  let config;
  let logger;

  beforeEach(async () => {
    // Create test config and logger
    logger = global.testUtils.createMockLogger();
    
    // Start mock MCP server
    mockMcpPort = await startMockMcpServer();
    
    // Configure debug server
    config = global.testUtils.createTestConfig({
      mcp: { defaultUrl: `ws://localhost:${mockMcpPort}/ws` }
    });
    
    // Start debug server
    debugServer = await createServer(config, logger);
    debugServerPort = global.testUtils.getServerPort(debugServer);
  });

  afterEach(async () => {
    // Close servers
    if (debugServer) {
      await debugServer.close();
    }
    if (mockMcpServer) {
      await new Promise(resolve => mockMcpServer.close(resolve));
    }
  });

  /**
   * Start a mock MCP server
   * @returns {Promise<number>} Port number
   */
  async function startMockMcpServer() {
    return new Promise((resolve) => {
      mockMcpServer = new WebSocketServer({ port: 0 });
      
      mockMcpServer.on('connection', (ws) => {
        // Simple echo server that responds to MCP requests
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            
            if (message.method === 'tools/list') {
              ws.send(JSON.stringify({
                jsonrpc: '2.0',
                id: message.id,
                result: {
                  tools: [
                    { name: 'test_tool', description: 'Test tool' }
                  ]
                }
              }));
            } else if (message.method === 'tools/call') {
              ws.send(JSON.stringify({
                jsonrpc: '2.0',
                id: message.id,
                result: {
                  content: [{ type: 'text', text: 'Tool executed' }]
                }
              }));
            }
          } catch (error) {
            // Ignore parse errors
          }
        });
      });
      
      mockMcpServer.on('listening', () => {
        resolve(mockMcpServer.address().port);
      });
    });
  }

  describe('End-to-End Flow', () => {
    it('should serve static files and handle WebSocket connections', async () => {
      // Test static file serving
      const htmlResponse = await request(debugServer)
        .get('/')
        .expect(200)
        .expect('Content-Type', /html/);
      
      expect(htmlResponse.text).toContain('Aiur Debug UI');
      
      // Test API endpoint
      const configResponse = await request(debugServer)
        .get('/api/config')
        .expect(200)
        .expect('Content-Type', /json/);
      
      expect(configResponse.body.mcp.defaultUrl).toBe(`ws://localhost:${mockMcpPort}/ws`);
    });

    it('should proxy WebSocket messages between client and MCP server', async () => {
      // Connect to debug server
      const client = new WebSocket(`ws://localhost:${debugServerPort}/ws`);
      
      // Wait for welcome message
      const welcomeMessage = await waitForMessage(client, 'welcome');
      expect(welcomeMessage.data.clientId).toBeDefined();
      
      // Connect to MCP server
      client.send(JSON.stringify({
        type: 'connect',
        data: { url: `ws://localhost:${mockMcpPort}/ws` }
      }));
      
      // Wait for connection confirmation
      const connectedMessage = await waitForMessage(client, 'connected');
      expect(connectedMessage.data.url).toBe(`ws://localhost:${mockMcpPort}/ws`);
      
      // Send MCP request
      client.send(JSON.stringify({
        type: 'mcp-request',
        data: {
          jsonrpc: '2.0',
          method: 'tools/list',
          params: {},
          id: 'req_1'
        }
      }));
      
      // Wait for MCP response
      const responseMessage = await waitForMessage(client, 'mcp-response');
      expect(responseMessage.data.result.tools).toHaveLength(1);
      expect(responseMessage.data.result.tools[0].name).toBe('test_tool');
      
      client.close();
    });

    it('should handle multiple concurrent connections', async () => {
      const clients = [];
      const numClients = 3;
      
      // Connect multiple clients
      for (let i = 0; i < numClients; i++) {
        const client = new WebSocket(`ws://localhost:${debugServerPort}/ws`);
        clients.push(client);
        
        await waitForMessage(client, 'welcome');
        
        client.send(JSON.stringify({
          type: 'connect',
          data: {}
        }));
        
        await waitForMessage(client, 'connected');
      }
      
      // Send requests from all clients
      const requestPromises = clients.map((client, index) => {
        client.send(JSON.stringify({
          type: 'mcp-request',
          data: {
            jsonrpc: '2.0',
            method: 'tools/call',
            params: { name: `test_${index}` },
            id: `req_${index}`
          }
        }));
        
        return waitForMessage(client, 'mcp-response');
      });
      
      // Wait for all responses
      const responses = await Promise.all(requestPromises);
      
      // Verify all clients received responses
      responses.forEach((response) => {
        expect(response.data.result.content[0].text).toBe('Tool executed');
      });
      
      // Clean up
      clients.forEach(client => client.close());
    });
  });

  describe('Error Handling', () => {
    it('should handle MCP server unavailability', async () => {
      const client = new WebSocket(`ws://localhost:${debugServerPort}/ws`);
      
      await waitForMessage(client, 'welcome');
      
      // Try to connect to non-existent MCP server
      client.send(JSON.stringify({
        type: 'connect',
        data: { url: 'ws://localhost:99999/ws' }
      }));
      
      // Should receive error message
      const errorMessage = await waitForMessage(client, 'error');
      expect(errorMessage.data.message).toContain('Failed to connect');
      
      client.close();
    });

    it('should handle invalid client messages gracefully', async () => {
      const client = new WebSocket(`ws://localhost:${debugServerPort}/ws`);
      
      await waitForMessage(client, 'welcome');
      
      // Send invalid JSON
      client.send('invalid json');
      
      const errorMessage = await waitForMessage(client, 'error');
      expect(errorMessage.data.message).toContain('Invalid message format');
      
      // Client should still be connected
      client.send(JSON.stringify({ type: 'ping' }));
      const pongMessage = await waitForMessage(client, 'pong');
      expect(pongMessage.type).toBe('pong');
      
      client.close();
    });
  });

  describe('Reconnection Behavior', () => {
    it('should attempt to reconnect when MCP server disconnects', async () => {
      const client = new WebSocket(`ws://localhost:${debugServerPort}/ws`);
      
      await waitForMessage(client, 'welcome');
      
      // Connect to MCP
      client.send(JSON.stringify({
        type: 'connect',
        data: {}
      }));
      
      await waitForMessage(client, 'connected');
      
      // Close MCP server
      await new Promise(resolve => mockMcpServer.close(resolve));
      mockMcpServer = null;
      
      // Should receive disconnected and reconnecting messages
      const disconnectedMessage = await waitForMessage(client, 'disconnected');
      expect(disconnectedMessage.data.url).toContain(`localhost:${mockMcpPort}`);
      
      const reconnectingMessage = await waitForMessage(client, 'reconnecting');
      expect(reconnectingMessage.data.attempt).toBe(1);
      
      client.close();
    });
  });

  /**
   * Wait for a specific message type from WebSocket
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} messageType - Message type to wait for
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>} Message data
   */
  function waitForMessage(ws, messageType, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for message type: ${messageType}`));
      }, timeout);
      
      const messageHandler = (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === messageType) {
            clearTimeout(timer);
            ws.removeListener('message', messageHandler);
            resolve(message);
          }
        } catch (error) {
          // Ignore parse errors
        }
      };
      
      ws.on('message', messageHandler);
    });
  }
});