/**
 * Error Pattern Recognition Module
 * Analyzes test errors to identify patterns, common issues, and provide intelligent suggestions
 */

export class ErrorPatternAnalyzer {
  constructor(jaw) {
    if (!jaw) {
      throw new Error('JAW instance is required');
    }
    this.jaw = jaw;
  }

  /**
   * Analyze error patterns for a session
   */
  async analyzeSession(sessionId) {
    const errors = await this.jaw.getErrorsByType('assertion');
    const runtimeErrors = await this.jaw.getErrorsByType('runtime');
    const timeoutErrors = await this.jaw.getErrorsByType('timeout');
    
    const allErrors = [...errors, ...runtimeErrors, ...timeoutErrors];
    
    if (allErrors.length === 0) {
      return {
        message: 'No errors found for this session',
        sessionId
      };
    }

    const patterns = this.identifyPatterns(allErrors);
    const categories = this.categorizeErrors(allErrors);
    const suggestions = this.generateSuggestions(patterns, categories);
    const trends = this.analyzeTrends(allErrors);

    return {
      sessionId,
      totalErrors: allErrors.length,
      patterns,
      categories,
      suggestions,
      trends,
      summary: this.generateSummary(patterns, categories)
    };
  }

  /**
   * Identify common error patterns
   */
  identifyPatterns(errors) {
    const patterns = {
      commonMessages: this.findCommonMessages(errors),
      stackTracePatterns: this.analyzeStackTraces(errors),
      filePatterns: this.analyzeFilePatterns(errors),
      timePatterns: this.analyzeTimePatterns(errors),
      similarityGroups: this.groupSimilarErrors(errors)
    };

    return patterns;
  }

  /**
   * Find most common error messages
   */
  findCommonMessages(errors) {
    const messageFrequency = {};
    
    errors.forEach(error => {
      // Normalize error message by removing specific values
      const normalizedMessage = this.normalizeErrorMessage(error.message);
      messageFrequency[normalizedMessage] = (messageFrequency[normalizedMessage] || 0) + 1;
    });

    return Object.entries(messageFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([message, count]) => ({
        message,
        count,
        percentage: Math.round((count / errors.length) * 100),
        examples: errors
          .filter(e => this.normalizeErrorMessage(e.message) === message)
          .slice(0, 3)
          .map(e => e.message)
      }));
  }

