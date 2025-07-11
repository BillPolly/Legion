import { jest } from '@jest/globals';
import CLI from '../src/index.js';

describe('List Commands', () => {
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

  describe('list modules command', () => {
    beforeEach(() => {
      cli.command = 'list';
      cli.listType = 'modules';
    });

    it('should list all available modules', async () => {
      await cli.executeListCommand();
      
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('Available Modules');
      expect(output).toContain('calculator');
      expect(output).toContain('file');
    });

    it('should show module details', async () => {
      await cli.executeListCommand();
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      // Should show tool count
      expect(output).toMatch(/calculator.*1.*tool/i);
      expect(output).toMatch(/file.*3.*tools/i);
    });

    it('should display dependencies for modules that have them', async () => {
      cli.options = { verbose: true };
      
      await cli.executeListCommand();
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      // File module has dependencies
      expect(output).toContain('Dependencies:');
      expect(output).toContain('basePath');
      expect(output).toContain('encoding');
    });
  });

  describe('list tools command', () => {
    beforeEach(() => {
      cli.command = 'list';
      cli.listType = 'tools';
    });

    it('should list all available tools', async () => {
      await cli.executeListCommand();
      
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('Available Tools');
      expect(output).toContain('calculator.calculator_evaluate');
      expect(output).toContain('file.file_read');
      expect(output).toContain('file.file_write');
      expect(output).toContain('file.directory_create');
    });

    it('should show tool descriptions', async () => {
      await cli.executeListCommand();
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('Evaluates a mathematical expression');
      expect(output).toContain('Read the contents of a file');
    });

    it('should group tools by module', async () => {
      await cli.executeListCommand();
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      // Check that module headers appear
      expect(output).toMatch(/calculator:/i);
      expect(output).toMatch(/file:/i);
    });
  });

  describe('list all command', () => {
    beforeEach(() => {
      cli.command = 'list';
      cli.listType = 'all';
    });

    it('should list both modules and tools', async () => {
      await cli.executeListCommand();
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('Modules');
      expect(output).toContain('Tools');
      expect(output).toContain('calculator');
      expect(output).toContain('file.file_read');
    });
  });

  describe('list with filters', () => {
    it('should filter by module name', async () => {
      cli.command = 'list';
      cli.listType = 'tools';
      cli.args = { module: 'file' };
      
      await cli.executeListCommand();
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('file.file_read');
      expect(output).not.toContain('calculator.calculator_evaluate');
    });

    it('should handle non-existent module filter', async () => {
      cli.command = 'list';
      cli.listType = 'tools';
      cli.args = { module: 'nonexistent' };
      
      await cli.executeListCommand();
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('No tools found');
    });
  });

  describe('output formatting', () => {
    it('should output JSON when requested', async () => {
      cli.command = 'list';
      cli.listType = 'modules';
      cli.options = { output: 'json' };
      
      await cli.executeListCommand();
      
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const output = consoleSpy.mock.calls[0][0];
      
      // Should be valid JSON
      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.some(m => m.name === 'calculator')).toBe(true);
    });

    it('should use table format for modules', async () => {
      cli.command = 'list';
      cli.listType = 'modules';
      
      await cli.executeListCommand();
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      // Should have table headers
      expect(output).toMatch(/name.*tools.*dependencies/i);
      // Should have separator line
      expect(output).toContain('---');
    });
  });

  describe('summary statistics', () => {
    it('should show total counts', async () => {
      cli.command = 'list';
      cli.listType = 'all';
      
      await cli.executeListCommand();
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toMatch(/Total:.*2.*modules/i);
      expect(output).toMatch(/Total:.*4.*tools/i);
    });
  });
});