/**
 * ServiceDataSource - DataSource implementation for service resources
 * 
 * Provides access to running services, processes, and network endpoints through the DataSource interface.
 * Supports querying service status, health checks, subscribing to service state changes,
 * and validation against service schema specifications.
 * 
 * URI Examples:
 * - legion://local/service/web-server/status
 * - legion://server/service/database/health
 * - legion://prod/service/api-gateway/metrics
 */

import { validateDataSourceInterface } from '@legion/handle/src/DataSource.js';

export class ServiceDataSource {
  constructor(context) {
    if (!context || !context.resourceManager) {
      throw new Error('Context with ResourceManager is required');
    }

    this.context = context;
    this.resourceManager = context.resourceManager;
    this.parsed = context.parsed;
    
    // Service-specific path parsing: /serviceName/endpoint?
    const pathParts = this.parsed.path.split('/').filter(p => p.length > 0);
    this.serviceName = pathParts[0] || null;
    this.endpoint = pathParts[1] || 'status';
    this.additionalPath = pathParts.slice(2).join('/');
    
    // Service connection and state
    this._connections = new Map();
    this._subscriptions = new Map();
    this._healthChecks = new Map();
    
    // Cached data
    this._schema = null;
    this._metadata = null;
    this._statusCache = new Map();
    this._statusCacheTimeout = 30 * 1000; // 30 seconds
    
    // Validate interface compliance
    validateDataSourceInterface(this, 'ServiceDataSource');
  }

