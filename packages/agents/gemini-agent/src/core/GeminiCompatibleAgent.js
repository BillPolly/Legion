import { ConfigurableAgent } from '@legion/configurable-agent';
import { ResourceManager } from '@legion/resource-manager';
import { ConversationManager } from '../conversation/ConversationManager.js';
import { GeminiPromptManager } from '../prompts/GeminiPromptManager.js';

export class GeminiCompatibleAgent extends ConfigurableAgent {
  constructor(config = {}, resourceManager = null) {
    super(config, resourceManager);
    this.conversationManager = null;
    this.promptManager = null;
  }

  async initialize() {
    const resourceManager = await ResourceManager.getInstance();
    this.promptManager = new GeminiPromptManager(resourceManager);
    this.conversationManager = new ConversationManager({
      promptManager: this.promptManager,
      resourceManager
    });

    await super.initialize();
  }

  async processMessage(userInput) {
    try {
      if (!userInput || typeof userInput !== 'string') {
        throw new Error('Invalid input: userInput must be a non-empty string');
      }
      const response = await this.conversationManager.handleUserInput(userInput);
      return this.streamResponse(response);
    } catch (error) {
      console.error('Error processing message:', error);
      throw error;
    }
  }

  async streamResponse(response) {
    // Implement streaming response handling
    return response;
  }

  async executeTools(toolRequests) {
    // Implement tool execution with proper permissions
    return await super.executeTools(toolRequests);
  }

  async executeTool(toolName, toolArgs) {
    // Single tool execution method for compatibility
    try {
      const toolRequest = {
        name: toolName,
        arguments: toolArgs,
        id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      
      const results = await this.executeTools([toolRequest]);
      
      if (results && results.length > 0) {
        return {
          type: 'tool_response',
          success: true,
          result: results[0].result,
          toolName: toolName,
          arguments: toolArgs
        };
      } else {
        return {
          type: 'tool_response',
          success: false,
          error: 'Tool execution failed',
          toolName: toolName,
          arguments: toolArgs
        };
      }
    } catch (error) {
      return {
        type: 'tool_response',
        success: false,
        error: error.message,
        toolName: toolName,
        arguments: toolArgs
      };
    }
  }

  async compressContext() {
    return await this.conversationManager.compressHistory();
  }
}
