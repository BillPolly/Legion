/**
 * TestingBTBase - Base class for BT-based agent testing
 * 
 * Provides infrastructure for testing other BT agents through their Actor interface
 * using behavior trees to define test scenarios and assertions.
 */

import { BTAgentBase } from '../core/BTAgentBase.js';
import { EventEmitter } from 'node:events';

export class TestingBTBase extends BTAgentBase {
  constructor(config = {}) {
    super({
      ...config,
      agentType: 'testing',
      configPath: config.configPath || null // Tests define their own config
    });
    
    this.testResults = new Map();
    this.testAgents = new Map(); // Agents under test
    this.mockEnvironments = new Map();
    this.testTimeouts = new Map();
    this.testEventEmitter = new EventEmitter();
    
    this.defaultTimeout = config.defaultTimeout || 30000;
    this.debugMode = config.debugMode || true; // Testing should be verbose by default
  }

  /**
   * Initialize testing infrastructure
   */
  async initialize() {
    await super.initialize();
    
    // Register testing-specific nodes
    await this.registerTestingNodes();
    
    this.testEventEmitter.emit('info', { message: 'TestingBT infrastructure initialized' });
  }

  /**
   * Register BT nodes specific to testing
   */
  async registerTestingNodes() {
    const testingNodes = [
      'SendMessageNode',
      'WaitForResponseNode', 
      'AssertResponseNode',
      'MockEnvironmentNode',
      'MockServiceNode',
      'MockAgentNode'
    ];

    for (const nodeType of testingNodes) {
      try {
        const nodeModule = await import(`./nodes/${nodeType}.js`);
        const NodeClass = nodeModule[nodeType];
        if (NodeClass && this.btExecutor) {
          // Use the node's getTypeName if available, otherwise derive from class name
          const typeName = NodeClass.getTypeName ? NodeClass.getTypeName() : 
                          nodeType.toLowerCase().replace('node', '');
          this.btExecutor.registerNodeType(typeName, NodeClass);
          if (this.debugMode) {
            console.log(`TestingBTBase: Registered testing node: ${typeName}`);
          }
        }
      } catch (error) {
        if (this.debugMode) {
          console.warn(`TestingBTBase: Could not load testing node ${nodeType}:`, error.message);
        }
      }
    }
  }

  /**
   * Register an agent under test
   */
  registerTestAgent(agentId, agent) {
    if (!agent || typeof agent.receive !== 'function') {
      throw new Error(`Agent ${agentId} must implement Actor interface with receive() method`);
    }
    
    this.testAgents.set(agentId, agent);
    this.testEventEmitter.emit('info', { 
      message: `Registered test agent: ${agentId}`, 
      agentType: agent.constructor.name 
    });
  }

  /**
   * Create a mock environment for isolated testing
   */
  createMockEnvironment(envId, config = {}) {
    const mockEnv = {
      id: envId,
      config: config,
      sessionManager: this.createMockSessionManager(),
      moduleLoader: this.createMockModuleLoader(),
      resourceManager: this.createMockResourceManager(),
      sentMessages: [],
      receivedMessages: []
    };
    
    this.mockEnvironments.set(envId, mockEnv);
    return mockEnv;
  }

  /**
   * Execute a test scenario defined in BT JSON format
   */
  async runTestScenario(scenarioConfig, options = {}) {
    const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timeout = options.timeout || this.defaultTimeout;
    
    // Initialize test context
    const testContext = {
      testId,
      scenario: scenarioConfig,
      startTime: Date.now(),
      testAgents: this.testAgents,
      mockEnvironments: this.mockEnvironments,
      testResults: new Map(),
      testEventEmitter: this.testEventEmitter,
      debugMode: this.debugMode,
      ...options.context
    };

    // Set up timeout
    const timeoutHandle = setTimeout(() => {
      this.markTestFailed(testId, 'Test timed out');
    }, timeout);
    this.testTimeouts.set(testId, timeoutHandle);

    try {
      this.testEventEmitter.emit('info', { 
        message: `Starting test scenario: ${scenarioConfig.name || testId}`,
        testId 
      });

      // Execute the test BT (use the tests property which contains the actual BT)
      const testTree = scenarioConfig.tests || scenarioConfig;
      const result = await this.btExecutor.executeTree(testTree, testContext);
      
      // Clear timeout
      clearTimeout(timeoutHandle);
      this.testTimeouts.delete(testId);
      
      // Compile final test results
      const testResults = {
        testId,
        scenarioName: scenarioConfig.name || 'Unnamed Test',
        status: result.success ? 'PASSED' : 'FAILED',
        duration: Date.now() - testContext.startTime,
        details: result,
        context: testContext,
        timestamp: new Date().toISOString()
      };
      
      this.testResults.set(testId, testResults);
      
      this.testEventEmitter.emit('testComplete', testResults);
      
      return testResults;
      
    } catch (error) {
      clearTimeout(timeoutHandle);
      this.testTimeouts.delete(testId);
      
      const testResults = {
        testId,
        scenarioName: scenarioConfig.name || 'Unnamed Test',
        status: 'ERROR',
        error: error.message,
        stackTrace: error.stack,
        duration: Date.now() - testContext.startTime,
        timestamp: new Date().toISOString()
      };
      
      this.testResults.set(testId, testResults);
      
      this.testEventEmitter.emit('testError', testResults);
      
      return testResults;
    }
  }

