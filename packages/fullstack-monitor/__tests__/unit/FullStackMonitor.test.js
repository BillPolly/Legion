/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock implementations
class MockLogManager extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map();
    this.monitoredProcesses = new Map();
  }

  static async create(resourceManager) {
    const manager = new MockLogManager();
    manager.resourceManager = resourceManager;
    await manager.initialize();
    return manager;
  }

  async initialize() {
    this.emit('initialized');
  }

  async createSession(config) {
    const session = {
      sessionId: `session-${Date.now()}`,
      name: config.name,
      metadata: config.metadata || {}
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  async monitorProcess(script, name) {
    const process = {
      pid: Math.floor(Math.random() * 10000),
      name,
      script,
      status: 'running'
    };
    this.monitoredProcesses.set(name, process);
    this.emit('process-started', process);
    return process;
  }

  async searchLogs(query) {
    return {
      success: true,
      matches: [],
      totalMatches: 0
    };
  }

  async getCorrelation(correlationId) {
    return [];
  }
}

class MockBrowserMonitor extends EventEmitter {
  constructor() {
    super();
    this.pages = new Map();
    this.sessions = new Map();
    this.browser = null;
  }

  static async create(resourceManager) {
    const monitor = new MockBrowserMonitor();
    monitor.resourceManager = resourceManager;
    await monitor.initialize();
    return monitor;
  }

  async initialize() {
    this.emit('initialized');
  }

  async launch(options = {}) {
    this.browser = { isConnected: true };
    this.emit('browser-launched', { browser: this.browser });
    return this.browser;
  }

  async monitorPage(url, sessionId) {
    const page = {
      id: `page-${Date.now()}`,
      url,
      sessionId,
      navigate: jest.fn(),
      click: jest.fn(),
      type: jest.fn(),
      screenshot: jest.fn()
    };
    this.pages.set(page.id, page);
    this.emit('page-created', { pageId: page.id, url, sessionId });
    return page;
  }

  async close() {
    this.browser = null;
    this.emit('browser-closed');
  }

  getSessionLogs(sessionId) {
    return [];
  }

  getSessionRequests(sessionId) {
    return [];
  }
}

class MockResourceManager {
  constructor() {
    this.resources = new Map();
  }

  get(key) {
    return this.resources.get(key);
  }

  set(key, value) {
    this.resources.set(key, value);
  }
}

// Import the actual FullStackMonitor once it's created
// For now, we'll define expected behavior

describe('FullStackMonitor', () => {
  let resourceManager;
  let monitor;

  beforeEach(() => {
    resourceManager = new MockResourceManager();
  });

  afterEach(async () => {
    if (monitor) {
      await monitor.cleanup();
    }
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create instance with async factory pattern', async () => {
      const FullStackMonitor = getMockFullStackMonitor();
      monitor = await FullStackMonitor.create(resourceManager);
      
      expect(monitor).toBeDefined();
      expect(monitor.logManager).toBeDefined();
      expect(monitor.browserMonitor).toBeDefined();
    });

    it('should throw if resourceManager is not provided', async () => {
      const FullStackMonitor = getMockFullStackMonitor();
      await expect(FullStackMonitor.create()).rejects.toThrow('ResourceManager is required');
    });

    it('should initialize both managers', async () => {
      const FullStackMonitor = getMockFullStackMonitor();
      monitor = await FullStackMonitor.create(resourceManager);
      
      expect(monitor.logManager).toBeInstanceOf(MockLogManager);
      expect(monitor.browserMonitor).toBeInstanceOf(MockBrowserMonitor);
    });

    it('should create unified session', async () => {
      const FullStackMonitor = getMockFullStackMonitor();
      monitor = await FullStackMonitor.create(resourceManager);
      
      expect(monitor.session).toBeDefined();
      expect(monitor.session.id).toBeDefined();
      expect(monitor.session.type).toBe('fullstack');
    });
  });

  describe('full-stack monitoring', () => {
    beforeEach(async () => {
      const FullStackMonitor = getMockFullStackMonitor();
      monitor = await FullStackMonitor.create(resourceManager);
    });

    it('should monitor full-stack application', async () => {
      const config = {
        backend: {
          script: 'server.js',
          name: 'backend-server',
          port: 3001
        },
        frontend: {
          url: 'http://localhost:3000'
        }
      };
      
      const result = await monitor.monitorFullStackApp(config);
      
      expect(result).toHaveProperty('backend');
      expect(result).toHaveProperty('browser');
      expect(result).toHaveProperty('session');
      expect(result.backend.name).toBe('backend-server');
      expect(result.browser.url).toBe('http://localhost:3000');
    });

    it('should wait for backend to be ready before launching browser', async () => {
      const config = {
        backend: {
          script: 'server.js',
          name: 'backend',
          port: 3001
        },
        frontend: {
          url: 'http://localhost:3000'
        }
      };
      
      // Mock waitForPort
      monitor.waitForPort = jest.fn().mockResolvedValue(true);
      
      await monitor.monitorFullStackApp(config);
      
      expect(monitor.waitForPort).toHaveBeenCalledWith(3001);
    });

    it('should link correlations between backend and frontend', async () => {
      const config = {
        backend: {
          script: 'server.js',
          name: 'backend',
          port: 3001
        },
        frontend: {
          url: 'http://localhost:3000'
        }
      };
      
      const result = await monitor.monitorFullStackApp(config);
      
      // Verify correlation linking is set up
      expect(monitor.correlations).toBeDefined();
    });
  });

  describe('debugging scenarios', () => {
    beforeEach(async () => {
      const FullStackMonitor = getMockFullStackMonitor();
      monitor = await FullStackMonitor.create(resourceManager);
    });

    it('should execute debug scenario steps', async () => {
      const steps = [
        { action: 'navigate', url: 'http://localhost:3000/login' },
        { action: 'type', selector: '#username', text: 'test' },
        { action: 'click', selector: '#submit' }
      ];
      
      const results = await monitor.debugScenario(steps);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toHaveProperty('step');
        expect(result).toHaveProperty('success');
      });
    });

    it('should collect correlated logs for each step', async () => {
      const steps = [
        { action: 'click', selector: '#api-button', correlationId: 'test-123' }
      ];
      
      // Mock correlation methods
      monitor.logManager.getCorrelation = jest.fn().mockResolvedValue([
        { message: 'Backend log 1' },
        { message: 'Backend log 2' }
      ]);
      
      monitor.browserMonitor.getSessionLogs = jest.fn().mockReturnValue([
        { text: 'Frontend log 1' }
      ]);
      
      const results = await monitor.debugScenario(steps);
      
      expect(results[0].backendLogs).toHaveLength(2);
      expect(results[0].frontendLogs).toHaveLength(1);
    });

    it('should analyze results and provide insights', async () => {
      const steps = [
        { action: 'click', selector: '#submit' }
      ];
      
      const results = await monitor.debugScenario(steps);
      const analysis = results[0].analysis;
      
      expect(analysis).toBeDefined();
      expect(analysis).toHaveProperty('summary');
    });
  });

  describe('correlation tracking', () => {
    beforeEach(async () => {
      const FullStackMonitor = getMockFullStackMonitor();
      monitor = await FullStackMonitor.create(resourceManager);
    });

    it('should track correlations across frontend and backend', async () => {
      const correlationId = 'correlation-123';
      
      await monitor.trackCorrelation(correlationId, {
        frontend: { url: '/api/users', method: 'GET' },
        backend: { endpoint: '/users', status: 200 }
      });
      
      const correlation = monitor.getCorrelation(correlationId);
      
      expect(correlation).toBeDefined();
      expect(correlation.frontend).toBeDefined();
      expect(correlation.backend).toBeDefined();
    });

    it('should find all logs for a correlation ID', async () => {
      const correlationId = 'correlation-456';
      
      // Mock log retrieval
      monitor.logManager.searchLogs = jest.fn().mockResolvedValue({
        matches: [{ message: 'Backend log' }]
      });
      
      monitor.browserMonitor.getSessionLogs = jest.fn().mockReturnValue([
        { text: 'Frontend log', correlationId }
      ]);
      
      const logs = await monitor.getCorrelatedLogs(correlationId);
      
      expect(logs).toHaveProperty('backend');
      expect(logs).toHaveProperty('frontend');
      expect(logs.backend).toHaveLength(1);
      expect(logs.frontend).toHaveLength(1);
    });
  });

  describe('real-time events', () => {
    beforeEach(async () => {
      const FullStackMonitor = getMockFullStackMonitor();
      monitor = await FullStackMonitor.create(resourceManager);
    });

    it('should forward browser events', async () => {
      const listener = jest.fn();
      monitor.on('browser-console', listener);
      
      monitor.browserMonitor.emit('console-message', {
        type: 'error',
        text: 'Test error'
      });
      
      expect(listener).toHaveBeenCalledWith({
        type: 'error',
        text: 'Test error'
      });
    });

    it('should forward backend log events', async () => {
      const listener = jest.fn();
      monitor.on('backend-log', listener);
      
      monitor.logManager.emit('log', {
        level: 'error',
        message: 'Server error'
      });
      
      expect(listener).toHaveBeenCalledWith({
        level: 'error',
        message: 'Server error'
      });
    });

    it('should emit correlation detected event', async () => {
      const listener = jest.fn();
      monitor.on('correlation-detected', listener);
      
      await monitor.trackCorrelation('cor-789', {
        frontend: { url: '/api/test' },
        backend: { endpoint: '/test' }
      });
      
      expect(listener).toHaveBeenCalledWith({
        correlationId: 'cor-789',
        frontend: { url: '/api/test' },
        backend: { endpoint: '/test' }
      });
    });
  });

  describe('statistics', () => {
    beforeEach(async () => {
      const FullStackMonitor = getMockFullStackMonitor();
      monitor = await FullStackMonitor.create(resourceManager);
    });

    it('should aggregate statistics from both monitors', async () => {
      monitor.logManager.getStatistics = jest.fn().mockReturnValue({
        totalLogs: 100,
        processes: 2
      });
      
      monitor.browserMonitor.getStatistics = jest.fn().mockReturnValue({
        totalConsoleMessages: 50,
        totalNetworkRequests: 30
      });
      
      const stats = monitor.getStatistics();
      
      expect(stats).toHaveProperty('backend');
      expect(stats).toHaveProperty('frontend');
      expect(stats).toHaveProperty('correlations');
      expect(stats.backend.totalLogs).toBe(100);
      expect(stats.frontend.totalConsoleMessages).toBe(50);
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      const FullStackMonitor = getMockFullStackMonitor();
      monitor = await FullStackMonitor.create(resourceManager);
    });

    it('should cleanup all resources', async () => {
      const backend = await monitor.logManager.monitorProcess('server.js', 'backend');
      const browser = await monitor.browserMonitor.launch();
      const page = await monitor.browserMonitor.monitorPage('http://localhost:3000', monitor.session.id);
      
      await monitor.cleanup();
      
      expect(monitor.browserMonitor.browser).toBeNull();
    });

    it('should emit cleanup event', async () => {
      const listener = jest.fn();
      monitor.on('cleanup', listener);
      
      await monitor.cleanup();
      
      expect(listener).toHaveBeenCalled();
    });
  });
});

