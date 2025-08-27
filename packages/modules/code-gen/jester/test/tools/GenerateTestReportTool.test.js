/**
 * GenerateTestReportTool Tests
 * Tests for markdown test report generation functionality
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { GenerateTestReportTool } from '../../src/tools/GenerateTestReportTool.js';
import { JestAgentWrapper } from '../../src/core/JestAgentWrapper.js';
import { TestDbHelper, setupTestDb, cleanupTestDb } from '../utils/test-db-helper.js';
import fs from 'fs/promises';
import path from 'path';

describe('GenerateTestReportTool', () => {
  let tool;
  let mockJestWrapper;
  let testDbPath;

  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    testDbPath = TestDbHelper.getTempDbPath('generate-test-report-tool');
    
    // Create a real JestWrapper for testing
    mockJestWrapper = new JestAgentWrapper({
      dbPath: testDbPath,
      storage: 'sqlite'
    });
    
    tool = new GenerateTestReportTool(mockJestWrapper);
  });

  afterEach(async () => {
    if (mockJestWrapper) {
      await mockJestWrapper.close();
    }
    await cleanupTestDb(testDbPath);
  });

  describe('Tool Configuration', () => {
    test('should have correct tool metadata', () => {
      expect(tool.name).toBe('generate_test_report');
      expect(tool.description).toContain('markdown test reports');
      expect(tool.inputSchema).toBeDefined();
      expect(tool.outputSchema).toBeDefined();
    });

    test('should have valid input schema', () => {
      const schema = tool.inputSchema;
      expect(schema).toBeDefined();
      
      // Test with valid input
      const validInput = {
        reportType: 'summary',
        includeCharts: true,
        includeCoverage: true,
        includeRecommendations: true
      };
      
      expect(() => schema.parse(validInput)).not.toThrow();
    });

    test('should have valid output schema', () => {
      const schema = tool.outputSchema;
      expect(schema).toBeDefined();
      
      // Test with valid output
      const validOutput = {
        reportContent: '# Test Report',
        written: false,
        summary: {
          totalTests: 5,
          passedTests: 4,
          failedTests: 1,
          duration: 1000,
          sessionId: 'test-session'
        }
      };
      
      expect(() => schema.parse(validOutput)).not.toThrow();
    });
  });

  describe('Report Generation', () => {
    test('should handle empty test data gracefully', async () => {
      const result = await tool.execute({
        reportType: 'summary'
      });

      expect(result.success).toBe(true);
      expect(result.data.reportContent).toBeDefined();
      expect(result.data.reportContent).toContain('Test Report');
      expect(result.data.written).toBe(false);
      expect(result.data.summary).toBeDefined();
    });

    test('should generate summary report', async () => {
      const result = await tool.execute({
        reportType: 'summary',
        title: 'Custom Test Report'
      });

      expect(result.success).toBe(true);
      expect(result.data.reportContent).toContain('Custom Test Report');
      expect(result.data.reportContent).toContain('📊 Test Summary');
      expect(result.data.reportContent).toContain('Total Tests');
      expect(result.data.reportContent).toContain('**Status**:');
    });

    test('should generate detailed report', async () => {
      const result = await tool.execute({
        reportType: 'detailed',
        includeCharts: true,
        includeRecommendations: true
      });

      expect(result.success).toBe(true);
      expect(result.data.reportContent).toContain('Test Report');
      expect(result.data.reportContent).toContain('📊 Test Summary');
      expect(result.data.reportContent).toContain('💡 Recommendations');
    });

    test('should generate performance report', async () => {
      const result = await tool.execute({
        reportType: 'performance'
      });

      expect(result.success).toBe(true);
      expect(result.data.reportContent).toContain('🚀 Performance Overview');
      expect(result.data.reportContent).toContain('Performance Recommendations');
    });

    test('should generate failure report', async () => {
      const result = await tool.execute({
        reportType: 'failure'
      });

      expect(result.success).toBe(true);
      expect(result.data.reportContent).toContain('🐛 Failure Analysis');
      expect(result.data.reportContent).toContain('No test failures found');
    });
  });

  describe('File Writing', () => {
    test('should write report to file when outputPath is provided', async () => {
      const tempDir = TestDbHelper.getTempDbPath('report-output').replace('.db', '');
      const outputPath = path.join(tempDir, 'test-report.md');

      const result = await tool.execute({
        reportType: 'summary',
        outputPath: outputPath,
        title: 'File Writing Test Report'
      });

      expect(result.success).toBe(true);
      expect(result.data.written).toBe(true);
      expect(result.data.filePath).toContain('test-report.md');
      
      // Verify file was actually written
      const fileExists = await fs.stat(outputPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
      
      if (fileExists) {
        const content = await fs.readFile(outputPath, 'utf8');
        expect(content).toContain('File Writing Test Report');
        expect(content).toContain('📊 Test Summary');
        
        // Clean up
        await fs.unlink(outputPath).catch(() => {});
      }
    });

    test('should handle file writing errors gracefully', async () => {
      const result = await tool.execute({
        reportType: 'summary',
        outputPath: '/invalid/path/that/does/not/exist.md'
      });

      // Should still succeed with content generation even if file writing fails
      expect(result.success).toBe(true);
      expect(result.data.reportContent).toBeDefined();
      expect(result.data.written).toBe(false);
      expect(result.data.filePath).toBeNull();
    });
  });

  describe('Tool Invocation', () => {
    test('should handle tool call invocation properly', async () => {
      const toolCall = {
        function: {
          name: 'generate_test_report',
          arguments: JSON.stringify({
            reportType: 'summary',
            title: 'Invocation Test Report'
          })
        }
      };

      const result = await tool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.reportContent).toContain('Invocation Test Report');
    });

    test('should handle invalid JSON arguments', async () => {
      const toolCall = {
        function: {
          name: 'generate_test_report',
          arguments: 'invalid json'
        }
      };

      const result = await tool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.data.errorMessage).toContain('Unexpected token');
    });

    test('should handle tool execution errors', async () => {
      // Create a tool with a null wrapper to trigger errors
      const brokenTool = new GenerateTestReportTool(null);
      
      const toolCall = {
        function: {
          name: 'generate_test_report',
          arguments: JSON.stringify({ reportType: 'summary' })
        }
      };

      const result = await brokenTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.data.errorMessage).toBeDefined();
    });
  });

  describe('Utility Functions', () => {
    test('should format duration correctly', () => {
      expect(tool.formatDuration(0)).toBe('0ms');
      expect(tool.formatDuration(500)).toBe('500ms');
      expect(tool.formatDuration(1500)).toBe('1.5s');
      expect(tool.formatDuration(65000)).toBe('1m 5s');
      expect(tool.formatDuration(-100)).toBe('0ms');
    });

    test('should generate appropriate title', () => {
      const data = {
        projectPath: '/path/to/my-project',
        timestamp: new Date().toISOString()
      };
      
      const options = { reportType: 'summary' };
      
      const title = tool.generateTitle(data, options);
      expect(title).toContain('Summary Test Report');
      expect(title).toContain('my-project');
    });

    test('should generate recommendations based on test results', () => {
      const data = {
        summary: { failed: 0, total: 10, skipped: 2, todo: 1 },
        tests: []
      };
      
      const recommendations = tool.generateRecommendations(data);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(rec => rec.includes('All tests passing'))).toBe(true);
      expect(recommendations.some(rec => rec.includes('skipped tests'))).toBe(true);
      expect(recommendations.some(rec => rec.includes('todo tests'))).toBe(true);
    });
  });

  describe('Integration with Analytics', () => {
    test('should integrate with performance analyzer when available', async () => {
      // This test would require more setup with actual test data
      // For now, just verify it doesn't crash when analytics are missing
      const result = await tool.execute({
        reportType: 'performance'
      });

      expect(result.success).toBe(true);
      expect(result.data.reportContent).toBeDefined();
      expect(result.data.reportContent).toContain('🚀 Performance Overview');
    });

    test('should integrate with error analyzer when failures exist', async () => {
      const result = await tool.execute({
        reportType: 'failure'
      });

      expect(result.success).toBe(true);
      expect(result.data.reportContent).toBeDefined();
      expect(result.data.reportContent).toContain('🐛 Failure Analysis');
    });
  });
});