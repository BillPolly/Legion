/**
 * ConversationManager - Ported from Gemini CLI turn management to Legion patterns
 * Manages turn-based conversations with tool integration
 */

import GeminiPromptManager from '../prompts/GeminiPromptManager.js';
import GeminiToolsModule from '../../../modules/gemini-tools/src/GeminiToolsModule.js';

/**
 * Manages conversation flow and turn-based dialogue (ported from Gemini CLI)
 */
export class ConversationManager {
  constructor(resourceManager, geminiToolsModule) {
    this.resourceManager = resourceManager;
    this.geminiToolsModule = geminiToolsModule;
    this.promptManager = new GeminiPromptManager(resourceManager);
    
    // Initialize tools module directly (no registry)
    this._initializeToolsModule();
    
    // Conversation state (ported from Gemini CLI)
    this.conversationHistory = [];
    this.currentContext = {
      workingDirectory: process.cwd(),
      recentFiles: [],
      environment: {}
    };
    this.turnCounter = 0;
  }

  /**
   * Process a user message and generate response (main conversation entry point)
   * Ported from Gemini CLI's turn management
   * @param {string} userInput - User's message
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response object
   */
  async processMessage(userInput, options = {}) {
    if (!userInput || typeof userInput !== 'string') {
      throw new Error('User input must be a non-empty string');
    }

    this.turnCounter++;

    // Create user turn (ported from Gemini CLI Turn structure)
    const userTurn = {
      id: `turn_${this.turnCounter}_user`,
      type: 'user',
      content: userInput.trim(),
      tools: [],
      timestamp: new Date().toISOString()
    };

    // Add to conversation history
    this.conversationHistory.push(userTurn);

    // Build system prompt with current context
    const systemPrompt = await this.promptManager.buildSystemPrompt();
    
    // Get LLM client from ResourceManager (Legion pattern)
    const llmClient = await this.resourceManager.get('llmClient');
    
    // Prepare conversation context for LLM
    const conversationContext = this.buildConversationContext();
    
    // Generate response using real LLM
    const response = await this.generateResponse(userInput, systemPrompt, conversationContext, llmClient);

    // Create assistant turn
    const assistantTurn = {
      id: `turn_${this.turnCounter}_assistant`,
      type: 'assistant',
      content: response.content,
      tools: response.tools || [],
      timestamp: new Date().toISOString()
    };

    // Add to conversation history
    this.conversationHistory.push(assistantTurn);

    return assistantTurn;
  }

