/**
 * BaseLayoutPlugin - Abstract base class for layout plugins
 * 
 * Provides a standardized interface and common functionality for layout plugins.
 * Custom layouts should extend this class to ensure compatibility with the plugin system.
 */

export class BaseLayoutPlugin {
  constructor(config = {}) {
    this.config = {
      // Layout bounds
      bounds: {
        width: config.bounds?.width || 1000,
        height: config.bounds?.height || 600,
        padding: config.bounds?.padding || 50
      },
      
      // Animation support
      enableAnimation: config.enableAnimation !== false,
      animationDuration: config.animationDuration || 300,
      
      // Performance options
      enableOptimizations: config.enableOptimizations !== false,
      maxNodes: config.maxNodes || 10000,
      
      // Debugging
      debug: config.debug || false,
      timing: config.timing || false,
      
      ...config
    };
    
    // Plugin metadata (should be overridden by subclasses)
    this.metadata = {
      name: 'base-layout',
      version: '1.0.0',
      description: 'Base layout plugin',
      author: 'System',
      category: 'base',
      capabilities: {},
      ...this.getMetadata()
    };
    
    // Performance tracking
    this.performance = {
      lastExecutionTime: 0,
      averageExecutionTime: 0,
      executionCount: 0,
      totalTime: 0
    };
    
    // State management
    this.initialized = false;
    this.destroyed = false;
  }
  
  /**
   * Get plugin metadata - should be overridden by subclasses
   * @returns {Object} Plugin metadata
   */
  getMetadata() {
    return {
      name: 'base-layout',
      version: '1.0.0',
      description: 'Base layout plugin',
      capabilities: {}
    };
  }
  
  /**
   * Initialize the plugin - can be overridden by subclasses
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    if (this.config.debug) {
      console.log(`Initializing layout plugin: ${this.metadata.name}`);
    }
    
    // Subclasses can override this for custom initialization
    await this.onInitialize();
    
    this.initialized = true;
  }
  
  /**
   * Custom initialization hook for subclasses
   * @protected
   */
  async onInitialize() {
    // Override in subclasses
  }
  
  /**
   * Main layout method - must be implemented by subclasses
   * @param {Object} graphData - Graph data to layout
   * @returns {Promise<Object>} Layout result
   */
  async layout(graphData) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (this.destroyed) {
      throw new Error('Plugin has been destroyed');
    }
    
    // Validate input
    this._validateGraphData(graphData);
    
    // Check node limit
    if (graphData.nodes.length > this.config.maxNodes) {
      throw new Error(`Graph too large: ${graphData.nodes.length} nodes (max: ${this.config.maxNodes})`);
    }
    
    const startTime = performance.now();
    
