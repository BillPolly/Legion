/**
 * ConversationManager - Simple implementation using SimplePromptClient
 * Uses standard chat history + tools pattern with minimal complexity
 */

import { SimplePromptClient } from '@legion/llm-client';
import { ResourceManager } from '@legion/resource-manager';
import { GeminiToolsModule } from '@legion/gemini-tools';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ConversationManager {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.conversationHistory = [];
    this.turnCounter = 0;
    this.simpleClient = null;
    
    // Load system prompt from file (sync)
    this._loadSystemPrompt();
    
    // Initialize async components (called on first use)
    this.initialized = false;
  }

  /**
   * Initialize all async components
   */
  async _initializeAsync() {
    if (this.initialized) return;
    
    try {
      // Initialize tools
      this.toolsModule = await GeminiToolsModule.create(this.resourceManager);
      console.log('✅ Tools initialized:', this.toolsModule.getStatistics().toolCount, 'tools');
      
      // Initialize SimplePromptClient
      this.simpleClient = await this.resourceManager.get('simplePromptClient');
      console.log('✅ SimplePromptClient initialized');
      
      this.initialized = true;
    } catch (error) {
      console.error('❌ Initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Load system prompt from prompts directory
   */
  _loadSystemPrompt() {
    try {
      const promptsDir = path.resolve(__dirname, '../../prompts');
      this.systemPrompt = fs.readFileSync(
        path.join(promptsDir, 'core-system-prompt.md'), 
        'utf-8'
      );
      console.log('✅ System prompt loaded');
    } catch (error) {
      console.error('❌ System prompt loading failed:', error.message);
      this.systemPrompt = 'You are a helpful coding assistant.';
    }
  }

  /**
   * Process user message using SimplePromptClient
   * @param {string} userInput - User's message
   * @returns {Promise<Object>} Response with tool execution
   */
  async processMessage(userInput) {
    // Ensure initialization is complete
    await this._initializeAsync();
    
    this.turnCounter++;

    // Add user message to history
    const userMessage = {
      role: 'user',
      content: userInput,
      timestamp: new Date().toISOString()
    };
    this.conversationHistory.push(userMessage);

    // Get available tools in SimplePromptClient format
    const availableTools = this._getToolsForSimpleClient();

    try {
      // Use SimplePromptClient with standard pattern
      const response = await this.simpleClient.request({
        prompt: userInput,
        systemPrompt: this.systemPrompt,
        chatHistory: this.conversationHistory.slice(-10), // Last 10 messages
        tools: availableTools,
        maxTokens: 2000,
        temperature: 0.1
      });

      // Add assistant response to history
      const assistantMessage = {
        role: 'assistant', 
        content: response.content,
        timestamp: new Date().toISOString()
      };

      // Handle tool calls if present
      if (response.toolCalls && response.toolCalls.length > 0) {
        const toolResults = [];
        
        for (const toolCall of response.toolCalls) {
          try {
            const result = await this.toolsModule.invoke(toolCall.name, toolCall.args);
            toolResults.push({
              name: toolCall.name,
              args: toolCall.args,
              result: result
            });
          } catch (error) {
            toolResults.push({
              name: toolCall.name,
              args: toolCall.args,
              error: error.message
            });
          }
        }
        
        assistantMessage.toolCalls = toolResults;
      }

      this.conversationHistory.push(assistantMessage);
      
      // Simple compression - keep last 50 messages
      if (this.conversationHistory.length > 50) {
        this.conversationHistory = this.conversationHistory.slice(-50);
      }

      return {
        id: `turn_${this.turnCounter}`,
        type: 'assistant',
        content: response.content,
        tools: assistantMessage.toolCalls || [],
        metadata: response.metadata,
        timestamp: assistantMessage.timestamp
      };

    } catch (error) {
      console.error('❌ Message processing failed:', error.message);
      
      const errorMessage = {
        role: 'assistant',
        content: `I apologize, but I encountered an error: ${error.message}`,
        timestamp: new Date().toISOString()
      };
      this.conversationHistory.push(errorMessage);

      return {
        id: `turn_${this.turnCounter}`,
        type: 'assistant', 
        content: errorMessage.content,
        tools: [],
        error: error.message,
        timestamp: errorMessage.timestamp
      };
    }
  }

  /**
   * Convert Gemini tools to SimplePromptClient format
   */
  _getToolsForSimpleClient() {
    if (!this.toolsModule) {
      return [];
    }

    const tools = this.toolsModule.getTools();
    return Object.entries(tools).map(([name, tool]) => ({
      name: name,
      description: tool.description || `Execute ${name}`,
      parameters: tool.inputSchema || {
        type: 'object',
        properties: {},
        additionalProperties: true
      }
    }));
  }

  /**
   * Get conversation history
   */
  getConversationHistory() {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
    this.turnCounter = 0;
  }

  /**
   * Get conversation state
   */
  getState() {
    return {
      messages: this.conversationHistory,
      turnCounter: this.turnCounter,
      timestamp: new Date().toISOString()
    };
  }
}

export default ConversationManager;