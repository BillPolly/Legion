/**
 * DecentPlanner - Thin orchestrator following Clean Architecture
 * Coordinates use cases and manages dependencies
 */

import { CreatePlanUseCase } from './application/use-cases/CreatePlanUseCase.js';
import { DecomposeTaskUseCase } from './application/use-cases/DecomposeTaskUseCase.js';
import { DiscoverToolsUseCase } from './application/use-cases/DiscoverToolsUseCase.js';
import { GenerateBehaviorTreeUseCase } from './application/use-cases/GenerateBehaviorTreeUseCase.js';
import { ValidatePlanUseCase } from './application/use-cases/ValidatePlanUseCase.js';

import { LLMComplexityClassifier } from './infrastructure/adapters/LLMComplexityClassifier.js';
import { LLMTaskDecomposer } from './infrastructure/adapters/LLMTaskDecomposer.js';
import { RegistryToolDiscoveryService } from './infrastructure/adapters/RegistryToolDiscoveryService.js';
import { ConsoleLogger } from './infrastructure/adapters/ConsoleLogger.js';
import { InMemoryPlanRepository } from './infrastructure/adapters/InMemoryPlanRepository.js';
import { InMemoryTaskRepository } from './infrastructure/adapters/InMemoryTaskRepository.js';

import { PlannerConfiguration } from './config/PlannerConfiguration.js';
import { ResourceManager } from '@legion/resource-manager';

export class DecentPlanner {
  constructor(options = {}) {
    this.config = new PlannerConfiguration(options);
    this.cancelled = false;
    this.initialized = false;
    
    // Will be initialized in initialize()
    this.dependencies = null;
    this.useCases = null;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    // Get or create dependencies
    this.dependencies = await this.createDependencies();
    
    // Create use cases with dependencies
    this.useCases = this.createUseCases(this.dependencies);
    
    this.initialized = true;
    this.dependencies.logger.info('DecentPlanner initialized');
  }

  async createDependencies() {
    const resourceManager = await ResourceManager.getInstance();
    
    // Get LLM client
    const llmClientOrPromise = resourceManager.get('llmClient');
    const llmClient = typeof llmClientOrPromise.then === 'function' 
      ? await llmClientOrPromise 
      : llmClientOrPromise;
    
    if (!llmClient) {
      throw new Error('LLM client is required but not available');
    }
    
    // Get tool registry - use the proper singleton instance
    const { ToolRegistry } = await import('@legion/tools-registry');
    const toolRegistry = await ToolRegistry.getInstance();
    
    // Create adapters
    const logger = new ConsoleLogger(this.config.logging);
    const planRepository = new InMemoryPlanRepository();
    const taskRepository = new InMemoryTaskRepository();
    const complexityClassifier = new LLMComplexityClassifier(llmClient);
    const taskDecomposer = new LLMTaskDecomposer(llmClient);
    const toolDiscoveryService = new RegistryToolDiscoveryService(
      toolRegistry,
      llmClient,
      this.config.toolDiscovery
    );
    
    // Get external planners if enabled
    let behaviorTreePlanner = null;
    let behaviorTreeValidator = null;
    
    if (this.config.formalPlanning.enabled) {
      const { Planner } = await import('@legion/planner');
      const { BTValidator } = await import('@legion/bt-validator');
      behaviorTreePlanner = new Planner({ llmClient });
      behaviorTreeValidator = new BTValidator();
    }
    
    return {
      logger,
      planRepository,
      taskRepository,
      complexityClassifier,
      taskDecomposer,
      toolDiscoveryService,
      behaviorTreePlanner,
      behaviorTreeValidator,
      llmClient,
      toolRegistry
    };
  }

  createUseCases(dependencies) {
    return {
      createPlan: new CreatePlanUseCase({
        planRepository: dependencies.planRepository,
        taskRepository: dependencies.taskRepository,
        logger: dependencies.logger
      }),
      
      decomposeTask: new DecomposeTaskUseCase({
        taskRepository: dependencies.taskRepository,
        complexityClassifier: dependencies.complexityClassifier,
        taskDecomposer: dependencies.taskDecomposer,
        logger: dependencies.logger,
        ...this.config.decomposition
      }),
      
      discoverTools: new DiscoverToolsUseCase({
        taskRepository: dependencies.taskRepository,
        toolDiscoveryService: dependencies.toolDiscoveryService,
        logger: dependencies.logger,
        ...this.config.toolDiscovery
      }),
      
      generateBehaviorTree: dependencies.behaviorTreePlanner ? 
        new GenerateBehaviorTreeUseCase({
          taskRepository: dependencies.taskRepository,
          behaviorTreePlanner: dependencies.behaviorTreePlanner,
          logger: dependencies.logger
        }) : null,
      
      validatePlan: dependencies.behaviorTreeValidator ?
        new ValidatePlanUseCase({
          planRepository: dependencies.planRepository,
          behaviorTreeValidator: dependencies.behaviorTreeValidator,
          logger: dependencies.logger
        }) : null
    };
  }

