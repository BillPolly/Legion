/**
 * @jest-environment jsdom
 */

import { CodeAnalysisCommands } from '../../../src/commands/CodeAnalysisCommands.js';

describe('Code Analysis Commands', () => {
  let codeAnalysisCommands;
  let mockContentScript;

  beforeEach(() => {
    // Setup content script mock
    mockContentScript = {
      getElement: jest.fn().mockImplementation((selector) => document.querySelector(selector)),
      getElements: jest.fn().mockImplementation((selector) => Array.from(document.querySelectorAll(selector))),
      sendMessage: jest.fn().mockResolvedValue({ success: true }),
      evaluateCode: jest.fn().mockImplementation((code) => {
        try {
          return { success: true, result: eval(code) };
        } catch (error) {
          return { success: false, error: error.message };
        }
      })
    };

    // Setup DOM with various script and style elements
    document.head.innerHTML = `
      <style id="main-styles">
        .container { display: flex; justify-content: center; }
        .old-browser { display: -webkit-box; -webkit-box-pack: center; }
        .performance-issue { 
          box-shadow: 0 0 10px rgba(0,0,0,0.5);
          filter: blur(2px);
          animation: spin 1s linear infinite;
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      </style>
      <link rel="stylesheet" href="external.css">
    `;
    
    document.body.innerHTML = `
      <div id="app">
        <script id="main-script">
          console.log("Hello World");
          var globalVar = "test";
          document.getElementById('test').innerHTML = userInput; // XSS vulnerability
          
          function performanceBottleneck() {
            for (let i = 0; i < 1000000; i++) {
              document.querySelector('.test');
            }
          }
          
          // Deprecated API usage
          document.attachEvent('onclick', function() {});
        </script>
        
        <script id="syntax-error-script">
          function broken() {
            console.log("missing semicolon"
            return "unclosed string;
          }
        </script>
        
        <script src="external.js"></script>
        
        <div id="dynamic-content"></div>
      </div>
    `;

    codeAnalysisCommands = new CodeAnalysisCommands(mockContentScript);
  });

  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('JavaScript Analysis', () => {
    test('should validate JavaScript syntax', async () => {
      const validCode = `
        function validFunction() {
          console.log("This is valid");
          return true;
        }
      `;

      const result = await codeAnalysisCommands.validateJavaScript(validCode, { 
        includeAnalysis: false 
      });

      expect(result).toEqual({
        success: true,
        analysis: {
          syntaxValid: true,
          errors: [],
          warnings: [],
          suggestions: expect.any(Array)
        }
      });
    });

    test('should detect JavaScript syntax errors', async () => {
      const invalidCode = `
        function invalidFunction() {
          console.log("missing semicolon"
          return "unclosed string;
        }
      `;

      const result = await codeAnalysisCommands.validateJavaScript(invalidCode, { 
        includeAnalysis: false 
      });

      expect(result).toEqual({
        success: true,
        analysis: {
          syntaxValid: false,
          errors: expect.arrayContaining([
            expect.objectContaining({
              type: 'syntax-error',
              message: expect.any(String),
              line: expect.any(Number)
            })
          ]),
          warnings: expect.any(Array),
          suggestions: expect.any(Array)
        }
      });
    });

    test('should detect security vulnerabilities', async () => {
      const vulnerableCode = `
        document.getElementById('output').innerHTML = userInput;
        eval(userData);
        document.write(content);
      `;

      const result = await codeAnalysisCommands.analyzeJSSecurity(vulnerableCode);

      expect(result).toEqual({
        success: true,
        security: {
          vulnerabilities: expect.arrayContaining([
            expect.objectContaining({
              type: 'xss-risk',
              severity: expect.stringMatching(/^(high|medium|low)$/),
              message: expect.any(String),
              line: expect.any(Number)
            }),
            expect.objectContaining({
              type: 'code-injection',
              severity: 'high',
              message: expect.any(String),
              line: expect.any(Number)
            })
          ]),
          score: expect.any(Number),
          recommendations: expect.any(Array)
        }
      });
    });

    test('should detect performance issues in JavaScript', async () => {
      const performantCode = `
        function performanceIssues() {
          // DOM query in loop
          for (let i = 0; i < 1000; i++) {
            document.querySelector('.item');
          }
          
          // Synchronous operations
          while (heavyComputation()) {
            processData();
          }
          
          // Memory leaks
          let cache = {};
          function addToCache(key, value) {
            cache[key] = value; // Never cleaned up
          }
        }
      `;

      const result = await codeAnalysisCommands.analyzeJSPerformance(performantCode);

      expect(result).toEqual({
        success: true,
        performance: {
          issues: expect.arrayContaining([
            expect.objectContaining({
              type: 'dom-query-in-loop',
              severity: expect.stringMatching(/^(high|medium|low)$/),
              message: expect.any(String),
              line: expect.any(Number)
            }),
            expect.objectContaining({
              type: 'potential-memory-leak',
              severity: expect.any(String),
              message: expect.any(String),
              line: expect.any(Number)
            })
          ]),
          score: expect.any(Number),
          recommendations: expect.any(Array)
        }
      });
    });

    test('should analyze JavaScript in DOM elements', async () => {
      const result = await codeAnalysisCommands.analyzePageJS();

      expect(result.success).toBe(true);
      expect(result.scripts).toEqual(expect.objectContaining({
        inline: expect.arrayContaining([
          expect.objectContaining({
            id: 'main-script',
            content: expect.any(String),
            analysis: expect.any(Object)
          })
        ]),
        external: expect.arrayContaining([
          expect.objectContaining({
            src: expect.stringContaining('external.js'),
            loaded: expect.any(Boolean),
            analysis: expect.any(Object)
          })
        ]),
        summary: expect.objectContaining({
          totalScripts: expect.any(Number),
          syntaxErrors: expect.any(Number),
          securityIssues: expect.any(Number),
          performanceIssues: expect.any(Number)
        })
      }));
    });
  });

  describe('CSS Analysis', () => {
    test('should validate CSS syntax', async () => {
      const validCSS = `
        .container {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        
        @media (max-width: 768px) {
          .container { flex-direction: column; }
        }
      `;

      const result = await codeAnalysisCommands.validateCSS(validCSS, { 
        includeAnalysis: false 
      });

      expect(result).toEqual({
        success: true,
        analysis: {
          syntaxValid: true,
          errors: [],
          warnings: [],
          suggestions: expect.any(Array)
        }
      });
    });

    test('should detect CSS syntax errors', async () => {
      const invalidCSS = `
        .container {
          display: flex
          justify-content: center;
          color: #invalid-color;
        }
        
        .unclosed {
          background: red;
      `;

      const result = await codeAnalysisCommands.validateCSS(invalidCSS, { 
        includeAnalysis: false 
      });

      expect(result).toEqual({
        success: true,
        analysis: {
          syntaxValid: false,
          errors: expect.arrayContaining([
            expect.objectContaining({
              type: 'syntax-error',
              message: expect.any(String),
              line: expect.any(Number)
            })
          ]),
          warnings: expect.any(Array),
          suggestions: expect.any(Array)
        }
      });
    });

    test('should check browser compatibility', async () => {
      const modernCSS = `
        .container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          backdrop-filter: blur(10px);
        }
      `;

      const result = await codeAnalysisCommands.analyzeCSSCompatibility(modernCSS);

      expect(result).toEqual({
        success: true,
        compatibility: {
          issues: expect.arrayContaining([
            expect.objectContaining({
              property: expect.any(String),
              support: expect.objectContaining({
                chrome: expect.any(String),
                firefox: expect.any(String),
                safari: expect.any(String),
                edge: expect.any(String)
              }),
              fallbacks: expect.any(Array)
            })
          ]),
          score: expect.any(Number),
          recommendations: expect.any(Array)
        }
      });
    });

    test('should detect CSS performance issues', async () => {
      const performantCSS = `
        .expensive {
          box-shadow: 0 0 50px rgba(0,0,0,0.8);
          filter: blur(10px) brightness(0.5);
          transform: rotate(45deg) scale(1.5);
        }
        
        * { 
          box-sizing: border-box; 
        }
        
        .reflow-cause {
          width: calc(100% - 10px);
          height: auto;
        }
      `;

      const result = await codeAnalysisCommands.analyzeCSSPerformance(performantCSS);

      expect(result).toEqual({
        success: true,
        performance: {
          issues: expect.arrayContaining([
            expect.objectContaining({
              type: expect.stringMatching(/^(expensive-property|universal-selector|layout-thrashing)$/),
              severity: expect.stringMatching(/^(high|medium|low)$/),
              property: expect.any(String),
              impact: expect.any(String),
              line: expect.any(Number)
            })
          ]),
          score: expect.any(Number),
          recommendations: expect.any(Array)
        }
      });
    });

    test('should analyze page CSS', async () => {
      const result = await codeAnalysisCommands.analyzePageCSS();

      expect(result.success).toBe(true);
      expect(result.stylesheets).toEqual(expect.objectContaining({
        inline: expect.arrayContaining([
          expect.objectContaining({
            id: 'main-styles',
            content: expect.any(String),
            analysis: expect.any(Object)
          })
        ]),
        external: expect.arrayContaining([
          expect.objectContaining({
            href: expect.stringContaining('external.css'),
            loaded: expect.any(Boolean),
            analysis: expect.any(Object)
          })
        ]),
        summary: expect.objectContaining({
          totalStylesheets: expect.any(Number),
          syntaxErrors: expect.any(Number),
          compatibilityIssues: expect.any(Number),
          performanceIssues: expect.any(Number)
        })
      }));
    });
  });

  describe('Code Quality Analysis', () => {
    test('should analyze code complexity', async () => {
      const complexCode = `
        function complexFunction(a, b, c, d, e) {
          if (a > 0) {
            if (b > 0) {
              if (c > 0) {
                if (d > 0) {
                  if (e > 0) {
                    return a + b + c + d + e;
                  } else {
                    return 0;
                  }
                }
              }
            }
          }
          return -1;
        }
      `;

      const result = await codeAnalysisCommands.analyzeComplexity(complexCode);

      expect(result).toEqual({
        success: true,
        complexity: {
          cyclomaticComplexity: expect.any(Number),
          cognitiveComplexity: expect.any(Number),
          maintainabilityIndex: expect.any(Number),
          issues: expect.arrayContaining([
            expect.objectContaining({
              type: 'high-complexity',
              metric: expect.any(String),
              value: expect.any(Number),
              threshold: expect.any(Number),
              suggestions: expect.any(Array)
            })
          ])
        }
      });
    });

    test('should detect code smells', async () => {
      const smellCode = `
        var globalVariable = "bad practice";
        
        function longFunction(a, b, c, d, e, f, g, h, i, j) {
          // Very long function with many parameters
          console.log(a, b, c, d, e, f, g, h, i, j);
          if (a) { console.log("a"); }
          if (b) { console.log("b"); }
          if (c) { console.log("c"); }
          if (d) { console.log("d"); }
          if (e) { console.log("e"); }
          if (f) { console.log("f"); }
          if (g) { console.log("g"); }
          if (h) { console.log("h"); }
          if (i) { console.log("i"); }
          if (j) { console.log("j"); }
          return a + b + c + d + e + f + g + h + i + j;
        }
        
        function duplicateLogic() {
          console.log("duplicate");
          return "result";
        }
        
        function anotherDuplicateLogic() {
          console.log("duplicate");
          return "result";
        }
      `;

      const result = await codeAnalysisCommands.detectCodeSmells(smellCode);

      expect(result).toEqual({
        success: true,
        smells: expect.arrayContaining([
          expect.objectContaining({
            type: expect.stringMatching(/^(long-parameter-list|global-variable|duplicate-code|long-function)$/),
            severity: expect.stringMatching(/^(high|medium|low)$/),
            message: expect.any(String),
            line: expect.any(Number),
            suggestions: expect.any(Array)
          })
        ]),
        score: expect.any(Number),
        recommendations: expect.any(Array)
      });
    });
  });

  describe('Command Integration', () => {
    test('should execute validate_javascript command', async () => {
      const result = await codeAnalysisCommands.executeCommand('validate_javascript', {
        code: 'console.log("Hello World");',
        includeAnalysis: true
      });

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
    });

    test('should execute validate_css command', async () => {
      const result = await codeAnalysisCommands.executeCommand('validate_css', {
        code: '.container { display: flex; }',
        checkCompatibility: true
      });

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
    });

    test('should execute analyze_page_code command', async () => {
      const result = await codeAnalysisCommands.executeCommand('analyze_page_code', {
        includeJS: true,
        includeCSS: true
      });

      expect(result.success).toBe(true);
      expect(result.analysis).toEqual(expect.objectContaining({
        javascript: expect.any(Object),
        css: expect.any(Object),
        summary: expect.any(Object)
      }));
    });

    test('should execute security_scan command', async () => {
      const result = await codeAnalysisCommands.executeCommand('security_scan', {
        scanJS: true,
        scanCSS: false
      });

      expect(result.success).toBe(true);
      expect(result.security).toBeDefined();
    });

    test('should handle invalid commands gracefully', async () => {
      const result = await codeAnalysisCommands.executeCommand('invalid_command', {});

      expect(result).toEqual({
        success: false,
        error: 'Unknown command: invalid_command'
      });
    });

    test('should validate command parameters', async () => {
      const result = await codeAnalysisCommands.executeCommand('validate_javascript', {
        code: null
      });

      expect(result).toEqual({
        success: false,
        error: 'Invalid parameters: code is required'
      });
    });
  });

  describe('Command Registration', () => {
    test('should register all code analysis commands', () => {
      const commands = codeAnalysisCommands.getRegisteredCommands();

      expect(commands).toEqual(expect.arrayContaining([
        'validate_javascript',
        'validate_css',
        'analyze_page_code',
        'security_scan',
        'performance_analysis'
      ]));
    });

    test('should provide command metadata', () => {
      const metadata = codeAnalysisCommands.getCommandMetadata('validate_javascript');

      expect(metadata).toEqual({
        name: 'validate_javascript',
        description: expect.any(String),
        parameters: expect.any(Array),
        examples: expect.any(Array)
      });
    });

    test('should validate command capabilities', () => {
      expect(codeAnalysisCommands.canExecuteCommand('validate_javascript')).toBe(true);
      expect(codeAnalysisCommands.canExecuteCommand('nonexistent_command')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle code analysis errors gracefully', async () => {
      // Mock the analyzeJSSecurity method to throw an error
      const originalAnalyzeJSSecurity = codeAnalysisCommands.analyzeJSSecurity;
      codeAnalysisCommands.analyzeJSSecurity = jest.fn().mockRejectedValue(new Error('Security analysis failed'));

      const result = await codeAnalysisCommands.validateJavaScript('console.log("test");', { includeAnalysis: true });

      // Restore the original method
      codeAnalysisCommands.analyzeJSSecurity = originalAnalyzeJSSecurity;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Code analysis error');
    });

    test('should handle malformed code input', async () => {
      const result = await codeAnalysisCommands.validateJavaScript(null);

      expect(result).toEqual({
        success: false,
        error: 'Invalid input: code is required'
      });
    });

    test('should handle large code input', async () => {
      const largeCode = 'console.log("test");'.repeat(10000);

      const result = await codeAnalysisCommands.validateJavaScript(largeCode);

      // Should either succeed with truncation or fail gracefully
      expect(result.success).toBeDefined();
      if (!result.success) {
        expect(result.error).toContain('Code too large');
      }
    });
  });
});