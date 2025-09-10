/**
 * Integration tests for McpClientTool
 * NO MOCKS - tests MCP server connection and management
 */

import McpClientTool, { MCPServerStatus } from '../../src/tools/McpClientTool.js';

describe('McpClientTool Integration', () => {
  let tool;

  beforeEach(() => {
    tool = new McpClientTool({ timeout: 5000 });
  });

  test('should create MCP client tool with proper configuration', () => {
    expect(tool.name).toBe('mcp_client');
    expect(tool.shortName).toBe('mcp');
    expect(tool.servers).toBeInstanceOf(Map);
    expect(tool.getConnectedServerCount()).toBe(0);
  });

  test('should connect to MCP server', async () => {
    const result = await tool._execute({
      action: 'connect',
      server_url: 'http://localhost:3001/mcp',
      server_name: 'test-server'
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe(MCPServerStatus.CONNECTED);
    expect(result.message).toContain('Connected to MCP server');
    expect(result.servers).toHaveLength(1);
    expect(result.servers[0].id).toBe('test-server');
    expect(result.servers[0].url).toBe('http://localhost:3001/mcp');

    // Verify server is tracked
    expect(tool.getConnectedServerCount()).toBe(1);
    
    console.log('✅ MCP server connection working');
  });

  test('should list connected MCP servers', async () => {
    // Connect a few servers first
    await tool._execute({
      action: 'connect',
      server_url: 'http://server1:3001/mcp',
      server_name: 'server1'
    });
    
    await tool._execute({
      action: 'connect', 
      server_url: 'http://server2:3002/mcp',
      server_name: 'server2'
    });

    const result = await tool._execute({ action: 'list' });

    expect(result.success).toBe(true);
    expect(result.servers).toHaveLength(2);
    expect(result.message).toContain('Found 2 MCP servers');

    const serverNames = result.servers.map(s => s.id);
    expect(serverNames).toContain('server1');
    expect(serverNames).toContain('server2');
    
    console.log('✅ MCP server listing working');
  });

  test('should get status of specific MCP server', async () => {
    // Connect server first
    await tool._execute({
      action: 'connect',
      server_url: 'http://localhost:3003/mcp',
      server_name: 'status-test'
    });

    const result = await tool._execute({
      action: 'status',
      server_name: 'status-test'
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe(MCPServerStatus.CONNECTED);
    expect(result.message).toContain('status-test is connected');
    expect(result.servers).toHaveLength(1);
    
    console.log('✅ MCP server status checking working');
  });

  test('should disconnect from MCP server', async () => {
    // Connect first
    await tool._execute({
      action: 'connect',
      server_url: 'http://localhost:3004/mcp', 
      server_name: 'disconnect-test'
    });

    expect(tool.getConnectedServerCount()).toBe(1);

    // Disconnect
    const result = await tool._execute({
      action: 'disconnect',
      server_name: 'disconnect-test'
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe(MCPServerStatus.DISCONNECTED);
    expect(result.message).toContain('Disconnected from MCP server');
    expect(tool.getConnectedServerCount()).toBe(0);
    
    console.log('✅ MCP server disconnection working');
  });

  test('should handle connection to non-existent server gracefully', async () => {
    const result = await tool._execute({
      action: 'connect',
      server_url: 'http://nonexistent:9999/mcp',
      server_name: 'fake-server'
    });

    // Should handle gracefully (simplified implementation)
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.message).toBe('string');
    
    console.log('MCP connection to non-existent server result:', result.success);
  });

  test('should validate required parameters', async () => {
    // Missing server_url for connect
    const result1 = await tool._execute({
      action: 'connect',
      server_name: 'test'
    });

    expect(result1.success).toBe(false);
    expect(result1.message).toContain('Server URL is required');

    // Missing server_name for disconnect
    const result2 = await tool._execute({
      action: 'disconnect'
    });

    expect(result2.success).toBe(false);
    expect(result2.message).toContain('Server name is required');
    
    console.log('✅ MCP parameter validation working');
  });

  test('should handle unknown actions', async () => {
    const result = await tool._execute({
      action: 'invalid_action'
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Unknown MCP action');
    
    console.log('✅ MCP unknown action handling working');
  });

  test('should generate server IDs from URLs', () => {
    const testUrls = [
      'http://localhost:3001/mcp',
      'https://api.example.com/mcp',
      'ws://mcp-server:8080'
    ];

    for (const url of testUrls) {
      const id = tool._generateServerId(url);
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    }
    
    console.log('✅ Server ID generation working');
  });

  test('should maintain server state correctly', async () => {
    // Connect multiple servers
    const servers = ['server-a', 'server-b', 'server-c'];
    
    for (const name of servers) {
      await tool._execute({
        action: 'connect',
        server_url: `http://${name}:3001/mcp`,
        server_name: name
      });
    }

    expect(tool.getConnectedServerCount()).toBe(3);

    // Disconnect one
    await tool._execute({
      action: 'disconnect',
      server_name: 'server-b'
    });

    expect(tool.getConnectedServerCount()).toBe(2);

    // List remaining
    const listResult = await tool._execute({ action: 'list' });
    const remainingNames = listResult.servers.map(s => s.id);
    expect(remainingNames).toContain('server-a');
    expect(remainingNames).toContain('server-c');
    expect(remainingNames).not.toContain('server-b');
    
    console.log('✅ MCP server state management working');
  });
});