/**
 * LayoutAnimator - Provides smooth layout transitions and animations for diagram updates
 * 
 * Supports various animation types:
 * - Position transitions (move, fade, spring)
 * - Layout morphing (between different algorithm results)
 * - Node appearance/disappearance (add/remove transitions)
 * - Edge routing animations
 * - Constraint-based animations
 */

export class LayoutAnimator {
  constructor(config = {}) {
    this.config = {
      duration: config.duration || 800, // milliseconds
      easing: config.easing || 'ease-out', // CSS easing function
      stagger: config.stagger || 0, // delay between node animations
      
      // Animation types
      enablePositionAnimation: config.enablePositionAnimation !== false,
      enableSizeAnimation: config.enableSizeAnimation !== false,
      enableOpacityAnimation: config.enableOpacityAnimation !== false,
      
      // Performance options
      useTransforms: config.useTransforms !== false, // Use CSS transforms vs position
      useAnimationFrame: config.useAnimationFrame !== false,
      enableGPUAcceleration: config.enableGPUAcceleration !== false,
      
      // Advanced features
      springConfig: {
        tension: config.springConfig?.tension || 120,
        friction: config.springConfig?.friction || 14,
        mass: config.springConfig?.mass || 1
      },
      
      ...config
    };
    
    // Animation state
    this.activeAnimations = new Map();
    this.animationGroups = new Map();
    this.frameId = null;
    this.isAnimating = false;
    
    // Animation queue for sequencing
    this.animationQueue = [];
    this.currentSequence = null;
    
    // Performance tracking
    this.stats = {
      animationsStarted: 0,
      animationsCompleted: 0,
      animationsCancelled: 0,
      averageDuration: 0,
      lastFrameTime: 0
    };
    
    // Bind methods
    this._tick = this._tick.bind(this);
  }

  /**
   * Animate transition from one layout to another
   * @param {Object} fromLayout - Starting layout state
   * @param {Object} toLayout - Target layout state
   * @param {Object} options - Animation options
   * @returns {Promise} Animation completion promise
   */
  async animateLayoutTransition(fromLayout, toLayout, options = {}) {
    const animationConfig = {
      ...this.config,
      ...options
    };
    
    // Create transition plan
    const transitionPlan = this._createTransitionPlan(fromLayout, toLayout, animationConfig);
    
    // Start the animation
    return this._executeTransitionPlan(transitionPlan, animationConfig);
  }

  /**
   * Animate individual node movements
   * @param {Array} nodeAnimations - Array of node animation definitions
   * @param {Object} options - Animation options
   * @returns {Promise} Animation completion promise
   */
  async animateNodes(nodeAnimations, options = {}) {
    const animationConfig = { ...this.config, ...options };
    const animationId = this._generateAnimationId();
    
    // Create animation group
    const animationGroup = {
      id: animationId,
      type: 'nodes',
      animations: new Map(),
      startTime: performance.now(),
      duration: animationConfig.duration,
      easing: animationConfig.easing,
      onComplete: options.onComplete,
      onUpdate: options.onUpdate
    };
    
    // Create individual node animations
    nodeAnimations.forEach((nodeAnim, index) => {
      const delay = animationConfig.stagger * index;
      const animation = this._createNodeAnimation(nodeAnim, animationConfig, delay);
      animationGroup.animations.set(nodeAnim.nodeId, animation);
    });
    
    this.animationGroups.set(animationId, animationGroup);
    this._startAnimationLoop();
    
    return new Promise((resolve, reject) => {
      animationGroup.resolve = resolve;
      animationGroup.reject = reject;
    });
  }

  /**
   * Animate edge routing changes
   * @param {Array} edgeAnimations - Array of edge animation definitions
   * @param {Object} options - Animation options
   * @returns {Promise} Animation completion promise
   */
  async animateEdges(edgeAnimations, options = {}) {
    const animationConfig = { ...this.config, ...options };
    const animationId = this._generateAnimationId();
    
    const animationGroup = {
      id: animationId,
      type: 'edges',
      animations: new Map(),
      startTime: performance.now(),
      duration: animationConfig.duration,
      easing: animationConfig.easing,
      onComplete: options.onComplete,
      onUpdate: options.onUpdate
    };
    
    // Create edge animations (path morphing, rerouting)
    edgeAnimations.forEach((edgeAnim, index) => {
      const delay = animationConfig.stagger * index;
      const animation = this._createEdgeAnimation(edgeAnim, animationConfig, delay);
      animationGroup.animations.set(edgeAnim.edgeId, animation);
    });
    
    this.animationGroups.set(animationId, animationGroup);
    this._startAnimationLoop();
    
    return new Promise((resolve, reject) => {
      animationGroup.resolve = resolve;
      animationGroup.reject = reject;
    });
  }

