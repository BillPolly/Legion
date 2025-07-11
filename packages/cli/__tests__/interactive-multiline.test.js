import { jest } from '@jest/globals';
import CLI from '../src/index.js';
import readline from 'readline';
import { EventEmitter } from 'events';

// Mock readline module
jest.mock('readline');

describe('Interactive Mode Multi-line Input', () => {
  let cli;
  let mockRL;
  let consoleSpy;

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
    
    readline.createInterface = jest.fn().mockReturnValue(mockRL);
    
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('JSON multi-line input', () => {
    it('should detect start of JSON object', async () => {
      const promise = cli.executeInteractiveCommand();
      
      // Start multi-line JSON
      mockRL.emit('line', 'calculator.calculator_evaluate --json {');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should change prompt to indicate multi-line mode
      expect(mockRL.setPrompt).toHaveBeenCalledWith('... ');
      
      mockRL.emit('close');
      await promise;
    });

    it('should accumulate multi-line JSON input', async () => {
      const promise = cli.executeInteractiveCommand();
      
      jest.spyOn(cli, 'executeTool').mockResolvedValue({ result: 42 });
      
      // Start multi-line JSON
      mockRL.emit('line', 'calculator.calculator_evaluate --json {');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Add JSON content
      mockRL.emit('line', '  "expression": "40 + 2"');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Close JSON
      mockRL.emit('line', '}');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(cli.executeTool).toHaveBeenCalledWith('calculator.calculator_evaluate', {
        expression: '40 + 2'
      });
      
      mockRL.emit('close');
      await promise;
    });

    it('should handle nested JSON objects', async () => {
      const promise = cli.executeInteractiveCommand();
      
      jest.spyOn(cli, 'executeTool').mockResolvedValue({ result: 'ok' });
      
      // Create a hypothetical tool that accepts nested JSON
      mockRL.emit('line', 'test.tool --json {');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      mockRL.emit('line', '  "outer": {');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      mockRL.emit('line', '    "inner": "value"');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      mockRL.emit('line', '  }');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      mockRL.emit('line', '}');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should maintain multi-line mode until JSON is complete
      expect(mockRL.setPrompt).toHaveBeenCalledWith('... ');
      expect(mockRL.setPrompt).toHaveBeenLastCalledWith('jsenvoy> ');
      
      mockRL.emit('close');
      await promise;
    });

    it('should handle JSON arrays', async () => {
      const promise = cli.executeInteractiveCommand();
      
      mockRL.emit('line', 'test.tool --json [');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      mockRL.emit('line', '  "item1",');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      mockRL.emit('line', '  "item2"');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      mockRL.emit('line', ']');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should return to normal prompt after JSON is complete
      expect(mockRL.setPrompt).toHaveBeenLastCalledWith('jsenvoy> ');
      
      mockRL.emit('close');
      await promise;
    });

    it('should handle escape to cancel multi-line', async () => {
      const promise = cli.executeInteractiveCommand();
      
      // Start multi-line JSON
      mockRL.emit('line', 'calculator.calculator_evaluate --json {');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Cancel with escape sequence
      mockRL.emit('line', '.cancel');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(consoleSpy).toHaveBeenCalledWith('Multi-line input cancelled');
      expect(mockRL.setPrompt).toHaveBeenLastCalledWith('jsenvoy> ');
      
      mockRL.emit('close');
      await promise;
    });

    it('should validate JSON on completion', async () => {
      const promise = cli.executeInteractiveCommand();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Start invalid JSON
      mockRL.emit('line', 'test.tool --json {');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      mockRL.emit('line', '  invalid json content');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      mockRL.emit('line', '}');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid JSON'));
      
      errorSpy.mockRestore();
      mockRL.emit('close');
      await promise;
    });
  });

  describe('multi-line string input', () => {
    it('should support multi-line strings with triple quotes', async () => {
      const promise = cli.executeInteractiveCommand();
      
      jest.spyOn(cli, 'executeTool').mockResolvedValue({ result: 'ok' });
      
      // Start multi-line string
      mockRL.emit('line', 'test.tool --content """');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockRL.setPrompt).toHaveBeenCalledWith('... ');
      
      // Add content
      mockRL.emit('line', 'Line 1');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      mockRL.emit('line', 'Line 2');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // End multi-line string
      mockRL.emit('line', '"""');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(cli.executeTool).toHaveBeenCalledWith('test.tool', {
        content: 'Line 1\nLine 2'
      });
      
      mockRL.emit('close');
      await promise;
    });

    it('should preserve formatting in multi-line strings', async () => {
      const promise = cli.executeInteractiveCommand();
      
      jest.spyOn(cli, 'executeTool').mockResolvedValue({ result: 'ok' });
      
      mockRL.emit('line', 'test.tool --code """');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      mockRL.emit('line', '  function test() {');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      mockRL.emit('line', '    return 42;');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      mockRL.emit('line', '  }');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      mockRL.emit('line', '"""');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(cli.executeTool).toHaveBeenCalledWith('test.tool', {
        code: '  function test() {\n    return 42;\n  }'
      });
      
      mockRL.emit('close');
      await promise;
    });
  });

  describe('prompt indicators', () => {
    it('should show appropriate prompts for different multi-line contexts', async () => {
      const promise = cli.executeInteractiveCommand();
      
      // JSON object
      mockRL.emit('line', 'test.tool --json {');
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockRL.setPrompt).toHaveBeenCalledWith('... ');
      
      mockRL.emit('line', '}');
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockRL.setPrompt).toHaveBeenLastCalledWith('jsenvoy> ');
      
      // Multi-line string
      mockRL.emit('line', 'test.tool --text """');
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockRL.setPrompt).toHaveBeenCalledWith('... ');
      
      mockRL.emit('line', '"""');
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockRL.setPrompt).toHaveBeenLastCalledWith('jsenvoy> ');
      
      mockRL.emit('close');
      await promise;
    });

    it('should maintain context during multi-line input', async () => {
      const promise = cli.executeInteractiveCommand();
      
      // Set context
      mockRL.emit('line', 'set test_var 123');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Multi-line should not affect context
      mockRL.emit('line', 'test.tool --json {');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      mockRL.emit('line', '}');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(cli.interactiveContext.test_var).toBe(123);
      
      mockRL.emit('close');
      await promise;
    });
  });
});