/**
 * Live integration tests for Code Analysis Module
 * Tests actual module loading and tool execution
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ResourceManager, ModuleFactory } from '@legion/tool-system';
import { CodeAnalysisModule } from '../../code-analysis/src/CodeAnalysisModule.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Live Code Analysis Module Tests', () => {
  let resourceManager;
  let moduleFactory;
  let codeAnalysisModule;

  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Create module factory
    moduleFactory = new ModuleFactory(resourceManager);

    // Create and initialize Code Analysis Module
    codeAnalysisModule = await CodeAnalysisModule.create(resourceManager);
  });

  describe('Module Loading', () => {
    test('should load CodeAnalysisModule with proper name and initialization', () => {
      expect(codeAnalysisModule).toBeDefined();
      expect(codeAnalysisModule.name).toBe('CodeAnalysisModule');
      expect(codeAnalysisModule.initialized).toBe(true);
      expect(codeAnalysisModule.description).toContain('Code analysis tools');
    });

    test('should have all expected tools', () => {
      const tools = codeAnalysisModule.getTools();
      expect(tools).toBeDefined();
      expect(tools.length).toBeGreaterThan(0);

      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('validate_javascript');
    });

    test('should provide module metadata', () => {
      const metadata = codeAnalysisModule.getMetadata();
      expect(metadata.name).toBe('CodeAnalysisModule');
      expect(metadata.capabilities).toContain('JavaScript syntax validation');
      expect(metadata.capabilities).toContain('Security vulnerability scanning');
      expect(metadata.supportedFeatures).toContain('XSS and code injection detection');
    });
  });

  describe('ValidateJavaScriptTool', () => {
    let validateTool;

    beforeAll(() => {
      validateTool = codeAnalysisModule.getTool('validate_javascript');
      expect(validateTool).toBeDefined();
    });

    test('should validate correct JavaScript code', async () => {
      const result = await validateTool.execute({
        code: `
          function calculateTotal(items) {
            return items.reduce((sum, item) => sum + item.price, 0);
          }
          
          const result = calculateTotal([
            { name: 'Apple', price: 1.99 },
            { name: 'Banana', price: 0.99 }
          ]);
          
          console.log(result);
        `
      });

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.metrics.linesOfCode).toBeGreaterThan(0);
      expect(result.metrics.complexity).toBeGreaterThan(0);
    });

    test('should detect syntax errors', async () => {
      const result = await validateTool.execute({
        code: `
          function broken() {
            const x = 5
            const y = 10 // Missing semicolon above won't cause error, but this will:
            return x + 
          }
        `
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Syntax error');
    });

    test('should detect security issues - XSS vulnerabilities', async () => {
      const result = await validateTool.execute({
        code: `
          function displayUserInput(userInput) {
            // Dangerous: Direct innerHTML assignment with user input
            document.getElementById('output').innerHTML = userInput;
            
            // Also dangerous: document.write
            document.write(userInput);
          }
        `,
        checkSecurity: true
      });

      expect(result.valid).toBe(true); // Syntax is valid
      expect(result.securityIssues.length).toBeGreaterThan(0);
      
      const xssIssues = result.securityIssues.filter(issue => issue.type === 'xss');
      expect(xssIssues.length).toBeGreaterThan(0);
      expect(xssIssues[0].severity).toBe('high');
      expect(xssIssues[0].message).toContain('XSS');
    });

    test('should detect security issues - code injection', async () => {
      const result = await validateTool.execute({
        code: `
          function executeUserCode(userCode) {
            // Dangerous: eval usage
            eval(userCode);
            
            // Also dangerous: Function constructor
            const userFunction = new Function(userCode);
            userFunction();
            
            // String-based setTimeout
            setTimeout(userCode, 1000);
          }
        `,
        checkSecurity: true
      });

      expect(result.securityIssues.length).toBeGreaterThan(0);
      
      const injectionIssues = result.securityIssues.filter(issue => issue.type === 'codeInjection');
      expect(injectionIssues.length).toBeGreaterThan(0);
      expect(injectionIssues[0].severity).toBe('critical');
    });

    test('should detect performance issues', async () => {
      const result = await validateTool.execute({
        code: `
          function inefficientCode() {
            // Performance issue: DOM query in loop
            for (let i = 0; i < 100; i++) {
              document.querySelector('.item-' + i).style.display = 'none';
            }
            
            // Performance issue: function creation in loop
            for (let j = 0; j < 50; j++) {
              setTimeout(function() {
                console.log(j);
              }, j * 100);
            }
          }
        `,
        checkPerformance: true
      });

      expect(result.performanceIssues.length).toBeGreaterThan(0);
      
      const domQueryIssue = result.performanceIssues.find(issue => 
        issue.type === 'dom-query-in-loop'
      );
      expect(domQueryIssue).toBeDefined();
      expect(domQueryIssue.suggestion).toContain('Cache DOM elements');
    });

    test('should provide code quality warnings', async () => {
      const result = await validateTool.execute({
        code: `
          var globalVar = 'This is global';
          
          function veryLongFunction(param1, param2, param3, param4, param5, param6) {
            const unusedVariable = 42;
            
            // This function is intentionally long to trigger warnings
            ${Array(60).fill('console.log("Line");').join('\n            ')}
            
            return param1 + param2;
          }
          
          const magicNumber = 123456789;
        `,
        includeAnalysis: true
      });

      expect(result.warnings.length).toBeGreaterThan(0);
      
      // Check for various warnings
      const hasLongFunctionWarning = result.warnings.some(w => 
        w.includes('too long')
      );
      const hasTooManyParamsWarning = result.warnings.some(w => 
        w.includes('too many parameters')
      );
      const hasUnusedVariableWarning = result.warnings.some(w => 
        w.includes('unused')
      );
      const hasMagicNumberWarning = result.warnings.some(w => 
        w.includes('magic numbers')
      );

      expect(hasLongFunctionWarning).toBe(true);
      expect(hasTooManyParamsWarning).toBe(true);
      expect(hasUnusedVariableWarning).toBe(true);
      expect(hasMagicNumberWarning).toBe(true);
    });

    test('should calculate code metrics correctly', async () => {
      const result = await validateTool.execute({
        code: `
          // This is a comment
          function simpleFunction() {
            const x = 10;
            const y = 20;
            return x + y;
          }
          
          function complexFunction(value) {
            if (value > 10) {
              if (value > 20) {
                return 'large';
              } else {
                return 'medium';
              }
            } else if (value > 0) {
              return 'small';
            } else {
              return 'negative';
            }
          }
        `
      });

      expect(result.metrics.linesOfCode).toBeGreaterThan(10);
      expect(result.metrics.complexity).toBeGreaterThan(5); // Due to multiple if/else
      expect(result.metrics.maintainabilityIndex).toBeGreaterThan(0);
      expect(result.metrics.maintainabilityIndex).toBeLessThan(171);
    });

    test('should validate code from file path', async () => {
      // Create a temporary file path (not actually creating the file for this test)
      const filePath = path.join(__dirname, 'non-existent-file.js');
      
      const result = await validateTool.execute({
        filePath: filePath
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Failed to read file');
    });
  });

  describe('Codebase Analysis', () => {
    test('should analyze multiple JavaScript files', async () => {
      const codebaseSpec = {
        javascriptFiles: [
          {
            path: 'src/utils.js',
            code: `
              export function formatDate(date) {
                return new Date(date).toLocaleDateString();
              }
              
              export function formatCurrency(amount) {
                return '$' + amount.toFixed(2);
              }
            `
          },
          {
            path: 'src/api.js',
            code: `
              async function fetchData(url) {
                const response = await fetch(url);
                return response.json();
              }
              
              // Security issue: eval usage
              function processData(data) {
                eval(data.code);
              }
            `
          }
        ]
      };

      const result = await codeAnalysisModule.analyzeCodebase(codebaseSpec);

      expect(result.success).toBe(true);
      expect(result.results.javascript).toHaveLength(2);
      expect(result.results.summary.totalFiles).toBe(2);
      expect(result.results.summary.validFiles).toBe(2);
      expect(result.results.summary.securityIssues).toBeGreaterThan(0);
      
      // Check for recommendations
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
      
      const securityRecommendation = result.recommendations.find(r => 
        r.category === 'security'
      );
      expect(securityRecommendation).toBeDefined();
      expect(securityRecommendation.priority).toBe('high');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty code', async () => {
      const validateTool = codeAnalysisModule.getTool('validate_javascript');
      
      const result = await validateTool.execute({
        code: ''
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('No code provided');
    });

    test('should handle very large code complexity', async () => {
      const validateTool = codeAnalysisModule.getTool('validate_javascript');
      
      // Generate code with high complexity
      const complexCode = `
        function veryComplex(x) {
          ${Array(20).fill(0).map((_, i) => `
            if (x === ${i}) {
              return 'case${i}';
            } else if (x > ${i * 10}) {
              return x > ${i * 20} ? 'high${i}' : 'low${i}';
            }`).join('')}
          return 'default';
        }
      `;

      const result = await validateTool.execute({
        code: complexCode
      });

      expect(result.valid).toBe(true);
      expect(result.metrics.complexity).toBeGreaterThan(40);
      expect(result.metrics.maintainabilityIndex).toBeLessThan(50); // Low maintainability
    });
  });
});