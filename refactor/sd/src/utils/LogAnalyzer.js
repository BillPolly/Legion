/**
 * LogAnalyzer - Analyzes captured logs for patterns, errors, and performance issues
 * 
 * Provides utilities for analyzing logs captured by LiveTestingAgent
 */

export class LogAnalyzer {
  constructor() {
    this.logs = [];
    this.correlationTraces = new Map();
    this.errorPatterns = new Map();
    this.performanceMetrics = {};
  }

  /**
   * Add logs for analysis
   */
  addLogs(logs) {
    this.logs.push(...logs);
    this.processLogs(logs);
  }

  /**
   * Process logs to extract correlation traces and patterns
   */
  processLogs(logs) {
    logs.forEach(log => {
      // Extract correlation ID
      const correlationId = this.extractCorrelationId(log.message);
      if (correlationId) {
        if (!this.correlationTraces.has(correlationId)) {
          this.correlationTraces.set(correlationId, []);
        }
        this.correlationTraces.get(correlationId).push(log);
      }

      // Track error patterns
      if (log.type === 'error' || log.type === 'uncaught' || log.type === 'unhandled') {
        const pattern = this.extractErrorPattern(log.message || log.error);
        if (pattern) {
          this.errorPatterns.set(pattern, (this.errorPatterns.get(pattern) || 0) + 1);
        }
      }

      // Extract performance metrics
      this.extractPerformanceMetrics(log);
    });
  }

