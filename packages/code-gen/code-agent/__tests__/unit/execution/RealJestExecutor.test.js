/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { RealJestExecutor } from '../../../src/execution/RealJestExecutor.js';
import { TestLogManager } from '../../../src/logging/TestLogManager.js';
import { LogAnalysisEngine } from '../../../src/logging/LogAnalysisEngine.js';
import { RuntimeConfig } from '../../../src/config/RuntimeConfig.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('RealJestExecutor', () => {
  let jestExecutor;
  let logManager;
  let logAnalyzer;
  let mockConfig;
  let testProjectPath;

  beforeAll(async () => {
    mockConfig = new RuntimeConfig({
      jest: {
        testEnvironment: 'node',
        collectCoverage: true,
        coverageDirectory: 'coverage',
        coverageReporters: ['json', 'lcov', 'text', 'html'],
        testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
        testPathIgnorePatterns: ['/node_modules/', '/dist/'],
        coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
        setupFilesAfterEnv: [],
        testTimeout: 10000,
        maxWorkers: 4,
        verbose: true,
        bail: false,
        forceExit: true,
        detectOpenHandles: true
      },
      logManager: {
        logLevel: 'info',
        enableStreaming: true,
        captureStdout: true,
        captureStderr: true
      }
    });

    // Create test project
    testProjectPath = path.join(__dirname, 'temp-jest-project');
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
    jestExecutor = new RealJestExecutor(mockConfig, logManager, logAnalyzer);
  });

  afterEach(async () => {
    if (jestExecutor) {
      await jestExecutor.cleanup();
    }
    if (logManager) {
      await logManager.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize with configuration', () => {
      expect(jestExecutor.config).toBeDefined();
      expect(jestExecutor.logManager).toBeDefined();
      expect(jestExecutor.logAnalyzer).toBeDefined();
      expect(jestExecutor.isInitialized).toBe(false);
    });

    test('should initialize Jest engine', async () => {
      await jestExecutor.initialize();
      
      expect(jestExecutor.isInitialized).toBe(true);
      expect(jestExecutor.jestEngine).toBeDefined();
      expect(jestExecutor.executionId).toBeDefined();
    });

    test('should validate Jest configuration', async () => {
      await jestExecutor.initialize();
      
      const isValid = await jestExecutor.validateConfiguration(testProjectPath);
      expect(isValid).toBe(true);
    });

    test('should handle missing Jest configuration', async () => {
      await jestExecutor.initialize();
      
      const isValid = await jestExecutor.validateConfiguration('/non-existent-path');
      expect(isValid).toBe(false);
    });
  });

  describe('Real Jest Execution', () => {
    beforeEach(async () => {
      await jestExecutor.initialize();
      // Set timeout for Jest execution tests
      jest.setTimeout(60000);
    });

    test('should execute Jest with real engine', async () => {
      // Increase timeout for this test
      jest.setTimeout(60000);
      
      const result = await jestExecutor.executeJest(testProjectPath);
      
      expect(result).toBeDefined();
      expect(result.executionId).toBeDefined();
      expect(result.exitCode).toBeDefined();
      expect(result.testResults).toBeDefined();
      expect(result.numTotalTests).toBeDefined();
      expect(result.numPassedTests).toBeDefined();
      expect(result.numFailedTests).toBeDefined();
      expect(result.numPendingTests).toBeDefined();
      expect(result.executionTime).toBeDefined();
    }, 60000);

    test('should capture Jest output logs', async () => {
      const result = await jestExecutor.executeJest(testProjectPath);
      
      expect(result.logs).toBeDefined();
      expect(result.logs.stdout).toBeDefined();
      expect(result.logs.stderr).toBeDefined();
      expect(result.correlationId).toBeDefined();
    });

    test('should parse Jest results correctly', async () => {
      const result = await jestExecutor.executeJest(testProjectPath);
      
      expect(result.testResults).toBeInstanceOf(Array);
      if (result.testResults.length > 0) {
        const firstResult = result.testResults[0];
        expect(firstResult.testFilePath).toBeDefined();
        expect(firstResult.testResults).toBeDefined();
        expect(firstResult.numFailingTests).toBeDefined();
        expect(firstResult.numPassingTests).toBeDefined();
      }
    });

    test('should collect coverage information', async () => {
      const result = await jestExecutor.executeJest(testProjectPath, { coverage: true });
      
      expect(result.coverage).toBeDefined();
      expect(result.coverage.global).toBeDefined();
      expect(result.coverage.global.lines).toBeDefined();
      expect(result.coverage.global.statements).toBeDefined();
      expect(result.coverage.global.functions).toBeDefined();
      expect(result.coverage.global.branches).toBeDefined();
    });

    test('should correlate Jest results with logs', async () => {
      const result = await jestExecutor.executeJest(testProjectPath);
      
      // Get logs by correlation ID
      const correlatedLogs = logManager.getLogsByCorrelationId(result.correlationId);
      expect(correlatedLogs).toBeDefined();
      expect(correlatedLogs.length).toBeGreaterThan(0);
    });

    test('should analyze Jest logs for insights', async () => {
      const result = await jestExecutor.executeJest(testProjectPath);
      
      const logs = logManager.getLogsByCorrelationId(result.correlationId);
      const analysis = await logAnalyzer.analyzeTestLogs(logs);
      
      expect(analysis).toBeDefined();
      expect(analysis.errors).toBeDefined();
      expect(analysis.warnings).toBeDefined();
      expect(analysis.patterns).toBeDefined();
    });
  });

  describe('Test Failure Analysis', () => {
    beforeEach(async () => {
      await jestExecutor.initialize();
    });

    test('should analyze test failures', async () => {
      const result = await jestExecutor.executeJest(testProjectPath);
      const analysis = await jestExecutor.analyzeFailures(result);
      
      expect(analysis).toBeDefined();
      expect(analysis.byType).toBeDefined();
      expect(analysis.byFile).toBeDefined();
      expect(analysis.commonPatterns).toBeDefined();
    });

    test('should categorize failure types', async () => {
      const result = await jestExecutor.executeJest(testProjectPath);
      const analysis = await jestExecutor.analyzeFailures(result);
      
      expect(analysis.byType).toBeDefined();
      expect(analysis.byType.assertion).toBeDefined();
      expect(analysis.byType.timeout).toBeDefined();
      expect(analysis.byType.error).toBeDefined();
    });

    test('should extract stack traces', async () => {
      const result = await jestExecutor.executeJest(testProjectPath);
      const analysis = await jestExecutor.analyzeFailures(result);
      
      if (result.numFailedTests > 0) {
        expect(analysis.stackTraces).toBeDefined();
        expect(analysis.stackTraces).toBeInstanceOf(Array);
      }
    });

    test('should generate failure suggestions', async () => {
      const result = await jestExecutor.executeJest(testProjectPath);
      const suggestions = await jestExecutor.generateFailureSuggestions(result);
      
      expect(suggestions).toBeDefined();
      expect(suggestions.immediate).toBeDefined();
      expect(suggestions.longTerm).toBeDefined();
    });
  });

  describe('Coverage Analysis', () => {
    beforeEach(async () => {
      await jestExecutor.initialize();
    });

    test('should analyze coverage metrics', async () => {
      const result = await jestExecutor.executeJest(testProjectPath, { coverage: true });
      const analysis = await jestExecutor.analyzeCoverage(result);
      
      expect(analysis).toBeDefined();
      expect(analysis.summary).toBeDefined();
      expect(analysis.uncoveredLines).toBeDefined();
      expect(analysis.lowCoverageFiles).toBeDefined();
    });

    test('should identify uncovered code', async () => {
      const result = await jestExecutor.executeJest(testProjectPath, { coverage: true });
      const analysis = await jestExecutor.analyzeCoverage(result);
      
      expect(analysis.uncoveredLines).toBeDefined();
      expect(analysis.uncoveredBranches).toBeDefined();
      expect(analysis.uncoveredFunctions).toBeDefined();
    });

    test('should suggest coverage improvements', async () => {
      const result = await jestExecutor.executeJest(testProjectPath, { coverage: true });
      const suggestions = await jestExecutor.generateCoverageSuggestions(result);
      
      expect(suggestions).toBeDefined();
      expect(suggestions.priorities).toBeDefined();
      expect(suggestions.testFiles).toBeDefined();
    });

    test('should track coverage trends', async () => {
      // Run multiple times to establish trends
      await jestExecutor.executeJest(testProjectPath, { coverage: true });
      await jestExecutor.executeJest(testProjectPath, { coverage: true });
      
      const trends = await jestExecutor.getCoverageTrends();
      
      expect(trends).toBeDefined();
      expect(trends.totalRuns).toBe(2);
      expect(trends.coverageHistory).toBeDefined();
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      await jestExecutor.initialize();
    });

    test('should measure execution performance', async () => {
      const result = await jestExecutor.executeJest(testProjectPath);
      
      expect(result.performance).toBeDefined();
      expect(result.performance.executionTime).toBeDefined();
      expect(result.performance.memoryUsage).toBeDefined();
      expect(result.performance.testsPerSecond).toBeDefined();
    });

    test('should identify slow tests', async () => {
      const result = await jestExecutor.executeJest(testProjectPath);
      const analysis = await jestExecutor.identifySlowTests(result);
      
      expect(analysis).toBeDefined();
      expect(analysis.slowTests).toBeDefined();
      expect(analysis.averageTestTime).toBeDefined();
      expect(analysis.recommendations).toBeDefined();
    });

    test('should track performance metrics over time', async () => {
      await jestExecutor.executeJest(testProjectPath);
      await jestExecutor.executeJest(testProjectPath);
      
      const metrics = await jestExecutor.getPerformanceMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.averageExecutionTime).toBeDefined();
      expect(metrics.totalExecutions).toBe(2);
      expect(metrics.performanceHistory).toBeDefined();
    });
  });

  describe('Test Result Parsing', () => {
    beforeEach(async () => {
      await jestExecutor.initialize();
    });

    test('should parse test suites correctly', async () => {
      const result = await jestExecutor.executeJest(testProjectPath);
      const parsed = await jestExecutor.parseTestResults(result);
      
      expect(parsed).toBeDefined();
      expect(parsed.testSuites).toBeDefined();
      expect(parsed.testSuites).toBeInstanceOf(Array);
    });

    test('should extract test metadata', async () => {
      const result = await jestExecutor.executeJest(testProjectPath);
      const parsed = await jestExecutor.parseTestResults(result);
      
      for (const suite of parsed.testSuites) {
        expect(suite.name).toBeDefined();
        expect(suite.tests).toBeDefined();
        expect(suite.status).toBeDefined();
      }
    });

    test('should handle test hooks', async () => {
      const result = await jestExecutor.executeJest(testProjectPath);
      const parsed = await jestExecutor.parseTestResults(result);
      
      expect(parsed.hooks).toBeDefined();
      expect(parsed.hooks.beforeAll).toBeDefined();
      expect(parsed.hooks.afterAll).toBeDefined();
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      await jestExecutor.initialize();
    });

    test('should load Jest configuration', async () => {
      const config = await jestExecutor.loadConfiguration(testProjectPath);
      
      expect(config).toBeDefined();
      expect(config.testEnvironment).toBeDefined();
      expect(config.collectCoverage).toBeDefined();
    });

    test('should validate configuration', async () => {
      const config = await jestExecutor.loadConfiguration(testProjectPath);
      const validation = await jestExecutor.validateJestConfig(config);
      
      expect(validation).toBeDefined();
      expect(validation.valid).toBeDefined();
      expect(validation.issues).toBeDefined();
    });

    test('should suggest configuration improvements', async () => {
      const config = await jestExecutor.loadConfiguration(testProjectPath);
      const suggestions = await jestExecutor.suggestConfigurationImprovements(config);
      
      expect(suggestions).toBeDefined();
      expect(suggestions.performance).toBeDefined();
      expect(suggestions.coverage).toBeDefined();
    });
  });

  describe('Reporting', () => {
    beforeEach(async () => {
      await jestExecutor.initialize();
    });

    test('should generate detailed Jest report', async () => {
      const result = await jestExecutor.executeJest(testProjectPath);
      const report = await jestExecutor.generateReport(result);
      
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.details).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.timestamp).toBeDefined();
    });

    test('should export results in multiple formats', async () => {
      const result = await jestExecutor.executeJest(testProjectPath);
      
      const jsonReport = await jestExecutor.exportResults(result, 'json');
      const junitReport = await jestExecutor.exportResults(result, 'junit');
      const htmlReport = await jestExecutor.exportResults(result, 'html');
      
      expect(jsonReport).toBeDefined();
      expect(junitReport).toBeDefined();
      expect(htmlReport).toBeDefined();
    });

    test('should generate CI-compatible output', async () => {
      const result = await jestExecutor.executeJest(testProjectPath);
      const ciOutput = await jestExecutor.generateCIOutput(result);
      
      expect(ciOutput).toBeDefined();
      expect(ciOutput.exitCode).toBeDefined();
      expect(ciOutput.summary).toBeDefined();
      expect(ciOutput.artifacts).toBeDefined();
    });
  });

  describe('Watch Mode', () => {
    beforeEach(async () => {
      await jestExecutor.initialize();
    });

    test('should support watch mode initialization', async () => {
      const watchConfig = await jestExecutor.setupWatchMode(testProjectPath);
      
      expect(watchConfig).toBeDefined();
      expect(watchConfig.watchAll).toBeDefined();
      expect(watchConfig.watchPathIgnorePatterns).toBeDefined();
    });

    test('should handle file change detection', async () => {
      const changes = await jestExecutor.detectFileChanges(testProjectPath, [
        'src/math.js',
        'src/string.js'
      ]);
      
      expect(changes).toBeDefined();
      expect(changes.changedFiles).toBeDefined();
      expect(changes.affectedTests).toBeDefined();
    });
  });

  describe('Integration Features', () => {
    beforeEach(async () => {
      await jestExecutor.initialize();
    });

    test('should integrate with log correlation', async () => {
      const result = await jestExecutor.executeJest(testProjectPath);
      
      // Check log correlation
      const correlatedLogs = logManager.getLogsByCorrelationId(result.correlationId);
      expect(correlatedLogs.length).toBeGreaterThan(0);
      
      // Check log analysis
      const analysis = await logAnalyzer.analyzeTestLogs(correlatedLogs);
      expect(analysis.errors).toBeDefined();
    });

    test('should emit execution events', async () => {
      const events = [];
      jestExecutor.on('execution-started', (event) => events.push(event));
      jestExecutor.on('execution-completed', (event) => events.push(event));
      
      await jestExecutor.executeJest(testProjectPath);
      
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('execution-started');
      expect(events[1].type).toBe('execution-completed');
    });

    test('should handle execution cancellation', async () => {
      const executionPromise = jestExecutor.executeJest(testProjectPath);
      
      // Cancel execution
      setTimeout(() => {
        jestExecutor.cancelExecution();
      }, 50);
      
      const result = await executionPromise;
      
      // Check that execution was cancelled
      expect(result.error).toBe('Execution cancelled');
      expect(result.exitCode).toBe(1);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await jestExecutor.initialize();
    });

    test('should handle invalid project paths', async () => {
      const result = await jestExecutor.executeJest('/non-existent-path');
      
      expect(result.error).toBeDefined();
      expect(result.executionId).toBeDefined();
      expect(result.exitCode).not.toBe(0);
    });

    test('should handle corrupted Jest config', async () => {
      // Create project with invalid config
      const invalidProjectPath = path.join(__dirname, 'temp-invalid-jest-project');
      await createInvalidJestProject(invalidProjectPath);
      
      try {
        const result = await jestExecutor.executeJest(invalidProjectPath);
        expect(result).toBeDefined();
        expect(result.exitCode).not.toBe(0);
      } finally {
        await fs.rm(invalidProjectPath, { recursive: true, force: true });
      }
    });

    test('should recover from execution failures', async () => {
      // Mock a failure scenario
      const originalExecute = jestExecutor.executeJest;
      jestExecutor.executeJest = jest.fn().mockRejectedValueOnce(new Error('Mock failure'));
      
      await expect(jestExecutor.executeJest(testProjectPath)).rejects.toThrow('Mock failure');
      
      // Restore and verify recovery
      jestExecutor.executeJest = originalExecute;
      const result = await jestExecutor.executeJest(testProjectPath);
      expect(result).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all resources', async () => {
      await jestExecutor.initialize();
      
      // Execute Jest to create resources
      await jestExecutor.executeJest(testProjectPath);
      
      expect(jestExecutor.isInitialized).toBe(true);
      
      await jestExecutor.cleanup();
      
      expect(jestExecutor.isInitialized).toBe(false);
      expect(jestExecutor.jestEngine).toBeNull();
    });
  });
});