  /**
   * Create spring-based animation for natural motion
   * @param {string} nodeId - Target node ID
   * @param {Object} from - Starting position/properties
   * @param {Object} to - Target position/properties
   * @param {Object} options - Spring options
   * @returns {Promise} Animation completion promise
   */
  async animateWithSpring(nodeId, from, to, options = {}) {
    const springConfig = { ...this.config.springConfig, ...options.spring };
    const animationId = this._generateAnimationId();
    
    const springAnimation = {
      id: animationId,
      type: 'spring',
      nodeId,
      from: { ...from },
      to: { ...to },
      current: { ...from },
      velocity: { x: 0, y: 0 },
      config: springConfig,
      startTime: performance.now(),
      isComplete: false,
      onUpdate: options.onUpdate,
      onComplete: options.onComplete
    };
    
    this.activeAnimations.set(animationId, springAnimation);
    this._startAnimationLoop();
    
    return new Promise((resolve, reject) => {
      springAnimation.resolve = resolve;
      springAnimation.reject = reject;
    });
  }

  /**
   * Cancel all active animations
   */
  cancelAllAnimations() {
    const activeCount = this.activeAnimations.size;
    
    this.activeAnimations.clear();
    this.animationGroups.clear();
    this.animationQueue = [];
    
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    
    this.isAnimating = false;
    if (this.stats) {
      this.stats.animationsCancelled += activeCount;
    }
  }

  /**
   * Cancel specific animation by ID
   * @param {string} animationId - Animation ID to cancel
   */
  cancelAnimation(animationId) {
    const animation = this.activeAnimations.get(animationId);
    const group = this.animationGroups.get(animationId);
    
    if (animation) {
      this.activeAnimations.delete(animationId);
      this.stats.animationsCancelled++;
    }
    
    if (group) {
      this.animationGroups.delete(animationId);
      if (group.reject) group.reject(new Error('Animation cancelled'));
    }
  }

  /**
   * Get current animation statistics
   * @returns {Object} Animation performance stats
   */
  getAnimationStats() {
    return {
      ...this.stats,
      activeAnimations: this.activeAnimations.size,
      activeGroups: this.animationGroups.size,
      isAnimating: this.isAnimating,
      queueLength: this.animationQueue.length
    };
  }

  // Private methods

  /**
   * Create transition plan between two layouts
   * @private
   */
  _createTransitionPlan(fromLayout, toLayout, config) {
    const plan = {
      nodeTransitions: new Map(),
      edgeTransitions: new Map(),
      addedNodes: [],
      removedNodes: [],
      addedEdges: [],
      removedEdges: []
    };
    
    // Identify node transitions, additions, and removals
    const fromNodes = fromLayout.positions || new Map();
    const toNodes = toLayout.positions || new Map();
    
    fromNodes.forEach((fromPos, nodeId) => {
      const toPos = toNodes.get(nodeId);
      
      if (toPos) {
        // Node exists in both layouts - create transition
        plan.nodeTransitions.set(nodeId, {
          from: fromPos,
          to: toPos,
          distance: this._calculateDistance(fromPos, toPos)
        });
      } else {
        // Node was removed
        plan.removedNodes.push({
          nodeId,
          position: fromPos
        });
      }
    });
    
    toNodes.forEach((toPos, nodeId) => {
      if (!fromNodes.has(nodeId)) {
        // Node was added
        plan.addedNodes.push({
          nodeId,
          position: toPos
        });
      }
    });
    
    // Identify edge transitions
    const fromEdges = fromLayout.edges || new Map();
    const toEdges = toLayout.edges || new Map();
    
    fromEdges.forEach((fromEdge, edgeId) => {
      const toEdge = toEdges.get(edgeId);
      
      if (toEdge) {
        plan.edgeTransitions.set(edgeId, {
          from: fromEdge,
          to: toEdge
        });
      } else {
        plan.removedEdges.push({
          edgeId,
          edge: fromEdge
        });
      }
    });
    
    toEdges.forEach((toEdge, edgeId) => {
      if (!fromEdges.has(edgeId)) {
        plan.addedEdges.push({
          edgeId,
          edge: toEdge
        });
      }
    });
    
    return plan;
  }

