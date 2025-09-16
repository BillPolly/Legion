/**
 * StrategyManager - Manages strategy lifecycle and dependency injection
 * Single responsibility: Strategy lifecycle management and dependency updates
 */

import { Logger } from '../../utils/Logger.js';
import { 
  StrategyError, 
  ConfigurationError, 
  ValidationError 
} from '../../errors/ROMAErrors.js';

export class StrategyManager {
  constructor(options = {}) {
    this.logger = options.logger || new Logger('StrategyManager');
    this.dependencies = options.dependencies || {};
    this.initializationCallbacks = new Map();
    this.updateCallbacks = new Map();
  }

  /**
   * Initialize a strategy with dependencies
   * @param {Object} strategy - Strategy instance to initialize
   * @param {Object} additionalDeps - Additional dependencies
   * @returns {Promise<boolean>} - True if initialization successful
   */
  async initializeStrategy(targetStrategy, additionalDependencies = {}) {
    if (!targetStrategy) {
      throw new ValidationError('Strategy is required for initialization', [], {
        operation: 'initializeStrategy'
      });
    }

    const strategyClassName = targetStrategy.constructor.name;
    const mergedDependencies = { ...this.dependencies, ...additionalDependencies };

    try {
      // Check if strategy has initialize method
      if (typeof targetStrategy.initialize === 'function') {
        await targetStrategy.initialize(mergedDependencies);
      }

      // Update strategy dependencies if supported
      if (typeof targetStrategy.updateDependencies === 'function') {
        targetStrategy.updateDependencies(mergedDependencies);
      }

      // Call initialization callbacks
      const registeredCallbacks = this.initializationCallbacks.get(strategyClassName) || [];
      for (const callbackFunction of registeredCallbacks) {
        try {
          await callbackFunction(targetStrategy, mergedDependencies);
        } catch (callbackError) {
          this.logger.warn('Initialization callback failed', {
            strategy: strategyClassName,
            error: callbackError.message
          });
        }
      }

      this.logger.debug('Strategy initialized', { strategy: strategyClassName });
      return true;

    } catch (initializationError) {
      const wrappedStrategyError = new StrategyError(
        `Strategy initialization failed: ${initializationError.message}`,
        strategyClassName,
        'STRATEGY_INITIALIZATION_ERROR',
        { originalError: initializationError.message }
      );
      
      this.logger.error('Strategy initialization failed', {
        strategy: strategyClassName,
        error: wrappedStrategyError.message
      });
      
      throw wrappedStrategyError;
    }
  }

  /**
   * Update dependencies for a strategy
   * @param {Object} strategy - Strategy instance to update
   * @param {Object} newDependencies - New dependencies to merge
   * @returns {boolean} - True if update successful
   */
  updateStrategyDependencies(targetStrategy, updatedDependencies) {
    if (!targetStrategy) {
      throw new ValidationError('Strategy is required for dependency update', [], {
        operation: 'updateStrategyDependencies'
      });
    }

    const strategyClassName = targetStrategy.constructor.name;
    const combinedDependencies = { ...this.dependencies, ...updatedDependencies };

    try {
      // Update strategy dependencies if supported
      if (typeof targetStrategy.updateDependencies === 'function') {
        targetStrategy.updateDependencies(combinedDependencies);
      } else {
        this.logger.warn('Strategy does not support dependency updates', {
          strategy: strategyClassName
        });
        return false;
      }

      // Call update callbacks
      const updateCallbackList = this.updateCallbacks.get(strategyClassName) || [];
      for (const updateCallback of updateCallbackList) {
        try {
          updateCallback(targetStrategy, combinedDependencies);
        } catch (callbackError) {
          this.logger.warn('Update callback failed', {
            strategy: strategyClassName,
            error: callbackError.message
          });
        }
      }

      this.logger.debug('Strategy dependencies updated', {
        strategy: strategyClassName,
        dependencyCount: Object.keys(combinedDependencies).length
      });

      return true;

    } catch (updateError) {
      const wrappedUpdateError = new StrategyError(
        `Dependency update failed: ${updateError.message}`,
        strategyClassName,
        'STRATEGY_DEPENDENCY_UPDATE_ERROR',
        { originalError: updateError.message }
      );
      
      this.logger.error('Dependency update failed', {
        strategy: strategyClassName,
        error: wrappedUpdateError.message
      });
      
      throw wrappedUpdateError;
    }
  }

  /**
   * Update global dependencies for all managed strategies
   * @param {Object} newDependencies - New dependencies to merge
   */
  updateGlobalDependencies(newDependencies) {
    this.dependencies = { ...this.dependencies, ...newDependencies };
    
    this.logger.debug('Global dependencies updated', {
      dependencyCount: Object.keys(this.dependencies).length,
      newKeys: Object.keys(newDependencies)
    });
  }

