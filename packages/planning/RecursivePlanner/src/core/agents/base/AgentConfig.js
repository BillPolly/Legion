/**
 * Configuration for PlanningAgent
 */

import { ValidationError } from '../../../foundation/types/errors/errors.js';

/**
 * Configuration class for planning agents
 */
export class AgentConfig {
  constructor(options = {}) {
    // Handle null/undefined options
    const opts = options || {};
    
    this.name = opts.name !== undefined ? opts.name : 'DefaultAgent';
    this.description = opts.description !== undefined ? opts.description : 'A planning agent';
    this.maxRetries = opts.maxRetries ?? 3;
    this.planningTimeout = opts.planningTimeout ?? 30000; // 30 seconds
    this.reflectionEnabled = opts.reflectionEnabled ?? true;
    this.parallelExecution = opts.parallelExecution ?? false;
    this.debugMode = opts.debugMode ?? false;
    
    // Orchestration configuration
    this.orchestration = {
      enabled: opts.orchestration?.enabled ?? true,
      maxReplanAttempts: opts.orchestration?.maxReplanAttempts ?? 3,
      executionStrategy: opts.orchestration?.executionStrategy ?? 'sequential',
      continueOnFailure: opts.orchestration?.continueOnFailure ?? false,
      stepTimeout: opts.orchestration?.stepTimeout ?? 30000
    };
  }

  /**
   * Generate a random string (temporary until we move IdGenerator)
   * @param {number} length - Length of string
   * @returns {string} Random string
   */
  _generateRandomString(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Validate the configuration
   * @throws {ValidationError} If configuration is invalid
   */
  validate() {
    if (typeof this.name !== 'string' || this.name.trim() === '') {
      throw new ValidationError('Agent name must be a non-empty string');
    }
    
    if (typeof this.description !== 'string' || this.description.trim() === '') {
      throw new ValidationError('Agent description must be a non-empty string');
    }
    
    if (typeof this.maxRetries !== 'number' || this.maxRetries <= 0) {
      throw new ValidationError('maxRetries must be a positive number');
    }
    
    if (this.maxRetries > 20) {
      throw new ValidationError('maxRetries must not exceed 20');
    }
    
    if (typeof this.planningTimeout !== 'number' || this.planningTimeout <= 0) {
      throw new ValidationError('planningTimeout must be a positive number');
    }
    
    if (this.planningTimeout < 1000) {
      throw new ValidationError('planningTimeout must be at least 1000ms');
    }
    
    if (this.planningTimeout > 600000) {
      throw new ValidationError('planningTimeout must not exceed 600000ms (10 minutes)');
    }
    
    if (typeof this.reflectionEnabled !== 'boolean') {
      throw new ValidationError('reflectionEnabled must be a boolean');
    }
    
    if (typeof this.debugMode !== 'boolean') {
      throw new ValidationError('debugMode must be a boolean');
    }
    
    if (typeof this.parallelExecution !== 'boolean') {
      throw new ValidationError('parallelExecution must be a boolean');
    }
    
    // Validate orchestration configuration
    if (typeof this.orchestration !== 'object' || this.orchestration === null) {
      throw new ValidationError('orchestration must be an object');
    }
    
    if (typeof this.orchestration.enabled !== 'boolean') {
      throw new ValidationError('orchestration.enabled must be a boolean');
    }
    
    if (typeof this.orchestration.maxReplanAttempts !== 'number' || this.orchestration.maxReplanAttempts <= 0) {
      throw new ValidationError('orchestration.maxReplanAttempts must be a positive number');
    }
    
    if (!['sequential', 'parallel', 'dependency-aware'].includes(this.orchestration.executionStrategy)) {
      throw new ValidationError('orchestration.executionStrategy must be sequential, parallel, or dependency-aware');
    }
    
    if (typeof this.orchestration.continueOnFailure !== 'boolean') {
      throw new ValidationError('orchestration.continueOnFailure must be a boolean');
    }
    
    if (typeof this.orchestration.stepTimeout !== 'number' || this.orchestration.stepTimeout <= 0) {
      throw new ValidationError('orchestration.stepTimeout must be a positive number');
    }
    
    // Validate agent name format (alphanumeric + underscore only)
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(this.name)) {
      throw new ValidationError('Agent name must be a valid identifier');
    }
  }

