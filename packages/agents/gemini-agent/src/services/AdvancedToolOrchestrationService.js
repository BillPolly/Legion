/**
 * AdvancedToolOrchestrationService - Ported from Gemini CLI coreToolScheduler.ts
 * Provides sophisticated tool validation, scheduling, and execution pipeline
 */

/**
 * Tool call statuses (ported from Gemini CLI)
 */
export const ToolCallStatus = {
  VALIDATING: 'validating',
  SCHEDULED: 'scheduled', 
  EXECUTING: 'executing',
  SUCCESS: 'success',
  ERROR: 'error',
  CANCELLED: 'cancelled',
  AWAITING_APPROVAL: 'awaiting_approval'
};

/**
 * Tool confirmation outcomes (ported from Gemini CLI)
 */
export const ToolConfirmationOutcome = {
  APPROVED: 'approved',
  REJECTED: 'rejected',
  AUTO_APPROVED: 'auto_approved'
};

/**
 * Advanced tool orchestration service (ported from Gemini CLI)
 */
export class AdvancedToolOrchestrationService {
  constructor(resourceManager, toolsModule) {
    this.resourceManager = resourceManager;
    this.toolsModule = toolsModule;
    
    // Tool execution tracking (ported from Gemini CLI)
    this.activeCalls = new Map(); // callId -> ToolCall
    this.completedCalls = [];
    this.callHistory = [];
    this.maxHistorySize = 1000;
    
    // Configuration (ported from Gemini CLI)
    this.config = {
      autoApproveTools: ['read_file', 'list_files', 'grep_search', 'glob_pattern'],
      requireApprovalTools: ['write_file', 'edit_file', 'shell_command', 'smart_edit'],
      dangerousTools: ['shell_command'],
      maxConcurrentCalls: 5,
      defaultTimeout: 30000
    };
  }

  /**
   * Schedule and execute tool call with validation pipeline (ported from Gemini CLI)
   * @param {Object} toolRequest - Tool call request
   * @returns {Promise<Object>} Tool execution result
   */
  async scheduleToolCall(toolRequest) {
    const callId = toolRequest.callId || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    try {
      // Create tool call record (ported from Gemini CLI)
      let toolCall = {
        callId,
        status: ToolCallStatus.VALIDATING,
        request: {
          callId,
          name: toolRequest.toolName,
          args: toolRequest.args,
          isClientInitiated: false,
          prompt_id: toolRequest.promptId || 'unknown'
        },
        startTime,
        tool: null,
        invocation: null
      };
      
      this.activeCalls.set(callId, toolCall);
      
      // Step 1: Validate tool exists (ported validation)
      const tool = this.toolsModule.getTool(toolRequest.toolName);
      if (!tool) {
        return this._handleToolError(toolCall, `Tool not found: ${toolRequest.toolName}`);
      }
      
      toolCall.tool = tool;
      
      // Step 2: Validate parameters (ported validation)
      const validationResult = await this._validateToolParameters(tool, toolRequest.args);
      if (!validationResult.valid) {
        return this._handleToolError(toolCall, `Parameter validation failed: ${validationResult.error}`);
      }
      
      // Step 3: Check if approval is needed (ported from Gemini CLI)
      const needsApproval = this._toolNeedsApproval(toolRequest.toolName, toolRequest.args);
      if (needsApproval) {
        toolCall.status = ToolCallStatus.AWAITING_APPROVAL;
        // For now, auto-approve for web interface
        toolCall.outcome = ToolConfirmationOutcome.AUTO_APPROVED;
      }
      
      // Step 4: Schedule for execution (ported from Gemini CLI)
      toolCall.status = ToolCallStatus.SCHEDULED;
      this.activeCalls.set(callId, toolCall);
      
      // Step 5: Execute tool (ported execution logic)
      return await this._executeTool(toolCall);
      
    } catch (error) {
      const toolCall = this.activeCalls.get(callId);
      return this._handleToolError(toolCall, error.message);
    }
  }

  /**
   * Execute tool with monitoring (ported from Gemini CLI)
   * @param {Object} toolCall - Tool call to execute
   * @returns {Promise<Object>} Execution result
   * @private
   */
  async _executeTool(toolCall) {
    const startTime = Date.now();
    
    try {
      toolCall.status = ToolCallStatus.EXECUTING;
      toolCall.startTime = startTime;
      this.activeCalls.set(toolCall.callId, toolCall);
      
      console.log(`⚙️ Executing tool: ${toolCall.request.name} (${toolCall.callId})`);
      
      // Execute through toolsModule (ported pattern)
      const result = await this.toolsModule.invoke(toolCall.request.name, toolCall.request.args);
      
      const durationMs = Date.now() - startTime;
      
      // Create successful tool call (ported from Gemini CLI)
      const successfulCall = {
        ...toolCall,
        status: ToolCallStatus.SUCCESS,
        response: {
          callId: toolCall.callId,
          result: result,
          error: undefined,
          durationMs
        },
        durationMs
      };
      
      this._completeToolCall(successfulCall);
      
      console.log(`✅ Tool completed: ${toolCall.request.name} (${durationMs}ms)`);
      
      return {
        success: true,
        callId: toolCall.callId,
        result: result,
        durationMs,
        status: ToolCallStatus.SUCCESS
      };
      
    } catch (error) {
      const durationMs = Date.now() - startTime;
      return this._handleToolError(toolCall, error.message, durationMs);
    }
  }

