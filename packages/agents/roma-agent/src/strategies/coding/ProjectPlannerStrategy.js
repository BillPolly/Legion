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

// Import components (to be implemented)
import RequirementsAnalyzer from './components/RequirementsAnalyzer.js';
import ProjectStructurePlanner from './components/ProjectStructurePlanner.js';
import ExecutionOrchestrator from './components/ExecutionOrchestrator.js';
import QualityController from './components/QualityController.js';
import ProgressTracker from './components/ProgressTracker.js';
import StateManager from './components/StateManager.js';
import ParallelExecutor from './components/ParallelExecutor.js';
import RecoveryManager from './components/RecoveryManager.js';
import EventStream from './components/EventStream.js';

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
    
    // Initialize component placeholders
    this.requirementsAnalyzer = null;
    this.projectPlanner = null;
    this.executionOrchestrator = null;
    this.qualityController = null;
    this.progressTracker = null;
    this.stateManager = null;
    this.parallelExecutor = null;
    this.recoveryManager = null;
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
    
    // Initialize components
    this.requirementsAnalyzer = new RequirementsAnalyzer(this.llmClient);
    this.projectPlanner = new ProjectStructurePlanner(this.llmClient, this.toolRegistry);
    
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
    
    this.qualityController = new QualityController(this.llmClient, this.toolRegistry);
    this.progressTracker = new ProgressTracker();
    this.stateManager = new StateManager(this.projectRoot);
    
    this.executionOrchestrator = new ExecutionOrchestrator(
      strategiesForOrchestrator,
      this.stateManager
    );
    this.parallelExecutor = new ParallelExecutor({ maxConcurrent: this.maxConcurrent });
    this.recoveryManager = new RecoveryManager(this.llmClient, this.toolRegistry);
    this.eventStream = new EventStream();
    
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
  async onParentMessage(parentTask, message) {
    switch (message.type) {
      case 'start':
        return await this._planAndExecuteProject(parentTask);
      case 'status':
        return await this._reportStatus(parentTask);
      case 'cancel':
        return await this._cancelExecution(parentTask);
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
      
      // Phase 1: Analyze requirements
      this.eventStream.emit({ type: 'phase.started', data: { phase: 'requirements' } });
      const requirements = await this.requirementsAnalyzer.analyze(task.description);
      await this.stateManager.updateRequirements(requirements);
      this.eventStream.emit({ type: 'phase.completed', data: { phase: 'requirements' } });
      
      // Phase 2: Create project plan
      this.eventStream.emit({ type: 'phase.started', data: { phase: 'planning' } });
      const plan = await this.projectPlanner.createPlan(requirements, task.id);
      await this.stateManager.savePlan(plan);
      this.eventStream.emit({ type: 'phase.completed', data: { phase: 'planning' } });
      
      // Phase 3: Execute plan
      this.eventStream.emit({ type: 'phase.started', data: { phase: 'execution' } });
      const result = await this._executePlan(plan, task);
      this.eventStream.emit({ type: 'phase.completed', data: { phase: 'execution' } });
      
      // Phase 4: Validate quality
      this.eventStream.emit({ type: 'phase.started', data: { phase: 'validation' } });
      const validation = await this.qualityController.validateProject(result);
      
      if (!validation.passed) {
        // Attempt recovery
        const recovery = await this._attemptRecovery(validation.issues);
        if (recovery.success) {
          result = recovery.result;
        }
      }
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
    const progress = this.progressTracker.getProgress();
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
    await this.executionOrchestrator.stopAll();
    
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
        this.eventStream.emit({ 
          type: 'phase.executing', 
          data: { phase: phase.phase, taskCount: phase.tasks.length } 
        });
        
        const phaseResults = {
          phase: phase.phase,
          priority: phase.priority,
          tasks: [],
          success: true
        };
        
        // Execute tasks in this phase
        for (const planTask of phase.tasks) {
          try {
            this.progressTracker.update({ 
              taskStarted: planTask.id, 
              description: planTask.description 
            });
            
            const taskResult = await this.executionOrchestrator.execute(planTask);
            
            phaseResults.tasks.push({
              id: planTask.id,
              success: taskResult.success,
              artifacts: taskResult.artifacts || []
            });
            
            // Store artifacts
            if (taskResult.artifacts) {
              results.artifacts.push(...taskResult.artifacts);
              for (const artifact of taskResult.artifacts) {
                task.storeArtifact?.(artifact);
              }
            }
            
            this.progressTracker.update({ 
              taskCompleted: planTask.id, 
              success: taskResult.success 
            });
            
          } catch (error) {
            console.error(`Task ${planTask.id} failed:`, error.message);
            phaseResults.tasks.push({
              id: planTask.id,
              success: false,
              error: error.message
            });
            phaseResults.success = false;
            
            this.progressTracker.update({ 
              taskFailed: planTask.id, 
              error: error.message 
            });
          }
        }
        
        results.phases.push(phaseResults);
        
        // If this phase failed and it's critical, stop execution
        if (!phaseResults.success && phase.priority <= 3) {
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
   * Attempt to recover from validation failures
   */
  async _attemptRecovery(issues) {
    try {
      const recovery = await this.recoveryManager.recover(issues);
      return recovery;
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
}