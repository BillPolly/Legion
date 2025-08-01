/**
 * Layout - Abstract base class for graph layout algorithms
 * 
 * Provides common interface for different layout algorithms like Dagre, Force-directed, etc.
 */

export class Layout {
  constructor(name, config = {}) {
    if (this.constructor === Layout) {
      throw new Error('Layout is an abstract class and cannot be instantiated directly');
    }
    
    this.name = name;
    this.config = {
      animated: true,
      animationDuration: 300,
      ...config
    };
    
    // Layout state
    this.isRunning = false;
    this.lastResult = null;
  }

  /**
   * Get layout name
   */
  getName() {
    return this.name;
  }

  /**
   * Get layout configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Update layout configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Check if layout is currently running
   */
  isLayoutRunning() {
    return this.isRunning;
  }

  /**
   * Get last layout result
   */
  getLastResult() {
    return this.lastResult;
  }

  /**
   * Calculate layout for given graph data
   * Abstract method - must be implemented by subclasses
   * 
   * @param {Object} graphData - Graph data with nodes and edges
   * @param {Array} graphData.nodes - Array of node objects
   * @param {Array} graphData.edges - Array of edge objects
   * @param {Object} constraints - Layout constraints (bounds, fixed nodes, etc.)
   * @returns {Promise<Object>} Layout result with positioned nodes and routed edges
   */
  async calculateLayout(graphData, constraints = {}) {
    throw new Error('calculateLayout must be implemented by subclasses');
  }

  /**
   * Apply layout result to graph model
   * 
   * @param {Object} layoutResult - Result from calculateLayout
   * @param {Object} model - Graph model to apply layout to
   * @param {Object} options - Application options
   */
  async applyLayout(layoutResult, model, options = {}) {
    if (!layoutResult || !model) {
      throw new Error('Layout result and model are required');
    }

    const {
      animated = this.config.animated,
      animationDuration = this.config.animationDuration,
      onProgress = null
    } = options;

    try {
      this.isRunning = true;

      if (animated) {
        await this._applyAnimatedLayout(layoutResult, model, animationDuration, onProgress);
      } else {
        await this._applyImmediateLayout(layoutResult, model);
      }

      this.lastResult = layoutResult;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run complete layout process (calculate + apply)
   * 
   * @param {Object} graphData - Graph data
   * @param {Object} model - Graph model
   * @param {Object} constraints - Layout constraints
   * @param {Object} options - Application options
   */
  async runLayout(graphData, model, constraints = {}, options = {}) {
    const layoutResult = await this.calculateLayout(graphData, constraints);
    await this.applyLayout(layoutResult, model, options);
    return layoutResult;
  }

  /**
   * Cancel running layout
   */
  cancelLayout() {
    this.isRunning = false;
  }

  /**
   * Validate graph data structure
   * @private
   */
  _validateGraphData(graphData) {
    if (!graphData || typeof graphData !== 'object') {
      throw new Error('Graph data must be an object');
    }

    if (!Array.isArray(graphData.nodes)) {
      throw new Error('Graph data must have a nodes array');
    }

    if (!Array.isArray(graphData.edges)) {
      throw new Error('Graph data must have an edges array');
    }

    // Validate node structure
    graphData.nodes.forEach((node, index) => {
      if (!node.id) {
        throw new Error(`Node at index ${index} missing required 'id' property`);
      }
    });

    // Validate edge structure
    graphData.edges.forEach((edge, index) => {
      if (!edge.source || !edge.target) {
        throw new Error(`Edge at index ${index} missing required 'source' or 'target' property`);
      }
    });
  }

  /**
   * Apply layout immediately without animation
   * @private
   */
  async _applyImmediateLayout(layoutResult, model) {
    const sceneGraph = model.getSceneGraph();
    
    // Begin batch update
    model.beginBatch();
    
    try {
      // Update node positions
      if (layoutResult.nodes) {
        layoutResult.nodes.forEach(nodeData => {
          const node = sceneGraph.getNodeById(nodeData.id);
          if (node && nodeData.position) {
            node.setPosition(nodeData.position.x, nodeData.position.y);
          }
        });
      }

      // Update edge routes if provided
      if (layoutResult.edges) {
        layoutResult.edges.forEach(edgeData => {
          const edge = model.getEdgeById(edgeData.id);
          if (edge && edgeData.points) {
            edge.setPath(edgeData.points);
          }
        });
      }
    } finally {
      // End batch update
      model.endBatch();
    }
  }

  /**
   * Apply layout with animation
   * @private
   */
  async _applyAnimatedLayout(layoutResult, model, duration, onProgress) {
    const sceneGraph = model.getSceneGraph();
    const animations = [];

    // Prepare node animations
    if (layoutResult.nodes) {
      layoutResult.nodes.forEach(nodeData => {
        const node = sceneGraph.getNodeById(nodeData.id);
        if (node && nodeData.position) {
          const currentPos = node.getPosition();
          const targetPos = nodeData.position;
          
          if (currentPos.x !== targetPos.x || currentPos.y !== targetPos.y) {
            animations.push({
              type: 'node-position',
              node,
              from: { x: currentPos.x, y: currentPos.y },
              to: { x: targetPos.x, y: targetPos.y }
            });
          }
        }
      });
    }

    // Run animations
    if (animations.length > 0) {
      await this._runAnimations(animations, model, duration, onProgress);
    }
  }

  /**
   * Run animations for layout changes
   * @private
   */
  async _runAnimations(animations, model, duration, onProgress) {
    const startTime = Date.now();
    const endTime = startTime + duration;

    return new Promise((resolve) => {
      const animate = () => {
        if (!this.isRunning) {
          resolve();
          return;
        }

        const now = Date.now();
        const progress = Math.min(1, (now - startTime) / duration);
        const eased = this._easeInOutCubic(progress);

        // Begin batch update
        model.beginBatch();

        try {
          // Update all animations
          animations.forEach(animation => {
            if (animation.type === 'node-position') {
              const x = animation.from.x + (animation.to.x - animation.from.x) * eased;
              const y = animation.from.y + (animation.to.y - animation.from.y) * eased;
              animation.node.setPosition(x, y);
            }
          });
        } finally {
          model.endBatch();
        }

        // Call progress callback
        if (onProgress) {
          onProgress(progress);
        }

        // Continue or finish
        if (progress >= 1 || now >= endTime) {
          resolve();
        } else {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    });
  }

  /**
   * Cubic ease-in-out easing function
   * @private
   */
  _easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  }
}