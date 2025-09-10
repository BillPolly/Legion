/**
 * LayoutTransitionManager - Manages smooth transitions between different layout algorithms
 * 
 * Provides animated transitions when switching between layout types:
 * - Position interpolation between source and target layouts
 * - Configurable easing functions and timing
 * - Support for different transition types (fade, scale, rotate)
 * - Cancellation and interruption handling
 * - Performance optimization for large graphs
 * 
 * Enables seamless user experience when exploring different layout views.
 */

export class LayoutTransitionManager {
  constructor(config = {}) {
    this.config = {
      // Timing configuration
      duration: config.duration || 800, // Transition duration in ms
      delay: config.delay || 0, // Delay before starting transition
      staggerDelay: config.staggerDelay || 20, // Delay between node animations
      
      // Easing functions
      easing: config.easing || 'easeInOutCubic', // Default easing function
      positionEasing: config.positionEasing || null, // Override for position animation
      
      // Visual effects
      enableFade: config.enableFade !== false, // Fade nodes during transition
      enableScale: config.enableScale !== false, // Scale nodes during transition
      enableRotate: config.enableRotate || false, // Rotate nodes during transition
      
      // Performance options
      batchSize: config.batchSize || 50, // Number of nodes to animate per frame
      useRAF: config.useRAF !== false, // Use requestAnimationFrame
      skipSmallMovements: config.skipSmallMovements !== false, // Skip transitions for small movements
      minMovementThreshold: config.minMovementThreshold || 5, // Minimum pixels to animate
      
      // Interruption handling
      allowInterruption: config.allowInterruption !== false, // Allow canceling transitions
      interruptionBehavior: config.interruptionBehavior || 'complete', // complete, cancel, blend
      
      // Callbacks
      onStart: config.onStart || null,
      onProgress: config.onProgress || null,
      onComplete: config.onComplete || null,
      onCancel: config.onCancel || null,
      
      ...config
    };
    
    // Transition state
    this.activeTransition = null;
    this.transitionId = 0;
    this.animationFrame = null;
    
    // Performance tracking
    this.stats = {
      totalTransitions: 0,
      completedTransitions: 0,
      canceledTransitions: 0,
      averageDuration: 0,
      totalDuration: 0
    };
    
    // Easing function registry
    this.easingFunctions = this._createEasingFunctions();
  }
  
  /**
   * Create easing functions for smooth animations
   */
  _createEasingFunctions() {
    return {
      linear: t => t,
      
      easeInQuad: t => t * t,
      easeOutQuad: t => t * (2 - t),
      easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
      
      easeInCubic: t => t * t * t,
      easeOutCubic: t => (--t) * t * t + 1,
      easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
      
      easeInQuart: t => t * t * t * t,
      easeOutQuart: t => 1 - (--t) * t * t * t,
      easeInOutQuart: t => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
      
      easeInBack: t => t * t * (2.7 * t - 1.7),
      easeOutBack: t => (--t) * t * (2.7 * t + 1.7) + 1,
      easeInOutBack: t => {
        const c = 1.7;
        return t < 0.5 
          ? (2 * t) * (2 * t) * ((c + 1) * 2 * t - c) / 2
          : ((2 * t - 2) * (2 * t - 2) * ((c + 1) * (t * 2 - 2) + c) + 2) / 2;
      },
      
      easeInElastic: t => {
        return t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
      },
      
      easeOutElastic: t => {
        return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
      },
      
      easeOutBounce: t => {
        if (t < 1/2.75) {
          return 7.5625 * t * t;
        } else if (t < 2/2.75) {
          return 7.5625 * (t -= 1.5/2.75) * t + 0.75;
        } else if (t < 2.5/2.75) {
          return 7.5625 * (t -= 2.25/2.75) * t + 0.9375;
        } else {
          return 7.5625 * (t -= 2.625/2.75) * t + 0.984375;
        }
      }
    };
  }
  
