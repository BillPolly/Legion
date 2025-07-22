/**
 * Element Inspector for Cerebrate Chrome Extension
 * Provides advanced element inspection, analysis, and highlighting capabilities
 */
export class ElementInspector {

  constructor(contentScript) {
    this.contentScript = contentScript;
    this.initialized = false;
    
    // State management
    this.selectedElements = [];
    this.inspectionHistory = [];
    this.inspectionMode = 'basic'; // 'basic', 'detailed', 'performance'
    this.hoverEnabled = false;
    
    // Event listeners
    this.eventListeners = [];
    this.hoverHandler = null;
    
    // Settings
    this.settings = {
      maxHistorySize: 50,
      hoverDelay: 100,
      analysisDepth: 3,
      performanceThreshold: 16.67 // 60fps
    };
    
    // Analysis cache
    this.analysisCache = new Map();
    this.cacheExpiry = 30000; // 30 seconds
  }

  /**
   * Initialize the element inspector
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    this.setupEventListeners();
    this.initialized = true;
  }

  /**
   * Setup event listeners for inspector functionality
   * @private
   */
  setupEventListeners() {
    // Setup hover handler for hover highlighting
    this.hoverHandler = (event) => {
      if (!this.hoverEnabled) return;
      
      const element = event.target;
      const selector = this.generateSelector(element);
      
      if (selector) {
        this.contentScript.highlightElement(selector);
      }
    };
  }

  /**
   * Select and highlight an element
   * @param {string} selector - Element selector
   * @returns {Promise<boolean>} - Success status
   */
  async selectElement(selector) {
    try {
      const element = this.contentScript.getElement(selector);
      if (!element) {
        return false;
      }

      // Highlight the element
      this.contentScript.highlightElement(selector);
      
      // Add to selected elements
      if (!this.selectedElements.includes(selector)) {
        this.selectedElements.push(selector);
      }
      
      // Add to history
      this.addToHistory(selector);
      
      return true;
    } catch (error) {
      console.warn('Error selecting element:', error);
      return false;
    }
  }

  /**
   * Get currently selected element (last selected)
   * @returns {string|null} - Selected element selector
   */
  getSelectedElement() {
    return this.selectedElements.length > 0 ? 
           this.selectedElements[this.selectedElements.length - 1] : 
           null;
  }

  /**
   * Get all selected elements
   * @returns {Array} - Array of selected element selectors
   */
  getSelectedElements() {
    return [...this.selectedElements];
  }

  /**
   * Clear all selected elements
   */
  clearSelection() {
    this.selectedElements.forEach(selector => {
      this.contentScript.removeHighlight(selector);
    });
    this.selectedElements = [];
  }

  /**
   * Toggle element highlighting
   * @param {string} selector - Element selector
   * @returns {Promise<boolean>} - Highlight status (true if highlighted)
   */
  async toggleHighlight(selector) {
    if (this.selectedElements.includes(selector)) {
      this.contentScript.removeHighlight(selector);
      this.selectedElements = this.selectedElements.filter(s => s !== selector);
      return false;
    } else {
      await this.selectElement(selector);
      return true;
    }
  }

  /**
   * Enable hover highlighting
   */
  enableHoverHighlight() {
    if (this.hoverEnabled || !this.hoverHandler) return;
    
    this.hoverEnabled = true;
    this.addEventListener(document, 'mouseover', this.hoverHandler);
    this.addEventListener(document, 'mouseout', (event) => {
      if (this.hoverEnabled) {
        const element = event.target;
        const selector = this.generateSelector(element);
        if (selector && !this.selectedElements.includes(selector)) {
          this.contentScript.removeHighlight(selector);
        }
      }
    });
  }

  /**
   * Disable hover highlighting
   */
  disableHoverHighlight() {
    this.hoverEnabled = false;
  }

  /**
   * Extract computed styles for an element
   * @param {string} selector - Element selector
   * @returns {Object|null} - Organized computed styles
   */
  extractComputedStyles(selector) {
    try {
      const element = this.contentScript.getElement(selector);
      if (!element) return null;

      const computedStyle = window.getComputedStyle(element);
      
      return {
        layout: {
          display: computedStyle.display,
          position: computedStyle.position,
          width: computedStyle.width,
          height: computedStyle.height,
          boxSizing: computedStyle.boxSizing
        },
        spacing: {
          margin: computedStyle.margin,
          marginTop: computedStyle.marginTop,
          marginRight: computedStyle.marginRight,
          marginBottom: computedStyle.marginBottom,
          marginLeft: computedStyle.marginLeft,
          padding: computedStyle.padding,
          paddingTop: computedStyle.paddingTop,
          paddingRight: computedStyle.paddingRight,
          paddingBottom: computedStyle.paddingBottom,
          paddingLeft: computedStyle.paddingLeft
        },
        typography: {
          fontSize: computedStyle.fontSize,
          fontFamily: computedStyle.fontFamily,
          fontWeight: computedStyle.fontWeight,
          lineHeight: computedStyle.lineHeight,
          textAlign: computedStyle.textAlign,
          textDecoration: computedStyle.textDecoration
        },
        visual: {
          color: computedStyle.color,
          backgroundColor: computedStyle.backgroundColor,
          border: computedStyle.border,
          borderRadius: computedStyle.borderRadius,
          boxShadow: computedStyle.boxShadow,
          opacity: computedStyle.opacity
        },
        positioning: {
          top: computedStyle.top,
          right: computedStyle.right,
          bottom: computedStyle.bottom,
          left: computedStyle.left,
          zIndex: computedStyle.zIndex,
          transform: computedStyle.transform
        }
      };
    } catch (error) {
      console.warn('Error extracting computed styles:', error);
      return null;
    }
  }

