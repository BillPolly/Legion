/**
 * CodeAnalysisModule - Legion module for code analysis
 * 
 * Provides tools for JavaScript and CSS validation, security scanning, and performance analysis
 */

import { Tool, Module } from '@legion/tools-registry';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

/**
 * JavaScript validation tool that analyzes code for syntax, security, and performance issues
 * NEW: Pure logic implementation - metadata comes from tools-metadata.json
 */
class ValidateJavaScriptTool extends Tool {
  // NEW PATTERN: constructor(module, toolName)
  constructor(module, toolName) {
    super(module, toolName);
    this.shortName = 'validate';
    
    // Security patterns to detect
    this.securityPatterns = {
      xss: [
        { pattern: /\.innerHTML\s*=\s*[^;]*(?:user|input|data|param)/i, message: 'Potential XSS via innerHTML' },
        { pattern: /document\.write\s*\(/i, message: 'Dangerous use of document.write' },
        { pattern: /\.insertAdjacentHTML\s*\(/i, message: 'Potential XSS via insertAdjacentHTML' }
      ],
      codeInjection: [
        { pattern: /eval\s*\(/i, message: 'Dangerous use of eval()' },
        { pattern: /new\s+Function\s*\(/i, message: 'Dynamic code execution with Function constructor' },
        { pattern: /setTimeout\s*\(\s*['"]/i, message: 'String-based setTimeout can lead to code injection' },
        { pattern: /setInterval\s*\(\s*['"]/i, message: 'String-based setInterval can lead to code injection' }
      ],
      dataLeakage: [
        { pattern: /localStorage\./i, message: 'Potential sensitive data in localStorage' },
        { pattern: /sessionStorage\./i, message: 'Potential sensitive data in sessionStorage' },
        { pattern: /document\.cookie/i, message: 'Direct cookie manipulation detected' }
      ]
    };

    // Performance anti-patterns
    this.performancePatterns = [
      { pattern: /for\s*\([^}]*\{[^}]*document\.querySelector/s, type: 'dom-query-in-loop', message: 'DOM query inside loop - consider caching' },
      { pattern: /var\s+\w+\s*=/g, type: 'global-variables', message: 'Global variable detected - consider encapsulation' },
      { pattern: /while\s*\([^}]*\{/g, type: 'while-loop', message: 'While loop detected - ensure proper exit conditions' }
    ];
  }

  // BACKWARDS COMPATIBILITY: support old pattern during migration
  static createLegacy() {
    return new ValidateJavaScriptTool({
      name: 'validate_javascript',
      description: 'Validate JavaScript code for syntax and quality issues',
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'JavaScript code to validate' },
          filePath: { type: 'string', description: 'Path to JavaScript file to validate' },
          includeAnalysis: { type: 'boolean', default: true, description: 'Include code quality analysis' },
          checkSecurity: { type: 'boolean', default: true, description: 'Check for security issues' },
          checkPerformance: { type: 'boolean', default: true, description: 'Check for performance issues' }
        }
      },
      outputSchema: {
        type: 'object',
        properties: {
          valid: { type: 'boolean', description: 'Whether the code is syntactically valid' },
          errors: { type: 'array', items: { type: 'string' }, description: 'Validation errors' },
          warnings: { type: 'array', items: { type: 'string' }, description: 'Code quality warnings' },
          securityIssues: { type: 'array', description: 'Security vulnerabilities found' },
          performanceIssues: { type: 'array', description: 'Performance issues found' },
          metrics: { type: 'object', description: 'Code metrics' }
        },
        required: ['valid', 'errors', 'warnings', 'securityIssues', 'performanceIssues', 'metrics']
      }
    });
  }

  /**
   * Pure business logic - no metadata, no validation
   * Base Tool class handles all validation using metadata
   */
  async _execute(params) {
    this.progress('Preparing code validation...', 10);

    let code = params.code;
    
    // Load code from file if filePath provided
    if (!code && params.filePath) {
      try {
        code = await fs.readFile(params.filePath, 'utf8');
      } catch (error) {
        throw new Error(`Failed to read file: ${error.message}`);
      }
    }

    if (!code) {
      throw new Error('No code provided for validation');
    }

    this.progress('Validating syntax...', 30);

    const result = {
      valid: true,
      errors: [],
      warnings: [],
      securityIssues: [],
      performanceIssues: [],
      metrics: this._calculateMetrics(code)
    };

    // Syntax validation
    try {
      new Function(code);
    } catch (syntaxError) {
      result.valid = false;
      result.errors.push(`Syntax error: ${syntaxError.message}`);
    }

    this.progress('Analyzing code quality...', 50);

    // Code quality analysis
    if (params.includeAnalysis !== false) {
      result.warnings.push(...this._analyzeCodeQuality(code));
    }

    this.progress('Checking security issues...', 70);

    // Security analysis
    if (params.checkSecurity !== false) {
      result.securityIssues = this._analyzeSecurityIssues(code);
    }

    this.progress('Analyzing performance...', 90);

    // Performance analysis
    if (params.checkPerformance !== false) {
      result.performanceIssues = this._analyzePerformanceIssues(code);
    }

    this.progress('Validation complete', 100);

    return result;
  }

  _calculateMetrics(code) {
    const lines = code.split('\n');
    const linesOfCode = lines.filter(line => line.trim() && !line.trim().startsWith('//')).length;
    
    // Simple complexity calculation (count decision points)
    const complexity = this._calculateCyclomaticComplexity(code);
    
    // Simple maintainability index (based on lines and complexity)
    const maintainabilityIndex = Math.max(0, 171 - 5.2 * Math.log(linesOfCode) - 0.23 * complexity);

    return {
      linesOfCode,
      complexity,
      maintainabilityIndex: Math.round(maintainabilityIndex)
    };
  }

  _calculateCyclomaticComplexity(code) {
    // Count decision points: if, else, while, for, case, catch, &&, ||, ?
    const decisionPatterns = [
      /\bif\s*\(/g,
      /\belse\b/g,
      /\bwhile\s*\(/g,
      /\bfor\s*\(/g,
      /\bcase\s+/g,
      /\bcatch\s*\(/g,
      /&&/g,
      /\|\|/g,
      /\?/g
    ];

    let complexity = 1; // Base complexity
    
    decisionPatterns.forEach(pattern => {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });

    return complexity;
  }

  _analyzeCodeQuality(code) {
    const warnings = [];

    // Long functions
    const functions = code.match(/function\s+\w+[^{]*\{[^}]*\}/g) || [];
    functions.forEach(func => {
      const lines = func.split('\n').length;
      if (lines > 50) {
        warnings.push(`Function is too long (${lines} lines) - consider breaking it down`);
      }
    });

    // Too many parameters
    const functionParams = code.match(/function\s+\w+\s*\(([^)]*)\)/g) || [];
    functionParams.forEach(func => {
      const params = func.match(/\(([^)]*)\)/)[1].split(',').filter(p => p.trim());
      if (params.length > 5) {
        warnings.push(`Function has too many parameters (${params.length}) - consider using an options object`);
      }
    });

    // Unused variables (simple detection)
    const varDeclarations = code.match(/(?:var|let|const)\s+(\w+)/g) || [];
    varDeclarations.forEach(decl => {
      const varName = decl.match(/(\w+)$/)[1];
      if (varName !== 'exports' && varName !== 'module') {
        const usage = new RegExp(`\\b${varName}\\b`, 'g');
        const matches = code.match(usage) || [];
        if (matches.length <= 1) { // Only declaration, no usage
          warnings.push(`Variable '${varName}' appears to be unused`);
        }
      }
    });

    // Magic numbers
    const magicNumbers = code.match(/\b\d{2,}\b/g) || [];
    if (magicNumbers.length > 0) {
      warnings.push('Consider using named constants instead of magic numbers');
    }

    return warnings;
  }

  _analyzeSecurityIssues(code) {
    const issues = [];
    const lines = code.split('\n');

    // Check all security pattern categories
    Object.entries(this.securityPatterns).forEach(([category, patterns]) => {
      patterns.forEach(({ pattern, message }) => {
        lines.forEach((line, index) => {
          if (pattern.test(line)) {
            issues.push({
              type: category,
              severity: this._getSeverityForCategory(category),
              message,
              line: index + 1
            });
          }
        });
      });
    });

    return issues;
  }

  _analyzePerformanceIssues(code) {
    const issues = [];

    this.performancePatterns.forEach(({ pattern, type, message }) => {
      if (pattern.test(code)) {
        issues.push({
          type,
          severity: 'medium',
          message,
          suggestion: this._getPerformanceSuggestion(type)
        });
      }
    });

    // Additional performance checks
    
    // Frequent DOM access
    const domAccess = (code.match(/document\./g) || []).length;
    if (domAccess > 10) {
      issues.push({
        type: 'frequent-dom-access',
        severity: 'medium',
        message: `${domAccess} DOM accesses detected`,
        suggestion: 'Consider caching DOM references'
      });
    }

    // Anonymous functions in loops
    if (/for\s*\([^}]*function\s*\(/s.test(code)) {
      issues.push({
        type: 'anonymous-function-in-loop',
        severity: 'high',
        message: 'Anonymous function created inside loop',
        suggestion: 'Move function declaration outside loop to avoid repeated creation'
      });
    }

    return issues;
  }

  _getSeverityForCategory(category) {
    const severityMap = {
      xss: 'high',
      codeInjection: 'critical',
      dataLeakage: 'medium'
    };
    return severityMap[category] || 'medium';
  }

  _getPerformanceSuggestion(type) {
    const suggestions = {
      'dom-query-in-loop': 'Cache DOM elements outside the loop',
      'global-variables': 'Use modules, namespaces, or IIFE to avoid global scope pollution',
      'while-loop': 'Ensure proper exit conditions and consider for-loops for known iterations',
      'frequent-dom-access': 'Cache DOM references in variables',
      'anonymous-function-in-loop': 'Declare functions outside loops to avoid repeated creation'
    };
    return suggestions[type] || 'Consider optimizing this code pattern';
  }
}

/**
 * CodeAnalysisModule - NEW metadata-driven architecture
 * Metadata comes from tools-metadata.json, tools contain pure logic only
 */
class CodeAnalysisModule extends Module {
  constructor() {
    super();
    this.name = 'code-analysis';
    this.description = 'Code analysis tools for JavaScript and CSS validation, security scanning, and performance analysis';
    this.version = '1.0.0';
    
    // NEW: Set metadata path for automatic loading
    this.metadataPath = './tools-metadata.json';
  }

  /**
   * Override getModulePath to support proper path resolution
   */
  getModulePath() {
    return fileURLToPath(import.meta.url);
  }

  /**
   * Static async factory method following the standard interface
   */
  static async create(resourceManager) {
    const module = new CodeAnalysisModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module - NEW metadata-driven approach
   */
  async initialize() {
    await super.initialize(); // This will load metadata automatically
    
    // NEW APPROACH: Create tools using metadata
    if (this.metadata) {
      // Create validate_javascript tool using metadata
      const validateJsTool = this.createToolFromMetadata('validate_javascript', ValidateJavaScriptTool);
      this.registerTool(validateJsTool.name, validateJsTool);
    } else {
      // FALLBACK: Old approach for backwards compatibility
      const validateJsTool = ValidateJavaScriptTool.createLegacy();
      this.registerTool(validateJsTool.name, validateJsTool);
    }
    // TODO: Add remaining tools (security analysis, performance analysis, CSS validation, etc.)
  }

  /**
   * Get all tools provided by this module
   */
  getTools() {
    if (!this.initialized) {
      throw new Error('CodeAnalysisModule must be initialized before getting tools');
    }

    return Object.values(this.tools);
  }

  /**
   * Get tool by name
   */
  getTool(name) {
    return this.tools[name];
  }

  /**
   * Analyze complete codebase
   * Convenience method that orchestrates multiple tools
   */
  async analyzeCodebase(codebaseSpec) {
    const results = {
      javascript: [],
      css: [],
      summary: {
        totalFiles: 0,
        validFiles: 0,
        securityIssues: 0,
        performanceIssues: 0
      }
    };

    try {
      // Analyze JavaScript files
      if (codebaseSpec.javascriptFiles) {
        const jsTool = this.getTool('validate_javascript');
        
        for (const file of codebaseSpec.javascriptFiles) {
          const result = await jsTool.execute({
            filePath: file.path,
            code: file.code,
            includeAnalysis: true,
            checkSecurity: true,
            checkPerformance: true
          });
          
          // Handle Tool base class response format
          if (!result.success) {
            throw new Error(result.error || 'Tool execution failed');
          }
          
          const analysis = result.data;
          
          results.javascript.push({
            file: file.path || 'inline',
            analysis
          });
          
          results.summary.totalFiles++;
          if (analysis.valid) results.summary.validFiles++;
          results.summary.securityIssues += analysis.securityIssues.length;
          results.summary.performanceIssues += analysis.performanceIssues.length;
        }
      }

      // TODO: Add CSS analysis when CSS tools are implemented

      return {
        success: true,
        results,
        recommendations: this._generateRecommendations(results)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        results
      };
    }
  }

  _generateRecommendations(results) {
    const recommendations = [];
    
    const totalSecurityIssues = results.summary.securityIssues;
    const totalPerformanceIssues = results.summary.performanceIssues;
    
    if (totalSecurityIssues > 0) {
      recommendations.push({
        category: 'security',
        priority: 'high',
        message: `Found ${totalSecurityIssues} security issues that should be addressed immediately`,
        actions: [
          'Review and fix all XSS vulnerabilities',
          'Replace eval() and Function() calls with safer alternatives',
          'Implement proper input sanitization'
        ]
      });
    }
    
    if (totalPerformanceIssues > 5) {
      recommendations.push({
        category: 'performance',
        priority: 'medium',
        message: `Found ${totalPerformanceIssues} performance issues that could impact user experience`,
        actions: [
          'Cache DOM references to avoid repeated queries',
          'Move function declarations outside loops',
          'Consider code splitting for large modules'
        ]
      });
    }
    
    const validationRate = results.summary.totalFiles > 0 
      ? (results.summary.validFiles / results.summary.totalFiles) * 100 
      : 100;
      
    if (validationRate < 90) {
      recommendations.push({
        category: 'quality',
        priority: 'medium',
        message: `Only ${Math.round(validationRate)}% of files pass validation`,
        actions: [
          'Fix syntax errors in failing files',
          'Implement code linting in development workflow',
          'Add automated testing for code quality'
        ]
      });
    }
    
    return recommendations;
  }

  /**
   * Cleanup the module
   */
  async cleanup() {
    this.tools = {};
    await super.cleanup();
  }

  /**
   * Get module metadata
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      version: this.version,
      author: 'Legion Team',
      tools: this.getTools().length,
      capabilities: [
        'JavaScript syntax validation',
        'Security vulnerability scanning',
        'Performance bottleneck detection',
        'Code complexity analysis',
        'CSS validation and compatibility checking',
        'Automated code quality assessment'
      ],
      supportedFeatures: [
        'XSS and code injection detection',
        'Cyclomatic complexity calculation',
        'Browser compatibility analysis',
        'Performance optimization suggestions',
        'Maintainability index scoring',
        'Batch codebase analysis'
      ]
    };
  }
}

export default CodeAnalysisModule;
