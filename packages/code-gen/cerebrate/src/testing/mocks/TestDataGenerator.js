/**
 * Test Data Generator for Cerebrate Testing
 * Generates realistic test data for various scenarios
 */
export class TestDataGenerator {
  constructor(options = {}) {
    this.config = {
      seed: options.seed || Date.now(),
      complexity: options.complexity || 'medium',
      locale: options.locale || 'en-US',
      ...options
    };
    
    // Initialize random seed for consistent test data
    this.rng = this.createSeededRandom(this.config.seed);
    
    // HTML tag names for DOM elements
    this.htmlTags = [
      'div', 'span', 'p', 'h1', 'h2', 'h3', 'button', 'input', 'select', 
      'textarea', 'form', 'section', 'article', 'nav', 'header', 'footer',
      'aside', 'main', 'ul', 'ol', 'li', 'a', 'img', 'table', 'tr', 'td'
    ];
    
    // CSS class names
    this.cssClasses = [
      'container', 'wrapper', 'content', 'sidebar', 'header', 'footer',
      'navigation', 'menu', 'item', 'button', 'form-group', 'input-field',
      'card', 'panel', 'modal', 'dropdown', 'tooltip', 'badge', 'alert',
      'primary', 'secondary', 'success', 'warning', 'error', 'info'
    ];
    
    // Sample text content
    this.sampleTexts = [
      'Lorem ipsum dolor sit amet',
      'Welcome to our website',
      'Click here to continue',
      'Submit form',
      'Contact us',
      'About us',
      'Our services',
      'Get started',
      'Learn more',
      'Sign up today'
    ];
    
    // JavaScript code patterns
    this.jsPatterns = {
      simple: [
        'console.log("Hello, World!");',
        'var x = 10;',
        'function test() { return true; }',
        'document.getElementById("test");'
      ],
      medium: [
        'function calculateTotal(items) { return items.reduce((sum, item) => sum + item.price, 0); }',
        'const users = await fetch("/api/users").then(res => res.json());',
        'class Component { constructor(props) { this.props = props; } }',
        'const debounce = (fn, delay) => { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); }; };'
      ],
      complex: [
        'async function processData(data) { try { const results = await Promise.all(data.map(async item => { const processed = await transform(item); return validate(processed); })); return results.filter(Boolean); } catch (error) { console.error("Processing failed:", error); throw error; } }',
        'const createObserver = (callback, options = {}) => { const { threshold = 0.1, rootMargin = "0px" } = options; return new IntersectionObserver((entries) => { entries.forEach(entry => { if (entry.isIntersecting) { callback(entry.target); } }); }, { threshold, rootMargin }); };'
      ]
    };
  }
  
  /**
   * Create seeded random number generator
   * @param {number} seed - Random seed
   * @returns {Function} - Random function
   * @private
   */
  createSeededRandom(seed) {
    let state = seed;
    return () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
  }
  
  /**
   * Get random item from array
   * @param {Array} array - Array to choose from
   * @returns {*} - Random item
   * @private
   */
  randomChoice(array) {
    return array[Math.floor(this.rng() * array.length)];
  }
  
  /**
   * Generate random integer within range
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} - Random integer
   * @private
   */
  randomInt(min, max) {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }
  
  /**
   * Generate realistic DOM element
   * @param {Object} options - Generation options
   * @returns {Object} - DOM element data
   */
  generateDOMElement(options = {}) {
    const tagName = options.tagName || this.randomChoice(this.htmlTags);
    const id = options.id || `element-${this.randomInt(1000, 9999)}`;
    const className = options.className || this.randomChoice(this.cssClasses);
    
    const element = {
      tagName: tagName.toUpperCase(),
      id,
      className,
      attributes: this.generateAttributes(tagName),
      textContent: this.randomChoice(this.sampleTexts),
      styles: this.generateStyles(),
      position: {
        top: this.randomInt(0, 1000),
        left: this.randomInt(0, 1000),
        width: this.randomInt(100, 500),
        height: this.randomInt(50, 200)
      },
      accessibility: this.generateAccessibilityData(tagName)
    };
    
    return element;
  }
  
