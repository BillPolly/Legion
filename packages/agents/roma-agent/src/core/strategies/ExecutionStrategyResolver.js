/**
 * ExecutionStrategyResolver - Selects appropriate execution strategy for tasks
 * Evaluates tasks against available strategies and returns the best match
 * 
 * Features:
 * - Strategy discovery and registration
 * - Priority-based strategy selection
 * - Fallback to atomic execution
 * - Strategy validation and compatibility checks
 * - Dynamic strategy loading
 */

import { AtomicExecutionStrategy } from './AtomicExecutionStrategy.js';
import { ParallelExecutionStrategy } from './ParallelExecutionStrategy.js';
import { SequentialExecutionStrategy } from './SequentialExecutionStrategy.js';
import { RecursiveExecutionStrategy } from './RecursiveExecutionStrategy.js';
import { Logger } from '../../utils/Logger.js';
import { 
  StrategyError, 
  StrategySelectionError 
} from '../../errors/ROMAErrors.js';
import { TaskAnalyzer } from '../../analysis/TaskAnalyzer.js';

const DEFAULT_STRATEGY_NAMES = new Set([
  'AtomicExecutionStrategy',
  'ParallelExecutionStrategy',
  'SequentialExecutionStrategy',
  'RecursiveExecutionStrategy'
]);

export class ExecutionStrategyResolver {
  constructor(injectedDependencies = {}) {
    this.dependencies = { ...injectedDependencies };
    this.priorityOrderedStrategies = [];
    this.strategyInstanceRegistry = new Map();
    this.strategyPriorityMap = new Map();
    this.logger = injectedDependencies.logger || new Logger('ExecutionStrategyResolver');
    this.enableTaskAnalyzer = injectedDependencies.enableTaskAnalyzer !== false;
    this.taskAnalyzer = injectedDependencies.taskAnalyzer || (this.enableTaskAnalyzer ? new TaskAnalyzer({ logger: this.logger }) : null);

    // Initialize default strategies
    this.initializeDefaultStrategies();
  }

  /**
   * Initialize default execution strategies with proper priority ordering
   */
  initializeDefaultStrategies() {
    // Strategy order matters - more specific strategies should be checked first
    const defaultStrategies = [
      { class: RecursiveExecutionStrategy, priority: 10 },  // High priority for complex tasks
      { class: ParallelExecutionStrategy, priority: 8 },    // High priority for parallel tasks
      { class: SequentialExecutionStrategy, priority: 6 },  // Medium priority for sequential tasks
      { class: AtomicExecutionStrategy, priority: 1 }       // Low priority - fallback for simple tasks
    ];

    for (const { class: StrategyClass, priority } of defaultStrategies) {
      this.registerStrategy(StrategyClass, priority);
    }
  }

  /**
   * Register a new execution strategy
   * @param {Class} StrategyClass - Strategy class constructor
   * @param {number} priority - Strategy priority (higher = checked first)
   * @param {Object} options - Strategy-specific options
   */
  registerStrategy(StrategyClass, strategyPriority = 5, strategyOptions = {}) {
    const uniqueStrategyName = StrategyClass.name;
    
    if (this.strategyInstanceRegistry.has(uniqueStrategyName)) {
      throw new Error(`Strategy ${uniqueStrategyName} is already registered`);
    }

    // Validate toolRegistry before strategy creation
    if (!this.dependencies.toolRegistry) {
      this.logger.warn('Creating strategy without toolRegistry - attempting to get from singleton');
    }

    // Ensure toolRegistry is passed to all strategies
    const strategyDeps = {
      ...this.dependencies,
      toolRegistry: this.dependencies.toolRegistry || null,  // Will be recovered in getToolRegistry if needed
      ...strategyOptions
    };

    // Create strategy instance with dependencies
    const newStrategyInstance = new StrategyClass(strategyDeps);

    // Validate strategy interface
    this.validateStrategy(newStrategyInstance);

    this.strategyInstanceRegistry.set(uniqueStrategyName, newStrategyInstance);
    this.strategyPriorityMap.set(uniqueStrategyName, strategyPriority);
    
    // Rebuild strategies array sorted by priority
    this.rebuildStrategiesArray();
  }

