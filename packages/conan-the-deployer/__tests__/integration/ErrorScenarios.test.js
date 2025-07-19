import { jest } from '@jest/globals';

// Mock dependencies for error scenario testing
const mockResourceManager = {
  get: jest.fn(),
  register: jest.fn(),
  initialize: jest.fn()
};

const mockDeploymentManager = {
  deploy: jest.fn(),
  updateDeployment: jest.fn(),
  stopDeployment: jest.fn(),
  getDeployment: jest.fn(),
  listDeployments: jest.fn(),
  getDeploymentLogs: jest.fn(),
  initialize: jest.fn()
};

const mockMonitoringSystem = {
  startMonitoring: jest.fn(),
  stopMonitoring: jest.fn(),
  getHealth: jest.fn(),
  getMetrics: jest.fn(),
  getLogs: jest.fn()
};

jest.unstable_mockModule('../../src/core/ResourceManager.js', () => ({
  default: jest.fn(() => mockResourceManager)
}));

jest.unstable_mockModule('../../src/DeploymentManager.js', () => ({
  default: jest.fn(() => mockDeploymentManager)
}));

jest.unstable_mockModule('../../src/MonitoringSystem.js', () => ({
  default: jest.fn(() => mockMonitoringSystem)
}));

// Import tools after mocking
const DeployApplicationTool = (await import('../../src/tools/DeployApplicationTool.js')).default;
const MonitorDeploymentTool = (await import('../../src/tools/MonitorDeploymentTool.js')).default;
const UpdateDeploymentTool = (await import('../../src/tools/UpdateDeploymentTool.js')).default;
const StopDeploymentTool = (await import('../../src/tools/StopDeploymentTool.js')).default;
const ListDeploymentsTool = (await import('../../src/tools/ListDeploymentsTool.js')).default;
const GetDeploymentLogsTool = (await import('../../src/tools/GetDeploymentLogsTool.js')).default;

