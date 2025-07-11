/**
 * Unit tests for Server Starter Tool
 */

import { jest } from '@jest/globals';
import ServerStarter from '../../src/server-starter/index.js';
import { createMockToolCall, validateToolResult } from '../utils/test-helpers.js';

describe('ServerStarter', () => {
  let serverStarter;

  beforeEach(() => {
    serverStarter = new ServerStarter();
    jest.clearAllMocks();
    serverStarter.serverProcess = null;
    serverStarter.serverOutput = [];
  });

  describe('constructor', () => {
    test('should initialize with correct properties', () => {
      expect(serverStarter.name).toBe('server_starter');
      expect(serverStarter.description).toBe('Starts and manages npm servers');
      expect(serverStarter.serverProcess).toBeNull();
      expect(serverStarter.serverOutput).toEqual([]);
      expect(serverStarter.maxOutputLines).toBe(1000);
    });
  });

  describe('getAllToolDescriptions', () => {
    test('should return all three server functions', () => {
      const descriptions = serverStarter.getAllToolDescriptions();
      
      expect(descriptions).toHaveLength(3);
      expect(descriptions[0].function.name).toBe('server_starter_start');
      expect(descriptions[1].function.name).toBe('server_starter_read_output');
      expect(descriptions[2].function.name).toBe('server_starter_stop');
    });

    test('should have correct parameter schemas', () => {
      const descriptions = serverStarter.getAllToolDescriptions();
      
      // Server start
      expect(descriptions[0].function.parameters.required).toContain('command');
      expect(descriptions[0].function.parameters.properties.command.type).toBe('string');
      expect(descriptions[0].function.parameters.properties.cwd.type).toBe('string');
      
      // Read output
      expect(descriptions[1].function.parameters.properties.lines.type).toBe('number');
      
      // Stop server has no required parameters
      expect(descriptions[2].function.parameters.properties).toEqual({});
    });
  });

  describe('readServerOutput method', () => {
    test('should return recent output lines', async () => {
      // Mock a running server process
      serverStarter.serverProcess = { pid: 12345 };
      serverStarter.serverOutput = ['line1', 'line2', 'line3', 'line4', 'line5'];
      
      const result = await serverStarter.readServerOutput(3);
      
      expect(result.success).toBe(true);
      expect(result.output).toEqual(['line3', 'line4', 'line5']);
      expect(result.lines).toBe(3);
    });

    test('should return all lines when requested count exceeds available', async () => {
      // Mock a running server process
      serverStarter.serverProcess = { pid: 12345 };
      serverStarter.serverOutput = ['line1', 'line2'];
      
      const result = await serverStarter.readServerOutput(10);
      
      expect(result.success).toBe(true);
      expect(result.output).toEqual(['line1', 'line2']);
      expect(result.lines).toBe(2);
    });

    test('should return default 50 lines when no count specified', async () => {
      // Mock a running server process
      serverStarter.serverProcess = { pid: 12345 };
      const longOutput = Array.from({ length: 100 }, (_, i) => `line${i + 1}`);
      serverStarter.serverOutput = longOutput;
      
      const result = await serverStarter.readServerOutput();
      
      expect(result.success).toBe(true);
      expect(result.output).toHaveLength(50);
      expect(result.output[0]).toBe('line51'); // Last 50 lines
      expect(result.lines).toBe(50);
    });

    test('should throw error when no server is running', async () => {
      serverStarter.serverProcess = null;
      
      await expect(serverStarter.readServerOutput()).rejects.toThrow('No server is currently running');
    });
  });

  describe('invoke method', () => {
    test('should route server_starter_read_output calls correctly', async () => {
      // Mock a running server process
      serverStarter.serverProcess = { pid: 12345 };
      serverStarter.serverOutput = ['test output'];
      
      const toolCall = createMockToolCall('server_starter_read_output', { 
        lines: 10 
      });
      const result = await serverStarter.invoke(toolCall);

      expect(result.success).toBe(true);
      expect(result.data.output).toEqual(['test output']);
    });

    test('should handle unknown function names', async () => {
      const toolCall = createMockToolCall('server_starter_unknown', {});
      const result = await serverStarter.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown function');
    });
  });
});