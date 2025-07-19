/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { RealESLintExecutor } from '../../../src/execution/RealESLintExecutor.js';
import { TestLogManager } from '../../../src/logging/TestLogManager.js';
import { LogAnalysisEngine } from '../../../src/logging/LogAnalysisEngine.js';
import { RuntimeConfig } from '../../../src/config/RuntimeConfig.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('RealESLintExecutor', () => {
  let eslintExecutor;
  let logManager;
  let logAnalyzer;
  let mockConfig;
  let testProjectPath;

  beforeAll(async () => {
    mockConfig = new RuntimeConfig({
      eslint: {
        configFile: '.eslintrc.json',
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        cache: false,
        cacheLocation: '.eslintcache',
        maxWarnings: 0,
        outputFormat: 'json',
        quiet: false,
        fix: false,
        fixDryRun: false,
        reportUnusedDisableDirectives: true
      },
      logManager: {
        logLevel: 'info',
        enableStreaming: true,
        captureStdout: true,
        captureStderr: true
      }
    });

    // Create test project
    testProjectPath = path.join(__dirname, 'temp-eslint-project');
    await createTestProject(testProjectPath);
  });

  afterAll(async () => {
    // Clean up test project
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    logManager = new TestLogManager(mockConfig.logManager);
    logAnalyzer = new LogAnalysisEngine(mockConfig);
    eslintExecutor = new RealESLintExecutor(mockConfig, logManager, logAnalyzer);
  });

  afterEach(async () => {
    if (eslintExecutor) {
      await eslintExecutor.cleanup();
    }
    if (logManager) {
      await logManager.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize with configuration', () => {
      expect(eslintExecutor.config).toBeDefined();
      expect(eslintExecutor.logManager).toBeDefined();
      expect(eslintExecutor.logAnalyzer).toBeDefined();
      expect(eslintExecutor.isInitialized).toBe(false);
    });

    test('should initialize ESLint engine', async () => {
      await eslintExecutor.initialize();
      
      expect(eslintExecutor.isInitialized).toBe(true);
      expect(eslintExecutor.eslintEngine).toBeDefined();
      expect(eslintExecutor.executionId).toBeDefined();
    });

    test('should validate ESLint configuration', async () => {
      await eslintExecutor.initialize();
      
      const isValid = await eslintExecutor.validateConfiguration(testProjectPath);
      expect(isValid).toBe(true);
    });

    test('should handle missing ESLint configuration', async () => {
      await eslintExecutor.initialize();
      
      const isValid = await eslintExecutor.validateConfiguration('/non-existent-path');
      expect(isValid).toBe(false);
    });
  });

  describe('Real ESLint Execution', () => {
    beforeEach(async () => {
      await eslintExecutor.initialize();
    });

    test('should execute ESLint with real engine', async () => {
      const result = await eslintExecutor.executeESLint(testProjectPath);
      
      expect(result).toBeDefined();
      expect(result.executionId).toBeDefined();
      expect(result.exitCode).toBeDefined();
      expect(result.results).toBeDefined();
      expect(result.errorCount).toBeDefined();
      expect(result.warningCount).toBeDefined();
      expect(result.fixableErrorCount).toBeDefined();
      expect(result.fixableWarningCount).toBeDefined();
      expect(result.executionTime).toBeDefined();
    });

    test('should capture ESLint output logs', async () => {
      const result = await eslintExecutor.executeESLint(testProjectPath);
      
      expect(result.logs).toBeDefined();
      expect(result.logs.stdout).toBeDefined();
      expect(result.logs.stderr).toBeDefined();
      expect(result.correlationId).toBeDefined();
    });

    test('should parse ESLint results correctly', async () => {
      const result = await eslintExecutor.executeESLint(testProjectPath);
      
      expect(result.results).toBeInstanceOf(Array);
      if (result.results.length > 0) {
        const firstResult = result.results[0];
        expect(firstResult.filePath).toBeDefined();
        expect(firstResult.messages).toBeDefined();
        expect(firstResult.errorCount).toBeDefined();
        expect(firstResult.warningCount).toBeDefined();
      }
    });

    test('should correlate ESLint results with logs', async () => {
      const result = await eslintExecutor.executeESLint(testProjectPath);
      
      // Get logs by correlation ID
      const correlatedLogs = logManager.getLogsByCorrelationId(result.correlationId);
      expect(correlatedLogs).toBeDefined();
      expect(correlatedLogs.length).toBeGreaterThan(0);
    });

    test('should analyze ESLint logs for insights', async () => {
      const result = await eslintExecutor.executeESLint(testProjectPath);
      
      const logs = logManager.getLogsByCorrelationId(result.correlationId);
      const analysis = await logAnalyzer.analyzeTestLogs(logs);
      
      expect(analysis).toBeDefined();
      expect(analysis.errors).toBeDefined();
      expect(analysis.warnings).toBeDefined();
      expect(analysis.patterns).toBeDefined();
    });
  });

  describe('Error Analysis', () => {
    beforeEach(async () => {
      await eslintExecutor.initialize();
    });

    test('should categorize ESLint errors by rule', async () => {
      const result = await eslintExecutor.executeESLint(testProjectPath);
      const analysis = await eslintExecutor.analyzeErrors(result);
      
      expect(analysis).toBeDefined();
      expect(analysis.byRule).toBeDefined();
      expect(analysis.byFile).toBeDefined();
      expect(analysis.bySeverity).toBeDefined();
    });

    test('should identify most common errors', async () => {
      const result = await eslintExecutor.executeESLint(testProjectPath);
      const analysis = await eslintExecutor.analyzeErrors(result);
      
      expect(analysis.mostCommon).toBeDefined();
      expect(analysis.mostCommon).toBeInstanceOf(Array);
    });

    test('should generate error severity mapping', async () => {
      const result = await eslintExecutor.executeESLint(testProjectPath);
      const analysis = await eslintExecutor.analyzeErrors(result);
      
      expect(analysis.bySeverity).toBeDefined();
      expect(analysis.bySeverity.error).toBeDefined();
      expect(analysis.bySeverity.warning).toBeDefined();
    });

    test('should track error trends across runs', async () => {
      // Run multiple times to establish trends
      await eslintExecutor.executeESLint(testProjectPath);
      await eslintExecutor.executeESLint(testProjectPath);
      
      const trends = await eslintExecutor.getErrorTrends();
      
      expect(trends).toBeDefined();
      expect(trends.totalRuns).toBe(2);
      expect(trends.errorHistory).toBeDefined();
      expect(trends.warningHistory).toBeDefined();
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      await eslintExecutor.initialize();
    });

    test('should measure execution performance', async () => {
      const result = await eslintExecutor.executeESLint(testProjectPath);
      
      expect(result.performance).toBeDefined();
      expect(result.performance.executionTime).toBeDefined();
      expect(result.performance.memoryUsage).toBeDefined();
      expect(result.performance.filesProcessed).toBeDefined();
      expect(result.performance.linesProcessed).toBeDefined();
    });

    test('should track performance metrics over time', async () => {
      await eslintExecutor.executeESLint(testProjectPath);
      await eslintExecutor.executeESLint(testProjectPath);
      
      const metrics = await eslintExecutor.getPerformanceMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.averageExecutionTime).toBeDefined();
      expect(metrics.totalExecutions).toBe(2);
      expect(metrics.performanceHistory).toBeDefined();
    });

    test('should identify performance bottlenecks', async () => {
      const result = await eslintExecutor.executeESLint(testProjectPath);
      const bottlenecks = await eslintExecutor.identifyBottlenecks(result);
      
      expect(bottlenecks).toBeDefined();
      expect(bottlenecks.slowFiles).toBeDefined();
      expect(bottlenecks.slowRules).toBeDefined();
      expect(bottlenecks.recommendations).toBeDefined();
    });
  });

  describe('Auto-Fix Capabilities', () => {
    beforeEach(async () => {
      await eslintExecutor.initialize();
    });

    test('should identify fixable issues', async () => {
      const result = await eslintExecutor.executeESLint(testProjectPath);
      const fixable = await eslintExecutor.identifyFixableIssues(result);
      
      expect(fixable).toBeDefined();
      expect(fixable.fixableErrors).toBeDefined();
      expect(fixable.fixableWarnings).toBeDefined();
      expect(fixable.fixableRules).toBeDefined();
    });

    test('should execute auto-fix with dry run', async () => {
      const result = await eslintExecutor.executeESLint(testProjectPath);
      
      if (result.fixableErrorCount > 0 || result.fixableWarningCount > 0) {
        const fixResult = await eslintExecutor.executeAutoFix(testProjectPath, { dryRun: true });
        
        expect(fixResult).toBeDefined();
        expect(fixResult.fixed).toBeDefined();
        expect(fixResult.dryRun).toBe(true);
        expect(fixResult.changedFiles).toBeDefined();
      }
    });

    test('should generate fix suggestions', async () => {
      const result = await eslintExecutor.executeESLint(testProjectPath);
      const suggestions = await eslintExecutor.generateFixSuggestions(result);
      
      expect(suggestions).toBeDefined();
      expect(suggestions.automatic).toBeDefined();
      expect(suggestions.manual).toBeDefined();
      expect(suggestions.priority).toBeDefined();
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      await eslintExecutor.initialize();
    });

    test('should load ESLint configuration', async () => {
      const config = await eslintExecutor.loadConfiguration(testProjectPath);
      
      expect(config).toBeDefined();
      expect(config.rules).toBeDefined();
      expect(config.env).toBeDefined();
      expect(config.parserOptions).toBeDefined();
    });

    test('should validate configuration rules', async () => {
      const config = await eslintExecutor.loadConfiguration(testProjectPath);
      const validation = await eslintExecutor.validateRules(config);
      
      expect(validation).toBeDefined();
      expect(validation.valid).toBeDefined();
      expect(validation.issues).toBeDefined();
    });

    test('should suggest configuration improvements', async () => {
      const config = await eslintExecutor.loadConfiguration(testProjectPath);
      const suggestions = await eslintExecutor.suggestConfigurationImprovements(config);
      
      expect(suggestions).toBeDefined();
      expect(suggestions.recommended).toBeDefined();
      expect(suggestions.deprecated).toBeDefined();
      expect(suggestions.missing).toBeDefined();
    });
  });

  describe('Reporting', () => {
    beforeEach(async () => {
      await eslintExecutor.initialize();
    });

    test('should generate detailed ESLint report', async () => {
      const result = await eslintExecutor.executeESLint(testProjectPath);
      const report = await eslintExecutor.generateReport(result);
      
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.details).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.timestamp).toBeDefined();
    });

    test('should export results in multiple formats', async () => {
      const result = await eslintExecutor.executeESLint(testProjectPath);
      
      const jsonReport = await eslintExecutor.exportResults(result, 'json');
      const textReport = await eslintExecutor.exportResults(result, 'text');
      const htmlReport = await eslintExecutor.exportResults(result, 'html');
      
      expect(jsonReport).toBeDefined();
      expect(textReport).toBeDefined();
      expect(htmlReport).toBeDefined();
    });

    test('should generate CI-compatible output', async () => {
      const result = await eslintExecutor.executeESLint(testProjectPath);
      const ciOutput = await eslintExecutor.generateCIOutput(result);
      
      expect(ciOutput).toBeDefined();
      expect(ciOutput.exitCode).toBeDefined();
      expect(ciOutput.summary).toBeDefined();
      expect(ciOutput.artifacts).toBeDefined();
    });
  });

  describe('Integration Features', () => {
    beforeEach(async () => {
      await eslintExecutor.initialize();
    });

    test('should integrate with log correlation', async () => {
      const result = await eslintExecutor.executeESLint(testProjectPath);
      
      // Check log correlation
      const correlatedLogs = logManager.getLogsByCorrelationId(result.correlationId);
      expect(correlatedLogs.length).toBeGreaterThan(0);
      
      // Check log analysis
      const analysis = await logAnalyzer.analyzeTestLogs(correlatedLogs);
      expect(analysis.errors).toBeDefined();
    });

    test('should emit execution events', async () => {
      const events = [];
      eslintExecutor.on('execution-started', (event) => events.push(event));
      eslintExecutor.on('execution-completed', (event) => events.push(event));
      
      await eslintExecutor.executeESLint(testProjectPath);
      
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('execution-started');
      expect(events[1].type).toBe('execution-completed');
    });

    test('should handle execution cancellation', async () => {
      // Use a path that will cause execution to take longer
      const executionPromise = eslintExecutor.executeESLint(testProjectPath);
      
      // Cancel execution immediately
      setTimeout(() => {
        eslintExecutor.cancelExecution();
      }, 50);
      
      const result = await executionPromise;
      
      // Check that execution was cancelled (returns error result instead of throwing)
      expect(result.error).toBe('Execution cancelled');
      expect(result.exitCode).toBe(1);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await eslintExecutor.initialize();
    });

    test('should handle invalid project paths', async () => {
      const result = await eslintExecutor.executeESLint('/non-existent-path');
      
      expect(result.error).toBeDefined();
      expect(result.executionId).toBeDefined();
      expect(result.exitCode).not.toBe(0);
    });

    test('should handle corrupted ESLint config', async () => {
      // Create project with invalid config
      const invalidProjectPath = path.join(__dirname, 'temp-invalid-eslint-project');
      await createInvalidConfigProject(invalidProjectPath);
      
      try {
        const result = await eslintExecutor.executeESLint(invalidProjectPath);
        
        // The result should indicate failure with non-zero exit code
        expect(result).toBeDefined();
        expect(result.exitCode).not.toBe(0);
        expect(result.logs.stderr).toContain('Cannot read config file');
      } finally {
        await fs.rm(invalidProjectPath, { recursive: true, force: true });
      }
    });

    test('should recover from execution failures', async () => {
      // Mock a failure scenario
      const originalExecute = eslintExecutor.executeESLint;
      eslintExecutor.executeESLint = jest.fn().mockRejectedValueOnce(new Error('Mock failure'));
      
      await expect(eslintExecutor.executeESLint(testProjectPath)).rejects.toThrow('Mock failure');
      
      // Restore and verify recovery
      eslintExecutor.executeESLint = originalExecute;
      const result = await eslintExecutor.executeESLint(testProjectPath);
      expect(result).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all resources', async () => {
      await eslintExecutor.initialize();
      
      // Execute ESLint to create resources
      await eslintExecutor.executeESLint(testProjectPath);
      
      expect(eslintExecutor.isInitialized).toBe(true);
      
      await eslintExecutor.cleanup();
      
      expect(eslintExecutor.isInitialized).toBe(false);
      expect(eslintExecutor.eslintEngine).toBeNull();
    });
  });
});

