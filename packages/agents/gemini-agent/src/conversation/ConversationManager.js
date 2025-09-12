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
      // Use SimplePromptClient to get raw LLM response
      const response = await this.simpleClient.request({
        prompt: userInput,
        systemPrompt: this.systemPrompt,
        chatHistory: this.conversationHistory.slice(-10), // Last 10 messages
        tools: availableTools,
        maxTokens: 2000,
        temperature: 0.1
      });

      // Process response through output-schema validator for proper tool extraction
      // First, try to extract JSON from XML if present
      const processedContent = this._preprocessResponseForValidation(response.content);
      const validationResult = this.responseValidator.process(processedContent);
      
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
   * Preprocess LLM response to convert Anthropic XML to JSON format for output-schema validation
   * @private
   */
  _preprocessResponseForValidation(content) {
    // Check if response contains Anthropic XML tool calls
    const hasXMLTools = content.includes('<tool_use');
    
    if (!hasXMLTools) {
      // No tool calls, return as simple response object
      return JSON.stringify({
        response: content
      });
    }

    // Extract tool calls using manual parsing to handle complex nested quotes
    const matches = this._extractToolCallsManually(content);
    
    if (matches.length === 0) {
      // XML found but couldn't parse - return as simple response
      return JSON.stringify({
        response: content
      });
    }

    // Extract the response text (everything before first tool call)
    const responseText = content.split('<tool_use')[0].trim();
    
    try {
      if (matches.length === 1) {
        // Single tool call - use safer JSON parsing
        const toolParams = this._safeJSONParse(matches[0][2]);
        if (!toolParams) {
          throw new Error('Failed to parse tool parameters');
        }
        
        return JSON.stringify({
          response: responseText,
          use_tool: {
            name: matches[0][1],
            args: toolParams
          }
        });
      } else {
        // Multiple tool calls
        const tools = [];
        for (const match of matches) {
          const toolParams = this._safeJSONParse(match[2]);
          if (toolParams) {
            tools.push({
              name: match[1],
              args: toolParams
            });
          } else {
            console.warn('❌ Failed to parse tool parameters for:', match[1]);
          }
        }
        
        if (tools.length === 0) {
          throw new Error('No valid tool calls parsed');
        }
        
        return JSON.stringify({
          response: responseText,
          use_tools: tools
        });
      }
    } catch (error) {
      console.error('❌ XML preprocessing failed:', error.message);
      return JSON.stringify({
        response: content
      });
    }
  }

  /**
   * Manually extract tool calls to handle complex nested quotes
   * @private
   */
  _extractToolCallsManually(content) {
    const matches = [];
    let searchStart = 0;
    
    while (true) {
      // Find next tool_use start
      const startTag = content.indexOf('<tool_use name="', searchStart);
      if (startTag === -1) break;
      
      // Extract name
      const nameStart = startTag + 16; // Length of '<tool_use name="'
      const nameEnd = content.indexOf('"', nameStart);
      if (nameEnd === -1) break;
      const name = content.substring(nameStart, nameEnd);
      
      // Find parameters start
      const paramStart = content.indexOf(" parameters='", nameEnd);
      if (paramStart === -1) break;
      
      // Find matching closing quote for parameters - handle nested quotes properly
      const paramValueStart = paramStart + 13; // Length of " parameters='"
      let paramValueEnd = paramValueStart;
      let inQuotes = false;
      let escaped = false;
      
      for (let i = paramValueStart; i < content.length; i++) {
        const char = content[i];
        
        if (escaped) {
          escaped = false;
          continue;
        }
        
        if (char === '\\') {
          escaped = true;
          continue;
        }
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "'" && !inQuotes) {
          // Found the closing quote outside of JSON string quotes
          paramValueEnd = i;
          break;
        }
      }
      
      if (paramValueEnd === paramValueStart) break;
      
      // Extract parameters
      const parameters = content.substring(paramValueStart, paramValueEnd);
      
      // Find closing tag
      const closeTag = content.indexOf('</tool_use>', paramValueEnd);
      if (closeTag === -1) break;
      
      matches.push([
        content.substring(startTag, closeTag + 11), // Full match
        name,
        parameters
      ]);
      
      searchStart = closeTag + 11;
    }
    
    return matches;
  }

  /**
   * Safely parse JSON with better error handling for complex nested quotes
   * @private
   */
  _safeJSONParse(jsonString) {
    try {
      // First try normal JSON.parse
      return JSON.parse(jsonString);
    } catch (error) {
      try {
        // More aggressive JSON fixing for complex nested quotes
        let fixed = jsonString;
        
        // Fix escaped quotes in nested JSON strings
        fixed = fixed.replace(/\\\\"/g, '\\"'); // Fix double-escaped quotes
        
        // Handle nested single quotes in JSON values
        // Look for patterns like: "key": "value with 'nested' quotes"
        fixed = fixed.replace(/"([^"]*)'([^']*)'([^"]*)"/g, '"$1\\"$2\\"$3"');
        
        // Fix common curl command patterns
        if (fixed.includes('curl') && fixed.includes('-d')) {
          // Extract the curl command and properly escape it
          const curlMatch = fixed.match(/"command":\s*"(curl[^"]*(?:\\.[^"]*)*)"/);
          if (curlMatch) {
            let curlCmd = curlMatch[1];
            // Properly escape quotes in curl command
            curlCmd = curlCmd.replace(/\\"/g, '\\\\"'); // Double escape quotes
            fixed = fixed.replace(curlMatch[0], `"command": "${curlCmd}"`);
          }
        }
        
        return JSON.parse(fixed);
      } catch (error2) {
        // Last resort: Extract just the basic command structure manually
        try {
          const commandMatch = jsonString.match(/"command":\s*"([^"]+(?:\\.[^"]*)*)/);
          if (commandMatch) {
            return {
              command: commandMatch[1].replace(/\\"/g, '"')
            };
          }
        } catch (error3) {
          // Complete failure
        }
        
        console.error('❌ JSON parsing completely failed:', error.message);
        console.error('❌ Failed content:', jsonString.substring(0, 100));
        return null;
      }
    }
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