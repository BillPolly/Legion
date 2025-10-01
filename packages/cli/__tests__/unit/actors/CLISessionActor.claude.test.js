/**
 * Unit Tests for CLISessionActor Claude Integration
 *
 * Tests the Claude task initialization and non-slash command routing
 * NO INTEGRATION - Uses mocks for Claude SDK
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { CLISessionActor } from '../../../src/actors/CLISessionActor.js';

describe('CLISessionActor - Claude Integration', () => {
  let mockShowme;
  let mockResourceManager;
  let mockToolRegistry;
  let actor;

  beforeEach(() => {
    // Mock ShowMeController
    mockShowme = {
      getStatus: () => ({ ready: true }),
      getWindows: () => []
    };

    // Mock ToolRegistry
    mockToolRegistry = {
      getTool: () => ({ name: 'test', description: 'Test tool', inputSchema: {} }),
      getAllTools: () => [
        { name: 'test_tool', description: 'Test tool', inputSchema: {} }
      ]
    };

    // Mock ResourceManager with toolRegistry
    mockResourceManager = {
      get: (key) => {
        if (key === 'env.ANTHROPIC_API_KEY') return 'test-api-key-12345';
        if (key === 'toolRegistry') return mockToolRegistry;
        return null;
      }
    };

    // Create actor instance
    actor = new CLISessionActor({
      showme: mockShowme,
      resourceManager: mockResourceManager,
      sessionId: 'test-session-123',
      useColors: false
    });
  });

  describe('_initializeClaudeTask()', () => {
    test('should initialize claudeTask on first call', async () => {
      // Verify no task initially
      expect(actor.claudeTask).toBeNull();

      // Initialize
      await actor._initializeClaudeTask();

      // Verify task created
      expect(actor.claudeTask).toBeDefined();
      expect(actor.claudeTask).not.toBeNull();
      expect(actor.claudeTask.id).toBeDefined();
      expect(actor.claudeTask.status).toBe('in-progress');
    });

    test('should only initialize once (idempotent)', async () => {
      // Initialize twice
      await actor._initializeClaudeTask();
      const firstTask = actor.claudeTask;

      await actor._initializeClaudeTask();
      const secondTask = actor.claudeTask;

      // Should be same task instance
      expect(secondTask).toBe(firstTask);
    });

    test('should create task with ClaudeAgentStrategy', async () => {
      await actor._initializeClaudeTask();

      // Verify strategy is set
      expect(actor.claudeTask.strategy).toBeDefined();
      expect(actor.claudeTask.strategy.initialized).toBe(true);
    });

    test('should include session ID in task description', async () => {
      await actor._initializeClaudeTask();

      expect(actor.claudeTask.description).toContain('test-session-123');
    });

    test('should create task with ExecutionContext', async () => {
      await actor._initializeClaudeTask();

      const context = actor.claudeTask.getContext();
      expect(context).toBeDefined();
      expect(context.constructor.name).toBe('ExecutionContext');
    });

    test('should fail fast if ANTHROPIC_API_KEY missing', async () => {
      // Create actor with ResourceManager that has no API key
      const mockRMNoKey = {
        get: (key) => {
          if (key === 'toolRegistry') return mockToolRegistry;
          return null; // No API key
        }
      };

      const actorNoKey = new CLISessionActor({
        showme: mockShowme,
        resourceManager: mockRMNoKey,
        sessionId: 'test-no-key'
      });

      // Should throw error
      await expect(actorNoKey._initializeClaudeTask()).rejects.toThrow('ANTHROPIC_API_KEY');
    });

    test('should start task after initialization', async () => {
      await actor._initializeClaudeTask();

      expect(actor.claudeTask.status).toBe('in-progress');
      expect(actor.claudeTask.metadata.startedAt).not.toBeNull();
    });
  });

  describe('handleExecuteCommand() - Non-slash commands', () => {
    test('should initialize Claude task on first non-slash command', async () => {
      expect(actor.claudeTask).toBeNull();

      await actor.handleExecuteCommand({ command: 'Hello Claude' });

      expect(actor.claudeTask).not.toBeNull();
    });

    test('should add user message to conversation', async () => {
      await actor.handleExecuteCommand({ command: 'What is 2+2?' });

      const userMessages = actor.claudeTask.conversation.filter(
        entry => entry.role === 'user' && entry.content === 'What is 2+2?'
      );

      expect(userMessages.length).toBeGreaterThan(0);
    });

    test('should handle Claude API call (returns error with mock API)', async () => {
      const result = await actor.handleExecuteCommand({ command: 'Hello' });

      // In unit tests with mock API, the Claude SDK will fail to call actual API
      // This is expected - the test verifies the error handling works
      expect(result.success).toBe(false);
      expect(result.sessionId).toBe('test-session-123');
      expect(result.error).toBeDefined();
    });

    test('should maintain conversation across multiple commands', async () => {
      await actor.handleExecuteCommand({ command: 'First command' });
      await actor.handleExecuteCommand({ command: 'Second command' });
      await actor.handleExecuteCommand({ command: 'Third command' });

      // Should have multiple user messages
      const userMessages = actor.claudeTask.conversation.filter(
        entry => entry.role === 'user'
      );

      expect(userMessages.length).toBeGreaterThanOrEqual(3);
    });

    test('should still process slash commands normally', async () => {
      const result = await actor.handleExecuteCommand({ command: '/help' });

      // Slash commands should work as before
      expect(result.success).toBe(true);
      // Should NOT initialize Claude task for slash commands
      expect(actor.claudeTask).toBeNull();
    });
  });

  describe('cleanup()', () => {
    test('should complete Claude task if active', async () => {
      // Initialize Claude task
      await actor._initializeClaudeTask();
      expect(actor.claudeTask.status).toBe('in-progress');

      // Cleanup
      await actor.cleanup();

      // Task should be completed
      expect(actor.claudeTask.status).toBe('completed');
    });

    test('should handle cleanup with no Claude task', async () => {
      expect(actor.claudeTask).toBeNull();

      // Should not throw
      await expect(actor.cleanup()).resolves.not.toThrow();
    });

    test('should not complete already completed task', async () => {
      await actor._initializeClaudeTask();
      actor.claudeTask.complete({ reason: 'Already done' });

      const completedAt = actor.claudeTask.metadata.completedAt;

      await actor.cleanup();

      // Should not change completed time
      expect(actor.claudeTask.metadata.completedAt).toBe(completedAt);
    });
  });
});
