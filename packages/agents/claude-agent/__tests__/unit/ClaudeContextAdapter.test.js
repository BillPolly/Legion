/**
 * Unit Tests for ClaudeContextAdapter
 *
 * Tests context synchronization between Legion and Claude SDK
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { ClaudeContextAdapter } from '../../src/ClaudeContextAdapter.js';

describe('ClaudeContextAdapter', () => {
  describe('constructor', () => {
    test('should initialize with provided context', () => {
      const context = { foo: 'bar' };
      const adapter = new ClaudeContextAdapter(context);
      expect(adapter.legionContext).toEqual(context);
    });

    test('should initialize with empty context if none provided', () => {
      const adapter = new ClaudeContextAdapter();
      expect(adapter.legionContext).toEqual({});
    });
  });

  describe('legionConversationToClaudeMessages()', () => {
    let adapter;

    beforeEach(() => {
      adapter = new ClaudeContextAdapter();
    });

    test('should convert user message to Claude format', () => {
      const conversation = [
        { role: 'user', content: 'Hello Claude' }
      ];

      const messages = adapter.legionConversationToClaudeMessages(conversation);

      expect(messages).toEqual([
        { role: 'user', content: 'Hello Claude' }
      ]);
    });

    test('should convert assistant message to Claude format', () => {
      const conversation = [
        { role: 'assistant', content: 'Hello human' }
      ];

      const messages = adapter.legionConversationToClaudeMessages(conversation);

      expect(messages).toEqual([
        { role: 'assistant', content: 'Hello human' }
      ]);
    });

    test('should skip system messages (not in messages array)', () => {
      const conversation = [
        { role: 'system', content: 'System prompt here' },
        { role: 'user', content: 'User message' }
      ];

      const messages = adapter.legionConversationToClaudeMessages(conversation);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ role: 'user', content: 'User message' });
    });

    test('should convert tool result to Claude tool_result format', () => {
      const conversation = [
        {
          role: 'tool',
          content: 'Tool result data',
          id: '123',
          metadata: {
            toolName: 'test_tool',
            toolUseId: 'tool_use_456'
          }
        }
      ];

      const messages = adapter.legionConversationToClaudeMessages(conversation);

      expect(messages).toEqual([
        {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: 'tool_use_456',
            content: 'Tool result data'
          }]
        }
      ]);
    });

    test('should generate tool_use_id from entry id if not provided', () => {
      const conversation = [
        {
          role: 'tool',
          content: 'Tool result',
          id: 'entry_789',
          metadata: {
            toolName: 'test_tool'
          }
        }
      ];

      const messages = adapter.legionConversationToClaudeMessages(conversation);

      expect(messages[0].content[0].tool_use_id).toBe('tool_entry_789');
    });

    test('should handle empty conversation array', () => {
      const messages = adapter.legionConversationToClaudeMessages([]);
      expect(messages).toEqual([]);
    });

    test('should handle null/undefined conversation', () => {
      expect(adapter.legionConversationToClaudeMessages(null)).toEqual([]);
      expect(adapter.legionConversationToClaudeMessages(undefined)).toEqual([]);
    });

    test('should handle mixed conversation', () => {
      const conversation = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Question' },
        { role: 'assistant', content: 'Answer' },
        { role: 'user', content: 'Follow up' }
      ];

      const messages = adapter.legionConversationToClaudeMessages(conversation);

      expect(messages).toHaveLength(3);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
      expect(messages[2].role).toBe('user');
    });
  });

  describe('extractSystemPrompt()', () => {
    let adapter;

    beforeEach(() => {
      adapter = new ClaudeContextAdapter();
    });

    test('should extract from task.context.systemPrompt if present', () => {
      const task = {
        description: 'Test task',
        context: {
          systemPrompt: 'Custom system prompt from context'
        }
      };

      const prompt = adapter.extractSystemPrompt(task);
      expect(prompt).toBe('Custom system prompt from context');
    });

    test('should extract from system messages in conversation', () => {
      const task = {
        description: 'Test task',
        conversation: [
          { role: 'system', content: 'System message 1' },
          { role: 'system', content: 'System message 2' }
        ]
      };

      const prompt = adapter.extractSystemPrompt(task);
      expect(prompt).toBe('System message 1\n\nSystem message 2');
    });

    test('should return default prompt with task description if none found', () => {
      const task = {
        description: 'Analyze codebase'
      };

      const prompt = adapter.extractSystemPrompt(task);
      expect(prompt).toBe('You are a helpful AI assistant working on the following task: Analyze codebase');
    });

    test('should combine multiple system messages with newlines', () => {
      const task = {
        description: 'Test',
        conversation: [
          { role: 'system', content: 'Part 1' },
          { role: 'user', content: 'User msg' },
          { role: 'system', content: 'Part 2' }
        ]
      };

      const prompt = adapter.extractSystemPrompt(task);
      expect(prompt).toBe('Part 1\n\nPart 2');
    });

    test('should prioritize context.systemPrompt over conversation', () => {
      const task = {
        description: 'Test',
        context: {
          systemPrompt: 'From context'
        },
        conversation: [
          { role: 'system', content: 'From conversation' }
        ]
      };

      const prompt = adapter.extractSystemPrompt(task);
      expect(prompt).toBe('From context');
    });
  });

  describe('formatArtifactsForClaude()', () => {
    let adapter;

    beforeEach(() => {
      adapter = new ClaudeContextAdapter();
    });

    test('should format artifacts object as context string', () => {
      const artifacts = {
        data: {
          type: 'json',
          description: 'User data',
          value: { name: 'Alice', age: 30 }
        }
      };

      const formatted = adapter.formatArtifactsForClaude(artifacts);

      expect(formatted).toContain('Available Artifacts:');
      expect(formatted).toContain('@data');
      expect(formatted).toContain('(json)');
      expect(formatted).toContain('User data');
    });

    test('should handle empty artifacts (return empty string)', () => {
      expect(adapter.formatArtifactsForClaude({})).toBe('');
      expect(adapter.formatArtifactsForClaude(null)).toBe('');
      expect(adapter.formatArtifactsForClaude(undefined)).toBe('');
    });

    test('should preview long artifact values (truncate)', () => {
      const longString = 'x'.repeat(150);
      const artifacts = {
        longData: {
          type: 'string',
          description: 'Long data',
          value: longString
        }
      };

      const formatted = adapter.formatArtifactsForClaude(artifacts);

      expect(formatted).toContain('x'.repeat(100) + '...');
      expect(formatted).not.toContain('x'.repeat(150));
    });

    test('should handle different value types (string, object, number)', () => {
      const artifacts = {
        str: { type: 'string', description: 'String', value: 'text' },
        obj: { type: 'object', description: 'Object', value: { key: 'val' } },
        num: { type: 'number', description: 'Number', value: 42 }
      };

      const formatted = adapter.formatArtifactsForClaude(artifacts);

      expect(formatted).toContain('@str');
      expect(formatted).toContain('@obj');
      expect(formatted).toContain('@num');
      expect(formatted).toContain('text');
      expect(formatted).toContain('{"key":"val"}');
      expect(formatted).toContain('42');
    });

    test('should handle null/undefined artifact values', () => {
      const artifacts = {
        nullValue: { type: 'any', description: 'Null', value: null },
        undefinedValue: { type: 'any', description: 'Undefined', value: undefined }
      };

      const formatted = adapter.formatArtifactsForClaude(artifacts);

      expect(formatted).toContain('(empty)');
    });
  });

  describe('enhanceClaudeRequest()', () => {
    let adapter;

    beforeEach(() => {
      adapter = new ClaudeContextAdapter();
    });

    test('should add system prompt to request', () => {
      const task = {
        description: 'Test task',
        context: { systemPrompt: 'System prompt' }
      };
      const request = { model: 'claude-3-5-sonnet-20241022' };

      const enhanced = adapter.enhanceClaudeRequest(task, request);

      expect(enhanced.system).toBe('System prompt');
      expect(enhanced.model).toBe('claude-3-5-sonnet-20241022');
    });

    test('should add artifacts context to system prompt', () => {
      const task = {
        description: 'Test',
        context: { systemPrompt: 'System' },
        getAllArtifacts: () => ({
          data: { type: 'json', description: 'Data', value: { x: 1 } }
        })
      };
      const request = {};

      const enhanced = adapter.enhanceClaudeRequest(task, request);

      expect(enhanced.system).toContain('System');
      expect(enhanced.system).toContain('Available Artifacts:');
      expect(enhanced.system).toContain('@data');
    });

    test('should convert conversation to messages', () => {
      const task = {
        description: 'Test',
        conversation: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi' }
        ]
      };
      const request = {};

      const enhanced = adapter.enhanceClaudeRequest(task, request);

      expect(enhanced.messages).toHaveLength(2);
      expect(enhanced.messages[0].content).toBe('Hello');
    });

    test('should preserve existing request properties', () => {
      const task = { description: 'Test' };
      const request = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        temperature: 0.7
      };

      const enhanced = adapter.enhanceClaudeRequest(task, request);

      expect(enhanced.model).toBe('claude-3-5-sonnet-20241022');
      expect(enhanced.max_tokens).toBe(1024);
      expect(enhanced.temperature).toBe(0.7);
    });

    test('should not override existing system prompt', () => {
      const task = {
        description: 'Test',
        context: { systemPrompt: 'From task' }
      };
      const request = {
        system: 'From request'
      };

      const enhanced = adapter.enhanceClaudeRequest(task, request);

      expect(enhanced.system).toBe('From request');
    });

    test('should handle task without getAllArtifacts method', () => {
      const task = {
        description: 'Test',
        context: { systemPrompt: 'System' }
      };
      const request = {};

      const enhanced = adapter.enhanceClaudeRequest(task, request);

      expect(enhanced.system).toBe('System');
    });
  });

  describe('storeClaudeResponseInTask()', () => {
    let adapter;
    let mockTask;
    let addResponseCalls;
    let addConversationEntryCalls;

    beforeEach(() => {
      adapter = new ClaudeContextAdapter();
      addResponseCalls = [];
      addConversationEntryCalls = [];
      mockTask = {
        addResponse: (...args) => addResponseCalls.push(args),
        addConversationEntry: (...args) => addConversationEntryCalls.push(args)
      };
    });

    test('should store assistant response in task conversation', () => {
      const response = {
        content: 'Claude response text'
      };

      adapter.storeClaudeResponseInTask(mockTask, response);

      expect(addResponseCalls).toHaveLength(1);
      expect(addResponseCalls[0]).toEqual(['Claude response text', 'claude-sdk']);
    });

    test('should handle array content (extract text)', () => {
      const response = {
        content: [
          { type: 'text', text: 'Part 1' },
          { type: 'text', text: 'Part 2' }
        ]
      };

      adapter.storeClaudeResponseInTask(mockTask, response);

      expect(addResponseCalls).toHaveLength(1);
      expect(addResponseCalls[0][0]).toBe('Part 1\nPart 2');
    });

    test('should store tool uses in task conversation with metadata', () => {
      const response = {
        content: 'Response',
        tool_uses: [
          {
            id: 'tool_123',
            name: 'test_tool',
            input: { param: 'value' }
          }
        ]
      };

      adapter.storeClaudeResponseInTask(mockTask, response);

      expect(addConversationEntryCalls).toHaveLength(1);
      expect(addConversationEntryCalls[0][0]).toBe('assistant');
      expect(addConversationEntryCalls[0][1]).toContain('"name":"test_tool"');
      expect(addConversationEntryCalls[0][2]).toEqual({
        type: 'tool_use',
        toolName: 'test_tool',
        toolUseId: 'tool_123'
      });
    });

    test('should handle null/undefined response gracefully', () => {
      adapter.storeClaudeResponseInTask(mockTask, null);
      adapter.storeClaudeResponseInTask(mockTask, undefined);

      expect(addResponseCalls).toHaveLength(0);
    });

    test('should handle null/undefined task gracefully', () => {
      const response = { content: 'Test' };

      expect(() => {
        adapter.storeClaudeResponseInTask(null, response);
        adapter.storeClaudeResponseInTask(undefined, response);
      }).not.toThrow();
    });
  });
});
