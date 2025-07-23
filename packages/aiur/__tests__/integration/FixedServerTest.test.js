/**
 * Test for the fixed MCP server implementation
 * Verifies that dynamically loaded tools appear in the tool list
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXED_SERVER_PATH = path.join(__dirname, '../../src/index-fixed.js');
const TEST_FILE = path.join(__dirname, 'test-fixed-server.txt');

// Helper to wait for server output
async function waitForServerReady(proc, timeout = 5000) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => {
      reject(new Error('Server startup timeout'));
    }, timeout);
    
    proc.stderr.on('data', (data) => {
      output += data.toString();
      if (output.includes('Total tools available:')) {
        clearTimeout(timer);
        resolve(output);
      }
    });
  });
}

// Helper to send MCP request
async function sendRequest(proc, request) {
  return new Promise((resolve, reject) => {
    let response = '';
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, 3000);
    
    proc.stdout.on('data', (data) => {
      response += data.toString();
      try {
        const lines = response.split('\n').filter(line => line.trim());
        for (const line of lines) {
          const parsed = JSON.parse(line);
          if (parsed.id === request.id) {
            clearTimeout(timeout);
            resolve(parsed);
            return;
          }
        }
      } catch (e) {
        // Continue collecting
      }
    });
    
    proc.stdin.write(JSON.stringify(request) + '\n');
  });
}

describe('Fixed MCP Server with Dynamic Loading', () => {
  let serverProcess;
  
  beforeEach(async () => {
    // Clean up test file if it exists
    await fs.unlink(TEST_FILE).catch(() => {});
  });
  
  afterEach(async () => {
    if (serverProcess) {
      serverProcess.kill();
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    // Clean up test file
    await fs.unlink(TEST_FILE).catch(() => {});
  });
  
  test('should load FileModule tools and list them', async () => {
    // Start the fixed server
    serverProcess = spawn('node', [FIXED_SERVER_PATH], {
      cwd: path.join(__dirname, '../../../..'), // Project root
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    // Wait for server to load modules
    const startupOutput = await waitForServerReady(serverProcess);
    
    // Check startup logs
    expect(startupOutput).toContain('Loaded module: file');
    expect(startupOutput).toContain('Added tools:');
    expect(startupOutput).toContain('file_read');
    expect(startupOutput).toContain('file_write');
    
    // List tools
    const listRequest = {
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 1
    };
    
    const response = await sendRequest(serverProcess, listRequest);
    
    expect(response.result).toBeDefined();
    expect(response.result.tools).toBeDefined();
    
    const toolNames = response.result.tools.map(t => t.name);
    
    // Check base tools
    expect(toolNames).toContain('context_add');
    expect(toolNames).toContain('plan_create');
    
    // Check dynamically loaded file tools
    expect(toolNames).toContain('file_read');
    expect(toolNames).toContain('file_write');
    expect(toolNames).toContain('directory_create');
    expect(toolNames).toContain('directory_list');
    
    // Verify tool count matches startup log
    const totalMatch = startupOutput.match(/Total tools available: (\d+)/);
    if (totalMatch) {
      const expectedCount = parseInt(totalMatch[1], 10);
      expect(response.result.tools.length).toBe(expectedCount);
    }
  });
  
  test('should execute file_write tool successfully', async () => {
    serverProcess = spawn('node', [FIXED_SERVER_PATH], {
      cwd: path.join(__dirname, '../../../..'),
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    await waitForServerReady(serverProcess);
    
    // Call file_write tool
    const writeRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'file_write',
        arguments: {
          filepath: TEST_FILE,
          content: 'Hello from fixed server test!'
        }
      },
      id: 2
    };
    
    const response = await sendRequest(serverProcess, writeRequest);
    
    expect(response.result).toBeDefined();
    expect(response.result.content[0].text).toBeDefined();
    
    const result = JSON.parse(response.result.content[0].text);
    expect(result.success).toBe(true);
    expect(result.filepath).toBe(TEST_FILE);
    expect(result.bytesWritten).toBe(29);
    
    // Verify file was created
    const content = await fs.readFile(TEST_FILE, 'utf8');
    expect(content).toBe('Hello from fixed server test!');
  });
  
  test('should have correct schema for dynamically loaded tools', async () => {
    serverProcess = spawn('node', [FIXED_SERVER_PATH], {
      cwd: path.join(__dirname, '../../../..'),
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    await waitForServerReady(serverProcess);
    
    const listRequest = {
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 3
    };
    
    const response = await sendRequest(serverProcess, listRequest);
    const fileWriteTool = response.result.tools.find(t => t.name === 'file_write');
    
    expect(fileWriteTool).toBeDefined();
    expect(fileWriteTool.description).toBe('Create a new file and write text content to it');
    expect(fileWriteTool.inputSchema).toEqual({
      type: 'object',
      properties: {
        filepath: {
          type: 'string',
          description: 'The path where the file should be created (can be absolute or relative)'
        },
        content: {
          type: 'string',
          description: 'The text content to write to the file'
        }
      },
      required: ['filepath', 'content']
    });
  });
});