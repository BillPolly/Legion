/**
 * Test EnhancedCodeAgent Git Integration
 * Phase 5.1.2: Git integration in EnhancedCodeAgent class
 */

import { describe, test, expect, beforeAll, afterEach, beforeEach, jest } from '@jest/globals';
import { ResourceManager } from '@jsenvoy/module-loader';
import { EnhancedCodeAgent } from '../../../src/agent/EnhancedCodeAgent.js';
import GitIntegrationManager from '../../../src/integration/GitIntegrationManager.js';
import GitConfigValidator from '../../../src/config/GitConfigValidator.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('EnhancedCodeAgent Git Integration', () => {
  let resourceManager;
  let enhancedAgent;
  let tempDir;

  beforeAll(async () => {
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Register test environment variables
    resourceManager.register('GITHUB_USER', 'TestUser');
    resourceManager.register('GITHUB_PAT', 'ghp_test_token');
    resourceManager.register('GITHUB_AGENT_ORG', 'AgentResults');
  });

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'enhanced-agent-git-test-'));
  });

  afterEach(async () => {
    if (enhancedAgent) {
      await enhancedAgent.cleanup();
      enhancedAgent = null;
    }
    
    // Remove temp directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to cleanup temp directory:', error.message);
      }
    }
  });

  test('should integrate Git with enhanced runtime testing features', async () => {
    const config = {
      enableGitIntegration: true,
      gitConfig: {
        ...GitConfigValidator.getDefaultConfig(),
        autoCommit: true,
        includeTestResults: true
      },
      enhancedConfig: {
        enableRuntimeTesting: true,
        enableBrowserTesting: false // Disable for unit tests
      }
    };
    
    enhancedAgent = new EnhancedCodeAgent(config);
    await enhancedAgent.initialize(tempDir);
    
    // Git should be initialized
    expect(enhancedAgent.gitIntegration).toBeDefined();
    
    // Create test files
    await fs.writeFile(path.join(tempDir, 'app.js'), 'export const app = () => "Hello";');
    await fs.writeFile(path.join(tempDir, 'app.test.js'), `
      import { app } from './app.js';
      test('app returns hello', () => {
        expect(app()).toBe('Hello');
      });
    `);
    
    // Run tests and commit with results
    const testResults = {
      passed: 1,
      failed: 0,
      coverage: 85
    };
    
    const commitResult = await enhancedAgent.commitWithTestResults(
      'testing',
      ['app.js', 'app.test.js'],
      'Add app with tests',
      testResults
    );
    
    expect(commitResult.success).toBe(true);
    expect(commitResult.metadata).toHaveProperty('testResults');
    expect(commitResult.metadata.testResults.passed).toBe(1);
    
    console.log('✅ Git integration with enhanced runtime testing working');
  });

  test('should integrate Git operations with browser testing', async () => {
    const config = {
      enableGitIntegration: true,
      gitConfig: GitConfigValidator.getDefaultConfig(),
      enhancedConfig: {
        enableBrowserTesting: true,
        browserHeadless: true
      }
    };
    
    enhancedAgent = new EnhancedCodeAgent(config);
    await enhancedAgent.initialize(tempDir);
    
    const gitEvents = [];
    enhancedAgent.on('git-browser-test-commit', (data) => gitEvents.push(data));
    
    // Create browser test files
    await fs.writeFile(path.join(tempDir, 'index.html'), '<html><body><h1>Test</h1></body></html>');
    await fs.writeFile(path.join(tempDir, 'browser.test.js'), `
      test('browser test', async ({ page }) => {
        await page.goto('file://${path.join(tempDir, 'index.html')}');
        const title = await page.textContent('h1');
        expect(title).toBe('Test');
      });
    `);
    
    // Commit with browser test metadata
    const browserTestResults = {
      browser: 'chromium',
      passed: 1,
      failed: 0,
      screenshots: ['test-screenshot.png']
    };
    
    const result = await enhancedAgent.commitBrowserTests(
      ['index.html', 'browser.test.js'],
      'Add browser tests',
      browserTestResults
    );
    
    expect(result.success).toBe(true);
    expect(result.metadata.browserTests).toBeDefined();
    expect(result.metadata.browserTests.browser).toBe('chromium');
    
    console.log('✅ Git integration with browser testing working');
  });

  test('should integrate Git with enhanced log analysis', async () => {
    const config = {
      enableGitIntegration: true,
      gitConfig: GitConfigValidator.getDefaultConfig(),
      enhancedConfig: {
        enableLogAnalysis: true
      }
    };
    
    enhancedAgent = new EnhancedCodeAgent(config);
    await enhancedAgent.initialize(tempDir);
    
    // Create files that would generate logs
    await fs.writeFile(path.join(tempDir, 'server.js'), `
      console.log('Server starting...');
      console.error('Warning: Config not found');
      console.log('Server started on port 3000');
    `);
    
    // Simulate log analysis results
    const logAnalysis = {
      errors: 1,
      warnings: 0,
      info: 2,
      patterns: ['Server lifecycle'],
      recommendations: ['Add config file handling']
    };
    
    // Commit with log analysis
    const result = await enhancedAgent.commitWithLogAnalysis(
      'debugging',
      ['server.js'],
      'Add server with logging',
      logAnalysis
    );
    
    expect(result.success).toBe(true);
    expect(result.metadata.logAnalysis).toBeDefined();
    expect(result.metadata.logAnalysis.errors).toBe(1);
    expect(result.metadata.logAnalysis.recommendations).toContain('Add config file handling');
    
    console.log('✅ Git integration with log analysis working');
  });

  test('should support enhanced quality phase Git integration', async () => {
    const config = {
      enableGitIntegration: true,
      gitConfig: {
        ...GitConfigValidator.getDefaultConfig(),
        qualityGates: {
          minCoverage: 80,
          maxComplexity: 10,
          noConsoleLog: true
        }
      }
    };
    
    enhancedAgent = new EnhancedCodeAgent(config);
    await enhancedAgent.initialize(tempDir);
    
    // Create files with quality issues
    await fs.writeFile(path.join(tempDir, 'quality.js'), `
      function complexFunction(a, b, c, d, e) {
        if (a) {
          if (b) {
            if (c) {
              if (d) {
                if (e) {
                  console.log('Too complex!');
                  return true;
                }
              }
            }
          }
        }
        return false;
      }
    `);
    
    // Run quality checks
    const qualityResults = {
      coverage: 75,
      complexity: 15,
      issues: ['console.log found', 'Complexity too high'],
      passed: false
    };
    
    // Try to commit - should fail quality gates
    const result = await enhancedAgent.commitWithQualityGates(
      'quality',
      ['quality.js'],
      'Add complex function',
      qualityResults
    );
    
    expect(result.success).toBe(false);
    expect(result.reason).toContain('quality gates');
    expect(result.failedGates).toContain('minCoverage');
    expect(result.failedGates).toContain('maxComplexity');
    
    console.log('✅ Enhanced quality phase Git integration working');
  });

  test('should handle performance monitoring with Git commits', async () => {
    const config = {
      enableGitIntegration: true,
      gitConfig: GitConfigValidator.getDefaultConfig(),
      enhancedConfig: {
        enablePerformanceMonitoring: true
      }
    };
    
    enhancedAgent = new EnhancedCodeAgent(config);
    await enhancedAgent.initialize(tempDir);
    
    // Create performance-critical files
    await fs.writeFile(path.join(tempDir, 'optimizer.js'), `
      export function optimize(data) {
        // Optimization logic
        return data.sort();
      }
    `);
    
    // Simulate performance metrics
    const performanceMetrics = {
      executionTime: 125,
      memoryUsage: 45.2,
      cpuUsage: 22.5,
      optimizations: ['Sorted data', 'Reduced iterations']
    };
    
    // Commit with performance data
    const result = await enhancedAgent.commitWithPerformanceData(
      'optimization',
      ['optimizer.js'],
      'Add optimizer with performance improvements',
      performanceMetrics
    );
    
    expect(result.success).toBe(true);
    expect(result.metadata.performance).toBeDefined();
    expect(result.metadata.performance.executionTime).toBe(125);
    expect(result.metadata.performance.optimizations).toHaveLength(2);
    
    console.log('✅ Performance monitoring with Git commits working');
  });

  test('should integrate Git with health monitoring', async () => {
    const config = {
      enableGitIntegration: true,
      gitConfig: GitConfigValidator.getDefaultConfig(),
      healthConfig: {
        trackHealthInGit: true
      }
    };
    
    enhancedAgent = new EnhancedCodeAgent(config);
    await enhancedAgent.initialize(tempDir);
    
    // Get health metrics
    const healthMetrics = await enhancedAgent.getHealthMetrics();
    
    // Create file and commit with health data
    await fs.writeFile(path.join(tempDir, 'health-check.js'), 'export const check = () => true;');
    
    const result = await enhancedAgent.commitWithHealthMetrics(
      'monitoring',
      ['health-check.js'],
      'Add health check',
      healthMetrics
    );
    
    expect(result.success).toBe(true);
    expect(result.metadata.health).toBeDefined();
    expect(result.metadata.health).toHaveProperty('cpu');
    expect(result.metadata.health).toHaveProperty('memory');
    
    console.log('✅ Git integration with health monitoring working');
  });

  test('should support parallel execution tracking in Git', async () => {
    const config = {
      enableGitIntegration: true,
      gitConfig: GitConfigValidator.getDefaultConfig(),
      enhancedConfig: {
        parallelExecution: true
      }
    };
    
    enhancedAgent = new EnhancedCodeAgent(config);
    await enhancedAgent.initialize(tempDir);
    
    // Create multiple test files for parallel execution
    const testFiles = [];
    for (let i = 1; i <= 5; i++) {
      const filename = `test${i}.test.js`;
      await fs.writeFile(path.join(tempDir, filename), `
        test('test ${i}', () => {
          expect(${i}).toBe(${i});
        });
      `);
      testFiles.push(filename);
    }
    
    // Simulate parallel execution results
    const parallelResults = {
      totalTests: 5,
      parallelWorkers: 3,
      executionTime: 250,
      speedup: 2.5,
      workerStats: [
        { worker: 1, tests: 2, time: 100 },
        { worker: 2, tests: 2, time: 110 },
        { worker: 3, tests: 1, time: 40 }
      ]
    };
    
    // Commit with parallel execution data
    const result = await enhancedAgent.commitParallelTests(
      testFiles,
      'Add parallel tests',
      parallelResults
    );
    
    expect(result.success).toBe(true);
    expect(result.metadata.parallelExecution).toBeDefined();
    expect(result.metadata.parallelExecution.speedup).toBe(2.5);
    expect(result.metadata.parallelExecution.workerStats).toHaveLength(3);
    
    console.log('✅ Parallel execution tracking in Git working');
  });

  test('should handle enhanced error recovery with Git', async () => {
    const config = {
      enableGitIntegration: true,
      gitConfig: GitConfigValidator.getDefaultConfig(),
      enhancedConfig: {
        enableErrorRecovery: true
      }
    };
    
    enhancedAgent = new EnhancedCodeAgent(config);
    await enhancedAgent.initialize(tempDir);
    
    // Create file with error
    await fs.writeFile(path.join(tempDir, 'error.js'), `
      function buggyFunction() {
        throw new Error('Intentional error');
      }
    `);
    
    // Simulate error and recovery
    const errorInfo = {
      error: 'Intentional error',
      stack: 'at buggyFunction (error.js:3)',
      recovered: true,
      fix: 'Added try-catch block',
      preventionStrategy: 'Input validation added'
    };
    
    // Commit with error recovery data
    const result = await enhancedAgent.commitErrorRecovery(
      ['error.js'],
      'Fix buggy function',
      errorInfo
    );
    
    expect(result.success).toBe(true);
    expect(result.metadata.errorRecovery).toBeDefined();
    expect(result.metadata.errorRecovery.recovered).toBe(true);
    expect(result.metadata.errorRecovery.fix).toBe('Added try-catch block');
    
    console.log('✅ Enhanced error recovery with Git working');
  });

  test('should provide enhanced Git metrics and analytics', async () => {
    const config = {
      enableGitIntegration: true,
      gitConfig: GitConfigValidator.getDefaultConfig(),
      enhancedConfig: {
        trackDetailedMetrics: true
      }
    };
    
    enhancedAgent = new EnhancedCodeAgent(config);
    await enhancedAgent.initialize(tempDir);
    
    // Make several commits with different metadata
    const phases = ['planning', 'development', 'testing', 'quality', 'completion'];
    
    for (const phase of phases) {
      const file = `${phase}.js`;
      await fs.writeFile(path.join(tempDir, file), `// ${phase} code`);
      
      await enhancedAgent.commitPhase(phase, [file], `Complete ${phase} phase`, {
        duration: Math.floor(Math.random() * 1000) + 500,
        complexity: Math.floor(Math.random() * 20) + 5
      });
    }
    
    // Get enhanced metrics
    const metrics = await enhancedAgent.getEnhancedGitMetrics();
    
    expect(metrics).toHaveProperty('phaseMetrics');
    expect(metrics).toHaveProperty('performanceTrends');
    expect(metrics).toHaveProperty('qualityTrends');
    expect(metrics).toHaveProperty('recommendations');
    
    expect(Object.keys(metrics.phaseMetrics)).toHaveLength(5);
    expect(metrics.recommendations).toBeInstanceOf(Array);
    
    console.log('✅ Enhanced Git metrics and analytics working');
  });

  test('should integrate Git with AI-powered fixing insights', async () => {
    const config = {
      enableGitIntegration: true,
      gitConfig: GitConfigValidator.getDefaultConfig(),
      enhancedConfig: {
        enableAIInsights: true
      }
    };
    
    enhancedAgent = new EnhancedCodeAgent(config);
    await enhancedAgent.initialize(tempDir);
    
    // Create file with issues
    await fs.writeFile(path.join(tempDir, 'buggy.js'), `
      function calculate(a, b) {
        return a + b;  // Should handle null values
      }
    `);
    
    // Simulate AI-powered fix
    const aiFixInsights = {
      issue: 'Potential null reference error',
      suggestion: 'Add null checks',
      confidence: 0.92,
      appliedFix: `
        function calculate(a, b) {
          if (a == null || b == null) {
            return 0;
          }
          return a + b;
        }
      `,
      reasoning: 'Prevents runtime errors when null/undefined values are passed'
    };
    
    // Commit with AI insights
    const result = await enhancedAgent.commitAIFix(
      ['buggy.js'],
      'Fix null handling based on AI analysis',
      aiFixInsights
    );
    
    expect(result.success).toBe(true);
    expect(result.metadata.aiFix).toBeDefined();
    expect(result.metadata.aiFix.confidence).toBe(0.92);
    expect(result.metadata.aiFix.reasoning).toContain('runtime errors');
    
    console.log('✅ Git integration with AI-powered fixing insights working');
  });
});