/**
 * LLMInteractionNode - Handles LLM interactions with retry logic and tool calling
 * 
 * Manages conversation with LLMs, including streaming responses, tool execution,
 * and robust error handling with retry patterns.
 */

import { BehaviorTreeNode, NodeStatus } from '../../../../shared/actor-BT/src/core/BehaviorTreeNode.js';

export class LLMInteractionNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'llm_interaction';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    // LLM configuration
    this.streaming = config.streaming !== false; // Default to true
    this.includeTools = config.tools !== false;  // Default to true
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
    this.maxIterations = config.maxIterations || 50;
    
    // LLM settings
    this.llmConfig = {
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 2000,
      model: config.model || 'claude-3-5-sonnet-20241022',
      provider: config.provider || 'anthropic'
    };
  }

  async executeNode(context) {
    try {
      const message = context.message;
      if (!message) {
        return this.createFailureResult('No message found in context');
      }
      
      // Get LLM client from resource manager
      const llmClient = await this.getLLMClient(context);
      if (!llmClient) {
        return this.createFailureResult('LLM client not available');
      }
      
      // Build conversation messages
      const messages = await this.buildMessages(context);
      
      // Get available tools if enabled
      const tools = this.includeTools ? await this.getAvailableTools(context) : [];
      
      // Execute LLM interaction with tools if available
      let result;
      if (tools.length > 0 && llmClient.executeWithTools) {
        result = await this.executeWithTools(llmClient, messages, tools, context);
      } else {
        result = await this.executeBasicCompletion(llmClient, messages, context);
      }
      
      return {
        status: NodeStatus.SUCCESS,
        data: {
          response: result.finalResponse,
          toolCalls: result.toolCalls || [],
          iterations: result.iterations || 1,
          conversationUpdated: true,
          llmInteractionComplete: true
        }
      };
      
    } catch (error) {
      return this.createFailureResult(`LLM interaction failed: ${error.message}`, error);
    }
  }
  
  /**
   * Get LLM client from context/resource manager
   */
  async getLLMClient(context) {
    // First check if LLM client is directly available in context
    if (context.llmClient) {
      return context.llmClient;
    }
    
    // Try to create one from resource manager
    if (context.resourceManager && context.resourceManager.createLLMClient) {
      try {
        return await context.resourceManager.createLLMClient(this.llmConfig);
      } catch (error) {
        console.warn('LLMInteractionNode: Failed to create LLM client:', error);
      }
    }
    
    return null;
  }
  
  /**
   * Build conversation messages array
   */
  async buildMessages(context) {
    const messages = [];
    
    // Add system prompt
    if (context.systemPrompt) {
      messages.push({
        role: 'system',
        content: context.systemPrompt
      });
    }
    
    // Add conversation history
    if (context.conversationHistory && Array.isArray(context.conversationHistory)) {
      // Take recent history to manage token usage
      const recentHistory = context.conversationHistory.slice(-20);
      
      for (const historyMessage of recentHistory) {
        if (historyMessage.tool_results) {
          // Handle multiple tool results
          const content = historyMessage.tool_results.map(result => ({
            type: 'tool_result',
            tool_use_id: result.tool_use_id,
            content: result.content
          }));
          
          messages.push({
            role: 'user',
            content: content
          });
        } else if (historyMessage.tool_calls && historyMessage.tool_calls.length > 0) {
          // Assistant message with tool calls
          const content = [];
          
          if (historyMessage.content) {
            content.push({
              type: 'text',
              text: historyMessage.content
            });
          }
          
          for (const toolCall of historyMessage.tool_calls) {
            content.push({
              type: 'tool_use',
              id: toolCall.id,
              name: toolCall.name,
              input: toolCall.input
            });
          }
          
          messages.push({
            role: 'assistant',
            content: content
          });
        } else {
          // Regular message
          messages.push({
            role: historyMessage.role,
            content: historyMessage.content
          });
        }
      }
    }
    
    // Add current user message if not already in history
    const currentMessage = context.message.content;
    if (currentMessage && !this.isMessageInHistory(currentMessage, context.conversationHistory)) {
      messages.push({
        role: 'user',
        content: currentMessage
      });
    }
    
    return messages;
  }
  
  /**
   * Check if message is already in conversation history
   */
  isMessageInHistory(messageContent, history) {
    if (!history || !Array.isArray(history)) return false;
    
    return history.some(msg => 
      msg.role === 'user' && msg.content === messageContent
    );
  }
  
  /**
   * Get available tools for LLM
   */
  async getAvailableTools(context) {
    const tools = [];
    
    try {
      // Get tools from module loader
      if (context.moduleLoader && context.moduleLoader.toolRegistry) {
        const toolsFromRegistry = Array.from(context.moduleLoader.toolRegistry.values());
        
        for (const tool of toolsFromRegistry) {
          if (tool.toJSON) {
            const toolDef = tool.toJSON();
            
            // Clean schema for Anthropic compatibility
            const inputSchema = this.cleanSchemaForAnthropic(toolDef.inputSchema, toolDef.name);
            
            tools.push({
              name: toolDef.name,
              description: toolDef.description,
              input_schema: inputSchema
            });
          }
        }
      }
      
      // Add complex task handling tool
      tools.push({
        name: 'handle_complex_task',
        description: 'Use this tool when the user asks for something complex that requires multiple steps, planning, or building something significant',
        input_schema: {
          type: 'object',
          properties: {
            task_description: {
              type: 'string',
              description: 'A clear description of what the user wants to build or accomplish'
            }
          },
          required: ['task_description']
        }
      });
      
    } catch (error) {
      console.warn('LLMInteractionNode: Error getting available tools:', error);
    }
    
    return tools;
  }
  
  /**
   * Clean schema for Anthropic's requirements
   */
  cleanSchemaForAnthropic(inputSchema, toolName) {
    const defaultSchema = { type: 'object', properties: {}, required: [] };
    
    if (!inputSchema || typeof inputSchema !== 'object') {
      return defaultSchema;
    }
    
    const cleanSchema = {
      type: inputSchema.type || 'object'
    };
    
    if (cleanSchema.type === 'object') {
      cleanSchema.properties = {};
      
      if (inputSchema.properties && typeof inputSchema.properties === 'object') {
        for (const [key, prop] of Object.entries(inputSchema.properties)) {
          if (!prop || typeof prop !== 'object') continue;
          
          const cleanProp = {};
          if (prop.type) cleanProp.type = prop.type;
          if (prop.description) cleanProp.description = prop.description;
          if (prop.enum) cleanProp.enum = prop.enum;
          if (prop.default !== undefined) cleanProp.default = prop.default;
          
          cleanSchema.properties[key] = cleanProp;
        }
      }
      
      if (Array.isArray(inputSchema.required)) {
        cleanSchema.required = inputSchema.required.filter(field => 
          typeof field === 'string' && cleanSchema.properties[field]
        );
      }
    }
    
    return cleanSchema;
  }
  
  /**
   * Execute LLM with tool calling support
   */
  async executeWithTools(llmClient, messages, tools, context) {
    let currentMessages = messages;
    let iterations = 0;
    let finalResponse = '';
    let allToolCalls = [];
    
    while (iterations < this.maxIterations) {
      iterations++;
      
      // Emit thinking status
      this.emitStreamingEvent(context, 'agent_thinking', { iteration: iterations });
      
      // Call LLM with tools
      const response = await this.callLLMWithRetry(llmClient, currentMessages, tools);
      
      if (response.toolCalls && response.toolCalls.length > 0) {
        // LLM wants to use tools
        allToolCalls.push(...response.toolCalls);
        
        if (response.content) {
          if (iterations === 1) {
            this.emitStreamingEvent(context, 'message', {
              content: response.content,
              isComplete: false
            });
          } else {
            this.emitStreamingEvent(context, 'agent_thought', {
              thought: response.content
            });
          }
        }
        
        // Execute tool calls
        const toolResults = await this.executeToolCalls(response.toolCalls, context);
        
        // Update conversation with assistant message and tool results
        const assistantMessage = {
          role: 'assistant',
          content: response.content || '',
          tool_calls: response.toolCalls
        };
        
        const toolResultsMessage = {
          role: 'user',
          content: JSON.stringify({
            tool_results: toolResults.map(result => ({
              tool_use_id: result.tool_use_id,
              content: result.content
            }))
          }),
          tool_results: toolResults
        };
        
        // Add to conversation history if available
        if (context.conversationHistory) {
          context.conversationHistory.push(assistantMessage);
          context.conversationHistory.push(toolResultsMessage);
        }
        
        // Rebuild messages for next iteration
        currentMessages = await this.buildMessages(context);
      } else {
        // No more tools needed
        finalResponse = response.content || 'Task completed.';
        break;
      }
    }
    
    if (iterations >= this.maxIterations) {
      finalResponse = 'Reached maximum iterations. Task may be incomplete.';
    }
    
    this.emitStreamingEvent(context, 'agent_complete', { iterations });
    
    return {
      finalResponse,
      toolCalls: allToolCalls,
      iterations
    };
  }
  
  /**
   * Execute basic LLM completion without tools
   */
  async executeBasicCompletion(llmClient, messages, context) {
    const prompt = this.messagesToPrompt(messages);
    const response = await this.callLLMWithRetry(llmClient, prompt);
    
    return {
      finalResponse: response,
      toolCalls: [],
      iterations: 1
    };
  }
  
  /**
   * Convert messages to simple prompt string
   */
  messagesToPrompt(messages) {
    return messages.map(msg => {
      if (msg.role === 'system') return `System: ${msg.content}`;
      if (msg.role === 'user') return `Human: ${msg.content}`;
      if (msg.role === 'assistant') return `Assistant: ${msg.content}`;
      return `${msg.role}: ${msg.content}`;
    }).join('\n\n');
  }
  
  /**
   * Call LLM with retry logic
   */
  async callLLMWithRetry(llmClient, messagesOrPrompt, tools = null) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        if (tools && llmClient.executeWithTools) {
          return await llmClient.executeWithTools(messagesOrPrompt, tools, this.llmConfig);
        } else if (llmClient.complete) {
          return await llmClient.complete(messagesOrPrompt, this.llmConfig.maxTokens);
        } else {
          throw new Error('LLM client does not support required methods');
        }
      } catch (error) {
        lastError = error;
        console.warn(`LLMInteractionNode: Attempt ${attempt}/${this.maxRetries} failed:`, error.message);
        
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }
    
    throw lastError;
  }
  
  /**
   * Execute tool calls
   */
  async executeToolCalls(toolCalls, context) {
    const results = [];
    
    for (const toolCall of toolCalls) {
      try {
        this.emitStreamingEvent(context, 'tool_executing', {
          toolName: toolCall.name,
          toolId: toolCall.id,
          parameters: toolCall.input
        });
        
        let result;
        
        if (toolCall.name === 'handle_complex_task') {
          // Delegate to task orchestrator
          result = { success: true, message: 'Task delegated to orchestrator' };
        } else if (context.moduleLoader && context.moduleLoader.hasTool(toolCall.name)) {
          result = await context.moduleLoader.executeTool(toolCall.name, toolCall.input);
        } else {
          result = { success: false, error: `Tool '${toolCall.name}' not found` };
        }
        
        // Filter out large data for LLM
        let resultForLLM = result;
        if (result.imageData || result.data) {
          const { imageData, data, ...sanitized } = result;
          resultForLLM = {
            ...sanitized,
            dataOmitted: true,
            dataType: imageData ? 'image' : 'binary',
            dataSizeKB: (imageData || data) ? Math.round((imageData || data).length / 1024) : 0
          };
        }
        
        results.push({
          tool_use_id: toolCall.id,
          content: JSON.stringify(resultForLLM)
        });
        
        this.emitStreamingEvent(context, 'tool_executed', {
          toolName: toolCall.name,
          success: result.success !== false
        });
        
      } catch (error) {
        results.push({
          tool_use_id: toolCall.id,
          content: JSON.stringify({
            success: false,
            error: error.message
          })
        });
      }
    }
    
    return results;
  }
  
  /**
   * Emit streaming event to remote actor
   */
  emitStreamingEvent(context, eventType, data) {
    if (context.remoteActor && context.remoteActor.receive) {
      context.remoteActor.receive({
        type: eventType,
        ...data,
        sessionId: context.sessionId,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Create failure result
   */
  createFailureResult(message, error = null) {
    return {
      status: NodeStatus.FAILURE,
      data: {
        error: message,
        stackTrace: error?.stack
      }
    };
  }
  
  /**
   * Delay utility
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get node metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      coordinationPattern: 'llm_interaction',
      streaming: this.streaming,
      includeTools: this.includeTools,
      maxRetries: this.maxRetries,
      maxIterations: this.maxIterations,
      llmConfig: this.llmConfig
    };
  }
}