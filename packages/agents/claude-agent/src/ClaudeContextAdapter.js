/**
 * ClaudeContextAdapter - Synchronizes context between Legion and Claude SDK
 *
 * Legion uses ExecutionContext for dependency injection and artifact management.
 * Claude SDK has its own context management with automatic compaction.
 *
 * This adapter ensures both systems stay synchronized without conflicts.
 */

export class ClaudeContextAdapter {
  constructor(legionContext) {
    this.legionContext = legionContext || {};
    this.claudeContext = [];
  }

  /**
   * Convert Legion conversation history to Claude messages format
   * @param {Array} legionConversation - Legion conversation entries
   * @returns {Array} Claude-formatted messages
   */
  legionConversationToClaudeMessages(legionConversation) {
    if (!Array.isArray(legionConversation)) {
      return [];
    }

    const messages = [];

    for (const entry of legionConversation) {
      // Skip system messages - they don't go in Claude's messages array
      if (entry.role === 'system') {
        continue;
      }

      // Convert user/assistant messages
      if (entry.role === 'user' || entry.role === 'assistant') {
        messages.push({
          role: entry.role,
          content: entry.content
        });
      }

      // Convert tool results
      if (entry.role === 'tool' && entry.metadata?.toolName) {
        messages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: entry.metadata.toolUseId || `tool_${entry.id}`,
            content: entry.content
          }]
        });
      }
    }

    return messages;
  }

  /**
   * Extract system prompt from Legion conversation or context
   * @param {Object} task - Legion task
   * @returns {string} System prompt
   */
  extractSystemPrompt(task) {
    // Check if task has explicit system prompt in context
    if (task.context?.systemPrompt) {
      return task.context.systemPrompt;
    }

    // Extract from first system message in conversation
    const systemMessages = task.conversation?.filter(e => e.role === 'system') || [];
    if (systemMessages.length > 0) {
      return systemMessages.map(m => m.content).join('\n\n');
    }

    // Default system prompt
    return `You are a helpful AI assistant working on the following task: ${task.description}`;
  }

  /**
   * Convert Legion ExecutionContext artifacts to context string
   * @param {Object} artifacts - Legion artifacts object
   * @returns {string} Formatted artifacts context
   */
  formatArtifactsForClaude(artifacts) {
    if (!artifacts || Object.keys(artifacts).length === 0) {
      return '';
    }

    const artifactDescriptions = Object.entries(artifacts).map(([name, artifact]) => {
      const type = artifact.type || 'unknown';
      const desc = artifact.description || '';
      const preview = this._getArtifactPreview(artifact.value);

      return `- @${name} (${type}): ${desc}\n  ${preview}`;
    });

    return `\n\nAvailable Artifacts:\n${artifactDescriptions.join('\n')}`;
  }

  /**
   * Get a preview of artifact value for context
   * @private
   */
  _getArtifactPreview(value) {
    if (value === null || value === undefined) {
      return '(empty)';
    }

    if (typeof value === 'string') {
      return value.length > 100 ? value.substring(0, 100) + '...' : value;
    }

    if (typeof value === 'object') {
      const json = JSON.stringify(value);
      return json.length > 100 ? json.substring(0, 100) + '...' : json;
    }

    return String(value);
  }

  /**
   * Merge Legion task context into Claude SDK request
   * @param {Object} task - Legion task
   * @param {Object} claudeRequest - Base Claude SDK request
   * @returns {Object} Enhanced Claude SDK request
   */
  enhanceClaudeRequest(task, claudeRequest) {
    const enhanced = { ...claudeRequest };

    // Add system prompt
    if (!enhanced.system) {
      enhanced.system = this.extractSystemPrompt(task);
    }

    // Add artifacts context to system prompt if artifacts exist
    const artifacts = task.getAllArtifacts ? task.getAllArtifacts() : {};
    if (Object.keys(artifacts).length > 0) {
      enhanced.system += this.formatArtifactsForClaude(artifacts);
    }

    // Convert conversation to messages
    if (task.conversation && !enhanced.messages) {
      enhanced.messages = this.legionConversationToClaudeMessages(task.conversation);
    }

    return enhanced;
  }

  /**
   * Store Claude response in Legion task conversation
   * @param {Object} task - Legion task
   * @param {Object} claudeResponse - Claude SDK response
   */
  storeClaudeResponseInTask(task, claudeResponse) {
    if (!task || !claudeResponse) {
      return;
    }

    // Store assistant response
    if (claudeResponse.content) {
      const content = Array.isArray(claudeResponse.content)
        ? claudeResponse.content.map(c => c.text || c.type).join('\n')
        : claudeResponse.content;

      task.addResponse(content, 'claude-sdk');
    }

    // Store tool uses
    if (claudeResponse.tool_uses) {
      for (const toolUse of claudeResponse.tool_uses) {
        task.addConversationEntry('assistant', JSON.stringify(toolUse), {
          type: 'tool_use',
          toolName: toolUse.name,
          toolUseId: toolUse.id
        });
      }
    }
  }
}
