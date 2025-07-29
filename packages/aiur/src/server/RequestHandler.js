/**
 * RequestHandler - Processes MCP requests on the server side
 * 
 * Handles tool listing, tool execution, and resource listing for each session
 */

export class RequestHandler {
  constructor(config) {
    this.sessionManager = config.sessionManager;
    this.logManager = config.logManager;
  }

  /**
   * Initialize the request handler
   */
  async initialize() {
    await this.logManager.logInfo('RequestHandler initialized', {
      source: 'RequestHandler',
      operation: 'initialize'
    });
  }

  /**
   * Handle an MCP request
   * @param {Object} request - The request object
   * @param {string} sessionId - Session ID
   * @returns {Object} Response object
   */
  async handleRequest(request, sessionId) {
    const session = this.sessionManager.getSession(sessionId);
    
    if (!session) {
      return {
        error: {
          code: -32001,
          message: 'Session not found'
        }
      };
    }
    
    try {
      switch (request.method) {
        case 'tools/list':
          return await this._handleToolsList(session);
          
        case 'tools/call':
          return await this._handleToolCall(request.params, session);
          
        case 'resources/list':
          return await this._handleResourcesList(session);
          
        default:
          return {
            error: {
              code: -32601,
              message: `Method not found: ${request.method}`
            }
          };
      }
    } catch (error) {
      await this.logManager.logError(error, {
        source: 'RequestHandler',
        operation: 'handle-request',
        method: request.method,
        sessionId,
        severity: 'error'
      });
      
      return {
        error: {
          code: -32603,
          message: error.message
        }
      };
    }
  }

  /**
   * Handle tools/list request
   * @private
   */
  async _handleToolsList(session) {
    try {
      // Ensure debug tools are set up for this session
      await this.ensureDebugTools(session);
      
      // Get all tool definitions from the session's provider
      const tools = await session.toolProvider.getAllToolDefinitions();
      
      await this.logManager.logInfo('Listed tools for session', {
        source: 'RequestHandler',
        operation: 'tools-list',
        sessionId: session.id,
        toolCount: tools.length
      });
      
      return {
        tools
      };
    } catch (error) {
      await this.logManager.logError(error, {
        source: 'RequestHandler',
        operation: 'tools-list-error',
        sessionId: session.id
      });
      throw error;
    }
  }

  /**
   * Handle tools/call request
   * @private
   */
  async _handleToolCall(params, session) {
    const { name, arguments: args = {} } = params;
    
    await this.logManager.logInfo('Tool call request', {
      source: 'RequestHandler',
      operation: 'tool-call-start',
      sessionId: session.id,
      tool: name
    });
    
    try {
      // Ensure debug tools are set up for this session
      await this.ensureDebugTools(session);
      
      // Check if tool exists
      if (!await session.toolProvider.toolExists(name)) {
        throw new Error(`Unknown tool: ${name}`);
      }
      
      // Resolve any handle references in the arguments
      let resolvedArgs = args;
      try {
        resolvedArgs = session.handleResolver.resolveParameters(args);
      } catch (resolutionError) {
        await this.logManager.logError(resolutionError, {
          source: 'RequestHandler',
          operation: 'parameter-resolution',
          sessionId: session.id,
          tool: name
        });
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `Parameter resolution failed: ${resolutionError.message}`
            }, null, 2)
          }],
          isError: true
        };
      }
      
      // Execute the tool
      const result = await session.toolProvider.executeTool(name, resolvedArgs);
      
      // Handle auto-save if requested
      if (resolvedArgs.saveAs && !result.isError) {
        await this._handleAutoSave(session, name, resolvedArgs, result);
      }
      
      // Update session metadata
      session.metadata.toolCalls++;
      
      await this.logManager.logInfo('Tool call completed', {
        source: 'RequestHandler',
        operation: 'tool-call-complete',
        sessionId: session.id,
        tool: name,
        isError: result.isError
      });
      
      return result;
      
    } catch (error) {
      session.metadata.errors++;
      
      await this.logManager.logError(error, {
        source: 'RequestHandler',
        operation: 'tool-call-error',
        sessionId: session.id,
        tool: name
      });
      
      return {
        content: [{
          type: "text",
          text: `Error executing tool ${name}: ${error.message}`
        }],
        isError: true
      };
    }
  }

  /**
   * Handle resources/list request
   * @private
   */
  async _handleResourcesList(session) {
    // Currently no resources exposed
    return {
      resources: []
    };
  }

  /**
   * Ensure debug tools are set up for the session
   * @param {Object} session - The session object
   * @deprecated Debug tools have been moved to separate aiur-debug-ui package
   */
  async ensureDebugTools(session) {
    // Debug tools have been moved to a separate package
    // This method is kept for compatibility but does nothing
    return;
  }

  /**
   * Handle auto-save functionality
   * @private
   */
  async _handleAutoSave(session, toolName, args, result) {
    try {
      // Parse the result to check if it was successful
      const resultData = JSON.parse(result.content[0].text);
      
      if (resultData.success) {
        const contextName = args.saveAs;
        const contextData = {
          data: resultData,
          description: `Result from ${toolName} tool`,
          addedAt: new Date().toISOString(),
          type: 'context',
          sourceTool: toolName,
          sourceArgs: args
        };
        
        // Use context manager to save the result
        const contextResult = await session.context.executeContextTool('context_add', {
          name: contextName,
          data: resultData,
          description: contextData.description
        });
        
        // Add save confirmation to result
        if (!contextResult.isError) {
          resultData.savedToContext = {
            contextName: contextName,
            handleId: contextResult.handleId,
            message: `Result saved to context as '${contextName}'`
          };
          
          // Update the result content
          result.content[0].text = JSON.stringify(resultData, null, 2);
          
          await this.logManager.logInfo('Auto-saved tool result to context', {
            source: 'RequestHandler',
            operation: 'auto-save',
            sessionId: session.id,
            tool: toolName,
            contextName
          });
        } else {
          resultData.contextWarning = `Failed to save to context: ${contextResult.content[0].text}`;
          result.content[0].text = JSON.stringify(resultData, null, 2);
        }
      }
    } catch (error) {
      await this.logManager.logError(error, {
        source: 'RequestHandler',
        operation: 'auto-save-failed',
        sessionId: session.id,
        tool: toolName,
        severity: 'warning'
      });
      // Don't fail the original request, just log the warning
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    await this.logManager.logInfo('RequestHandler cleaned up', {
      source: 'RequestHandler',
      operation: 'cleanup'
    });
  }
}

export default RequestHandler;