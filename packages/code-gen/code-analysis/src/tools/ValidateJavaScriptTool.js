/**
 * ValidateJavaScriptTool - Comprehensive JavaScript validation
 * 
 * Extracted and adapted from cerebrate CodeAnalysisCommands for Legion framework
 */

import { Tool, ToolResult } from '@legion/module-loader';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export class ValidateJavaScriptTool extends Tool {
  constructor() {
    super();
    this.name = 'validate_javascript';
    this.description = 'Validate JavaScript code for syntax and quality issues';
    this.inputSchema = z.object({
      code: z.string().optional().describe('JavaScript code to validate'),
      filePath: z.string().optional().describe('Path to JavaScript file to validate (alternative to code)'),
      projectPath: z.string().optional().describe('Project root directory for batch analysis of all JS files'),
      includeAnalysis: z.boolean().default(true).describe('Include code quality analysis'),
      checkSecurity: z.boolean().default(true).describe('Check for security issues'),
      checkPerformance: z.boolean().default(true).describe('Check for performance issues'),
      filePattern: z.string().optional().default('**/*.{js,mjs,jsx}').describe('File pattern for batch analysis (when projectPath is provided)')
    });
    this.outputSchema = z.object({
      valid: z.boolean().describe('Whether the code is syntactically valid'),
      errors: z.array(z.string()).describe('Array of validation errors'),
      warnings: z.array(z.string()).describe('Array of code quality warnings'),
      securityIssues: z.array(z.object({
        type: z.string(),
        severity: z.string(),
        message: z.string(),
        line: z.number().optional(),
        file: z.string().optional()
      })).describe('Security vulnerabilities found'),
      performanceIssues: z.array(z.object({
        type: z.string(),
        severity: z.string(),
        message: z.string(),
        suggestion: z.string(),
        file: z.string().optional()
      })).describe('Performance issues found'),
      metrics: z.object({
        linesOfCode: z.number(),
        complexity: z.number(),
        maintainabilityIndex: z.number()
      }).describe('Code metrics'),
      results: z.object({
        javascript: z.array(z.object({
          file: z.string(),
          valid: z.boolean(),
          errors: z.array(z.string()),
          warnings: z.array(z.string()),
          metrics: z.object({
            linesOfCode: z.number(),
            complexity: z.number(),
            maintainabilityIndex: z.number()
          })
        })).optional(),
        summary: z.object({
          totalFiles: z.number(),
          validFiles: z.number(),
          totalErrors: z.number(),
          totalWarnings: z.number(),
          securityIssues: z.number(),
          performanceIssues: z.number()
        }).optional()
      }).optional().describe('Batch analysis results (when projectPath is provided)')
    });

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

  /**
   * Returns the tool description in standard function calling format
   */
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.inputSchema,
        output: this.outputSchema || {
          success: {
            type: 'object',
            properties: {
              result: { type: 'any', description: 'Tool execution result' }
            }
          },
          failure: {
            type: 'object',
            properties: {
              error: { type: 'string', description: 'Error message' },
              details: { type: 'object', description: 'Error details' }
            }
          }
        }
      }
    };
  }

  async invoke(toolCall) {
    // Parse arguments from the tool call
    let args;
    try {
      args = typeof toolCall.function.arguments === 'string' 
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } catch (error) {
      return ToolResult.failure(error.message || 'Tool execution failed', {
        toolName: this.name,
        error: error.toString(),
        stack: error.stack
      });
    }

    // Execute the tool with parsed arguments
    try {
      const result = await this.execute(args);
      return ToolResult.success(result);
    } catch (error) {
      return ToolResult.failure(error.message || 'Tool execution failed', {
        toolName: this.name,
        error: error.toString(),
        stack: error.stack
      });
    }
  }

  async execute(args) {
    try {
      this.emit('progress', { percentage: 10, status: 'Preparing code validation...' });

      let code = args.code;
      
      // Load code from file if filePath provided
      if (!code && args.filePath) {
        try {
          code = await fs.readFile(args.filePath, 'utf8');
        } catch (error) {
          return {
            valid: false,
            errors: [`Failed to read file: ${error.message}`],
            warnings: [],
            securityIssues: [],
            performanceIssues: [],
            metrics: { linesOfCode: 0, complexity: 0, maintainabilityIndex: 0 }
          };
        }
      }

      if (!code) {
        return {
          valid: false,
          errors: ['No code provided for validation'],
          warnings: [],
          securityIssues: [],
          performanceIssues: [],
          metrics: { linesOfCode: 0, complexity: 0, maintainabilityIndex: 0 }
        };
      }

      this.emit('progress', { percentage: 30, status: 'Validating syntax...' });

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

      this.emit('progress', { percentage: 50, status: 'Analyzing code quality...' });

      // Code quality analysis
      if (args.includeAnalysis) {
        result.warnings.push(...this._analyzeCodeQuality(code));
      }

      this.emit('progress', { percentage: 70, status: 'Checking security issues...' });

      // Security analysis
      if (args.checkSecurity) {
        result.securityIssues = this._analyzeSecurityIssues(code);
      }

      this.emit('progress', { percentage: 90, status: 'Analyzing performance...' });

      // Performance analysis
      if (args.checkPerformance) {
        result.performanceIssues = this._analyzePerformanceIssues(code);
      }

      this.emit('progress', { percentage: 100, status: 'Validation complete' });

      return result;

    } catch (error) {
      this.emit('error', { message: error.message });
      throw error;
    }
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