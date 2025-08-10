/**
 * @jest-environment node
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('MCP Server End-to-End', () => {
  let mcpProcess;
  let serverPath;
  
  beforeAll(() => {
    serverPath = path.join(__dirname, '../../mcp-server.js');
  });
  
  afterEach(async () => {
    if (mcpProcess && !mcpProcess.killed) {
      mcpProcess.kill('SIGTERM');
      
      // Wait for process to exit
      await new Promise((resolve) => {
        mcpProcess.once('exit', resolve);
        setTimeout(resolve, 2000); // Fallback timeout
      });
    }
  });
  
  test('should complete basic MCP protocol handshake', async () => {
    mcpProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_OPTIONS: '--experimental-vm-modules' }
    });
    
    let serverReady = false;
    let responses = [];
    
    // Wait for server to be ready
    await new Promise((resolve) => {
      mcpProcess.stderr.on('data', (data) => {
        const text = data.toString();
        if (text.includes('MCP Server ready for connections')) {
          serverReady = true;
          resolve();
        }
      });
      
      setTimeout(resolve, 5000); // Fallback timeout
    });
    
    expect(serverReady).toBe(true);
    
    // Collect responses
    mcpProcess.stdout.on('data', (data) => {
      const text = data.toString().trim();
      if (text) {
        try {
          const response = JSON.parse(text);
          responses.push(response);
        } catch (err) {
          // Ignore non-JSON output
        }
      }
    });
    
    // Send initialize message
    const initMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }
    };
    
    mcpProcess.stdin.write(JSON.stringify(initMessage) + '\n');
    
    // Wait for initialize response
    await new Promise((resolve) => {
      const checkResponse = () => {
        const initResponse = responses.find(r => r.id === 1);
        if (initResponse) {
          resolve();
        } else {
          setTimeout(checkResponse, 100);
        }
      };
      checkResponse();
      setTimeout(resolve, 3000); // Timeout
    });
    
    const initResponse = responses.find(r => r.id === 1);
    expect(initResponse).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: {
          name: 'fullstack-monitor',
          version: '1.0.0'
        }
      }
    });
    
    // Send tools/list message
    const listMessage = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    };
    
    mcpProcess.stdin.write(JSON.stringify(listMessage) + '\n');
    
    // Wait for tools list response
    await new Promise((resolve) => {
      const checkResponse = () => {
        const listResponse = responses.find(r => r.id === 2);
        if (listResponse) {
          resolve();
        } else {
          setTimeout(checkResponse, 100);
        }
      };
      checkResponse();
      setTimeout(resolve, 3000); // Timeout
    });
    
    const listResponse = responses.find(r => r.id === 2);
    expect(listResponse).toMatchObject({
      jsonrpc: '2.0',
      id: 2,
      result: {
        tools: expect.any(Array)
      }
    });
    
    expect(listResponse.result.tools.length).toBeGreaterThan(0);
    expect(listResponse.result.tools.some(t => t.name === 'start_fullstack_monitoring')).toBe(true);
    
    // Send a tool call
    const toolCall = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'list_sessions',
        arguments: {}
      }
    };
    
    mcpProcess.stdin.write(JSON.stringify(toolCall) + '\n');
    
    // Wait for tool call response
    await new Promise((resolve) => {
      const checkResponse = () => {
        const callResponse = responses.find(r => r.id === 3);
        if (callResponse) {
          resolve();
        } else {
          setTimeout(checkResponse, 100);
        }
      };
      checkResponse();
      setTimeout(resolve, 3000); // Timeout
    });
    
    const callResponse = responses.find(r => r.id === 3);
    expect(callResponse).toMatchObject({
      jsonrpc: '2.0',
      id: 3,
      result: {
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('list_sessions completed successfully')
          })
        ])
      }
    });
  }, 30000);
  
  test('should handle server shutdown gracefully', async () => {
    mcpProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_OPTIONS: '--experimental-vm-modules' }
    });
    
    let shutdownMessage = '';
    mcpProcess.stderr.on('data', (data) => {
      shutdownMessage += data.toString();
    });
    
    // Wait for server to start
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });
    
    // Send SIGTERM
    mcpProcess.kill('SIGTERM');
    
    // Wait for exit
    const exitCode = await new Promise((resolve) => {
      mcpProcess.once('exit', (code) => {
        resolve(code);
      });
      setTimeout(() => resolve('timeout'), 5000);
    });
    
    expect(exitCode).toBe(0);
    expect(shutdownMessage).toContain('Shutting down MCP server');
  }, 10000);
});