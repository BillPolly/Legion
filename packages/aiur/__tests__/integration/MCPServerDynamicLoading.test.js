/**
 * Integration tests for MCP Server with Dynamic Module Loading
 * 
 * Tests the complete flow of loading Legion modules into a running MCP server
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.join(__dirname, '../../src/index.js');

// Helper to send MCP request and get response
async function sendMCPRequest(proc, request) {
  return new Promise((resolve, reject) => {
    let response = '';
    let errorOutput = '';
    
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, 5000);
    
    proc.stdout.on('data', (data) => {
      response += data.toString();
      try {
        // Try to parse complete JSON response
        const lines = response.split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.id === request.id) {
              clearTimeout(timeout);
              resolve(parsed);
              return;
            }
          } catch (e) {
            // Not complete JSON yet, continue collecting
          }
        }
      } catch (e) {
        // Continue collecting data
      }
    });
    
    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    // Send request
    proc.stdin.write(JSON.stringify(request) + '\n');
  });
}

describe('MCP Server Dynamic Module Loading Integration', () => {
  let serverProcess;
  
  beforeEach(async () => {
    // Start the MCP server
    serverProcess = spawn('node', [SERVER_PATH], {
      cwd: path.join(__dirname, '../../../..'), // Project root
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    // Wait for server to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
  });
  
  afterEach(async () => {
    if (serverProcess) {
      serverProcess.kill();
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  });
  
  describe('Tool Discovery', () => {
    test('should list all tools including dynamically loaded FileModule', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1
      };
      
      const response = await sendMCPRequest(serverProcess, request);
      
      expect(response.result).toBeDefined();
      expect(response.result.tools).toBeDefined();
      expect(Array.isArray(response.result.tools)).toBe(true);
      
      const toolNames = response.result.tools.map(t => t.name);
      
      // Base tools
      expect(toolNames).toContain('context_add');
      expect(toolNames).toContain('context_get');
      expect(toolNames).toContain('context_list');
      
      // Planning tools
      expect(toolNames).toContain('plan_create');
      expect(toolNames).toContain('plan_execute');
      
      // Dynamically loaded file tools
      expect(toolNames).toContain('file_read');
      expect(toolNames).toContain('file_write');
      expect(toolNames).toContain('directory_create');
      expect(toolNames).toContain('directory_list');
    });
    
    test('should have correct schema for file_write tool', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 2
      };
      
      const response = await sendMCPRequest(serverProcess, request);
      const fileWriteTool = response.result.tools.find(t => t.name === 'file_write');
      
      expect(fileWriteTool).toBeDefined();
      expect(fileWriteTool.description).toBe('Create a new file and write text content to it');
      expect(fileWriteTool.inputSchema).toBeDefined();
      expect(fileWriteTool.inputSchema.type).toBe('object');
      expect(fileWriteTool.inputSchema.properties.filepath).toBeDefined();
      expect(fileWriteTool.inputSchema.properties.content).toBeDefined();
      expect(fileWriteTool.inputSchema.required).toContain('filepath');
      expect(fileWriteTool.inputSchema.required).toContain('content');
    });
  });
  
  describe('Tool Execution', () => {
    test('should execute file_write through MCP', async () => {
      const testFile = path.join(__dirname, 'test-output.txt');
      
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'file_write',
          arguments: {
            filepath: testFile,
            content: 'Hello from MCP test!'
          }
        },
        id: 3
      };
      
      const response = await sendMCPRequest(serverProcess, request);
      
      expect(response.result).toBeDefined();
      expect(response.result.content).toBeDefined();
      expect(response.result.content[0].type).toBe('text');
      
      const result = JSON.parse(response.result.content[0].text);
      expect(result.success).toBe(true);
      expect(result.filepath).toBe(testFile);
      expect(result.bytesWritten).toBe(20);
      
      // Cleanup
      const fs = await import('fs/promises');
      await fs.unlink(testFile).catch(() => {});
    });
    
    test('should handle missing tool gracefully', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'nonexistent_tool',
          arguments: {}
        },
        id: 4
      };
      
      const response = await sendMCPRequest(serverProcess, request);
      
      expect(response.result).toBeDefined();
      expect(response.result.isError).toBe(true);
      expect(response.result.content[0].text).toContain('Unknown tool: nonexistent_tool');
    });
  });
  
  describe('Plan Creation with File Operations', () => {
    test('should create and execute plan with file operations', async () => {
      const testDir = path.join(__dirname, 'test-plan-output');
      const testFile = path.join(testDir, 'hello.html');
      
      // Create plan
      const createPlanRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'plan_create',
          arguments: {
            title: 'Build Hello World Web Page',
            description: 'Create a simple HTML page',
            steps: [
              {
                id: 'create_dir',
                action: 'directory_create',
                parameters: {
                  dirpath: testDir
                }
              },
              {
                id: 'write_html',
                action: 'file_write',
                dependsOn: ['create_dir'],
                parameters: {
                  filepath: testFile,
                  content: '<!DOCTYPE html>\n<html>\n<head>\n<title>Hello World</title>\n</head>\n<body>\n<h1>Hello World</h1>\n</body>\n</html>'
                }
              }
            ],
            saveAs: 'hello_world_plan'
          }
        },
        id: 5
      };
      
      const createResponse = await sendMCPRequest(serverProcess, createPlanRequest);
      const createResult = JSON.parse(createResponse.result.content[0].text);
      
      expect(createResult.success).toBe(true);
      expect(createResult.plan).toBeDefined();
      expect(createResult.savedToContext).toBeDefined();
      
      // Execute plan
      const executePlanRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'plan_execute',
          arguments: {
            planHandle: '@hello_world_plan'
          }
        },
        id: 6
      };
      
      const executeResponse = await sendMCPRequest(serverProcess, executePlanRequest);
      const executeResult = JSON.parse(executeResponse.result.content[0].text);
      
      expect(executeResult.success).toBe(true);
      expect(executeResult.executionId).toBeDefined();
      expect(executeResult.results).toBeDefined();
      expect(executeResult.results.create_dir.success).toBe(true);
      expect(executeResult.results.write_html.success).toBe(true);
      
      // Verify file was created
      const fs = await import('fs/promises');
      const fileExists = await fs.access(testFile).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
      
      // Cleanup
      await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    });
  });
  
  describe('Context Integration', () => {
    test('should save file content to context and reference it', async () => {
      // Save content to context
      const saveContentRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'context_add',
          arguments: {
            name: 'html_template',
            data: '<html><body><h1>From Context</h1></body></html>',
            description: 'HTML template for testing'
          }
        },
        id: 7
      };
      
      await sendMCPRequest(serverProcess, saveContentRequest);
      
      // Create plan that references context
      const planRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'plan_create',
          arguments: {
            title: 'Write from Context',
            steps: [
              {
                id: 'write_from_context',
                action: 'file_write',
                parameters: {
                  filepath: path.join(__dirname, 'from-context.html'),
                  content: '@html_template'
                }
              }
            ]
          }
        },
        id: 8
      };
      
      const planResponse = await sendMCPRequest(serverProcess, planRequest);
      const planResult = JSON.parse(planResponse.result.content[0].text);
      
      expect(planResult.success).toBe(true);
      // The plan should show the reference, actual resolution happens during execution
      expect(planResult.plan.steps[0].parameters.content).toBe('@html_template');
      
      // Cleanup
      const fs = await import('fs/promises');
      await fs.unlink(path.join(__dirname, 'from-context.html')).catch(() => {});
    });
  });
});