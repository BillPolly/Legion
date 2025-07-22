/**
 * Content Script for Cerebrate Chrome Extension
 * Provides page context access, element inspection, and secure communication
 */
export class ContentScript {

  constructor(messaging = null) {
    this.messaging = messaging;
    this.initialized = false;
    
    // State management
    this.highlightOverlays = new Map(); // selector -> overlay element
    this.eventListeners = [];
    this.messageHandler = null;
    this.observers = [];
    
    // Callback registrations
    this.navigationCallbacks = [];
    this.domChangeCallbacks = [];
    this.errorCallbacks = [];
    this.resourceLoadCallbacks = [];
    this.scrollCallbacks = [];
    
    // Performance monitoring
    this.performanceObserver = null;
    
    // Configuration
    this.highlightStyle = {
      position: 'absolute',
      pointerEvents: 'none',
      backgroundColor: 'rgba(74, 144, 226, 0.3)',
      border: '2px solid #4A90E2',
      borderRadius: '3px',
      zIndex: '999999'
    };
  }

  /**
   * Initialize content script
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    this.setupMessageHandler();
    this.setupEventListeners();
    this.setupPerformanceMonitoring();
    
    this.initialized = true;
  }

  /**
   * Setup message handler for extension communication
   * @private
   */
  setupMessageHandler() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      this.messageHandler = (message, sender, sendResponse) => {
        this.handleExtensionMessage(message, sender, sendResponse);
      };
      
