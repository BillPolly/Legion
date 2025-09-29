/**
 * StrategyHandle - Handle implementation for task strategy resources
 *
 * Provides Handle interface for loading, inspecting, and instantiating task strategies.
 * Strategies are JavaScript files that export factory functions for creating task executors.
 *
 * URI Examples:
 * - legion://local/strategy/packages/agents/roma-agent/src/strategies/simple-node/SimpleNodeTestStrategy.js
 * - legion://server/strategy/strategies/analysis/DataAnalysisStrategy.js
 */

export class StrategyHandle {
  constructor(dataSource, parsed) {
    if (!dataSource) {
      throw new Error('DataSource is required for StrategyHandle');
    }

    if (!parsed) {
      throw new Error('Parsed URI components are required for StrategyHandle');
    }

    this.dataSource = dataSource;
    this.parsed = parsed;
    this._destroyed = false;

    // Strategy-specific properties from path
    this.filePath = parsed.path || '';
    this.server = parsed.server;
    this.resourceType = parsed.resourceType;

    // Cached strategy data
    this._factory = null;
    this._metadata = null;
    this._lastFetch = null;
    this._cacheTimeout = 5 * 60 * 1000; // 5 minutes

    // Create proxy for transparent property access
    return new Proxy(this, {
      get(target, prop, receiver) {
        // Handle methods and private properties directly
        if (prop in target || prop.startsWith('_') || typeof target[prop] === 'function') {
          return Reflect.get(target, prop, receiver);
        }

        // For metadata access via proxy
        if (typeof prop === 'string' && target._metadata) {
          // Special properties from metadata
          if (prop === 'strategyName') return target._metadata.strategyName;
          if (prop === 'strategyType') return target._metadata.strategyType;
          if (prop === 'requiredTools') return target._metadata.requiredTools;
          if (prop === 'promptSchemas') return target._metadata.promptSchemas;
          if (prop === 'description') return target._metadata.description;
        }

        return Reflect.get(target, prop, receiver);
      },

      has(target, prop) {
        // Check if it's a StrategyHandle property/method
        if (prop in target) {
          return true;
        }

        // Check metadata properties
        if (target._metadata) {
          const metadataProps = ['strategyName', 'strategyType', 'requiredTools', 'promptSchemas', 'description'];
          return metadataProps.includes(prop);
        }

        return false;
      }
    });
  }

  /**
   * Load strategy factory function
   * @returns {Promise<Function>} Strategy factory function
   */
  async loadFactory() {
    this._checkDestroyed();

    // Return cached factory if available and recent
    if (this._factory && this._isDataCacheValid()) {
      return this._factory;
    }

    try {
      const results = await this.dataSource.queryAsync({ loadStrategy: true });

      if (results.length === 0) {
        throw new Error(`Strategy not found: ${this.filePath}`);
      }

      // Update cache
      this._factory = results[0].factory;
      this._lastFetch = Date.now();

      return this._factory;

    } catch (error) {
      throw new Error(`Failed to load strategy factory: ${error.message}`);
    }
  }

  /**
   * Instantiate strategy with given context and options
   * @param {Object} context - Strategy execution context (resourceManager, toolRegistry, etc.)
   * @param {Object} options - Strategy options
   * @returns {Promise<Object>} Instantiated strategy instance
   */
  async instantiate(context, options = {}) {
    this._checkDestroyed();

    try {
      const results = await this.dataSource.queryAsync({
        instantiate: { context, options }
      });

      if (results.length === 0) {
        throw new Error(`Failed to instantiate strategy: ${this.filePath}`);
      }

      return results[0].strategy;

    } catch (error) {
      throw new Error(`Failed to instantiate strategy: ${error.message}`);
    }
  }

  /**
   * Get strategy metadata (name, type, tools, prompts)
   * @returns {Promise<Object>} Strategy metadata
   */
  async getMetadata() {
    this._checkDestroyed();

    // Return cached metadata if available and recent
    if (this._metadata && this._isDataCacheValid()) {
      return this._metadata;
    }

    try {
      const results = await this.dataSource.queryAsync({ getMetadata: true });

      if (results.length === 0) {
        throw new Error(`Strategy not found: ${this.filePath}`);
      }

      // Update cache
      this._metadata = results[0].data;
      this._lastFetch = Date.now();

      return this._metadata;

    } catch (error) {
      throw new Error(`Failed to get strategy metadata: ${error.message}`);
    }
  }

  /**
   * Check if strategy file exists
   * @returns {Promise<boolean>} True if strategy file exists
   */
  async exists() {
    this._checkDestroyed();

    try {
      await this.getMetadata();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get Handle metadata for semantic search
   * @returns {Object} Handle metadata
   */
  getHandleMetadata() {
    this._checkDestroyed();

    const baseMetadata = this.dataSource.getMetadata ? this.dataSource.getMetadata() : {};

    return {
      ...baseMetadata,
      handleType: 'strategy',
      filePath: this.filePath,
      strategyName: this._metadata?.strategyName,
      strategyType: this._metadata?.strategyType,
      requiredTools: this._metadata?.requiredTools,
      promptSchemas: this._metadata?.promptSchemas,
      hasCachedFactory: !!this._factory,
      hasCachedMetadata: !!this._metadata,
      cacheAge: this._lastFetch ? Date.now() - this._lastFetch : null
    };
  }

  /**
   * Get Handle schema
   * @returns {Object} Handle schema
   */
  getSchema() {
    this._checkDestroyed();
    return this.dataSource.getSchema ? this.dataSource.getSchema() : {};
  }

  /**
   * Get URI for this strategy resource
   * @returns {string} Legion URI
   */
  toURI() {
    return `legion://${this.server}/${this.resourceType}${this.filePath}`;
  }

  /**
   * Clone this Handle
   * @returns {StrategyHandle} Cloned Handle
   */
  clone() {
    this._checkDestroyed();
    return new StrategyHandle(this.dataSource, { ...this.parsed });
  }

  /**
   * Check if Handle is destroyed
   * @returns {boolean} True if destroyed
   */
  isDestroyed() {
    return this._destroyed;
  }

  /**
   * Destroy this Handle and cleanup resources
   */
  destroy() {
    if (this._destroyed) return;

    // Cleanup cached data
    this._factory = null;
    this._metadata = null;
    this._lastFetch = null;

    this._destroyed = true;
    this.dataSource = null;
    this.parsed = null;
  }

  /**
   * String representation
   * @returns {string} String representation
   */
  toString() {
    if (this._destroyed) {
      return '[StrategyHandle (destroyed)]';
    }

    return `[StrategyHandle: ${this.toURI()}]`;
  }

  /**
   * JSON representation
   * @returns {Object} JSON-serializable object
   */
  toJSON() {
    if (this._destroyed) {
      return { destroyed: true };
    }

    return {
      type: 'StrategyHandle',
      uri: this.toURI(),
      filePath: this.filePath,
      server: this.server,
      strategyName: this._metadata?.strategyName,
      strategyType: this._metadata?.strategyType,
      hasCachedFactory: !!this._factory,
      hasCachedMetadata: !!this._metadata
    };
  }

  // Private helper methods

  /**
   * Check if cached data is still valid
   * @returns {boolean} True if cache is valid
   * @private
   */
  _isDataCacheValid() {
    if (!this._lastFetch) return false;
    return (Date.now() - this._lastFetch) < this._cacheTimeout;
  }

  /**
   * Check if Handle is destroyed and throw if so
   * @private
   */
  _checkDestroyed() {
    if (this._destroyed) {
      throw new Error('StrategyHandle has been destroyed');
    }
  }
}

export default StrategyHandle;