import { ConversationStateManager } from '../../src/services/ConversationStateManager.js';

describe('ConversationStateManager', () => {
  let stateManager;
  const testConversationId = 'test-conversation';

  beforeEach(() => {
    stateManager = new ConversationStateManager();
  });

  describe('Conversation Management', () => {
    test('should create new conversation', () => {
      stateManager.createConversation(testConversationId, { userId: 'user123' });
      
      const history = stateManager.getConversationHistory(testConversationId);
      expect(history).toEqual([]);
    });

    test('should throw error for invalid conversation ID', () => {
      expect(() => {
        stateManager.createConversation('', {});
      }).toThrow('Invalid conversation ID');

      expect(() => {
        stateManager.createConversation(null, {});
      }).toThrow('Invalid conversation ID');
    });

    test('should throw error for duplicate conversation', () => {
      stateManager.createConversation(testConversationId);
      
      expect(() => {
        stateManager.createConversation(testConversationId);
      }).toThrow(`Conversation ${testConversationId} already exists`);
    });
  });

  describe('Message Management', () => {
    beforeEach(() => {
      stateManager.createConversation(testConversationId);
    });

    test('should add message to conversation', () => {
      const testMessage = { 
        role: 'user', 
        content: 'Hello world',
        type: 'text'
      };
      
      stateManager.addMessage(testConversationId, testMessage);
      
      const history = stateManager.getConversationHistory(testConversationId);
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        role: 'user',
        content: 'Hello world',
        type: 'text'
      });
      expect(history[0]).toHaveProperty('timestamp');
      expect(history[0]).toHaveProperty('id');
    });

    test('should throw error for non-existent conversation', () => {
      expect(() => {
        stateManager.addMessage('non-existent', { role: 'user', content: 'test' });
      }).toThrow('Conversation non-existent not found');
    });

    test('should throw error for invalid message', () => {
      expect(() => {
        stateManager.addMessage(testConversationId, null);
      }).toThrow('Invalid message format');

      expect(() => {
        stateManager.addMessage(testConversationId, 'not an object');
      }).toThrow('Invalid message format');
    });
  });

  describe('History Retrieval', () => {
    beforeEach(() => {
      stateManager.createConversation(testConversationId);
      
      // Add multiple messages
      stateManager.addMessage(testConversationId, { role: 'user', content: 'Message 1' });
      stateManager.addMessage(testConversationId, { role: 'assistant', content: 'Response 1' });
      stateManager.addMessage(testConversationId, { role: 'user', content: 'Message 2' });
    });

    test('should return empty array for non-existent conversation', () => {
      const history = stateManager.getConversationHistory('non-existent');
      expect(history).toEqual([]);
    });

    test('should return all messages when no options provided', () => {
      const history = stateManager.getConversationHistory(testConversationId);
      expect(history).toHaveLength(3);
      expect(history[0].content).toBe('Message 1');
      expect(history[1].content).toBe('Response 1');
      expect(history[2].content).toBe('Message 2');
    });

    test('should limit messages when limit option provided', () => {
      const history = stateManager.getConversationHistory(testConversationId, { limit: 2 });
      expect(history).toHaveLength(2);
      expect(history[0].content).toBe('Response 1'); // Last 2 messages
      expect(history[1].content).toBe('Message 2');
    });

    test('should filter messages by date when since option provided', async () => {
      const cutoffDate = new Date();
      
      // Wait a bit then add another message after cutoff
      await new Promise(resolve => setTimeout(resolve, 10));
      stateManager.addMessage(testConversationId, { role: 'user', content: 'Recent message' });
      
      const history = stateManager.getConversationHistory(testConversationId, { since: cutoffDate });
      expect(history).toHaveLength(1);
      expect(history[0].content).toBe('Recent message');
    });
  });

  describe('Conversation Deletion', () => {
    test('should delete existing conversation', () => {
      stateManager.createConversation(testConversationId);
      stateManager.addMessage(testConversationId, { role: 'user', content: 'test' });
      
      const deleted = stateManager.deleteConversation(testConversationId);
      expect(deleted).toBe(true);
      
      const history = stateManager.getConversationHistory(testConversationId);
      expect(history).toEqual([]);
    });

    test('should return false for non-existent conversation', () => {
      const deleted = stateManager.deleteConversation('non-existent');
      expect(deleted).toBe(false);
    });
  });
});