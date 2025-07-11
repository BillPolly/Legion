import { jest } from '@jest/globals';
import CLI from '../src/index.js';
import readline from 'readline';
import { EventEmitter } from 'events';

// Mock readline module
jest.mock('readline');

describe('Interactive Mode Autocomplete', () => {
  let cli;
  let mockRL;
  let consoleSpy;
  let completer;

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
      mockRL.emit('close');
    });
    mockRL.setPrompt = jest.fn();
    mockRL.question = jest.fn();
    mockRL.write = jest.fn();
    
    // Capture the completer function when createInterface is called
    readline.createInterface = jest.fn((options) => {
      completer = options.completer;
      return mockRL;
    });
    
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('module name autocomplete', () => {
    it('should complete partial module names', async () => {
      const promise = cli.executeInteractiveCommand();
      
      // Test completing 'calc' to 'calculator'
      const [completions, line] = await completer('calc');
      
      expect(completions).toContain('calculator');
      expect(line).toBe('calc');
      
      mockRL.emit('close');
      await promise;
    });

    it('should show all modules when no input given', async () => {
      const promise = cli.executeInteractiveCommand();
      
      const [completions, line] = await completer('');
      
      expect(completions).toContain('calculator');
      expect(completions).toContain('file');
      expect(completions).toContain('list');
      expect(completions).toContain('help');
      expect(completions).toContain('exit');
      expect(line).toBe('');
      
      mockRL.emit('close');
      await promise;
    });

    it('should handle exact module matches', async () => {
      const promise = cli.executeInteractiveCommand();
      
      const [completions, line] = await completer('calculator');
      
      expect(completions).toContain('calculator.');
      expect(line).toBe('calculator');
      
      mockRL.emit('close');
      await promise;
    });
  });

  describe('tool name autocomplete', () => {
    it('should complete tool names after module.', async () => {
      const promise = cli.executeInteractiveCommand();
      
      const [completions, line] = await completer('calculator.');
      
      expect(completions).toContain('calculator.calculator_evaluate');
      expect(line).toBe('calculator.');
      
      mockRL.emit('close');
      await promise;
    });

    it('should complete partial tool names', async () => {
      const promise = cli.executeInteractiveCommand();
      
      const [completions, line] = await completer('calculator.calc');
      
      expect(completions).toContain('calculator.calculator_evaluate');
      expect(line).toBe('calculator.calc');
      
      mockRL.emit('close');
      await promise;
    });

    it('should show all tools for a module', async () => {
      const promise = cli.executeInteractiveCommand();
      
      const [completions, line] = await completer('file.');
      
      expect(completions.some(c => c.startsWith('file.'))).toBe(true);
      expect(line).toBe('file.');
      
      mockRL.emit('close');
      await promise;
    });
  });

  describe('parameter name autocomplete', () => {
    it('should complete parameter names after tool', async () => {
      const promise = cli.executeInteractiveCommand();
      
      const [completions, line] = await completer('calculator.calculator_evaluate --');
      
      expect(completions).toContain('--expression');
      expect(line).toBe('calculator.calculator_evaluate --');
      
      mockRL.emit('close');
      await promise;
    });

    it('should complete partial parameter names', async () => {
      const promise = cli.executeInteractiveCommand();
      
      const [completions, line] = await completer('calculator.calculator_evaluate --exp');
      
      expect(completions).toContain('--expression');
      expect(line).toBe('calculator.calculator_evaluate --exp');
      
      mockRL.emit('close');
      await promise;
    });

    it('should not suggest already used parameters', async () => {
      const promise = cli.executeInteractiveCommand();
      
      const [completions, line] = await completer('calculator.calculator_evaluate --expression "2+2" --');
      
      expect(completions).not.toContain('--expression');
      expect(line).toBe('calculator.calculator_evaluate --expression "2+2" --');
      
      mockRL.emit('close');
      await promise;
    });
  });

  describe('command autocomplete', () => {
    it('should complete list commands', async () => {
      const promise = cli.executeInteractiveCommand();
      
      const [completions, line] = await completer('li');
      
      expect(completions).toContain('list');
      expect(line).toBe('li');
      
      mockRL.emit('close');
      await promise;
    });

    it('should complete list subcommands', async () => {
      const promise = cli.executeInteractiveCommand();
      
      const [completions, line] = await completer('list ');
      
      expect(completions).toContain('modules');
      expect(completions).toContain('tools');
      expect(completions).toContain('all');
      expect(line).toBe('list ');
      
      mockRL.emit('close');
      await promise;
    });

    it('should complete help command', async () => {
      const promise = cli.executeInteractiveCommand();
      
      const [completions, line] = await completer('hel');
      
      expect(completions).toContain('help');
      expect(line).toBe('hel');
      
      mockRL.emit('close');
      await promise;
    });

    it('should complete special commands', async () => {
      const promise = cli.executeInteractiveCommand();
      
      const [completions, line] = await completer('cle');
      
      expect(completions).toContain('clear');
      expect(line).toBe('cle');
      
      mockRL.emit('close');
      await promise;
    });
  });

  describe('context-aware completion', () => {
    it('should not complete in string literals', async () => {
      const promise = cli.executeInteractiveCommand();
      
      const [completions, line] = await completer('calculator.calculator_evaluate --expression "calc');
      
      expect(completions).toEqual([]);
      expect(line).toBe('calculator.calculator_evaluate --expression "calc');
      
      mockRL.emit('close');
      await promise;
    });

    it('should handle multiple completions', async () => {
      const promise = cli.executeInteractiveCommand();
      
      // If we have multiple modules starting with 'c', should return all
      const [completions, line] = await completer('c');
      
      expect(Array.isArray(completions)).toBe(true);
      expect(completions.some(c => c.startsWith('c'))).toBe(true);
      expect(line).toBe('c');
      
      mockRL.emit('close');
      await promise;
    });
  });

  describe('tab behavior', () => {
    it('should handle tab key for completion', async () => {
      const promise = cli.executeInteractiveCommand();
      
      // Start the REPL
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Simulate typing 'calc' and pressing tab
      mockRL.line = 'calc';
      mockRL.cursor = 4;
      
      // Get completions
      const [completions] = await completer('calc');
      
      // If only one completion, it should be applied
      if (completions.length === 1) {
        expect(completions[0]).toBe('calculator');
      }
      
      mockRL.emit('close');
      await promise;
    });
  });
});