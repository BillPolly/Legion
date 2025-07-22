/**
 * Page State Monitor for Cerebrate Chrome Extension
 * Monitors page state changes, navigation, DOM mutations, performance, and errors
 */
export class PageStateMonitor {

  constructor(contentScript = null) {
    this.contentScript = contentScript;
    this.initialized = false;
    
    // Monitoring state
    this.monitoringOptions = {
      navigation: true,
      mutations: true,
      performance: true,
      errors: true,
      scroll: true
    };
    
    // Event callbacks
    this.navigationCallbacks = [];
    this.hashChangeCallbacks = [];
    this.domChangeCallbacks = [];
    this.attributeChangeCallbacks = [];
    this.textChangeCallbacks = [];
    this.errorCallbacks = [];
    this.scrollCallbacks = [];
    this.resizeCallbacks = [];
    this.resourceLoadCallbacks = [];
    this.stateChangeCallbacks = [];
    this.visibilityCallbacks = [];
    
    // State tracking
    this.navigationHistory = [];
    this.previousHistoryLength = window.history.length;
    this.previousScrollPosition = { x: window.scrollX, y: window.scrollY };
    this.lastViewportSize = { width: window.innerWidth, height: window.innerHeight };
    this.mutationCount = 0;
    this.errorStatistics = {
      totalErrors: 0,
      errorTypes: {
        javascript: 0,
        'unhandled-rejection': 0
      },
      recentErrors: [],
      topErrors: []
    };
    
    // Performance tracking
    this.coreWebVitals = {
      FCP: null,
      LCP: null,
      FID: null,
      CLS: null,
      TTFB: null
    };
    
    this.memoryTrend = [];
    
    // Observers and listeners
    this.mutationObserver = null;
    this.performanceObserver = null;
    this.intersectionObservers = new Map();
    this.eventListeners = [];
    
    // Throttling settings
    this.mutationThrottleMs = 16; // ~60fps
    this.mutationThrottleTimer = null;
    this.pendingMutations = [];
    
    // Resource observer callback
    this.resourceObserverCallback = null;
    
    // Settings
    this.maxHistorySize = 100;
    this.maxErrorHistory = 50;
    this.maxMemoryTrend = 50;
    this.stateChangeThreshold = 10; // mutations to trigger state change
  }

  /**
   * Initialize the page state monitor
   * @param {Object} options - Monitoring options
   */
  initialize(options = {}) {
    if (this.initialized) {
      return;
    }

    // Merge options
    this.monitoringOptions = { ...this.monitoringOptions, ...options };
    
    try {
      // Setup navigation monitoring
      if (this.monitoringOptions.navigation) {
        this.setupNavigationMonitoring();
      }
      
      // Setup DOM mutation monitoring  
      if (this.monitoringOptions.mutations) {
        this.setupMutationMonitoring();
      }
      
      // Setup performance monitoring
      if (this.monitoringOptions.performance) {
        this.setupPerformanceMonitoring();
      }
      
      // Setup error monitoring
      if (this.monitoringOptions.errors) {
        this.setupErrorMonitoring();
      }
      
      // Setup scroll monitoring
      if (this.monitoringOptions.scroll) {
        this.setupScrollMonitoring();
      }
      
      this.initialized = true;
    } catch (error) {
      console.warn('Error initializing PageStateMonitor:', error);
      // Continue with partial functionality
      this.initialized = true;
    }
  }

