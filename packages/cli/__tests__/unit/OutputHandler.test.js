/**
 * Unit tests for OutputHandler
 * Tests output formatting, colored output, and message display
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { OutputHandler } from '../../src/handlers/OutputHandler.js';

describe('OutputHandler Unit Tests', () => {
  let outputHandler;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    outputHandler = new OutputHandler();
    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('should create OutputHandler with default options', () => {
    expect(outputHandler).toBeDefined();
    expect(outputHandler.useColors).toBe(true);
  });

  test('should create OutputHandler with colors disabled', () => {
    const handler = new OutputHandler({ useColors: false });
    expect(handler.useColors).toBe(false);
  });

  test('should output success message', () => {
    outputHandler.success('Operation completed');
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  test('should output error message', () => {
    outputHandler.error('Operation failed');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  test('should output info message', () => {
    outputHandler.info('Information');
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  test('should output warning message', () => {
    outputHandler.warning('Warning message');
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  test('should output plain message', () => {
    outputHandler.print('Plain text');
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  test('should output blank line', () => {
    outputHandler.blank();
    expect(consoleLogSpy).toHaveBeenCalledWith('');
  });

  test('should format table output', () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 }
    ];

    const table = outputHandler.formatTable(data);
    expect(table).toBeDefined();
    expect(typeof table).toBe('string');
    expect(table).toContain('name');
    expect(table).toContain('age');
  });

  test('should format empty table', () => {
    const table = outputHandler.formatTable([]);
    expect(table).toBe('(no data)');
  });

  test('should format JSON output', () => {
    const data = { name: 'test', value: 123 };
    const json = outputHandler.formatJSON(data);
    expect(json).toBeDefined();
    expect(typeof json).toBe('string');
    expect(json).toContain('name');
    expect(json).toContain('test');
  });

  test('should format JSON with indentation', () => {
    const data = { name: 'test' };
    const json = outputHandler.formatJSON(data, 4);
    expect(json).toContain('    '); // 4 space indent
  });

  test('should output list', () => {
    const items = ['item1', 'item2', 'item3'];
    outputHandler.list(items);
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  test('should output empty list message', () => {
    outputHandler.list([]);
    expect(consoleLogSpy).toHaveBeenCalledWith('(no items)');
  });

  test('should output list with custom prefix', () => {
    const items = ['item1', 'item2'];
    outputHandler.list(items, '-');
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  test('should output heading', () => {
    outputHandler.heading('Test Heading');
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  test('should output divider', () => {
    outputHandler.divider();
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  test('should output custom divider', () => {
    outputHandler.divider('=', 40);
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  test('should format command result success', () => {
    const result = {
      success: true,
      message: 'Command executed'
    };

    outputHandler.commandResult(result);
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  test('should format command result error', () => {
    const result = {
      success: false,
      message: 'Command failed'
    };

    outputHandler.commandResult(result);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  test('should format error with stack trace', () => {
    const error = new Error('Test error');
    outputHandler.formatError(error);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  test('should format error without stack trace', () => {
    const error = new Error('Test error');
    const handler = new OutputHandler({ showStackTrace: false });
    handler.formatError(error);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  test('should format string error', () => {
    outputHandler.formatError('Simple error message');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  test('should enable colors', () => {
    outputHandler.setColors(true);
    expect(outputHandler.useColors).toBe(true);
  });

  test('should disable colors', () => {
    outputHandler.setColors(false);
    expect(outputHandler.useColors).toBe(false);
  });

  test('should clear screen', () => {
    // Just test that it doesn't throw
    expect(() => outputHandler.clear()).not.toThrow();
  });
});
