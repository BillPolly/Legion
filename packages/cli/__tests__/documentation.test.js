import { jest } from '@jest/globals';
import CLI from '../src/index.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Documentation and Examples', () => {
  let cli;
  let consoleSpy;

  beforeEach(() => {
    cli = new CLI();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('documentation generation', () => {
    it('should generate comprehensive help documentation', async () => {
      await cli.showGeneralHelp();
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      // Should include all major sections
      expect(output).toContain('jsEnvoy CLI');
      expect(output).toContain('Usage:');
      expect(output).toContain('Commands:');
      expect(output).toContain('Options:');
      expect(output).toContain('Examples:');
    });

    it('should generate tool-specific documentation', async () => {
      await cli.loadConfiguration();
      await cli.initializeResourceManager();
      await cli.loadModules();
      cli.initializeModuleFactory();
      
      await cli.showToolHelp('calculator.calculator_evaluate');
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('Tool: calculator.calculator_evaluate');
      expect(output).toContain('Parameters:');
      expect(output).toContain('expression');
      expect(output).toContain('Examples:');
    });

    it('should generate module documentation', async () => {
      await cli.loadConfiguration();
      await cli.initializeResourceManager();
      await cli.loadModules();
      cli.initializeModuleFactory();
      
      await cli.showModuleHelp('calculator');
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('Module: calculator');
      expect(output).toContain('Tools:');
      expect(output).toContain('calculator_evaluate');
    });
  });

  describe('example validation', () => {
    it('should validate README exists', async () => {
      const readmePath = path.join(__dirname, '..', 'README.md');
      await expect(fs.access(readmePath)).resolves.not.toThrow();
      
      const content = await fs.readFile(readmePath, 'utf8');
      expect(content).toContain('# @jsenvoy/cli');
      expect(content).toContain('## Installation');
      expect(content).toContain('## Quick Start');
      expect(content).toContain('## Configuration');
    });

    it('should validate example scripts exist', async () => {
      const examplesDir = path.join(__dirname, '..', 'examples');
      
      const files = await fs.readdir(examplesDir);
      expect(files).toContain('basic-usage.sh');
      expect(files).toContain('advanced-features.sh');
      expect(files).toContain('interactive-session.md');
      expect(files).toContain('.jsenvoy.example.json');
    });

    it('should validate example configuration', async () => {
      const configPath = path.join(__dirname, '..', 'examples', '.jsenvoy.example.json');
      const content = await fs.readFile(configPath, 'utf8');
      
      // Remove comment lines for validation - they appear as properties like "// comment": ""
      const commentPattern = /^\s*"\/\/[^"]*":\s*"",?\s*$/;
      const lines = content.split('\n');
      const cleanLines = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip comment property lines
        if (commentPattern.test(line)) {
          // If previous line ends with comma and this is last property before closing brace,
          // we need to remove the comma from previous line
          if (cleanLines.length > 0 && i + 1 < lines.length) {
            const nextNonEmpty = lines.slice(i + 1).find(l => l.trim() !== '')?.trim();
            if (nextNonEmpty && (nextNonEmpty === '}' || nextNonEmpty === '},')) {
              const lastLine = cleanLines[cleanLines.length - 1];
              if (lastLine.trim().endsWith(',')) {
                cleanLines[cleanLines.length - 1] = lastLine.replace(/,\s*$/, '');
              }
            }
          }
          continue;
        }
        
        cleanLines.push(line);
      }
      
      const cleanJson = cleanLines.join('\n');
      const config = JSON.parse(cleanJson);
      
      // Should have all major sections
      expect(config).toHaveProperty('resources');
      expect(config).toHaveProperty('modules');
      expect(config).toHaveProperty('aliases');
      expect(config).toHaveProperty('presets');
    });
  });

  describe('tutorial system', () => {
    it('should provide helpful examples in help output', async () => {
      await cli.loadConfiguration();
      await cli.initializeResourceManager();
      await cli.loadModules();
      cli.initializeModuleFactory();
      
      // Check general help includes examples
      await cli.showGeneralHelp();
      let output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('jsenvoy calculator.calculator_evaluate --expression');
      
      // Clear spy
      consoleSpy.mockClear();
      
      // Check tool help includes examples
      await cli.showToolHelp('file.file_writer');
      output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Examples:');
      expect(output).toContain('file.file_writer --filePath');
    });

    it('should show contextual help for errors', () => {
      const error = new Error("Missing required parameter: 'expression'");
      
      // Mock tool for parameter error
      jest.spyOn(cli, 'getToolByName').mockReturnValue({
        parameters: {
          properties: {
            expression: {
              type: 'string',
              description: 'Mathematical expression to evaluate'
            }
          },
          required: ['expression']
        }
      });
      
      // Set up the module and tool name for context
      cli.moduleName = 'calculator';
      cli.toolName = 'calculator_evaluate';
      
      // Spy on console.error before calling the method
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      cli.handleParameterError(error);
      
      // Combine all console output
      const allCalls = [...errorSpy.mock.calls, ...consoleSpy.mock.calls];
      const output = allCalls.map(call => call[0]).join('\n');
      
      expect(output).toContain('Required parameters:');
      expect(output).toContain('Example:');
      
      errorSpy.mockRestore();
    });
  });

  describe('interactive help system', () => {
    it('should provide autocomplete for help topics', async () => {
      await cli.loadConfiguration();
      await cli.initializeResourceManager();
      await cli.loadModules();
      
      const completer = cli.getCompleter();
      const [completions] = await completer('help calc');
      
      // Completions should include calculator-related items
      expect(completions.some(c => c.includes('calculator'))).toBe(true);
    });

    it('should show available commands in interactive help', async () => {
      // Mock interactive mode help
      const mockRL = { prompt: jest.fn() };
      await cli.processInteractiveCommand('help', mockRL);
      
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Commands:');
      expect(output).toContain('help');
      expect(output).toContain('list');
      expect(output).toContain('interactive');
    });
  });

  describe('API documentation', () => {
    it('should document all public methods', () => {
      // Check that main public methods exist
      expect(typeof cli.run).toBe('function');
      expect(typeof cli.parseArgs).toBe('function');
      expect(typeof cli.loadConfiguration).toBe('function');
      expect(typeof cli.loadModules).toBe('function');
      expect(typeof cli.executeTool).toBe('function');
      expect(typeof cli.formatOutput).toBe('function');
    });

    it('should have consistent method signatures', async () => {
      // executeTool should accept tool name and args
      const mockTool = {
        instance: { execute: jest.fn().mockResolvedValue({ result: 'test' }) }
      };
      jest.spyOn(cli, 'getToolByName').mockReturnValue(mockTool);
      
      const result = await cli.executeTool('test.tool', { param: 'value' });
      expect(result).toEqual({ result: 'test' });
      expect(mockTool.instance.execute).toHaveBeenCalledWith({ param: 'value' });
    });
  });

  describe('example code in documentation', () => {
    it('should have valid command examples', () => {
      // Test that example commands would parse correctly
      const examples = [
        ['node', 'jsenvoy', 'calculator.calculator_evaluate', '--expression', '2 + 2'],
        ['node', 'jsenvoy', 'list', 'modules'],
        ['node', 'jsenvoy', 'help', 'calculator'],
        ['node', 'jsenvoy', '--output', 'json', 'list'],
        ['node', 'jsenvoy', '--preset', 'dev', 'list', 'modules']
      ];
      
      examples.forEach(argv => {
        expect(() => cli.parseArgs(argv)).not.toThrow();
      });
    });

    it('should have valid configuration examples', () => {
      const exampleConfig = {
        verbose: false,
        output: 'text',
        resources: {
          basePath: '/home/user/data'
        },
        aliases: {
          calc: 'calculator.calculator_evaluate --expression'
        },
        presets: {
          dev: { verbose: true }
        }
      };
      
      // Should be able to merge without errors
      const merged = cli.mergeConfigurations({}, exampleConfig);
      expect(merged.aliases.calc).toBe('calculator.calculator_evaluate --expression');
    });
  });
});