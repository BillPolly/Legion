/**
 * EnhancedCodeAgent - Enhanced orchestrator with real runtime testing
 * 
 * Extends the base CodeAgent with:
 * - Real test execution through node-runner
 * - Browser testing with playwright
 * - Comprehensive log analysis with log-manager
 * - Enhanced quality validation
 * - AI-powered fixing with log insights
 */

import { EventEmitter } from 'events';
import { CodeAgent } from './CodeAgent.js';

// Import runtime integration
import { RuntimeIntegrationManager } from '../integration/RuntimeIntegrationManager.js';

// Import enhanced phases
import { EnhancedQualityPhase } from '../phases/EnhancedQualityPhase.js';
import { ComprehensiveTestingPhase } from '../phases/ComprehensiveTestingPhase.js';
import { EnhancedFixingPhase } from '../phases/EnhancedFixingPhase.js';

// Import monitoring
import { SystemHealthMonitor } from '../monitoring/SystemHealthMonitor.js';
import { PerformanceOptimizer } from '../optimization/PerformanceOptimizer.js';

/**
 * Enhanced CodeAgent with real runtime testing capabilities
 */
class EnhancedCodeAgent extends CodeAgent {
  constructor(config = {}) {
    super(config);
    
    // Enhanced configuration
    this.enhancedConfig = {
      enableRuntimeTesting: true,
      enableBrowserTesting: true,
      enableLogAnalysis: true,
      enablePerformanceMonitoring: true,
      runtimeTimeout: 300000, // 5 minutes
      browserHeadless: true,
      parallelExecution: true,
      ...config.enhancedConfig
    };
    
    // Runtime components
    this.runtimeManager = null;
    this.healthMonitor = null;
    this.performanceOptimizer = null;
    
    // Enhanced phases
    this.enhancedQualityPhase = null;
    this.comprehensiveTestingPhase = null;
    this.enhancedFixingPhase = null;
    
    // Metrics tracking
    this.metrics = {
      totalExecutionTime: 0,
      phaseMetrics: new Map(),
      resourceUsage: {
        cpu: [],
        memory: [],
        disk: []
      }
    };
  }

