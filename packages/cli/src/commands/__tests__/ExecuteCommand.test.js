import { jest } from '@jest/globals';
import { ExecuteCommand } from '../ExecuteCommand.js';
import { ToolResult } from '@jsenvoy/modules';

describe('ExecuteCommand', () => {
  let executeCommand;
  let mockToolRegistry;
  let mockOutputFormatter;

  beforeEach(() => {
    mockToolRegistry = {
      resolveTool: jest.fn()
    };
    
    mockOutputFormatter = {
      format: jest.fn()
    };
    
    executeCommand = new ExecuteCommand(mockToolRegistry, mockOutputFormatter);
    
    // Mock console methods
    global.console.log = jest.fn();
    global.console.error = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('execute with file operations', () => {
    test('executes file_write with invoke method', async () => {
      const mockInvoke = jest.fn().mockResolvedValue(
        new ToolResult(true, { filepath: 'test.txt', bytesWritten: 11 })
      );
      
      const mockTool = {
        module: 'file',
        tool: {
          invoke: mockInvoke
        },
        metadata: {
          name: 'file_write',
          functionName: 'file_write'
        }
      };
      
      mockToolRegistry.resolveTool.mockReturnValue(mockTool);
      
      await executeCommand.execute({
        moduleName: 'file',
        toolName: 'file_write',
        args: {
          filepath: 'test.txt',
          content: 'hello world'
        }
      }, {});
      
      expect(mockInvoke).toHaveBeenCalledWith({
        function: {
          name: 'file_write',
          arguments: JSON.stringify({
            filepath: 'test.txt',
            content: 'hello world'
          })
        }
      });
      
      // Should not print ToolResult wrapper
      expect(console.log).not.toHaveBeenCalled();
    });

    test('executes ModularTool with execute method', async () => {
      const mockExecute = jest.fn().mockResolvedValue({
        content: 'File content here'
      });
      
      const mockTool = {
        module: 'file',
        tool: {
          execute: mockExecute
        },
        metadata: {
          name: 'file_read'
        }
      };
      
      mockToolRegistry.resolveTool.mockReturnValue(mockTool);
      
      await executeCommand.execute({
        moduleName: 'file',
        toolName: 'file_read',
        args: {
          filePath: 'test.txt'
        }
      }, {});
      
      expect(mockExecute).toHaveBeenCalledWith({
        filePath: 'test.txt'
      });
      
      expect(console.log).toHaveBeenCalledWith('File content here');
    });

    test('handles tool not found', async () => {
      mockToolRegistry.resolveTool.mockReturnValue(null);
      
      await executeCommand.execute({
        moduleName: 'file',
        toolName: 'nonexistent',
        args: {}
      }, {}).catch(error => {
        expect(error.message).toBe('Tool not found: nonexistent');
      });
    });

    test('handles tool execution errors', async () => {
      const mockTool = {
        module: 'file',
        tool: {
          invoke: jest.fn().mockRejectedValue(new Error('Write failed'))
        },
        metadata: {
          name: 'file_write',
          functionName: 'file_write'
        }
      };
      
      mockToolRegistry.resolveTool.mockReturnValue(mockTool);
      
      await executeCommand.execute({
        moduleName: 'file',
        toolName: 'file_write',
        args: {}
      }, {}).catch(error => {
        expect(error.message).toBe('Tool execution failed: Write failed');
      });
    });

    test('formats JSON output when requested', async () => {
      const mockTool = {
        module: 'calc',
        tool: {
          execute: jest.fn().mockResolvedValue({ result: 42 })
        },
        metadata: {
          name: 'calculator'
        }
      };
      
      mockToolRegistry.resolveTool.mockReturnValue(mockTool);
      
      await executeCommand.execute({
        moduleName: 'calc',
        toolName: 'calculator',
        args: { expression: '6*7' }
      }, { output: 'json' });
      
      expect(console.log).toHaveBeenCalledWith(JSON.stringify({ result: 42 }, null, 2));
    });

    test('handles ToolResult with error', async () => {
      const mockTool = {
        module: 'file',
        tool: {
          invoke: jest.fn().mockResolvedValue(
            new ToolResult(false, { filepath: 'test.txt' }, 'Permission denied')
          )
        },
        metadata: {
          name: 'file_write',
          functionName: 'file_write'
        }
      };
      
      mockToolRegistry.resolveTool.mockReturnValue(mockTool);
      
      await executeCommand.execute({
        moduleName: 'file',
        toolName: 'file_write',
        args: { filepath: 'test.txt', content: 'data' }
      }, {});
      
      expect(console.error).toHaveBeenCalledWith('Error: Permission denied');
      expect(console.error).toHaveBeenCalledWith('Details:', expect.any(String));
    });
  });

  describe('output formatting', () => {
    test('does not print successful ToolResult metadata', async () => {
      const mockTool = {
        module: 'file',
        tool: {
          invoke: jest.fn().mockResolvedValue(
            new ToolResult(true, { 
              filepath: 'test.txt', 
              bytesWritten: 11,
              created: true 
            })
          )
        },
        metadata: {
          name: 'file_write',
          functionName: 'file_write'
        }
      };
      
      mockToolRegistry.resolveTool.mockReturnValue(mockTool);
      
      await executeCommand.execute({
        moduleName: 'file',
        toolName: 'file_write',
        args: { filepath: 'test.txt', content: 'hello' }
      }, {});
      
      // Should not print anything for successful file operations
      expect(console.log).not.toHaveBeenCalled();
    });

    test('does not print calculator results (tool prints them)', async () => {
      const mockTool = {
        module: 'calculator',
        tool: {
          invoke: jest.fn().mockResolvedValue(
            new ToolResult(true, { 
              result: 10,
              expression: '5+5'
            })
          )
        },
        metadata: {
          name: 'calculator_evaluate',
          functionName: 'calculator_evaluate'
        }
      };
      
      mockToolRegistry.resolveTool.mockReturnValue(mockTool);
      
      await executeCommand.execute({
        moduleName: 'calculator',
        toolName: 'calculator_evaluate',
        args: { expression: '5+5' }
      }, {});
      
      // Should not print calculator results (calculator tool handles this)
      expect(console.log).not.toHaveBeenCalled();
    });
  });
});