/**
 * PerformanceProfiler - Advanced performance monitoring and profiling for TreeScribe
 * 
 * Provides detailed performance metrics, bottleneck detection, and optimization suggestions
 * for all TreeScribe operations including parsing, rendering, and user interactions.
 */

export class PerformanceProfiler {
  constructor(options = {}) {
    this.options = {
      enableProfiling: true,
      enableMetrics: true,
      enableTrace: false, // Detailed tracing (can be memory intensive)
      maxMetrics: 1000,
      maxTraces: 100,
      samplingRate: 1.0, // 1.0 = 100% sampling
      warningThresholds: {
        parseTime: 1000, // 1 second
        renderTime: 100, // 100ms
        memoryUsage: 50 * 1024 * 1024, // 50MB
        nodeCount: 10000
      },
      ...options
    };

    this.enabled = this.options.enableProfiling;
    this.destroyed = false;
    
    // Active sessions
    this.activeSessions = new Map();
    this.sessionId = 0;
    
    // Metrics storage
    this.metrics = {
      parsing: [],
      rendering: [],
      interactions: [],
      memory: [],
      timing: []
    };
    
    // Performance marks and measures
    this.marks = new Map();
    this.measures = new Map();
    
    // Trace data
    this.traces = [];
    
    // Real-time monitoring
    this.observers = {
      performance: null,
      memory: null,
      mutation: null
    };
    
    // Callbacks
    this.callbacks = {
      warning: [],
      metric: [],
      session: [],
      trace: []
    };
    
    // Initialize performance observer
    this._initializeObservers();
    
    // Start memory monitoring
    this._startMemoryMonitoring();
  }

  /**
   * Start profiling session
   */
  startSession(name, metadata = {}) {
    if (!this.enabled) return null;
    
    const sessionId = ++this.sessionId;
    const session = {
      id: sessionId,
      name,
      metadata,
      startTime: performance.now(),
      startMemory: this._getMemoryUsage(),
      marks: [],
      measures: [],
      warnings: [],
      completed: false
    };
    
    this.activeSessions.set(sessionId, session);
    this._mark(`session-${sessionId}-start`);
    
    this._notifySession('start', session);
    
    return sessionId;
  }

  /**
   * End profiling session
   */
  endSession(sessionId) {
    if (!this.enabled) return null;
    
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;
    
    const endTime = performance.now();
    const endMemory = this._getMemoryUsage();
    
    session.endTime = endTime;
    session.endMemory = endMemory;
    session.duration = endTime - session.startTime;
    session.memoryDelta = endMemory - session.startMemory;
    session.completed = true;
    
    this._mark(`session-${sessionId}-end`);
    this._measure(`session-${sessionId}`, `session-${sessionId}-start`, `session-${sessionId}-end`);
    
    // Store session metrics
    this._storeMetric('timing', {
      sessionId: session.id,
      name: session.name,
      duration: session.duration,
      memoryDelta: session.memoryDelta,
      timestamp: session.startTime
    });
    
    // Check for warnings
    this._checkSessionWarnings(session);
    
    this.activeSessions.delete(sessionId);
    this._notifySession('end', session);
    
    return session;
  }

  /**
   * Add mark to current session
   */
  mark(sessionId, name, metadata = {}) {
    if (!this.enabled) return;
    
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    const markName = `session-${sessionId}-${name}`;
    const timestamp = performance.now();
    
    this._mark(markName);
    
    const mark = {
      name,
      markName,
      timestamp,
      relativeTime: timestamp - session.startTime,
      metadata
    };
    
    session.marks.push(mark);
    
    if (this.options.enableTrace) {
      this._addTrace('mark', mark);
    }
  }

  /**
   * Add measure between two marks
   */
  measure(sessionId, name, startMark, endMark, metadata = {}) {
    if (!this.enabled) return;
    
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    const measureName = `session-${sessionId}-${name}`;
    const startMarkName = `session-${sessionId}-${startMark}`;
    const endMarkName = `session-${sessionId}-${endMark}`;
    
    const duration = this._measure(measureName, startMarkName, endMarkName);
    
    const measure = {
      name,
      measureName,
      startMark,
      endMark,
      duration,
      metadata
    };
    
    session.measures.push(measure);
    
    if (this.options.enableTrace) {
      this._addTrace('measure', measure);
    }
    
    return duration;
  }

