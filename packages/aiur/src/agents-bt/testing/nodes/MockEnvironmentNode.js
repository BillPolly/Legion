/**
 * MockEnvironmentNode - Creates and manages mock environments for isolated testing
 * 
 * Testing node that sets up controlled environments with mock dependencies,
 * services, and data for testing agents in isolation.
 */

import { BehaviorTreeNode, NodeStatus } from '../../../../../shared/actor-BT/src/core/BehaviorTreeNode.js';

export class MockEnvironmentNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'mock_environment';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    this.action = config.action || 'setup'; // setup, teardown, configure
    this.environmentId = config.environmentId || 'default';
    
    // Mock configuration
    this.mockServices = config.mockServices || [];
    this.mockData = config.mockData || {};
    this.mockResponses = config.mockResponses || {};
    
    // Environment settings
    this.isolateAgents = config.isolateAgents !== false;
    this.captureInteractions = config.captureInteractions !== false;
    this.enableLogging = config.enableLogging !== false;
  }

  async executeNode(context) {
    try {
      switch (this.action) {
        case 'setup':
          return await this.setupMockEnvironment(context);
        case 'teardown':
          return await this.teardownMockEnvironment(context);
        case 'configure':
          return await this.configureMockEnvironment(context);
        case 'reset':
          return await this.resetMockEnvironment(context);
        default:
          return {
            status: NodeStatus.FAILURE,
            data: { error: `Unknown mock environment action: ${this.action}` }
          };
      }
    } catch (error) {
      console.error(`MockEnvironmentNode: Error in action ${this.action}:`, error);
      return {
        status: NodeStatus.FAILURE,
        data: {
          error: error.message,
          stackTrace: error.stack,
          action: this.action,
          environmentId: this.environmentId
        }
      };
    }
  }

  /**
   * Set up mock environment
   */
  async setupMockEnvironment(context) {
    if (context.debugMode) {
      console.log(`MockEnvironmentNode: Setting up mock environment: ${this.environmentId}`);
    }

    // Create mock environment structure
    const mockEnvironment = {
      id: this.environmentId,
      createdAt: new Date().toISOString(),
      config: {
        isolateAgents: this.isolateAgents,
        captureInteractions: this.captureInteractions,
        enableLogging: this.enableLogging
      },
      
      // Mock services
      sessionManager: this.createMockSessionManager(),
      moduleLoader: this.createMockModuleLoader(),
      resourceManager: this.createMockResourceManager(),
      artifactManager: this.createMockArtifactManager(),
      
      // Interaction tracking
      interactions: [],
      serviceCalls: [],
      
      // Mock data
      data: { ...this.mockData },
      
      // State tracking
      state: 'active'
    };

    // Set up service mocks based on configuration
    for (const serviceConfig of this.mockServices) {
      await this.setupServiceMock(mockEnvironment, serviceConfig);
    }

    // Store environment in context
    if (!context.mockEnvironments) {
      context.mockEnvironments = new Map();
    }
    context.mockEnvironments.set(this.environmentId, mockEnvironment);

    // Set as active environment if this is the first one
    if (!context.activeMockEnvironment) {
      context.activeMockEnvironment = mockEnvironment;
    }

    return {
      status: NodeStatus.SUCCESS,
      data: {
        environmentId: this.environmentId,
        servicesCreated: this.mockServices.length,
        mockEnvironment: mockEnvironment,
        message: 'Mock environment setup complete'
      }
    };
  }

  /**
   * Teardown mock environment
   */
  async teardownMockEnvironment(context) {
    if (!context.mockEnvironments || !context.mockEnvironments.has(this.environmentId)) {
      return {
        status: NodeStatus.SUCCESS,
        data: { message: `Mock environment ${this.environmentId} was not found (already cleaned up?)` }
      };
    }

    const mockEnvironment = context.mockEnvironments.get(this.environmentId);

    if (context.debugMode) {
      console.log(`MockEnvironmentNode: Tearing down mock environment: ${this.environmentId}`);
      console.log(`Environment had ${mockEnvironment.interactions.length} interactions`);
    }

    // Clean up any resources
    mockEnvironment.state = 'destroyed';

    // Remove from context
    context.mockEnvironments.delete(this.environmentId);

    // Update active environment if this was it
    if (context.activeMockEnvironment && context.activeMockEnvironment.id === this.environmentId) {
      context.activeMockEnvironment = context.mockEnvironments.size > 0 ? 
        Array.from(context.mockEnvironments.values())[0] : null;
    }

    return {
      status: NodeStatus.SUCCESS,
      data: {
        environmentId: this.environmentId,
        interactionCount: mockEnvironment.interactions.length,
        serviceCallCount: mockEnvironment.serviceCalls.length,
        message: 'Mock environment teardown complete'
      }
    };
  }

  /**
   * Configure existing mock environment
   */
  async configureMockEnvironment(context) {
    if (!context.mockEnvironments || !context.mockEnvironments.has(this.environmentId)) {
      return {
        status: NodeStatus.FAILURE,
        data: { error: `Mock environment ${this.environmentId} not found` }
      };
    }

    const mockEnvironment = context.mockEnvironments.get(this.environmentId);

    // Update mock data
    if (this.mockData) {
      Object.assign(mockEnvironment.data, this.mockData);
    }

    // Update mock responses
    if (this.mockResponses) {
      mockEnvironment.mockResponses = { ...mockEnvironment.mockResponses, ...this.mockResponses };
    }

    if (context.debugMode) {
      console.log(`MockEnvironmentNode: Configured mock environment: ${this.environmentId}`);
    }

    return {
      status: NodeStatus.SUCCESS,
      data: {
        environmentId: this.environmentId,
        message: 'Mock environment configuration updated'
      }
    };
  }

  /**
   * Reset mock environment state
   */
  async resetMockEnvironment(context) {
    if (!context.mockEnvironments || !context.mockEnvironments.has(this.environmentId)) {
      return {
        status: NodeStatus.FAILURE,
        data: { error: `Mock environment ${this.environmentId} not found` }
      };
    }

    const mockEnvironment = context.mockEnvironments.get(this.environmentId);

    // Reset tracking data
    mockEnvironment.interactions = [];
    mockEnvironment.serviceCalls = [];
    
    // Reset mock call counts
    this.resetMockCalls(mockEnvironment.sessionManager);
    this.resetMockCalls(mockEnvironment.moduleLoader);
    this.resetMockCalls(mockEnvironment.resourceManager);
    this.resetMockCalls(mockEnvironment.artifactManager);

    if (context.debugMode) {
      console.log(`MockEnvironmentNode: Reset mock environment: ${this.environmentId}`);
    }

    return {
      status: NodeStatus.SUCCESS,
      data: {
        environmentId: this.environmentId,
        message: 'Mock environment reset complete'
      }
    };
  }

  /**
   * Set up a service mock
   */
  async setupServiceMock(mockEnvironment, serviceConfig) {
    const { name, type, responses, behavior } = serviceConfig;
    
    switch (type) {
      case 'http':
        mockEnvironment[name] = this.createMockHttpService(responses, behavior);
        break;
      case 'database':
        mockEnvironment[name] = this.createMockDatabase(responses, behavior);
        break;
      case 'file_system':
        mockEnvironment[name] = this.createMockFileSystem(responses, behavior);
        break;
      case 'custom':
        mockEnvironment[name] = this.createCustomMock(responses, behavior);
        break;
      default:
        console.warn(`MockEnvironmentNode: Unknown service mock type: ${type}`);
    }
  }

  /**
   * Create mock session manager
   */
  createMockSessionManager() {
    const mockFn = (implementation) => {
      const fn = async (...args) => {
        fn.mock.calls.push(args);
        if (typeof implementation === 'function') {
          return await implementation(...args);
        }
        return implementation;
      };
      fn.mock = { calls: [] };
      fn.mockClear = () => { fn.mock.calls = []; };
      return fn;
    };

    const mock = {
      createSession: mockFn(async (config) => ({
        id: `mock-session-${Date.now()}`,
        ...config,
        createdAt: new Date().toISOString()
      })),
      getSession: mockFn(async (id) => ({
        id,
        createdAt: new Date().toISOString(),
        messages: []
      })),
      updateSession: mockFn(true),
      deleteSession: mockFn(true),
      addMessage: mockFn(true),
      getMessages: mockFn([]),
      
      // Test helpers
      _callHistory: [],
      _getCallCount: function(method) {
        return this[method].mock.calls.length;
      }
    };

    // Track all calls for testing purposes
    Object.keys(mock).forEach(key => {
      if (typeof mock[key] === 'function' && key !== '_getCallCount') {
        const originalFn = mock[key];
        mock[key] = async (...args) => {
          mock._callHistory.push({ method: key, args, timestamp: Date.now() });
          return await originalFn(...args);
        };
      }
    });

    return mock;
  }

  /**
   * Create mock module loader
   */
  createMockModuleLoader() {
    const mockTools = new Map([
      ['file_read', { 
        name: 'file_read', 
        execute: jest.fn().mockResolvedValue({ 
          success: true, 
          content: 'mock file content',
          filePath: '/mock/path/file.txt'
        })
      }],
      ['directory_list', { 
        name: 'directory_list', 
        execute: jest.fn().mockResolvedValue({ 
          success: true, 
          files: ['file1.txt', 'file2.txt', 'subfolder/'],
          path: '/mock/path/'
        })
      }],
      ['web_fetch', {
        name: 'web_fetch',
        execute: jest.fn().mockResolvedValue({
          success: true,
          content: '<html><body>Mock web content</body></html>',
          url: 'https://example.com'
        })
      }]
    ]);

    return {
      loadModule: jest.fn().mockResolvedValue(true),
      unloadModule: jest.fn().mockResolvedValue(true),
      getToolByName: jest.fn().mockImplementation(name => mockTools.get(name)),
      getAllTools: jest.fn().mockReturnValue(Array.from(mockTools.values())),
      getLoadedModules: jest.fn().mockReturnValue(['file', 'web', 'test-module']),
      
      // Test helpers
      _mockTools: mockTools,
      _addMockTool: function(name, toolMock) {
        this._mockTools.set(name, toolMock);
      }
    };
  }

  /**
   * Create mock resource manager
   */
  createMockResourceManager() {
    return {
      get: jest.fn().mockImplementation(key => {
        const mockData = {
          'env.OPENAI_API_KEY': 'mock-openai-key-12345',
          'env.ANTHROPIC_API_KEY': 'mock-anthropic-key-67890',
          'env.GITHUB_PAT': 'mock-github-token',
          'sessionManager': this.createMockSessionManager(),
          'moduleLoader': this.createMockModuleLoader()
        };
        return mockData[key];
      }),
      register: jest.fn(),
      initialize: jest.fn().mockResolvedValue(true),
      
      // Test helpers
      _mockData: new Map(),
      _setMockValue: function(key, value) {
        this._mockData.set(key, value);
        this.get.mockImplementation(k => k === key ? value : this.get.mockImplementation()(k));
      }
    };
  }

  /**
   * Create mock artifact manager
   */
  createMockArtifactManager() {
    return {
      storeArtifact: jest.fn().mockResolvedValue({ success: true, id: 'mock-artifact-id' }),
      getArtifact: jest.fn().mockResolvedValue({ id: 'mock-artifact-id', content: 'mock content' }),
      getAllArtifacts: jest.fn().mockResolvedValue([]),
      deleteArtifact: jest.fn().mockResolvedValue({ success: true }),
      clearArtifacts: jest.fn().mockResolvedValue({ success: true }),
      
      // Test helpers
      _artifacts: [],
      _addMockArtifact: function(artifact) {
        this._artifacts.push(artifact);
        this.getAllArtifacts.mockResolvedValue(this._artifacts);
      }
    };
  }

  /**
   * Reset mock call history
   */
  resetMockCalls(mockObject) {
    Object.keys(mockObject).forEach(key => {
      if (mockObject[key] && typeof mockObject[key].mockClear === 'function') {
        mockObject[key].mockClear();
      }
    });
    
    if (mockObject._callHistory) {
      mockObject._callHistory = [];
    }
  }

  /**
   * Get node metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      nodeType: 'mock_environment',
      purpose: 'Create and manage mock environments for isolated testing',
      environmentId: this.environmentId,
      action: this.action,
      capabilities: [
        'mock_service_creation',
        'interaction_tracking',
        'environment_isolation',
        'data_mocking',
        'call_history_tracking'
      ]
    };
  }
}