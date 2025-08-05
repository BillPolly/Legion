/**
 * PlanExecutionLogger - Event listener that captures plan execution events and logs them
 * 
 * This class listens to PlanExecutor events and converts them to structured log entries
 * stored in the workspace LOG_DIR. Maintains clean separation of concerns by not
 * modifying the core PlanExecutor logic.
 */

import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';

export class PlanExecutionLogger extends EventEmitter {
  constructor(logManager, workspaceLogDir) {
    super();
    
    this.logManager = logManager;
    this.workspaceLogDir = workspaceLogDir;
    this.isInitialized = false;
    
    // Log file path will be set during initialization
    this.logFile = null;
    
    // Track execution context for correlation
    this.executionContext = {
      currentPlanId: null,
      currentStepId: null,
      planStartTime: null,
      stepStartTimes: new Map()
    };
  }
  
  /**
   * Initialize the logger and set up log capture sources
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    
    try {
      // Set the log file path
      this.logFile = path.join(this.workspaceLogDir, 'plan-execution.log');
      
      // Ensure log directory exists
      await fs.mkdir(this.workspaceLogDir, { recursive: true });
      
      // Create single log file if it doesn't exist
      try {
        await fs.access(this.logFile);
      } catch {
        await fs.writeFile(this.logFile, '');
      }
      
      this.isInitialized = true;
      this.emit('logger:initialized', { 
        logDir: this.workspaceLogDir,
        logFile: this.logFile
      });
      
    } catch (error) {
      this.emit('logger:error', { 
        message: 'Failed to initialize plan execution logger',
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Attach event listeners to a PlanExecutor instance
   */
  attachToPlanExecutor(planExecutor) {
    // Plan-level events
    planExecutor.on('plan:start', this._handlePlanStart.bind(this));
    planExecutor.on('plan:complete', this._handlePlanComplete.bind(this));
    planExecutor.on('plan:error', this._handlePlanError.bind(this));
    
    // Step-level events  
    planExecutor.on('step:start', this._handleStepStart.bind(this));
    planExecutor.on('step:complete', this._handleStepComplete.bind(this));
    planExecutor.on('step:error', this._handleStepError.bind(this));
    
    this.emit('logger:attached', { 
      message: 'Event listeners attached to PlanExecutor' 
    });
  }
  
  /**
   * Handle plan start events
   */
  async _handlePlanStart(event) {
    this.executionContext.currentPlanId = event.planId;
    this.executionContext.planStartTime = new Date();
    
    const logEntry = this._createLogEntry('info', 'plan:start', {
      planId: event.planId,
      planName: event.planName,
      totalSteps: event.totalSteps,
      timestamp: event.timestamp,
      executionContext: {
        startTime: this.executionContext.planStartTime.toISOString()
      }
    });
    
    await this._writeLogEntry('planExecution', logEntry);
  }
  
  /**
   * Handle plan complete events
   */
  async _handlePlanComplete(event) {
    const executionTime = Date.now() - this.executionContext.planStartTime.getTime();
    
    const logEntry = this._createLogEntry('info', 'plan:complete', {
      planId: event.planId,
      success: event.success,
      completedSteps: event.completedSteps,
      failedSteps: event.failedSteps,
      executionTime: event.executionTime,
      timestamp: event.timestamp,
      executionContext: {
        totalExecutionTime: executionTime,
        endTime: new Date().toISOString()
      }
    });
    
    await this._writeLogEntry('planExecution', logEntry);
    
    // Clear execution context
    this.executionContext.currentPlanId = null;
    this.executionContext.planStartTime = null;
  }
  
  /**
   * Handle plan error events
   */
  async _handlePlanError(event) {
    const logEntry = this._createLogEntry('error', 'plan:error', {
      planId: event.planId,
      error: event.error,
      timestamp: event.timestamp,
      executionContext: {
        failureTime: new Date().toISOString(),
        currentStep: this.executionContext.currentStepId
      }
    });
    
    await this._writeLogEntry('planExecution', logEntry);
  }
  
