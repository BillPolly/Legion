/**
 * E2EValidator - End-to-end validation system
 * 
 * Provides:
 * - Complete workflow validation
 * - Integration testing across all components
 * - Production readiness checks
 * - Performance validation
 * - Security validation
 */

import { EventEmitter } from 'events';
import { EnhancedCodeAgent } from '../agent/EnhancedCodeAgent.js';
import { SecurityScanner } from '../security/SecurityScanner.js';
import { PerformanceMonitor } from '../monitoring/PerformanceMonitor.js';

/**
 * Validation test case
 */
class ValidationTest {
  constructor(name, testFn, options = {}) {
    this.name = name;
    this.testFn = testFn;
    this.timeout = options.timeout || 300000; // 5 minutes default
    this.retries = options.retries || 0;
    this.critical = options.critical || false;
    this.category = options.category || 'general';
  }

  async run(context) {
    const startTime = Date.now();
    let attempts = 0;
    let lastError = null;
    
    while (attempts <= this.retries) {
      try {
        attempts++;
        const result = await Promise.race([
          this.testFn(context),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Test timeout')), this.timeout)
          )
        ]);
        
        return {
          name: this.name,
          success: true,
          duration: Date.now() - startTime,
          attempts,
          result
        };
        
      } catch (error) {
        lastError = error;
        if (attempts > this.retries) {
          return {
            name: this.name,
            success: false,
            duration: Date.now() - startTime,
            attempts,
            error: error.message,
            critical: this.critical
          };
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
}

/**
 * End-to-end validation system
 */
class E2EValidator extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      workingDirectory: './validation-test',
      enableCleanup: true,
      runSecurity: true,
      runPerformance: true,
      runIntegration: true,
      performanceThresholds: {
        totalDuration: 600000, // 10 minutes
        memoryUsage: 2048, // MB
        cpuUsage: 80 // %
      },
      ...config
    };
    
    this.tests = [];
    this.results = [];
    this.agent = null;
    this.securityScanner = null;
    this.performanceMonitor = null;
    
    // Initialize tests
    this.initializeTests();
  }