  /**
   * Validate strategy health
   * @param {Object} strategy - Strategy instance to validate
   * @returns {Object} - Health check result
   */
  validateStrategyHealth(strategy) {
    if (!strategy) {
      return {
        healthy: false,
        issues: ['Strategy is null or undefined'],
        score: 0
      };
    }

    const issues = [];
    const strategyName = strategy.constructor.name;

    // Check required methods
    const requiredMethods = ['canHandle', 'execute'];
    for (const method of requiredMethods) {
      if (typeof strategy[method] !== 'function') {
        issues.push(`Missing required method: ${method}`);
      }
    }

    // Check optional methods exist if declared
    const optionalMethods = ['initialize', 'updateDependencies', 'estimateComplexity'];
    for (const method of optionalMethods) {
      if (strategy[method] && typeof strategy[method] !== 'function') {
        issues.push(`Invalid method type for ${method}: expected function`);
      }
    }

    // Check constructor name
    if (!strategyName || strategyName === 'Object') {
      issues.push('Strategy missing valid constructor name');
    }

    // Health score calculation
    const totalChecks = requiredMethods.length + optionalMethods.length + 1;
    const passedChecks = totalChecks - issues.length;
    const healthScore = Math.max(0, Math.min(100, (passedChecks / totalChecks) * 100));

    return {
      healthy: issues.length === 0,
      issues,
      score: healthScore,
      strategyName
    };
  }

  /**
   * Get dependency requirements for a strategy
   * @param {Object} strategy - Strategy instance
   * @returns {Object} - Dependency analysis
   */
  analyzeDependencies(strategy) {
    if (!strategy) {
      return {
        required: [],
        optional: [],
        current: {},
        missing: []
      };
    }

    const analysis = {
      required: [],
      optional: [],
      current: { ...this.dependencies },
      missing: []
    };

    // Check if strategy has dependency analysis method
    if (typeof strategy.getDependencyRequirements === 'function') {
      try {
        const requirements = strategy.getDependencyRequirements();
        analysis.required = requirements.required || [];
        analysis.optional = requirements.optional || [];
      } catch (error) {
        this.logger.warn('Failed to get dependency requirements', {
          strategy: strategy.constructor.name,
          error: error.message
        });
      }
    }

    // Find missing required dependencies
    for (const dep of analysis.required) {
      if (!(dep in this.dependencies)) {
        analysis.missing.push(dep);
      }
    }

    return analysis;
  }

  /**
   * Register initialization callback
   * @param {string} strategyName - Strategy name
   * @param {Function} callback - Callback function
   */
  onStrategyInitialized(strategyName, callback) {
    if (!this.initializationCallbacks.has(strategyName)) {
      this.initializationCallbacks.set(strategyName, []);
    }
    this.initializationCallbacks.get(strategyName).push(callback);
  }

  /**
   * Register dependency update callback
   * @param {string} strategyName - Strategy name
   * @param {Function} callback - Callback function
   */
  onStrategyUpdated(strategyName, callback) {
    if (!this.updateCallbacks.has(strategyName)) {
      this.updateCallbacks.set(strategyName, []);
    }
    this.updateCallbacks.get(strategyName).push(callback);
  }

  /**
   * Remove callbacks for a strategy
   * @param {string} strategyName - Strategy name
   */
  clearCallbacks(strategyName) {
    this.initializationCallbacks.delete(strategyName);
    this.updateCallbacks.delete(strategyName);
  }

  /**
   * Get management statistics
   * @returns {Object} - Management statistics
   */
  getStatistics() {
    return {
      globalDependencies: Object.keys(this.dependencies).length,
      dependencyKeys: Object.keys(this.dependencies),
      initCallbackStrategies: this.initializationCallbacks.size,
      updateCallbackStrategies: this.updateCallbacks.size,
      totalCallbacks: Array.from(this.initializationCallbacks.values())
        .reduce((sum, callbacks) => sum + callbacks.length, 0) +
        Array.from(this.updateCallbacks.values())
        .reduce((sum, callbacks) => sum + callbacks.length, 0)
    };
  }

  /**
   * Get current dependencies
   * @returns {Object} - Current dependencies object
   */
  getDependencies() {
    return { ...this.dependencies };
  }

  /**
   * Check if dependency exists
   * @param {string} key - Dependency key
   * @returns {boolean} - True if exists
   */
  hasDependency(key) {
    return key in this.dependencies;
  }

  /**
   * Get specific dependency
   * @param {string} key - Dependency key
   * @returns {*} - Dependency value or undefined
   */
  getDependency(key) {
    return this.dependencies[key];
  }

  /**
   * Set specific dependency
   * @param {string} key - Dependency key
   * @param {*} value - Dependency value
   */
  setDependency(key, value) {
    this.dependencies[key] = value;
    
    this.logger.debug('Dependency set', { key, type: typeof value });
  }

  /**
   * Remove dependency
   * @param {string} key - Dependency key
   * @returns {boolean} - True if removed
   */
  removeDependency(key) {
    if (key in this.dependencies) {
      delete this.dependencies[key];
      this.logger.debug('Dependency removed', { key });
      return true;
    }
    return false;
  }

  /**
   * Clear all dependencies
   */
  clearDependencies() {
    const count = Object.keys(this.dependencies).length;
    this.dependencies = {};
    this.logger.debug('All dependencies cleared', { count });
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.initializationCallbacks.clear();
    this.updateCallbacks.clear();
    this.clearDependencies();
  }
}