/**
 * PlannerEngine - Unified planning orchestrator for Legion framework
 * 
 * Combines the best features from llm-planner and recursive-planner:
 * - Strategy pattern for multiple planning approaches
 * - Robust JSON parsing and error handling
 * - BT structure generation instead of linear plans
 * - Clean separation from execution logic
 * - Intelligent tool discovery via semantic search
 */

import { BTValidator } from '@legion/bt-validator';

/**
 * Planning request specification
 */
export class PlanningRequest {
  constructor({
    description,
    inputs = [],
    requiredOutputs = [],
    allowableActions = [],
    maxSteps = 20,
    initialInputData = {},
    context = {},
    useSemanticToolDiscovery = false,
    toolDiscoveryOptions = {}
  }) {
    this.description = description;
    this.inputs = inputs;
    this.requiredOutputs = requiredOutputs;
    this.allowableActions = allowableActions;
    this.maxSteps = maxSteps;
    this.initialInputData = initialInputData;
    this.context = context;
    this.useSemanticToolDiscovery = useSemanticToolDiscovery;
    this.toolDiscoveryOptions = toolDiscoveryOptions;
  }

  validate() {
    if (!this.description) {
      throw new Error('Planning request must have a description');
    }
    
    // Allow empty allowableActions if using semantic discovery
    if (!this.useSemanticToolDiscovery && (!this.allowableActions || this.allowableActions.length === 0)) {
      throw new Error('Planning request must have allowable actions or use semantic tool discovery');
    }
  }
}

/**
 * Planning result with validation
 */
export class PlanningResult {
  constructor(bt, strategy, metadata = {}) {
    this.bt = bt;              // Generated BT structure
    this.strategy = strategy;   // Strategy used for generation
    this.metadata = {
      createdAt: new Date().toISOString(),
      version: '1.0.0',
      ...metadata
    };
    this.validated = false;
    this.validationResult = null;
  }

  setValidation(validationResult) {
    this.validated = true;
    this.validationResult = validationResult;
    return this;
  }

  isValid() {
    return this.validated && this.validationResult?.valid;
  }
}

/**
 * Main planning engine that orchestrates strategy execution
 */
export class PlannerEngine {
  constructor(options = {}) {
    this.strategies = new Map();
    this.validator = options.validator || new BTValidator({
      strictMode: options.strictMode !== false,
      validateTools: true,
      applyDefaults: true
    });
    this.maxRetries = options.maxRetries || 3;
    this.debugMode = options.debugMode || false;
    this.toolDiscoveryService = options.toolDiscoveryService || null;
    this.toolRegistry = options.toolRegistry || null;
  }

  /**
   * Register a planning strategy
   * @param {string} name - Strategy name
   * @param {PlanningStrategy} strategy - Strategy implementation
   */
  registerStrategy(name, strategy) {
    if (!strategy || typeof strategy.generateBT !== 'function') {
      throw new Error(`Strategy '${name}' must implement generateBT method`);
    }
    
    this.strategies.set(name, strategy);
    
    if (this.debugMode) {
      console.log(`[PlannerEngine] Registered strategy: ${name}`);
    }
  }

