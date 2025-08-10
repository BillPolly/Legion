/**
 * @jest-environment node
 */

import { MCPClient } from '../../mcp-client.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('MCP Client Integration', () => {
  let client;
  let serverPath;
  
  beforeAll(() => {
    serverPath = path.join(__dirname, '../../mcp-server.js');
  });
  
  beforeEach(() => {
    client = new MCPClient();
  });
  
  afterEach(async () => {
    await client.disconnect();
  });
  
  test('should establish MCP connection and list tools', async () => {
    // Connect to server
    await client.connect('node', [serverPath]);
    
    // Initialize connection
    const initResult = await client.initialize({
      name: 'test-mcp-client',
      version: '1.0.0'
    });
    
    expect(initResult).toMatchObject({
      protocolVersion: '2024-11-05',
      serverInfo: {
        name: 'fullstack-monitor',
        version: '1.0.0'
      }
    });
    
    // Get tools
    const tools = await client.getTools();
    
    expect(tools).toHaveLength(5);
    expect(tools.some(t => t.name === 'start_app')).toBe(true);
    expect(tools.some(t => t.name === 'query_logs')).toBe(true);
    expect(tools.some(t => t.name === 'list_sessions')).toBe(true);
  }, 30000);
  
  test('should execute tools successfully', async () => {
    await client.connect('node', [serverPath]);
    await client.initialize();
    await client.getTools();
    
    // Test list_sessions tool
    const sessionsResult = await client.callTool('list_sessions');
    
    expect(sessionsResult).toMatchObject({
      content: expect.arrayContaining([
        expect.objectContaining({
          type: 'text',
          text: expect.any(String)
        })
      ])
    });
    
    // Test unknown tool error handling
    const unknownResult = await client.callTool('unknown_tool');
    
    expect(unknownResult).toMatchObject({
      content: expect.arrayContaining([
        expect.objectContaining({
          type: 'text',
          text: expect.stringContaining('Unknown tool: unknown_tool')
        })
      ]),
      isError: true
    });
  }, 30000);
  
  test('should handle client utility methods', async () => {
    await client.connect('node', [serverPath]);
    await client.initialize();
    await client.getTools();
    
    // Test getTool method
    const startTool = client.getTool('start_app');
    expect(startTool).toMatchObject({
      name: 'start_app',
      description: expect.any(String),
      inputSchema: expect.any(Object)
    });
    
    // Test findTools method
    const appTools = client.findTools('app');
    expect(appTools.length).toBeGreaterThan(0);
    expect(appTools.every(t => 
      t.name.includes('app') || 
      t.description.toLowerCase().includes('app')
    )).toBe(true);
  }, 30000);
  
  test('should handle server disconnection gracefully', async () => {
    await client.connect('node', [serverPath]);
    await client.initialize();
    
    let serverExited = false;
    client.once('serverExit', (code) => {
      serverExited = true;
      expect(code).toBe(0);
    });
    
    await client.disconnect();
    
    // Give some time for the event to fire
    await new Promise(resolve => setTimeout(resolve, 500));
    
    expect(serverExited).toBe(true);
  }, 30000);
  
  test('should send notifications without expecting response', async () => {
    await client.connect('node', [serverPath]);
    await client.initialize();
    
    // This should not throw or timeout
    client.sendNotification('notifications/initialized');
    
    // Wait a bit to ensure server processed it
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Test that we can still make regular calls after notification
    const tools = await client.getTools();
    expect(tools).toHaveLength(5);
  }, 30000);
});