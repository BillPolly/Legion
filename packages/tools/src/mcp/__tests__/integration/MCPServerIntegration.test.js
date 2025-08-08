/**
 * MCP Server Integration Tests
 * 
 * Tests the complete MCP server integration with real servers.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { MCPServerProcess } from '../../MCPServerProcess.js';
import { MCPServerManager } from '../../MCPServerManager.js';
import { MCPPackageManager } from '../../MCPPackageManager.js';
import { MCPToolProvider } from '../../integration/MCPToolProvider.js';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';

describe('MCP Server Integration', () => {
  let testDir;
  let serverManager;
  let packageManager;
  let toolProvider;

  beforeAll(async () => {
    // Create test directory
    testDir = join(tmpdir(), `mcp-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    
    // Create test files
    writeFileSync(join(testDir, 'test.txt'), 'Hello MCP World!');
    writeFileSync(join(testDir, 'data.json'), JSON.stringify({ test: true }));

    // Initialize managers
    serverManager = new MCPServerManager();
    packageManager = new MCPPackageManager();
    toolProvider = new MCPToolProvider(serverManager);
  });

  afterAll(async () => {
    // Clean up
    await serverManager.stopAll();
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('Filesystem Server', () => {
    let filesystemServer;

    it('should start filesystem MCP server', async () => {
      filesystemServer = new MCPServerProcess({
        id: 'test-filesystem',
        name: 'Test Filesystem Server',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', testDir],
        transport: 'stdio'
      });

      await filesystemServer.start();
      expect(filesystemServer.status).toBe('running');
      expect(filesystemServer.capabilities).toBeDefined();
    });

    it('should list available tools', async () => {
      const tools = await filesystemServer.listTools();
      expect(tools).toBeInstanceOf(Array);
      expect(tools.length).toBeGreaterThan(0);
      
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('read_file');
      expect(toolNames).toContain('list_directory');
      expect(toolNames).toContain('get_file_info');
    });

    it('should read file using MCP tool', async () => {
      const result = await filesystemServer.callTool('read_file', {
        path: join(testDir, 'test.txt')
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Hello MCP World!');
    });

    it('should list directory contents', async () => {
      const result = await filesystemServer.callTool('list_directory', {
        path: testDir
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      const text = result.content[0].text;
      expect(text).toContain('test.txt');
      expect(text).toContain('data.json');
    });

    it('should provide Legion-compatible tool wrappers', async () => {
      const legionTools = await toolProvider.getToolsForServer('test-filesystem');
      expect(legionTools).toBeInstanceOf(Array);
      expect(legionTools.length).toBeGreaterThan(0);

      // Find the read_file tool
      const readTool = legionTools.find(t => t.name === 'mcp_filesystem_read_file');
      expect(readTool).toBeDefined();
      expect(readTool.description).toBeDefined();
      expect(readTool.inputSchema).toBeDefined();

      // Execute through Legion interface
      const result = await readTool.execute({
        path: join(testDir, 'test.txt')
      });

      expect(result.success).toBe(true);
      expect(result.content).toContain('Hello MCP World!');
    });

    it('should handle tool errors gracefully', async () => {
      const result = await filesystemServer.callTool('read_file', {
        path: '/nonexistent/file.txt'
      });

      // MCP servers typically return error in content
      expect(result).toBeDefined();
      if (result.error) {
        expect(result.error).toBeDefined();
      } else if (result.content) {
        const text = result.content[0].text;
        expect(text.toLowerCase()).toMatch(/error|not found|no such file/);
      }
    });

    afterAll(async () => {
      if (filesystemServer) {
        await filesystemServer.stop();
      }
    });
  });

  describe('Server Manager', () => {
    it('should manage multiple MCP servers', async () => {
      const serverId = await serverManager.startServer({
        id: 'managed-filesystem',
        name: 'Managed Filesystem',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', testDir],
        transport: 'stdio'
      });

      expect(serverId).toBe('managed-filesystem');
      
      const status = serverManager.getServerStatus('managed-filesystem');
      expect(status).toBe('running');

      const tools = await serverManager.listTools('managed-filesystem');
      expect(tools).toBeInstanceOf(Array);
      expect(tools.length).toBeGreaterThan(0);

      await serverManager.stopServer('managed-filesystem');
      const statusAfter = serverManager.getServerStatus('managed-filesystem');
      expect(statusAfter).toBe('stopped');
    });

    it('should handle server health checks', async () => {
      const serverId = await serverManager.startServer({
        id: 'health-check-test',
        name: 'Health Check Test',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', testDir],
        transport: 'stdio'
      });

      const isHealthy = await serverManager.checkHealth('health-check-test');
      expect(isHealthy).toBe(true);

      await serverManager.stopServer('health-check-test');
    });
  });

  describe('Package Manager', () => {
    it('should search for MCP servers', async () => {
      const results = await packageManager.searchServers('filesystem');
      expect(results).toBeDefined();
      expect(results.servers).toBeInstanceOf(Array);
      
      if (results.servers.length > 0) {
        const fsServer = results.servers.find(s => 
          s.name.toLowerCase().includes('filesystem') ||
          s.packageName.includes('filesystem')
        );
        expect(fsServer).toBeDefined();
      }
    });

    it('should provide recommendations based on task', async () => {
      const recommendations = await packageManager.getRecommendations(
        'I need to read and write files'
      );

      expect(recommendations).toBeDefined();
      expect(recommendations.servers).toBeInstanceOf(Array);
      
      // Should recommend filesystem server
      const hasFilesystem = recommendations.servers.some(s =>
        s.name.toLowerCase().includes('file') ||
        s.description.toLowerCase().includes('file')
      );
      expect(hasFilesystem).toBe(true);
    });
  });

  describe('Tool Provider Integration', () => {
    let serverId;

    beforeAll(async () => {
      serverId = await serverManager.startServer({
        id: 'provider-test',
        name: 'Provider Test Server',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', testDir],
        transport: 'stdio'
      });
    });

    it('should provide all tools from server', async () => {
      const tools = await toolProvider.getAllTools();
      expect(tools).toBeInstanceOf(Array);
      
      const providerTools = tools.filter(t => t.name.startsWith('mcp_'));
      expect(providerTools.length).toBeGreaterThan(0);
    });

    it('should execute tools through provider', async () => {
      const tools = await toolProvider.getToolsForServer('provider-test');
      const readTool = tools.find(t => t.name.includes('read_file'));
      
      expect(readTool).toBeDefined();
      
      const result = await readTool.execute({
        path: join(testDir, 'data.json')
      });

      expect(result.success).toBe(true);
      expect(result.content).toContain('"test": true');
    });

    afterAll(async () => {
      await serverManager.stopServer('provider-test');
    });
  });
});