  /**
   * Initialize validation tests
   */
  initializeTests() {
    // Core functionality tests
    this.addTest('Agent Initialization', async (ctx) => {
      ctx.agent = new EnhancedCodeAgent({
        projectType: 'fullstack',
        enhancedConfig: {
          enableRuntimeTesting: true,
          enableBrowserTesting: true,
          enableLogAnalysis: true
        }
      });
      
      await ctx.agent.initialize(this.config.workingDirectory);
      return { initialized: true };
    }, { critical: true, category: 'core' });
    
    // Project generation tests
    this.addTest('Simple Project Generation', async (ctx) => {
      const result = await ctx.agent.develop({
        projectName: 'Validation Test App',
        description: 'Simple todo application for validation',
        features: [
          'Add and remove tasks',
          'Mark tasks complete',
          'Local storage'
        ]
      });
      
      return {
        success: result.success,
        filesGenerated: result.filesGenerated,
        testsCreated: result.testsCreated
      };
    }, { critical: true, category: 'generation' });
    
    // Quality validation tests
    this.addTest('Quality Checks Pass', async (ctx) => {
      const qualityResults = await ctx.agent.runEnhancedQualityChecks();
      
      return {
        eslintPassed: qualityResults.eslint.errorCount === 0,
        testsPassed: qualityResults.jest.failed === 0,
        coverage: qualityResults.coverage?.percentage || 0
      };
    }, { category: 'quality' });
    
    // Runtime testing validation
    this.addTest('Runtime Test Execution', async (ctx) => {
      const testResults = await ctx.agent.comprehensiveTestingPhase.runAllTests({
        includeUnit: true,
        includeIntegration: true,
        includeE2E: false // Skip for speed
      });
      
      return {
        totalTests: testResults.summary.total,
        passed: testResults.summary.passed,
        failed: testResults.summary.failed,
        duration: testResults.duration
      };
    }, { category: 'testing' });
    
    // Fix validation
    this.addTest('Fix Application', async (ctx) => {
      // Intentionally break something
      const fileOps = ctx.agent.fileOps;
      await fileOps.writeFile(
        `${this.config.workingDirectory}/broken.js`,
        'const x = ; // Syntax error'
      );
      
      // Run quality checks (should fail)
      const beforeFix = await ctx.agent.runEnhancedQualityChecks();
      
      // Apply fixes
      const fixResult = await ctx.agent.runEnhancedFixing();
      
      // Verify fixed
      const afterFix = await ctx.agent.runEnhancedQualityChecks();
      
      return {
        hadErrors: beforeFix.eslint.errorCount > 0,
        fixApplied: fixResult.success,
        errorsFixed: afterFix.eslint.errorCount === 0
      };
    }, { category: 'fixing' });
    
    // Security validation
    if (this.config.runSecurity) {
      this.addTest('Security Scan', async (ctx) => {
        ctx.securityScanner = new SecurityScanner();
        const report = await ctx.securityScanner.scanProject(
          this.config.workingDirectory
        );
        
        return {
          critical: report.summary.critical,
          high: report.summary.high,
          medium: report.summary.medium,
          low: report.summary.low,
          passed: report.summary.critical === 0 && report.summary.high === 0
        };
      }, { category: 'security' });
    }
    
    // Performance validation
    if (this.config.runPerformance) {
      this.addTest('Performance Benchmarks', async (ctx) => {
        const metrics = ctx.agent.getMetricsSummary();
        
        return {
          totalTime: metrics.totalTime,
          cpuPeak: metrics.resourcePeaks.cpu,
          memoryPeak: metrics.resourcePeaks.memory,
          withinThresholds: 
            metrics.totalTime < this.config.performanceThresholds.totalDuration &&
            metrics.resourcePeaks.memory < this.config.performanceThresholds.memoryUsage * 1024 * 1024 &&
            metrics.resourcePeaks.cpu < this.config.performanceThresholds.cpuUsage
        };
      }, { category: 'performance' });
    }
    
    // Integration tests
    if (this.config.runIntegration) {
      this.addTest('Component Integration', async (ctx) => {
        // Test that all components work together
        const results = {
          runtimeManager: false,
          healthMonitor: false,
          performanceOptimizer: false,
          logManager: false
        };
        
        // Check runtime manager
        if (ctx.agent.runtimeManager && ctx.agent.runtimeManager.isInitialized) {
          results.runtimeManager = true;
        }
        
        // Check health monitor
        if (ctx.agent.healthMonitor && ctx.agent.healthMonitor.isRunning) {
          results.healthMonitor = true;
        }
        
        // Check performance optimizer
        if (ctx.agent.performanceOptimizer) {
          const report = ctx.agent.performanceOptimizer.generatePerformanceReport();
          results.performanceOptimizer = report !== null;
        }
        
        // Check log manager
        if (ctx.agent.runtimeManager && ctx.agent.runtimeManager.logManager) {
          results.logManager = true;
        }
        
        return results;
      }, { category: 'integration' });
      
      this.addTest('Event System', async (ctx) => {
        const events = [];
        const expectedEvents = ['progress', 'phase-start', 'phase-complete'];
        
        // Set up listeners
        expectedEvents.forEach(event => {
          ctx.agent.once(event, (data) => {
            events.push({ event, data });
          });
        });
        
        // Trigger a small operation
        await ctx.agent.planningPhase.planProject({
          projectName: 'Event Test',
          description: 'Testing events'
        });
        
        return {
          eventsReceived: events.length,
          hasAllEvents: expectedEvents.every(e => 
            events.some(evt => evt.event === e)
          )
        };
      }, { category: 'integration' });
    }
    
    // Cleanup test
    this.addTest('Resource Cleanup', async (ctx) => {
      const beforeCleanup = process.memoryUsage();
      
      await ctx.agent.cleanup();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const afterCleanup = process.memoryUsage();
      
      return {
        memoryFreed: beforeCleanup.heapUsed - afterCleanup.heapUsed > 0,
        agentCleaned: !ctx.agent.healthMonitor?.isRunning
      };
    }, { category: 'cleanup' });
  }

  /**
   * Add validation test
   */
  addTest(name, testFn, options) {
    this.tests.push(new ValidationTest(name, testFn, options));
  }

