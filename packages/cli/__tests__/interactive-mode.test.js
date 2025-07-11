import { jest } from '@jest/globals';
import CLI from '../src/index.js';
import readline from 'readline';
import { EventEmitter } from 'events';

// Mock readline module
jest.mock('readline');

describe('Interactive Mode', () => {
  let cli;
  let mockRL;
  let consoleSpy;
  let exitSpy;

  beforeEach(async () => {
    cli = new CLI();
    await cli.loadConfiguration();
    await cli.initializeResourceManager();
    await cli.loadModules();
    cli.initializeModuleFactory();
    
    // Create mock readline interface
    mockRL = new EventEmitter();
    mockRL.prompt = jest.fn();
    mockRL.close = jest.fn(() => {
      // Emit close event when close() is called
      mockRL.emit('close');
    });
    mockRL.setPrompt = jest.fn();
    mockRL.question = jest.fn();
    
    // Mock readline.createInterface
    readline.createInterface = jest.fn().mockReturnValue(mockRL);
    
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    exitSpy = jest.spyOn(process, 'exit').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('REPL initialization', () => {
    it('should create readline interface', async () => {
      const promise = cli.executeInteractiveCommand();
      
      expect(readline.createInterface).toHaveBeenCalledWith({
        input: process.stdin,
        output: process.stdout,
        prompt: expect.any(String),
        completer: expect.any(Function)
      });
      
      // Simulate exit
      mockRL.emit('close');
      await promise;
    });

    it('should show welcome message', async () => {
      const promise = cli.executeInteractiveCommand();
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Interactive Mode'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Type "help" for commands'));
      
      mockRL.emit('close');
      await promise;
    });

    it('should set appropriate prompt', async () => {
      const promise = cli.executeInteractiveCommand();
      
      expect(mockRL.setPrompt).toHaveBeenCalledWith('jsenvoy> ');
      expect(mockRL.prompt).toHaveBeenCalled();
      
      mockRL.emit('close');
      await promise;
    });
  });

  describe('command handling', () => {
    it('should execute tool commands', async () => {
      const promise = cli.executeInteractiveCommand();
      
      // Mock tool execution
      jest.spyOn(cli, 'executeTool').mockResolvedValue({ result: 42 });
      jest.spyOn(cli, 'formatOutput').mockImplementation();
      
      // Simulate user input
      mockRL.emit('line', 'calculator.calculator_evaluate --expression "40+2"');
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(cli.executeTool).toHaveBeenCalledWith('calculator.calculator_evaluate', {
        expression: '40+2'
      });
      expect(cli.formatOutput).toHaveBeenCalledWith({ result: 42 });
      expect(mockRL.prompt).toHaveBeenCalled();
      
      mockRL.emit('close');
      await promise;
    });

    it('should handle list commands', async () => {
      const promise = cli.executeInteractiveCommand();
      
      jest.spyOn(cli, 'listModules').mockResolvedValue();
      
      mockRL.emit('line', 'list modules');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(cli.listModules).toHaveBeenCalled();
      
      mockRL.emit('close');
      await promise;
    });

    it('should handle help commands', async () => {
      const promise = cli.executeInteractiveCommand();
      
      jest.spyOn(cli, 'showGeneralHelp').mockResolvedValue();
      
      mockRL.emit('line', 'help');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(cli.showGeneralHelp).toHaveBeenCalled();
      
      mockRL.emit('close');
      await promise;
    });

    it('should handle exit commands', async () => {
      const promise = cli.executeInteractiveCommand();
      
      mockRL.emit('line', 'exit');
      
      await promise;
      
      expect(mockRL.close).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Goodbye!');
    });

    it('should handle quit command', async () => {
      const promise = cli.executeInteractiveCommand();
      
      mockRL.emit('line', 'quit');
      
      await promise;
      
      expect(mockRL.close).toHaveBeenCalled();
    });

    it('should handle .exit command', async () => {
      const promise = cli.executeInteractiveCommand();
      
      mockRL.emit('line', '.exit');
      
      await promise;
      
      expect(mockRL.close).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle command errors gracefully', async () => {
      const promise = cli.executeInteractiveCommand();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      jest.spyOn(cli, 'executeTool').mockRejectedValue(new Error('Tool error'));
      
      mockRL.emit('line', 'calculator.calculator_evaluate');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(errorSpy).toHaveBeenCalledWith('Error:', 'Tool error');
      expect(mockRL.prompt).toHaveBeenCalled(); // Should continue prompting
      
      errorSpy.mockRestore();
      mockRL.emit('close');
      await promise;
    });

    it('should handle unknown commands', async () => {
      const promise = cli.executeInteractiveCommand();
      
      mockRL.emit('line', 'unknown command');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown command'));
      expect(mockRL.prompt).toHaveBeenCalled();
      
      mockRL.emit('close');
      await promise;
    });
  });

  describe('special commands', () => {
    it('should clear screen with clear command', async () => {
      const promise = cli.executeInteractiveCommand();
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation();
      
      mockRL.emit('line', 'clear');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(writeSpy).toHaveBeenCalledWith('\x1Bc');
      
      writeSpy.mockRestore();
      mockRL.emit('close');
      await promise;
    });

    it('should clear screen with cls command', async () => {
      const promise = cli.executeInteractiveCommand();
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation();
      
      mockRL.emit('line', 'cls');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(writeSpy).toHaveBeenCalledWith('\x1Bc');
      
      writeSpy.mockRestore();
      mockRL.emit('close');
      await promise;
    });
  });

  describe('SIGINT handling', () => {
    it('should handle Ctrl+C gracefully', async () => {
      const promise = cli.executeInteractiveCommand();
      
      mockRL.emit('SIGINT');
      
      await promise;
      
      expect(consoleSpy).toHaveBeenCalledWith('\nGoodbye!');
      expect(mockRL.close).toHaveBeenCalled();
    });
  });

  describe('session state', () => {
    it('should maintain context between commands', async () => {
      const promise = cli.executeInteractiveCommand();
      
      // Set a context variable
      mockRL.emit('line', 'set verbose true');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(cli.interactiveContext.verbose).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('Set verbose = true');
      
      mockRL.emit('close');
      await promise;
    });

    it('should show context with show command', async () => {
      const promise = cli.executeInteractiveCommand();
      
      cli.interactiveContext = { test: 'value' };
      
      mockRL.emit('line', 'show');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Context:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test: value'));
      
      mockRL.emit('close');
      await promise;
    });
  });

  describe('history', () => {
    it('should add commands to history', async () => {
      const promise = cli.executeInteractiveCommand();
      
      expect(cli.commandHistory).toBeDefined();
      expect(cli.commandHistory).toEqual([]);
      
      mockRL.emit('line', 'list modules');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(cli.commandHistory).toContain('list modules');
      
      mockRL.emit('close');
      await promise;
    });

    it('should not add empty commands to history', async () => {
      const promise = cli.executeInteractiveCommand();
      
      mockRL.emit('line', '');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(cli.commandHistory).toEqual([]);
      
      mockRL.emit('close');
      await promise;
    });

    it('should limit history size', async () => {
      const promise = cli.executeInteractiveCommand();
      
      // Add many commands
      for (let i = 0; i < 105; i++) {
        cli.commandHistory.push(`command ${i}`);
      }
      
      mockRL.emit('line', 'new command');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(cli.commandHistory.length).toBeLessThanOrEqual(100);
      expect(cli.commandHistory[cli.commandHistory.length - 1]).toBe('new command');
      
      mockRL.emit('close');
      await promise;
    });
  });
});