  /**
   * Cancel the current planning operation
   */
  cancel() {
    this.dependencies?.logger.info('Planning cancelled');
    this.cancelled = true;
  }

  /**
   * Reset cancellation flag
   */
  resetCancellation() {
    this.cancelled = false;
  }

  /**
   * Check if planning has been cancelled
   */
  checkCancellation() {
    if (this.cancelled) {
      throw new Error('Planning operation was cancelled');
    }
  }

  /**
   * Main planning method - orchestrates the planning process
   */
  async plan(goal, context = {}, progressCallback = null) {
    await this.initialize();
    this.resetCancellation();
    
    const startTime = Date.now();
    
    try {
      // Step 1: Create plan
      if (progressCallback) progressCallback('Creating plan...');
      this.checkCancellation();
      
      const planResult = await this.useCases.createPlan.execute({ goal, context });
      if (!planResult.success) {
        throw new Error(planResult.error);
      }
      
      const plan = planResult.data;
      
      // Step 2: Decompose task
      if (progressCallback) progressCallback('Decomposing tasks...');
      this.checkCancellation();
      
      const decomposeResult = await this.useCases.decomposeTask.execute({
        task: plan.rootTask,
        context,
        progressCallback: (msg) => {
          this.checkCancellation();
          if (progressCallback) progressCallback(msg);
        }
      });
      
      if (!decomposeResult.success) {
        throw new Error(decomposeResult.error);
      }
      
      plan.rootTask = decomposeResult.data.task;
      plan.updateStatistics(decomposeResult.data.statistics);
      
      // Step 3: Discover tools
      if (progressCallback) progressCallback('Discovering tools...');
      this.checkCancellation();
      
      const toolsResult = await this.useCases.discoverTools.execute({
        rootTask: plan.rootTask,
        progressCallback: (msg) => {
          this.checkCancellation();
          if (progressCallback) progressCallback(msg);
        }
      });
      
      if (!toolsResult.success) {
        throw new Error(toolsResult.error);
      }
      
      plan.updateStatistics({
        toolDiscovery: toolsResult.data
      });
      
      // Step 4: Generate behavior trees (if enabled)
      if (this.config.formalPlanning.enabled && this.useCases.generateBehaviorTree) {
        if (progressCallback) progressCallback('Generating behavior trees...');
        this.checkCancellation();
        
        const btResult = await this.useCases.generateBehaviorTree.execute({
          rootTask: plan.rootTask
        });
        
        if (btResult.success) {
          plan.behaviorTrees = btResult.data.behaviorTrees;
        }
      }
      
      // Step 5: Validate plan (if enabled)
      if (this.config.formalPlanning.validateBehaviorTrees && this.useCases.validatePlan) {
        if (progressCallback) progressCallback('Validating plan...');
        this.checkCancellation();
        
        const validationResult = await this.useCases.validatePlan.execute({
          plan
        });
        
        plan.setValidation(validationResult.data);
      }
      
      // Update plan status
      plan.updateStatus('VALIDATED');
      await this.dependencies.planRepository.update(plan);
      
      const duration = Date.now() - startTime;
      this.dependencies.logger.info('Planning completed', { 
        planId: plan.id.toString(),
        duration 
      });
      
      return {
        success: true,
        data: plan,
        duration
      };
      
    } catch (error) {
      this.dependencies?.logger.error('Planning failed', { 
        error: error.message 
      });
      
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Run only informal planning (decomposition + tool discovery)
   */
  async planInformalOnly(goal, context = {}, progressCallback = null) {
    const originalConfig = this.config.formalPlanning.enabled;
    this.config.formalPlanning.enabled = false;
    
    try {
      return await this.plan(goal, context, progressCallback);
    } finally {
      this.config.formalPlanning.enabled = originalConfig;
    }
  }

  /**
   * Generate report for a plan
   */
  generateReport(plan) {
    const lines = [
      '=== DECENT Planning Report ===',
      '',
      `Goal: ${plan.goal}`,
      `Status: ${plan.status}`,
      `Created: ${plan.createdAt.toISOString()}`,
      ''
    ];
    
    if (plan.statistics) {
      lines.push('## Statistics');
      lines.push(JSON.stringify(plan.statistics, null, 2));
      lines.push('');
    }
    
    if (plan.validation) {
      lines.push('## Validation');
      lines.push(JSON.stringify(plan.validation, null, 2));
      lines.push('');
    }
    
    if (plan.behaviorTrees && plan.behaviorTrees.length > 0) {
      lines.push('## Behavior Trees');
      lines.push(`Generated ${plan.behaviorTrees.length} behavior trees`);
      lines.push('');
    }
    
    return lines.join('\n');
  }
}