/**
 * RecursiveExecutionStrategy - Execute tasks through hierarchical decomposition
 * Handles recursive task breakdown and execution with depth control
 * 
 * Features:
 * - Hierarchical task decomposition
 * - Depth control and cycle detection
 * - Adaptive strategy selection
 * - Result composition from subtasks
 * - Progress tracking for recursive execution
 */

import { ExecutionStrategy } from './ExecutionStrategy.js';
import { Logger } from '../../utils/Logger.js';

export class RecursiveExecutionStrategy extends ExecutionStrategy {
  constructor(injectedDependencies = {}) {
    super(injectedDependencies);
    this.name = 'RecursiveExecutionStrategy';
    this.maxDepth = injectedDependencies.maxDepth ?? 5;
    this.decomposeThreshold = injectedDependencies.decomposeThreshold ?? 0.7;
    this.logger = injectedDependencies.logger || new Logger('RecursiveExecutionStrategy');
    this.useCache = injectedDependencies.useCache ?? true;
    this.decompositionCache = new Map();
    this.cycleDetection = injectedDependencies.cycleDetection ?? true;
    
    // Initialize dependencies with injection
    this.initializeDependencies(injectedDependencies);
  }

  /**
   * Initialize dependencies for better testability
   * @param {Object} dependencies - Injected dependencies
   */
  initializeDependencies(dependencies) {
    this.toolRegistry = dependencies.toolRegistry || null;
    this.llmClient = dependencies.llmClient || null;
    this.progressStream = dependencies.progressStream || null;
    this.resourceManager = dependencies.resourceManager || null;
    this.errorRecovery = dependencies.errorRecovery || null;
    this.options = dependencies; // Store for substrategy creation
  }

  /**
   * Update dependencies after construction for testing
   * @param {Object} updatedDependencies - New dependencies to inject
   */
  updateDependencies(updatedDependencies) {
    // Update inherited dependencies
    if (super.updateDependencies) {
      super.updateDependencies(updatedDependencies);
    }
    
    // Update strategy-specific dependencies
    if (updatedDependencies.toolRegistry) {
      this.toolRegistry = updatedDependencies.toolRegistry;
    }
    if (updatedDependencies.llmClient) {
      this.llmClient = updatedDependencies.llmClient;
    }
    if (updatedDependencies.progressStream) {
      this.progressStream = updatedDependencies.progressStream;
    }
    if (updatedDependencies.resourceManager) {
      this.resourceManager = updatedDependencies.resourceManager;
    }
    if (updatedDependencies.logger) {
      this.logger = updatedDependencies.logger;
    }
    if (updatedDependencies.errorRecovery) {
      this.errorRecovery = updatedDependencies.errorRecovery;
    }
    if (updatedDependencies.maxDepth !== undefined) {
      this.maxDepth = updatedDependencies.maxDepth;
    }
    if (updatedDependencies.decomposeThreshold !== undefined) {
      this.decomposeThreshold = updatedDependencies.decomposeThreshold;
    }
    if (updatedDependencies.useCache !== undefined) {
      this.useCache = updatedDependencies.useCache;
    }
    if (updatedDependencies.cycleDetection !== undefined) {
      this.cycleDetection = updatedDependencies.cycleDetection;
    }

    // Update options for substrategy creation
    this.options = { ...this.options, ...updatedDependencies };

    if (this.logger) {
      this.logger.debug('RecursiveExecutionStrategy dependencies updated', {
        updatedKeys: Object.keys(updatedDependencies)
      });
    }
  }

  /**
   * Get current dependencies for testing/inspection
   * @returns {Object} - Current dependency state
   */
  getDependencies() {
    const baseDependencies = super.getDependencies ? super.getDependencies() : {};
    
    return {
      ...baseDependencies,
      toolRegistry: this.toolRegistry,
      llmClient: this.llmClient,
      progressStream: this.progressStream,
      resourceManager: this.resourceManager,
      logger: this.logger,
      errorRecovery: this.errorRecovery,
      maxDepth: this.maxDepth,
      decomposeThreshold: this.decomposeThreshold,
      useCache: this.useCache,
      cycleDetection: this.cycleDetection
    };
  }