  /**
   * Handle tool execution error (ported from Gemini CLI)
   * @param {Object} toolCall - Tool call that errored
   * @param {string} errorMessage - Error message
   * @param {number} durationMs - Execution duration
   * @returns {Object} Error result
   * @private
   */
  _handleToolError(toolCall, errorMessage, durationMs = 0) {
    const errorCall = {
      ...toolCall,
      status: ToolCallStatus.ERROR,
      response: {
        callId: toolCall.callId,
        result: null,
        error: new Error(errorMessage),
        durationMs
      },
      durationMs
    };
    
    this._completeToolCall(errorCall);
    
    console.error(`❌ Tool error: ${toolCall.request?.name || 'unknown'} - ${errorMessage}`);
    
    return {
      success: false,
      callId: toolCall.callId,
      error: errorMessage,
      durationMs,
      status: ToolCallStatus.ERROR
    };
  }

  /**
   * Complete tool call and move to history (ported from Gemini CLI)
   * @param {Object} completedCall - Completed tool call
   * @private
   */
  _completeToolCall(completedCall) {
    this.activeCalls.delete(completedCall.callId);
    this.completedCalls.push(completedCall);
    this.callHistory.push(completedCall);
    
    // Maintain history size
    if (this.callHistory.length > this.maxHistorySize) {
      this.callHistory = this.callHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Validate tool parameters (ported validation from Gemini CLI)
   * @param {Object} tool - Tool to validate
   * @param {Object} args - Arguments to validate
   * @returns {Object} Validation result
   * @private
   */
  async _validateToolParameters(tool, args) {
    try {
      // Basic validation - real implementation would be more sophisticated
      if (!args || typeof args !== 'object') {
        return { valid: false, error: 'Arguments must be an object' };
      }
      
      // Tool-specific validation
      if (tool.name === 'read_file' && !args.absolute_path) {
        return { valid: false, error: 'absolute_path is required for read_file' };
      }
      
      if (tool.name === 'write_file' && (!args.absolute_path || !args.content)) {
        return { valid: false, error: 'absolute_path and content are required for write_file' };
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Check if tool needs approval (ported from Gemini CLI)
   * @param {string} toolName - Tool name
   * @param {Object} args - Tool arguments
   * @returns {boolean} Whether approval is needed
   * @private
   */
  _toolNeedsApproval(toolName, args) {
    // Auto-approve safe tools
    if (this.config.autoApproveTools.includes(toolName)) {
      return false;
    }
    
    // Require approval for potentially dangerous operations
    if (this.config.requireApprovalTools.includes(toolName)) {
      return true;
    }
    
    // Special case: shell commands with dangerous operations
    if (toolName === 'shell_command' && args.command) {
      const command = args.command.toLowerCase();
      if (command.includes('rm -rf') || command.includes('format') || command.includes('delete')) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get orchestration statistics
   * @returns {Object} Orchestration stats
   */
  getOrchestrationStats() {
    const statusCounts = {};
    for (const call of this.callHistory) {
      statusCounts[call.status] = (statusCounts[call.status] || 0) + 1;
    }
    
    return {
      activeCalls: this.activeCalls.size,
      completedCalls: this.completedCalls.length,
      totalCalls: this.callHistory.length,
      statusBreakdown: statusCounts,
      averageDuration: this._calculateAverageDuration()
    };
  }

  /**
   * Calculate average tool execution duration
   * @returns {number} Average duration in ms
   * @private
   */
  _calculateAverageDuration() {
    const completedWithDuration = this.callHistory.filter(call => call.durationMs > 0);
    if (completedWithDuration.length === 0) return 0;
    
    const totalMs = completedWithDuration.reduce((sum, call) => sum + call.durationMs, 0);
    return Math.round(totalMs / completedWithDuration.length);
  }

  /**
   * Get active tool calls
   * @returns {Array} Currently executing tools
   */
  getActiveCalls() {
    return Array.from(this.activeCalls.values());
  }

  /**
   * Get recent tool call history
   * @param {number} limit - Number of recent calls
   * @returns {Array} Recent tool calls
   */
  getRecentCalls(limit = 10) {
    return this.callHistory.slice(-limit);
  }

  /**
   * Clear orchestration data (for testing)
   */
  clearOrchestrationData() {
    this.activeCalls.clear();
    this.completedCalls = [];
    this.callHistory = [];
  }
}

export default AdvancedToolOrchestrationService;