  /**
   * Merge with another configuration
   * @param {Object} overrides - Properties to override
   * @returns {AgentConfig} New merged configuration instance
   */
  merge(overrides = {}) {
    const merged = new AgentConfig({
      ...this.toJSON(),
      ...overrides
    });
    merged.validate();
    return merged;
  }

  /**
   * Create a copy of this configuration
   * @param {Object} overrides - Properties to override
   * @returns {AgentConfig} New configuration instance
   */
  clone(overrides = {}) {
    return new AgentConfig({
      ...this.toJSON(),
      ...overrides
    });
  }

  /**
   * Convert to JSON object
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      name: this.name,
      description: this.description,
      maxRetries: this.maxRetries,
      planningTimeout: this.planningTimeout,
      reflectionEnabled: this.reflectionEnabled,
      parallelExecution: this.parallelExecution,
      debugMode: this.debugMode,
      orchestration: { ...this.orchestration }
    };
  }

  /**
   * Convert to plain object (legacy method)
   * @returns {Object} Plain object representation
   */
  toObject() {
    return this.toJSON();
  }

  /**
   * Create from JSON object
   * @param {Object} json - JSON representation
   * @returns {AgentConfig} Configuration instance
   */
  static fromJSON(json) {
    const config = new AgentConfig(json);
    config.validate();
    return config;
  }

  /**
   * Create from plain object (legacy method)
   * @param {Object} obj - Plain object
   * @returns {AgentConfig} Configuration instance
   */
  static fromObject(obj) {
    return AgentConfig.fromJSON(obj);
  }

  /**
   * Get human-readable summary of configuration
   * @returns {string} Configuration summary
   */
  getSummary() {
    const timeout = Math.round(this.planningTimeout / 1000);
    const features = [];
    
    if (this.reflectionEnabled) features.push('reflection enabled');
    if (this.parallelExecution) features.push('parallel execution');
    if (this.debugMode) features.push('debug mode');
    
    return `${this.name}: ${this.maxRetries} retries, ${timeout}s timeout${features.length > 0 ? ', ' + features.join(', ') : ''}`;
  }

  /**
   * Create performance-optimized configuration template
   * @param {string} name - Agent name
   * @param {Object} overrides - Additional overrides
   * @returns {AgentConfig} Performance-optimized configuration
   */
  static performanceOptimized(name, overrides = {}) {
    return new AgentConfig({
      name,
      description: 'Performance-optimized planning agent',
      maxRetries: 2,
      planningTimeout: 15000,
      reflectionEnabled: false,
      parallelExecution: true,
      debugMode: false,
      ...overrides
    });
  }

  /**
   * Create debugging configuration template
   * @param {string} name - Agent name
   * @param {Object} overrides - Additional overrides
   * @returns {AgentConfig} Debug-optimized configuration
   */
  static debugging(name, overrides = {}) {
    return new AgentConfig({
      name,
      description: 'Debugging-enabled planning agent',
      maxRetries: 5,
      planningTimeout: 60000,
      reflectionEnabled: true,
      parallelExecution: false,
      debugMode: true,
      ...overrides
    });
  }

  /**
   * Create production configuration template
   * @param {string} name - Agent name
   * @param {Object} overrides - Additional overrides
   * @returns {AgentConfig} Production-ready configuration
   */
  static production(name, overrides = {}) {
    return new AgentConfig({
      name,
      description: 'Production planning agent',
      maxRetries: 3,
      planningTimeout: 30000,
      reflectionEnabled: true,
      parallelExecution: false,
      debugMode: false,
      ...overrides
    });
  }
}