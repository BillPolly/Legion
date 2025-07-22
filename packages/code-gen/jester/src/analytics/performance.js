/**
 * Performance Analysis Module
 * Analyzes test performance metrics and identifies bottlenecks
 */

export class PerformanceAnalyzer {
  constructor(jaw) {
    if (!jaw) {
      throw new Error('JAW instance is required');
    }
    this.jaw = jaw;
  }

  /**
   * Analyze test performance for a session
   */
  async analyzeSession(sessionId) {
    const tests = await this.jaw.findTests({ sessionId });
    
    if (tests.length === 0) {
      return {
        message: 'No tests found for this session',
        sessionId
      };
    }

    const metrics = this.calculateMetrics(tests);
    const bottlenecks = this.identifyBottlenecks(tests);
    const trends = await this.analyzeTrends(tests);
    const recommendations = this.generateRecommendations(metrics, bottlenecks);

    return {
      sessionId,
      totalTests: tests.length,
      metrics,
      bottlenecks,
      trends,
      recommendations,
      summary: this.generateSummary(metrics, bottlenecks)
    };
  }

  /**
   * Calculate performance metrics
   */
  calculateMetrics(tests) {
    const durations = tests.map(t => t.duration).filter(d => d > 0);
    
    if (durations.length === 0) {
      return {
        totalDuration: 0,
        averageDuration: 0,
        medianDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        standardDeviation: 0
      };
    }

    const sorted = durations.sort((a, b) => a - b);
    const total = durations.reduce((sum, d) => sum + d, 0);
    const average = total / durations.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    
    // Calculate standard deviation
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - average, 2), 0) / durations.length;
    const standardDeviation = Math.sqrt(variance);

    return {
      totalDuration: total,
      averageDuration: Math.round(average),
      medianDuration: median,
      minDuration: sorted[0],
      maxDuration: sorted[sorted.length - 1],
      standardDeviation: Math.round(standardDeviation)
    };
  }

  /**
   * Identify performance bottlenecks
   */
  identifyBottlenecks(tests) {
    const durations = tests.map(t => t.duration).filter(d => d > 0);
    
    if (durations.length === 0) {
      return {
        slowTests: [],
        outliers: [],
        categories: {}
      };
    }

    const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const threshold = average * 2; // Tests taking more than 2x average are slow
    
    const slowTests = tests
      .filter(t => t.duration > threshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)
      .map(t => ({
        name: t.fullName,
        duration: t.duration,
        slownessFactor: Math.round(t.duration / average * 100) / 100
      }));

    // Identify outliers (tests taking more than 3 standard deviations from mean)
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - average, 2), 0) / durations.length;
    const stdDev = Math.sqrt(variance);
    const outlierThreshold = average + (3 * stdDev);
    
    const outliers = tests
      .filter(t => t.duration > outlierThreshold)
      .map(t => ({
        name: t.fullName,
        duration: t.duration,
        deviationFactor: Math.round((t.duration - average) / stdDev * 100) / 100
      }));

    // Categorize performance issues
    const categories = this.categorizePerformanceIssues(tests, average);

    return {
      slowTests,
      outliers,
      categories,
      thresholds: {
        slow: threshold,
        outlier: outlierThreshold
      }
    };
  }

  /**
   * Categorize performance issues
   */
  categorizePerformanceIssues(tests, average) {
    const categories = {
      veryFast: [], // < 50ms
      fast: [],     // 50-200ms
      moderate: [], // 200-1000ms
      slow: [],     // 1000-5000ms
      verySlow: []  // > 5000ms
    };

    tests.forEach(test => {
      const duration = test.duration;
      if (duration < 50) {
        categories.veryFast.push(test);
      } else if (duration < 200) {
        categories.fast.push(test);
      } else if (duration < 1000) {
        categories.moderate.push(test);
      } else if (duration < 5000) {
        categories.slow.push(test);
      } else {
        categories.verySlow.push(test);
      }
    });

    // Return counts and percentages
    const total = tests.length;
    return {
      veryFast: {
        count: categories.veryFast.length,
        percentage: Math.round(categories.veryFast.length / total * 100)
      },
      fast: {
        count: categories.fast.length,
        percentage: Math.round(categories.fast.length / total * 100)
      },
      moderate: {
        count: categories.moderate.length,
        percentage: Math.round(categories.moderate.length / total * 100)
      },
      slow: {
        count: categories.slow.length,
        percentage: Math.round(categories.slow.length / total * 100)
      },
      verySlow: {
        count: categories.verySlow.length,
        percentage: Math.round(categories.verySlow.length / total * 100)
      }
    };
  }

  /**
   * Analyze performance trends
   */
  async analyzeTrends(tests) {
    // Group tests by name to analyze trends over time
    const testGroups = {};
    tests.forEach(test => {
      if (!testGroups[test.fullName]) {
        testGroups[test.fullName] = [];
      }
      testGroups[test.fullName].push(test);
    });

    const trends = {};
    Object.entries(testGroups).forEach(([testName, testRuns]) => {
      if (testRuns.length > 1) {
        const sortedRuns = testRuns.sort((a, b) => a.startTime - b.startTime);
        const durations = sortedRuns.map(t => t.duration);
        
        // Calculate trend direction
        const firstHalf = durations.slice(0, Math.floor(durations.length / 2));
        const secondHalf = durations.slice(Math.floor(durations.length / 2));
        
        const firstAvg = firstHalf.reduce((sum, d) => sum + d, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, d) => sum + d, 0) / secondHalf.length;
        
        let trend = 'stable';
        const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
        
        if (changePercent > 20) {
          trend = 'degrading';
        } else if (changePercent < -20) {
          trend = 'improving';
        }

        trends[testName] = {
          trend,
          changePercent: Math.round(changePercent),
          runs: testRuns.length,
          averageDuration: Math.round((durations.reduce((sum, d) => sum + d, 0) / durations.length))
        };
      }
    });

    return trends;
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(metrics, bottlenecks) {
    const recommendations = [];

    // Slow test recommendations
    if (bottlenecks.slowTests.length > 0) {
      recommendations.push({
        type: 'slow_tests',
        priority: 'high',
        title: 'Optimize Slow Tests',
        description: `${bottlenecks.slowTests.length} tests are significantly slower than average`,
        suggestion: 'Review test logic, mock external dependencies, and optimize database queries',
        affectedTests: bottlenecks.slowTests.slice(0, 3).map(t => t.name)
      });
    }

    // Outlier recommendations
    if (bottlenecks.outliers.length > 0) {
      recommendations.push({
        type: 'outliers',
        priority: 'medium',
        title: 'Investigate Performance Outliers',
        description: `${bottlenecks.outliers.length} tests have extremely unusual performance characteristics`,
        suggestion: 'Check for race conditions, timing dependencies, or resource contention',
        affectedTests: bottlenecks.outliers.slice(0, 3).map(t => t.name)
      });
    }

    // High variance recommendation
    if (metrics.standardDeviation > metrics.averageDuration) {
      recommendations.push({
        type: 'high_variance',
        priority: 'medium',
        title: 'High Performance Variance',
        description: 'Test durations vary significantly, indicating inconsistent performance',
        suggestion: 'Standardize test environments and reduce external dependencies'
      });
    }

    // Very slow category recommendation
    if (bottlenecks.categories && bottlenecks.categories.verySlow && bottlenecks.categories.verySlow.count > 0) {
      recommendations.push({
        type: 'very_slow',
        priority: 'high',
        title: 'Very Slow Tests Detected',
        description: `${bottlenecks.categories.verySlow.count} tests take over 5 seconds to complete`,
        suggestion: 'Consider breaking down complex tests or using test doubles for expensive operations'
      });
    }

    return recommendations;
  }

  /**
   * Generate performance summary
   */
  generateSummary(metrics, bottlenecks) {
    let status = 'good';
    const issues = [];

    if (bottlenecks.slowTests.length > 5) {
      status = 'poor';
      issues.push(`${bottlenecks.slowTests.length} slow tests detected`);
    } else if (bottlenecks.slowTests.length > 0) {
      status = 'fair';
      issues.push(`${bottlenecks.slowTests.length} slow tests detected`);
    }

    if (bottlenecks.outliers.length > 0) {
      status = status === 'good' ? 'fair' : status;
      issues.push(`${bottlenecks.outliers.length} performance outliers detected`);
    }

    if (metrics.averageDuration > 1000) {
      status = 'poor';
      issues.push('High average test duration');
    }

    return {
      status,
      issues,
      message: this.generateSummaryMessage(status, metrics, issues)
    };
  }

  /**
   * Generate summary message
   */
  generateSummaryMessage(status, metrics, issues) {
    switch (status) {
      case 'good':
        return `Performance is good. Average test duration: ${metrics.averageDuration}ms`;
      case 'fair':
        return `Performance is acceptable but could be improved. Issues: ${issues.join(', ')}`;
      case 'poor':
        return `Performance needs attention. Major issues: ${issues.join(', ')}`;
      default:
        return 'Performance analysis completed';
    }
  }

  /**
   * Compare performance between sessions
   */
  async compareSessions(sessionId1, sessionId2) {
    const [analysis1, analysis2] = await Promise.all([
      this.analyzeSession(sessionId1),
      this.analyzeSession(sessionId2)
    ]);

    if (analysis1.message || analysis2.message) {
      return {
        error: 'One or both sessions have no test data',
        session1: analysis1,
        session2: analysis2
      };
    }

    const comparison = {
      sessions: {
        session1: sessionId1,
        session2: sessionId2
      },
      metrics: {
        totalDuration: {
          session1: analysis1.metrics.totalDuration,
          session2: analysis2.metrics.totalDuration,
          change: analysis2.metrics.totalDuration - analysis1.metrics.totalDuration,
          changePercent: Math.round(((analysis2.metrics.totalDuration - analysis1.metrics.totalDuration) / analysis1.metrics.totalDuration) * 100)
        },
        averageDuration: {
          session1: analysis1.metrics.averageDuration,
          session2: analysis2.metrics.averageDuration,
          change: analysis2.metrics.averageDuration - analysis1.metrics.averageDuration,
          changePercent: Math.round(((analysis2.metrics.averageDuration - analysis1.metrics.averageDuration) / analysis1.metrics.averageDuration) * 100)
        }
      },
      bottlenecks: {
        slowTests: {
          session1: analysis1.bottlenecks.slowTests.length,
          session2: analysis2.bottlenecks.slowTests.length,
          change: analysis2.bottlenecks.slowTests.length - analysis1.bottlenecks.slowTests.length
        }
      },
      summary: this.generateComparisonSummary(analysis1, analysis2)
    };

    return comparison;
  }

  /**
   * Generate comparison summary
   */
  generateComparisonSummary(analysis1, analysis2) {
    const avgChange = analysis2.metrics.averageDuration - analysis1.metrics.averageDuration;
    const avgChangePercent = Math.round((avgChange / analysis1.metrics.averageDuration) * 100);

    let trend = 'stable';
    let message = '';

    if (avgChangePercent > 10) {
      trend = 'degraded';
      message = `Performance degraded by ${avgChangePercent}%`;
    } else if (avgChangePercent < -10) {
      trend = 'improved';
      message = `Performance improved by ${Math.abs(avgChangePercent)}%`;
    } else {
      message = 'Performance remained stable';
    }

    return {
      trend,
      message,
      avgChangePercent
    };
  }
}
