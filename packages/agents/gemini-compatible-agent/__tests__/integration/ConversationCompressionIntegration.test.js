/**
 * Integration tests for ConversationCompressionService
 * NO MOCKS - tests real compression with real LLM
 */

import ConversationCompressionService, { CompressionStatus } from '../../src/services/ConversationCompressionService.js';
import { ResourceManager } from '@legion/resource-manager';

describe('ConversationCompressionService Integration', () => {
  let compressionService;
  let resourceManager;
  let llmClient;

  beforeAll(async () => {
    // Get real ResourceManager and LLM client (NO MOCKS)
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    
    compressionService = new ConversationCompressionService(resourceManager);
  });

  test('should estimate token counts correctly', () => {
    const shortConversation = [
      { type: 'user', content: 'Hello' },
      { type: 'assistant', content: 'Hi there!', tools: [] }
    ];
    
    const longConversation = [
      { type: 'user', content: 'Please explain how to build a React application from scratch with all the components and state management and routing and testing and deployment strategies.' },
      { type: 'assistant', content: 'I\'ll explain how to build a complete React application. First, you need to set up the project structure...'.repeat(100), tools: [] }
    ];
    
    const shortTokens = compressionService.estimateTokenCount(shortConversation);
    const longTokens = compressionService.estimateTokenCount(longConversation);
    
    expect(shortTokens).toBeLessThan(20);
    expect(longTokens).toBeGreaterThan(1000);
    expect(longTokens).toBeGreaterThan(shortTokens);
    
    console.log('Token estimation: short =', shortTokens, 'long =', longTokens);
  });

  test('should detect when compression is needed', () => {
    // Create conversation that exceeds threshold
    const longConversation = [];
    for (let i = 0; i < 50; i++) {
      longConversation.push({
        type: 'user',
        content: 'This is a long conversation that will exceed token limits. '.repeat(20)
      });
      longConversation.push({
        type: 'assistant', 
        content: 'I understand your long request and here is my detailed response. '.repeat(30),
        tools: []
      });
    }
    
    const needsCompression = compressionService.needsCompression(longConversation);
    const forceCompression = compressionService.needsCompression([], true);
    
    expect(needsCompression).toBe(true);
    expect(forceCompression).toBe(true);
    
    console.log('Long conversation tokens:', compressionService.estimateTokenCount(longConversation));
    console.log('Needs compression:', needsCompression);
  });

  test('should not compress short conversations', () => {
    const shortConversation = [
      { type: 'user', content: 'Hello' },
      { type: 'assistant', content: 'Hi!', tools: [] }
    ];
    
    const needsCompression = compressionService.needsCompression(shortConversation);
    expect(needsCompression).toBe(false);
    
    console.log('Short conversation - no compression needed:', needsCompression);
  });

  test('should build proper compression input', () => {
    const testHistory = [
      { type: 'user', content: 'Create a test file' },
      { 
        type: 'assistant', 
        content: 'I\'ll create that file for you',
        tools: [
          { name: 'write_file', args: { path: '/test.txt' }, result: { success: true } }
        ]
      },
      { type: 'user', content: 'Read it back' },
      { type: 'assistant', content: 'Here\'s the content', tools: [] }
    ];
    
    const compressionPrompt = 'Compress this conversation:';
    const input = compressionService.buildCompressionInput(testHistory, compressionPrompt);
    
    expect(input).toContain('Compress this conversation:');
    expect(input).toContain('USER: Create a test file');
    expect(input).toContain('ASSISTANT: I\'ll create that file');
    expect(input).toContain('TOOL_EXECUTION: write_file');
    expect(input).toContain('USER: Read it back');
    
    console.log('Compression input preview:', input.substring(0, 300));
  });

  test('should perform real compression with LLM', async () => {
    // Create realistic conversation to compress
    const conversationToCompress = [
      { type: 'user', content: 'I need help building a Node.js application' },
      { type: 'assistant', content: 'I can help you build a Node.js application. Let me start by creating the basic structure.', tools: [] },
      { type: 'user', content: 'Add Express server functionality' },
      { type: 'assistant', content: 'I\'ll add Express server functionality to your application.', tools: [] },
      { type: 'user', content: 'Include database integration' }, 
      { type: 'assistant', content: 'I\'ll help integrate a database into your Node.js application.', tools: [] }
    ];
    
    const compressionPrompt = `You are a conversation summarizer. Summarize this conversation into key points:
    
    <state_snapshot>
    <user_goal>The user's main objective</user_goal>
    <key_actions>Important actions taken</key_actions>
    <current_state>Current status of the work</current_state>
    </state_snapshot>`;
    
    const result = await compressionService.compressConversation(
      conversationToCompress,
      llmClient,
      compressionPrompt
    );
    
    expect(result.compressionStatus).toBe(CompressionStatus.COMPRESSED);
    expect(result.compressedHistory).toBeDefined();
    expect(result.compressedHistory.length).toBeLessThan(conversationToCompress.length);
    expect(result.newTokenCount).toBeLessThan(result.originalTokenCount);
    expect(result.compressionRatio).toBeLessThan(1);
    
    // Verify compression summary contains key information
    const compressionSummary = result.compressedHistory.find(turn => turn.isCompressed);
    expect(compressionSummary).toBeDefined();
    expect(compressionSummary.content).toContain('CONVERSATION SUMMARY');
    
    console.log('Compression successful:', {
      originalTokens: result.originalTokenCount,
      newTokens: result.newTokenCount,
      ratio: Math.round(result.compressionRatio * 100) + '%',
      historyLength: result.compressedHistory.length
    });
    
    console.log('Compression summary preview:', compressionSummary.content.substring(0, 200));
  }, 60000); // Long timeout for LLM compression

  test('should handle compression failures gracefully', async () => {
    // Test with empty history (should fail gracefully)
    const emptyHistory = [];
    const badPrompt = 'Invalid prompt that might cause issues';
    
    const result = await compressionService.compressConversation(
      emptyHistory,
      llmClient,
      badPrompt
    );
    
    // Should handle gracefully even if compression fails
    expect(result).toBeDefined();
    expect(result.compressionStatus).toBeDefined();
    
    console.log('Empty history compression result:', result.compressionStatus);
  });

  test('should preserve recent conversation after compression', () => {
    const longHistory = [];
    for (let i = 0; i < 20; i++) {
      longHistory.push({ type: 'user', content: `Message ${i}` });
      longHistory.push({ type: 'assistant', content: `Response ${i}`, tools: [] });
    }
    
    // Calculate where compression should split
    const preserveIndex = Math.floor(longHistory.length * (1 - compressionService.COMPRESSION_PRESERVE_THRESHOLD));
    
    expect(preserveIndex).toBeGreaterThan(0);
    expect(preserveIndex).toBeLessThan(longHistory.length);
    
    const historyToCompress = longHistory.slice(0, preserveIndex);
    const historyToKeep = longHistory.slice(preserveIndex);
    
    expect(historyToCompress.length).toBeGreaterThan(0);
    expect(historyToKeep.length).toBeGreaterThan(0);
    expect(historyToKeep.length).toBeLessThan(historyToCompress.length);
    
    console.log('Compression split:', {
      total: longHistory.length,
      compress: historyToCompress.length, 
      keep: historyToKeep.length,
      ratio: historyToKeep.length / longHistory.length
    });
  });

  test('should reset compression state for testing', () => {
    // Simulate failed compression
    compressionService.hasFailedCompressionAttempt = true;
    
    // Reset should clear failure state
    compressionService.resetCompressionState();
    
    expect(compressionService.hasFailedCompressionAttempt).toBe(false);
    
    console.log('✅ Compression state reset working');
  });
});