  /**
   * Generate element attributes
   * @param {string} tagName - HTML tag name
   * @returns {Object} - Attributes
   * @private
   */
  generateAttributes(tagName) {
    const baseAttributes = {
      'data-testid': `test-${this.randomInt(100, 999)}`,
      'data-component': this.randomChoice(['header', 'content', 'sidebar', 'footer'])
    };
    
    switch (tagName.toLowerCase()) {
      case 'button':
        return {
          ...baseAttributes,
          type: this.randomChoice(['button', 'submit', 'reset']),
          disabled: this.rng() < 0.2 // 20% chance of being disabled
        };
        
      case 'input':
        return {
          ...baseAttributes,
          type: this.randomChoice(['text', 'email', 'password', 'number', 'tel']),
          placeholder: 'Enter text here...',
          required: this.rng() < 0.5
        };
        
      case 'a':
        return {
          ...baseAttributes,
          href: `https://example.com/${this.randomChoice(['page1', 'page2', 'about', 'contact'])}`,
          target: this.rng() < 0.3 ? '_blank' : '_self'
        };
        
      case 'img':
        return {
          ...baseAttributes,
          src: `https://picsum.photos/${this.randomInt(200, 800)}/${this.randomInt(200, 600)}`,
          alt: this.rng() < 0.8 ? 'Sample image description' : '' // 20% chance of missing alt
        };
        
      default:
        return baseAttributes;
    }
  }
  
  /**
   * Generate CSS styles
   * @returns {Object} - CSS styles
   * @private
   */
  generateStyles() {
    const colors = ['#ffffff', '#f0f0f0', '#e0e0e0', '#333333', '#666666', '#999999'];
    const units = ['px', 'em', 'rem', '%'];
    
    return {
      backgroundColor: this.randomChoice(colors),
      color: this.randomChoice(['#000000', '#333333', '#666666', '#ffffff']),
      padding: `${this.randomInt(5, 20)}${this.randomChoice(units)}`,
      margin: `${this.randomInt(0, 15)}${this.randomChoice(units)}`,
      border: `${this.randomInt(0, 3)}px solid ${this.randomChoice(colors)}`,
      borderRadius: `${this.randomInt(0, 10)}px`,
      fontSize: `${this.randomInt(12, 24)}px`,
      fontWeight: this.randomChoice(['normal', 'bold', '400', '600', '700']),
      display: this.randomChoice(['block', 'inline', 'inline-block', 'flex', 'grid']),
      position: this.randomChoice(['static', 'relative', 'absolute'])
    };
  }
  
  /**
   * Generate accessibility data
   * @param {string} tagName - HTML tag name
   * @returns {Object} - Accessibility data
   * @private
   */
  generateAccessibilityData(tagName) {
    const roles = ['button', 'link', 'heading', 'navigation', 'main', 'complementary', 'banner'];
    
    return {
      role: this.randomChoice(roles),
      tabIndex: this.randomChoice([-1, 0, 1, 2]),
      ariaLabel: this.rng() < 0.7 ? this.randomChoice(this.sampleTexts) : null,
      ariaDescribedBy: this.rng() < 0.3 ? `desc-${this.randomInt(1, 100)}` : null,
      ariaHidden: this.rng() < 0.1 ? 'true' : null,
      hasAriaLabel: this.rng() < 0.7,
      focusable: this.rng() < 0.6
    };
  }
  
  /**
   * Generate JavaScript code samples
   * @param {number} count - Number of samples to generate
   * @returns {Array} - JavaScript samples
   */
  generateJavaScriptSamples(count = 3) {
    const samples = [];
    
    for (let i = 0; i < count; i++) {
      const complexity = this.randomChoice(['simple', 'medium', 'complex']);
      const code = this.randomChoice(this.jsPatterns[complexity]);
      
      samples.push({
        code,
        complexity,
        issues: this.generateCodeIssues(),
        suggestions: this.generateCodeSuggestions(),
        type: this.randomChoice(['function', 'variable', 'class', 'expression']),
        loc: code.split('\n').length,
        dependencies: this.generateDependencies()
      });
    }
    
    return samples;
  }
  
  /**
   * Generate code issues
   * @returns {Array} - Code issues
   * @private
   */
  generateCodeIssues() {
    const issues = [
      'Unused variable detected',
      'Consider using const instead of var',
      'Missing error handling',
      'Potential memory leak',
      'Deprecated API usage',
      'Performance bottleneck detected',
      'Missing type annotations',
      'Code duplication found'
    ];
    
    const count = this.randomInt(0, 3);
    return Array.from({ length: count }, () => this.randomChoice(issues));
  }
  
  /**
   * Generate code suggestions
   * @returns {Array} - Code suggestions
   * @private
   */
  generateCodeSuggestions() {
    const suggestions = [
      'Use arrow functions for cleaner syntax',
      'Consider using async/await instead of promises',
      'Extract common functionality into utility functions',
      'Add input validation',
      'Use destructuring assignment',
      'Consider memoization for expensive operations',
      'Add proper error boundaries',
      'Use more descriptive variable names'
    ];
    
    const count = this.randomInt(1, 4);
    return Array.from({ length: count }, () => this.randomChoice(suggestions));
  }
  