  /**
   * Run all validation tests
   */
  async validate() {
    this.emit('validation:started', {
      totalTests: this.tests.length,
      config: this.config
    });
    
    const context = {};
    const startTime = Date.now();
    let passed = 0;
    let failed = 0;
    let critical = 0;
    
    // Set up performance monitoring
    if (this.config.runPerformance) {
      this.performanceMonitor = new PerformanceMonitor();
      this.performanceMonitor.start();
    }
    
    try {
      // Run tests sequentially
      for (const test of this.tests) {
        this.emit('test:started', {
          name: test.name,
          category: test.category
        });
        
        const result = await test.run(context);
        this.results.push(result);
        
        if (result.success) {
          passed++;
          this.emit('test:passed', result);
        } else {
          failed++;
          if (result.critical) critical++;
          this.emit('test:failed', result);
          
          // Stop on critical failure
          if (result.critical) {
            break;
          }
        }
      }
      
      // Generate report
      const report = this.generateReport();
      
      this.emit('validation:completed', {
        duration: Date.now() - startTime,
        passed,
        failed,
        critical,
        report
      });
      
      return report;
      
    } catch (error) {
      this.emit('error', {
        message: `Validation failed: ${error.message}`,
        error: error.message
      });
      throw error;
      
    } finally {
      // Cleanup
      if (context.agent) {
        await context.agent.cleanup();
      }
      
      if (this.performanceMonitor) {
        this.performanceMonitor.stop();
      }
      
      if (this.config.enableCleanup) {
        await this.cleanup();
      }
    }
  }

  /**
   * Generate validation report
   */
  generateReport() {
    const categories = {};
    const criticalFailures = [];
    
    // Group by category
    for (const result of this.results) {
      const test = this.tests.find(t => t.name === result.name);
      const category = test?.category || 'general';
      
      if (!categories[category]) {
        categories[category] = {
          total: 0,
          passed: 0,
          failed: 0,
          tests: []
        };
      }
      
      categories[category].total++;
      if (result.success) {
        categories[category].passed++;
      } else {
        categories[category].failed++;
        if (result.critical) {
          criticalFailures.push(result);
        }
      }
      
      categories[category].tests.push(result);
    }
    
    // Calculate overall health
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
    
    // Performance metrics
    let performanceReport = null;
    if (this.performanceMonitor) {
      performanceReport = this.performanceMonitor.generateReport();
    }
    
    return {
      summary: {
        totalTests,
        passed: passedTests,
        failed: totalTests - passedTests,
        criticalFailures: criticalFailures.length,
        successRate: successRate.toFixed(2),
        duration: this.results.reduce((sum, r) => sum + r.duration, 0)
      },
      categories,
      criticalFailures,
      performance: performanceReport,
      recommendations: this.generateRecommendations(),
      productionReady: this.isProductionReady()
    };
  }

  /**
   * Generate recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Check test results
    const failedTests = this.results.filter(r => !r.success);
    
    if (failedTests.some(t => t.name.includes('Security'))) {
      recommendations.push({
        priority: 'high',
        message: 'Address security vulnerabilities before deployment'
      });
    }
    
    if (failedTests.some(t => t.name.includes('Performance'))) {
      recommendations.push({
        priority: 'medium',
        message: 'Optimize performance to meet benchmarks'
      });
    }
    
    if (failedTests.some(t => t.name.includes('Quality'))) {
      recommendations.push({
        priority: 'high',
        message: 'Fix quality issues and improve test coverage'
      });
    }
    
    // Check categories
    const categories = this.getCategoryResults();
    
    if (categories.integration && categories.integration.failed > 0) {
      recommendations.push({
        priority: 'high',
        message: 'Resolve integration issues between components'
      });
    }
    
    return recommendations;
  }

  /**
   * Check if production ready
   */
  isProductionReady() {
    // Critical checks
    const criticalPassed = this.results
      .filter(r => this.tests.find(t => t.name === r.name)?.critical)
      .every(r => r.success);
    
    if (!criticalPassed) return false;
    
    // Security checks
    const securityTest = this.results.find(r => r.name === 'Security Scan');
    if (securityTest && !securityTest.result?.passed) return false;
    
    // Performance checks
    const perfTest = this.results.find(r => r.name === 'Performance Benchmarks');
    if (perfTest && !perfTest.result?.withinThresholds) return false;
    
    // Quality checks
    const qualityTest = this.results.find(r => r.name === 'Quality Checks Pass');
    if (qualityTest && !qualityTest.success) return false;
    
    return true;
  }

  /**
   * Get results by category
   */
  getCategoryResults() {
    const categories = {};
    
    for (const result of this.results) {
      const test = this.tests.find(t => t.name === result.name);
      const category = test?.category || 'general';
      
      if (!categories[category]) {
        categories[category] = { passed: 0, failed: 0 };
      }
      
      if (result.success) {
        categories[category].passed++;
      } else {
        categories[category].failed++;
      }
    }
    
    return categories;
  }

  /**
   * Cleanup
   */
  async cleanup() {
    try {
      // Remove test directory
      const fs = await import('fs/promises');
      await fs.rm(this.config.workingDirectory, { 
        recursive: true, 
        force: true 
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

export { E2EValidator };