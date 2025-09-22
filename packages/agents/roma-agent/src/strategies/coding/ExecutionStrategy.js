/**
 * ExecutionStrategy - Wraps ExecutionOrchestrator as TaskStrategy
 * Phase 3.1: Migration from component orchestration to hierarchical task delegation
 * 
 * This strategy wraps the ExecutionOrchestrator component and implements the
 * TaskStrategy interface for proper parent→child task delegation.
 */

import { TaskStrategy } from '@legion/tasks';
import ExecutionOrchestrator from './components/ExecutionOrchestrator.js';

export default class ExecutionStrategy extends TaskStrategy {
  constructor(strategies, stateManager, options = {}) {
    super();
    
    this.strategies = strategies;
    this.stateManager = stateManager;
    this.options = {
      maxRetries: 3,
      backoffStrategy: 'exponential',
      validateResults: true,
      ...options
    };
    
    // Lazy initialization - component created on first use
    this.executionOrchestrator = null;
  }
  
  getName() {
    return 'Execution';
  }
  
  /**
   * Initialize the wrapped ExecutionOrchestrator component
   */
  _ensureComponentInitialized() {
    if (!this.executionOrchestrator) {
      if (!this.strategies || !this.stateManager) {
        throw new Error('ExecutionStrategy requires strategies and stateManager');
      }
      this.executionOrchestrator = new ExecutionOrchestrator(this.strategies, this.stateManager);
    }
  }
  
  /**
   * Handle messages from parent task
   */
  async onParentMessage(parentTask, message) {
    switch (message.type) {
      case 'start':
      case 'work':
        return await this._handleExecutionRequest(message.task || parentTask);
      case 'abort':
        return await this._handleAbortRequest();
      default:
        return { acknowledged: true };
    }
  }
  
  /**
   * Handle messages from child tasks (ExecutionStrategy may create children for parallel execution)
   */
  async onChildMessage(childTask, message) {
    const task = childTask.parent;
    if (!task) {
      throw new Error('Child task has no parent');
    }

    switch (message.type) {
      case 'completed':
        return { acknowledged: true };
      case 'failed':
        return { acknowledged: true };
      default:
        return { acknowledged: true };
    }
  }
  