  /**
   * Get registered strategy
   * @param {string} name - Strategy name
   * @returns {PlanningStrategy} Strategy implementation
   */
  getStrategy(name) {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      throw new Error(`Strategy '${name}' not found. Available: ${Array.from(this.strategies.keys()).join(', ')}`);
    }
    return strategy;
  }

  /**
   * List available strategies
   * @returns {Array<string>} Strategy names
   */
  listStrategies() {
    return Array.from(this.strategies.keys());
  }

  /**
   * Create a BT plan using the specified strategy
   * @param {PlanningRequest} request - Planning request
   * @param {string} strategyName - Strategy to use
   * @returns {Promise<PlanningResult>} Generated BT plan
   */
  async createPlan(request, strategyName) {
    // Validate request
    if (!(request instanceof PlanningRequest)) {
      throw new Error('Request must be a PlanningRequest instance');
    }
    
    // Enhance request with semantic tool discovery if enabled
    if (request.useSemanticToolDiscovery && this.toolDiscoveryService) {
      request = await this.enhanceRequestWithDiscoveredTools(request);
    }
    
    request.validate();

    const strategy = this.getStrategy(strategyName);
    let lastError;
    let lastFailedBT = null;

    // Retry loop with strategy-specific error handling
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        if (this.debugMode) {
          console.log(`[PlannerEngine] Attempt ${attempt}/${this.maxRetries} using strategy '${strategyName}'`);
        }

        // Generate BT using strategy
        const bt = await this.executeStrategyWithRetry(strategy, request, attempt, lastFailedBT, lastError);
        
        // Create result
        const result = new PlanningResult(bt, strategyName, {
          attempt,
          retries: attempt - 1,
          strategyName
        });

        // Validate generated BT
        const validationResult = await this.validator.validate(bt, request.allowableActions, request.context);
        result.setValidation(validationResult);

        if (result.isValid()) {
          if (this.debugMode) {
            console.log(`[PlannerEngine] Successfully generated valid BT with ${this.countBTNodes(bt)} nodes`);
          }
          return result;
        } else {
          if (this.debugMode) {
            console.log(`[PlannerEngine] BT validation failed:`, validationResult.errors);
          }
          
          lastFailedBT = bt;
          const validationError = new Error(`BT validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
          validationError.validationErrors = validationResult.errors;
          validationError.bt = bt;
          throw validationError;
        }

      } catch (error) {
        lastError = error;
        
        if (this.debugMode) {
          console.warn(`[PlannerEngine] Attempt ${attempt} failed:`, error.message);
        }
        
        if (attempt === this.maxRetries) {
          break;
        }
        
        // Exponential backoff
        await this.sleep(1000 * attempt);
      }
    }

    throw new Error(`Failed to generate valid BT plan after ${this.maxRetries} attempts using strategy '${strategyName}': ${lastError?.message}`);
  }

  /**
   * Execute strategy with retry context
   * @param {PlanningStrategy} strategy - Strategy to execute
   * @param {PlanningRequest} request - Original request
   * @param {number} attempt - Current attempt number
   * @param {Object} lastFailedBT - Previously failed BT (if any)
   * @param {Error} lastError - Previous error (if any)
   * @returns {Promise<Object>} Generated BT structure
   */
  async executeStrategyWithRetry(strategy, request, attempt, lastFailedBT, lastError) {
    const retryContext = {
      attempt,
      isRetry: attempt > 1,
      lastFailedBT,
      lastError,
      validationErrors: lastError?.validationErrors || []
    };

    // Check if strategy supports retry-aware generation
    if (attempt > 1 && typeof strategy.generateBTWithRetry === 'function') {
      return await strategy.generateBTWithRetry(request, retryContext);
    } else {
      return await strategy.generateBT(request, retryContext);
    }
  }

  /**
   * Create multiple plans using different strategies
   * @param {PlanningRequest} request - Planning request
   * @param {Array<string>} strategyNames - Strategies to try
   * @returns {Promise<Array<PlanningResult>>} Generated plans
   */
  async createMultiplePlans(request, strategyNames) {
    const results = [];
    
    for (const strategyName of strategyNames) {
      try {
        const result = await this.createPlan(request, strategyName);
        results.push(result);
      } catch (error) {
        if (this.debugMode) {
          console.warn(`[PlannerEngine] Strategy '${strategyName}' failed:`, error.message);
        }
        results.push({
          strategy: strategyName,
          error: error.message,
          success: false
        });
      }
    }
    
    return results;
  }

  /**
   * Find the best strategy for a given request
   * @param {PlanningRequest} request - Planning request
   * @param {Array<string>} candidateStrategies - Strategies to evaluate
   * @returns {Promise<string>} Best strategy name
   */
  async selectBestStrategy(request, candidateStrategies) {
    // Simple heuristic - can be enhanced with ML/scoring
    const results = await this.createMultiplePlans(request, candidateStrategies);
    
    const validResults = results.filter(r => r.success !== false && r.isValid());
    
    if (validResults.length === 0) {
      throw new Error('No strategy was able to generate a valid BT');
    }
    
    // For now, prefer the first successful one
    // Could be enhanced with scoring based on BT complexity, execution time estimates, etc.
    return validResults[0].strategy;
  }

  /**
   * Count nodes in BT structure
   * @param {Object} bt - BT structure
   * @returns {number} Node count
   */
  countBTNodes(bt) {
    let count = 1; // Count this node
    
    if (bt.children && Array.isArray(bt.children)) {
      for (const child of bt.children) {
        count += this.countBTNodes(child);
      }
    }
    
    if (bt.child) {
      count += this.countBTNodes(bt.child);
    }
    
    return count;
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Enhance planning request with semantically discovered tools
   * @param {PlanningRequest} request - Original planning request
   * @returns {Promise<PlanningRequest>} Enhanced request with discovered tools
   */
  async enhanceRequestWithDiscoveredTools(request) {
    if (!this.toolDiscoveryService) {
      console.warn('[PlannerEngine] Tool discovery service not configured');
      return request;
    }

    try {
      if (this.debugMode) {
        console.log(`[PlannerEngine] Discovering tools for: ${request.description}`);
      }

      // Find relevant tools based on task description
      const discoveredTools = await this.toolDiscoveryService.findRelevantTools(
        request.description,
        {
          limit: request.toolDiscoveryOptions.limit || 20,
          minScore: request.toolDiscoveryOptions.minScore || 0.7,
          categories: request.toolDiscoveryOptions.categories,
          excludeTools: request.toolDiscoveryOptions.excludeTools,
          includeMetadata: true
        }
      );

      if (this.debugMode) {
        console.log(`[PlannerEngine] Discovered ${discoveredTools.length} relevant tools`);
        console.log(`[PlannerEngine] Top tools:`, discoveredTools.slice(0, 5).map(t => ({
          name: t.name,
          score: t.relevanceScore.toFixed(2)
        })));
      }

      // Convert discovered tools to allowable actions format
      const allowableActions = discoveredTools.map(tool => {
        // If we have the actual tool instance, use its schema
        if (tool.instance) {
          return {
            type: tool.name,
            description: tool.description || tool.instance.description,
            inputSchema: tool.instance.inputSchema || tool.instance.schema,
            outputSchema: tool.instance.outputSchema,
            metadata: {
              category: tool.category,
              relevanceScore: tool.relevanceScore,
              capabilities: tool.capabilities
            }
          };
        }
        
        // Otherwise use discovered metadata
        return {
          type: tool.name,
          description: tool.description,
          metadata: {
            category: tool.category,
            relevanceScore: tool.relevanceScore,
            capabilities: tool.capabilities,
            available: false
          }
        };
      });

      // Merge with existing allowable actions (if any)
      const enhancedRequest = new PlanningRequest({
        ...request,
        allowableActions: [...request.allowableActions, ...allowableActions],
        context: {
          ...request.context,
          toolDiscovery: {
            performed: true,
            toolCount: discoveredTools.length,
            topTools: discoveredTools.slice(0, 5).map(t => t.name)
          }
        }
      });

      return enhancedRequest;

    } catch (error) {
      console.error('[PlannerEngine] Tool discovery failed:', error);
      
      // Fall back to original request
      if (request.allowableActions.length > 0) {
        return request;
      }
      
      // If no fallback tools, throw error
      throw new Error(`Tool discovery failed and no fallback tools provided: ${error.message}`);
    }
  }

  /**
   * Create planning request with semantic tool discovery
   * @param {string} taskDescription - Natural language task description
   * @param {Object} options - Planning options
   * @returns {Promise<PlanningRequest>} Planning request with discovered tools
   */
  async createSemanticPlanningRequest(taskDescription, options = {}) {
    const request = new PlanningRequest({
      description: taskDescription,
      useSemanticToolDiscovery: true,
      toolDiscoveryOptions: options.toolDiscovery || {},
      maxSteps: options.maxSteps || 20,
      context: options.context || {}
    });

    // Discover and add tools
    return await this.enhanceRequestWithDiscoveredTools(request);
  }

  /**
   * Get engine statistics
   * @returns {Object} Engine statistics
   */
  getStats() {
    return {
      registeredStrategies: Array.from(this.strategies.keys()),
      strategyCount: this.strategies.size,
      validatorOptions: {
        strictMode: this.validator.strictMode,
        validateTools: this.validator.validateTools,
        applyDefaults: this.validator.applyDefaults
      },
      maxRetries: this.maxRetries,
      debugMode: this.debugMode,
      toolDiscoveryEnabled: !!this.toolDiscoveryService,
      toolRegistryEnabled: !!this.toolRegistry
    };
  }
}