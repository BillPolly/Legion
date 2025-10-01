/**
 * ClaudeAgentStrategy
 *
 * TaskStrategy implementation that wraps Claude Agent SDK
 * Implements actor model message passing for Legion
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeToolBridge } from './ClaudeToolBridge.js';
import { ClaudeContextAdapter } from './ClaudeContextAdapter.js';

/**
 * ClaudeAgentStrategy - Pure prototypal TaskStrategy
 *
 * Uses fire-and-forget message passing (send(), not async returns)
 * Single source of truth in Legion Task, not Claude SDK
 * FAIL FAST error handling - no fallbacks
 */
export const ClaudeAgentStrategy = {
  /**
   * Initialize strategy with ExecutionContext
   *
   * @param {Object} context - ExecutionContext with toolRegistry and resourceManager
   * @throws {Error} If context invalid or API key missing (FAIL FAST)
   */
  async initialize(context) {
    // Validate context (FAIL FAST)
    if (!context) {
      throw new Error('ExecutionContext is required for ClaudeAgentStrategy.initialize()');
    }

    if (!context.toolRegistry) {
      throw new Error('ExecutionContext must have toolRegistry');
    }

    if (!context.resourceManager) {
      throw new Error('ExecutionContext must have resourceManager');
    }

    // Store context reference
    this.context = context;

    // Get ResourceManager (already a reference from context)
    this.resourceManager = context.resourceManager;

    // Extract ANTHROPIC_API_KEY from ResourceManager (FAIL FAST if missing)
    this.apiKey = this.resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!this.apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY not found in ResourceManager. ' +
        'Please set ANTHROPIC_API_KEY in .env file.'
      );
    }

    // Initialize ClaudeToolBridge with toolRegistry
    this.toolBridge = new ClaudeToolBridge(context.toolRegistry);

    // Initialize ClaudeContextAdapter
    this.contextAdapter = new ClaudeContextAdapter();

    // Initialize Claude SDK client with API key
    this.claudeClient = new Anthropic({
      apiKey: this.apiKey
    });

    // Strategy is now ready
    this.initialized = true;
  },

  /**
   * Actor message handler - fire-and-forget pattern
   *
   * @param {Object} task - Legion Task receiving the message
   * @param {Object} senderTask - Task that sent the message (or null)
   * @param {Object} message - Message object with type and content
   */
  async onMessage(task, senderTask, message) {
    // Fire-and-forget: Handle messages asynchronously without returning values

    if (message.type === 'start' || message.type === 'work') {
      // Both 'start' and 'work' trigger Claude query
      await this._queryClaudeAsync(task);
    }

    // Unknown message types are ignored (fire-and-forget)
    // No return value - this is actor model message passing
  },

  /**
   * Query Claude SDK with task context
   *
   * @param {Object} task - Legion Task to query Claude for
   * @private
   */
  async _queryClaudeAsync(task) {
    // Build base request with model and max_tokens
    const baseRequest = {
      model: task.context?.model || 'claude-3-5-sonnet-20241022',
      max_tokens: task.context?.max_tokens || 8192
    };

    // Enhance request with Legion context (system prompt, artifacts, messages)
    const claudeRequest = this.contextAdapter.enhanceClaudeRequest(task, baseRequest);

    // Add tools from Legion ToolRegistry
    const tools = this.toolBridge.legionToolsToClaudeTools();
    if (tools && tools.length > 0) {
      claudeRequest.tools = tools;
    }

    // Call Claude SDK
    const response = await this.claudeClient.messages.create(claudeRequest);

    // Process response (store in task, handle tool uses, etc.)
    await this._processClaudeResponse(task, response);
  },

  /**
   * Process Claude SDK response
   *
   * @param {Object} task - Legion Task
   * @param {Object} response - Response from Claude SDK
   * @private
   */
  async _processClaudeResponse(task, response) {
    // Store response in task using ContextAdapter
    this.contextAdapter.storeClaudeResponseInTask(task, response);

    // Handle tool uses if present
    if (response.tool_uses && response.tool_uses.length > 0) {
      for (const toolUse of response.tool_uses) {
        await this._handleToolUse(task, toolUse);
      }
    }

    // Check stop reason
    if (response.stop_reason === 'end_turn') {
      // Task completed
      if (task.complete) {
        task.complete();
      }
    } else if (response.stop_reason === 'tool_use') {
      // Continue conversation after tool execution (already handled above)
      // Tool results stored, will query Claude again on next message
    }
  },

  /**
   * Handle Claude tool use request
   *
   * @param {Object} task - Legion Task
   * @param {Object} toolUse - Tool use object from Claude
   * @private
   */
  async _handleToolUse(task, toolUse) {
    // Execute tool via ToolBridge
    const result = await this.toolBridge.executeLegionTool(
      toolUse.name,
      toolUse.input
    );

    // Format result for Claude
    const formattedResult = this.toolBridge.formatToolResult(result);

    // Store tool result in task
    if (task.addConversationEntry) {
      task.addConversationEntry('tool', formattedResult, {
        toolName: toolUse.name,
        toolUseId: toolUse.id
      });
    }

    // Continue Claude conversation with tool result
    await this._queryClaudeAsync(task);
  }
};