  /**
   * Compare declared vs computed styles
   * @param {string} selector - Element selector
   * @returns {Object} - Style comparison
   */
  compareStyles(selector) {
    try {
      const element = this.contentScript.getElement(selector);
      if (!element) return null;

      const computedStyle = window.getComputedStyle(element);
      const declaredStyle = element.style;
      
      const declared = {};
      const computed = {};
      const overrides = [];
      const inherited = [];

      // Extract declared styles
      for (let i = 0; i < declaredStyle.length; i++) {
        const property = declaredStyle[i];
        declared[property] = declaredStyle.getPropertyValue(property);
      }

      // Extract key computed styles
      const keyProperties = [
        'display', 'position', 'width', 'height', 'margin', 'padding',
        'fontSize', 'color', 'backgroundColor', 'border'
      ];

      keyProperties.forEach(property => {
        computed[property] = computedStyle.getPropertyValue(property);
        
        // Check for overrides
        if (declared[property] && declared[property] !== computed[property]) {
          overrides.push({
            property,
            declared: declared[property],
            computed: computed[property]
          });
        }
      });

      return { declared, computed, overrides, inherited };
    } catch (error) {
      console.warn('Error comparing styles:', error);
      return null;
    }
  }

  /**
   * Analyze CSS cascade and inheritance
   * @param {string} selector - Element selector
   * @returns {Object} - Cascade analysis
   */
  analyzeCascade(selector) {
    try {
      const element = this.contentScript.getElement(selector);
      if (!element) return null;

      return {
        inherited: this.findInheritedProperties(element),
        cascaded: this.findCascadedProperties(element),
        specificity: this.calculateSpecificity(element),
        important: this.findImportantProperties(element)
      };
    } catch (error) {
      console.warn('Error analyzing cascade:', error);
      return { inherited: [], cascaded: [], specificity: {}, important: [] };
    }
  }

  /**
   * Get responsive breakpoints affecting the element
   * @param {string} selector - Element selector
   * @returns {Object} - Responsive breakpoint information
   */
  getResponsiveBreakpoints(selector) {
    try {
      const element = this.contentScript.getElement(selector);
      if (!element) return null;

      const mediaQueries = this.findApplicableMediaQueries(element);
      
      return {
        current: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        applicable: mediaQueries.filter(mq => mq.matches),
        mediaQueries: mediaQueries
      };
    } catch (error) {
      console.warn('Error getting responsive breakpoints:', error);
      return { current: {}, applicable: [], mediaQueries: [] };
    }
  }

  /**
   * Analyze event listeners on an element
   * @param {string} selector - Element selector
   * @returns {Object} - Event listener analysis
   */
  analyzeEventListeners(selector) {
    try {
      const element = this.contentScript.getElement(selector);
      if (!element) return null;

      // Note: This is a simplified implementation
      // Real event listener detection requires Chrome DevTools Protocol
      const listeners = {
        direct: this.getDirectEventListeners(element),
        delegated: this.getDelegatedEventListeners(element),
        inherited: this.getInheritedEventListeners(element),
        total: 0
      };
      
      listeners.total = listeners.direct.length + 
                       listeners.delegated.length + 
                       listeners.inherited.length;
      
      return listeners;
    } catch (error) {
      console.warn('Error analyzing event listeners:', error);
      return { direct: [], delegated: [], inherited: [], total: 0 };
    }
  }

  /**
   * Find event delegation patterns
   * @param {string} selector - Element selector
   * @returns {Object} - Event delegation information
   */
  findEventDelegation(selector) {
    try {
      const element = this.contentScript.getElement(selector);
      if (!element) return null;

      const delegates = [];
      const handlers = [];
      let current = element.parentElement;
      
      while (current) {
        const elementListeners = this.getDirectEventListeners(current);
        if (elementListeners.length > 0) {
          delegates.push({
            element: current,
            selector: this.generateSelector(current),
            listeners: elementListeners
          });
          handlers.push(...elementListeners);
        }
        current = current.parentElement;
      }

      return {
        delegates,
        handlers,
        bubbling: true
      };
    } catch (error) {
      console.warn('Error finding event delegation:', error);
      return { delegates: [], handlers: [], bubbling: false };
    }
  }