  /**
   * Handle step start events
   */
  async _handleStepStart(event) {
    this.executionContext.currentStepId = event.stepId;
    this.executionContext.stepStartTimes.set(event.stepId, new Date());
    
    const logEntry = this._createLogEntry('info', 'step:start', {
      planId: event.planId,
      stepId: event.stepId,
      stepName: event.stepName,
      stepPath: event.stepPath,
      timestamp: event.timestamp,
      executionContext: {
        stepStartTime: this.executionContext.stepStartTimes.get(event.stepId).toISOString()
      }
    });
    
    await this._writeLogEntry('stepExecution', logEntry);
  }
  
  /**
   * Handle step complete events
   */
  async _handleStepComplete(event) {
    const stepStartTime = this.executionContext.stepStartTimes.get(event.stepId);
    const stepExecutionTime = stepStartTime ? Date.now() - stepStartTime.getTime() : null;
    
    const logEntry = this._createLogEntry('info', 'step:complete', {
      planId: event.planId,
      stepId: event.stepId,
      stepName: event.stepName,
      stepPath: event.stepPath,
      timestamp: event.timestamp,
      executionContext: {
        stepExecutionTime,
        endTime: new Date().toISOString()
      }
    });
    
    await this._writeLogEntry('stepExecution', logEntry);
    
    // Clean up step timing
    this.executionContext.stepStartTimes.delete(event.stepId);
  }
  
  /**
   * Handle step error events
   */
  async _handleStepError(event) {
    const logEntry = this._createLogEntry('error', 'step:error', {
      planId: event.planId,
      stepId: event.stepId,
      stepName: event.stepName,
      stepPath: event.stepPath,
      error: event.error,
      timestamp: event.timestamp,
      executionContext: {
        failureTime: new Date().toISOString()
      }
    });
    
    await this._writeLogEntry('stepExecution', logEntry);
  }
  
  /**
   * Log tool execution results (can be called manually for tool outputs)
   */
  async logToolExecution(toolName, parameters, result, stepId = null) {
    const logEntry = this._createLogEntry('info', 'tool:execute', {
      toolName,
      parameters,
      result,
      stepId: stepId || this.executionContext.currentStepId,
      planId: this.executionContext.currentPlanId,
      executionContext: {
        executionTime: new Date().toISOString()
      }
    });
    
    await this._writeLogEntry('toolOutputs', logEntry);
  }
  
  /**
   * Create a structured log entry
   */
  _createLogEntry(level, eventType, data) {
    return {
      timestamp: new Date().toISOString(),
      level,
      eventType,
      ...data,
      source: 'plan-executor',
      version: '1.0.0'
    };
  }
  
  /**
   * Write log entry to the appropriate log file
   */
  async _writeLogEntry(logType, logEntry) {
    try {
      // Ensure logger is initialized
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const logLine = JSON.stringify(logEntry) + '\n';
      
      await fs.appendFile(this.logFile, logLine);
      
      // Emit log event for real-time monitoring
      this.emit('log:written', { 
        logType, 
        entry: logEntry 
      });
      
    } catch (error) {
      this.emit('logger:error', {
        message: 'Failed to write log entry',
        logType,
        error: error.message
      });
    }
  }
  
  /**
   * Get current execution context
   */
  getExecutionContext() {
    return { ...this.executionContext };
  }
  
  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      // Clear execution context
      this.executionContext = {
        currentPlanId: null,
        currentStepId: null,
        planStartTime: null,
        stepStartTimes: new Map()
      };
      
      this.emit('logger:cleanup', { 
        message: 'Plan execution logger cleaned up' 
      });
      
    } catch (error) {
      this.emit('logger:error', {
        message: 'Error during logger cleanup',
        error: error.message
      });
    }
  }
}