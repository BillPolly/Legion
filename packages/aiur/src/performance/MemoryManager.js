/**
 * Memory Manager
 * 
 * Tracks memory usage, detects leaks, provides optimization suggestions,
 * and handles memory pressure scenarios
 */

import { EventEmitter } from 'events';

export class MemoryManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      maxHeapSize: options.maxHeapSize || 1024 * 1024 * 1024, // 1GB
      gcThreshold: options.gcThreshold || 0.8,
      enableMonitoring: options.enableMonitoring !== false,
      leakDetectionWindow: options.leakDetectionWindow || 300000, // 5 minutes
      samplingInterval: options.samplingInterval || 10000, // 10 seconds
      ...options
    };

    // Memory tracking
    this.allocations = new Map(); // id -> { size, timestamp, type, stackTrace }
    this.memorySnapshots = [];
    this.gcEvents = [];

    // Current memory state
    this.currentUsage = {
      allocatedBytes: 0,
      allocationCount: 0,
      deallocatedBytes: 0,
      deallocationCount: 0
    };

    // Memory pressure state
    this.memoryPressure = 0;
    this.pressureHandlers = [];

    // Monitoring timer
    this.monitoringTimer = null;
    if (this.options.enableMonitoring) {
      this._startMonitoring();
    }
  }

  /**
   * Track memory allocation
   */
  trackAllocation(id, size, type = 'unknown', stackTrace = null) {
    const allocation = {
      id,
      size,
      type,
      timestamp: Date.now(),
      stackTrace: stackTrace || this._captureStackTrace()
    };

    this.allocations.set(id, allocation);
    this.currentUsage.allocatedBytes += size;
    this.currentUsage.allocationCount++;

    this.emit('allocation', allocation);

    // Check for memory pressure
    this._checkMemoryPressure();
  }

  /**
   * Track memory deallocation
   */
  trackDeallocation(id) {
    const allocation = this.allocations.get(id);
    if (allocation) {
      this.allocations.delete(id);
      this.currentUsage.deallocatedBytes += allocation.size;
      this.currentUsage.deallocationCount++;

      this.emit('deallocation', { id, size: allocation.size });
    }
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage() {
    const allocations = Array.from(this.allocations.values());
    
    return {
      allocatedBytes: this.currentUsage.allocatedBytes,
      deallocatedBytes: this.currentUsage.deallocatedBytes,
      netBytes: this.currentUsage.allocatedBytes - this.currentUsage.deallocatedBytes,
      allocationCount: this.currentUsage.allocationCount,
      deallocationCount: this.currentUsage.deallocationCount,
      activeAllocations: allocations.length,
      allocations: allocations,
      heapUsage: this._getHeapUsage()
    };
  }

  /**
   * Detect potential memory leaks
   */
  detectPotentialLeaks() {
    const now = Date.now();
    const windowStart = now - this.options.leakDetectionWindow;
    
    // Get allocations in the detection window
    const recentAllocations = Array.from(this.allocations.values())
      .filter(alloc => alloc.timestamp > windowStart);

    // Group by type
    const allocationsByType = {};
    let totalSize = 0;

    for (const alloc of recentAllocations) {
      if (!allocationsByType[alloc.type]) {
        allocationsByType[alloc.type] = { count: 0, size: 0, allocations: [] };
      }
      
      allocationsByType[alloc.type].count++;
      allocationsByType[alloc.type].size += alloc.size;
      allocationsByType[alloc.type].allocations.push(alloc);
      totalSize += alloc.size;
    }

    // Find suspicious patterns
    const suspiciousPatterns = [];
    
    for (const [type, data] of Object.entries(allocationsByType)) {
      // High count of small allocations
      if (data.count > 100 && data.size / data.count < 1024) {
        suspiciousPatterns.push({
          type: 'high-frequency-small',
          category: type,
          count: data.count,
          averageSize: data.size / data.count,
          severity: 'medium'
        });
      }

      // Large allocations that weren't deallocated
      const largeAllocations = data.allocations.filter(a => a.size > 1024 * 1024);
      if (largeAllocations.length > 0) {
        suspiciousPatterns.push({
          type: 'large-undeallocated',
          category: type,
          count: largeAllocations.length,
          totalSize: largeAllocations.reduce((sum, a) => sum + a.size, 0),
          severity: 'high'
        });
      }

      // Consistent growth pattern
      if (data.count > 50) {
        const timestamps = data.allocations.map(a => a.timestamp).sort();
        const timespan = timestamps[timestamps.length - 1] - timestamps[0];
        const growthRate = (data.count / timespan) * 1000; // allocations per second

        if (growthRate > 0.1) {
          suspiciousPatterns.push({
            type: 'consistent-growth',
            category: type,
            growthRate,
            timespan,
            severity: 'medium'
          });
        }
      }
    }

    // Calculate overall growth rate
    const snapshots = this.memorySnapshots.filter(s => s.timestamp > windowStart);
    let growthRate = 0;
    
    if (snapshots.length > 1) {
      const timeDiff = snapshots[snapshots.length - 1].timestamp - snapshots[0].timestamp;
      const byteDiff = snapshots[snapshots.length - 1].allocatedBytes - snapshots[0].allocatedBytes;
      growthRate = timeDiff > 0 ? (byteDiff / timeDiff) * 1000 : 0;
    } else if (recentAllocations.length > 0) {
      // If no snapshots but recent allocations, calculate based on allocation rate
      const timespan = now - windowStart;
      growthRate = timespan > 0 ? (totalSize / timespan) * 1000 : 0;
    }

    return {
      suspiciousPatterns,
      totalAllocations: recentAllocations.length,
      totalSize,
      growthRate,
      analysisWindow: this.options.leakDetectionWindow,
      timestamp: now
    };
  }

  /**
   * Get optimization suggestions
   */
  getOptimizationSuggestions() {
    const usage = this.getMemoryUsage();
    const suggestions = [];

    // Analyze allocation patterns
    const allocationsByType = {};
    const allocationsBySize = { small: 0, medium: 0, large: 0 };

    for (const alloc of usage.allocations) {
      // By type
      if (!allocationsByType[alloc.type]) {
        allocationsByType[alloc.type] = { count: 0, size: 0 };
      }
      allocationsByType[alloc.type].count++;
      allocationsByType[alloc.type].size += alloc.size;

      // By size category
      if (alloc.size < 1024) {
        allocationsBySize.small++;
      } else if (alloc.size < 1024 * 1024) {
        allocationsBySize.medium++;
      } else {
        allocationsBySize.large++;
      }
    }

    // Large allocations suggestion
    if (allocationsBySize.large > 0) {
      suggestions.push({
        type: 'large-allocations',
        priority: 'high',
        description: `${allocationsBySize.large} large allocations (>1MB) detected`,
        recommendations: [
          'Consider streaming or chunking large data',
          'Implement object pooling for large objects',
          'Use memory-mapped files for large datasets'
        ]
      });
    }

    // Small allocation fragmentation
    if (allocationsBySize.small > allocationsBySize.medium + allocationsBySize.large) {
      suggestions.push({
        type: 'fragmentation',
        priority: 'medium',
        description: 'High number of small allocations may cause fragmentation',
        recommendations: [
          'Use buffer pools for small allocations',
          'Batch small allocations into larger chunks',
          'Consider using typed arrays for numeric data'
        ]
      });
    }

    // Memory pressure
    if (this.memoryPressure > 0.8) {
      suggestions.push({
        type: 'memory-pressure',
        priority: 'critical',
        description: 'High memory pressure detected',
        recommendations: [
          'Trigger immediate garbage collection',
          'Clear non-essential caches',
          'Reduce concurrent operations'
        ]
      });
    }

    // Type-specific suggestions
    for (const [type, data] of Object.entries(allocationsByType)) {
      if (data.count > 100) {
        suggestions.push({
          type: 'high-frequency-type',
          category: type,
          priority: 'medium',
          description: `High allocation frequency for type: ${type}`,
          recommendations: [
            `Implement object pooling for ${type}`,
            `Cache and reuse ${type} instances`,
            `Consider flyweight pattern for ${type}`
          ]
        });
      }
    }

    return suggestions;
  }

  /**
   * Record garbage collection event
   */
  recordGCEvent(gcData) {
    const event = {
      ...gcData,
      timestamp: Date.now()
    };

    this.gcEvents.push(event);
    
    // Keep only recent events (last hour)
    const oneHourAgo = Date.now() - 3600000;
    this.gcEvents = this.gcEvents.filter(e => e.timestamp > oneHourAgo);

    this.emit('gc-event', event);
  }

  /**
   * Get garbage collection statistics
   */
  getGCStatistics() {
    if (this.gcEvents.length === 0) {
      return {
        events: [],
        averageDuration: 0,
        totalReclaimed: 0,
        frequency: 0
      };
    }

    const totalDuration = this.gcEvents.reduce((sum, e) => sum + (e.duration || 0), 0);
    const totalReclaimed = this.gcEvents.reduce((sum, e) => 
      sum + ((e.beforeSize || 0) - (e.afterSize || 0)), 0);
    
    const timespan = this.gcEvents[this.gcEvents.length - 1].timestamp - 
                     this.gcEvents[0].timestamp;
    const frequency = timespan > 0 ? (this.gcEvents.length / timespan) * 1000 : 0;

    return {
      events: this.gcEvents,
      averageDuration: totalDuration / this.gcEvents.length,
      totalReclaimed,
      frequency,
      majorGCs: this.gcEvents.filter(e => e.type === 'major').length,
      minorGCs: this.gcEvents.filter(e => e.type === 'minor').length
    };
  }

  /**
   * Set memory pressure level
   */
  setMemoryPressure(level) {
    this.memoryPressure = Math.max(0, Math.min(1, level));
    this.emit('memory-pressure-changed', this.memoryPressure);
  }

  /**
   * Handle memory pressure
   */
  handleMemoryPressure() {
    const urgency = this.memoryPressure > 0.9 ? 'critical' : 
                   this.memoryPressure > 0.8 ? 'high' : 'medium';

    const actions = [];
    
    if (urgency === 'critical' || this.memoryPressure >= 0.95) {
      actions.push('force-gc', 'clear-caches', 'reduce-concurrency');
    } else if (urgency === 'high' || this.memoryPressure >= 0.85) {
      actions.push('force-gc', 'clear-caches');
    } else {
      actions.push('suggest-gc', 'clear-optional-caches');
    }

    const recommendations = {
      urgency,
      actions,
      memoryPressure: this.memoryPressure,
      suggestions: this.getOptimizationSuggestions().filter(s => 
        s.priority === 'critical' || s.priority === 'high'
      )
    };

    this.emit('memory-pressure-handled', recommendations);
    
    return recommendations;
  }

  /**
   * Stop memory monitoring
   */
  stop() {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
  }

  /**
   * Get heap usage from Node.js
   * @private
   */
  _getHeapUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        rss: usage.rss,
        external: usage.external
      };
    }
    return {};
  }

  /**
   * Capture stack trace
   * @private
   */
  _captureStackTrace() {
    const stack = new Error().stack;
    return stack ? stack.split('\n').slice(2, 5) : null; // Skip first 2 lines, take 3
  }

  /**
   * Start memory monitoring
   * @private
   */
  _startMonitoring() {
    this.monitoringTimer = setInterval(() => {
      const snapshot = {
        timestamp: Date.now(),
        ...this.getMemoryUsage()
      };
      
      this.memorySnapshots.push(snapshot);
      
      // Keep only last 100 snapshots
      if (this.memorySnapshots.length > 100) {
        this.memorySnapshots = this.memorySnapshots.slice(-100);
      }

      this.emit('memory-snapshot', snapshot);
      
      // Auto-detect memory pressure
      this._checkMemoryPressure();
    }, this.options.samplingInterval);
  }

  /**
   * Check and update memory pressure
   * @private
   */
  _checkMemoryPressure() {
    const heapUsage = this._getHeapUsage();
    if (heapUsage.heapUsed && heapUsage.heapTotal) {
      const heapPressure = heapUsage.heapUsed / heapUsage.heapTotal;
      const configPressure = this.currentUsage.allocatedBytes / this.options.maxHeapSize;
      
      this.setMemoryPressure(Math.max(heapPressure, configPressure));
    }
  }
}