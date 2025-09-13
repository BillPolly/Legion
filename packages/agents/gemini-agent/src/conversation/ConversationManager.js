/**
 * ConversationManager - Simple implementation using SimplePromptClient
 * Uses standard chat history + tools pattern with minimal complexity
 */

import { SimplePromptClient } from '@legion/llm-client';
import { ResourceManager } from '@legion/resource-manager';
import { GeminiToolsModule } from '@legion/gemini-tools';
import { SmartToolResultFormatter } from '../utils/SmartToolResultFormatter.js';
import { ResponseValidator } from '@legion/output-schema';
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
    
    // Cache actual tool objects by name for easy invocation
    this.toolsByName = new Map(); // Maps tool.name -> tool object
    this.cachedToolsForLLM = null; // Cached tools array for SimplePromptClient
    
    // Initialize proper tool calling schema for output validation
    this.toolCallSchema = {
      type: 'object',
      properties: {
        response: { type: 'string', description: 'Your response to the user' },
        use_tool: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Tool name to execute' },
            args: { type: 'object', description: 'Tool arguments' }
          },
          required: ['name', 'args']
        },
        use_tools: {
          type: 'array',
          description: 'Array of tools to execute in sequence',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Tool name' },
              args: { type: 'object', description: 'Tool arguments' }
            },
            required: ['name', 'args']
          }
        }
      },
      required: ['response']
    };
    
    // Initialize response validator for structured tool calling
    this.responseValidator = new ResponseValidator(this.toolCallSchema);
    
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
      
      // Cache tools by name for easy invocation
      this._cacheTools();
      
      // Initialize SimplePromptClient
      this.simpleClient = await this.resourceManager.get('simplePromptClient');
      console.log('✅ SimplePromptClient initialized');
      
      // Initialize ResponseValidator for tool call processing
      this.responseValidator = new ResponseValidator(this.toolCallSchema);
      console.log('✅ ResponseValidator initialized');
      
      this.initialized = true;
    } catch (error) {
      console.error('❌ Initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Cache tools by name for easy invocation
   */
  _cacheTools() {
    const tools = this.toolsModule.getTools();
    this.toolsByName.clear();
    
    // Cache tool objects by their actual names
    Object.values(tools).forEach(tool => {
      const toolName = tool.name || tool.toolName;
      if (toolName) {
        this.toolsByName.set(toolName, tool);
      }
    });
    
    console.log('✅ Cached tools by name:', Array.from(this.toolsByName.keys()));
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
      // Generate proper output format instructions using ResponseValidator
      const formatInstructions = this.responseValidator.generateInstructions({
        response: "I understand and will help you.",
        use_tool: {
          name: "shell_command",
          args: { command: "echo example" }
        }
      });
      
      // Add format instructions to system prompt
      const systemPromptWithInstructions = this.systemPrompt + '\n\n' + formatInstructions;
      
      // Use SimplePromptClient with proper format instructions
      const response = await this.simpleClient.request({
        prompt: userInput,
        systemPrompt: systemPromptWithInstructions,
        chatHistory: this.conversationHistory.slice(-10), // Last 10 messages
        tools: availableTools,
        maxTokens: 2000,
        temperature: 0.1
      });

      // Process response through output-schema validator (handles XML, JSON, etc. automatically)
      const validationResult = this.responseValidator.process(response.content);
      
      let assistantMessage = {
        role: 'assistant', 
        content: validationResult.success ? validationResult.data.response : response.content,
        timestamp: new Date().toISOString()
      };

      // Use proper validated tool calls from output-schema
      if (validationResult.success && (validationResult.data.use_tool || validationResult.data.use_tools)) {
        const toolCalls = validationResult.data.use_tools || [validationResult.data.use_tool];
        console.log('🔧 Executing', toolCalls.length, 'tool calls...');
        const toolResults = [];
        let updatedContent = validationResult.data.response;
        
        for (const toolCall of toolCalls) {
          try {
            console.log('⚡ Executing tool:', toolCall.name, toolCall.args);
            
            // Use cached tool object for direct invocation
            const tool = this.toolsByName.get(toolCall.name);
            if (!tool) {
              throw new Error(`Tool '${toolCall.name}' not found in cached tools`);
            }
            
            const result = await tool.execute(toolCall.args);
            console.log('✅ Tool result:', result);
            
            toolResults.push({
              name: toolCall.name,
              args: toolCall.args,
              result: result
            });
            
            // Append beautifully formatted result to response
            const formattedResult = SmartToolResultFormatter.format(toolCall.name, result);
            updatedContent = updatedContent + `\n\n${formattedResult}\n`;
            
          } catch (error) {
            console.error('❌ Tool execution failed:', toolCall.name, error.message);
            toolResults.push({
              name: toolCall.name,
              args: toolCall.args,
              error: error.message
            });
            
            // Append formatted error message to response
            const formattedError = SmartToolResultFormatter.formatError(toolCall.name, { error: error.message });
            updatedContent = updatedContent + `\n\n${formattedError}\n`;
          }
        }
        
        assistantMessage.toolCalls = toolResults;
        assistantMessage.content = updatedContent; // Use content with executed tool results
      }

      this.conversationHistory.push(assistantMessage);
      
      // Simple compression - keep last 50 messages
      if (this.conversationHistory.length > 50) {
        this.conversationHistory = this.conversationHistory.slice(-50);
      }

      return {
        id: `turn_${this.turnCounter}`,
        type: 'assistant',
        content: assistantMessage.content, // Use updated content with tool results
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
    // Return cached tools if available
    if (this.cachedToolsForLLM) {
      return this.cachedToolsForLLM;
    }
    
    if (!this.toolsByName || this.toolsByName.size === 0) {
      return [];
    }

    // Create tools array from cached tools by name
    this.cachedToolsForLLM = Array.from(this.toolsByName.values()).map(tool => ({
      name: tool.name || tool.toolName,
      description: tool.description || `Execute ${tool.name}`,
      parameters: tool.inputSchema || {
        type: 'object',
        properties: {},
        additionalProperties: true
      }
    }));
    
    return this.cachedToolsForLLM;
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