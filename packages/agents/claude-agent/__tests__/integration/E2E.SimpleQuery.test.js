/**
 * End-to-End Integration Test - Simple Query without Tools
 *
 * Tests complete task lifecycle with REAL Claude API
 * NO MOCKS - test fails if API key missing or API unavailable
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ClaudeAgentStrategy } from '../../src/ClaudeAgentStrategy.js';
import ResourceManager from '@legion/resource-manager';

describe('E2E - Simple Query (NO TOOLS)', () => {
  let resourceManager;
  let apiKey;

  beforeAll(async () => {
    // Get ResourceManager singleton - NO FALLBACKS
    resourceManager = await ResourceManager.getInstance();

    // Verify ANTHROPIC_API_KEY exists - FAIL FAST if missing
    apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY not found in ResourceManager. ' +
        'Set ANTHROPIC_API_KEY in .env file to run integration tests.'
      );
    }
  }, 10000);

  test('should complete simple question-answer with real Claude API', async () => {
    // Create ExecutionContext with minimal toolRegistry
    const context = {
      toolRegistry: {
        getTool: () => null,
        getAllTools: () => []
      },
      resourceManager: resourceManager
    };

    // Create strategy and initialize
    const strategy = Object.create(ClaudeAgentStrategy);
    await strategy.initialize(context);

    // Create mock task with Legion Task interface
    let taskCompleted = false;
    let taskStatus = 'pending';
    const task = {
      id: 'e2e_simple_query',
      description: 'Answer a simple question',
      conversation: [
        { role: 'user', content: 'What is 2 + 2? Answer with just the number.' }
      ],
      context: {
        systemPrompt: 'You are a helpful math assistant. Answer concisely.',
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100
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
      },
      getAllArtifacts: () => ({}),
      complete: function() {
        taskCompleted = true;
        taskStatus = 'completed';
      }
    };

    // Send 'start' message to trigger Claude query
    await strategy.onMessage(task, null, { type: 'start' });

    // Verify task completed
    expect(taskCompleted).toBe(true);
    expect(taskStatus).toBe('completed');

    // Verify response stored in conversation
    expect(task.conversation.length).toBeGreaterThan(1);

    // Find assistant response
    const assistantResponse = task.conversation.find(
      entry => entry.role === 'assistant' && entry.metadata?.source === 'claude-sdk'
    );

    expect(assistantResponse).toBeDefined();
    expect(assistantResponse.content).toBeDefined();
    expect(typeof assistantResponse.content).toBe('string');

    // Verify response contains answer (should be "4")
    expect(assistantResponse.content).toMatch(/4/);

    console.log('✅ Simple query E2E test passed');
    console.log('Response:', assistantResponse.content);
  }, 30000); // 30 second timeout for real API call
});