  /**
   * Check if this strategy can handle the task
   */
  canHandle(task, context) {
    // Can handle if task is marked as recursive
    if (task.recursive || task.strategy === 'recursive') {
      return true;
    }

    // Can handle if task indicates hierarchical structure
    if (task.decompose || task.breakdown) {
      return true;
    }

    // Can handle if task has hierarchical indicators
    if (task.hierarchy || task.nested) {
      return true;
    }

    // Can handle simple data tasks marked as recursive
    if (task.data !== undefined && task.recursive) {
      return true;
    }

    // Can handle tasks with description (even if not explicitly marked recursive)
    if (task.description && !task.tool && !task.toolName) {
      return true;
    }

    // Can handle complex tasks that need decomposition
    if (this.requiresDecomposition(task, context)) {
      return true;
    }

    // Can handle if task has recursive subtasks
    if (task.subtasks && task.subtasks.some(st => st.recursive || st.decompose)) {
      return true;
    }

    return false;
  }

  /**
   * Execute task through recursive decomposition
   */
  async execute(task, context) {
    this.validateTask(task);
    const taskId = this.getTaskId(task);

    return this.executeWithMonitoring(task, context, async (task, ctx, emitter) => {
      // Check if we can handle this task
      if (!this.canHandle(task, ctx)) {
        throw new Error(`RecursiveExecutionStrategy cannot handle task: ${taskId}`);
      }

      // Check depth limits - must be enforced before attempting decomposition
      if (ctx.depth >= this.maxDepth) {
        throw new Error(`Maximum recursion depth exceeded: ${ctx.depth}`);
      }

      // Check for cycles if enabled
      if (this.cycleDetection && this.detectCycle(task, ctx)) {
        throw new Error(`Cycle detected in task execution: ${taskId}`);
      }

      emitter.custom('recursive_start', {
        taskId,
        depth: ctx.depth,
        maxDepth: this.maxDepth,
        requiresDecomposition: this.requiresDecomposition(task, ctx)
      });

      // Try direct execution first if task is simple enough
      if (!this.shouldDecompose(task, ctx)) {
        emitter.custom('direct_execution', { taskId, reason: 'Below decomposition threshold' });
        const directResult = await this.executeDirectly(task, ctx, emitter);
        // Return the result directly since executeDirectly already wraps it properly
        return directResult;
      }

      // Decompose task into subtasks
      emitter.custom('decomposition_start', { taskId, depth: ctx.depth });
      const decomposition = await this.decomposeTask(task, ctx, emitter);

      if (!decomposition) {
        this.logger.warn('Decomposition failed, falling back to direct execution', {
          taskId
        });
        emitter.custom('decomposition_failed', {
          taskId,
          fallback: 'direct_execution'
        });
        return await this.executeDirectly(task, ctx, emitter);
      }

      if (!decomposition.subtasks || decomposition.subtasks.length === 0) {
        // Fallback to direct execution if decomposition is empty
        emitter.custom('decomposition_empty', { taskId, fallback: 'direct_execution' });
        return await this.executeDirectly(task, ctx, emitter);
      }

      emitter.custom('decomposition_complete', {
        taskId,
        subtaskCount: decomposition.subtasks.length,
        decompositionStrategy: decomposition.strategy || 'default'
      });

      // Execute subtasks recursively
      const subtaskResults = await this.executeSubtasks(
        decomposition.subtasks,
        ctx,
        emitter,
        decomposition.strategy
      );

      // Compose final result from subtask results
      emitter.custom('composition_start', {
        taskId,
        subtaskResults: subtaskResults.length,
        successful: subtaskResults.filter(r => r.success).length
      });

      const composedResult = await this.composeResult(
        task,
        subtaskResults,
        decomposition,
        ctx
      );

      emitter.custom('recursive_complete', {
        taskId,
        depth: ctx.depth,
        subtasksExecuted: subtaskResults.length,
        successful: subtaskResults.filter(r => r.success).length,
        failed: subtaskResults.filter(r => !r.success).length
      });

      // Return composed result - extract the actual result if wrapped in metadata
      const finalResult = composedResult && typeof composedResult === 'object' && composedResult.result !== undefined
        ? composedResult.result
        : composedResult;

      return finalResult;
    });
  }

  /**
   * Determine if task should be decomposed
   */
  shouldDecompose(task, context) {
    // Check depth limits first - ABSOLUTELY no decomposition beyond max depth
    if (context.depth >= this.maxDepth) {
      return false;
    }

    // Always decompose if explicitly requested (depth limits already checked above)
    if (task.decompose || task.breakdown) {
      return true;
    }

    // For recursive tasks, only decompose if they have complexity indicators
    if (task.recursive && (task.subtasks || task.description)) {
      return true;
    }

    // Check decomposition threshold
    const complexity = this.estimateTaskComplexity(task, context);
    if (complexity.score >= this.decomposeThreshold) {
      return true;
    }

    // Check if task has complexity indicators
    return this.requiresDecomposition(task, context);
  }

