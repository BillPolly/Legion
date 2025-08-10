/**
 * StandaloneSessionManager - Extends SessionManager with mock FullStackMonitor support
 * This version includes Sidewinder support for the simplified tools
 */

import { EventEmitter } from 'events';
import { SessionManager } from './SessionManager.js';

/**
 * Mock FullStackMonitor for testing MCP server without full dependencies
 */
class MockFullStackMonitor extends EventEmitter {
  constructor(resourceManager) {
    super();
    this.resourceManager = resourceManager;
    this.session = { id: `session-${Date.now()}` };
    this.startTime = new Date();
    this.isActive = true;
    
    // Mock state
    this.activeBrowsers = new Map();
    this.backendProcesses = new Map();
    this.logs = {
      backend: [],
      frontend: []
    };
    this.correlations = new Map();
    this.debugScenariosRun = 0;
    
    // Mock logManager and browserMonitor
    this.logManager = {
      searchLogs: async (params) => {
        const matches = this.logs.backend.filter(log => 
          log.message.toLowerCase().includes(params.query.toLowerCase())
        );
        return {
          success: true,
          matches: matches
        };
      }
    };
    
    this.browserMonitor = {
      getSessionLogs: (sessionId) => {
        return this.logs.frontend;
      }
    };
  }
  
  static async create(resourceManager) {
    const monitor = new MockFullStackMonitor(resourceManager);
    await monitor.initialize();
    return monitor;
  }
  
  async initialize() {
    // Add some mock logs for testing
    this.logs.backend.push(
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Server initialized successfully',
        processId: 'main'
      },
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Test endpoint registered',
        processId: 'main'
      }
    );
    
    this.logs.frontend.push(
      {
        timestamp: new Date().toISOString(),
        type: 'log',
        text: 'Frontend app loaded',
        pageId: 'main'
      },
      {
        timestamp: new Date().toISOString(),
        type: 'info',
        text: 'Test component mounted',
        pageId: 'main'
      }
    );
    
    // Mock initialization
    this.emit('initialized');
  }
  
  async monitorFullStackApp(config) {
    // Mock full-stack monitoring
    const mockBackend = {
      name: config.backend?.name || 'mock-backend',
      pid: Math.floor(Math.random() * 10000),
      status: 'running'
    };
    
    const mockBrowser = {
      id: `browser-${Date.now()}`,
      url: config.frontend?.url || 'http://localhost:3000'
    };
    
    this.backendProcesses.set('default', mockBackend);
    this.activeBrowsers.set('default', { page: { screenshot: async () => Buffer.from('mock-image') } });
    
    // Add some mock logs
    this.logs.backend.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Backend ${mockBackend.name} started on PID ${mockBackend.pid}`,
      processId: mockBackend.name
    });
    
    this.logs.frontend.push({
      timestamp: new Date().toISOString(),
      type: 'log',
      text: `Frontend loaded: ${mockBrowser.url}`,
      pageId: mockBrowser.id
    });
    
    return {
      backend: mockBackend,
      browser: mockBrowser
    };
  }
  
  async debugScenario(steps) {
    this.debugScenariosRun++;
    const results = [];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const correlationId = `corr-${Date.now()}-${i}`;
      
      // Mock step execution - always succeed for tests
      const success = true;
      
      const result = {
        step,
        success,
        error: success ? null : `Mock error in step ${i + 1}`,
        correlationId,
        backendLogs: this.logs.backend.slice(-2),
        frontendLogs: this.logs.frontend.slice(-2),
        analysis: {
          insights: success ? [] : [
            { type: 'frontend-errors', count: 1, message: 'Mock frontend error' }
          ]
        }
      };
      
      results.push(result);
      
      // Store correlation
      this.correlations.set(correlationId, {
        backend: this.logs.backend.slice(-1),
        frontend: this.logs.frontend.slice(-1),
        network: []
      });
    }
    
    return results;
  }
  
  async getCorrelatedLogs(correlationId) {
    return this.correlations.get(correlationId) || {
      backend: [],
      frontend: [],
      network: []
    };
  }
  
  getStatistics() {
    return {
      backend: {
        totalLogs: this.logs.backend.length,
        processes: this.backendProcesses.size,
        errors: this.logs.backend.filter(l => l.level === 'error').length
      },
      frontend: {
        totalConsoleMessages: this.logs.frontend.length,
        totalNetworkRequests: 0,
        totalErrors: this.logs.frontend.filter(l => l.type === 'error').length
      },
      correlationsDetected: this.correlations.size,
      debugScenariosRun: this.debugScenariosRun,
      uptime: Date.now() - this.startTime.getTime()
    };
  }
  
  getSessionLogs(sessionId) {
    return this.logs.frontend;
  }
  
  async cleanup() {
    this.isActive = false;
    this.activeBrowsers.clear();
    this.backendProcesses.clear();
    this.emit('cleanup');
  }
}

export class StandaloneSessionManager extends SessionManager {
  constructor() {
    super(); // Initialize parent SessionManager
    // Override to use MockFullStackMonitor instead of real one
    this.useMockMonitor = true;
  }
  
  /**
   * Override to create MockFullStackMonitor instead of real one
   */
  async getOrCreateMonitor(sessionId = 'default') {
    if (this.monitors.has(sessionId)) {
      return this.monitors.get(sessionId);
    }
    
    // Check session limit
    if (this.monitors.size >= this.maxSessions) {
      // Clean up oldest session
      const oldestSession = Array.from(this.monitors.keys())[0];
      await this.endSession(oldestSession);
    }
    
    // Create new mock monitor instead of real FullStackMonitor
    const monitor = await MockFullStackMonitor.create(this.defaultResourceManager);
    
    this.monitors.set(sessionId, monitor);
    this.sessions.set(sessionId, {
      id: sessionId,
      monitor,
      startTime: new Date(),
      active: true
    });
    
    // Set up cleanup on monitor events
    monitor.on('cleanup', () => {
      this.monitors.delete(sessionId);
      this.sessions.delete(sessionId);
    });
    
    return monitor;
  }
}