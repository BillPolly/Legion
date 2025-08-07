/**
 * PlannerEngine - Unified planning orchestrator for Legion framework
 * 
 * Combines the best features from llm-planner and recursive-planner:
 * - Strategy pattern for multiple planning approaches
 * - Robust JSON parsing and error handling
 * - BT structure generation instead of linear plans
 * - Clean separation from execution logic
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
    context = {}
  }) {
    this.description = description;
    this.inputs = inputs;
    this.requiredOutputs = requiredOutputs;
    this.allowableActions = allowableActions;
    this.maxSteps = maxSteps;
    this.initialInputData = initialInputData;
    this.context = context;
  }

  validate() {
    if (!this.description) {
      throw new Error('Planning request must have a description');
    }
    
    if (!this.allowableActions || this.allowableActions.length === 0) {
      throw new Error('Planning request must have allowable actions');
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
      debugMode: this.debugMode
    };
  }
}