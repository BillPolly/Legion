import { jest } from '@jest/globals';
import CLI from '../src/index.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Advanced Features', () => {
  let cli;
  let consoleSpy;

  beforeEach(async () => {
    cli = new CLI();
    
    // Mock console before loading configuration to prevent output
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    await cli.loadConfiguration();
    await cli.initializeResourceManager();
    await cli.loadModules();
    cli.initializeModuleFactory();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('command aliases', () => {
    it('should support built-in aliases', async () => {
      // Test common alias 'ls' for 'list'
      cli.parseArgs(['node', 'jsenvoy', 'ls', 'modules']);
      
      expect(cli.command).toBe('list');
      expect(cli.listType).toBe('modules');
    });

    it('should load aliases from configuration', async () => {
      cli.config.aliases = {
        'calc': 'calculator.calculator_evaluate',
        'eval': 'calculator.calculator_evaluate --expression'
      };
      
      // Should expand 'calc' to full command
      cli.parseArgs(['node', 'jsenvoy', 'calc', '--expression', '2+2']);
      expect(cli.command).toBe('execute');
      expect(cli.moduleName).toBe('calculator');
      expect(cli.toolName).toBe('calculator_evaluate');
    });

    it('should support aliases with default arguments', async () => {
      cli.config.aliases = {
        'eval': 'calculator.calculator_evaluate --expression'
      };
      
      // Should expand and merge arguments
      cli.parseArgs(['node', 'jsenvoy', 'eval', '"2+2"']);
      expect(cli.args.expression).toBe('2+2');
    });

    it('should handle nested aliases', async () => {
      cli.config.aliases = {
        'calc': 'calculator.calculator_evaluate',
        'c': 'calc'
      };
      
      cli.parseArgs(['node', 'jsenvoy', 'c', '--expression', '2+2']);
      expect(cli.command).toBe('execute');
      expect(cli.moduleName).toBe('calculator');
    });

    it('should prevent circular aliases', async () => {
      cli.config.aliases = {
        'a': 'b',
        'b': 'c',
        'c': 'a'
      };
      
      expect(() => {
        cli.parseArgs(['node', 'jsenvoy', 'a']);
      }).toThrow('Circular alias detected');
    });

    it('should list available aliases', async () => {
      // Set up aliases before loading config
      const configBackup = cli.config;
      cli.config = {
        ...configBackup,
        aliases: {
          'calc': 'calculator.calculator_evaluate',
          'eval': 'calculator.calculator_evaluate --expression'
        }
      };
      
      // Call listAliases directly to avoid full run
      await cli.listAliases();
      
      // Check all the console output
      const allOutput = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).toContain('Available Aliases');
      expect(allOutput).toContain('calc');
      expect(allOutput).toContain('calculator.calculator_evaluate');
      expect(allOutput).toContain('ls'); // built-in alias
      expect(allOutput).toContain('list'); // built-in alias target
    });
  });

  describe('command chaining', () => {
    it('should execute multiple commands with &&', async () => {
      const mockExecute = jest.fn()
        .mockResolvedValueOnce({ result: 4 })
        .mockResolvedValueOnce({ result: 16 });
      
      // Mock the executeTool method
      jest.spyOn(cli, 'executeTool').mockImplementation(async (toolName, args) => {
        return mockExecute(args);
      });
      
      // Mock getToolByName to return a valid tool
      jest.spyOn(cli, 'getToolByName').mockReturnValue({
        instance: { execute: mockExecute },
        parameters: { 
          properties: { expression: { type: 'string' } },
          required: ['expression']
        }
      });
      
      await cli.run(['node', 'jsenvoy', 'calculator.calculator_evaluate', '--expression', '2+2', '&&', 
                     'calculator.calculator_evaluate', '--expression', '4*4']);
      
      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(mockExecute).toHaveBeenCalledWith({ expression: '2+2' });
      expect(mockExecute).toHaveBeenCalledWith({ expression: '4*4' });
    });

    it('should stop chain on error with &&', async () => {
      const mockExecute = jest.fn()
        .mockRejectedValueOnce(new Error('First command failed'))
        .mockResolvedValueOnce({ result: 'should not reach' });
      
      // Mock executeTool to use our mock
      jest.spyOn(cli, 'executeTool').mockImplementation(async (toolName, args) => {
        return mockExecute(args);
      });
      
      // Mock getToolByName
      jest.spyOn(cli, 'getToolByName').mockReturnValue({
        instance: { execute: mockExecute },
        parameters: { properties: {}, required: [] }
      });
      
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();
      
      await cli.run(['node', 'jsenvoy', 'test.fail', '&&', 'test.succeed']);
      
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should execute all commands with ;', async () => {
      const mockExecute = jest.fn()
        .mockRejectedValueOnce(new Error('First command failed'))
        .mockResolvedValueOnce({ result: 'success' });
      
      // Mock executeTool
      jest.spyOn(cli, 'executeTool').mockImplementation(async (toolName, args) => {
        return mockExecute(args);
      });
      
      // Mock getToolByName
      jest.spyOn(cli, 'getToolByName').mockReturnValue({
        instance: { execute: mockExecute },
        parameters: { properties: {}, required: [] }
      });
      
      // Mock process.exit to prevent test from exiting
      jest.spyOn(process, 'exit').mockImplementation();
      
      await cli.run(['node', 'jsenvoy', 'test.fail', ';', 'test.succeed']);
      
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });
  });

  describe('batch file execution', () => {
    it('should execute commands from a file', async () => {
      const batchFile = path.join(os.tmpdir(), 'test-batch.jsenvoy');
      await fs.writeFile(batchFile, `
# Comment line
calculator.calculator_evaluate --expression "2+2"
list modules
# Another comment
help calculator
      `.trim());
      
      // Track commands executed
      const executedCommands = [];
      
      // Mock CLI.run to track commands
      const originalRun = CLI.prototype.run;
      CLI.prototype.run = jest.fn(async function(argv) {
        executedCommands.push(argv.slice(2).join(' '));
        return 0;
      });
      
      await cli.run(['node', 'jsenvoy', '--batch', batchFile]);
      
      expect(executedCommands).toContain('calculator.calculator_evaluate --expression 2+2');
      expect(executedCommands).toContain('list modules');
      expect(executedCommands).toContain('help calculator');
      expect(executedCommands).toHaveLength(3);
      
      // Restore original run method
      CLI.prototype.run = originalRun;
      
      await fs.unlink(batchFile);
    });

    it('should skip empty lines and comments in batch files', async () => {
      const batchFile = path.join(os.tmpdir(), 'test-batch-comments.jsenvoy');
      await fs.writeFile(batchFile, `
# This is a comment

calculator.calculator_evaluate --expression "2+2"

# Another comment
# More comments
      `.trim());
      
      // Track commands executed
      const executedCommands = [];
      
      // Mock CLI.run to track commands
      const originalRun = CLI.prototype.run;
      CLI.prototype.run = jest.fn(async function(argv) {
        executedCommands.push(argv.slice(2).join(' '));
        return 0;
      });
      
      await cli.run(['node', 'jsenvoy', '--batch', batchFile]);
      
      expect(executedCommands).toHaveLength(1);
      expect(executedCommands[0]).toBe('calculator.calculator_evaluate --expression 2+2');
      
      // Restore original run method
      CLI.prototype.run = originalRun;
      
      await fs.unlink(batchFile);
    });

    it('should support batch files with aliases', async () => {
      // Track commands executed
      const executedCommands = [];
      
      // Mock CLI.run to track commands and use aliases
      const originalRun = CLI.prototype.run;
      CLI.prototype.run = jest.fn(async function(argv) {
        // Set aliases on the new instance
        this.config = { aliases: { 'calc': 'calculator.calculator_evaluate --expression' } };
        executedCommands.push(argv.slice(2).join(' '));
        return 0;
      });
      
      const batchFile = path.join(os.tmpdir(), 'test-batch-aliases.jsenvoy');
      await fs.writeFile(batchFile, 'calc "10 * 10"');
      
      await cli.run(['node', 'jsenvoy', '--batch', batchFile]);
      
      expect(executedCommands).toHaveLength(1);
      expect(executedCommands[0]).toBe('calc "10 * 10"');
      
      // Restore original run method
      CLI.prototype.run = originalRun;
      
      await fs.unlink(batchFile);
    });

    it('should handle batch file errors gracefully', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await cli.run(['node', 'jsenvoy', '--batch', '/nonexistent/file.jsenvoy']);
      
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error reading batch file'));
    });
  });

  describe('environment presets', () => {
    it('should load environment presets', async () => {
      cli.config.presets = {
        'dev': {
          verbose: true,
          output: 'json',
          resources: {
            API_URL: 'http://localhost:3000'
          }
        },
        'prod': {
          verbose: false,
          output: 'text',
          resources: {
            API_URL: 'https://api.example.com'
          }
        }
      };
      
      // Mock listModules to prevent actual execution
      jest.spyOn(cli, 'listModules').mockImplementation();
      
      await cli.run(['node', 'jsenvoy', '--preset', 'dev', 'list', 'modules']);
      
      expect(cli.options.verbose).toBe(true);
      expect(cli.options.output).toBe('json');
      // Check that resources would be applied
      expect(cli.config.resources.API_URL).toBe('http://localhost:3000');
    });

    it('should override preset values with CLI arguments', async () => {
      cli.config.presets = {
        'dev': {
          verbose: true,
          output: 'json'
        }
      };
      
      await cli.run(['node', 'jsenvoy', '--preset', 'dev', '--output', 'text', 'help']);
      
      expect(cli.options.verbose).toBe(true);
      expect(cli.options.output).toBe('text'); // CLI arg overrides preset
    });

    it('should list available presets', async () => {
      cli.config.presets = {
        'dev': { verbose: true },
        'prod': { verbose: false },
        'test': { output: 'json' }
      };
      
      await cli.run(['node', 'jsenvoy', 'list', 'presets']);
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Available Presets'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('dev'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('prod'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test'));
    });

    it('should error on unknown preset', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await cli.run(['node', 'jsenvoy', '--preset', 'unknown', 'help']);
      
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown preset: unknown'));
    });
  });

  describe('interactive mode aliases', () => {
    it('should expand aliases in interactive mode', async () => {
      const readline = await import('readline');
      const { EventEmitter } = await import('events');
      
      jest.doMock('readline', () => ({
        createInterface: jest.fn(() => {
          const mockRL = new EventEmitter();
          mockRL.prompt = jest.fn();
          mockRL.close = jest.fn(() => mockRL.emit('close'));
          mockRL.setPrompt = jest.fn();
          return mockRL;
        })
      }));
      
      cli.config.aliases = {
        'calc': 'calculator.calculator_evaluate --expression'
      };
      
      const mockRL = readline.createInterface();
      const mockExecute = jest.fn().mockResolvedValue({ result: 42 });
      cli.executeTool = mockExecute;
      
      const promise = cli.executeInteractiveCommand();
      
      // Use alias in interactive mode
      mockRL.emit('line', 'calc "6 * 7"');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockExecute).toHaveBeenCalledWith('calculator.calculator_evaluate', { expression: '6 * 7' });
      
      mockRL.emit('close');
      await promise;
    });
  });
});