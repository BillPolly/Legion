import { jest } from '@jest/globals';
import CLI from '../src/index.js';

describe('Tool Discovery and Metadata', () => {
  let cli;

  beforeEach(async () => {
    cli = new CLI();
    await cli.loadConfiguration();
    await cli.initializeResourceManager();
    await cli.loadModules();
    cli.initializeModuleFactory();
  });

  describe('discoverTools', () => {
    it('should discover all tools from loaded modules', () => {
      const tools = cli.discoverTools();
      
      expect(tools).toBeDefined();
      expect(tools.size).toBeGreaterThan(0);
      
      // Should have calculator tool
      expect(tools.has('calculator.calculator_evaluate')).toBe(true);
      
      // Should have file tools
      expect(tools.has('file.file_reader')).toBe(true);
      expect(tools.has('file.file_writer')).toBe(true);
      expect(tools.has('file.directory_creator')).toBe(true);
    });

    it('should include tool metadata', () => {
      const tools = cli.discoverTools();
      
      const calculatorTool = tools.get('calculator.calculator_evaluate');
      expect(calculatorTool).toBeDefined();
      expect(calculatorTool.name).toBe('calculator_evaluate');
      expect(calculatorTool.description).toBeDefined();
      expect(calculatorTool.parameters).toBeDefined();
      expect(calculatorTool.module).toBe('calculator');
    });

    it('should extract parameter schemas', () => {
      const tools = cli.discoverTools();
      
      const calculatorTool = tools.get('calculator.calculator_evaluate');
      expect(calculatorTool.parameters).toBeDefined();
      expect(calculatorTool.parameters.type).toBe('object');
      expect(calculatorTool.parameters.properties).toBeDefined();
      expect(calculatorTool.parameters.properties.expression).toBeDefined();
      expect(calculatorTool.parameters.required).toContain('expression');
    });
  });

  describe('getToolByName', () => {
    it('should find tool by full name (module.tool)', () => {
      const tool = cli.getToolByName('calculator.calculator_evaluate');
      
      expect(tool).toBeDefined();
      expect(tool.name).toBe('calculator_evaluate');
    });

    it('should return null for non-existent tool', () => {
      const tool = cli.getToolByName('nonexistent.tool');
      
      expect(tool).toBeNull();
    });

    it('should be case-sensitive', () => {
      const tool = cli.getToolByName('Calculator.calculator_evaluate');
      
      expect(tool).toBeNull();
    });
  });

  describe('getToolsByModule', () => {
    it('should return all tools for a module', () => {
      const tools = cli.getToolsByModule('file');
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(3); // file_reader, file_writer, directory_creator
      expect(tools.every(t => t.module === 'file')).toBe(true);
    });

    it('should return empty array for non-existent module', () => {
      const tools = cli.getToolsByModule('nonexistent');
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(0);
    });
  });

  describe('validateToolName', () => {
    it('should validate correct tool names', () => {
      expect(cli.validateToolName('calculator.calculator_evaluate')).toBe(true);
      expect(cli.validateToolName('file.file_reader')).toBe(true);
    });

    it('should reject invalid tool names', () => {
      expect(cli.validateToolName('calculator')).toBe(false);
      expect(cli.validateToolName('calculator.')).toBe(false);
      expect(cli.validateToolName('.evaluate')).toBe(false);
      expect(cli.validateToolName('nonexistent.tool')).toBe(false);
    });
  });

  describe('getToolMetadata', () => {
    it('should return complete tool metadata', () => {
      const metadata = cli.getToolMetadata('calculator.calculator_evaluate');
      
      expect(metadata).toBeDefined();
      expect(metadata.name).toBe('calculator_evaluate');
      expect(metadata.module).toBe('calculator');
      expect(metadata.description).toBeDefined();
      expect(metadata.parameters).toBeDefined();
      expect(metadata.required).toBeDefined();
      expect(metadata.examples).toBeDefined();
    });

    it('should include parameter types and descriptions', () => {
      const metadata = cli.getToolMetadata('calculator.calculator_evaluate');
      
      const expressionParam = metadata.parameters.properties.expression;
      expect(expressionParam.type).toBe('string');
      expect(expressionParam.description).toBeDefined();
    });

    it('should generate examples based on schema', () => {
      const metadata = cli.getToolMetadata('calculator.calculator_evaluate');
      
      expect(metadata.examples).toBeDefined();
      expect(Array.isArray(metadata.examples)).toBe(true);
      expect(metadata.examples.length).toBeGreaterThan(0);
      expect(metadata.examples[0]).toContain('calculator.calculator_evaluate');
    });
  });

  describe('getAllToolNames', () => {
    it('should return sorted list of all tool names', () => {
      const names = cli.getAllToolNames();
      
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(0);
      expect(names).toContain('calculator.calculator_evaluate');
      expect(names).toContain('file.file_reader');
      
      // Should be sorted
      const sorted = [...names].sort();
      expect(names).toEqual(sorted);
    });
  });

  describe('tool registry caching', () => {
    it('should cache tool discovery results', () => {
      const tools1 = cli.discoverTools();
      const tools2 = cli.discoverTools();
      
      expect(tools1).toBe(tools2); // Same Map instance
    });

    it('should invalidate cache when modules change', async () => {
      const tools1 = cli.discoverTools();
      
      // Simulate adding a new module
      cli.moduleClasses.set('test', class TestModule {});
      cli.invalidateToolCache();
      
      const tools2 = cli.discoverTools();
      
      expect(tools1).not.toBe(tools2); // Different Map instances
    });
  });
});