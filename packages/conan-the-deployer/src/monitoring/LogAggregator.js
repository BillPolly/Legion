import { EventEmitter } from 'events';
import fs from 'fs/promises';

/**
 * LogAggregator - Aggregates and processes logs from multiple sources
 */
class LogAggregator extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.logSources = new Map(); // deploymentId -> array of log sources
    this.logHistory = new Map(); // deploymentId -> array of log collections
    this.logStreams = new Map(); // deploymentId -> stream interval ID
    
    // Configuration
    this.defaultInterval = options.interval || 30000; // 30 seconds
    this.maxHistorySize = options.maxHistorySize || 1000;
    this.defaultMaxLines = options.maxLines || 1000;
  }

  /**
   * Add a log source for a deployment
   */
  addLogSource(config) {
    const {
      deploymentId,
      type,
      interval = this.defaultInterval,
      ...otherConfig
    } = config;

    if (!this.logSources.has(deploymentId)) {
      this.logSources.set(deploymentId, []);
    }

    const sourceConfig = {
      type,
      interval,
      ...otherConfig
    };

    this.logSources.get(deploymentId).push(sourceConfig);
  }

  /**
   * Remove a log source by index
   */
  removeLogSource(deploymentId, index) {
    const sources = this.logSources.get(deploymentId);
    if (sources && index >= 0 && index < sources.length) {
      sources.splice(index, 1);
    }
  }

  /**
   * Remove all log sources for a deployment
   */
  removeAllLogSources(deploymentId) {
    this.logSources.delete(deploymentId);
    this.logHistory.delete(deploymentId);
    this.stopLogStreaming(deploymentId);
  }

  /**
   * Update log source configuration
   */
  updateLogSource(deploymentId, index, updates) {
    const sources = this.logSources.get(deploymentId);
    if (sources && index >= 0 && index < sources.length) {
      Object.assign(sources[index], updates);
    }
  }

  /**
   * Get log sources for a deployment
   */
  getLogSources(deploymentId) {
    return this.logSources.get(deploymentId) || [];
  }

  /**
   * Read logs from file
   */
  async readFileLog(config) {
    const { 
      path, 
      format = 'json', 
      maxLines = this.defaultMaxLines,
      skipInvalidLines = true 
    } = config;

    try {
      const content = await fs.readFile(path, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      // Get the last N lines
      const targetLines = lines.length > maxLines ? lines.slice(-maxLines) : lines;
      const logs = [];

      for (const line of targetLines) {
        try {
          let logEntry;

          if (format === 'json') {
            const parsed = JSON.parse(line);
            logEntry = {
              timestamp: new Date(parsed.timestamp || Date.now()),
              level: parsed.level || 'info',
              message: parsed.message || parsed.msg || line,
              ...parsed
            };
          } else {
            // Parse text format: YYYY-MM-DD HH:mm:ss [LEVEL] MESSAGE
            const textMatch = line.match(/^(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})\s*\[(\w+)\]\s*(.+)$/);
            if (textMatch) {
              logEntry = {
                timestamp: new Date(textMatch[1]),
                level: textMatch[2].toLowerCase(),
                message: textMatch[3],
                raw: line
              };
            } else {
              // Fallback for unstructured text
              logEntry = {
                timestamp: new Date(),
                level: 'info',
                message: line,
                raw: line
              };
            }
          }

          logs.push(logEntry);

        } catch (parseError) {
          if (!skipInvalidLines) {
            logs.push({
              timestamp: new Date(),
              level: 'error',
              message: `Parse error: ${parseError.message}`,
              raw: line,
              parseError: true
            });
          }
        }
      }

      return logs;

    } catch (error) {
      return {
        error: error.message,
        logs: [],
        timestamp: new Date()
      };
    }
  }

  /**
   * Collect logs from HTTP endpoint
   */
  async collectHttpLogs(config) {
    const { url, timeout = 10000, since } = config;
    const startTime = Date.now();

    try {
      // Build URL with query parameters
      const logUrl = new URL(url);
      if (since) {
        logUrl.searchParams.set('since', since);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(logUrl.toString(), {
        signal: controller.signal,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'conan-the-deployer-log-aggregator'
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
          error: `HTTP ${response.status}: ${response.statusText}`,
          logs: []
        };
      }

      const data = await response.json();
      const logs = data.logs || data.entries || data || [];

      // Normalize log entries
      const normalizedLogs = logs.map(log => ({
        timestamp: new Date(log.timestamp || log.time || Date.now()),
        level: log.level || log.severity || 'info',
        message: log.message || log.msg || log.text || JSON.stringify(log),
        ...log
      }));

      return {
        success: true,
        logs: normalizedLogs,
        responseTime,
        status: response.status,
        url: logUrl.toString(),
        timestamp: new Date()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        success: false,
        responseTime,
        url,
        timestamp: new Date(),
        error: error.message,
        logs: []
      };
    }
  }

  /**
   * Collect logs from custom source
   */
  async collectCustomLogs(config) {
    const { name, source, params = {} } = config;
    const startTime = Date.now();

    try {
      const logs = await source(params);
      const executionTime = Date.now() - startTime;

      // Normalize log entries
      const normalizedLogs = logs.map(log => ({
        timestamp: new Date(log.timestamp || Date.now()),
        level: log.level || 'info',
        message: log.message || JSON.stringify(log),
        source: name,
        ...log
      }));

      return {
        success: true,
        name,
        logs: normalizedLogs,
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
        error: error.message,
        logs: []
      };
    }
  }

  /**
   * Collect logs for a specific deployment
   */
  async collectLogs(deploymentId) {
    const sources = this.getLogSources(deploymentId);
    const collections = [];

    for (const sourceConfig of sources) {
      let result;

      if (sourceConfig.type === 'file') {
        const logs = await this.readFileLog(sourceConfig);
        result = {
          type: 'file',
          success: !logs.error,
          logs: logs.error ? [] : logs,
          error: logs.error,
          path: sourceConfig.path,
          timestamp: new Date()
        };
      } else if (sourceConfig.type === 'http') {
        result = await this.collectHttpLogs(sourceConfig);
        result.type = 'http';
      } else if (sourceConfig.type === 'custom') {
        result = await this.collectCustomLogs(sourceConfig);
        result.type = 'custom';
      } else if (sourceConfig.type === 'stdout') {
        // Placeholder for stdout collection - would integrate with ProcessManager
        result = {
          type: 'stdout',
          success: true,
          logs: [],
          processId: sourceConfig.processId,
          timestamp: new Date(),
          message: 'Stdout collection not yet implemented'
        };
      }

      collections.push(result);
    }

    const logResult = {
      deploymentId,
      collections,
      timestamp: new Date()
    };

    // Store in history
    this.addToHistory(deploymentId, logResult);

    // Emit logs collected event
    this.emit('logs:collected', logResult);

    return logResult;
  }

  /**
   * Add log collection result to history
   */
  addToHistory(deploymentId, logResult) {
    if (!this.logHistory.has(deploymentId)) {
      this.logHistory.set(deploymentId, []);
    }

    const history = this.logHistory.get(deploymentId);
    history.push(logResult);

    // Limit history size
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  /**
   * Get log history for a deployment
   */
  getLogHistory(deploymentId) {
    return this.logHistory.get(deploymentId) || [];
  }

  /**
   * Get latest logs for a deployment
   */
  getLatestLogs(deploymentId) {
    const history = this.getLogHistory(deploymentId);
    return history.length > 0 ? history[history.length - 1] : null;
  }

  /**
   * Search logs across all collections for a deployment
   */
  searchLogs(deploymentId, criteria = {}) {
    const { level, since, until, search, source, limit = 1000 } = criteria;
    const history = this.getLogHistory(deploymentId);
    const allLogs = [];

    // Collect all logs from history
    for (const collection of history) {
      for (const sourceCollection of collection.collections) {
        if (sourceCollection.logs && sourceCollection.success) {
          allLogs.push(...sourceCollection.logs);
        }
      }
    }

    // Apply filters
    let filteredLogs = allLogs;

    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }

    if (since) {
      const sinceDate = new Date(since);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= sinceDate);
    }

    if (until) {
      const untilDate = new Date(until);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= untilDate);
    }

    if (search) {
      const searchTerm = search.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        log.message.toLowerCase().includes(searchTerm)
      );
    }

    if (source) {
      filteredLogs = filteredLogs.filter(log => log.source === source);
    }

    // Sort by timestamp (newest first) and limit
    filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return filteredLogs.slice(0, limit);
  }

  /**
   * Start log streaming for a deployment
   */
  startLogStreaming(deploymentId) {
    if (this.logStreams.has(deploymentId)) {
      this.stopLogStreaming(deploymentId);
    }

    const sources = this.getLogSources(deploymentId);
    if (sources.length === 0) return;

    // Use the shortest interval among all sources
    const interval = Math.min(...sources.map(source => source.interval));

    const intervalId = setInterval(async () => {
      try {
        await this.collectLogs(deploymentId);
      } catch (error) {
        this.emit('logs:error', {
          deploymentId,
          error: error.message,
          timestamp: new Date()
        });
      }
    }, interval);

    this.logStreams.set(deploymentId, intervalId);
  }

  /**
   * Stop log streaming for a deployment
   */
  stopLogStreaming(deploymentId) {
    const intervalId = this.logStreams.get(deploymentId);
    if (intervalId) {
      clearInterval(intervalId);
      this.logStreams.delete(deploymentId);
    }
  }

  /**
   * Stop all log streaming
   */
  stopAllWatching() {
    for (const [deploymentId] of this.logStreams) {
      this.stopLogStreaming(deploymentId);
    }
  }

  /**
   * Get log statistics across all deployments
   */
  getLogStatistics() {
    const logLevels = {};
    let totalLogEntries = 0;

    for (const history of this.logHistory.values()) {
      for (const collection of history) {
        for (const sourceCollection of collection.collections) {
          if (sourceCollection.logs && sourceCollection.success) {
            for (const log of sourceCollection.logs) {
              totalLogEntries++;
              const level = log.level || 'unknown';
              logLevels[level] = (logLevels[level] || 0) + 1;
            }
          }
        }
      }
    }

    return {
      totalDeployments: this.logHistory.size,
      totalLogEntries,
      logLevels,
      averageLogsPerDeployment: this.logHistory.size > 0 ? 
        (totalLogEntries / this.logHistory.size).toFixed(2) : 0,
      timestamp: new Date()
    };
  }

  /**
   * Get log summary with deployment details
   */
  getLogSummary() {
    const deploymentLogs = {};
    
    for (const [deploymentId, history] of this.logHistory) {
      const sources = this.getLogSources(deploymentId);
      const latest = history.length > 0 ? history[history.length - 1] : null;
      
      // Count total logs for this deployment
      let totalLogs = 0;
      const sourceTypes = new Set();

      for (const collection of history) {
        for (const sourceCollection of collection.collections) {
          sourceTypes.add(sourceCollection.type);
          if (sourceCollection.logs && sourceCollection.success) {
            totalLogs += sourceCollection.logs.length;
          }
        }
      }
      
      deploymentLogs[deploymentId] = {
        latestCollection: latest ? latest.timestamp : null,
        totalCollections: history.length,
        totalLogs,
        logSources: sources.length,
        sourceTypes: Array.from(sourceTypes),
        hasFileSources: sources.some(s => s.type === 'file'),
        hasHttpSources: sources.some(s => s.type === 'http'),
        hasCustomSources: sources.some(s => s.type === 'custom')
      };
    }

    const totalHistoryEntries = Array.from(this.logHistory.values())
      .reduce((total, history) => total + history.length, 0);

    return {
      totalDeployments: this.logHistory.size,
      deploymentsWithHistory: this.logHistory.size,
      totalHistoryEntries,
      deploymentLogs,
      timestamp: new Date()
    };
  }

  /**
   * Get collection statistics
   */
  getCollectionStatistics() {
    const totalDeployments = this.logSources.size;
    const activeStreams = this.logStreams.size;
    const totalLogSources = Array.from(this.logSources.values())
      .reduce((total, sources) => total + sources.length, 0);
    
    const totalHistoryEntries = Array.from(this.logHistory.values())
      .reduce((total, history) => total + history.length, 0);

    // Calculate source types distribution
    const sourceTypes = {};
    for (const sources of this.logSources.values()) {
      for (const source of sources) {
        sourceTypes[source.type] = (sourceTypes[source.type] || 0) + 1;
      }
    }

    return {
      totalDeployments,
      activeStreams,
      totalLogSources,
      totalHistoryEntries,
      sourceTypes,
      averageSourcesPerDeployment: totalDeployments > 0 ? 
        (totalLogSources / totalDeployments).toFixed(2) : 0,
      timestamp: new Date()
    };
  }

  /**
   * Parse log level from string
   */
  normalizeLogLevel(level) {
    if (!level) return 'info';
    
    const normalized = level.toLowerCase();
    const levelMap = {
      'trace': 'trace',
      'debug': 'debug',
      'info': 'info',
      'information': 'info',
      'warn': 'warn',
      'warning': 'warn',
      'error': 'error',
      'err': 'error',
      'fatal': 'fatal',
      'critical': 'fatal'
    };

    return levelMap[normalized] || 'info';
  }

  /**
   * Format timestamp for consistent display
   */
  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toISOString();
  }
}

export default LogAggregator;