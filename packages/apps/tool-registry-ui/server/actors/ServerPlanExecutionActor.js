/**
 * ServerPlanExecutionActor - Server-side actor for plan execution operations
 * Handles behavior tree execution, progress tracking, and artifact management
 */

export class ServerPlanExecutionActor {
  constructor(btExecutor, toolRegistry, mongoProvider) {
    if (!btExecutor) {
      throw new Error('BT Executor is required');
    }
    if (!toolRegistry) {
      throw new Error('Tool Registry is required');
    }
    if (!mongoProvider) {
      throw new Error('MongoDB provider is required');
    }
    
    this.btExecutor = btExecutor;
    this.toolRegistry = toolRegistry;
    this.mongoProvider = mongoProvider;
    this.remoteActor = null;
    
    // Track active executions
    this.activeExecutions = new Map();
  }

  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
  }

  async receive(message) {
    const { type, data } = message;
    
    try {
      switch (type) {
        case 'execution:start':
          await this.handleExecutionStart(data);
          break;
          
        case 'execution:pause':
          await this.handleExecutionPause(data);
          break;
          
        case 'execution:resume':
          await this.handleExecutionResume(data);
          break;
          
        case 'execution:stop':
          await this.handleExecutionStop(data);
          break;
          
        case 'execution:step':
          await this.handleExecutionStep(data);
          break;
          
        case 'execution:status':
          await this.handleExecutionStatus(data);
          break;
          
        case 'execution:list':
          await this.handleExecutionList(data);
          break;
          
        case 'execution:history':
          await this.handleExecutionHistory(data);
          break;
          
        case 'execution:save':
          await this.handleExecutionSave(data);
          break;
          
        case 'execution:breakpoint:set':
          await this.handleBreakpointSet(data);
          break;
          
        case 'execution:breakpoint:remove':
          await this.handleBreakpointRemove(data);
          break;
          
        default:
          await this.sendError(`Unknown message type: ${type}`);
      }
    } catch (error) {
      await this.sendError(`Error processing ${type}: ${error.message}`, error);
    }
  }

  async handleExecutionStart(data) {
    if (!data || !data.executionId || !data.behaviorTree) {
      await this.sendError('Missing required fields: executionId, behaviorTree');
      return;
    }

    const { executionId, planId, behaviorTree, options = {} } = data;
    
    // Create execution record
    const executionRecord = {
      executionId,
      planId,
      status: 'running',
      startTime: new Date(),
      progress: {
        totalTasks: this.countTasks(behaviorTree),
        completedTasks: 0,
        currentTask: null
      },
      artifacts: {},
      logs: []
    };
    
    // Store in active executions
    this.activeExecutions.set(executionId, executionRecord);
    
    // Notify client that execution has started
    await this.sendMessage('execution:started', {
      executionId,
      planId
    });
    
    try {
      // Configure execution callbacks
      const executionOptions = {
        ...options,
        onTaskStart: async (task) => {
          await this.handleTaskStart(executionId, task);
        },
        onTaskComplete: async (task) => {
          await this.handleTaskComplete(executionId, task);
        },
        onToolExecute: async (toolInfo) => {
          await this.handleToolExecute(executionId, toolInfo);
        },
        onArtifactCreated: async (artifact) => {
          await this.handleArtifactCreated(executionId, artifact);
        }
      };
      
      // Execute behavior tree
      const result = await this.btExecutor.execute(behaviorTree, executionOptions);
      
      // Update execution record
      const execution = this.activeExecutions.get(executionId);
      if (execution) {
        execution.status = 'completed';
        execution.endTime = new Date();
        execution.results = result.results;
        execution.artifacts = { ...execution.artifacts, ...result.artifacts };
      }
      
      // Send completion message
      await this.sendMessage('execution:complete', {
        executionId,
        status: result.status,
        results: result.results,
        artifacts: result.artifacts
      });
      
      // Save to database
      await this.saveExecutionRecord(execution);
      
    } catch (error) {
      // Update execution status
      const execution = this.activeExecutions.get(executionId);
      if (execution) {
        execution.status = 'failed';
        execution.endTime = new Date();
        execution.error = error.message;
      }
      
      await this.sendMessage('execution:error', {
        executionId,
        error: `Execution failed: ${error.message}`,
        details: error
      });
      
      // Save failed execution to database
      await this.saveExecutionRecord(execution);
    }
  }

  async handleExecutionPause(data) {
    if (!data || !data.executionId) {
      await this.sendError('Missing executionId');
      return;
    }

    const { executionId } = data;
    const execution = this.activeExecutions.get(executionId);
    
    if (!execution) {
      await this.sendError(`Execution not found: ${executionId}`);
      return;
    }
    
    try {
      await this.btExecutor.pause(executionId);
      execution.status = 'paused';
      
      await this.sendMessage('execution:paused', {
        executionId
      });
    } catch (error) {
      await this.sendError(`Failed to pause execution: ${error.message}`, error);
    }
  }

  async handleExecutionResume(data) {
    if (!data || !data.executionId) {
      await this.sendError('Missing executionId');
      return;
    }

    const { executionId } = data;
    const execution = this.activeExecutions.get(executionId);
    
    if (!execution) {
      await this.sendError(`Execution not found: ${executionId}`);
      return;
    }
    
    try {
      await this.btExecutor.resume(executionId);
      execution.status = 'running';
      
      await this.sendMessage('execution:resumed', {
        executionId
      });
    } catch (error) {
      await this.sendError(`Failed to resume execution: ${error.message}`, error);
    }
  }

  async handleExecutionStop(data) {
    if (!data || !data.executionId) {
      await this.sendError('Missing executionId');
      return;
    }

    const { executionId } = data;
    const execution = this.activeExecutions.get(executionId);
    
    if (!execution) {
      await this.sendError(`Execution not found: ${executionId}`);
      return;
    }
    
    try {
      await this.btExecutor.stop(executionId);
      
      // Update and save execution record
      execution.status = 'stopped';
      execution.endTime = new Date();
      await this.saveExecutionRecord(execution);
      
      // Remove from active executions
      this.activeExecutions.delete(executionId);
      
      await this.sendMessage('execution:stopped', {
        executionId
      });
    } catch (error) {
      await this.sendError(`Failed to stop execution: ${error.message}`, error);
    }
  }

  async handleExecutionStep(data) {
    if (!data || !data.executionId) {
      await this.sendError('Missing executionId');
      return;
    }

    const { executionId } = data;
    const execution = this.activeExecutions.get(executionId);
    
    if (!execution) {
      await this.sendError(`Execution not found: ${executionId}`);
      return;
    }
    
    try {
      const stepResult = await this.btExecutor.step(executionId);
      
      await this.sendMessage('execution:step:complete', {
        executionId,
        taskExecuted: stepResult.taskExecuted,
        status: stepResult.status
      });
    } catch (error) {
      await this.sendError(`Failed to step execution: ${error.message}`, error);
    }
  }

  async handleExecutionStatus(data) {
    if (!data || !data.executionId) {
      await this.sendError('Missing executionId');
      return;
    }

    const { executionId } = data;
    const execution = this.activeExecutions.get(executionId);
    
    if (!execution) {
      await this.sendError(`Execution not found: ${executionId}`);
      return;
    }
    
    await this.sendMessage('execution:status:result', {
      executionId,
      status: execution.status,
      progress: execution.progress,
      artifacts: execution.artifacts,
      startTime: execution.startTime,
      currentTask: execution.progress.currentTask
    });
  }

  async handleExecutionList(data) {
    const executions = Array.from(this.activeExecutions.entries()).map(([id, exec]) => ({
      executionId: id,
      planId: exec.planId,
      status: exec.status,
      startTime: exec.startTime,
      progress: exec.progress
    }));
    
    await this.sendMessage('execution:list:result', {
      executions
    });
  }

  async handleExecutionHistory(data) {
    try {
      const collection = this.mongoProvider.getCollection('plan_executions');
      const limit = data?.limit || 50;
      
      const executions = await collection
        .find({})
        .sort({ startTime: -1 })
        .limit(limit)
        .toArray();
      
      await this.sendMessage('execution:history:result', {
        executions
      });
    } catch (error) {
      await this.sendError(`Failed to load execution history: ${error.message}`, error);
    }
  }

  async handleExecutionSave(data) {
    if (!data || !data.executionId) {
      await this.sendError('Missing executionId');
      return;
    }

    try {
      const collection = this.mongoProvider.getCollection('plan_executions');
      
      const executionDocument = {
        ...data,
        savedAt: new Date()
      };
      
      const result = await collection.insertOne(executionDocument);
      
      await this.sendMessage('execution:saved', {
        recordId: result.insertedId
      });
    } catch (error) {
      await this.sendError(`Failed to save execution: ${error.message}`, error);
    }
  }

  async handleBreakpointSet(data) {
    if (!data || !data.executionId || !data.taskId) {
      await this.sendError('Missing executionId or taskId');
      return;
    }

    const { executionId, taskId } = data;
    
    try {
      const result = await this.btExecutor.setBreakpoint(executionId, taskId);
      
      await this.sendMessage('execution:breakpoint:set:result', {
        executionId,
        taskId,
        set: result.set
      });
    } catch (error) {
      await this.sendError(`Failed to set breakpoint: ${error.message}`, error);
    }
  }

  async handleBreakpointRemove(data) {
    if (!data || !data.executionId || !data.taskId) {
      await this.sendError('Missing executionId or taskId');
      return;
    }

    const { executionId, taskId } = data;
    
    try {
      const result = await this.btExecutor.removeBreakpoint(executionId, taskId);
      
      await this.sendMessage('execution:breakpoint:removed', {
        executionId,
        taskId
      });
    } catch (error) {
      await this.sendError(`Failed to remove breakpoint: ${error.message}`, error);
    }
  }

  // Helper methods for execution callbacks
  async handleTaskStart(executionId, task) {
    const execution = this.activeExecutions.get(executionId);
    if (execution) {
      execution.progress.currentTask = task.name || task.id;
      execution.logs.push({
        timestamp: new Date(),
        type: 'task:start',
        message: `Starting task: ${task.name || task.id}`
      });
    }
    
    await this.sendMessage('execution:task:start', {
      executionId,
      taskId: task.id,
      taskName: task.name
    });
  }

  async handleTaskComplete(executionId, task) {
    const execution = this.activeExecutions.get(executionId);
    if (execution) {
      execution.progress.completedTasks++;
      execution.logs.push({
        timestamp: new Date(),
        type: 'task:complete',
        message: `Completed task: ${task.name || task.id}`
      });
    }
    
    await this.sendMessage('execution:task:complete', {
      executionId,
      taskId: task.id,
      status: task.status,
      outputs: task.outputs
    });
  }

  async handleToolExecute(executionId, toolInfo) {
    const execution = this.activeExecutions.get(executionId);
    if (execution) {
      execution.logs.push({
        timestamp: new Date(),
        type: 'tool:execute',
        message: `Executing tool: ${toolInfo.toolName}`
      });
    }
    
    await this.sendMessage('execution:tool:execute', {
      executionId,
      toolName: toolInfo.toolName,
      params: toolInfo.params
    });
  }

  async handleArtifactCreated(executionId, artifact) {
    const execution = this.activeExecutions.get(executionId);
    if (execution) {
      execution.artifacts[artifact.name] = artifact.value;
      execution.logs.push({
        timestamp: new Date(),
        type: 'artifact:created',
        message: `Created artifact: ${artifact.name}`
      });
    }
    
    await this.sendMessage('execution:artifact:created', {
      executionId,
      name: artifact.name,
      value: artifact.value
    });
  }

  // Helper methods
  countTasks(behaviorTree) {
    let count = 0;
    
    const traverse = (node) => {
      if (node.type === 'action') {
        count++;
      }
      if (node.children) {
        node.children.forEach(traverse);
      }
      if (node.child) {
        traverse(node.child);
      }
    };
    
    traverse(behaviorTree);
    return count;
  }

  async saveExecutionRecord(execution) {
    if (!execution) return;
    
    try {
      const collection = this.mongoProvider.getCollection('plan_executions');
      await collection.insertOne({
        ...execution,
        savedAt: new Date()
      });
    } catch (error) {
      console.error('Failed to save execution record:', error);
    }
  }

  async sendMessage(type, data) {
    if (this.remoteActor) {
      await this.remoteActor.send({ type, data });
    }
  }

  async sendError(error, details = null) {
    await this.sendMessage('execution:error', {
      error,
      details: details || {},
      timestamp: new Date()
    });
  }
}