  /**
   * Unregister a strategy
   * @param {string} strategyName - Name of strategy to remove
   */
  unregisterStrategy(targetStrategyName) {
    if (!this.strategyInstanceRegistry.has(targetStrategyName)) {
      throw new Error(`Strategy ${targetStrategyName} is not registered`);
    }

    this.strategyInstanceRegistry.delete(targetStrategyName);
    this.strategyPriorityMap.delete(targetStrategyName);
    this.rebuildStrategiesArray();
  }

  /**
   * Select the best strategy for a task
   * @param {Object} task - Task to execute
   * @param {ExecutionContext} context - Execution context
   * @returns {ExecutionStrategy} - Selected strategy instance
   */
  async selectStrategy(taskDefinition, executionContext) {
    // Validate inputs
    if (!taskDefinition) {
      throw new Error('Task is required for strategy selection');
    }
    if (!executionContext) {
      throw new Error('ExecutionContext is required for strategy selection');
    }

    const taskId = taskDefinition.id || taskDefinition.taskId || 'unknown';

    // Manual override
    if (taskDefinition.strategy) {
      const override = this.getStrategy(taskDefinition.strategy);
      if (override) {
        if (this.logger) {
          this.logger.info('Using manual strategy override', {
            taskId,
            strategy: taskDefinition.strategy
          });
        }
        return override;
      }

      if (this.logger) {
        this.logger.warn('Manual strategy override not found, falling back to automatic selection', {
          taskId,
          strategy: taskDefinition.strategy
        });
      }
    }

    // Respect atomic flag
    if (taskDefinition.atomic === true) {
      const atomicStrategy = this.getStrategy('AtomicExecutionStrategy');
      if (atomicStrategy) {
        if (this.logger) {
          this.logger.info('Atomic flag enforced - using AtomicExecutionStrategy', { taskId });
        }
        return atomicStrategy;
      }
    }

    // Task analyzer recommendation
    if (this.taskAnalyzer) {
      try {
        const analysis = await this.taskAnalyzer.analyzeTask(taskDefinition, executionContext);
        const recommendedStrategyName = analysis?.recommendation?.strategy;

        if (recommendedStrategyName) {
          const recommendedStrategy = this.getStrategy(recommendedStrategyName);
          if (recommendedStrategy && recommendedStrategy.canHandle(taskDefinition, executionContext)) {
            if (this.logger) {
              this.logger.debug('TaskAnalyzer recommendation selected', {
                taskId,
                strategy: recommendedStrategyName,
                confidence: analysis.recommendation.confidence,
                pattern: analysis.recommendation.pattern
              });
            }
            return recommendedStrategy;
          }

          if (this.logger) {
            this.logger.warn('TaskAnalyzer recommended strategy unavailable or incompatible', {
              taskId,
              recommendedStrategy: recommendedStrategyName
            });
          }
        }

        for (const alternative of analysis?.recommendation?.alternatives || []) {
          const alternativeStrategy = this.getStrategy(alternative.strategy);
          if (alternativeStrategy && alternativeStrategy.canHandle(taskDefinition, executionContext)) {
            if (this.logger) {
              this.logger.info('Using TaskAnalyzer alternative strategy', {
                taskId,
                strategy: alternative.strategy,
                reason: alternative.reason
              });
            }
            return alternativeStrategy;
          }
        }
      } catch (analysisError) {
        if (this.logger) {
          this.logger.warn('TaskAnalyzer recommendation failed, falling back to default selection', {
            taskId,
            error: analysisError.message
          });
        }
      }
    }

    // Priority-ordered strategy selection fallback
    for (const candidateStrategy of this.priorityOrderedStrategies) {
      try {
        if (candidateStrategy.canHandle(taskDefinition, executionContext)) {
          return candidateStrategy;
        }
      } catch (evaluationError) {
        if (this.logger) {
          this.logger.warn('Strategy evaluation failed', {
            strategy: candidateStrategy.constructor.name,
            error: evaluationError.message,
            taskId
          });
        }
        continue;
      }
    }

    // Fallback to atomic strategy if available
    const fallbackAtomicStrategy = this.getStrategy('AtomicExecutionStrategy');
    if (fallbackAtomicStrategy) {
      if (this.logger) {
        this.logger.warn('Falling back to AtomicExecutionStrategy - no preferred strategy available', { taskId });
      }
      return fallbackAtomicStrategy;
    }

    throw new Error('No suitable execution strategy found for task');
  }