  /**
   * Run multiple test scenarios
   */
  async runTestSuite(testSuite, options = {}) {
    const suiteId = `suite_${Date.now()}`;
    const results = [];
    
    this.testEventEmitter.emit('info', { 
      message: `Starting test suite: ${testSuite.name || suiteId}`,
      testCount: testSuite.tests.length 
    });

    for (const testScenario of testSuite.tests) {
      const result = await this.runTestScenario(testScenario, {
        ...options,
        context: {
          suiteId,
          ...options.context
        }
      });
      
      results.push(result);
      
      // Stop on first failure if configured
      if (options.stopOnFailure && result.status !== 'PASSED') {
        break;
      }
    }

    const suiteResults = {
      suiteId,
      suiteName: testSuite.name || 'Unnamed Suite',
      totalTests: testSuite.tests.length,
      passed: results.filter(r => r.status === 'PASSED').length,
      failed: results.filter(r => r.status === 'FAILED').length,
      errors: results.filter(r => r.status === 'ERROR').length,
      results: results,
      duration: results.reduce((total, r) => total + r.duration, 0),
      timestamp: new Date().toISOString()
    };

    this.testEventEmitter.emit('suiteComplete', suiteResults);
    
    return suiteResults;
  }

  /**
   * Get test results
   */
  getTestResults(testId = null) {
    if (testId) {
      return this.testResults.get(testId);
    }
    return Array.from(this.testResults.values());
  }

  /**
   * Clear test results
   */
  clearTestResults() {
    this.testResults.clear();
    this.testEventEmitter.emit('info', { message: 'Test results cleared' });
  }

  /**
   * Mark test as failed
   */
  markTestFailed(testId, reason) {
    const existingResult = this.testResults.get(testId);
    if (existingResult) {
      existingResult.status = 'FAILED';
      existingResult.failureReason = reason;
    }
    
    this.testEventEmitter.emit('testFailed', { testId, reason });
  }

  /**
   * Create BT-based mock services using MockServiceNode
   */
  async createMockServices(context) {
    // Import the MockServiceNode
    const { MockServiceNode } = await import('./nodes/MockServiceNode.js');
    
    // Create session manager mock using BT
    const sessionMock = new MockServiceNode({
      serviceName: 'sessionManager',
      serviceType: 'session',
      mockResponses: {
        createSession: (args) => ({ 
          id: `session-${Date.now()}`, 
          ...args[0],
          createdAt: new Date().toISOString() 
        }),
        getSession: (args) => ({ 
          id: args[0], 
          messages: [] 
        })
      }
    }, null, this.btExecutor);
    
    // Create module loader mock using BT
    const moduleMock = new MockServiceNode({
      serviceName: 'moduleLoader',
      serviceType: 'module',
      mockResponses: {
        getToolByName: (args) => {
          const tools = {
            'file_read': { 
              name: 'file_read', 
              execute: async () => ({ success: true, content: 'mock file content' })
            },
            'directory_list': { 
              name: 'directory_list', 
              execute: async () => ({ success: true, files: ['file1.txt', 'file2.txt'] })
            }
          };
          return tools[args[0]] || null;
        }
      }
    }, null, this.btExecutor);
    
    // Create resource manager mock using BT  
    const resourceMock = new MockServiceNode({
      serviceName: 'resourceManager',
      serviceType: 'resource',
      mockResponses: {
        get: (args) => {
          const key = args[0];
          const resources = {
            'env.OPENAI_API_KEY': 'mock-openai-key',
            'env.ANTHROPIC_API_KEY': 'mock-anthropic-key'
          };
          return resources[key];
        },
        initialize: () => true
      }
    }, null, this.btExecutor);
    
    // Execute nodes to create the services
    const sessionResult = await sessionMock.executeNode(context || {});
    const moduleResult = await moduleMock.executeNode(context || {});
    const resourceResult = await resourceMock.executeNode(context || {});
    
    return {
      sessionManager: this.wrapMockService(sessionMock, 'session'),
      moduleLoader: this.wrapMockService(moduleMock, 'module'),
      resourceManager: this.wrapMockService(resourceMock, 'resource')
    };
  }
  