  /**
   * Profile parsing operation
   */
  async profileParsing(sessionId, parseFunction, content, parser) {
    if (!this.enabled) {
      return await parseFunction();
    }
    
    this.mark(sessionId, 'parse-start', {
      contentSize: typeof content === 'string' ? content.length : 'unknown',
      parserName: parser?.getName?.() || 'unknown'
    });
    
    const startMemory = this._getMemoryUsage();
    const startTime = performance.now();
    
    try {
      const result = await parseFunction();
      
      const endTime = performance.now();
      const endMemory = this._getMemoryUsage();
      const duration = endTime - startTime;
      const memoryUsed = endMemory - startMemory;
      const nodeCount = this._countNodes(result);
      
      this.mark(sessionId, 'parse-end', {
        duration,
        memoryUsed,
        nodeCount,
        success: true
      });
      
      // Store parsing metrics
      const parseMetric = {
        timestamp: startTime,
        duration,
        memoryUsed,
        nodeCount,
        contentSize: typeof content === 'string' ? content.length : 0,
        parserName: parser?.getName?.() || 'unknown',
        success: true
      };
      
      this._storeMetric('parsing', parseMetric);
      
      // Check warnings
      this._checkParsingWarnings(parseMetric, sessionId);
      
      return result;
      
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.mark(sessionId, 'parse-error', {
        duration,
        error: error.message,
        success: false
      });
      
      // Store error metric
      this._storeMetric('parsing', {
        timestamp: startTime,
        duration,
        error: error.message,
        success: false
      });
      
      throw error;
    }
  }

  /**
   * Profile rendering operation
   */
  profileRendering(sessionId, renderFunction, nodeCount = 0) {
    if (!this.enabled) {
      return renderFunction();
    }
    
    this.mark(sessionId, 'render-start', { nodeCount });
    
    const startTime = performance.now();
    
    try {
      const result = renderFunction();
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.mark(sessionId, 'render-end', {
        duration,
        nodeCount,
        success: true
      });
      
      // Store rendering metrics
      const renderMetric = {
        timestamp: startTime,
        duration,
        nodeCount,
        success: true
      };
      
      this._storeMetric('rendering', renderMetric);
      
      // Check warnings
      this._checkRenderingWarnings(renderMetric, sessionId);
      
      return result;
      
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.mark(sessionId, 'render-error', {
        duration,
        error: error.message,
        success: false
      });
      
      throw error;
    }
  }

  /**
   * Profile user interaction
   */
  profileInteraction(sessionId, action, interactionFunction) {
    if (!this.enabled) {
      return interactionFunction();
    }
    
    this.mark(sessionId, `interaction-${action}-start`);
    
    const startTime = performance.now();
    
    try {
      const result = interactionFunction();
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.mark(sessionId, `interaction-${action}-end`, {
        action,
        duration,
        success: true
      });
      
      // Store interaction metrics
      this._storeMetric('interactions', {
        timestamp: startTime,
        action,
        duration,
        success: true
      });
      
      return result;
      
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.mark(sessionId, `interaction-${action}-error`, {
        action,
        duration,
        error: error.message,
        success: false
      });
      
      throw error;
    }
  }

  /**
   * Get performance summary
   */
  getSummary() {
    const summary = {
      activeSessions: this.activeSessions.size,
      totalMetrics: this._getTotalMetricCount(),
      averages: this._calculateAverages(),
      warnings: this._getWarningsSummary(),
      memory: this._getMemorySummary(),
      recommendations: this._getRecommendations()
    };
    
    return summary;
  }

  /**
   * Get detailed session report
   */
  getSessionReport(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;
    
    return {
      id: session.id,
      name: session.name,
      metadata: session.metadata,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.duration,
      memoryDelta: session.memoryDelta,
      marks: session.marks,
      measures: session.measures,
      warnings: session.warnings,
      timeline: this._buildTimeline(session),
      bottlenecks: this._identifyBottlenecks(session)
    };
  }

  /**
   * Get performance trends
   */
  getTrends(timeWindow = 300000) { // 5 minutes default
    const cutoff = Date.now() - timeWindow;
    
    const trends = {};
    
    Object.keys(this.metrics).forEach(category => {
      const recentMetrics = this.metrics[category].filter(m => 
        m.timestamp > cutoff
      );
      
      if (recentMetrics.length > 0) {
        trends[category] = {
          count: recentMetrics.length,
          averageDuration: this._average(recentMetrics.map(m => m.duration)),
          trend: this._calculateTrend(recentMetrics),
          issues: recentMetrics.filter(m => !m.success).length
        };
      }
    });
    
    return trends;
  }

