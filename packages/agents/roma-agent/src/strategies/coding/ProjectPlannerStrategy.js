/**
 * ProjectPlannerStrategy - Meta-strategy for orchestrating complete Node.js project development
 * Converted to pure prototypal pattern
 * 
 * Coordinates specialized sub-strategies to transform requirements into fully functional applications.
 * Manages multi-phase workflows with automatic error recovery and quality assurance.
 */

import { TaskStrategy } from '@legion/tasks';
import { EnhancedPromptRegistry } from '@legion/prompting-manager';
import { createSimpleNodeServerStrategy } from '../simple-node/SimpleNodeServerStrategy.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { createSimpleNodeTestStrategy } from '../simple-node/SimpleNodeTestStrategy.js';
import { createSimpleNodeDebugStrategy } from '../simple-node/SimpleNodeDebugStrategy.js';

// Import new strategies (migrated from components)
import { createAnalysisStrategy as AnalysisStrategy } from './AnalysisStrategy.js';
import { createPlanningStrategy as PlanningStrategy } from './PlanningStrategy.js';
import { createExecutionStrategy as ExecutionStrategy } from './ExecutionStrategy.js';
import { createQualityStrategy as QualityStrategy } from './QualityStrategy.js';

// Import new strategies (migrated from components)
import { createRecoveryStrategy as RecoveryStrategy } from './RecoveryStrategy.js';
import { createMonitoringStrategy as MonitoringStrategy } from './MonitoringStrategy.js';

// Import utilities (moved from components)
import StateManager from '../../utils/StateManager.js';
import ParallelExecutor from '../../utils/ParallelExecutor.js';
import EventStream from '../../utils/EventStream.js';

/**
 * Create a ProjectPlannerStrategy prototype
 * This factory function creates the strategy with its dependencies
 */
export function createProjectPlannerStrategy(llmClient = null, toolRegistry = null, options = {}) {
  // Create the strategy as an object that inherits from TaskStrategy
  const strategy = Object.create(TaskStrategy);
  
  // Store configuration
  const config = {
    llmClient: llmClient,
    toolRegistry: toolRegistry,
    options: {
      projectRoot: '/tmp/roma-projects',
      maxConcurrent: 3,
      maxRetries: 3,
      executionTimeout: 300000, // 5 minutes
      ...options
    },
    // Initialize strategy placeholders (Phase 4: Migration to task delegation)
    analysisStrategy: null,
    planningStrategy: null,
    executionStrategy: null,
    qualityStrategy: null,
    recoveryStrategy: null,
    monitoringStrategy: null,
    
    // Component functionality now integrated into strategies
    stateManager: null,
    parallelExecutor: null,
    eventStream: null,
    
    // Sub-strategies
    strategies: {
      server: null,
      test: null,
      debug: null
    },
    
    // Initialize prompt registry
    promptRegistry: null,
    
    // Project state
    state: null
  };
  
  // Initialize prompt registry
  const promptsPath = path.resolve(__dirname, '../../../prompts');
  config.promptRegistry = new EnhancedPromptRegistry(promptsPath);
  
  /**
   * The only required method - handles all messages
   */
  strategy.onMessage = function onMessage(senderTask, message) {
    // 'this' is the task instance that received the message
    
    try {
      // Determine if message is from child or parent/initiator
      if (senderTask.parent === this) {
        // Message from child task
        switch (message.type) {
          case 'completed':
            console.log(`✅ ProjectPlanner child task completed: ${senderTask.description}`);
            // Handle child task completion
            handleChildComplete.call(this, senderTask, message.result, config).catch(error => {
              console.error(`❌ ProjectPlannerStrategy child completion handling failed: ${error.message}`);
              try {
                this.fail(error);
                if (this.parent) {
                  this.send(this.parent, { type: 'failed', error });
                }
              } catch (innerError) {
                console.error(`❌ Failed to handle child completion error: ${innerError.message}`);
              }
            });
            break;
            
          case 'failed':
            console.log(`❌ ProjectPlanner child task failed: ${senderTask.description}`);
            this.send(this.parent, { type: 'child-failed', child: senderTask, error: message.error });
            break;
            
          default:
            console.log(`ℹ️ ProjectPlannerStrategy received unhandled message from child: ${message.type}`);
        }
      } else {
        // Message from parent or initiator
        switch (message.type) {
          case 'start':
          case 'work':
            // Fire-and-forget async operation with error boundary
            handleProjectPlanningRequest.call(this, config).catch(error => {
              console.error(`❌ ProjectPlannerStrategy async operation failed: ${error.message}`);
              try {
                this.fail(error);
                if (this.parent) {
                  this.send(this.parent, { type: 'failed', error });
                }
              } catch (innerError) {
                console.error(`❌ Failed to handle async error: ${innerError.message}`);
              }
            });
            break;
            
          case 'status':
            // Fire-and-forget status report
            reportStatus.call(this, config).catch(error => {
              console.error(`❌ Status report failed: ${error.message}`);
            });
            break;
            
          case 'cancel':
            // Fire-and-forget cancellation
            cancelExecution.call(this, config).catch(error => {
              console.error(`❌ Cancellation failed: ${error.message}`);
            });
            break;
            
          default:
            console.log(`ℹ️ ProjectPlannerStrategy received unhandled message: ${message.type}`);
        }
      }
    } catch (error) {
      // Catch any synchronous errors in message handling
      console.error(`❌ ProjectPlannerStrategy message handler error: ${error.message}`);
      // Don't let errors escape the message handler - handle them gracefully
      try {
        if (this.addConversationEntry) {
          this.addConversationEntry('system', `Message handling error: ${error.message}`);
        }
      } catch (innerError) {
        console.error(`❌ Failed to log message handling error: ${innerError.message}`);
      }
    }
  };
  
  return strategy;
}

