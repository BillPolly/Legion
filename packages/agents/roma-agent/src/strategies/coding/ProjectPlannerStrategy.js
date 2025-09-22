/**
 * ProjectPlannerStrategy - Meta-strategy for orchestrating complete Node.js project development
 * 
 * Coordinates specialized sub-strategies to transform requirements into fully functional applications.
 * Manages multi-phase workflows with automatic error recovery and quality assurance.
 */

import { TaskStrategy } from '@legion/tasks';
import { EnhancedPromptRegistry } from '@legion/prompting-manager';
import SimpleNodeServerStrategy from '../simple-node/SimpleNodeServerStrategy.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import SimpleNodeTestStrategy from '../simple-node/SimpleNodeTestStrategy.js';
import SimpleNodeDebugStrategy from '../simple-node/SimpleNodeDebugStrategy.js';

// Import new strategies (migrated from components)
import AnalysisStrategy from './AnalysisStrategy.js';
import PlanningStrategy from './PlanningStrategy.js';
import ExecutionStrategy from './ExecutionStrategy.js';
import QualityStrategy from './QualityStrategy.js';

// Import new strategies (migrated from components)
import RecoveryStrategy from './RecoveryStrategy.js';
import MonitoringStrategy from './MonitoringStrategy.js';

// Import utilities (moved from components)
import StateManager from '../../utils/StateManager.js';
import ParallelExecutor from '../../utils/ParallelExecutor.js';
import EventStream from '../../utils/EventStream.js';

export default class ProjectPlannerStrategy extends TaskStrategy {
  constructor(llmClient = null, toolRegistry = null, options = {}) {
    super();
    
    // Core services
    this.llmClient = llmClient;
    this.toolRegistry = toolRegistry;
    
    // Configuration
    this.projectRoot = options.projectRoot || '/tmp/roma-projects';
    this.maxConcurrent = options.maxConcurrent || 3;
    this.maxRetries = options.maxRetries || 3;
    this.executionTimeout = options.executionTimeout || 300000; // 5 minutes
    
    // Initialize strategy placeholders (Phase 4: Migration to task delegation)
    this.analysisStrategy = null;
    this.planningStrategy = null;
    this.executionStrategy = null;
    this.qualityStrategy = null;
    this.recoveryStrategy = null;
    this.monitoringStrategy = null;
    
    // Component functionality now integrated into strategies
    this.stateManager = null;
    this.parallelExecutor = null;
    this.eventStream = null;
    
    // Sub-strategies
    this.strategies = {
      server: null,
      test: null,
      debug: null
    };
    
    // Initialize prompt registry
    const promptsPath = path.resolve(__dirname, '../../../prompts');
    this.promptRegistry = new EnhancedPromptRegistry(promptsPath);
    
    // Project state
    this.state = null;
  }
  
  getName() {
    return 'ProjectPlanner';
  }
  
