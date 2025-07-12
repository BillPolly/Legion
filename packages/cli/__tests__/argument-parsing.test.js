import { InteractiveMode } from '../src/interactive/InteractiveMode.js';
import { jest } from '@jest/globals';

describe('Argument Parsing', () => {
  let interactiveMode;
  let mockCli;
  let mockToolRegistry;

  beforeEach(() => {
    // Mock the CLI and tool registry
    mockToolRegistry = {
      resolveTool: jest.fn(),
      getAllTools: jest.fn().mockReturnValue([])
    };
    
    mockCli = {
      toolRegistry: mockToolRegistry,
      commands: {
        execute: {
          execute: jest.fn()
        }
      },
      errorHandler: {
        handle: jest.fn()
      },
      argumentParser: {
        expandAlias: jest.fn(cmd => cmd)
      }
    };
    
    interactiveMode = new InteractiveMode(mockCli, null, null, null);
  });

  describe('parseInteractiveLine', () => {
    test('should parse simple command with arguments', () => {
      const result = interactiveMode.parseInteractiveLine('calc 2+2');
      expect(result).toEqual(['calc', '2+2']);
    });

    test('should parse command with quoted string', () => {
      const result = interactiveMode.parseInteractiveLine('write test.txt "hello world"');
      expect(result).toEqual(['write', 'test.txt', 'hello world']);
    });

    test('should parse command with unquoted multiple words', () => {
      const result = interactiveMode.parseInteractiveLine('write test.txt hello world');
      expect(result).toEqual(['write', 'test.txt', 'hello', 'world']);
    });

    test('should handle single quotes', () => {
      const result = interactiveMode.parseInteractiveLine("write test.txt 'hello world'");
      expect(result).toEqual(['write', 'test.txt', 'hello world']);
    });

    test('should handle mixed quotes', () => {
      const result = interactiveMode.parseInteractiveLine('write test.txt "hello \'world\'"');
      expect(result).toEqual(['write', 'test.txt', "hello 'world'"]);
    });
  });

  describe('positional argument mapping', () => {
    test('should map two arguments correctly', async () => {
      const mockTool = {
        module: 'file',
        tool: { name: 'file_write' },
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

      mockToolRegistry.resolveTool.mockReturnValue(mockTool);

      // Mock readline interface
      const mockRl = { prompt: jest.fn() };
      
      // Simulate processing the command
      await interactiveMode.processCommand('write test.txt "hello world"', mockRl, {});

      // Check that execute was called with correct arguments
      expect(mockCli.commands.execute.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          moduleName: 'file',
          toolName: 'file_write',
          args: {
            filepath: 'test.txt',
            content: 'hello world'
          }
        }),
        expect.any(Object)
      );
    });

    test('should join remaining args for last parameter', async () => {
      const mockTool = {
        module: 'file',
        tool: { name: 'file_write' },
        metadata: {
          name: 'file_write',
          parameters: {
            properties: {
              filepath: { type: 'string' },
              content: { type: 'string' }
            }
          }
        }
      };

      mockToolRegistry.resolveTool.mockReturnValue(mockTool);

      // Mock readline interface
      const mockRl = { prompt: jest.fn() };
      
      // Simulate processing the command without quotes
      await interactiveMode.processCommand('write test.txt hello world this is content', mockRl, {});

      // Check that execute was called with joined content
      expect(mockCli.commands.execute.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          args: {
            filepath: 'test.txt',
            content: 'hello world this is content'
          }
        }),
        expect.any(Object)
      );
    });
  });
});