  /**
   * Decompose task into subtasks
   */
  async decomposeTask(task, context, emitter) {
    const taskId = this.getTaskId(task);

    if (this.useCache) {
      const cacheKey = this.createCacheKey(task, context);
      if (this.decompositionCache.has(cacheKey)) {
        emitter.custom('cache_hit', { taskId, cacheKey });
        return this.decompositionCache.get(cacheKey);
      }
    }

    let decomposition = null;

    if (task.subtasks && Array.isArray(task.subtasks)) {
      decomposition = {
        subtasks: task.subtasks,
        strategy: task.decompositionStrategy || 'predefined',
        metadata: { source: 'predefined' }
      };
    } else if (this.llmClient && (task.description || task.prompt || task.operation)) {
      decomposition = await this.llmDecompose(task, context, emitter);

      if (!decomposition) {
        decomposition = this.createFallbackDecomposition(task);
      }
    } else if (task.template || task.pattern) {
      decomposition = await this.templateDecompose(task, context);
    } else {
      decomposition = await this.heuristicDecompose(task, context);
    }

    if (!decomposition) {
      this.logger.error('Task decomposition failed', {
        taskId
      });
      return null;
    }

    if (this.useCache) {
      const cacheKey = this.createCacheKey(task, context);
      this.decompositionCache.set(cacheKey, decomposition);
    }

    return decomposition;
  }

  /**
   * LLM-based task decomposition
   */
  async llmDecompose(task, context, emitter) {
    const taskId = this.getTaskId(task);
    
    try {
      emitter.custom('llm_decomposition_start', { taskId });

      const decompositionPrompt = this.buildDecompositionPrompt(task, context);
      
      // Ensure we have SimplePromptClient
      if (!this.simplePromptClient) {
        await this.initialize();
      }
      
      const response = await this.simplePromptClient.request({
        prompt: decompositionPrompt,
        systemPrompt: 'You are a task decomposition expert. Break down complex tasks into smaller, manageable subtasks.',
        temperature: 0.3,
        maxTokens: 2000
      });

      const decomposition = this.parseDecompositionResponse(response.content || response, task);
      
      emitter.custom('llm_decomposition_complete', {
        taskId,
        subtaskCount: decomposition.subtasks?.length || 0
      });

      return decomposition;
    } catch (error) {
      const message = error.message || String(error);

      if (message.startsWith('Failed to parse decomposition response')) {
        this.logger.warn('LLM decomposition response parsing failed, using fallback', { taskId, error: message });
        emitter.custom('llm_decomposition_failed', { taskId, error: message, fallback: true });
        return this.createFallbackDecomposition(task);
      }

      this.logger.error('LLM decomposition failed', { taskId, error: message });
      emitter.custom('llm_decomposition_failed', { taskId, error: message });
      
      return null;
    }
  }

  /**
   * Build decomposition prompt for LLM
   */
  buildDecompositionPrompt(task, context) {
    const taskDescription = task.description || task.prompt || task.operation || 'Unnamed task';
    
    return `
Please decompose the following task into smaller, manageable subtasks:

Task: ${taskDescription}
Context: Depth ${context.depth}/${this.maxDepth}
${task.constraints ? `Constraints: ${JSON.stringify(task.constraints)}` : ''}
${task.resources ? `Available Resources: ${JSON.stringify(task.resources)}` : ''}

Please respond with a JSON object containing:
{
  "subtasks": [
    {
      "id": "subtask-id",
      "description": "Subtask description",
      "operation": "What to do",
      "priority": 1-10,
      "dependencies": ["other-subtask-ids"],
      "estimatedTime": "time estimate"
    }
  ],
  "strategy": "sequential|parallel|mixed",
  "reasoning": "Why this decomposition approach"
}

Make sure subtasks are:
- Atomic and executable
- Properly ordered if sequential
- Independent if parallel
- Have clear success criteria
`.trim();
  }

