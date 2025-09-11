/**
 * Integration tests for complete conversation management
 * Tests conversation flow with real components
 * NO MOCKS - uses real LLM client with Anthropic API
 */

import { ConversationManager } from '../../src/conversation/ConversationManager.js';
import { ResourceManager } from '@legion/resource-manager';

describe('Conversation Management Integration', () => {
  let conversationManager;
  let resourceManager;

  beforeAll(async () => {
    // Get real ResourceManager singleton (NO MOCKS)
    resourceManager = await ResourceManager.getInstance();
    
    // Create mock prompt manager for testing
    const mockPromptManager = {
      buildSystemPrompt: async () => 'You are a helpful assistant.'
    };
    
    conversationManager = new ConversationManager(resourceManager);
  });

  beforeEach(() => {
    // Clear conversation history between tests
    if (conversationManager) {
      conversationManager.clearHistory();
    }
  });

  test('should process complete conversation workflow with real LLM', async () => {
    // Test complete conversation cycle with real Anthropic LLM
    const userInput = 'Hello, respond with exactly "Hello! I am ready to help."';
    
    const response = await conversationManager.processMessage(userInput);
    
    expect(response.type).toBe('assistant');
    expect(typeof response.content).toBe('string');
    expect(response.content.length).toBeGreaterThan(0);
    expect(response.id).toBeDefined();
    expect(response.timestamp).toBeDefined();
    
    console.log('Real LLM Response:', response.content);
    
    // Check conversation history was updated
    const history = conversationManager.getConversationHistory();
    expect(history.length).toBe(2); // User turn + assistant turn
    expect(history[0].role).toBe('user');
    expect(history[1].role).toBe('assistant');
  }, 60000); // Real LLM call needs longer timeout

  test('should handle multiple conversation turns', async () => {
    const messages = [
      'Hello agent',
      'Can you read file.js for me?',
      'List the current directory'
    ];
    
    for (const message of messages) {
      await conversationManager.processMessage(message);
    }
    
    const history = conversationManager.getConversationHistory();
    expect(history.length).toBe(6); // 3 user + 3 assistant turns
    
    // Check turn ordering
    expect(history[0].role).toBe('user');
    expect(history[1].role).toBe('assistant');
    expect(history[2].role).toBe('user');
    expect(history[3].role).toBe('assistant');
  }, 90000); // Long timeout for multiple LLM calls

  test('should build conversation context correctly', async () => {
    // Add some conversation history
    await conversationManager.processMessage('First message');
    await conversationManager.processMessage('Second message');
    
    const context = conversationManager.buildConversationContext();
    
    expect(context).toContain('Recent Conversation');
    expect(context).toContain('USER: First message');
    expect(context).toContain('USER: Second message');
    expect(context).toContain('ASSISTANT:');
  }, 60000); // Timeout for LLM calls

  test('should handle context management', () => {
    const initialContext = conversationManager.getCurrentContext();
    
    expect(initialContext.workingDirectory).toBe(process.cwd());
    expect(Array.isArray(initialContext.recentFiles)).toBe(true);
    
    // Test updating working directory
    conversationManager.updateWorkingDirectory('/new/path');
    const updatedContext = conversationManager.getCurrentContext();
    expect(updatedContext.workingDirectory).toBe('/new/path');
    
    // Test adding recent files
    conversationManager.addRecentFile('/path/to/file.js');
    const contextWithFile = conversationManager.getCurrentContext();
    expect(contextWithFile.recentFiles).toContain('/path/to/file.js');
  });

  test('should clear conversation history', async () => {
    // Add some messages
    await conversationManager.processMessage('Test message 1');
    await conversationManager.processMessage('Test message 2');
    
    expect(conversationManager.getConversationHistory().length).toBe(4);
    
    // Clear history
    conversationManager.clearHistory();
    
    expect(conversationManager.getConversationHistory().length).toBe(0);
  }, 60000); // Timeout for LLM calls

  test('should handle file operation response patterns', async () => {
    // Test file reading response
    const readResponse = await conversationManager.processMessage('read file.js');
    expect(readResponse.content).toContain('read');
    
    // Test directory listing response
    const listResponse = await conversationManager.processMessage('list files in src/');
    expect(listResponse.content).toContain('files');
  }, 60000); // Timeout for LLM calls

  test('should validate input and fail fast', async () => {
    // Test Legion pattern: fail fast with proper errors
    await expect(conversationManager.processMessage('')).rejects.toThrow('User input must be a non-empty string');
    await expect(conversationManager.processMessage(null)).rejects.toThrow('User input must be a non-empty string');
    await expect(conversationManager.processMessage(123)).rejects.toThrow('User input must be a non-empty string');
  });
});