/**
 * GeminiCompatibleAgent - Main agent class that replicates Gemini CLI functionality
 * Built using Legion framework patterns with ported Gemini CLI code
 */

import { ConfigurableAgent } from '@legion/configurable-agent';
import { validateAgentConfig } from '../schemas/ToolSchemas.js';
import ConversationManager from '../conversation/ConversationManager.js';
// Note: Will import GeminiToolsModule when packages are properly linked

/**
 * Gemini-compatible agent that extends Legion's ConfigurableAgent
 * Provides the same functionality as Gemini CLI using ported code
 */
export class GeminiCompatibleAgent extends ConfigurableAgent {
  constructor(config = {}, resourceManager) {
    // Configure agent to use GeminiToolsModule with proper Legion patterns
    const agentConfig = {
      agent: {
        id: 'gemini-compatible-agent',
        name: 'Gemini Compatible Agent',
        description: 'AI coding assistant with complete Gemini CLI capabilities',
        type: 'task',
        version: '1.0.0',
        capabilities: [
          {
            module: 'gemini-tools',
            tools: [
              'read_file', 'write_file', 'edit_file', 'list_files', 
              'grep_search', 'shell_command', 'save_memory', 'smart_edit',
              'read_many_files', 'glob_pattern', 'web_fetch', 'web_search', 
              'ripgrep_search'
            ],
            permissions: { read: true, write: true, execute: true }
          }
        ],
        llm: {
          provider: 'anthropic', 
          model: 'claude-3-5-sonnet-20241022',
          temperature: 0.1,
          maxTokens: 100000,
          systemPrompt: 'You are a Gemini-compatible AI coding assistant with access to file operations, search tools, and shell commands.'
        },
        prompts: {
          templates: {},
          responseFormats: {
            default: {
              type: 'json',
              includeMetadata: true
            }
          }
        },
        state: {
          conversationHistory: {
            maxMessages: 100,
            pruningStrategy: 'sliding-window'
          },
          contextVariables: {}
        },
        ...config
      }
    };

    // Call parent constructor with proper Legion config
    super(agentConfig, resourceManager);
  }

  /**
   * Initialize the agent using ConfigurableAgent's patterns
   */
  async initialize() {
    // Call parent initialization - this handles everything!
    await super.initialize();

    console.log(`✅ GeminiCompatibleAgent initialized: ${this.name}`);
    console.log(`🔧 Available tools: ${Object.keys(this.capabilityManager?.tools || {}).length}`);
    return this;
  }

  /**
   * Process user chat message using ConfigurableAgent patterns
   * @param {string} userInput - User's message
   * @param {Object} options - Additional options  
   * @returns {Promise<Object>} Response
   */
  async processMessage(userInput, options = {}) {
    const sessionId = options.sessionId || 'gemini-session';
    
    // Use ConfigurableAgent's receive method for chat
    const chatMessage = {
      type: 'chat',
      from: 'user',
      content: userInput,
      sessionId
    };

    const response = await this.receive(chatMessage);
    return response;
  }

  /**
   * Execute tool using ConfigurableAgent patterns
   * @param {string} toolName - Tool to execute
   * @param {Object} params - Tool parameters
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Tool result
   */
  async executeTool(toolName, params, options = {}) {
    const sessionId = options.sessionId || 'gemini-session';
    
    // Use ConfigurableAgent's receive method for tool requests
    const toolMessage = {
      type: 'tool_request',
      from: 'user',
      tool: toolName,
      operation: 'execute', // Standard operation
      params,
      sessionId
    };

    const response = await this.receive(toolMessage);
    return response;
  }

  /**
   * Get conversation history from ConfigurableAgent state
   */
  getConversationHistory() {
    return this.state?.getConversationHistory() || [];
  }
}