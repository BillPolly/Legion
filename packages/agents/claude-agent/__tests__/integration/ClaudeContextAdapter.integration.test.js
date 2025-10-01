/**
 * Integration Tests for ClaudeContextAdapter
 *
 * Tests context synchronization with real-like Legion Task
 * NO MOCKS - uses actual task interface
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ClaudeContextAdapter } from '../../src/ClaudeContextAdapter.js';

describe('ClaudeContextAdapter Integration', () => {
  let adapter;
  let mockTask;

  beforeAll(() => {
    adapter = new ClaudeContextAdapter();

    // Create a real-like Legion Task interface
    mockTask = {
      id: 'task_123',
      description: 'Analyze code and suggest improvements',
      conversation: [
        { role: 'system', content: 'You are a code analysis assistant.' },
        { role: 'user', content: 'Please analyze this code' },
        { role: 'assistant', content: 'I will analyze the code for you.' },
        {
          role: 'tool',
          content: 'File contents: function test() { return 42; }',
          id: 'entry_1',
          metadata: {
            toolName: 'file_read',
            toolUseId: 'tool_use_789'
          }
        },
        { role: 'user', content: 'What issues do you see?' }
      ],
      context: {
        systemPrompt: 'You are an expert code reviewer.',
        config: { model: 'claude-3-5-sonnet-20241022' }
      },
      artifacts: {
        codeFile: {
          type: 'file',
          description: 'Source code file',
          value: 'function example() { console.log("test"); }'
        },
        metadata: {
          type: 'json',
          description: 'Analysis metadata',
          value: { language: 'javascript', loc: 42 }
        }
      },
      getAllArtifacts: function() {
        return this.artifacts;
      },
      addResponse: function(content, source) {
        this.conversation.push({
          role: 'assistant',
          content: content,
          metadata: { source: source }
        });
      },
      addConversationEntry: function(role, content, metadata) {
        this.conversation.push({
          role: role,
          content: content,
          metadata: metadata
        });
      }
    };
  });

  describe('Full round-trip - Legion → Claude → Legion', () => {
    test('should convert Legion conversation to Claude messages correctly', () => {
      const messages = adapter.legionConversationToClaudeMessages(mockTask.conversation);

      // Should have user, assistant, tool_result, and user messages (skip system)
      expect(messages).toHaveLength(4);

      expect(messages[0]).toEqual({
        role: 'user',
        content: 'Please analyze this code'
      });

      expect(messages[1]).toEqual({
        role: 'assistant',
        content: 'I will analyze the code for you.'
      });

      expect(messages[2]).toEqual({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: 'tool_use_789',
          content: 'File contents: function test() { return 42; }'
        }]
      });

      expect(messages[3]).toEqual({
        role: 'user',
        content: 'What issues do you see?'
      });
    });

    test('should extract system prompt correctly', () => {
      const systemPrompt = adapter.extractSystemPrompt(mockTask);

      expect(systemPrompt).toBe('You are an expert code reviewer.');
    });

    test('should format artifacts for Claude context', () => {
      const artifactsContext = adapter.formatArtifactsForClaude(mockTask.artifacts);

      expect(artifactsContext).toContain('Available Artifacts:');
      expect(artifactsContext).toContain('@codeFile');
      expect(artifactsContext).toContain('(file)');
      expect(artifactsContext).toContain('Source code file');
      expect(artifactsContext).toContain('@metadata');
      expect(artifactsContext).toContain('(json)');
      expect(artifactsContext).toContain('Analysis metadata');
    });

    test('should enhance Claude request with full task context', () => {
      const baseRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048
      };

      const enhanced = adapter.enhanceClaudeRequest(mockTask, baseRequest);

      // Should have system prompt
      expect(enhanced.system).toContain('You are an expert code reviewer.');
      // Should include artifacts context
      expect(enhanced.system).toContain('Available Artifacts:');
      expect(enhanced.system).toContain('@codeFile');

      // Should have messages
      expect(enhanced.messages).toHaveLength(4);

      // Should preserve original properties
      expect(enhanced.model).toBe('claude-3-5-sonnet-20241022');
      expect(enhanced.max_tokens).toBe(2048);
    });

    test('should store Claude response in task conversation', () => {
      const conversationLengthBefore = mockTask.conversation.length;

      const claudeResponse = {
        id: 'msg_abc123',
        content: 'The code looks good but could use better error handling.',
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 }
      };

      adapter.storeClaudeResponseInTask(mockTask, claudeResponse);

      // Should have added one entry
      expect(mockTask.conversation.length).toBe(conversationLengthBefore + 1);

      // Should have the response
      const lastEntry = mockTask.conversation[mockTask.conversation.length - 1];
      expect(lastEntry.role).toBe('assistant');
      expect(lastEntry.content).toBe('The code looks good but could use better error handling.');
      expect(lastEntry.metadata.source).toBe('claude-sdk');
    });

    test('should handle Claude response with tool uses', () => {
      const conversationLengthBefore = mockTask.conversation.length;

      const claudeResponse = {
        content: 'I need to read the file first.',
        tool_uses: [
          {
            id: 'tool_use_456',
            name: 'file_read',
            input: { path: '/src/test.js' }
          }
        ]
      };

      adapter.storeClaudeResponseInTask(mockTask, claudeResponse);

      // Should have added response + tool use
      expect(mockTask.conversation.length).toBe(conversationLengthBefore + 2);

      // Check assistant response
      const responseEntry = mockTask.conversation[conversationLengthBefore];
      expect(responseEntry.role).toBe('assistant');
      expect(responseEntry.content).toBe('I need to read the file first.');

      // Check tool use entry
      const toolEntry = mockTask.conversation[conversationLengthBefore + 1];
      expect(toolEntry.role).toBe('assistant');
      expect(toolEntry.metadata.type).toBe('tool_use');
      expect(toolEntry.metadata.toolName).toBe('file_read');
      expect(toolEntry.metadata.toolUseId).toBe('tool_use_456');
    });
  });

  describe('Context preservation through round-trip', () => {
    test('should maintain conversation history integrity', () => {
      // Start with current conversation
      const initialLength = mockTask.conversation.length;

      // Simulate Claude query cycle
      const claudeRequest = adapter.enhanceClaudeRequest(mockTask, {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024
      });

      // Verify request has all context
      expect(claudeRequest.messages.length).toBeGreaterThan(0);
      expect(claudeRequest.system).toBeTruthy();

      // Simulate Claude response
      const claudeResponse = {
        content: 'Analysis complete. No major issues found.'
      };

      adapter.storeClaudeResponseInTask(mockTask, claudeResponse);

      // Verify conversation grew
      expect(mockTask.conversation.length).toBe(initialLength + 1);

      // Verify we can convert again with new entry
      const newMessages = adapter.legionConversationToClaudeMessages(mockTask.conversation);
      expect(newMessages.length).toBeGreaterThan(0);
    });

    test('should handle multiple round-trips', () => {
      const initialLength = mockTask.conversation.length;

      // Round-trip 1
      adapter.storeClaudeResponseInTask(mockTask, {
        content: 'Response 1'
      });

      // Round-trip 2
      adapter.storeClaudeResponseInTask(mockTask, {
        content: 'Response 2'
      });

      // Round-trip 3
      adapter.storeClaudeResponseInTask(mockTask, {
        content: 'Response 3'
      });

      expect(mockTask.conversation.length).toBe(initialLength + 3);

      // Verify all responses are in conversation
      const messages = adapter.legionConversationToClaudeMessages(mockTask.conversation);
      const contents = messages.map(m => typeof m.content === 'string' ? m.content : '');
      expect(contents).toContain('Response 1');
      expect(contents).toContain('Response 2');
      expect(contents).toContain('Response 3');
    });
  });
});