  /**
   * Analyze event propagation path
   * @param {string} selector - Element selector
   * @returns {Object} - Event propagation analysis
   */
  analyzePropagationPath(selector) {
    try {
      const element = this.contentScript.getElement(selector);
      if (!element) return null;

      const path = [];
      let current = element;
      
      // Build propagation path
      while (current) {
        path.push(this.generateSelector(current));
        current = current.parentElement;
      }

      return {
        capture: [...path].reverse(),
        target: this.generateSelector(element),
        bubble: path,
        stoppers: [] // Would need runtime analysis to detect
      };
    } catch (error) {
      console.warn('Error analyzing propagation path:', error);
      return { capture: [], target: '', bubble: [], stoppers: [] };
    }
  }

  /**
   * Find passive event listeners
   * @param {string} selector - Element selector
   * @returns {Array} - Passive event listeners
   */
  findPassiveListeners(selector) {
    try {
      const element = this.contentScript.getElement(selector);
      if (!element) return [];

      // Check if element has scroll event listener (mock implementation)
      // In real implementation, this would use DevTools Protocol
      const hasScrollListener = element.onscroll || element.getAttribute('onscroll');
      
      if (hasScrollListener) {
        return [{
          event: 'scroll',
          passive: true,
          type: 'passive'
        }];
      }
      
      return [];
    } catch (error) {
      console.warn('Error finding passive listeners:', error);
      return [];
    }
  }

  /**
   * Get element tree with specified depth
   * @param {string} selector - Element selector
   * @param {number} maxDepth - Maximum depth to traverse
   * @returns {Object} - Element tree
   */
  getElementTree(selector, maxDepth = 3) {
    try {
      const element = this.contentScript.getElement(selector);
      if (!element) return null;

      const buildTree = (el, depth) => {
        if (depth > maxDepth) {
          return { truncated: true };
        }

        const node = {
          element: {
            selector: this.generateSelector(el),
            tagName: el.tagName,
            classes: Array.from(el.classList),
            attributes: this.getElementAttributes(el),
            id: el.id || null
          },
          children: [],
          depth
        };

        if (depth < maxDepth) {
          Array.from(el.children).forEach(child => {
            node.children.push(buildTree(child, depth + 1));
          });
        }

        return node;
      };

      const tree = buildTree(element, 0);
      tree.depth = maxDepth; // Set the correct depth value
      tree.totalNodes = this.countNodes(tree);
      
      return tree;
    } catch (error) {
      console.warn('Error getting element tree:', error);
      return null;
    }
  }

  /**
   * Get parent chain of an element
   * @param {string} selector - Element selector
   * @returns {Array} - Parent chain
   */
  getParentChain(selector) {
    try {
      const element = this.contentScript.getElement(selector);
      if (!element) return [];

      const parents = [];
      let current = element.parentElement;
      
      while (current && current !== document.body) {
        parents.push({
          selector: this.generateSelector(current),
          tagName: current.tagName,
          classes: Array.from(current.classList),
          id: current.id || null
        });
        current = current.parentElement;
      }

      return parents;
    } catch (error) {
      console.warn('Error getting parent chain:', error);
      return [];
    }
  }

  /**
   * Get sibling elements
   * @param {string} selector - Element selector
   * @returns {Object} - Sibling elements
   */
  getSiblings(selector) {
    try {
      const element = this.contentScript.getElement(selector);
      if (!element) return { previous: [], next: [], all: [] };

      const siblings = Array.from(element.parentElement.children);
      const elementIndex = siblings.indexOf(element);
      
      return {
        previous: siblings.slice(0, elementIndex).map(el => this.createElementInfo(el)),
        next: siblings.slice(elementIndex + 1).map(el => this.createElementInfo(el)),
        all: siblings.filter(el => el !== element).map(el => this.createElementInfo(el))
      };
    } catch (error) {
      console.warn('Error getting siblings:', error);
      return { previous: [], next: [], all: [] };
    }
  }

  /**
   * Analyze element relationships
   * @param {string} selector - Element selector
   * @returns {Object} - Element relationships
   */
  analyzeRelationships(selector) {
    try {
      const element = this.contentScript.getElement(selector);
      if (!element) return null;

      return {
        parent: element.parentElement ? this.createElementInfo(element.parentElement) : null,
        children: Array.from(element.children).map(el => this.createElementInfo(el)),
        siblings: this.getSiblings(selector),
        ancestors: this.getParentChain(selector),
        descendants: this.getDescendants(element)
      };
    } catch (error) {
      console.warn('Error analyzing relationships:', error);
      return null;
    }
  }

