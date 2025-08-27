/**
 * LogAnalysisEngine - AI-powered log analysis with actionable insights
 * 
 * Provides comprehensive log analysis including error detection, pattern recognition,
 * performance analysis, root cause analysis, and actionable suggestions.
 */

import { EventEmitter } from 'events';
import { EnhancedCorrelationEngine } from './EnhancedCorrelationEngine.js';
import { EnhancedPerformanceAnalyzer } from './EnhancedPerformanceAnalyzer.js';

/**
 * LogAnalysisEngine class for comprehensive log analysis
 */
class LogAnalysisEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Configuration with defaults
    this.config = {
      errorPatterns: [
        /ERROR:/i,
        /FAILED:/i,
        /exception/i,
        /error/i,
        /fatal/i,
        /critical/i
      ],
      warningPatterns: [
        /WARN:/i,
        /WARNING:/i,
        /deprecated/i,
        /obsolete/i,
        /slow/i
      ],
      performancePatterns: [
        /took (\d+)ms/i,
        /duration: (\d+)/i,
        /response time: (\d+)/i,
        /elapsed: (\d+)/i,
        /execution time: (\d+)/i
      ],
      enableRootCauseAnalysis: true,
      correlationWindowMs: 5000,
      maxSuggestions: 5,
      performanceThreshold: 1000, // ms
      errorFrequencyThreshold: 3,
      ...config
    };
    
    // Validate configuration
    this.validateConfig();
    
    // State management
    this.isCleanedUp = false;
    this.analysisCache = new Map();
    this.patternCache = new Map();
    
    // Enhanced correlation engine
    this.correlationEngine = new EnhancedCorrelationEngine({
      shortTermWindow: this.config.correlationWindowMs,
      correlationThreshold: 0.7,
      causalityThreshold: 0.8,
      enableCausalityDetection: this.config.enableRootCauseAnalysis
    });
    
    // Enhanced performance analyzer
    this.performanceAnalyzer = new EnhancedPerformanceAnalyzer({
      criticalThreshold: 5000,
      warningThreshold: 2000,
      targetThreshold: 500,
      enablePredictiveAnalysis: this.config.enableRootCauseAnalysis,
      enableDetailedMetrics: true
    });
    
    // Performance metrics
    this.metrics = {
      logsProcessed: 0,
      analysisTime: 0,
      errorsFound: 0,
      warningsFound: 0,
      patternsDetected: 0,
      suggestionsGenerated: 0
    };
    
    // Error categories
    this.errorCategories = {
      'connection': /connection|connect|socket|network|timeout/i,
      'database': /database.*(sql|query|table|schema)|sql.*database|query.*database/i,
      'authentication': /auth|login|token|credentials|unauthorized/i,
      'validation': /validation|invalid|format|parse|syntax/i,
      'permission': /permission|access|forbidden|denied/i,
      'exception': /exception|unhandled|caught|throw/i,
      'memory': /memory|heap|stack|allocation|leak/i,
      'performance': /slow|performance|bottleneck|latency/i
    };
    
    // Warning severity levels
    this.warningSeverity = {
      'security': 'high',
      'performance': 'medium',
      'deprecated': 'low',
      'config': 'medium',
      'resource': 'high'
    };
  }

  /**
   * Validate configuration
   */
  validateConfig() {
    if (!Array.isArray(this.config.errorPatterns)) {
      throw new Error('errorPatterns must be an array');
    }
    
    if (!Array.isArray(this.config.warningPatterns)) {
      throw new Error('warningPatterns must be an array');
    }
    
    if (this.config.correlationWindowMs < 0) {
      throw new Error('correlationWindowMs must be non-negative');
    }
    
    if (this.config.maxSuggestions < 1) {
      throw new Error('maxSuggestions must be at least 1');
    }
  }

  /**
   * Analyze test logs comprehensively
   */
  async analyzeTestLogs(logs) {
    const startTime = Date.now();
    
    this.emit('analysis-started', { logCount: logs.length, timestamp: startTime });
    
    try {
      // Extract different types of issues
      const errors = this.extractErrors(logs);
      const warnings = this.extractWarnings(logs);
      const performance = this.analyzePerformance(logs);
      const enhancedPerformance = await this.performanceAnalyzer.analyzePerformance(logs);
      
      // Detect patterns
      const patterns = this.detectPatterns(logs);
      
      // Analyze chains and correlations
      const chains = this.analyzeErrorChains(logs);
      
      // Enhanced correlation analysis
      const enhancedCorrelation = await this.correlationEngine.performCorrelationAnalysis(logs);
      
      // Generate insights and suggestions
      const insights = await this.generateInsights(logs);
      const suggestions = this.generateSuggestions(errors, warnings, performance);
      
      // Prioritize issues
      const priorities = this.prioritizeIssues(errors, warnings);
      
      // Update metrics
      this.metrics.logsProcessed += logs.length;
      this.metrics.errorsFound += errors.length;
      this.metrics.warningsFound += warnings.length;
      this.metrics.patternsDetected += patterns.commonErrors.length + patterns.repeatedErrors.length;
      this.metrics.suggestionsGenerated += suggestions.length;
      const analysisTime = Date.now() - startTime;
      this.metrics.analysisTime += Math.max(1, analysisTime); // Ensure at least 1ms is recorded
      
      const analysis = {
        errors,
        warnings,
        performance,
        enhancedPerformance,
        patterns,
        chains,
        enhancedCorrelation,
        insights,
        suggestions,
        priorities,
        metadata: {
          totalLogs: logs.length,
          analysisTime: Date.now() - startTime,
          timestamp: Date.now()
        }
      };
      
      this.emit('analysis-completed', { analysis, timestamp: Date.now() });
      
      return analysis;
      
    } catch (error) {
      this.emit('analysis-failed', { error: error.message, timestamp: Date.now() });
      throw error;
    }
  }

  /**
   * Extract error logs and categorize them
   */
  extractErrors(logs) {
    const errors = [];
    
    for (const log of logs) {
      if (this.isErrorLog(log)) {
        const category = this.categorizeError(log);
        const errorInfo = {
          id: log.id,
          timestamp: log.timestamp,
          source: log.source,
          message: log.message,
          correlationId: log.correlationId,
          category,
          severity: this.getErrorSeverity(log, category),
          stack: log.stack || null,
          metadata: log.metadata || {}
        };
        
        errors.push(errorInfo);
      }
    }
    
    return errors;
  }

  /**
   * Check if log is an error
   */
  isErrorLog(log) {
    if (log.level === 'error') {
      return true;
    }
    
    return this.config.errorPatterns.some(pattern => 
      pattern.test(log.message)
    );
  }

  /**
   * Categorize error by type
   */
  categorizeError(log) {
    for (const [category, pattern] of Object.entries(this.errorCategories)) {
      if (pattern.test(log.message)) {
        return category;
      }
    }
    
    return 'unknown';
  }

  /**
   * Get error severity level
   */
  getErrorSeverity(log, category) {
    const criticalCategories = ['security', 'database', 'authentication'];
    const highCategories = ['connection', 'exception', 'memory'];
    
    if (criticalCategories.includes(category)) {
      return 'critical';
    }
    
    if (highCategories.includes(category)) {
      return 'high';
    }
    
    return 'medium';
  }

  /**
   * Extract warning logs and categorize them
   */
  extractWarnings(logs) {
    const warnings = [];
    
    for (const log of logs) {
      if (this.isWarningLog(log)) {
        const category = this.categorizeWarning(log);
        const warningInfo = {
          id: log.id,
          timestamp: log.timestamp,
          source: log.source,
          message: log.message,
          correlationId: log.correlationId,
          category,
          severity: this.getWarningSeverity(log, category),
          metadata: log.metadata || {}
        };
        
        warnings.push(warningInfo);
      }
    }
    
    return warnings;
  }

  /**
   * Check if log is a warning
   */
  isWarningLog(log) {
    if (log.level === 'warn' || log.level === 'warning') {
      return true;
    }
    
    return this.config.warningPatterns.some(pattern => 
      pattern.test(log.message)
    );
  }

  /**
   * Categorize warning by type
   */
  categorizeWarning(log) {
    if (/security|auth|unauthorized|password/i.test(log.message)) {
      return 'security';
    }
    
    if (/performance|slow|memory|cpu/i.test(log.message)) {
      return 'performance';
    }
    
    if (/deprecated|obsolete|legacy/i.test(log.message)) {
      return 'deprecated';
    }
    
    if (/config|configuration|setting/i.test(log.message)) {
      return 'config';
    }
    
    if (/resource|disk|space|limit/i.test(log.message)) {
      return 'resource';
    }
    
    return 'general';
  }

  /**
   * Get warning severity level
   */
  getWarningSeverity(log, category) {
    return this.warningSeverity[category] || 'low';
  }

  /**
   * Analyze performance metrics from logs
   */
  analyzePerformance(logs) {
    const metrics = [];
    const bottlenecks = [];
    const trends = this.analyzePerformanceTrends(logs);
    
    for (const log of logs) {
      const performanceData = this.extractPerformanceData(log);
      
      if (performanceData) {
        metrics.push({
          id: log.id,
          timestamp: log.timestamp,
          source: log.source,
          value: performanceData.value,
          unit: performanceData.unit,
          operation: performanceData.operation,
          correlationId: log.correlationId
        });
        
        // Check for bottlenecks
        if (performanceData.value > this.config.performanceThreshold) {
          bottlenecks.push({
            id: log.id,
            timestamp: log.timestamp,
            source: log.source,
            value: performanceData.value,
            unit: performanceData.unit,
            operation: performanceData.operation,
            severity: this.getPerformanceSeverity(performanceData.value)
          });
        }
      }
    }
    
    return {
      metrics,
      bottlenecks,
      trends,
      averageResponseTime: this.calculateAverageResponseTime(metrics),
      totalOperations: metrics.length
    };
  }

  /**
   * Extract performance data from log message
   */
  extractPerformanceData(log) {
    for (const pattern of this.config.performancePatterns) {
      const match = log.message.match(pattern);
      if (match) {
        const value = parseInt(match[1], 10);
        return {
          value,
          unit: 'ms',
          operation: this.extractOperationName(log.message)
        };
      }
    }
    
    return null;
  }

  /**
   * Extract operation name from log message
   */
  extractOperationName(message) {
    // Simple extraction - could be enhanced with NLP
    const words = message.toLowerCase().split(' ');
    const operationWords = ['request', 'query', 'operation', 'call', 'process'];
    
    for (const word of operationWords) {
      if (words.includes(word)) {
        return word;
      }
    }
    
    return 'unknown';
  }

  /**
   * Analyze performance trends
   */
  analyzePerformanceTrends(logs) {
    const performanceData = logs
      .map(log => this.extractPerformanceData(log))
      .filter(data => data !== null)
      .map((data, index) => ({ ...data, index }));
    
    if (performanceData.length < 2) {
      return { direction: 'stable', slope: 0 };
    }
    
    // Simple linear regression
    const n = performanceData.length;
    const sumX = performanceData.reduce((sum, data) => sum + data.index, 0);
    const sumY = performanceData.reduce((sum, data) => sum + data.value, 0);
    const sumXY = performanceData.reduce((sum, data) => sum + data.index * data.value, 0);
    const sumX2 = performanceData.reduce((sum, data) => sum + data.index * data.index, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    return {
      direction: slope > 10 ? 'increasing' : slope < -10 ? 'decreasing' : 'stable',
      slope: Math.round(slope * 100) / 100
    };
  }

  /**
   * Calculate average response time
   */
  calculateAverageResponseTime(metrics) {
    if (metrics.length === 0) return 0;
    
    const total = metrics.reduce((sum, metric) => sum + metric.value, 0);
    return Math.round(total / metrics.length);
  }

  /**
   * Get performance severity level
   */
  getPerformanceSeverity(value) {
    if (value > 5000) return 'critical';
    if (value > 2000) return 'high';
    if (value > 1000) return 'medium';
    return 'low';
  }

  /**
   * Detect patterns in logs
   */
  detectPatterns(logs) {
    const repeatedErrors = this.detectRepeatedErrors(logs);
    const commonErrors = this.detectCommonErrorPatterns(logs);
    const timePatterns = this.detectTimePatterns(logs);
    
    return {
      repeatedErrors,
      commonErrors,
      timePatterns
    };
  }

  /**
   * Detect repeated errors
   */
  detectRepeatedErrors(logs) {
    const errorCounts = new Map();
    
    for (const log of logs) {
      if (this.isErrorLog(log)) {
        const key = `${log.source}-${log.message}`;
        errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
      }
    }
    
    const repeatedErrors = [];
    for (const [key, count] of errorCounts) {
      if (count >= this.config.errorFrequencyThreshold) {
        const [source, message] = key.split('-', 2);
        repeatedErrors.push({
          source,
          message,
          frequency: count,
          severity: count > 10 ? 'critical' : count > 5 ? 'high' : 'medium'
        });
      }
    }
    
    return repeatedErrors;
  }

  /**
   * Detect common error patterns
   */
  detectCommonErrorPatterns(logs) {
    const patternCounts = new Map();
    
    for (const log of logs) {
      if (this.isErrorLog(log)) {
        const patterns = this.extractErrorPatterns(log.message);
        for (const pattern of patterns) {
          const sources = patternCounts.get(pattern)?.sources || new Set();
          sources.add(log.source);
          patternCounts.set(pattern, {
            frequency: (patternCounts.get(pattern)?.frequency || 0) + 1,
            sources
          });
        }
      }
    }
    
    const commonErrors = [];
    for (const [pattern, data] of patternCounts) {
      if (data.frequency >= this.config.errorFrequencyThreshold) {
        commonErrors.push({
          pattern,
          frequency: data.frequency,
          sources: Array.from(data.sources)
        });
      }
    }
    
    return commonErrors;
  }

  /**
   * Extract error patterns from message
   */
  extractErrorPatterns(message) {
    const patterns = [];
    
    // Extract common error types
    if (/TypeError/.test(message)) {
      patterns.push('TypeError');
    }
    
    if (/ReferenceError/.test(message)) {
      patterns.push('ReferenceError');
    }
    
    if (/SyntaxError/.test(message)) {
      patterns.push('SyntaxError');
    }
    
    if (/Connection/.test(message)) {
      patterns.push('Connection');
    }
    
    if (/Timeout/.test(message)) {
      patterns.push('Timeout');
    }
    
    return patterns;
  }

  /**
   * Detect time-based patterns
   */
  detectTimePatterns(logs) {
    const hourly = new Map();
    
    for (const log of logs) {
      if (this.isErrorLog(log)) {
        const hour = new Date(log.timestamp).getHours();
        hourly.set(hour, (hourly.get(hour) || 0) + 1);
      }
    }
    
    const peakHours = Array.from(hourly.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    return {
      hourlyDistribution: Object.fromEntries(hourly),
      peakHours: peakHours.map(([hour, count]) => ({ hour, count }))
    };
  }

  /**
   * Analyze error chains and propagation
   */
  analyzeErrorChains(logs) {
    const chains = [];
    const errorLogs = logs.filter(log => this.isErrorLog(log));
    
    // Group errors by time proximity
    const timeGroups = this.groupByTimeProximity(errorLogs, this.config.correlationWindowMs);
    
    for (const group of timeGroups) {
      if (group.length > 1) {
        const chain = this.identifyErrorChain(group);
        if (chain) {
          chains.push(chain);
        }
      }
    }
    
    return chains;
  }

  /**
   * Group logs by time proximity
   */
  groupByTimeProximity(logs, windowMs) {
    const groups = [];
    const sortedLogs = [...logs].sort((a, b) => a.timestamp - b.timestamp);
    
    let currentGroup = [sortedLogs[0]];
    
    for (let i = 1; i < sortedLogs.length; i++) {
      const log = sortedLogs[i];
      const lastLog = currentGroup[currentGroup.length - 1];
      
      if (log.timestamp - lastLog.timestamp <= windowMs) {
        currentGroup.push(log);
      } else {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [log];
      }
    }
    
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  }

  /**
   * Identify error chain from group
   */
  identifyErrorChain(group) {
    // Simple chain detection - could be enhanced with ML
    const sources = group.map(log => log.source);
    const uniqueSources = [...new Set(sources)];
    
    if (uniqueSources.length > 1) {
      return {
        type: 'error_propagation',
        steps: group.map(log => ({
          timestamp: log.timestamp,
          source: log.source,
          message: log.message,
          correlationId: log.correlationId
        })),
        duration: group[group.length - 1].timestamp - group[0].timestamp,
        severity: 'high'
      };
    }
    
    return null;
  }

  /**
   * Correlate logs by various criteria
   */
  async correlateLogs(logs) {
    const correlations = [];
    const correlationGroups = new Map();
    
    // Group by correlation ID
    for (const log of logs) {
      if (log.correlationId) {
        if (!correlationGroups.has(log.correlationId)) {
          correlationGroups.set(log.correlationId, []);
        }
        correlationGroups.get(log.correlationId).push(log);
      }
    }
    
    // Create correlation objects
    for (const [correlationId, groupLogs] of correlationGroups) {
      if (groupLogs.length > 1) {
        const sources = [...new Set(groupLogs.map(log => log.source))];
        const levels = [...new Set(groupLogs.map(log => log.level))];
        
        correlations.push({
          correlationId,
          sources,
          levels,
          count: groupLogs.length,
          timespan: groupLogs[groupLogs.length - 1].timestamp - groupLogs[0].timestamp,
          logs: groupLogs
        });
      }
    }
    
    return { correlations };
  }

  /**
   * Correlate logs by time window
   */
  async correlateLogsByTimeWindow(logs, baseTime, windowMs) {
    const startTime = baseTime - windowMs / 2;
    const endTime = baseTime + windowMs / 2;
    
    return logs.filter(log => 
      log.timestamp >= startTime && log.timestamp <= endTime
    );
  }

  /**
   * Generate actionable insights
   */
  async generateInsights(logs) {
    const insights = [];
    
    // Analyze errors for insights
    const errorLogs = logs.filter(log => this.isErrorLog(log));
    const errorsBySource = this.groupBySource(errorLogs);
    
    for (const [source, sourceLogs] of Object.entries(errorsBySource)) {
      if (sourceLogs.length > 0) {
        const insight = {
          id: `insight-${source}`,
          category: this.categorizeError(sourceLogs[0]),
          source,
          description: `${sourceLogs.length} error(s) detected in ${source}: ${sourceLogs[0].message}`,
          severity: sourceLogs.length > 5 ? 'high' : 'medium',
          actionable: true,
          recommendations: this.generateRecommendations(sourceLogs),
          affectedLogs: sourceLogs.map(log => log.id)
        };
        
        insights.push(insight);
      }
    }
    
    return { insights };
  }

  /**
   * Group logs by source
   */
  groupBySource(logs) {
    const groups = {};
    
    for (const log of logs) {
      if (!groups[log.source]) {
        groups[log.source] = [];
      }
      groups[log.source].push(log);
    }
    
    return groups;
  }

  /**
   * Generate recommendations for logs
   */
  generateRecommendations(logs) {
    const recommendations = [];
    const firstLog = logs[0];
    const category = this.categorizeError(firstLog);
    
    switch (category) {
      case 'connection':
        recommendations.push('Check network connectivity');
        recommendations.push('Verify service endpoints');
        recommendations.push('Review connection pool settings');
        break;
        
      case 'database':
        recommendations.push('Check database connectivity');
        recommendations.push('Review query performance');
        recommendations.push('Verify database schema');
        break;
        
      case 'authentication':
        recommendations.push('Verify authentication credentials');
        recommendations.push('Check token expiration');
        recommendations.push('Review access permissions');
        break;
        
      case 'performance':
        recommendations.push('Optimize slow operations');
        recommendations.push('Review resource allocation');
        recommendations.push('Consider caching strategies');
        break;
        
      default:
        recommendations.push('Review error logs for patterns');
        recommendations.push('Check application configuration');
        recommendations.push('Verify system resources');
    }
    
    return recommendations;
  }

  /**
   * Generate suggestions for improvements
   */
  generateSuggestions(errors, warnings, performance) {
    const suggestions = [];
    
    // Error-based suggestions
    if (errors.length > 0) {
      const errorsByCategory = this.groupByCategory(errors);
      
      for (const [category, categoryErrors] of Object.entries(errorsByCategory)) {
        if (categoryErrors.length > 0) {
          suggestions.push({
            id: `suggestion-${category}`,
            category,
            priority: this.getSuggestionPriority(category, categoryErrors.length),
            description: `Address ${categoryErrors.length} ${category} error(s)`,
            actions: this.generateCategoryActions(category),
            impact: 'high',
            effort: 'medium'
          });
        }
      }
    }
    
    // Performance-based suggestions
    if (performance.bottlenecks.length > 0) {
      suggestions.push({
        id: 'suggestion-performance',
        category: 'performance',
        priority: 'high',
        description: `Optimize ${performance.bottlenecks.length} performance bottleneck(s)`,
        actions: [
          'Profile slow operations',
          'Optimize database queries',
          'Implement caching',
          'Review algorithm complexity'
        ],
        impact: 'high',
        effort: 'high'
      });
    }
    
    return suggestions.slice(0, this.config.maxSuggestions);
  }

  /**
   * Group items by category
   */
  groupByCategory(items) {
    const groups = {};
    
    for (const item of items) {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    }
    
    return groups;
  }

  /**
   * Get suggestion priority
   */
  getSuggestionPriority(category, count) {
    const criticalCategories = ['database', 'authentication', 'security', 'connection'];
    
    if (criticalCategories.includes(category) || count > 10) {
      return 'high';
    }
    
    if (count > 5) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Generate category-specific actions
   */
  generateCategoryActions(category) {
    const actions = {
      database: [
        'Check database connection settings',
        'Verify database credentials',
        'Review query performance',
        'Check database resource usage'
      ],
      connection: [
        'Verify network connectivity',
        'Check service endpoints',
        'Review timeout settings',
        'Validate SSL certificates'
      ],
      authentication: [
        'Verify authentication credentials',
        'Check token expiration',
        'Review access permissions',
        'Validate user sessions'
      ],
      performance: [
        'Profile slow operations',
        'Optimize algorithms',
        'Review resource allocation',
        'Implement caching'
      ]
    };
    
    return actions[category] || [
      'Review error logs',
      'Check application logs',
      'Verify system resources',
      'Contact support if needed'
    ];
  }

  /**
   * Prioritize issues by severity and impact
   */
  prioritizeIssues(errors, warnings) {
    const priorities = [];
    
    // Add errors with high priority
    const highPriorityErrors = errors.filter(error => 
      error.severity === 'critical' || error.severity === 'high'
    );
    
    for (const error of highPriorityErrors) {
      priorities.push({
        id: error.id,
        type: 'error',
        level: 'high',
        source: error.source,
        message: error.message,
        category: error.category,
        timestamp: error.timestamp
      });
    }
    
    // Add warnings with medium priority
    const highSeverityWarnings = warnings.filter(warning => 
      warning.severity === 'high' || warning.severity === 'medium'
    );
    
    for (const warning of highSeverityWarnings) {
      priorities.push({
        id: warning.id,
        type: 'warning',
        level: 'medium',
        source: warning.source,
        message: warning.message,
        category: warning.category,
        timestamp: warning.timestamp
      });
    }
    
    // Sort by timestamp (most recent first)
    priorities.sort((a, b) => b.timestamp - a.timestamp);
    
    return priorities;
  }

  /**
   * Generate comprehensive analysis report
   */
  generateReport(analysis) {
    const report = {
      summary: {
        totalLogs: analysis.metadata.totalLogs,
        errorCount: analysis.errors.length,
        warningCount: analysis.warnings.length,
        performanceIssues: analysis.performance.bottlenecks.length,
        patternsDetected: analysis.patterns.commonErrors.length + analysis.patterns.repeatedErrors.length,
        analysisTime: analysis.metadata.analysisTime,
        timestamp: analysis.metadata.timestamp
      },
      sections: {
        errors: {
          total: analysis.errors.length,
          byCategory: this.groupByCategory(analysis.errors),
          critical: analysis.errors.filter(e => e.severity === 'critical').length,
          high: analysis.errors.filter(e => e.severity === 'high').length
        },
        warnings: {
          total: analysis.warnings.length,
          byCategory: this.groupByCategory(analysis.warnings),
          high: analysis.warnings.filter(w => w.severity === 'high').length,
          medium: analysis.warnings.filter(w => w.severity === 'medium').length
        },
        performance: {
          averageResponseTime: analysis.performance.averageResponseTime,
          bottlenecks: analysis.performance.bottlenecks.length,
          trends: analysis.performance.trends,
          slowestOperation: analysis.performance.bottlenecks[0] || null
        },
        patterns: {
          repeatedErrors: analysis.patterns.repeatedErrors.length,
          commonErrors: analysis.patterns.commonErrors.length,
          timePatterns: analysis.patterns.timePatterns
        },
        suggestions: {
          total: analysis.suggestions.length,
          high: analysis.suggestions.filter(s => s.priority === 'high').length,
          medium: analysis.suggestions.filter(s => s.priority === 'medium').length,
          low: analysis.suggestions.filter(s => s.priority === 'low').length
        }
      }
    };
    
    return report;
  }

  /**
   * Export analysis in different formats
   */
  exportAnalysis(analysis, format = 'json') {
    switch (format) {
      case 'json':
        return JSON.stringify(analysis, null, 2);
      
      case 'text':
        return this.generateTextReport(analysis);
      
      case 'markdown':
        return this.generateMarkdownReport(analysis);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Generate text report
   */
  generateTextReport(analysis) {
    const lines = [];
    
    lines.push('Log Analysis Report');
    lines.push('='.repeat(50));
    lines.push('');
    
    lines.push(`Total Logs: ${analysis.metadata.totalLogs}`);
    lines.push(`Errors: ${analysis.errors.length}`);
    lines.push(`Warnings: ${analysis.warnings.length}`);
    lines.push(`Performance Issues: ${analysis.performance.bottlenecks.length}`);
    lines.push('');
    
    if (analysis.errors.length > 0) {
      lines.push('Errors:');
      lines.push('-'.repeat(20));
      for (const error of analysis.errors) {
        lines.push(`  [${error.severity.toUpperCase()}] ${error.source}: ${error.message}`);
      }
      lines.push('');
    }
    
    if (analysis.warnings.length > 0) {
      lines.push('Warnings:');
      lines.push('-'.repeat(20));
      for (const warning of analysis.warnings) {
        lines.push(`  [${warning.severity.toUpperCase()}] ${warning.source}: ${warning.message}`);
      }
      lines.push('');
    }
    
    if (analysis.suggestions.length > 0) {
      lines.push('Suggestions:');
      lines.push('-'.repeat(20));
      for (const suggestion of analysis.suggestions) {
        lines.push(`  [${suggestion.priority.toUpperCase()}] ${suggestion.description}`);
      }
      lines.push('');
    }
    
    return lines.join('\n');
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport(analysis) {
    const lines = [];
    
    lines.push('# Log Analysis Report');
    lines.push('');
    
    lines.push('## Summary');
    lines.push(`- **Total Logs**: ${analysis.metadata.totalLogs}`);
    lines.push(`- **Errors**: ${analysis.errors.length}`);
    lines.push(`- **Warnings**: ${analysis.warnings.length}`);
    lines.push(`- **Performance Issues**: ${analysis.performance.bottlenecks.length}`);
    lines.push('');
    
    if (analysis.errors.length > 0) {
      lines.push('## Errors');
      lines.push('| Severity | Source | Message |');
      lines.push('|----------|--------|---------|');
      for (const error of analysis.errors) {
        lines.push(`| ${error.severity} | ${error.source} | ${error.message} |`);
      }
      lines.push('');
    }
    
    if (analysis.warnings.length > 0) {
      lines.push('## Warnings');
      lines.push('| Severity | Source | Message |');
      lines.push('|----------|--------|---------|');
      for (const warning of analysis.warnings) {
        lines.push(`| ${warning.severity} | ${warning.source} | ${warning.message} |`);
      }
      lines.push('');
    }
    
    if (analysis.suggestions.length > 0) {
      lines.push('## Suggestions');
      for (const suggestion of analysis.suggestions) {
        lines.push(`### ${suggestion.description}`);
        lines.push(`**Priority**: ${suggestion.priority}`);
        lines.push(`**Actions**:`);
        for (const action of suggestion.actions) {
          lines.push(`- ${action}`);
        }
        lines.push('');
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Get analysis metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.analysisCache.size,
      patternCacheSize: this.patternCache.size
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.analysisCache.clear();
    this.patternCache.clear();
    await this.correlationEngine.cleanup();
    await this.performanceAnalyzer.cleanup();
    this.isCleanedUp = true;
    
    this.emit('cleanup-complete', { timestamp: Date.now() });
  }
}

export { LogAnalysisEngine };