  /**
   * Setup navigation event monitoring
   * @private
   */
  setupNavigationMonitoring() {
    const navigationHandler = (event) => {
      const direction = this.detectNavigationDirection();
      
      const navigationEvent = {
        type: event.type,
        url: window.location.href,
        state: event.state,
        timestamp: Date.now(),
        direction
      };
      
      this.addToNavigationHistory(navigationEvent);
      this.notifyCallbacks(this.navigationCallbacks, navigationEvent);
    };
    
    const hashChangeHandler = (event) => {
      const hashEvent = {
        oldURL: event.oldURL,
        newURL: event.newURL,
        oldHash: new URL(event.oldURL).hash,
        newHash: new URL(event.newURL).hash,
        timestamp: Date.now()
      };
      
      this.notifyCallbacks(this.hashChangeCallbacks, hashEvent);
    };
    
    window.addEventListener('popstate', navigationHandler);
    window.addEventListener('hashchange', hashChangeHandler);
    
    this.eventListeners.push(
      { element: window, event: 'popstate', handler: navigationHandler },
      { element: window, event: 'hashchange', handler: hashChangeHandler }
    );
  }

  /**
   * Setup DOM mutation monitoring
   * @private
   */
  setupMutationMonitoring() {
    try {
      this.mutationObserver = new MutationObserver((mutations) => {
        this.handleMutations(mutations);
      });
      
      this.mutationObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeOldValue: true,
        characterData: true,
        characterDataOldValue: true
      });
    } catch (error) {
      console.warn('Error setting up mutation observer:', error);
      this.monitoringOptions.mutations = false;
    }
  }

  /**
   * Setup performance monitoring
   * @private
   */
  setupPerformanceMonitoring() {
    try {
      if (typeof PerformanceObserver !== 'undefined') {
        // Core Web Vitals observer
        this.performanceObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          
          entries.forEach(entry => {
            switch (entry.entryType) {
              case 'paint':
                if (entry.name === 'first-contentful-paint') {
                  this.coreWebVitals.FCP = entry.startTime;
                }
                break;
              case 'largest-contentful-paint':
                this.coreWebVitals.LCP = entry.startTime;
                break;
              case 'first-input':
                this.coreWebVitals.FID = entry.processingStart - entry.startTime;
                break;
              case 'layout-shift':
                if (!entry.hadRecentInput) {
                  this.coreWebVitals.CLS = (this.coreWebVitals.CLS || 0) + entry.value;
                }
                break;
            }
          });
        });
        
        this.performanceObserver.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'first-input', 'layout-shift'] });
        
        // Resource observer
        this.resourceObserverCallback = (entryList) => {
          const entries = entryList.getEntries();
          
          entries.forEach(entry => {
            if (entry.entryType === 'resource') {
              const resourceInfo = {
                url: entry.name,
                type: this.getResourceType(entry.name),
                loadTime: entry.responseEnd - entry.startTime,
                size: entry.transferSize || 0,
                timestamp: Date.now(),
                cached: entry.transferSize === 0 && entry.decodedBodySize > 0
              };
              
              this.notifyCallbacks(this.resourceLoadCallbacks, resourceInfo);
            }
          });
        };
        
        const resourceObserver = new PerformanceObserver(this.resourceObserverCallback);
        resourceObserver.observe({ entryTypes: ['resource'] });
      }
      
      // Calculate TTFB
      if (performance.timing) {
        this.coreWebVitals.TTFB = performance.timing.responseStart - performance.timing.navigationStart;
      }
    } catch (error) {
      console.warn('Error setting up performance monitoring:', error);
      this.monitoringOptions.performance = false;
    }
  }

  /**
   * Setup error monitoring
   * @private
   */
  setupErrorMonitoring() {
    const errorHandler = (event) => {
      const errorInfo = {
        type: 'javascript',
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error ? event.error.stack : '',
        timestamp: Date.now(),
        url: window.location.href
      };
      
      this.trackError(errorInfo);
      this.notifyCallbacks(this.errorCallbacks, errorInfo);
    };
    
    const rejectionHandler = (event) => {
      const errorInfo = {
        type: 'unhandled-rejection',
        message: event.reason.message || event.reason.toString(),
        stack: event.reason.stack || '',
        timestamp: Date.now(),
        url: window.location.href
      };
      
      this.trackError(errorInfo);
      this.notifyCallbacks(this.errorCallbacks, errorInfo);
    };
    
    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);
    
    this.eventListeners.push(
      { element: window, event: 'error', handler: errorHandler },
      { element: window, event: 'unhandledrejection', handler: rejectionHandler }
    );
  }

  /**
   * Setup scroll and viewport monitoring
   * @private
   */
  setupScrollMonitoring() {
    const scrollHandler = () => {
      const currentPosition = { x: window.scrollX, y: window.scrollY };
      const direction = this.getScrollDirection(currentPosition);
      const velocity = this.calculateScrollVelocity(currentPosition);
      
      const scrollInfo = {
        x: currentPosition.x,
        y: currentPosition.y,
        direction,
        velocity,
        timestamp: Date.now()
      };
      
      this.previousScrollPosition = currentPosition;
      this.notifyCallbacks(this.scrollCallbacks, scrollInfo);
    };
    
    const resizeHandler = () => {
      const currentSize = { width: window.innerWidth, height: window.innerHeight };
      
      const resizeInfo = {
        width: currentSize.width,
        height: currentSize.height,
        aspectRatio: currentSize.width / currentSize.height,
        orientation: currentSize.width > currentSize.height ? 'landscape' : 'portrait',
        timestamp: Date.now()
      };
      
      this.lastViewportSize = currentSize;
      this.notifyCallbacks(this.resizeCallbacks, resizeInfo);
    };
    
    window.addEventListener('scroll', scrollHandler, { passive: true });
    window.addEventListener('resize', resizeHandler);
    
    this.eventListeners.push(
      { element: window, event: 'scroll', handler: scrollHandler },
      { element: window, event: 'resize', handler: resizeHandler }
    );
  }

  /**
   * Handle DOM mutations with throttling
   * @private
   */
  handleMutations(mutations) {
    this.pendingMutations.push(...mutations);
    
    if (this.mutationThrottleTimer) {
      return;
    }
    
    this.mutationThrottleTimer = setTimeout(() => {
      const allMutations = [...this.pendingMutations];
      this.pendingMutations = [];
      this.mutationThrottleTimer = null;
      
      allMutations.forEach(mutation => {
        const mutationInfo = {
          type: mutation.type,
          target: mutation.target,
          addedNodes: Array.from(mutation.addedNodes),
          removedNodes: Array.from(mutation.removedNodes),
          attributeName: mutation.attributeName,
          oldValue: mutation.oldValue,
          newValue: mutation.type === 'attributes' ? 
            mutation.target.getAttribute(mutation.attributeName) : 
            (mutation.type === 'characterData' ? mutation.target.textContent : null),
          timestamp: Date.now()
        };
        
        this.mutationCount++;
        
        // Route to specific callbacks
        if (mutation.type === 'childList') {
          this.notifyCallbacks(this.domChangeCallbacks, mutationInfo);
        } else if (mutation.type === 'attributes') {
          this.notifyCallbacks(this.attributeChangeCallbacks, mutationInfo);
        } else if (mutation.type === 'characterData') {
          this.notifyCallbacks(this.textChangeCallbacks, mutationInfo);
        }
        
        // Check for significant state changes
        if (this.mutationCount % this.stateChangeThreshold === 0) {
          const stateChangeInfo = {
            type: 'dom-structure',
            significance: this.mutationCount > 50 ? 'major' : 'minor',
            changes: this.mutationCount,
            timestamp: Date.now()
          };
          
          this.notifyCallbacks(this.stateChangeCallbacks, stateChangeInfo);
        }
      });
    }, this.mutationThrottleMs);
  }

  /**
   * Track error statistics
   * @private
   */
  trackError(errorInfo) {
    this.errorStatistics.totalErrors++;
    this.errorStatistics.errorTypes[errorInfo.type] = 
      (this.errorStatistics.errorTypes[errorInfo.type] || 0) + 1;
    
    // Add to recent errors
    this.errorStatistics.recentErrors.unshift(errorInfo);
    if (this.errorStatistics.recentErrors.length > this.maxErrorHistory) {
      this.errorStatistics.recentErrors.pop();
    }
    
    // Update error rate (errors per minute)
    const now = Date.now();
    const recentErrors = this.errorStatistics.recentErrors.filter(
      error => now - error.timestamp < 60000
    );
    this.errorStatistics.errorRate = recentErrors.length;
    
    // Update top errors
    this.updateTopErrors(errorInfo);
  }

  /**
   * Update top errors list
   * @private
   */
  updateTopErrors(errorInfo) {
    const signature = `${errorInfo.message}:${errorInfo.filename}:${errorInfo.line}`;
    
    let topError = this.errorStatistics.topErrors.find(e => e.signature === signature);
    if (topError) {
      topError.count++;
      topError.lastOccurred = errorInfo.timestamp;
    } else {
      this.errorStatistics.topErrors.push({
        signature,
        message: errorInfo.message,
        filename: errorInfo.filename,
        line: errorInfo.line,
        count: 1,
        firstOccurred: errorInfo.timestamp,
        lastOccurred: errorInfo.timestamp
      });
    }
    
    // Sort by count
    this.errorStatistics.topErrors.sort((a, b) => b.count - a.count);
    
    // Keep top 10
    if (this.errorStatistics.topErrors.length > 10) {
      this.errorStatistics.topErrors.splice(10);
    }
  }

  /**
   * Detect navigation direction
   * @private
   */
  detectNavigationDirection() {
    const currentLength = window.history.length;
    let direction = 'unknown';
    
    if (currentLength < this.previousHistoryLength) {
      direction = 'back';
    } else if (currentLength > this.previousHistoryLength) {
      direction = 'forward';
    }
    
    this.previousHistoryLength = currentLength;
    return direction;
  }

  /**
   * Get scroll direction
   * @private
   */
  getScrollDirection(currentPosition) {
    const deltaY = currentPosition.y - this.previousScrollPosition.y;
    if (deltaY > 0) return 'down';
    if (deltaY < 0) return 'up';
    return 'none';
  }

  /**
   * Calculate scroll velocity
   * @private
   */
  calculateScrollVelocity(currentPosition) {
    const deltaY = Math.abs(currentPosition.y - this.previousScrollPosition.y);
    const deltaTime = 16; // Approximate frame time
    return deltaY / deltaTime;
  }

  /**
   * Get resource type from URL
   * @private
   */
  getResourceType(url) {
    if (url.match(/\.(js)$/)) return 'script';
    if (url.match(/\.(css)$/)) return 'stylesheet';
    if (url.match(/\.(png|jpg|jpeg|gif|svg)$/)) return 'image';
    if (url.match(/\.(woff|woff2|ttf|eot)$/)) return 'font';
    return 'other';
  }

  /**
   * Add navigation event to history
   * @private
   */
  addToNavigationHistory(navigationEvent) {
    this.navigationHistory.push(navigationEvent);
    if (this.navigationHistory.length > this.maxHistorySize) {
      this.navigationHistory.shift();
    }
  }

  /**
   * Notify callbacks with error handling
   * @private
   */
  notifyCallbacks(callbacks, data, filterElement = null) {
    callbacks.forEach(callback => {
      try {
        if (callback.filter && data.addedNodes) {
          // Check if any added nodes match the filter
          const matchingNodes = data.addedNodes.filter(node => {
            return node.nodeType === 1 && // Element node
                   node.matches && 
                   node.matches(callback.filter);
          });
          
          if (matchingNodes.length === 0) {
            return;
          }
        }
        
        callback.callback ? callback.callback(data) : callback(data);
      } catch (error) {
        console.warn('Error in callback:', error);
      }
    });
  }

  // Public API methods

  /**
   * Register navigation event callback
   */
  onNavigation(callback) {
    this.navigationCallbacks.push(callback);
  }

  /**
   * Register hash change callback
   */
  onHashChange(callback) {
    this.hashChangeCallbacks.push(callback);
  }

  /**
   * Register DOM change callback
   */
  onDOMChange(callback, filter = null) {
    this.domChangeCallbacks.push(filter ? { callback, filter } : callback);
  }

  /**
   * Register attribute change callback
   */
  onAttributeChange(callback) {
    this.attributeChangeCallbacks.push(callback);
  }

  /**
   * Register text change callback
   */
  onTextChange(callback) {
    this.textChangeCallbacks.push(callback);
  }

  /**
   * Register error callback
   */
  onError(callback) {
    this.errorCallbacks.push(callback);
  }

  /**
   * Register scroll callback
   */
  onScroll(callback) {
    this.scrollCallbacks.push(callback);
  }

  /**
   * Register viewport change callback
   */
  onViewportChange(callback) {
    this.resizeCallbacks.push(callback);
  }

  /**
   * Register resource load callback
   */
  onResourceLoad(callback) {
    this.resourceLoadCallbacks.push(callback);
  }

  /**
   * Register state change callback
   */
  onStateChange(callback) {
    this.stateChangeCallbacks.push(callback);
  }

  /**
   * Register element visibility callback
   */
  onElementVisibility(selector, callback) {
    try {
      const element = document.querySelector(selector);
      if (!element) return;
      
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const visibilityInfo = {
            element: entry.target,
            visible: entry.isIntersecting,
            ratio: entry.intersectionRatio,
            timestamp: Date.now()
          };
          
          callback(visibilityInfo);
        });
      });
      
      observer.observe(element);
      this.intersectionObservers.set(selector, observer);
    } catch (error) {
      console.warn('Error setting up visibility observer:', error);
    }
  }

  /**
   * Get navigation history
   */
  getNavigationHistory() {
    return [...this.navigationHistory];
  }

  /**
   * Get navigation metrics
   */
  getNavigationMetrics() {
    const timing = performance.timing;
    
    return {
      domContentLoaded: timing.domContentLoadedEventEnd - timing.domContentLoadedEventStart,
      loadComplete: timing.loadEventEnd - timing.loadEventStart,
      firstPaint: this.coreWebVitals.FCP || 0,
      firstContentfulPaint: this.coreWebVitals.FCP || 0,
      timeToInteractive: timing.domInteractive - timing.navigationStart,
      navigationTiming: {
        navigationStart: timing.navigationStart,
        domContentLoadedEventStart: timing.domContentLoadedEventStart,
        domContentLoadedEventEnd: timing.domContentLoadedEventEnd,
        loadEventStart: timing.loadEventStart,
        loadEventEnd: timing.loadEventEnd
      }
    };
  }

  /**
   * Get Core Web Vitals
   */
  getCoreWebVitals() {
    return { ...this.coreWebVitals };
  }

  /**
   * Analyze performance issues
   */
  analyzePerformanceIssues(resources = []) {
    const issues = [];
    
    resources.forEach(resource => {
      const loadTime = resource.responseEnd - resource.startTime;
      
      if (loadTime > 3000) {
        issues.push({
          type: 'slow-resource',
          resource: resource.name,
          loadTime
        });
      }
      
      if (resource.transferSize > 500000) {
        issues.push({
          type: 'large-resource',
          resource: resource.name,
          size: resource.transferSize
        });
      }
    });
    
    return issues;
  }

  /**
   * Get memory usage
   */
  getMemoryUsage() {
    if (!performance.memory) {
      return {
        used: 0,
        total: 0,
        limit: 0,
        percentage: 0,
        trend: []
      };
    }
    
    const memory = performance.memory;
    const usage = {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
      percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
      trend: [...this.memoryTrend]
    };
    
    // Update trend
    this.memoryTrend.unshift({
      used: memory.usedJSHeapSize,
      timestamp: Date.now()
    });
    
    if (this.memoryTrend.length > this.maxMemoryTrend) {
      this.memoryTrend.pop();
    }
    
    return usage;
  }

  /**
   * Get error statistics
   */
  getErrorStatistics() {
    return { ...this.errorStatistics };
  }

  /**
   * Detect error patterns
   */
  detectErrorPatterns() {
    const patterns = [];
    
    // Find repeated errors
    this.errorStatistics.topErrors.forEach(error => {
      if (error.count >= 3) {
        patterns.push({
          type: 'repeated-error',
          message: error.message,
          count: error.count,
          locations: [{
            filename: error.filename,
            line: error.line
          }]
        });
      }
    });
    
    return patterns;
  }

  /**
   * Set mutation throttle
   */
  setMutationThrottle(milliseconds) {
    this.mutationThrottleMs = milliseconds;
  }

  /**
   * Capture page snapshot
   */
  captureSnapshot() {
    return {
      url: window.location.href,
      title: document.title,
      timestamp: Date.now(),
      dom: {
        nodeCount: document.getElementsByTagName('*').length,
        depth: this.calculateDOMDepth(document.documentElement),
        structure: document.documentElement.outerHTML.substring(0, 1000)
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY
      },
      performance: this.getCoreWebVitals(),
      errors: this.errorStatistics.recentErrors.slice(0, 10)
    };
  }

  /**
   * Compare page snapshots
   */
  compareSnapshots(snapshot1, snapshot2) {
    return {
      dom: {
        nodeCountDelta: snapshot2.dom.nodeCount - snapshot1.dom.nodeCount,
        structuralChanges: this.compareStructure(snapshot1.dom.structure, snapshot2.dom.structure)
      },
      viewport: {
        widthDelta: snapshot2.viewport.width - snapshot1.viewport.width,
        heightDelta: snapshot2.viewport.height - snapshot1.viewport.height,
        scrollDelta: {
          x: snapshot2.viewport.scrollX - snapshot1.viewport.scrollX,
          y: snapshot2.viewport.scrollY - snapshot1.viewport.scrollY
        }
      },
      performance: {
        fcpDelta: (snapshot2.performance.FCP || 0) - (snapshot1.performance.FCP || 0),
        lcpDelta: (snapshot2.performance.LCP || 0) - (snapshot1.performance.LCP || 0)
      },
      timestamp: Date.now()
    };
  }

  /**
   * Compare DOM structure
   * @private
   */
  compareStructure(structure1, structure2) {
    // Simple comparison - in real implementation would be more sophisticated
    return structure1 === structure2 ? [] : ['content-changed'];
  }

  /**
   * Calculate DOM depth
   * @private
   */
  calculateDOMDepth(element, depth = 0) {
    if (!element.children.length) return depth;
    
    let maxChildDepth = depth;
    for (let child of element.children) {
      const childDepth = this.calculateDOMDepth(child, depth + 1);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    }
    
    return maxChildDepth;
  }

  /**
   * Check if monitor is initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus() {
    return { ...this.monitoringOptions };
  }

  /**
   * Destroy the monitor and cleanup resources
   */
  destroy() {
    if (!this.initialized) {
      return;
    }
    
    // Cleanup observers
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }
    
    // Cleanup intersection observers
    this.intersectionObservers.forEach(observer => observer.disconnect());
    this.intersectionObservers.clear();
    
    // Remove event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
    
    // Clear timers
    if (this.mutationThrottleTimer) {
      clearTimeout(this.mutationThrottleTimer);
      this.mutationThrottleTimer = null;
    }
    
    // Clear callbacks
    this.navigationCallbacks = [];
    this.hashChangeCallbacks = [];
    this.domChangeCallbacks = [];
    this.attributeChangeCallbacks = [];
    this.textChangeCallbacks = [];
    this.errorCallbacks = [];
    this.scrollCallbacks = [];
    this.resizeCallbacks = [];
    this.resourceLoadCallbacks = [];
    this.stateChangeCallbacks = [];
    this.visibilityCallbacks = [];
    
    this.initialized = false;
  }
}