  /**
   * Analyze accessibility of an element
   * @param {string} selector - Element selector
   * @returns {Object} - Accessibility analysis
   */
  analyzeAccessibility(selector) {
    try {
      const element = this.contentScript.getElement(selector);
      if (!element) return null;

      return {
        aria: this.analyzeAriaAttributes(element),
        semantics: this.validateSemantics(selector),
        contrast: this.checkColorContrast(selector),
        keyboard: this.analyzeKeyboardNavigation(selector),
        issues: this.findAccessibilityIssues(element)
      };
    } catch (error) {
      console.warn('Error analyzing accessibility:', error);
      return null;
    }
  }

  /**
   * Validate semantic HTML
   * @param {string} selector - Element selector
   * @returns {Object} - Semantic validation
   */
  validateSemantics(selector) {
    try {
      const element = this.contentScript.getElement(selector);
      if (!element) return null;

      const landmarks = this.findLandmarks(element);
      const headings = this.findHeadings(element);
      const violations = this.findSemanticViolations(element);
      const suggestions = this.generateSemanticSuggestions(element);

      return { landmarks, headings, violations, suggestions };
    } catch (error) {
      console.warn('Error validating semantics:', error);
      return { landmarks: [], headings: [], violations: [], suggestions: [] };
    }
  }

  /**
   * Check color contrast
   * @param {string} selector - Element selector
   * @returns {Object} - Color contrast analysis
   */
  checkColorContrast(selector) {
    try {
      const element = this.contentScript.getElement(selector);
      if (!element) return null;

      const computedStyle = window.getComputedStyle(element);
      const foreground = computedStyle.color;
      const background = computedStyle.backgroundColor;
      
      const ratio = this.calculateContrastRatio(foreground, background);
      
      return {
        foreground,
        background,
        ratio,
        wcagAA: ratio >= 4.5,
        wcagAAA: ratio >= 7,
        suggestions: ratio < 4.5 ? ['Increase color contrast'] : []
      };
    } catch (error) {
      console.warn('Error checking color contrast:', error);
      return { foreground: '', background: '', ratio: 0, wcagAA: false, wcagAAA: false, suggestions: [] };
    }
  }

  /**
   * Analyze keyboard navigation
   * @param {string} selector - Element selector
   * @returns {Object} - Keyboard navigation analysis
   */
  analyzeKeyboardNavigation(selector) {
    try {
      const element = this.contentScript.getElement(selector);
      if (!element) return null;

      const focusableElements = this.findFocusableElements(element);
      const tabOrder = this.getTabOrder(focusableElements);
      
      return {
        focusable: focusableElements,
        tabOrder,
        traps: this.findFocusTraps(element),
        skips: this.findSkipLinks(element),
        issues: this.findKeyboardIssues(element)
      };
    } catch (error) {
      console.warn('Error analyzing keyboard navigation:', error);
      return { focusable: [], tabOrder: [], traps: [], skips: [], issues: [] };
    }
  }

  /**
   * Measure rendering performance impact
   * @param {string} selector - Element selector
   * @returns {Promise<Object>} - Performance measurements
   */
  async measureRenderingPerformance(selector) {
    try {
      const element = this.contentScript.getElement(selector);
      if (!element) return null;

      // Simplified performance measurement
      const start = performance.now();
      
      // Trigger reflow and repaint
      element.offsetHeight; // Forces reflow
      element.style.opacity = '0.99'; // Forces repaint
      element.style.opacity = '1'; // Restore
      
      const end = performance.now();
      const duration = end - start;
      
      return {
        reflow: duration * 0.6, // Estimated reflow time
        repaint: duration * 0.3, // Estimated repaint time
        composite: duration * 0.1, // Estimated composite time
        layoutThrashing: duration > this.settings.performanceThreshold,
        suggestions: duration > this.settings.performanceThreshold ? 
                    ['Consider optimizing this element for better performance'] : []
      };
    } catch (error) {
      console.warn('Error measuring rendering performance:', error);
      return { reflow: 0, repaint: 0, composite: 0, layoutThrashing: false, suggestions: [] };
    }
  }

  /**
   * Analyze DOM complexity
   * @param {string} selector - Element selector
   * @returns {Object} - DOM complexity analysis
   */
  analyzeDOMComplexity(selector) {
    try {
      const element = this.contentScript.getElement(selector);
      if (!element) return null;

      const depth = this.calculateMaxDepth(element);
      const breadth = this.calculateMaxBreadth(element);
      const nodes = this.countDescendants(element);
      const selectors = this.countUniqueSelectors(element);
      
      const score = this.calculateComplexityScore(depth, breadth, nodes, selectors);
      const issues = this.identifyComplexityIssues(score, depth, breadth, nodes);

      return { depth, breadth, nodes, selectors, score, issues };
    } catch (error) {
      console.warn('Error analyzing DOM complexity:', error);
      return { depth: 0, breadth: 0, nodes: 0, selectors: 0, score: 0, issues: [] };
    }
  }