  /**
   * Initialize strategy components and sub-strategies
   */
  async initialize(task) {
    // Get context from task if available
    const context = this._getContextFromTask(task);
    
    // Initialize LLM and tools (use provided or get from context)
    this.llmClient = this.llmClient || context?.llmClient;
    this.toolRegistry = this.toolRegistry || context?.toolRegistry;
    
    // Validate required services
    if (!this.llmClient) {
      throw new Error('LLM client is required');
    }
    
    if (!this.toolRegistry) {
      throw new Error('ToolRegistry is required');
    }
    
    // Initialize strategies (Phase 4: Migration to task delegation)
    this.analysisStrategy = new AnalysisStrategy(this.llmClient);
    this.planningStrategy = new PlanningStrategy(this.llmClient, this.toolRegistry);
    this.qualityStrategy = new QualityStrategy(this.llmClient, this.toolRegistry);
    this.recoveryStrategy = new RecoveryStrategy(this.llmClient, this.toolRegistry);
    this.monitoringStrategy = new MonitoringStrategy();
    
    // Initialize sub-strategies first
    this.strategies.server = new SimpleNodeServerStrategy(
      this.llmClient,
      this.toolRegistry,
      { projectRoot: this.projectRoot }
    );
    
    this.strategies.test = new SimpleNodeTestStrategy(
      this.llmClient,
      this.toolRegistry,
      { projectRoot: this.projectRoot }
    );
    
    this.strategies.debug = new SimpleNodeDebugStrategy(
      this.llmClient,
      this.toolRegistry,
      { projectRoot: this.projectRoot }
    );
    
    // Create strategies mapping with proper names for ExecutionOrchestrator
    const strategiesForOrchestrator = {
      SimpleNodeServer: this.strategies.server,
      SimpleNodeTest: this.strategies.test,
      SimpleNodeDebug: this.strategies.debug,
      FileSystem: this.strategies.server,  // FileSystem tasks handled by server strategy
      NodeProject: this.strategies.server, // NodeProject tasks handled by server strategy
      Documentation: this.strategies.server // Documentation tasks handled by server strategy
    };
    
    this.stateManager = new StateManager(this.projectRoot);
    
    // Initialize ExecutionStrategy (merged ExecutionOrchestrator functionality)
    this.executionStrategy = new ExecutionStrategy(
      strategiesForOrchestrator,
      this.stateManager
    );
    this.parallelExecutor = new ParallelExecutor({ maxConcurrent: this.maxConcurrent });
    this.eventStream = new EventStream();
    
    // Set up recovery strategy project planner reference
    this.recoveryStrategy.projectPlanner = this.planningStrategy;
    
    // Initialize sub-strategies
    await this.strategies.server.initialize(task);
    await this.strategies.test.initialize(task);
    await this.strategies.debug.initialize(task);
    
    // Prompts are now loaded from files via promptRegistry
    
    // Load or create project state
    this.state = await this.stateManager.loadOrCreate(task.id || task.projectId || 'default');
  }
  
  /**
   * Handle messages from parent task
   */
  async onMessage(sourceTask, message) {
    switch (message.type) {
      case 'start':
        return await this._planAndExecuteProject(sourceTask);
      case 'status':
        return await this._reportStatus(sourceTask);
      case 'cancel':
        return await this._cancelExecution(sourceTask);
      case 'completed':
        // Handle child task completion
        if (!sourceTask.parent) {
          throw new Error('Child task has no parent');
        }
        return await this._onChildComplete(sourceTask.parent, sourceTask, message.result);
      case 'failed':
        // Handle child task failure
        if (!sourceTask.parent) {
          throw new Error('Child task has no parent');
        }
        sourceTask.parent.fail(message.error);
        return { acknowledged: true };
      default:
        return { acknowledged: true };
    }
  }
  
