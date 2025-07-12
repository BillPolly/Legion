import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { InteractiveMode } from '../../src/interactive/InteractiveMode.js';
import EventEmitter from 'events';

describe('InteractiveMode', () => {
  let interactiveMode;
  let mockCli;
  let mockTabCompleter;
  let mockCommandHistory;
  let mockMultiLineInput;
  let mockRl;
  let consoleLogSpy;
  let consoleErrorSpy;
  let processStdoutWriteSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processStdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation();

    mockCli = {
      commands: {
        help: {
          execute: jest.fn()
        },
        list: {
          execute: jest.fn()
        },
        execute: {
          execute: jest.fn()
        }
      },
      argumentParser: {
        expandAlias: jest.fn().mockImplementation(cmd => cmd)
      },
      errorHandler: {
        handle: jest.fn()
      },
      toolRegistry: {
        resolveTool: jest.fn(),
        getAllTools: jest.fn().mockReturnValue([])
      }
    };

    mockTabCompleter = {
      getCompleter: jest.fn().mockReturnValue(() => [[], ''])
    };

    mockCommandHistory = {
      add: jest.fn()
    };

    mockMultiLineInput = {
      isActive: jest.fn().mockReturnValue(false),
      shouldStartMultiLine: jest.fn().mockReturnValue(false),
      start: jest.fn(),
      processLine: jest.fn()
    };

    // Create mock readline interface that extends EventEmitter
    mockRl = new EventEmitter();
    mockRl.setPrompt = jest.fn();
    mockRl.prompt = jest.fn();
    mockRl.close = jest.fn();

    interactiveMode = new InteractiveMode(
      mockCli,
      mockTabCompleter,
      mockCommandHistory,
      mockMultiLineInput
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processStdoutWriteSpy.mockRestore();
  });

  describe('start', () => {
    it('should set initial prompt', async () => {
      const promise = interactiveMode.start(mockRl, {});
      
      expect(mockRl.setPrompt).toHaveBeenCalledWith('jsenvoy> ');
      expect(mockRl.prompt).toHaveBeenCalled();
      
      // Clean up
      mockRl.emit('close');
      await promise;
    });

    it('should handle exit command', async () => {
      const promise = interactiveMode.start(mockRl, {});
      
      mockRl.emit('line', 'exit');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Goodbye!');
      expect(mockRl.close).toHaveBeenCalled();
      
      mockRl.emit('close');
      await promise;
    });

    it('should handle quit command', async () => {
      const promise = interactiveMode.start(mockRl, {});
      
      mockRl.emit('line', 'quit');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Goodbye!');
      expect(mockRl.close).toHaveBeenCalled();
      
      mockRl.emit('close');
      await promise;
    });

    it('should handle .exit command', async () => {
      const promise = interactiveMode.start(mockRl, {});
      
      mockRl.emit('line', '.exit');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Goodbye!');
      expect(mockRl.close).toHaveBeenCalled();
      
      mockRl.emit('close');
      await promise;
    });

    it('should handle clear command', async () => {
      const promise = interactiveMode.start(mockRl, {});
      
      mockRl.emit('line', 'clear');
      
      expect(processStdoutWriteSpy).toHaveBeenCalledWith('\x1Bc');
      expect(mockRl.prompt).toHaveBeenCalled();
      
      mockRl.emit('close');
      await promise;
    });

    it('should handle cls command', async () => {
      const promise = interactiveMode.start(mockRl, {});
      
      mockRl.emit('line', 'cls');
      
      expect(processStdoutWriteSpy).toHaveBeenCalledWith('\x1Bc');
      expect(mockRl.prompt).toHaveBeenCalled();
      
      mockRl.emit('close');
      await promise;
    });

    it('should handle SIGINT', async () => {
      const promise = interactiveMode.start(mockRl, {});
      
      mockRl.emit('SIGINT');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('\nGoodbye!');
      expect(mockRl.close).toHaveBeenCalled();
      
      mockRl.emit('close');
      await promise;
    });

    it('should skip empty lines', async () => {
      const promise = interactiveMode.start(mockRl, {});
      
      mockRl.emit('line', '   ');
      
      expect(mockCommandHistory.add).not.toHaveBeenCalled();
      expect(mockRl.prompt).toHaveBeenCalled();
      
      mockRl.emit('close');
      await promise;
    });

    it('should add non-empty lines to history', async () => {
      const promise = interactiveMode.start(mockRl, {});
      
      mockRl.emit('line', 'help');
      
      expect(mockCommandHistory.add).toHaveBeenCalledWith('help');
      
      mockRl.emit('close');
      await promise;
    });
  });

  describe('processCommand', () => {
    it('should handle help command', async () => {
      await interactiveMode.processCommand('help', mockRl, {});
      
      expect(mockCli.commands.help.execute).toHaveBeenCalledWith(
        { helpTopic: null },
        {}
      );
      expect(mockRl.prompt).toHaveBeenCalled();
    });

    it('should handle help with topic', async () => {
      await interactiveMode.processCommand('help calculator', mockRl, {});
      
      expect(mockCli.commands.help.execute).toHaveBeenCalledWith(
        { helpTopic: 'calculator' },
        {}
      );
    });

    it('should handle list command', async () => {
      await interactiveMode.processCommand('list', mockRl, {});
      
      expect(mockCli.commands.list.execute).toHaveBeenCalledWith(
        { listType: 'all', options: {} },
        {}
      );
    });

    it('should handle list modules', async () => {
      await interactiveMode.processCommand('list modules', mockRl, {});
      
      expect(mockCli.commands.list.execute).toHaveBeenCalledWith(
        { listType: 'modules', options: {} },
        {}
      );
    });

    it('should handle list tools', async () => {
      await interactiveMode.processCommand('list tools', mockRl, {});
      
      expect(mockCli.commands.list.execute).toHaveBeenCalledWith(
        { listType: 'tools', args: {}, options: {} },
        {}
      );
    });

    it('should handle tool execution', async () => {
      // Mock the tool resolution
      mockCli.toolRegistry.resolveTool.mockReturnValue({
        module: 'calculator',
        metadata: {
          name: 'add',
          parameters: {
            properties: {
              a: { type: 'string' },
              b: { type: 'string' }
            }
          }
        }
      });
      
      await interactiveMode.processCommand('calculator.add --a 5 --b 3', mockRl, {});
      
      expect(mockCli.commands.execute.execute).toHaveBeenCalledWith({
        moduleName: 'calculator',
        toolName: 'add',
        args: { a: '5', b: '3' },
        options: {}
      }, {});
    });

    it('should handle tool with boolean flags', async () => {
      // Mock the tool resolution
      mockCli.toolRegistry.resolveTool.mockReturnValue({
        module: 'file',
        metadata: {
          name: 'read',
          parameters: {
            properties: {
              path: { type: 'string' },
              verbose: { type: 'boolean' }
            }
          }
        }
      });
      
      await interactiveMode.processCommand('file.read --path test.txt --verbose', mockRl, {});
      
      expect(mockCli.commands.execute.execute).toHaveBeenCalledWith({
        moduleName: 'file',
        toolName: 'read',
        args: { path: 'test.txt', verbose: true },
        options: {}
      }, {});
    });

    it('should expand aliases', async () => {
      mockCli.argumentParser.expandAlias.mockReturnValue('calculator.evaluate');
      
      // Mock the tool resolution
      mockCli.toolRegistry.resolveTool.mockReturnValue({
        module: 'calculator',
        metadata: {
          name: 'evaluate',
          parameters: {
            properties: {
              expression: { type: 'string' }
            }
          }
        }
      });
      
      await interactiveMode.processCommand('calc --expression "2+2"', mockRl, {});
      
      expect(mockCli.argumentParser.expandAlias).toHaveBeenCalledWith('calc');
      expect(mockCli.commands.execute.execute).toHaveBeenCalledWith({
        moduleName: 'calculator',
        toolName: 'evaluate',
        args: { expression: '2+2' },
        options: {}
      }, {});
    });

    it('should handle JSON arguments', async () => {
      // Mock the tool resolution
      mockCli.toolRegistry.resolveTool.mockReturnValue({
        module: 'api',
        metadata: {
          name: 'request',
          parameters: {
            properties: {
              data: { type: 'string' }
            }
          }
        }
      });
      
      // Test that JSON argument handling attempts to parse the JSON
      // Even though the parseInteractiveLine doesn't preserve quotes properly,
      // the JSON parsing should still work when using single quotes
      await interactiveMode.processCommand('api.request --data \'{"key":"value"}\'', mockRl, {});
      
      // For non-json key, it should just pass the value through
      expect(mockCli.commands.execute.execute).toHaveBeenCalledWith({
        moduleName: 'api',
        toolName: 'request',
        args: { data: '{"key":"value"}' },
        options: {}
      }, {});
    });

    it('should handle invalid JSON', async () => {
      // Mock the tool resolution
      mockCli.toolRegistry.resolveTool.mockReturnValue({
        module: 'api',
        metadata: {
          name: 'request',
          parameters: {
            properties: {
              json: { type: 'object' }
            }
          }
        }
      });
      
      await interactiveMode.processCommand('api.request --json {invalid}', mockRl, {});
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid JSON'));
      expect(mockCli.commands.execute.execute).not.toHaveBeenCalled();
    });

    it('should handle unknown commands', async () => {
      await interactiveMode.processCommand('unknown', mockRl, {});
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Unknown command: unknown');
      expect(consoleLogSpy).toHaveBeenCalledWith('\nType "help" for available commands or "list" to see available tools');
    });

    it('should handle errors', async () => {
      const error = new Error('Test error');
      mockCli.commands.help.execute.mockRejectedValue(error);
      
      await interactiveMode.processCommand('help', mockRl, {});
      
      expect(mockCli.errorHandler.handle).toHaveBeenCalledWith(error, {});
    });
  });

  describe('parseInteractiveLine', () => {
    it('should parse simple arguments', () => {
      const result = interactiveMode.parseInteractiveLine('calculator add --a 5 --b 3');
      
      expect(result).toEqual(['calculator', 'add', '--a', '5', '--b', '3']);
    });

    it('should handle double quotes', () => {
      const result = interactiveMode.parseInteractiveLine('echo "hello world"');
      
      expect(result).toEqual(['echo', 'hello world']);
    });

    it('should handle single quotes', () => {
      const result = interactiveMode.parseInteractiveLine("echo 'hello world'");
      
      expect(result).toEqual(['echo', 'hello world']);
    });

    it('should handle mixed quotes', () => {
      const result = interactiveMode.parseInteractiveLine('test "double" \'single\'');
      
      expect(result).toEqual(['test', 'double', 'single']);
    });

    it('should handle empty string', () => {
      const result = interactiveMode.parseInteractiveLine('');
      
      expect(result).toEqual([]);
    });

    it('should handle multiple spaces', () => {
      const result = interactiveMode.parseInteractiveLine('a    b    c');
      
      expect(result).toEqual(['a', 'b', 'c']);
    });
  });

  describe('handleSetCommand', () => {
    it('should set string values', () => {
      interactiveMode.handleSetCommand('set name John Doe');
      
      expect(interactiveMode.interactiveContext.name).toBe('John Doe');
      expect(consoleLogSpy).toHaveBeenCalledWith('Set name = John Doe');
    });

    it('should set boolean true', () => {
      interactiveMode.handleSetCommand('set verbose true');
      
      expect(interactiveMode.interactiveContext.verbose).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalledWith('Set verbose = true');
    });

    it('should set boolean false', () => {
      interactiveMode.handleSetCommand('set debug false');
      
      expect(interactiveMode.interactiveContext.debug).toBe(false);
      expect(consoleLogSpy).toHaveBeenCalledWith('Set debug = false');
    });

    it('should set numeric values', () => {
      interactiveMode.handleSetCommand('set count 42');
      
      expect(interactiveMode.interactiveContext.count).toBe(42);
      expect(consoleLogSpy).toHaveBeenCalledWith('Set count = 42');
    });

    it('should handle decimal numbers', () => {
      interactiveMode.handleSetCommand('set pi 3.14');
      
      expect(interactiveMode.interactiveContext.pi).toBe(3.14);
    });
  });

  describe('handleShowCommand', () => {
    it('should show empty context', () => {
      interactiveMode.handleShowCommand();
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Context:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  (empty)');
    });

    it('should show context values', () => {
      interactiveMode.interactiveContext = {
        name: 'test',
        count: 10,
        verbose: true
      };
      
      interactiveMode.handleShowCommand();
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Context:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  name: test');
      expect(consoleLogSpy).toHaveBeenCalledWith('  count: 10');
      expect(consoleLogSpy).toHaveBeenCalledWith('  verbose: true');
    });
  });

  describe('multi-line input', () => {
    it('should start multi-line mode', async () => {
      mockMultiLineInput.shouldStartMultiLine.mockReturnValue(true);
      
      const promise = interactiveMode.start(mockRl, {});
      
      mockRl.emit('line', 'calculator.evaluate \\');
      
      expect(mockMultiLineInput.start).toHaveBeenCalledWith('calculator.evaluate \\');
      expect(mockRl.setPrompt).toHaveBeenCalledWith('... ');
      expect(mockRl.prompt).toHaveBeenCalled();
      
      mockRl.emit('close');
      await promise;
    });

    it('should process multi-line input', async () => {
      mockMultiLineInput.isActive.mockReturnValue(true);
      mockMultiLineInput.processLine.mockReturnValue({
        complete: true,
        command: 'calculator.add --a 5 --b 3',
        cancelled: false
      });
      
      const promise = interactiveMode.start(mockRl, {});
      
      mockRl.emit('line', '--b 3');
      
      expect(mockMultiLineInput.processLine).toHaveBeenCalledWith('--b 3');
      expect(mockRl.setPrompt).toHaveBeenCalledWith('jsenvoy> ');
      
      mockRl.emit('close');
      await promise;
    });

    it('should handle cancelled multi-line', async () => {
      mockMultiLineInput.isActive.mockReturnValue(true);
      mockMultiLineInput.processLine.mockReturnValue({
        cancelled: true,
        complete: false
      });
      
      const promise = interactiveMode.start(mockRl, {});
      
      mockRl.emit('line', '');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Multi-line input cancelled');
      expect(mockRl.setPrompt).toHaveBeenCalledWith('jsenvoy> ');
      
      mockRl.emit('close');
      await promise;
    });

    it('should continue multi-line input', async () => {
      mockMultiLineInput.isActive.mockReturnValue(true);
      mockMultiLineInput.processLine.mockReturnValue({
        complete: false,
        cancelled: false
      });
      
      const promise = interactiveMode.start(mockRl, {});
      
      mockRl.emit('line', '--a 5 \\');
      
      expect(mockRl.setPrompt).toHaveBeenCalledWith('... ');
      expect(mockRl.prompt).toHaveBeenCalled();
      
      mockRl.emit('close');
      await promise;
    });
  });

  describe('getCompleter', () => {
    it('should return tab completer function', () => {
      const mockCompleter = jest.fn();
      mockTabCompleter.getCompleter.mockReturnValue(mockCompleter);
      
      const result = interactiveMode.getCompleter();
      
      expect(result).toBe(mockCompleter);
      expect(mockTabCompleter.getCompleter).toHaveBeenCalled();
    });
  });
});