    try {
      // Pre-processing
      const preprocessedData = await this._preprocessGraphData(graphData);
      
      // Execute layout algorithm
      const result = await this._executeLayout(preprocessedData);
      
      // Post-processing
      const finalResult = await this._postprocessResult(result, graphData);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Update performance stats
      this._updatePerformanceStats(executionTime);
      
      // Add metadata to result
      finalResult.metadata = {
        ...finalResult.metadata,
        plugin: this.metadata.name,
        executionTime,
        performance: { ...this.performance }
      };
      
      if (this.config.timing) {
        console.log(`Layout ${this.metadata.name} executed in ${executionTime.toFixed(2)}ms`);
      }
      
      return finalResult;
      
    } catch (error) {
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      this._updatePerformanceStats(executionTime);
      
      console.error(`Layout execution failed for ${this.metadata.name}:`, error);
      throw error;
    }
  }
  
  /**
   * Execute the actual layout algorithm - must be implemented by subclasses
   * @param {Object} graphData - Preprocessed graph data
   * @returns {Promise<Object>} Raw layout result
   * @protected
   */
  async _executeLayout(graphData) {
    throw new Error('_executeLayout must be implemented by subclass');
  }
  
  /**
   * Validate graph data structure
   * @param {Object} graphData - Graph data to validate
   * @protected
   */
  _validateGraphData(graphData) {
    if (!graphData) {
      throw new Error('Graph data is required');
    }
    
    if (!Array.isArray(graphData.nodes)) {
      throw new Error('Graph data must have a nodes array');
    }
    
    if (graphData.edges && !Array.isArray(graphData.edges)) {
      throw new Error('Graph edges must be an array');
    }
    
    // Validate node structure
    graphData.nodes.forEach((node, index) => {
      if (!node.id) {
        throw new Error(`Node at index ${index} missing required 'id' field`);
      }
    });
    
    // Validate edge structure
    if (graphData.edges) {
      const nodeIds = new Set(graphData.nodes.map(n => n.id));
      
      graphData.edges.forEach((edge, index) => {
        if (!edge.source || !edge.target) {
          throw new Error(`Edge at index ${index} missing source or target`);
        }
        
        if (!nodeIds.has(edge.source)) {
          throw new Error(`Edge source '${edge.source}' not found in nodes`);
        }
        
        if (!nodeIds.has(edge.target)) {
          throw new Error(`Edge target '${edge.target}' not found in nodes`);
        }
      });
    }
  }
  
  /**
   * Preprocess graph data before layout
   * @param {Object} graphData - Original graph data
   * @returns {Promise<Object>} Preprocessed graph data
   * @protected
   */
  async _preprocessGraphData(graphData) {
    // Default preprocessing - can be overridden by subclasses
    const processedData = {
      nodes: graphData.nodes.map(node => ({
        ...node,
        size: node.size || { width: 100, height: 60 },
        position: node.position || { x: 0, y: 0 }
      })),
      edges: graphData.edges || []
    };
    
    // Hook for subclasses
    return await this.onPreprocessData(processedData);
  }
  
  /**
   * Preprocessing hook for subclasses
   * @param {Object} graphData - Preprocessed graph data
   * @returns {Promise<Object>} Further processed graph data
   * @protected
   */
  async onPreprocessData(graphData) {
    return graphData;
  }
  
  /**
   * Post-process layout result
   * @param {Object} result - Raw layout result
   * @param {Object} originalData - Original graph data
   * @returns {Promise<Object>} Final layout result
   * @protected
   */
  async _postprocessResult(result, originalData) {
    // Ensure required result structure
    const finalResult = {
      positions: result.positions || new Map(),
      bounds: result.bounds || this._calculateBounds(result.positions),
      edges: result.edges || new Map(),
      metadata: {
        algorithm: this.metadata.name,
        nodeCount: originalData.nodes.length,
        edgeCount: originalData.edges ? originalData.edges.length : 0,
        ...result.metadata
      }
    };
    
    // Hook for subclasses
    return await this.onPostprocessResult(finalResult, originalData);
  }
  
  /**
   * Post-processing hook for subclasses
   * @param {Object} result - Post-processed layout result
   * @param {Object} originalData - Original graph data
   * @returns {Promise<Object>} Final layout result
   * @protected
   */
  async onPostprocessResult(result, originalData) {
    return result;
  }
  
  /**
   * Calculate bounding box for positions
   * @param {Map} positions - Node positions
   * @returns {Object} Bounds object
   * @protected
   */
  _calculateBounds(positions) {
    if (!positions || positions.size === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    positions.forEach(pos => {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y);
    });
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
  
  /**
   * Update performance statistics
   * @param {number} executionTime - Execution time in milliseconds
   * @protected
   */
  _updatePerformanceStats(executionTime) {
    this.performance.lastExecutionTime = executionTime;
    this.performance.executionCount++;
    this.performance.totalTime += executionTime;
    this.performance.averageExecutionTime = this.performance.totalTime / this.performance.executionCount;
  }
  
  /**
   * Get current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return { ...this.config };
  }
  
  /**
   * Update configuration
   * @param {Object} newConfig - New configuration values
   */
  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    };
    
    // Notify subclasses of config change
    this.onConfigChanged(newConfig);
  }
  
  /**
   * Configuration change hook for subclasses
   * @param {Object} newConfig - New configuration values
   * @protected
   */
  onConfigChanged(newConfig) {
    // Override in subclasses
  }
  
  /**
   * Get plugin performance statistics
   * @returns {Object} Performance statistics
   */
  getPerformanceStats() {
    return { ...this.performance };
  }
  
  /**
   * Reset performance statistics
   */
  resetPerformanceStats() {
    this.performance = {
      lastExecutionTime: 0,
      averageExecutionTime: 0,
      executionCount: 0,
      totalTime: 0
    };
  }
  
  /**
   * Check if plugin supports specific capability
   * @param {string} capability - Capability to check
   * @returns {boolean}
   */
  supportsCapability(capability) {
    return Boolean(this.metadata.capabilities[capability]);
  }
  
  /**
   * Get list of supported capabilities
   * @returns {Array} Array of capability names
   */
  getSupportedCapabilities() {
    return Object.keys(this.metadata.capabilities).filter(cap => 
      this.metadata.capabilities[cap]
    );
  }
  
  /**
   * Destroy the plugin and clean up resources
   */
  destroy() {
    if (this.destroyed) {
      return;
    }
    
    if (this.config.debug) {
      console.log(`Destroying layout plugin: ${this.metadata.name}`);
    }
    
    // Hook for subclasses
    this.onDestroy();
    
    this.destroyed = true;
    this.initialized = false;
  }
  
  /**
   * Destruction hook for subclasses
   * @protected
   */
  onDestroy() {
    // Override in subclasses
  }
}

export default BaseLayoutPlugin;