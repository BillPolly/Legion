/**
 * TestResultAggregator - Comprehensive test result aggregation
 * 
 * Provides advanced aggregation capabilities:
 * - Multi-source result consolidation
 * - Coverage data merging
 * - Performance metrics aggregation
 * - Failure pattern analysis
 * - Trend identification
 * - Statistical analysis
 * - Report generation
 * - Data normalization
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

/**
 * TestResultAggregator class for aggregating test results
 */
class TestResultAggregator extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = config;
    this.aggregationConfig = config.aggregation || {
      coverageThresholds: {
        excellent: 90,
        good: 80,
        fair: 70,
        poor: 60
      },
      performanceThresholds: {
        responseTime: 1000,
        throughput: 100,
        errorRate: 0.01
      },
      trendAnalysis: {
        enabled: true,
        historySize: 10,
        forecastingEnabled: true
      }
    };
    
    // Aggregation state
    this.aggregatedResults = new Map();
    this.coverageHistory = [];
    this.performanceHistory = [];
    this.failurePatterns = new Map();
    
    // Statistical data
    this.statistics = {
      totalRuns: 0,
      averageSuccessRate: 0,
      averageCoverage: 0,
      averageExecutionTime: 0,
      failureDistribution: new Map(),
      coverageTrend: null,
      performanceTrend: null
    };
  }

  /**
   * Aggregate test results from multiple sources
   */
  async aggregateResults(resultSources) {
    const aggregationId = randomUUID();
    const startTime = Date.now();
    
    this.emit('aggregation-started', { 
      aggregationId, 
      sources: resultSources.length,
      timestamp: startTime 
    });
    
    try {
      // Initialize aggregation
      const aggregated = this.initializeAggregation();
      
      // Process each result source
      for (const source of resultSources) {
        await this.processResultSource(source, aggregated);
      }
      
      // Calculate derived metrics
      this.calculateDerivedMetrics(aggregated);
      
      // Analyze patterns
      await this.analyzePatterns(aggregated);
      
      // Update statistics
      this.updateStatistics(aggregated);
      
      // Generate insights
      const insights = await this.generateInsights(aggregated);
      
      // Store aggregated results
      aggregated.id = aggregationId;
      aggregated.timestamp = Date.now();
      aggregated.duration = aggregated.timestamp - startTime;
      aggregated.insights = insights;
      
      this.aggregatedResults.set(aggregationId, aggregated);
      
      this.emit('aggregation-completed', { 
        aggregationId,
        summary: aggregated.summary,
        timestamp: Date.now() 
      });
      
      return aggregated;
      
    } catch (error) {
      this.emit('aggregation-failed', { 
        aggregationId,
        error: error.message,
        timestamp: Date.now() 
      });
      throw error;
    }
  }

  /**
   * Initialize aggregation structure
   */
  initializeAggregation() {
    return {
      summary: {
        totalSources: 0,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        successRate: 0,
        executionTime: 0
      },
      coverage: {
        lines: { total: 0, covered: 0, percentage: 0 },
        statements: { total: 0, covered: 0, percentage: 0 },
        functions: { total: 0, covered: 0, percentage: 0 },
        branches: { total: 0, covered: 0, percentage: 0 },
        overall: 0
      },
      performance: {
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        throughput: 0,
        errorRate: 0,
        cpu: { avg: 0, max: 0 },
        memory: { avg: 0, max: 0 }
      },
      byType: {
        unit: { total: 0, passed: 0, failed: 0, coverage: 0 },
        integration: { total: 0, passed: 0, failed: 0, coverage: 0 },
        e2e: { total: 0, passed: 0, failed: 0, coverage: 0 },
        performance: { total: 0, passed: 0, failed: 0, metrics: {} }
      },
      failures: {
        byType: new Map(),
        byFile: new Map(),
        byTest: [],
        patterns: []
      },
      quality: {
        score: 0,
        grade: 'F',
        strengths: [],
        weaknesses: [],
        recommendations: []
      }
    };
  }

  /**
   * Process a single result source
   */
  async processResultSource(source, aggregated) {
    aggregated.summary.totalSources++;
    
    switch (source.type) {
      case 'jest':
        await this.processJestResults(source, aggregated);
        break;
        
      case 'eslint':
        await this.processESLintResults(source, aggregated);
        break;
        
      case 'playwright':
        await this.processPlaywrightResults(source, aggregated);
        break;
        
      case 'performance':
        await this.processPerformanceResults(source, aggregated);
        break;
        
      case 'comprehensive':
        await this.processComprehensiveResults(source, aggregated);
        break;
        
      default:
        await this.processGenericResults(source, aggregated);
    }
  }

  /**
   * Process Jest test results
   */
  async processJestResults(source, aggregated) {
    const results = source.results;
    
    // Update test counts
    aggregated.summary.totalTests += results.numTotalTests || 0;
    aggregated.summary.passedTests += results.numPassedTests || 0;
    aggregated.summary.failedTests += results.numFailedTests || 0;
    aggregated.summary.skippedTests += results.numPendingTests || 0;
    aggregated.summary.executionTime += results.executionTime || 0;
    
    // Process coverage if available
    if (results.coverage) {
      this.mergeCoverage(results.coverage, aggregated.coverage);
    }
    
    // Process test results
    if (results.testResults) {
      for (const testFile of results.testResults) {
        const testType = this.determineTestType(testFile.testFilePath);
        const typeStats = aggregated.byType[testType];
        
        if (typeStats) {
          typeStats.total += testFile.numTotalTests || 0;
          typeStats.passed += testFile.numPassingTests || 0;
          typeStats.failed += testFile.numFailingTests || 0;
        }
        
        // Process failures
        if (testFile.numFailingTests > 0) {
          this.processTestFailures(testFile, aggregated.failures);
        }
      }
    }
  }

  /**
   * Process ESLint results
   */
  async processESLintResults(source, aggregated) {
    const results = source.results;
    
    // Count ESLint issues as quality metrics
    let totalIssues = 0;
    let fixableIssues = 0;
    
    for (const file of results) {
      totalIssues += file.errorCount + file.warningCount;
      fixableIssues += file.fixableErrorCount + file.fixableWarningCount;
      
      // Track issues by file
      if (file.errorCount > 0 || file.warningCount > 0) {
        aggregated.failures.byFile.set(file.filePath, {
          errors: file.errorCount,
          warnings: file.warningCount,
          fixable: file.fixableErrorCount + file.fixableWarningCount
        });
      }
    }
    
    // Update quality metrics
    aggregated.quality.codeQualityIssues = totalIssues;
    aggregated.quality.fixableIssues = fixableIssues;
  }

  /**
   * Process Playwright E2E results
   */
  async processPlaywrightResults(source, aggregated) {
    const results = source.results;
    
    // Update E2E stats
    aggregated.byType.e2e.total += results.total || 0;
    aggregated.byType.e2e.passed += results.passed || 0;
    aggregated.byType.e2e.failed += results.failed || 0;
    
    // Process screenshots and videos
    if (results.artifacts) {
      aggregated.artifacts = aggregated.artifacts || { screenshots: [], videos: [] };
      aggregated.artifacts.screenshots.push(...(results.artifacts.screenshots || []));
      aggregated.artifacts.videos.push(...(results.artifacts.videos || []));
    }
  }

  /**
   * Process performance test results
   */
  async processPerformanceResults(source, aggregated) {
    const results = source.results;
    
    // Update performance stats
    aggregated.byType.performance.total += results.total || 0;
    aggregated.byType.performance.passed += results.passed || 0;
    aggregated.byType.performance.failed += results.failed || 0;
    
    // Merge performance metrics
    if (results.metrics) {
      this.mergePerformanceMetrics(results.metrics, aggregated.performance);
    }
    
    // Store raw metrics for trend analysis
    aggregated.byType.performance.metrics = {
      ...aggregated.byType.performance.metrics,
      ...results.metrics
    };
  }

  /**
   * Process comprehensive test results
   */
  async processComprehensiveResults(source, aggregated) {
    const results = source.results;
    
    // Process summary
    if (results.summary) {
      aggregated.summary.totalTests += results.summary.totalTests || 0;
      aggregated.summary.passedTests += results.summary.passedTests || 0;
      aggregated.summary.failedTests += results.summary.failedTests || 0;
      aggregated.summary.skippedTests += results.summary.skippedTests || 0;
      aggregated.summary.executionTime += results.summary.executionTime || 0;
    }
    
    // Process phases
    if (results.phases) {
      for (const phase of results.phases) {
        const testType = phase.type || 'unit';
        const typeStats = aggregated.byType[testType];
        
        if (typeStats) {
          typeStats.total += phase.total || 0;
          typeStats.passed += phase.passed || 0;
          typeStats.failed += phase.failed || 0;
        }
      }
    }
    
    // Process coverage
    if (results.coverage) {
      // Check if coverage is given as percentages (comprehensive format)
      if (typeof results.coverage.lines === 'number') {
        // Coverage is already in percentage format
        aggregated.coverage.lines.percentage = results.coverage.lines;
        aggregated.coverage.statements.percentage = results.coverage.statements || results.coverage.lines;
        aggregated.coverage.functions.percentage = results.coverage.functions || results.coverage.lines;
        aggregated.coverage.branches.percentage = results.coverage.branches || results.coverage.lines;
        
        // Set dummy totals since we don't have raw numbers
        aggregated.coverage.lines.total = 100;
        aggregated.coverage.lines.covered = results.coverage.lines;
        aggregated.coverage.statements.total = 100;
        aggregated.coverage.statements.covered = results.coverage.statements || results.coverage.lines;
        aggregated.coverage.functions.total = 100;
        aggregated.coverage.functions.covered = results.coverage.functions || results.coverage.lines;
        aggregated.coverage.branches.total = 100;
        aggregated.coverage.branches.covered = results.coverage.branches || results.coverage.lines;
      } else {
        // Coverage has raw numbers
        this.mergeCoverage({ global: results.coverage }, aggregated.coverage);
      }
      
      // Calculate overall coverage
      aggregated.coverage.overall = (
        aggregated.coverage.lines.percentage +
        aggregated.coverage.statements.percentage +
        aggregated.coverage.functions.percentage +
        aggregated.coverage.branches.percentage
      ) / 4;
    }
    
    // Process performance
    if (results.performance) {
      this.mergePerformanceMetrics(results.performance, aggregated.performance);
    }
  }

  /**
   * Process generic test results
   */
  async processGenericResults(source, aggregated) {
    const results = source.results;
    
    // Try to extract common fields
    aggregated.summary.totalTests += results.total || results.totalTests || 0;
    aggregated.summary.passedTests += results.passed || results.passedTests || 0;
    aggregated.summary.failedTests += results.failed || results.failedTests || 0;
    aggregated.summary.skippedTests += results.skipped || results.skippedTests || 0;
  }

  /**
   * Merge coverage data
   */
  mergeCoverage(source, target) {
    const global = source.global || source;
    
    ['lines', 'statements', 'functions', 'branches'].forEach(metric => {
      if (global[metric]) {
        target[metric].total += global[metric].total || 0;
        target[metric].covered += global[metric].covered || 0;
      }
    });
  }

  /**
   * Merge performance metrics
   */
  mergePerformanceMetrics(source, target) {
    // Calculate weighted averages
    const weight = 1 / (this.statistics.totalRuns + 1);
    
    target.avgResponseTime = this.weightedAverage(
      target.avgResponseTime, 
      source.avgResponseTime || source.responseTime, 
      weight
    );
    
    target.throughput = this.weightedAverage(
      target.throughput,
      source.throughput,
      weight
    );
    
    target.errorRate = this.weightedAverage(
      target.errorRate,
      source.errorRate,
      weight
    );
    
    // Update percentiles
    if (source.p95ResponseTime) {
      target.p95ResponseTime = Math.max(target.p95ResponseTime, source.p95ResponseTime);
    }
    if (source.p99ResponseTime) {
      target.p99ResponseTime = Math.max(target.p99ResponseTime, source.p99ResponseTime);
    }
    
    // Update resource usage
    if (source.cpu) {
      target.cpu.avg = this.weightedAverage(target.cpu.avg, source.cpu.avg || source.cpu, weight);
      target.cpu.max = Math.max(target.cpu.max, source.cpu.max || source.cpu);
    }
    if (source.memory) {
      target.memory.avg = this.weightedAverage(target.memory.avg, source.memory.avg || source.memory, weight);
      target.memory.max = Math.max(target.memory.max, source.memory.max || source.memory);
    }
  }

  /**
   * Calculate weighted average
   */
  weightedAverage(current, newValue, weight) {
    if (newValue === undefined || newValue === null) return current;
    return current * (1 - weight) + newValue * weight;
  }

  /**
   * Determine test type from file path
   */
  determineTestType(filePath) {
    if (filePath.includes('.e2e.') || filePath.includes('e2e/')) {
      return 'e2e';
    } else if (filePath.includes('.integration.') || filePath.includes('integration/')) {
      return 'integration';
    } else if (filePath.includes('.performance.') || filePath.includes('performance/')) {
      return 'performance';
    }
    return 'unit';
  }

  /**
   * Process test failures
   */
  processTestFailures(testFile, failures) {
    for (const test of testFile.testResults || []) {
      if (test.status === 'failed') {
        // Add to failures list
        failures.byTest.push({
          file: testFile.testFilePath,
          test: test.title || test.fullName,
          errors: test.failureMessages,
          duration: test.duration
        });
        
        // Categorize failure
        const failureType = this.categorizeFailure(test.failureMessages);
        const count = failures.byType.get(failureType) || 0;
        failures.byType.set(failureType, count + 1);
      }
    }
  }

  /**
   * Categorize failure type
   */
  categorizeFailure(failureMessages) {
    if (!failureMessages || failureMessages.length === 0) return 'unknown';
    
    const message = failureMessages[0].toLowerCase();
    
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('syntaxerror')) return 'syntax';
    if (message.includes('typeerror') || message.includes('referenceerror')) return 'runtime';
    if (message.includes('assertion') || message.includes('expect')) return 'assertion';
    if (message.includes('async') || message.includes('promise')) return 'async';
    if (message.includes('mock')) return 'mocking';
    
    return 'other';
  }

  /**
   * Calculate derived metrics
   */
  calculateDerivedMetrics(aggregated) {
    const { summary, coverage } = aggregated;
    
    // Calculate success rate
    if (summary.totalTests > 0) {
      summary.successRate = (summary.passedTests / summary.totalTests) * 100;
    }
    
    // Calculate coverage percentages
    ['lines', 'statements', 'functions', 'branches'].forEach(metric => {
      if (coverage[metric].total > 0) {
        coverage[metric].percentage = 
          (coverage[metric].covered / coverage[metric].total) * 100;
      }
    });
    
    // Calculate overall coverage
    coverage.overall = (
      coverage.lines.percentage +
      coverage.statements.percentage +
      coverage.functions.percentage +
      coverage.branches.percentage
    ) / 4;
    
    // Calculate quality score
    aggregated.quality.score = this.calculateQualityScore(aggregated);
    aggregated.quality.grade = this.calculateQualityGrade(aggregated.quality.score);
  }

  /**
   * Calculate quality score
   */
  calculateQualityScore(aggregated) {
    const weights = {
      successRate: 0.3,
      coverage: 0.3,
      performance: 0.2,
      codeQuality: 0.2
    };
    
    let score = 0;
    
    // Success rate component
    score += (aggregated.summary.successRate / 100) * weights.successRate * 100;
    
    // Coverage component
    score += (aggregated.coverage.overall / 100) * weights.coverage * 100;
    
    // Performance component
    const perfScore = this.calculatePerformanceScore(aggregated.performance);
    score += perfScore * weights.performance;
    
    // Code quality component
    const qualityIssues = aggregated.quality.codeQualityIssues || 0;
    const qualityScore = Math.max(0, 100 - qualityIssues * 2);
    score += (qualityScore / 100) * weights.codeQuality * 100;
    
    return Math.round(score);
  }

  /**
   * Calculate performance score
   */
  calculatePerformanceScore(performance) {
    let score = 100;
    
    // Deduct for slow response times
    if (performance.avgResponseTime > this.aggregationConfig.performanceThresholds.responseTime) {
      score -= 20;
    }
    
    // Deduct for low throughput
    if (performance.throughput < this.aggregationConfig.performanceThresholds.throughput) {
      score -= 20;
    }
    
    // Deduct for high error rate
    if (performance.errorRate > this.aggregationConfig.performanceThresholds.errorRate) {
      score -= 30;
    }
    
    return Math.max(0, score);
  }

  /**
   * Calculate quality grade
   */
  calculateQualityGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Analyze patterns in failures
   */
  async analyzePatterns(aggregated) {
    const { failures } = aggregated;
    
    // Find common failure patterns
    const patterns = [];
    
    // Pattern 1: Files with multiple failures
    for (const [file, issues] of failures.byFile) {
      if ((issues.errors + issues.warnings) > 3) {
        patterns.push({
          type: 'high-failure-file',
          file,
          count: issues.errors + issues.warnings
        });
      }
    }
    
    // Pattern 2: Common failure types
    for (const [type, count] of failures.byType) {
      if (count > 5) {
        patterns.push({
          type: 'common-failure-type',
          failureType: type,
          count
        });
      }
    }
    
    // Pattern 3: Timeout issues
    const timeoutCount = failures.byType.get('timeout') || 0;
    if (timeoutCount > 2) {
      patterns.push({
        type: 'timeout-issues',
        count: timeoutCount,
        recommendation: 'Consider increasing test timeouts or optimizing test performance'
      });
    }
    
    failures.patterns = patterns;
    
    // Update failure pattern history
    this.updateFailurePatterns(patterns);
  }

  /**
   * Update failure pattern history
   */
  updateFailurePatterns(patterns) {
    for (const pattern of patterns) {
      const key = `${pattern.type}:${pattern.failureType || pattern.file || 'general'}`;
      const existing = this.failurePatterns.get(key) || { count: 0, occurrences: [] };
      
      existing.count++;
      existing.occurrences.push(Date.now());
      
      // Keep only recent occurrences
      if (existing.occurrences.length > 10) {
        existing.occurrences.shift();
      }
      
      this.failurePatterns.set(key, existing);
    }
  }

  /**
   * Update statistics
   */
  updateStatistics(aggregated) {
    this.statistics.totalRuns++;
    
    // Update averages
    const weight = 1 / this.statistics.totalRuns;
    
    this.statistics.averageSuccessRate = this.weightedAverage(
      this.statistics.averageSuccessRate,
      aggregated.summary.successRate,
      weight
    );
    
    this.statistics.averageCoverage = this.weightedAverage(
      this.statistics.averageCoverage,
      aggregated.coverage.overall,
      weight
    );
    
    this.statistics.averageExecutionTime = this.weightedAverage(
      this.statistics.averageExecutionTime,
      aggregated.summary.executionTime,
      weight
    );
    
    // Update history for trends
    this.updateHistory(aggregated);
    
    // Calculate trends
    if (this.aggregationConfig.trendAnalysis.enabled) {
      this.calculateTrends();
    }
  }

  /**
   * Update history for trend analysis
   */
  updateHistory(aggregated) {
    // Update coverage history
    this.coverageHistory.push({
      timestamp: Date.now(),
      coverage: aggregated.coverage.overall,
      lines: aggregated.coverage.lines.percentage,
      branches: aggregated.coverage.branches.percentage
    });
    
    // Update performance history
    this.performanceHistory.push({
      timestamp: Date.now(),
      responseTime: aggregated.performance.avgResponseTime,
      throughput: aggregated.performance.throughput,
      errorRate: aggregated.performance.errorRate
    });
    
    // Limit history size
    const maxHistory = this.aggregationConfig.trendAnalysis.historySize;
    if (this.coverageHistory.length > maxHistory) {
      this.coverageHistory.shift();
    }
    if (this.performanceHistory.length > maxHistory) {
      this.performanceHistory.shift();
    }
  }

  /**
   * Calculate trends
   */
  calculateTrends() {
    if (this.coverageHistory.length >= 3) {
      this.statistics.coverageTrend = this.calculateTrend(
        this.coverageHistory.map(h => h.coverage)
      );
    }
    
    if (this.performanceHistory.length >= 3) {
      this.statistics.performanceTrend = {
        responseTime: this.calculateTrend(
          this.performanceHistory.map(h => h.responseTime)
        ),
        throughput: this.calculateTrend(
          this.performanceHistory.map(h => h.throughput)
        ),
        errorRate: this.calculateTrend(
          this.performanceHistory.map(h => h.errorRate)
        )
      };
    }
  }

  /**
   * Calculate trend direction
   */
  calculateTrend(values) {
    if (values.length < 2) return 'stable';
    
    // Simple linear regression
    const n = values.length;
    const sumX = n * (n - 1) / 2;
    const sumY = values.reduce((sum, y) => sum + y, 0);
    const sumXY = values.reduce((sum, y, i) => sum + i * y, 0);
    const sumX2 = n * (n - 1) * (2 * n - 1) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    // Determine trend based on slope
    if (slope > 0.5) return 'improving';
    if (slope < -0.5) return 'degrading';
    return 'stable';
  }

  /**
   * Generate insights from aggregated data
   */
  async generateInsights(aggregated) {
    const insights = {
      strengths: [],
      weaknesses: [],
      opportunities: [],
      recommendations: []
    };
    
    // Analyze strengths
    if (aggregated.summary.successRate >= 95) {
      insights.strengths.push('Excellent test success rate');
    }
    if (aggregated.coverage.overall >= 80) {
      insights.strengths.push('Strong code coverage');
    }
    if (aggregated.performance.errorRate < 0.01) {
      insights.strengths.push('Low error rate in production');
    }
    
    // Analyze weaknesses
    if (aggregated.summary.failedTests > 0) {
      insights.weaknesses.push(`${aggregated.summary.failedTests} failing tests need attention`);
    }
    if (aggregated.coverage.overall < 70) {
      insights.weaknesses.push('Code coverage below recommended threshold');
    }
    if (aggregated.performance.avgResponseTime > 1000) {
      insights.weaknesses.push('Response times exceeding performance targets');
    }
    
    // Identify opportunities
    if (aggregated.quality.fixableIssues > 0) {
      insights.opportunities.push(`${aggregated.quality.fixableIssues} code issues can be auto-fixed`);
    }
    if (aggregated.byType.e2e.total === 0) {
      insights.opportunities.push('Add end-to-end tests for better coverage');
    }
    
    // Generate recommendations
    insights.recommendations = this.generateRecommendations(aggregated);
    
    // Add quality assessment
    aggregated.quality.strengths = insights.strengths;
    aggregated.quality.weaknesses = insights.weaknesses;
    aggregated.quality.recommendations = insights.recommendations;
    
    return insights;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(aggregated) {
    const recommendations = [];
    
    // Coverage recommendations
    if (aggregated.coverage.branches.percentage < 80) {
      recommendations.push({
        priority: 'high',
        category: 'coverage',
        message: 'Increase branch coverage by adding tests for conditional logic'
      });
    }
    
    // Performance recommendations
    if (aggregated.performance.avgResponseTime > 1000) {
      recommendations.push({
        priority: 'high',
        category: 'performance',
        message: 'Optimize slow endpoints to improve response times'
      });
    }
    
    // Failure recommendations
    const timeoutFailures = aggregated.failures.byType.get('timeout') || 0;
    if (timeoutFailures > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'reliability',
        message: 'Review and fix timeout issues in tests'
      });
    }
    
    // Trend-based recommendations
    if (this.statistics.coverageTrend === 'degrading') {
      recommendations.push({
        priority: 'high',
        category: 'quality',
        message: 'Coverage trend is declining - enforce coverage requirements'
      });
    }
    
    // Always have at least one recommendation
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'low',
        category: 'general',
        message: 'Continue monitoring test metrics and maintain high quality standards'
      });
    }
    
    return recommendations;
  }

  /**
   * Get aggregation history
   */
  getHistory(limit = 10) {
    const results = Array.from(this.aggregatedResults.values())
      .sort((a, b) => a.timestamp - b.timestamp) // Sort oldest first, then reverse
      .slice(-limit) // Take last N items
      .reverse(); // Reverse to get newest first
    
    return results;
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      recentFailurePatterns: Array.from(this.failurePatterns.entries())
        .filter(([_, data]) => data.count > 2)
        .map(([pattern, data]) => ({ pattern, ...data }))
    };
  }

  /**
   * Export aggregated results
   */
  async exportResults(aggregationId, format = 'json') {
    const aggregated = this.aggregatedResults.get(aggregationId);
    if (!aggregated) {
      throw new Error(`Aggregation ${aggregationId} not found`);
    }
    
    switch (format) {
      case 'json':
        return JSON.stringify(aggregated, null, 2);
        
      case 'html':
        return this.generateHTMLReport(aggregated);
        
      case 'markdown':
        return this.generateMarkdownReport(aggregated);
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport(aggregated) {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Test Results - ${new Date(aggregated.timestamp).toLocaleString()}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; }
    .metric { margin: 10px 0; }
    .grade { font-size: 48px; font-weight: bold; }
    .grade-A { color: #28a745; }
    .grade-B { color: #17a2b8; }
    .grade-C { color: #ffc107; }
    .grade-D { color: #fd7e14; }
    .grade-F { color: #dc3545; }
  </style>
</head>
<body>
  <h1>Aggregated Test Results</h1>
  
  <div class="summary">
    <h2>Summary</h2>
    <div class="grade grade-${aggregated.quality.grade}">${aggregated.quality.grade}</div>
    <div class="metric">Quality Score: ${aggregated.quality.score}/100</div>
    <div class="metric">Total Tests: ${aggregated.summary.totalTests}</div>
    <div class="metric">Success Rate: ${aggregated.summary.successRate.toFixed(1)}%</div>
    <div class="metric">Coverage: ${aggregated.coverage.overall.toFixed(1)}%</div>
  </div>
  
  <h2>Coverage Details</h2>
  <ul>
    <li>Lines: ${aggregated.coverage.lines.percentage.toFixed(1)}%</li>
    <li>Statements: ${aggregated.coverage.statements.percentage.toFixed(1)}%</li>
    <li>Functions: ${aggregated.coverage.functions.percentage.toFixed(1)}%</li>
    <li>Branches: ${aggregated.coverage.branches.percentage.toFixed(1)}%</li>
  </ul>
  
  <h2>Performance</h2>
  <ul>
    <li>Average Response Time: ${aggregated.performance.avgResponseTime.toFixed(0)}ms</li>
    <li>Throughput: ${aggregated.performance.throughput.toFixed(0)} req/s</li>
    <li>Error Rate: ${(aggregated.performance.errorRate * 100).toFixed(2)}%</li>
  </ul>
  
  <h2>Recommendations</h2>
  <ul>
    ${aggregated.quality.recommendations.map(r => 
      `<li>[${r.priority}] ${r.message}</li>`
    ).join('')}
  </ul>
</body>
</html>`;
  }

  /**
   * Generate Markdown report
   */
  generateMarkdownReport(aggregated) {
    return `# Aggregated Test Results

Generated: ${new Date(aggregated.timestamp).toLocaleString()}

## Summary

- **Quality Grade**: ${aggregated.quality.grade}
- **Quality Score**: ${aggregated.quality.score}/100
- **Total Tests**: ${aggregated.summary.totalTests}
- **Success Rate**: ${aggregated.summary.successRate.toFixed(1)}%
- **Overall Coverage**: ${aggregated.coverage.overall.toFixed(1)}%

## Coverage Details

| Metric | Coverage |
|--------|----------|
| Lines | ${aggregated.coverage.lines.percentage.toFixed(1)}% |
| Statements | ${aggregated.coverage.statements.percentage.toFixed(1)}% |
| Functions | ${aggregated.coverage.functions.percentage.toFixed(1)}% |
| Branches | ${aggregated.coverage.branches.percentage.toFixed(1)}% |

## Performance Metrics

- **Average Response Time**: ${aggregated.performance.avgResponseTime.toFixed(0)}ms
- **Throughput**: ${aggregated.performance.throughput.toFixed(0)} req/s
- **Error Rate**: ${(aggregated.performance.errorRate * 100).toFixed(2)}%

## Test Results by Type

| Type | Total | Passed | Failed | Success Rate |
|------|-------|--------|--------|--------------|
| Unit | ${aggregated.byType.unit.total} | ${aggregated.byType.unit.passed} | ${aggregated.byType.unit.failed} | ${aggregated.byType.unit.total > 0 ? ((aggregated.byType.unit.passed / aggregated.byType.unit.total) * 100).toFixed(1) : 0}% |
| Integration | ${aggregated.byType.integration.total} | ${aggregated.byType.integration.passed} | ${aggregated.byType.integration.failed} | ${aggregated.byType.integration.total > 0 ? ((aggregated.byType.integration.passed / aggregated.byType.integration.total) * 100).toFixed(1) : 0}% |
| E2E | ${aggregated.byType.e2e.total} | ${aggregated.byType.e2e.passed} | ${aggregated.byType.e2e.failed} | ${aggregated.byType.e2e.total > 0 ? ((aggregated.byType.e2e.passed / aggregated.byType.e2e.total) * 100).toFixed(1) : 0}% |

## Recommendations

${aggregated.quality.recommendations.map(r => 
  `- **[${r.priority}]** ${r.message}`
).join('\n')}
`;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.emit('aggregator-cleanup-started', { timestamp: Date.now() });
    
    // Clear data
    this.aggregatedResults.clear();
    this.coverageHistory = [];
    this.performanceHistory = [];
    this.failurePatterns.clear();
    
    // Reset statistics
    this.statistics = {
      totalRuns: 0,
      averageSuccessRate: 0,
      averageCoverage: 0,
      averageExecutionTime: 0,
      failureDistribution: new Map(),
      coverageTrend: null,
      performanceTrend: null
    };
    
    this.emit('aggregator-cleanup-completed', { timestamp: Date.now() });
  }
}

export { TestResultAggregator };