/**
 * QualityReporter - Comprehensive quality reporting system
 * 
 * Provides unified reporting for:
 * - ESLint analysis results
 * - Jest test execution results
 * - Coverage analysis
 * - Performance metrics
 * - Trend analysis
 * - Actionable insights and recommendations
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

/**
 * QualityReporter class for comprehensive quality reporting
 */
class QualityReporter extends EventEmitter {
  constructor(config, logManager, logAnalyzer) {
    super();
    
    this.config = config;
    this.logManager = logManager;
    this.logAnalyzer = logAnalyzer;
    
    // State management
    this.isInitialized = false;
    this.reportId = null;
    
    // Report history
    this.reportHistory = [];
    this.qualityTrends = {
      totalReports: 0,
      qualityHistory: []
    };
    
    // Quality metrics
    this.qualityMetrics = {
      overallScore: 0,
      testCoverage: 0,
      codeQuality: 0,
      performance: 0,
      maintainability: 0
    };
    
    // Thresholds
    this.qualityThresholds = {
      excellent: 90,
      good: 80,
      fair: 70,
      poor: 60
    };
  }

  /**
   * Initialize the quality reporter
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    this.emit('initializing', { timestamp: Date.now() });

    try {
      // Initialize report ID
      this.reportId = randomUUID();
      
      // Initialize log capture
      await this.logManager.initialize();
      
      this.isInitialized = true;
      this.emit('initialized', { reportId: this.reportId, timestamp: Date.now() });
      
    } catch (error) {
      this.emit('initialization-error', { error: error.message, timestamp: Date.now() });
      throw error;
    }
  }

  /**
   * Generate comprehensive quality report
   */
  async generateQualityReport(eslintResult, jestResult, projectPath) {
    if (!this.isInitialized) {
      throw new Error('QualityReporter not initialized');
    }

    const reportId = randomUUID();
    const correlationId = randomUUID();
    const startTime = Date.now();
    
    this.emit('report-generation-started', {
      reportId,
      correlationId,
      projectPath,
      timestamp: startTime
    });

    try {
      // Log report generation start
      await this.logManager.captureLogs('quality-reporter', `Quality report generation started for ${projectPath}`, {
        correlationId,
        level: 'info',
        metadata: { reportId, projectPath }
      });

      // Analyze ESLint results
      const eslintAnalysis = await this.analyzeESLintResults(eslintResult);
      
      // Analyze Jest results
      const jestAnalysis = await this.analyzeJestResults(jestResult);
      
      // Calculate quality metrics
      const qualityMetrics = await this.calculateQualityMetrics(eslintAnalysis, jestAnalysis);
      
      // Generate insights and recommendations
      const insights = await this.generateInsights(eslintAnalysis, jestAnalysis, qualityMetrics);
      
      // Get correlated logs
      const correlatedLogs = this.logManager.getLogsByCorrelationId(correlationId);
      const logAnalysis = await this.logAnalyzer.analyzeTestLogs(correlatedLogs);
      
      // Generate trend analysis
      const trendAnalysis = await this.analyzeTrends(qualityMetrics);
      
      // Create comprehensive report
      const report = {
        reportId,
        correlationId,
        projectPath,
        timestamp: Date.now(),
        executionTime: Date.now() - startTime,
        summary: {
          overallScore: qualityMetrics.overallScore,
          qualityGrade: this.calculateQualityGrade(qualityMetrics.overallScore),
          eslintScore: eslintAnalysis.score,
          jestScore: jestAnalysis.score,
          coverageScore: jestAnalysis.coverage.score,
          performanceScore: qualityMetrics.performance
        },
        eslint: eslintAnalysis,
        jest: jestAnalysis,
        qualityMetrics,
        insights,
        trends: trendAnalysis,
        logs: {
          analysis: logAnalysis,
          correlationId
        },
        recommendations: await this.generateRecommendations(eslintAnalysis, jestAnalysis, qualityMetrics)
      };

      // Update history and trends
      this.reportHistory.push(report);
      this.updateQualityTrends(qualityMetrics);

      this.emit('report-generation-completed', {
        reportId,
        correlationId,
        report,
        timestamp: Date.now()
      });

      return report;

    } catch (error) {
      await this.logManager.captureLogs('quality-reporter', `Quality report generation failed: ${error.message}`, {
        correlationId,
        level: 'error',
        metadata: { reportId, projectPath, error: error.message }
      });

      this.emit('report-generation-failed', {
        reportId,
        correlationId,
        error: error.message,
        timestamp: Date.now()
      });

      throw error;
    }
  }

