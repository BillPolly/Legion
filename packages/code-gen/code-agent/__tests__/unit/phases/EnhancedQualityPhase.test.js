/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { EnhancedQualityPhase } from '../../../src/phases/EnhancedQualityPhase.js';
import { RuntimeConfig } from '../../../src/config/RuntimeConfig.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('EnhancedQualityPhase', () => {
  let qualityPhase;
  let mockConfig;
  let testProjectPath;

  beforeAll(async () => {
    mockConfig = new RuntimeConfig({
      nodeRunner: {
        timeout: 30000,
        maxConcurrentProcesses: 3,
        healthCheckInterval: 1000,
        shutdownTimeout: 5000
      },
      logManager: {
        logLevel: 'info',
        enableStreaming: true,
        captureStdout: true,
        captureStderr: true
      },
      playwright: {
        headless: true,
        timeout: 30000,
        browsers: ['chromium'],
        baseURL: 'http://localhost:3000'
      },
      quality: {
        eslintPath: 'node_modules/.bin/eslint',
        jestPath: 'node_modules/.bin/jest',
        prettierPath: 'node_modules/.bin/prettier'
      }
    });

    // Create a temporary test project
    testProjectPath = path.join(__dirname, 'temp-quality-project');
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
    qualityPhase = new EnhancedQualityPhase(mockConfig);
  });

  afterEach(async () => {
    if (qualityPhase) {
      await qualityPhase.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize with configuration', () => {
      expect(qualityPhase.config).toBeDefined();
      expect(qualityPhase.isInitialized).toBe(false);
      expect(qualityPhase.qualityResults).toBeInstanceOf(Map);
    });

    test('should initialize all components', async () => {
      await qualityPhase.initialize();
      
      expect(qualityPhase.isInitialized).toBe(true);
      expect(qualityPhase.testExecutor).toBeDefined();
      expect(qualityPhase.serverManager).toBeDefined();
      expect(qualityPhase.logManager).toBeDefined();
      expect(qualityPhase.logAnalyzer).toBeDefined();
    });

    test('should load quality rules', async () => {
      await qualityPhase.initialize();
      
      expect(qualityPhase.qualityRules).toBeDefined();
      expect(qualityPhase.qualityRules.eslint).toBeDefined();
      expect(qualityPhase.qualityRules.jest).toBeDefined();
      expect(qualityPhase.qualityRules.prettier).toBeDefined();
    });
  });

  describe('Real ESLint Execution', () => {
    beforeEach(async () => {
      await qualityPhase.initialize();
    });

    test('should run real ESLint checks', async () => {
      const result = await qualityPhase.runESLintChecks(testProjectPath);
      
      expect(result).toBeDefined();
      expect(result.passed).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.fixableErrors).toBeDefined();
      expect(result.fixableWarnings).toBeDefined();
      expect(result.executionTime).toBeDefined();
    });

    test('should capture ESLint logs', async () => {
      const result = await qualityPhase.runESLintChecks(testProjectPath);
      
      expect(result.logs).toBeDefined();
      expect(result.logs.stdout).toBeDefined();
      expect(result.logs.stderr).toBeDefined();
      expect(result.logAnalysis).toBeDefined();
    });

    test('should analyze ESLint errors', async () => {
      const result = await qualityPhase.runESLintChecks(testProjectPath);
      
      if (result.errors.length > 0) {
        expect(result.errorAnalysis).toBeDefined();
        expect(result.errorAnalysis.byRule).toBeDefined();
        expect(result.errorAnalysis.byFile).toBeDefined();
        expect(result.errorAnalysis.mostCommon).toBeDefined();
      }
    });

    test('should suggest ESLint fixes', async () => {
      const result = await qualityPhase.runESLintChecks(testProjectPath);
      
      expect(result.suggestions).toBeDefined();
      if (result.fixableErrors > 0) {
        expect(result.suggestions).toContain('Run with --fix to automatically fix some issues');
      }
    });
  });

  describe('Real Jest Execution', () => {
    beforeEach(async () => {
      await qualityPhase.initialize();
    });

    test('should run real Jest tests', async () => {
      const result = await qualityPhase.runJestTests(testProjectPath);
      
      expect(result).toBeDefined();
      expect(result.passed).toBeDefined();
      expect(result.totalTests).toBeDefined();
      expect(result.passedTests).toBeDefined();
      expect(result.failedTests).toBeDefined();
      expect(result.coverage).toBeDefined();
      expect(result.executionTime).toBeDefined();
    });

    test('should capture Jest output', async () => {
      const result = await qualityPhase.runJestTests(testProjectPath);
      
      expect(result.logs).toBeDefined();
      expect(result.testResults).toBeDefined();
      expect(result.coverageReport).toBeDefined();
    });

    test('should analyze test failures', async () => {
      const result = await qualityPhase.runJestTests(testProjectPath);
      
      if (result.failedTests > 0) {
        expect(result.failureAnalysis).toBeDefined();
        expect(result.failureAnalysis.byType).toBeDefined();
        expect(result.failureAnalysis.stackTraces).toBeDefined();
        expect(result.failureAnalysis.suggestions).toBeDefined();
      }
    });

    test('should generate test coverage insights', async () => {
      const result = await qualityPhase.runJestTests(testProjectPath);
      
      expect(result.coverageInsights).toBeDefined();
      expect(result.coverageInsights.uncoveredFiles).toBeDefined();
      expect(result.coverageInsights.lowCoverageFiles).toBeDefined();
      expect(result.coverageInsights.recommendations).toBeDefined();
    });
  });

  describe('Real Prettier Checks', () => {
    beforeEach(async () => {
      await qualityPhase.initialize();
    });

    test('should run Prettier formatting checks', async () => {
      const result = await qualityPhase.runPrettierChecks(testProjectPath);
      
      expect(result).toBeDefined();
      expect(result.formatted).toBeDefined();
      expect(result.unformatted).toBeDefined();
      expect(result.errors).toBeDefined();
    });

    test('should identify formatting issues', async () => {
      const result = await qualityPhase.runPrettierChecks(testProjectPath);
      
      if (result.unformatted.length > 0) {
        expect(result.formattingIssues).toBeDefined();
        expect(result.formattingIssues).toHaveLength(result.unformatted.length);
      }
    });
  });

  describe('Integrated Quality Analysis', () => {
    beforeEach(async () => {
      await qualityPhase.initialize();
    });

    test('should run comprehensive quality check', async () => {
      const result = await qualityPhase.runComprehensiveQualityCheck(testProjectPath);
      
      expect(result).toBeDefined();
      expect(result.eslint).toBeDefined();
      expect(result.jest).toBeDefined();
      expect(result.prettier).toBeDefined();
      expect(result.overallScore).toBeDefined();
      expect(result.passed).toBeDefined();
    });

    test('should correlate quality issues', async () => {
      const result = await qualityPhase.runComprehensiveQualityCheck(testProjectPath);
      
      expect(result.correlations).toBeDefined();
      expect(result.correlations.lintAndTest).toBeDefined();
      expect(result.correlations.formatAndLint).toBeDefined();
      expect(result.commonIssues).toBeDefined();
    });

    test('should provide prioritized recommendations', async () => {
      const result = await qualityPhase.runComprehensiveQualityCheck(testProjectPath);
      
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.critical).toBeDefined();
      expect(result.recommendations.important).toBeDefined();
      expect(result.recommendations.nice).toBeDefined();
    });

    test('should analyze code quality trends', async () => {
      // Run multiple times to establish trends
      await qualityPhase.runComprehensiveQualityCheck(testProjectPath);
      await qualityPhase.runComprehensiveQualityCheck(testProjectPath);
      
      const trends = await qualityPhase.analyzeQualityTrends();
      
      expect(trends).toBeDefined();
      expect(trends.improving).toBeDefined();
      expect(trends.degrading).toBeDefined();
      expect(trends.stable).toBeDefined();
    });
  });

  describe('Log-Based Insights', () => {
    beforeEach(async () => {
      await qualityPhase.initialize();
    });

    test('should extract insights from ESLint logs', async () => {
      const result = await qualityPhase.runESLintChecks(testProjectPath);
      const insights = await qualityPhase.extractESLintInsights(result.logs);
      
      expect(insights).toBeDefined();
      expect(insights.patterns).toBeDefined();
      expect(insights.rootCauses).toBeDefined();
      expect(insights.quickFixes).toBeDefined();
    });

    test('should correlate test failures with code issues', async () => {
      const eslintResult = await qualityPhase.runESLintChecks(testProjectPath);
      const jestResult = await qualityPhase.runJestTests(testProjectPath);
      
      const correlation = await qualityPhase.correlateTestAndLintIssues(
        jestResult.failedTests,
        eslintResult.errors
      );
      
      expect(correlation).toBeDefined();
      expect(correlation.related).toBeDefined();
      expect(correlation.causality).toBeDefined();
    });

    test('should identify performance bottlenecks from logs', async () => {
      const result = await qualityPhase.runJestTests(testProjectPath);
      const bottlenecks = await qualityPhase.identifyPerformanceBottlenecks(result.logs);
      
      expect(bottlenecks).toBeDefined();
      expect(bottlenecks.slowTests).toBeDefined();
      expect(bottlenecks.memoryIssues).toBeDefined();
      expect(bottlenecks.recommendations).toBeDefined();
    });
  });

  describe('Auto-Fix Capabilities', () => {
    beforeEach(async () => {
      await qualityPhase.initialize();
    });

    test('should auto-fix ESLint issues', async () => {
      const checkResult = await qualityPhase.runESLintChecks(testProjectPath);
      
      if (checkResult.fixableErrors > 0 || checkResult.fixableWarnings > 0) {
        const fixResult = await qualityPhase.autoFixESLintIssues(testProjectPath);
        
        expect(fixResult).toBeDefined();
        expect(fixResult.fixed).toBeDefined();
        expect(fixResult.remaining).toBeDefined();
        expect(fixResult.changedFiles).toBeDefined();
      }
    });

    test('should auto-format with Prettier', async () => {
      const checkResult = await qualityPhase.runPrettierChecks(testProjectPath);
      
      if (checkResult.unformatted.length > 0) {
        const formatResult = await qualityPhase.autoFormatCode(testProjectPath);
        
        expect(formatResult).toBeDefined();
        expect(formatResult.formatted).toBeDefined();
        expect(formatResult.failed).toBeDefined();
      }
    });

    test('should suggest test fixes', async () => {
      const testResult = await qualityPhase.runJestTests(testProjectPath);
      
      if (testResult.failedTests > 0) {
        const suggestions = await qualityPhase.suggestTestFixes(testResult.testResults);
        
        expect(suggestions).toBeDefined();
        expect(suggestions.assertions).toBeDefined();
        expect(suggestions.mocking).toBeDefined();
        expect(suggestions.async).toBeDefined();
      }
    });
  });

  describe('Quality Gates', () => {
    beforeEach(async () => {
      await qualityPhase.initialize();
    });

    test('should enforce quality gates', async () => {
      const result = await qualityPhase.enforceQualityGates(testProjectPath);
      
      expect(result).toBeDefined();
      expect(result.passed).toBeDefined();
      expect(result.gates).toBeDefined();
      expect(result.gates.linting).toBeDefined();
      expect(result.gates.testing).toBeDefined();
      expect(result.gates.coverage).toBeDefined();
      expect(result.gates.formatting).toBeDefined();
    });

    test('should block on critical issues', async () => {
      const gates = {
        maxErrors: 0,
        minCoverage: 80,
        requireFormatting: true
      };
      
      const result = await qualityPhase.enforceQualityGates(testProjectPath, gates);
      
      expect(result.blockers).toBeDefined();
      if (!result.passed) {
        expect(result.blockers.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Reporting', () => {
    beforeEach(async () => {
      await qualityPhase.initialize();
    });

    test('should generate comprehensive quality report', async () => {
      await qualityPhase.runComprehensiveQualityCheck(testProjectPath);
      const report = await qualityPhase.generateQualityReport();
      
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.details).toBeDefined();
      expect(report.trends).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.timestamp).toBeDefined();
    });

    test('should export quality metrics', async () => {
      await qualityPhase.runComprehensiveQualityCheck(testProjectPath);
      const metrics = await qualityPhase.exportQualityMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.eslint).toBeDefined();
      expect(metrics.jest).toBeDefined();
      expect(metrics.prettier).toBeDefined();
      expect(metrics.overall).toBeDefined();
    });

    test('should generate actionable insights', async () => {
      await qualityPhase.runComprehensiveQualityCheck(testProjectPath);
      const insights = await qualityPhase.generateActionableInsights();
      
      expect(insights).toBeDefined();
      expect(insights.immediate).toBeDefined();
      expect(insights.shortTerm).toBeDefined();
      expect(insights.longTerm).toBeDefined();
      expect(insights.automation).toBeDefined();
    });
  });

  describe('Integration with CI/CD', () => {
    beforeEach(async () => {
      await qualityPhase.initialize();
    });

    test('should output CI-friendly results', async () => {
      const result = await qualityPhase.runForCI(testProjectPath);
      
      expect(result).toBeDefined();
      expect(result.exitCode).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.artifacts).toBeDefined();
    });

    test('should generate test reports for CI', async () => {
      const result = await qualityPhase.runForCI(testProjectPath);
      
      expect(result.reports).toBeDefined();
      expect(result.reports.junit).toBeDefined();
      expect(result.reports.coverage).toBeDefined();
      expect(result.reports.eslint).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await qualityPhase.initialize();
    });

    test('should handle missing ESLint config', async () => {
      const result = await qualityPhase.runESLintChecks('/non-existent-path');
      
      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
    });

    test('should handle Jest execution failures', async () => {
      const result = await qualityPhase.runJestTests('/invalid-project');
      
      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
    });

    test('should recover from partial failures', async () => {
      const result = await qualityPhase.runComprehensiveQualityCheck('/partial-project');
      
      expect(result).toBeDefined();
      expect(result.partial).toBeDefined();
      expect(result.completedChecks).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all resources', async () => {
      await qualityPhase.initialize();
      
      // Run quality checks
      await qualityPhase.runComprehensiveQualityCheck(testProjectPath);
      
      expect(qualityPhase.qualityResults.size).toBeGreaterThan(0);
      
      await qualityPhase.cleanup();
      
      expect(qualityPhase.qualityResults.size).toBe(0);
      expect(qualityPhase.isInitialized).toBe(false);
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
      name: 'test-quality-project',
      version: '1.0.0',
      type: 'module',
      scripts: {
        test: 'jest',
        lint: 'eslint src',
        format: 'prettier --check src'
      },
      devDependencies: {
        eslint: '^8.0.0',
        jest: '^29.0.0',
        prettier: '^3.0.0'
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
        'no-console': 'warn'
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
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: ['**/__tests__/**/*.test.js']
};`
  );
  
  // Create Prettier config
  await fs.writeFile(
    path.join(projectPath, '.prettierrc'),
    JSON.stringify({
      semi: true,
      singleQuote: true,
      tabWidth: 2,
      trailingComma: 'es5'
    }, null, 2)
  );
  
  // Create sample source file with issues
  await fs.writeFile(
    path.join(projectPath, 'src', 'index.js'),
    `// Sample file with quality issues
export function calculateSum(a, b) {
  console.log('Calculating sum'); // Should trigger no-console warning
  const result = a + b;
  const unused = 'This variable is not used'; // Should trigger no-unused-vars error
  return result;
}

export function formatString(str) {
  return str.trim().toLowerCase()
}

// Unformatted code
export const config={
  name:"test",
  value:42
}
`
  );
  
  // Create sample test file
  await fs.writeFile(
    path.join(projectPath, '__tests__', 'index.test.js'),
    `import { calculateSum, formatString } from '../src/index.js';

describe('calculateSum', () => {
  test('should add two numbers', () => {
    expect(calculateSum(2, 3)).toBe(5);
  });
  
  test('should handle negative numbers', () => {
    expect(calculateSum(-1, -1)).toBe(-2);
  });
});

describe('formatString', () => {
  test('should trim and lowercase string', () => {
    expect(formatString('  HELLO  ')).toBe('hello');
  });
  
  // This test will fail
  test('should handle empty string', () => {
    expect(formatString('')).toBe(null);
  });
});
`
  );
}