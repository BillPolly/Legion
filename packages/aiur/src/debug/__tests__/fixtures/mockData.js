/**
 * Mock data and fixtures for Web Debug Interface tests
 */

// Mock functions factory to avoid jest dependency issues
export const createMockFn = () => {
  let mockReturnValue = undefined;
  let mockImplementation = null;
  const calls = [];
  
  const mockFn = (...args) => {
    calls.push(args);
    if (mockImplementation) {
      return mockImplementation(...args);
    }
    return mockReturnValue || Promise.resolve();
  };
  
  mockFn.mockReturnValue = (value) => {
    mockReturnValue = value;
    return mockFn;
  };
  mockFn.mockResolvedValue = (value) => { 
    mockReturnValue = Promise.resolve(value); 
    return mockFn; 
  };
  mockFn.mockRejectedValue = (value) => { 
    mockReturnValue = Promise.reject(value); 
    return mockFn; 
  };
  mockFn.mockImplementation = (impl) => { 
    mockImplementation = impl; 
    return mockFn; 
  };
  mockFn.mockClear = () => { 
    calls.length = 0; 
    return mockFn; 
  };
  
  // Jest compatibility properties
  Object.defineProperty(mockFn, 'mock', {
    get: () => ({ calls })
  });
  
  // Add Jest matcher methods
  mockFn.toHaveBeenCalled = () => calls.length > 0;
  mockFn.toHaveBeenCalledWith = (...expectedArgs) => {
    return calls.some(callArgs => 
      JSON.stringify(callArgs) === JSON.stringify(expectedArgs)
    );
  };
  mockFn.toHaveBeenCalledTimes = (expectedTimes) => calls.length === expectedTimes;
  
  return mockFn;
};

export const mockMCPServer = {
  contextManager: {
    executeContextTool: createMockFn(),
    getToolDefinitions: () => [
      {
        name: "context_add",
        description: "Add data to the context for AI agents to reference",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            data: {},
            description: { type: "string" }
          },
          required: ["name", "data"]
        }
      }
    ]
  },
  
  toolDefinitionProvider: {
    getAllToolDefinitions: () => [
      { name: 'context_add' },
      { name: 'context_get' },
      { name: 'context_list' },
      { name: 'plan_execute' },
      { name: 'web_debug_start' }
    ],
    executeTool: createMockFn(),
    getToolStatistics: () => ({
      total: 5,
      context: 3,
      modules: 2,
      loadedModules: 1
    })
  },
  
  monitoringSystem: {
    on: createMockFn(),
    recordMetric: createMockFn(),
    getDashboardData: () => ({
      systemHealth: { score: 95, status: 'healthy' },
      keyMetrics: [],
      alerts: [],
      uptime: 12345
    })
  }
};

export const mockResourceManager = {
  get: createMockFn().mockImplementation((key) => {
    switch (key) {
      case 'contextManager':
        return mockMCPServer.contextManager;
      case 'toolDefinitionProvider':
        return mockMCPServer.toolDefinitionProvider;
      case 'monitoringSystem':
        return mockMCPServer.monitoringSystem;
      default:
        return null;
    }
  })
};

export const sampleWebSocketMessages = {
  welcome: {
    type: 'welcome',
    data: {
      serverId: 'test-server-123',
      version: '1.0.0',
      capabilities: ['tool-execution', 'context-management', 'event-streaming'],
      availableTools: ['context_add', 'context_get', 'plan_execute']
    }
  },
  
  executeToolRequest: {
    type: 'execute-tool',
    id: 'req_123',
    data: {
      name: 'context_list',
      arguments: { filter: 'test*' }
    }
  },
  
  toolResult: {
    type: 'tool-result',
    id: 'req_123',
    data: {
      success: true,
      result: {
        content: [{ type: "text", text: '{"contexts": [], "total": 0}' }],
        isError: false
      },
      executionTime: 45
    }
  },
  
  event: {
    type: 'event',
    data: {
      eventType: 'tool-executed',
      timestamp: '2024-01-15T10:30:00.000Z',
      source: 'debug-server',
      payload: { tool: 'context_list', success: true }
    }
  }
};

export const sampleContextData = [
  {
    name: 'user_config',
    data: { theme: 'dark', language: 'en' },
    description: 'User configuration settings',
    addedAt: '2024-01-15T10:00:00.000Z'
  },
  {
    name: 'deployment_settings',
    data: { env: 'production', replicas: 3 },
    description: 'Deployment configuration',
    addedAt: '2024-01-15T10:15:00.000Z'
  }
];

export const sampleEvents = [
  {
    type: 'event',
    data: {
      eventType: 'metric-recorded',
      timestamp: '2024-01-15T10:30:00.000Z',
      source: 'monitoring-system',
      payload: { metric: 'cpu_usage', value: 45.2 }
    }
  },
  {
    type: 'event',
    data: {
      eventType: 'tool-executed',
      timestamp: '2024-01-15T10:31:00.000Z',
      source: 'debug-server',
      payload: { tool: 'context_add', success: true, executionTime: 25 }
    }
  }
];