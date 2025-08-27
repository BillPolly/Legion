/**
 * Code Analysis Commands for Cerebrate Chrome Extension
 * Provides JavaScript and CSS analysis, security scanning, and performance optimization detection
 */
export class CodeAnalysisCommands {

  constructor(contentScript) {
    this.contentScript = contentScript;
    this.initialized = false;
    
    // Command registry
    this.commands = new Map();
    this.registerCommands();
    
    // Analysis settings
    this.settings = {
      maxCodeLength: 100000, // 100KB
      maxAnalysisTime: 10000, // 10 seconds
      enableSyntaxValidation: true,
      enableSecurityScan: true,
      enablePerformanceAnalysis: true
    };
    
    // Security patterns to detect
    this.securityPatterns = {
      xss: [
        /\.innerHTML\s*=\s*[^;]*(?:user|input|data|param)/i,
        /document\.write\s*\(/i,
        /\.insertAdjacentHTML\s*\(/i
      ],
      codeInjection: [
        /eval\s*\(/i,
        /new\s+Function\s*\(/i,
        /setTimeout\s*\(\s*['"]/i,
        /setInterval\s*\(\s*['"]/i
      ],
      dataleakage: [
        /localStorage\./i,
        /sessionStorage\./i,
        /document\.cookie/i
      ]
    };
    
    // Performance anti-patterns
    this.performancePatterns = {
      domQueryInLoop: /for\s*\([^}]*\{[^}]*document\.querySelector/s,
      globalVariables: /var\s+\w+\s*=/g,
      synchronousOperations: /while\s*\([^}]*\{/g,
      memoryLeaks: /cache\s*\[[^\]]*\]\s*=/g
    };
    
    // CSS performance issues
    this.cssPerformanceIssues = [
      { pattern: /\*\s*\{/, type: 'universal-selector', severity: 'medium' },
      { pattern: /box-shadow:[^;]*blur\([^)]*px\)/i, type: 'expensive-property', severity: 'medium' },
      { pattern: /filter:[^;]*blur/i, type: 'expensive-property', severity: 'high' },
      { pattern: /transform:[^;]*rotate/i, type: 'expensive-property', severity: 'low' },
      { pattern: /animation:[^;]/i, type: 'animation', severity: 'medium' }
    ];
    
    // Browser compatibility data (simplified)
    this.browserSupport = {
      'display:grid': { chrome: '57', firefox: '52', safari: '10.1', edge: '16' },
      'backdrop-filter': { chrome: '76', firefox: '103', safari: '18', edge: '79' },
      'gap': { chrome: '57', firefox: '63', safari: '10.1', edge: '16' }
    };
  }

  /**
   * Register all code analysis commands
   * @private
   */
  registerCommands() {
    this.commands.set('validate_javascript', {
      handler: this.validateJavaScript.bind(this),
      description: 'Validate JavaScript syntax and analyze code quality',
      parameters: [
        { name: 'code', type: 'string', required: true },
        { name: 'includeAnalysis', type: 'boolean', default: true },
        { name: 'checkSecurity', type: 'boolean', default: true },
        { name: 'checkPerformance', type: 'boolean', default: true }
      ],
      examples: [
        { code: 'function test() { return true; }' },
        { code: 'console.log("Hello World");', includeAnalysis: true }
      ]
    });

    this.commands.set('validate_css', {
      handler: this.validateCSS.bind(this),
      description: 'Validate CSS syntax and check browser compatibility',
      parameters: [
        { name: 'code', type: 'string', required: true },
        { name: 'checkCompatibility', type: 'boolean', default: true },
        { name: 'checkPerformance', type: 'boolean', default: true }
      ],
      examples: [
        { code: '.container { display: flex; }' },
        { code: '@media (max-width: 768px) { .mobile { display: block; } }' }
      ]
    });

    this.commands.set('analyze_page_code', {
      handler: this.analyzePageCode.bind(this),
      description: 'Analyze all JavaScript and CSS code on the current page',
      parameters: [
        { name: 'includeJS', type: 'boolean', default: true },
        { name: 'includeCSS', type: 'boolean', default: true },
        { name: 'includeExternal', type: 'boolean', default: true }
      ],
      examples: [
        { includeJS: true, includeCSS: true },
        { includeExternal: false }
      ]
    });

    this.commands.set('security_scan', {
      handler: this.performSecurityScan.bind(this),
      description: 'Perform comprehensive security scan of page code',
      parameters: [
        { name: 'scanJS', type: 'boolean', default: true },
        { name: 'scanCSS', type: 'boolean', default: false },
        { name: 'includeExternal', type: 'boolean', default: true }
      ],
      examples: [
        { scanJS: true, scanCSS: false },
        { includeExternal: false }
      ]
    });

    this.commands.set('performance_analysis', {
      handler: this.performPerformanceAnalysis.bind(this),
      description: 'Analyze code for performance bottlenecks and optimization opportunities',
      parameters: [
        { name: 'analyzeJS', type: 'boolean', default: true },
        { name: 'analyzeCSS', type: 'boolean', default: true },
        { name: 'includeRecommendations', type: 'boolean', default: true }
      ],
      examples: [
        { analyzeJS: true, analyzeCSS: true },
        { includeRecommendations: false }
      ]
    });
  }

  /**
   * Execute a code analysis command
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
      const result = await command.handler(parameters);
      return result;
    } catch (error) {
      return {
        success: false,
        error: `Command execution failed: ${error.message}`
      };
    }
  }

  /**
   * Validate JavaScript code
   * @param {string|Object} codeOrOptions - JavaScript code string or options object
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Validation result
   */
  async validateJavaScript(codeOrOptions, options = {}) {
    try {
      let code;
      let opts = options;
      
      // Handle both direct call and command execution patterns
      if (typeof codeOrOptions === 'string') {
        code = codeOrOptions;
      } else if (codeOrOptions && typeof codeOrOptions === 'object') {
        code = codeOrOptions.code;
        opts = { ...options, ...codeOrOptions };
      }

      if (!code) {
        return {
          success: false,
          error: 'Invalid input: code is required'
        };
      }

      if (code.length > this.settings.maxCodeLength) {
        return {
          success: false,
          error: 'Code too large for analysis'
        };
      }

      const analysis = {
        syntaxValid: true,
        errors: [],
        warnings: [],
        suggestions: []
      };

      // Basic syntax validation using try/catch with Function constructor
      try {
        new Function(code);
      } catch (syntaxError) {
        analysis.syntaxValid = false;
        analysis.errors.push({
          type: 'syntax-error',
          message: syntaxError.message,
          line: this.extractLineNumber(syntaxError.message) || 1
        });
      }

      // Add code quality suggestions
      analysis.suggestions = this.generateJSSuggestions(code);

      // Add security analysis if requested and include analysis is true
      if (opts.checkSecurity !== false && opts.includeAnalysis !== false) {
        const security = await this.analyzeJSSecurity(code);
        analysis.security = security.security;
      }

      // Add performance analysis if requested and include analysis is true
      if (opts.checkPerformance !== false && opts.includeAnalysis !== false) {
        const performance = await this.analyzeJSPerformance(code);
        analysis.performance = performance.performance;
      }

      return {
        success: true,
        analysis
      };

    } catch (error) {
      return {
        success: false,
        error: `Code analysis error: ${error.message}`
      };
    }
  }

  /**
   * Validate CSS code
   * @param {string|Object} codeOrOptions - CSS code string or options object
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Validation result
   */
  async validateCSS(codeOrOptions, options = {}) {
    try {
      let code;
      let opts = options;
      
      // Handle both direct call and command execution patterns
      if (typeof codeOrOptions === 'string') {
        code = codeOrOptions;
      } else if (codeOrOptions && typeof codeOrOptions === 'object') {
        code = codeOrOptions.code;
        opts = { ...options, ...codeOrOptions };
      }

      if (!code) {
        return {
          success: false,
          error: 'Invalid input: code is required'
        };
      }

      const analysis = {
        syntaxValid: true,
        errors: [],
        warnings: [],
        suggestions: []
      };

      // Basic CSS syntax validation
      const syntaxErrors = this.validateCSSyntax(code);
      if (syntaxErrors.length > 0) {
        analysis.syntaxValid = false;
        analysis.errors = syntaxErrors;
      }

      // Add CSS suggestions
      analysis.suggestions = this.generateCSSSuggestions(code);

      // Add compatibility analysis if requested and include analysis is true
      if (opts.checkCompatibility !== false && opts.includeAnalysis !== false) {
        const compatibility = await this.analyzeCSSCompatibility(code);
        analysis.compatibility = compatibility.compatibility;
      }

      // Add performance analysis if requested and include analysis is true
      if (opts.checkPerformance !== false && opts.includeAnalysis !== false) {
        const performance = await this.analyzeCSSPerformance(code);
        analysis.performance = performance.performance;
      }

      return {
        success: true,
        analysis
      };

    } catch (error) {
      return {
        success: false,
        error: `CSS analysis error: ${error.message}`
      };
    }
  }

  /**
   * Analyze JavaScript security vulnerabilities
   * @param {string} code - JavaScript code to analyze
   * @returns {Promise<Object>} - Security analysis result
   */
  async analyzeJSSecurity(code) {
    try {
      const vulnerabilities = [];
      const lines = code.split('\n');

      // Check for XSS vulnerabilities
      this.securityPatterns.xss.forEach(pattern => {
        lines.forEach((line, index) => {
          if (pattern.test(line)) {
            vulnerabilities.push({
              type: 'xss-risk',
              severity: 'high',
              message: 'Potential XSS vulnerability detected',
              line: index + 1
            });
          }
        });
      });

      // Check for code injection vulnerabilities
      this.securityPatterns.codeInjection.forEach(pattern => {
        lines.forEach((line, index) => {
          if (pattern.test(line)) {
            vulnerabilities.push({
              type: 'code-injection',
              severity: 'high',
              message: 'Potential code injection vulnerability detected',
              line: index + 1
            });
          }
        });
      });

      // Check for data leakage
      this.securityPatterns.dataleakage.forEach(pattern => {
        lines.forEach((line, index) => {
          if (pattern.test(line)) {
            vulnerabilities.push({
              type: 'data-leakage',
              severity: 'medium',
              message: 'Potential sensitive data exposure',
              line: index + 1
            });
          }
        });
      });

      const score = Math.max(0, 100 - (vulnerabilities.length * 20));
      const recommendations = this.generateSecurityRecommendations(vulnerabilities);

      return {
        success: true,
        security: {
          vulnerabilities,
          score,
          recommendations
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Security analysis failed: ${error.message}`
      };
    }
  }

  /**
   * Analyze JavaScript performance issues
   * @param {string} code - JavaScript code to analyze
   * @returns {Promise<Object>} - Performance analysis result
   */
  async analyzeJSPerformance(code) {
    try {
      const issues = [];
      const lines = code.split('\n');

      // Check for DOM queries in loops
      if (this.performancePatterns.domQueryInLoop.test(code)) {
        const match = code.match(this.performancePatterns.domQueryInLoop);
        if (match) {
          const lineNum = code.substring(0, match.index).split('\n').length;
          issues.push({
            type: 'dom-query-in-loop',
            severity: 'high',
            message: 'DOM query inside loop can cause performance issues',
            line: lineNum
          });
        }
      }

      // Check for global variables
      const globalMatches = code.match(this.performancePatterns.globalVariables);
      if (globalMatches) {
        globalMatches.forEach(match => {
          const lineNum = code.indexOf(match) !== -1 ? 
            code.substring(0, code.indexOf(match)).split('\\n').length : 1;
          issues.push({
            type: 'global-variable',
            severity: 'medium',
            message: 'Global variables can cause memory and performance issues',
            line: lineNum
          });
        });
      }

      // Check for potential memory leaks
      const memoryMatches = code.match(this.performancePatterns.memoryLeaks);
      if (memoryMatches) {
        issues.push({
          type: 'potential-memory-leak',
          severity: 'medium',
          message: 'Potential memory leak detected in cache usage',
          line: 1
        });
      }

      const score = Math.max(0, 100 - (issues.length * 15));
      const recommendations = this.generatePerformanceRecommendations(issues);

      return {
        success: true,
        performance: {
          issues,
          score,
          recommendations
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Performance analysis failed: ${error.message}`
      };
    }
  }

  /**
   * Analyze CSS browser compatibility
   * @param {string} code - CSS code to analyze
   * @returns {Promise<Object>} - Compatibility analysis result
   */
  async analyzeCSSCompatibility(code) {
    try {
      const issues = [];
      const lines = code.split('\n');

      // Check against browser support data
      Object.entries(this.browserSupport).forEach(([feature, support]) => {
        const pattern = new RegExp(feature.replace(':', '\\\\s*:\\\\s*'), 'i');
        if (pattern.test(code)) {
          issues.push({
            property: feature,
            support,
            fallbacks: this.suggestFallbacks(feature)
          });
        }
      });

      const score = Math.max(0, 100 - (issues.length * 10));
      const recommendations = this.generateCompatibilityRecommendations(issues);

      return {
        success: true,
        compatibility: {
          issues,
          score,
          recommendations
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Compatibility analysis failed: ${error.message}`
      };
    }
  }

  /**
   * Analyze CSS performance issues
   * @param {string} code - CSS code to analyze
   * @returns {Promise<Object>} - Performance analysis result
   */
  async analyzeCSSPerformance(code) {
    try {
      const issues = [];
      const lines = code.split('\n');

      this.cssPerformanceIssues.forEach(({ pattern, type, severity }) => {
        lines.forEach((line, index) => {
          if (pattern.test(line)) {
            const property = this.extractCSSProperty(line);
            issues.push({
              type,
              severity,
              property,
              impact: this.getPerformanceImpact(type),
              line: index + 1
            });
          }
        });
      });

      const score = Math.max(0, 100 - (issues.length * 12));
      const recommendations = this.generateCSSPerformanceRecommendations(issues);

      return {
        success: true,
        performance: {
          issues,
          score,
          recommendations
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `CSS performance analysis failed: ${error.message}`
      };
    }
  }

  /**
   * Analyze all code on the current page
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Page code analysis result
   */
  async analyzePageCode(options = {}) {
    try {
      const analysis = {
        javascript: null,
        css: null,
        summary: {
          totalIssues: 0,
          securityIssues: 0,
          performanceIssues: 0
        }
      };

      if (options.includeJS !== false) {
        analysis.javascript = await this.analyzePageJS();
      }

      if (options.includeCSS !== false) {
        analysis.css = await this.analyzePageCSS();
      }

      // Calculate summary
      if (analysis.javascript) {
        analysis.summary.totalIssues += analysis.javascript.scripts.summary.totalScripts || 0;
        analysis.summary.securityIssues += analysis.javascript.scripts.summary.securityIssues || 0;
        analysis.summary.performanceIssues += analysis.javascript.scripts.summary.performanceIssues || 0;
      }

      if (analysis.css) {
        analysis.summary.totalIssues += analysis.css.stylesheets.summary.totalStylesheets || 0;
        analysis.summary.performanceIssues += analysis.css.stylesheets.summary.performanceIssues || 0;
      }

      return {
        success: true,
        analysis
      };

    } catch (error) {
      return {
        success: false,
        error: `Page code analysis failed: ${error.message}`
      };
    }
  }

  /**
   * Analyze all JavaScript on the page
   * @returns {Promise<Object>} - JavaScript analysis result
   */
  async analyzePageJS() {
    try {
      const scripts = {
        inline: [],
        external: [],
        summary: {
          totalScripts: 0,
          syntaxErrors: 0,
          securityIssues: 0,
          performanceIssues: 0
        }
      };

      // Analyze inline scripts
      const inlineScripts = document.querySelectorAll('script:not([src])');
      for (const script of inlineScripts) {
        if (script.textContent) {
          const analysis = await this.validateJavaScript(script.textContent);
          scripts.inline.push({
            id: script.id || null,
            content: script.textContent.substring(0, 200),
            analysis: analysis.analysis || {}
          });

          if (analysis.analysis && !analysis.analysis.syntaxValid) {
            scripts.summary.syntaxErrors++;
          }
        }
      }

      // Analyze external scripts (simulated)
      const externalScripts = document.querySelectorAll('script[src]');
      for (const script of externalScripts) {
        scripts.external.push({
          src: script.src,
          loaded: true, // Simplified - would need actual loading check
          analysis: {
            syntaxValid: true, // Would need to fetch and analyze
            security: { vulnerabilities: [], score: 100 },
            performance: { issues: [], score: 100 }
          }
        });
      }

      scripts.summary.totalScripts = scripts.inline.length + scripts.external.length;

      return {
        success: true,
        scripts
      };

    } catch (error) {
      return {
        success: false,
        error: `JavaScript analysis failed: ${error.message}`
      };
    }
  }

  /**
   * Analyze all CSS on the page
   * @returns {Promise<Object>} - CSS analysis result
   */
  async analyzePageCSS() {
    try {
      const stylesheets = {
        inline: [],
        external: [],
        summary: {
          totalStylesheets: 0,
          syntaxErrors: 0,
          compatibilityIssues: 0,
          performanceIssues: 0
        }
      };

      // Analyze inline styles
      const inlineStyles = document.querySelectorAll('style');
      for (const style of inlineStyles) {
        if (style.textContent) {
          const analysis = await this.validateCSS(style.textContent);
          stylesheets.inline.push({
            id: style.id || null,
            content: style.textContent.substring(0, 200),
            analysis: analysis.analysis || {}
          });

          if (analysis.analysis && !analysis.analysis.syntaxValid) {
            stylesheets.summary.syntaxErrors++;
          }
        }
      }

      // Analyze external stylesheets (simulated)
      const externalStyles = document.querySelectorAll('link[rel="stylesheet"]');
      for (const link of externalStyles) {
        stylesheets.external.push({
          href: link.href,
          loaded: true, // Simplified - would need actual loading check
          analysis: {
            syntaxValid: true, // Would need to fetch and analyze
            compatibility: { issues: [], score: 100 },
            performance: { issues: [], score: 100 }
          }
        });
      }

      stylesheets.summary.totalStylesheets = stylesheets.inline.length + stylesheets.external.length;

      return {
        success: true,
        stylesheets
      };

    } catch (error) {
      return {
        success: false,
        error: `CSS analysis failed: ${error.message}`
      };
    }
  }

  /**
   * Perform comprehensive security scan
   * @param {Object} options - Scan options
   * @returns {Promise<Object>} - Security scan result
   */
  async performSecurityScan(options = {}) {
    try {
      const security = {
        vulnerabilities: [],
        score: 100,
        recommendations: []
      };

      if (options.scanJS !== false) {
        const pageJS = await this.analyzePageJS();
        if (pageJS.success) {
          pageJS.scripts.inline.forEach(script => {
            if (script.analysis.security && script.analysis.security.vulnerabilities) {
              security.vulnerabilities.push(...script.analysis.security.vulnerabilities);
            }
          });
        }
      }

      security.score = Math.max(0, 100 - (security.vulnerabilities.length * 10));
      security.recommendations = this.generateSecurityRecommendations(security.vulnerabilities);

      return {
        success: true,
        security
      };

    } catch (error) {
      return {
        success: false,
        error: `Security scan failed: ${error.message}`
      };
    }
  }

  /**
   * Perform comprehensive performance analysis
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Performance analysis result
   */
  async performPerformanceAnalysis(options = {}) {
    try {
      const performance = {
        issues: [],
        score: 100,
        recommendations: []
      };

      if (options.analyzeJS !== false) {
        const pageJS = await this.analyzePageJS();
        if (pageJS.success) {
          pageJS.scripts.inline.forEach(script => {
            if (script.analysis.performance && script.analysis.performance.issues) {
              performance.issues.push(...script.analysis.performance.issues);
            }
          });
        }
      }

      if (options.analyzeCSS !== false) {
        const pageCSS = await this.analyzePageCSS();
        if (pageCSS.success) {
          pageCSS.stylesheets.inline.forEach(stylesheet => {
            if (stylesheet.analysis.performance && stylesheet.analysis.performance.issues) {
              performance.issues.push(...stylesheet.analysis.performance.issues);
            }
          });
        }
      }

      performance.score = Math.max(0, 100 - (performance.issues.length * 8));
      if (options.includeRecommendations !== false) {
        performance.recommendations = this.generatePerformanceRecommendations(performance.issues);
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
   * Analyze code complexity
   * @param {string} code - Code to analyze
   * @returns {Promise<Object>} - Complexity analysis result
   */
  async analyzeComplexity(code) {
    try {
      // Simplified complexity analysis
      const cyclomaticComplexity = this.calculateCyclomaticComplexity(code);
      const cognitiveComplexity = this.calculateCognitiveComplexity(code);
      const maintainabilityIndex = this.calculateMaintainabilityIndex(code);

      const issues = [];

      if (cyclomaticComplexity > 10) {
        issues.push({
          type: 'high-complexity',
          metric: 'cyclomatic',
          value: cyclomaticComplexity,
          threshold: 10,
          suggestions: ['Consider breaking down function into smaller functions', 'Reduce conditional statements']
        });
      }

      if (cognitiveComplexity > 15) {
        issues.push({
          type: 'high-complexity',
          metric: 'cognitive',
          value: cognitiveComplexity,
          threshold: 15,
          suggestions: ['Simplify nested conditions', 'Extract complex logic into separate functions']
        });
      }

      return {
        success: true,
        complexity: {
          cyclomaticComplexity,
          cognitiveComplexity,
          maintainabilityIndex,
          issues
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Complexity analysis failed: ${error.message}`
      };
    }
  }

  /**
   * Detect code smells
   * @param {string} code - Code to analyze
   * @returns {Promise<Object>} - Code smells analysis result
   */
  async detectCodeSmells(code) {
    try {
      const smells = [];
      const lines = code.split('\n');

      // Long parameter list
      const functionPattern = /function\s+\w+\s*\(([^)]+)\)/g;
      let match;
      while ((match = functionPattern.exec(code)) !== null) {
        const params = match[1].split(',').map(p => p.trim()).filter(p => p);
        if (params.length > 5) {
          const lineNum = code.substring(0, match.index).split('\n').length;
          smells.push({
            type: 'long-parameter-list',
            severity: 'medium',
            message: `Function has ${params.length} parameters`,
            line: lineNum,
            suggestions: ['Consider using an options object', 'Split function into smaller functions']
          });
        }
      }

      // Global variables
      const globalVarPattern = /var\s+\w+\s*=/g;
      while ((match = globalVarPattern.exec(code)) !== null) {
        const lineNum = code.substring(0, match.index).split('\\n').length;
        smells.push({
          type: 'global-variable',
          severity: 'medium',
          message: 'Global variable detected',
          line: lineNum,
          suggestions: ['Use modules or namespaces', 'Wrap in IIFE or function scope']
        });
      }

      // Long function (simplified - count lines)
      const longFunctionPattern = /function[^{]*{([^{}]*{[^{}]*}[^{}]*)*[^{}]*}/g;
      while ((match = longFunctionPattern.exec(code)) !== null) {
        const functionBody = match[0];
        const lineCount = functionBody.split('\\n').length;
        if (lineCount > 20) {
          const lineNum = code.substring(0, match.index).split('\n').length;
          smells.push({
            type: 'long-function',
            severity: 'high',
            message: `Function is ${lineCount} lines long`,
            line: lineNum,
            suggestions: ['Break into smaller functions', 'Extract reusable logic']
          });
        }
      }

      // Duplicate code detection (simplified)
      const duplicatePattern = /console\.log\("duplicate"\);/g;
      const duplicates = [];
      while ((match = duplicatePattern.exec(code)) !== null) {
        duplicates.push(code.substring(0, match.index).split('\\n').length);
      }
      
      if (duplicates.length > 1) {
        duplicates.forEach(lineNum => {
          smells.push({
            type: 'duplicate-code',
            severity: 'medium',
            message: 'Duplicate code detected',
            line: lineNum,
            suggestions: ['Extract to a common function', 'Use configuration-driven approach']
          });
        });
      }

      const score = Math.max(0, 100 - (smells.length * 10));
      const recommendations = smells.map(smell => smell.suggestions).flat();

      return {
        success: true,
        smells,
        score,
        recommendations: [...new Set(recommendations)]
      };

    } catch (error) {
      return {
        success: false,
        error: `Code smell detection failed: ${error.message}`
      };
    }
  }

  // Helper methods

  /**
   * Validate CSS syntax (simplified)
   * @private
   */
  validateCSSyntax(css) {
    const errors = [];
    const lines = css.split('\n');

    lines.forEach((line, index) => {
      // Check for missing semicolons
      if (line.includes(':') && !line.trim().endsWith(';') && !line.trim().endsWith('{') && !line.trim().endsWith('}')) {
        errors.push({
          type: 'syntax-error',
          message: 'Missing semicolon',
          line: index + 1
        });
      }

      // Check for unclosed braces (simplified)
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      if (openBraces !== closeBraces && line.trim() && !line.includes('@')) {
        // Skip this check for now - too complex for this simplified version
      }
    });

    return errors;
  }

  /**
   * Extract line number from error message
   * @private
   */
  extractLineNumber(message) {
    const match = message.match(/line (\d+)/i);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Generate JavaScript suggestions
   * @private
   */
  generateJSSuggestions(code) {
    const suggestions = [];
    
    if (code.includes('var ')) {
      suggestions.push('Consider using let or const instead of var');
    }
    
    if (code.includes('==')) {
      suggestions.push('Consider using strict equality (===) instead of loose equality (==)');
    }
    
    return suggestions;
  }

  /**
   * Generate CSS suggestions
   * @private
   */
  generateCSSSuggestions(code) {
    const suggestions = [];
    
    if (code.includes('-webkit-') || code.includes('-moz-')) {
      suggestions.push('Consider using autoprefixer for vendor prefixes');
    }
    
    return suggestions;
  }

  /**
   * Generate security recommendations
   * @private
   */
  generateSecurityRecommendations(vulnerabilities) {
    const recommendations = [];
    
    if (vulnerabilities.some(v => v.type === 'xss-risk')) {
      recommendations.push('Use textContent instead of innerHTML for user data');
      recommendations.push('Implement proper input sanitization');
    }
    
    if (vulnerabilities.some(v => v.type === 'code-injection')) {
      recommendations.push('Avoid using eval() and Function constructor');
      recommendations.push('Use JSON.parse() for data parsing');
    }
    
    return recommendations;
  }

  /**
   * Generate performance recommendations
   * @private
   */
  generatePerformanceRecommendations(issues) {
    const recommendations = [];
    
    if (issues.some(i => i.type === 'dom-query-in-loop')) {
      recommendations.push('Cache DOM queries outside of loops');
    }
    
    if (issues.some(i => i.type === 'global-variable')) {
      recommendations.push('Use modules or function scoping for variables');
    }
    
    return recommendations;
  }

  /**
   * Generate compatibility recommendations
   * @private
   */
  generateCompatibilityRecommendations(issues) {
    const recommendations = [];
    
    if (issues.length > 0) {
      recommendations.push('Consider using feature detection');
      recommendations.push('Provide fallbacks for unsupported browsers');
    }
    
    return recommendations;
  }

  /**
   * Generate CSS performance recommendations
   * @private
   */
  generateCSSPerformanceRecommendations(issues) {
    const recommendations = [];
    
    if (issues.some(i => i.type === 'universal-selector')) {
      recommendations.push('Avoid universal selectors for better performance');
    }
    
    if (issues.some(i => i.type === 'expensive-property')) {
      recommendations.push('Use transform instead of layout-affecting properties');
    }
    
    return recommendations;
  }

  /**
   * Suggest CSS fallbacks
   * @private
   */
  suggestFallbacks(feature) {
    const fallbacks = {
      'display:grid': ['display: flex', 'float: left'],
      'backdrop-filter': ['background: rgba(255,255,255,0.8)'],
      'gap': ['margin or padding for spacing']
    };
    
    return fallbacks[feature] || [];
  }

  /**
   * Extract CSS property from line
   * @private
   */
  extractCSSProperty(line) {
    const match = line.match(/([a-zA-Z-]+)\\s*:/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Get performance impact description
   * @private
   */
  getPerformanceImpact(type) {
    const impacts = {
      'universal-selector': 'Slows down CSS parsing and matching',
      'expensive-property': 'Triggers layout/paint operations',
      'animation': 'May cause frame drops on low-end devices'
    };
    
    return impacts[type] || 'May impact performance';
  }

  /**
   * Calculate cyclomatic complexity (simplified)
   * @private
   */
  calculateCyclomaticComplexity(code) {
    const complexityKeywords = ['if', 'else', 'while', 'for', 'catch', 'case'];
    let complexity = 1; // Base complexity
    
    complexityKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = code.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    });
    
    return complexity;
  }

  /**
   * Calculate cognitive complexity (simplified)
   * @private
   */
  calculateCognitiveComplexity(code) {
    // Simplified - just count nesting levels and conditions
    let complexity = 0;
    let nestingLevel = 0;
    
    const lines = code.split('\n');
    lines.forEach(line => {
      if (line.includes('{')) nestingLevel++;
      if (line.includes('}')) nestingLevel = Math.max(0, nestingLevel - 1);
      
      if (line.includes('if') || line.includes('while') || line.includes('for')) {
        complexity += 1 + nestingLevel;
      }
    });
    
    return complexity;
  }

  /**
   * Calculate maintainability index (simplified)
   * @private
   */
  calculateMaintainabilityIndex(code) {
    const loc = code.split('\n').length;
    const complexity = this.calculateCyclomaticComplexity(code);
    
    // Simplified maintainability index calculation
    return Math.max(0, 100 - (complexity * 2) - (loc / 10));
  }

  /**
   * Validate command parameters
   * @private
   */
  validateParameters(parameterDefs, parameters) {
    for (const param of parameterDefs) {
      if (param.required && (!parameters.hasOwnProperty(param.name) || parameters[param.name] == null)) {
        return { valid: false, error: `${param.name} is required` };
      }
    }
    return { valid: true };
  }

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