// Export default for backward compatibility
export default createProjectPlannerStrategy;

// ============================================================================
// Internal implementation functions
// These work with the task instance and strategy config  
// ============================================================================

/**
 * Handle project planning request - main execution logic
 * Called with task as 'this' context
 */
async function handleProjectPlanningRequest(config) {
  try {
    console.log(`🏗️ ProjectPlannerStrategy orchestrating: ${this.description}`);
    
    // Initialize dependencies first
    await initializeDependencies.call(this, config);
    
    // Execute the main project planning and execution flow
    const result = await planAndExecuteProject(config, this);
    
    console.log(`✅ ProjectPlannerStrategy completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    
    this.complete(result);
    
    // Notify parent if exists (fire-and-forget message passing)
    if (this.parent) {
      this.send(this.parent, { type: 'completed', result });
    }
    
  } catch (error) {
    console.error(`❌ ProjectPlannerStrategy failed: ${error.message}`);
    
    this.addConversationEntry('system', 
      `Project planning failed: ${error.message}`);
    
    this.fail(error);
    
    // Notify parent of failure if exists (fire-and-forget message passing)
    if (this.parent) {
      this.send(this.parent, { type: 'failed', error });
    }
  }
}

/**
 * Initialize all strategy dependencies
 */
async function initializeDependencies(config) {
  console.log('🔧 Initializing ProjectPlannerStrategy dependencies...');
  
  // Get services from task context
  const context = getContextFromTask(this);
  config.llmClient = config.llmClient || context.llmClient;
  config.toolRegistry = config.toolRegistry || context.toolRegistry;
  
  if (!config.llmClient) {
    throw new Error('LLM client is required for ProjectPlannerStrategy');
  }
  
  if (!config.toolRegistry) {
    throw new Error('ToolRegistry is required for ProjectPlannerStrategy');
  }
  
  // Initialize core strategies with proper factory function calls
  config.analysisStrategy = AnalysisStrategy(config.llmClient, config.toolRegistry, config.options);
  config.planningStrategy = PlanningStrategy(config.llmClient, config.toolRegistry, config.options);
  config.executionStrategy = ExecutionStrategy(config.strategies, config.stateManager, config.options);
  config.qualityStrategy = QualityStrategy(config.llmClient, config.toolRegistry, config.options);
  config.recoveryStrategy = RecoveryStrategy(config.llmClient, config.toolRegistry, config.options);
  config.monitoringStrategy = MonitoringStrategy(config.options);
  
  // Initialize sub-strategies using factory functions
  config.strategies.server = createSimpleNodeServerStrategy(config.llmClient, config.toolRegistry, config.options);
  config.strategies.test = createSimpleNodeTestStrategy(config.llmClient, config.toolRegistry, config.options);
  config.strategies.debug = createSimpleNodeDebugStrategy(config.llmClient, config.toolRegistry, config.options);
  
  // Initialize components
  config.stateManager = new StateManager();
  config.parallelExecutor = new ParallelExecutor();
  config.eventStream = new EventStream();
  
  console.log('✅ ProjectPlannerStrategy dependencies initialized');
}

/**
 * Main project planning and execution flow
 */
async function planAndExecuteProject(config, task) {
  try {
    // Emit start event
    config.eventStream.emit({
      type: 'project.started',
      taskId: task.id,
      data: { description: task.description }
    });
    
    // Phase 1: Analyze requirements (using child task delegation)
    config.eventStream.emit({ type: 'phase.started', data: { phase: 'requirements' } });
    config.monitoringStrategy.send(task, { 
      type: 'update', 
      progressData: { taskStarted: 'requirements', description: 'Analyzing project requirements' }
    });
    const requirements = await delegateRequirementsAnalysis(config, task);
    await config.stateManager.updateRequirements(requirements);
    config.monitoringStrategy.send(task, { 
      type: 'update', 
      progressData: { taskCompleted: 'requirements', success: true }
    });
    config.eventStream.emit({ type: 'phase.completed', data: { phase: 'requirements' } });
    
    // Phase 2: Create project plan (using child task delegation)
    config.eventStream.emit({ type: 'phase.started', data: { phase: 'planning' } });
    config.monitoringStrategy.send(task, { 
      type: 'update', 
      progressData: { taskStarted: 'planning', description: 'Creating project plan' }
    });
    const plan = await delegateProjectPlanning(config, task, requirements);
    await config.stateManager.savePlan(plan);
    config.monitoringStrategy.send(task, { 
      type: 'update', 
      progressData: { taskCompleted: 'planning', success: true }
    });
    config.eventStream.emit({ type: 'phase.completed', data: { phase: 'planning' } });
    
    // Phase 3: Execute plan (using child task delegation)
    config.eventStream.emit({ type: 'phase.started', data: { phase: 'execution' } });
    config.monitoringStrategy.send(task, { 
      type: 'update', 
      progressData: { taskStarted: 'execution', description: 'Executing project plan' }
    });
    const result = await delegateExecution(config, task, plan);
    config.monitoringStrategy.send(task, { 
      type: 'update', 
      progressData: { taskCompleted: 'execution', success: true }
    });
    config.eventStream.emit({ type: 'phase.completed', data: { phase: 'execution' } });
    
    // Phase 4: Validate quality (using child task delegation)
    config.eventStream.emit({ type: 'phase.started', data: { phase: 'validation' } });
    config.monitoringStrategy.send(task, { 
      type: 'update', 
      progressData: { taskStarted: 'validation', description: 'Validating project quality' }
    });
    const validation = await delegateQuality(config, task, result);
    
    if (!validation.passed) {
      // Attempt recovery
      const recovery = await attemptRecovery(config, validation.issues);
      if (recovery.success) {
        result = recovery.result;
      }
    }
    
    config.monitoringStrategy.send(task, { 
      type: 'update', 
      progressData: { taskCompleted: 'validation', success: validation.passed }
    });
    config.eventStream.emit({ type: 'phase.completed', data: { phase: 'validation' } });
    
    // Phase 5: Finalize
    await config.stateManager.markComplete(result);
    task.complete?.(result);
    
    config.eventStream.emit({
      type: 'project.completed',
      taskId: task.id,
      data: { result }
    });
    
    return {
      success: true,
      project: result,
      artifacts: task.getAllArtifacts ? Object.values(task.getAllArtifacts()) : []
    };
    
  } catch (error) {
    console.error('Project execution failed:', error);
    config.eventStream.emit({
      type: 'error.occurred',
      taskId: task.id,
      data: { error: error.message }
    });
    
    task.fail?.(error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Handle child task completion
 */
async function handleChildComplete(senderTask, result, config) {
  console.log(`✅ Child task completed: ${senderTask.description}`);
  
  // Copy artifacts from child to parent
  const childArtifacts = senderTask.getAllArtifacts();
  for (const [name, artifact] of Object.entries(childArtifacts)) {
    this.storeArtifact(name, artifact.content, artifact.description, artifact.type);
  }
  
  console.log(`📦 Copied ${Object.keys(childArtifacts).length} artifacts from child`);
  
  return { acknowledged: true, childComplete: true };
}

/**
 * Report current project status
 */
async function reportStatus(config) {
  const progress = config.monitoringStrategy.getProgress();
  const state = await config.stateManager.getState();
  
  return {
    type: 'status',
    progress: progress,
    state: state,
    phases: state.phases,
    currentPhase: state.status,
    artifacts: state.artifacts?.length || 0
  };
}

/**
 * Cancel project execution
 */
async function cancelExecution(config) {
  // Stop all running tasks
  await config.executionStrategy.stopAll();
  
  // Update state
  await config.stateManager.updateStatus('cancelled');
  
  // Emit cancellation event
  config.eventStream.emit({
    type: 'project.cancelled',
    taskId: this.id
  });
  
  return {
    type: 'cancelled',
    message: 'Project execution cancelled'
  };
}

/**
 * Delegate requirements analysis to child task using AnalysisStrategy
 */
async function delegateRequirementsAnalysis(config, task) {
  console.log(`📋 Delegating requirements analysis to child task...`);
  
  // Create child task for requirements analysis
  const taskManager = task.lookup ? task.lookup('taskManager') : null;
  if (!taskManager) {
    throw new Error('TaskManager is required for hierarchical delegation');
  }
  
  const analysisTask = await taskManager.createTask(
    `Analyze requirements: ${task.description}`, 
    task, 
    {
      strategy: config.analysisStrategy,
      workspaceDir: task.workspaceDir,
      llmClient: config.llmClient
    }
  );
  
  console.log(`📍 Created analysis task: ${analysisTask.id}`);
  
  // Send start message to child task
  const result = await analysisTask.receiveMessage({ type: 'start' });
  
  if (!result.success) {
    throw new Error(`Requirements analysis failed: ${result.result}`);
  }
  
  // Extract analysis from child task artifacts
  const analysisArtifact = analysisTask.getArtifact('requirements-analysis');
  if (!analysisArtifact) {
    throw new Error('Analysis task completed but no analysis artifact found');
  }
  
  console.log(`✅ Requirements analysis delegated successfully`);
  return analysisArtifact.content;
}

/**
 * Delegate project planning to child task using PlanningStrategy
 */
async function delegateProjectPlanning(config, task, requirements) {
  console.log(`📋 Delegating project planning to child task...`);
  
  // Store requirements in task artifacts for planning strategy
  task.storeArtifact('requirements-analysis', requirements, 'Analyzed requirements for planning', 'analysis');
  
  // Create child task for project planning
  const taskManager = task.lookup ? task.lookup('taskManager') : null;
  if (!taskManager) {
    throw new Error('TaskManager is required for hierarchical delegation');
  }
  
  const planningTask = await taskManager.createTask(
    `Create project plan: ${task.description}`, 
    task, 
    {
      strategy: config.planningStrategy,
      workspaceDir: task.workspaceDir,
      llmClient: config.llmClient,
      toolRegistry: config.toolRegistry
    }
  );
  
  if (!planningTask) {
    throw new Error('Failed to create planning child task');
  }
  
  console.log(`📍 Created planning task: ${planningTask.id || 'no-id'}`);
  
  // Send start message to child task
  const result = await planningTask.receiveMessage({ type: 'start' });
  
  if (!result.success) {
    throw new Error(`Project planning failed: ${result.result}`);
  }
  
  // Extract plan from child task artifacts
  const planArtifact = planningTask.getArtifact('project-plan');
  if (!planArtifact) {
    throw new Error('Planning task completed but no project plan artifact found');
  }
  
  console.log(`✅ Project planning delegated successfully`);
  return planArtifact.content;
}

/**
 * Delegate project execution to child task using ExecutionStrategy
 */
async function delegateExecution(config, task, plan) {
  console.log(`📋 Delegating project execution to child task...`);
  
  // Store plan in task artifacts for execution strategy
  task.storeArtifact('project-plan', plan, 'Project plan for execution', 'plan');
  
  // Create child task for project execution
  const taskManager = task.lookup ? task.lookup('taskManager') : null;
  if (!taskManager) {
    throw new Error('TaskManager is required for hierarchical delegation');
  }
  
  const executionTask = await taskManager.createTask(
    `Execute project plan: ${task.description}`, 
    task, 
    {
      strategy: config.executionStrategy,
      workspaceDir: task.workspaceDir,
      strategies: config.strategies,
      stateManager: config.stateManager
    }
  );
  
  if (!executionTask) {
    throw new Error('Failed to create execution child task');
  }
  
  console.log(`📍 Created execution task: ${executionTask.id || 'no-id'}`);
  
  // Send start message to child task
  const result = await executionTask.receiveMessage({ type: 'start' });
  
  if (!result.success) {
    throw new Error(`Project execution failed: ${result.result}`);
  }
  
  // Extract execution result from child task artifacts
  const executionArtifact = executionTask.getArtifact('execution-result');
  if (!executionArtifact) {
    throw new Error('Execution task completed but no execution result artifact found');
  }
  
  console.log(`✅ Project execution delegated successfully`);
  return executionArtifact.content;
}

/**
 * Delegate quality validation to child task using QualityStrategy
 */
async function delegateQuality(config, task, result) {
  console.log(`📋 Delegating quality validation to child task...`);
  
  // Store execution result in task artifacts for quality strategy
  task.storeArtifact('execution-result', result, 'Execution result for quality validation', 'result');
  
  // Create child task for quality validation
  const taskManager = task.lookup ? task.lookup('taskManager') : null;
  if (!taskManager) {
    throw new Error('TaskManager is required for hierarchical delegation');
  }
  
  const qualityTask = await taskManager.createTask(
    `Validate quality: ${task.description}`, 
    task, 
    {
      strategy: config.qualityStrategy,
      workspaceDir: task.workspaceDir,
      llmClient: config.llmClient,
      toolRegistry: config.toolRegistry
    }
  );
  
  if (!qualityTask) {
    throw new Error('Failed to create quality child task');
  }
  
  console.log(`📍 Created quality task: ${qualityTask.id || 'no-id'}`);
  
  // Send start message to child task
  const qualityResult = await qualityTask.receiveMessage({ type: 'start' });
  
  if (!qualityResult.success) {
    throw new Error(`Quality validation failed: ${qualityResult.result}`);
  }
  
  // Extract validation from child task artifacts
  const validationArtifact = qualityTask.getArtifact('quality-validation');
  if (!validationArtifact) {
    throw new Error('Quality task completed but no validation artifact found');
  }
  
  console.log(`✅ Quality validation delegated successfully`);
  return validationArtifact.content;
}

/**
 * Attempt to recover from validation failures
 * Note: Recovery is now handled through delegation, not direct strategy calls
 */
async function attemptRecovery(config, issues) {
  try {
    // For now, we'll skip recovery since it requires task delegation
    // In a full implementation, this would create a recovery child task
    // and delegate the recovery process to it
    console.warn('Recovery delegation not yet implemented - skipping recovery attempt');
    return { success: false, error: 'Recovery not implemented in pure prototypal pattern yet' };
  } catch (error) {
    console.error('Recovery failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Execute prompt with LLM
 */
async function executePrompt(config, promptPath, variables) {
  const prompt = await config.promptRegistry.fill(promptPath, variables);
  const response = await config.llmClient.complete(prompt);
  
  // Parse response based on expected format
  const metadata = await config.promptRegistry.getMetadata(promptPath);
  
  if (metadata.responseFormat === 'json') {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || response.match(/{[\s\S]*}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : response;
      const data = JSON.parse(jsonStr);
      return { success: true, data };
    } catch (error) {
      return { success: false, errors: [`Failed to parse JSON: ${error.message}`] };
    }
  }
  
  return { success: true, data: response };
}

/**
 * Helper to extract context from task
 */
function getContextFromTask(task) {
  return task?.context || {};
}