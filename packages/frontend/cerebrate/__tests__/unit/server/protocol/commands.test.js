import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DebugCommands } from '../../../../src/server/protocol/commands.js';

describe('DebugCommands', () => {
  let debugCommands;
  let mockAgent;
  let mockContext;

  beforeEach(() => {
    mockAgent = {
      execute: jest.fn(),
      isIdle: jest.fn().mockReturnValue(true),
      getStatus: jest.fn().mockReturnValue({ status: 'ready' })
    };

    mockContext = {
      sessionId: 'test-session-001',
      timestamp: new Date()
    };

    debugCommands = new DebugCommands({
      agent: mockAgent
    });
  });

  describe('Inspect Element Command Processing', () => {
    test('should process inspect_element command with CSS selector', async () => {
      const expectedResult = {
        element: {
          tag: 'div',
          id: 'test-element',
          classes: ['container', 'main'],
          attributes: { 'data-test': 'value' }
        },
        styles: {
          computed: { display: 'flex', color: 'red' },
          inline: { margin: '10px' }
        },
        position: { x: 100, y: 200, width: 300, height: 150 }
      };

      mockAgent.execute.mockResolvedValue({
        success: true,
        data: expectedResult
      });

      const result = await debugCommands.inspectElement(
        { selector: '#test-element' },
        mockContext
      );

      expect(mockAgent.execute).toHaveBeenCalledWith({
        command: 'dom_inspector',
        parameters: {
          action: 'inspect',
          selector: '#test-element',
          includeStyles: true,
          includePosition: true,
          includeAttributes: true
        },
        context: mockContext
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expectedResult);
    });

    test('should process inspect_element with XPath selector', async () => {
      const result = await debugCommands.inspectElement(
        { selector: '//div[@class="test"]', selectorType: 'xpath' },
        mockContext
      );

      expect(mockAgent.execute).toHaveBeenCalledWith({
        command: 'dom_inspector',
        parameters: {
          action: 'inspect',
          selector: '//div[@class="test"]',
          selectorType: 'xpath',
          includeStyles: true,
          includePosition: true,
          includeAttributes: true
        },
        context: mockContext
      });
    });

    test('should handle inspect_element with custom options', async () => {
      const options = {
        includeStyles: false,
        includeChildren: true,
        maxDepth: 2
      };

      await debugCommands.inspectElement(
        { selector: '.test', ...options },
        mockContext
      );

      expect(mockAgent.execute).toHaveBeenCalledWith({
        command: 'dom_inspector',
        parameters: {
          action: 'inspect',
          selector: '.test',
          includeStyles: false,
          includeChildren: true,
          maxDepth: 2,
          includePosition: true,
          includeAttributes: true
        },
        context: mockContext
      });
    });

    test('should validate inspect_element parameters', async () => {
      await expect(debugCommands.inspectElement(
        { /* missing selector */ },
        mockContext
      )).rejects.toThrow('selector is required');

      await expect(debugCommands.inspectElement(
        { selector: '' },
        mockContext
      )).rejects.toThrow('selector cannot be empty');
    });
  });

  describe('Analyze JavaScript Command Handling', () => {
    test('should analyze JavaScript errors', async () => {
      const errorInfo = {
        message: 'Cannot read property of undefined',
        stack: 'Error: Cannot read property...\n  at Object.handler',
        file: 'app.js',
        line: 42,
        column: 15
      };

      mockAgent.execute.mockResolvedValue({
        success: true,
        data: {
          analysis: {
            error_type: 'TypeError',
            root_cause: 'accessing undefined variable',
            suggestions: ['Check variable initialization', 'Add null checks']
          },
          source_context: {
            code: 'const value = obj.property;',
            line_number: 42
          }
        }
      });

      const result = await debugCommands.analyzeJavaScript(
        { type: 'error', error: errorInfo },
        mockContext
      );

      expect(mockAgent.execute).toHaveBeenCalledWith({
        command: 'js_analyzer',
        parameters: {
          action: 'analyze_error',
          error: errorInfo,
          includeSourceContext: true,
          provideSuggestions: true
        },
        context: mockContext
      });

      expect(result.success).toBe(true);
      expect(result.data.analysis.error_type).toBe('TypeError');
    });

    test('should analyze JavaScript performance', async () => {
      const performanceData = {
        functions: [
          { name: 'slowFunction', executionTime: 1500, callCount: 10 },
          { name: 'fastFunction', executionTime: 50, callCount: 100 }
        ]
      };

      await debugCommands.analyzeJavaScript(
        { type: 'performance', data: performanceData },
        mockContext
      );

      expect(mockAgent.execute).toHaveBeenCalledWith({
        command: 'js_analyzer',
        parameters: {
          action: 'analyze_performance',
          data: performanceData,
          includeOptimizations: true,
          generateReport: true
        },
        context: mockContext
      });
    });

    test('should validate JavaScript analysis parameters', async () => {
      await expect(debugCommands.analyzeJavaScript(
        { /* missing type */ },
        mockContext
      )).rejects.toThrow('type is required');

      await expect(debugCommands.analyzeJavaScript(
        { type: 'invalid_type' },
        mockContext
      )).rejects.toThrow('Invalid analysis type');
    });
  });

  describe('Debug Error Command Execution', () => {
    test('should debug console errors', async () => {
      const consoleError = {
        level: 'error',
        message: 'Uncaught ReferenceError: variable is not defined',
        source: 'main.js:25:10',
        timestamp: new Date().toISOString()
      };

      mockAgent.execute.mockResolvedValue({
        success: true,
        data: {
          error_analysis: {
            type: 'ReferenceError',
            variable: 'variable',
            scope_analysis: 'Variable not declared in current scope'
          },
          fix_suggestions: [
            'Declare variable before use',
            'Check spelling of variable name',
            'Ensure variable is in scope'
          ]
        }
      });

      const result = await debugCommands.debugError(
        { type: 'console', error: consoleError },
        mockContext
      );

      expect(mockAgent.execute).toHaveBeenCalledWith({
        command: 'error_debugger',
        parameters: {
          action: 'debug_console_error',
          error: consoleError,
          includeScope: true,
          provideFixes: true
        },
        context: mockContext
      });

      expect(result.success).toBe(true);
      expect(result.data.error_analysis.type).toBe('ReferenceError');
    });

    test('should debug network errors', async () => {
      const networkError = {
        url: 'https://api.example.com/data',
        status: 404,
        statusText: 'Not Found',
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      };

      await debugCommands.debugError(
        { type: 'network', error: networkError },
        mockContext
      );

      expect(mockAgent.execute).toHaveBeenCalledWith({
        command: 'error_debugger',
        parameters: {
          action: 'debug_network_error',
          error: networkError,
          checkEndpoint: true,
          analyzeCors: true
        },
        context: mockContext
      });
    });

    test('should debug runtime errors with stack trace', async () => {
      const runtimeError = {
        name: 'TypeError',
        message: 'Cannot read property "length" of null',
        stack: 'TypeError: Cannot read property "length" of null\n    at process (app.js:15:20)\n    at main (app.js:8:5)'
      };

      await debugCommands.debugError(
        { type: 'runtime', error: runtimeError },
        mockContext
      );

      expect(mockAgent.execute).toHaveBeenCalledWith({
        command: 'error_debugger',
        parameters: {
          action: 'debug_runtime_error',
          error: runtimeError,
          analyzeStack: true,
          includeSourceMap: true
        },
        context: mockContext
      });
    });

    test('should validate debug error parameters', async () => {
      await expect(debugCommands.debugError(
        { /* missing type */ },
        mockContext
      )).rejects.toThrow('type is required');

      await expect(debugCommands.debugError(
        { type: 'invalid' },
        mockContext
      )).rejects.toThrow('Invalid error type');

      await expect(debugCommands.debugError(
        { type: 'console', /* missing error */ },
        mockContext
      )).rejects.toThrow('error is required');
    });
  });

  describe('Command Parameter Validation', () => {
    test('should validate required parameters', async () => {
      const commands = [
        { method: 'inspectElement', params: {} },
        { method: 'analyzeJavaScript', params: {} },
        { method: 'debugError', params: {} }
      ];

      for (const { method, params } of commands) {
        await expect(debugCommands[method](params, mockContext))
          .rejects.toThrow();
      }
    });

    test('should handle null or undefined parameters', async () => {
      await expect(debugCommands.inspectElement(null, mockContext))
        .rejects.toThrow('parameters are required');

      await expect(debugCommands.analyzeJavaScript(undefined, mockContext))
        .rejects.toThrow('parameters are required');
    });

    test('should validate parameter types', async () => {
      await expect(debugCommands.inspectElement(
        { selector: 123 }, // should be string
        mockContext
      )).rejects.toThrow('selector must be a string');

      await expect(debugCommands.analyzeJavaScript(
        { type: 'error', error: 'not-an-object' }, // should be object
        mockContext
      )).rejects.toThrow('error must be an object');
    });
  });

  describe('Command Context Handling', () => {
    test('should handle missing context', async () => {
      mockAgent.execute.mockResolvedValue({ success: true, data: {} });

      await debugCommands.inspectElement(
        { selector: '.test' }
        // missing context parameter
      );

      expect(mockAgent.execute).toHaveBeenCalledWith({
        command: 'dom_inspector',
        parameters: expect.any(Object),
        context: undefined
      });
    });

    test('should pass through context metadata', async () => {
      const richContext = {
        sessionId: 'test-session-001',
        userId: 'user-123',
        timestamp: new Date(),
        requestId: 'req-456',
        metadata: { debug: true }
      };

      mockAgent.execute.mockResolvedValue({ success: true, data: {} });

      await debugCommands.inspectElement(
        { selector: '.test' },
        richContext
      );

      expect(mockAgent.execute).toHaveBeenCalledWith({
        command: 'dom_inspector',
        parameters: expect.any(Object),
        context: richContext
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle agent execution failures', async () => {
      const agentError = new Error('Agent processing failed');
      mockAgent.execute.mockRejectedValue(agentError);

      await expect(debugCommands.inspectElement(
        { selector: '.test' },
        mockContext
      )).rejects.toThrow('Agent processing failed');
    });

    test('should handle agent returning error responses', async () => {
      mockAgent.execute.mockResolvedValue({
        success: false,
        error: 'Element not found',
        code: 'ELEMENT_NOT_FOUND'
      });

      const result = await debugCommands.inspectElement(
        { selector: '.missing' },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Element not found');
      expect(result.code).toBe('ELEMENT_NOT_FOUND');
    });

    test('should handle timeout errors', async () => {
      const timeoutError = new Error('Operation timed out');
      timeoutError.code = 'TIMEOUT';
      mockAgent.execute.mockRejectedValue(timeoutError);

      await expect(debugCommands.analyzeJavaScript(
        { type: 'performance', data: {} },
        mockContext
      )).rejects.toThrow('Operation timed out');
    });
  });

  describe('Command Registration and Discovery', () => {
    test('should register all supported commands', () => {
      const supportedCommands = debugCommands.getSupportedCommands();

      expect(supportedCommands).toContain('inspect_element');
      expect(supportedCommands).toContain('analyze_javascript');
      expect(supportedCommands).toContain('debug_error');
    });

    test('should provide command metadata', () => {
      const metadata = debugCommands.getCommandMetadata('inspect_element');

      expect(metadata).toEqual({
        name: 'inspect_element',
        description: 'Inspect DOM element with detailed analysis',
        parameters: {
          selector: { type: 'string', required: true, description: 'CSS selector or XPath' },
          selectorType: { type: 'string', required: false, description: 'Selector type: css or xpath' },
          includeStyles: { type: 'boolean', required: false, description: 'Include computed styles' },
          includeChildren: { type: 'boolean', required: false, description: 'Include child elements' },
          maxDepth: { type: 'number', required: false, description: 'Maximum depth for children' }
        },
        returns: {
          element: { type: 'object', description: 'Element information' },
          styles: { type: 'object', description: 'Style information' },
          position: { type: 'object', description: 'Element position and dimensions' }
        }
      });
    });

    test('should return null for unknown command metadata', () => {
      const metadata = debugCommands.getCommandMetadata('unknown_command');
      expect(metadata).toBeNull();
    });
  });
});