  /**
   * Parse LLM decomposition response
   */
  parseDecompositionResponse(response, originalTask) {
    try {
      // Extract JSON from response if it contains other text
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : response;
      
      const parsed = JSON.parse(jsonStr);
      
      // Validate and enrich subtasks
      if (parsed.subtasks && Array.isArray(parsed.subtasks)) {
        parsed.subtasks = parsed.subtasks.map((subtask, index) => ({
          id: subtask.id || `${originalTask.id || 'task'}-sub-${index}`,
          description: subtask.description || subtask.operation,
          operation: subtask.operation || subtask.description,
          priority: subtask.priority || 5,
          dependencies: subtask.dependencies || [],
          estimatedTime: subtask.estimatedTime || 1000,
          parent: this.getTaskId(originalTask),
          ...subtask
        }));
      }

      return {
        subtasks: parsed.subtasks || [],
        strategy: parsed.strategy || 'sequential',
        reasoning: parsed.reasoning || 'LLM decomposition',
        metadata: {
          source: 'llm',
          confidence: this.estimateDecompositionConfidence(parsed)
        }
      };
    } catch (error) {
      // Log parsing error with context
      this.logger.warn('Failed to parse LLM decomposition response', {
        taskId: this.getTaskId(originalTask),
        error: error.message,
        responseSnippet: response ? response.substring(0, 200) : 'empty'
      });
      
      // Throw error to be handled by caller
      throw new Error(`Failed to parse decomposition response: ${error.message}`);
    }
  }

  /**
   * Template-based decomposition
   */
  async templateDecompose(task, context) {
    const template = task.template || task.pattern;
    
    // Simple template substitution
    if (typeof template === 'object' && template.steps) {
      return {
        subtasks: template.steps.map((step, index) => ({
          id: `${task.id || 'task'}-template-${index}`,
          ...step
        })),
        strategy: template.strategy || 'sequential',
        metadata: { source: 'template' }
      };
    }

    this.logger?.warn('Invalid task template provided', {
      taskId: this.getTaskId(task)
    });
    return null;
  }

  /**
   * Heuristic-based decomposition
   */
  async heuristicDecompose(task, context) {
    const subtasks = [];
    const taskDescription = task.description || task.operation || task.prompt || '';

    // Look for step indicators
    const stepPatterns = [
      /step \d+[:\-]/gi,
      /first[,\s].*then/gi,
      /\d+\./g,
      /-\s+/g
    ];

    let foundSteps = false;
    for (const pattern of stepPatterns) {
      const matches = taskDescription.match(pattern);
      if (matches && matches.length > 1) {
        // Split by pattern and create subtasks
        const parts = taskDescription.split(pattern).filter(part => part.trim());
        parts.forEach((part, index) => {
          if (part.trim()) {
            subtasks.push({
              id: `${task.id || 'task'}-heuristic-${index}`,
              description: part.trim(),
              operation: part.trim(),
              priority: index + 1
            });
          }
        });
        foundSteps = true;
        break;
      }
    }

    if (!foundSteps) {
      // Create generic subtasks based on task type
      if (task.tool || task.toolName) {
        subtasks.push({
          id: `${task.id || 'task'}-tool-exec`,
          description: `Execute ${task.tool || task.toolName}`,
          tool: task.tool || task.toolName,
          params: task.params || {}
        });
      } else {
        // Create planning and execution phases
        subtasks.push(
          {
            id: `${task.id || 'task'}-plan`,
            description: 'Plan the task execution',
            operation: 'analyze_and_plan',
            priority: 1
          },
          {
            id: `${task.id || 'task'}-execute`,
            description: 'Execute the planned task',
            operation: 'execute_plan',
            priority: 2,
            dependencies: [`${task.id || 'task'}-plan`]
          }
        );
      }
    }

    if (subtasks.length > 0) {
      return {
        subtasks,
        strategy: 'sequential',
        metadata: { source: 'heuristic', confidence: 0.6 }
      };
    }
    
    this.logger?.warn('Unable to decompose task heuristically', {
      taskId: this.getTaskId(task)
    });
    return null;
  }

  /**
   * Execute subtasks using appropriate strategy
   */
  async executeSubtasks(subtasks, context, emitter, strategy = 'sequential') {
    const results = [];
    
    // Create child context for subtask execution
    const childContext = context.createChild(`recursive-${Date.now()}`);

    switch (strategy) {
      case 'parallel':
        return await this.executeSubtasksParallel(subtasks, childContext, emitter);
      
      case 'sequential':
        return await this.executeSubtasksSequential(subtasks, childContext, emitter);
      
      case 'mixed':
        return await this.executeSubtasksMixed(subtasks, childContext, emitter);
      
      default:
        return await this.executeSubtasksSequential(subtasks, childContext, emitter);
    }
  }