  /**
   * Wrap a MockServiceNode as a service interface
   */
  wrapMockService(mockNode, serviceType) {
    const callMethod = async (method, ...args) => {
      const result = await mockNode.executeNode({
        method,
        args,
        serviceType
      });
      return result.data?.response || result.data;
    };
    
    // Create service interface based on type
    switch (serviceType) {
      case 'session':
        return {
          createSession: (...args) => callMethod('createSession', ...args),
          getSession: (...args) => callMethod('getSession', ...args),
          updateSession: (...args) => callMethod('updateSession', ...args),
          deleteSession: (...args) => callMethod('deleteSession', ...args),
          addMessage: (...args) => callMethod('addMessage', ...args),
          getMessages: (...args) => callMethod('getMessages', ...args)
        };
      case 'module':
        return {
          loadModule: (...args) => callMethod('loadModule', ...args),
          getToolByName: (...args) => callMethod('getToolByName', ...args),
          getAllTools: (...args) => callMethod('getAllTools', ...args),
          getLoadedModules: (...args) => callMethod('getLoadedModules', ...args)
        };
      case 'resource':
        return {
          get: (...args) => callMethod('get', ...args),
          register: (...args) => callMethod('register', ...args),
          initialize: (...args) => callMethod('initialize', ...args)
        };
      default:
        return {
          call: callMethod
        };
    }
  }

  // Keep legacy methods for compatibility but delegate to BT mocks
  createMockSessionManager() {
    console.warn('createMockSessionManager is deprecated. Use createMockServices() instead.');
    return this.createMockServices().then(s => s.sessionManager);
  }

  createMockModuleLoader() {
    console.warn('createMockModuleLoader is deprecated. Use createMockServices() instead.');
    return this.createMockServices().then(s => s.moduleLoader);
  }

  createMockResourceManager() {
    console.warn('createMockResourceManager is deprecated. Use createMockServices() instead.');
    return this.createMockServices().then(s => s.resourceManager);
  }

  /**
   * Clean up test resources
   */
  async cleanup() {
    // Clear all test timeouts
    for (const timeoutHandle of this.testTimeouts.values()) {
      clearTimeout(timeoutHandle);
    }
    this.testTimeouts.clear();
    
    // Clean up mock environments
    this.mockEnvironments.clear();
    
    // Clear test agents
    this.testAgents.clear();
    
    this.testEventEmitter.emit('info', { message: 'Testing infrastructure cleaned up' });
  }

  /**
   * Get metadata about this testing agent
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      agentType: 'testing',
      capabilities: [
        'actor_message_testing',
        'scenario_execution',
        'assertion_validation',
        'mock_environment_creation',
        'test_result_reporting'
      ],
      testStats: {
        totalTests: this.testResults.size,
        activeTestAgents: this.testAgents.size,
        mockEnvironments: this.mockEnvironments.size
      }
    };
  }

  /**
   * Actor interface - handle messages from other actors
   */
  async receive(payload, envelope) {
    // Handle test control messages
    if (payload.type === 'test_control') {
      switch (payload.action) {
        case 'run_scenario':
          return await this.runTestScenario(payload.scenario, payload.options);
        case 'run_suite':
          return await this.runTestSuite(payload.suite, payload.options);
        case 'get_results':
          return this.getTestResults(payload.testId);
        case 'clear_results':
          this.clearTestResults();
          return { success: true };
        case 'cleanup':
          await this.cleanup();
          return { success: true };
        default:
          return { error: `Unknown test control action: ${payload.action}` };
      }
    }
    
    // Otherwise use standard BT agent message handling
    return await super.receive(payload, envelope);
  }
}