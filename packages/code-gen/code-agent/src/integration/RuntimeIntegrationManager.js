/**
 * RuntimeIntegrationManager - Central orchestrator for runtime testing components
 * 
 * Coordinates log-manager, node-runner, and playwright for comprehensive testing
 */

import { EventEmitter } from 'events';
import { RuntimeConfig } from '../config/RuntimeConfig.js';

/**
 * RuntimeIntegrationManager class
 */
class RuntimeIntegrationManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Initialize configuration
    this.runtimeConfig = new RuntimeConfig(config);
    this.config = this.runtimeConfig.getConfig();
    
    // Initialize component references
    this.logManager = null;
    this.nodeRunner = null;
    this.playwright = null;
    
    // State management
    this.isInitialized = false;
    this.activeProcesses = new Map();
    this.activeSessions = new Map();
    this.resourceMetrics = {
      memory: 0,
      cpu: 0,
      processes: 0,
      sessions: 0
    };
    
    // Error handling
    this.errorHistory = [];
    this.maxErrorHistory = 100;
    
    // Performance tracking
    this.performanceMetrics = {
      operationCount: 0,
      totalOperationTime: 0,
      averageOperationTime: 0,
      lastOperationTime: 0
    };
    
    // Validation
    this.validateConfiguration();
  }

  /**
   * Validate configuration on construction
   */
  validateConfiguration() {
    if (!this.config) {
      throw new Error('RuntimeIntegrationManager requires configuration');
    }
    
    // Validate required configuration sections
    const requiredSections = ['logManager', 'nodeRunner', 'playwright', 'integration'];
    for (const section of requiredSections) {
      if (!this.config[section]) {
        throw new Error(`Missing required configuration section: ${section}`);
      }
    }
  }

  /**
   * Initialize all runtime components
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    this.emit('initialization-started', { timestamp: new Date().toISOString() });

    try {
      // Initialize components in order
      await this.initializeLogManager();
      await this.initializeNodeRunner();
      await this.initializePlaywright();
      
      // Set up cross-component communication
      await this.setupCrossComponentCommunication();
      
      // Start monitoring
      await this.startResourceMonitoring();
      
      this.isInitialized = true;
      this.emit('initialization-complete', { 
        timestamp: new Date().toISOString(),
        components: {
          logManager: !!this.logManager,
          nodeRunner: !!this.nodeRunner,
          playwright: !!this.playwright
        }
      });
      
    } catch (error) {
      this.recordError(error, 'initialization');
      this.emit('initialization-failed', { 
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Initialize log-manager component
   */
  async initializeLogManager() {
    try {
      // For now, create a mock log manager - will be replaced with real implementation
      this.logManager = {
        initialize: async () => true,
        attachToProcess: async (process) => ({ processId: process.pid }),
        captureLogs: async (source) => ({ logs: [], source }),
        analyzeLogs: async (logs) => ({ errors: [], warnings: [], insights: [] }),
        getLogsByProcess: async (processId) => ({ logs: [], processId }),
        cleanup: async () => true
      };
      
      await this.logManager.initialize();
      
      this.emit('component-initialized', { 
        component: 'logManager',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      throw new Error(`Failed to initialize log-manager: ${error.message}`);
    }
  }

  /**
   * Initialize node-runner component
   */
  async initializeNodeRunner() {
    try {
      // For now, create a mock node runner - will be replaced with real implementation
      this.nodeRunner = {
        initialize: async () => true,
        startServer: async (config) => ({ 
          pid: Math.floor(Math.random() * 10000),
          port: config.port || 3000,
          status: 'running'
        }),
        runTests: async (config) => ({ 
          success: true,
          results: { passed: 5, failed: 0, coverage: 85 }
        }),
        executeCommand: async (command, args) => ({ 
          success: true,
          output: `Executed: ${command} ${args.join(' ')}`,
          exitCode: 0
        }),
        stopProcess: async (pid) => ({ success: true, pid }),
        cleanup: async () => true
      };
      
      await this.nodeRunner.initialize();
      
      this.emit('component-initialized', { 
        component: 'nodeRunner',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      throw new Error(`Failed to initialize node-runner: ${error.message}`);
    }
  }

  /**
   * Initialize playwright component
   */
  async initializePlaywright() {
    try {
      // For now, create a mock playwright - will be replaced with real implementation
      this.playwright = {
        initialize: async () => true,
        launchBrowser: async (config) => ({ 
          id: Math.random().toString(36).substr(2, 9),
          type: config?.browserType || 'chromium',
          status: 'running'
        }),
        executeTests: async (browser, tests) => ({ 
          success: true,
          results: { passed: 3, failed: 0, screenshots: [] }
        }),
        takeScreenshot: async (page) => ({ 
          success: true,
          screenshot: 'base64-encoded-screenshot',
          timestamp: new Date().toISOString()
        }),
        closeBrowser: async (browser) => ({ success: true, browserId: browser.id }),
        cleanup: async () => true
      };
      
      await this.playwright.initialize();
      
      this.emit('component-initialized', { 
        component: 'playwright',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      throw new Error(`Failed to initialize playwright: ${error.message}`);
    }
  }

  /**
   * Set up cross-component communication
   */
  async setupCrossComponentCommunication() {
    if (!this.config.integration.enableCrossComponentLogging) {
      return;
    }

    // Set up event forwarding between components
    this.on('process-started', (event) => {
      if (this.logManager) {
        this.logManager.attachToProcess(event.process);
      }
    });

    this.on('browser-launched', (event) => {
      if (this.logManager) {
        this.logManager.captureLogs(`browser-${event.browser.id}`);
      }
    });

    this.emit('cross-component-communication-setup', { 
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Start resource monitoring
   */
  async startResourceMonitoring() {
    if (!this.config.integration.enableResourceTracking) {
      return;
    }

    // Start periodic resource monitoring
    this.resourceMonitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.collectResourceMetrics();
        this.resourceMetrics = metrics;
        this.emit('resource-metrics-updated', { metrics, timestamp: new Date().toISOString() });
      } catch (error) {
        this.recordError(error, 'resource-monitoring');
      }
    }, 5000);
  }

  /**
   * Execute process with comprehensive logging
   */
  async executeWithLogging(processConfig) {
    this.assertInitialized();
    
    const operationStart = Date.now();
    const operationId = Math.random().toString(36).substr(2, 9);
    
    try {
      this.emit('operation-started', { 
        operationId,
        operation: 'executeWithLogging',
        config: processConfig,
        timestamp: new Date().toISOString()
      });

      // Start process using node-runner
      const process = await this.nodeRunner.executeCommand(
        processConfig.command,
        processConfig.args || []
      );
      
      // Track active process
      this.activeProcesses.set(operationId, process);
      
      // Attach log capture
      let logs = [];
      if (this.logManager) {
        const logResult = await this.logManager.captureLogs(operationId);
        logs = logResult.logs;
      }
      
      // Update performance metrics
      const operationTime = Date.now() - operationStart;
      this.updatePerformanceMetrics(operationTime);
      
      const result = {
        success: process.success,
        processId: operationId,
        logs: logs,
        output: process.output,
        duration: operationTime,
        timestamp: new Date().toISOString()
      };
      
      this.emit('operation-completed', { 
        operationId,
        result,
        timestamp: new Date().toISOString()
      });
      
      return result;
      
    } catch (error) {
      const operationTime = Date.now() - operationStart;
      this.updatePerformanceMetrics(operationTime);
      this.recordError(error, 'executeWithLogging', { operationId, processConfig });
      
      const result = {
        success: false,
        error: error.message,
        processId: operationId,
        logs: [],
        duration: operationTime,
        timestamp: new Date().toISOString()
      };
      
      this.emit('operation-failed', { 
        operationId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      return result;
    } finally {
      // Clean up active process
      this.activeProcesses.delete(operationId);
    }
  }

  /**
   * Start a process and return handle
   */
  async startProcess(processConfig) {
    this.assertInitialized();
    
    const process = await this.nodeRunner.executeCommand(
      processConfig.command,
      processConfig.args || []
    );
    
    const processId = Math.random().toString(36).substr(2, 9);
    this.activeProcesses.set(processId, process);
    
    this.emit('process-started', { 
      processId,
      process,
      timestamp: new Date().toISOString()
    });
    
    return { processId, ...process };
  }

  /**
   * Aggregate results from multiple components
   */
  async aggregateResults(testResults) {
    const aggregated = {
      overall: {
        success: true,
        score: 0,
        issues: []
      },
      components: testResults,
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        coverage: 0,
        errors: 0,
        warnings: 0
      },
      timestamp: new Date().toISOString()
    };
    
    // Aggregate Jest results
    if (testResults.jest) {
      aggregated.summary.totalTests += testResults.jest.passed + testResults.jest.failed;
      aggregated.summary.passedTests += testResults.jest.passed;
      aggregated.summary.failedTests += testResults.jest.failed;
      aggregated.summary.coverage = testResults.jest.coverage;
      
      if (testResults.jest.failed > 0) {
        aggregated.overall.success = false;
        aggregated.overall.issues.push('Jest tests failed');
      }
    }
    
    // Aggregate ESLint results
    if (testResults.eslint) {
      aggregated.summary.errors += testResults.eslint.errors;
      aggregated.summary.warnings += testResults.eslint.warnings;
      
      if (testResults.eslint.errors > 0) {
        aggregated.overall.success = false;
        aggregated.overall.issues.push('ESLint errors found');
      }
    }
    
    // Aggregate browser results
    if (testResults.browser) {
      aggregated.summary.totalTests += testResults.browser.passed + testResults.browser.failed;
      aggregated.summary.passedTests += testResults.browser.passed;
      aggregated.summary.failedTests += testResults.browser.failed;
      
      if (testResults.browser.failed > 0) {
        aggregated.overall.success = false;
        aggregated.overall.issues.push('Browser tests failed');
      }
    }
    
    // Calculate overall score
    if (aggregated.summary.totalTests > 0) {
      aggregated.overall.score = Math.round(
        (aggregated.summary.passedTests / aggregated.summary.totalTests) * 100
      );
    }
    
    return aggregated;
  }

  /**
   * Get count of active processes
   */
  getActiveProcessCount() {
    return this.activeProcesses.size;
  }

  /**
   * Get current resource metrics
   */
  async getResourceMetrics() {
    return await this.collectResourceMetrics();
  }

  /**
   * Collect current resource metrics
   */
  async collectResourceMetrics() {
    const metrics = {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      activeProcesses: this.activeProcesses.size,
      activeSessions: this.activeSessions.size,
      timestamp: new Date().toISOString()
    };
    
    return metrics;
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(operationTime) {
    this.performanceMetrics.operationCount++;
    this.performanceMetrics.totalOperationTime += operationTime;
    this.performanceMetrics.averageOperationTime = 
      this.performanceMetrics.totalOperationTime / this.performanceMetrics.operationCount;
    this.performanceMetrics.lastOperationTime = operationTime;
  }

  /**
   * Record error with context
   */
  recordError(error, context, additionalInfo = {}) {
    const errorRecord = {
      message: error.message,
      stack: error.stack,
      context,
      additionalInfo,
      timestamp: new Date().toISOString()
    };
    
    this.errorHistory.push(errorRecord);
    
    // Keep error history within limits
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory.shift();
    }
    
    this.emit('error-recorded', errorRecord);
  }

  /**
   * Assert that manager is initialized
   */
  assertInitialized() {
    if (!this.isInitialized) {
      throw new Error('RuntimeIntegrationManager is not initialized. Call initialize() first.');
    }
  }

  /**
   * Clean up all resources
   */
  async cleanup() {
    this.emit('cleanup-started', { timestamp: new Date().toISOString() });
    
    try {
      // Stop resource monitoring
      if (this.resourceMonitoringInterval) {
        clearInterval(this.resourceMonitoringInterval);
        this.resourceMonitoringInterval = null;
      }
      
      // Clean up active processes
      const processCleanupPromises = Array.from(this.activeProcesses.entries()).map(
        async ([processId, process]) => {
          try {
            if (this.nodeRunner && process.pid) {
              await this.nodeRunner.stopProcess(process.pid);
            }
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      );
      
      await Promise.all(processCleanupPromises);
      this.activeProcesses.clear();
      
      // Clean up sessions
      this.activeSessions.clear();
      
      // Clean up components
      if (this.logManager) {
        await this.logManager.cleanup();
      }
      
      if (this.nodeRunner) {
        await this.nodeRunner.cleanup();
      }
      
      if (this.playwright) {
        await this.playwright.cleanup();
      }
      
      this.isInitialized = false;
      
      this.emit('cleanup-complete', { timestamp: new Date().toISOString() });
      
    } catch (error) {
      this.recordError(error, 'cleanup');
      this.emit('cleanup-failed', { 
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

export { RuntimeIntegrationManager };