  /**
   * Execute subtasks sequentially
   */
  async executeSubtasksSequential(subtasks, context, emitter) {
    const results = [];
    
    for (let i = 0; i < subtasks.length; i++) {
      const subtask = subtasks[i];
      const subtaskContext = context.createChild(this.getTaskId(subtask));
      
      emitter.custom('subtask_start', {
        subtaskId: this.getTaskId(subtask),
        index: i,
        total: subtasks.length,
        strategy: 'sequential'
      });

      try {
        const result = await this.executeSubtask(subtask, subtaskContext, emitter);
        results.push(result);
        
        emitter.custom('subtask_complete', {
          subtaskId: this.getTaskId(subtask),
          index: i,
          success: result.success
        });
      } catch (error) {
        const subtaskId = this.getTaskId(subtask);
        
        // Attempt error recovery if available
        if (this.errorRecovery) {
          try {
            const recoveryResult = await this.errorRecovery.recover(error, {
              subtaskId,
              index: i,
              context: subtaskContext.getMetadata ? subtaskContext.getMetadata() : {},
              strategy: 'RecursiveExecutionStrategy',
              sequential: true,
              totalSubtasks: subtasks.length
            });
            
            if (recoveryResult.success) {
              if (this.logger) {
                this.logger.info('Error recovery successful for sequential subtask', {
                  subtaskId,
                  index: i,
                  recoveryAction: recoveryResult.action
                });
              }
              
              emitter.custom('subtask_recovery_success', {
                subtaskId,
                index: i,
                recoveryAction: recoveryResult.action
              });
              
              // Apply recovery delay if specified
              if (recoveryResult.delay) {
                await new Promise(resolve => setTimeout(resolve, recoveryResult.delay));
              }
              
              // Create success result from recovery
              const recoverySuccess = {
                success: true,
                result: recoveryResult.result || null,
                subtaskId,
                context: subtaskContext.withResult(recoveryResult.result),
                error: null,
                recovered: true
              };
              results.push(recoverySuccess);
              
              emitter.custom('subtask_complete', {
                subtaskId,
                index: i,
                success: true,
                recovered: true
              });
              
              continue; // Skip to next subtask
            }
          } catch (recoveryError) {
            if (this.logger) {
              this.logger.warn('Error recovery failed for sequential subtask', {
                subtaskId,
                index: i,
                originalError: error.message,
                recoveryError: recoveryError.message
              });
            }
          }
        }
        
        this.logger.error('Subtask execution failed', {
          subtaskId,
          index: i,
          error: error.message
        });
        
        const errorResult = {
          success: false,
          error: error.message,
          subtaskId,
          context: subtaskContext
        };
        results.push(errorResult);
        
        emitter.custom('subtask_failed', {
          subtaskId,
          index: i,
          error: error.message
        });
        
        // If critical, propagate the error
        if (subtask.critical !== false) {
          throw new Error(`Critical subtask failed: ${subtaskId} - ${error.message}`);
        }
      }
    }
    
    return results;
  }

  /**
   * Execute subtasks in parallel
   */
  async executeSubtasksParallel(subtasks, context, emitter) {
    const promises = subtasks.map(async (subtask, index) => {
      const subtaskContext = context.createChild(this.getTaskId(subtask));
      
      emitter.custom('subtask_start', {
        subtaskId: this.getTaskId(subtask),
        index,
        total: subtasks.length,
        strategy: 'parallel'
      });

      try {
        const result = await this.executeSubtask(subtask, subtaskContext, emitter);
        
        emitter.custom('subtask_complete', {
          subtaskId: this.getTaskId(subtask),
          index,
          success: result.success
        });
        
        return result;
      } catch (error) {
        const subtaskId = this.getTaskId(subtask);
        
        // Attempt error recovery if available
        if (this.errorRecovery) {
          try {
            const recoveryResult = await this.errorRecovery.recover(error, {
              subtaskId,
              index,
              context: subtaskContext.getMetadata ? subtaskContext.getMetadata() : {},
              strategy: 'RecursiveExecutionStrategy',
              parallel: true,
              totalSubtasks: subtasks.length
            });
            
            if (recoveryResult.success) {
              if (this.logger) {
                this.logger.info('Error recovery successful for parallel subtask', {
                  subtaskId,
                  index,
                  recoveryAction: recoveryResult.action
                });
              }
              
              emitter.custom('subtask_recovery_success', {
                subtaskId,
                index,
                recoveryAction: recoveryResult.action
              });
              
              // Apply recovery delay if specified
              if (recoveryResult.delay) {
                await new Promise(resolve => setTimeout(resolve, recoveryResult.delay));
              }
              
              // Return recovered result
              emitter.custom('subtask_complete', {
                subtaskId,
                index,
                success: true,
                recovered: true
              });
              
              return {
                success: true,
                result: recoveryResult.result || null,
                subtaskId,
                context: subtaskContext.withResult(recoveryResult.result),
                error: null,
                recovered: true
              };
            }
          } catch (recoveryError) {
            if (this.logger) {
              this.logger.warn('Error recovery failed for parallel subtask', {
                subtaskId,
                index,
                originalError: error.message,
                recoveryError: recoveryError.message
              });
            }
          }
        }
        
        this.logger.error('Parallel subtask execution failed', {
          subtaskId,
          index,
          error: error.message
        });
        
        emitter.custom('subtask_failed', {
          subtaskId,
          index,
          error: error.message
        });
        
        // For parallel execution, we collect errors but don't throw immediately
        // unless the subtask is marked as critical
        if (subtask.critical === true) {
          throw new Error(`Critical parallel subtask failed: ${subtaskId} - ${error.message}`);
        }
        
        return {
          success: false,
          error: error.message,
          subtaskId,
          context: subtaskContext
        };
      }
    });

    return await Promise.all(promises);
  }