  /**
   * Execute the transition plan
   * @private
   */
  async _executeTransitionPlan(plan, config) {
    const animations = [];
    
    // Create node transition animations
    plan.nodeTransitions.forEach((transition, nodeId) => {
      animations.push({
        nodeId,
        from: transition.from,
        to: transition.to,
        type: 'move'
      });
    });
    
    // Create node appearance animations
    plan.addedNodes.forEach(node => {
      animations.push({
        nodeId: node.nodeId,
        from: { ...node.position, opacity: 0 },
        to: { ...node.position, opacity: 1 },
        type: 'appear'
      });
    });
    
    // Create node disappearance animations
    plan.removedNodes.forEach(node => {
      animations.push({
        nodeId: node.nodeId,
        from: { ...node.position, opacity: 1 },
        to: { ...node.position, opacity: 0 },
        type: 'disappear'
      });
    });
    
    // Execute all animations
    return this.animateNodes(animations, config);
  }

  /**
   * Create individual node animation
   * @private
   */
  _createNodeAnimation(nodeAnim, config, delay = 0) {
    return {
      nodeId: nodeAnim.nodeId,
      type: nodeAnim.type || 'move',
      from: nodeAnim.from,
      to: nodeAnim.to,
      startTime: performance.now() + delay,
      duration: config.duration,
      easing: config.easing,
      delay,
      progress: 0,
      isComplete: false
    };
  }

  /**
   * Create individual edge animation
   * @private
   */
  _createEdgeAnimation(edgeAnim, config, delay = 0) {
    return {
      edgeId: edgeAnim.edgeId,
      type: edgeAnim.type || 'reroute',
      from: edgeAnim.from,
      to: edgeAnim.to,
      startTime: performance.now() + delay,
      duration: config.duration,
      easing: config.easing,
      delay,
      progress: 0,
      isComplete: false
    };
  }

  /**
   * Start animation loop
   * @private
   */
  _startAnimationLoop() {
    if (!this.isAnimating) {
      this.isAnimating = true;
      this.frameId = requestAnimationFrame(this._tick);
    }
  }

  /**
   * Animation frame tick
   * @private
   */
  _tick(timestamp) {
    this.stats.lastFrameTime = timestamp;
    
    // Update active animations
    const completedAnimations = [];
    const completedGroups = [];
    
    // Process spring animations
    this.activeAnimations.forEach((animation, id) => {
      if (animation.type === 'spring') {
        this._updateSpringAnimation(animation, timestamp);
        if (animation.isComplete) {
          completedAnimations.push(id);
        }
      }
    });
    
    // Process animation groups
    this.animationGroups.forEach((group, id) => {
      this._updateAnimationGroup(group, timestamp);
      if (this._isGroupComplete(group)) {
        completedGroups.push(id);
      }
    });
    
    // Clean up completed animations
    completedAnimations.forEach(id => {
      const animation = this.activeAnimations.get(id);
      if (animation.onComplete) animation.onComplete();
      if (animation.resolve) animation.resolve();
      this.activeAnimations.delete(id);
      this.stats.animationsCompleted++;
    });
    
    completedGroups.forEach(id => {
      const group = this.animationGroups.get(id);
      if (group.onComplete) group.onComplete();
      if (group.resolve) group.resolve();
      this.animationGroups.delete(id);
    });
    
    // Continue loop if animations are active
    if (this.activeAnimations.size > 0 || this.animationGroups.size > 0) {
      this.frameId = requestAnimationFrame(this._tick);
    } else {
      this.isAnimating = false;
      this.frameId = null;
    }
  }