  /**
   * Generate dependencies
   * @returns {Array} - Dependencies
   * @private
   */
  generateDependencies() {
    const deps = ['lodash', 'moment', 'axios', 'react', 'vue', 'jquery', 'underscore', 'rxjs'];
    const count = this.randomInt(0, 3);
    return Array.from({ length: count }, () => this.randomChoice(deps));
  }
  
  /**
   * Generate accessibility test scenarios
   * @returns {Array} - Accessibility scenarios
   */
  generateAccessibilityScenarios() {
    return [
      {
        name: 'Missing Alt Text',
        html: '<img src="image.jpg" />',
        expectedIssues: ['missing-alt-text'],
        wcagLevel: 'A',
        severity: 'error'
      },
      {
        name: 'Low Color Contrast',
        html: '<div style="color: #ccc; background: #fff;">Low contrast text</div>',
        expectedIssues: ['color-contrast'],
        wcagLevel: 'AA',
        severity: 'warning'
      },
      {
        name: 'Missing Form Labels',
        html: '<input type="text" placeholder="Enter name" />',
        expectedIssues: ['missing-label'],
        wcagLevel: 'A',
        severity: 'error'
      },
      {
        name: 'Improper Heading Order',
        html: '<h1>Title</h1><h3>Subtitle</h3>',
        expectedIssues: ['heading-order'],
        wcagLevel: 'AA',
        severity: 'warning'
      },
      {
        name: 'Missing Button Text',
        html: '<button></button>',
        expectedIssues: ['empty-button'],
        wcagLevel: 'A',
        severity: 'error'
      }
    ];
  }
  
  /**
   * Generate performance test data
   * @returns {Object} - Performance data
   */
  generatePerformanceData() {
    const loadTime = this.randomInt(500, 3000);
    const domContentLoaded = Math.min(loadTime - this.randomInt(100, 500), loadTime);
    const firstPaint = Math.min(domContentLoaded - this.randomInt(50, 200), domContentLoaded);
    
    return {
      metrics: {
        loadTime,
        domContentLoaded,
        firstPaint,
        largestContentfulPaint: loadTime + this.randomInt(50, 300),
        firstInputDelay: this.randomInt(10, 100),
        cumulativeLayoutShift: parseFloat((this.rng() * 0.5).toFixed(3))
      },
      resources: this.generateResourceData(),
      bottlenecks: this.generateBottlenecks(),
      recommendations: this.generatePerformanceRecommendations(),
      score: this.randomInt(40, 95)
    };
  }
  
  /**
   * Generate resource data
   * @returns {Array} - Resource data
   * @private
   */
  generateResourceData() {
    const resources = [];
    const types = ['script', 'stylesheet', 'image', 'font', 'document'];
    
    for (let i = 0; i < this.randomInt(5, 15); i++) {
      resources.push({
        url: `https://example.com/resource${i}.${this.randomChoice(['js', 'css', 'png', 'woff2', 'html'])}`,
        type: this.randomChoice(types),
        size: this.randomInt(1024, 1024 * 1024), // 1KB to 1MB
        loadTime: this.randomInt(10, 500),
        cached: this.rng() < 0.6
      });
    }
    
    return resources;
  }
  
  /**
   * Generate performance bottlenecks
   * @returns {Array} - Bottlenecks
   * @private
   */
  generateBottlenecks() {
    const bottlenecks = [
      'Large bundle size (2.3MB)',
      'Unused CSS rules (45%)',
      'Unoptimized images (3 found)',
      'Blocking JavaScript (5 scripts)',
      'Multiple font downloads',
      'Excessive DOM depth',
      'Missing gzip compression',
      'Inefficient cache policies'
    ];
    
    const count = this.randomInt(2, 5);
    return Array.from({ length: count }, () => this.randomChoice(bottlenecks));
  }
  
  /**
   * Generate performance recommendations
   * @returns {Array} - Recommendations
   * @private
   */
  generatePerformanceRecommendations() {
    const recommendations = [
      'Enable gzip compression',
      'Optimize images with WebP format',
      'Remove unused CSS',
      'Implement code splitting',
      'Use lazy loading for images',
      'Minimize render-blocking resources',
      'Optimize font loading',
      'Reduce server response time'
    ];
    
    const count = this.randomInt(3, 6);
    return Array.from({ length: count }, () => this.randomChoice(recommendations));
  }
  
  /**
   * Generate error scenarios
   * @param {number} count - Number of errors to generate
   * @returns {Array} - Error scenarios
   */
  generateErrorScenarios(count = 5) {
    const errorTypes = ['TypeError', 'ReferenceError', 'SyntaxError', 'NetworkError', 'SecurityError'];
    const errors = [];
    
    for (let i = 0; i < count; i++) {
      const type = this.randomChoice(errorTypes);
      
      errors.push({
        type,
        code: `${type.toUpperCase()}_${this.randomInt(1000, 9999)}`,
        message: this.generateErrorMessage(type),
        stack: this.generateStackTrace(),
        recoverable: this.rng() < 0.7,
        retryable: this.rng() < 0.5,
        timestamp: Date.now() - this.randomInt(0, 86400000) // Within last 24 hours
      });
    }
    
    return errors;
  }
  
