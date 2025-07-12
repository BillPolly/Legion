import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ExecuteCommand } from '../../src/commands/ExecuteCommand.js';

describe('ExecuteCommand', () => {
  let executeCommand;
  let mockToolRegistry;
  let mockOutputFormatter;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    // Create mock ToolRegistry with moduleLoader
    mockToolRegistry = {
      getToolByName: jest.fn(),
      validateToolArguments: jest.fn(),
      executeTool: jest.fn(),
      convertArguments: jest.fn(),
      moduleLoader: {
        getModules: jest.fn().mockReturnValue(new Map([
          ['calculator', { name: 'calculator' }],
          ['file', { name: 'file' }],
          ['test', { name: 'test' }]
        ]))
      }
    };
    
    mockOutputFormatter = {
      format: jest.fn()
    };
    
    executeCommand = new ExecuteCommand(mockToolRegistry, mockOutputFormatter);
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('execute', () => {
    it('should execute tool successfully', async () => {
      const mockTool = {
        name: 'evaluate',
        module: 'calculator',
        description: 'Evaluate expression',
        parameters: {
          properties: {
            expression: { type: 'string' }
          }
        }
      };
      
      mockToolRegistry.getToolByName.mockReturnValue(mockTool);
      mockToolRegistry.validateToolArguments.mockReturnValue({ valid: true, errors: [] });
      mockToolRegistry.convertArguments.mockReturnValue({ expression: '2 + 2' });
      mockToolRegistry.executeTool.mockResolvedValue({ result: 4 });
      
      await executeCommand.execute({
        moduleName: 'calculator',
        toolName: 'evaluate',
        args: { expression: '2 + 2' },
        options: {}
      }, {});
      
      expect(mockToolRegistry.executeTool).toHaveBeenCalledWith(
        'calculator.evaluate',
        { expression: '2 + 2' },
        {}
      );
      expect(mockOutputFormatter.format).toHaveBeenCalledWith(
        { result: 4 },
        {}
      );
    });

    it('should handle module not found', async () => {
      await expect(executeCommand.execute({
        moduleName: 'unknown',
        toolName: 'tool',
        args: {},
        options: {}
      }, {})).rejects.toThrow('Module not found: unknown');
    });

    it('should handle tool not found', async () => {
      mockToolRegistry.getToolByName.mockReturnValue(null);
      
      await expect(executeCommand.execute({
        moduleName: 'calculator',
        toolName: 'unknown',
        args: {},
        options: {}
      }, {})).rejects.toThrow('Tool not found: calculator.unknown');
    });

    it('should handle validation errors with missing required params', async () => {
      const mockTool = {
        name: 'evaluate',
        module: 'calculator',
        parameters: {
          properties: {
            expression: { type: 'string' }
          }
        }
      };
      
      mockToolRegistry.getToolByName.mockReturnValue(mockTool);
      mockToolRegistry.validateToolArguments.mockReturnValue({
        valid: false,
        errors: ['Missing required parameter: expression']
      });
      
      await expect(executeCommand.execute({
        moduleName: 'calculator',
        toolName: 'evaluate',
        args: {},
        options: {}
      }, {})).rejects.toThrow('Missing required parameter: expression');
    });

    it('should handle validation errors with invalid arguments', async () => {
      const mockTool = {
        name: 'evaluate',
        module: 'calculator',
        parameters: {
          properties: {
            expression: { type: 'string' }
          }
        }
      };
      
      mockToolRegistry.getToolByName.mockReturnValue(mockTool);
      mockToolRegistry.validateToolArguments.mockReturnValue({
        valid: false,
        errors: ['Invalid type for parameter: expression']
      });
      
      await expect(executeCommand.execute({
        moduleName: 'calculator',
        toolName: 'evaluate',
        args: { expression: 123 },
        options: {}
      }, {})).rejects.toThrow('Invalid arguments provided');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('  - Invalid type for parameter: expression');
    });

    it('should handle unknown parameters with suggestions', async () => {
      const mockTool = {
        name: 'evaluate',
        module: 'calculator',
        parameters: {
          properties: {
            expression: { type: 'string' }
          }
        }
      };
      
      mockToolRegistry.getToolByName.mockReturnValue(mockTool);
      mockToolRegistry.validateToolArguments.mockReturnValue({ valid: true, errors: [] });
      
      await expect(executeCommand.execute({
        moduleName: 'calculator',
        toolName: 'evaluate',
        args: { expession: '2 + 2' }, // typo
        options: {}
      }, {})).rejects.toThrow('Unknown parameter: --expession');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('\nDid you mean: --expression?');
    });

    it('should handle unknown parameters without suggestions', async () => {
      const mockTool = {
        name: 'evaluate',
        module: 'calculator',
        parameters: {
          properties: {
            expression: { type: 'string' }
          }
        }
      };
      
      mockToolRegistry.getToolByName.mockReturnValue(mockTool);
      mockToolRegistry.validateToolArguments.mockReturnValue({ valid: true, errors: [] });
      
      await expect(executeCommand.execute({
        moduleName: 'calculator',
        toolName: 'evaluate',
        args: { unknown: 'value' },
        options: {}
      }, {})).rejects.toThrow('Unknown parameter: --unknown');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('\nAvailable parameters:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  --expression');
    });

    it('should handle execution errors', async () => {
      const mockTool = {
        name: 'evaluate',
        module: 'calculator',
        parameters: {
          properties: {
            expression: { type: 'string' }
          }
        }
      };
      
      mockToolRegistry.getToolByName.mockReturnValue(mockTool);
      mockToolRegistry.validateToolArguments.mockReturnValue({ valid: true, errors: [] });
      mockToolRegistry.convertArguments.mockReturnValue({ expression: '2 / 0' });
      mockToolRegistry.executeTool.mockRejectedValue(new Error('Division by zero'));
      
      await expect(executeCommand.execute({
        moduleName: 'calculator',
        toolName: 'evaluate',
        args: { expression: '2 / 0' },
        options: {}
      }, {})).rejects.toThrow('Division by zero');
    });

    it('should pass through all arguments to tool', async () => {
      const mockTool = {
        name: 'complex',
        module: 'test',
        parameters: {
          properties: {
            string: { type: 'string' },
            number: { type: 'number' },
            boolean: { type: 'boolean' },
            object: { type: 'object' },
            array: { type: 'array' }
          }
        }
      };
      
      const complexArgs = {
        string: 'value',
        number: 42,
        boolean: true,
        object: { nested: 'data' },
        array: [1, 2, 3]
      };
      
      mockToolRegistry.getToolByName.mockReturnValue(mockTool);
      mockToolRegistry.validateToolArguments.mockReturnValue({ valid: true, errors: [] });
      mockToolRegistry.convertArguments.mockReturnValue(complexArgs);
      mockToolRegistry.executeTool.mockResolvedValue({ success: true });
      
      await executeCommand.execute({
        moduleName: 'test',
        toolName: 'complex',
        args: complexArgs,
        options: {}
      }, {});
      
      expect(mockToolRegistry.executeTool).toHaveBeenCalledWith(
        'test.complex',
        complexArgs,
        {}
      );
    });
  });

  describe('findBestMatch', () => {
    it('should find exact match', () => {
      const match = executeCommand.findBestMatch('expression', ['expression', 'value', 'input']);
      expect(match).toBe('expression');
    });

    it('should find close match with typo', () => {
      const match = executeCommand.findBestMatch('expession', ['expression', 'value', 'input']);
      expect(match).toBe('expression');
    });

    it('should return null for no good match', () => {
      const match = executeCommand.findBestMatch('unknown', ['expression', 'value', 'input']);
      expect(match).toBeNull();
    });

    it('should handle empty candidates', () => {
      const match = executeCommand.findBestMatch('test', []);
      expect(match).toBeNull();
    });

    it('should handle null input', () => {
      const match = executeCommand.findBestMatch(null, ['test']);
      expect(match).toBeNull();
    });
  });

  describe('levenshteinDistance', () => {
    it('should calculate distance between strings', () => {
      expect(executeCommand.levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(executeCommand.levenshteinDistance('hello', 'hello')).toBe(0);
      expect(executeCommand.levenshteinDistance('abc', 'xyz')).toBe(3);
    });
  });
});