      chrome.runtime.onMessage.addListener(this.messageHandler);
    }
  }

  /**
   * Setup event listeners for page monitoring
   * @private
   */
  setupEventListeners() {
    // Navigation events
    const navigationHandler = (event) => {
      const data = {
        type: event.type,
        url: window.location.href,
        state: event.state,
        timestamp: Date.now()
      };
      
      this.navigationCallbacks.forEach(callback => callback(data));
    };
    
    this.addEventListener(window, 'popstate', navigationHandler);

    // Error events
    const errorHandler = (event) => {
      const data = {
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error ? event.error.stack : '',
        timestamp: Date.now()
      };
      
      this.errorCallbacks.forEach(callback => callback(data));
    };
    
    this.addEventListener(window, 'error', errorHandler);

    // Resource loading events  
    const resourceHandler = (event) => {
      const target = event.target;
      const data = {
        type: target.tagName.toLowerCase() === 'link' ? 'stylesheet' : 'script',
        url: target.href || target.src,
        status: 'loaded',
        timestamp: Date.now()
      };
      
      this.resourceLoadCallbacks.forEach(callback => callback(data));
    };
    
    // Note: In real implementation, would need to attach to specific elements
    // This is simplified for testing

    // Scroll events
    const scrollHandler = () => {
      const data = {
        x: window.scrollX,
        y: window.scrollY,
        timestamp: Date.now()
      };
      
      this.scrollCallbacks.forEach(callback => callback(data));
    };
    
    this.addEventListener(window, 'scroll', scrollHandler);
  }

  /**
   * Setup performance monitoring
   * @private
   */
  setupPerformanceMonitoring() {
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          // Process performance entries
        });
        this.performanceObserver.observe({ entryTypes: ['navigation', 'paint', 'resource'] });
      } catch (error) {
        console.warn('Performance monitoring not available');
      }
    }
  }

  /**
   * Add event listener and track for cleanup
   * @param {Element} element - Element to add listener to
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @private
   */
  addEventListener(element, event, handler) {
    element.addEventListener(event, handler);
    this.eventListeners.push({ element, event, handler });
  }

  /**
   * Handle messages from extension
   * @param {Object} message - Message from extension
   * @param {Object} sender - Message sender
   * @param {Function} sendResponse - Response callback
   * @private
   */
  handleExtensionMessage(message, sender, sendResponse) {
    try {
      if (!this.isValidMessage(message)) {
        sendResponse({ success: false, error: 'Invalid message format' });
        return;
      }

      const sanitizedMessage = this.sanitizeMessage(message);
      
      switch (sanitizedMessage.type) {
        case 'inspectElement':
          const metadata = this.getElementMetadata(sanitizedMessage.selector);
          sendResponse({ success: true, data: metadata });
          break;
          
        case 'highlightElement':
          this.highlightElement(sanitizedMessage.selector);
          sendResponse({ success: true });
          break;
          
        case 'removeHighlight':
          this.removeHighlight(sanitizedMessage.selector);
          sendResponse({ success: true });
          break;
          
        case 'capturePageState':
          const pageState = this.capturePageState();
          sendResponse({ success: true, data: pageState });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown command type' });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Get element by selector
   * @param {string} selector - CSS selector
   * @returns {Element|null} - Found element or null
   */
  getElement(selector) {
    try {
      return document.querySelector(selector);
    } catch (error) {
      console.warn('Invalid selector:', selector, error);
      return null;
    }
  }

  /**
   * Get element metadata
   * @param {string} selector - CSS selector
   * @returns {Object|null} - Element metadata or null
   */
  getElementMetadata(selector) {
    const element = this.getElement(selector);
    if (!element) return null;

    try {
      const rect = element.getBoundingClientRect();
      const computedStyles = window.getComputedStyle(element);
      
      // Extract attributes
      const attributes = {};
      for (const attr of element.attributes) {
        if (attr.name !== 'id' && attr.name !== 'class') {
          attributes[attr.name] = attr.value;
        }
      }

      return {
        tagName: element.tagName,
        id: element.id || null,
        className: element.className || null,
        attributes,
        textContent: element.textContent.trim(),
        innerHTML: element.innerHTML,
        computedStyles: this.extractComputedStyles(computedStyles),
        boundingRect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
          bottom: rect.bottom,
          right: rect.right
        }
      };
    } catch (error) {
      console.warn('Error extracting element metadata:', error);
      return null;
    }
  }

  /**
   * Extract relevant computed styles
   * @param {CSSStyleDeclaration} computedStyles - Computed styles
   * @returns {Object} - Relevant styles
   * @private
   */
  extractComputedStyles(computedStyles) {
    const relevantStyles = [
      'display', 'position', 'width', 'height', 'margin', 'padding', 'border',
      'backgroundColor', 'color', 'fontSize', 'fontFamily', 'textAlign',
      'zIndex', 'opacity', 'visibility'
    ];

    const styles = {};
    relevantStyles.forEach(property => {
      styles[property] = computedStyles.getPropertyValue(property);
    });

    return styles;
  }

  /**
   * Get page variable safely
   * @param {string} variableName - Variable name
   * @returns {*} - Variable value or undefined
   */
  getPageVariable(variableName) {
    try {
      return window[variableName];
    } catch (error) {
      console.warn('Cannot access page variable:', variableName, error);
      return undefined;
    }
  }

  /**
   * Execute page function safely
   * @param {string} functionName - Function name
   * @param {...*} args - Function arguments
   * @returns {*} - Function result or undefined
   */
  executePageFunction(functionName, ...args) {
    try {
      const func = window[functionName];
      if (typeof func === 'function') {
        return func(...args);
      }
      return undefined;
    } catch (error) {
      console.warn('Cannot execute page function:', functionName, error);
      return undefined;
    }
  }

  /**
   * Setup frame communication
   * @param {string} frameSelector - Frame selector
   * @returns {Object} - Communication interface
   */
  setupFrameCommunication(frameSelector) {
    try {
      const frame = this.getElement(frameSelector);
      if (!frame || frame.tagName !== 'IFRAME') {
        return null;
      }

      return {
        sendMessage: (message) => {
          try {
            frame.contentWindow.postMessage(message, '*');
          } catch (error) {
            console.warn('Cross-origin frame access blocked:', error);
          }
        },
        listen: (callback) => {
          const handler = (event) => {
            if (event.source === frame.contentWindow) {
              callback(event.data);
            }
          };
          this.addEventListener(window, 'message', handler);
        }
      };
    } catch (error) {
      console.warn('Cannot setup frame communication:', error);
      return null;
    }
  }

  /**
   * Capture page state
   * @returns {Object} - Page state
   */
  capturePageState() {
    try {
      return {
        url: window.location.href,
        title: document.title,
        documentElement: document.documentElement.outerHTML.substring(0, 10000), // Limit size
        bodyClasses: Array.from(document.body.classList),
        headElements: this.getHeadElements(),
        scripts: this.getScriptElements(),
        stylesheets: this.getStylesheetElements(),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY
        },
        timestamp: Date.now()
      };
    } catch (error) {
      console.warn('Error capturing page state:', error);
      return {};
    }
  }

  /**
   * Get head elements
   * @returns {Array} - Head elements
   * @private
   */
  getHeadElements() {
    const elements = [];
    const head = document.head;
    
    if (head) {
      for (const element of head.children) {
        elements.push({
          tagName: element.tagName,
          attributes: this.getElementAttributes(element)
        });
      }
    }
    
    return elements;
  }

  /**
   * Get script elements
   * @returns {Array} - Script elements
   * @private
   */
  getScriptElements() {
    const scripts = [];
    const scriptElements = document.querySelectorAll('script');
    
    scriptElements.forEach(script => {
      scripts.push({
        src: script.src,
        type: script.type,
        async: script.async,
        defer: script.defer
      });
    });
    
    return scripts;
  }

  /**
   * Get stylesheet elements
   * @returns {Array} - Stylesheet elements
   * @private
   */
  getStylesheetElements() {
    const stylesheets = [];
    const linkElements = document.querySelectorAll('link[rel="stylesheet"]');
    
    linkElements.forEach(link => {
      stylesheets.push({
        href: link.href,
        media: link.media,
        disabled: link.disabled
      });
    });
    
    return stylesheets;
  }

  /**
   * Get element attributes
   * @param {Element} element - Element
   * @returns {Object} - Attributes
   * @private
   */
  getElementAttributes(element) {
    const attributes = {};
    for (const attr of element.attributes) {
      attributes[attr.name] = attr.value;
    }
    return attributes;
  }

  /**
   * Highlight element
   * @param {string} selector - Element selector
   */
  highlightElement(selector) {
    try {
      const element = this.getElement(selector);
      if (!element) return;

      // Remove existing highlight
      this.removeHighlight(selector);

      const rect = element.getBoundingClientRect();
      const overlay = document.createElement('div');
      overlay.className = 'cerebrate-highlight-overlay';
      
      // Apply styles
      Object.assign(overlay.style, this.highlightStyle);
      overlay.style.top = (rect.top + window.scrollY) + 'px';
      overlay.style.left = (rect.left + window.scrollX) + 'px';
      overlay.style.width = rect.width + 'px';
      overlay.style.height = rect.height + 'px';

      document.body.appendChild(overlay);
      this.highlightOverlays.set(selector, overlay);
    } catch (error) {
      console.warn('Error highlighting element:', error);
    }
  }

  /**
   * Remove highlight
   * @param {string} selector - Element selector
   */
  removeHighlight(selector) {
    const overlay = this.highlightOverlays.get(selector);
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    this.highlightOverlays.delete(selector);
  }

  /**
   * Get computed styles for element
   * @param {string} selector - Element selector
   * @returns {CSSStyleDeclaration|null} - Computed styles
   */
  getComputedStyles(selector) {
    const element = this.getElement(selector);
    if (!element) return null;
    
    try {
      return window.getComputedStyle(element);
    } catch (error) {
      console.warn('Error getting computed styles:', error);
      return null;
    }
  }

  /**
   * Get event listeners for element
   * @param {string} selector - Element selector
   * @returns {Object} - Event listeners by type
   */
  getEventListeners(selector) {
    const element = this.getElement(selector);
    if (!element) return {};

    // Note: This is a simplified implementation
    // In reality, we'd need to use chrome dev tools or maintain our own registry
    const listeners = {};
    
    // Check for common event types
    const eventTypes = ['click', 'mouseenter', 'mouseleave', 'focus', 'blur', 'change', 'submit'];
    
    eventTypes.forEach(type => {
      // This is a mock implementation - real event listener detection is complex
      if (element.onclick || element[`on${type}`]) {
        listeners[type] = ['native handler'];
      }
    });

    return listeners;
  }

  /**
   * Get element tree
   * @param {string} selector - Root element selector
   * @param {number} maxDepth - Maximum depth to traverse
   * @returns {Object} - Element tree
   */
  getElementTree(selector, maxDepth = 3) {
    const element = this.getElement(selector);
    if (!element) return null;

    const buildTree = (el, depth) => {
      if (depth > maxDepth) return { tagName: el.tagName, truncated: true };

      const node = {
        tagName: el.tagName,
        id: el.id || undefined,
        className: el.className || undefined,
        children: []
      };

      if (depth < maxDepth) {
        for (const child of el.children) {
          node.children.push(buildTree(child, depth + 1));
        }
      }

      return node;
    };

    return buildTree(element, 0);
  }

  /**
   * Find elements by text content
   * @param {string} text - Text to search for
   * @returns {Array} - Found elements
   */
  findElementsByText(text) {
    const elements = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.toLowerCase().includes(text.toLowerCase())) {
        elements.push(node.parentElement);
      }
    }

    return elements;
  }

  /**
   * Get element dimensions
   * @param {string} selector - Element selector
   * @returns {Object|null} - Element dimensions
   */
  getElementDimensions(selector) {
    const element = this.getElement(selector);
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      x: rect.x,
      y: rect.y,
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      right: rect.right
    };
  }

  /**
   * Register navigation callback
   * @param {Function} callback - Navigation callback
   */
  onNavigation(callback) {
    this.navigationCallbacks.push(callback);
  }

  /**
   * Register DOM change callback
   * @param {Function} callback - DOM change callback
   */
  onDOMChange(callback) {
    this.domChangeCallbacks.push(callback);
    
    // Setup mutation observer
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        const data = {
          type: mutation.type,
          target: mutation.target,
          addedNodes: Array.from(mutation.addedNodes),
          removedNodes: Array.from(mutation.removedNodes),
          timestamp: Date.now()
        };
        
        callback(data);
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      characterData: true,
      characterDataOldValue: true
    });
    
    this.observers.push(observer);
  }

  /**
   * Register error callback
   * @param {Function} callback - Error callback
   */
  onError(callback) {
    this.errorCallbacks.push(callback);
  }

  /**
   * Register resource load callback
   * @param {Function} callback - Resource load callback
   */
  onResourceLoad(callback) {
    this.resourceLoadCallbacks.push(callback);
  }

  /**
   * Register scroll callback
   * @param {Function} callback - Scroll callback
   */
  onScroll(callback) {
    this.scrollCallbacks.push(callback);
  }

  /**
   * Capture performance metrics
   * @returns {Object} - Performance metrics
   */
  capturePerformanceMetrics() {
    const navigation = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || {};
    const paint = (performance.getEntriesByType && performance.getEntriesByType('paint')) || [];
    const resources = (performance.getEntriesByType && performance.getEntriesByType('resource')) || [];
    
    const memory = performance.memory ? {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
    } : {};

    return {
      navigation,
      paint: paint.reduce((acc, entry) => {
        acc[entry.name] = entry.startTime;
        return acc;
      }, {}),
      resources: resources.slice(0, 10), // Limit to avoid large payloads
      memory,
      timestamp: Date.now()
    };
  }

  /**
   * Send message to extension
   * @param {Object} message - Message to send
   * @returns {Promise} - Response promise
   */
  async sendMessage(message) {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
    }
    
    throw new Error('Chrome runtime not available');
  }

  /**
   * Validate message structure
   * @param {*} message - Message to validate
   * @returns {boolean} - True if valid
   */
  isValidMessage(message) {
    return message !== null &&
           message !== undefined &&
           typeof message === 'object' && 
           typeof message.type === 'string' && 
           message.type.length > 0;
  }

  /**
   * Sanitize message data
   * @param {Object} message - Message to sanitize
   * @returns {Object} - Sanitized message
   */
  sanitizeMessage(message) {
    const sanitized = { ...message };
    
    if (sanitized.data) {
      sanitized.data = this.sanitizeObject(sanitized.data);
    }
    
    return sanitized;
  }

  /**
   * Sanitize object by removing dangerous content
   * @param {Object} obj - Object to sanitize
   * @returns {Object} - Sanitized object
   * @private
   */
  sanitizeObject(obj) {
    if (typeof obj === 'string') {
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/javascript:/gi, '');
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      Object.keys(obj).forEach(key => {
        sanitized[key] = this.sanitizeObject(obj[key]);
      });
      return sanitized;
    }
    
    return obj;
  }

  /**
   * Check if initialized
   * @returns {boolean} - True if initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Destroy content script and cleanup resources
   */
  destroy() {
    if (!this.initialized) {
      return;
    }

    // Remove all highlights
    this.highlightOverlays.forEach((overlay, selector) => {
      this.removeHighlight(selector);
    });

    // Remove event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];

    // Disconnect observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];

    // Disconnect performance observer
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }

    // Remove message handler
    if (typeof chrome !== 'undefined' && chrome.runtime && this.messageHandler) {
      chrome.runtime.onMessage.removeListener(this.messageHandler);
      this.messageHandler = null;
    }

    // Clear callbacks
    this.navigationCallbacks = [];
    this.domChangeCallbacks = [];
    this.errorCallbacks = [];
    this.resourceLoadCallbacks = [];
    this.scrollCallbacks = [];

    this.initialized = false;
  }
}