  /**
   * Normalize error message for pattern matching
   */
  normalizeErrorMessage(message) {
    if (!message || typeof message !== 'string') {
      return 'UNKNOWN_MESSAGE';
    }
    
    return message
      // Replace numbers with placeholder
      .replace(/\d+/g, 'NUMBER')
      // Replace quoted strings with placeholder
      .replace(/"[^"]*"/g, 'STRING')
      // Replace file paths with placeholder
      .replace(/\/[^\s]+/g, 'PATH')
      // Replace specific variable names but keep common words
      .replace(/\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*[=\(\)])/g, 'VARIABLE')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Analyze stack trace patterns
   */
  analyzeStackTraces(errors) {
    const stackPatterns = {};
    
    errors.forEach(error => {
      if (error.stackTrace && error.stackTrace.length > 0) {
        // Get the top few frames of the stack trace
        const topFrames = error.stackTrace
          .slice(0, 3)
          .map(frame => frame.function || frame.file || 'unknown')
          .join(' -> ');
        
        stackPatterns[topFrames] = (stackPatterns[topFrames] || 0) + 1;
      }
    });

    return Object.entries(stackPatterns)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([pattern, count]) => ({
        pattern,
        count,
        percentage: Math.round((count / errors.length) * 100)
      }));
  }

  /**
   * Analyze file patterns where errors occur
   */
  analyzeFilePatterns(errors) {
    const fileFrequency = {};
    
    errors.forEach(error => {
      if (error.location && error.location.file) {
        const file = error.location.file;
        fileFrequency[file] = (fileFrequency[file] || 0) + 1;
      }
    });

    return Object.entries(fileFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([file, count]) => ({
        file,
        count,
        percentage: Math.round((count / errors.length) * 100)
      }));
  }

  /**
   * Analyze time patterns of errors
   */
  analyzeTimePatterns(errors) {
    const hourFrequency = {};
    const dayFrequency = {};
    
    errors.forEach(error => {
      if (error.timestamp) {
        const date = new Date(error.timestamp);
        const hour = date.getHours();
        const day = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        hourFrequency[hour] = (hourFrequency[hour] || 0) + 1;
        dayFrequency[day] = (dayFrequency[day] || 0) + 1;
      }
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    return {
      byHour: Object.entries(hourFrequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([hour, count]) => ({
          hour: parseInt(hour),
          count,
          percentage: Math.round((count / errors.length) * 100)
        })),
      byDay: Object.entries(dayFrequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([day, count]) => ({
          day: dayNames[parseInt(day)],
          count,
          percentage: Math.round((count / errors.length) * 100)
        }))
    };
  }

  /**
   * Group similar errors together
   */
  groupSimilarErrors(errors) {
    const groups = [];
    const processed = new Set();
    
    errors.forEach((error, index) => {
      if (processed.has(index)) return;
      
      const similarErrors = [error];
      const normalizedMessage = this.normalizeErrorMessage(error.message);
      
      // Find similar errors
      errors.forEach((otherError, otherIndex) => {
        if (otherIndex !== index && !processed.has(otherIndex)) {
          const otherNormalized = this.normalizeErrorMessage(otherError.message);
          
          if (this.calculateSimilarity(normalizedMessage, otherNormalized) > 0.8) {
            similarErrors.push(otherError);
            processed.add(otherIndex);
          }
        }
      });
      
      if (similarErrors.length > 1) {
        groups.push({
          pattern: normalizedMessage,
          count: similarErrors.length,
          errors: similarErrors.slice(0, 5), // Limit examples
          percentage: Math.round((similarErrors.length / errors.length) * 100)
        });
      }
      
      processed.add(index);
    });

    return groups.sort((a, b) => b.count - a.count).slice(0, 5);
  }

  /**
   * Calculate similarity between two strings
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Categorize errors by type and characteristics
   */
  categorizeErrors(errors) {
    const categories = {
      byType: this.categorizeByType(errors),
      bySeverity: this.categorizeBySeverity(errors),
      byFrequency: this.categorizeByFrequency(errors),
      byLocation: this.categorizeByLocation(errors)
    };

    return categories;
  }

  /**
   * Categorize errors by type
   */
  categorizeByType(errors) {
    const types = {};
    
    errors.forEach(error => {
      const type = error.type || 'unknown';
      if (!types[type]) {
        types[type] = { count: 0, errors: [] };
      }
      types[type].count++;
      types[type].errors.push(error);
    });

    return Object.entries(types)
      .map(([type, data]) => ({
        type,
        count: data.count,
        percentage: Math.round((data.count / errors.length) * 100),
        examples: data.errors.slice(0, 3)
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Categorize errors by severity
   */
  categorizeBySeverity(errors) {
    const severityKeywords = {
      critical: ['cannot read property', 'undefined is not a function', 'maximum call stack', 'out of memory'],
      high: ['assertion failed', 'expected', 'timeout', 'network error'],
      medium: ['warning', 'deprecated', 'missing'],
      low: ['style', 'format', 'lint']
    };

    const severities = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
    
    errors.forEach(error => {
      const message = error.message.toLowerCase();
      let categorized = false;
      
      for (const [severity, keywords] of Object.entries(severityKeywords)) {
        if (keywords.some(keyword => message.includes(keyword))) {
          severities[severity]++;
          categorized = true;
          break;
        }
      }
      
      if (!categorized) {
        severities.unknown++;
      }
    });

    return Object.entries(severities)
      .map(([severity, count]) => ({
        severity,
        count,
        percentage: Math.round((count / errors.length) * 100)
      }))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Categorize errors by frequency
   */
  categorizeByFrequency(errors) {
    const messageFreq = {};
    
    errors.forEach(error => {
      const key = error.message.substring(0, 100); // First 100 chars
      messageFreq[key] = (messageFreq[key] || 0) + 1;
    });

    const frequencies = Object.values(messageFreq);
    const total = frequencies.length;
    
    return {
      frequent: frequencies.filter(f => f >= 5).length,
      occasional: frequencies.filter(f => f >= 2 && f < 5).length,
      rare: frequencies.filter(f => f === 1).length,
      uniqueMessages: total,
      repetitionRate: Math.round(((total - frequencies.filter(f => f === 1).length) / total) * 100)
    };
  }

  /**
   * Categorize errors by location
   */
  categorizeByLocation(errors) {
    const locations = {
      testFiles: 0,
      sourceFiles: 0,
      nodeModules: 0,
      unknown: 0
    };
    
    errors.forEach(error => {
      if (error.location && error.location.file) {
        const file = error.location.file;
        if (file.includes('.test.') || file.includes('.spec.')) {
          locations.testFiles++;
        } else if (file.includes('node_modules')) {
          locations.nodeModules++;
        } else if (file.includes('/src/') || file.includes('/lib/')) {
          locations.sourceFiles++;
        } else {
          locations.unknown++;
        }
      } else {
        locations.unknown++;
      }
    });

    return Object.entries(locations)
      .map(([location, count]) => ({
        location,
        count,
        percentage: Math.round((count / errors.length) * 100)
      }))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Analyze error trends over time
   */
  analyzeTrends(errors) {
    if (errors.length < 2) {
      return { message: 'Insufficient data for trend analysis' };
    }

    // Sort errors by timestamp
    const sortedErrors = errors
      .filter(e => e.timestamp)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (sortedErrors.length < 2) {
      return { message: 'Insufficient timestamped data for trend analysis' };
    }

    const timeSpan = new Date(sortedErrors[sortedErrors.length - 1].timestamp) - new Date(sortedErrors[0].timestamp);
    const intervals = Math.min(10, Math.max(2, Math.floor(sortedErrors.length / 5)));
    const intervalSize = timeSpan / intervals;

    const buckets = Array(intervals).fill(0);
    
    sortedErrors.forEach(error => {
      const errorTime = new Date(error.timestamp) - new Date(sortedErrors[0].timestamp);
      const bucketIndex = Math.min(intervals - 1, Math.floor(errorTime / intervalSize));
      buckets[bucketIndex]++;
    });

    // Calculate trend direction
    const firstHalf = buckets.slice(0, Math.floor(intervals / 2));
    const secondHalf = buckets.slice(Math.floor(intervals / 2));
    
    const firstAvg = firstHalf.reduce((sum, count) => sum + count, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, count) => sum + count, 0) / secondHalf.length;
    
    let trend = 'stable';
    const changePercent = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
    
    if (changePercent > 20) {
      trend = 'increasing';
    } else if (changePercent < -20) {
      trend = 'decreasing';
    }

    return {
      trend,
      changePercent: Math.round(changePercent),
      distribution: buckets,
      timeSpan: Math.round(timeSpan / (1000 * 60 * 60)), // hours
      totalErrors: sortedErrors.length
    };
  }

  /**
   * Generate intelligent suggestions based on patterns
   */
  generateSuggestions(patterns, categories) {
    const suggestions = [];

    // Suggestions based on common messages
    if (patterns.commonMessages.length > 0) {
      const topMessage = patterns.commonMessages[0];
      if (topMessage.percentage > 30) {
        suggestions.push({
          type: 'common_error',
          priority: 'high',
          title: 'Address Most Common Error',
          description: `${topMessage.percentage}% of errors have the same pattern: "${topMessage.message}"`,
          suggestion: this.generateSpecificSuggestion(topMessage.message),
          impact: 'high'
        });
      }
    }

    // Suggestions based on file patterns
    if (patterns.filePatterns.length > 0) {
      const topFile = patterns.filePatterns[0];
      if (topFile.percentage > 40) {
        suggestions.push({
          type: 'file_hotspot',
          priority: 'medium',
          title: 'Error Hotspot Detected',
          description: `${topFile.percentage}% of errors occur in ${topFile.file}`,
          suggestion: 'Review and refactor this file to improve test reliability',
          impact: 'medium'
        });
      }
    }

    // Suggestions based on error types
    const criticalErrors = categories.bySeverity.find(s => s.severity === 'critical');
    if (criticalErrors && criticalErrors.percentage > 20) {
      suggestions.push({
        type: 'critical_errors',
        priority: 'high',
        title: 'Critical Errors Need Immediate Attention',
        description: `${criticalErrors.percentage}% of errors are critical`,
        suggestion: 'Focus on fixing critical errors first as they likely indicate fundamental issues',
        impact: 'high'
      });
    }

    // Suggestions based on similarity groups
    if (patterns.similarityGroups.length > 0) {
      const largestGroup = patterns.similarityGroups[0];
      if (largestGroup.percentage > 25) {
        suggestions.push({
          type: 'similar_errors',
          priority: 'medium',
          title: 'Similar Errors Detected',
          description: `${largestGroup.percentage}% of errors follow the same pattern`,
          suggestion: 'These similar errors likely have a common root cause that can be fixed together',
          impact: 'medium'
        });
      }
    }

    // Suggestions based on repetition rate
    if (categories.byFrequency.repetitionRate > 60) {
      suggestions.push({
        type: 'repetitive_errors',
        priority: 'medium',
        title: 'High Error Repetition Rate',
        description: `${categories.byFrequency.repetitionRate}% of errors are repetitive`,
        suggestion: 'Focus on fixing the most frequent errors to maximize impact',
        impact: 'medium'
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Generate specific suggestion based on error message
   */
  generateSpecificSuggestion(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('cannot read property') || lowerMessage.includes('undefined')) {
      return 'Check for null/undefined values before accessing properties. Consider using optional chaining (?.) or null checks.';
    }
    
    if (lowerMessage.includes('expected') && lowerMessage.includes('received')) {
      return 'Review test assertions. Ensure expected values match actual implementation behavior.';
    }
    
    if (lowerMessage.includes('timeout')) {
      return 'Increase timeout values or optimize async operations. Consider using waitFor utilities for dynamic content.';
    }
    
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
      return 'Mock network requests in tests to avoid external dependencies and improve test reliability.';
    }
    
    if (lowerMessage.includes('not a function')) {
      return 'Verify that the imported module exports the expected function. Check import/export statements.';
    }
    
    return 'Review the error context and stack trace to identify the root cause.';
  }

  /**
   * Generate summary of error analysis
   */
  generateSummary(patterns, categories) {
    const topErrorType = categories.byType[0];
    const criticalCount = categories.bySeverity.find(s => s.severity === 'critical')?.count || 0;
    const repetitionRate = categories.byFrequency.repetitionRate;
    
    let status = 'good';
    const issues = [];
    
    if (criticalCount > 0) {
      status = 'poor';
      issues.push(`${criticalCount} critical errors detected`);
    }
    
    if (repetitionRate > 70) {
      status = status === 'good' ? 'fair' : status;
      issues.push('High error repetition rate');
    }
    
    if (patterns.commonMessages.length > 0 && patterns.commonMessages[0].percentage > 50) {
      status = status === 'good' ? 'fair' : status;
      issues.push('Single error pattern dominates');
    }

    return {
      status,
      issues,
      dominantErrorType: topErrorType?.type || 'unknown',
      repetitionRate,
      message: this.generateSummaryMessage(status, issues, topErrorType)
    };
  }

  /**
   * Generate summary message
   */
  generateSummaryMessage(status, issues, topErrorType) {
    switch (status) {
      case 'good':
        return `Error patterns are diverse and manageable. Most common type: ${topErrorType?.type || 'unknown'}`;
      case 'fair':
        return `Error patterns show some concerning trends: ${issues.join(', ')}`;
      case 'poor':
        return `Error patterns indicate serious issues: ${issues.join(', ')}`;
      default:
        return 'Error pattern analysis completed';
    }
  }

  /**
   * Compare error patterns between sessions
   */
  async compareSessions(sessionId1, sessionId2) {
    const [analysis1, analysis2] = await Promise.all([
      this.analyzeSession(sessionId1),
      this.analyzeSession(sessionId2)
    ]);

    if (analysis1.message || analysis2.message) {
      return {
        error: 'One or both sessions have no error data',
        session1: analysis1,
        session2: analysis2
      };
    }

    const comparison = {
      sessions: {
        session1: sessionId1,
        session2: sessionId2
      },
      errorCounts: {
        session1: analysis1.totalErrors,
        session2: analysis2.totalErrors,
        change: analysis2.totalErrors - analysis1.totalErrors,
        changePercent: analysis1.totalErrors > 0 ? 
          Math.round(((analysis2.totalErrors - analysis1.totalErrors) / analysis1.totalErrors) * 100) : 0
      },
      patternChanges: this.comparePatterns(analysis1.patterns, analysis2.patterns),
      summary: this.generateComparisonSummary(analysis1, analysis2)
    };

    return comparison;
  }

  /**
   * Compare patterns between two analyses
   */
  comparePatterns(patterns1, patterns2) {
    const changes = {
      newPatterns: [],
      resolvedPatterns: [],
      persistentPatterns: []
    };

    const messages1 = new Set(patterns1.commonMessages.map(m => m.message));
    const messages2 = new Set(patterns2.commonMessages.map(m => m.message));

    // Find new patterns
    patterns2.commonMessages.forEach(pattern => {
      if (!messages1.has(pattern.message)) {
        changes.newPatterns.push(pattern);
      }
    });

    // Find resolved patterns
    patterns1.commonMessages.forEach(pattern => {
      if (!messages2.has(pattern.message)) {
        changes.resolvedPatterns.push(pattern);
      }
    });

    // Find persistent patterns
    patterns1.commonMessages.forEach(pattern1 => {
      const pattern2 = patterns2.commonMessages.find(p => p.message === pattern1.message);
      if (pattern2) {
        changes.persistentPatterns.push({
          message: pattern1.message,
          countChange: pattern2.count - pattern1.count,
          percentageChange: pattern2.percentage - pattern1.percentage
        });
      }
    });

    return changes;
  }

  /**
   * Generate comparison summary
   */
  generateComparisonSummary(analysis1, analysis2) {
    const errorChange = analysis2.totalErrors - analysis1.totalErrors;
    const errorChangePercent = analysis1.totalErrors > 0 ? 
      Math.round((errorChange / analysis1.totalErrors) * 100) : 0;

    let trend = 'stable';
    let message = '';

    if (errorChangePercent > 20) {
      trend = 'worsening';
      message = `Error patterns worsened by ${errorChangePercent}%`;
    } else if (errorChangePercent < -20) {
      trend = 'improving';
      message = `Error patterns improved by ${Math.abs(errorChangePercent)}%`;
    } else {
      message = 'Error patterns remained relatively stable';
    }

    return {
      trend,
      message,
      errorChangePercent
    };
  }
}
