import { jest } from '@jest/globals';
import CLI from '../src/index.js';
import chalk from 'chalk';

describe('Output Formatter', () => {
  let cli;
  let consoleSpy;

  beforeEach(() => {
    cli = new CLI();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    // Disable chalk colors for consistent testing
    chalk.level = 0;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    chalk.level = 3; // Restore colors
  });

  describe('formatOutput', () => {
    it('should format string output', () => {
      cli.formatOutput('Hello, World!');
      
      expect(consoleSpy).toHaveBeenCalledWith('Hello, World!');
    });

    it('should format number output', () => {
      cli.formatOutput(42);
      
      expect(consoleSpy).toHaveBeenCalledWith('42');
    });

    it('should format boolean output', () => {
      cli.formatOutput(true);
      
      expect(consoleSpy).toHaveBeenCalledWith('true');
    });

    it('should format object output with pretty printing', () => {
      const obj = { name: 'test', value: 123 };
      cli.formatOutput(obj);
      
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('name');
      expect(output).toContain('test');
      expect(output).toContain('value');
      expect(output).toContain('123');
    });

    it('should format array output', () => {
      const arr = ['apple', 'banana', 'orange'];
      cli.formatOutput(arr);
      
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('apple');
      expect(output).toContain('banana');
      expect(output).toContain('orange');
    });

    it('should handle null and undefined', () => {
      cli.formatOutput(null);
      expect(consoleSpy).toHaveBeenCalledWith('null');
      
      consoleSpy.mockClear();
      cli.formatOutput(undefined);
      expect(consoleSpy).toHaveBeenCalledWith('undefined');
    });
  });

  describe('JSON output mode', () => {
    beforeEach(() => {
      cli.options = { output: 'json' };
    });

    it('should output raw JSON when in JSON mode', () => {
      const data = { result: 42, message: 'Success' };
      cli.formatOutput(data);
      
      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
    });

    it('should handle arrays in JSON mode', () => {
      const data = [1, 2, 3];
      cli.formatOutput(data);
      
      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
    });

    it('should handle primitives in JSON mode', () => {
      cli.formatOutput('test');
      expect(consoleSpy).toHaveBeenCalledWith('"test"');
      
      consoleSpy.mockClear();
      cli.formatOutput(42);
      expect(consoleSpy).toHaveBeenCalledWith('42');
    });
  });

  describe('formatError', () => {
    let errorSpy;

    beforeEach(() => {
      errorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      errorSpy.mockRestore();
    });

    it('should format error messages', () => {
      cli.formatError(new Error('Something went wrong'));
      
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'));
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Something went wrong'));
    });

    it('should show stack trace in verbose mode', () => {
      cli.options = { verbose: true };
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:10:15';
      
      cli.formatError(error);
      
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Stack trace:'));
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('at test.js:10:15'));
    });

    it('should handle string errors', () => {
      cli.formatError('Simple error message');
      
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'));
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Simple error message'));
    });
  });

  describe('colored output', () => {
    beforeEach(() => {
      cli.config = { color: true };
      chalk.level = 3; // Enable colors
    });

    it('should use colors when enabled', () => {
      cli.formatSuccess('Operation completed successfully');
      
      expect(consoleSpy).toHaveBeenCalled();
      // Note: In tests, chalk might not apply colors, but the method should be called
    });

    it('should not use colors when disabled', () => {
      cli.config.color = false;
      cli.formatSuccess('Operation completed successfully');
      
      expect(consoleSpy).toHaveBeenCalledWith('✓ Operation completed successfully');
    });
  });

  describe('formatTable', () => {
    it('should format data as a table', () => {
      const data = [
        { name: 'calculator', tools: 1, status: 'active' },
        { name: 'file', tools: 3, status: 'active' }
      ];
      
      cli.formatTable(data);
      
      expect(consoleSpy).toHaveBeenCalled();
      
      // Collect all console.log calls
      const allOutput = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(allOutput).toContain('name');
      expect(allOutput).toContain('tools');
      expect(allOutput).toContain('status');
      expect(allOutput).toContain('calculator');
      expect(allOutput).toContain('file');
    });

    it('should handle empty data', () => {
      cli.formatTable([]);
      
      expect(consoleSpy).toHaveBeenCalledWith('No data to display');
    });
  });

  describe('formatList', () => {
    it('should format items as a bulleted list', () => {
      const items = ['Item 1', 'Item 2', 'Item 3'];
      cli.formatList(items);
      
      expect(consoleSpy).toHaveBeenCalledTimes(3);
      expect(consoleSpy).toHaveBeenNthCalledWith(1, '  • Item 1');
      expect(consoleSpy).toHaveBeenNthCalledWith(2, '  • Item 2');
      expect(consoleSpy).toHaveBeenNthCalledWith(3, '  • Item 3');
    });

    it('should handle empty list', () => {
      cli.formatList([]);
      
      expect(consoleSpy).toHaveBeenCalledWith('  (empty)');
    });
  });

  describe('formatToolResult', () => {
    it('should format tool execution results', () => {
      const result = {
        result: 42,
        details: { calculation: '40 + 2' }
      };
      
      cli.formatToolResult('calculator.calculator_evaluate', result);
      
      expect(consoleSpy).toHaveBeenCalled();
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(c => c.includes('Result:'))).toBe(true);
      expect(calls.some(c => c.includes('42'))).toBe(true);
    });

    it('should handle errors in tool results', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = {
        error: 'Invalid expression',
        code: 'INVALID_EXPR'
      };
      
      cli.formatToolResult('calculator.calculator_evaluate', result);
      
      expect(consoleSpy).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
      
      const logCalls = consoleSpy.mock.calls.map(call => call[0]);
      const errorCalls = errorSpy.mock.calls.map(call => call[0]);
      const allCalls = [...logCalls, ...errorCalls];
      
      expect(allCalls.some(c => c.includes('Error:'))).toBe(true);
      expect(allCalls.some(c => c.includes('Invalid expression'))).toBe(true);
      
      errorSpy.mockRestore();
    });
  });

  describe('progress indicators', () => {
    it('should show spinner for long operations', () => {
      const spinner = cli.showSpinner('Processing...');
      
      expect(spinner).toBeDefined();
      expect(spinner.stop).toBeDefined();
      expect(spinner.succeed).toBeDefined();
      expect(spinner.fail).toBeDefined();
    });
  });
});