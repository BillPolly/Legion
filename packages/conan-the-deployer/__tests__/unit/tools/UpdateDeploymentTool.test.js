import { jest } from '@jest/globals';

// Mock dependencies
const mockDeploymentManager = {
  updateDeployment: jest.fn(),
  getDeployment: jest.fn(),
  rollbackDeployment: jest.fn()
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
const UpdateDeploymentTool = (await import('../../../src/tools/UpdateDeploymentTool.js')).default;

describe('UpdateDeploymentTool', () => {
  let updateTool;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup resource manager
    mockResourceManager.get.mockImplementation((key) => {
      if (key === 'deployment-manager') {
        return mockDeploymentManager;
      }
      return null;
    });

    updateTool = new UpdateDeploymentTool();
  });

  describe('Tool Configuration', () => {
    test('should have correct tool name and description', () => {
      expect(updateTool.name).toBe('update_deployment');
      expect(updateTool.description).toContain('Update deployment configurations with various strategies');
    });

    test('should declare correct tool description schema', () => {
      const description = updateTool.getToolDescription();
      
      expect(description.function.name).toBe('update_deployment');
      expect(description.function.parameters.type).toBe('object');
      expect(description.function.parameters.properties).toHaveProperty('deploymentId');
      expect(description.function.parameters.properties).toHaveProperty('updates');
      expect(description.function.parameters.required).toContain('deploymentId');
      expect(description.function.parameters.required).toContain('updates');
    });
  });

  describe('Parameter Validation', () => {
    test('should validate required parameters', async () => {
      const toolCall = {
        function: {
          name: 'update_deployment',
          arguments: JSON.stringify({
            // Missing required parameters
          })
        }
      };

      const result = await updateTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter');
    });

    test('should validate update strategy', async () => {
      const toolCall = {
        function: {
          name: 'update_deployment',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            updates: { image: 'new-image:latest' },
            strategy: 'invalid-strategy'
          })
        }
      };

      const result = await updateTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid update strategy');
    });

    test('should validate updates parameter structure', async () => {
      const toolCall = {
        function: {
          name: 'update_deployment',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            updates: 'invalid-updates' // Should be object
          })
        }
      };

      const result = await updateTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Updates must be an object');
    });
  });

  describe('Update Strategies', () => {
    test('should perform rolling update successfully', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        provider: 'docker',
        status: 'running',
        name: 'test-app'
      };

      const mockUpdateResult = {
        success: true,
        id: 'deploy-123-updated',
        strategy: 'rolling',
        status: 'running',
        previousVersion: 'v1.0.0',
        newVersion: 'v1.1.0'
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.updateDeployment.mockResolvedValue(mockUpdateResult);

      const toolCall = {
        function: {
          name: 'update_deployment',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            updates: {
              image: 'myapp:v1.1.0',
              environment: { VERSION: 'v1.1.0' }
            },
            strategy: 'rolling'
          })
        }
      };

      const result = await updateTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.update.strategy).toBe('rolling');
      expect(result.data.update.status).toBe('running');
      expect(result.data.summary).toContain('Rolling update');
      
      expect(mockDeploymentManager.updateDeployment).toHaveBeenCalledWith('deploy-123', {
        image: 'myapp:v1.1.0',
        environment: { VERSION: 'v1.1.0' }
      }, {
        strategy: 'rolling',
        rollbackOnFailure: true,
        verifyUpdate: true,
        healthCheckTimeout: 60000,
        trafficSplitPercentage: undefined,
        maxUnavailable: undefined,
        maxSurge: undefined
      });
    });

    test('should perform blue-green deployment successfully', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        provider: 'railway',
        status: 'running',
        name: 'prod-app'
      };

      const mockUpdateResult = {
        success: true,
        id: 'deploy-123-blue-green',
        strategy: 'blue-green',
        status: 'running',
        greenEnvironment: 'deploy-123-green',
        switchedAt: new Date().toISOString()
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.updateDeployment.mockResolvedValue(mockUpdateResult);

      const toolCall = {
        function: {
          name: 'update_deployment',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            updates: {
              branch: 'release/v2.0.0',
              environment: { FEATURE_FLAG: 'enabled' }
            },
            strategy: 'blue-green',
            rollbackOnFailure: true
          })
        }
      };

      const result = await updateTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.update.strategy).toBe('blue-green');
      expect(result.data.update.greenEnvironment).toBe('deploy-123-green');
      expect(result.data.summary).toContain('Blue-green deployment');
    });

    test('should perform recreate strategy successfully', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        provider: 'local',
        status: 'running',
        name: 'dev-app'
      };

      const mockUpdateResult = {
        success: true,
        id: 'deploy-123-recreated',
        strategy: 'recreate',
        status: 'running',
        downtime: 5000 // 5 seconds
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.updateDeployment.mockResolvedValue(mockUpdateResult);

      const toolCall = {
        function: {
          name: 'update_deployment',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            updates: {
              command: 'npm run start:prod',
              port: 8080
            },
            strategy: 'recreate'
          })
        }
      };

      const result = await updateTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.update.strategy).toBe('recreate');
      expect(result.data.update.downtime).toBe(5000);
      expect(result.data.summary).toContain('Recreate deployment');
    });
  });

  describe('Update Verification', () => {
    test('should verify successful update', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        provider: 'docker',
        status: 'running',
        name: 'test-app'
      };

      const mockUpdateResult = {
        success: true,
        id: 'deploy-123-updated',
        strategy: 'rolling',
        status: 'running',
        verified: true,
        healthChecks: {
          http: 'passing',
          readiness: 'passing'
        }
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.updateDeployment.mockResolvedValue(mockUpdateResult);

      const toolCall = {
        function: {
          name: 'update_deployment',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            updates: { image: 'myapp:latest' },
            strategy: 'rolling',
            verifyUpdate: true,
            healthCheckTimeout: 60000
          })
        }
      };

      const result = await updateTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.update.verified).toBe(true);
      expect(result.data.update.healthChecks).toEqual({
        http: 'passing',
        readiness: 'passing'
      });
      expect(result.data.summary).toContain('verified successfully');
    });

    test('should handle update verification failure with rollback', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        provider: 'docker',
        status: 'running',
        name: 'test-app'
      };

      const mockUpdateResult = {
        success: false,
        error: 'Health check failed after update',
        strategy: 'rolling',
        verified: false,
        rolledBack: true,
        rollbackId: 'deploy-123-rollback'
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.updateDeployment.mockResolvedValue(mockUpdateResult);

      const toolCall = {
        function: {
          name: 'update_deployment',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            updates: { image: 'myapp:broken' },
            strategy: 'rolling',
            rollbackOnFailure: true
          })
        }
      };

      const result = await updateTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Health check failed after update');
      expect(result.rolledBack).toBe(true);
      expect(result.rollbackId).toBe('deploy-123-rollback');
      expect(result.suggestions.some(s => s.includes('deployment was automatically rolled back'))).toBe(true);
    });
  });

  describe('Scaling Operations', () => {
    test('should scale deployment up successfully', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        provider: 'docker',
        status: 'running',
        name: 'scalable-app'
      };

      const mockUpdateResult = {
        success: true,
        id: 'deploy-123',
        strategy: 'scaling',
        status: 'running',
        previousReplicas: 2,
        newReplicas: 5,
        scalingType: 'horizontal'
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.updateDeployment.mockResolvedValue(mockUpdateResult);

      const toolCall = {
        function: {
          name: 'update_deployment',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            updates: {
              replicas: 5
            },
            strategy: 'scaling'
          })
        }
      };

      const result = await updateTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.update.newReplicas).toBe(5);
      expect(result.data.update.previousReplicas).toBe(2);
      expect(result.data.summary).toContain('Scaled "scalable-app" from 2 to 5 replicas');
    });

    test('should handle vertical scaling', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        provider: 'docker',
        status: 'running',
        name: 'resource-intensive-app'
      };

      const mockUpdateResult = {
        success: true,
        id: 'deploy-123',
        strategy: 'scaling',
        status: 'running',
        scalingType: 'vertical',
        resources: {
          cpu: '2.0',
          memory: '4Gi'
        }
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.updateDeployment.mockResolvedValue(mockUpdateResult);

      const toolCall = {
        function: {
          name: 'update_deployment',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            updates: {
              resources: {
                cpu: '2.0',
                memory: '4Gi'
              }
            },
            strategy: 'scaling'
          })
        }
      };

      const result = await updateTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.update.scalingType).toBe('vertical');
      expect(result.data.update.resources.cpu).toBe('2.0');
      expect(result.data.summary).toContain('vertical scaling');
    });
  });

  describe('Environment Updates', () => {
    test('should update environment variables', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        provider: 'railway',
        status: 'running',
        name: 'config-app'
      };

      const mockUpdateResult = {
        success: true,
        id: 'deploy-123',
        strategy: 'config',
        status: 'running',
        environmentUpdated: true,
        restartRequired: false
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.updateDeployment.mockResolvedValue(mockUpdateResult);

      const toolCall = {
        function: {
          name: 'update_deployment',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            updates: {
              environment: {
                API_URL: 'https://api.v2.example.com',
                DEBUG_MODE: 'false',
                CACHE_TTL: '3600'
              }
            },
            strategy: 'config'
          })
        }
      };

      const result = await updateTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.update.environmentUpdated).toBe(true);
      expect(result.data.update.restartRequired).toBe(false);
      expect(result.data.summary).toContain('Environment variables updated');
    });
  });

  describe('Error Handling', () => {
    test('should handle deployment not found', async () => {
      mockDeploymentManager.getDeployment.mockResolvedValue(null);

      const toolCall = {
        function: {
          name: 'update_deployment',
          arguments: JSON.stringify({
            deploymentId: 'nonexistent-123',
            updates: { image: 'new-image' }
          })
        }
      };

      const result = await updateTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Deployment not found');
      expect(result.suggestions.some(s => s.includes('Verify the deployment ID'))).toBe(true);
    });

    test('should handle update failures', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        provider: 'docker',
        status: 'running',
        name: 'test-app'
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.updateDeployment.mockRejectedValue(new Error('Update failed: insufficient resources'));

      const toolCall = {
        function: {
          name: 'update_deployment',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            updates: { image: 'resource-heavy:latest' }
          })
        }
      };

      const result = await updateTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('insufficient resources');
    });

    test('should handle invalid JSON arguments', async () => {
      const toolCall = {
        function: {
          name: 'update_deployment',
          arguments: 'invalid-json'
        }
      };

      const result = await updateTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });
  });

  describe('Strategy-specific Validation', () => {
    test('should validate blue-green specific parameters', async () => {
      const toolCall = {
        function: {
          name: 'update_deployment',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            updates: { image: 'new-image' },
            strategy: 'blue-green',
            trafficSplitPercentage: 150 // Invalid percentage
          })
        }
      };

      const result = await updateTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Traffic split percentage must be between 0 and 100');
    });

    test('should validate scaling parameters', async () => {
      const toolCall = {
        function: {
          name: 'update_deployment',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            updates: { replicas: -5 }, // Invalid negative replicas
            strategy: 'scaling'
          })
        }
      };

      const result = await updateTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Replicas must be a positive number');
    });
  });

  describe('Response Formatting', () => {
    test('should format successful update response correctly', async () => {
      const mockDeployment = {
        id: 'deploy-123',
        provider: 'docker',
        status: 'running',
        name: 'test-app'
      };

      const mockUpdateResult = {
        success: true,
        id: 'deploy-123-updated',
        strategy: 'rolling',
        status: 'running'
      };

      mockDeploymentManager.getDeployment.mockResolvedValue(mockDeployment);
      mockDeploymentManager.updateDeployment.mockResolvedValue(mockUpdateResult);

      const toolCall = {
        function: {
          name: 'update_deployment',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            updates: { image: 'new-image' }
          })
        }
      };

      const result = await updateTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('deployment');
      expect(result.data).toHaveProperty('update');
      expect(result.data).toHaveProperty('summary');
      expect(result.data).toHaveProperty('nextSteps');
      
      expect(result.data.deployment.id).toBe('deploy-123');
      expect(result.data.update.strategy).toBe('rolling');
      expect(result.data.nextSteps).toBeInstanceOf(Array);
    });
  });
});