  /**
   * Update spring animation
   * @private
   */
  _updateSpringAnimation(animation, timestamp) {
    // Skip if animation is already complete or missing required properties
    if (animation.isComplete || !animation.current || !animation.to) {
      return;
    }
    
    const elapsed = timestamp - animation.startTime;
    const { tension, friction, mass } = animation.config || this.config.springConfig;
    
    // Spring physics calculation
    const springForceX = -tension * (animation.current.x - animation.to.x);
    const springForceY = -tension * (animation.current.y - animation.to.y);
    
    const dampingForceX = -friction * animation.velocity.x;
    const dampingForceY = -friction * animation.velocity.y;
    
    const accelerationX = (springForceX + dampingForceX) / mass;
    const accelerationY = (springForceY + dampingForceY) / mass;
    
    animation.velocity.x += accelerationX * 0.016; // ~60fps
    animation.velocity.y += accelerationY * 0.016;
    
    animation.current.x += animation.velocity.x * 0.016;
    animation.current.y += animation.velocity.y * 0.016;
    
    // Check for completion (near target with low velocity)
    const distanceToTarget = this._calculateDistance(animation.current, animation.to);
    const speed = Math.sqrt(animation.velocity.x ** 2 + animation.velocity.y ** 2);
    
    if (distanceToTarget < 0.5 && speed < 0.5) {
      animation.current = { ...animation.to };
      animation.isComplete = true;
    }
    
    // Call update callback
    if (animation.onUpdate) {
      animation.onUpdate(animation.current, animation.nodeId);
    }
  }

  /**
   * Update animation group
   * @private
   */
  _updateAnimationGroup(group, timestamp) {
    group.animations.forEach((animation, id) => {
      if (!animation.isComplete) {
        this._updateAnimation(animation, timestamp);
      }
    });
    
    // Call group update callback
    if (group.onUpdate) {
      const currentStates = new Map();
      group.animations.forEach((animation, id) => {
        currentStates.set(id, this._getCurrentAnimationState(animation));
      });
      group.onUpdate(currentStates);
    }
  }

  /**
   * Update individual animation within a group
   * @private
   */
  _updateAnimation(animation, timestamp) {
    const elapsed = timestamp - animation.startTime;
    
    if (elapsed < 0) return; // Animation hasn't started yet
    
    const progress = Math.min(elapsed / animation.duration, 1);
    const easedProgress = this._applyEasing(progress, animation.easing);
    
    animation.progress = easedProgress;
    
    // Update animation properties
    if (animation.from && animation.to) {
      animation.current = this._interpolateProperties(animation.from, animation.to, easedProgress);
    }
    
    if (progress >= 1) {
      animation.isComplete = true;
    }
  }

  /**
   * Check if animation group is complete
   * @private
   */
  _isGroupComplete(group) {
    let allComplete = true;
    group.animations.forEach(animation => {
      if (!animation.isComplete) {
        allComplete = false;
      }
    });
    return allComplete;
  }

  /**
   * Apply easing function to progress
   * @private
   */
  _applyEasing(progress, easingType) {
    switch (easingType) {
      case 'linear':
        return progress;
      case 'ease-in':
        return progress * progress;
      case 'ease-out':
        return 1 - (1 - progress) * (1 - progress);
      case 'ease-in-out':
        return progress < 0.5 
          ? 2 * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      default:
        return progress; // fallback to linear
    }
  }

  /**
   * Interpolate between two property objects
   * @private
   */
  _interpolateProperties(from, to, progress) {
    const result = {};
    
    Object.keys(to).forEach(key => {
      if (typeof from[key] === 'number' && typeof to[key] === 'number') {
        result[key] = from[key] + (to[key] - from[key]) * progress;
      } else {
        result[key] = progress < 0.5 ? from[key] : to[key];
      }
    });
    
    return result;
  }

  /**
   * Get current animation state
   * @private
   */
  _getCurrentAnimationState(animation) {
    return {
      nodeId: animation.nodeId,
      edgeId: animation.edgeId,
      current: animation.current,
      progress: animation.progress,
      isComplete: animation.isComplete
    };
  }

  /**
   * Calculate distance between two points
   * @private
   */
  _calculateDistance(from, to) {
    return Math.sqrt(
      Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2)
    );
  }

  /**
   * Generate unique animation ID
   * @private
   */
  _generateAnimationId() {
    return `anim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup and destroy the animator
   */
  destroy() {
    this.cancelAllAnimations();
    this.config = null;
    this.stats = null;
  }
}

export default LayoutAnimator;