  /**
   * Export performance data
   */
  exportData(format = 'json') {
    const data = {
      summary: this.getSummary(),
      metrics: this.metrics,
      traces: this.traces,
      activeSessionCount: this.activeSessions.size,
      exportTime: Date.now(),
      version: '1.0.0'
    };
    
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this._convertToCSV(data);
      default:
        return data;
    }
  }

  /**
   * Initialize performance observers
   * @private
   */
  _initializeObservers() {
    if (!this.enabled || typeof PerformanceObserver === 'undefined') return;
    
    try {
      // Performance timing observer
      this.observers.performance = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.name.startsWith('session-')) {
            this._processPerformanceEntry(entry);
          }
        });
      });
      
      this.observers.performance.observe({ 
        entryTypes: ['measure', 'mark'] 
      });
      
    } catch (error) {
      console.warn('Performance observer not supported:', error);
    }
  }

  /**
   * Start memory monitoring
   * @private  
   */
  _startMemoryMonitoring() {
    if (!this.enabled) return;
    
    const monitorMemory = () => {
      if (this.destroyed) return;
      
      const memoryInfo = this._getMemoryUsage();
      this._storeMetric('memory', {
        timestamp: Date.now(),
        ...memoryInfo
      });
      
      // Check memory warnings
      if (memoryInfo.used > this.options.warningThresholds.memoryUsage) {
        this._addWarning('memory', `High memory usage: ${Math.round(memoryInfo.used / 1024 / 1024)}MB`);
      }
      
      setTimeout(monitorMemory, 5000); // Every 5 seconds
    };
    
    setTimeout(monitorMemory, 1000);
  }

  /**
   * Get memory usage
   * @private
   */
  _getMemoryUsage() {
    if (typeof performance.memory !== 'undefined') {
      return {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      };
    }
    
    // Fallback estimation
    return {
      used: 0,
      total: 0,
      limit: 0
    };
  }

  /**
   * Add performance mark
   * @private
   */
  _mark(name) {
    try {
      performance.mark(name);
      this.marks.set(name, performance.now());
    } catch (error) {
      // Fallback
      this.marks.set(name, performance.now());
    }
  }

  /**
   * Add performance measure
   * @private
   */
  _measure(name, startMark, endMark) {
    try {
      performance.measure(name, startMark, endMark);
      const measure = performance.getEntriesByName(name, 'measure')[0];
      return measure ? measure.duration : 0;
    } catch (error) {
      // Fallback calculation
      const start = this.marks.get(startMark) || 0;
      const end = this.marks.get(endMark) || 0;
      return Math.max(0, end - start);
    }
  }

  /**
   * Store metric
   * @private
   */
  _storeMetric(category, metric) {
    if (!this.metrics[category]) {
      this.metrics[category] = [];
    }
    
    this.metrics[category].push(metric);
    
    // Trim if exceeding max
    if (this.metrics[category].length > this.options.maxMetrics) {
      this.metrics[category] = this.metrics[category].slice(-this.options.maxMetrics);
    }
    
    this._notifyMetric(category, metric);
  }

  /**
   * Add trace entry
   * @private
   */
  _addTrace(type, data) {
    if (!this.options.enableTrace) return;
    
    const trace = {
      type,
      timestamp: performance.now(),
      data,
      stackTrace: this._getStackTrace()
    };
    
    this.traces.push(trace);
    
    // Trim if exceeding max
    if (this.traces.length > this.options.maxTraces) {
      this.traces = this.traces.slice(-this.options.maxTraces);
    }
    
    this._notifyTrace(trace);
  }

  /**
   * Get stack trace
   * @private
   */
  _getStackTrace() {
    try {
      throw new Error();
    } catch (e) {
      return e.stack?.split('\n').slice(3, 8).join('\n') || '';
    }
  }

  /**
   * Count nodes in tree
   * @private
   */
  _countNodes(tree, count = 0) {
    if (!tree || typeof tree !== 'object') return count;
    
    count++;
    
    if (tree.children && Array.isArray(tree.children)) {
      for (const child of tree.children) {
        count = this._countNodes(child, count);
      }
    }
    
    return count;
  }

  /**
   * Check parsing warnings
   * @private
   */
  _checkParsingWarnings(metric, sessionId) {
    if (metric.duration > this.options.warningThresholds.parseTime) {
      this._addWarning('parsing', `Slow parsing: ${Math.round(metric.duration)}ms`, sessionId);
    }
    
    if (metric.nodeCount > this.options.warningThresholds.nodeCount) {
      this._addWarning('parsing', `Large document: ${metric.nodeCount} nodes`, sessionId);
    }
  }

  /**
   * Check rendering warnings
   * @private
   */
  _checkRenderingWarnings(metric, sessionId) {
    if (metric.duration > this.options.warningThresholds.renderTime) {
      this._addWarning('rendering', `Slow rendering: ${Math.round(metric.duration)}ms`, sessionId);
    }
  }

  /**
   * Add warning
   * @private
   */
  _addWarning(category, message, sessionId = null) {
    const warning = {
      category,
      message,
      timestamp: Date.now(),
      sessionId
    };
    
    if (sessionId) {
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.warnings.push(warning);
      }
    }
    
    this._notifyWarning(warning);
  }

  /**
   * Calculate averages
   * @private
   */
  _calculateAverages() {
    const averages = {};
    
    Object.keys(this.metrics).forEach(category => {
      const metrics = this.metrics[category];
      if (metrics.length > 0) {
        const durations = metrics.map(m => m.duration).filter(d => d !== undefined);
        averages[category] = {
          duration: this._average(durations),
          count: metrics.length
        };
      }
    });
    
    return averages;
  }

  /**
   * Calculate average
   * @private
   */
  _average(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  /**
   * Notify callbacks
   * @private
   */
  _notifyWarning(warning) {
    this.callbacks.warning.forEach(cb => {
      try {
        cb(warning);
      } catch (error) {
        console.error('Error in warning callback:', error);
      }
    });
  }

  _notifyMetric(category, metric) {
    this.callbacks.metric.forEach(cb => {
      try {
        cb(category, metric);
      } catch (error) {
        console.error('Error in metric callback:', error);
      }
    });
  }

  _notifySession(type, session) {
    this.callbacks.session.forEach(cb => {
      try {
        cb(type, session);
      } catch (error) {
        console.error('Error in session callback:', error);
      }
    });
  }

  _notifyTrace(trace) {
    this.callbacks.trace.forEach(cb => {
      try {
        cb(trace);
      } catch (error) {
        console.error('Error in trace callback:', error);
      }
    });
  }

  /**
   * Check session for warnings
   * @private
   */
  _checkSessionWarnings(session) {
    if (session.duration > this.options.warningThresholds.parseTime) {
      this._addWarning('performance', `Long session duration: ${Math.round(session.duration)}ms`, session.id);
    }
    
    if (session.memoryDelta > this.options.warningThresholds.memoryUsage) {
      this._addWarning('memory', `High memory usage: ${Math.round(session.memoryDelta / 1024 / 1024)}MB`, session.id);
    }
  }

  /**
   * Build timeline for session
   * @private
   */
  _buildTimeline(session) {
    const timeline = [];
    
    // Add marks to timeline
    session.marks.forEach(mark => {
      timeline.push({
        type: 'mark',
        name: mark.name,
        time: mark.relativeTime,
        metadata: mark.metadata
      });
    });
    
    // Add measures to timeline
    session.measures.forEach(measure => {
      timeline.push({
        type: 'measure',
        name: measure.name,
        duration: measure.duration,
        metadata: measure.metadata
      });
    });
    
    // Sort by time
    timeline.sort((a, b) => (a.time || 0) - (b.time || 0));
    
    return timeline;
  }

  /**
   * Identify bottlenecks in session
   * @private
   */
  _identifyBottlenecks(session) {
    const bottlenecks = [];
    
    // Find long-running measures
    session.measures.forEach(measure => {
      if (measure.duration > 100) {
        bottlenecks.push({
          type: 'slow-operation',
          name: measure.name,
          duration: measure.duration,
          severity: measure.duration > 1000 ? 'high' : 'medium'
        });
      }
    });
    
    // Find memory spikes
    if (session.memoryDelta > 10 * 1024 * 1024) { // 10MB
      bottlenecks.push({
        type: 'memory-spike',
        delta: session.memoryDelta,
        severity: session.memoryDelta > 50 * 1024 * 1024 ? 'high' : 'medium'
      });
    }
    
    return bottlenecks;
  }

  /**
   * Get total metric count
   * @private
   */
  _getTotalMetricCount() {
    return Object.values(this.metrics).reduce((total, metrics) => total + metrics.length, 0);
  }

  /**
   * Get warnings summary
   * @private
   */
  _getWarningsSummary() {
    const warnings = [];
    this.activeSessions.forEach(session => {
      warnings.push(...session.warnings);
    });
    
    return {
      total: warnings.length,
      categories: warnings.reduce((acc, warning) => {
        acc[warning.category] = (acc[warning.category] || 0) + 1;
        return acc;
      }, {})
    };
  }

  /**
   * Get memory summary
   * @private
   */
  _getMemorySummary() {
    const memoryMetrics = this.metrics.memory || [];
    if (memoryMetrics.length === 0) {
      return { current: 0, peak: 0, average: 0 };
    }
    
    const latest = memoryMetrics[memoryMetrics.length - 1];
    const peak = Math.max(...memoryMetrics.map(m => m.used || 0));
    const average = memoryMetrics.reduce((sum, m) => sum + (m.used || 0), 0) / memoryMetrics.length;
    
    return {
      current: latest.used || 0,
      peak,
      average
    };
  }

  /**
   * Get recommendations
   * @private
   */
  _getRecommendations() {
    const recommendations = [];
    const averages = this._calculateAverages();
    const memory = this._getMemorySummary();
    
    // Check for performance issues
    if (averages.parsing && averages.parsing.duration > 1000) {
      recommendations.push('Consider enabling streaming for large documents');
    }
    
    if (averages.rendering && averages.rendering.duration > 100) {
      recommendations.push('Consider virtual scrolling for large trees');
    }
    
    if (memory.current > 50 * 1024 * 1024) {
      recommendations.push('High memory usage - consider enabling compression');
    }
    
    return recommendations;
  }

  /**
   * Calculate trend
   * @private
   */
  _calculateTrend(metrics) {
    if (metrics.length < 2) return 'stable';
    
    const durations = metrics.map(m => m.duration).filter(d => d !== undefined);
    if (durations.length < 2) return 'stable';
    
    const firstHalf = durations.slice(0, Math.floor(durations.length / 2));
    const secondHalf = durations.slice(Math.floor(durations.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const change = (secondAvg - firstAvg) / firstAvg;
    
    if (change > 0.1) return 'degrading';
    if (change < -0.1) return 'improving';
    return 'stable';
  }

  /**
   * Convert to CSV
   * @private
   */
  _convertToCSV(data) {
    const rows = [];
    
    // Add headers
    rows.push('Category,Timestamp,Duration,Success,Details');
    
    // Add metrics
    Object.entries(data.metrics).forEach(([category, metrics]) => {
      metrics.forEach(metric => {
        rows.push([
          category,
          metric.timestamp,
          metric.duration || '',
          metric.success || '',
          JSON.stringify(metric).replace(/,/g, ';')
        ].join(','));
      });
    });
    
    return rows.join('\n');
  }

  /**
   * Process performance entry
   * @private
   */
  _processPerformanceEntry(entry) {
    // Store performance entry data
    this._storeMetric('timing', {
      name: entry.name,
      duration: entry.duration,
      startTime: entry.startTime,
      timestamp: Date.now()
    });
  }

  /**
   * Add callback methods
   */
  onWarning(callback) {
    this.callbacks.warning.push(callback);
    return () => {
      const index = this.callbacks.warning.indexOf(callback);
      if (index > -1) this.callbacks.warning.splice(index, 1);
    };
  }

  onMetric(callback) {
    this.callbacks.metric.push(callback);
    return () => {
      const index = this.callbacks.metric.indexOf(callback);
      if (index > -1) this.callbacks.metric.splice(index, 1);
    };
  }

  onSession(callback) {
    this.callbacks.session.push(callback);
    return () => {
      const index = this.callbacks.session.indexOf(callback);
      if (index > -1) this.callbacks.session.splice(index, 1);
    };
  }

  onTrace(callback) {
    this.callbacks.trace.push(callback);
    return () => {
      const index = this.callbacks.trace.indexOf(callback);
      if (index > -1) this.callbacks.trace.splice(index, 1);
    };
  }

  /**
   * Enable/disable profiling
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Clear all data
   */
  clear() {
    Object.keys(this.metrics).forEach(key => {
      this.metrics[key] = [];
    });
    this.traces = [];
    this.marks.clear();
    this.measures.clear();
  }

  /**
   * Destroy profiler
   */
  destroy() {
    if (this.destroyed) return;
    
    this.destroyed = true;
    
    // Stop observers
    Object.values(this.observers).forEach(observer => {
      if (observer) {
        try {
          observer.disconnect();
        } catch (e) {
          // Ignore
        }
      }
    });
    
    // Clear data
    this.clear();
    
    // Clear active sessions
    this.activeSessions.clear();
    
    // Clear callbacks
    Object.keys(this.callbacks).forEach(key => {
      this.callbacks[key] = [];
    });
  }
}