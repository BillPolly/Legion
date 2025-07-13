import DependencyGraph from '../base/DependencyGraph.js';
import { RESOURCE_STATUS } from '../base/ResourceStatus.js';

/**
 * ProcessOrchestrator manages the startup and shutdown of multiple processes
 * Handles dependency ordering, parallel execution, and error recovery
 */
class ProcessOrchestrator {
  constructor() {
    this.processes = new Map();
    this.dependencyGraph = new DependencyGraph();
    this.isStarting = false;
    this.isStopping = false;
    this.startupPromise = null;
    this.shutdownPromise = null;
    this.eventHandlers = new Map();
  }

  /**
   * Register a process with the orchestrator
   * @param {string} name - Process name
   * @param {ProcessResource} processResource - Process resource instance
   * @param {string[]} dependencies - Array of dependency process names
   */
  registerProcess(name, processResource, dependencies = []) {
    if (this.processes.has(name)) {
      throw new Error(`Process '${name}' is already registered`);
    }

    this.processes.set(name, {
      resource: processResource,
      dependencies,
      startTime: null,
      errorCount: 0
    });

    // Add to dependency graph
    this.dependencyGraph.addResource(name, dependencies);

    console.log(`Registered process '${name}' with dependencies: [${dependencies.join(', ')}]`);
  }

  /**
   * Unregister a process
   * @param {string} name - Process name
   */
  unregisterProcess(name) {
    if (!this.processes.has(name)) {
      return false;
    }

    this.processes.delete(name);
    this.dependencyGraph.removeResource(name);
    
    console.log(`Unregistered process '${name}'`);
    return true;
  }

  /**
   * Start all processes in dependency order
   * @param {Object} options - Startup options
   * @returns {Promise<Object>} Startup results
   */
  async startAll(options = {}) {
    if (this.isStarting) {
      return this.startupPromise;
    }

    const {
      parallel = true,
      timeout = 300000, // 5 minutes
      stopOnError = false
    } = options;

    this.isStarting = true;
    this.startupPromise = this._executeStartup(parallel, timeout, stopOnError);

    try {
      return await this.startupPromise;
    } finally {
      this.isStarting = false;
      this.startupPromise = null;
    }
  }

  /**
   * Execute the startup process
   * @private
   */
  async _executeStartup(parallel, timeout, stopOnError) {
    const startTime = Date.now();
    const results = new Map();
    
    try {
      // Get startup order
      const startupOrder = this.dependencyGraph.getStartupOrder();
      console.log(`Starting processes in order: [${startupOrder.join(', ')}]`);

      this.emit('startup:begin', { order: startupOrder });

      if (parallel) {
        await this._startupParallel(startupOrder, results, timeout, stopOnError);
      } else {
        await this._startupSequential(startupOrder, results, timeout, stopOnError);
      }

      const duration = Date.now() - startTime;
      const summary = this._createStartupSummary(results, duration);
      
      this.emit('startup:complete', summary);
      return summary;

    } catch (error) {
      const duration = Date.now() - startTime;
      const summary = this._createStartupSummary(results, duration, error);
      
      this.emit('startup:error', summary);
      throw error;
    }
  }

  /**
   * Start processes in parallel groups respecting dependencies
   * @private
   */
  async _startupParallel(startupOrder, results, timeout, stopOnError) {
    const completed = new Set();
    const inProgress = new Map();
    
    // Group processes by dependency level
    const dependencyLevels = this._groupByDependencyLevel(startupOrder);
    
    for (const level of dependencyLevels) {
      console.log(`Starting dependency level: [${level.join(', ')}]`);
      
      // Start all processes in this level in parallel
      const levelPromises = level.map(async (processName) => {
        return this._startSingleProcess(processName, results, timeout);
      });

      // Wait for all processes in this level to complete
      const levelResults = await Promise.allSettled(levelPromises);
      
      // Check results
      for (let i = 0; i < levelResults.length; i++) {
        const processName = level[i];
        const result = levelResults[i];
        
        if (result.status === 'fulfilled') {
          completed.add(processName);
        } else {
          results.set(processName, {
            success: false,
            error: result.reason,
            duration: 0
          });
          
          if (stopOnError) {
            throw new Error(`Failed to start process '${processName}': ${result.reason}`);
          }
        }
      }
    }
  }

