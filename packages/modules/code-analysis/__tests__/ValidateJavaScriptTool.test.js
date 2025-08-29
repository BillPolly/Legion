/**
 * Test for ValidateJavaScriptTool - Tool Registry Pattern Compatibility
 */

import { describe, test, expect } from '@jest/globals';
import { ValidateJavaScriptTool } from '../src/tools/ValidateJavaScriptTool.js';

describe('ValidateJavaScriptTool', () => {
  let tool;

  beforeEach(() => {
    tool = new ValidateJavaScriptTool();
  });

  describe('Tool Registry Pattern Compliance', () => {
    test('should have correct name and description', () => {
      expect(tool.name).toBe('validate_javascript');
      expect(tool.description).toBe('Validate JavaScript code for syntax and quality issues');
    });

    test('should have _execute method instead of execute', () => {
      expect(typeof tool._execute).toBe('function');
      expect(tool._execute).not.toBe(tool.execute); // Should be different (base class execute wraps _execute)
    });

    test('should have basic tool properties', () => {
      expect(tool.name).toBe('validate_javascript');
      expect(tool.description).toContain('JavaScript code');
    });

    test('should have default schema structure from base Tool class', () => {
      // Tools now have default empty schemas from base class, actual schemas come from metadata
      expect(tool.schema).toBeUndefined(); // schema property not set
      expect(tool.inputSchema).toEqual({ type: 'object', properties: {} }); // default from base class
      expect(tool.outputSchema).toEqual({ type: 'object', properties: {} }); // default from base class
    });
  });

  describe('Basic Functionality', () => {
    test('should validate simple valid JavaScript code', async () => {
      const result = await tool.execute({
        code: 'const x = 42; console.log(x);'
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('valid', true);
      expect(result.data).toHaveProperty('errors');
      expect(result.data).toHaveProperty('warnings');
      expect(result.data).toHaveProperty('securityIssues');
      expect(result.data).toHaveProperty('performanceIssues');
      expect(result.data).toHaveProperty('metrics');
      expect(result.data.errors).toHaveLength(0);
    });

    test('should detect syntax errors', async () => {
      const result = await tool.execute({
        code: 'const x = ; // syntax error'
      });

      expect(result.success).toBe(true);
      expect(result.data.valid).toBe(false);
      expect(result.data.errors.length).toBeGreaterThan(0);
    });

    test('should detect security issues', async () => {
      const result = await tool.execute({
        code: 'eval(userInput); // security issue',
        checkSecurity: true
      });

      expect(result.success).toBe(true);
      expect(result.data.securityIssues.length).toBeGreaterThan(0);
      expect(result.data.securityIssues[0]).toHaveProperty('type');
      expect(result.data.securityIssues[0]).toHaveProperty('severity');
      expect(result.data.securityIssues[0]).toHaveProperty('message');
    });

    test('should detect performance issues', async () => {
      const result = await tool.execute({
        code: 'for (let i = 0; i < 100; i++) { document.querySelector("div"); }',
        checkPerformance: true
      });

      expect(result.success).toBe(true);
      expect(result.data.performanceIssues.length).toBeGreaterThan(0);
      expect(result.data.performanceIssues[0]).toHaveProperty('type');
      expect(result.data.performanceIssues[0]).toHaveProperty('suggestion');
    });

    test('should calculate metrics', async () => {
      const result = await tool.execute({
        code: 'const x = 42;\nconst y = 24;\nconsole.log(x + y);'
      });

      expect(result.success).toBe(true);
      expect(result.data.metrics).toHaveProperty('linesOfCode');
      expect(result.data.metrics).toHaveProperty('complexity');
      expect(result.data.metrics).toHaveProperty('maintainabilityIndex');
      expect(result.data.metrics.linesOfCode).toBeGreaterThan(0);
    });

    test('should handle missing code gracefully', async () => {
      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(result.data.valid).toBe(false);
      expect(result.data.errors).toContain('No code provided for validation');
    });
  });

  describe('Tool Base Class Integration', () => {
    test('should use Tool base class execute method that wraps _execute', async () => {
      const result = await tool.execute({
        code: 'const x = 42;'
      });

      // Should return standard Tool base class format
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('object');
    });

    test('should handle errors in standard Tool base class format', async () => {
      // Mock _execute to throw an error
      const originalExecute = tool._execute;
      tool._execute = async () => {
        throw new Error('Test error');
      };

      const result = await tool.execute({ code: 'test' });

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error', 'Test error');
      expect(result).toHaveProperty('data');

      // Restore original method
      tool._execute = originalExecute;
    });
  });
});