  /**
   * Generate error message
   * @param {string} type - Error type
   * @returns {string} - Error message
   * @private
   */
  generateErrorMessage(type) {
    const messages = {
      TypeError: 'Cannot read property of undefined',
      ReferenceError: 'Variable is not defined',
      SyntaxError: 'Unexpected token',
      NetworkError: 'Failed to fetch resource',
      SecurityError: 'Permission denied'
    };
    
    return messages[type] || 'Unknown error occurred';
  }
  
  /**
   * Generate stack trace
   * @returns {string} - Stack trace
   * @private
   */
  generateStackTrace() {
    const functions = ['main', 'handleClick', 'processData', 'render', 'initialize'];
    const files = ['app.js', 'utils.js', 'component.js', 'service.js'];
    
    const stack = [];
    for (let i = 0; i < this.randomInt(3, 7); i++) {
      const func = this.randomChoice(functions);
      const file = this.randomChoice(files);
      const line = this.randomInt(1, 500);
      
      stack.push(`    at ${func} (${file}:${line}:${this.randomInt(1, 50)})`);
    }
    
    return stack.join('\n');
  }
  
  /**
   * Generate command response data
   * @param {string} command - Command name
   * @returns {Object} - Response data
   */
  generateCommandResponse(command) {
    const success = this.rng() < 0.9; // 90% success rate
    
    if (!success) {
      return {
        success: false,
        error: {
          code: 'MOCK_ERROR',
          message: `Mock error for command: ${command}`
        }
      };
    }
    
    switch (command) {
      case 'inspect_element':
        return {
          success: true,
          data: {
            element: this.generateDOMElement()
          }
        };
        
      case 'analyze_javascript':
        return {
          success: true,
          data: this.generateJavaScriptSamples(1)[0]
        };
        
      case 'audit_accessibility':
        return {
          success: true,
          data: {
            score: this.randomInt(60, 95),
            issues: this.generateAccessibilityScenarios().slice(0, this.randomInt(0, 3)),
            recommendations: [
              'Add ARIA labels',
              'Improve color contrast',
              'Fix heading structure'
            ].slice(0, this.randomInt(1, 3))
          }
        };
        
      case 'analyze_performance':
        return {
          success: true,
          data: this.generatePerformanceData()
        };
        
      default:
        return {
          success: true,
          data: {
            message: `Mock response for ${command}`,
            timestamp: Date.now()
          }
        };
    }
  }
  
  /**
   * Generate user interactions
   * @param {number} count - Number of interactions
   * @returns {Array} - User interactions
   */
  generateUserInteractions(count = 10) {
    const interactions = [];
    const types = ['click', 'scroll', 'keydown', 'focus', 'blur', 'mouseover', 'submit'];
    const targets = ['button', 'input', 'link', 'div', 'form', 'select'];
    
    for (let i = 0; i < count; i++) {
      const type = this.randomChoice(types);
      const target = this.randomChoice(targets);
      
      interactions.push({
        type,
        target: `${target}#${this.randomChoice(['submit', 'cancel', 'next', 'prev', 'menu'])}`,
        timestamp: Date.now() - this.randomInt(0, 3600000), // Within last hour
        data: this.generateInteractionData(type)
      });
    }
    
    return interactions.sort((a, b) => a.timestamp - b.timestamp);
  }
  
  /**
   * Generate interaction data
   * @param {string} type - Interaction type
   * @returns {Object} - Interaction data
   * @private
   */
  generateInteractionData(type) {
    switch (type) {
      case 'click':
        return {
          clientX: this.randomInt(0, 1920),
          clientY: this.randomInt(0, 1080),
          button: 0
        };
        
      case 'scroll':
        return {
          scrollX: this.randomInt(0, 1000),
          scrollY: this.randomInt(0, 5000)
        };
        
      case 'keydown':
        return {
          key: this.randomChoice(['Enter', 'Tab', 'Escape', 'Space', 'ArrowUp', 'ArrowDown']),
          keyCode: this.randomInt(8, 90)
        };
        
      default:
        return {};
    }
  }
  
  /**
   * Get current seed
   * @returns {number} - Current seed
   */
  getSeed() {
    return this.config.seed;
  }
  
  /**
   * Reset generator with new seed
   * @param {number} seed - New seed
   */
  setSeed(seed) {
    this.config.seed = seed;
    this.rng = this.createSeededRandom(seed);
  }
}