  /**
   * Start processes sequentially
   * @private
   */
  async _startupSequential(startupOrder, results, timeout, stopOnError) {
    for (const processName of startupOrder) {
      try {
        await this._startSingleProcess(processName, results, timeout);
      } catch (error) {
        if (stopOnError) {
          throw error;
        }
        console.error(`Failed to start process '${processName}':`, error);
      }
    }
  }

  /**
   * Start a single process
   * @private
   */
  async _startSingleProcess(processName, results, timeout) {
    const processInfo = this.processes.get(processName);
    if (!processInfo) {
      throw new Error(`Process '${processName}' not registered`);
    }

    const startTime = Date.now();
    
    try {
      console.log(`Starting process '${processName}'...`);
      this.emit('process:starting', { name: processName });

      // Set timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Process '${processName}' startup timeout after ${timeout}ms`));
        }, timeout);
      });

      // Start the process with timeout
      await Promise.race([
        processInfo.resource.initialize(),
        timeoutPromise
      ]);

      const duration = Date.now() - startTime;
      processInfo.startTime = new Date();
      
      results.set(processName, {
        success: true,
        duration,
        pid: processInfo.resource.childProcess?.pid
      });

      console.log(`✓ Process '${processName}' started successfully (${duration}ms)`);
      this.emit('process:started', { name: processName, duration });

    } catch (error) {
      const duration = Date.now() - startTime;
      processInfo.errorCount++;
      
      results.set(processName, {
        success: false,
        error: error.message,
        duration
      });

      console.error(`✗ Process '${processName}' failed to start (${duration}ms):`, error.message);
      this.emit('process:failed', { name: processName, error: error.message, duration });
      
      throw error;
    }
  }

  /**
   * Group processes by dependency level for parallel startup
   * @private
   */
  _groupByDependencyLevel(startupOrder) {
    const levels = [];
    const processed = new Set();
    
    for (const processName of startupOrder) {
      if (processed.has(processName)) continue;
      
      // Find all processes that can start at the same time
      const level = [];
      const remainingProcesses = startupOrder.filter(p => !processed.has(p));
      
      for (const candidate of remainingProcesses) {
        const dependencies = this.dependencyGraph.getDependencies(candidate);
        const dependenciesSatisfied = dependencies.every(dep => processed.has(dep));
        
        if (dependenciesSatisfied) {
          level.push(candidate);
          processed.add(candidate);
        }
      }
      
      if (level.length > 0) {
        levels.push(level);
      }
    }
    
    return levels;
  }

  /**
   * Stop all processes in reverse dependency order
   * @param {Object} options - Shutdown options
   * @returns {Promise<Object>} Shutdown results
   */
  async stopAll(options = {}) {
    if (this.isStopping) {
      return this.shutdownPromise;
    }

    const {
      timeout = 60000, // 1 minute
      force = false
    } = options;

    this.isStopping = true;
    this.shutdownPromise = this._executeShutdown(timeout, force);

    try {
      return await this.shutdownPromise;
    } finally {
      this.isStopping = false;
      this.shutdownPromise = null;
    }
  }

  /**
   * Execute the shutdown process
   * @private
   */
  async _executeShutdown(timeout, force) {
    const startTime = Date.now();
    const results = new Map();
    
    try {
      // Get shutdown order (reverse of startup)
      const shutdownOrder = this.dependencyGraph.getShutdownOrder();
      console.log(`Stopping processes in order: [${shutdownOrder.join(', ')}]`);

      this.emit('shutdown:begin', { order: shutdownOrder });

      // Stop processes sequentially to respect dependencies
      for (const processName of shutdownOrder) {
        const processInfo = this.processes.get(processName);
        if (!processInfo || processInfo.resource.status === RESOURCE_STATUS.STOPPED) {
          continue;
        }

        try {
          await this._stopSingleProcess(processName, results, timeout, force);
        } catch (error) {
          console.error(`Error stopping process '${processName}':`, error);
          results.set(processName, {
            success: false,
            error: error.message,
            duration: 0
          });
        }
      }

      const duration = Date.now() - startTime;
      const summary = this._createShutdownSummary(results, duration);
      
      this.emit('shutdown:complete', summary);
      return summary;

    } catch (error) {
      const duration = Date.now() - startTime;
      const summary = this._createShutdownSummary(results, duration, error);
      
      this.emit('shutdown:error', summary);
      throw error;
    }
  }

  /**
   * Stop a single process
   * @private
   */
  async _stopSingleProcess(processName, results, timeout, force) {
    const processInfo = this.processes.get(processName);
    const startTime = Date.now();
    
    try {
      console.log(`Stopping process '${processName}'...`);
      this.emit('process:stopping', { name: processName });

      if (force) {
        // Force stop
        if (processInfo.resource.childProcess) {
          processInfo.resource.childProcess.kill('SIGKILL');
        }
      } else {
        // Graceful stop with timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Process '${processName}' shutdown timeout after ${timeout}ms`));
          }, timeout);
        });

        await Promise.race([
          processInfo.resource.cleanup(),
          timeoutPromise
        ]);
      }

      const duration = Date.now() - startTime;
      results.set(processName, {
        success: true,
        duration
      });

      console.log(`✓ Process '${processName}' stopped successfully (${duration}ms)`);
      this.emit('process:stopped', { name: processName, duration });

    } catch (error) {
      const duration = Date.now() - startTime;
      results.set(processName, {
        success: false,
        error: error.message,
        duration
      });

      console.error(`✗ Process '${processName}' failed to stop (${duration}ms):`, error.message);
      this.emit('process:stop_failed', { name: processName, error: error.message, duration });
      
      throw error;
    }
  }

  /**
   * Restart a specific process and its dependents
   * @param {string} processName - Process to restart
   * @param {Object} options - Restart options
   */
  async restartProcess(processName, options = {}) {
    if (!this.processes.has(processName)) {
      throw new Error(`Process '${processName}' not registered`);
    }

    const { restartDependents = true } = options;
    
    // Get processes that need to be restarted
    const processesToRestart = [processName];
    if (restartDependents) {
      const dependents = this.dependencyGraph.getDependents(processName);
      processesToRestart.push(...dependents);
    }

    console.log(`Restarting processes: [${processesToRestart.join(', ')}]`);

    // Stop processes in reverse dependency order
    const stopOrder = [...processesToRestart].reverse();
    for (const name of stopOrder) {
      const processInfo = this.processes.get(name);
      if (processInfo && processInfo.resource.status === RESOURCE_STATUS.RUNNING) {
        await processInfo.resource.cleanup();
      }
    }

    // Start processes in dependency order
    for (const name of processesToRestart) {
      const processInfo = this.processes.get(name);
      if (processInfo) {
        await processInfo.resource.initialize();
        processInfo.startTime = new Date();
      }
    }

    return { restarted: processesToRestart };
  }

  /**
   * Get status of all processes
   */
  getStatus() {
    const processes = {};
    
    for (const [name, processInfo] of this.processes) {
      processes[name] = {
        status: processInfo.resource.status,
        startTime: processInfo.startTime,
        errorCount: processInfo.errorCount,
        dependencies: this.dependencyGraph.getDependencies(name),
        dependents: this.dependencyGraph.getDependents(name),
        resource: processInfo.resource.getDetailedStatus()
      };
    }

    return {
      isStarting: this.isStarting,
      isStopping: this.isStopping,
      processCount: this.processes.size,
      processes,
      dependencyGraph: this.dependencyGraph.getStatistics()
    };
  }

  /**
   * Create startup summary
   * @private
   */
  _createStartupSummary(results, duration, error = null) {
    const successful = [];
    const failed = [];
    
    for (const [name, result] of results) {
      if (result.success) {
        successful.push(name);
      } else {
        failed.push({ name, error: result.error });
      }
    }

    return {
      success: !error && failed.length === 0,
      duration,
      totalProcesses: this.processes.size,
      successful,
      failed,
      error: error?.message
    };
  }

  /**
   * Create shutdown summary
   * @private
   */
  _createShutdownSummary(results, duration, error = null) {
    return this._createStartupSummary(results, duration, error);
  }

  /**
   * Add event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event).add(handler);
  }

  /**
   * Remove event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).delete(handler);
    }
  }

  /**
   * Emit event
   * @private
   */
  emit(event, data) {
    if (this.eventHandlers.has(event)) {
      for (const handler of this.eventHandlers.get(event)) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for '${event}':`, error);
        }
      }
    }
  }

  /**
   * Clear all registered processes
   */
  clear() {
    this.processes.clear();
    this.dependencyGraph.clear();
  }

  /**
   * Get dependency graph visualization
   */
  getDependencyGraph() {
    return this.dependencyGraph;
  }
}

export default ProcessOrchestrator;