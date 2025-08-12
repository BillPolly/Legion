/**
 * FullStackMonitor - Orchestrates browser and backend monitoring for complete observability
 * Combines log-manager and browser-monitor to provide unified debugging capabilities
 */

import { EventEmitter } from 'events';
import { LogStore } from './log-store/index.js';
import { BrowserMonitor } from '@legion/browser-monitor';
import { WebSocketServer } from 'ws';
import net from 'net';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import path from 'path';
import * as url from 'url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class FullStackMonitor extends EventEmitter {
  constructor(config) {
    super();
    
    this.resourceManager = config.resourceManager;
    this.logStore = config.logStore;
    this.browserMonitor = config.browserMonitor;
    this.session = config.session;
    
    // Agent WebSocket server (handles both Sidewinder and Browser agents)
    this.agentServer = null;
    this.sidewinderClients = new Map();
    this.browserClients = new Map();
    
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
    const logStore = await LogStore.create(resourceManager);
    const browserMonitor = await BrowserMonitor.create(resourceManager);
    
    // Create unified session
    const session = await logStore.createSession('fullstack-monitoring', {
      type: 'fullstack',
      startTime: new Date(),
      monitors: ['log-store', 'browser-monitor']
    });
    
    const monitor = new FullStackMonitor({
      resourceManager,
      logStore,
      browserMonitor,
      session: {
        id: session.id,
        type: 'fullstack',
        ...session
      }
    });
    
    // Start Agent WebSocket server for both Sidewinder and Browser agents
    try {
      await monitor.startAgentServer(9901);
      console.log('✅ Agent WebSocket server started on ws://localhost:9901');
      console.log('   - Backend agents connect to: /sidewinder');
      console.log('   - Browser agents connect to: /browser');
    } catch (error) {
      console.warn(`⚠️  Failed to start agent server: ${error.message}`);
    }
    
    await monitor.initialize();
    return monitor;
  }
  
  /**
   * Start WebSocket server for both Sidewinder and Browser agents
   */
  async startAgentServer(port = 9901) {
    return new Promise((resolve, reject) => {
      try {
        // Create server without path restriction - we'll handle routing ourselves
        this.agentServer = new WebSocketServer({ port });
        
        this.agentServer.on('connection', (ws, request) => {
          const path = request.url;
          let clientId;
          
          if (path === '/sidewinder') {
            // Backend agent connection
            clientId = `sidewinder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            this.sidewinderClients.set(clientId, ws);
            console.log(`🔌 Sidewinder agent connected: ${clientId}`);
            
            ws.on('message', async (data) => {
              try {
                const message = JSON.parse(data.toString());
                await this.handleSidewinderMessage(message, clientId);
              } catch (error) {
                console.error('Failed to process Sidewinder message:', error);
              }
            });
            
            ws.on('close', () => {
              this.sidewinderClients.delete(clientId);
              console.log(`🔌 Sidewinder agent disconnected: ${clientId}`);
            });
            
          } else if (path === '/browser') {
            // Browser agent connection
            clientId = `browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            this.browserClients.set(clientId, ws);
            console.log(`🌐 Browser agent connected: ${clientId}`);
            
            ws.on('message', async (data) => {
              try {
                const message = JSON.parse(data.toString());
                await this.handleBrowserMessage(message, clientId);
              } catch (error) {
                console.error('Failed to process Browser message:', error);
              }
            });
            
            ws.on('close', () => {
              this.browserClients.delete(clientId);
              console.log(`🌐 Browser agent disconnected: ${clientId}`);
            });
            
          } else {
            // Unknown path - close connection
            console.warn(`Unknown WebSocket path: ${path}`);
            ws.close();
            return;
          }
          
          // Send welcome message
          ws.send(JSON.stringify({
            type: 'connected',
            clientId,
            timestamp: new Date()
          }));
          
          ws.on('error', (error) => {
            console.error(`WebSocket error for ${clientId}:`, error);
          });
        });
        
        this.agentServer.on('listening', () => {
          resolve();
        });
        
        this.agentServer.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Handle messages from Sidewinder agents
   */
  async handleSidewinderMessage(message, clientId) {
    switch(message.type) {
      case 'identify':
        // Track the Sidewinder session
        console.log(`Sidewinder agent identified: session=${message.sessionId}, pid=${message.pid}`);
        break;
        
      case 'console':
        // Store console message using optimized Sidewinder logging
        await this.logStore.logSidewinderMessage({
          ...message,
          source: 'sidewinder-console'
        }, clientId);
        
        // Check for correlation IDs in console messages
        const text = Array.isArray(message.args) ? message.args.join(' ') : '';
        const correlationMatch = text.match(/\[([\w-]*correlation[\w-]*)\]/);
        if (correlationMatch) {
          const correlationId = correlationMatch[1];
          await this.trackCorrelation(correlationId, {
            backend: {
              type: 'console',
              clientId,
              message: text,
              timestamp: message.timestamp || Date.now()
            }
          });
        }
        break;
        
      case 'processStart':
        // Add process to session via direct LogManager call
        await this.logStore.trackProcess({
          processId: message.pid,
          command: message.argv ? message.argv.join(' ') : 'unknown',
          args: message.argv || [],
          cwd: message.cwd || process.cwd()
        });
        
        // Also log the process start
        await this.logStore.logSidewinderMessage({
          ...message,
          source: 'sidewinder-process'
        }, clientId);
        break;
        
      case 'uncaughtException':
      case 'error':
        // Store error as log via direct LogManager call
        await this.logStore.logSidewinderMessage({
          ...message,
          source: `sidewinder-${message.type}`
        }, clientId);
        break;
        
      case 'processExit':
        // Complete the process
        if (message.pid) {
          await this.logStore.completeProcess(message.pid, {
            exitCode: message.code
          });
        }
        break;
        
      case 'server-lifecycle':
        // Log server lifecycle events
        await this.logStore.logSidewinderMessage({
          ...message,
          source: 'sidewinder-server'
        }, clientId);
        break;
        
      default:
        // Log any other message types
        await this.logStore.logSidewinderMessage({
          ...message,
          source: `sidewinder-${message.type}`
        }, clientId);
    }
    
    // Track correlation if present
    if (message.correlationId) {
      await this.trackCorrelation(message.correlationId, { 
        backend: message 
      });
    }
  }
  
  /**
   * Handle messages from Browser agents
   */
  async handleBrowserMessage(message, clientId) {
    switch(message.type) {
      case 'identify':
        // Track the browser session
        console.log(`Browser agent identified: page=${message.pageUrl}, session=${message.sessionId}`);
        await this.logStore.logBrowserMessage({
          ...message,
          source: 'browser-agent'
        }, clientId);
        break;
        
      case 'console':
        // Store browser console message
        await this.logStore.logBrowserMessage({
          ...message,
          source: 'browser-console'
        }, clientId);
        
        // Check for correlation IDs in console messages
        const text = Array.isArray(message.args) ? message.args.join(' ') : '';
        const correlationMatch = text.match(/\[([\w-]*correlation[\w-]*)\]/);
        if (correlationMatch) {
          await this.trackCorrelation(correlationMatch[1], {
            frontend: {
              type: 'console',
              level: message.method,
              message: text,
              timestamp: message.timestamp
            }
          });
        }
        break;
        
      case 'network':
        // Track network requests
        await this.logStore.logBrowserMessage({
          ...message,
          source: 'browser-network'
        }, clientId);
        
        // Track correlation
        if (message.correlationId) {
          await this.trackCorrelation(message.correlationId, {
            frontend: {
              type: 'network',
              subtype: message.subtype,
              url: message.url,
              method: message.method,
              status: message.status,
              duration: message.duration,
              timestamp: message.timestamp
            }
          });
        }
        break;
        
      case 'error':
        // Store browser errors
        await this.logStore.logBrowserMessage({
          ...message,
          source: 'browser-error'
        }, clientId);
        break;
        
      case 'unhandledrejection':
        // Store unhandled promise rejections
        await this.logStore.logBrowserMessage({
          ...message,
          source: 'browser-rejection'
        }, clientId);
        break;
        
      case 'dom-mutation':
        // Log DOM changes (sample rate controlled by agent)
        await this.logStore.logBrowserMessage({
          ...message,
          source: 'browser-dom'
        }, clientId);
        break;
        
      case 'user-interaction':
        // Log user interactions
        await this.logStore.logBrowserMessage({
          ...message,
          source: 'browser-interaction'
        }, clientId);
        break;
        
      default:
        // Log any other message types
        await this.logStore.logBrowserMessage({
          ...message,
          source: `browser-${message.type}`
        }, clientId);
    }
  }
  
  /**
   * Initialize the full-stack monitor
   */
  async initialize() {
    // Set up event forwarding from browser monitor
    this.browserMonitor.on('console-message', async (data) => {
      await this.handleBrowserConsole(data);
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
    
    // LogStore does not emit log events to prevent infinite loops
    
    // Log agent server status
    if (this.agentServer) {
      console.log('🔌 Agent WebSocket server ready for connections');
    } else {
      console.warn('⚠️  No agent server available - agents cannot connect');
    }
    
    this.emit('initialized', {
      sessionId: this.session.id,
      timestamp: new Date()
    });
  }
  
  /**
   * Inject Sidewinder agent and start a backend process
   */
  async injectSidewinderAgent(scriptPath, options = {}) {
    const agentPath = path.join(__dirname, 'sidewinder-agent.cjs');
    
    // Verify agent file exists
    try {
      await fs.access(agentPath);
    } catch (error) {
      throw new Error(`Sidewinder agent not found at ${agentPath}`);
    }
    
    // Start process with agent injection
    const child = spawn('node', ['-r', agentPath, scriptPath], {
      stdio: options.stdio || 'inherit',
      env: {
        ...process.env,
        SIDEWINDER_SESSION_ID: options.sessionId || this.session.id,
        SIDEWINDER_WS_PORT: options.wsPort || '9901',
        SIDEWINDER_WS_HOST: options.wsHost || 'localhost',
        SIDEWINDER_DEBUG: options.debug ? 'true' : 'false'
      }
    });
    
    return child;
  }
  
  /**
   * Inject browser agent into a Puppeteer page
   */
  async injectBrowserAgent(page, options = {}) {
    const agentPath = path.join(__dirname, 'browser-agent.js');
    
    // Read agent script
    const agentCode = await fs.readFile(agentPath, 'utf8');
    
    // Inject configuration variables before the agent code
    const configScript = `
      window.__BROWSER_AGENT_PORT__ = '${options.wsPort || '9901'}';
      window.__BROWSER_AGENT_HOST__ = '${options.wsHost || 'localhost'}';
      window.__BROWSER_AGENT_SESSION__ = '${options.sessionId || this.session.id}';
      window.__BROWSER_AGENT_PAGE_ID__ = '${options.pageId || 'page-' + Date.now()}';
      window.__BROWSER_AGENT_TRACK_INTERACTIONS__ = ${options.trackInteractions || false};
      window.__BROWSER_AGENT_TRACK_MUTATIONS__ = ${options.trackMutations || false};
    `;
    
    // Inject both configuration and agent code
    await page.evaluateOnNewDocument(configScript + '\n' + agentCode);
  }
  
  /**
   * Monitor a full-stack application
   */
  async monitorFullStackApp(config) {
    const { backend, frontend } = config;
    
    // Start backend monitoring with Sidewinder injection
    if (backend && backend.script) {
      console.log(`🚀 Starting backend monitoring: ${backend.name}`);
      
      // Start the backend process with Sidewinder agent
      const backendProcess = await this.injectSidewinderAgent(backend.script, {
        sessionId: this.session.id,
        wsPort: '9901',
        debug: backend.debug || false,
        stdio: backend.stdio || 'inherit'
      });
      
      // Track the process
      this.activeBackends.set(backend.name, {
        process: backendProcess,
        config: backend,
        pid: backendProcess.pid
      });
      
      // Add process to session
      await this.logStore.addProcessToSession(this.session.id, {
        processId: backendProcess.pid,
        name: backend.name,
        type: 'backend',
        script: backend.script
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
    }
    
    // Launch browser and monitor frontend
    let page = null;
    let browser = null;
    
    if (frontend && frontend.url) {
      console.log(`🌐 Launching browser...`);
      browser = await this.browserMonitor.launch(frontend.browserOptions || {});
      
      // Get the page (monitorPage creates a new page)
      console.log(`📄 Monitoring frontend: ${frontend.url}`);
      page = await this.browserMonitor.monitorPage(
        frontend.url,
        this.session.id
      );
      
      // Inject browser agent into the page
      await this.injectBrowserAgent(page.page || page, {
        sessionId: this.session.id,
        pageId: page.id || page.pageId,
        wsPort: '9901',
        trackInteractions: frontend.trackInteractions || false,
        trackMutations: frontend.trackMutations || false
      });
      
      this.activeBrowsers.set(page.id, {
        page,
        config: frontend
      });
    }
    
    // Set up correlation linking if we have both backend and frontend
    const backendProcess = backend ? this.activeBackends.get(backend.name)?.process : null;
    if (backendProcess && page) {
      this.linkCorrelations(backendProcess, page);
    }
    
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
        result.backendLogs = await this.logStore.searchCorrelated(result.correlationId);
        
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
    
    // LogStore does not emit log events to prevent infinite loops
    // Correlation tracking is now handled directly in LogStore
  }
  
  /**
   * Track a correlation between frontend and backend
   */
  async trackCorrelation(correlationId, data) {
    // Handle null/undefined/empty correlation ID
    if (!correlationId || correlationId.trim() === '') {
      return;
    }
    
    // Use LogStore's correlation engine for tracking
    if (data && data.frontend) {
      this.logStore.trackCorrelation(correlationId, 'frontend', data.frontend);
    }
    
    if (data && data.backend) {
      this.logStore.trackCorrelation(correlationId, 'backend', data.backend);
    }
    
    // Also maintain local correlations map for backward compatibility
    if (!this.correlations.has(correlationId)) {
      this.correlations.set(correlationId, {
        id: correlationId,
        frontend: null,
        backend: null,
        firstSeen: new Date()
      });
    }
    
    const correlation = this.correlations.get(correlationId);
    
    if (data && data.frontend) {
      correlation.frontend = data.frontend;
    }
    
    if (data && data.backend) {
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
    // Search backend logs using optimized correlation search
    const correlatedResults = await this.logStore.searchCorrelated(correlationId);
    const backendResult = { matches: correlatedResults.backend || [] };
    
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
   * Get correlation logs (alias method expected by tests)
   */
  async getCorrelationLogs(correlationId) {
    // Use LogStore's optimized correlation search
    const correlatedResults = await this.logStore.searchCorrelated(correlationId);
    const backendResult = { matches: correlatedResults.backend || [] };
    
    // Also get logs from the correlation tracking
    const correlation = this.logStore.getCorrelation(correlationId);
    const trackedLogs = [];
    if (correlation && correlation.backend) {
      if (Array.isArray(correlation.backend)) {
        trackedLogs.push(...correlation.backend);
      } else {
        trackedLogs.push(correlation.backend);
      }
    }
    
    // Combine results
    const allLogs = [...(backendResult.matches || []), ...trackedLogs];
    
    // Remove duplicates based on timestamp and message
    const uniqueLogs = Array.from(new Map(
      allLogs.map(log => [`${log.timestamp}-${log.message}`, log])
    ).values());
    
    return uniqueLogs;
  }
  
  /**
   * Search logs (delegate to log manager)
   */
  async searchLogs(options) {
    return await this.logStore.searchLogs(options);
  }
  
  /**
   * Handle browser console messages
   */
  async handleBrowserConsole(data) {
    // Store browser console message as log via direct LogManager call
    await this.logStore.logMessage({
      sessionId: this.session.id,
      level: data.type || 'info',
      message: data.text || data.message || '',
      source: 'browser-console',
      metadata: {
        url: data.url,
        lineNumber: data.lineNumber,
        timestamp: data.timestamp
      }
    });
    
    // Check for correlation IDs in console messages
    const text = data.text || '';
    const correlationMatch = text.match(/\[([\w-]*correlation[\w-]*)\]/);
    
    if (correlationMatch) {
      const correlationId = correlationMatch[1];
      await this.trackCorrelation(correlationId, {
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
  async handleBackendLog(data) {
    // Store the log if it's not already stored
    if (!data.stored) {
      await this.logStore.logMessage({
        sessionId: data.sessionId || this.session.id,
        level: data.level || 'info',
        message: data.message || '',
        source: data.source || 'backend',
        metadata: data.metadata
      });
    }
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
    let attempts = 0;
    
    // Give the server a moment to start up
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    while (Date.now() - startTime < timeout) {
      attempts++;
      const isOpen = await this.checkPort(port);
      if (isOpen) {
        console.log(`   Port ${port} is open after ${attempts} attempts`);
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`   Port ${port} check timeout after ${attempts} attempts`);
    return false;
  }
  
  /**
   * Check if a port is open
   */
  checkPort(port) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      
      // Set a timeout for the connection attempt
      socket.setTimeout(1000);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.connect(port, 'localhost');
    });
  }
  
  /**
   * Get aggregated statistics
   */
  async getStatistics() {
    const backendStats = (this.logStore && typeof this.logStore.getStatistics === 'function') ? 
      await this.logStore.getStatistics() : {};
    
    const frontendStats = (this.browserMonitor && typeof this.browserMonitor.getStatistics === 'function') ? 
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
   * Agent Injection Helper Methods
   */
  
  /**
   * Get path to Sidewinder agent for --require flag
   */
  getSidewinderAgentPath() {
    const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
    return path.join(__dirname, 'sidewinder-agent.cjs');
  }
  
  /**
   * Build Node command with Sidewinder agent injection
   */
  buildNodeCommand(script, options = {}) {
    const agentPath = this.getSidewinderAgentPath();
    const { nodeOptions = '' } = options;
    
    // Handle npm/yarn/pnpm commands
    if (script.startsWith('npm ') || script.startsWith('yarn ') || script.startsWith('pnpm ')) {
      const existingNodeOptions = process.env.NODE_OPTIONS || '';
      const combinedOptions = `${existingNodeOptions} --require "${agentPath}"`.trim();
      return `NODE_OPTIONS="${combinedOptions}" ${script}`;
    }
    
    // Handle TypeScript files
    if (script.endsWith('.ts')) {
      return `node ${nodeOptions} --require "${agentPath}" --require ts-node/register ${script}`;
    }
    
    // Regular Node command
    return `node ${nodeOptions} --require "${agentPath}" ${script}`;
  }
  
  /**
   * Get environment variables for Sidewinder agent
   */
  getSidewinderEnv(options = {}) {
    const { port = 9901 } = options;
    return {
      SIDEWINDER_WS_URL: `ws://localhost:${port}/sidewinder`,
      SIDEWINDER_SESSION_ID: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  }
  
  /**
   * Get browser agent script content
   */
  getBrowserAgentScript(options = {}) {
    const { wsUrl = 'ws://localhost:9901/browser', sessionId = '' } = options;
    const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
    const agentPath = path.join(__dirname, 'browser-agent.js');
    
    try {
      let script = fsSync.readFileSync(agentPath, 'utf8');
      // Replace WebSocket URL in the script
      script = script.replace('ws://localhost:9901/browser', wsUrl);
      if (sessionId) {
        script = script.replace("sessionId: window.__BROWSER_AGENT_SESSION__ || 'default'", `sessionId: '${sessionId}'`);
      }
      return script;
    } catch (error) {
      console.warn('Failed to read browser agent script:', error.message);
      return '// Browser agent script not found';
    }
  }
  
  /**
   * Inject browser agent script into HTML
   */
  injectBrowserAgent(html, options = {}) {
    const script = this.getBrowserAgentScript(options);
    const scriptTag = `<script>\n${script}\n</script>\n`;
    
    // Try to inject before closing body tag
    if (html.includes('</body>')) {
      return html.replace('</body>', `${scriptTag}</body>`);
    }
    
    // Fallback: append to end
    return html + scriptTag;
  }
  
  /**
   * Spawn process with Sidewinder agent
   */
  async spawnWithAgent(command, args = [], options = {}) {
    const { spawn } = await import('child_process');
    const agentEnv = this.getSidewinderEnv();
    const agentPath = this.getSidewinderAgentPath();
    
    const spawnOptions = {
      ...options,
      env: {
        ...process.env,
        ...options.env,
        ...agentEnv,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require "${agentPath}"`.trim()
      }
    };
    
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, spawnOptions);
      
      child.on('error', reject);
      child.on('exit', (code) => {
        if (code === 0) {
          resolve(child);
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });
      
      // For immediate return of process handle
      setTimeout(() => resolve(child), 0);
    });
  }
  
  /**
   * Get injection help documentation
   */
  getInjectionHelp() {
    return `
Fullstack Monitor Agent Injection Help

SIDEWINDER AGENT (Backend Monitoring):
- Automatically injected via --require flag
- Monitors console, errors, process events, server lifecycle
- Use: monitor.buildNodeCommand('app.js') for proper injection

BROWSER AGENT (Frontend Monitoring):
- Injected as script into HTML pages
- Monitors console, fetch, XHR, DOM mutations, user interactions
- Use: monitor.injectBrowserAgent(html) for proper injection

EXAMPLES:
- Node.js: node --require ./src/sidewinder-agent.cjs app.js
- npm: NODE_OPTIONS="--require ./src/sidewinder-agent.cjs" npm start
- TypeScript: node --require ./src/sidewinder-agent.cjs --require ts-node/register app.ts
- Browser: Inject <script> containing browser-agent.js before </body>

ENVIRONMENT VARIABLES:
- SIDEWINDER_WS_URL: WebSocket URL for backend agent
- SIDEWINDER_SESSION_ID: Unique session identifier
`;
  }

  /**
   * Clean up all resources
   */
  async cleanup() {
    console.log('🧹 Cleaning up FullStackMonitor...');
    
    // Stop Agent WebSocket server
    if (this.agentServer) {
      try {
        // Close all Sidewinder client connections
        for (const [clientId, ws] of this.sidewinderClients.entries()) {
          ws.close();
        }
        this.sidewinderClients.clear();
        
        // Close all Browser client connections
        for (const [clientId, ws] of this.browserClients.entries()) {
          ws.close();
        }
        this.browserClients.clear();
        
        // Close the server
        await new Promise((resolve) => {
          this.agentServer.close(resolve);
        });
        console.log('  Agent server stopped');
      } catch (error) {
        console.warn('  Warning: Failed to stop agent server:', error.message);
      }
    }
    
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
      if (entry.process && !entry.process.killed) {
        console.log(`  Stopping backend: ${name}`);
        entry.process.kill('SIGTERM');
      }
    }
    
    // End session
    if (this.session && this.logStore.endSession) {
      try {
        await this.logStore.endSession();
      } catch (error) {
        console.warn('  Warning: Failed to end session:', error.message);
      }
    }
    
    // Cleanup log manager
    if (this.logStore && this.logStore.cleanup) {
      try {
        await this.logStore.cleanup();
        console.log('  Log manager cleaned up');
      } catch (error) {
        console.warn('  Warning: Log manager cleanup failed:', error.message);
      }
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