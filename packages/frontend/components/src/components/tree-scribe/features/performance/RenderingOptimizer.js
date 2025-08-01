/**
 * RenderingOptimizer - Advanced rendering pipeline optimization for TreeScribe
 * 
 * Optimizes DOM operations, batch updates, reduces reflows/repaints,
 * implements efficient diffing algorithms, and provides adaptive rendering strategies.
 */

export class RenderingOptimizer {
  constructor(options = {}) {
    this.options = {
      batchSize: 50,
      frameTimeTarget: 16, // 60fps
      adaptiveRendering: true,
      virtualizeThreshold: 1000,
      diffingEnabled: true,
      recycleElements: true,
      lazyRendering: true,
      intersectionThreshold: 0.1,
      prefetchDistance: 2,
      ...options
    };

    this.destroyed = false;
    
    // Rendering state
    this.renderQueue = [];
    this.batchedUpdates = new Map();
    this.activeRender = false;
    this.lastFrameTime = 0;
    
    // Element pools for recycling
    this.elementPools = new Map();
    
    // Intersection observer for lazy rendering
    this.intersectionObserver = null;
    this.observedElements = new WeakSet();
    
    // Rendering metrics
    this.metrics = {
      totalRenders: 0,
      batchedRenders: 0,
      recycledElements: 0,
      skippedRenders: 0,
      averageFrameTime: 16,
      reflows: 0,
      repaints: 0
    };
    
    // Diffing state
    this.previousTreeState = new WeakMap();
    this.nodeSignatures = new WeakMap();
    
    // Performance monitoring
    this.performanceObserver = null;
    
    // Initialize systems
    this._initializeIntersectionObserver();
    this._initializePerformanceObserver();
    this._startRenderLoop();
  }

  /**
   * Optimize tree rendering
   */
  async renderTree(container, tree, options = {}) {
    if (this.destroyed) return;

    const startTime = performance.now();
    this.metrics.totalRenders++;

    try {
      // Check if we should use virtual scrolling
      const nodeCount = this._countNodes(tree);
      if (nodeCount > this.options.virtualizeThreshold) {
        return await this._renderVirtualized(container, tree, options);
      }

      // Use regular optimized rendering
      return await this._renderOptimized(container, tree, options);

    } catch (error) {
      console.error('Rendering error:', error);
      throw error;
    } finally {
      const renderTime = performance.now() - startTime;
      this._updateFrameTime(renderTime);
    }
  }

  /**
   * Batch multiple DOM updates
   */
  batchUpdate(updates) {
    if (this.destroyed) return Promise.resolve();

    return new Promise((resolve) => {
      // Add to batch queue
      const batchId = Date.now() + Math.random();
      this.batchedUpdates.set(batchId, {
        updates,
        resolve,
        timestamp: Date.now()
      });

      // Schedule batch processing
      this._scheduleBatchProcess();
    });
  }

