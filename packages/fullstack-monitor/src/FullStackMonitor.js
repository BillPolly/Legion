/**
 * FullStackMonitor - Orchestrates browser and backend monitoring for complete observability
 * Combines log-manager and browser-monitor to provide unified debugging capabilities
 */

import { EventEmitter } from 'events';
import { LegionLogManager } from '@legion/log-manager';
import { BrowserMonitor } from '@legion/browser-monitor';
import net from 'net';

export class FullStackMonitor extends EventEmitter {
  constructor(config) {
    super();
    
    this.resourceManager = config.resourceManager;
    this.logManager = config.logManager;
    this.browserMonitor = config.browserMonitor;
    this.session = config.session;
    
    // Correlation tracking
    this.correlations = new Map();
    this.correlationIndex = new Map(); // Map correlation IDs to related data
    
    // Active monitoring
    this.activeBackends = new Map();
    this.activeBrowsers = new Map();
    
    // Statistics
    this.stats = {
      correlationsDetected: 0,
      debugScenariosRun: 0,
      totalStepsExecuted: 0,
      startTime: new Date()
    };
  }
  
  /**
   * Create FullStackMonitor instance using async factory pattern
   */
  static async create(resourceManager) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    
    // Initialize both monitors
    const logManager = await LegionLogManager.create(resourceManager);
    const browserMonitor = await BrowserMonitor.create(resourceManager);
    
    // Create unified session
    const session = await logManager.createSession({
      name: 'fullstack-monitoring',
      type: 'fullstack',
      metadata: {
        startTime: new Date(),
        monitors: ['log-manager', 'browser-monitor']
      }
    });
    
    const monitor = new FullStackMonitor({
      resourceManager,
      logManager,
      browserMonitor,
      session: {
        id: session.sessionId,
        type: 'fullstack',
        ...session
      }
    });
    
