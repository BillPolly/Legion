/**
 * DOM Analysis Commands for Cerebrate Chrome Extension
 * Provides comprehensive DOM inspection, accessibility analysis, and performance assessment
 */
export class DOMAnalysisCommands {

  constructor(contentScript) {
    this.contentScript = contentScript;
    this.initialized = false;
    
    // Command registry
    this.commands = new Map();
    this.registerCommands();
    
    // Analysis settings
    this.settings = {
      maxDepth: 10,
      maxNodes: 1000,
      maxAnalysisTime: 5000, // 5 seconds
      enablePerformanceAnalysis: true,
      enableAccessibilityAnalysis: true
    };
    
    // Performance thresholds
    this.performanceThresholds = {
      domSize: { high: 1500, medium: 800 },
      depth: { high: 12, medium: 8 },
      renderingCost: { high: 16.67, medium: 8.33 }, // ms per frame
      layoutComplexity: { high: 100, medium: 50 }
    };
    
    // Accessibility rules
    this.accessibilityRules = {
      wcagAA: {
        colorContrast: 4.5,
        largeTextContrast: 3.0
      },
      wcagAAA: {
        colorContrast: 7.0,
        largeTextContrast: 4.5
      }
    };
  }

  /**
   * Register all DOM analysis commands
   * @private
   */
  registerCommands() {
    this.commands.set('inspect_element', {
      handler: this.inspectElement.bind(this),
      description: 'Inspect a specific DOM element with comprehensive analysis',
      parameters: [
        { name: 'selector', type: 'string', required: true },
        { name: 'includeAccessibility', type: 'boolean', default: true },
        { name: 'includePerformance', type: 'boolean', default: true },
        { name: 'includeSEO', type: 'boolean', default: true }
      ],
      examples: [
        { selector: '#main-content' },
        { selector: '.navbar', includeAccessibility: true }
      ]
    });

    this.commands.set('analyze_dom_tree', {
      handler: this.analyzeDOMTree.bind(this),
      description: 'Analyze DOM tree structure with detailed statistics',
      parameters: [
        { name: 'selector', type: 'string', required: true },
        { name: 'maxDepth', type: 'number', default: 10 },
        { name: 'includeTextNodes', type: 'boolean', default: true },
        { name: 'filterBy', type: 'string', enum: ['all', 'semantic', 'interactive'] },
        { name: 'analyzeIssues', type: 'boolean', default: true }
      ],
      examples: [
        { selector: 'body', maxDepth: 5 },
        { selector: '.content', filterBy: 'semantic' }
      ]
    });

    this.commands.set('analyze_accessibility', {
      handler: this.analyzeAccessibility.bind(this),
      description: 'Perform comprehensive accessibility analysis',
      parameters: [
        { name: 'selector', type: 'string', required: true },
        { name: 'level', type: 'string', enum: ['A', 'AA', 'AAA'], default: 'AA' },
        { name: 'includeContrast', type: 'boolean', default: true },
        { name: 'includeKeyboard', type: 'boolean', default: true },
        { name: 'includeSemantics', type: 'boolean', default: true }
      ],
      examples: [
        { selector: 'form', level: 'AA' },
        { selector: '.navigation', includeContrast: true }
      ]
    });

    this.commands.set('assess_performance', {
      handler: this.assessPerformanceImpact.bind(this),
      description: 'Assess performance impact of DOM elements',
      parameters: [
        { name: 'selector', type: 'string', required: true },
        { name: 'includeRecommendations', type: 'boolean', default: true },
        { name: 'analyzeLayout', type: 'boolean', default: true },
        { name: 'analyzePaint', type: 'boolean', default: true }
      ],
      examples: [
        { selector: '.gallery', includeRecommendations: true },
        { selector: '#app', analyzeLayout: true }
      ]
    });
  }

