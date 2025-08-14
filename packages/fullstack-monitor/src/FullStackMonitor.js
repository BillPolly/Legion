/**
 * FullStackMonitor - Orchestrates browser and backend monitoring for complete observability
 * Combines log-manager and browser-monitor to provide unified debugging capabilities
 */

import { EventEmitter } from 'events';
import { LogStore } from './log-store/index.js';
import { ScriptAnalyzer } from './ScriptAnalyzer.js';
import { WebSocketServer } from 'ws';
import net from 'net';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import path from 'path';
import * as url from 'url';

// Dynamic import for Puppeteer to handle missing dependencies
let puppeteer;
try {
  puppeteer = (await import('puppeteer')).default;
} catch (e) {
  console.warn('⚠️  Puppeteer not available - browser features will be disabled');
}

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class FullStackMonitor extends EventEmitter {
  constructor(config) {
    super();
    
    this.resourceManager = config.resourceManager;
    this.logStore = config.logStore;
    this.session = config.session;
    this.wsAgentPort = config.wsAgentPort || 9901;  // Store WebSocket port for agents
    
    // Initialize ScriptAnalyzer with correct agent path
    const agentPath = path.join(__dirname, 'sidewinder-agent.cjs');
    this.scriptAnalyzer = new ScriptAnalyzer({ agentPath });
    
    // Set up event listeners to forward browser events to LogStore
    this.on('console-message', (data) => {
      this.logStore.logBrowserMessage({
        type: 'console',
        level: data.type,
        text: data.text,
        sessionId: data.sessionId,
        pageId: data.pageId,
        source: 'browser-console'
      });
    });
    
    this.on('page-error', (data) => {
      this.logStore.logBrowserMessage({
        type: 'error',
        level: 'error',
        message: data.message,
        sessionId: data.sessionId,
        pageId: data.pageId,
        source: 'browser-error'
      });
    });
    
    // Integrated browser functionality
    this.browser = null;
    this.browserPages = new Map(); // pageId -> page info
    this.sessionPages = new Map(); // sessionId -> pageId[]
    
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
    
    // Cleanup flag
    this.isCleaningUp = false;
  }
  
  /**
   * Create FullStackMonitor instance using async factory pattern
   */
  static async create(resourceManager, options = {}) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    
    // Initialize log store
    const logStore = await LogStore.create(resourceManager);
    
    // Create unified session
    const session = await logStore.createSession('fullstack-monitoring', {
      type: 'fullstack',
      wsAgentPort: options.wsAgentPort,  // Include port in session metadata
      startTime: new Date(),
      monitors: ['log-store', 'browser-monitor']
    });
    
    const monitor = new FullStackMonitor({
      resourceManager,
      logStore,
      session: {
        id: session.id,
        type: 'fullstack',
        ...session
      },
      wsAgentPort: options.wsAgentPort  // Store the port
    });
    
    // Start Agent WebSocket server for both Sidewinder and Browser agents
    try {
      // Use provided port or default to 9901
      const port = options.wsAgentPort || 9901;
      await monitor.startAgentServer(port);
      console.log(`✅ Agent WebSocket server started on ws://localhost:${port}`);
      console.log('   - Backend agents connect to: /sidewinder');
      console.log('   - Browser agents connect to: /browser');
    } catch (error) {
      console.error(`❌ Failed to start agent server: ${error.message}`);
      throw error; // Re-throw to prevent partial initialization
    }
    
    await monitor.initialize();
    return monitor;
  }
  
  /**
   * Start WebSocket server for both Sidewinder and Browser agents
   */
  async startAgentServer(port = 9901) {
    // Check if server is already running
    if (this.agentServer) {
      console.log('Agent server already running');
      return;
    }
    
    // Don't kill anything on our own WebSocket port - we manage that now
    // The port is already chosen to be available by the MCP server
    
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
                console.log(`📨 Sidewinder message received: ${message.type}`);
                await this.handleSidewinderMessage(message, clientId);
              } catch (error) {
                console.error('Failed to process Sidewinder message:', error);
              }
            });
            
            ws.on('close', () => {
              this.sidewinderClients.delete(clientId);
              if (!this.isCleaningUp) {
                console.log(`🔌 Sidewinder agent disconnected: ${clientId}`);
              }
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
              if (!this.isCleaningUp) {
                console.log(`🌐 Browser agent disconnected: ${clientId}`);
              }
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
    // Monitor is now ready with integrated browser functionality
    
    // Log agent server status
    if (this.agentServer) {
      console.log('🔌 Agent WebSocket server ready for connections');
    } else {
      console.warn('⚠️  No agent server available - agents cannot connect');
    }
    
    console.log('✅ FullStackMonitor initialized with integrated browser functionality');
    
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
    
    // Determine the working directory
    let cwd = options.cwd;
    
    if (!cwd) {
      // Look for package.json in the script's directory and parent directories
      const scriptDir = path.dirname(path.resolve(scriptPath));
      let currentDir = scriptDir;
      
      while (currentDir !== path.dirname(currentDir)) {
        try {
          await fs.access(path.join(currentDir, 'package.json'));
          cwd = currentDir;
          break;
        } catch {
          currentDir = path.dirname(currentDir);
        }
      }
      
      // If no package.json found, use script's directory
      if (!cwd) {
        cwd = scriptDir;
      }
    }
    
    console.log(`📂 Working directory set to: ${cwd}`);
    
    // Start process with agent injection
    const child = spawn('node', ['-r', agentPath, scriptPath], {
      cwd: cwd,  // Set the working directory
      stdio: options.stdio || 'inherit',
      env: {
        ...process.env,
        SIDEWINDER_SESSION_ID: options.sessionId || this.session.id,
        SIDEWINDER_WS_PORT: options.wsAgentPort || String(this.wsAgentPort),
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
      window.__BROWSER_AGENT_PORT__ = '${options.wsAgentPort || this.wsAgentPort}';
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
   * Simple API: Start monitoring an app from a script path
   */
  async startApp(scriptPath, options = {}) {
    try {
      // Use ScriptAnalyzer to figure out how to run it
      const strategy = await this.scriptAnalyzer.analyze(scriptPath, {
        sessionId: options.session_id || this.session.id,
        wsAgentPort: String(this.wsAgentPort),
        debug: options.debug || false
      });
      
      // Kill port if specified
      if (options.wait_for_port) {
        await this.killProcessOnPort(options.wait_for_port);
      }
      
      // Start monitoring with the strategy
      await this.monitorFullStackApp({
        backend: {
          executionStrategy: strategy,
          port: options.wait_for_port || strategy.metadata?.detectsPort,
          name: path.basename(scriptPath),
          debug: options.debug || false,
          sessionId: options.session_id || this.session.id
        }
      });
      
      return { content: [{ type: 'text', text: '✅ App started' }] };
    } catch (error) {
      console.error('Error starting app:', error);
      return { content: [{ type: 'text', text: `❌ Failed to start app: ${error.message}` }] };
    }
  }
  
  /**
   * Simple API: Get logs
   */
  async getLogs(limit = 25) {
    const sidewinderLogs = await this.logStore.getRecentAgentLogs('sidewinder', limit);
    const browserLogs = await this.logStore.getRecentAgentLogs('browser', limit);
    const allLogs = [...sidewinderLogs, ...browserLogs];
    allLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    if (allLogs.length > 0) {
      const logText = allLogs.map(log => 
        `[${log.timestamp}] [${log.agentType}] ${log.level}: ${log.message}`
      ).join('\n');
      return { content: [{ type: 'text', text: `Found ${allLogs.length} logs:\n\n${logText}` }] };
    } else {
      return { content: [{ type: 'text', text: `Found 0 logs` }] };
    }
  }
  
  /**
   * Simple API: Open and monitor a webpage
   */
  async openPage(url, sessionId, options = {}) {
    try {
      // Launch browser if not already launched
      if (!this.browser) {
        await this.launch({ headless: options.headless || false });
      }
      
      // Create a new page
      const page = await this.browser.newPage();
      const pageId = `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Inject browser agent BEFORE navigating
      await this.injectBrowserAgent(page, {
        sessionId: sessionId,
        pageId: pageId,
        wsAgentPort: String(this.wsAgentPort),
        trackInteractions: options.trackInteractions || false,
        trackMutations: options.trackMutations || false
      });
      
      // Set up event handlers
      page.on('console', (msg) => {
        this.emit('console-message', {
          pageId,
          sessionId,
          type: msg.type(),
          text: msg.text(),
          timestamp: new Date()
        });
      });
      
      page.on('pageerror', (error) => {
        this.emit('page-error', {
          pageId,
          sessionId,
          message: error.message,
          stack: error.stack,
          timestamp: new Date()
        });
      });
      
      // Now navigate to the URL
      await page.goto(url, {
        waitUntil: url.startsWith('data:') ? 'domcontentloaded' : 'networkidle2',
        timeout: 15000
      });
      
      // Store page info
      const pageInfo = {
        id: pageId,
        page,
        url,
        sessionId,
        createdAt: new Date()
      };
      
      this.browserPages.set(pageId, pageInfo);
      
      // Ensure sessionPages tracking
      if (!this.sessionPages.has(sessionId)) {
        this.sessionPages.set(sessionId, []);
      }
      this.sessionPages.get(sessionId).push(pageId); // Store pageId, not pageInfo
      
      return { content: [{ type: 'text', text: `✅ Page opened: ${url}` }] };
    } catch (error) {
      console.error('Error opening page:', error);
      return { content: [{ type: 'text', text: `❌ Failed to open page: ${error.message}` }] };
    }
  }
  
  /**
   * Simple API: Take screenshot
   */
  async screenshot(sessionId, options = {}) {
    try {
      const result = await this.takeScreenshot(sessionId, options);
      return { content: [{ type: 'text', text: '✅ Screenshot taken' }] };
    } catch (error) {
      console.error('Error taking screenshot:', error);
      return { content: [{ type: 'text', text: `❌ Failed to take screenshot: ${error.message}` }] };
    }
  }
  
  /**
   * Simple API: Execute browser command
   */
  async browserCommand(sessionId, command, args = []) {
    try {
      const result = await this.executeBrowserCommand(sessionId, command, args);
      return { content: [{ type: 'text', text: `✅ ${result}` }] };
    } catch (error) {
      console.error('Error executing browser command:', error);
      return { content: [{ type: 'text', text: `❌ Failed to execute command: ${error.message}` }] };
    }
  }
  
  /**
   * Simple API: Stop monitoring
   */
  async stopApp() {
    try {
      // Only stop the app processes, NOT the agent WebSocket server!
      // The WebSocket server must stay alive for the lifetime of the FullStackMonitor
      
      // Stop all backend processes
      for (const [name, backend] of this.activeBackends) {
        try {
          if (backend.process && !backend.process.killed) {
            backend.process.kill('SIGTERM');
            console.log(`Stopped backend: ${name}`);
          }
        } catch (error) {
          console.error(`Error stopping backend ${name}:`, error);
        }
      }
      this.activeBackends.clear();
      
      // Close all browser pages (but keep browser instance)
      for (const [pageId, pageInfo] of this.browserPages) {
        try {
          await pageInfo.page.close();
          console.log(`Closed page: ${pageId}`);
        } catch (error) {
          console.error(`Error closing page ${pageId}:`, error);
        }
      }
      this.browserPages.clear();
      this.sessionPages.clear();
      
      return { content: [{ type: 'text', text: '✅ Stopped' }] };
    } catch (error) {
      console.error('Error stopping app:', error);
      return { content: [{ type: 'text', text: `❌ Error during cleanup: ${error.message}` }] };
    }
  }
  
  /**
   * Monitor a full-stack application
   */
  async monitorFullStackApp(config) {
    const { backend, frontend } = config;
    
    // Start backend monitoring with Sidewinder injection
    if (backend) {
      console.log(`🚀 Starting backend monitoring: ${backend.name}`);
      
      // Auto-kill any process on the target port if specified
      if (backend.port) {
        await this.killProcessOnPort(backend.port);
      }
      
      let backendProcess;
      
      // New: Support execution strategy from ScriptAnalyzer
      if (backend.executionStrategy) {
        const strategy = backend.executionStrategy;
        const { spawn } = await import('child_process');
        
        // Spawn the process using the strategy
        backendProcess = spawn(strategy.command, strategy.args, {
          cwd: strategy.cwd,
          stdio: backend.stdio || 'inherit',
          env: {
            ...process.env,
            ...strategy.env,
            SIDEWINDER_SESSION_ID: backend.sessionId || this.session.id,
            SIDEWINDER_WS_PORT: String(this.wsAgentPort),
            SIDEWINDER_WS_HOST: 'localhost',
            SIDEWINDER_DEBUG: backend.debug ? 'true' : 'false'
          }
        });
        
        console.log(`  Executing: ${strategy.command} ${strategy.args.join(' ')}`);
        console.log(`  Working directory: ${strategy.cwd}`);
        
      } else if (backend.script) {
        // Direct script execution (legacy)
        backendProcess = await this.injectSidewinderAgent(backend.script, {
          sessionId: backend.sessionId || this.session.id,
          wsAgentPort: String(this.wsAgentPort),
          debug: backend.debug || false,
          stdio: backend.stdio || 'inherit'
        });
      } else if (backend.packagePath) {
        // Package.json based execution (npm/yarn)
        backendProcess = await this.injectNpmCommand(backend.packagePath, backend.startScript || 'start', {
          sessionId: backend.sessionId || this.session.id,
          wsAgentPort: String(this.wsAgentPort),
          debug: backend.debug || false,
          stdio: backend.stdio || 'inherit',
          env: backend.env
        });
      } else {
        throw new Error('Backend config must specify executionStrategy, script, or packagePath');
      }
      
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
        wsAgentPort: String(this.wsAgentPort),
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
   * Kill any process running on a specific port
   */
  async killProcessOnPort(port) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    try {
      console.log(`🔍 Checking port ${port}...`);
      
      // Find and kill the process
      if (process.platform === 'darwin' || process.platform === 'linux') {
        // macOS/Linux: Use lsof to find the process
        // Don't check isPortInUse first - just try to kill anything on the port
        try {
          const { stdout } = await execAsync(`lsof -t -i:${port}`);
          const pids = stdout.trim().split('\n').filter(Boolean);
          
          for (const pid of pids) {
            try {
              await execAsync(`kill -9 ${pid}`);
              console.log(`  ✅ Killed process ${pid}`);
            } catch (error) {
              console.warn(`  ⚠️  Failed to kill process ${pid}: ${error.message}`);
            }
          }
        } catch (error) {
          // lsof returns error if no process found, which is fine
          if (!error.message.includes('No such process')) {
            console.warn(`  ⚠️  Error finding process on port ${port}: ${error.message}`);
          }
        }
      } else if (process.platform === 'win32') {
        // Windows: Use netstat and taskkill
        try {
          const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
          const lines = stdout.trim().split('\n');
          const pids = new Set();
          
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0') {
              pids.add(pid);
            }
          }
          
          for (const pid of pids) {
            try {
              await execAsync(`taskkill /F /PID ${pid}`);
              console.log(`  ✅ Killed process ${pid}`);
            } catch (error) {
              console.warn(`  ⚠️  Failed to kill process ${pid}: ${error.message}`);
            }
          }
        } catch (error) {
          console.warn(`  ⚠️  Error finding process on port ${port}: ${error.message}`);
        }
      }
      
      // Wait a moment for the port to be released
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify the port is now free
      const stillInUse = await this.isPortInUse(port);
      if (stillInUse) {
        console.warn(`  ⚠️  Port ${port} still in use after kill attempt`);
      } else {
        console.log(`  ✅ Port ${port} is now free`);
      }
      
    } catch (error) {
      console.error(`Failed to kill process on port ${port}:`, error);
    }
  }

  /**
   * Check if a port is in use
   */
  async isPortInUse(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true); // Port is in use
        } else {
          resolve(false);
        }
      });
      
      server.once('listening', () => {
        server.close();
        resolve(false); // Port is free
      });
      
      server.listen(port, '127.0.0.1');
    });
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
    const { port = this.wsAgentPort } = options;
    return {
      SIDEWINDER_WS_PORT: String(this.wsAgentPort),
      SIDEWINDER_WS_HOST: 'localhost',
      SIDEWINDER_SESSION_ID: this.session.id || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  }
  
  /**
   * Get browser agent script content
   */
  getBrowserAgentScript(options = {}) {
    const { wsUrl = `ws://localhost:${this.wsAgentPort}/browser`, sessionId = '' } = options;
    const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
    const agentPath = path.join(__dirname, 'browser-agent.js');
    
    try {
      let script = fsSync.readFileSync(agentPath, 'utf8');
      // Replace WebSocket URL in the script
      script = script.replace('ws://localhost:9901/browser', wsUrl);
      script = script.replace("'9901'", `'${this.wsAgentPort}'`);
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
  injectBrowserAgentIntoHTML(html, options = {}) {
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
   * Legacy wrapper for spawnWithAgent - delegates to monitorFullStackApp
   * @deprecated Use monitorFullStackApp instead
   */
  async spawnWithAgent(command, args = [], options = {}) {
    console.warn('spawnWithAgent is deprecated, use monitorFullStackApp instead');
    
    // Extract script from args
    let script = null;
    if (command === 'node' && args.length > 0) {
      script = args[0];
    }
    
    if (!script) {
      throw new Error('spawnWithAgent: Unable to determine script from arguments');
    }
    
    // Create config for monitorFullStackApp
    const config = {
      backend: {
        script,
        name: 'legacy-spawn',
        debug: false,
        stdio: options.stdio || 'inherit'
      }
    };
    
    const app = await this.monitorFullStackApp(config);
    
    // Return the backend process for compatibility
    const backend = this.activeBackends.get('legacy-spawn');
    return backend ? backend.process : null;
  }

  /**
   * Inject Sidewinder agent into npm/yarn command
   */
  async injectNpmCommand(packagePath, scriptName, options = {}) {
    const { spawn } = await import('child_process');
    const agentPath = path.join(__dirname, 'sidewinder-agent.cjs');
    
    // Verify agent file exists
    try {
      await fs.access(agentPath);
    } catch (error) {
      throw new Error(`Sidewinder agent not found at ${agentPath}`);
    }
    
    // Read package.json to understand the start script
    let startCommand = null;
    try {
      const packageJsonPath = path.join(packagePath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      startCommand = packageJson.scripts?.[scriptName];
    } catch (error) {
      console.warn(`Could not read package.json: ${error.message}`);
    }
    
    // If we have a ts-node script, run it directly with node and our agent
    if (startCommand && startCommand.includes('ts-node')) {
      console.log(`🔬 Detected ts-node script, using direct injection`);
      
      // Extract the actual script file from the ts-node command
      const scriptMatch = startCommand.match(/ts-node(?:\/register)?\s+(.+?)(?:\s|$)/);
      if (scriptMatch && scriptMatch[1]) {
        const scriptFile = path.join(packagePath, scriptMatch[1]);
        
        // Run directly with node, using both our agent and ts-node/register
        const child = spawn('node', [
          '--require', agentPath,
          '--require', 'ts-node/register',
          scriptFile
        ], {
          cwd: packagePath,
          stdio: options.stdio || 'inherit',
          env: {
            ...process.env,
            ...options.env,
            SIDEWINDER_SESSION_ID: options.sessionId || this.session.id,
            SIDEWINDER_WS_PORT: options.wsAgentPort || String(this.wsAgentPort),
            SIDEWINDER_WS_HOST: options.wsHost || 'localhost',
            SIDEWINDER_DEBUG: 'true' // Enable debug for ts-node projects
          }
        });
        
        return child;
      }
    }
    
    // Fallback to standard npm injection for non-ts-node scripts
    console.log(`📦 Using standard npm injection for script: ${scriptName}`);
    const child = spawn('npm', ['run', scriptName], {
      cwd: packagePath,
      stdio: options.stdio || 'inherit',
      env: {
        ...process.env,
        ...options.env,
        SIDEWINDER_SESSION_ID: options.sessionId || this.session.id,
        SIDEWINDER_WS_PORT: options.wsAgentPort || String(this.wsAgentPort),
        SIDEWINDER_WS_HOST: options.wsHost || 'localhost',
        SIDEWINDER_DEBUG: options.debug ? 'true' : 'false',
        NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require "${agentPath}"`.trim()
      }
    });
    
    return child;
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

  // ========================================
  // INTEGRATED BROWSER FUNCTIONALITY
  // ========================================

  /**
   * Launch browser instance
   */
  async launch(options = {}) {
    if (!puppeteer) {
      throw new Error('Puppeteer not available - install puppeteer to use browser features');
    }

    try {
      // For macOS, we need to handle browser permissions properly
      const isHeadless = options.headless !== undefined ? options.headless : false;
      
      const launchOptions = {
        headless: isHeadless ? 'new' : false, // Use new headless mode or visible
        devtools: options.devtools || false,
        defaultViewport: options.viewport || { width: 1280, height: 720 },
        ignoreDefaultArgs: false,
        pipe: isHeadless, // Use pipe for headless, WebSocket for visible
        args: options.args || [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-extensions',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--no-first-run',
          '--disable-default-apps',
          '--disable-gpu',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          ...(isHeadless ? ['--remote-debugging-port=0'] : []), // Only for headless
          ...(process.platform === 'darwin' && isHeadless ? [
            '--enable-features=UseOzonePlatform',
            '--ozone-platform=headless'
          ] : [])
        ],
        ...options
      };

      // For visible browser on macOS, try to use system Chrome
      if (!isHeadless && process.platform === 'darwin') {
        const systemChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        try {
          await fs.access(systemChromePath);
          launchOptions.executablePath = systemChromePath;
          console.log('🍎 Using system Chrome for visible browser');
        } catch (e) {
          console.log('⚠️  System Chrome not found, using bundled Chrome');
        }
      }

      // Remove pipe option if explicitly set to false
      if (options.pipe === false) {
        delete launchOptions.pipe;
      }

      console.log('🚀 Launching browser with options:', { 
        headless: launchOptions.headless,
        pipe: launchOptions.pipe,
        platform: process.platform,
        argsCount: launchOptions.args?.length 
      });

      this.browser = await puppeteer.launch(launchOptions);
      
      // Add error handler for the browser
      this.browser.on('disconnected', () => {
        console.log('⚠️  Browser disconnected');
        this.browser = null;
      });

      // Test browser connection
      const version = await this.browser.version();
      console.log(`📦 Browser version: ${version}`);

      this.emit('browser-launched', {
        browser: this.browser,
        options: launchOptions,
        timestamp: new Date()
      });

      console.log(`🌐 Browser launched successfully (headless: ${launchOptions.headless})`);
      return this.browser;

    } catch (error) {
      console.error('❌ Failed to launch browser:', error.message);
      
      // If visible browser failed, try headless as fallback
      if (options.headless === false && !options._fallbackAttempt) {
        console.log('🔄 Visible browser failed, trying headless fallback...');
        return this.launch({ ...options, headless: true, _fallbackAttempt: true });
      }
      
      throw error;
    }
  }

  /**
   * Monitor a page for a session
   */
  async monitorPage(url, sessionId) {
    try {
      if (!this.browser) {
        await this.launch(); // Launch with default options
      }

      console.log(`📄 Creating new page for session: ${sessionId}`);
      const page = await this.browser.newPage();
      const pageId = `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Set up event handlers
      page.on('console', (msg) => {
        this.emit('console-message', {
          pageId,
          sessionId,
          type: msg.type(),
          text: msg.text(),
          timestamp: new Date()
        });
      });

      page.on('pageerror', (error) => {
        this.emit('page-error', {
          pageId,
          sessionId,
          message: error.message,
          stack: error.stack,
          timestamp: new Date()
        });
      });

      // Navigate to URL with shorter timeout for data URLs
      const isDataUrl = url.startsWith('data:');
      console.log(`🔗 Navigating to: ${isDataUrl ? 'data URL' : url}`);
      
      await page.goto(url, {
        waitUntil: isDataUrl ? 'domcontentloaded' : 'networkidle2',
        timeout: 15000
      });

      // Store page info
      const pageInfo = {
        id: pageId,
        page,
        url,
        sessionId,
        createdAt: new Date()
      };

      this.browserPages.set(pageId, pageInfo);
      
      // Track pages by session
      if (!this.sessionPages.has(sessionId)) {
        this.sessionPages.set(sessionId, []);
      }
      this.sessionPages.get(sessionId).push(pageId);

      this.emit('page-created', {
        pageId,
        url,
        sessionId,
        timestamp: new Date()
      });

      console.log(`✅ Page opened successfully: ${pageId}`);
      return pageInfo;
      
    } catch (error) {
      console.error(`❌ Failed to monitor page: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get pages for a session
   */
  getSessionPages(sessionId) {
    const pageIds = this.sessionPages.get(sessionId) || [];
    return pageIds.map(pageId => this.browserPages.get(pageId)).filter(Boolean);
  }

  /**
   * Close a page
   */
  async closePage(pageId) {
    const pageInfo = this.browserPages.get(pageId);
    if (pageInfo) {
      await pageInfo.page.close();
      this.browserPages.delete(pageId);
      
      // Remove from session tracking
      for (const [sessionId, pageIds] of this.sessionPages.entries()) {
        const index = pageIds.indexOf(pageId);
        if (index > -1) {
          pageIds.splice(index, 1);
          if (pageIds.length === 0) {
            this.sessionPages.delete(sessionId);
          }
          break;
        }
      }

      this.emit('page-closed', {
        pageId,
        sessionId: pageInfo.sessionId,
        timestamp: new Date()
      });

      console.log(`📄 Page closed: ${pageId}`);
    }
  }

  /**
   * Close browser
   */
  async closeBrowser() {
    if (this.browser) {
      // Close all pages first
      for (const [pageId] of this.browserPages) {
        await this.closePage(pageId);
      }

      await this.browser.close();
      this.browser = null;

      this.emit('browser-closed', {
        timestamp: new Date()
      });

      console.log('🌐 Browser closed');
    }
  }

  /**
   * Take screenshot of a page
   */
  async takeScreenshot(sessionId, options = {}) {
    const pages = this.getSessionPages(sessionId);
    if (!pages || pages.length === 0) {
      throw new Error('No page open for this session. Use monitorPage first.');
    }

    const pageInfo = pages[0]; // Use first page
    const page = pageInfo.page;

    const screenshotOptions = {
      fullPage: options.fullPage || false,
      ...(options.format && { type: options.format }),
      ...(options.quality && { quality: options.quality })
    };

    if (options.path) {
      screenshotOptions.path = options.path;
      await page.screenshot(screenshotOptions);
      console.log(`📷 Screenshot saved: ${options.path}`);
      return { path: options.path };
    } else {
      screenshotOptions.encoding = 'base64';
      const screenshot = await page.screenshot(screenshotOptions);
      console.log(`📷 Screenshot captured (${screenshot.length} chars)`);
      return { base64: screenshot };
    }
  }

  /**
   * Execute browser command on a page
   */
  async executeBrowserCommand(sessionId, command, args = []) {
    const pages = this.getSessionPages(sessionId);
    if (!pages || pages.length === 0) {
      throw new Error('No page open for this session. Use monitorPage first.');
    }

    const pageInfo = pages[0];
    const page = pageInfo.page;

    switch (command) {
      case 'click':
        if (!args[0]) throw new Error('Click command requires selector argument');
        await page.click(args[0]);
        return `Clicked element: ${args[0]}`;

      case 'type':
        if (args.length < 2) throw new Error('Type command requires selector and text arguments');
        await page.type(args[0], args[1]);
        return `Typed "${args[1]}" into ${args[0]}`;

      case 'evaluate':
        if (!args[0]) throw new Error('Evaluate command requires JavaScript code argument');
        const evalResult = await page.evaluate(args[0]);
        return `Evaluation result: ${JSON.stringify(evalResult)}`;

      case 'title':
        const title = await page.title();
        return `Page title: ${title}`;

      case 'url':
        const url = page.url();
        return `Page URL: ${url}`;

      default:
        throw new Error(`Unknown browser command: ${command}`);
    }
  }

  /**
   * Clean up all resources
   */
  async cleanup() {
    console.log('🧹 Cleaning up FullStackMonitor...');
    
    // Set cleanup flag to prevent logging after cleanup
    this.isCleaningUp = true;
    
    // Stop Agent WebSocket server
    if (this.agentServer) {
      try {
        // Remove all event listeners from clients first
        for (const [clientId, ws] of this.sidewinderClients.entries()) {
          try {
            ws.removeAllListeners();
            ws.terminate(); // Force close immediately
          } catch (e) {
            // Ignore errors during cleanup
          }
        }
        this.sidewinderClients.clear();
        
        // Remove all event listeners from browser clients
        for (const [clientId, ws] of this.browserClients.entries()) {
          try {
            ws.removeAllListeners();
            ws.terminate(); // Force close immediately
          } catch (e) {
            // Ignore errors during cleanup
          }
        }
        this.browserClients.clear();
        
        // Force close all connections on the server
        this.agentServer.clients.forEach(ws => {
          try {
            ws.terminate();
          } catch (e) {
            // Ignore
          }
        });
        
        // Close the server with shorter timeout
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve();
          }, 500); // Shorter timeout
          
          this.agentServer.close((err) => {
            clearTimeout(timeout);
            resolve();
          });
        });
        
        // Null out the reference
        this.agentServer = null;
        console.log('  Agent server stopped');
      } catch (error) {
        console.warn('  Warning: Failed to stop agent server:', error.message);
      }
    }
    
    // Close integrated browser
    await this.closeBrowser();
    
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