// Temporary mock implementation for testing
function getMockFullStackMonitor() {
  class FullStackMonitor extends EventEmitter {
    constructor(config) {
      super();
      this.logManager = config.logManager;
      this.browserMonitor = config.browserMonitor;
      this.session = config.session;
      this.correlations = new Map();
    }

    static async create(resourceManager) {
      if (!resourceManager) {
        throw new Error('ResourceManager is required');
      }

      const logManager = await MockLogManager.create(resourceManager);
      const browserMonitor = await MockBrowserMonitor.create(resourceManager);
      
      const session = await logManager.createSession({
        name: 'fullstack-monitoring',
        type: 'fullstack'
      });

      const monitor = new FullStackMonitor({
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

    async initialize() {
      // Set up event forwarding
      this.browserMonitor.on('console-message', (data) => {
        this.emit('browser-console', data);
      });

      this.logManager.on('log', (data) => {
        this.emit('backend-log', data);
      });
    }

    async monitorFullStackApp(config) {
      const backend = await this.logManager.monitorProcess(
        config.backend.script,
        config.backend.name
      );

      if (this.waitForPort) {
        await this.waitForPort(config.backend.port);
      }

      const browser = await this.browserMonitor.launch();
      const page = await this.browserMonitor.monitorPage(
        config.frontend.url,
        this.session.id
      );

      return {
        backend,
        browser: page,
        session: this.session
      };
    }

    async debugScenario(steps) {
      const results = [];
      
      for (const step of steps) {
        const result = {
          step,
          success: true,
          analysis: {
            summary: 'Step completed successfully'
          }
        };

        if (step.correlationId) {
          result.backendLogs = await this.logManager.getCorrelation(step.correlationId);
          result.frontendLogs = this.browserMonitor.getSessionLogs(this.session.id);
        }

        results.push(result);
      }

      return results;
    }

    async trackCorrelation(correlationId, data) {
      this.correlations.set(correlationId, data);
      this.emit('correlation-detected', {
        correlationId,
        ...data
      });
    }

    getCorrelation(correlationId) {
      return this.correlations.get(correlationId);
    }

    async getCorrelatedLogs(correlationId) {
      const backendResult = await this.logManager.searchLogs({
        query: correlationId
      });

      const frontendLogs = this.browserMonitor.getSessionLogs(this.session.id)
        .filter(log => log.correlationId === correlationId);

      return {
        backend: backendResult.matches || [],
        frontend: frontendLogs
      };
    }

    getStatistics() {
      const backendStats = this.logManager.getStatistics ? 
        this.logManager.getStatistics() : {};
      
      const frontendStats = this.browserMonitor.getStatistics ? 
        this.browserMonitor.getStatistics() : {};

      return {
        backend: backendStats,
        frontend: frontendStats,
        correlations: this.correlations.size
      };
    }

    async cleanup() {
      if (this.browserMonitor.browser) {
        await this.browserMonitor.close();
      }
      this.emit('cleanup');
    }
  }

  return FullStackMonitor;
}