  /**
   * Generate response using real LLM client (ported logic from Gemini CLI)
   * @param {string} userInput - User's input
   * @param {string} systemPrompt - System prompt
   * @param {string} context - Conversation context
   * @param {Object} llmClient - Real LLM client
   * @returns {Promise<Object>} Generated response
   */
  async generateResponse(userInput, systemPrompt, context, llmClient) {
    try {
      // Ensure tools module is initialized
      if (!this.geminiToolsModule) {
        await this._initializeToolsModule();
      }

      // Build tool-calling prompt (using Gemini CLI patterns)
      const toolCallingPrompt = this.buildToolCallingPrompt(userInput, `${systemPrompt}\n\n${context}`);

      // Call real LLM client for tool calling (NO MOCKS)
      const llmResponse = await llmClient.complete(toolCallingPrompt);

      // Parse response for tool calls
      const toolCalls = this.parseToolCalls(llmResponse);

      let finalResponse = llmResponse;
      const executedTools = [];

      // Execute any tool calls found (Legion pattern)
      for (const toolCall of toolCalls) {
        try {
          console.log(`🔧 Executing tool: ${toolCall.name}`, toolCall.args);
          
          // Use Legion pattern: await tool.execute(jsonArgs)
          const toolResult = await this.executeTool(toolCall.name, toolCall.args);
          
          console.log(`✅ Tool result:`, toolResult);
          
          executedTools.push({
            name: toolCall.name,
            args: toolCall.args,
            result: toolResult
          });

          // Add tool result to conversation context
          finalResponse += `\n\nTool ${toolCall.name} executed successfully: ${JSON.stringify(toolResult)}`;
          
        } catch (toolError) {
          console.error(`❌ Tool execution failed:`, toolError.message);
          finalResponse += `\n\nTool ${toolCall.name} failed: ${toolError.message}`;
        }
      }

      return {
        content: finalResponse,
        tools: executedTools
      };
      
    } catch (error) {
      // Legion pattern: fail fast
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  /**
   * Build conversation context string (ported from Gemini CLI)
   * @returns {string} Formatted conversation context
   */
  buildConversationContext() {
    if (this.conversationHistory.length === 0) {
      return '';
    }

    // Build context from recent turns (ported logic)
    const recentTurns = this.conversationHistory.slice(-10); // Last 10 turns
    
    let context = '# Conversation History\n\n';
    for (const turn of recentTurns) {
      context += `**${turn.type.toUpperCase()}**: ${turn.content}\n\n`;
    }

    return context;
  }

  /**
   * Get conversation history
   * @returns {Array} Copy of conversation history
   */
  getConversationHistory() {
    return [...this.conversationHistory];
  }

  /**
   * Get current context
   * @returns {Object} Current conversation context
   */
  getCurrentContext() {
    return { ...this.currentContext };
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
    this.turnCounter = 0;
  }

  /**
   * Update working directory context
   * @param {string} directory - New working directory
   */
  updateWorkingDirectory(directory) {
    this.currentContext.workingDirectory = directory;
  }

  /**
   * Add file to recent files tracking
   * @param {string} filePath - File that was accessed
   */
  addRecentFile(filePath) {
    if (!this.currentContext.recentFiles.includes(filePath)) {
      this.currentContext.recentFiles.unshift(filePath);
      // Keep only recent 20 files
      this.currentContext.recentFiles = this.currentContext.recentFiles.slice(0, 20);
    }
  }

  /**
   * Initialize tools module directly (Legion pattern)
   */
  async _initializeToolsModule() {
    try {
      if (!this.geminiToolsModule) {
        // Create GeminiToolsModule directly
        this.geminiToolsModule = await GeminiToolsModule.create(this.resourceManager);
      }
    } catch (error) {
      console.warn('Failed to initialize tools module:', error.message);
    }
  }

  /**
   * Execute tool using Legion pattern (tool.execute(jsonArgs))
   * @param {string} toolName - Name of the tool
   * @param {Object} args - Tool arguments
   * @returns {Promise<Object>} Tool result
   */
  async executeTool(toolName, args) {
    if (!this.geminiToolsModule) {
      throw new Error('Tools module not initialized');
    }

    try {
      // Use Legion pattern: module.invoke() -> tool.execute(args)
      const result = await this.geminiToolsModule.invoke(toolName, args);
      return result;
    } catch (error) {
      throw new Error(`Tool execution failed: ${error.message}`);
    }
  }

  /**
   * Parse tool calls from LLM response (using PromptManager patterns)
   * @param {string} response - LLM response text
   * @returns {Array} Parsed tool calls
   */
  parseToolCalls(response) {
    const toolCalls = [];
    
    try {
      // Try to parse the entire response as JSON first
      const parsed = JSON.parse(response);
      if (parsed.use_tool && parsed.use_tool.name && parsed.use_tool.args) {
        toolCalls.push({
          name: parsed.use_tool.name,
          args: parsed.use_tool.args
        });
      }
    } catch (error) {
      // If full response isn't JSON, look for JSON blocks
      const lines = response.split('\\n');
      let jsonBlock = '';
      let inJsonBlock = false;
      let braceCount = 0;
      
      for (const line of lines) {
        if (line.trim().startsWith('{')) {
          inJsonBlock = true;
          braceCount = 0;
        }
        
        if (inJsonBlock) {
          jsonBlock += line + '\\n';
          
          // Count braces to find end of JSON
          for (const char of line) {
            if (char === '{') braceCount++;
            if (char === '}') braceCount--;
          }
          
          // End of JSON block
          if (braceCount === 0) {
            try {
              const parsed = JSON.parse(jsonBlock.trim());
              if (parsed.use_tool && parsed.use_tool.name && parsed.use_tool.args) {
                toolCalls.push({
                  name: parsed.use_tool.name,
                  args: parsed.use_tool.args
                });
              }
            } catch (parseError) {
              // Skip invalid JSON block
            }
            
            jsonBlock = '';
            inJsonBlock = false;
          }
        }
      }
    }

    return toolCalls;
  }

  /**
   * Build tool-calling prompt (using Gemini CLI patterns)
   * @param {string} userInput - User's request
   * @param {string} context - Conversation context
   * @returns {string} Prompt requesting tool usage
   */
  buildToolCallingPrompt(userInput, context) {
    return `${context}

User Request: ${userInput}

Please analyze this request and if it requires tool usage, respond with JSON in this exact format:
{
  "response": "Your response to the user",
  "use_tool": {
    "name": "tool_name", 
    "args": {"param1": "value1", "param2": "value2"}
  }
}

Available tools: read_file, write_file, edit_file, list_files, grep_search, shell_command, save_memory, smart_edit, read_many_files, glob_pattern, web_fetch, web_search, ripgrep_search

If no tools are needed, just respond normally. If tools are needed, include the use_tool section.`;
  }
}

export default ConversationManager;