  /**
   * Analyze ESLint results
   */
  async analyzeESLintResults(eslintResult) {
    const analysis = {
      summary: {
        totalFiles: eslintResult.results.length,
        totalErrors: eslintResult.errorCount,
        totalWarnings: eslintResult.warningCount,
        fixableErrors: eslintResult.fixableErrorCount,
        fixableWarnings: eslintResult.fixableWarningCount
      },
      score: 0,
      quality: 'unknown',
      issues: {
        byRule: {},
        byFile: {},
        bySeverity: { error: 0, warning: 0 },
        mostCommon: []
      },
      fixability: {
        autoFixable: eslintResult.fixableErrorCount + eslintResult.fixableWarningCount,
        manualFixRequired: (eslintResult.errorCount - eslintResult.fixableErrorCount) + 
                          (eslintResult.warningCount - eslintResult.fixableWarningCount),
        fixabilityScore: 0
      },
      performance: eslintResult.performance
    };

    // Calculate ESLint score (100 - weighted penalty for errors/warnings)
    const errorPenalty = eslintResult.errorCount * 10;
    const warningPenalty = eslintResult.warningCount * 2;
    analysis.score = Math.max(0, 100 - errorPenalty - warningPenalty);
    analysis.quality = this.calculateQualityGrade(analysis.score);

    // Analyze issues by rule
    for (const result of eslintResult.results) {
      const fileName = path.basename(result.filePath);
      analysis.issues.byFile[fileName] = {
        errors: result.errorCount,
        warnings: result.warningCount
      };

      for (const message of result.messages) {
        const rule = message.ruleId || 'unknown';
        
        if (!analysis.issues.byRule[rule]) {
          analysis.issues.byRule[rule] = { count: 0, severity: message.severity };
        }
        analysis.issues.byRule[rule].count++;

        if (message.severity === 2) {
          analysis.issues.bySeverity.error++;
        } else if (message.severity === 1) {
          analysis.issues.bySeverity.warning++;
        }
      }
    }

    // Calculate most common issues
    analysis.issues.mostCommon = Object.entries(analysis.issues.byRule)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 10)
      .map(([rule, data]) => ({ rule, count: data.count, severity: data.severity }));

    // Calculate fixability score
    const totalIssues = eslintResult.errorCount + eslintResult.warningCount;
    if (totalIssues > 0) {
      analysis.fixability.fixabilityScore = 
        ((eslintResult.fixableErrorCount + eslintResult.fixableWarningCount) / totalIssues) * 100;
    } else {
      analysis.fixability.fixabilityScore = 100;
    }