  /**
   * Handle execution request from parent task
   */
  async _handleExecutionRequest(task) {
    try {
      console.log(`⚙️ ExecutionStrategy handling: ${task.description}`);
      
      // Extract execution plan from task
      const plan = this._extractExecutionPlan(task);
      if (!plan) {
        return {
          success: false,
          result: 'No execution plan found for execution'
        };
      }
      
      // Add conversation entry
      task.addConversationEntry('system', 
        `Executing project plan with ${plan.phases?.length || 0} phases`);
      
      // Initialize component if needed
      this._ensureComponentInitialized();
      
      // Execute plan using wrapped component
      const result = await this._executePlan(plan, task);
      
      // Store execution artifacts
      task.storeArtifact(
        'execution-result',
        result,
        `Execution result with ${result.phases?.length || 0} completed phases`,
        'execution'
      );
      
      if (result.artifacts && result.artifacts.length > 0) {
        task.storeArtifact(
          'execution-artifacts',
          result.artifacts,
          `${result.artifacts.length} artifacts produced during execution`,
          'artifacts'
        );
      }
      
      // Add conversation entry about completion
      task.addConversationEntry('system', 
        `Execution completed: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.phases?.length || 0} phases processed`);
      
      console.log(`✅ ExecutionStrategy completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      
      return {
        success: result.success,
        result: {
          execution: result,
          projectId: result.projectId,
          phasesCompleted: result.phases?.length || 0,
          artifactsCreated: result.artifacts?.length || 0
        },
        artifacts: ['execution-result', 'execution-artifacts']
      };
      
    } catch (error) {
      console.error(`❌ ExecutionStrategy failed: ${error.message}`);
      
      task.addConversationEntry('system', 
        `Execution failed: ${error.message}`);
      
      return {
        success: false,
        result: error.message
      };
    }
  }
  
  /**
   * Handle abort request
   */
  async _handleAbortRequest() {
    try {
      if (this.executionOrchestrator) {
        await this.executionOrchestrator.stopAll();
      }
      return { acknowledged: true, aborted: true };
    } catch (error) {
      console.error(`Error during abort: ${error.message}`);
      return { acknowledged: true, aborted: false, error: error.message };
    }
  }
  
  /**
   * Execute a project plan by processing all phases and tasks
   */
  async _executePlan(plan, task) {
    const results = {
      success: true,
      projectId: plan.projectId,
      structure: plan.structure,
      phases: [],
      artifacts: []
    };
    
    try {
      // Process phases in order
      for (const phase of plan.phases) {
        console.log(`🔄 Executing phase: ${phase.phase} (${phase.tasks.length} tasks)`);
        
        const phaseResults = {
          phase: phase.phase,
          priority: phase.priority,
          tasks: [],
          success: true
        };
        
        // Execute tasks in this phase
        for (const planTask of phase.tasks) {
          try {
            console.log(`📍 Executing task: ${planTask.description || planTask.action}`);
            
            // Ensure component is initialized before use
            this._ensureComponentInitialized();
            
            // Ensure task has retry configuration
            const taskWithDefaults = {
              ...planTask,
              retry: planTask.retry || { maxAttempts: 1, strategy: 'exponential' },
              validation: planTask.validation || { required: false }
            };
            
            const taskResult = await this.executionOrchestrator.execute(taskWithDefaults);
            
            phaseResults.tasks.push({
              id: planTask.id,
              success: taskResult.success,
              artifacts: taskResult.artifacts || []
            });
            
            // Store artifacts
            if (taskResult.artifacts) {
              results.artifacts.push(...taskResult.artifacts);
              for (const artifact of taskResult.artifacts) {
                task.storeArtifact(artifact.name, artifact.content, artifact.description, artifact.type);
              }
            }
            
          } catch (error) {
            console.error(`Task ${planTask.id} failed:`, error.message);
            phaseResults.tasks.push({
              id: planTask.id,
              success: false,
              error: error.message
            });
            phaseResults.success = false;
          }
        }
        
        results.phases.push(phaseResults);
        
        // If this phase failed and it's critical, stop execution
        // Phases without priority are considered critical (priority 1)
        const priority = phase.priority !== undefined ? phase.priority : 1;
        if (!phaseResults.success && priority <= 3) {
          results.success = false;
          break;
        }
      }
      
      return results;
      
    } catch (error) {
      console.error('Plan execution failed:', error);
      results.success = false;
      results.error = error.message;
      return results;
    }
  }
  
  /**
   * Extract execution plan from task artifacts or context
   */
  _extractExecutionPlan(task) {
    // First try to get plan from artifacts
    const artifacts = task.getAllArtifacts ? task.getAllArtifacts() : {};
    
    // Look for project plan artifact
    if (artifacts['project-plan']) {
      return artifacts['project-plan'].content;
    }
    
    // Look for execution plan
    if (artifacts['execution-plan']) {
      return artifacts['execution-plan'].content;
    }
    
    // Look for plan artifact
    if (artifacts['plan']) {
      return artifacts['plan'].content;
    }
    
    // Look in task context or input
    if (task.input && task.input.plan) {
      return task.input.plan;
    }
    
    // Fallback to task description if it contains plan structure
    if (task.description && task.description.trim()) {
      try {
        const parsedDescription = JSON.parse(task.description);
        if (parsedDescription.phases) {
          return parsedDescription;
        }
      } catch {
        // Not JSON, ignore
      }
    }
    
    return null;
  }
  
  /**
   * Get context information from task for execution
   */
  _getContextFromTask(task) {
    const context = {
      taskId: task.id,
      description: task.description,
      workspaceDir: task.workspaceDir
    };
    
    // Add any existing artifacts as context
    if (task.getAllArtifacts) {
      const artifacts = task.getAllArtifacts();
      context.existingArtifacts = Object.keys(artifacts);
    }
    
    // Add conversation history for context
    if (task.getConversationContext) {
      context.conversationHistory = task.getConversationContext();
    }
    
    return context;
  }
}