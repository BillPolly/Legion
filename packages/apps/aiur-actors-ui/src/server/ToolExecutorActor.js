/**
 * ToolExecutorActor - Executes Legion tools on the server
 */

export class ToolExecutorActor {
  constructor(toolRegistry, sessionManager) {
    this.isActor = true;
    this.toolRegistry = toolRegistry;
    this.sessionManager = sessionManager;
    
    // Metrics tracking
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      toolMetrics: {}
    };
  }

  /**
   * Receive and handle messages
   * @param {Object} message - Incoming message
   */
  async receive(message) {
    switch (message.type) {
      case 'tool_execution':
        await this.handleToolExecution(message);
        break;
        
      case 'get_tools':
        this.handleGetTools(message);
        break;
        
      default:
        console.warn('ToolExecutorActor: Unknown message type', message.type);
    }
  }

  /**
   * Handle tool execution request
   * @private
   */
  async handleToolExecution(message) {
    const { tool, args, requestId, sessionId } = message;
    
    this.metrics.totalExecutions++;
    
    // Get tool from registry
    const toolInstance = this.toolRegistry.getTool(tool);
    
    if (!toolInstance) {
      this.metrics.failedExecutions++;
      this.reply({
        type: 'execution_result',
        requestId,
        success: false,
        error: `Tool not found: ${tool}`
      });
      return;
    }
    
    // Get or create session
    let session = this.sessionManager.getSession(sessionId);
    if (!session && sessionId) {
      session = this.sessionManager.createSession(sessionId);
    }
    
    try {
      // Execute tool
      const result = await toolInstance.execute(args, session);
      
      this.metrics.successfulExecutions++;
      this.updateToolMetrics(tool, true);
      
      // Emit execution event
      this.emit('tool_executed', {
        tool,
        args,
        sessionId,
        success: true
      });
      
      // Send result
      this.reply({
        type: 'execution_result',
        requestId,
        success: true,
        result
      });
      
    } catch (error) {
      this.metrics.failedExecutions++;
      this.updateToolMetrics(tool, false);
      
      // Emit execution event
      this.emit('tool_executed', {
        tool,
        args,
        sessionId,
        success: false,
        error: error.message
      });
      
      // Send error
      this.reply({
        type: 'execution_result',
        requestId,
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Handle get tools request
   * @private
   */
  handleGetTools(message) {
    const { requestId } = message;
    
    const tools = this.toolRegistry.getAllTools();
    
    this.reply({
      type: 'tools_list',
      requestId,
      tools
    });
  }

  /**
   * Update tool-specific metrics
   * @private
   */
  updateToolMetrics(toolName, success) {
    if (!this.metrics.toolMetrics[toolName]) {
      this.metrics.toolMetrics[toolName] = {
        executions: 0,
        successes: 0,
        failures: 0,
        lastExecution: null
      };
    }
    
    const toolMetric = this.metrics.toolMetrics[toolName];
    toolMetric.executions++;
    
    if (success) {
      toolMetric.successes++;
    } else {
      toolMetric.failures++;
    }
    
    toolMetric.lastExecution = Date.now();
  }

  /**
   * Get execution metrics
   * @returns {Object} Metrics object
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Reply method (set by ActorSpace)
   */
  reply(message) {
    throw new Error('Reply method not initialized');
  }

  /**
   * Emit method (set by ActorSpace)
   */
  emit(event, data) {
    // Default no-op, overridden by ActorSpace
  }
}