    return analysis;
  }

  /**
   * Analyze Jest results
   */
  async analyzeJestResults(jestResult) {
    const analysis = {
      summary: {
        totalTests: jestResult.numTotalTests,
        passedTests: jestResult.numPassedTests,
        failedTests: jestResult.numFailedTests,
        pendingTests: jestResult.numPendingTests,
        successRate: 0
      },
      score: 0,
      quality: 'unknown',
      coverage: {
        lines: jestResult.coverage.global.lines,
        statements: jestResult.coverage.global.statements,
        functions: jestResult.coverage.global.functions,
        branches: jestResult.coverage.global.branches,
        score: 0,
        quality: 'unknown'
      },
      failures: {
        byType: {},
        byFile: {},
        patterns: []
      },
      performance: jestResult.performance
    };

    // Calculate success rate
    if (jestResult.numTotalTests > 0) {
      analysis.summary.successRate = (jestResult.numPassedTests / jestResult.numTotalTests) * 100;
    } else {
      analysis.summary.successRate = 100;
    }

    // Calculate Jest score based on success rate
    analysis.score = analysis.summary.successRate;
    analysis.quality = this.calculateQualityGrade(analysis.score);

    // Calculate coverage score (average of all coverage metrics)
    const coverageMetrics = [
      jestResult.coverage.global.lines.pct,
      jestResult.coverage.global.statements.pct,
      jestResult.coverage.global.functions.pct,
      jestResult.coverage.global.branches.pct
    ];
    analysis.coverage.score = coverageMetrics.reduce((sum, pct) => sum + pct, 0) / coverageMetrics.length;
    analysis.coverage.quality = this.calculateQualityGrade(analysis.coverage.score);

    // Analyze test failures
    for (const testResult of jestResult.testResults) {
      const fileName = path.basename(testResult.testFilePath);
      analysis.failures.byFile[fileName] = {
        failing: testResult.numFailingTests,
        passing: testResult.numPassingTests
      };

      // Analyze individual test failures
      for (const test of testResult.testResults || []) {
        if (test.status === 'failed') {
          const failureType = this.categorizeTestFailure(test);
          if (!analysis.failures.byType[failureType]) {
            analysis.failures.byType[failureType] = 0;
          }
          analysis.failures.byType[failureType]++;
        }
      }
    }

    // Identify failure patterns
    if (jestResult.numFailedTests > 0) {
      analysis.failures.patterns = this.identifyFailurePatterns(analysis.failures);
    }

    return analysis;
  }

  /**
   * Calculate quality metrics
   */
  async calculateQualityMetrics(eslintAnalysis, jestAnalysis) {
    const metrics = {
      overallScore: 0,
      testCoverage: jestAnalysis.coverage.score,
      codeQuality: eslintAnalysis.score,
      performance: 0,
      maintainability: 0,
      reliability: jestAnalysis.score,
      security: 0
    };

    // Calculate performance score (based on execution times)
    const eslintPerf = Math.max(0, 100 - (eslintAnalysis.performance.executionTime / 100));
    const jestPerf = Math.max(0, 100 - (jestAnalysis.performance.executionTime / 1000));
    metrics.performance = (eslintPerf + jestPerf) / 2;

    // Calculate maintainability score
    const fixabilityFactor = eslintAnalysis.fixability.fixabilityScore * 0.4;
    const complexityFactor = Math.max(0, 100 - eslintAnalysis.summary.totalErrors * 5) * 0.6;
    metrics.maintainability = fixabilityFactor + complexityFactor;

    // Calculate security score (based on security-related ESLint rules)
    const securityIssues = Object.keys(eslintAnalysis.issues.byRule)
      .filter(rule => rule.includes('security') || rule.includes('no-eval') || rule.includes('no-unsafe'))
      .reduce((count, rule) => count + eslintAnalysis.issues.byRule[rule].count, 0);
    metrics.security = Math.max(0, 100 - securityIssues * 10);

    // Calculate overall score (weighted average)
    const weights = {
      testCoverage: 0.25,
      codeQuality: 0.25,
      performance: 0.15,
      maintainability: 0.15,
      reliability: 0.15,
      security: 0.05
    };

    metrics.overallScore = 
      metrics.testCoverage * weights.testCoverage +
      metrics.codeQuality * weights.codeQuality +
      metrics.performance * weights.performance +
      metrics.maintainability * weights.maintainability +
      metrics.reliability * weights.reliability +
      metrics.security * weights.security;

    return metrics;
  }

  /**
   * Generate insights
   */
  async generateInsights(eslintAnalysis, jestAnalysis, qualityMetrics) {
    const insights = {
      strengths: [],
      weaknesses: [],
      opportunities: [],
      risks: []
    };

    // Identify strengths
    if (qualityMetrics.testCoverage >= 80) {
      insights.strengths.push('High test coverage indicates well-tested codebase');
    }
    if (eslintAnalysis.score >= 90) {
      insights.strengths.push('Excellent code quality with minimal linting issues');
    }
    if (jestAnalysis.summary.successRate >= 95) {
      insights.strengths.push('Very high test success rate shows reliable code');
    }

    // Identify weaknesses
    if (qualityMetrics.testCoverage < 70) {
      insights.weaknesses.push('Low test coverage leaves code vulnerable to bugs');
    }
    if (eslintAnalysis.summary.totalErrors > 10) {
      insights.weaknesses.push('High number of ESLint errors indicates code quality issues');
    }
    if (jestAnalysis.summary.failedTests > 0) {
      insights.weaknesses.push('Failed tests indicate potential functionality issues');
    }

    // Identify opportunities
    if (eslintAnalysis.fixability.autoFixable > 0) {
      insights.opportunities.push(`${eslintAnalysis.fixability.autoFixable} issues can be automatically fixed`);
    }
    if (qualityMetrics.performance < 80) {
      insights.opportunities.push('Performance can be improved through optimization');
    }
    if (jestAnalysis.coverage.branches.pct < 80) {
      insights.opportunities.push('Branch coverage can be improved with additional test cases');
    }

    // Identify risks
    if (eslintAnalysis.summary.totalErrors > 20) {
      insights.risks.push('High error count poses maintainability risks');
    }
    if (qualityMetrics.testCoverage < 50) {
      insights.risks.push('Very low test coverage increases bug risk in production');
    }
    if (qualityMetrics.security < 70) {
      insights.risks.push('Security-related issues detected in code');
    }

    return insights;
  }

  /**
   * Generate recommendations
   */
  async generateRecommendations(eslintAnalysis, jestAnalysis, qualityMetrics) {
    const recommendations = {
      immediate: [],
      shortTerm: [],
      longTerm: [],
      priority: []
    };

    // Immediate actions
    if (jestAnalysis.summary.failedTests > 0) {
      recommendations.immediate.push('Fix failing tests to ensure code functionality');
    }
    if (eslintAnalysis.fixability.autoFixable > 0) {
      recommendations.immediate.push('Run ESLint auto-fix to resolve automatically fixable issues');
    }
    if (eslintAnalysis.summary.totalErrors > 0) {
      recommendations.immediate.push('Address ESLint errors before deployment');
    }

    // Short-term actions
    if (qualityMetrics.testCoverage < 80) {
      recommendations.shortTerm.push('Increase test coverage to at least 80%');
    }
    if (eslintAnalysis.summary.totalWarnings > 10) {
      recommendations.shortTerm.push('Resolve ESLint warnings to improve code quality');
    }
    if (qualityMetrics.performance < 70) {
      recommendations.shortTerm.push('Optimize performance bottlenecks identified in analysis');
    }

    // Long-term actions
    if (qualityMetrics.maintainability < 70) {
      recommendations.longTerm.push('Improve code maintainability through refactoring');
    }
    if (qualityMetrics.security < 80) {
      recommendations.longTerm.push('Implement comprehensive security practices');
    }
    recommendations.longTerm.push('Establish continuous quality monitoring');

    // Priority recommendations
    if (qualityMetrics.overallScore < 60) {
      recommendations.priority.push('Critical: Overall quality score is below acceptable threshold');
    }
    if (jestAnalysis.summary.successRate < 90) {
      recommendations.priority.push('High: Test success rate needs immediate attention');
    }
    if (eslintAnalysis.summary.totalErrors > 15) {
      recommendations.priority.push('High: Excessive ESLint errors require urgent fixes');
    }

    return recommendations;
  }

  /**
   * Analyze quality trends
   */
  async analyzeTrends(qualityMetrics) {
    const trends = {
      direction: 'stable',
      improvement: 0,
      regression: 0,
      comparison: null,
      forecast: null
    };

    if (this.qualityTrends.qualityHistory.length > 1) {
      const current = qualityMetrics.overallScore;
      const previous = this.qualityTrends.qualityHistory[this.qualityTrends.qualityHistory.length - 1].overallScore;
      
      trends.improvement = current - previous;
      
      if (trends.improvement > 5) {
        trends.direction = 'improving';
      } else if (trends.improvement < -5) {
        trends.direction = 'declining';
      }

      trends.comparison = {
        current,
        previous,
        change: trends.improvement,
        changePercent: ((trends.improvement / previous) * 100).toFixed(2)
      };
    }

    // Simple forecast based on recent trend
    if (this.qualityTrends.qualityHistory.length >= 3) {
      const recent = this.qualityTrends.qualityHistory.slice(-3);
      const avgChange = recent.reduce((sum, curr, idx, arr) => {
        if (idx === 0) return 0;
        return sum + (curr.overallScore - arr[idx - 1].overallScore);
      }, 0) / (recent.length - 1);

      trends.forecast = {
        nextScore: Math.max(0, Math.min(100, qualityMetrics.overallScore + avgChange)),
        confidence: Math.abs(avgChange) < 2 ? 'high' : 'medium'
      };
    }

    return trends;
  }

  /**
   * Update quality trends
   */
  updateQualityTrends(qualityMetrics) {
    this.qualityTrends.totalReports++;
    this.qualityTrends.qualityHistory.push({
      timestamp: Date.now(),
      overallScore: qualityMetrics.overallScore,
      testCoverage: qualityMetrics.testCoverage,
      codeQuality: qualityMetrics.codeQuality,
      performance: qualityMetrics.performance,
      maintainability: qualityMetrics.maintainability
    });

    // Keep only last 50 entries
    if (this.qualityTrends.qualityHistory.length > 50) {
      this.qualityTrends.qualityHistory = this.qualityTrends.qualityHistory.slice(-50);
    }
  }

  /**
   * Calculate quality grade
   */
  calculateQualityGrade(score) {
    if (score >= this.qualityThresholds.excellent) return 'A';
    if (score >= this.qualityThresholds.good) return 'B';
    if (score >= this.qualityThresholds.fair) return 'C';
    if (score >= this.qualityThresholds.poor) return 'D';
    return 'F';
  }

  /**
   * Categorize test failure
   */
  categorizeTestFailure(test) {
    if (!test.failureMessages || test.failureMessages.length === 0) {
      return 'unknown';
    }

    const message = test.failureMessages[0].toLowerCase();
    
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('expect')) return 'assertion';
    if (message.includes('mock')) return 'mocking';
    if (message.includes('async') || message.includes('promise')) return 'async';
    if (message.includes('syntax') || message.includes('parse')) return 'syntax';
    
    return 'runtime';
  }

  /**
   * Identify failure patterns
   */
  identifyFailurePatterns(failures) {
    const patterns = [];
    
    // Check for common failure types
    const totalFailures = Object.values(failures.byType).reduce((sum, count) => sum + count, 0);
    
    for (const [type, count] of Object.entries(failures.byType)) {
      const percentage = (count / totalFailures) * 100;
      if (percentage > 30) {
        patterns.push(`High concentration of ${type} failures (${percentage.toFixed(1)}%)`);
      }
    }
    
    // Check for file-specific issues
    const fileFailures = Object.entries(failures.byFile)
      .filter(([, data]) => data.failing > 3)
      .map(([file]) => file);
    
    if (fileFailures.length > 0) {
      patterns.push(`Files with multiple failures: ${fileFailures.join(', ')}`);
    }
    
    return patterns;
  }

  /**
   * Export quality report
   */
  async exportReport(report, format = 'json', outputPath = null) {
    const exportId = randomUUID();
    
    try {
      let content;
      let filename;
      
      switch (format.toLowerCase()) {
        case 'json':
          content = JSON.stringify(report, null, 2);
          filename = `quality-report-${report.reportId}.json`;
          break;
          
        case 'html':
          content = await this.generateHTMLReport(report);
          filename = `quality-report-${report.reportId}.html`;
          break;
          
        case 'markdown':
          content = await this.generateMarkdownReport(report);
          filename = `quality-report-${report.reportId}.md`;
          break;
          
        case 'csv':
          content = await this.generateCSVReport(report);
          filename = `quality-report-${report.reportId}.csv`;
          break;
          
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
      
      const fullPath = outputPath ? path.join(outputPath, filename) : filename;
      
      if (outputPath) {
        await fs.writeFile(fullPath, content, 'utf8');
      }
      
      return {
        exportId,
        format,
        filename,
        path: fullPath,
        content: outputPath ? null : content,
        size: Buffer.byteLength(content, 'utf8')
      };
      
    } catch (error) {
      throw new Error(`Failed to export report: ${error.message}`);
    }
  }

  /**
   * Generate HTML report
   */
  async generateHTMLReport(report) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quality Report - ${report.reportId}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .metric-card { background: white; border: 1px solid #dee2e6; padding: 15px; border-radius: 8px; text-align: center; }
        .score { font-size: 2em; font-weight: bold; margin: 10px 0; }
        .grade-A { color: #28a745; }
        .grade-B { color: #6f42c1; }
        .grade-C { color: #fd7e14; }
        .grade-D { color: #dc3545; }
        .grade-F { color: #6c757d; }
        .section { margin: 20px 0; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px; }
        .insights { background: #e3f2fd; }
        .recommendations { background: #f3e5f5; }
        .trends { background: #e8f5e8; }
        ul { list-style-type: none; padding: 0; }
        li { margin: 5px 0; padding: 5px; background: rgba(0,0,0,0.05); border-radius: 4px; }
        .priority { background: #ffebee; border-left: 4px solid #f44336; }
        .immediate { background: #fff3e0; border-left: 4px solid #ff9800; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Quality Report</h1>
        <p><strong>Project:</strong> ${report.projectPath}</p>
        <p><strong>Generated:</strong> ${new Date(report.timestamp).toLocaleString()}</p>
        <p><strong>Execution Time:</strong> ${report.executionTime}ms</p>
    </div>

    <div class="summary">
        <div class="metric-card">
            <h3>Overall Score</h3>
            <div class="score grade-${report.summary.qualityGrade}">${report.summary.overallScore.toFixed(1)}</div>
            <div>Grade: ${report.summary.qualityGrade}</div>
        </div>
        <div class="metric-card">
            <h3>Test Coverage</h3>
            <div class="score">${report.jest.coverage.score.toFixed(1)}%</div>
            <div>Grade: ${report.jest.coverage.quality}</div>
        </div>
        <div class="metric-card">
            <h3>Code Quality</h3>
            <div class="score">${report.eslint.score.toFixed(1)}</div>
            <div>Grade: ${report.eslint.quality}</div>
        </div>
        <div class="metric-card">
            <h3>Test Success</h3>
            <div class="score">${report.jest.summary.successRate.toFixed(1)}%</div>
            <div>${report.jest.summary.passedTests}/${report.jest.summary.totalTests} passed</div>
        </div>
    </div>

    <div class="section insights">
        <h2>Key Insights</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
            <div>
                <h3>Strengths</h3>
                <ul>${report.insights.strengths.map(s => `<li>${s}</li>`).join('')}</ul>
            </div>
            <div>
                <h3>Weaknesses</h3>
                <ul>${report.insights.weaknesses.map(w => `<li>${w}</li>`).join('')}</ul>
            </div>
            <div>
                <h3>Opportunities</h3>
                <ul>${report.insights.opportunities.map(o => `<li>${o}</li>`).join('')}</ul>
            </div>
            <div>
                <h3>Risks</h3>
                <ul>${report.insights.risks.map(r => `<li>${r}</li>`).join('')}</ul>
            </div>
        </div>
    </div>

    <div class="section recommendations">
        <h2>Recommendations</h2>
        <div>
            <h3>Priority Actions</h3>
            <ul>${report.recommendations.priority.map(p => `<li class="priority">${p}</li>`).join('')}</ul>
        </div>
        <div>
            <h3>Immediate Actions</h3>
            <ul>${report.recommendations.immediate.map(i => `<li class="immediate">${i}</li>`).join('')}</ul>
        </div>
    </div>

    <div class="section">
        <h2>ESLint Analysis</h2>
        <p><strong>Total Files:</strong> ${report.eslint.summary.totalFiles}</p>
        <p><strong>Errors:</strong> ${report.eslint.summary.totalErrors} | <strong>Warnings:</strong> ${report.eslint.summary.totalWarnings}</p>
        <p><strong>Auto-fixable:</strong> ${report.eslint.fixability.autoFixable} issues</p>
        
        <h3>Most Common Issues</h3>
        <ul>
            ${report.eslint.issues.mostCommon.slice(0, 5).map(issue => 
                `<li>${issue.rule}: ${issue.count} occurrences (${issue.severity === 2 ? 'error' : 'warning'})</li>`
            ).join('')}
        </ul>
    </div>

    <div class="section">
        <h2>Jest Analysis</h2>
        <p><strong>Total Tests:</strong> ${report.jest.summary.totalTests}</p>
        <p><strong>Passed:</strong> ${report.jest.summary.passedTests} | <strong>Failed:</strong> ${report.jest.summary.failedTests}</p>
        
        <h3>Coverage Breakdown</h3>
        <ul>
            <li>Lines: ${report.jest.coverage.lines.pct.toFixed(1)}% (${report.jest.coverage.lines.covered}/${report.jest.coverage.lines.total})</li>
            <li>Statements: ${report.jest.coverage.statements.pct.toFixed(1)}% (${report.jest.coverage.statements.covered}/${report.jest.coverage.statements.total})</li>
            <li>Functions: ${report.jest.coverage.functions.pct.toFixed(1)}% (${report.jest.coverage.functions.covered}/${report.jest.coverage.functions.total})</li>
            <li>Branches: ${report.jest.coverage.branches.pct.toFixed(1)}% (${report.jest.coverage.branches.covered}/${report.jest.coverage.branches.total})</li>
        </ul>
    </div>

    ${report.trends.comparison ? `
    <div class="section trends">
        <h2>Quality Trends</h2>
        <p><strong>Direction:</strong> ${report.trends.direction}</p>
        <p><strong>Change:</strong> ${report.trends.comparison.change > 0 ? '+' : ''}${report.trends.comparison.change.toFixed(1)} points (${report.trends.comparison.changePercent}%)</p>
        <p><strong>Previous Score:</strong> ${report.trends.comparison.previous.toFixed(1)} → <strong>Current Score:</strong> ${report.trends.comparison.current.toFixed(1)}</p>
        ${report.trends.forecast ? `<p><strong>Forecast:</strong> ${report.trends.forecast.nextScore.toFixed(1)} (${report.trends.forecast.confidence} confidence)</p>` : ''}
    </div>
    ` : ''}
</body>
</html>`;
  }

  /**
   * Generate Markdown report
   */
  async generateMarkdownReport(report) {
    return `# Quality Report

**Project:** ${report.projectPath}  
**Generated:** ${new Date(report.timestamp).toLocaleString()}  
**Execution Time:** ${report.executionTime}ms  

## Summary

| Metric | Score | Grade |
|--------|-------|-------|
| Overall Quality | ${report.summary.overallScore.toFixed(1)} | ${report.summary.qualityGrade} |
| Test Coverage | ${report.jest.coverage.score.toFixed(1)}% | ${report.jest.coverage.quality} |
| Code Quality | ${report.eslint.score.toFixed(1)} | ${report.eslint.quality} |
| Test Success | ${report.jest.summary.successRate.toFixed(1)}% | ${report.jest.summary.passedTests}/${report.jest.summary.totalTests} |

## Key Insights

### Strengths
${report.insights.strengths.map(s => `- ${s}`).join('\n')}

### Weaknesses  
${report.insights.weaknesses.map(w => `- ${w}`).join('\n')}

### Opportunities
${report.insights.opportunities.map(o => `- ${o}`).join('\n')}

### Risks
${report.insights.risks.map(r => `- ${r}`).join('\n')}

## Recommendations

### Priority Actions
${report.recommendations.priority.map(p => `- **${p}**`).join('\n')}

### Immediate Actions
${report.recommendations.immediate.map(i => `- ${i}`).join('\n')}

### Short-term Actions
${report.recommendations.shortTerm.map(s => `- ${s}`).join('\n')}

## ESLint Analysis

- **Total Files:** ${report.eslint.summary.totalFiles}
- **Errors:** ${report.eslint.summary.totalErrors}
- **Warnings:** ${report.eslint.summary.totalWarnings}
- **Auto-fixable:** ${report.eslint.fixability.autoFixable} issues
- **Score:** ${report.eslint.score.toFixed(1)}/100

### Most Common Issues
${report.eslint.issues.mostCommon.slice(0, 5).map(issue => 
  `- ${issue.rule}: ${issue.count} occurrences (${issue.severity === 2 ? 'error' : 'warning'})`
).join('\n')}

## Jest Analysis

- **Total Tests:** ${report.jest.summary.totalTests}
- **Passed:** ${report.jest.summary.passedTests}
- **Failed:** ${report.jest.summary.failedTests}
- **Success Rate:** ${report.jest.summary.successRate.toFixed(1)}%

### Coverage
- **Lines:** ${report.jest.coverage.lines.pct.toFixed(1)}% (${report.jest.coverage.lines.covered}/${report.jest.coverage.lines.total})
- **Statements:** ${report.jest.coverage.statements.pct.toFixed(1)}% (${report.jest.coverage.statements.covered}/${report.jest.coverage.statements.total})
- **Functions:** ${report.jest.coverage.functions.pct.toFixed(1)}% (${report.jest.coverage.functions.covered}/${report.jest.coverage.functions.total})
- **Branches:** ${report.jest.coverage.branches.pct.toFixed(1)}% (${report.jest.coverage.branches.covered}/${report.jest.coverage.branches.total})

${report.trends.comparison ? `
## Quality Trends

- **Direction:** ${report.trends.direction}
- **Change:** ${report.trends.comparison.change > 0 ? '+' : ''}${report.trends.comparison.change.toFixed(1)} points (${report.trends.comparison.changePercent}%)
- **Previous Score:** ${report.trends.comparison.previous.toFixed(1)} → **Current Score:** ${report.trends.comparison.current.toFixed(1)}
${report.trends.forecast ? `- **Forecast:** ${report.trends.forecast.nextScore.toFixed(1)} (${report.trends.forecast.confidence} confidence)` : ''}
` : ''}`;
  }

  /**
   * Generate CSV report
   */
  async generateCSVReport(report) {
    const rows = [
      ['Metric', 'Value', 'Grade'],
      ['Overall Score', report.summary.overallScore.toFixed(1), report.summary.qualityGrade],
      ['Test Coverage', report.jest.coverage.score.toFixed(1), report.jest.coverage.quality],
      ['Code Quality', report.eslint.score.toFixed(1), report.eslint.quality],
      ['Test Success Rate', report.jest.summary.successRate.toFixed(1), ''],
      ['Total Tests', report.jest.summary.totalTests, ''],
      ['Passed Tests', report.jest.summary.passedTests, ''],
      ['Failed Tests', report.jest.summary.failedTests, ''],
      ['ESLint Errors', report.eslint.summary.totalErrors, ''],
      ['ESLint Warnings', report.eslint.summary.totalWarnings, ''],
      ['Auto-fixable Issues', report.eslint.fixability.autoFixable, ''],
      ['Execution Time (ms)', report.executionTime, '']
    ];

    return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }

  /**
   * Get quality trends
   */
  async getQualityTrends() {
    return this.qualityTrends;
  }

  /**
   * Get report history
   */
  async getReportHistory(limit = 10) {
    return this.reportHistory.slice(-limit);
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.emit('cleanup-started', { timestamp: Date.now() });

    try {
      // Reset state
      this.reportId = null;
      this.isInitialized = false;
      
      // Clear history (keep trends for analytics)
      this.reportHistory = [];
      
      this.emit('cleanup-completed', { timestamp: Date.now() });
      
    } catch (error) {
      this.emit('cleanup-error', { error: error.message, timestamp: Date.now() });
      throw error;
    }
  }
}

export { QualityReporter };