  /**
   * Execute subtasks with mixed strategy (respecting dependencies)
   */
  async executeSubtasksMixed(subtasks, context, emitter) {
    const results = [];
    const completed = new Set();
    const pending = [...subtasks];
    
    while (pending.length > 0) {
      // Find tasks that can be executed (no pending dependencies)
      const ready = pending.filter(subtask => {
        const deps = subtask.dependencies || [];
        return deps.every(dep => completed.has(dep));
      });

      if (ready.length === 0) {
        throw new Error('Circular dependency detected in subtasks');
      }

      // Execute ready tasks in parallel
      const readyPromises = ready.map(async subtask => {
        const subtaskContext = context.createChild(this.getTaskId(subtask));
        const subtaskId = this.getTaskId(subtask);
        
        try {
          const result = await this.executeSubtask(subtask, subtaskContext, emitter);
          completed.add(subtaskId);
          return result;
        } catch (error) {
          // Attempt error recovery if available
          if (this.errorRecovery) {
            try {
              const recoveryResult = await this.errorRecovery.recover(error, {
                subtaskId,
                context: subtaskContext.getMetadata ? subtaskContext.getMetadata() : {},
                strategy: 'RecursiveExecutionStrategy',
                mixed: true,
                dependencyChain: true,
                critical: subtask.critical
              });
              
              if (recoveryResult.success) {
                if (this.logger) {
                  this.logger.info('Error recovery successful for mixed subtask', {
                    subtaskId,
                    recoveryAction: recoveryResult.action
                  });
                }
                
                emitter.custom('subtask_recovery_success', {
                  subtaskId,
                  recoveryAction: recoveryResult.action,
                  mixed: true
                });
                
                // Apply recovery delay if specified
                if (recoveryResult.delay) {
                  await new Promise(resolve => setTimeout(resolve, recoveryResult.delay));
                }
                
                // Mark as completed and return success result from recovery
                completed.add(subtaskId);
                return {
                  success: true,
                  result: recoveryResult.result || null,
                  subtaskId,
                  context: subtaskContext.withResult(recoveryResult.result),
                  recovered: true
                };
              }
            } catch (recoveryError) {
              if (this.logger) {
                this.logger.warn('Error recovery failed for mixed subtask', {
                  subtaskId,
                  originalError: error.message,
                  recoveryError: recoveryError.message
                });
              }
            }
          }
          
          this.logger.error('Mixed execution subtask failed', {
            subtaskId,
            error: error.message
          });
          
          // For mixed execution with dependencies, critical failures should propagate
          if (subtask.critical === true) {
            throw new Error(`Critical subtask failed in dependency chain: ${subtaskId} - ${error.message}`);
          }
          
          completed.add(subtaskId); // Mark as completed even if failed
          return {
            success: false,
            error: error.message,
            subtaskId,
            context: subtaskContext
          };
        }
      });

      const readyResults = await Promise.all(readyPromises);
      results.push(...readyResults);

      // Remove completed tasks from pending
      ready.forEach(subtask => {
        const index = pending.indexOf(subtask);
        if (index >= 0) {
          pending.splice(index, 1);
        }
      });
    }

    return results;
  }

  /**
   * Execute a single subtask
   */
  async executeSubtask(subtask, context, emitter) {
    // Select appropriate strategy for subtask
    const strategy = await this.selectSubtaskStrategy(subtask, context);
    
    if (strategy) {
      return await strategy.execute(subtask, context);
    } else {
      // executeDirectly now returns raw result, so we need to wrap it for consistency
      const directResult = await this.executeDirectly(subtask, context, emitter);
      return {
        success: true,
        result: directResult
      };
    }
  }

