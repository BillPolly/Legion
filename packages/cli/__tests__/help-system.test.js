import { jest } from '@jest/globals';
import CLI from '../src/index.js';

describe('Help System', () => {
  let cli;
  let consoleSpy;

  beforeEach(async () => {
    cli = new CLI();
    await cli.loadConfiguration();
    await cli.initializeResourceManager();
    await cli.loadModules();
    cli.initializeModuleFactory();
    
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('general help', () => {
    beforeEach(() => {
      cli.command = 'help';
      cli.helpTopic = undefined;
    });

    it('should show general help information', async () => {
      await cli.executeHelpCommand();
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('jsEnvoy CLI');
      expect(output).toContain('Usage:');
      expect(output).toContain('jsenvoy [options] <command> [arguments]');
    });

    it('should list available commands', async () => {
      await cli.executeHelpCommand();
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('Commands:');
      expect(output).toContain('list');
      expect(output).toContain('help');
      expect(output).toContain('interactive');
      expect(output).toContain('<module>.<tool>');
    });

    it('should show global options', async () => {
      await cli.executeHelpCommand();
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('Options:');
      expect(output).toContain('--verbose');
      expect(output).toContain('--output');
      expect(output).toContain('--no-color');
    });

    it('should show examples', async () => {
      await cli.executeHelpCommand();
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('Examples:');
      expect(output).toContain('jsenvoy calculator.calculator_evaluate --expression "2+2"');
      expect(output).toContain('jsenvoy list modules');
    });
  });

  describe('command-specific help', () => {
    it('should show help for list command', async () => {
      cli.command = 'help';
      cli.helpTopic = 'list';
      
      await cli.executeHelpCommand();
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('list command');
      expect(output).toContain('list modules');
      expect(output).toContain('list tools');
      expect(output).toContain('list all');
    });

    it('should show help for interactive command', async () => {
      cli.command = 'help';
      cli.helpTopic = 'interactive';
      
      await cli.executeHelpCommand();
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('Interactive mode');
      expect(output).toContain('REPL');
    });
  });

  describe('tool-specific help', () => {
    it('should show help for a specific tool', async () => {
      cli.command = 'help';
      cli.helpTopic = 'calculator.calculator_evaluate';
      
      await cli.executeHelpCommand();
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('calculator.calculator_evaluate');
      expect(output).toContain('Evaluates a mathematical expression');
      expect(output).toContain('Parameters:');
      expect(output).toContain('expression');
      expect(output).toContain('string');
      expect(output).toContain('required');
    });

    it('should show parameter details', async () => {
      cli.command = 'help';
      cli.helpTopic = 'file.file_reader';
      
      await cli.executeHelpCommand();
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('file.file_reader');
      expect(output).toContain('filePath');
      expect(output).toContain('The path to the file to read');
    });

    it('should show examples for the tool', async () => {
      cli.command = 'help';
      cli.helpTopic = 'calculator.calculator_evaluate';
      
      await cli.executeHelpCommand();
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('Examples:');
      expect(output).toContain('jsenvoy calculator.calculator_evaluate --expression');
    });
  });

  describe('module help', () => {
    it('should show help for a module', async () => {
      cli.command = 'help';
      cli.helpTopic = 'file';
      
      await cli.executeHelpCommand();
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('Module: file');
      expect(output).toContain('Tools:');
      expect(output).toContain('file_reader');
      expect(output).toContain('file_writer');
      expect(output).toContain('directory_creator');
    });

    it('should show module dependencies', async () => {
      cli.command = 'help';
      cli.helpTopic = 'file';
      
      await cli.executeHelpCommand();
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('Dependencies:');
      expect(output).toContain('basePath');
      expect(output).toContain('encoding');
    });
  });

  describe('error handling', () => {
    it('should handle unknown help topics', async () => {
      cli.command = 'help';
      cli.helpTopic = 'nonexistent';
      
      await cli.executeHelpCommand();
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('Unknown help topic');
      expect(output).toContain('nonexistent');
      expect(output).toContain('Available topics:');
    });

    it('should suggest similar topics for typos', async () => {
      cli.command = 'help';
      cli.helpTopic = 'calculater'; // Typo
      
      await cli.executeHelpCommand();
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('Did you mean:');
      expect(output).toContain('calculator');
    });
  });

  describe('help formatting', () => {
    it('should format help with proper sections', async () => {
      cli.command = 'help';
      
      await cli.executeHelpCommand();
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      // Check for section headers
      expect(output).toMatch(/Usage:/);
      expect(output).toMatch(/Commands:/);
      expect(output).toMatch(/Options:/);
      expect(output).toMatch(/Examples:/);
    });

    it('should use colors when enabled', async () => {
      cli.config.color = true;
      cli.command = 'help';
      
      await cli.executeHelpCommand();
      
      // Just verify it runs without error
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('help integration', () => {
    it('should be accessible via --help flag', () => {
      cli.parseArgs(['node', 'jsenvoy', '--help']);
      
      expect(cli.command).toBe('help');
    });

    it('should be accessible via -h flag', () => {
      cli.parseArgs(['node', 'jsenvoy', '-h']);
      
      expect(cli.command).toBe('help');
    });

    it('should show help for specific command with --help', () => {
      cli.parseArgs(['node', 'jsenvoy', 'list', '--help']);
      
      expect(cli.command).toBe('help');
      expect(cli.helpTopic).toBe('list');
    });
  });
});