  /**
   * Create optimized element
   */
  createElement(tagName, className, content, attributes = {}) {
    // Try to recycle element from pool
    let element = this._getFromPool(tagName, className);
    
    if (!element) {
      element = document.createElement(tagName);
      if (className) {
        element.className = className;
      }
    } else {
      this.metrics.recycledElements++;
    }

    // Set content efficiently
    if (content !== undefined) {
      this._setElementContent(element, content);
    }

    // Set attributes efficiently
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });

    return element;
  }

  /**
   * Recycle element back to pool
   */
  recycleElement(element) {
    if (!this.options.recycleElements || !element) return;

    const tagName = element.tagName.toLowerCase();
    const className = element.className;
    const poolKey = `${tagName}-${className}`;

    // Clean element
    this._cleanElement(element);

    // Add to pool
    const pool = this.elementPools.get(poolKey) || [];
    if (pool.length < 50) { // Limit pool size
      pool.push(element);
      this.elementPools.set(poolKey, pool);
    }
  }

  /**
   * Diff and update tree efficiently
   */
  async updateTree(container, newTree, oldTree, options = {}) {
    if (this.destroyed) return;

    if (!this.options.diffingEnabled || !oldTree) {
      return this.renderTree(container, newTree, options);
    }

    const startTime = performance.now();
    
    try {
      // Perform tree diffing
      const patches = this._diffTrees(oldTree, newTree);
      
      if (patches.length === 0) {
        this.metrics.skippedRenders++;
        return; // No changes needed
      }

      // Apply patches efficiently
      await this._applyPatches(container, patches, options);

    } catch (error) {
      console.error('Tree update error:', error);
      // Fallback to full re-render
      return this.renderTree(container, newTree, options);
    } finally {
      const updateTime = performance.now() - startTime;
      this._updateFrameTime(updateTime);
    }
  }

  /**
   * Enable lazy rendering for container
   */
  enableLazyRendering(container, threshold = 0.1) {
    if (!this.intersectionObserver) return;

    const observer = this.intersectionObserver;
    
    // Observe all child elements
    const elements = container.querySelectorAll('[data-lazy-render]');
    elements.forEach(element => {
      if (!this.observedElements.has(element)) {
        observer.observe(element);
        this.observedElements.add(element);
      }
    });
  }

  /**
   * Prefetch rendering data for upcoming elements
   */
  async prefetchRenderData(nodes, distance = 2) {
    if (this.destroyed || distance <= 0) return;

    const prefetchPromises = nodes.map(async (node) => {
      // Prefetch child data
      if (node.children && node.children.length > 0) {
        await this.prefetchRenderData(node.children, distance - 1);
      }

      // Pre-calculate signatures
      this._calculateNodeSignature(node);

      // Pre-render critical elements
      if (node.critical) {
        await this._prerenderNode(node);
      }
    });

    await Promise.all(prefetchPromises);
  }

  /**
   * Get rendering performance metrics
   */
  getMetrics() {
    const batchEfficiency = this.metrics.totalRenders > 0 
      ? this.metrics.batchedRenders / this.metrics.totalRenders 
      : 0;

    const recycleEfficiency = this.metrics.totalRenders > 0
      ? this.metrics.recycledElements / this.metrics.totalRenders
      : 0;

    return {
      ...this.metrics,
      batchEfficiency,
      recycleEfficiency,
      queuedRenders: this.renderQueue.length,
      poolSizes: this._getPoolSizes(),
      frameRate: Math.round(1000 / this.metrics.averageFrameTime)
    };
  }

  /**
   * Optimize for current performance conditions
   */
  adaptToPerformance() {
    const metrics = this.getMetrics();
    
    // If frame rate is low, increase optimization
    if (metrics.frameRate < 30) {
      this.options.batchSize = Math.min(100, this.options.batchSize * 1.5);
      this.options.virtualizeThreshold = Math.max(500, this.options.virtualizeThreshold * 0.8);
    }
    
    // If frame rate is high, we can be less aggressive
    if (metrics.frameRate > 55) {
      this.options.batchSize = Math.max(25, this.options.batchSize * 0.9);
      this.options.virtualizeThreshold = Math.min(2000, this.options.virtualizeThreshold * 1.1);
    }
    
    // Adjust recycling based on memory pressure
    if (performance.memory && performance.memory.usedJSHeapSize > 50 * 1024 * 1024) {
      this._clearElementPools();
    }
  }

  /**
   * Render tree with optimizations
   * @private
   */
  async _renderOptimized(container, tree, options) {
    const fragment = document.createDocumentFragment();
    const renderContext = {
      container,
      fragment,
      options,
      level: 0,
      rendered: 0
    };

    await this._renderNodeOptimized(tree, renderContext);

    // Batch DOM update
    return this._commitRender(container, fragment, options);
  }

  /**
   * Render single node with optimizations
   * @private
   */
  async _renderNodeOptimized(node, context) {
    if (this.destroyed) return;

    // Check if we need to yield
    if (context.rendered > 0 && context.rendered % this.options.batchSize === 0) {
      await this._yieldToMain();
    }

    // Create element efficiently
    const element = this._createNodeElement(node, context);
    
    // Set lazy rendering if appropriate
    if (context.level > 2 && this.options.lazyRendering) {
      element.setAttribute('data-lazy-render', 'true');
      element.style.minHeight = '20px'; // Prevent layout shift
    }

    // Render children
    if (node.children && node.children.length > 0) {
      const childContext = {
        ...context,
        level: context.level + 1
      };

      for (const child of node.children) {
        await this._renderNodeOptimized(child, childContext);
        context.rendered++;
      }
    }

    context.fragment.appendChild(element);
    return element;
  }

  /**
   * Render with virtualization for large trees
   * @private
   */
  async _renderVirtualized(container, tree, options) {
    // This would integrate with VirtualScrollManager
    // For now, implement a simplified version
    
    const visibleNodes = this._getVisibleNodes(tree, options.viewport);
    const fragment = document.createDocumentFragment();
    
    for (const node of visibleNodes) {
      const element = this._createNodeElement(node, { 
        container, 
        fragment, 
        options, 
        level: 0 
      });
      fragment.appendChild(element);
    }
    
    return this._commitRender(container, fragment, options);
  }

  /**
   * Create DOM element for node
   * @private
   */
  _createNodeElement(node, context) {
    const className = `tree-node level-${context.level}`;
    const element = this.createElement('div', className);
    
    // Set node data
    element.setAttribute('data-node-id', node.id || '');
    element.setAttribute('data-node-type', node.type || 'default');
    
    // Create node structure
    const header = this.createElement('div', 'node-header', node.title);
    element.appendChild(header);
    
    if (node.content) {
      const content = this.createElement('div', 'node-content', node.content);
      element.appendChild(content);
    }
    
    // Store node reference for diffing
    element._treeNode = node;
    this._calculateNodeSignature(node);
    
    return element;
  }

  /**
   * Commit rendered content to DOM
   * @private
   */
  async _commitRender(container, fragment, options) {
    // Measure layout before update
    const beforeRect = container.getBoundingClientRect();
    
    // Clear container efficiently
    if (options.replace !== false) {
      this._clearContainer(container);
    }
    
    // Append new content
    container.appendChild(fragment);
    
    // Measure layout after update
    const afterRect = container.getBoundingClientRect();
    
    // Track layout changes
    if (beforeRect.height !== afterRect.height || beforeRect.width !== afterRect.width) {
      this.metrics.reflows++;
    }
    
    // Enable lazy rendering if configured
    if (this.options.lazyRendering) {
      this.enableLazyRendering(container);
    }
    
    return container;
  }

  /**
   * Diff two trees for efficient updates
   * @private
   */
  _diffTrees(oldTree, newTree) {
    const patches = [];
    
    this._diffNodes(oldTree, newTree, patches, []);
    
    return patches;
  }

  /**
   * Diff two nodes recursively
   * @private
   */
  _diffNodes(oldNode, newNode, patches, path) {
    if (!oldNode && !newNode) return;
    
    if (!oldNode) {
      patches.push({ type: 'CREATE', node: newNode, path });
      return;
    }
    
    if (!newNode) {
      patches.push({ type: 'REMOVE', path });
      return;
    }
    
    // Check if nodes are different
    const oldSig = this._calculateNodeSignature(oldNode);
    const newSig = this._calculateNodeSignature(newNode);
    
    if (oldSig !== newSig) {
      patches.push({ type: 'UPDATE', oldNode, newNode, path });
    }
    
    // Diff children
    const oldChildren = oldNode.children || [];
    const newChildren = newNode.children || [];
    const maxLength = Math.max(oldChildren.length, newChildren.length);
    
    for (let i = 0; i < maxLength; i++) {
      this._diffNodes(
        oldChildren[i],
        newChildren[i],
        patches,
        [...path, i]
      );
    }
  }

  /**
   * Apply patches to DOM
   * @private
   */
  async _applyPatches(container, patches, options) {
    const fragment = document.createDocumentFragment();
    let patchesApplied = 0;
    
    for (const patch of patches) {
      switch (patch.type) {
        case 'CREATE':
          await this._applyCreatePatch(container, patch, fragment);
          break;
        case 'UPDATE':
          await this._applyUpdatePatch(container, patch);
          break;
        case 'REMOVE':
          await this._applyRemovePatch(container, patch);
          break;
      }
      
      patchesApplied++;
      
      // Yield periodically
      if (patchesApplied % 20 === 0) {
        await this._yieldToMain();
      }
    }
    
    // Commit any new elements
    if (fragment.children.length > 0) {
      container.appendChild(fragment);
    }
  }

  /**
   * Calculate node signature for efficient diffing
   * @private
   */
  _calculateNodeSignature(node) {
    if (this.nodeSignatures.has(node)) {
      return this.nodeSignatures.get(node);
    }
    
    const signature = JSON.stringify({
      title: node.title,
      content: node.content,
      type: node.type,
      childCount: (node.children || []).length
    });
    
    this.nodeSignatures.set(node, signature);
    return signature;
  }

  /**
   * Get element from pool
   * @private
   */
  _getFromPool(tagName, className) {
    if (!this.options.recycleElements) return null;
    
    const poolKey = `${tagName}-${className}`;
    const pool = this.elementPools.get(poolKey);
    
    return pool && pool.length > 0 ? pool.pop() : null;
  }

  /**
   * Clean element for recycling
   * @private
   */
  _cleanElement(element) {
    // Clear content
    element.textContent = '';
    
    // Remove attributes except class
    const attrs = Array.from(element.attributes);
    attrs.forEach(attr => {
      if (attr.name !== 'class') {
        element.removeAttribute(attr.name);
      }
    });
    
    // Clear inline styles
    element.style.cssText = '';
    
    // Remove tree node reference
    delete element._treeNode;
  }

  /**
   * Initialize intersection observer for lazy rendering
   * @private
   */
  _initializeIntersectionObserver() {
    if (typeof IntersectionObserver === 'undefined') return;
    
    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this._renderLazyElement(entry.target);
        }
      });
    }, {
      threshold: this.options.intersectionThreshold,
      rootMargin: '50px'
    });
  }

  /**
   * Initialize performance observer
   * @private
   */
  _initializePerformanceObserver() {
    if (typeof PerformanceObserver === 'undefined') return;
    
    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.entryType === 'measure' && entry.name.includes('render')) {
            this._updateFrameTime(entry.duration);
          }
        });
      });
      
      this.performanceObserver.observe({ entryTypes: ['measure'] });
    } catch (e) {
      // Performance observer not supported
    }
  }

  /**
   * Start render loop for batching
   * @private
   */
  _startRenderLoop() {
    const processFrame = () => {
      if (this.destroyed) return;
      
      if (this.renderQueue.length > 0 || this.batchedUpdates.size > 0) {
        this._processBatchedUpdates();
      }
      
      requestAnimationFrame(processFrame);
    };
    
    requestAnimationFrame(processFrame);
  }

  /**
   * Process batched updates
   * @private
   */
  _processBatchedUpdates() {
    if (this.activeRender) return;
    
    this.activeRender = true;
    const startTime = performance.now();
    
    try {
      // Process batched updates
      for (const [batchId, batch] of this.batchedUpdates.entries()) {
        batch.updates.forEach(update => update());
        batch.resolve();
        this.batchedUpdates.delete(batchId);
        this.metrics.batchedRenders++;
        
        // Check frame time budget
        if (performance.now() - startTime > this.options.frameTimeTarget) {
          break;
        }
      }
    } finally {
      this.activeRender = false;
    }
  }

  /**
   * Schedule batch processing
   * @private
   */
  _scheduleBatchProcess() {
    if (this.batchTimeout) return;
    
    this.batchTimeout = setTimeout(() => {
      this.batchTimeout = null;
      this._processBatchedUpdates();
    }, 0);
  }

  /**
   * Update frame time metrics
   * @private
   */
  _updateFrameTime(duration) {
    this.metrics.averageFrameTime = (this.metrics.averageFrameTime * 0.9) + (duration * 0.1);
    this.lastFrameTime = duration;
  }

  /**
   * Yield to main thread
   * @private
   */
  async _yieldToMain() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  /**
   * Count nodes in tree
   * @private
   */
  _countNodes(tree, count = 0) {
    if (!tree) return count;
    
    count++;
    
    if (tree.children) {
      tree.children.forEach(child => {
        count = this._countNodes(child, count);
      });
    }
    
    return count;
  }

  /**
   * Clear element pools
   * @private
   */
  _clearElementPools() {
    this.elementPools.clear();
  }

  /**
   * Get pool sizes for metrics
   * @private
   */
  _getPoolSizes() {
    const sizes = {};
    this.elementPools.forEach((pool, key) => {
      sizes[key] = pool.length;
    });
    return sizes;
  }

  /**
   * Set element content efficiently
   * @private
   */
  _setElementContent(element, content) {
    if (typeof content === 'string') {
      element.textContent = content;
    } else if (content instanceof DocumentFragment || content instanceof Element) {
      element.appendChild(content);
    } else {
      element.textContent = String(content);
    }
  }

  /**
   * Clear container efficiently
   * @private
   */
  _clearContainer(container) {
    // Recycle existing elements if enabled
    if (this.options.recycleElements) {
      const elements = container.querySelectorAll('[data-recyclable]');
      elements.forEach(element => this.recycleElement(element));
    }
    
    // Clear container
    container.innerHTML = '';
  }

  /**
   * Get visible nodes for virtualization
   * @private
   */
  _getVisibleNodes(tree, viewport = {}) {
    // Simplified implementation - in reality would use VirtualScrollManager
    const allNodes = this._flattenTree(tree);
    const start = viewport.start || 0;
    const end = viewport.end || Math.min(allNodes.length, start + 50);
    
    return allNodes.slice(start, end);
  }

  /**
   * Flatten tree to array
   * @private
   */
  _flattenTree(tree, depth = 0) {
    const nodes = [{ ...tree, depth }];
    
    if (tree.children && tree.children.length > 0) {
      tree.children.forEach(child => {
        nodes.push(...this._flattenTree(child, depth + 1));
      });
    }
    
    return nodes;
  }

  /**
   * Apply create patch
   * @private
   */
  async _applyCreatePatch(container, patch, fragment) {
    const element = this._createNodeElement(patch.node, {
      container,
      fragment,
      options: {},
      level: patch.path.length
    });
    
    fragment.appendChild(element);
  }

  /**
   * Apply update patch
   * @private
   */
  async _applyUpdatePatch(container, patch) {
    // Find element to update
    const element = this._findElementByPath(container, patch.path);
    if (element) {
      // Update element content
      const titleElement = element.querySelector('.node-header');
      if (titleElement) {
        titleElement.textContent = patch.newNode.title;
      }
      
      const contentElement = element.querySelector('.node-content');
      if (contentElement && patch.newNode.content) {
        contentElement.textContent = patch.newNode.content;
      }
      
      // Update node reference
      element._treeNode = patch.newNode;
    }
  }

  /**
   * Apply remove patch
   * @private
   */
  async _applyRemovePatch(container, patch) {
    const element = this._findElementByPath(container, patch.path);
    if (element && element.parentNode) {
      // Recycle before removing
      this.recycleElement(element);
      element.parentNode.removeChild(element);
    }
  }

  /**
   * Find element by path
   * @private
   */
  _findElementByPath(container, path) {
    let current = container;
    
    for (const index of path) {
      const children = current.children;
      if (index < children.length) {
        current = children[index];
      } else {
        return null;
      }
    }
    
    return current;
  }

  /**
   * Render lazy element
   * @private
   */
  _renderLazyElement(element) {
    // Remove lazy marker
    element.removeAttribute('data-lazy-render');
    
    // Render actual content
    const node = element._treeNode;
    if (node && node.children) {
      const childContainer = document.createElement('div');
      childContainer.className = 'node-children';
      
      node.children.forEach(child => {
        const childElement = this._createNodeElement(child, {
          container: element,
          fragment: childContainer,
          options: {},
          level: 1
        });
        childContainer.appendChild(childElement);
      });
      
      element.appendChild(childContainer);
    }
    
    // Remove from observer
    if (this.intersectionObserver) {
      this.intersectionObserver.unobserve(element);
    }
  }

  /**
   * Prerender node
   * @private
   */
  async _prerenderNode(node) {
    // Create element in memory
    const element = this._createNodeElement(node, {
      container: null,
      fragment: document.createDocumentFragment(),
      options: {},
      level: 0
    });
    
    // Store in cache for quick access
    if (node.id) {
      // Could integrate with cache system here
    }
    
    return element;
  }

  /**
   * Destroy optimizer
   */
  destroy() {
    if (this.destroyed) return;
    
    this.destroyed = true;
    
    // Clear timeouts
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    
    // Disconnect observers
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    
    // Clear pools and caches
    this.elementPools.clear();
    this.renderQueue = [];
    this.batchedUpdates.clear();
    this.previousTreeState = new WeakMap();
    this.nodeSignatures = new WeakMap();
    this.observedElements = new WeakSet();
  }
}