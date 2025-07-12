import { jest } from '@jest/globals';
import { InteractiveMode } from '../InteractiveMode.js';

describe('InteractiveMode', () => {
  let interactiveMode;
  let mockCli;
  let mockToolRegistry;
  let mockExecuteCommand;
  let mockReadline;

  beforeEach(() => {
    // Mock tool registry
    mockToolRegistry = {
      resolveTool: jest.fn(),
      getAllTools: jest.fn().mockReturnValue([])
    };
    
    // Mock execute command
    mockExecuteCommand = {
      execute: jest.fn().mockResolvedValue()
    };
    
    // Mock CLI with all required properties
    mockCli = {
      toolRegistry: mockToolRegistry,
      commands: {
        execute: mockExecuteCommand,
        help: { execute: jest.fn() },
        list: { execute: jest.fn() }
      },
      errorHandler: {
        handle: jest.fn()
      },
      argumentParser: {
        expandAlias: jest.fn((cmd) => cmd)  // Just return the command as-is
      }
    };
    
    // Mock readline interface
    mockReadline = {
      prompt: jest.fn(),
      on: jest.fn(),
      setPrompt: jest.fn(),
      close: jest.fn()
    };
    
    interactiveMode = new InteractiveMode(mockCli, null, null, null);
  });

  describe('parseInteractiveLine', () => {
    test('parses simple command with single argument', () => {
      const result = interactiveMode.parseInteractiveLine('calc 2+2');
      expect(result).toEqual(['calc', '2+2']);
    });

    test('parses command with quoted string', () => {
      const result = interactiveMode.parseInteractiveLine('write test.txt "hello world"');
      expect(result).toEqual(['write', 'test.txt', 'hello world']);
    });

    test('parses command with single quotes', () => {
      const result = interactiveMode.parseInteractiveLine("write test.txt 'hello world'");
      expect(result).toEqual(['write', 'test.txt', 'hello world']);
    });

    test('parses command with unquoted multiple words', () => {
      const result = interactiveMode.parseInteractiveLine('write test.txt hello world');
      expect(result).toEqual(['write', 'test.txt', 'hello', 'world']);
    });

    test('handles empty quotes', () => {
      const result = interactiveMode.parseInteractiveLine('write test.txt ""');
      expect(result).toEqual(['write', 'test.txt', '']);
    });

    test('handles mixed content', () => {
      const result = interactiveMode.parseInteractiveLine('write file.txt "quoted part" unquoted part');
      expect(result).toEqual(['write', 'file.txt', 'quoted part', 'unquoted', 'part']);
    });

    test('handles special characters in quotes', () => {
      const result = interactiveMode.parseInteractiveLine('write test.txt "hello\nworld\ttab"');
      expect(result).toEqual(['write', 'test.txt', 'hello\nworld\ttab']);
    });

    test('handles multiple spaces between arguments', () => {
      const result = interactiveMode.parseInteractiveLine('write   test.txt    hello     world');
      expect(result).toEqual(['write', 'test.txt', 'hello', 'world']);
    });
  });

  describe('processCommand with file operations', () => {
    const mockFileTool = {
      module: 'file',
      tool: { 
        name: 'file_write',
        invoke: jest.fn().mockResolvedValue({
          success: true,
          data: { filepath: 'test.txt', bytesWritten: 11 }
        })
      },
      metadata: {
        name: 'file_write',
        parameters: {
          properties: {
            filepath: { type: 'string' },
            content: { type: 'string' }
          },
          required: ['filepath', 'content']
        }
      }
    };

    beforeEach(() => {
      mockToolRegistry.resolveTool.mockReturnValue(mockFileTool);
    });

    test('handles write with quoted content', async () => {
      await interactiveMode.processCommand('write test.txt "hello world"', mockReadline, {});
      
      expect(mockExecuteCommand.execute).toHaveBeenCalledWith({
        moduleName: 'file',
        toolName: 'file_write',
        args: {
          filepath: 'test.txt',
          content: 'hello world'
        },
        options: {}
      }, {});
    });

    test('handles write with unquoted multi-word content', async () => {
      await interactiveMode.processCommand('write test.txt hello world this is content', mockReadline, {});
      
      expect(mockExecuteCommand.execute).toHaveBeenCalledWith({
        moduleName: 'file',
        toolName: 'file_write',
        args: {
          filepath: 'test.txt',
          content: 'hello world this is content'
        },
        options: {}
      }, {});
    });

    test('handles write with empty content', async () => {
      await interactiveMode.processCommand('write test.txt ""', mockReadline, {});
      
      expect(mockExecuteCommand.execute).toHaveBeenCalledWith({
        moduleName: 'file',
        toolName: 'file_write',
        args: {
          filepath: 'test.txt',
          content: ''
        },
        options: {}
      }, {});
    });

    test('handles mkdir command', async () => {
      const mockMkdirTool = {
        module: 'file',
        tool: { name: 'directory_create' },
        metadata: {
          name: 'directory_create',
          parameters: {
            properties: {
              dirpath: { type: 'string' }
            },
            required: ['dirpath']
          }
        }
      };
      
      mockToolRegistry.resolveTool.mockReturnValue(mockMkdirTool);
      
      await interactiveMode.processCommand('mkdir testdir', mockReadline, {});
      
      expect(mockExecuteCommand.execute).toHaveBeenCalledWith({
        moduleName: 'file',
        toolName: 'directory_create',
        args: {
          dirpath: 'testdir'
        },
        options: {}
      }, {});
    });

    test('handles read command', async () => {
      const mockReadTool = {
        module: 'file',
        tool: { name: 'file_read' },
        metadata: {
          name: 'file_read',
          parameters: {
            properties: {
              filepath: { type: 'string' }
            },
            required: ['filepath']
          }
        }
      };
      
      mockToolRegistry.resolveTool.mockReturnValue(mockReadTool);
      
      await interactiveMode.processCommand('read package.json', mockReadline, {});
      
      expect(mockExecuteCommand.execute).toHaveBeenCalledWith({
        moduleName: 'file',
        toolName: 'file_read',
        args: {
          filepath: 'package.json'
        },
        options: {}
      }, {});
    });

    test('handles calc command with expression', async () => {
      const mockCalcTool = {
        module: 'calculator',
        tool: { name: 'calculator_evaluate' },
        metadata: {
          name: 'calculator_evaluate',
          parameters: {
            properties: {
              expression: { type: 'string' }
            },
            required: ['expression']
          }
        }
      };
      
      mockToolRegistry.resolveTool.mockReturnValue(mockCalcTool);
      
      await interactiveMode.processCommand('calc (5+3)*2', mockReadline, {});
      
      expect(mockExecuteCommand.execute).toHaveBeenCalledWith({
        moduleName: 'calculator',
        toolName: 'calculator_evaluate',
        args: {
          expression: '(5+3)*2'
        },
        options: {}
      }, {});
    });
  });

  describe('positional argument edge cases', () => {
    test('handles tool with no parameters', async () => {
      const mockTool = {
        module: 'test',
        tool: { name: 'no_params' },
        metadata: {
          name: 'no_params',
          parameters: {
            properties: {},
            required: []
          }
        }
      };
      
      mockToolRegistry.resolveTool.mockReturnValue(mockTool);
      
      await interactiveMode.processCommand('no_params extra arguments', mockReadline, {});
      
      expect(mockExecuteCommand.execute).toHaveBeenCalledWith({
        moduleName: 'test',
        toolName: 'no_params',
        args: {},
        options: {}
      }, {});
    });

    test('handles tool with three parameters', async () => {
      const mockTool = {
        module: 'test',
        tool: { name: 'three_params' },
        metadata: {
          name: 'three_params',
          parameters: {
            properties: {
              first: { type: 'string' },
              second: { type: 'string' },
              third: { type: 'string' }
            },
            required: ['first', 'second', 'third']
          }
        }
      };
      
      mockToolRegistry.resolveTool.mockReturnValue(mockTool);
      
      await interactiveMode.processCommand('three_params one two three four five', mockReadline, {});
      
      expect(mockExecuteCommand.execute).toHaveBeenCalledWith({
        moduleName: 'test',
        toolName: 'three_params',
        args: {
          first: 'one',
          second: 'two',
          third: 'three four five'  // Last param gets remaining args
        },
        options: {}
      }, {});
    });

    test('handles named arguments mixed with positional', async () => {
      const mockTool = {
        module: 'test',
        tool: { name: 'mixed_args' },
        metadata: {
          name: 'mixed_args',
          parameters: {
            properties: {
              file: { type: 'string' },
              content: { type: 'string' },
              mode: { type: 'string' }
            }
          }
        }
      };
      
      mockToolRegistry.resolveTool.mockReturnValue(mockTool);
      
      await interactiveMode.processCommand('mixed_args test.txt --mode append some content here', mockReadline, {});
      
      expect(mockExecuteCommand.execute).toHaveBeenCalledWith({
        moduleName: 'test',
        toolName: 'mixed_args',
        args: {
          file: 'test.txt',
          mode: 'append',
          content: 'some content here'
        },
        options: {}
      }, {});
    });
  });
});