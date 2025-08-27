import { jest } from '@jest/globals';

// Mock dependencies
const mockDeploymentManager = {
  getDeploymentLogs: jest.fn(),
  getDeployment: jest.fn()
};

const mockResourceManager = {
  get: jest.fn(),
  initialize: jest.fn()
};

jest.unstable_mockModule('../../../src/DeploymentManager.js', () => ({
  default: jest.fn(() => mockDeploymentManager)
}));

jest.unstable_mockModule('@legion/resource-manager', () => ({
  default: jest.fn(() => mockResourceManager)
}));

// Import after mocking
const GetDeploymentLogsTool = (await import('../../../src/tools/GetDeploymentLogsTool.js')).default;

describe('GetDeploymentLogsTool', () => {
  let logsTool;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup resource manager
    mockResourceManager.get.mockImplementation((key) => {
      if (key === 'deployment-manager') {
        return mockDeploymentManager;
      }
      return null;
    });

    logsTool = new GetDeploymentLogsTool();
  });

  describe('Tool Configuration', () => {
    test('should have correct tool name and description', () => {
      expect(logsTool.name).toBe('get_deployment_logs');
      expect(logsTool.description).toContain('Retrieve logs from deployments with filtering and search capabilities');
    });

    test('should declare correct tool description schema', () => {
      const description = logsTool.getToolDescription();
      
      expect(description.function.name).toBe('get_deployment_logs');
      expect(description.function.parameters.type).toBe('object');
      expect(description.function.parameters.properties).toHaveProperty('deploymentId');
      expect(description.function.parameters.properties).toHaveProperty('lines');
      expect(description.function.parameters.properties).toHaveProperty('follow');
      expect(description.function.parameters.required).toContain('deploymentId');
    });
  });

  describe('Parameter Validation', () => {
    test('should validate required parameters', async () => {
      const toolCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            // Missing required parameters
          })
        }
      };

      const result = await logsTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter');
    });

    test('should validate lines parameter', async () => {
      const toolCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            lines: -50 // Invalid negative lines
          })
        }
      };

      const result = await logsTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Lines must be a positive number');
    });

    test('should validate since parameter format', async () => {
      const toolCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            since: 'invalid-timestamp'
          })
        }
      };

      const result = await logsTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid since timestamp format');
    });
  });

  describe('Log Retrieval', () => {
    test('should retrieve recent logs by default', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        name: 'test-app',
        provider: 'local',
        status: 'running'
      };

      const mockLogs = {
        success: true,
        logs: [
          { timestamp: '2024-01-01T10:00:00Z', level: 'info', message: 'Application started', source: 'app' },
          { timestamp: '2024-01-01T10:01:00Z', level: 'warn', message: 'Database connection slow', source: 'db' },
          { timestamp: '2024-01-01T10:02:00Z', level: 'error', message: 'Failed to process request', source: 'api' }
        ],
        totalLines: 3,
        truncated: false
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.getDeploymentLogs.mockResolvedValue(mockLogs);

      const toolCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123'
          })
        }
      };

      const result = await logsTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.logs).toHaveLength(3);
      expect(result.data.summary.totalLines).toBe(3);
      expect(result.data.summary.truncated).toBe(false);
      
      expect(mockDeploymentManager.getDeploymentLogs).toHaveBeenCalledWith('deploy-123', {
        lines: 100,
        follow: false,
        since: undefined,
        until: undefined,
        level: undefined,
        search: undefined,
        source: undefined,
        includeTimestamp: true,
        format: 'structured'
      });
    });

    test('should retrieve logs with custom parameters', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        name: 'api-service',
        provider: 'docker',
        status: 'running'
      };

      const mockLogs = {
        success: true,
        logs: [
          { timestamp: '2024-01-01T10:00:00Z', level: 'error', message: 'Connection failed', source: 'api' }
        ],
        totalLines: 1,
        truncated: false
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.getDeploymentLogs.mockResolvedValue(mockLogs);

      const toolCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            lines: 50,
            level: 'error',
            search: 'Connection',
            since: '2024-01-01T09:00:00Z'
          })
        }
      };

      const result = await logsTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.logs).toHaveLength(1);
      expect(result.data.logs[0].level).toBe('error');
      expect(result.data.logs[0].message).toContain('Connection');
      
      expect(mockDeploymentManager.getDeploymentLogs).toHaveBeenCalledWith('deploy-123', {
        lines: 50,
        follow: false,
        since: '2024-01-01T09:00:00Z',
        until: undefined,
        level: 'error',
        search: 'Connection',
        source: undefined,
        includeTimestamp: true,
        format: 'structured'
      });
    });

    test('should handle follow mode (streaming)', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        name: 'live-app',
        provider: 'railway',
        status: 'running'
      };

      const mockLogs = {
        success: true,
        logs: [
          { timestamp: '2024-01-01T10:00:00Z', level: 'info', message: 'Request processed', source: 'app' }
        ],
        totalLines: 1,
        streaming: true,
        followHandle: 'follow-123'
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.getDeploymentLogs.mockResolvedValue(mockLogs);

      const toolCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            follow: true,
            lines: 0 // Start from end for follow mode
          })
        }
      };

      const result = await logsTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.streaming).toBe(true);
      expect(result.data.followHandle).toBe('follow-123');
      expect(result.data.summary.message).toContain('streaming live logs');
    });
  });

  describe('Log Filtering', () => {
    test('should filter logs by level', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        name: 'debug-app',
        provider: 'local',
        status: 'running'
      };

      const mockLogs = {
        success: true,
        logs: [
          { timestamp: '2024-01-01T10:00:00Z', level: 'error', message: 'Critical error occurred', source: 'app' },
          { timestamp: '2024-01-01T10:01:00Z', level: 'error', message: 'Another error', source: 'db' }
        ],
        totalLines: 2,
        filtered: true,
        originalLines: 100
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.getDeploymentLogs.mockResolvedValue(mockLogs);

      const toolCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            level: 'error'
          })
        }
      };

      const result = await logsTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.logs.every(log => log.level === 'error')).toBe(true);
      expect(result.data.summary.filtered).toBe(true);
      expect(result.data.summary.originalLines).toBe(100);
    });

    test('should search logs by content', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        name: 'search-app',
        provider: 'docker',
        status: 'running'
      };

      const mockLogs = {
        success: true,
        logs: [
          { timestamp: '2024-01-01T10:00:00Z', level: 'info', message: 'User authentication successful', source: 'auth' },
          { timestamp: '2024-01-01T10:01:00Z', level: 'info', message: 'User logged out', source: 'auth' }
        ],
        totalLines: 2,
        searchTerm: 'User'
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.getDeploymentLogs.mockResolvedValue(mockLogs);

      const toolCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            search: 'User'
          })
        }
      };

      const result = await logsTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.logs.every(log => log.message.includes('User'))).toBe(true);
      expect(result.data.summary.searchTerm).toBe('User');
    });

    test('should filter logs by time range', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        name: 'time-app',
        provider: 'railway',
        status: 'running'
      };

      const mockLogs = {
        success: true,
        logs: [
          { timestamp: '2024-01-01T10:30:00Z', level: 'info', message: 'Process started', source: 'app' },
          { timestamp: '2024-01-01T10:45:00Z', level: 'info', message: 'Process completed', source: 'app' }
        ],
        totalLines: 2,
        timeRange: {
          since: '2024-01-01T10:00:00Z',
          until: '2024-01-01T11:00:00Z'
        }
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.getDeploymentLogs.mockResolvedValue(mockLogs);

      const toolCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            since: '2024-01-01T10:00:00Z',
            until: '2024-01-01T11:00:00Z'
          })
        }
      };

      const result = await logsTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.logs).toHaveLength(2);
      expect(result.data.summary.timeRange).toEqual({
        since: '2024-01-01T10:00:00Z',
        until: '2024-01-01T11:00:00Z'
      });
    });
  });

  describe('Output Formatting', () => {
    test('should format logs as structured by default', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        name: 'format-app',
        provider: 'local',
        status: 'running'
      };

      const mockLogs = {
        success: true,
        logs: [
          { timestamp: '2024-01-01T10:00:00Z', level: 'info', message: 'Test message', source: 'app' }
        ],
        totalLines: 1,
        format: 'structured'
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.getDeploymentLogs.mockResolvedValue(mockLogs);

      const toolCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123'
          })
        }
      };

      const result = await logsTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.format).toBe('structured');
      expect(result.data.logs[0]).toHaveProperty('timestamp');
      expect(result.data.logs[0]).toHaveProperty('level');
      expect(result.data.logs[0]).toHaveProperty('message');
      expect(result.data.logs[0]).toHaveProperty('source');
    });

    test('should format logs as raw text when requested', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        name: 'raw-app',
        provider: 'docker',
        status: 'running'
      };

      const mockLogs = {
        success: true,
        logs: [
          '2024-01-01T10:00:00Z [INFO] app: Test message',
          '2024-01-01T10:01:00Z [WARN] db: Connection slow'
        ],
        totalLines: 2,
        format: 'raw'
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.getDeploymentLogs.mockResolvedValue(mockLogs);

      const toolCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            format: 'raw'
          })
        }
      };

      const result = await logsTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.format).toBe('raw');
      expect(Array.isArray(result.data.logs)).toBe(true);
      expect(typeof result.data.logs[0]).toBe('string');
    });
  });

  describe('Provider-specific Handling', () => {
    test('should handle local provider logs', async () => {
      const mockDeployment = {
        id: 'local-123',
        name: 'local-app',
        provider: 'local',
        status: 'running',
        pid: 12345
      };

      const mockLogs = {
        success: true,
        logs: [
          { timestamp: '2024-01-01T10:00:00Z', level: 'info', message: 'Local process log', source: 'stdout' }
        ],
        totalLines: 1,
        logSource: 'process'
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.getDeploymentLogs.mockResolvedValue(mockLogs);

      const toolCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: 'local-123'
          })
        }
      };

      const result = await logsTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.logs[0].source).toBe('stdout');
      expect(result.data.summary.logSource).toBe('process');
    });

    test('should handle Docker container logs', async () => {
      const mockDeployment = {
        id: 'docker-456',
        name: 'container-app',
        provider: 'docker',
        status: 'running'
      };

      const mockLogs = {
        success: true,
        logs: [
          { timestamp: '2024-01-01T10:00:00Z', level: 'info', message: 'Container log message', source: 'container' }
        ],
        totalLines: 1,
        logSource: 'docker',
        containerId: 'abc123def456'
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.getDeploymentLogs.mockResolvedValue(mockLogs);

      const toolCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: 'docker-456'
          })
        }
      };

      const result = await logsTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.logs[0].source).toBe('container');
      expect(result.data.summary.logSource).toBe('docker');
      expect(result.data.summary.containerId).toBe('abc123def456');
    });

    test('should handle Railway service logs', async () => {
      const mockDeployment = {
        id: 'railway-789',
        name: 'railway-service',
        provider: 'railway',
        status: 'running'
      };

      const mockLogs = {
        success: true,
        logs: [
          { timestamp: '2024-01-01T10:00:00Z', level: 'info', message: 'Railway deployment log', source: 'service' }
        ],
        totalLines: 1,
        logSource: 'railway',
        serviceId: 'srv_xyz789'
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.getDeploymentLogs.mockResolvedValue(mockLogs);

      const toolCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: 'railway-789'
          })
        }
      };

      const result = await logsTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.logs[0].source).toBe('service');
      expect(result.data.summary.logSource).toBe('railway');
      expect(result.data.summary.serviceId).toBe('srv_xyz789');
    });
  });

  describe('Error Handling', () => {
    test('should handle deployment not found', async () => {
      mockDeploymentManager.getDeployment.mockResolvedValue(null);

      const toolCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: 'nonexistent-123'
          })
        }
      };

      const result = await logsTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Deployment not found');
      expect(result.suggestions.some(s => s.includes('Verify the deployment ID'))).toBe(true);
    });

    test('should handle stopped deployment', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        name: 'stopped-app',
        provider: 'docker',
        status: 'stopped'
      };

      const mockLogs = {
        success: true,
        logs: [
          { timestamp: '2024-01-01T09:59:00Z', level: 'info', message: 'Application shutting down', source: 'app' }
        ],
        totalLines: 1,
        historical: true
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.getDeploymentLogs.mockResolvedValue(mockLogs);

      const toolCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123'
          })
        }
      };

      const result = await logsTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.summary.historical).toBe(true);
      expect(result.data.summary.message).toContain('historical logs');
    });

    test('should handle log retrieval failures', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        name: 'failing-app',
        provider: 'docker',
        status: 'running'
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.getDeploymentLogs.mockRejectedValue(new Error('Container logs not accessible'));

      const toolCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123'
          })
        }
      };

      const result = await logsTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Container logs not accessible');
    });

    test('should handle invalid JSON arguments', async () => {
      const toolCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: 'invalid-json'
        }
      };

      const result = await logsTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });
  });

  describe('Large Log Handling', () => {
    test('should handle truncated logs', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        name: 'verbose-app',
        provider: 'docker',
        status: 'running'
      };

      const mockLogs = {
        success: true,
        logs: Array.from({ length: 100 }, (_, i) => ({
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          level: 'info',
          message: `Log message ${i + 1}`,
          source: 'app'
        })),
        totalLines: 100,
        truncated: true,
        availableLines: 5000
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.getDeploymentLogs.mockResolvedValue(mockLogs);

      const toolCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            lines: 100
          })
        }
      };

      const result = await logsTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.logs).toHaveLength(100);
      expect(result.data.summary.truncated).toBe(true);
      expect(result.data.summary.availableLines).toBe(5000);
      expect(result.data.nextSteps).toContain('Increase --lines parameter to retrieve more logs');
    });

    test('should handle empty logs', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        name: 'silent-app',
        provider: 'local',
        status: 'running'
      };

      const mockLogs = {
        success: true,
        logs: [],
        totalLines: 0
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.getDeploymentLogs.mockResolvedValue(mockLogs);

      const toolCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123'
          })
        }
      };

      const result = await logsTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.logs).toHaveLength(0);
      expect(result.data.summary.totalLines).toBe(0);
      expect(result.data.message).toContain('No logs found');
    });
  });

  describe('Response Formatting', () => {
    test('should format successful response correctly', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        name: 'test-app',
        provider: 'local',
        status: 'running'
      };

      const mockLogs = {
        success: true,
        logs: [
          { timestamp: '2024-01-01T10:00:00Z', level: 'info', message: 'Test log', source: 'app' }
        ],
        totalLines: 1
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.getDeploymentLogs.mockResolvedValue(mockLogs);

      const toolCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123'
          })
        }
      };

      const result = await logsTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('deployment');
      expect(result.data).toHaveProperty('logs');
      expect(result.data).toHaveProperty('summary');
      expect(result.data).toHaveProperty('format');
      expect(result.data).toHaveProperty('nextSteps');
      
      expect(result.data.deployment.id).toBe('deploy-123');
      expect(result.data.logs).toBeInstanceOf(Array);
      expect(result.data.summary.totalLines).toBe(1);
      expect(result.data.nextSteps).toBeInstanceOf(Array);
    });
  });
});