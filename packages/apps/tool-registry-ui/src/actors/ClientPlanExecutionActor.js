/**
 * ClientPlanExecutionActor - Client-side actor for plan execution operations
 * Handles execution control, progress tracking, and result management
 */

export class ClientPlanExecutionActor {
  constructor(applicationContext) {
    this.applicationContext = applicationContext;
    this.remoteActor = null;
    this.activeExecutions = new Map();
    this.currentExecution = null;
  }

  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
  }

  async onConnected() {
    console.log('✅ Execution actor connected');
    this.applicationContext.updateState?.('executionAvailable', true);
  }

  /**
   * Start plan execution
   */
  async startExecution(planId, behaviorTree, options = {}) {
    if (!this.remoteActor) {
      throw new Error('Execution actor not connected');
    }

    const executionId = `exec-${Date.now()}`;

    // Update UI state
    this.applicationContext.updateState?.('executionStatus', 'starting');
    this.applicationContext.updateState?.('currentExecutionId', executionId);

    // Send execution start request
    await this.remoteActor.receive({
      type: 'execution:start',
      data: {
        executionId,
        planId,
        behaviorTree,
        options
      }
    });

    return executionId;
  }

  /**
   * Pause execution
   */
  async pauseExecution(executionId) {
    if (!this.remoteActor) {
      throw new Error('Execution actor not connected');
    }

    await this.remoteActor.receive({
      type: 'execution:pause',
      data: { executionId }
    });
  }

  /**
   * Resume execution
   */
  async resumeExecution(executionId) {
    if (!this.remoteActor) {
      throw new Error('Execution actor not connected');
    }

    await this.remoteActor.receive({
      type: 'execution:resume',
      data: { executionId }
    });
  }

  /**
   * Stop execution
   */
  async stopExecution(executionId) {
    if (!this.remoteActor) {
      throw new Error('Execution actor not connected');
    }

    await this.remoteActor.receive({
      type: 'execution:stop',
      data: { executionId }
    });
  }

  /**
   * Step through execution
   */
  async stepExecution(executionId) {
    if (!this.remoteActor) {
      throw new Error('Execution actor not connected');
    }

    await this.remoteActor.receive({
      type: 'execution:step',
      data: { executionId }
    });
  }

  /**
   * Get execution status
   */
  async getExecutionStatus(executionId) {
    if (!this.remoteActor) {
      throw new Error('Execution actor not connected');
    }

    await this.remoteActor.receive({
      type: 'execution:status',
      data: { executionId }
    });
  }

  /**
   * List active executions
   */
  async listExecutions() {
    if (!this.remoteActor) {
      throw new Error('Execution actor not connected');
    }

    await this.remoteActor.receive({
      type: 'execution:list',
      data: {}
    });
  }

  /**
   * Get execution history
   */
  async getExecutionHistory(limit = 50) {
    if (!this.remoteActor) {
      throw new Error('Execution actor not connected');
    }

    await this.remoteActor.receive({
      type: 'execution:history',
      data: { limit }
    });
  }

  /**
   * Set breakpoint on task
   */
  async setBreakpoint(executionId, taskId) {
    if (!this.remoteActor) {
      throw new Error('Execution actor not connected');
    }

    await this.remoteActor.receive({
      type: 'execution:breakpoint:set',
      data: { executionId, taskId }
    });
  }

  /**
   * Remove breakpoint from task
   */
  async removeBreakpoint(executionId, taskId) {
    if (!this.remoteActor) {
      throw new Error('Execution actor not connected');
    }

    await this.remoteActor.receive({
      type: 'execution:breakpoint:remove',
      data: { executionId, taskId }
    });
  }

  /**
   * Handle incoming messages from server
   */
  async receive(message) {
    const { type, data } = message;

    switch (type) {
      case 'execution:started':
        this.handleExecutionStarted(data);
        break;

      case 'execution:task:start':
        this.handleTaskStart(data);
        break;

      case 'execution:task:complete':
        this.handleTaskComplete(data);
        break;

      case 'execution:tool:execute':
        this.handleToolExecute(data);
        break;

      case 'execution:artifact:created':
        this.handleArtifactCreated(data);
        break;

      case 'execution:paused':
        this.handleExecutionPaused(data);
        break;

      case 'execution:resumed':
        this.handleExecutionResumed(data);
        break;

      case 'execution:stopped':
        this.handleExecutionStopped(data);
        break;

      case 'execution:step:complete':
        this.handleStepComplete(data);
        break;

      case 'execution:complete':
        this.handleExecutionComplete(data);
        break;

      case 'execution:status:result':
        this.handleStatusResult(data);
        break;

      case 'execution:list:result':
        this.handleListResult(data);
        break;

      case 'execution:history:result':
        this.handleHistoryResult(data);
        break;

      case 'execution:breakpoint:set:result':
        this.handleBreakpointSet(data);
        break;

      case 'execution:breakpoint:removed':
        this.handleBreakpointRemoved(data);
        break;

      case 'execution:error':
        this.handleExecutionError(data);
        break;

      default:
        console.warn(`Unknown execution message type: ${type}`);
    }
  }

  handleExecutionStarted(data) {
    console.log('🚀 Execution started:', data.executionId);
    
    const execution = {
      id: data.executionId,
      planId: data.planId,
      status: 'running',
      startTime: new Date(),
      tasks: [],
      artifacts: {}
    };
    
    this.activeExecutions.set(data.executionId, execution);
    this.currentExecution = execution;
    
    this.applicationContext.updateState?.('executionStatus', 'running');
    this.applicationContext.onExecutionStarted?.(data);
  }

  handleTaskStart(data) {
    console.log('📋 Task started:', data.taskName || data.taskId);
    
    if (this.currentExecution) {
      this.currentExecution.currentTask = data.taskName || data.taskId;
    }
    
    this.applicationContext.updateState?.('currentTask', data.taskName || data.taskId);
    this.applicationContext.onTaskStart?.(data);
  }

  handleTaskComplete(data) {
    console.log('✅ Task completed:', data.taskId);
    
    if (this.currentExecution) {
      this.currentExecution.tasks.push({
        id: data.taskId,
        status: data.status,
        completedAt: new Date()
      });
    }
    
    this.applicationContext.onTaskComplete?.(data);
  }

  handleToolExecute(data) {
    console.log('🔧 Tool executing:', data.toolName);
    this.applicationContext.onToolExecute?.(data);
  }

  handleArtifactCreated(data) {
    console.log('📦 Artifact created:', data.name);
    
    if (this.currentExecution) {
      this.currentExecution.artifacts[data.name] = data.value;
    }
    
    this.applicationContext.updateState?.('artifacts', this.currentExecution?.artifacts);
    this.applicationContext.onArtifactCreated?.(data);
  }

  handleExecutionPaused(data) {
    console.log('⏸️ Execution paused:', data.executionId);
    
    const execution = this.activeExecutions.get(data.executionId);
    if (execution) {
      execution.status = 'paused';
    }
    
    this.applicationContext.updateState?.('executionStatus', 'paused');
    this.applicationContext.onExecutionPaused?.(data);
  }

  handleExecutionResumed(data) {
    console.log('▶️ Execution resumed:', data.executionId);
    
    const execution = this.activeExecutions.get(data.executionId);
    if (execution) {
      execution.status = 'running';
    }
    
    this.applicationContext.updateState?.('executionStatus', 'running');
    this.applicationContext.onExecutionResumed?.(data);
  }

  handleExecutionStopped(data) {
    console.log('⏹️ Execution stopped:', data.executionId);
    
    const execution = this.activeExecutions.get(data.executionId);
    if (execution) {
      execution.status = 'stopped';
      execution.endTime = new Date();
    }
    
    this.applicationContext.updateState?.('executionStatus', 'stopped');
    this.applicationContext.onExecutionStopped?.(data);
  }

  handleStepComplete(data) {
    console.log('👟 Step completed:', data.taskExecuted);
    this.applicationContext.onStepComplete?.(data);
  }

  handleExecutionComplete(data) {
    console.log('🎉 Execution complete:', data.executionId);
    
    const execution = this.activeExecutions.get(data.executionId);
    if (execution) {
      execution.status = 'completed';
      execution.endTime = new Date();
      execution.results = data.results;
      execution.artifacts = { ...execution.artifacts, ...data.artifacts };
    }
    
    this.applicationContext.updateState?.('executionStatus', 'completed');
    this.applicationContext.updateState?.('executionResults', data.results);
    this.applicationContext.updateState?.('artifacts', data.artifacts);
    this.applicationContext.onExecutionComplete?.(data);
  }

  handleStatusResult(data) {
    console.log('📊 Execution status:', data);
    this.applicationContext.onStatusResult?.(data);
  }

  handleListResult(data) {
    console.log('📋 Active executions:', data.executions);
    this.applicationContext.updateState?.('activeExecutions', data.executions);
    this.applicationContext.onExecutionsList?.(data.executions);
  }

  handleHistoryResult(data) {
    console.log('📜 Execution history:', data.executions);
    this.applicationContext.updateState?.('executionHistory', data.executions);
    this.applicationContext.onExecutionHistory?.(data.executions);
  }

  handleBreakpointSet(data) {
    console.log('🔴 Breakpoint set:', data.taskId);
    this.applicationContext.onBreakpointSet?.(data);
  }

  handleBreakpointRemoved(data) {
    console.log('⚪ Breakpoint removed:', data.taskId);
    this.applicationContext.onBreakpointRemoved?.(data);
  }

  handleExecutionError(data) {
    console.error('❌ Execution error:', data.error);
    
    if (data.executionId) {
      const execution = this.activeExecutions.get(data.executionId);
      if (execution) {
        execution.status = 'failed';
        execution.error = data.error;
      }
    }
    
    this.applicationContext.updateState?.('executionStatus', 'error');
    this.applicationContext.updateState?.('executionError', data.error);
    this.applicationContext.onExecutionError?.(data);
  }

  /**
   * Get current execution
   */
  getCurrentExecution() {
    return this.currentExecution;
  }

  /**
   * Get all active executions
   */
  getActiveExecutions() {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Get execution by ID
   */
  getExecution(executionId) {
    return this.activeExecutions.get(executionId);
  }

  /**
   * Clean up
   */
  async cleanup() {
    this.activeExecutions.clear();
    this.currentExecution = null;
    this.remoteActor = null;
  }
}