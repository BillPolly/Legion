import { jest } from '@jest/globals';

// Mock dependencies
const mockDeploymentManager = {
  stopDeployment: jest.fn(),
  getDeployment: jest.fn()
};

const mockResourceManager = {
  get: jest.fn(),
  initialize: jest.fn()
};

jest.unstable_mockModule('../../../src/DeploymentManager.js', () => ({
  default: jest.fn(() => mockDeploymentManager)
}));

jest.unstable_mockModule('../../../src/core/ResourceManager.js', () => ({
  default: jest.fn(() => mockResourceManager)
}));

// Import after mocking
const StopDeploymentTool = (await import('../../../src/tools/StopDeploymentTool.js')).default;

describe('StopDeploymentTool', () => {
  let stopTool;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup resource manager
    mockResourceManager.get.mockImplementation((key) => {
      if (key === 'deployment-manager') {
        return mockDeploymentManager;
      }
      return null;
    });

    stopTool = new StopDeploymentTool();
  });

  describe('Tool Configuration', () => {
    test('should have correct tool name and description', () => {
      expect(stopTool.name).toBe('stop_deployment');
      expect(stopTool.description).toContain('Stop running deployments with graceful shutdown options');
    });

    test('should declare correct tool description schema', () => {
      const description = stopTool.getToolDescription();
      
      expect(description.function.name).toBe('stop_deployment');
      expect(description.function.parameters.type).toBe('object');
      expect(description.function.parameters.properties).toHaveProperty('deploymentId');
      expect(description.function.parameters.properties).toHaveProperty('graceful');
      expect(description.function.parameters.required).toContain('deploymentId');
    });
  });

  describe('Parameter Validation', () => {
    test('should validate required parameters', async () => {
      const toolCall = {
        function: {
          name: 'stop_deployment',
          arguments: JSON.stringify({
            // Missing required parameters
          })
        }
      };

      const result = await stopTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter');
    });

    test('should validate timeout parameter', async () => {
      const toolCall = {
        function: {
          name: 'stop_deployment',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            timeout: -5000 // Invalid negative timeout
          })
        }
      };

      const result = await stopTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout must be a positive number');
    });
  });

  describe('Graceful Shutdown', () => {
    test('should stop deployment gracefully', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        name: 'test-app',
        provider: 'local',
        status: 'running'
      };

      const mockStopResult = {
        success: true,
        id: 'deploy-123',
        status: 'stopped',
        stoppedAt: new Date().toISOString(),
        graceful: true,
        shutdownTime: 2500
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.stopDeployment.mockResolvedValue(mockStopResult);

      const toolCall = {
        function: {
          name: 'stop_deployment',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            graceful: true,
            timeout: 30000
          })
        }
      };

      const result = await stopTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.stop.status).toBe('stopped');
      expect(result.data.stop.graceful).toBe(true);
      expect(result.data.stop.shutdownTime).toBe(2500);
      expect(result.data.summary).toContain('gracefully stopped');
      
      expect(mockDeploymentManager.stopDeployment).toHaveBeenCalledWith('deploy-123', {
        graceful: true,
        timeout: 30000,
        force: false,
        cleanup: false,
        removeVolumes: false,
        signal: 'SIGTERM',
        drainConnections: true,
        notifyUsers: false
      });
    });

    test('should handle forced shutdown', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        name: 'stuck-app',
        provider: 'docker',
        status: 'running'
      };

      const mockStopResult = {
        success: true,
        id: 'deploy-123',
        status: 'stopped',
        stoppedAt: new Date().toISOString(),
        graceful: false,
        forced: true
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.stopDeployment.mockResolvedValue(mockStopResult);

      const toolCall = {
        function: {
          name: 'stop_deployment',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            graceful: false,
            force: true
          })
        }
      };

      const result = await stopTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.stop.forced).toBe(true);
      expect(result.data.summary).toContain('forcefully stopped');
    });

    test('should handle graceful shutdown timeout', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        name: 'slow-app',
        provider: 'local',
        status: 'running'
      };

      const mockStopResult = {
        success: true,
        id: 'deploy-123',
        status: 'stopped',
        stoppedAt: new Date().toISOString(),
        graceful: false,
        timedOut: true,
        shutdownTime: 30000
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.stopDeployment.mockResolvedValue(mockStopResult);

      const toolCall = {
        function: {
          name: 'stop_deployment',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            graceful: true,
            timeout: 30000
          })
        }
      };

      const result = await stopTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.stop.timedOut).toBe(true);
      expect(result.data.summary).toContain('timed out');
      expect(result.data.nextSteps).toContain('Consider increasing timeout for future stops of this deployment');
    });
  });

  describe('Provider-specific Handling', () => {
    test('should handle local provider shutdown', async () => {
      const mockDeployment = {
        id: 'local-123',
        name: 'dev-server',
        provider: 'local',
        status: 'running',
        pid: 12345
      };

      const mockStopResult = {
        success: true,
        id: 'local-123',
        status: 'stopped',
        graceful: true,
        signal: 'SIGTERM'
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.stopDeployment.mockResolvedValue(mockStopResult);

      const toolCall = {
        function: {
          name: 'stop_deployment',
          arguments: JSON.stringify({
            deploymentId: 'local-123'
          })
        }
      };

      const result = await stopTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.stop.signal).toBe('SIGTERM');
      expect(result.data.summary).toContain('Local process stopped');
    });

    test('should handle Docker container shutdown', async () => {
      const mockDeployment = {
        id: 'docker-456',
        name: 'web-container',
        provider: 'docker',
        status: 'running'
      };

      const mockStopResult = {
        success: true,
        id: 'docker-456',
        status: 'stopped',
        graceful: true,
        containerStopped: true
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.stopDeployment.mockResolvedValue(mockStopResult);

      const toolCall = {
        function: {
          name: 'stop_deployment',
          arguments: JSON.stringify({
            deploymentId: 'docker-456',
            graceful: true
          })
        }
      };

      const result = await stopTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.stop.containerStopped).toBe(true);
      expect(result.data.summary).toContain('Docker container stopped');
    });

    test('should handle Railway service shutdown', async () => {
      const mockDeployment = {
        id: 'railway-789',
        name: 'prod-service',
        provider: 'railway',
        status: 'running'
      };

      const mockStopResult = {
        success: true,
        id: 'railway-789',
        status: 'stopped',
        graceful: true,
        serviceScaledDown: true
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.stopDeployment.mockResolvedValue(mockStopResult);

      const toolCall = {
        function: {
          name: 'stop_deployment',
          arguments: JSON.stringify({
            deploymentId: 'railway-789'
          })
        }
      };

      const result = await stopTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.stop.serviceScaledDown).toBe(true);
      expect(result.data.summary).toContain('Railway service stopped');
    });
  });

  describe('Cleanup Operations', () => {
    test('should perform cleanup when requested', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        name: 'temp-app',
        provider: 'docker',
        status: 'running'
      };

      const mockStopResult = {
        success: true,
        id: 'deploy-123',
        status: 'stopped',
        graceful: true,
        cleanup: {
          performed: true,
          removedContainers: 1,
          removedVolumes: 2,
          removedNetworks: 1
        }
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.stopDeployment.mockResolvedValue(mockStopResult);

      const toolCall = {
        function: {
          name: 'stop_deployment',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            cleanup: true,
            removeVolumes: true
          })
        }
      };

      const result = await stopTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.stop.cleanup.performed).toBe(true);
      expect(result.data.stop.cleanup.removedContainers).toBe(1);
      expect(result.data.summary).toContain('cleanup completed');
      
      expect(mockDeploymentManager.stopDeployment).toHaveBeenCalledWith('deploy-123', {
        graceful: true,
        timeout: 30000,
        force: false,
        cleanup: true,
        removeVolumes: true,
        signal: 'SIGTERM',
        drainConnections: true,
        notifyUsers: false
      });
    });

    test('should preserve volumes when specified', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        name: 'data-app',
        provider: 'docker',
        status: 'running'
      };

      const mockStopResult = {
        success: true,
        id: 'deploy-123',
        status: 'stopped',
        cleanup: {
          performed: true,
          removedContainers: 1,
          preservedVolumes: 3
        }
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.stopDeployment.mockResolvedValue(mockStopResult);

      const toolCall = {
        function: {
          name: 'stop_deployment',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            cleanup: true,
            removeVolumes: false
          })
        }
      };

      const result = await stopTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.stop.cleanup.preservedVolumes).toBe(3);
      expect(result.data.summary).toContain('volumes preserved');
    });
  });

  describe('Error Handling', () => {
    test('should handle deployment not found', async () => {
      mockDeploymentManager.getDeployment.mockResolvedValue(null);

      const toolCall = {
        function: {
          name: 'stop_deployment',
          arguments: JSON.stringify({
            deploymentId: 'nonexistent-123'
          })
        }
      };

      const result = await stopTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Deployment not found');
      expect(result.suggestions.some(s => s.includes('Verify the deployment ID'))).toBe(true);
    });

    test('should handle already stopped deployment', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        name: 'stopped-app',
        provider: 'local',
        status: 'stopped'
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);

      const toolCall = {
        function: {
          name: 'stop_deployment',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123'
          })
        }
      };

      const result = await stopTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('already stopped');
      expect(result.suggestions).toContain('Use list_deployments to see current deployment statuses');
    });

    test('should handle stop failures', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        name: 'stubborn-app',
        provider: 'docker',
        status: 'running'
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.stopDeployment.mockRejectedValue(new Error('Container cannot be stopped'));

      const toolCall = {
        function: {
          name: 'stop_deployment',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123'
          })
        }
      };

      const result = await stopTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Container cannot be stopped');
    });

    test('should handle invalid JSON arguments', async () => {
      const toolCall = {
        function: {
          name: 'stop_deployment',
          arguments: 'invalid-json'
        }
      };

      const result = await stopTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });
  });

  describe('Multiple Deployment Handling', () => {
    test('should handle stop all deployments for a provider', async () => {
      const toolCall = {
        function: {
          name: 'stop_deployment',
          arguments: JSON.stringify({
            deploymentId: 'all',
            provider: 'docker',
            graceful: true
          })
        }
      };

      const mockStopResult = {
        success: true,
        stopped: ['docker-1', 'docker-2', 'docker-3'],
        totalStopped: 3
      };

      mockDeploymentManager.stopDeployment.mockResolvedValue(mockStopResult);

      const result = await stopTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.stop.totalStopped).toBe(3);
      expect(result.data.summary).toContain('Stopped 3 deployments');
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

      const mockStopResult = {
        success: true,
        id: 'deploy-123',
        status: 'stopped',
        graceful: true
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.stopDeployment.mockResolvedValue(mockStopResult);

      const toolCall = {
        function: {
          name: 'stop_deployment',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123'
          })
        }
      };

      const result = await stopTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('deployment');
      expect(result.data).toHaveProperty('stop');
      expect(result.data).toHaveProperty('summary');
      expect(result.data).toHaveProperty('nextSteps');
      
      expect(result.data.deployment.id).toBe('deploy-123');
      expect(result.data.stop.status).toBe('stopped');
      expect(result.data.nextSteps).toBeInstanceOf(Array);
    });
  });
});