    await monitor.initialize();
    return monitor;
  }
  
  /**
   * Initialize the full-stack monitor
   */
  async initialize() {
    // Set up event forwarding from browser monitor
    this.browserMonitor.on('console-message', (data) => {
      this.handleBrowserConsole(data);
      this.emit('browser-console', data);
    });
    
    this.browserMonitor.on('network-request', (data) => {
      this.handleNetworkRequest(data);
      this.emit('browser-request', data);
    });
    
    this.browserMonitor.on('network-response', (data) => {
      this.handleNetworkResponse(data);
      this.emit('browser-response', data);
    });
    
    this.browserMonitor.on('page-error', (data) => {
      this.emit('browser-error', data);
    });
    
    // Set up event forwarding from log manager
    this.logManager.on('log', (data) => {
      this.handleBackendLog(data);
      this.emit('backend-log', data);
    });
    
    // Set up WebSocket server if available
    if (this.logManager.wsServer) {
      this.logManager.wsServer.on('log', (data) => {
        this.handleStreamedLog(data);
      });
    }
    
    this.emit('initialized', {
      sessionId: this.session.id,
      timestamp: new Date()
    });
  }
  
  /**
   * Monitor a full-stack application
   */
  async monitorFullStackApp(config) {
    const { backend, frontend } = config;
    
    // Start backend monitoring
    console.log(`🚀 Starting backend monitoring: ${backend.name}`);
    
    // Create a session and add the process to it
    const session = await this.logManager.createSession({
      name: backend.name,
      type: 'backend'
    });
    
    // Start the backend process (simplified for MCP usage)
    const backendProcess = {
      pid: Date.now(), // Mock process ID
      name: backend.name,
      script: backend.script,
      sessionId: session.sessionId
    };
    
    // Add process to session
    await this.logManager.addProcessToSession(session.sessionId, {
      processId: backendProcess.pid,
      name: backend.name,
      type: 'backend',
      script: backend.script
    });
    
    this.activeBackends.set(backend.name, {
      process: backendProcess,
      config: backend
    });
    
    // Wait for backend to be ready
    if (backend.port) {
      console.log(`⏳ Waiting for backend on port ${backend.port}...`);
      const ready = await this.waitForPort(backend.port, backend.timeout || 30000);
      if (!ready) {
        throw new Error(`Backend failed to start on port ${backend.port}`);
      }
      console.log(`✅ Backend ready on port ${backend.port}`);
    } else if (backend.waitTime) {
      await new Promise(resolve => setTimeout(resolve, backend.waitTime));
    }
    
    // Launch browser
    console.log(`🌐 Launching browser...`);
    const browser = await this.browserMonitor.launch(frontend.browserOptions || {});
    
    // Monitor frontend page
    console.log(`📄 Monitoring frontend: ${frontend.url}`);
    const page = await this.browserMonitor.monitorPage(
      frontend.url,
      this.session.id
    );
    
    this.activeBrowsers.set(page.id, {
      page,
      config: frontend
    });
    
    // Set up correlation linking
    this.linkCorrelations(backendProcess, page);
    
    this.emit('app-monitored', {
      backend: backendProcess,
      frontend: page,
      sessionId: this.session.id
    });
    
    return {
      backend: backendProcess,
      browser: page,
      session: this.session
    };
  }
  
  /**
   * Execute a debugging scenario
   */
  async debugScenario(steps) {
    console.log(`🔍 Executing debug scenario with ${steps.length} steps`);
    const results = [];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`  Step ${i + 1}: ${step.action}`);
      
      const result = await this.executeStep(step);
      
      // Collect correlated logs if correlation ID is present
      if (result.correlationId) {
        result.backendLogs = await this.logManager.getCorrelation
 ? 
          await this.logManager.getCorrelation(result.correlationId) : [];
        
        result.frontendLogs = this.browserMonitor.getSessionLogs(this.session.id)
          .filter(log => {
            const text = log.text || log.message || '';
            return text.includes(result.correlationId);
          });
      }
      
      // Analyze the step result
      result.analysis = this.analyzeStepResult(result);
      
      results.push(result);
      this.stats.totalStepsExecuted++;
    }
    
    this.stats.debugScenariosRun++;
    
    return results;
  }
  
  /**
   * Execute a single step in a scenario
   */
  async executeStep(step) {
    const result = {
      step,
      success: false,
      timestamp: new Date()
    };
    
    try {
      // Get the active page
      const pageEntry = Array.from(this.activeBrowsers.values())[0];
      if (!pageEntry) {
        throw new Error('No active browser page');
      }
      
      const page = pageEntry.page;
      
      switch (step.action) {
        case 'navigate':
          await page.navigate(step.url);
          result.success = true;
          result.url = step.url;
          break;
          
        case 'click':
          await page.click(step.selector);
          result.success = true;
          result.selector = step.selector;
          
          // Check for correlation ID in subsequent requests
          await new Promise(resolve => setTimeout(resolve, 100));
          const recentRequests = this.browserMonitor.getSessionRequests(this.session.id);
          const lastRequest = recentRequests[recentRequests.length - 1];
          if (lastRequest && lastRequest.correlationId) {
            result.correlationId = lastRequest.correlationId;
          }
          break;
          
        case 'type':
          await page.type(step.selector, step.text);
          result.success = true;
          result.selector = step.selector;
          break;
          
        case 'waitFor':
          await page.waitForSelector(step.selector, step.options);
          result.success = true;
          result.selector = step.selector;
          break;
          
        case 'screenshot':
          const screenshot = await page.screenshot(step.options || {});
          result.success = true;
          result.screenshot = screenshot;
          break;
          
        case 'evaluate':
          const evalResult = await page.evaluate(step.function, ...(step.args || []));
          result.success = true;
          result.evaluationResult = evalResult;
          break;
          
        default:
          throw new Error(`Unknown action: ${step.action}`);
      }
      
      if (step.correlationId) {
        result.correlationId = step.correlationId;
      }
      
    } catch (error) {
      result.success = false;
      result.error = error.message;
      result.stack = error.stack;
    }
    
    return result;
  }
  
  /**
   * Analyze step execution result
   */
  analyzeStepResult(result) {
    const analysis = {
      summary: result.success ? 'Step completed successfully' : 'Step failed',
      insights: []
    };
    
    // Check for errors in logs
    if (result.backendLogs) {
      const errors = result.backendLogs.filter(log => log.level === 'error');
      if (errors.length > 0) {
        analysis.insights.push({
          type: 'backend-errors',
          count: errors.length,
          messages: errors.map(e => e.message)
        });
      }
    }
    
    if (result.frontendLogs) {
      const consoleErrors = result.frontendLogs.filter(log => log.type === 'error');
      if (consoleErrors.length > 0) {
        analysis.insights.push({
          type: 'frontend-errors',
          count: consoleErrors.length,
          messages: consoleErrors.map(e => e.text)
        });
      }
    }
    
    // Check for performance issues
    if (result.networkTiming && result.networkTiming > 1000) {
      analysis.insights.push({
        type: 'slow-request',
        duration: result.networkTiming,
        message: `Request took ${result.networkTiming}ms`
      });
    }
    
    return analysis;
  }
  
  /**
   * Link correlations between backend and frontend
   */
  linkCorrelations(backend, page) {
    // When browser makes a request, check for correlation ID
    this.browserMonitor.on('network-request', (request) => {
      if (request.correlationId) {
        this.trackCorrelation(request.correlationId, {
          frontend: {
            pageId: request.pageId,
            url: request.url,
            method: request.method,
            timestamp: request.timestamp
          }
        });
      }
    });
    
    // When backend logs contain correlation ID, link it
    this.logManager.on('log', (log) => {
      const message = log.message || '';
      const correlationMatch = message.match(/\[(correlation-[\w-]+)\]/);
      
      if (correlationMatch) {
        const correlationId = correlationMatch[1];
        this.trackCorrelation(correlationId, {
          backend: {
            processId: log.processId,
            level: log.level,
            message: log.message,
            timestamp: log.timestamp
          }
        });
      }
    });
  }
  
  /**
   * Track a correlation between frontend and backend
   */
  async trackCorrelation(correlationId, data) {
    if (!this.correlations.has(correlationId)) {
      this.correlations.set(correlationId, {
        id: correlationId,
        frontend: null,
        backend: null,
        firstSeen: new Date()
      });
    }
    
    const correlation = this.correlations.get(correlationId);
    
    if (data.frontend) {
      correlation.frontend = data.frontend;
    }
    
    if (data.backend) {
      if (!correlation.backend) {
        correlation.backend = [];
      }
      if (Array.isArray(correlation.backend)) {
        correlation.backend.push(data.backend);
      }
    }
    
    correlation.lastSeen = new Date();
    
    this.stats.correlationsDetected++;
    
    this.emit('correlation-detected', {
      correlationId,
      ...data
    });
  }
  
  /**
   * Get correlation data
   */
  getCorrelation(correlationId) {
    return this.correlations.get(correlationId);
  }
  
  /**
   * Get all logs for a correlation ID
   */
  async getCorrelatedLogs(correlationId) {
    // Search backend logs
    const backendResult = await this.logManager.searchLogs({
      query: correlationId,
      sessionId: this.session.id,
      mode: 'keyword'
    });
    
    // Get frontend logs
    const frontendLogs = this.browserMonitor.getSessionLogs(this.session.id)
      .filter(log => {
        const text = (log.text || log.message || '').toString();
        return text.includes(correlationId);
      });
    
    // Get network requests with this correlation
    const networkRequests = this.browserMonitor.getSessionRequests(this.session.id)
      .filter(req => req.correlationId === correlationId);
    
    return {
      backend: backendResult.matches || [],
      frontend: frontendLogs,
      network: networkRequests,
      correlation: this.getCorrelation(correlationId)
    };
  }
  
  /**
   * Handle browser console messages
   */
  handleBrowserConsole(data) {
    // Check for correlation IDs in console messages
    const text = data.text || '';
    const correlationMatch = text.match(/\[(correlation-[\w-]+)\]/);
    
    if (correlationMatch) {
      const correlationId = correlationMatch[1];
      this.trackCorrelation(correlationId, {
        frontend: {
          type: 'console',
          level: data.type,
          message: data.text,
          timestamp: data.timestamp
        }
      });
    }
  }
  
  /**
   * Handle network requests
   */
  handleNetworkRequest(data) {
    if (data.correlationId) {
      this.trackCorrelation(data.correlationId, {
        frontend: {
          type: 'request',
          url: data.url,
          method: data.method,
          timestamp: data.timestamp
        }
      });
    }
  }
  
  /**
   * Handle network responses
   */
  handleNetworkResponse(data) {
    // Could track response times, status codes, etc.
  }
  
  /**
   * Handle backend log entries
   */
  handleBackendLog(data) {
    // Already handled in linkCorrelations
  }
  
  /**
   * Handle streamed logs from WebSocket
   */
  handleStreamedLog(data) {
    // Process real-time logs if needed
  }
  
  /**
   * Wait for a port to become available
   */
  async waitForPort(port, timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const isOpen = await this.checkPort(port);
      if (isOpen) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return false;
  }
  
  /**
   * Check if a port is open
   */
  checkPort(port) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.connect(port, 'localhost');
    });
  }
  
  /**
   * Get aggregated statistics
   */
  getStatistics() {
    const backendStats = this.logManager.getStatistics ? 
      this.logManager.getStatistics() : {};
    
    const frontendStats = this.browserMonitor.getStatistics ? 
      this.browserMonitor.getStatistics() : {};
    
    return {
      backend: backendStats,
      frontend: frontendStats,
      correlations: this.correlations.size,
      correlationsDetected: this.stats.correlationsDetected,
      debugScenariosRun: this.stats.debugScenariosRun,
      totalStepsExecuted: this.stats.totalStepsExecuted,
      activeBackends: this.activeBackends.size,
      activeBrowsers: this.activeBrowsers.size,
      uptime: Date.now() - this.stats.startTime.getTime()
    };
  }
  
  /**
   * Clean up all resources
   */
  async cleanup() {
    console.log('🧹 Cleaning up FullStackMonitor...');
    
    // Close all browser pages
    for (const [pageId, entry] of this.activeBrowsers.entries()) {
      await this.browserMonitor.closePage(pageId);
    }
    
    // Close browser
    if (this.browserMonitor.browser) {
      await this.browserMonitor.close();
    }
    
    // Stop backend processes
    for (const [name, entry] of this.activeBackends.entries()) {
      // The log manager should handle process cleanup
      console.log(`  Stopping backend: ${name}`);
    }
    
    // End session
    if (this.session && this.logManager.endSession) {
      await this.logManager.endSession(this.session.id);
    }
    
    // Clear data
    this.correlations.clear();
    this.activeBackends.clear();
    this.activeBrowsers.clear();
    
    this.emit('cleanup', {
      timestamp: new Date()
    });
    
    console.log('✅ Cleanup complete');
  }
}