  /**
   * Select strategy for subtask execution
   */
  async selectSubtaskStrategy(subtask, context) {
    // Recursive tasks
    if (this.canHandle(subtask, context)) {
      return this; // Use self for recursive subtasks
    }

    // Parallel subtasks
    if (subtask.parallel || Array.isArray(subtask.subtasks)) {
      const { ParallelExecutionStrategy } = await import('./ParallelExecutionStrategy.js');
      return new ParallelExecutionStrategy({
        toolRegistry: this.toolRegistry,
        llmClient: this.llmClient,
        progressStream: this.progressStream
      });
    }

    // Sequential subtasks
    if (subtask.sequential || Array.isArray(subtask.steps)) {
      const { SequentialExecutionStrategy } = await import('./SequentialExecutionStrategy.js');
      return new SequentialExecutionStrategy({
        toolRegistry: this.toolRegistry,
        llmClient: this.llmClient,
        progressStream: this.progressStream
      });
    }

    // Atomic subtasks
    if (subtask.tool || subtask.toolName || subtask.execute || subtask.fn) {
      const { AtomicExecutionStrategy } = await import('./AtomicExecutionStrategy.js');
      return new AtomicExecutionStrategy({
        toolRegistry: this.toolRegistry,
        llmClient: this.llmClient,
        progressStream: this.progressStream
      });
    }

    return null;
  }

  /**
   * Execute task directly (fallback)
   */
  async executeDirectly(task, context, emitter) {
    // Direct data return (prioritize over description)
    if (task.data !== undefined) {
      return task.data;
    }

    // Simple prompt execution
    if (task.prompt || task.description || task.operation) {
      // Ensure we have SimplePromptClient
      if (!this.simplePromptClient) {
        await this.initialize();
        if (!this.simplePromptClient) {
          throw new Error('SimplePromptClient not configured for direct execution');
        }
      }

      const response = await this.simplePromptClient.request({
        prompt: task.prompt || task.description || task.operation,
        maxTokens: task.maxTokens || 1000,
        temperature: task.temperature
      });

      return response && response.content ? response.content : response;
    }

    throw new Error(`Cannot execute task directly: ${this.getTaskId(task)}`);
  }

  /**
   * Compose final result from subtask results
   */
  async composeResult(originalTask, subtaskResults, decomposition, context) {
    const successful = subtaskResults.filter(r => r.success);
    const failed = subtaskResults.filter(r => !r.success);

    // Custom composition function
    if (originalTask.compose && typeof originalTask.compose === 'function') {
      return originalTask.compose(subtaskResults, decomposition);
    }

    // Default composition based on task type
    const compositionType = originalTask.compositionType || 'aggregate';
    
    switch (compositionType) {
      case 'aggregate':
        return {
          result: successful.map(r => this.extractResultValue(r)),
          metadata: {
            successful: successful.length,
            failed: failed.length,
            total: subtaskResults.length,
            source: decomposition?.metadata?.source || 'composed'
          }
        };

      case 'merge':
        return {
          result: successful.reduce((acc, result) => {
            const value = this.extractResultValue(result);
            if (typeof value === 'object' && value !== null) {
              return { ...acc, ...value };
            }
            return acc;
          }, {}),
          metadata: {
            successful: successful.length,
            failed: failed.length,
            total: subtaskResults.length,
            source: decomposition?.metadata?.source || 'composed'
          }
        };

      case 'last':
        // Return last successful result directly
        const lastResult = successful[successful.length - 1];
        return lastResult ? this.extractResultValue(lastResult) : null;

      case 'first':
        // Return first successful result directly
        const firstResult = successful[0];
        return firstResult ? this.extractResultValue(firstResult) : null;

      default:
        return {
          result: successful.map(r => this.extractResultValue(r)),
          metadata: {
            successful: successful.length,
            failed: failed.length,
            total: subtaskResults.length,
            source: decomposition?.metadata?.source || 'composed'
          }
        };
    }
  }

  /**
   * Detect cycles in task execution
   */
  detectCycle(task, context) {
    if (!this.cycleDetection) return false;
    
    const taskId = this.getTaskId(task);
    const ancestors = context.getAncestors ? context.getAncestors() : [];
    
    return ancestors.some(ancestor => 
      this.getTaskId(ancestor) === taskId ||
      (ancestor.description && task.description && 
       ancestor.description === task.description)
    );
  }