  /**
   * Transition between two layout states
   * @param {Map} fromPositions - Source node positions
   * @param {Map} toPositions - Target node positions
   * @param {Object} options - Transition options
   * @returns {Promise} Promise that resolves when transition completes
   */
  async transition(fromPositions, toPositions, options = {}) {
    // Merge with instance config
    const config = { ...this.config, ...options };
    
    // Cancel existing transition if needed
    if (this.activeTransition) {
      await this._handleTransitionInterruption(config.interruptionBehavior);
    }
    
    // Create transition state
    const transitionId = ++this.transitionId;
    const startTime = performance.now();
    
    this.activeTransition = {
      id: transitionId,
      fromPositions: new Map(fromPositions),
      toPositions: new Map(toPositions),
      config,
      startTime,
      progress: 0,
      nodeStates: new Map(),
      cancelled: false
    };
    
    // Prepare node transition data
    this._prepareNodeTransitions(this.activeTransition);
    
    // Start transition
    this.stats.totalTransitions++;
    
    if (config.onStart) {
      config.onStart(transitionId, fromPositions, toPositions);
    }
    
    try {
      await this._executeTransition(this.activeTransition);
      
      // Mark as completed
      this.stats.completedTransitions++;
      const duration = performance.now() - startTime;
      this.stats.totalDuration += duration;
      this.stats.averageDuration = this.stats.totalDuration / this.stats.completedTransitions;
      
      if (config.onComplete && !this.activeTransition.cancelled) {
        config.onComplete(transitionId, toPositions);
      }
      
      return toPositions;
      
    } catch (error) {
      this.stats.canceledTransitions++;
      
      if (config.onCancel) {
        config.onCancel(transitionId, error);
      }
      
      throw error;
      
    } finally {
      this.activeTransition = null;
    }
  }
  
  /**
   * Prepare node transition data
   */
  _prepareNodeTransitions(transition) {
    const { fromPositions, toPositions, config } = transition;
    
    // Find all nodes that need to be animated
    const allNodeIds = new Set([
      ...fromPositions.keys(),
      ...toPositions.keys()
    ]);
    
    let nodeIndex = 0;
    for (const nodeId of allNodeIds) {
      const fromPos = fromPositions.get(nodeId) || { x: 0, y: 0, opacity: 0, scale: 0 };
      const toPos = toPositions.get(nodeId) || { x: 0, y: 0, opacity: 0, scale: 0 };
      
      // Calculate movement distance
      const distance = Math.sqrt(
        Math.pow(toPos.x - fromPos.x, 2) + 
        Math.pow(toPos.y - fromPos.y, 2)
      );
      
      // Skip small movements if configured
      const shouldAnimate = !config.skipSmallMovements || distance >= config.minMovementThreshold;
      
      if (shouldAnimate) {
        transition.nodeStates.set(nodeId, {
          from: { ...fromPos },
          to: { ...toPos },
          current: { ...fromPos },
          distance,
          delay: nodeIndex * config.staggerDelay,
          startTime: null,
          completed: false
        });
      } else {
        // Node doesn't need animation - set final position immediately
        transition.nodeStates.set(nodeId, {
          from: { ...fromPos },
          to: { ...toPos },
          current: { ...toPos },
          distance: 0,
          delay: 0,
          startTime: 0,
          completed: true
        });
      }
      
      nodeIndex++;
    }
  }
  
  /**
   * Execute the transition animation
   */
  async _executeTransition(transition) {
    return new Promise((resolve, reject) => {
      const animate = (currentTime) => {
        if (transition.cancelled) {
          reject(new Error('Transition cancelled'));
          return;
        }
        
        const elapsed = currentTime - transition.startTime - transition.config.delay;
        
        if (elapsed < 0) {
          // Still in delay phase
          this.animationFrame = requestAnimationFrame(animate);
          return;
        }
        
        // Update transition progress
        const rawProgress = elapsed / transition.config.duration;
        transition.progress = Math.min(rawProgress, 1);
        
        // Update node positions
        const allComplete = this._updateNodePositions(transition, currentTime);
        
        // Call progress callback
        if (transition.config.onProgress) {
          transition.config.onProgress(transition.id, transition.progress, this._getCurrentPositions(transition));
        }
        
        // Check if transition is complete
        if (allComplete && transition.progress >= 1) {
          resolve();
        } else {
          this.animationFrame = requestAnimationFrame(animate);
        }
      };
      
      // Start animation
      if (transition.config.useRAF) {
        this.animationFrame = requestAnimationFrame(animate);
      } else {
        // Use setTimeout for testing or specific scenarios
        const interval = setInterval(() => {
          animate(performance.now());
          if (transition.cancelled || transition.progress >= 1) {
            clearInterval(interval);
          }
        }, 16); // ~60fps
      }
    });
  }
  