  /**
   * Get a specific strategy by name
   * @param {string} strategyName - Name of strategy to retrieve
   * @returns {ExecutionStrategy|null} - Strategy instance or null
   */
  getStrategy(requestedStrategyName) {
    return this.strategyInstanceRegistry.get(requestedStrategyName) || null;
  }

  /**
   * Get all registered strategies
   * @returns {Array<ExecutionStrategy>} - Array of strategy instances
   */
  getAllStrategies() {
    return [...this.priorityOrderedStrategies];
  }

  /**
   * Get strategy names sorted by priority
   * @returns {Array<string>} - Strategy names in priority order
   */
  getStrategyNames() {
    return this.priorityOrderedStrategies.map(strategyInstance => strategyInstance.constructor.name);
  }

  /**
   * Check if a strategy is registered
   * @param {string} strategyName - Name of strategy to check
   * @returns {boolean} - True if strategy is registered
   */
  hasStrategy(queryStrategyName) {
    return this.strategyInstanceRegistry.has(queryStrategyName);
  }

  /**
   * Get strategy statistics
   * @returns {Object} - Statistics about registered strategies
   */
  getStatistics() {
    const strategyMetadataList = Array.from(this.strategyInstanceRegistry.entries()).map(([strategyName, strategyInstance]) => ({
      name: strategyName,
      priority: this.strategyPriorityMap.get(strategyName),
      type: strategyInstance.constructor.name
    }));

    return {
      totalStrategies: this.strategyInstanceRegistry.size,
      strategies: strategyMetadataList.sort((strategyA, strategyB) => strategyB.priority - strategyA.priority),
      dependenciesProvided: Object.keys(this.dependencies)
    };
  }

  /**
   * Evaluate which strategies can handle a task
   * @param {Object} task - Task to evaluate
   * @param {ExecutionContext} context - Execution context
   * @returns {Array<Object>} - Array of strategy evaluations
   */
  evaluateStrategies(task, context) {
    const evaluations = [];

    for (const strategy of this.priorityOrderedStrategies) {
      try {
        const canHandle = strategy.canHandle(task, context);
        const priority = this.strategyPriorityMap.get(strategy.constructor.name);
        
        evaluations.push({
          strategyName: strategy.constructor.name,
          canHandle,
          priority,
          reason: canHandle ? 'Can handle task' : 'Cannot handle task'
        });
      } catch (error) {
        evaluations.push({
          strategyName: strategy.constructor.name,
          canHandle: false,
          priority: this.strategyPriorityMap.get(strategy.constructor.name),
          reason: `Evaluation error: ${error.message}`
        });
      }
    }

    return evaluations;
  }

  /**
   * Update dependencies for all strategies
   * @param {Object} newDependencies - New dependencies to merge
   */
  updateDependencies(newDependencies) {
    this.dependencies = { ...this.dependencies, ...newDependencies };
    
    // Warn if toolRegistry is being removed
    if (newDependencies.hasOwnProperty('toolRegistry') && !newDependencies.toolRegistry) {
      this.logger.warn('Warning: toolRegistry is being set to null/undefined in dependency update');
    }
    
    // Update all strategy instances with new dependencies
    const strategyEntries = Array.from(this.strategyInstanceRegistry.entries());
    for (const [strategyName, strategyInstance] of strategyEntries) {
      if (typeof strategyInstance.updateDependencies === 'function') {
        strategyInstance.updateDependencies(this.dependencies);
      } else {
        const StrategyClass = strategyInstance.constructor;
        const priority = this.strategyPriorityMap.get(strategyName);
        const replacement = new StrategyClass(this.dependencies);
        this.validateStrategy(replacement);
        this.strategyInstanceRegistry.set(strategyName, replacement);
      }
    }

    this.rebuildStrategiesArray();

    if (this.logger?.debug) {
      this.logger.debug('ExecutionStrategyResolver dependencies updated', {
        updatedKeys: Object.keys(newDependencies),
        strategiesUpdated: this.strategyInstanceRegistry.size
      });
    }
  }

  /**
   * Get current dependencies for inspection/testing
   * @returns {Object} - Current dependency state
   */
  getCurrentDependencies() {
    return {
      ...this.dependencies,
      registeredStrategies: Array.from(this.strategyInstanceRegistry.keys()),
      totalStrategies: this.strategyInstanceRegistry.size
    };
  }