  /**
   * Estimate task complexity for decomposition decisions
   */
  estimateTaskComplexity(task, context) {
    let score = 0;
    const description = task.description || task.operation || task.prompt || '';

    // Length-based complexity
    score += Math.min(description.length / 1000, 0.3);

    // Keyword-based complexity
    const complexityKeywords = [
      'multiple', 'several', 'various', 'complex', 'detailed',
      'step by step', 'stages', 'phases', 'break down',
      'analyze', 'research', 'investigate', 'comprehensive'
    ];
    
    const keywordMatches = complexityKeywords.filter(keyword => 
      description.toLowerCase().includes(keyword)
    ).length;
    
    score += keywordMatches * 0.1;

    // Structure-based complexity
    if (task.subtasks && task.subtasks.length > 0) {
      score += 0.5;
    }
    
    if (task.constraints && Object.keys(task.constraints).length > 2) {
      score += 0.2;
    }

    // Context-based complexity
    score += context.depth * 0.1;

    return {
      score: Math.min(score, 1.0),
      factors: {
        length: description.length,
        keywords: keywordMatches,
        hasSubtasks: !!task.subtasks,
        depth: context.depth
      }
    };
  }

  /**
   * Estimate decomposition confidence
   */
  estimateDecompositionConfidence(decomposition) {
    if (!decomposition.subtasks || decomposition.subtasks.length === 0) {
      return 0;
    }

    let confidence = 0.5; // Base confidence

    // More subtasks generally indicate better decomposition
    confidence += Math.min(decomposition.subtasks.length * 0.1, 0.3);

    // Check for proper structure
    const hasDescriptions = decomposition.subtasks.every(st => st.description);
    if (hasDescriptions) confidence += 0.2;

    // Check for dependencies (indicates thoughtful decomposition)
    const hasDependencies = decomposition.subtasks.some(st => st.dependencies && st.dependencies.length > 0);
    if (hasDependencies) confidence += 0.15;

    // Check for reasoning
    if (decomposition.reasoning) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Create cache key for decomposition
   */
  createCacheKey(task, context) {
    const description = task.description || task.operation || task.prompt || '';
    const constraints = JSON.stringify(task.constraints || {});
    return `${description.substring(0, 100)}-${constraints}-${context.depth}`;
  }

  /**
   * Create fallback decomposition
   */
  createFallbackDecomposition(task) {
    return {
      subtasks: [
        {
          id: `${task.id || 'task'}-fallback`,
          description: task.description || task.operation || task.prompt,
          operation: 'execute_directly'
        }
      ],
      strategy: 'sequential',
      metadata: { source: 'fallback', confidence: 0.3 }
    };
  }

  /**
   * Estimate execution complexity
   */
  async estimateComplexity(task, context) {
    const complexity = this.estimateTaskComplexity(task, context);
    
    // Check if task is recursive or will be decomposed
    if (task.recursive || this.shouldDecompose(task, context)) {
      // Recursive execution estimate
      const estimatedSubtasks = Math.max(2, Math.ceil(complexity.score * 5));
      const estimatedDepth = Math.min(context.depth + 1, this.maxDepth);
      
      const baseTime = 1000; // Base time per subtask
      const decompositionTime = 3000; // Time for decomposition
      const compositionTime = 1000; // Time for result composition
      
      const totalTime = decompositionTime + (estimatedSubtasks * baseTime) + compositionTime;
      const totalCost = 0.002 + (estimatedSubtasks * 0.001); // LLM costs

      return {
        estimatedTime: totalTime,
        estimatedCost: totalCost,
        confidence: 0.6 - (estimatedDepth * 0.1),
        reasoning: `Recursive execution with ~${estimatedSubtasks} subtasks at depth ${estimatedDepth}`
      };
    }

    // Direct execution estimate
    return {
      estimatedTime: 2000,
      estimatedCost: 0.001,
      confidence: 0.8,
      reasoning: 'Direct execution (below decomposition threshold)'
    };
  }

  /**
   * Validate recursive task configuration
   */
  validateRecursiveTask(task) {
    this.validateTask(task);

    if (this.maxDepth < 1) {
      throw new Error('Max depth must be at least 1');
    }

    if (this.decomposeThreshold < 0 || this.decomposeThreshold > 1) {
      throw new Error('Decompose threshold must be between 0 and 1');
    }

    return true;
  }

  /**
   * Clear decomposition cache
   */
  clearCache() {
    this.decompositionCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.decompositionCache.size,
      enabled: this.useCache
    };
  }
}
