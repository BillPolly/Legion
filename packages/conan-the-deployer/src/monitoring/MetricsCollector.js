import { EventEmitter } from 'events';
import os from 'os';
import fs from 'fs/promises';

/**
 * MetricsCollector - Collects and aggregates metrics from deployments
 */
class MetricsCollector extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.metricsCollectors = new Map(); // deploymentId -> array of metrics collectors
    this.metricsHistory = new Map(); // deploymentId -> array of metrics results
    this.scheduledCollections = new Map(); // deploymentId -> interval ID
    this.previousNetworkStats = new Map(); // For calculating network deltas
    
    // Configuration
    this.defaultInterval = options.interval || 60000; // 1 minute
    this.maxHistorySize = options.maxHistorySize || 1000;
  }

  /**
   * Add a metrics collector for a deployment
   */
  addMetricsCollector(config) {
    const {
      deploymentId,
      type,
      interval = this.defaultInterval,
      ...otherConfig
    } = config;

    if (!this.metricsCollectors.has(deploymentId)) {
      this.metricsCollectors.set(deploymentId, []);
    }

    const collectorConfig = {
      type,
      interval,
      ...otherConfig
    };

    this.metricsCollectors.get(deploymentId).push(collectorConfig);
  }

  /**
   * Remove a metrics collector by index
   */
  removeMetricsCollector(deploymentId, index) {
    const collectors = this.metricsCollectors.get(deploymentId);
    if (collectors && index >= 0 && index < collectors.length) {
      collectors.splice(index, 1);
    }
  }

  /**
   * Remove all metrics collectors for a deployment
   */
  removeAllMetricsCollectors(deploymentId) {
    this.metricsCollectors.delete(deploymentId);
    this.metricsHistory.delete(deploymentId);
    this.previousNetworkStats.delete(deploymentId);
    this.stopScheduledCollection(deploymentId);
  }

  /**
   * Update metrics collector configuration
   */
  updateMetricsCollector(deploymentId, index, updates) {
    const collectors = this.metricsCollectors.get(deploymentId);
    if (collectors && index >= 0 && index < collectors.length) {
      Object.assign(collectors[index], updates);
    }
  }

  /**
   * Get metrics collectors for a deployment
   */
  getMetricsCollectors(deploymentId) {
    return this.metricsCollectors.get(deploymentId) || [];
  }

  /**
   * Collect system metrics
   */
  async collectSystemMetrics(requestedMetrics = ['cpu', 'memory', 'disk', 'network']) {
    const result = {
      timestamp: new Date()
    };

    try {
      if (requestedMetrics.includes('cpu')) {
        result.cpu = await this.collectCpuMetrics();
      }

      if (requestedMetrics.includes('memory')) {
        result.memory = await this.collectMemoryMetrics();
      }

      if (requestedMetrics.includes('disk')) {
        result.disk = await this.collectDiskMetrics();
      }

      if (requestedMetrics.includes('network')) {
        result.network = await this.collectNetworkMetrics();
      }

      return result;

    } catch (error) {
      return {
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  /**
   * Collect CPU metrics
   */
  async collectCpuMetrics() {
    const cpus = os.cpus();
    const numCpus = cpus.length;
    
    // Calculate CPU usage by getting load average
    const loadAverage = os.loadavg();
    const usage = Math.min((loadAverage[0] / numCpus) * 100, 100);

    return {
      usage: Math.round(usage * 100) / 100, // Round to 2 decimal places
      cores: numCpus,
      loadAverage: {
        '1min': loadAverage[0],
        '5min': loadAverage[1],
        '15min': loadAverage[2]
      },
      architecture: os.arch(),
      platform: os.platform()
    };
  }

  /**
   * Collect memory metrics
   */
  async collectMemoryMetrics() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const percentage = (usedMem / totalMem) * 100;

    return {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      percentage: Math.round(percentage * 100) / 100,
      // Convert to human readable units
      totalMB: Math.round(totalMem / 1024 / 1024),
      usedMB: Math.round(usedMem / 1024 / 1024),
      freeMB: Math.round(freeMem / 1024 / 1024)
    };
  }

  /**
   * Collect disk metrics
   */
  async collectDiskMetrics() {
    try {
      // For cross-platform compatibility, we'll use a simple approach
      // In production, you might want to use a more robust library like 'diskusage'
      const stats = await fs.stat('.');
      
      // Approximate disk usage (this is a simplified implementation)
      // In a real implementation, you'd use system-specific commands or libraries
      const totalDisk = 1024 * 1024 * 1024 * 100; // Simulate 100GB total
      const usedDisk = totalDisk * 0.3; // Simulate 30% usage
      const freeDisk = totalDisk - usedDisk;
      const percentage = (usedDisk / totalDisk) * 100;

      return {
        total: totalDisk,
        used: usedDisk,
        free: freeDisk,
        percentage: Math.round(percentage * 100) / 100,
        // Convert to human readable units
        totalGB: Math.round(totalDisk / 1024 / 1024 / 1024),
        usedGB: Math.round(usedDisk / 1024 / 1024 / 1024),
        freeGB: Math.round(freeDisk / 1024 / 1024 / 1024)
      };

    } catch (error) {
      return {
        error: error.message,
        total: 0,
        used: 0,
        free: 0,
        percentage: 0
      };
    }
  }

  /**
   * Collect network metrics
   */
  async collectNetworkMetrics() {
    try {
      const networkInterfaces = os.networkInterfaces();
      let totalBytesIn = 0;
      let totalBytesOut = 0;

      // Simulate network metrics (in production, you'd read from /proc/net/dev on Linux)
      totalBytesIn = Math.floor(Math.random() * 1000000000); // Random bytes in
      totalBytesOut = Math.floor(Math.random() * 500000000); // Random bytes out

      return {
        bytesIn: totalBytesIn,
        bytesOut: totalBytesOut,
        interfaces: Object.keys(networkInterfaces).length,
        // Convert to human readable units
        mbIn: Math.round(totalBytesIn / 1024 / 1024),
        mbOut: Math.round(totalBytesOut / 1024 / 1024)
      };

    } catch (error) {
      return {
        error: error.message,
        bytesIn: 0,
        bytesOut: 0,
        interfaces: 0
      };
    }
  }

  /**
   * Collect metrics from HTTP endpoint
   */
  async collectHttpMetrics(config) {
    const { url, timeout = 5000 } = config;
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'conan-the-deployer-metrics-collector'
        }
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          statusText: response.statusText,
          responseTime,
          timestamp: new Date(),
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const metrics = await response.json();

      return {
        success: true,
        metrics,
        responseTime,
        status: response.status,
        url,
        timestamp: new Date()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        success: false,
        responseTime,
        url,
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  /**
   * Collect custom metrics
   */
  async collectCustomMetrics(config) {
    const { name, collector } = config;
    const startTime = Date.now();

    try {
      const metrics = await collector();
      const executionTime = Date.now() - startTime;

      return {
        success: true,
        name,
        metrics,
        executionTime,
        timestamp: new Date()
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        name,
        executionTime,
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  /**
   * Collect metrics for a specific deployment
   */
  async collectMetrics(deploymentId) {
    const collectors = this.getMetricsCollectors(deploymentId);
    const collections = [];

    for (const collectorConfig of collectors) {
      let result;

      if (collectorConfig.type === 'system') {
        const systemResult = await this.collectSystemMetrics(collectorConfig.metrics);
        result = {
          type: 'system',
          success: !systemResult.error,
          metrics: systemResult,
          timestamp: systemResult.timestamp
        };
      } else if (collectorConfig.type === 'http') {
        result = await this.collectHttpMetrics(collectorConfig);
        result.type = 'http';
      } else if (collectorConfig.type === 'custom') {
        result = await this.collectCustomMetrics(collectorConfig);
        result.type = 'custom';
      }

      collections.push(result);
    }

    const metricsResult = {
      deploymentId,
      collections,
      timestamp: new Date()
    };

    // Store in history
    this.addToHistory(deploymentId, metricsResult);

    // Emit metrics collected event
    this.emit('metrics:collected', metricsResult);

    return metricsResult;
  }

  /**
   * Add metrics result to history
   */
  addToHistory(deploymentId, metricsResult) {
    if (!this.metricsHistory.has(deploymentId)) {
      this.metricsHistory.set(deploymentId, []);
    }

    const history = this.metricsHistory.get(deploymentId);
    history.push(metricsResult);

    // Limit history size
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  /**
   * Get metrics history for a deployment
   */
  getMetricsHistory(deploymentId) {
    return this.metricsHistory.get(deploymentId) || [];
  }

  /**
   * Get latest metrics for a deployment
   */
  getLatestMetrics(deploymentId) {
    const history = this.getMetricsHistory(deploymentId);
    return history.length > 0 ? history[history.length - 1] : null;
  }

  /**
   * Start scheduled metrics collection for a deployment
   */
  startScheduledCollection(deploymentId) {
    if (this.scheduledCollections.has(deploymentId)) {
      this.stopScheduledCollection(deploymentId);
    }

    const collectors = this.getMetricsCollectors(deploymentId);
    if (collectors.length === 0) return;

    // Use the shortest interval among all collectors
    const interval = Math.min(...collectors.map(collector => collector.interval));

    const intervalId = setInterval(async () => {
      try {
        await this.collectMetrics(deploymentId);
      } catch (error) {
        this.emit('metrics:error', {
          deploymentId,
          error: error.message,
          timestamp: new Date()
        });
      }
    }, interval);

    this.scheduledCollections.set(deploymentId, intervalId);
  }

  /**
   * Stop scheduled metrics collection for a deployment
   */
  stopScheduledCollection(deploymentId) {
    const intervalId = this.scheduledCollections.get(deploymentId);
    if (intervalId) {
      clearInterval(intervalId);
      this.scheduledCollections.delete(deploymentId);
    }
  }

  /**
   * Stop all scheduled metrics collection
   */
  stopAllCollection() {
    for (const [deploymentId] of this.scheduledCollections) {
      this.stopScheduledCollection(deploymentId);
    }
  }

  /**
   * Get aggregated metrics across all deployments
   */
  getAggregatedMetrics() {
    const deploymentIds = Array.from(this.metricsHistory.keys());
    const totalDeployments = deploymentIds.length;
    const totalCollectors = Array.from(this.metricsCollectors.values())
      .reduce((total, collectors) => total + collectors.length, 0);

    if (totalDeployments === 0) {
      return {
        totalDeployments: 0,
        totalCollectors: 0,
        averageCpuUsage: 0,
        averageMemoryUsage: 0,
        timestamp: new Date()
      };
    }

    let totalCpuUsage = 0;
    let totalMemoryUsage = 0;
    let cpuSamples = 0;
    let memorySamples = 0;

    for (const deploymentId of deploymentIds) {
      const latest = this.getLatestMetrics(deploymentId);
      if (latest && latest.collections) {
        for (const collection of latest.collections) {
          if (collection.type === 'system' && collection.success) {
            if (collection.cpu && collection.cpu.usage !== undefined) {
              totalCpuUsage += collection.cpu.usage;
              cpuSamples++;
            }
            if (collection.memory && collection.memory.percentage !== undefined) {
              totalMemoryUsage += collection.memory.percentage;
              memorySamples++;
            }
          }
        }
      }
    }

    return {
      totalDeployments,
      totalCollectors,
      averageCpuUsage: cpuSamples > 0 ? Math.round((totalCpuUsage / cpuSamples) * 100) / 100 : 0,
      averageMemoryUsage: memorySamples > 0 ? Math.round((totalMemoryUsage / memorySamples) * 100) / 100 : 0,
      timestamp: new Date()
    };
  }

  /**
   * Get metrics summary with deployment details
   */
  getMetricsSummary() {
    const deploymentMetrics = {};
    
    for (const [deploymentId, history] of this.metricsHistory) {
      const collectors = this.getMetricsCollectors(deploymentId);
      const latest = history.length > 0 ? history[history.length - 1] : null;
      
      deploymentMetrics[deploymentId] = {
        latestCollection: latest ? latest.timestamp : null,
        totalCollections: history.length,
        metricsCollectors: collectors.length,
        collectorTypes: collectors.map(c => c.type),
        hasSystemMetrics: collectors.some(c => c.type === 'system'),
        hasHttpMetrics: collectors.some(c => c.type === 'http'),
        hasCustomMetrics: collectors.some(c => c.type === 'custom')
      };
    }

    const totalHistoryEntries = Array.from(this.metricsHistory.values())
      .reduce((total, history) => total + history.length, 0);

    return {
      totalDeployments: this.metricsHistory.size,
      deploymentsWithHistory: this.metricsHistory.size,
      totalHistoryEntries,
      deploymentMetrics,
      timestamp: new Date()
    };
  }

  /**
   * Get metrics collection statistics
   */
  getStatistics() {
    const totalDeployments = this.metricsCollectors.size;
    const activeScheduledCollections = this.scheduledCollections.size;
    const totalMetricsCollectors = Array.from(this.metricsCollectors.values())
      .reduce((total, collectors) => total + collectors.length, 0);
    
    const totalHistoryEntries = Array.from(this.metricsHistory.values())
      .reduce((total, history) => total + history.length, 0);

    // Calculate collection types distribution
    const collectorTypes = {};
    for (const collectors of this.metricsCollectors.values()) {
      for (const collector of collectors) {
        collectorTypes[collector.type] = (collectorTypes[collector.type] || 0) + 1;
      }
    }

    return {
      totalDeployments,
      activeScheduledCollections,
      totalMetricsCollectors,
      totalHistoryEntries,
      collectorTypes,
      averageCollectorsPerDeployment: totalDeployments > 0 ? 
        (totalMetricsCollectors / totalDeployments).toFixed(2) : 0,
      timestamp: new Date()
    };
  }
}

export default MetricsCollector;