  /**
   * Execute a DOM analysis command
   * @param {string} commandName - Command to execute
   * @param {Object} parameters - Command parameters
   * @returns {Promise<Object>} - Command result
   */
  async executeCommand(commandName, parameters = {}) {
    if (!this.commands.has(commandName)) {
      return {
        success: false,
        error: `Unknown command: ${commandName}`
      };
    }

    const command = this.commands.get(commandName);
    
    // Validate parameters
    const validation = this.validateParameters(command.parameters, parameters);
    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid parameters: ${validation.error}`
      };
    }

    try {
      const result = await command.handler(parameters.selector, parameters);
      return result;
    } catch (error) {
      return {
        success: false,
        error: `Command execution failed: ${error.message}`
      };
    }
  }

  /**
   * Inspect a specific DOM element
   * @param {string} selector - Element selector
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Element analysis result
   */
  async inspectElement(selector, options = {}) {
    try {
      const element = this.contentScript.getElement(selector);
      if (!element) {
        return {
          success: false,
          error: 'Element not found',
          selector
        };
      }

      const analysis = {
        selector,
        tagName: element.tagName,
        id: element.id || null,
        className: element.className || null,
        attributes: this.getElementAttributes(element),
        textContent: element.textContent?.substring(0, 200) || '',
        innerHTML: element.innerHTML?.substring(0, 500) || '',
        computedStyles: await this.getComputedStylesSafely(element),
        boundingRect: this.getElementBoundingRect(element)
      };

      // Add accessibility analysis
      if (options.includeAccessibility !== false) {
        analysis.accessibility = await this.analyzeElementAccessibility(element);
      }

      // Add SEO analysis  
      if (options.includeSEO !== false) {
        analysis.seo = await this.analyzeElementSEO(element);
      }

      // Add performance analysis
      if (options.includePerformance !== false) {
        analysis.performance = await this.analyzeElementPerformance(element);
      }

      return {
        success: true,
        element: analysis
      };

    } catch (error) {
      return {
        success: false,
        error: `DOM access error: ${error.message}`
      };
    }
  }

  /**
   * Analyze DOM tree structure
   * @param {string} selector - Root element selector
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Tree analysis result
   */
  async analyzeDOMTree(selector, options = {}) {
    try {
      // Validate selector
      if (!this.isValidSelector(selector)) {
        return {
          success: false,
          error: 'Invalid selector or element not found',
          selector
        };
      }

      const rootElement = this.contentScript.getElement(selector);
      if (!rootElement) {
        return {
          success: false,
          error: 'Invalid selector or element not found',
          selector
        };
      }

      const maxDepth = Math.min(options.maxDepth || this.settings.maxDepth, 20);
      const maxNodes = options.maxNodes || this.settings.maxNodes;
      
      let nodeCount = 0;
      const startTime = Date.now();

      const buildTree = (element, currentDepth = 0) => {
        nodeCount++;
        
        // Check constraints
        if (nodeCount > maxNodes) {
          throw new Error('Analysis stopped due to constraints');
        }
        
        if (Date.now() - startTime > this.settings.maxAnalysisTime) {
          throw new Error('Analysis stopped due to constraints: timeout');
        }

        const node = {
          element: {
            tagName: element.tagName,
            id: element.id || null,
            className: element.className || null,
            attributes: this.getElementAttributes(element),
            textContent: element.textContent?.substring(0, 100) || ''
          },
          children: [],
          depth: currentDepth
        };

        if (currentDepth < maxDepth) {
          const children = this.getFilteredChildren(element, options);
          
          for (const child of children) {
            if (child.nodeType === Node.ELEMENT_NODE) {
              node.children.push(buildTree(child, currentDepth + 1));
            } else if (options.includeTextNodes !== false && child.nodeType === Node.TEXT_NODE) {
              const text = child.textContent.trim();
              if (text) {
                node.children.push({
                  element: {
                    nodeType: 'TEXT',
                    textContent: text.substring(0, 100)
                  },
                  children: [],
                  depth: currentDepth + 1
                });
              }
            }
          }
        }

        return node;
      };

      const tree = buildTree(rootElement);
      const statistics = this.calculateTreeStatistics(rootElement, maxDepth);

      const result = {
        success: true,
        tree: {
          ...tree,
          depth: maxDepth,
          totalNodes: nodeCount,
          statistics
        }
      };

      // Add issue analysis
      if (options.analyzeIssues) {
        result.tree.issues = await this.analyzeTreeIssues(rootElement);
      }

      return result;

    } catch (error) {
      return {
        success: false,
        error: error.message,
        selector
      };
    }
  }

  /**
   * Analyze accessibility of DOM elements
   * @param {string} selector - Root element selector
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Accessibility analysis result
   */
  async analyzeAccessibility(selector, options = {}) {
    try {
      const rootElement = this.contentScript.getElement(selector);
      if (!rootElement) {
        return {
          success: false,
          error: 'Element not found',
          selector
        };
      }

      const violations = [];
      const passes = [];
      const incomplete = [];

      // Analyze ARIA usage
      const ariaIssues = await this.analyzeARIA(rootElement);
      violations.push(...ariaIssues.violations);
      passes.push(...ariaIssues.passes);

      // Analyze semantic structure
      const semantics = await this.analyzeSemantics(rootElement);
      
      // Analyze color contrast
      let contrast = [];
      if (options.includeContrast !== false) {
        contrast = await this.analyzeColorContrast(rootElement);
      }

      // Analyze keyboard navigation
      let keyboard = {};
      if (options.includeKeyboard !== false) {
        keyboard = await this.analyzeKeyboardNavigation(rootElement);
      }

      // Calculate accessibility score
      const score = this.calculateAccessibilityScore(violations, passes, incomplete);
      const level = this.determineWCAGLevel(score, violations);

      return {
        success: true,
        accessibility: {
          score,
          level,
          violations,
          passes,
          incomplete,
          summary: {
            totalElements: this.countElements(rootElement),
            violationCount: violations.length,
            passCount: passes.length,
            incompleteCount: incomplete.length
          },
          semantics: options.includeSemantics !== false ? semantics : undefined,
          contrast: options.includeContrast !== false ? contrast : undefined,
          keyboard: options.includeKeyboard !== false ? keyboard : undefined
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Accessibility analysis failed: ${error.message}`
      };
    }
  }

  /**
   * Assess performance impact of DOM elements
   * @param {string} selector - Element selector
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Performance analysis result
   */
  async assessPerformanceImpact(selector, options = {}) {
    try {
      const element = this.contentScript.getElement(selector);
      if (!element) {
        return {
          success: false,
          error: 'Element not found',
          selector
        };
      }

      const performance = {
        renderingCost: this.calculateRenderingCost(element),
        layoutComplexity: this.calculateLayoutComplexity(element),
        paintComplexity: this.calculatePaintComplexity(element),
        compositeComplexity: this.calculateCompositeComplexity(element),
        memoryFootprint: this.calculateMemoryFootprint(element)
      };

      // Analyze expensive properties
      performance.expensiveProperties = await this.findExpensiveProperties(element);

      // Analyze DOM size impact
      performance.domSize = this.analyzeDOMSizeImpact(element);

      // Analyze layout thrashing potential
      if (options.analyzeLayout !== false) {
        performance.layoutThrashing = await this.analyzeLayoutThrashing(element);
      }

      // Generate recommendations
      if (options.includeRecommendations !== false) {
        performance.recommendations = this.generatePerformanceRecommendations(performance, element);
      }

      return {
        success: true,
        performance
      };

    } catch (error) {
      return {
        success: false,
        error: `Performance analysis failed: ${error.message}`
      };
    }
  }

  /**
   * Get element attributes safely
   * @private
   */
  getElementAttributes(element) {
    const attributes = {};
    try {
      for (const attr of element.attributes) {
        attributes[attr.name] = attr.value;
      }
    } catch (error) {
      // Handle potential security restrictions
    }
    return attributes;
  }

  /**
   * Get computed styles safely
   * @private
   */
  async getComputedStylesSafely(element) {
    try {
      return this.contentScript.getComputedStyles ? 
        this.contentScript.getComputedStyles(element) || null : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get element bounding rectangle
   * @private
   */
  getElementBoundingRect(element) {
    try {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Analyze element accessibility
   * @private
   */
  async analyzeElementAccessibility(element) {
    const accessibility = {
      hasAriaLabel: element.hasAttribute('aria-label'),
      hasAriaDescribedBy: element.hasAttribute('aria-describedby'),
      describedBy: element.hasAttribute('aria-describedby') ? 
        element.getAttribute('aria-describedby').split(' ') : [],
      role: element.getAttribute('role'),
      focusable: this.isFocusable(element),
      tabIndex: element.tabIndex,
      semanticRole: this.getSemanticRole(element),
      accessibleName: this.getAccessibleName(element),
      issues: [],
      wcagLevel: 'AA'
    };

    // Check for common accessibility issues
    if (!accessibility.hasAriaLabel && !accessibility.accessibleName && this.requiresAccessibleName(element)) {
      accessibility.issues.push('Missing accessible name');
    }

    if (element.tagName === 'IMG' && !element.getAttribute('alt')) {
      accessibility.issues.push('Image missing alt text');
    }

    return accessibility;
  }

  /**
   * Analyze element SEO
   * @private
   */
  async analyzeElementSEO(element) {
    const seo = {
      headingLevel: this.getHeadingLevel(element),
      headingHierarchy: true,
      hasProperNesting: true,
      textLength: element.textContent.length,
      keywordDensity: {},
      issues: [],
      suggestions: []
    };

    // Analyze heading hierarchy
    if (seo.headingLevel > 0) {
      seo.headingHierarchy = this.checkHeadingHierarchy(element);
      if (!seo.headingHierarchy) {
        seo.issues.push('Improper heading hierarchy');
      }
    }

    // Analyze text length
    if (seo.headingLevel > 0 && seo.textLength === 0) {
      seo.issues.push('Empty heading');
    }

    if (seo.textLength > 60 && seo.headingLevel === 1) {
      seo.suggestions.push('H1 text should be under 60 characters for better SEO');
    }

    return seo;
  }

  /**
   * Analyze element performance
   * @private
   */
  async analyzeElementPerformance(element) {
    const performance = {
      renderingImpact: 'low',
      layoutThrashing: false,
      expensiveProperties: [],
      optimizations: [],
      memoryFootprint: this.calculateMemoryFootprint(element),
      recommendations: []
    };

    // Check for expensive properties
    const computedStyle = this.contentScript.getComputedStyles(element);
    if (computedStyle) {
      if (computedStyle.transform && computedStyle.transform !== 'none') {
        performance.expensiveProperties.push('transform');
      }
      
      if (computedStyle.filter && computedStyle.filter !== 'none') {
        performance.expensiveProperties.push('filter');
        performance.renderingImpact = 'medium';
      }
    }

    // Generate recommendations
    if (element.children.length > 100) {
      performance.recommendations.push('Consider virtualization for large lists');
    }

    if (element.tagName === 'IMG' && !element.getAttribute('loading')) {
      performance.recommendations.push('Add lazy loading for images');
    }

    return performance;
  }

  /**
   * Get filtered children based on options
   * @private
   */
  getFilteredChildren(element, options) {
    const children = Array.from(element.childNodes);
    
    if (options.filterBy === 'semantic') {
      return children.filter(child => 
        child.nodeType === Node.ELEMENT_NODE && 
        this.isSemanticElement(child)
      );
    }
    
    if (options.filterBy === 'interactive') {
      return children.filter(child => 
        child.nodeType === Node.ELEMENT_NODE && 
        this.isInteractiveElement(child)
      );
    }
    
    return children;
  }

  /**
   * Calculate tree statistics
   * @private
   */
  calculateTreeStatistics(rootElement, maxDepth) {
    let elementCount = 0;
    let textNodeCount = 0;
    let commentCount = 0;
    let actualMaxDepth = 0;
    let totalDepth = 0;

    const traverse = (element, depth = 0) => {
      actualMaxDepth = Math.max(actualMaxDepth, depth);
      totalDepth += depth;
      
      if (element.nodeType === Node.ELEMENT_NODE) {
        elementCount++;
      } else if (element.nodeType === Node.TEXT_NODE) {
        textNodeCount++;
      } else if (element.nodeType === Node.COMMENT_NODE) {
        commentCount++;
      }

      if (depth < maxDepth) {
        for (const child of element.childNodes) {
          traverse(child, depth + 1);
        }
      }
    };

    traverse(rootElement);

    const totalNodes = elementCount + textNodeCount + commentCount;
    const averageDepth = totalNodes > 0 ? totalDepth / totalNodes : 0;
    const complexity = this.calculateComplexityScore(elementCount, actualMaxDepth, averageDepth);

    return {
      elementCount,
      textNodeCount,
      commentCount,
      maxDepth: actualMaxDepth,
      averageDepth: Math.round(averageDepth * 100) / 100,
      complexity: Math.round(complexity * 100) / 100
    };
  }

  /**
   * Analyze tree issues
   * @private
   */
  async analyzeTreeIssues(rootElement) {
    const issues = [];

    // Check for missing alt text on images
    const images = rootElement.querySelectorAll('img');
    images.forEach((img, index) => {
      if (!img.getAttribute('alt')) {
        issues.push({
          type: 'accessibility',
          severity: 'warning',
          element: `img:nth-child(${index + 1})`,
          message: 'Image missing alt text'
        });
      }
    });

    // Check for missing labels on form inputs
    const inputs = rootElement.querySelectorAll('input, textarea, select');
    inputs.forEach((input, index) => {
      const id = input.id;
      if (id) {
        const label = rootElement.querySelector(`label[for="${id}"]`);
        if (!label && !input.getAttribute('aria-label')) {
          issues.push({
            type: 'accessibility',
            severity: 'error',
            element: `${input.tagName.toLowerCase()}#${id}`,
            message: 'Form input missing associated label'
          });
        }
      }
    });

    // Check for heading hierarchy
    const headings = rootElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let previousLevel = 0;
    headings.forEach(heading => {
      const level = parseInt(heading.tagName.charAt(1));
      if (level > previousLevel + 1) {
        issues.push({
          type: 'seo',
          severity: 'warning',
          element: heading.tagName.toLowerCase(),
          message: `Heading level skipped (h${previousLevel} to h${level})`
        });
      }
      previousLevel = level;
    });

    return issues;
  }

  /**
   * Analyze ARIA usage
   * @private
   */
  async analyzeARIA(rootElement) {
    const violations = [];
    const passes = [];

    // Check for proper ARIA label usage
    const elementsWithAriaLabel = rootElement.querySelectorAll('[aria-label]');
    elementsWithAriaLabel.forEach(element => {
      const ariaLabel = element.getAttribute('aria-label');
      if (ariaLabel && ariaLabel.trim()) {
        passes.push({
          rule: 'aria-label-present',
          element: this.getElementSelector(element),
          message: 'Element has proper aria-label'
        });
      } else {
        violations.push({
          rule: 'aria-label-empty',
          severity: 'error',
          element: this.getElementSelector(element),
          message: 'aria-label is empty',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/aria-label'
        });
      }
    });

    // Check for aria-describedby references
    const elementsWithDescribedBy = rootElement.querySelectorAll('[aria-describedby]');
    elementsWithDescribedBy.forEach(element => {
      const describedBy = element.getAttribute('aria-describedby');
      const ids = describedBy.split(/\s+/);
      const invalidIds = ids.filter(id => !document.getElementById(id));
      
      if (invalidIds.length > 0) {
        violations.push({
          rule: 'aria-describedby-invalid',
          severity: 'error',
          element: this.getElementSelector(element),
          message: `aria-describedby references non-existent IDs: ${invalidIds.join(', ')}`,
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/aria-describedby'
        });
      }
    });

    // Check for missing alt text on images
    const images = rootElement.querySelectorAll('img');
    images.forEach(img => {
      if (!img.getAttribute('alt')) {
        violations.push({
          rule: 'image-alt',
          severity: 'error',
          element: this.getElementSelector(img),
          message: 'Image missing alt attribute',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/image-alt'
        });
      }
    });

    // Check for form labels
    const inputs = rootElement.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      if (input.type !== 'hidden' && input.type !== 'button' && input.type !== 'submit') {
        const hasLabel = input.labels && input.labels.length > 0;
        const hasAriaLabel = input.hasAttribute('aria-label');
        const hasAriaLabelledBy = input.hasAttribute('aria-labelledby');
        
        if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy) {
          violations.push({
            rule: 'label-missing',
            severity: 'error',
            element: this.getElementSelector(input),
            message: 'Form input missing associated label',
            helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/label'
          });
        }
      }
    });

    return { violations, passes };
  }

  /**
   * Analyze semantic structure
   * @private
   */
  async analyzeSemantics(rootElement) {
    const landmarks = [];
    const headings = [];
    const navigation = [];
    const forms = [];

    // Find landmarks - process each selector separately to avoid parsing issues
    const landmarkSelectors = ['header', 'main', 'nav', 'aside', 'footer'];
    landmarkSelectors.forEach(selectorName => {
      const elements = rootElement.querySelectorAll(selectorName);
      elements.forEach(element => {
        landmarks.push({
          role: this.getLandmarkRole(element),
          element: element.tagName.toLowerCase(),
          selector: this.getElementSelector(element)
        });
      });
    });

    // Find headings
    const headingElements = rootElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headingElements.forEach(heading => {
      headings.push({
        level: parseInt(heading.tagName.charAt(1)),
        text: heading.textContent.trim().substring(0, 50),
        element: this.getElementSelector(heading)
      });
    });

    // Find navigation elements
    const navElements = rootElement.querySelectorAll('nav, [role="navigation"]');
    navElements.forEach(nav => {
      navigation.push({
        element: this.getElementSelector(nav),
        links: nav.querySelectorAll('a').length
      });
    });

    // Find forms
    const formElements = rootElement.querySelectorAll('form');
    formElements.forEach(form => {
      forms.push({
        element: this.getElementSelector(form),
        inputs: form.querySelectorAll('input, textarea, select').length
      });
    });

    return { landmarks, headings, navigation, forms };
  }

  /**
   * Analyze color contrast
   * @private
   */
  async analyzeColorContrast(rootElement) {
    const contrast = [];
    const textElements = rootElement.querySelectorAll('*');
    
    Array.from(textElements).forEach(element => {
      const text = element.textContent ? element.textContent.trim() : '';
      if (text && element.children.length === 0) { // Only leaf text nodes
        try {
          const styles = this.contentScript.getComputedStyles(element);
          if (styles) {
            const ratio = this.calculateContrastRatio(styles.color, styles.backgroundColor);
            const selector = this.getElementSelector(element);
            
            // Only add if we have a valid selector
            if (selector && selector !== 'unknown' && selector !== '#') {
              contrast.push({
                element: selector,
                foreground: styles.color,
                background: styles.backgroundColor,
                ratio: Math.round(ratio * 100) / 100,
                wcagAA: ratio >= this.accessibilityRules.wcagAA.colorContrast,
                wcagAAA: ratio >= this.accessibilityRules.wcagAAA.colorContrast
              });
            }
          }
        } catch (error) {
          // Skip elements that can't be analyzed
        }
      }
    });
    
    return contrast.slice(0, 20); // Limit results
  }

  /**
   * Analyze keyboard navigation
   * @private
   */
  async analyzeKeyboardNavigation(rootElement) {
    const focusableElements = [];
    const tabOrder = [];
    const tabTraps = [];
    const skipLinks = [];
    const issues = [];

    // Find focusable elements
    const focusableSelectors = [
      'a[href]', 'button', 'input', 'textarea', 'select',
      '[tabindex]:not([tabindex="-1"])', '[contenteditable="true"]'
    ];
    
    focusableSelectors.forEach(selector => {
      const elements = rootElement.querySelectorAll(selector);
      elements.forEach(element => {
        if (!element.disabled && !element.hidden) {
          focusableElements.push({
            element: this.getElementSelector(element),
            tabIndex: element.tabIndex,
            visible: this.isVisible(element)
          });
        }
      });
    });

    // Build tab order
    const sortedElements = focusableElements
      .filter(item => item.visible)
      .sort((a, b) => {
        if (a.tabIndex === b.tabIndex) return 0;
        if (a.tabIndex === 0) return 1;
        if (b.tabIndex === 0) return -1;
        return a.tabIndex - b.tabIndex;
      });

    sortedElements.forEach((item, index) => {
      tabOrder.push({
        order: index + 1,
        element: item.element,
        tabIndex: item.tabIndex
      });
    });

    // Check for skip links
    const links = rootElement.querySelectorAll('a[href^="#"]');
    links.forEach(link => {
      const href = link.getAttribute('href');
      // Validate href is not just '#' and is a valid selector
      if (href && href.length > 1 && this.isValidSelector(href)) {
        try {
          const target = rootElement.querySelector(href);
          if (target && link.textContent.toLowerCase().includes('skip')) {
            skipLinks.push({
              element: this.getElementSelector(link),
              target: href
            });
          }
        } catch (error) {
          // Skip invalid selectors
        }
      }
    });

    return {
      focusableElements: focusableElements.length,
      tabOrder,
      tabTraps, // Would need more complex analysis
      skipLinks,
      issues
    };
  }

  /**
   * Calculate accessibility score
   * @private
   */
  calculateAccessibilityScore(violations, passes, incomplete) {
    const totalTests = violations.length + passes.length + incomplete.length;
    if (totalTests === 0) return 100;
    
    const errorWeight = 10;
    const warningWeight = 5;
    const incompleteWeight = 2;
    
    let penalty = 0;
    violations.forEach(violation => {
      penalty += violation.severity === 'error' ? errorWeight : warningWeight;
    });
    penalty += incomplete.length * incompleteWeight;
    
    const maxPossiblePenalty = totalTests * errorWeight;
    const score = Math.max(0, 100 - (penalty / maxPossiblePenalty) * 100);
    
    return Math.round(score);
  }

  /**
   * Determine WCAG level
   * @private
   */
  determineWCAGLevel(score, violations) {
    const criticalViolations = violations.filter(v => v.severity === 'error');
    
    if (criticalViolations.length > 0) return 'fail';
    if (score >= 90) return 'AAA';
    if (score >= 70) return 'AA';
    return 'fail';
  }

  /**
   * Calculate rendering cost
   * @private
   */
  calculateRenderingCost(element) {
    const rect = element.getBoundingClientRect();
    const area = rect.width * rect.height;
    const childCount = element.children.length;
    
    // Simple heuristic: larger areas and more children cost more
    const baseCost = Math.min(area / 10000, 10); // Cap at 10ms
    const childCost = childCount * 0.1;
    
    return Math.round((baseCost + childCost) * 100) / 100;
  }

  /**
   * Calculate layout complexity
   * @private
   */
  calculateLayoutComplexity(element) {
    try {
      const styles = this.contentScript.getComputedStyles(element);
      let complexity = 0;
      
      if (styles) {
        // CSS Grid and Flexbox add complexity
        if (styles.display === 'grid') complexity += 30;
        if (styles.display === 'flex') complexity += 20;
        
        // Positioning adds complexity
        if (styles.position === 'absolute' || styles.position === 'fixed') complexity += 15;
        
        // Transforms add complexity
        if (styles.transform !== 'none') complexity += 25;
        
        // Float adds complexity
        if (styles.float !== 'none') complexity += 10;
      }
      
      // Child count affects complexity
      complexity += element.children.length * 2;
      
      return Math.min(complexity, 100);
    } catch (error) {
      return 10; // Default complexity
    }
  }

  /**
   * Calculate paint complexity
   * @private
   */
  calculatePaintComplexity(element) {
    try {
      const styles = this.contentScript.getComputedStyles(element);
      let complexity = 0;
      
      if (styles) {
        // Gradients and shadows increase paint complexity
        if (styles.background && styles.background.includes('gradient')) complexity += 20;
        if (styles.boxShadow && styles.boxShadow !== 'none') complexity += 15;
        if (styles.textShadow && styles.textShadow !== 'none') complexity += 10;
        if (styles.borderRadius && styles.borderRadius !== '0px') complexity += 5;
        
        // Opacity and filters
        if (parseFloat(styles.opacity) < 1) complexity += 10;
        if (styles.filter && styles.filter !== 'none') complexity += 25;
      }
      
      return Math.min(complexity, 100);
    } catch (error) {
      return 5; // Default complexity
    }
  }

  /**
   * Calculate composite complexity
   * @private
   */
  calculateCompositeComplexity(element) {
    try {
      const styles = this.contentScript.getComputedStyles(element);
      let complexity = 0;
      
      if (styles) {
        // Properties that create new stacking contexts
        if (styles.transform !== 'none') complexity += 20;
        if (parseFloat(styles.opacity) < 1) complexity += 15;
        if (styles.filter && styles.filter !== 'none') complexity += 25;
        if (styles.isolation === 'isolate') complexity += 10;
        if (styles.mixBlendMode !== 'normal') complexity += 20;
      }
      
      return Math.min(complexity, 100);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate memory footprint
   * @private
   */
  calculateMemoryFootprint(element) {
    const nodeCount = element.querySelectorAll('*').length;
    const textLength = element.textContent.length;
    
    // Rough estimate: each element ~1KB, each character ~2 bytes
    const elementMemory = nodeCount * 1024;
    const textMemory = textLength * 2;
    
    return elementMemory + textMemory;
  }

  /**
   * Find expensive CSS properties
   * @private
   */
  async findExpensiveProperties(element) {
    const expensiveProperties = [];
    
    try {
      const styles = this.contentScript.getComputedStyles(element);
      if (!styles) return expensiveProperties;
      
      const expensiveChecks = [
        {
          property: 'filter',
          impact: 'paint',
          cost: styles.filter !== 'none' ? 25 : 0,
          alternative: 'Use CSS transforms or pre-processed images'
        },
        {
          property: 'box-shadow',
          impact: 'paint',
          cost: styles.boxShadow !== 'none' ? 15 : 0,
          alternative: 'Use border or outline for simple shadows'
        },
        {
          property: 'border-radius',
          impact: 'paint',
          cost: styles.borderRadius !== '0px' ? 5 : 0,
          alternative: 'Use square corners or pre-rendered images'
        },
        {
          property: 'transform',
          impact: 'composite',
          cost: styles.transform !== 'none' ? 20 : 0,
          alternative: 'Prefer translate3d() for hardware acceleration'
        }
      ];
      
      expensiveChecks.forEach(check => {
        if (check.cost > 0) {
          expensiveProperties.push({
            property: check.property,
            element: this.getElementSelector(element),
            impact: check.impact,
            cost: check.cost,
            alternative: check.alternative
          });
        }
      });
      
    } catch (error) {
      // Handle errors gracefully
    }
    
    return expensiveProperties;
  }

  /**
   * Analyze DOM size impact
   * @private
   */
  analyzeDOMSizeImpact(element) {
    const elementCount = element.querySelectorAll('*').length;
    const depth = this.calculateMaxDepth(element);
    const nodeSize = this.calculateMemoryFootprint(element);
    
    let impact = 'low';
    if (elementCount > this.performanceThresholds.domSize.high || 
        depth > this.performanceThresholds.depth.high) {
      impact = 'high';
    } else if (elementCount > this.performanceThresholds.domSize.medium || 
               depth > this.performanceThresholds.depth.medium) {
      impact = 'medium';
    }
    
    const optimizations = [];
    if (elementCount > 100) {
      optimizations.push('Consider virtualization for large lists');
    }
    if (depth > 10) {
      optimizations.push('Flatten DOM structure to reduce nesting');
    }
    
    return {
      elementCount,
      depth,
      nodeSize,
      impact,
      optimizations
    };
  }

  /**
   * Analyze layout thrashing potential
   * @private
   */
  async analyzeLayoutThrashing(element) {
    const causes = [];
    const recommendations = [];
    let risk = 'low';
    
    try {
      const styles = this.contentScript.getComputedStyles(element);
      if (!styles) return { risk, causes, recommendations };
      
      // Check for properties that cause layout
      const layoutProperties = ['width', 'height', 'margin', 'padding', 'border', 'font-size'];
      layoutProperties.forEach(prop => {
        if (styles[prop] && styles[prop].includes('%')) {
          causes.push(`Percentage-based ${prop} can cause layout recalculation`);
          risk = 'medium';
        }
      });
      
      // Check for float usage
      if (styles.float !== 'none') {
        causes.push('Float property causes complex layout calculations');
        risk = 'medium';
      }
      
      // Check for complex selectors (would need more analysis)
      const complexSelectors = element.querySelectorAll('*').length;
      if (complexSelectors > 500) {
        causes.push('Large number of descendant elements');
        risk = 'high';
      }
      
      if (causes.length > 0) {
        recommendations.push('Use CSS transforms instead of changing layout properties');
        recommendations.push('Batch DOM reads and writes');
        recommendations.push('Consider using will-change CSS property');
      }
      
    } catch (error) {
      // Handle errors gracefully
    }
    
    return { risk, causes, recommendations };
  }

  /**
   * Generate performance recommendations
   * @private
   */
  generatePerformanceRecommendations(performance, element) {
    const recommendations = [];
    
    if (performance.renderingCost > this.performanceThresholds.renderingCost.high) {
      recommendations.push({
        type: 'rendering',
        impact: 'high',
        suggestion: 'Reduce element complexity or use CSS contain property',
        element: this.getElementSelector(element)
      });
    }
    
    if (performance.layoutComplexity > this.performanceThresholds.layoutComplexity.high) {
      recommendations.push({
        type: 'layout',
        impact: 'high',
        suggestion: 'Simplify CSS layout or use CSS Grid/Flexbox more efficiently',
        element: this.getElementSelector(element)
      });
    }
    
    if (performance.expensiveProperties.length > 3) {
      recommendations.push({
        type: 'css',
        impact: 'medium',
        suggestion: 'Reduce expensive CSS properties like filters and complex shadows',
        element: this.getElementSelector(element)
      });
    }
    
    if (performance.domSize.elementCount > this.performanceThresholds.domSize.high) {
      recommendations.push({
        type: 'dom',
        impact: 'high',
        suggestion: 'Implement virtualization or pagination for large content',
        element: this.getElementSelector(element)
      });
    }
    
    return recommendations;
  }

  // Utility methods

  /**
   * Validate command parameters
   * @private
   */
  validateParameters(parameterDefs, parameters) {
    for (const param of parameterDefs) {
      if (param.required && !(param.name in parameters)) {
        return { valid: false, error: `${param.name} is required` };
      }
      
      if (param.name === 'selector' && parameters[param.name] === null) {
        return { valid: false, error: 'selector is required' };
      }
    }
    
    return { valid: true };
  }

  /**
   * Check if selector is valid
   * @private
   */
  isValidSelector(selector) {
    try {
      document.querySelector(selector);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if element is focusable
   * @private
   */
  isFocusable(element) {
    const focusableTags = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'];
    return focusableTags.includes(element.tagName) || 
           element.hasAttribute('tabindex') ||
           element.hasAttribute('contenteditable');
  }

  /**
   * Get semantic role of element
   * @private
   */
  getSemanticRole(element) {
    if (element.hasAttribute('role')) {
      return element.getAttribute('role');
    }
    
    const roleMap = {
      'BUTTON': 'button',
      'A': 'link',
      'INPUT': element.type === 'button' ? 'button' : 'textbox',
      'IMG': 'img',
      'H1': 'heading',
      'H2': 'heading',
      'H3': 'heading',
      'H4': 'heading',
      'H5': 'heading',
      'H6': 'heading'
    };
    
    return roleMap[element.tagName] || null;
  }

  /**
   * Get accessible name
   * @private
   */
  getAccessibleName(element) {
    // Check aria-label first
    if (element.hasAttribute('aria-label')) {
      return element.getAttribute('aria-label');
    }
    
    // Check associated label
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) {
        return label.textContent.trim();
      }
    }
    
    // Check text content
    return element.textContent.trim();
  }

  /**
   * Check if element requires accessible name
   * @private
   */
  requiresAccessibleName(element) {
    const requiresName = ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'];
    return requiresName.includes(element.tagName);
  }

  /**
   * Get heading level
   * @private
   */
  getHeadingLevel(element) {
    const match = element.tagName.match(/^H([1-6])$/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Check heading hierarchy
   * @private
   */
  checkHeadingHierarchy(element) {
    const currentLevel = this.getHeadingLevel(element);
    if (currentLevel === 0) return true;
    
    // Find previous heading
    let prev = element.previousElementSibling;
    while (prev) {
      const prevLevel = this.getHeadingLevel(prev);
      if (prevLevel > 0) {
        return currentLevel <= prevLevel + 1;
      }
      prev = prev.previousElementSibling;
    }
    
    return currentLevel === 1; // First heading should be h1
  }

  /**
   * Check if element is semantic
   * @private
   */
  isSemanticElement(element) {
    const semanticTags = [
      'HEADER', 'NAV', 'MAIN', 'ARTICLE', 'SECTION', 'ASIDE', 'FOOTER',
      'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'UL', 'OL', 'LI',
      'BLOCKQUOTE', 'FIGURE', 'FIGCAPTION', 'TIME', 'ADDRESS'
    ];
    return semanticTags.includes(element.tagName);
  }

  /**
   * Check if element is interactive
   * @private
   */
  isInteractiveElement(element) {
    const interactiveTags = [
      'A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'LABEL'
    ];
    return interactiveTags.includes(element.tagName) ||
           element.hasAttribute('onclick') ||
           element.hasAttribute('tabindex');
  }

  /**
   * Get landmark role
   * @private
   */
  getLandmarkRole(element) {
    if (element.hasAttribute('role')) {
      return element.getAttribute('role');
    }
    
    const landmarkMap = {
      'HEADER': 'banner',
      'NAV': 'navigation',
      'MAIN': 'main',
      'ASIDE': 'complementary',
      'FOOTER': 'contentinfo'
    };
    
    return landmarkMap[element.tagName] || null;
  }

  /**
   * Get element selector
   * @private
   */
  getElementSelector(element) {
    if (!element || !element.tagName) {
      return 'unknown';
    }
    
    // Check for valid ID - must exist, be a string, and have content when trimmed
    if (element.id && typeof element.id === 'string' && element.id.trim()) {
      const trimmedId = element.id.trim();
      // Ensure the ID is valid for CSS selector (not just whitespace or special chars)
      if (trimmedId && /^[a-zA-Z][\w-]*$/.test(trimmedId)) {
        return `#${trimmedId}`;
      }
    }
    
    // Check for valid class - must exist, be a string, and have content when trimmed
    if (element.className && typeof element.className === 'string' && element.className.trim()) {
      const classes = element.className.trim().split(/\s+/);
      const firstValidClass = classes.find(cls => cls && /^[a-zA-Z_][\w-]*$/.test(cls));
      if (firstValidClass) {
        return `.${firstValidClass}`;
      }
    }
    
    return element.tagName.toLowerCase();
  }

  /**
   * Check if element is visible
   * @private
   */
  isVisible(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * Calculate contrast ratio
   * @private
   */
  calculateContrastRatio(foreground, background) {
    // Simple implementation - would need more robust color parsing
    // This is a placeholder that returns reasonable values
    const fgLum = this.getLuminance(foreground);
    const bgLum = this.getLuminance(background);
    
    const lighter = Math.max(fgLum, bgLum);
    const darker = Math.min(fgLum, bgLum);
    
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Get luminance from color
   * @private
   */
  getLuminance(color) {
    // Placeholder implementation
    // Would need proper color parsing and luminance calculation
    if (color.includes('rgb(0, 0, 0)') || color === 'black') return 0;
    if (color.includes('rgb(255, 255, 255)') || color === 'white') return 1;
    return 0.5; // Default middle value
  }

  /**
   * Count elements
   * @private
   */
  countElements(rootElement) {
    return rootElement.querySelectorAll('*').length;
  }

  /**
   * Calculate complexity score
   * @private
   */
  calculateComplexityScore(elementCount, maxDepth, averageDepth) {
    const sizeScore = Math.min(elementCount / 100, 10);
    const depthScore = Math.min(maxDepth, 10);
    const avgDepthScore = Math.min(averageDepth * 2, 10);
    
    return sizeScore + depthScore + avgDepthScore;
  }

  /**
   * Calculate max depth
   * @private
   */
  calculateMaxDepth(element) {
    let maxDepth = 0;
    
    const traverse = (el, depth = 0) => {
      maxDepth = Math.max(maxDepth, depth);
      Array.from(el.children).forEach(child => traverse(child, depth + 1));
    };
    
    traverse(element);
    return maxDepth;
  }

  // Public API methods

  /**
   * Get registered commands
   */
  getRegisteredCommands() {
    return Array.from(this.commands.keys());
  }

  /**
   * Get command metadata
   */
  getCommandMetadata(commandName) {
    const command = this.commands.get(commandName);
    if (!command) return null;
    
    return {
      name: commandName,
      description: command.description,
      parameters: command.parameters,
      examples: command.examples
    };
  }

  /**
   * Check if command can be executed
   */
  canExecuteCommand(commandName) {
    return this.commands.has(commandName);
  }
}