  /**
   * Extract correlation ID from log message
   */
  extractCorrelationId(message) {
    if (!message) return null;
    
    // Try various correlation ID patterns
    const patterns = [
      /correlation[_-]?id[:\s]+([a-zA-Z0-9-]+)/i,
      /x-correlation-id[:\s]+([a-zA-Z0-9-]+)/i,
      /trace[_-]?id[:\s]+([a-zA-Z0-9-]+)/i,
      /request[_-]?id[:\s]+([a-zA-Z0-9-]+)/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Extract error pattern from message
   */
  extractErrorPattern(message) {
    if (!message) return null;
    
    const patterns = [
      /Cannot read prop[a-z]* ['"](\w+)['"] of (undefined|null)/,
      /(\w+) is not a function/,
      /(\w+) is not defined/,
      /Unexpected token (\w+)/,
      /Maximum call stack size exceeded/,
      /Connection refused/,
      /ENOENT: no such file or directory/,
      /TypeError: .+/,
      /ReferenceError: .+/,
      /SyntaxError: .+/
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[0];
      }
    }
    
    // Return first line if no pattern matches
    return message.split('\n')[0].substring(0, 100);
  }

  /**
   * Extract performance metrics from logs
   */
  extractPerformanceMetrics(log) {
    if (!log.message) return;

    // Extract response time from HTTP logs
    const responseTimeMatch = log.message.match(/\((\d+(?:\.\d+)?)ms\)/);
    if (responseTimeMatch) {
      const responseTime = parseFloat(responseTimeMatch[1]);
      if (!this.performanceMetrics.responseTimes) {
        this.performanceMetrics.responseTimes = [];
      }
      this.performanceMetrics.responseTimes.push(responseTime);
    }

    // Extract status codes
    const statusMatch = log.message.match(/status[:\s]+(\d{3})/i);
    if (statusMatch) {
      const status = statusMatch[1];
      if (!this.performanceMetrics.statusCodes) {
        this.performanceMetrics.statusCodes = {};
      }
      this.performanceMetrics.statusCodes[status] = (this.performanceMetrics.statusCodes[status] || 0) + 1;
    }
  }

  /**
   * Get trace for a specific correlation ID
   */
  getTrace(correlationId) {
    const trace = this.correlationTraces.get(correlationId);
    if (!trace || trace.length === 0) {
      return null;
    }

    const startTime = trace[0].timestamp;
    const endTime = trace[trace.length - 1].timestamp;
    const duration = endTime - startTime;

    return {
      correlationId,
      events: trace.length,
      duration,
      startTime,
      endTime,
      timeline: trace.map(log => ({
        relativeTime: log.timestamp - startTime,
        type: log.type,
        message: log.message,
        timestamp: log.timestamp
      }))
    };
  }

  /**
   * Analyze request flow for a correlation ID
   */
  analyzeRequestFlow(correlationId) {
    const trace = this.getTrace(correlationId);
    if (!trace) {
      return null;
    }

    const flow = {
      correlationId,
      duration: trace.duration,
      steps: [],
      layers: {
        frontend: [],
        backend: [],
        database: []
      }
    };

    trace.timeline.forEach(event => {
      // Categorize by layer
      if (event.message.includes('UI') || event.message.includes('frontend') || event.message.includes('click')) {
        flow.layers.frontend.push(event);
      } else if (event.message.includes('API') || event.message.includes('/api/') || event.message.includes('endpoint')) {
        flow.layers.backend.push(event);
      } else if (event.message.includes('database') || event.message.includes('DB') || event.message.includes('query')) {
        flow.layers.database.push(event);
      }

      // Extract key steps
      if (event.message.match(/request|response|error|complete/i)) {
        flow.steps.push({
          time: event.relativeTime,
          message: event.message.substring(0, 100)
        });
      }
    });

    return flow;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const summary = {
      totalLogs: this.logs.length,
      errors: this.logs.filter(l => l.type === 'error').length,
      warnings: this.logs.filter(l => l.type === 'warn').length
    };

    // Response time statistics
    if (this.performanceMetrics.responseTimes && this.performanceMetrics.responseTimes.length > 0) {
      const times = this.performanceMetrics.responseTimes;
      times.sort((a, b) => a - b);
      
      summary.responseTime = {
        min: Math.min(...times),
        max: Math.max(...times),
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        median: times[Math.floor(times.length / 2)],
        p95: times[Math.floor(times.length * 0.95)],
        p99: times[Math.floor(times.length * 0.99)]
      };
    }

    // Status code distribution
    if (this.performanceMetrics.statusCodes) {
      summary.statusCodes = this.performanceMetrics.statusCodes;
      summary.errorRate = Object.entries(this.performanceMetrics.statusCodes)
        .filter(([code]) => code >= '400')
        .reduce((sum, [, count]) => sum + count, 0) / 
        Object.values(this.performanceMetrics.statusCodes)
        .reduce((sum, count) => sum + count, 0);
    }

    // Error patterns
    if (this.errorPatterns.size > 0) {
      summary.topErrors = Array.from(this.errorPatterns.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([pattern, count]) => ({ pattern, count }));
    }

    return summary;
  }

  /**
   * Generate trace diagram (text-based)
   */
  generateTraceDiagram(correlationId) {
    const flow = this.analyzeRequestFlow(correlationId);
    if (!flow) {
      return 'No trace found for correlation ID: ' + correlationId;
    }

    let diagram = `\nTrace Diagram for ${correlationId}\n`;
    diagram += `Duration: ${flow.duration}ms\n`;
    diagram += '═'.repeat(60) + '\n\n';
    
    diagram += 'Frontend        Backend         Database\n';
    diagram += '────────        ────────        ────────\n';
    
    const maxTime = Math.max(
      ...flow.layers.frontend.map(e => e.relativeTime),
      ...flow.layers.backend.map(e => e.relativeTime),
      ...flow.layers.database.map(e => e.relativeTime),
      0
    );

    // Create timeline
    for (let t = 0; t <= maxTime; t += Math.ceil(maxTime / 20)) {
      let line = '';
      
      // Check frontend events
      const frontendEvent = flow.layers.frontend.find(e => 
        Math.abs(e.relativeTime - t) < maxTime / 40
      );
      line += frontendEvent ? '●' : '│';
      line += ' '.repeat(15);
      
      // Check backend events
      const backendEvent = flow.layers.backend.find(e => 
        Math.abs(e.relativeTime - t) < maxTime / 40
      );
      line += backendEvent ? '●' : '│';
      line += ' '.repeat(15);
      
      // Check database events
      const dbEvent = flow.layers.database.find(e => 
        Math.abs(e.relativeTime - t) < maxTime / 40
      );
      line += dbEvent ? '●' : '│';
      
      // Add time marker
      line += `  ${t}ms`;
      
      // Add event description if present
      const event = frontendEvent || backendEvent || dbEvent;
      if (event) {
        line += ` - ${event.message.substring(0, 40)}...`;
      }
      
      diagram += line + '\n';
    }

    return diagram;
  }

  /**
   * Identify bottlenecks in traces
   */
  identifyBottlenecks() {
    const bottlenecks = [];
    
    this.correlationTraces.forEach((trace, correlationId) => {
      if (trace.length < 2) return;
      
      const duration = trace[trace.length - 1].timestamp - trace[0].timestamp;
      
      // Find slow operations (> 100ms between events)
      for (let i = 1; i < trace.length; i++) {
        const gap = trace[i].timestamp - trace[i - 1].timestamp;
        if (gap > 100) {
          bottlenecks.push({
            correlationId,
            between: [trace[i - 1].message, trace[i].message],
            duration: gap,
            severity: gap > 500 ? 'critical' : gap > 200 ? 'high' : 'medium'
          });
        }
      }
      
      // Check overall request duration
      if (duration > 1000) {
        bottlenecks.push({
          correlationId,
          type: 'slow_request',
          duration,
          severity: duration > 5000 ? 'critical' : duration > 2000 ? 'high' : 'medium'
        });
      }
    });
    
    return bottlenecks.sort((a, b) => b.duration - a.duration);
  }

  /**
   * Get health status based on logs
   */
  getHealthStatus() {
    const errors = this.logs.filter(l => l.type === 'error' || l.type === 'uncaught').length;
    const warnings = this.logs.filter(l => l.type === 'warn').length;
    const totalLogs = this.logs.length;
    
    const errorRate = totalLogs > 0 ? errors / totalLogs : 0;
    const warningRate = totalLogs > 0 ? warnings / totalLogs : 0;
    
    let status = 'healthy';
    let score = 100;
    
    // Deduct points for errors and warnings
    score -= errors * 10;
    score -= warnings * 2;
    
    // Deduct for high error rate
    if (errorRate > 0.1) {
      score -= 30;
      status = 'degraded';
    } else if (errorRate > 0.05) {
      score -= 15;
      status = 'degraded';
    }
    
    // Check for critical errors
    const criticalErrors = Array.from(this.errorPatterns.keys()).filter(pattern =>
      pattern.includes('Maximum call stack') ||
      pattern.includes('Connection refused') ||
      pattern.includes('ENOENT')
    );
    
    if (criticalErrors.length > 0) {
      score -= 25;
      status = 'critical';
    }
    
    // Check performance
    if (this.performanceMetrics.responseTimes) {
      const avgResponseTime = this.performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / 
                             this.performanceMetrics.responseTimes.length;
      if (avgResponseTime > 1000) {
        score -= 10;
        if (status === 'healthy') status = 'degraded';
      }
    }
    
    return {
      status,
      score: Math.max(0, score),
      metrics: {
        errorRate,
        warningRate,
        totalLogs,
        errors,
        warnings,
        correlationTraces: this.correlationTraces.size
      }
    };
  }

  /**
   * Generate comprehensive analysis report
   */
  generateReport() {
    const report = {
      summary: this.getPerformanceSummary(),
      health: this.getHealthStatus(),
      bottlenecks: this.identifyBottlenecks().slice(0, 5),
      correlationTraces: {
        total: this.correlationTraces.size,
        traces: Array.from(this.correlationTraces.keys()).slice(0, 10)
      }
    };

    return report;
  }

  /**
   * Clear all data
   */
  clear() {
    this.logs = [];
    this.correlationTraces.clear();
    this.errorPatterns.clear();
    this.performanceMetrics = {};
  }
}