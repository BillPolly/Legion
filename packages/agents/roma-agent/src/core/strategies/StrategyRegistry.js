/**
 * StrategyRegistry - Manages registration and retrieval of execution strategies
 * Single responsibility: Strategy registration and storage
 */

import { Logger } from '../../utils/Logger.js';

export class StrategyRegistry {
  constructor(options = {}) {
    this.logger = options.logger || new Logger('StrategyRegistry');
    this.strategies = new Map();
    this.priorities = new Map();
    this.metadata = new Map();
  }

  /**
   * Register a new execution strategy
   * @param {Class} StrategyClass - Strategy class constructor
   * @param {number} priority - Strategy priority (higher = checked first)
   * @param {Object} options - Strategy-specific options
   * @param {Object} dependencies - Strategy dependencies
   */
  register(StrategyClass, priority = 5, options = {}, dependencies = {}) {
    const strategyName = StrategyClass.name;
    
    if (this.strategies.has(strategyName)) {
      throw new Error(`Strategy ${strategyName} is already registered`);
    }

    // Create strategy instance
    const strategyInstance = new StrategyClass({
      ...dependencies,
      ...options
    });

    // Validate strategy interface
    this.validateStrategy(strategyInstance);

    this.strategies.set(strategyName, strategyInstance);
    this.priorities.set(strategyName, priority);
    this.metadata.set(strategyName, {
      className: strategyName,
      registeredAt: Date.now(),
      options: { ...options },
      priority
    });

    this.logger.debug('Strategy registered', {
      strategy: strategyName,
      priority
    });
  }

  /**
   * Unregister a strategy
   * @param {string} strategyName - Name of strategy to remove
   * @returns {boolean} - True if removed
   */
  unregister(strategyName) {
    if (!this.strategies.has(strategyName)) {
      return false;
    }

    this.strategies.delete(strategyName);
    this.priorities.delete(strategyName);
    this.metadata.delete(strategyName);

    this.logger.debug('Strategy unregistered', { strategy: strategyName });
    return true;
  }

  /**
   * Get a specific strategy by name
   * @param {string} strategyName - Name of strategy to retrieve
   * @returns {Object|null} - Strategy instance or null
   */
  get(strategyName) {
    return this.strategies.get(strategyName) || null;
  }

  /**
   * Check if a strategy is registered
   * @param {string} strategyName - Name of strategy to check
   * @returns {boolean} - True if strategy is registered
   */
  has(strategyName) {
    return this.strategies.has(strategyName);
  }

  /**
   * Get all registered strategies
   * @returns {Array<Object>} - Array of strategy instances
   */
  getAll() {
    return Array.from(this.strategies.values());
  }

  /**
   * Get strategies sorted by priority
   * @returns {Array<Object>} - Strategies ordered by priority (highest first)
   */
  getSortedByPriority() {
    const strategies = Array.from(this.strategies.entries());
    
    return strategies
      .sort((a, b) => {
        const priorityA = this.priorities.get(a[0]) || 0;
        const priorityB = this.priorities.get(b[0]) || 0;
        return priorityB - priorityA;
      })
      .map(([_, strategy]) => strategy);
  }

  /**
   * Get strategy names sorted by priority
   * @returns {Array<string>} - Strategy names in priority order
   */
  getNamesSortedByPriority() {
    const strategies = Array.from(this.strategies.keys());
    
    return strategies.sort((a, b) => {
      const priorityA = this.priorities.get(a) || 0;
      const priorityB = this.priorities.get(b) || 0;
      return priorityB - priorityA;
    });
  }

  /**
   * Get strategy priority
   * @param {string} strategyName - Strategy name
   * @returns {number} - Priority value
   */
  getPriority(strategyName) {
    return this.priorities.get(strategyName) || 0;
  }

  /**
   * Update strategy priority
   * @param {string} strategyName - Strategy name
   * @param {number} newPriority - New priority value
   * @returns {boolean} - True if updated
   */
  setPriority(strategyName, newPriority) {
    if (!this.strategies.has(strategyName)) {
      return false;
    }
    
    this.priorities.set(strategyName, newPriority);
    const metadata = this.metadata.get(strategyName);
    if (metadata) {
      metadata.priority = newPriority;
    }
    
    return true;
  }

  /**
   * Get strategy metadata
   * @param {string} strategyName - Strategy name
   * @returns {Object|null} - Strategy metadata or null
   */
  getMetadata(strategyName) {
    return this.metadata.get(strategyName) || null;
  }

  /**
   * Filter strategies by predicate
   * @param {Function} predicate - Filter function
   * @returns {Array<Object>} - Filtered strategies
   */
  filter(predicate) {
    return Array.from(this.strategies.values()).filter(predicate);
  }

  /**
   * Find strategy by predicate
   * @param {Function} predicate - Search predicate
   * @returns {Object|null} - Found strategy or null
   */
  find(predicate) {
    return Array.from(this.strategies.values()).find(predicate) || null;
  }

  /**
   * Get registry size
   * @returns {number} - Number of registered strategies
   */
  size() {
    return this.strategies.size;
  }

  /**
   * Check if registry is empty
   * @returns {boolean} - True if empty
   */
  isEmpty() {
    return this.strategies.size === 0;
  }

  /**
   * Clear all registered strategies
   */
  clear() {
    this.strategies.clear();
    this.priorities.clear();
    this.metadata.clear();
    this.logger.debug('Strategy registry cleared');
  }

  /**
   * Get registry statistics
   * @returns {Object} - Registry statistics
   */
  getStatistics() {
    const strategies = Array.from(this.strategies.keys()).map(name => ({
      name,
      priority: this.priorities.get(name),
      metadata: this.metadata.get(name)
    }));

    const priorityDistribution = {};
    for (const priority of this.priorities.values()) {
      priorityDistribution[priority] = (priorityDistribution[priority] || 0) + 1;
    }

    return {
      totalStrategies: this.strategies.size,
      strategies: strategies.sort((a, b) => b.priority - a.priority),
      priorityDistribution,
      averagePriority: Array.from(this.priorities.values())
        .reduce((sum, p) => sum + p, 0) / this.priorities.size || 0
    };
  }

  /**
   * Validate strategy interface
   * @private
   */
  validateStrategy(strategy) {
    const requiredMethods = ['canHandle', 'execute'];
    const optionalMethods = ['estimateComplexity', 'initialize', 'updateDependencies'];

    for (const method of requiredMethods) {
      if (typeof strategy[method] !== 'function') {
        throw new Error(`Strategy must implement ${method}() method`);
      }
    }

    // Verify optional methods if they exist
    for (const method of optionalMethods) {
      if (strategy[method] && typeof strategy[method] !== 'function') {
        throw new Error(`Strategy ${method} must be a function if provided`);
      }
    }

    // Check constructor name exists
    if (!strategy.constructor.name) {
      throw new Error('Strategy must have a valid constructor name');
    }
  }
}