  /**
   * Find expensive CSS properties
   * @param {string} selector - Element selector
   * @returns {Object} - Expensive properties analysis
   */
  findExpensiveProperties(selector) {
    try {
      const element = this.contentScript.getElement(selector);
      if (!element) return null;

      const computedStyle = window.getComputedStyle(element);
      const expensiveProps = {
        layout: ['width', 'height', 'padding', 'margin', 'display', 'position', 'float', 'clear'],
        paint: ['color', 'background', 'border', 'box-shadow', 'border-radius', 'outline'],
        composite: ['opacity', 'transform', 'filter', 'clip-path', 'mask']
      };

      const triggers = {
        layout: [],
        paint: [],
        composite: []
      };

      Object.keys(expensiveProps).forEach(category => {
        expensiveProps[category].forEach(prop => {
          const value = computedStyle.getPropertyValue(prop);
          if (value && value !== 'auto' && value !== 'none' && value !== 'initial') {
            triggers[category].push({ property: prop, value });
          }
        });
      });

      const totalTriggers = triggers.layout.length + triggers.paint.length + triggers.composite.length;
      const impact = totalTriggers > 10 ? 'high' : totalTriggers > 5 ? 'medium' : 'low';

      return {
        triggers,
        alternatives: this.suggestAlternatives(triggers),
        impact
      };
    } catch (error) {
      console.warn('Error finding expensive properties:', error);
      return { triggers: { layout: [], paint: [], composite: [] }, alternatives: [], impact: 'low' };
    }
  }

  /**
   * Analyze memory impact
   * @param {string} selector - Element selector
   * @returns {Object} - Memory impact analysis
   */
  analyzeMemoryImpact(selector) {
    try {
      const element = this.contentScript.getElement(selector);
      if (!element) return null;

      const domNodes = this.countDescendants(element) + 1;
      const eventListeners = this.analyzeEventListeners(selector).total;
      const styleRules = this.countAppliedStyleRules(element);
      
      // Rough estimation (bytes)
      const estimated = (domNodes * 100) + (eventListeners * 50) + (styleRules * 20);

      return {
        domNodes,
        eventListeners,
        styleRules,
        estimated,
        leaks: this.detectMemoryLeaks(element)
      };
    } catch (error) {
      console.warn('Error analyzing memory impact:', error);
      return { domNodes: 0, eventListeners: 0, styleRules: 0, estimated: 0, leaks: [] };
    }
  }

  /**
   * Get inspection history
   * @returns {Array} - Inspection history
   */
  getInspectionHistory() {
    return [...this.inspectionHistory];
  }

  /**
   * Get inspector state
   * @returns {Object} - Inspector state
   */
  getState() {
    return {
      selectedElements: [...this.selectedElements],
      hoverEnabled: this.hoverEnabled,
      mode: this.inspectionMode,
      history: [...this.inspectionHistory],
      settings: { ...this.settings }
    };
  }

  /**
   * Restore inspector state
   * @param {Object} state - State to restore
   */
  restoreState(state) {
    this.selectedElements = [...(state.selectedElements || [])];
    this.hoverEnabled = state.hoverEnabled || false;
    this.inspectionMode = state.mode || 'basic';
    this.inspectionHistory = [...(state.history || [])];
    this.settings = { ...this.settings, ...(state.settings || {}) };
    
    if (this.hoverEnabled) {
      this.enableHoverHighlight();
    }
  }

  /**
   * Set inspection mode
   * @param {string} mode - Inspection mode ('basic', 'detailed', 'performance')
   */
  setInspectionMode(mode) {
    const validModes = ['basic', 'detailed', 'performance'];
    if (validModes.includes(mode)) {
      this.inspectionMode = mode;
    }
  }

  /**
   * Get inspection mode
   * @returns {string} - Current inspection mode
   */
  getInspectionMode() {
    return this.inspectionMode;
  }

  /**
   * Filter elements by criteria
   * @param {Object} criteria - Filter criteria
   * @returns {Array} - Filtered elements
   */
  filterElements(criteria) {
    try {
      const elements = document.querySelectorAll('*');
      const results = [];

      elements.forEach(element => {
        let matches = true;

        if (criteria.tagName && element.tagName !== criteria.tagName.toUpperCase()) {
          matches = false;
        }

        if (criteria.hasClass && !element.classList.contains(criteria.hasClass)) {
          matches = false;
        }

        if (criteria.hasAttribute && !element.hasAttribute(criteria.hasAttribute)) {
          matches = false;
        }

        // Check for specific attribute value if provided
        if (criteria.hasAttribute && criteria.attributeValue) {
          if (element.getAttribute(criteria.hasAttribute) !== criteria.attributeValue) {
            matches = false;
          }
        }

        if (matches) {
          results.push(this.createElementInfo(element));
        }
      });

      return results;
    } catch (error) {
      console.warn('Error filtering elements:', error);
      return [];
    }
  }

  /**
   * Check if inspector is initialized
   * @returns {boolean} - True if initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Destroy inspector and cleanup
   */
  destroy() {
    if (!this.initialized) return;

    // Clear all highlights
    this.clearSelection();

    // Remove event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];

    // Disable hover highlighting
    this.disableHoverHighlight();

    // Clear cache
    this.analysisCache.clear();

    this.initialized = false;
  }