// Helper function to create test project
async function createTestProject(projectPath) {
  await fs.mkdir(projectPath, { recursive: true });
  await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });
  await fs.mkdir(path.join(projectPath, '__tests__'), { recursive: true });
  
  // Create package.json
  await fs.writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify({
      name: 'test-jest-project',
      version: '1.0.0',
      type: 'module',
      scripts: {
        test: 'jest',
        'test:coverage': 'jest --coverage',
        'test:watch': 'jest --watch'
      },
      devDependencies: {
        jest: '^29.7.0'
      }
    }, null, 2)
  );
  
  // Create Jest config
  await fs.writeFile(
    path.join(projectPath, 'jest.config.js'),
    `export default {
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['json', 'lcov', 'text', 'html'],
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/index.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};`
  );
  
  // Create source files
  await fs.writeFile(
    path.join(projectPath, 'src', 'math.js'),
    `// Math utility functions
export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

export function multiply(a, b) {
  return a * b;
}

export function divide(a, b) {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}

export function factorial(n) {
  if (n < 0) {
    throw new Error('Factorial of negative number');
  }
  if (n === 0 || n === 1) {
    return 1;
  }
  return n * factorial(n - 1);
}
`
  );
  
  await fs.writeFile(
    path.join(projectPath, 'src', 'string.js'),
    `// String utility functions
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function reverse(str) {
  return str.split('').reverse().join('');
}

export function isPalindrome(str) {
  const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  return cleaned === cleaned.split('').reverse().join('');
}

export function countWords(str) {
  return str.trim().split(/\\s+/).length;
}
`
  );
  
  // Create test files
  await fs.writeFile(
    path.join(projectPath, '__tests__', 'math.test.js'),
    `import { add, subtract, multiply, divide, factorial } from '../src/math.js';

describe('Math utilities', () => {
  describe('add', () => {
    test('should add two positive numbers', () => {
      expect(add(2, 3)).toBe(5);
    });
    
    test('should add negative numbers', () => {
      expect(add(-2, -3)).toBe(-5);
    });
    
    test('should add zero', () => {
      expect(add(5, 0)).toBe(5);
    });
  });

  describe('subtract', () => {
    test('should subtract two numbers', () => {
      expect(subtract(5, 3)).toBe(2);
    });
    
    test('should handle negative results', () => {
      expect(subtract(3, 5)).toBe(-2);
    });
  });

  describe('multiply', () => {
    test('should multiply two numbers', () => {
      expect(multiply(4, 3)).toBe(12);
    });
    
    test('should handle zero', () => {
      expect(multiply(5, 0)).toBe(0);
    });
  });

  describe('divide', () => {
    test('should divide two numbers', () => {
      expect(divide(10, 2)).toBe(5);
    });
    
    test('should throw on division by zero', () => {
      expect(() => divide(10, 0)).toThrow('Division by zero');
    });
  });

  describe('factorial', () => {
    test('should calculate factorial of positive number', () => {
      expect(factorial(5)).toBe(120);
    });
    
    test('should return 1 for 0 and 1', () => {
      expect(factorial(0)).toBe(1);
      expect(factorial(1)).toBe(1);
    });
    
    test('should throw for negative numbers', () => {
      expect(() => factorial(-1)).toThrow('Factorial of negative number');
    });
  });
});
`
  );
  
  await fs.writeFile(
    path.join(projectPath, '__tests__', 'string.test.js'),
    `import { capitalize, reverse, isPalindrome, countWords } from '../src/string.js';

describe('String utilities', () => {
  describe('capitalize', () => {
    test('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
    });
    
    test('should handle empty string', () => {
      expect(capitalize('')).toBe('');
    });
    
    test('should handle already capitalized', () => {
      expect(capitalize('Hello')).toBe('Hello');
    });
  });

  describe('reverse', () => {
    test('should reverse string', () => {
      expect(reverse('hello')).toBe('olleh');
    });
    
    test('should handle palindrome', () => {
      expect(reverse('racecar')).toBe('racecar');
    });
  });

  describe('isPalindrome', () => {
    test('should identify palindrome', () => {
      expect(isPalindrome('racecar')).toBe(true);
    });
    
    test('should identify non-palindrome', () => {
      expect(isPalindrome('hello')).toBe(false);
    });
    
    test('should handle spaces and punctuation', () => {
      expect(isPalindrome('A man, a plan, a canal: Panama')).toBe(true);
    });
  });

  describe('countWords', () => {
    test('should count words in sentence', () => {
      expect(countWords('Hello world')).toBe(2);
    });
    
    test('should handle multiple spaces', () => {
      expect(countWords('Hello   world')).toBe(2);
    });
    
    test('should handle single word', () => {
      expect(countWords('Hello')).toBe(1);
    });
  });
});
`
  );
  
  // Create a test file with intentional failure
  await fs.writeFile(
    path.join(projectPath, '__tests__', 'failing.test.js'),
    `describe('Failing tests', () => {
  test('should fail intentionally', () => {
    expect(1 + 1).toBe(3); // This will fail
  });
  
  test('should pass', () => {
    expect(true).toBe(true);
  });
});
`
  );
}

// Helper function to create project with invalid Jest config
async function createInvalidJestProject(projectPath) {
  await fs.mkdir(projectPath, { recursive: true });
  await fs.mkdir(path.join(projectPath, '__tests__'), { recursive: true });
  
  // Create invalid Jest config
  await fs.writeFile(
    path.join(projectPath, 'jest.config.js'),
    'export default { invalid: "config" syntax'
  );
  
  await fs.writeFile(
    path.join(projectPath, '__tests__', 'test.test.js'),
    'test("simple test", () => { expect(true).toBe(true); });'
  );
}