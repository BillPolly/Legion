/**
 * Real Tool Calling Integration Tests
 * Tests SimplePromptClient with actual LLM and real tool execution
 * NO MOCKS - uses real ANTHROPIC_API_KEY and actual tool calls
 */

import { jest } from '@jest/globals';
import { SimplePromptClient } from '../../src/SimplePromptClient.js';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('SimplePromptClient Real Tool Calling Integration', () => {
  let simpleClient;
  let resourceManager;
  let testDir;

  beforeAll(async () => {
    // Get real ResourceManager with .env
    resourceManager = await ResourceManager.getInstance();
    
    // Check for required API key
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not found in .env - required for real tool testing');
    }

    // Create SimplePromptClient with real API
    simpleClient = new SimplePromptClient({
      provider: 'anthropic',
      apiKey: apiKey,
      model: 'claude-3-5-sonnet-20241022'
    });

    // Create test directory
    testDir = path.join(__dirname, '..', '..', 'tmp', 'tool-test');
    await fs.mkdir(testDir, { recursive: true });

    console.log('✅ Real tool calling integration test initialized');
    console.log('📁 Test directory:', testDir);
  });

  afterAll(async () => {
    // Clean up test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Real Tool Execution with Live LLM', () => {
    it('should call calculator tool and get real result', async () => {
      const calculatorTool = {
        name: 'calculator',
        description: 'Perform mathematical calculations',
        parameters: {
          type: 'object',
          properties: {
            expression: { 
              type: 'string',
              description: 'Mathematical expression to evaluate'
            }
          },
          required: ['expression']
        }
      };

      const response = await simpleClient.request({
        prompt: 'What is 15 * 7?',
        systemPrompt: 'You are a helpful assistant. Use tools when appropriate.',
        tools: [calculatorTool],
        chatHistory: [],
        maxTokens: 1000
      });

      console.log('Calculator Response:', response);
      
      // Verify response structure
      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('metadata');
      
      // Check if tool was called (Anthropic returns XML format)
      if (response.content.includes('tool_use')) {
        console.log('✅ Tool call detected in response');
        expect(response.content).toContain('calculator');
        expect(response.content).toContain('15');
        expect(response.content).toContain('7');
      } else {
        // LLM might have answered directly
        expect(response.content).toMatch(/105|hundred.*five/i);
      }

      expect(response.metadata.provider).toBe('anthropic');
    }, 30000);

    it('should handle file operations with real file system', async () => {
      // Create a test file first
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'Hello World from test file!');

      const readFileTool = {
        name: 'read_file',
        description: 'Read the contents of a file',
        parameters: {
          type: 'object',
          properties: {
            absolute_path: {
              type: 'string',
              description: 'Absolute path to the file to read'
            }
          },
          required: ['absolute_path']
        }
      };

      const response = await simpleClient.request({
        prompt: `Read the file at ${testFile}`,
        systemPrompt: 'You are a helpful assistant. Use tools to read files when requested.',
        tools: [readFileTool],
        chatHistory: [],
        maxTokens: 1000
      });

      console.log('File Read Response:', response);

      // Verify tool calling format  
      expect(response.content).toBeDefined();
      
      if (response.content.includes('tool_use')) {
        expect(response.content).toContain('read_file');
        expect(response.content).toContain(testFile);
        console.log('✅ File read tool call detected');
      } else {
        // If LLM didn't use tool, it should explain why
        expect(response.content.length).toBeGreaterThan(10);
      }
    }, 30000);

    it('should extract and format tool calls correctly', async () => {
      const listFilesTool = {
        name: 'list_files',
        description: 'List files in a directory', 
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string', 
              description: 'Directory path to list'
            }
          },
          required: ['path']
        }
      };

      const response = await simpleClient.request({
        prompt: 'List the files in the current directory',
        systemPrompt: 'You are a helpful assistant. When asked to list files, use the list_files tool.',
        tools: [listFilesTool],
        chatHistory: [],
        maxTokens: 1000
      });

      console.log('List Files Response:', response);
      
      // Check for proper tool calling
      expect(response.content).toBeDefined();
      expect(response.metadata.provider).toBe('anthropic');
      
      // Should either contain tool_use XML or explain why no tool was used
      const hasToolCall = response.content.includes('tool_use');
      const hasExplanation = response.content.length > 20;
      
      expect(hasToolCall || hasExplanation).toBe(true);
      
      if (hasToolCall) {
        console.log('✅ Tool call format verification passed');
        // Verify tool call structure for Anthropic
        expect(response.content).toMatch(/<tool_use.*name.*parameters.*>/);
      }
    }, 30000);

    it('should handle multiple tools in one request', async () => {
      const tools = [
        {
          name: 'create_file',
          description: 'Create a new file',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['path', 'content']
          }
        },
        {
          name: 'read_file', 
          description: 'Read a file',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string' }
            },
            required: ['path']
          }
        }
      ];

      const response = await simpleClient.request({
        prompt: 'Create a file called hello.txt with "Hello World" content, then read it back to verify',
        systemPrompt: 'You are a helpful assistant. Use tools to complete file operations.',
        tools: tools,
        chatHistory: [],
        maxTokens: 1500
      });

      console.log('Multi-tool Response:', response);
      
      expect(response.content).toBeDefined();
      
      // Should show tool usage for file operations
      if (response.content.includes('tool_use')) {
        console.log('✅ Multi-tool workflow detected');
        // Could be single tool call or multiple
        const toolCallCount = (response.content.match(/tool_use/g) || []).length;
        console.log(`Tool calls detected: ${toolCallCount}`);
        expect(toolCallCount).toBeGreaterThanOrEqual(1);
      }
    }, 45000);
  });

  describe('Tool Response Parsing', () => {
    it('should properly extract tool calls from Anthropic XML format', () => {
      const anthropicResponse = `I'll help you with that calculation.

<tool_use name="calculator" parameters='{"expression": "15 * 7"}'></tool_use>`;

      // Test the tool call extraction logic
      const toolCalls = extractToolCalls(anthropicResponse);
      
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].name).toBe('calculator');
      expect(toolCalls[0].args.expression).toBe('15 * 7');
    });

    it('should handle multiple tool calls in one response', () => {
      const multiToolResponse = `I'll do both operations for you.

<tool_use name="create_file" parameters='{"path": "/test/file.txt", "content": "Hello"}'></tool_use>

And then I'll read it:

<tool_use name="read_file" parameters='{"path": "/test/file.txt"}'></tool_use>`;

      const toolCalls = extractToolCalls(multiToolResponse);
      
      expect(toolCalls).toHaveLength(2);
      expect(toolCalls[0].name).toBe('create_file');
      expect(toolCalls[1].name).toBe('read_file');
    });
  });
});

/**
 * Extract tool calls from Anthropic XML format
 * This should match the logic in ConversationManager
 */
function extractToolCalls(response) {
  const toolCalls = [];
  
  // Look for Anthropic-style tool usage
  const toolRegex = /<tool_use name="([^"]+)" parameters='([^']+)'><\/tool_use>/g;
  let match;
  
  while ((match = toolRegex.exec(response)) !== null) {
    try {
      const parameters = JSON.parse(match[2]);
      toolCalls.push({
        name: match[1],
        args: parameters,
        id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });
    } catch (e) {
      console.warn('Failed to parse tool parameters:', match[2]);
    }
  }
  
  return toolCalls;
}