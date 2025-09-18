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
import { ResponseValidator } from '@legion/output-schema';
import { ProgressCalculator } from '../progress/ProgressCalculator.js';

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
    
    // Initialize ResponseValidator for tool calling (same as AtomicExecutionStrategy)
    this.toolCallSchema = {
      type: 'object',
      properties: {
        response: { type: 'string', description: 'Your response to the user' },
        use_tool: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Tool name to execute' },
            args: { type: 'object', description: 'Tool arguments' }
          },
          required: ['name', 'args']
        },
        use_tools: {
          type: 'array',
          description: 'Array of tools to execute in sequence',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Tool name' },
              args: { type: 'object', description: 'Tool arguments' }
            },
            required: ['name', 'args']
          }
        }
      },
      required: ['response']
    };
    this.responseValidator = new ResponseValidator(this.toolCallSchema);
    
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
    // BUT exclude tasks with sequential pattern keywords - those should use SequentialStrategy
    if (task.description && !task.tool && !task.toolName) {
      // Check for sequential patterns that should be handled by SequentialExecutionStrategy
      const sequentialPatterns = [
        'then',
        'finally',
        'after that',
        'followed by',
        'next',
        'subsequently',
        'afterwards',
        'step by step',
        'one by one',
        'in order',
        'sequentially'
      ];
      
      const descLower = task.description.toLowerCase();
      const hasSequentialPattern = sequentialPatterns.some(pattern => 
        descLower.includes(pattern)
      );
      
      // Don't handle if it has sequential patterns
      if (hasSequentialPattern) {
        return false;
      }
      
      return true;
    }

    // Can handle complex tasks that have description/prompt
    if (task.description || task.prompt || task.operation) {
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
        maxDepth: this.maxDepth
      });

      // Try direct execution first if task is simple enough
      if (!(await this.shouldDecompose(task, ctx))) {
        emitter.custom('direct_execution', { taskId, reason: 'Below decomposition threshold' });
        const directResult = await this.executeDirectly(task, ctx, emitter);
        // Return the result directly since executeDirectly already wraps it properly
        return directResult;
      }

      // Decompose task into subtasks
      emitter.custom('decomposition_start', { taskId, depth: ctx.depth });
      emitter.custom('decomposition_progress', {
        taskId,
        phase: 'analyzing',
        percentage: 10,
        message: 'Analyzing task complexity'
      });
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

      // Initialize progress calculator for subtask execution
      const progressCalculator = new ProgressCalculator(decomposition.subtasks.length);
      emitter.custom('execution_plan', {
        taskId,
        totalSubtasks: decomposition.subtasks.length,
        estimatedTime: progressCalculator.estimateInitialTime(this.calculateTaskComplexity(task))
      });

      // Execute subtasks recursively
      const subtaskResults = await this.executeSubtasks(
        decomposition.subtasks,
        ctx,
        emitter,
        decomposition.strategy,
        progressCalculator
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
   * Build comprehensive prompt for LLM decomposition decision
   */
  buildDecompositionDecisionPrompt(task, context) {
    const taskDescription = task.description || task.prompt || task.operation || 'Task with no description';
    const taskId = this.getTaskId(task);
    
    // Gather available execution strategies
    const availableStrategies = [
      'atomic (direct execution with tool or LLM)',
      'parallel (concurrent execution of independent subtasks)',
      'recursive (break down into smaller subtasks)',
      'conditional (branch based on conditions)'
    ];
    
    // Gather available tools if tool registry is available
    let toolContext = '';
    if (this.toolRegistry) {
      toolContext = '\nAvailable tools that might be relevant: calculator, file operations, data processing, etc.';
    }
    
    // Build context about current execution state
    const executionContext = {
      currentDepth: context.depth,
      maxDepth: this.maxDepth,
      remainingDepth: this.maxDepth - context.depth,
      hasSubtasks: Array.isArray(task.subtasks) && task.subtasks.length > 0,
      taskComplexity: this.estimateTaskComplexity ? this.estimateTaskComplexity(task, context) : null
    };
    
    const prompt = `You are a task decomposition expert. Analyze the following task and decide if it should be decomposed into subtasks.

TASK INFORMATION:
Task ID: ${taskId}
Description: ${taskDescription}
${task.tool ? `Tool specified: ${task.tool}` : ''}
${task.subtasks ? `Has ${task.subtasks.length} predefined subtasks` : 'No predefined subtasks'}

EXECUTION CONTEXT:
Current recursion depth: ${executionContext.currentDepth}
Maximum allowed depth: ${executionContext.maxDepth}
Remaining depth available: ${executionContext.remainingDepth}
${toolContext}

Available execution strategies: ${availableStrategies.join(', ')}

DECOMPOSITION RULES:
1. Simple atomic tasks (single tool call, direct calculation) should NOT be decomposed
2. Complex multi-step tasks SHOULD be decomposed if depth allows
3. Tasks with clear sequential steps benefit from decomposition
4. Tasks requiring different tools/capabilities should be decomposed
5. If remaining depth is 0, MUST NOT decompose
6. If task has predefined subtasks, prefer using them

Analyze the task and respond with a JSON object:
{
  "decompose": boolean,
  "reasoning": "Brief explanation of decision",
  "suggestedStrategy": "atomic|parallel|recursive|conditional",
  "estimatedSubtasks": number (if decomposing),
  "confidence": number (0-1)
}

Respond ONLY with valid JSON, no additional text.`;

    return prompt;
  }

  /**
   * Determine if task should be decomposed using LLM intelligence
   */
  async shouldDecompose(task, context) {
    // Hard constraints first - ABSOLUTELY no decomposition beyond max depth
    if (context.depth >= this.maxDepth) {
      return false;
    }

    // Respect explicit decomposition directives
    if (task.decompose !== undefined) {
      return task.decompose;
    }

    // If no LLM available, use simple heuristic
    if (!this.llmClient) {
      // Only decompose if task has predefined subtasks
      return Array.isArray(task.subtasks) && task.subtasks.length > 0;
    }

    try {
      // Build comprehensive context for LLM decision
      const prompt = this.buildDecompositionDecisionPrompt(task, context);
      
      // Ensure we have SimplePromptClient
      if (!this.simplePromptClient) {
        await this.initialize();
      }

      const response = await this.simplePromptClient.request({
        prompt,
        maxTokens: 500,
        temperature: 0.3, // Lower temperature for consistent decisions
        systemPrompt: 'You are a task decomposition expert. Answer with valid JSON only.'
      });

      const decision = JSON.parse(response.content || response);
      
      // Store the reasoning and suggested decomposition
      if (decision.decompose) {
        task._decompositionPlan = decision;
        if (context.log) {
          context.log(`Decomposition decision: ${decision.reasoning}`);
        }
      }
      
      return decision.decompose;
    } catch (error) {
      // Log error and default to no decomposition
      if (this.logger) {
        this.logger.warn('LLM decomposition decision failed', {
          taskId: this.getTaskId(task),
          error: error.message
        });
      }
      
      // Fallback: only decompose if task has predefined subtasks
      return Array.isArray(task.subtasks) && task.subtasks.length > 0;
    }
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
      
      // Build proper request parameters with tools (same pattern as AtomicExecutionStrategy)
      const requestParams = this.buildSimplePromptRequest(
        {
          ...task,
          prompt: decompositionPrompt,
          systemPrompt: 'You are a task decomposition expert. Break down complex tasks into smaller, manageable subtasks.',
          temperature: 0.3,
          maxTokens: 2000
        },
        context,
        decompositionPrompt
      );
      
      // Emit LLM request event for observability
      emitter.custom('llm_request', {
        taskId: taskId,
        model: 'default',
        temperature: 0.3,
        maxTokens: 2000,
        prompt: decompositionPrompt,
        toolsAvailable: requestParams.tools?.length || 0,
        purpose: 'task_decomposition',
        timestamp: new Date().toISOString()
      });
      
      const response = await this.simplePromptClient.request(requestParams);

      const decomposition = this.parseDecompositionResponse(response.content || response, task);
      
      // Emit LLM response event for observability
      emitter.custom('llm_response', {
        taskId: taskId,
        model: 'default',
        result: decomposition,
        purpose: 'task_decomposition',
        subtasksGenerated: decomposition.subtasks?.length || 0,
        timestamp: new Date().toISOString()
      });
      
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
   * Build decomposition prompt for LLM with artifact context
   */
  buildDecompositionPrompt(task, context) {
    const taskDescription = task.description || task.prompt || task.operation || 'Unnamed task';
    
    // Build artifact-aware prompt using base class method
    const basePrompt = this.buildPrompt(task, context);
    
    // Add decomposition-specific instructions
    const decompositionInstructions = `

Your task is to decompose the above task into smaller, manageable subtasks.

Context: Depth ${context.depth}/${this.maxDepth}
${task.constraints ? `Constraints: ${JSON.stringify(task.constraints)}` : ''}
${task.resources ? `Available Resources: ${JSON.stringify(task.resources)}` : ''}

Please respond with a JSON object containing:
{
  "subtasks": [
    {
      "id": "subtask-id",
      "description": "Subtask description",
      "tool": "tool_name",
      "inputs": {
        "parameter1": "direct value or @artifact_name",
        "parameter2": "@another_artifact"
      },
      "outputs": [
        {
          "name": "output_artifact_name",
          "type": "file|data|process|config|etc",
          "description": "Clear description of what this output is",
          "purpose": "Why this output is needed for the task"
        }
      ],
      "priority": 1-10,
      "dependencies": ["other-subtask-ids"],
      "estimatedTime": "time estimate"
    }
  ],
  "strategy": "sequential|parallel|mixed",
  "reasoning": "Why this decomposition approach"
}

Make sure subtasks:
- Reference existing artifacts using @artifact_name in inputs
- Specify meaningful names for outputs
- Are atomic and executable
- Are properly ordered if sequential
- Are independent if parallel
- Have clear success criteria
- Include artifact flow between subtasks`;

    return basePrompt + decompositionInstructions;
  }

  /**
   * Parse LLM decomposition response
   */
  parseDecompositionResponse(response, originalTask) {
    try {
      // Extract JSON from response if it contains other text
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      let jsonStr = jsonMatch ? jsonMatch[0] : response;
      
      // Sanitize JSON string to handle control characters
      jsonStr = this.sanitizeJsonString(jsonStr);
      
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
   * Sanitize JSON string to handle control characters that cause parsing errors
   * @param {string} jsonStr - Raw JSON string from LLM
   * @returns {string} - Sanitized JSON string
   */
  sanitizeJsonString(jsonStr) {
    if (!jsonStr || typeof jsonStr !== 'string') {
      return jsonStr;
    }

    // Replace common problematic control characters
    return jsonStr
      // Replace unescaped newlines within string values
      .replace(/(?<!\\)[\r\n]/g, '\\n')
      // Replace unescaped tabs within string values  
      .replace(/(?<!\\)\t/g, '\\t')
      // Replace unescaped backslashes (but be careful not to double-escape)
      .replace(/(?<!\\)\\(?!["\\/bfnrt])/g, '\\\\')
      // Remove any remaining control characters that aren't properly escaped
      .replace(/[\x00-\x1F\x7F]/g, (match) => {
        // Convert control chars to unicode escapes
        const code = match.charCodeAt(0);
        return '\\u' + code.toString(16).padStart(4, '0');
      });
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
  async executeSubtasks(subtasks, context, emitter, strategy = 'sequential', progressCalculator = null) {
    const results = [];
    
    // Create child context for subtask execution
    const childContext = context.createChild(`recursive-${Date.now()}`);

    switch (strategy) {
      case 'parallel':
        return await this.executeSubtasksParallel(subtasks, childContext, emitter, progressCalculator);
      
      case 'sequential':
        return await this.executeSubtasksSequential(subtasks, childContext, emitter, progressCalculator);
      
      case 'mixed':
        return await this.executeSubtasksMixed(subtasks, childContext, emitter, progressCalculator);
      
      default:
        return await this.executeSubtasksSequential(subtasks, childContext, emitter, progressCalculator);
    }
  }

  /**
   * Execute subtasks sequentially with artifact chaining
   */
  async executeSubtasksSequential(subtasks, context, emitter, progressCalculator = null) {
    const results = [];
    
    for (let i = 0; i < subtasks.length; i++) {
      const subtask = subtasks[i];
      const subtaskId = this.getTaskId(subtask);
      // Use the main context for artifact chaining in sequential execution
      const subtaskContext = context;
      
      // Start progress tracking for this subtask
      if (progressCalculator) {
        progressCalculator.startStep(subtaskId);
      }
      
      emitter.custom('subtask_start', {
        subtaskId,
        index: i,
        total: subtasks.length,
        strategy: 'sequential',
        artifactsAvailable: context.listArtifacts().length
      });

      try {
        const result = await this.executeSubtask(subtask, subtaskContext, emitter);
        results.push(result);
        
        // Complete progress tracking for this subtask
        if (progressCalculator) {
          progressCalculator.completeStep(subtaskId);
          
          // Emit progress update with calculated metrics
          emitter.custom('progress_update', {
            subtaskId,
            index: i,
            percentage: progressCalculator.calculatePercentage(),
            remainingTime: progressCalculator.estimateRemainingTime()
          });
        }
        
        emitter.custom('subtask_complete', {
          subtaskId,
          index: i,
          success: result.success,
          artifactsGenerated: subtaskContext.listArtifacts().length - context.listArtifacts().length
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
                context: subtaskContext,
                error: null,
                recovered: true
              };
              
              // Store recovery result as artifact if it has meaningful value
              if (recoveryResult.result !== undefined && recoveryResult.result !== null) {
                const artifactName = `${subtaskId}_recovery_result`;
                subtaskContext.addArtifact(artifactName, {
                  type: 'data',
                  value: recoveryResult.result,
                  description: `Recovery result from failed subtask execution`,
                  purpose: 'Store recovery result for sequential execution continuation',
                  timestamp: Date.now(),
                  metadata: {
                    subtaskId: subtaskId,
                    index: i,
                    recoveryAction: recoveryResult.action,
                    success: true
                  }
                });
              }
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
   * Execute subtasks in parallel with artifact isolation
   */
  async executeSubtasksParallel(subtasks, context, emitter, progressCalculator = null) {
    const promises = subtasks.map(async (subtask, index) => {
      const subtaskId = this.getTaskId(subtask);
      const subtaskContext = context.createChild(subtaskId);
      
      // Start progress tracking for this subtask
      if (progressCalculator) {
        progressCalculator.startStep(subtaskId);
      }
      
      emitter.custom('subtask_start', {
        subtaskId,
        index,
        total: subtasks.length,
        strategy: 'parallel',
        artifactsInherited: context.listArtifacts().length
      });

      try {
        const result = await this.executeSubtask(subtask, subtaskContext, emitter);
        
        // If subtask has tool execution with artifacts, use executeToolWithArtifacts
        if (subtask.tool && subtask.inputs && subtask.outputs) {
          await this.executeToolWithArtifacts(subtask, subtaskContext);
        }
        
        // Complete progress tracking for this subtask
        if (progressCalculator) {
          progressCalculator.completeStep(subtaskId);
          
          // Emit progress update with calculated metrics
          emitter.custom('progress_update', {
            subtaskId,
            index,
            percentage: progressCalculator.calculatePercentage(),
            remainingTime: progressCalculator.estimateRemainingTime()
          });
        }
        
        emitter.custom('subtask_complete', {
          subtaskId,
          index,
          success: result.success,
          artifactsGenerated: subtaskContext.listArtifacts().length - context.listArtifacts().length
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
              
              // Store recovery result as artifact if it has meaningful value
              if (recoveryResult.result !== undefined && recoveryResult.result !== null) {
                const artifactName = `${subtaskId}_recovery_result`;
                subtaskContext.addArtifact(artifactName, {
                  type: 'data',
                  value: recoveryResult.result,
                  description: `Recovery result from failed parallel subtask execution`,
                  purpose: 'Store recovery result for parallel execution aggregation',
                  timestamp: Date.now(),
                  metadata: {
                    subtaskId: subtaskId,
                    index: index,
                    recoveryAction: recoveryResult.action,
                    success: true
                  }
                });
              }
              
              return {
                success: true,
                result: recoveryResult.result || null,
                subtaskId,
                context: subtaskContext,
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
  async executeSubtasksMixed(subtasks, context, emitter, progressCalculator = null) {
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
                
                // Store recovery result as artifact if it has meaningful value
                if (recoveryResult.result !== undefined && recoveryResult.result !== null) {
                  const artifactName = `${subtaskId}_recovery_result`;
                  subtaskContext.addArtifact(artifactName, {
                    type: 'data',
                    value: recoveryResult.result,
                    description: `Recovery result from failed mixed execution subtask`,
                    purpose: 'Store recovery result for dependency chain continuation',
                    timestamp: Date.now(),
                    metadata: {
                      subtaskId: subtaskId,
                      recoveryAction: recoveryResult.action,
                      dependencyChain: true,
                      success: true
                    }
                  });
                }
                
                // Mark as completed and return success result from recovery
                completed.add(subtaskId);
                return {
                  success: true,
                  result: recoveryResult.result || null,
                  subtaskId,
                  context: subtaskContext,
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
    // Check if this is a tool call - handle it directly for proper artifact management
    if (subtask.tool || subtask.toolName) {
      // Resolve artifact references in inputs first to catch missing artifacts
      const resolvedInputs = this.resolveToolInputs(subtask.inputs || {}, context);
      
      // If the subtask has output specifications, use full artifact management
      if (subtask.outputs && Array.isArray(subtask.outputs)) {
        const toolCall = {
          tool: subtask.tool || subtask.toolName,
          inputs: subtask.inputs || {},
          outputs: subtask.outputs
        };
        
        const result = await this.executeToolWithArtifacts(toolCall, context);
        return {
          success: true,
          result: result
        };
      } else {
        // No outputs specified - just execute the tool with resolved inputs
        const tool = await this.toolRegistry.getTool(subtask.tool || subtask.toolName);
        if (!tool) {
          throw new Error(`Tool not found: ${subtask.tool || subtask.toolName}`);
        }
        
        const result = await tool.execute(resolvedInputs);
        return {
          success: true,
          result: result
        };
      }
    }
    
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
      const taskId = this.getTaskId(task);
      
      // Ensure we have SimplePromptClient
      if (!this.simplePromptClient) {
        await this.initialize();
        if (!this.simplePromptClient) {
          throw new Error('SimplePromptClient not configured for direct execution');
        }
      }

      // Build request parameters with proper tool integration
      const requestParams = this.buildSimplePromptRequest(task, context, 
        task.prompt || task.description || task.operation);
      
      // Emit LLM request event for observability
      emitter.custom('llm_request', {
        taskId: taskId,
        model: task.model || 'default',
        temperature: task.temperature,
        maxTokens: task.maxTokens,
        prompt: task.prompt || task.description || task.operation,
        toolsAvailable: requestParams.tools?.length || 0,
        purpose: 'direct_execution',
        timestamp: new Date().toISOString()
      });
      
      const response = await this.simplePromptClient.request(requestParams);
      
      // Handle null response gracefully (e.g., when LLM client fails)
      if (!response) {
        emitter.custom('llm_response_null', { taskId: this.getTaskId(task) });
        return {
          success: true,
          result: null,
          message: 'LLM request returned null response'
        };
      }
      
      // Process response through ResponseValidator for tool call detection (same as AtomicExecutionStrategy)
      if (this.responseValidator && this.toolRegistry && response) {
        const content = response.content || response;
        if (content) {
          const validationResult = this.responseValidator.process(content);
          
          if (validationResult.success && (validationResult.data.use_tool || validationResult.data.use_tools)) {
            // Execute tool calls (same pattern as AtomicExecutionStrategy)
            const toolCalls = validationResult.data.use_tools || [validationResult.data.use_tool];
            
            let finalContent = validationResult.data.response || (response.content || response);
            const toolResults = [];
            
            for (const toolCall of toolCalls) {
              try {
                // Emit tool execution start event
                emitter.custom('tool_execution_start', { 
                  tool: toolCall.name,
                  taskId: taskId,
                  timestamp: new Date().toISOString()
                });
                
                // Get tool from registry
                const tool = await this.toolRegistry.getTool(toolCall.name);
                if (!tool) {
                  throw new Error(`Tool '${toolCall.name}' not found`);
                }
                
                // Execute tool
                const result = await tool.execute(toolCall.args);
                const extractedResult = this.extractToolResult(result);
                
                toolResults.push({
                  name: toolCall.name,
                  args: toolCall.args,
                  result: result
                });
                
                // Emit tool execution complete event
                emitter.custom('tool_execution_complete', {
                  tool: toolCall.name,
                  taskId: taskId,
                  params: toolCall.args,
                  result: extractedResult,
                  timestamp: new Date().toISOString()
                });
                
                // Check for file creation and emit specific event
                if (toolCall.name === 'file_write' && result.success && toolCall.args.filepath) {
                  emitter.custom('file_created', {
                    filepath: toolCall.args.filepath,
                    content: toolCall.args.content,
                    size: toolCall.args.content?.length || 0,
                    timestamp: new Date().toISOString()
                  });
                }
                
                // Append tool result to content
                finalContent += `\n\n🔧 ${toolCall.name} executed: ${JSON.stringify(extractedResult)}`;
                
              } catch (error) {
                toolResults.push({
                  name: toolCall.name,
                  args: toolCall.args,
                  error: error.message
                });
                finalContent += `\n\n❌ ${toolCall.name} failed: ${error.message}`;
              }
            }
            
            // Emit LLM response event for observability
            emitter.custom('llm_response', {
              taskId: taskId,
              model: task.model || 'default',
              result: {
                content: finalContent,
                toolResults: toolResults,
                toolsExecuted: toolResults.length
              },
              purpose: 'direct_execution',
              toolsExecuted: toolResults.length,
              timestamp: new Date().toISOString()
            });
            
            return {
              content: finalContent,
              toolResults: toolResults,
              toolsExecuted: toolResults.length
            };
          }
          
          // Return validated response even if no tools were used
          if (validationResult.success) {
            const result = validationResult.data.response || (response.content || response);
            
            // Emit LLM response event for observability
            emitter.custom('llm_response', {
              taskId: taskId,
              model: task.model || 'default',
              result: result,
              purpose: 'direct_execution',
              toolsExecuted: 0,
              timestamp: new Date().toISOString()
            });
            
            return result;
          }
        }
      }

      // Fallback: Parse tool calls from response content (for XML format)
      if (response) {
        const parsedToolCalls = this.parseToolCallsFromContent(response.content || response);
        if (parsedToolCalls.length > 0) {
          emitter.custom('tool_calls_parsed', { count: parsedToolCalls.length });
          
          const toolResults = await this.executeToolCalls(parsedToolCalls, context, emitter);
          
          return {
            content: response.content || response,
            toolResults: toolResults,
            combinedResult: this.combineContentAndToolResults(response.content || response, toolResults)
          };
        }

        return response && response.content ? response.content : response;
      }
    }

    // Graceful fallback when no execution path is available
    emitter.custom('direct_execution_fallback', { taskId: this.getTaskId(task) });
    return {
      success: true,
      result: null,
      message: `No direct execution path available for task: ${this.getTaskId(task)}`
    };
  }

  /**
   * Build SimplePromptClient request parameters with proper tool integration (same as AtomicExecutionStrategy)
   */
  buildSimplePromptRequest(task, context, prompt) {
    const params = {
      prompt: prompt || task.prompt || task.description || task.operation,
      maxTokens: task.maxTokens || 1000,
      temperature: task.temperature
    };

    // Add system prompt with tool usage instructions
    let systemPrompt = task.systemPrompt || task.systemMessage || context.userContext?.systemPrompt || 'You are a helpful assistant.';
    
    // Add ResponseValidator format instructions for proper tool usage
    if (this.responseValidator) {
      const formatInstructions = this.responseValidator.generateInstructions({
        response: "I understand and will help you.",
        use_tool: {
          name: "file_write",
          args: { filePath: "/path/to/file.txt", content: "example content" }
        }
      });
      systemPrompt += '\n\n' + formatInstructions;
    }
    
    params.systemPrompt = systemPrompt;

    // Add chat history if provided
    if (task.messages && Array.isArray(task.messages)) {
      params.chatHistory = task.messages;
    }

    // Add context from conversation history if needed
    if (task.includeHistory && context.conversationHistory.length > 0) {
      const historyMessage = this.formatConversationHistory(context, 3);
      params.chatHistory = params.chatHistory || [];
      params.chatHistory.push({
        role: 'assistant',
        content: historyMessage
      });
    }

    // Add tools - CRITICAL: Automatically include all available tools
    if (task.tools && Array.isArray(task.tools)) {
      params.tools = task.tools;
    } else {
      // Get all available tools from registry (like AtomicExecutionStrategy does)
      params.tools = this.getAvailableToolsForLLM();
    }

    // Add any additional LLM options
    if (task.llmOptions) {
      Object.assign(params, task.llmOptions);
    }

    // Enrich prompt with context
    if (params.prompt) {
      params.prompt = this.enrichPrompt(params.prompt, context);
    }

    return params;
  }

  /**
   * Build history message from conversation history (updated for artifacts)
   */
  buildHistoryMessage(conversationHistory) {
    const relevant = conversationHistory.slice(-3); // Last 3 messages
    return relevant.map((msg, index) => 
      `${msg.role}: ${msg.content}`
    ).join('\n');
  }

  /**
   * Enrich prompt with context (artifact-aware version)
   */
  enrichPrompt(prompt, context) {
    let enriched = prompt;

    // Replace context variables (no shared state in new artifact system)
    const variables = {
      taskId: context.taskId,
      sessionId: context.sessionId,
      depth: context.depth,
      maxDepth: context.maxDepth,
      correlationId: context.correlationId
    };

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      enriched = enriched.replace(regex, value);
    });

    return enriched;
  }

  /**
   * Get available tools for LLM in SimplePromptClient format (same as AtomicExecutionStrategy)
   */
  getAvailableToolsForLLM() {
    if (!this.toolRegistry) {
      return [];
    }

    try {
      // Get tools from tool registry (check if method exists)
      if (this.toolRegistry.getAllTools && typeof this.toolRegistry.getAllTools === 'function') {
        const tools = this.toolRegistry.getAllTools();
        
        // Convert to SimplePromptClient format (same as AtomicExecutionStrategy)
        return tools.map(tool => ({
          name: tool.name || tool.toolName,
          description: tool.description || `Execute ${tool.name}`,
          parameters: tool.inputSchema || {
            type: 'object',
            properties: {},
            additionalProperties: true
          }
        }));
      } else {
        // Fallback for mock registries without getAllTools method
        return [];
      }
    } catch (error) {
      if (this.logger) {
        this.logger.warn('Failed to get available tools for LLM', { error: error.message });
      }
      return [];
    }
  }

  /**
   * Extract result from tool execution (same as AtomicExecutionStrategy)
   */
  extractToolResult(toolResult) {
    if (!toolResult) {
      return null;
    }

    // Standard tool result format
    if (toolResult.success !== undefined) {
      if (!toolResult.success) {
        throw new Error(toolResult.error || 'Tool execution failed');
      }
      // Return the actual result value, even if it's null/undefined
      if ('result' in toolResult) {
        return toolResult.result;
      }
      if ('data' in toolResult) {
        return toolResult.data;
      }
      return toolResult;
    }

    // Direct result
    return toolResult;
  }

  /**
   * Get available tools for SimplePromptClient
   */
  async getAvailableTools() {
    if (!this.toolRegistry) {
      return [];
    }

    try {
      // Get tools from tool registry
      const tools = await this.toolRegistry.listTools();
      
      // Convert to SimplePromptClient format
      return tools.map(tool => ({
        name: tool.name,
        description: tool.description || `Execute ${tool.name} tool`,
        inputSchema: tool.inputSchema || {
          type: 'object',
          properties: {},
          required: []
        }
      }));
    } catch (error) {
      if (this.logger) {
        this.logger.warn('Failed to get available tools', { error: error.message });
      }
      return [];
    }
  }

  /**
   * Parse tool calls from content using XML format (Anthropic style)
   */
  parseToolCallsFromContent(content) {
    if (!content || typeof content !== 'string') {
      return [];
    }

    const toolCalls = [];
    
    // Match <tool_use name="tool_name" parameters='{"param": "value"}'>
    const toolRegex = /<tool_use name="([^"]+)" parameters='([^']+)'>\s*<\/tool_use>/g;
    let match;
    
    while ((match = toolRegex.exec(content)) !== null) {
      try {
        const parameters = JSON.parse(match[2]);
        toolCalls.push({
          name: match[1],
          args: parameters,
          id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });
      } catch (e) {
        if (this.logger) {
          this.logger.warn('Failed to parse tool parameters', { 
            toolName: match[1], 
            parameters: match[2],
            error: e.message 
          });
        }
      }
    }
    
    return toolCalls;
  }

  /**
   * Execute tool calls and return results
   */
  async executeToolCalls(toolCalls, context, emitter) {
    const results = [];
    
    for (const toolCall of toolCalls) {
      try {
        emitter.custom('tool_execution_start', { tool: toolCall.name });
        
        // Get the tool from registry
        const tool = await this.toolRegistry.getTool(toolCall.name);
        if (!tool) {
          throw new Error(`Tool not found: ${toolCall.name}`);
        }

        // Execute the tool
        const result = await tool.execute(toolCall.args);
        
        emitter.custom('tool_execution_success', { 
          tool: toolCall.name,
          success: result.success !== false 
        });
        
        results.push({
          name: toolCall.name,
          args: toolCall.args,
          result: result,
          success: result.success !== false
        });
        
      } catch (error) {
        emitter.custom('tool_execution_error', { 
          tool: toolCall.name,
          error: error.message 
        });
        
        results.push({
          name: toolCall.name,
          args: toolCall.args,
          error: error.message,
          success: false
        });
      }
    }
    
    return results;
  }

  /**
   * Combine text content with tool execution results
   */
  combineContentAndToolResults(content, toolResults) {
    if (!toolResults || toolResults.length === 0) {
      return content;
    }

    let combined = content;
    
    // Replace tool_use XML with actual results
    for (const toolResult of toolResults) {
      if (toolResult.success && toolResult.result) {
        // Extract meaningful result
        const actualResult = this.extractToolResult(toolResult.result);
        
        // Format the result nicely
        const formattedResult = `\n\n🔧 ${toolResult.name} Result:\n${JSON.stringify(actualResult, null, 2)}`;
        combined += formattedResult;
      } else if (!toolResult.success) {
        const formattedError = `\n\n❌ ${toolResult.name} Error:\n${toolResult.error}`;
        combined += formattedError;
      }
    }
    
    return combined;
  }

  /**
   * Extract meaningful result from tool execution
   */
  extractToolResult(toolResult) {
    if (!toolResult) {
      return null;
    }

    // Standard tool result format
    if (toolResult.success !== undefined) {
      if (!toolResult.success) {
        return { error: toolResult.error || 'Tool execution failed' };
      }
      
      // Return the actual result value
      if ('result' in toolResult) {
        return toolResult.result;
      }
      if ('data' in toolResult) {
        return toolResult.data;
      }
      return toolResult;
    }

    // Direct result
    return toolResult;
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
          operation: 'execute_directly',
          // CRITICAL: Mark as atomic to prevent recursive decomposition
          atomic: true,
          decompose: false
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
    if (task.recursive || (await this.shouldDecompose(task, context))) {
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
   * Calculate task complexity for progress estimation
   */
  calculateTaskComplexity(task) {
    let complexity = 0.5; // Default complexity
    
    if (task.description) {
      // Length-based complexity
      complexity += Math.min(task.description.length / 1000, 0.3);
      
      // Keyword-based complexity
      const complexKeywords = ['multiple', 'several', 'analyze', 'comprehensive', 'detailed', 'complex'];
      const matches = complexKeywords.filter(keyword => 
        task.description.toLowerCase().includes(keyword)
      );
      complexity += matches.length * 0.1;
    }
    
    // Structure-based complexity
    if (task.subtasks) complexity += 0.2;
    if (task.dependencies) complexity += 0.15;
    if (task.tool || task.toolName) complexity += 0.1;
    
    return Math.min(complexity, 1.0);
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
