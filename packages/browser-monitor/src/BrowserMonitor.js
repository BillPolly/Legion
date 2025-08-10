/**
 * BrowserMonitor - Core browser automation and monitoring class
 * Provides browser lifecycle management, page monitoring, and session tracking
 */

import { EventEmitter } from 'events';
// Dynamic imports to handle missing dependencies during testing
let puppeteer;
let playwright;

try {
  puppeteer = (await import('puppeteer')).default;
} catch (e) {
  // Puppeteer not installed
}

try {
  playwright = (await import('playwright')).default;
} catch (e) {
  // Playwright not installed
}

export class BrowserMonitor extends EventEmitter {
  constructor(config) {
    super();
    
    this.resourceManager = config.resourceManager;
    this.browserType = config.browserType;
    this.browser = null;
    this.driver = null;
    this.pages = new Map();
    this.sessions = new Map();
    
    // Statistics
    this.stats = {
      totalPagesCreated: 0,
      totalSessionsCreated: 0,
      totalConsoleMessages: 0,
      totalNetworkRequests: 0,
      totalErrors: 0,
      startTime: new Date()
    };
    
    // Configuration
    this.config = {
      defaultTimeout: 30000,
      slowMo: 0,
      ...config.options
    };
  }
  
  /**
   * Create BrowserMonitor instance using async factory pattern
   */
  static async create(resourceManager) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    
    const browserType = resourceManager.get('BROWSER_TYPE') || 'puppeteer';
    
    const monitor = new BrowserMonitor({
      resourceManager,
      browserType
    });
    
