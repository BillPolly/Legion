/**
 * CodeAnalysisModule - Legion module for code analysis
 * 
 * Provides tools for JavaScript and CSS validation, security scanning, and performance analysis
 */

import { Module } from '@legion/tools';
import { wrapTool } from '../../src/ToolWrapper.js';
import { ValidateJavaScriptTool } from './tools/ValidateJavaScriptTool.js';

export class CodeAnalysisModule extends Module {
  constructor(dependencies = {}) {
    super();
    this.name = 'CodeAnalysisModule';
    this.config = dependencies;
    this.description = 'Code analysis tools for JavaScript and CSS validation, security scanning, and performance analysis';
    this.version = '1.0.0';
  }

  /**
   * Static async factory method following the Async Resource Manager Pattern
   */
  static async create(resourceManager) {
    const dependencies = {
      resourceManager: resourceManager
    };

    const module = new CodeAnalysisModule(dependencies);
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module
   */
  async initialize() {
    if (this.initialized) return;

    // Initialize tools and wrap them for Legion compatibility
    this.tools = [
      wrapTool(new ValidateJavaScriptTool())
      // TODO: Add remaining tools (security analysis, performance analysis, CSS validation, etc.)
    ];

    this.initialized = true;
    await super.initialize();
  }

  /**
   * Get all tools provided by this module
   */
  getTools() {
    if (!this.initialized) {
      throw new Error('CodeAnalysisModule must be initialized before getting tools');
    }

    return this.tools;
  }

  /**
   * Get tool by name
   */
  getTool(name) {
    return this.tools.find(tool => tool.name === name);
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
          const analysis = await jsTool.execute({
            filePath: file.path,
            code: file.code,
            includeAnalysis: true,
            checkSecurity: true,
            checkPerformance: true
          });
          
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
    this.tools = [];
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