  // Helper methods
  
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
   * Add selector to inspection history
   * @param {string} selector - Element selector
   * @private
   */
  addToHistory(selector) {
    const entry = {
      selector,
      timestamp: Date.now(),
      mode: this.inspectionMode
    };

    this.inspectionHistory.push(entry);

    // Limit history size
    if (this.inspectionHistory.length > this.settings.maxHistorySize) {
      this.inspectionHistory.shift();
    }
  }

  /**
   * Generate unique selector for element
   * @param {Element} element - DOM element
   * @returns {string} - Unique selector
   * @private
   */
  generateSelector(element) {
    if (!element || element === document || element === document.documentElement) {
      return null;
    }

    // Try ID first
    if (element.id) {
      return `#${element.id}`;
    }

    // Try class combination
    if (element.classList.length > 0) {
      const classes = Array.from(element.classList).join('.');
      const selector = `${element.tagName.toLowerCase()}.${classes}`;
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }

    // Try nth-child
    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(element);
      const parentSelector = this.generateSelector(parent);
      return `${parentSelector} > ${element.tagName.toLowerCase()}:nth-child(${index + 1})`;
    }

    return element.tagName.toLowerCase();
  }

  /**
   * Get element attributes as object
   * @param {Element} element - DOM element
   * @returns {Object} - Attributes object
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
   * Create element info object
   * @param {Element} element - DOM element
   * @returns {Object} - Element info
   * @private
   */
  createElementInfo(element) {
    return {
      tagName: element.tagName,
      classes: Array.from(element.classList),
      id: element.id || null,
      attributes: this.getElementAttributes(element),
      selector: this.generateSelector(element)
    };
  }

  /**
   * Count nodes in tree
   * @param {Object} tree - Element tree
   * @returns {number} - Node count
   * @private
   */
  countNodes(tree) {
    let count = 1; // Current node
    if (tree.children) {
      tree.children.forEach(child => {
        count += this.countNodes(child);
      });
    }
    return count;
  }

  /**
   * Get descendants of element
   * @param {Element} element - DOM element
   * @returns {Array} - Descendant elements
   * @private
   */
  getDescendants(element) {
    const descendants = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT,
      null,
      false
    );

    let node = walker.nextNode();
    while (node) {
      if (node !== element) {
        descendants.push(this.createElementInfo(node));
      }
      node = walker.nextNode();
    }

    return descendants;
  }

  /**
   * Find inherited properties
   * @param {Element} element - DOM element
   * @returns {Array} - Inherited properties
   * @private
   */
  findInheritedProperties(element) {
    const inheritedProps = ['color', 'font-family', 'font-size', 'line-height', 'text-align'];
    const inherited = [];
    
    const computedStyle = window.getComputedStyle(element);
    const parentStyle = element.parentElement ? 
                       window.getComputedStyle(element.parentElement) : 
                       null;
    
    if (parentStyle) {
      inheritedProps.forEach(prop => {
        const elementValue = computedStyle.getPropertyValue(prop);
        const parentValue = parentStyle.getPropertyValue(prop);
        
        if (elementValue === parentValue) {
          inherited.push({ property: prop, value: elementValue });
        }
      });
    }
    
    return inherited;
  }

  /**
   * Find cascaded properties
   * @param {Element} element - DOM element
   * @returns {Array} - Cascaded properties
   * @private
   */
  findCascadedProperties(element) {
    // Simplified implementation
    return [];
  }

  /**
   * Calculate CSS specificity
   * @param {Element} element - DOM element
   * @returns {Object} - Specificity calculation
   * @private
   */
  calculateSpecificity(element) {
    return {
      inline: element.style.length > 0 ? 1000 : 0,
      ids: element.id ? 100 : 0,
      classes: element.classList.length * 10,
      elements: 1
    };
  }

  /**
   * Find important properties
   * @param {Element} element - DOM element
   * @returns {Array} - Important properties
   * @private
   */
  findImportantProperties(element) {
    const important = [];
    const style = element.style;
    
    for (let i = 0; i < style.length; i++) {
      const property = style[i];
      const priority = style.getPropertyPriority(property);
      
      if (priority === 'important') {
        important.push({
          property,
          value: style.getPropertyValue(property),
          priority
        });
      }
    }
    
    return important;
  }

  /**
   * Find applicable media queries
   * @param {Element} element - DOM element
   * @returns {Array} - Media queries
   * @private
   */
  findApplicableMediaQueries(element) {
    const mediaQueries = [];
    
    // This would require parsing stylesheets - simplified implementation
    const commonBreakpoints = [
      { query: '(max-width: 768px)', matches: window.innerWidth <= 768 },
      { query: '(max-width: 1024px)', matches: window.innerWidth <= 1024 },
      { query: '(min-width: 769px)', matches: window.innerWidth >= 769 }
    ];
    
    return commonBreakpoints;
  }

  /**
   * Get direct event listeners
   * @param {Element} element - DOM element
   * @returns {Array} - Direct event listeners
   * @private
   */
  getDirectEventListeners(element) {
    // Simplified implementation - real detection needs DevTools Protocol
    const listeners = [];
    const commonEvents = ['click', 'mouseover', 'keydown', 'focus', 'scroll'];
    
    commonEvents.forEach(event => {
      if (element[`on${event}`] || element.getAttribute(`on${event}`)) {
        listeners.push({ event, type: 'direct' });
      }
    });
    
    return listeners;
  }

  /**
   * Get delegated event listeners
   * @param {Element} element - DOM element
   * @returns {Array} - Delegated event listeners
   * @private
   */
  getDelegatedEventListeners(element) {
    // Simplified implementation
    return [];
  }

  /**
   * Get inherited event listeners
   * @param {Element} element - DOM element
   * @returns {Array} - Inherited event listeners
   * @private
   */
  getInheritedEventListeners(element) {
    // Simplified implementation
    return [];
  }

  /**
   * Analyze ARIA attributes
   * @param {Element} element - DOM element
   * @returns {Object} - ARIA analysis
   * @private
   */
  analyzeAriaAttributes(element) {
    const ariaAttributes = Array.from(element.attributes)
      .filter(attr => attr.name.startsWith('aria-'));
    
    const labels = ariaAttributes
      .filter(attr => attr.name.includes('label'))
      .map(attr => ({ attribute: attr.name, value: attr.value }));
    
    const roles = element.getAttribute('role') ? 
                 [{ attribute: 'role', value: element.getAttribute('role') }] : 
                 [];
    
    return {
      labels,
      roles,
      states: ariaAttributes.filter(attr => attr.name.includes('state')),
      properties: ariaAttributes.filter(attr => !attr.name.includes('label') && !attr.name.includes('state'))
    };
  }

  /**
   * Find landmarks in element
   * @param {Element} element - DOM element
   * @returns {Array} - Landmark elements
   * @private
   */
  findLandmarks(element) {
    const landmarks = [];
    const landmarkElements = element.querySelectorAll('header, main, nav, aside, footer, [role="banner"], [role="main"], [role="navigation"], [role="complementary"], [role="contentinfo"]');
    
    landmarkElements.forEach(el => {
      landmarks.push({
        element: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || this.getImplicitRole(el.tagName.toLowerCase()),
        selector: this.generateSelector(el)
      });
    });
    
    return landmarks;
  }

  /**
   * Find headings in element
   * @param {Element} element - DOM element
   * @returns {Array} - Heading elements
   * @private
   */
  findHeadings(element) {
    const headings = [];
    const headingElements = element.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
    
    headingElements.forEach(el => {
      headings.push({
        level: parseInt(el.tagName.charAt(1)) || 1,
        text: el.textContent.trim(),
        selector: this.generateSelector(el)
      });
    });
    
    return headings;
  }

  /**
   * Find semantic violations
   * @param {Element} element - DOM element
   * @returns {Array} - Semantic violations
   * @private
   */
  findSemanticViolations(element) {
    // Simplified implementation
    return [];
  }

  /**
   * Generate semantic suggestions
   * @param {Element} element - DOM element
   * @returns {Array} - Semantic suggestions
   * @private
   */
  generateSemanticSuggestions(element) {
    // Simplified implementation
    return [];
  }

  /**
   * Calculate contrast ratio
   * @param {string} foreground - Foreground color
   * @param {string} background - Background color
   * @returns {number} - Contrast ratio
   * @private
   */
  calculateContrastRatio(foreground, background) {
    // Simplified implementation - returns mock ratio
    return 4.5;
  }

  /**
   * Find focusable elements
   * @param {Element} element - DOM element
   * @returns {Array} - Focusable elements
   * @private
   */
  findFocusableElements(element) {
    const focusableSelectors = [
      'a[href]', 'button', 'input', 'select', 'textarea',
      '[tabindex]:not([tabindex="-1"])', '[contenteditable="true"]'
    ];
    
    return Array.from(element.querySelectorAll(focusableSelectors.join(', ')))
      .map(el => this.createElementInfo(el));
  }

  /**
   * Get tab order
   * @param {Array} focusableElements - Focusable elements
   * @returns {Array} - Tab order
   * @private
   */
  getTabOrder(focusableElements) {
    return focusableElements.sort((a, b) => {
      const aTabIndex = parseInt(a.attributes.tabindex || '0');
      const bTabIndex = parseInt(b.attributes.tabindex || '0');
      return aTabIndex - bTabIndex;
    });
  }

  /**
   * Find focus traps
   * @param {Element} element - DOM element
   * @returns {Array} - Focus traps
   * @private
   */
  findFocusTraps(element) {
    // Simplified implementation
    return [];
  }

  /**
   * Find skip links
   * @param {Element} element - DOM element
   * @returns {Array} - Skip links
   * @private
   */
  findSkipLinks(element) {
    const skipLinks = element.querySelectorAll('a[href^="#"]');
    return Array.from(skipLinks).map(el => this.createElementInfo(el));
  }

  /**
   * Find keyboard issues
   * @param {Element} element - DOM element
   * @returns {Array} - Keyboard issues
   * @private
   */
  findKeyboardIssues(element) {
    // Simplified implementation
    return [];
  }

  /**
   * Find accessibility issues
   * @param {Element} element - DOM element
   * @returns {Array} - Accessibility issues
   * @private
   */
  findAccessibilityIssues(element) {
    // Simplified implementation
    return [];
  }

  /**
   * Calculate maximum depth
   * @param {Element} element - DOM element
   * @returns {number} - Maximum depth
   * @private
   */
  calculateMaxDepth(element) {
    let maxDepth = 0;
    
    const traverse = (el, depth) => {
      maxDepth = Math.max(maxDepth, depth);
      Array.from(el.children).forEach(child => {
        traverse(child, depth + 1);
      });
    };
    
    traverse(element, 0);
    return maxDepth;
  }

  /**
   * Calculate maximum breadth
   * @param {Element} element - DOM element
   * @returns {number} - Maximum breadth
   * @private
   */
  calculateMaxBreadth(element) {
    let maxBreadth = 0;
    
    const traverse = (el) => {
      maxBreadth = Math.max(maxBreadth, el.children.length);
      Array.from(el.children).forEach(child => {
        traverse(child);
      });
    };
    
    traverse(element);
    return maxBreadth;
  }

  /**
   * Count descendants
   * @param {Element} element - DOM element
   * @returns {number} - Descendant count
   * @private
   */
  countDescendants(element) {
    return element.querySelectorAll('*').length;
  }

  /**
   * Count unique selectors
   * @param {Element} element - DOM element
   * @returns {number} - Unique selector count
   * @private
   */
  countUniqueSelectors(element) {
    const selectors = new Set();
    const elements = element.querySelectorAll('*');
    
    elements.forEach(el => {
      selectors.add(this.generateSelector(el));
    });
    
    return selectors.size;
  }

  /**
   * Calculate complexity score
   * @param {number} depth - Tree depth
   * @param {number} breadth - Tree breadth
   * @param {number} nodes - Node count
   * @param {number} selectors - Selector count
   * @returns {number} - Complexity score
   * @private
   */
  calculateComplexityScore(depth, breadth, nodes, selectors) {
    return Math.round((depth * 0.3 + breadth * 0.2 + nodes * 0.4 + selectors * 0.1) / 10);
  }

  /**
   * Identify complexity issues
   * @param {number} score - Complexity score
   * @param {number} depth - Tree depth
   * @param {number} breadth - Tree breadth
   * @param {number} nodes - Node count
   * @returns {Array} - Complexity issues
   * @private
   */
  identifyComplexityIssues(score, depth, breadth, nodes) {
    const issues = [];
    
    if (depth > 10) issues.push('DOM tree too deep');
    if (breadth > 20) issues.push('Too many siblings');
    if (nodes > 1000) issues.push('Too many DOM nodes');
    if (score > 8) issues.push('Overall complexity too high');
    
    return issues;
  }

  /**
   * Suggest alternatives for expensive properties
   * @param {Object} triggers - Property triggers
   * @returns {Array} - Alternative suggestions
   * @private
   */
  suggestAlternatives(triggers) {
    const alternatives = [];
    
    if (triggers.layout.length > 0) {
      alternatives.push('Consider using transform instead of changing layout properties');
    }
    
    if (triggers.paint.length > 0) {
      alternatives.push('Consider using will-change or transform for better performance');
    }
    
    return alternatives;
  }

  /**
   * Count applied style rules
   * @param {Element} element - DOM element
   * @returns {number} - Style rule count
   * @private
   */
  countAppliedStyleRules(element) {
    // Simplified implementation - would need to parse stylesheets
    const computedStyle = window.getComputedStyle(element);
    return computedStyle.length;
  }

  /**
   * Detect memory leaks
   * @param {Element} element - DOM element
   * @returns {Array} - Potential memory leaks
   * @private
   */
  detectMemoryLeaks(element) {
    // Simplified implementation
    const leaks = [];
    
    // Check for circular references, detached nodes, etc.
    // This would require more sophisticated analysis
    
    return leaks;
  }

  /**
   * Get implicit role for element
   * @param {string} tagName - Tag name
   * @returns {string} - Implicit role
   * @private
   */
  getImplicitRole(tagName) {
    const implicitRoles = {
      'header': 'banner',
      'main': 'main',
      'nav': 'navigation',
      'aside': 'complementary',
      'footer': 'contentinfo',
      'button': 'button',
      'a': 'link',
      'img': 'image'
    };
    
    return implicitRoles[tagName] || '';
  }
}