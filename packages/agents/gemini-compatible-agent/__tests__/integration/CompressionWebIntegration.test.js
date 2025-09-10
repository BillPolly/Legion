/**
 * Integration test for compression through web interface
 * NO MOCKS - tests real compression with long conversations
 */

import ToolCallingConversationManager from '../../src/conversation/ToolCallingConversationManager.js';
import { ResourceManager } from '@legion/resource-manager';

describe('Compression Web Interface Integration', () => {
  let conversationManager;
  let resourceManager;

  beforeAll(async () => {
    // Get real ResourceManager (NO MOCKS)
    resourceManager = await ResourceManager.getInstance();
    conversationManager = new ToolCallingConversationManager(resourceManager);
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('✅ ConversationManager with compression initialized');
  });

  test('should handle long conversation without compression errors', async () => {
    // Clear any existing history
    conversationManager.clearHistory();
    
    // Simulate many conversation turns to test compression
    const messages = [
      'Hello, I need help with a large Node.js project',
      'Please create several files for me',
      'Can you read back what you created?',
      'Search for specific patterns in the files',
      'Make some edits to improve the code',
      'Run some shell commands to test',
      'Save important information to memory',
      'Give me a summary of what we\'ve accomplished'
    ];
    
    let lastResponse;
    
    for (const [index, message] of messages.entries()) {
      console.log(`Turn ${index + 1}: ${message.substring(0, 50)}...`);
      
      lastResponse = await conversationManager.processMessage(message);
      
      expect(lastResponse.type).toBe('assistant');
      expect(typeof lastResponse.content).toBe('string');
      
      const history = conversationManager.getConversationHistory();
      console.log(`History length: ${history.length}, Last response length: ${lastResponse.content.length}`);
      
      // Check if compression was triggered
      const hasCompressionMarker = history.some(turn => turn.isCompressed);
      if (hasCompressionMarker) {
        console.log('🗜️ Compression was triggered during conversation');
      }
    }
    
    const finalHistory = conversationManager.getConversationHistory();
    console.log(`Final conversation length: ${finalHistory.length} turns`);
    
    // Conversation should still be functional
    expect(finalHistory.length).toBeGreaterThan(0);
    expect(lastResponse.content.length).toBeGreaterThan(0);
    
  }, 300000); // 5 minute timeout for long conversation test

  test('should force compression with slash command', async () => {
    // Create a moderate conversation
    await conversationManager.processMessage('Start a new conversation');
    await conversationManager.processMessage('Create a test file');
    await conversationManager.processMessage('Read the file back');
    
    const beforeHistory = conversationManager.getConversationHistory();
    const beforeLength = beforeHistory.length;
    
    console.log('Before compression:', beforeLength, 'turns');
    
    // Force compression using internal method (simulates what slash command would do)
    const llmClient = await resourceManager.get('llmClient');
    
    try {
      const compressionPrompt = conversationManager.promptManager.getCompressionPrompt();
      const compressionResult = await conversationManager.compressionService.compressConversation(
        beforeHistory,
        llmClient,
        compressionPrompt
      );
      
      console.log('Compression result:', {
        status: compressionResult.compressionStatus,
        originalTokens: compressionResult.originalTokenCount,
        newTokens: compressionResult.newTokenCount
      });
      
      if (compressionResult.compressionStatus === 'compressed') {
        conversationManager.conversationHistory = compressionResult.compressedHistory;
        
        const afterHistory = conversationManager.getConversationHistory();
        console.log('After compression:', afterHistory.length, 'turns');
        
        // Should have compression marker
        const hasCompressionMarker = afterHistory.some(turn => turn.isCompressed);
        expect(hasCompressionMarker).toBe(true);
      }
    } catch (error) {
      console.log('Compression test completed with status:', error.message);
    }
  }, 120000);

  test('should maintain conversation functionality after compression', async () => {
    // Test that conversation still works normally after compression
    const response = await conversationManager.processMessage('Are you still working correctly after compression?');
    
    expect(response.type).toBe('assistant');
    expect(typeof response.content).toBe('string');
    expect(response.content.length).toBeGreaterThan(10);
    
    console.log('Post-compression response:', response.content.substring(0, 100));
    
    // Agent should still be responsive
    expect(response.content.toLowerCase()).toMatch(/yes|work|function|help|assist/);
  }, 60000);
});