  /**
   * Execute query against service - SYNCHRONOUS
   * @param {Object} querySpec - Query specification
   * @returns {Array} Query results
   */
  query(querySpec) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }

    // For synchronous interface, we need to handle async service operations
    // This is a limitation - service operations are inherently async
    // We'll throw an error directing users to use async methods
    throw new Error('Service operations are async - use ServiceHandle.queryAsync() instead of sync query()');
  }

  /**
   * Execute async query against service
   * @param {Object} querySpec - Query specification
   * @returns {Promise<Array>} Query results
   */
  async queryAsync(querySpec) {
    const results = [];

    try {
      if (querySpec.status) {
        // Get service status
        const status = await this._getServiceStatus();
        return [{ 
          service: this.serviceName,
          endpoint: this.endpoint,
          status: status.status,
          uptime: status.uptime,
          lastCheck: status.lastCheck,
          metadata: status.metadata
        }];
        
      } else if (querySpec.health) {
        // Perform health check
        const health = await this._performHealthCheck();
        return [{ 
          service: this.serviceName,
          endpoint: this.endpoint,
          healthy: health.healthy,
          response: health.response,
          responseTime: health.responseTime,
          timestamp: health.timestamp
        }];
        
      } else if (querySpec.metrics) {
        // Get service metrics
        const metrics = await this._getServiceMetrics();
        return [{ 
          service: this.serviceName,
          endpoint: this.endpoint,
          metrics: metrics.data,
          timestamp: metrics.timestamp
        }];
        
      } else if (querySpec.logs) {
        // Get service logs
        const logs = await this._getServiceLogs(querySpec.logs);
        return logs.map(log => ({
          service: this.serviceName,
          timestamp: log.timestamp,
          level: log.level,
          message: log.message,
          metadata: log.metadata || {}
        }));
        
      } else if (querySpec.processes) {
        // List service processes
        const processes = await this._getServiceProcesses();
        return processes.map(proc => ({
          service: this.serviceName,
          pid: proc.pid,
          name: proc.name,
          status: proc.status,
          cpu: proc.cpu,
          memory: proc.memory,
          uptime: proc.uptime
        }));
        
      } else if (querySpec.find === 'all') {
        // List all available services
        const services = await this._discoverServices();
        return services.map(service => ({
          name: service.name,
          type: service.type,
          port: service.port,
          status: service.status,
          url: service.url
        }));
      }

      return results;

    } catch (error) {
      throw new Error(`Service query failed: ${error.message}`);
    }
  }

  /**
   * Set up subscription for service changes - SYNCHRONOUS
   * @param {Object} querySpec - Query specification to monitor
   * @param {Function} callback - Change notification callback
   * @returns {Object} Subscription object
   */
  subscribe(querySpec, callback) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }

    const subscriptionId = Date.now() + Math.random();
    
    // Create subscription object (async setup will happen in background)
    const subscription = {
      id: subscriptionId,
      querySpec,
      callback,
      unsubscribe: () => {
        this._subscriptions.delete(subscriptionId);
        this._stopServiceMonitoring(subscriptionId);
      }
    };

    this._subscriptions.set(subscriptionId, subscription);
    
    // Start service monitoring asynchronously
    this._startServiceMonitoring(subscriptionId, querySpec, callback);

    return subscription;
  }

  /**
   * Get service schema - SYNCHRONOUS
   * @returns {Object} Schema describing service structure
   */
  getSchema() {
    if (!this._schema) {
      this._schema = this._generateServiceSchema();
    }
    return this._schema;
  }

  /**
   * Update service configuration - SYNCHRONOUS (throws error directing to async)
   * @param {Object} updateSpec - Update specification
   * @returns {Object} Update result
   */
  update(updateSpec) {
    throw new Error('Service updates are async - use ServiceHandle.updateAsync() instead of sync update()');
  }

  /**
   * Update service configuration - ASYNC
   * @param {Object} updateSpec - Update specification
   * @returns {Promise<Object>} Update result
   */
  async updateAsync(updateSpec) {
    const changes = [];

    try {
      if (updateSpec.start) {
        // Start service
        const result = await this._startService(updateSpec.start);
        changes.push({
          type: 'start',
          service: this.serviceName,
          success: result.success,
          pid: result.pid,
          port: result.port
        });
      }

      if (updateSpec.stop) {
        // Stop service
        const result = await this._stopService(updateSpec.stop);
        changes.push({
          type: 'stop',
          service: this.serviceName,
          success: result.success,
          exitCode: result.exitCode
        });
      }

      if (updateSpec.restart) {
        // Restart service
        const result = await this._restartService(updateSpec.restart);
        changes.push({
          type: 'restart',
          service: this.serviceName,
          success: result.success,
          newPid: result.newPid
        });
      }

      if (updateSpec.configure) {
        // Update service configuration
        const result = await this._configureService(updateSpec.configure);
        changes.push({
          type: 'configure',
          service: this.serviceName,
          success: result.success,
          changedSettings: result.changedSettings
        });
      }

      if (updateSpec.scale) {
        // Scale service instances
        const result = await this._scaleService(updateSpec.scale);
        changes.push({
          type: 'scale',
          service: this.serviceName,
          success: result.success,
          instanceCount: result.instanceCount
        });
      }

      // Invalidate cached data
      this._statusCache.clear();
      this._metadata = null;

      // Notify subscribers of changes
      this._notifySubscribers(changes);

      return {
        success: true,
        changes,
        metadata: {
          service: this.serviceName,
          endpoint: this.endpoint,
          timestamp: Date.now()
        }
      };

    } catch (error) {
      throw new Error(`Service update failed: ${error.message}`);
    }
  }

  /**
   * Validate service data - SYNCHRONOUS
   * @param {*} data - Data to validate
   * @returns {boolean} True if valid
   */
  validate(data) {
    if (data === null || data === undefined) {
      return false;
    }

    // Basic service validation
    if (typeof data === 'object') {
      // Valid service object should have service name and some status
      if (data.service || data.name) {
        return true;
      }
      
      // Health check response
      if (data.healthy !== undefined) {
        return true;
      }
      
      // Process information
      if (data.pid && data.status) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get service metadata - SYNCHRONOUS
   * @returns {Object} Metadata about service resource
   */
  getMetadata() {
    if (!this._metadata) {
      this._metadata = {
        dataSourceType: 'ServiceDataSource',
        serviceName: this.serviceName,
        endpoint: this.endpoint,
        additionalPath: this.additionalPath,
        subscriptionCount: this._subscriptions.size,
        activeConnections: this._connections.size,
        schema: this.getSchema(),
        capabilities: {
          query: false, // Sync query not supported
          queryAsync: true,
          subscribe: true,
          update: false, // Sync update not supported
          updateAsync: true,
          validate: true,
          queryBuilder: true
        },
        cachedStatuses: this._statusCache.size,
        lastModified: Date.now()
      };
    }
    
    return this._metadata;
  }

  /**
   * Create query builder for services - SYNCHRONOUS
   * @param {Handle} sourceHandle - Source Handle
   * @returns {Object} Service query builder
   */
  queryBuilder(sourceHandle) {
    if (!sourceHandle) {
      throw new Error('Source Handle is required for query builder');
    }

    return new ServiceQueryBuilder(sourceHandle, this);
  }

  // Private helper methods

  /**
   * Get service status with caching
   * @returns {Promise<Object>} Service status
   * @private
   */
  async _getServiceStatus() {
    const cacheKey = `${this.serviceName}:status`;
    const cached = this._statusCache.get(cacheKey);
    
    if (cached && this._isStatusCacheValid(cached.timestamp)) {
      return cached.data;
    }

    try {
      // Try multiple methods to determine service status
      let status = { status: 'unknown', uptime: null, lastCheck: Date.now(), metadata: {} };
      
      // Check if it's a known service port
      const serviceConfig = this._getServiceConfig();
      if (serviceConfig && serviceConfig.port) {
        const isListening = await this._checkPortListening(serviceConfig.port);
        status.status = isListening ? 'running' : 'stopped';
        
        if (isListening && serviceConfig.healthEndpoint) {
          try {
            const healthResponse = await this._performHealthCheck();
            status.metadata.health = healthResponse;
          } catch (error) {
            status.metadata.healthError = error.message;
          }
        }
      }
      
      // Check process list for service
      const processes = await this._findServiceProcesses();
      if (processes.length > 0) {
        status.status = 'running';
        status.metadata.processes = processes.length;
        status.uptime = Math.max(...processes.map(p => p.uptime || 0));
      }

      // Cache the result
      this._statusCache.set(cacheKey, {
        data: status,
        timestamp: Date.now()
      });

      return status;
    } catch (error) {
      throw new Error(`Failed to get service status: ${error.message}`);
    }
  }

  /**
   * Perform health check on service
   * @returns {Promise<Object>} Health check result
   * @private
   */
  async _performHealthCheck() {
    const serviceConfig = this._getServiceConfig();
    if (!serviceConfig || !serviceConfig.healthEndpoint) {
      throw new Error('No health endpoint configured for service');
    }

    const startTime = Date.now();
    
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(serviceConfig.healthEndpoint, {
        timeout: 5000,
        method: 'GET'
      });
      
      const responseTime = Date.now() - startTime;
      const responseData = await response.text();
      
      return {
        healthy: response.ok,
        response: responseData,
        responseTime,
        statusCode: response.status,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        healthy: false,
        response: null,
        responseTime: Date.now() - startTime,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get service configuration from ResourceManager
   * @returns {Object|null} Service configuration
   * @private
   */
  _getServiceConfig() {
    // Look for service configuration in ResourceManager
    const services = this.resourceManager.get('services') || {};
    return services[this.serviceName] || null;
  }

  /**
   * Check if port is listening
   * @param {number} port - Port number to check
   * @returns {Promise<boolean>} True if port is listening
   * @private
   */
  async _checkPortListening(port) {
    try {
      const net = await import('net');
      
      return new Promise((resolve) => {
        const socket = new net.Socket();
        
        socket.setTimeout(1000);
        
        socket.on('connect', () => {
          socket.destroy();
          resolve(true);
        });
        
        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });
        
        socket.on('error', () => {
          resolve(false);
        });
        
        socket.connect(port, '127.0.0.1');
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * Find processes related to this service
   * @returns {Promise<Array>} Service processes
   * @private
   */
  async _findServiceProcesses() {
    try {
      const { execSync } = await import('child_process');
      
      // Use ps to find processes matching service name
      const psOutput = execSync(`ps aux | grep -i "${this.serviceName}" | grep -v grep`, { 
        encoding: 'utf8',
        stdio: 'pipe' 
      }).toString();
      
      const processes = [];
      const lines = psOutput.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 11) {
          processes.push({
            user: parts[0],
            pid: parseInt(parts[1]),
            cpu: parseFloat(parts[2]),
            memory: parseFloat(parts[3]),
            command: parts.slice(10).join(' '),
            status: 'running'
          });
        }
      }
      
      return processes;
    } catch (error) {
      // No processes found or ps command failed
      return [];
    }
  }

  /**
   * Check if status cache is valid
   * @param {number} timestamp - Cache timestamp
   * @returns {boolean} True if cache is valid
   * @private
   */
  _isStatusCacheValid(timestamp) {
    return (Date.now() - timestamp) < this._statusCacheTimeout;
  }

  /**
   * Get service metrics
   * @returns {Promise<Object>} Service metrics
   * @private
   */
  async _getServiceMetrics() {
    // This would integrate with monitoring systems like Prometheus, New Relic, etc.
    // For now, return basic process metrics
    const processes = await this._findServiceProcesses();
    
    if (processes.length === 0) {
      return {
        data: { available: false, reason: 'Service not running' },
        timestamp: Date.now()
      };
    }
    
    const totalCpu = processes.reduce((sum, p) => sum + p.cpu, 0);
    const totalMemory = processes.reduce((sum, p) => sum + p.memory, 0);
    
    return {
      data: {
        processCount: processes.length,
        totalCpuPercent: totalCpu,
        totalMemoryPercent: totalMemory,
        processes: processes.map(p => ({
          pid: p.pid,
          cpu: p.cpu,
          memory: p.memory
        }))
      },
      timestamp: Date.now()
    };
  }

  /**
   * Get service logs
   * @param {Object} options - Log options
   * @returns {Promise<Array>} Service logs
   * @private
   */
  async _getServiceLogs(options = {}) {
    const { lines = 100, level = null, since = null } = options;
    
    // This would integrate with logging systems
    // For now, try to read from common log locations
    const logs = [];
    
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Common log file locations
      const logPaths = [
        `/var/log/${this.serviceName}.log`,
        `/var/log/${this.serviceName}/${this.serviceName}.log`,
        `./logs/${this.serviceName}.log`,
        `./log/${this.serviceName}.log`
      ];
      
      for (const logPath of logPaths) {
        try {
          const content = await fs.readFile(logPath, 'utf8');
          const logLines = content.split('\n')
            .filter(line => line.trim())
            .slice(-lines)
            .map(line => this._parseLogLine(line));
          
          logs.push(...logLines);
          break; // Found logs, stop looking
        } catch (error) {
          // Log file doesn't exist or can't be read, try next
          continue;
        }
      }
      
      return logs;
    } catch (error) {
      // Return empty logs if we can't access any
      return [];
    }
  }

  /**
   * Parse log line into structured format
   * @param {string} line - Log line
   * @returns {Object} Parsed log entry
   * @private
   */
  _parseLogLine(line) {
    // Basic log parsing - would be enhanced for specific log formats
    const timestamp = new Date();
    let level = 'info';
    let message = line;
    
    // Try to extract timestamp and level
    const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/);
    if (timestampMatch) {
      timestamp = new Date(timestampMatch[1]);
      message = line.substring(timestampMatch[0].length).trim();
    }
    
    const levelMatch = message.match(/^\[?(\w+)\]?\s*/i);
    if (levelMatch) {
      level = levelMatch[1].toLowerCase();
      message = message.substring(levelMatch[0].length);
    }
    
    return {
      timestamp,
      level,
      message,
      metadata: {}
    };
  }

  /**
   * Get service processes
   * @returns {Promise<Array>} Service processes with detailed info
   * @private
   */
  async _getServiceProcesses() {
    return this._findServiceProcesses();
  }

  /**
   * Discover available services
   * @returns {Promise<Array>} Available services
   * @private
   */
  async _discoverServices() {
    const services = [];
    
    try {
      // Check ResourceManager for configured services
      const configuredServices = this.resourceManager.get('services') || {};
      
      for (const [name, config] of Object.entries(configuredServices)) {
        const status = await this._getServiceStatusByName(name);
        services.push({
          name,
          type: config.type || 'unknown',
          port: config.port,
          status: status.status,
          url: config.port ? `http://localhost:${config.port}` : null
        });
      }
      
      // TODO: Add auto-discovery of running services by scanning ports
      
      return services;
    } catch (error) {
      throw new Error(`Service discovery failed: ${error.message}`);
    }
  }

  /**
   * Get status for specific service name
   * @param {string} serviceName - Service name
   * @returns {Promise<Object>} Service status
   * @private
   */
  async _getServiceStatusByName(serviceName) {
    const originalServiceName = this.serviceName;
    this.serviceName = serviceName;
    
    try {
      const status = await this._getServiceStatus();
      return status;
    } finally {
      this.serviceName = originalServiceName;
    }
  }

  /**
   * Start service monitoring for subscription
   * @param {string} subscriptionId - Subscription ID
   * @param {Object} querySpec - Query specification
   * @param {Function} callback - Change callback
   * @private
   */
  async _startServiceMonitoring(subscriptionId, querySpec, callback) {
    try {
      // Set up periodic monitoring based on query type
      let interval;
      
      if (querySpec.status || querySpec.health) {
        // Monitor service status/health every 30 seconds
        interval = setInterval(async () => {
          try {
            let result;
            if (querySpec.status) {
              result = await this._getServiceStatus();
            } else {
              result = await this._performHealthCheck();
            }
            
            callback([{
              type: 'status_change',
              service: this.serviceName,
              timestamp: Date.now(),
              data: result
            }]);
          } catch (error) {
            console.warn('Service monitoring failed:', error);
          }
        }, 30000);
        
      } else if (querySpec.processes) {
        // Monitor processes every 10 seconds
        interval = setInterval(async () => {
          try {
            const processes = await this._getServiceProcesses();
            callback([{
              type: 'process_change',
              service: this.serviceName,
              timestamp: Date.now(),
              processes
            }]);
          } catch (error) {
            console.warn('Process monitoring failed:', error);
          }
        }, 10000);
      }
      
      if (interval) {
        this._subscriptions.get(subscriptionId).interval = interval;
      }
      
    } catch (error) {
      console.warn(`Failed to start service monitoring for subscription ${subscriptionId}:`, error);
    }
  }

  /**
   * Stop service monitoring for subscription
   * @param {string} subscriptionId - Subscription ID
   * @private
   */
  _stopServiceMonitoring(subscriptionId) {
    const subscription = this._subscriptions.get(subscriptionId);
    if (subscription && subscription.interval) {
      clearInterval(subscription.interval);
    }
  }

  /**
   * Start service
   * @param {Object} config - Start configuration
   * @returns {Promise<Object>} Start result
   * @private
   */
  async _startService(config) {
    // This would integrate with process managers like PM2, systemd, etc.
    throw new Error('Service start not implemented - integrate with process manager');
  }

  /**
   * Stop service
   * @param {Object} config - Stop configuration
   * @returns {Promise<Object>} Stop result
   * @private
   */
  async _stopService(config) {
    // This would integrate with process managers
    throw new Error('Service stop not implemented - integrate with process manager');
  }

  /**
   * Restart service
   * @param {Object} config - Restart configuration
   * @returns {Promise<Object>} Restart result
   * @private
   */
  async _restartService(config) {
    // This would integrate with process managers
    throw new Error('Service restart not implemented - integrate with process manager');
  }

  /**
   * Configure service
   * @param {Object} config - Configuration settings
   * @returns {Promise<Object>} Configuration result
   * @private
   */
  async _configureService(config) {
    // This would update service configuration files
    throw new Error('Service configuration not implemented');
  }

  /**
   * Scale service instances
   * @param {Object} config - Scale configuration
   * @returns {Promise<Object>} Scale result
   * @private
   */
  async _scaleService(config) {
    // This would integrate with container orchestrators
    throw new Error('Service scaling not implemented - integrate with orchestrator');
  }

  /**
   * Generate service schema
   * @returns {Object} Service schema
   * @private
   */
  _generateServiceSchema() {
    return {
      version: '1.0.0',
      type: 'service',
      serviceName: this.serviceName,
      endpoint: this.endpoint,
      attributes: {
        name: {
          type: 'string',
          required: true,
          description: 'Service name'
        },
        status: {
          type: 'string',
          enum: ['running', 'stopped', 'starting', 'stopping', 'unknown'],
          description: 'Service status'
        },
        port: {
          type: 'number',
          description: 'Service port number'
        },
        health: {
          type: 'object',
          description: 'Service health information'
        },
        uptime: {
          type: 'number',
          description: 'Service uptime in milliseconds'
        }
      },
      relationships: {},
      constraints: {
        requiredFields: ['name', 'status']
      },
      capabilities: [
        'status', 'health', 'metrics', 'logs', 'processes',
        'start', 'stop', 'restart', 'configure', 'scale'
      ]
    };
  }

  /**
   * Notify subscribers of changes
   * @param {Array} changes - Array of change objects
   * @private
   */
  _notifySubscribers(changes) {
    for (const subscription of this._subscriptions.values()) {
      try {
        subscription.callback(changes);
      } catch (error) {
        console.warn('Service change notification failed:', error);
      }
    }
  }

  /**
   * Cleanup and close monitoring
   */
  async shutdown() {
    // Stop all monitoring intervals
    for (const [subscriptionId] of this._subscriptions) {
      this._stopServiceMonitoring(subscriptionId);
    }

    // Clear subscriptions
    this._subscriptions.clear();
    this._connections.clear();
    this._healthChecks.clear();

    // Clear cached data
    this._statusCache.clear();
    this._metadata = null;
  }
}

/**
 * Service-specific query builder
 */
class ServiceQueryBuilder {
  constructor(sourceHandle, dataSource) {
    this._sourceHandle = sourceHandle;
    this._dataSource = dataSource;
    this._operations = [];
    this._options = {};
  }

  /**
   * Query service status
   * @returns {ServiceQueryBuilder} Query builder for chaining
   */
  status() {
    this._operations.push({ type: 'status' });
    return this;
  }

  /**
   * Query service health
   * @returns {ServiceQueryBuilder} Query builder for chaining
   */
  health() {
    this._operations.push({ type: 'health' });
    return this;
  }

  /**
   * Query service metrics
   * @returns {ServiceQueryBuilder} Query builder for chaining
   */
  metrics() {
    this._operations.push({ type: 'metrics' });
    return this;
  }

  /**
   * Query service logs
   * @param {Object} options - Log options (lines, level, since)
   * @returns {ServiceQueryBuilder} Query builder for chaining
   */
  logs(options = {}) {
    this._operations.push({ type: 'logs', options });
    return this;
  }

  /**
   * Query service processes
   * @returns {ServiceQueryBuilder} Query builder for chaining
   */
  processes() {
    this._operations.push({ type: 'processes' });
    return this;
  }

  /**
   * Execute query and return first result
   * @returns {Promise<Object>} First query result
   */
  async first() {
    const querySpec = this._buildQuerySpec();
    const results = await this._dataSource.queryAsync(querySpec);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Execute query and return all results
   * @returns {Promise<Array>} All query results
   */
  async toArray() {
    const querySpec = this._buildQuerySpec();
    const results = await this._dataSource.queryAsync(querySpec);
    return results;
  }

  /**
   * Count query results
   * @returns {Promise<number>} Count of results
   */
  async count() {
    const results = await this.toArray();
    return results.length;
  }

  /**
   * Build query specification from operations
   * @returns {Object} Query specification
   * @private
   */
  _buildQuerySpec() {
    if (this._operations.length === 0) {
      return { status: true };
    }

    const querySpec = { ...this._options };
    
    for (const operation of this._operations) {
      switch (operation.type) {
        case 'status':
          querySpec.status = true;
          break;
        case 'health':
          querySpec.health = true;
          break;
        case 'metrics':
          querySpec.metrics = true;
          break;
        case 'logs':
          querySpec.logs = operation.options;
          break;
        case 'processes':
          querySpec.processes = true;
          break;
      }
    }

    return querySpec;
  }
}

export default ServiceDataSource;