  /**
   * Get tool registry from singleton if not available
   * @returns {Promise<ToolRegistry|null>} Tool registry instance or null
   */
  async getToolRegistry() {
    if (this.dependencies.toolRegistry) {
      return this.dependencies.toolRegistry;
    }
    
    try {
      const { ToolRegistry } = await import('@legion/tools-registry');
      const toolRegistry = await ToolRegistry.getInstance();
      this.logger.warn('Retrieved toolRegistry from singleton fallback');
      this.dependencies.toolRegistry = toolRegistry;
      return toolRegistry;
    } catch (error) {
      this.logger.error('Failed to get toolRegistry from singleton:', error.message);
      return null;
    }
  }

  /**
   * Initialize the strategy resolver
   */
  async initialize() {
    // Ensure toolRegistry is available before initializing strategies
    if (!this.dependencies.toolRegistry) {
      await this.getToolRegistry();
    }
    
    await this.initializeAllStrategies();
    this.logger.debug('ExecutionStrategyResolver initialized');
  }

  /**
   * Initialize with custom dependencies for testing
   * @param {Object} testDependencies - Dependencies for testing
   */
  async initializeWithDependencies(testDependencies) {
    this.updateDependencies(testDependencies);
    await this.initializeAllStrategies();
    this.logger.debug('ExecutionStrategyResolver initialized with test dependencies');
  }

  /**
   * Validate strategy interface
   * @param {Object} strategy - Strategy instance to validate
   */
  validateStrategy(strategy) {
    const strategyName = strategy?.constructor?.name;
    if (!strategyName || strategyName === 'Object') {
      throw new Error('Strategy must have a proper constructor name');
    }

    const requiredMethods = ['canHandle', 'execute'];
    const optionalMethods = ['estimateComplexity', 'initialize'];

    for (const method of requiredMethods) {
      if (typeof strategy[method] !== 'function') {
        throw new Error(`Strategy ${strategyName} must implement ${method} method`);
      }
    }

    // Validate optional methods if present
    for (const method of optionalMethods) {
      if (strategy[method] && typeof strategy[method] !== 'function') {
        throw new Error(`Strategy ${strategyName} ${method} must be a function if provided`);
      }
    }
  }

  /**
   * Rebuild strategies array sorted by priority
   */
  rebuildStrategiesArray() {
    this.priorityOrderedStrategies = Array.from(this.strategyInstanceRegistry.entries())
      .sort(([strategyNameA], [strategyNameB]) => {
        const priorityA = this.strategyPriorityMap.get(strategyNameA);
        const priorityB = this.strategyPriorityMap.get(strategyNameB);
        return priorityB - priorityA; // Higher priority first
      })
      .map(([strategyName, strategyInstance]) => strategyInstance);
  }

  /**
   * Clear all registered strategies
   */
  clear() {
    this.priorityOrderedStrategies = [];
    this.strategyInstanceRegistry.clear();
    this.strategyPriorityMap.clear();
  }

  /**
   * Initialize all strategies that support initialization
   */
  async initializeAllStrategies() {
    const strategyInitPromises = [];

    for (const strategyInstance of this.priorityOrderedStrategies) {
      if (typeof strategyInstance.initialize === 'function') {
        strategyInitPromises.push(strategyInstance.initialize());
      }
    }

    await Promise.all(strategyInitPromises);
  }

  /**
   * Clone resolver with same configuration
   * @param {Object} overrides - Override options
   * @returns {ExecutionStrategyResolver} - New resolver instance
   */
  clone(overrides = {}) {
    const { skipDefaults, ...dependencyOverrides } = overrides;
    const mergedDependencies = { ...this.dependencies, ...dependencyOverrides };

    const newResolver = new ExecutionStrategyResolver(mergedDependencies);
    newResolver.clear();

    const entries = Array.from(this.strategyInstanceRegistry.entries());
    const strategiesToCopy = skipDefaults
      ? entries.filter(([name]) => !DEFAULT_STRATEGY_NAMES.has(name))
      : entries;

    for (const [name, strategyInstance] of strategiesToCopy) {
      const priority = this.strategyPriorityMap.get(name);
      newResolver.registerStrategy(strategyInstance.constructor, priority);
    }

    return newResolver;
  }
}
