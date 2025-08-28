import { jest } from '@jest/globals';

// Mock dependencies
const mockMonitoringSystem = {
  startMonitoring: jest.fn(),
  stopMonitoring: jest.fn(),
  getMetrics: jest.fn(),
  getLogs: jest.fn(),
  getHealthStatus: jest.fn()
};

const mockDeploymentManager = {
  getDeployment: jest.fn(),
  listDeployments: jest.fn()
};

const mockResourceManager = {
  get: jest.fn(),
  initialize: jest.fn(),
  register: jest.fn()
};

// Mock the ResourceManager class with getInstance static method
const MockResourceManager = jest.fn(() => mockResourceManager);
MockResourceManager.getInstance = jest.fn(async () => mockResourceManager);

jest.unstable_mockModule('../../../src/MonitoringSystem.js', () => ({
  default: jest.fn(() => mockMonitoringSystem)
}));

jest.unstable_mockModule('../../../src/DeploymentManager.js', () => ({
  default: jest.fn(() => mockDeploymentManager)
}));

jest.unstable_mockModule('@legion/resource-manager', () => ({
  ResourceManager: MockResourceManager,
  default: MockResourceManager
}));

// Import after mocking
const MonitorDeploymentTool = (await import('../../../src/tools/MonitorDeploymentTool.js')).default;