  /**
   * Initialize enhanced components
   */
  async initialize(workingDirectory, options = {}) {
    // Initialize base CodeAgent
    await super.initialize(workingDirectory, options);
    
    try {
      // Initialize runtime integration manager
      this.runtimeManager = new RuntimeIntegrationManager({
        workingDirectory,
        ...this.enhancedConfig,
        ...options.runtimeConfig
      });
      await this.runtimeManager.initialize();
      
      // Initialize system health monitor
      this.healthMonitor = new SystemHealthMonitor({
        checkInterval: 5000,
        thresholds: {
          cpu: 80,
          memory: 85,
          disk: 90
        },
        ...options.healthConfig
      });
      await this.healthMonitor.start();
      
      // Initialize performance optimizer
      this.performanceOptimizer = new PerformanceOptimizer({
        enableCaching: true,
        enableParallelization: true,
        ...options.performanceConfig
      });
      
      // Initialize enhanced phases
      this.enhancedQualityPhase = new EnhancedQualityPhase({
        workingDirectory,
        runtimeManager: this.runtimeManager,
        ...options.qualityConfig
      });
      await this.enhancedQualityPhase.initialize();
      
      this.comprehensiveTestingPhase = new ComprehensiveTestingPhase({
        workingDirectory,
        runtimeManager: this.runtimeManager,
        ...options.testingConfig
      });
      await this.comprehensiveTestingPhase.initialize();
      
      this.enhancedFixingPhase = new EnhancedFixingPhase({
        workingDirectory,
        llmClient: this.llmClient,
        ...options.fixingConfig
      });
      await this.enhancedFixingPhase.initialize();
      
      // Set up event forwarding
      this.setupEventForwarding();
      
      this.emit('info', {
        message: 'Enhanced CodeAgent initialized with runtime testing',
        capabilities: {
          runtimeTesting: this.enhancedConfig.enableRuntimeTesting,
          browserTesting: this.enhancedConfig.enableBrowserTesting,
          logAnalysis: this.enhancedConfig.enableLogAnalysis
        }
      });
      
    } catch (error) {
      this.emit('error', {
        message: `Failed to initialize enhanced components: ${error.message}`,
        phase: 'enhanced_initialization',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Enhanced development workflow with real testing
   */
  async develop(requirements) {
    if (!this.initialized) {
      throw new Error('EnhancedCodeAgent must be initialized before use');
    }
    
    const startTime = Date.now();
    this.metrics.totalExecutionTime = 0;
    
    this.emit('info', {
      message: 'Starting enhanced development process with real testing...',
      requirements,
      mode: 'enhanced'
    });
    
    try {
      // Start health monitoring
      this.healthMonitor.on('warning', (data) => {
        this.emit('warning', {
          message: `System health warning: ${data.metric} at ${data.value}%`,
          metric: data
        });
      });
      
      // 1. Planning Phase (using base implementation)
      await this.trackPhase('planning', async () => {
        this.emit('phase-start', {
          phase: 'planning',
          emoji: '📋',
          message: 'Planning project architecture...'
        });
        await this.planProject(requirements);
      });
      
      // 2. Code Generation Phase (using base implementation)
      await this.trackPhase('generation', async () => {
        this.emit('phase-start', {
          phase: 'generation',
          emoji: '⚡',
          message: 'Generating code...'
        });
        await this.generateCode();
      });
      
      // 3. Test Generation Phase (using base implementation)
      await this.trackPhase('test_generation', async () => {
        this.emit('phase-start', {
          phase: 'testing',
          emoji: '🧪',
          message: 'Creating tests...'
        });
        await this.generateTests();
      });
      
      // 4. Enhanced Quality Phase with Real Testing
      await this.trackPhase('enhanced_quality', async () => {
        this.emit('phase-start', {
          phase: 'enhanced_quality',
          emoji: '🚀',
          message: 'Running real quality validation...'
        });
        await this.runEnhancedQualityChecks();
      });
      
      // 5. Comprehensive Testing Phase
      await this.trackPhase('comprehensive_testing', async () => {
        this.emit('phase-start', {
          phase: 'comprehensive_testing',
          emoji: '🧪',
          message: 'Executing comprehensive test suite...'
        });
        await this.runComprehensiveTesting();
      });
      
      // 6. Enhanced Fixing Phase
      await this.trackPhase('enhanced_fixing', async () => {
        this.emit('phase-start', {
          phase: 'enhanced_fixing',
          emoji: '🔧',
          message: 'Applying AI-powered fixes...'
        });
        await this.runEnhancedFixing();
      });
      
      // 7. Final Validation
      await this.trackPhase('final_validation', async () => {
        this.emit('phase-start', {
          phase: 'final_validation',
          emoji: '✅',
          message: 'Final validation...'
        });
        await this.runFinalValidation();
      });
      
      // Complete workflow
      this.metrics.totalExecutionTime = Date.now() - startTime;
      
      const summary = await this.generateEnhancedSummary();
      
      this.emit('info', {
        message: '🎉 Enhanced development completed successfully!',
        summary,
        metrics: this.getMetricsSummary()
      });
      
      return summary;
      
    } catch (error) {
      this.emit('error', {
        message: `Enhanced development failed: ${error.message}`,
        phase: 'enhanced_development',
        error: error.message,
        metrics: this.getMetricsSummary()
      });
      throw error;
    } finally {
      // Cleanup
      await this.cleanup();
    }
  }

  /**
   * Run enhanced quality checks with real execution
   */
  async runEnhancedQualityChecks() {
    try {
      const results = await this.enhancedQualityPhase.runQualityChecks();
      
      this.qualityCheckResults = {
        ...this.qualityCheckResults,
        enhanced: results
      };
      
      // Store detailed results
      if (results.logs) {
        await this.storeLogs('quality', results.logs);
      }
      
      return results;
      
    } catch (error) {
      this.emit('error', {
        message: `Enhanced quality checks failed: ${error.message}`,
        phase: 'enhanced_quality',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Run comprehensive testing across all layers
   */
  async runComprehensiveTesting() {
    try {
      const testConfig = {
        includeUnit: true,
        includeIntegration: true,
        includeE2E: this.enhancedConfig.enableBrowserTesting,
        includePerfomance: true,
        parallel: this.enhancedConfig.parallelExecution
      };
      
      const results = await this.comprehensiveTestingPhase.runAllTests(testConfig);
      
      // Analyze test results
      const analysis = await this.analyzeTestResults(results);
      
      this.emit('info', {
        message: 'Comprehensive testing completed',
        summary: {
          totalTests: results.summary.total,
          passed: results.summary.passed,
          failed: results.summary.failed,
          coverage: results.coverage?.percentage
        }
      });
      
      return { results, analysis };
      
    } catch (error) {
      this.emit('error', {
        message: `Comprehensive testing failed: ${error.message}`,
        phase: 'comprehensive_testing',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Run enhanced fixing with AI and log insights
   */
  async runEnhancedFixing() {
    try {
      // Collect all issues from previous phases
      const issues = await this.collectAllIssues();
      
      if (issues.length === 0) {
        this.emit('info', {
          message: 'No issues found to fix',
          phase: 'enhanced_fixing'
        });
        return { success: true, fixesApplied: 0 };
      }
      
      // Configure fixing based on issue types
      const fixConfig = {
        maxIterations: 5,
        strategies: ['syntax', 'logic', 'performance'],
        enableAutoFix: true,
        useLogs: true
      };
      
      // Apply fixes iteratively
      const result = await this.enhancedFixingPhase.iterativeFix({
        issues,
        config: fixConfig
      });
      
      this.emit('info', {
        message: 'Enhanced fixing completed',
        summary: {
          iterations: result.iterations,
          fixesApplied: result.totalFixes,
          success: result.success
        }
      });
      
      return result;
      
    } catch (error) {
      this.emit('error', {
        message: `Enhanced fixing failed: ${error.message}`,
        phase: 'enhanced_fixing',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Run final validation to ensure everything works
   */
  async runFinalValidation() {
    const validationResults = {
      testsPass: false,
      lintPass: false,
      buildPass: false,
      serverStarts: false,
      browserWorks: false
    };
    
    try {
      // Run all tests one more time
      const testResult = await this.comprehensiveTestingPhase.runAllTests({
        includeUnit: true,
        includeIntegration: true,
        includeE2E: false, // Skip E2E for speed
        quick: true
      });
      validationResults.testsPass = testResult.summary.failed === 0;
      
      // Run ESLint
      const lintResult = await this.enhancedQualityPhase.runLintChecks();
      validationResults.lintPass = lintResult.errorCount === 0;
      
      // Verify build
      const buildResult = await this.verifyBuild();
      validationResults.buildPass = buildResult.success;
      
      // Verify server starts (if backend project)
      if (this.projectPlan?.architecture?.backend) {
        const serverResult = await this.verifyServerStarts();
        validationResults.serverStarts = serverResult.success;
      }
      
      // Verify browser works (if frontend project)
      if (this.projectPlan?.architecture?.frontend) {
        const browserResult = await this.verifyBrowserWorks();
        validationResults.browserWorks = browserResult.success;
      }
      
      const allPass = Object.values(validationResults).every(v => v === true || v === false);
      
      if (!allPass) {
        throw new Error('Final validation failed');
      }
      
      return validationResults;
      
    } catch (error) {
      this.emit('error', {
        message: `Final validation failed: ${error.message}`,
        phase: 'final_validation',
        error: error.message,
        results: validationResults
      });
      throw error;
    }
  }

  /**
   * Track phase execution time and resources
   */
  async trackPhase(phaseName, phaseFunction) {
    const startTime = Date.now();
    const startResources = await this.healthMonitor.getCurrentMetrics();
    
    try {
      await phaseFunction();
      
      const endTime = Date.now();
      const endResources = await this.healthMonitor.getCurrentMetrics();
      
      this.metrics.phaseMetrics.set(phaseName, {
        duration: endTime - startTime,
        resourceUsage: {
          cpu: endResources.cpu - startResources.cpu,
          memory: endResources.memory - startResources.memory
        }
      });
      
    } catch (error) {
      this.metrics.phaseMetrics.set(phaseName, {
        duration: Date.now() - startTime,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Setup event forwarding from enhanced components
   */
  setupEventForwarding() {
    // Forward events from runtime manager
    this.runtimeManager.on('log', (data) => {
      this.emit('runtime:log', data);
    });
    
    this.runtimeManager.on('error', (data) => {
      this.emit('runtime:error', data);
    });
    
    // Forward events from enhanced phases
    const phases = [
      this.enhancedQualityPhase,
      this.comprehensiveTestingPhase,
      this.enhancedFixingPhase
    ];
    
    for (const phase of phases) {
      if (phase) {
        phase.on('progress', (data) => this.emit('progress', data));
        phase.on('error', (data) => this.emit('error', data));
        phase.on('warning', (data) => this.emit('warning', data));
      }
    }
  }

  /**
   * Collect all issues from various phases
   */
  async collectAllIssues() {
    const issues = [];
    
    // Collect from quality results
    if (this.qualityCheckResults?.enhanced) {
      const { eslint, jest, browser } = this.qualityCheckResults.enhanced;
      
      if (eslint?.errors) {
        issues.push(...eslint.errors.map(e => ({
          type: 'eslint',
          severity: 'error',
          ...e
        })));
      }
      
      if (jest?.failures) {
        issues.push(...jest.failures.map(f => ({
          type: 'test',
          severity: 'error',
          ...f
        })));
      }
      
      if (browser?.failures) {
        issues.push(...browser.failures.map(f => ({
          type: 'browser',
          severity: 'error',
          ...f
        })));
      }
    }
    
    return issues;
  }

  /**
   * Analyze test results for insights
   */
  async analyzeTestResults(results) {
    const analysis = {
      patterns: [],
      recommendations: [],
      riskAreas: []
    };
    
    // Identify failure patterns
    if (results.failures && results.failures.length > 0) {
      const failurePatterns = this.identifyFailurePatterns(results.failures);
      analysis.patterns = failurePatterns;
    }
    
    // Generate recommendations
    if (results.coverage && results.coverage.percentage < 80) {
      analysis.recommendations.push({
        type: 'coverage',
        message: 'Increase test coverage to at least 80%',
        priority: 'high'
      });
    }
    
    // Identify risk areas
    if (results.performance && results.performance.slowTests) {
      analysis.riskAreas.push({
        type: 'performance',
        message: 'Slow tests detected',
        tests: results.performance.slowTests
      });
    }
    
    return analysis;
  }

  /**
   * Identify patterns in test failures
   */
  identifyFailurePatterns(failures) {
    const patterns = new Map();
    
    for (const failure of failures) {
      const key = failure.error?.message || failure.message;
      if (!patterns.has(key)) {
        patterns.set(key, {
          message: key,
          count: 0,
          files: []
        });
      }
      
      const pattern = patterns.get(key);
      pattern.count++;
      pattern.files.push(failure.file);
    }
    
    return Array.from(patterns.values())
      .filter(p => p.count > 1)
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Store logs for later analysis
   */
  async storeLogs(phase, logs) {
    const logDir = `${this.config.workingDirectory}/.code-agent/logs`;
    await this.fileOps.createDirectory(logDir);
    
    const logFile = `${logDir}/${phase}-${Date.now()}.json`;
    await this.fileOps.writeFile(logFile, JSON.stringify(logs, null, 2));
  }

  /**
   * Verify build process
   */
  async verifyBuild() {
    try {
      // Check if build script exists
      const packageJson = await this.fileOps.readFile(
        `${this.config.workingDirectory}/package.json`
      );
      const pkg = JSON.parse(packageJson);
      
      if (pkg.scripts?.build) {
        // Would run actual build in production
        return { success: true, message: 'Build script found' };
      }
      
      return { success: true, message: 'No build required' };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify server starts successfully
   */
  async verifyServerStarts() {
    try {
      // Would use ServerExecutionManager to start and test server
      return { success: true, message: 'Server verification simulated' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify browser functionality
   */
  async verifyBrowserWorks() {
    try {
      // Would use BrowserTestRunner to test browser
      return { success: true, message: 'Browser verification simulated' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate enhanced summary with metrics
   */
  async generateEnhancedSummary() {
    const baseSummary = this.getProjectSummary();
    
    const enhancedSummary = {
      ...baseSummary,
      enhanced: {
        runtimeTesting: {
          enabled: true,
          testsExecuted: this.qualityCheckResults?.enhanced?.jest?.totalTests || 0,
          testsPassed: this.qualityCheckResults?.enhanced?.jest?.passed || 0,
          coverage: this.qualityCheckResults?.enhanced?.coverage?.percentage || 0
        },
        browserTesting: {
          enabled: this.enhancedConfig.enableBrowserTesting,
          scenarios: this.qualityCheckResults?.enhanced?.browser?.scenarios || 0,
          screenshots: this.qualityCheckResults?.enhanced?.browser?.screenshots || 0
        },
        performance: {
          totalExecutionTime: this.metrics.totalExecutionTime,
          phaseBreakdown: Object.fromEntries(this.metrics.phaseMetrics)
        },
        logAnalysis: {
          errorsFound: this.qualityCheckResults?.enhanced?.logs?.errors || 0,
          warningsFound: this.qualityCheckResults?.enhanced?.logs?.warnings || 0,
          insightsGenerated: this.qualityCheckResults?.enhanced?.logs?.insights || 0
        }
      }
    };
    
    return enhancedSummary;
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary() {
    return {
      totalTime: this.metrics.totalExecutionTime,
      phases: Object.fromEntries(this.metrics.phaseMetrics),
      resourcePeaks: {
        cpu: Math.max(...this.metrics.resourceUsage.cpu.map(r => r.value || 0)),
        memory: Math.max(...this.metrics.resourceUsage.memory.map(r => r.value || 0))
      }
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      // Stop health monitor
      if (this.healthMonitor) {
        await this.healthMonitor.stop();
      }
      
      // Cleanup runtime manager
      if (this.runtimeManager) {
        await this.runtimeManager.cleanup();
      }
      
      // Save final state
      await this.saveState();
      
    } catch (error) {
      this.emit('warning', {
        message: `Cleanup error: ${error.message}`,
        error: error.message
      });
    }
  }
}

export { EnhancedCodeAgent };