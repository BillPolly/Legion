/**
 * Unit tests for AgentState class
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { AgentState } from '../../src/state/AgentState.js';

describe('AgentState', () => {
  let state;
  
  describe('Initialization', () => {
    it('should initialize with empty state', () => {
      state = new AgentState();
      
      expect(state).toBeDefined();
      expect(state.conversationHistory).toEqual([]);
      expect(state.contextVariables).toEqual({});
      expect(state.metadata).toBeDefined();
      expect(state.metadata.createdAt).toBeDefined();
      expect(state.metadata.lastUpdated).toBeDefined();
      expect(state.metadata.messageCount).toBe(0);
    });

    it('should initialize with provided configuration', () => {
      const config = {
        maxMessages: 50,
        pruningStrategy: 'sliding-window',
        contextVariables: {
          userName: {
            type: 'string',
            persistent: true
          },
          sessionId: {
            type: 'string',
            persistent: false
          }
        }
      };
      
      state = new AgentState(config);
      
      expect(state.config).toEqual(config);
      expect(state.config.maxMessages).toBe(50);
      expect(state.config.pruningStrategy).toBe('sliding-window');
      expect(state.contextVariables).toEqual({});
    });

    it('should use default configuration when not provided', () => {
      state = new AgentState();
      
      expect(state.config.maxMessages).toBe(100);
      expect(state.config.pruningStrategy).toBe('sliding-window');
      expect(state.config.contextVariables).toEqual({});
    });
  });

  describe('Conversation History Management', () => {
    beforeEach(() => {
      state = new AgentState({ maxMessages: 3 });
    });

    it('should add message to conversation history', () => {
      const message = {
        role: 'user',
        content: 'Hello'
      };
      
      state.addMessage(message);
      
      expect(state.conversationHistory).toHaveLength(1);
      expect(state.conversationHistory[0]).toMatchObject(message);
      expect(state.conversationHistory[0].timestamp).toBeDefined();
      expect(state.conversationHistory[0].id).toBeDefined();
      expect(state.metadata.messageCount).toBe(1);
    });

    it('should add multiple messages', () => {
      state.addMessage({ role: 'user', content: 'Hello' });
      state.addMessage({ role: 'assistant', content: 'Hi there!' });
      state.addMessage({ role: 'user', content: 'How are you?' });
      
      expect(state.conversationHistory).toHaveLength(3);
      expect(state.metadata.messageCount).toBe(3);
      expect(state.conversationHistory[0].role).toBe('user');
      expect(state.conversationHistory[1].role).toBe('assistant');
      expect(state.conversationHistory[2].role).toBe('user');
    });

    it('should prune messages using sliding window strategy', () => {
      // Add 5 messages to a history with max 3
      state.addMessage({ role: 'user', content: 'Message 1' });
      state.addMessage({ role: 'assistant', content: 'Response 1' });
      state.addMessage({ role: 'user', content: 'Message 2' });
      state.addMessage({ role: 'assistant', content: 'Response 2' });
      state.addMessage({ role: 'user', content: 'Message 3' });
      
      expect(state.conversationHistory).toHaveLength(3);
      expect(state.conversationHistory[0].content).toBe('Message 2');
      expect(state.conversationHistory[1].content).toBe('Response 2');
      expect(state.conversationHistory[2].content).toBe('Message 3');
      expect(state.metadata.messageCount).toBe(5); // Total count is maintained
    });

    it('should handle importance-based pruning strategy', () => {
      state = new AgentState({ 
        maxMessages: 3, 
        pruningStrategy: 'importance-based' 
      });
      
      state.addMessage({ role: 'user', content: 'Normal message', importance: 1 });
      state.addMessage({ role: 'assistant', content: 'Important response', importance: 5 });
      state.addMessage({ role: 'user', content: 'Another normal', importance: 1 });
      state.addMessage({ role: 'assistant', content: 'Very important', importance: 10 });
      state.addMessage({ role: 'user', content: 'Latest message', importance: 2 });
      
      // Should keep the most important messages and the latest
      expect(state.conversationHistory).toHaveLength(3);
      expect(state.conversationHistory.some(m => m.importance === 10)).toBe(true);
      expect(state.conversationHistory.some(m => m.importance === 5)).toBe(true);
      expect(state.conversationHistory[2].content).toBe('Latest message');
    });

    it('should clear conversation history', () => {
      state.addMessage({ role: 'user', content: 'Message 1' });
      state.addMessage({ role: 'assistant', content: 'Response 1' });
      
      state.clearHistory();
      
      expect(state.conversationHistory).toEqual([]);
      expect(state.metadata.messageCount).toBe(0);
      expect(state.metadata.lastCleared).toBeDefined();
    });

    it('should get recent messages', () => {
      state.addMessage({ role: 'user', content: 'Message 1' });
      state.addMessage({ role: 'assistant', content: 'Response 1' });
      state.addMessage({ role: 'user', content: 'Message 2' });
      
      const recent = state.getRecentMessages(2);
      
      expect(recent).toHaveLength(2);
      expect(recent[0].content).toBe('Response 1');
      expect(recent[1].content).toBe('Message 2');
    });
  });

  describe('Context Variables', () => {
    beforeEach(() => {
      const config = {
        contextVariables: {
          userName: {
            type: 'string',
            persistent: true
          },
          taskCount: {
            type: 'number',
            persistent: true
          },
          tempData: {
            type: 'object',
            persistent: false
          }
        }
      };
      state = new AgentState(config);
    });

    it('should set context variable', () => {
      state.setContextVariable('userName', 'Alice');
      
      expect(state.contextVariables.userName).toBe('Alice');
      expect(state.metadata.lastUpdated).toBeDefined();
    });

    it('should validate context variable type', () => {
      expect(() => {
        state.setContextVariable('userName', 123); // Wrong type
      }).toThrow('Invalid type for context variable userName');
      
      expect(() => {
        state.setContextVariable('taskCount', 'not a number'); // Wrong type
      }).toThrow('Invalid type for context variable taskCount');
    });

    it('should allow setting undefined variable when not strict', () => {
      state.setContextVariable('newVariable', 'value', false);
      
      expect(state.contextVariables.newVariable).toBe('value');
    });

    it('should throw when setting undefined variable in strict mode', () => {
      expect(() => {
        state.setContextVariable('undefinedVar', 'value', true);
      }).toThrow('Context variable undefinedVar is not defined');
    });

    it('should get context variable', () => {
      state.setContextVariable('userName', 'Bob');
      
      const value = state.getContextVariable('userName');
      expect(value).toBe('Bob');
    });

    it('should return default value for undefined variable', () => {
      const value = state.getContextVariable('nonExistent', 'default');
      expect(value).toBe('default');
    });

    it('should delete context variable', () => {
      state.setContextVariable('userName', 'Charlie');
      state.deleteContextVariable('userName');
      
      expect(state.contextVariables.userName).toBeUndefined();
    });

    it('should get all context variables', () => {
      state.setContextVariable('userName', 'David');
      state.setContextVariable('taskCount', 5);
      
      const vars = state.getAllContextVariables();
      
      expect(vars).toEqual({
        userName: 'David',
        taskCount: 5
      });
    });

    it('should get persistent variables only', () => {
      state.setContextVariable('userName', 'Eve');
      state.setContextVariable('taskCount', 10);
      state.setContextVariable('tempData', { temp: true });
      
      const persistent = state.getPersistentVariables();
      
      expect(persistent).toEqual({
        userName: 'Eve',
        taskCount: 10
      });
      expect(persistent.tempData).toBeUndefined();
    });

    it('should extract variable from text using pattern', () => {
      const config = {
        contextVariables: {
          userName: {
            type: 'string',
            persistent: true,
            extractionPattern: 'my name is ([\\w]+)'
          },
          email: {
            type: 'string',
            persistent: true,
            extractionPattern: '([\\w.]+@[\\w.]+)'
          }
        }
      };
      
      state = new AgentState(config);
      
      const extracted = state.extractVariablesFromText(
        'Hello, my name is Frank and my email is frank@example.com'
      );
      
      expect(extracted.userName).toBe('Frank');
      expect(extracted.email).toBe('frank@example.com');
    });
  });

  describe('State Serialization', () => {
    beforeEach(() => {
      state = new AgentState({ maxMessages: 10 });
    });

    it('should serialize state to JSON', () => {
      state.addMessage({ role: 'user', content: 'Test message' });
      state.setContextVariable('testVar', 'testValue', false);
      
      const serialized = state.toJSON();
      
      expect(serialized).toBeDefined();
      expect(serialized.conversationHistory).toHaveLength(1);
      expect(serialized.contextVariables.testVar).toBe('testValue');
      expect(serialized.metadata).toBeDefined();
      expect(serialized.config).toBeDefined();
    });

    it('should deserialize state from JSON', () => {
      const json = {
        conversationHistory: [
          { role: 'user', content: 'Previous message', timestamp: Date.now(), id: 'msg1' }
        ],
        contextVariables: {
          previousVar: 'previousValue'
        },
        metadata: {
          createdAt: Date.now() - 10000,
          lastUpdated: Date.now() - 5000,
          messageCount: 1
        },
        config: {
          maxMessages: 20,
          pruningStrategy: 'importance-based'
        }
      };
      
      const newState = AgentState.fromJSON(json);
      
      expect(newState.conversationHistory).toHaveLength(1);
      expect(newState.conversationHistory[0].content).toBe('Previous message');
      expect(newState.contextVariables.previousVar).toBe('previousValue');
      expect(newState.config.maxMessages).toBe(20);
      expect(newState.metadata.messageCount).toBe(1);
    });

    it('should create a deep copy of state', () => {
      state.addMessage({ role: 'user', content: 'Original' });
      state.setContextVariable('original', 'value', false);
      
      const copy = state.clone();
      
      // Modify the copy
      copy.addMessage({ role: 'assistant', content: 'Copy' });
      copy.setContextVariable('original', 'modified', false);
      
      // Original should be unchanged
      expect(state.conversationHistory).toHaveLength(1);
      expect(state.contextVariables.original).toBe('value');
      
      // Copy should have changes
      expect(copy.conversationHistory).toHaveLength(2);
      expect(copy.contextVariables.original).toBe('modified');
    });
  });

  describe('State Persistence', () => {
    it('should prepare state for memory storage', async () => {
      state = new AgentState();
      state.addMessage({ role: 'user', content: 'Test' });
      
      const prepared = await state.prepareForStorage('memory');
      
      expect(prepared).toBeDefined();
      expect(prepared.conversationHistory).toHaveLength(1);
    });

    it('should prepare state for file storage', async () => {
      state = new AgentState();
      state.setContextVariable('fileTest', 'value', false);
      
      const prepared = await state.prepareForStorage('file');
      
      expect(typeof prepared).toBe('string');
      const parsed = JSON.parse(prepared);
      expect(parsed.contextVariables.fileTest).toBe('value');
    });

    it('should prepare state for MongoDB storage', async () => {
      state = new AgentState();
      state.addMessage({ role: 'user', content: 'MongoDB test' });
      
      const prepared = await state.prepareForStorage('mongodb');
      
      expect(prepared).toBeDefined();
      expect(prepared._id).toBeUndefined(); // Should not include _id
      expect(prepared.conversationHistory).toHaveLength(1);
      expect(prepared.metadata).toBeDefined();
    });

    it('should restore state from storage format', async () => {
      const stored = {
        conversationHistory: [
          { role: 'user', content: 'Stored message', timestamp: Date.now(), id: 'stored1' }
        ],
        contextVariables: { storedVar: 'storedValue' },
        metadata: { messageCount: 1 },
        config: { maxMessages: 30 }
      };
      
      const restored = await AgentState.restoreFromStorage(stored, 'memory');
      
      expect(restored).toBeInstanceOf(AgentState);
      expect(restored.conversationHistory).toHaveLength(1);
      expect(restored.contextVariables.storedVar).toBe('storedValue');
      expect(restored.config.maxMessages).toBe(30);
    });
  });

  describe('Metadata Tracking', () => {
    beforeEach(() => {
      state = new AgentState();
    });

    it('should track creation time', () => {
      const now = Date.now();
      expect(state.metadata.createdAt).toBeGreaterThanOrEqual(now - 100);
      expect(state.metadata.createdAt).toBeLessThanOrEqual(now + 100);
    });

    it('should update last modified time', async () => {
      const initialUpdate = state.metadata.lastUpdated;
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      state.addMessage({ role: 'user', content: 'Update test' });
      
      expect(state.metadata.lastUpdated).toBeGreaterThan(initialUpdate);
    });

    it('should track message statistics', () => {
      state.addMessage({ role: 'user', content: 'User message' });
      state.addMessage({ role: 'assistant', content: 'Assistant response' });
      state.addMessage({ role: 'system', content: 'System message' });
      
      const stats = state.getStatistics();
      
      expect(stats.totalMessages).toBe(3);
      expect(stats.userMessages).toBe(1);
      expect(stats.assistantMessages).toBe(1);
      expect(stats.systemMessages).toBe(1);
      expect(stats.averageMessageLength).toBeGreaterThan(0);
    });
  });
});