describe('MonitorDeploymentTool', () => {
  let monitorTool;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup resource manager
    mockResourceManager.get.mockImplementation((key) => {
      if (key === 'monitoring-system') {
        return mockMonitoringSystem;
      }
      if (key === 'deployment-manager') {
        return mockDeploymentManager;
      }
      return null;
    });

    monitorTool = new MonitorDeploymentTool();
  });

  describe('Tool Configuration', () => {
    test('should have correct tool name and description', () => {
      expect(monitorTool.name).toBe('monitor_deployment');
      expect(monitorTool.description).toContain('Monitor deployment health, metrics, and logs');
    });

    test('should declare correct tool description schema', () => {
      const description = monitorTool.getToolDescription();
      
      expect(description.function.name).toBe('monitor_deployment');
      expect(description.function.parameters.type).toBe('object');
      expect(description.function.parameters.properties).toHaveProperty('deploymentId');
      expect(description.function.parameters.properties).toHaveProperty('action');
      expect(description.function.parameters.required).toContain('deploymentId');
      expect(description.function.parameters.required).toContain('action');
    });
  });

  describe('Parameter Validation', () => {
    test('should validate required parameters', async () => {
      const args = {
            // is requireds
          };
      const result = await monitorTool.execute(args);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('is required');
    });

    test('should validate action parameter', async () => {
      const args = {
            deploymentId: 'deploy-123',
            action: 'invalid-action'
          };
      const result = await monitorTool.execute(args);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid action');
    });
  });

  describe('Monitoring Activation', () => {
    test('should start monitoring successfully', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        provider: 'local',
        status: 'running',
        name: 'test-app'
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockMonitoringSystem.startMonitoring.mockResolvedValue({
        success: true,
        monitoringId: 'monitor-456'
      });

      const args = {
            deploymentId: 'deploy-123',
            action: 'start',
            interval: 30000,
            metrics: ['cpu', 'memory']
          };
      const result = await monitorTool.execute(args);
      
      expect(result.success).toBe(true);
      expect(result.data.monitoring.id).toBe('monitor-456');
      expect(result.data.monitoring.status).toBe('active');
      expect(result.data.summary).toContain('Started monitoring');
      
      expect(mockMonitoringSystem.startMonitoring).toHaveBeenCalledWith('deploy-123', {
        interval: 30000,
        metrics: ['cpu', 'memory'],
        persistent: false,
        realtime: false,
        alertThresholds: undefined
      });
    });

    test('should stop monitoring successfully', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        provider: 'docker',
        status: 'running',
        name: 'test-container'
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockMonitoringSystem.stopMonitoring.mockResolvedValue({
        success: true
      });

      const args = {
            deploymentId: 'deploy-123',
            action: 'stop'
          };
      const result = await monitorTool.execute(args);
      
      expect(result.success).toBe(true);
      expect(result.data.monitoring.status).toBe('stopped');
      expect(result.data.summary).toContain('Stopped monitoring');
      
      expect(mockMonitoringSystem.stopMonitoring).toHaveBeenCalledWith('deploy-123');
    });
  });

  describe('Metrics Selection', () => {
    test('should get current metrics successfully', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        provider: 'docker',
        status: 'running'
      };

      const mockMetrics = {
        cpu: 45.2,
        memory: { usage: 512000000, percent: 75.5 },
        network: { rx: 1024, tx: 2048 },
        timestamp: new Date().toISOString()
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockMonitoringSystem.getMetrics.mockResolvedValue(mockMetrics);

      const args = {
            deploymentId: 'deploy-123',
            action: 'metrics',
            metricsType: 'current'
          };
      const result = await monitorTool.execute(args);
      
      expect(result.success).toBe(true);
      expect(result.data.metrics.cpu).toBe(45.2);
      expect(result.data.metrics.memory.percent).toBe(75.5);
      expect(result.data.summary).toContain('Current metrics');
      
      expect(mockMonitoringSystem.getMetrics).toHaveBeenCalledWith('deploy-123', { type: 'current' });
    });

    test('should get health status successfully', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        provider: 'railway',
        status: 'running'
      };

      const mockHealth = {
        status: 'healthy',
        checks: {
          http: { status: 'passing', responseTime: 120 },
          disk: { status: 'passing', usage: 45 },
          memory: { status: 'warning', usage: 85 }
        },
        overallScore: 85,
        timestamp: new Date().toISOString()
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockMonitoringSystem.getHealthStatus.mockResolvedValue(mockHealth);

      const args = {
            deploymentId: 'deploy-123',
            action: 'health'
          };
      const result = await monitorTool.execute(args);
      
      expect(result.success).toBe(true);
      expect(result.data.health.status).toBe('healthy');
      expect(result.data.health.overallScore).toBe(85);
      expect(result.data.summary).toContain('Health status');
      
      expect(mockMonitoringSystem.getHealthStatus).toHaveBeenCalledWith('deploy-123');
    });
  });

  describe('Real-time Updates', () => {
    test('should get recent logs successfully', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        provider: 'local',
        status: 'running'
      };

      const mockLogs = {
        success: true,
        logs: [
          { timestamp: '2024-01-01T10:00:00Z', level: 'info', message: 'Server started' },
          { timestamp: '2024-01-01T10:01:00Z', level: 'warn', message: 'High memory usage' },
          { timestamp: '2024-01-01T10:02:00Z', level: 'info', message: 'Request processed' }
        ]
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockMonitoringSystem.getLogs.mockResolvedValue(mockLogs);

      const args = {
            deploymentId: 'deploy-123',
            action: 'logs',
            lines: 100,
            follow: false
          };
      const result = await monitorTool.execute(args);
      
      expect(result.success).toBe(true);
      expect(result.data.logs).toHaveLength(3);
      expect(result.data.logs[0].message).toBe('Server started');
      expect(result.data.summary).toContain('Retrieved 3 log entries');
      
      expect(mockMonitoringSystem.getLogs).toHaveBeenCalledWith('deploy-123', {
        lines: 100,
        follow: false
      });
    });

    test('should handle live monitoring setup', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        provider: 'docker',
        status: 'running'
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockMonitoringSystem.startMonitoring.mockResolvedValue({
        success: true,
        monitoringId: 'live-monitor-789',
        realtime: true
      });

      const args = {
            deploymentId: 'deploy-123',
            action: 'start',
            realtime: true,
            interval: 5000
          };
      const result = await monitorTool.execute(args);
      
      expect(result.success).toBe(true);
      expect(result.data.monitoring.realtime).toBe(true);
      expect(result.data.nextSteps.some(step => step.includes('Real-time monitoring is active'))).toBe(true);
    });
  });

  describe('Monitoring Persistence', () => {
    test('should save monitoring configuration', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        provider: 'railway',
        status: 'running',
        name: 'test-railway-app'
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockMonitoringSystem.startMonitoring.mockResolvedValue({
        success: true,
        monitoringId: 'persistent-monitor-123',
        persistent: true
      });

      const args = {
            deploymentId: 'deploy-123',
            action: 'start',
            persistent: true,
            alertThresholds: {
              cpu: 80,
              memory: 90,
              responseTime: 5000
            }
          };
      const result = await monitorTool.execute(args);
      
      expect(result.success).toBe(true);
      expect(result.data.monitoring.persistent).toBe(true);
      expect(result.data.summary).toContain('(persistent)');
      
      expect(mockMonitoringSystem.startMonitoring).toHaveBeenCalledWith('deploy-123', {
        interval: 30000,
        metrics: ['cpu', 'memory'],
        persistent: true,
        realtime: false,
        alertThresholds: {
          cpu: 80,
          memory: 90,
          responseTime: 5000
        }
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle deployment not found', async () => {
      mockDeploymentManager.getDeployment.mockResolvedValue(null);

      const args = {
            deploymentId: 'nonexistent-123',
            action: 'start'
          };
      const result = await monitorTool.execute(args);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Deployment not found');
      expect(result.data.suggestions.some(suggestion => suggestion.includes('Verify the deployment ID'))).toBe(true);
    });

    test('should handle monitoring system errors', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        provider: 'local',
        status: 'running'
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockMonitoringSystem.startMonitoring.mockRejectedValue(new Error('Monitoring system unavailable'));

      const args = {
            deploymentId: 'deploy-123',
            action: 'start'
          };
      const result = await monitorTool.execute(args);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Monitoring system unavailable');
    });

    test('should handle invalid JSON arguments', async () => {
      const args = {}; // Empty args test
      const result = await monitorTool.execute(args);
      
      expect(result.success).toBe(false); // Test should fail with invalid args
    });
  });

  describe('Action-specific Validation', () => {
    test('should validate metrics-specific parameters', async () => {
      const args = {
            deploymentId: 'deploy-123',
            action: 'metrics',
            metricsType: 'invalid-type'
          };
      const result = await monitorTool.execute(args);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid metrics type');
    });

    test('should validate logs-specific parameters', async () => {
      const args = {
            deploymentId: 'deploy-123',
            action: 'logs',
            lines: -10 // Invalid negative value
          };
      const result = await monitorTool.execute(args);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Lines must be a positive number');
    });
  });

  describe('Response Formatting', () => {
    test('should format monitoring status response correctly', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        provider: 'docker',
        status: 'running',
        name: 'test-app'
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockMonitoringSystem.startMonitoring.mockResolvedValue({
        success: true,
        monitoringId: 'monitor-456',
        interval: 30000
      });

      const args = {
            deploymentId: 'deploy-123',
            action: 'start'
          };
      const result = await monitorTool.execute(args);
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('monitoring');
      expect(result.data).toHaveProperty('deployment');
      expect(result.data).toHaveProperty('summary');
      expect(result.data).toHaveProperty('nextSteps');
      
      expect(result.data.deployment.id).toBe('deploy-123');
      expect(result.data.monitoring.id).toBe('monitor-456');
      expect(result.data.nextSteps).toBeInstanceOf(Array);
    });
  });
});