describe('Error Scenario Tests', () => {
  let deployTool, monitorTool, updateTool, stopTool, listTool, logsTool;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock behavior
    mockResourceManager.get.mockImplementation((key) => {
      if (key === 'deployment-manager') {
        return mockDeploymentManager;
      } else if (key === 'monitoring-system') {
        return mockMonitoringSystem;
      }
      return null;
    });
    
    deployTool = new DeployApplicationTool();
    monitorTool = new MonitorDeploymentTool();
    updateTool = new UpdateDeploymentTool();
    stopTool = new StopDeploymentTool();
    listTool = new ListDeploymentsTool();
    logsTool = new GetDeploymentLogsTool();
  });

  describe('Provider Failures', () => {
    test('should handle Docker daemon not available', async () => {
      mockDeploymentManager.deploy.mockRejectedValue(
        new Error('Docker daemon not available. Ensure Docker is installed and running.')
      );

      const deployCall = {
        function: {
          name: 'deploy_application',
          arguments: JSON.stringify({
            provider: 'docker',
            config: {
              name: 'docker-app',
              source: '/test/path'
            }
          })
        }
      };

      const result = await deployTool.invoke(deployCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Docker daemon not available');
      expect(result.suggestions).toContain('Ensure Docker is installed and running');
    });

    test('should handle Railway API authentication failure', async () => {
      mockDeploymentManager.deploy.mockRejectedValue(
        new Error('Railway API authentication failed. Check your API key.')
      );

      const deployCall = {
        function: {
          name: 'deploy_application',
          arguments: JSON.stringify({
            provider: 'railway',
            config: {
              name: 'railway-app',
              source: '/test/path'
            }
          })
        }
      };

      const result = await deployTool.invoke(deployCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Railway API authentication failed');
      expect(result.suggestions).toContain('Check your Railway API key configuration');
    });

    test('should handle port conflicts gracefully', async () => {
      mockDeploymentManager.deploy.mockResolvedValue({
        success: false,
        error: 'Port 3000 is already in use by another process',
        details: {
          port: 3000,
          provider: 'local',
          conflictingProcess: { pid: 1234, name: 'existing-app' }
        }
      });

      const deployCall = {
        function: {
          name: 'deploy_application',
          arguments: JSON.stringify({
            provider: 'local',
            config: {
              name: 'port-conflict-app',
              source: '/test/path',
              environment: { PORT: '3000' }
            }
          })
        }
      };

      const result = await deployTool.invoke(deployCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Port 3000 is already in use');
      expect(result.suggestions).toContain('Try using a different port');
    });
  });

  describe('Network Interruptions', () => {
    test('should handle network timeout during deployment', async () => {
      mockDeploymentManager.deploy.mockRejectedValue(
        new Error('ETIMEDOUT: Network timeout while downloading dependencies')
      );

      const deployCall = {
        function: {
          name: 'deploy_application',
          arguments: JSON.stringify({
            provider: 'railway',
            config: {
              name: 'network-timeout-app',
              source: '/test/path'
            }
          })
        }
      };

      const result = await deployTool.invoke(deployCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
      expect(result.suggestions).toContain('Check your internet connection and try again');
    });

    test('should handle intermittent connection issues during monitoring', async () => {
      const deploymentId = 'deploy-123';
      
      mockDeploymentManager.getDeployment.mockResolvedValue({
        id: deploymentId,
        provider: 'docker',
        status: 'running'
      });

      // First call succeeds, second fails due to network
      mockMonitoringSystem.startMonitoring
        .mockResolvedValueOnce({
          success: true,
          monitoring: { status: 'active' }
        })
        .mockRejectedValueOnce(
          new Error('ECONNREFUSED: Connection refused to monitoring endpoint')
        );

      const monitorCall = {
        function: {
          name: 'monitor_deployment',
          arguments: JSON.stringify({
            deploymentId: deploymentId,
            action: 'start'
          })
        }
      };

      // First call should succeed
      const result1 = await monitorTool.invoke(monitorCall);
      expect(result1.success).toBe(true);

      // Second call should fail gracefully
      const result2 = await monitorTool.invoke(monitorCall);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Connection refused');
      expect(result2.suggestions).toContain('Check if the deployment is still running');
    });

    test('should handle DNS resolution failures', async () => {
      mockDeploymentManager.deploy.mockRejectedValue(
        new Error('ENOTFOUND: DNS resolution failed for registry.npmjs.org')
      );

      const deployCall = {
        function: {
          name: 'deploy_application',
          arguments: JSON.stringify({
            provider: 'docker',
            config: {
              name: 'dns-fail-app',
              source: '/test/path'
            }
          })
        }
      };

      const result = await deployTool.invoke(deployCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('DNS resolution failed');
      expect(result.suggestions).toContain('Check your DNS settings');
    });
  });

  describe('Invalid Configurations', () => {
    test('should handle malformed package.json', async () => {
      mockDeploymentManager.deploy.mockRejectedValue(
        new Error('Invalid package.json: Unexpected token in JSON at position 45')
      );

      const deployCall = {
        function: {
          name: 'deploy_application',
          arguments: JSON.stringify({
            provider: 'local',
            config: {
              name: 'malformed-json-app',
              source: '/test/path/with/bad/package.json'
            }
          })
        }
      };

      const result = await deployTool.invoke(deployCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid package.json');
      expect(result.suggestions).toContain('Validate your package.json syntax');
    });

    test('should handle missing required dependencies', async () => {
      mockDeploymentManager.deploy.mockRejectedValue(
        new Error('Missing required dependency: express. Run npm install to install missing dependencies.')
      );

      const deployCall = {
        function: {
          name: 'deploy_application',
          arguments: JSON.stringify({
            provider: 'local',
            config: {
              name: 'missing-deps-app',
              source: '/test/path'
            }
          })
        }
      };

      const result = await deployTool.invoke(deployCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required dependency');
      expect(result.suggestions).toContain('Run npm install to install dependencies');
    });

    test('should handle invalid environment variables', async () => {
      const deployCall = {
        function: {
          name: 'deploy_application',
          arguments: JSON.stringify({
            provider: 'local',
            config: {
              name: 'invalid-env-app',
              source: '/test/path',
              environment: {
                'INVALID KEY WITH SPACES': 'value',
                '123STARTS_WITH_NUMBER': 'value'
              }
            }
          })
        }
      };

      const result = await deployTool.invoke(deployCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid environment variable names');
      expect(result.suggestions).toContain('Environment variable names must follow naming conventions');
    });
  });

  describe('Resource Exhaustion', () => {
    test('should handle out of memory errors', async () => {
      mockDeploymentManager.deploy.mockRejectedValue(
        new Error('JavaScript heap out of memory')
      );

      const deployCall = {
        function: {
          name: 'deploy_application',
          arguments: JSON.stringify({
            provider: 'local',
            config: {
              name: 'memory-heavy-app',
              source: '/test/path'
            }
          })
        }
      };

      const result = await deployTool.invoke(deployCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('heap out of memory');
      expect(result.suggestions).toContain('Consider increasing memory limits');
    });

    test('should handle disk space exhaustion', async () => {
      mockDeploymentManager.deploy.mockRejectedValue(
        new Error('ENOSPC: no space left on device')
      );

      const deployCall = {
        function: {
          name: 'deploy_application',
          arguments: JSON.stringify({
            provider: 'docker',
            config: {
              name: 'disk-space-app',
              source: '/test/path'
            }
          })
        }
      };

      const result = await deployTool.invoke(deployCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('no space left on device');
      expect(result.suggestions).toContain('Free up disk space and try again');
    });

    test('should handle too many open files', async () => {
      mockDeploymentManager.getDeploymentLogs.mockRejectedValue(
        new Error('EMFILE: too many open files')
      );

      mockDeploymentManager.getDeployment.mockResolvedValue({
        id: 'deploy-123',
        provider: 'local',
        status: 'running'
      });

      const logsCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: 'deploy-123',
            lines: 1000
          })
        }
      };

      const result = await logsTool.invoke(logsCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('too many open files');
      expect(result.suggestions).toContain('Increase system file descriptor limits');
    });
  });

  describe('Cleanup After Failures', () => {
    test('should cleanup partial deployments after failure', async () => {
      const deploymentId = 'partial-deploy-123';
      
      // Mock partial deployment that fails during health check
      mockDeploymentManager.deploy.mockResolvedValue({
        success: false,
        error: 'Health check failed after deployment',
        partialDeployment: {
          id: deploymentId,
          status: 'failed',
          resources: ['container-abc123', 'network-def456']
        },
        cleanupRequired: true
      });

      const deployCall = {
        function: {
          name: 'deploy_application',
          arguments: JSON.stringify({
            provider: 'docker',
            config: {
              name: 'failing-app',
              source: '/test/path',
              healthCheck: {
                path: '/health',
                timeout: 5000
              }
            }
          })
        }
      };

      const result = await deployTool.invoke(deployCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Health check failed');
      expect(result.cleanupRequired).toBe(true);
      expect(result.suggestions).toContain('Run cleanup to remove partial deployment resources');
    });

    test('should handle cleanup failures gracefully', async () => {
      const deploymentId = 'cleanup-fail-123';
      
      mockDeploymentManager.getDeployment.mockResolvedValue({
        id: deploymentId,
        provider: 'docker',
        status: 'failed'
      });

      mockDeploymentManager.stopDeployment.mockRejectedValue(
        new Error('Failed to remove container: container not found')
      );

      const stopCall = {
        function: {
          name: 'stop_deployment',
          arguments: JSON.stringify({
            deploymentId: deploymentId,
            cleanup: true,
            force: true
          })
        }
      };

      const result = await stopTool.invoke(stopCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to remove container');
      expect(result.suggestions).toContain('Check Docker container status manually');
    });
  });

  describe('Rollback Scenarios', () => {
    test('should handle rollback failures during update', async () => {
      const deploymentId = 'rollback-fail-123';
      
      mockDeploymentManager.getDeployment.mockResolvedValue({
        id: deploymentId,
        provider: 'railway',
        status: 'running'
      });

      // Update fails and rollback also fails
      mockDeploymentManager.updateDeployment.mockResolvedValue({
        success: false,
        error: 'Update failed: new image contains critical errors',
        rollbackAttempted: true,
        rollbackFailed: true,
        rollbackError: 'Previous deployment version no longer available'
      });

      const updateCall = {
        function: {
          name: 'update_deployment',
          arguments: JSON.stringify({
            deploymentId: deploymentId,
            updates: {
              image: 'myapp:broken-version'
            },
            strategy: 'rolling',
            rollbackOnFailure: true
          })
        }
      };

      const result = await updateTool.invoke(updateCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Update failed');
      expect(result.rollbackFailed).toBe(true);
      expect(result.suggestions).toContain('Manual intervention required');
    });

    test('should handle partial rollback completion', async () => {
      const deploymentId = 'partial-rollback-123';
      
      mockDeploymentManager.getDeployment.mockResolvedValue({
        id: deploymentId,
        provider: 'docker',
        status: 'running'
      });

      mockDeploymentManager.updateDeployment.mockResolvedValue({
        success: false,
        error: 'Update failed during health check',
        rollbackAttempted: true,
        rollbackSuccess: true,
        rollbackPartial: true,
        rollbackDetails: {
          containersRestored: 2,
          containersFailed: 1,
          configRestored: true
        }
      });

      const updateCall = {
        function: {
          name: 'update_deployment',
          arguments: JSON.stringify({
            deploymentId: deploymentId,
            updates: {
              replicas: 5
            },
            strategy: 'rolling',
            rollbackOnFailure: true
          })
        }
      };

      const result = await updateTool.invoke(updateCall);
      
      expect(result.success).toBe(false);
      expect(result.rollbackPartial).toBe(true);
      expect(result.suggestions).toContain('Verify deployment status and consider manual cleanup');
    });
  });

  describe('Concurrent Error Scenarios', () => {
    test('should handle deployment conflicts', async () => {
      const deploymentId = 'conflict-123';
      
      // First update succeeds
      mockDeploymentManager.getDeployment.mockResolvedValue({
        id: deploymentId,
        provider: 'local',
        status: 'running'
      });

      mockDeploymentManager.updateDeployment
        .mockResolvedValueOnce({
          success: true,
          id: deploymentId,
          status: 'updating'
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Deployment is already being updated by another process',
          conflictingOperation: 'update'
        });

      const updateCall = {
        function: {
          name: 'update_deployment',
          arguments: JSON.stringify({
            deploymentId: deploymentId,
            updates: { replicas: 3 }
          })
        }
      };

      // First call succeeds
      const result1 = await updateTool.invoke(updateCall);
      expect(result1.success).toBe(true);

      // Second concurrent call fails
      const result2 = await updateTool.invoke(updateCall);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('already being updated');
      expect(result2.suggestions).toContain('Wait for the current operation to complete');
    });

    test('should handle monitoring system overload', async () => {
      // Setup many deployments
      const deploymentIds = Array.from({ length: 50 }, (_, i) => `deploy-${i}`);
      
      mockDeploymentManager.getDeployment.mockImplementation((id) => 
        Promise.resolve({
          id: id,
          provider: 'local',
          status: 'running'
        })
      );

      // Monitoring system gets overloaded
      mockMonitoringSystem.startMonitoring.mockRejectedValue(
        new Error('Monitoring system overloaded: too many active monitors (max: 20)')
      );

      const monitorCalls = deploymentIds.map(id => ({
        function: {
          name: 'monitor_deployment',
          arguments: JSON.stringify({
            deploymentId: id,
            action: 'start'
          })
        }
      }));

      // Try to start monitoring for all deployments
      const results = await Promise.all(
        monitorCalls.map(call => monitorTool.invoke(call))
      );

      // All should fail gracefully
      expect(results.every(r => !r.success)).toBe(true);
      expect(results.every(r => r.error.includes('overloaded'))).toBe(true);
      expect(results.every(r => r.suggestions.some(s => s.includes('Reduce the number of concurrent monitors')))).toBe(true);
    });
  });

  describe('Data Corruption Scenarios', () => {
    test('should handle corrupted deployment metadata', async () => {
      mockDeploymentManager.listDeployments.mockResolvedValue({
        success: false,
        error: 'Deployment metadata corrupted: unable to parse deployment records',
        corruptedRecords: ['deploy-123', 'deploy-456'],
        partialData: true
      });

      const listCall = {
        function: {
          name: 'list_deployments',
          arguments: JSON.stringify({})
        }
      };

      const result = await listTool.invoke(listCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('metadata corrupted');
      expect(result.suggestions).toContain('Consider rebuilding deployment index');
    });

    test('should handle corrupted log files', async () => {
      const deploymentId = 'corrupted-logs-123';
      
      mockDeploymentManager.getDeployment.mockResolvedValue({
        id: deploymentId,
        provider: 'local',
        status: 'running'
      });

      mockDeploymentManager.getDeploymentLogs.mockResolvedValue({
        success: false,
        error: 'Log file corrupted or truncated',
        partialLogs: [
          { timestamp: '2024-01-01T10:00:00Z', message: 'App started', corrupted: false },
          { timestamp: '2024-01-01T10:01:00Z', message: null, corrupted: true }
        ],
        corruption: {
          type: 'truncated',
          position: 1024,
          recoverable: true
        }
      });

      const logsCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: deploymentId,
            lines: 100
          })
        }
      };

      const result = await logsTool.invoke(logsCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Log file corrupted');
      expect(result.suggestions).toContain('Try retrieving logs with different parameters');
    });
  });
});