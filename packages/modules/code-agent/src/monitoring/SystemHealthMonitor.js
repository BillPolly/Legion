/**
 * SystemHealthMonitor - Monitors system resources during code generation
 * 
 * Tracks:
 * - CPU usage
 * - Memory consumption
 * - Disk usage
 * - Process health
 * - Network activity
 */

import { EventEmitter } from 'events';
import os from 'os';
import { promises as fs } from 'fs';

/**
 * System health monitoring for resource tracking
 */
class SystemHealthMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      checkInterval: 5000, // 5 seconds
      historySize: 100,
      thresholds: {
        cpu: 80,      // percentage
        memory: 85,   // percentage
        disk: 90,     // percentage
        processes: 50 // max processes
      },
      ...config
    };
    
    this.isRunning = false;
    this.intervalId = null;
    
    // Metrics history
    this.history = {
      cpu: [],
      memory: [],
      disk: [],
      processes: [],
      network: []
    };
    
    // Current metrics
    this.currentMetrics = {
      cpu: 0,
      memory: 0,
      disk: 0,
      processes: 0,
      uptime: 0
    };
  }

  /**
   * Start monitoring
   */
  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.emit('started', { config: this.config });
    
    // Initial check
    await this.checkHealth();
    
    // Set up interval
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        await this.checkHealth();
      }
    }, this.config.checkInterval);
  }

  /**
   * Stop monitoring
   */
  async stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.emit('stopped', {
      finalMetrics: this.currentMetrics,
      history: this.getHistorySummary()
    });
  }

  /**
   * Check system health
   */
  async checkHealth() {
    try {
      const metrics = await this.collectMetrics();
      this.currentMetrics = metrics;
      
      // Add to history
      this.addToHistory(metrics);
      
      // Check thresholds
      this.checkThresholds(metrics);
      
      // Emit current metrics
      this.emit('metrics', metrics);
      
    } catch (error) {
      this.emit('error', {
        message: `Health check failed: ${error.message}`,
        error: error.message
      });
    }
  }

  /**
   * Collect system metrics
   */
  async collectMetrics() {
    const metrics = {
      timestamp: Date.now(),
      cpu: await this.getCPUUsage(),
      memory: this.getMemoryUsage(),
      disk: await this.getDiskUsage(),
      processes: this.getProcessCount(),
      uptime: process.uptime(),
      network: await this.getNetworkUsage()
    };
    
    return metrics;
  }

  /**
   * Get CPU usage percentage
   */
  async getCPUUsage() {
    return new Promise((resolve) => {
      const startMeasure = this.cpuAverage();
      
      setTimeout(() => {
        const endMeasure = this.cpuAverage();
        
        const idleDiff = endMeasure.idle - startMeasure.idle;
        const totalDiff = endMeasure.total - startMeasure.total;
        
        const percentageCPU = 100 - ~~(100 * idleDiff / totalDiff);
        resolve(percentageCPU);
      }, 100);
    });
  }

  /**
   * Calculate CPU average
   */
  cpuAverage() {
    const cpus = os.cpus();
    
    let totalIdle = 0;
    let totalTick = 0;
    
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    }
    
    return {
      idle: totalIdle / cpus.length,
      total: totalTick / cpus.length
    };
  }

  /**
   * Get memory usage
   */
  getMemoryUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
      percentage: Math.round((usedMem / totalMem) * 100),
      used: usedMem,
      free: freeMem,
      total: totalMem,
      process: process.memoryUsage()
    };
  }

  /**
   * Get disk usage
   */
  async getDiskUsage() {
    try {
      // This is a simplified version - in production would use proper disk usage library
      const stats = await fs.statfs(process.cwd());
      
      const total = stats.blocks * stats.bsize;
      const free = stats.bavail * stats.bsize;
      const used = total - free;
      const percentage = Math.round((used / total) * 100);
      
      return {
        percentage,
        used,
        free,
        total
      };
    } catch (error) {
      return {
        percentage: 0,
        error: error.message
      };
    }
  }

  /**
   * Get process count
   */
  getProcessCount() {
    // This would be more sophisticated in production
    return {
      node: 1, // Current process
      total: os.loadavg()[0] // Rough estimate
    };
  }

  /**
   * Get network usage (simplified)
   */
  async getNetworkUsage() {
    // This would track actual network I/O in production
    return {
      bytesReceived: 0,
      bytesSent: 0
    };
  }

  /**
   * Add metrics to history
   */
  addToHistory(metrics) {
    const historyEntry = {
      timestamp: metrics.timestamp,
      cpu: metrics.cpu,
      memory: metrics.memory.percentage,
      disk: metrics.disk.percentage
    };
    
    this.history.cpu.push({ t: metrics.timestamp, v: metrics.cpu });
    this.history.memory.push({ t: metrics.timestamp, v: metrics.memory.percentage });
    this.history.disk.push({ t: metrics.timestamp, v: metrics.disk.percentage });
    
    // Trim history
    for (const key in this.history) {
      if (this.history[key].length > this.config.historySize) {
        this.history[key] = this.history[key].slice(-this.config.historySize);
      }
    }
  }

  /**
   * Check thresholds and emit warnings
   */
  checkThresholds(metrics) {
    const { thresholds } = this.config;
    
    if (metrics.cpu > thresholds.cpu) {
      this.emit('warning', {
        metric: 'cpu',
        value: metrics.cpu,
        threshold: thresholds.cpu,
        message: `CPU usage ${metrics.cpu}% exceeds threshold ${thresholds.cpu}%`
      });
    }
    
    if (metrics.memory.percentage > thresholds.memory) {
      this.emit('warning', {
        metric: 'memory',
        value: metrics.memory.percentage,
        threshold: thresholds.memory,
        message: `Memory usage ${metrics.memory.percentage}% exceeds threshold ${thresholds.memory}%`
      });
    }
    
    if (metrics.disk.percentage > thresholds.disk) {
      this.emit('warning', {
        metric: 'disk',
        value: metrics.disk.percentage,
        threshold: thresholds.disk,
        message: `Disk usage ${metrics.disk.percentage}% exceeds threshold ${thresholds.disk}%`
      });
    }
  }

  /**
   * Get current metrics
   */
  async getCurrentMetrics() {
    if (!this.isRunning) {
      await this.checkHealth();
    }
    return this.currentMetrics;
  }

  /**
   * Get metrics history summary
   */
  getHistorySummary() {
    const summary = {};
    
    for (const [metric, history] of Object.entries(this.history)) {
      if (history.length === 0) continue;
      
      const values = history.map(h => h.v || 0);
      summary[metric] = {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        current: values[values.length - 1],
        samples: values.length
      };
    }
    
    return summary;
  }

  /**
   * Get resource usage trends
   */
  getResourceTrends() {
    const trends = {};
    
    for (const [metric, history] of Object.entries(this.history)) {
      if (history.length < 2) continue;
      
      const recent = history.slice(-10);
      const older = history.slice(-20, -10);
      
      if (older.length > 0) {
        const recentAvg = recent.reduce((a, b) => a + (b.v || 0), 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + (b.v || 0), 0) / older.length;
        
        trends[metric] = {
          direction: recentAvg > olderAvg ? 'increasing' : 'decreasing',
          change: ((recentAvg - olderAvg) / olderAvg) * 100
        };
      }
    }
    
    return trends;
  }

  /**
   * Predict resource exhaustion
   */
  predictResourceExhaustion() {
    const predictions = {};
    const trends = this.getResourceTrends();
    
    for (const [metric, trend] of Object.entries(trends)) {
      if (trend.direction === 'increasing' && trend.change > 5) {
        const current = this.currentMetrics[metric];
        const threshold = this.config.thresholds[metric];
        
        if (current && threshold) {
          const rate = trend.change / 100;
          const remaining = threshold - current;
          const intervalsToThreshold = remaining / (current * rate);
          const timeToThreshold = intervalsToThreshold * this.config.checkInterval;
          
          predictions[metric] = {
            willExceedThreshold: true,
            estimatedTime: timeToThreshold,
            currentValue: current,
            threshold: threshold
          };
        }
      }
    }
    
    return predictions;
  }

  /**
   * Generate health report
   */
  generateHealthReport() {
    return {
      status: this.isRunning ? 'running' : 'stopped',
      currentMetrics: this.currentMetrics,
      summary: this.getHistorySummary(),
      trends: this.getResourceTrends(),
      predictions: this.predictResourceExhaustion(),
      config: this.config,
      uptime: process.uptime()
    };
  }
}

export { SystemHealthMonitor };