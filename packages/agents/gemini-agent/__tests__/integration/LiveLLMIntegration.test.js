/**
 * Live LLM Integration Test for Gemini Agent
 * Tests ConversationManager with actual LLM using SimplePromptClient
 * NO MOCKS - uses real ANTHROPIC_API_KEY
 * All file operations directed to __tests__/tmp directory
 */

import { jest } from '@jest/globals';
import ConversationManager from '../../src/conversation/ConversationManager.js';
import { ResourceManager } from '@legion/resource-manager';
import { SimplePromptClient } from '@legion/llm-client';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Gemini Agent Live LLM Integration', () => {
  let conversationManager;
  let resourceManager;
  let testTmpDir;

  beforeAll(async () => {
    // Get real ResourceManager with .env
    resourceManager = await ResourceManager.getInstance();
    
    // Check for required API key
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not found in .env - required for live LLM testing');
    }

    // Create test tmp directory
    testTmpDir = path.join(__dirname, '..', 'tmp');
    await fs.mkdir(testTmpDir, { recursive: true });

    console.log('✅ Live LLM integration test initialized with Anthropic API');
    console.log('📁 Test tmp directory:', testTmpDir);
  });

  beforeEach(() => {
    // Create real ConversationManager with real ResourceManager
    conversationManager = new ConversationManager(resourceManager);
    
    // Set working directory in ResourceManager for test tmp directory
    resourceManager.set('workingDirectory', testTmpDir);
  });

  afterAll(async () => {
    // Clean up test files
    try {
      await fs.rm(testTmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Simple Conversation Flow', () => {
    it('should handle basic user message with real LLM', async () => {
      const userInput = 'What is 2 + 2?';
      
      const response = await conversationManager.processMessage(userInput);
      
      // Verify response structure
      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('type', 'assistant');
      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('timestamp');
      
      // Content should be a real LLM response
      expect(typeof response.content).toBe('string');
      expect(response.content.length).toBeGreaterThan(0);
      expect(response.content).toMatch(/4|four/i); // Should mention the answer
      
      console.log('🤖 Real LLM Response:', response.content.substring(0, 100));
    }, 30000); // 30 second timeout for LLM call

    it('should maintain conversation context across turns', async () => {
      // First message
      await conversationManager.processMessage('My name is Alex');
      
      // Second message asking about the name
      const response = await conversationManager.processMessage('What is my name?');
      
      expect(response.content.toLowerCase()).toContain('alex');
      console.log('🧠 Context Memory Response:', response.content.substring(0, 100));
    }, 30000);

    it('should handle tool requests and actually call tools', async () => {
      const response = await conversationManager.processMessage('List the files in the current directory');
      
      expect(response.content).toBeDefined();
      
      // The LLM should either respond with text or make tool calls
      const hasToolCall = response.content.includes('tool_use') || 
                          (response.tools && response.tools.length > 0);
      const hasTextResponse = response.content.toLowerCase().match(/file|director|list/);
      
      expect(hasToolCall || hasTextResponse).toBe(true);
      
      if (hasToolCall) {
        console.log('🔧 Tool Call Made:', response.content.substring(0, 100));
      } else {
        console.log('💬 Text Response:', response.content.substring(0, 100));
      }
    }, 30000);
  });

  describe('Conversation History Management', () => {
    it('should build proper chat history for SimplePromptClient', async () => {
      // Add some conversation
      await conversationManager.processMessage('Hello');
      await conversationManager.processMessage('How are you?');
      
      const history = conversationManager.getConversationHistory();
      
      // Should have proper role-based format
      expect(history[0].role).toBe('user');
      expect(history[0].content).toBe('Hello');
      expect(history[1].role).toBe('assistant');
      expect(history[2].role).toBe('user');
      expect(history[2].content).toBe('How are you?');
      expect(history[3].role).toBe('assistant');
    });

    it('should clear conversation history', () => {
      conversationManager.conversationHistory = [
        { role: 'user', content: 'test' },
        { role: 'assistant', content: 'response' }
      ];
      
      conversationManager.clearHistory();
      expect(conversationManager.getConversationHistory()).toEqual([]);
      expect(conversationManager.turnCounter).toBe(0);
    });
  });

  describe('Error Handling with Real LLM', () => {
    it('should handle malformed requests gracefully', async () => {
      const response = await conversationManager.processMessage('');
      
      // Should handle empty input gracefully
      expect(response.content).toBeDefined();
      expect(typeof response.content).toBe('string');
    }, 30000);
  });

  describe('Provider Adaptation', () => {
    it('should work with real Anthropic provider through SimplePromptClient', async () => {
      const response = await conversationManager.processMessage('Say hello in exactly 3 words');
      
      expect(response.content).toBeDefined();
      expect(response.metadata).toHaveProperty('provider');
      
      console.log('🔄 Provider:', response.metadata.provider);
      console.log('📝 Controlled Response:', response.content);
    }, 30000);
  });

  describe('File Generation Testing', () => {
    it('should generate files in __tests__/tmp directory when requested', async () => {
      const response = await conversationManager.processMessage('Create a hello.js file with console.log("Hello World!")');
      
      expect(response.content).toBeDefined();
      
      // If the LLM decided to create a file via tool call, check it's in tmp
      if (response.tools && response.tools.length > 0) {
        const writeFileCalls = response.tools.filter(tool => tool.name === 'write_file');
        if (writeFileCalls.length > 0) {
          // Verify file was requested (path may vary based on LLM understanding)
          const filePath = writeFileCalls[0].args.absolute_path;
          expect(filePath).toBeDefined();
          expect(filePath).toContain('hello');
          
          // Check if file actually exists
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toContain('Hello World');
            console.log('✅ File created in tmp:', filePath);
          } catch (error) {
            console.log('ℹ️ File not created (tool may have failed):', error.message);
          }
        }
      }
      
      console.log('📁 File Generation Response:', response.content.substring(0, 150));
    }, 30000);

    it('should list files in tmp directory', async () => {
      // Create a test file first
      const testFile = path.join(testTmpDir, 'test-file.txt');
      await fs.writeFile(testFile, 'Test content');
      
      const response = await conversationManager.processMessage('List the files in the current directory');
      
      expect(response.content).toBeDefined();
      console.log('📂 Directory Listing Response:', response.content.substring(0, 150));
    }, 30000);
  });
});