    await monitor.initialize();
    return monitor;
  }
  
  /**
   * Initialize the browser monitor
   */
  async initialize() {
    // Set up the appropriate driver
    switch (this.browserType) {
      case 'puppeteer':
        this.driver = puppeteer;
        break;
        
      case 'playwright':
      case 'playwright-chromium':
        this.driver = playwright.chromium;
        break;
        
      case 'playwright-firefox':
        this.driver = playwright.firefox;
        break;
        
      case 'playwright-webkit':
        this.driver = playwright.webkit;
        break;
        
      case 'mock':
        // For testing - driver should be injected
        break;
        
      default:
        throw new Error(`Unsupported browser type: ${this.browserType}`);
    }
    
    this.emit('initialized', {
      browserType: this.browserType,
      timestamp: new Date()
    });
  }
  
  /**
   * Launch browser instance
   */
  async launch(options = {}) {
    try {
      const launchOptions = {
        headless: options.headless !== undefined ? options.headless : true,
        devtools: options.devtools || false,
        slowMo: options.slowMo || this.config.slowMo,
        defaultViewport: options.viewport || { width: 1280, height: 720 },
        args: options.args || [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=IsolateOrigins',
          '--disable-site-isolation-trials'
        ],
        ...options
      };
      
      this.browser = await this.driver.launch(launchOptions);
      
      // Set up browser event handlers
      this.browser.on('disconnected', () => {
        this.emit('browser-crashed', {
          timestamp: new Date(),
          message: 'Browser disconnected unexpectedly'
        });
      });
      
      this.emit('browser-launched', {
        browser: this.browser,
        options: launchOptions,
        timestamp: new Date()
      });
      
      return this.browser;
      
    } catch (error) {
      this.stats.totalErrors++;
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Close browser instance
   */
  async close() {
    if (this.browser) {
      // Close all pages first
      for (const [pageId, monitoredPage] of this.pages.entries()) {
        await this.closePage(pageId);
      }
      
      await this.browser.close();
      this.browser = null;
      
      this.emit('browser-closed', {
        timestamp: new Date()
      });
    }
  }
  
  /**
   * Check if browser is connected
   */
  isConnected() {
    if (!this.browser) return false;
    
    // Check based on browser type
    if (this.browserType === 'puppeteer' || this.browserType === 'mock') {
      return this.browser.isConnected ? this.browser.isConnected : this.browser.isConnected !== false;
    } else {
      // Playwright
      return this.browser.isConnected();
    }
  }
  
  /**
   * Create a monitored page
   */
  async monitorPage(url, sessionId) {
    if (!this.browser) {
      throw new Error('Browser not launched. Call launch() first.');
    }
    
    const page = await this.browser.newPage();
    const pageId = `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Inject monitoring script before navigation
    const monitoringScript = this.getMonitoringScript(sessionId, pageId);
    await page.evaluateOnNewDocument(monitoringScript, sessionId, pageId);
    
    // Set up console capture
    page.on('console', (msg) => {
      this.handleConsoleMessage(pageId, sessionId, msg);
    });
    
    // Set up network interception
    page.on('request', (request) => {
      this.handleNetworkRequest(pageId, sessionId, request);
    });
    
    page.on('response', (response) => {
      this.handleNetworkResponse(pageId, sessionId, response);
    });
    
    // Set up error capture
    page.on('pageerror', (error) => {
      this.handlePageError(pageId, sessionId, error);
    });
    
    // Navigate to URL
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: this.config.defaultTimeout
    });
    
    // Create monitored page object
    const monitoredPage = {
      id: pageId,
      page,
      url,
      sessionId,
      createdAt: new Date(),
      consoleLogs: [],
      networkRequests: [],
      errors: [],
      
      // Helper methods
      navigate: async (newUrl, options = {}) => {
        return page.goto(newUrl, {
          waitUntil: 'networkidle2',
          timeout: this.config.defaultTimeout,
          ...options
        });
      },
      
      screenshot: async (options = {}) => {
        const screenshot = await page.screenshot(options);
        this.emit('screenshot-taken', {
          pageId,
          sessionId,
          timestamp: new Date(),
          options
        });
        return screenshot;
      },
      
      startRecording: async (options = {}) => {
        const { path, format = 'mp4', fps = 30 } = options;
        
        if (monitoredPage._recording) {
          throw new Error('Recording already in progress');
        }
        
        // Use native Puppeteer screencast if available (Puppeteer 21+)
        if (page.screencast) {
          const recordingOptions = {
            path,
            format,
            fps
          };
          
          monitoredPage._recording = {
            path,
            startTime: new Date(),
            options: recordingOptions
          };
          
          await page.screencast(recordingOptions);
          
          this.emit('recording-started', {
            pageId,
            sessionId,
            timestamp: new Date(),
            path,
            options: recordingOptions
          });
          
          return { path, startTime: monitoredPage._recording.startTime };
        } else {
          throw new Error('Video recording not supported in this Puppeteer version');
        }
      },
      
      stopRecording: async () => {
        if (!monitoredPage._recording) {
          throw new Error('No recording in progress');
        }
        
        if (page.screencast) {
          await page.screencast({ path: null }); // Stop recording
        }
        
        const recording = monitoredPage._recording;
        const duration = new Date() - recording.startTime;
        
        delete monitoredPage._recording;
        
        this.emit('recording-stopped', {
          pageId,
          sessionId,
          timestamp: new Date(),
          path: recording.path,
          duration
        });
        
        return {
          path: recording.path,
          duration,
          startTime: recording.startTime,
          endTime: new Date()
        };
      },
      
      isRecording: () => {
        return !!monitoredPage._recording;
      },
      
      click: async (selector) => {
        await page.click(selector);
        this.emit('element-clicked', {
          pageId,
          sessionId,
          selector,
          timestamp: new Date()
        });
      },
      
      type: async (selector, text) => {
        await page.type(selector, text);
        this.emit('text-typed', {
          pageId,
          sessionId,
          selector,
          text: text.substring(0, 20) + '...', // Don't log full text for security
          timestamp: new Date()
        });
      },
      
      evaluate: async (fn, ...args) => {
        return page.evaluate(fn, ...args);
      },
      
      waitForSelector: async (selector, options = {}) => {
        return page.waitForSelector(selector, {
          timeout: this.config.defaultTimeout,
          ...options
        });
      }
    };
    
    // Store the monitored page
    this.pages.set(pageId, monitoredPage);
    this.stats.totalPagesCreated++;
    
    this.emit('page-created', {
      pageId,
      url,
      sessionId,
      timestamp: new Date()
    });
    
    return monitoredPage;
  }
  
  /**
   * Close a monitored page
   */
  async closePage(pageId) {
    const monitoredPage = this.pages.get(pageId);
    if (monitoredPage) {
      await monitoredPage.page.close();
      this.pages.delete(pageId);
      
      this.emit('page-closed', {
        pageId,
        sessionId: monitoredPage.sessionId,
        timestamp: new Date()
      });
    }
  }
  
  /**
   * Create a monitoring session
   */
  async createSession(config) {
    const session = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: config.name,
      metadata: config.metadata || {},
      startTime: new Date(),
      pages: [],
      logs: [],
      requests: []
    };
    
    this.sessions.set(session.id, session);
    this.stats.totalSessionsCreated++;
    
    this.emit('session-created', {
      sessionId: session.id,
      name: session.name,
      timestamp: new Date()
    });
    
    return session;
  }
  
  /**
   * End a monitoring session
   */
  async endSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    // Close all pages for this session
    for (const [pageId, page] of this.pages.entries()) {
      if (page.sessionId === sessionId) {
        await this.closePage(pageId);
      }
    }
    
    session.endTime = new Date();
    this.sessions.delete(sessionId);
    
    this.emit('session-ended', {
      sessionId,
      duration: session.endTime - session.startTime,
      timestamp: new Date()
    });
  }
  
  /**
   * Get monitoring script to inject into pages
   */
  getMonitoringScript(sessionId, pageId) {
    return function() {
      // This runs in the browser context
      window.__BROWSER_MONITOR__ = {
        sessionId: arguments[0],
        pageId: arguments[1],
        startTime: Date.now(),
        logs: [],
        errors: [],
        
        // Override console methods
        captureConsole: function() {
          const original = {};
          ['log', 'warn', 'error', 'info', 'debug'].forEach(method => {
            original[method] = console[method];
            console[method] = function(...args) {
              window.__BROWSER_MONITOR__.logs.push({
                type: method,
                args: args,
                timestamp: Date.now(),
                stack: new Error().stack
              });
              original[method].apply(console, args);
            };
          });
        },
        
        // Capture unhandled errors
        captureErrors: function() {
          window.addEventListener('error', (event) => {
            window.__BROWSER_MONITOR__.errors.push({
              message: event.message,
              filename: event.filename,
              lineno: event.lineno,
              colno: event.colno,
              error: event.error ? event.error.stack : null,
              timestamp: Date.now()
            });
          });
          
          window.addEventListener('unhandledrejection', (event) => {
            window.__BROWSER_MONITOR__.errors.push({
              type: 'unhandledrejection',
              reason: event.reason,
              promise: event.promise,
              timestamp: Date.now()
            });
          });
        },
        
        // Add correlation ID to requests
        injectCorrelation: function() {
          const originalFetch = window.fetch;
          window.fetch = function(...args) {
            const correlationId = `correlation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Add correlation header
            if (args[1] && args[1].headers) {
              args[1].headers['X-Correlation-ID'] = correlationId;
            } else if (args[1]) {
              args[1].headers = { 'X-Correlation-ID': correlationId };
            } else {
              args[1] = { headers: { 'X-Correlation-ID': correlationId } };
            }
            
            // Log the request
            console.log(`[${correlationId}] Fetch:`, args[0]);
            
            return originalFetch.apply(window, args);
          };
        }
      };
      
      // Initialize monitoring
      window.__BROWSER_MONITOR__.captureConsole();
      window.__BROWSER_MONITOR__.captureErrors();
      window.__BROWSER_MONITOR__.injectCorrelation();
    };
  }
  
  /**
   * Handle console messages from the page
   */
  handleConsoleMessage(pageId, sessionId, msg) {
    const logEntry = {
      pageId,
      sessionId,
      type: msg.type(),
      text: msg.text(),
      args: msg.args().map(arg => {
        try {
          return arg.jsonValue ? arg.jsonValue() : String(arg);
        } catch {
          return String(arg);
        }
      }),
      timestamp: new Date()
    };
    
    // Store in page's console logs
    const page = this.pages.get(pageId);
    if (page) {
      page.consoleLogs.push(logEntry);
    }
    
    // Store in session
    const session = this.sessions.get(sessionId);
    if (session) {
      session.logs.push(logEntry);
    }
    
    this.stats.totalConsoleMessages++;
    
    this.emit('console-message', logEntry);
  }
  
  /**
   * Handle network requests
   */
  handleNetworkRequest(pageId, sessionId, request) {
    const requestEntry = {
      pageId,
      sessionId,
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      postData: request.postData ? request.postData() : null,
      resourceType: request.resourceType(),
      timestamp: new Date()
    };
    
    // Look for correlation ID
    const correlationId = requestEntry.headers['x-correlation-id'] || 
                         requestEntry.headers['X-Correlation-ID'];
    if (correlationId) {
      requestEntry.correlationId = correlationId;
    }
    
    // Store in page's network requests
    const page = this.pages.get(pageId);
    if (page) {
      page.networkRequests.push(requestEntry);
    }
    
    // Store in session
    const session = this.sessions.get(sessionId);
    if (session) {
      session.requests.push(requestEntry);
    }
    
    this.stats.totalNetworkRequests++;
    
    this.emit('network-request', requestEntry);
  }
  
  /**
   * Handle network responses
   */
  handleNetworkResponse(pageId, sessionId, response) {
    const responseEntry = {
      pageId,
      sessionId,
      url: response.url(),
      status: response.status(),
      headers: response.headers(),
      requestUrl: response.request().url(),
      timestamp: new Date()
    };
    
    this.emit('network-response', responseEntry);
  }
  
  /**
   * Handle page errors
   */
  handlePageError(pageId, sessionId, error) {
    const errorEntry = {
      pageId,
      sessionId,
      message: error.message,
      stack: error.stack,
      timestamp: new Date()
    };
    
    // Store in page's errors
    const page = this.pages.get(pageId);
    if (page) {
      page.errors.push(errorEntry);
    }
    
    this.stats.totalErrors++;
    
    this.emit('page-error', errorEntry);
  }
  
  /**
   * Get statistics
   */
  getStatistics() {
    return {
      activeSessions: this.sessions.size,
      activePages: this.pages.size,
      browserConnected: this.isConnected(),
      totalPagesCreated: this.stats.totalPagesCreated,
      totalSessionsCreated: this.stats.totalSessionsCreated,
      totalConsoleMessages: this.stats.totalConsoleMessages,
      totalNetworkRequests: this.stats.totalNetworkRequests,
      totalErrors: this.stats.totalErrors,
      uptime: Date.now() - this.stats.startTime.getTime()
    };
  }
  
  /**
   * Get session details
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }
  
  /**
   * Get page details
   */
  getPage(pageId) {
    return this.pages.get(pageId);
  }
  
  /**
   * Get all console logs for a session
   */
  getSessionLogs(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? session.logs : [];
  }
  
  /**
   * Get all network requests for a session
   */
  getSessionRequests(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? session.requests : [];
  }
}