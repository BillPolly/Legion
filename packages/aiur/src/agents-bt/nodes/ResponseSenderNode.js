/**
 * ResponseSenderNode - Sends responses back to remote actors
 * 
 * Handles sending various types of responses and messages
 * back to remote actors in agent workflows.
 */

import { BehaviorTreeNode, NodeStatus } from '../../../../shared/actor-BT/src/core/BehaviorTreeNode.js';

export class ResponseSenderNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'response_sender';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    // Use responseType from config, NOT type (which is the node type)
    this.responseType = config.responseType || config.type || 'chat_response';
    this.content = config.content || null;
    this.includeContext = config.includeContext !== false;
  }

  async executeNode(context) {
    try {
      if (!context.remoteActor) {
        console.warn('ResponseSenderNode: No remote actor to send response to');
        // Still mark that we tried to send a response to prevent duplicate processing
        context.responseSent = true;
        return {
          status: NodeStatus.SUCCESS,
          data: { 
            message: 'No remote actor available',
            responseSent: true,
            responseType: this.responseType
          }
        };
      }
      
      // Build response message
      const response = this.buildResponse(context);
      
      // Send response
      context.remoteActor.receive(response);
      
      // Mark that response was already sent to prevent duplicate sending
      context.responseSent = true;
      context.sentResponse = response;
      
      return {
        status: NodeStatus.SUCCESS,
        data: {
          responseSent: true,
          responseType: response.type,
          contentLength: response.content ? response.content.length : 0
        }
      };
      
    } catch (error) {
      return {
        status: NodeStatus.FAILURE,
        data: {
          error: error.message,
          stackTrace: error.stack
        }
      };
    }
  }
  
  /**
   * Build response message
   */
  buildResponse(context) {
    const baseResponse = {
      type: this.responseType,
      sessionId: context.sessionId,
      timestamp: new Date().toISOString()
    };
    
    // Add request ID if available
    if (context.message?.requestId) {
      baseResponse.requestId = context.message.requestId;
    }
    
    // Add content based on type
    switch (this.responseType) {
      case 'chat_response':
        return this.buildChatResponse(baseResponse, context);
      case 'tool_response':
        return this.buildToolResponse(baseResponse, context);
      case 'tools_list_response':
      case 'tools_list':
        return this.buildToolsListResponse(baseResponse, context);
      case 'module_list_response':
        return this.buildModuleListResponse(baseResponse, context);
      case 'module_loaded':
      case 'module_unloaded':
        return this.buildModuleResponse(baseResponse, context);
      case 'pong':
        return this.buildPongResponse(baseResponse, context);
      case 'error':
        return this.buildErrorResponse(baseResponse, context);
      case 'status':
        return this.buildStatusResponse(baseResponse, context);
      default:
        return this.buildGenericResponse(baseResponse, context);
    }
  }
  
  /**
   * Build chat response
   */
  buildChatResponse(baseResponse, context) {
    const response = { ...baseResponse };
    
    // Get response content
    if (this.content) {
      response.content = this.substitutePlaceholders(this.content, context);
    } else if (context.response) {
      response.content = typeof context.response === 'string' ? 
        context.response : context.response.content;
    } else if (context.llmResponse) {
      response.content = context.llmResponse;
    } else {
      response.content = 'Task completed successfully.';
    }
    
    // Add completion status
    response.isComplete = context.isComplete !== false;
    
    // Add artifacts if available
    if (context.artifacts && Object.keys(context.artifacts).length > 0) {
      response.artifacts = context.artifacts;
    }
    
    // Add voice data if available
    if (context.voiceData) {
      response.voiceData = context.voiceData;
    }
    
    return response;
  }
  
  /**
   * Build tool response
   */
  buildToolResponse(baseResponse, context) {
    const response = { ...baseResponse };
    
    // Add tool information
    if (context.toolName) {
      response.tool = context.toolName;
    }
    
    // Add tool result
    if (context.toolResult) {
      response.result = context.toolResult;
    } else if (context.response) {
      response.result = context.response;
    }
    
    // Add success status
    response.success = context.toolResult ? 
      (context.toolResult.success !== false) : true;
    
    return response;
  }
  
  /**
   * Build error response
   */
  buildErrorResponse(baseResponse, context) {
    const response = { ...baseResponse };
    
    // Get error message
    if (this.content) {
      response.error = this.substitutePlaceholders(this.content, context);
    } else if (context.error) {
      response.error = typeof context.error === 'string' ? 
        context.error : context.error.message;
    } else {
      response.error = 'An error occurred during processing';
    }
    
    // Add tool context if this was a tool error
    if (context.toolName) {
      response.tool = context.toolName;
    }
    
    return response;
  }
  
  /**
   * Build status response
   */
  buildStatusResponse(baseResponse, context) {
    const response = { ...baseResponse };
    
    // Add status message
    if (this.content) {
      response.message = this.substitutePlaceholders(this.content, context);
    } else if (context.statusMessage) {
      response.message = context.statusMessage;
    } else {
      response.message = 'Status update';
    }
    
    // Add progress if available
    if (context.progress !== undefined) {
      response.progress = context.progress;
    }
    
    return response;
  }
  
  /**
   * Build tools list response
   */
  buildToolsListResponse(baseResponse, context) {
    const response = { 
      ...baseResponse,
      type: 'tools_list'  // Ensure correct type for frontend
    };
    
    
    // The tools list should be in the execution context from previous node results
    // Check the parent execution result for ToolsListNode data
    let tools = null;
    
    // First check if tools are directly in context
    if (context.tools) {
      tools = context.tools;
    } else if (context.toolsList) {
      tools = context.toolsList;
    } else if (context.data?.tools) {
      tools = context.data.tools;
    } else {
      // Look for tools in the execution result from previous steps
      // The BT executor should have the results from the ToolsListNode
      if (context.previousNodeResult?.data?.tools) {
        tools = context.previousNodeResult.data.tools;
      } else if (context.executionResult?.data?.tools) {
        tools = context.executionResult.data.tools;
      }
    }
    
    response.tools = tools || [];
    
    return response;
  }
  
  /**
   * Build module list response
   */
  buildModuleListResponse(baseResponse, context) {
    const response = { 
      ...baseResponse,
      type: 'module_list_response'
    };
    
    // Find modules data in context
    if (context.modules) {
      response.modules = context.modules;
    } else if (context.modulesList) {
      response.modules = context.modulesList;
    } else if (context.data?.modules) {
      response.modules = context.data.modules;
    } else {
      // Fallback: empty modules list
      response.modules = { loaded: [], available: [] };
    }
    
    return response;
  }
  
  /**
   * Build module loaded/unloaded response
   */
  buildModuleResponse(baseResponse, context) {
    const response = { ...baseResponse };
    
    // Add module name
    if (context.moduleName) {
      response.moduleName = context.moduleName;
    } else if (context.message?.moduleName) {
      response.moduleName = context.message.moduleName;
    }
    
    // Add message
    if (this.content) {
      response.message = this.substitutePlaceholders(this.content, context);
    } else {
      response.message = `Module ${response.moduleName} ${this.responseType === 'module_loaded' ? 'loaded' : 'unloaded'} successfully`;
    }
    
    // Add loaded tools for module_loaded
    if (this.responseType === 'module_loaded' && context.loadedTools) {
      response.toolsLoaded = context.loadedTools;
    }
    
    return response;
  }
  
  /**
   * Build pong response
   */
  buildPongResponse(baseResponse, context) {
    const response = { 
      ...baseResponse,
      type: 'pong'
    };
    
    // Add content
    if (this.content) {
      response.content = this.substitutePlaceholders(this.content, context);
    } else {
      response.content = 'pong';
    }
    
    return response;
  }
  
  /**
   * Build generic response
   */
  buildGenericResponse(baseResponse, context) {
    const response = { ...baseResponse };
    
    // Add content if specified
    if (this.content) {
      response.content = this.substitutePlaceholders(this.content, context);
    }
    
    // Add response data from context
    if (context.response && typeof context.response === 'object') {
      Object.assign(response, context.response);
    }
    
    return response;
  }
  
  /**
   * Send streaming response (for progressive content)
   */
  sendStreamingResponse(context, chunk) {
    if (!context.remoteActor) return;
    
    context.remoteActor.receive({
      type: 'stream',
      content: chunk,
      sessionId: context.sessionId,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Send multiple responses (batch)
   */
  sendBatchResponses(context, responses) {
    if (!context.remoteActor) return;
    
    for (const response of responses) {
      const fullResponse = {
        ...response,
        sessionId: context.sessionId,
        timestamp: new Date().toISOString()
      };
      
      if (context.message?.requestId) {
        fullResponse.requestId = context.message.requestId;
      }
      
      context.remoteActor.receive(fullResponse);
    }
  }
  
  /**
   * Send notification (fire-and-forget style message)
   */
  sendNotification(context, type, data) {
    if (!context.remoteActor) return;
    
    context.remoteActor.receive({
      type: type,
      ...data,
      sessionId: context.sessionId,
      timestamp: new Date().toISOString(),
      notification: true
    });
  }
  
  /**
   * Get metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      coordinationPattern: 'response_sending',
      responseType: this.responseType,
      includeContext: this.includeContext,
      supportsResponseTypes: [
        'chat_response',
        'tool_response', 
        'error',
        'status',
        'custom'
      ]
    };
  }
}