  /**
   * Main project planning and execution flow
   */
  async _planAndExecuteProject(task) {
    try {
      // Emit start event
      this.eventStream.emit({
        type: 'project.started',
        taskId: task.id,
        data: { description: task.description }
      });
      
      // Phase 1: Analyze requirements (using child task delegation)
      this.eventStream.emit({ type: 'phase.started', data: { phase: 'requirements' } });
      await this.monitoringStrategy.onMessage(task, { 
        type: 'update', 
        progressData: { taskStarted: 'requirements', description: 'Analyzing project requirements' }
      });
      const requirements = await this._delegateRequirementsAnalysis(task);
      await this.stateManager.updateRequirements(requirements);
      await this.monitoringStrategy.onMessage(task, { 
        type: 'update', 
        progressData: { taskCompleted: 'requirements', success: true }
      });
      this.eventStream.emit({ type: 'phase.completed', data: { phase: 'requirements' } });
      
      // Phase 2: Create project plan (using child task delegation)
      this.eventStream.emit({ type: 'phase.started', data: { phase: 'planning' } });
      await this.monitoringStrategy.onMessage(task, { 
        type: 'update', 
        progressData: { taskStarted: 'planning', description: 'Creating project plan' }
      });
      const plan = await this._delegateProjectPlanning(task, requirements);
      await this.stateManager.savePlan(plan);
      await this.monitoringStrategy.onMessage(task, { 
        type: 'update', 
        progressData: { taskCompleted: 'planning', success: true }
      });
      this.eventStream.emit({ type: 'phase.completed', data: { phase: 'planning' } });
      
      // Phase 3: Execute plan (using child task delegation)
      this.eventStream.emit({ type: 'phase.started', data: { phase: 'execution' } });
      await this.monitoringStrategy.onMessage(task, { 
        type: 'update', 
        progressData: { taskStarted: 'execution', description: 'Executing project plan' }
      });
      const result = await this._delegateExecution(task, plan);
      await this.monitoringStrategy.onMessage(task, { 
        type: 'update', 
        progressData: { taskCompleted: 'execution', success: true }
      });
      this.eventStream.emit({ type: 'phase.completed', data: { phase: 'execution' } });
      
      // Phase 4: Validate quality (using child task delegation)
      this.eventStream.emit({ type: 'phase.started', data: { phase: 'validation' } });
      await this.monitoringStrategy.onMessage(task, { 
        type: 'update', 
        progressData: { taskStarted: 'validation', description: 'Validating project quality' }
      });
      const validation = await this._delegateQuality(task, result);
      
      if (!validation.passed) {
        // Attempt recovery
        const recovery = await this._attemptRecovery(validation.issues);
        if (recovery.success) {
          result = recovery.result;
        }
      }
      
      await this.monitoringStrategy.onMessage(task, { 
        type: 'update', 
        progressData: { taskCompleted: 'validation', success: validation.passed }
      });
      this.eventStream.emit({ type: 'phase.completed', data: { phase: 'validation' } });
      
      // Phase 5: Finalize
      await this.stateManager.markComplete(result);
      task.complete?.(result);
      
      this.eventStream.emit({
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
      this.eventStream.emit({
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
   * Report current project status
   */
  async _reportStatus(task) {
    const progress = this.monitoringStrategy.getProgress();
    const state = await this.stateManager.getState();
    
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
  async _cancelExecution(task) {
    // Stop all running tasks
    await this.executionStrategy.stopAll();
    
    // Update state
    await this.stateManager.updateStatus('cancelled');
    
    // Emit cancellation event
    this.eventStream.emit({
      type: 'project.cancelled',
      taskId: task.id
    });
    
    return {
      type: 'cancelled',
      message: 'Project execution cancelled'
    };
  }
  
  /**
   * Delegate project execution to child task using ExecutionStrategy
   * Phase 3.2: Hierarchical task delegation implementation
   */
  async _delegateExecution(task, plan) {
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
        strategy: this.executionStrategy,
        workspaceDir: task.workspaceDir,
        strategies: this.strategies,
        stateManager: this.stateManager
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
   * Attempt to recover from validation failures
   */
  async _attemptRecovery(issues) {
    try {
      // Use task delegation pattern for recovery strategy
      const recoveryResult = await this.recoveryStrategy.onMessage(null, {
        type: 'recover',
        error: issues,
        attempt: 1
      });
      
      return recoveryResult.result || { success: false, error: 'Recovery failed' };
    } catch (error) {
      console.error('Recovery failed:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get prompt definitions for PromptFactory
   */
  /**
   * Execute prompt with LLM
   */
  async _executePrompt(promptPath, variables) {
    const prompt = await this.promptRegistry.fill(promptPath, variables);
    const response = await this.llmClient.complete(prompt);
    
    // Parse response based on expected format
    const metadata = await this.promptRegistry.getMetadata(promptPath);
    
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
   * DEPRECATED: Prompt definitions moved to markdown files
   */
  _getPromptDefinitions() {
    return [
      {
        name: 'analyzeRequirements',
        template: `Analyze the following project requirements and extract:
- Project type (api, web, cli, library)
- Required features
- Technical constraints
- Suggested technology stack

Requirements: {{description}}

Respond in JSON format with the structure:
{
  "type": "api|web|cli|library",
  "features": ["list of features"],
  "constraints": ["list of constraints"],
  "technologies": ["suggested technologies"]
}`,
        responseSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['api', 'web', 'cli', 'library'] },
            features: { type: 'array', items: { type: 'string' } },
            constraints: { type: 'array', items: { type: 'string' } },
            technologies: { type: 'array', items: { type: 'string' } }
          },
          required: ['type', 'features', 'technologies']
        },
        examples: [
          {
            type: "api",
            features: ["user authentication", "REST endpoints", "JWT tokens"],
            constraints: ["secure", "scalable"],
            technologies: ["express", "jsonwebtoken", "bcrypt", "mongodb"]
          }
        ]
      },
      {
        name: 'createProjectPlan',
        template: `Create a detailed project plan for the following requirements:
{{requirements}}

Generate a phase-based execution plan with tasks for each phase.
Include dependencies between tasks and estimated complexity.

Respond in JSON format matching the execution plan schema.`,
        responseSchema: {
          type: 'object',
          properties: {
            planId: { type: 'string' },
            phases: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  phase: { type: 'string' },
                  priority: { type: 'number' },
                  tasks: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        action: { type: 'string' },
                        dependencies: { type: 'array', items: { type: 'string' } }
                      },
                      required: ['id', 'action']
                    }
                  }
                },
                required: ['phase', 'tasks']
              }
            }
          },
          required: ['planId', 'phases']
        },
        examples: [
          {
            planId: "plan-123",
            phases: [
              {
                phase: "setup",
                priority: 1,
                tasks: [
                  { id: "task-1", action: "create project structure", dependencies: [] },
                  { id: "task-2", action: "initialize package.json", dependencies: ["task-1"] }
                ]
              }
            ]
          }
        ]
      }
    ];
  }
  
  /**
   * Helper to extract context from task
   */
  _getContextFromTask(task) {
    return task?.context || {};
  }
  
  /**
   * Delegate requirements analysis to child task using AnalysisStrategy
   * Phase 1.2: Hierarchical task delegation implementation
   */
  async _delegateRequirementsAnalysis(task) {
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
        strategy: this.analysisStrategy,
        workspaceDir: task.workspaceDir,
        llmClient: this.llmClient
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
   * Phase 2.2: Hierarchical task delegation implementation
   */
  async _delegateProjectPlanning(task, requirements) {
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
        strategy: this.planningStrategy,
        workspaceDir: task.workspaceDir,
        llmClient: this.llmClient,
        toolRegistry: this.toolRegistry
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
   * Delegate quality validation to child task using QualityStrategy
   * Phase 4.2: Hierarchical task delegation implementation
   */
  async _delegateQuality(task, executionResult) {
    console.log(`📋 Delegating quality validation to child task...`);
    
    // Store execution result in task artifacts for quality strategy
    task.storeArtifact('execution-result', executionResult, 'Project execution result for quality validation', 'execution');
    
    // Create child task for quality validation
    const taskManager = task.lookup ? task.lookup('taskManager') : null;
    if (!taskManager) {
      throw new Error('TaskManager is required for hierarchical delegation');
    }
    
    const qualityTask = await taskManager.createTask(
      `Validate project quality: ${task.description}`, 
      task, 
      {
        strategy: this.qualityStrategy,
        workspaceDir: task.workspaceDir,
        llmClient: this.llmClient,
        toolRegistry: this.toolRegistry
      }
    );
    
    if (!qualityTask) {
      throw new Error('Failed to create quality child task');
    }
    
    console.log(`📍 Created quality task: ${qualityTask.id || 'no-id'}`);
    
    // Send start message to child task
    const result = await qualityTask.receiveMessage({ type: 'start' });
    
    if (!result.success) {
      throw new Error(`Quality validation failed: ${result.result}`);
    }
    
    // Extract validation result from child task artifacts
    const validationArtifact = qualityTask.getArtifact('quality-validation');
    if (!validationArtifact) {
      throw new Error('Quality task completed but no validation result artifact found');
    }
    
    console.log(`✅ Quality validation delegated successfully`);
    return validationArtifact.content;
  }
  
  /**
   * Handle completion of child tasks (Phase 4: Migration to hierarchical delegation)
   */
  async _onChildComplete(task, childTask, result) {
    // Determine child task type by examining description or strategy
    if (childTask.description && childTask.description.includes('Analyze requirements')) {
      return await this._onAnalysisComplete(task, childTask, result);
    } else if (childTask.description && childTask.description.includes('Create project plan')) {
      return await this._onPlanningComplete(task, childTask, result);
    } else if (childTask.description && childTask.description.includes('Execute project plan')) {
      return await this._onExecutionComplete(task, childTask, result);
    } else if (childTask.description && childTask.description.includes('Validate project quality')) {
      return await this._onQualityComplete(task, childTask, result);
    } else {
      // Generic child completion handler
      return await this._onGenericChildComplete(task, childTask, result);
    }
  }
  
  /**
   * Handle completion of analysis child task
   * Phase 1.2: Child task completion handler
   */
  async _onAnalysisComplete(task, childTask, result) {
    console.log(`✅ Analysis child task completed: ${childTask.description}`);
    
    // Copy artifacts from child to parent
    const childArtifacts = childTask.getAllArtifacts();
    for (const [name, artifact] of Object.entries(childArtifacts)) {
      task.storeArtifact(name, artifact.content, artifact.description, artifact.type);
    }
    
    console.log(`📦 Copied ${Object.keys(childArtifacts).length} artifacts from analysis child`);
    
    // Continue with remaining project phases...
    // (This would continue the execution flow but for now just acknowledge)
    return { acknowledged: true, analysisComplete: true };
  }
  
  /**
   * Handle completion of planning child task
   * Phase 2.2: Child task completion handler
   */
  async _onPlanningComplete(task, childTask, result) {
    console.log(`✅ Planning child task completed: ${childTask.description}`);
    
    // Copy artifacts from child to parent
    const childArtifacts = childTask.getAllArtifacts();
    for (const [name, artifact] of Object.entries(childArtifacts)) {
      task.storeArtifact(name, artifact.content, artifact.description, artifact.type);
    }
    
    console.log(`📦 Copied ${Object.keys(childArtifacts).length} artifacts from planning child`);
    
    // Continue with remaining project phases...
    // (This would continue the execution flow but for now just acknowledge)
    return { acknowledged: true, planningComplete: true };
  }
  
  /**
   * Handle completion of execution child task
   * Phase 3.2: Child task completion handler
   */
  async _onExecutionComplete(task, childTask, result) {
    console.log(`✅ Execution child task completed: ${childTask.description}`);
    
    // Copy artifacts from child to parent
    const childArtifacts = childTask.getAllArtifacts();
    for (const [name, artifact] of Object.entries(childArtifacts)) {
      task.storeArtifact(name, artifact.content, artifact.description, artifact.type);
    }
    
    console.log(`📦 Copied ${Object.keys(childArtifacts).length} artifacts from execution child`);
    
    // Continue with remaining project phases...
    // (This would continue the execution flow but for now just acknowledge)
    return { acknowledged: true, executionComplete: true };
  }
  
  /**
   * Handle completion of quality child task
   * Phase 4.2: Child task completion handler
   */
  async _onQualityComplete(task, childTask, result) {
    console.log(`✅ Quality child task completed: ${childTask.description}`);
    
    // Copy artifacts from child to parent
    const childArtifacts = childTask.getAllArtifacts();
    for (const [name, artifact] of Object.entries(childArtifacts)) {
      task.storeArtifact(name, artifact.content, artifact.description, artifact.type);
    }
    
    console.log(`📦 Copied ${Object.keys(childArtifacts).length} artifacts from quality child`);
    
    // Continue with remaining project phases...
    // (This would continue the execution flow but for now just acknowledge)
    return { acknowledged: true, qualityComplete: true };
  }
  
  /**
   * Handle completion of generic child tasks
   */
  async _onGenericChildComplete(task, childTask, result) {
    console.log(`✅ Generic child task completed: ${childTask.description}`);
    
    // Copy artifacts from child to parent
    const childArtifacts = childTask.getAllArtifacts();
    for (const [name, artifact] of Object.entries(childArtifacts)) {
      task.storeArtifact(name, artifact.content, artifact.description, artifact.type);
    }
    
    console.log(`📦 Copied ${Object.keys(childArtifacts).length} artifacts from child`);
    
    return { acknowledged: true, childComplete: true };
  }
}