// Helper function to create test project
async function createTestProject(projectPath) {
  await fs.mkdir(projectPath, { recursive: true });
  await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });
  
  // Create package.json
  await fs.writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify({
      name: 'test-eslint-project',
      version: '1.0.0',
      type: 'module',
      devDependencies: {
        eslint: '^8.0.0'
      }
    }, null, 2)
  );
  
  // Create ESLint config
  await fs.writeFile(
    path.join(projectPath, '.eslintrc.json'),
    JSON.stringify({
      env: {
        browser: true,
        es2021: true,
        node: true
      },
      extends: 'eslint:recommended',
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      rules: {
        'no-unused-vars': 'error',
        'no-console': 'warn',
        'no-debugger': 'error',
        'no-alert': 'error',
        'prefer-const': 'error',
        'no-var': 'error'
      }
    }, null, 2)
  );
  
  // Create sample files with various ESLint issues
  await fs.writeFile(
    path.join(projectPath, 'src', 'index.js'),
    `// Sample file with ESLint issues
var oldVar = 'should use const'; // no-var violation
const unused = 'not used'; // no-unused-vars violation
let message = 'Hello World';

console.log(message); // no-console warning
alert('Debug message'); // no-alert error
debugger; // no-debugger error

export function calculateSum(a, b) {
  return a + b;
}

export function processData(data) {
  var result = []; // no-var violation
  for (let i = 0; i < data.length; i++) {
    result.push(data[i] * 2);
  }
  return result;
}
`
  );
  
  await fs.writeFile(
    path.join(projectPath, 'src', 'utils.js'),
    `// Another file with different issues
const config = {
  name: 'test',
  value: 42
};

function unusedFunction() { // no-unused-vars violation
  return 'never called';
}

export function formatString(str) {
  console.log('Formatting:', str); // no-console warning
  return str.trim().toLowerCase();
}

export { config };
`
  );
}

// Helper function to create project with invalid config
async function createInvalidConfigProject(projectPath) {
  await fs.mkdir(projectPath, { recursive: true });
  await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });
  
  // Create invalid ESLint config
  await fs.writeFile(
    path.join(projectPath, '.eslintrc.json'),
    '{ invalid json syntax'
  );
  
  await fs.writeFile(
    path.join(projectPath, 'src', 'index.js'),
    'export const test = "hello";'
  );
}