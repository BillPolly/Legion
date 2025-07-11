import { jest } from '@jest/globals';
import CLI from '../src/index.js';

describe('Tool Executor', () => {
  let cli;
  let mockExecute;

  beforeEach(async () => {
    cli = new CLI();
    await cli.loadConfiguration();
    await cli.initializeResourceManager();
    await cli.loadModules();
    cli.initializeModuleFactory();
    
    // Mock tool execution to avoid side effects
    mockExecute = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('executeTool', () => {
    it('should execute a tool with valid arguments', async () => {
      mockExecute.mockResolvedValue({ result: 42 });
      
      // Get the calculator tool and mock its execute method
      const tool = cli.getToolByName('calculator.calculator_evaluate');
      tool.instance.execute = mockExecute;
      
      const result = await cli.executeTool('calculator.calculator_evaluate', {
        expression: '40 + 2'
      });
      
      expect(mockExecute).toHaveBeenCalledWith({ expression: '40 + 2' });
      expect(result).toEqual({ result: 42 });
    });

    it('should throw error for non-existent tool', async () => {
      await expect(cli.executeTool('nonexistent.tool', {}))
        .rejects.toThrow('Tool not found: nonexistent.tool');
    });

    it('should handle tool execution errors', async () => {
      mockExecute.mockRejectedValue(new Error('Execution failed'));
      
      const tool = cli.getToolByName('calculator.calculator_evaluate');
      tool.instance.execute = mockExecute;
      
      await expect(cli.executeTool('calculator.calculator_evaluate', {}))
        .rejects.toThrow('Execution failed');
    });

    it('should handle async tool execution', async () => {
      mockExecute.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { result: 'async result' };
      });
      
      const tool = cli.getToolByName('calculator.calculator_evaluate');
      tool.instance.execute = mockExecute;
      
      const result = await cli.executeTool('calculator.calculator_evaluate', {
        expression: 'test'
      });
      
      expect(result).toEqual({ result: 'async result' });
    });
  });

  describe('validateToolArguments', () => {
    it('should validate required parameters', () => {
      const result = cli.validateToolArguments('calculator.calculator_evaluate', {});
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required parameter: 'expression'");
    });

    it('should validate parameter types', () => {
      const result = cli.validateToolArguments('calculator.calculator_evaluate', {
        expression: 123 // Should be string
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/Parameter 'expression' must be of type string/);
    });

    it('should pass validation with correct arguments', () => {
      const result = cli.validateToolArguments('calculator.calculator_evaluate', {
        expression: '2 + 2'
      });
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate enum values if specified', () => {
      // Mock a tool with enum parameter
      const mockTool = {
        parameters: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['add', 'subtract', 'multiply']
            }
          },
          required: ['mode']
        }
      };
      
      jest.spyOn(cli, 'getToolByName').mockReturnValue(mockTool);
      
      const result = cli.validateToolArguments('test.tool', {
        mode: 'divide' // Not in enum
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/Parameter 'mode' must be one of/);
    });
  });

  describe('convertArguments', () => {
    it('should convert string numbers to numbers', () => {
      const converted = cli.convertArguments('calculator.calculator_evaluate', {
        expression: '42'
      });
      
      // Expression should remain string for calculator
      expect(converted.expression).toBe('42');
    });

    it('should convert string booleans to booleans', () => {
      const mockTool = {
        parameters: {
          type: 'object',
          properties: {
            recursive: { type: 'boolean' }
          }
        }
      };
      
      jest.spyOn(cli, 'getToolByName').mockReturnValue(mockTool);
      
      const converted = cli.convertArguments('test.tool', {
        recursive: 'true'
      });
      
      expect(converted.recursive).toBe(true);
    });

    it('should handle array parameters', () => {
      const mockTool = {
        parameters: {
          type: 'object',
          properties: {
            items: { type: 'array' }
          }
        }
      };
      
      jest.spyOn(cli, 'getToolByName').mockReturnValue(mockTool);
      
      const converted = cli.convertArguments('test.tool', {
        items: ['a', 'b', 'c']
      });
      
      expect(Array.isArray(converted.items)).toBe(true);
      expect(converted.items).toEqual(['a', 'b', 'c']);
    });

    it('should parse JSON strings for object parameters', () => {
      const mockTool = {
        parameters: {
          type: 'object',
          properties: {
            config: { type: 'object' }
          }
        }
      };
      
      jest.spyOn(cli, 'getToolByName').mockReturnValue(mockTool);
      
      const converted = cli.convertArguments('test.tool', {
        config: '{"key": "value"}'
      });
      
      expect(converted.config).toEqual({ key: 'value' });
    });
  });

  describe('executeCommand integration', () => {
    beforeEach(() => {
      cli.command = 'execute';
      cli.moduleName = 'calculator';
      cli.toolName = 'calculator_evaluate';
      cli.args = { expression: '2 + 2' };
    });

    it('should execute tool command with validation', async () => {
      mockExecute.mockResolvedValue({ result: 4 });
      
      const tool = cli.getToolByName('calculator.calculator_evaluate');
      tool.instance.execute = mockExecute;
      
      jest.spyOn(cli, 'formatOutput').mockImplementation((result) => {
        console.log(JSON.stringify(result));
      });
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await cli.executeCommand();
      
      expect(mockExecute).toHaveBeenCalledWith({ expression: '2 + 2' });
      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify({ result: 4 }));
    });

    it('should handle validation errors', async () => {
      cli.args = {}; // Missing required parameter
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();
      
      try {
        await cli.run(['node', 'jsenvoy', 'calculator.calculator_evaluate']);
      } catch (error) {
        // Expected to throw
      }
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Missing required parameter: 'expression'"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('timeout handling', () => {
    it('should timeout long-running tools', async () => {
      cli.config.toolTimeout = 100; // 100ms timeout
      
      mockExecute.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return { result: 'should not reach' };
      });
      
      const tool = cli.getToolByName('calculator.calculator_evaluate');
      tool.instance.execute = mockExecute;
      
      await expect(cli.executeTool('calculator.calculator_evaluate', {
        expression: 'test'
      })).rejects.toThrow('Tool execution timeout');
    });

    it('should complete within timeout', async () => {
      cli.config.toolTimeout = 100; // 100ms timeout
      
      mockExecute.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { result: 'success' };
      });
      
      const tool = cli.getToolByName('calculator.calculator_evaluate');
      tool.instance.execute = mockExecute;
      
      const result = await cli.executeTool('calculator.calculator_evaluate', {
        expression: 'test'
      });
      
      expect(result).toEqual({ result: 'success' });
    });
  });
});