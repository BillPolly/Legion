/**
 * EnhancedFixingPhase Tests
 * 
 * Tests for the AI-powered fixing phase with log-based insights
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { EnhancedFixingPhase } from '../../../src/phases/EnhancedFixingPhase.js';

describe('EnhancedFixingPhase', () => {
  let phase;
  let mockConfig;
  let mockLogManager;
  let mockLogAnalyzer;
  let mockLLMClient;
  let mockFileWriter;
  let mockTestExecutor;
  let mockESLintExecutor;

  beforeEach(() => {
    mockConfig = {
      workingDirectory: '/test/project',
      maxIterations: 3,
      fixStrategies: ['syntax', 'logic', 'performance'],
      enableAutoFix: true
    };

    // Mock log manager
    mockLogManager = {
      captureTestLogs: jest.fn().mockResolvedValue({ logs: [] }),
      captureLintLogs: jest.fn().mockResolvedValue({ logs: [] }),
      getLogsByPattern: jest.fn().mockResolvedValue([]),
      attachToProcess: jest.fn()
    };

    // Mock log analyzer
    mockLogAnalyzer = {
      analyzeTestFailures: jest.fn().mockResolvedValue({
        rootCauses: [],
        patterns: [],
        suggestions: []
      }),
      analyzeLintErrors: jest.fn().mockResolvedValue({
        errors: [],
        warnings: [],
        autoFixable: []
      }),
      correlateErrors: jest.fn().mockResolvedValue({
        correlations: [],
        commonCauses: []
      }),
      generateFixSuggestions: jest.fn().mockResolvedValue([])
    };

    // Mock LLM client
    mockLLMClient = {
      generateFix: jest.fn().mockResolvedValue({
        code: 'fixed code',
        explanation: 'fix explanation'
      }),
      analyzeProblem: jest.fn().mockResolvedValue({
        analysis: 'problem analysis',
        approach: 'fix approach'
      })
    };

    // Mock file writer
    mockFileWriter = {
      writeFile: jest.fn().mockResolvedValue(true),
      readFile: jest.fn().mockResolvedValue('original code')
    };

    // Mock test executor
    mockTestExecutor = {
      executeTests: jest.fn().mockResolvedValue({
        success: true,
        passed: 10,
        failed: 0
      })
    };

    // Mock ESLint executor
    mockESLintExecutor = {
      executeLint: jest.fn().mockResolvedValue({
        success: true,
        errorCount: 0,
        warningCount: 0
      })
    };

    phase = new EnhancedFixingPhase(mockConfig);
    
    // Inject mocks
    phase.logManager = mockLogManager;
    phase.logAnalyzer = mockLogAnalyzer;
    phase.llmClient = mockLLMClient;
    phase.fileWriter = mockFileWriter;
    phase.testExecutor = mockTestExecutor;
    phase.eslintExecutor = mockESLintExecutor;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      expect(phase.config).toEqual(mockConfig);
      expect(phase.fixHistory).toEqual([]);
      expect(phase.currentIteration).toBe(0);
    });

    test('should be an EventEmitter', () => {
      expect(phase).toBeInstanceOf(EventEmitter);
    });

    test('should initialize fix strategies', () => {
      expect(phase.strategies).toBeDefined();
      expect(phase.strategies.size).toBeGreaterThan(0);
    });
  });

  describe('Fix Application', () => {
    test('should apply fixes based on test failures', async () => {
      const testFailures = {
        failed: 2,
        errors: [
          {
            testName: 'should calculate sum',
            error: 'Expected 5 but got 4',
            file: 'calculator.js',
            line: 10
          }
        ]
      };

      mockLogAnalyzer.analyzeTestFailures.mockResolvedValue({
        rootCauses: [{
          type: 'logic_error',
          description: 'Incorrect calculation',
          file: 'calculator.js',
          line: 10
        }],
        suggestions: [{
          fix: 'Change + to - operator',
          confidence: 0.9
        }]
      });

      const result = await phase.applyFixes(testFailures);

      expect(result.success).toBe(true);
      expect(mockLogAnalyzer.analyzeTestFailures).toHaveBeenCalledWith(testFailures);
      expect(mockLLMClient.generateFix).toHaveBeenCalled();
      expect(mockFileWriter.writeFile).toHaveBeenCalled();
    });

    test('should apply ESLint auto-fixes', async () => {
      const lintErrors = {
        errorCount: 3,
        errors: [
          {
            rule: 'semi',
            file: 'app.js',
            line: 5,
            fixable: true
          }
        ]
      };

      mockLogAnalyzer.analyzeLintErrors.mockResolvedValue({
        autoFixable: [lintErrors.errors[0]]
      });

      const result = await phase.applyLintFixes(lintErrors);

      expect(result.success).toBe(true);
      expect(result.fixedCount).toBeGreaterThan(0);
      expect(mockESLintExecutor.executeLint).toHaveBeenCalledWith(
        expect.objectContaining({ fix: true })
      );
    });

    test('should handle fix application failures', async () => {
      mockFileWriter.writeFile.mockRejectedValue(new Error('Write failed'));

      const result = await phase.applyFixes({ failed: 1, errors: [] });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Root Cause Analysis', () => {
    test('should perform root cause analysis from logs', async () => {
      const logs = [
        { level: 'error', message: 'TypeError: Cannot read property', timestamp: Date.now() },
        { level: 'warn', message: 'Deprecated function used', timestamp: Date.now() }
      ];

      mockLogManager.getLogsByPattern.mockResolvedValue(logs);
      mockLogAnalyzer.correlateErrors.mockResolvedValue({
        correlations: [{
          primaryError: 'TypeError',
          relatedErrors: ['undefined variable'],
          rootCause: 'Missing initialization'
        }]
      });

      const result = await phase.analyzeRootCause({ failed: 1 });

      expect(result.rootCauses).toBeDefined();
      expect(result.correlations).toBeDefined();
      expect(mockLogManager.getLogsByPattern).toHaveBeenCalled();
      expect(mockLogAnalyzer.correlateErrors).toHaveBeenCalled();
    });

    test('should identify patterns across multiple failures', async () => {
      const failures = [
        { file: 'a.js', error: 'undefined is not a function' },
        { file: 'b.js', error: 'undefined is not a function' }
      ];

      const result = await phase.identifyPatterns(failures);

      expect(result.patterns).toBeDefined();
      expect(result.commonIssues).toBeDefined();
    });
  });

  describe('Fix Generation', () => {
    test('should generate targeted fixes based on analysis', async () => {
      const analysis = {
        rootCause: 'Missing error handling',
        file: 'api.js',
        line: 25,
        suggestion: 'Add try-catch block'
      };

      mockLLMClient.generateFix.mockResolvedValue({
        code: 'try { /* existing code */ } catch (error) { /* handle */ }',
        explanation: 'Added error handling'
      });

      const result = await phase.generateFix(analysis);

      expect(result.code).toBeDefined();
      expect(result.explanation).toBeDefined();
      expect(mockLLMClient.generateFix).toHaveBeenCalledWith(
        expect.objectContaining({
          rootCause: analysis.rootCause
        })
      );
    });

    test('should generate multiple fix alternatives', async () => {
      const analysis = {
        rootCause: 'Performance issue',
        file: 'processor.js'
      };

      const result = await phase.generateFixAlternatives(analysis);

      expect(result.alternatives).toBeDefined();
      expect(Array.isArray(result.alternatives)).toBe(true);
      expect(result.alternatives.length).toBeGreaterThan(0);
    });

    test('should prioritize fixes based on confidence', async () => {
      const fixes = [
        { fix: 'Fix A', confidence: 0.6 },
        { fix: 'Fix B', confidence: 0.9 },
        { fix: 'Fix C', confidence: 0.7 }
      ];

      const prioritized = await phase.prioritizeFixes(fixes);

      expect(prioritized[0].confidence).toBe(0.9);
      expect(prioritized[1].confidence).toBe(0.7);
      expect(prioritized[2].confidence).toBe(0.6);
    });
  });

  describe('Fix Validation', () => {
    test('should validate fixes by running tests', async () => {
      const fix = {
        file: 'calculator.js',
        code: 'fixed code',
        testFile: 'calculator.test.js'
      };

      mockTestExecutor.executeTests.mockResolvedValue({
        success: true,
        passed: 5,
        failed: 0
      });

      const result = await phase.validateFix(fix);

      expect(result.valid).toBe(true);
      expect(result.testsPassed).toBe(true);
      expect(mockTestExecutor.executeTests).toHaveBeenCalled();
    });

    test('should validate fixes with ESLint', async () => {
      const fix = {
        file: 'app.js',
        code: 'fixed code'
      };

      mockESLintExecutor.executeLint.mockResolvedValue({
        success: true,
        errorCount: 0
      });

      const result = await phase.validateWithLint(fix);

      expect(result.valid).toBe(true);
      expect(result.lintPassed).toBe(true);
      expect(mockESLintExecutor.executeLint).toHaveBeenCalled();
    });

    test('should reject invalid fixes', async () => {
      mockTestExecutor.executeTests.mockResolvedValue({
        success: false,
        failed: 2
      });

      const result = await phase.validateFix({ file: 'bad.js' });

      expect(result.valid).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe('Iterative Fixing', () => {
    test('should iterate until all issues are fixed', async () => {
      let iteration = 0;
      
      mockTestExecutor.executeTests.mockImplementation(async () => {
        iteration++;
        return {
          success: iteration >= 2,
          failed: iteration < 2 ? 1 : 0
        };
      });

      const result = await phase.iterativeFix({
        initialFailures: 1,
        maxIterations: 3
      });

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(2);
      expect(phase.fixHistory.length).toBe(2);
    });

    test('should stop after max iterations', async () => {
      mockTestExecutor.executeTests.mockResolvedValue({
        success: false,
        failed: 1
      });

      const result = await phase.iterativeFix({
        maxIterations: 3
      });

      expect(result.success).toBe(false);
      expect(result.iterations).toBe(3);
      expect(result.reason).toContain('max iterations');
    });

    test('should track fix history', async () => {
      await phase.applyFixes({ failed: 1, errors: [] });
      await phase.applyFixes({ failed: 1, errors: [] });

      expect(phase.fixHistory.length).toBe(2);
      expect(phase.fixHistory[0].iteration).toBe(1);
      expect(phase.fixHistory[1].iteration).toBe(2);
    });
  });

  describe('Fix Strategies', () => {
    test('should apply syntax fix strategy', async () => {
      const error = {
        type: 'SyntaxError',
        message: 'Unexpected token',
        file: 'app.js',
        line: 10
      };

      const strategy = phase.strategies.get('syntax');
      const result = await strategy.apply(error, phase);

      expect(result).toBeDefined();
      expect(result.type).toBe('syntax');
    });

    test('should apply logic fix strategy', async () => {
      const error = {
        type: 'AssertionError',
        message: 'Expected true but got false',
        file: 'logic.js'
      };

      const strategy = phase.strategies.get('logic');
      const result = await strategy.apply(error, phase);

      expect(result).toBeDefined();
      expect(result.type).toBe('logic');
    });

    test('should apply performance fix strategy', async () => {
      const issue = {
        type: 'PerformanceWarning',
        message: 'Function takes too long',
        file: 'processor.js'
      };

      const strategy = phase.strategies.get('performance');
      const result = await strategy.apply(issue, phase);

      expect(result).toBeDefined();
      expect(result.type).toBe('performance');
    });

    test('should select appropriate strategy based on error type', async () => {
      const syntaxError = { type: 'SyntaxError' };
      const logicError = { type: 'AssertionError' };
      const perfIssue = { type: 'PerformanceWarning' };

      expect(phase.selectStrategy(syntaxError).name).toBe('syntax');
      expect(phase.selectStrategy(logicError).name).toBe('logic');
      expect(phase.selectStrategy(perfIssue).name).toBe('performance');
    });
  });

  describe('Event Emission', () => {
    test('should emit fix started event', async () => {
      const listener = jest.fn();
      phase.on('fix:started', listener);

      await phase.applyFixes({ failed: 1, errors: [] });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          iteration: 1,
          failures: expect.any(Object)
        })
      );
    });

    test('should emit fix completed event', async () => {
      const listener = jest.fn();
      phase.on('fix:completed', listener);

      await phase.applyFixes({ failed: 0, errors: [] });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          iteration: 1
        })
      );
    });

    test('should emit analysis event', async () => {
      const listener = jest.fn();
      phase.on('analysis:completed', listener);

      await phase.analyzeRootCause({ failed: 1 });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          rootCauses: expect.any(Object)
        })
      );
    });
  });

  describe('Integration', () => {
    test('should integrate with quality phase results', async () => {
      const qualityResults = {
        eslint: { errorCount: 2, errors: [] },
        jest: { failed: 1, errors: [] },
        browser: { failed: 0 }
      };

      const result = await phase.fixQualityIssues(qualityResults);

      expect(result.eslintFixed).toBeDefined();
      expect(result.testsFixed).toBeDefined();
      expect(result.overallSuccess).toBeDefined();
    });

    test('should generate comprehensive fix report', async () => {
      phase.fixHistory = [
        { iteration: 1, fixes: 2, success: false },
        { iteration: 2, fixes: 1, success: true }
      ];

      const report = await phase.generateReport();

      expect(report.totalIterations).toBe(2);
      expect(report.totalFixes).toBe(3);
      expect(report.finalSuccess).toBe(true);
      expect(report.history).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle LLM client errors', async () => {
      mockLLMClient.generateFix.mockRejectedValue(new Error('LLM error'));

      const result = await phase.generateFix({ rootCause: 'test' });

      expect(result.error).toBeDefined();
      expect(result.fallback).toBeDefined();
    });

    test('should handle file write errors', async () => {
      mockFileWriter.writeFile.mockRejectedValue(new Error('Permission denied'));

      const result = await phase.applyFixes({ failed: 1, errors: [] });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });

    test('should handle validation errors gracefully', async () => {
      mockTestExecutor.executeTests.mockRejectedValue(new Error('Test runner error'));

      const result = await phase.validateFix({ file: 'test.js' });

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});