  /**
   * Update node positions for current frame
   */
  _updateNodePositions(transition, currentTime) {
    const easingFn = this.easingFunctions[transition.config.easing] || this.easingFunctions.easeInOutCubic;
    let allComplete = true;
    
    for (const [nodeId, nodeState] of transition.nodeStates) {
      if (nodeState.completed) continue;
      
      const nodeElapsed = currentTime - transition.startTime - nodeState.delay;
      
      if (nodeElapsed < 0) {
        // Node still in delay phase
        allComplete = false;
        continue;
      }
      
      const nodeProgress = Math.min(nodeElapsed / transition.config.duration, 1);
      const easedProgress = easingFn(nodeProgress);
      
      // Interpolate position
      nodeState.current.x = this._lerp(nodeState.from.x, nodeState.to.x, easedProgress);
      nodeState.current.y = this._lerp(nodeState.from.y, nodeState.to.y, easedProgress);
      
      // Apply visual effects
      if (transition.config.enableFade) {
        const fadeProgress = this._calculateFadeProgress(nodeProgress);
        nodeState.current.opacity = this._lerp(
          nodeState.from.opacity || 1, 
          nodeState.to.opacity || 1, 
          fadeProgress
        );
      }
      
      if (transition.config.enableScale) {
        const scaleProgress = this._calculateScaleProgress(nodeProgress);
        nodeState.current.scale = this._lerp(
          nodeState.from.scale || 1, 
          nodeState.to.scale || 1, 
          scaleProgress
        );
      }
      
      if (transition.config.enableRotate) {
        nodeState.current.rotation = this._lerp(
          nodeState.from.rotation || 0,
          nodeState.to.rotation || 0,
          easedProgress
        );
      }
      
      // Check if node animation is complete
      if (nodeProgress >= 1) {
        nodeState.current = { ...nodeState.to };
        nodeState.completed = true;
      } else {
        allComplete = false;
      }
    }
    
    return allComplete;
  }
  
  /**
   * Calculate fade progress for smooth fade effects
   */
  _calculateFadeProgress(progress) {
    // Create a fade-out-then-fade-in effect
    if (progress < 0.5) {
      return 1 - (progress * 2); // Fade out
    } else {
      return (progress - 0.5) * 2; // Fade in
    }
  }
  
  /**
   * Calculate scale progress for smooth scale effects
   */
  _calculateScaleProgress(progress) {
    // Scale down then scale up for dynamic effect
    const scaleEasing = this.easingFunctions.easeInOutBack;
    return scaleEasing(progress);
  }
  
  /**
   * Linear interpolation
   */
  _lerp(start, end, t) {
    return start + (end - start) * t;
  }
  
  /**
   * Get current positions during transition
   */
  _getCurrentPositions(transition) {
    const currentPositions = new Map();
    
    for (const [nodeId, nodeState] of transition.nodeStates) {
      currentPositions.set(nodeId, { ...nodeState.current });
    }
    
    return currentPositions;
  }
  
  /**
   * Handle transition interruption
   */
  async _handleTransitionInterruption(behavior) {
    if (!this.activeTransition) return;
    
    switch (behavior) {
      case 'cancel':
        this.activeTransition.cancelled = true;
        if (this.animationFrame) {
          cancelAnimationFrame(this.animationFrame);
        }
        break;
        
      case 'complete':
        // Instantly complete the current transition
        this._completeTransitionInstantly(this.activeTransition);
        break;
        
      case 'blend':
        // Allow new transition to start from current positions
        // Current implementation just cancels - could be enhanced for blending
        this.activeTransition.cancelled = true;
        break;
        
      default:
        this.activeTransition.cancelled = true;
    }
    
    // Wait a frame to ensure cleanup
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  
  /**
   * Instantly complete active transition
   */
  _completeTransitionInstantly(transition) {
    for (const [nodeId, nodeState] of transition.nodeStates) {
      nodeState.current = { ...nodeState.to };
      nodeState.completed = true;
    }
    
    transition.progress = 1;
    
    if (transition.config.onProgress) {
      transition.config.onProgress(transition.id, 1, this._getCurrentPositions(transition));
    }
  }
  
  /**
   * Cancel current transition
   */
  cancelTransition() {
    if (this.activeTransition) {
      this.activeTransition.cancelled = true;
      
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
    }
  }
  
  /**
   * Check if transition is currently active
   */
  isTransitioning() {
    return this.activeTransition !== null && !this.activeTransition.cancelled;
  }
  
  /**
   * Get current transition progress
   */
  getTransitionProgress() {
    return this.activeTransition ? this.activeTransition.progress : 0;
  }
  
  /**
   * Add custom easing function
   */
  addEasingFunction(name, easingFn) {
    if (typeof easingFn === 'function') {
      this.easingFunctions[name] = easingFn;
    }
  }
  
  /**
   * Get performance statistics
   */
  getStats() {
    return { ...this.stats };
  }
  
  /**
   * Reset performance statistics
   */
  resetStats() {
    this.stats = {
      totalTransitions: 0,
      completedTransitions: 0,
      canceledTransitions: 0,
      averageDuration: 0,
      totalDuration: 0
    };
  }
  
  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }
  
  /**
   * Destroy transition manager and clean up
   */
  destroy() {
    this.cancelTransition();
    
    this.activeTransition = null;
    this.animationFrame = null;
    this.easingFunctions = {};
  }
}

export default LayoutTransitionManager;