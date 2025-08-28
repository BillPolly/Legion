import { jest } from '@jest/globals';
import path from 'path';
import fs from 'fs/promises';
import { tmpdir } from 'os';

// Mock dependencies
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

jest.unstable_mockModule('@legion/resource-manager', () => ({
  ResourceManager: jest.fn(() => mockResourceManager),
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
const ListDeploymentsTool = (await import('../../src/tools/ListDeploymentsTool.js')).default;
const StopDeploymentTool = (await import('../../src/tools/StopDeploymentTool.js')).default;
const GetDeploymentLogsTool = (await import('../../src/tools/GetDeploymentLogsTool.js')).default;

describe('Tool Integration Tests', () => {
  let deployTool, monitorTool, updateTool, listTool, stopTool, logsTool;
  let tempDir, testAppDir;

  beforeAll(async () => {
    // Create a temporary directory for test applications
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'conan-test-'));
    testAppDir = path.join(tempDir, 'test-app');
    
    // Create a test Node.js application
    await fs.mkdir(testAppDir, { recursive: true });
    
    // Create package.json
    const packageJson = {
      name: 'test-app',
      version: '1.0.0',
      main: 'server.js',
      scripts: {
        start: 'node server.js',
        test: 'echo "test"'
      },
      dependencies: {
        express: '^4.18.0'
      }
    };
    
    await fs.writeFile(
      path.join(testAppDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // Create server.js
    const serverJs = `
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ message: 'Hello from test app!', port: port });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

const server = app.listen(port, () => {
  console.log(\`Test app listening on port \${port}\`);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});
    `;
    
    await fs.writeFile(path.join(testAppDir, 'server.js'), serverJs);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock behavior for ResourceManager
    mockResourceManager.get.mockImplementation((key) => {
      if (key === 'deployment-manager') {
        return mockDeploymentManager;
      } else if (key === 'monitoring-system') {
        return mockMonitoringSystem;
      }
      return null;
    });
    
    // Initialize tools
    deployTool = new DeployApplicationTool();
    monitorTool = new MonitorDeploymentTool();
    updateTool = new UpdateDeploymentTool();
    listTool = new ListDeploymentsTool();
    stopTool = new StopDeploymentTool();
    logsTool = new GetDeploymentLogsTool();
  });

  afterAll(async () => {
    // Cleanup temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error.message);
    }
  });

  describe('End-to-End Deployment Workflow', () => {
    test('should complete full deployment lifecycle using tools', async () => {
      const deploymentId = 'deploy-123';
      
      // Step 1: Deploy application
      mockDeploymentManager.deploy.mockResolvedValue({
        success: true,
        id: deploymentId,
        name: 'test-app',
        provider: 'local',
        status: 'running',
        url: 'http://localhost:3000',
        pid: 12345,
        port: 3000,
        createdAt: new Date().toISOString()
      });

      const deployToolCall = {
        function: {
          name: 'deploy_application',
          arguments: JSON.stringify({
            provider: 'local',
            config: {
              source: testAppDir,
              name: 'test-app',
              environment: {
                NODE_ENV: 'production',
                PORT: '3000'
              },
              healthCheck: {
                path: '/health',
                interval: 5000
              }
            }
          })
        }
      };

      const deployResult = await deployTool.execute(deployToolCall.function.arguments ? JSON.parse(deployToolCall.function.arguments) : {});
      
      expect(deployResult.success).toBe(true);
      expect(deployResult.data.deployment.id).toBe(deploymentId);
      expect(deployResult.data.deployment.provider).toBe('local');
      expect(deployResult.data.deployment.status).toBe('running');
      
      // Verify deployment manager was called correctly
      expect(mockDeploymentManager.deploy).toHaveBeenCalledWith(
        'local',
        expect.objectContaining({
          source: testAppDir,
          name: 'test-app'
        })
      );

      // Step 2: Start monitoring
      mockMonitoringSystem.startMonitoring.mockResolvedValue({
        success: true,
        monitoring: {
          deploymentId: deploymentId,
          status: 'active',
          interval: 5000
        }
      });

      mockDeploymentManager.getDeployment.mockResolvedValue({
        id: deploymentId,
        name: 'test-app',
        provider: 'local',
        status: 'running'
      });

      const monitorToolCall = {
        function: {
          name: 'monitor_deployment',
          arguments: JSON.stringify({
            deploymentId: deploymentId,
            action: 'start',
            interval: 5000
          })
        }
      };

      const monitorResult = await monitorTool.execute(monitorToolCall.function.arguments ? JSON.parse(monitorToolCall.function.arguments) : {});
      
      expect(monitorResult.success).toBe(true);
      expect(monitorResult.data.monitoring.status).toBe('active');

      // Step 3: List deployments
      mockDeploymentManager.listDeployments.mockResolvedValue({
        success: true,
        deployments: [{
          id: deploymentId,
          name: 'test-app',
          provider: 'local',
          status: 'running',
          url: 'http://localhost:3000',
          createdAt: new Date().toISOString()
        }]
      });

      const listToolCall = {
        function: {
          name: 'list_deployments',
          arguments: JSON.stringify({
            provider: 'local'
          })
        }
      };

      const listResult = await listTool.execute(listToolCall.function.arguments ? JSON.parse(listToolCall.function.arguments) : {});
      
      expect(listResult.success).toBe(true);
      expect(listResult.data.deployments).toHaveLength(1);
      expect(listResult.data.deployments[0].id).toBe(deploymentId);

      // Step 4: Update deployment
      mockDeploymentManager.updateDeployment.mockResolvedValue({
        success: true,
        id: deploymentId,
        strategy: 'rolling',
        status: 'running',
        newVersion: 'v1.1.0',
        updatedAt: new Date().toISOString()
      });

      const updateToolCall = {
        function: {
          name: 'update_deployment',
          arguments: JSON.stringify({
            deploymentId: deploymentId,
            updates: {
              environment: {
                NODE_ENV: 'production',
                PORT: '3000',
                NEW_FEATURE: 'enabled'
              }
            },
            strategy: 'rolling'
          })
        }
      };

      const updateResult = await updateTool.execute(updateToolCall.function.arguments ? JSON.parse(updateToolCall.function.arguments) : {});
      
      expect(updateResult.success).toBe(true);
      expect(updateResult.data.update.strategy).toBe('rolling');

      // Step 5: Get logs
      mockDeploymentManager.getDeploymentLogs.mockResolvedValue({
        success: true,
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'Test app listening on port 3000',
            source: 'stdout'
          },
          {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'Environment updated',
            source: 'app'
          }
        ],
        totalLines: 2,
        format: 'structured'
      });

      const logsToolCall = {
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: deploymentId,
            lines: 50,
            format: 'structured'
          })
        }
      };

      const logsResult = await logsTool.execute(logsToolCall.function.arguments ? JSON.parse(logsToolCall.function.arguments) : {});
      
      expect(logsResult.success).toBe(true);
      expect(logsResult.data.logs).toHaveLength(2);
      expect(logsResult.data.format).toBe('structured');

      // Step 6: Stop deployment
      mockDeploymentManager.stopDeployment.mockResolvedValue({
        success: true,
        id: deploymentId,
        status: 'stopped',
        graceful: true,
        shutdownTime: 2500,
        stoppedAt: new Date().toISOString()
      });

      const stopToolCall = {
        function: {
          name: 'stop_deployment',
          arguments: JSON.stringify({
            deploymentId: deploymentId,
            graceful: true,
            timeout: 10000
          })
        }
      };

      const stopResult = await stopTool.execute(stopToolCall.function.arguments ? JSON.parse(stopToolCall.function.arguments) : {});
      
      expect(stopResult.success).toBe(true);
      expect(stopResult.data.stop.graceful).toBe(true);
      expect(stopResult.data.stop.shutdownTime).toBe(2500);
    });
  });

  describe('Multi-Provider Scenarios', () => {
    test('should handle deployment migration from local to docker', async () => {
      const localDeploymentId = 'local-123';
      const dockerDeploymentId = 'docker-456';

      // Step 1: Deploy to local first
      mockDeploymentManager.deploy.mockResolvedValueOnce({
        success: true,
        id: localDeploymentId,
        name: 'test-app',
        provider: 'local',
        status: 'running',
        url: 'http://localhost:3000'
      });

      const localDeployCall = {
        function: {
          name: 'deploy_application',
          arguments: JSON.stringify({
            provider: 'local',
            config: {
              source: testAppDir,
              name: 'test-app'
            }
          })
        }
      };

      const localResult = await deployTool.execute(localDeployCall.function.arguments ? JSON.parse(localDeployCall.function.arguments) : {});
      expect(localResult.success).toBe(true);
      expect(localResult.data.deployment.provider).toBe('local');

      // Step 2: Deploy same app to Docker
      mockDeploymentManager.deploy.mockResolvedValueOnce({
        success: true,
        id: dockerDeploymentId,
        name: 'test-app-docker',
        provider: 'docker',
        status: 'running',
        url: 'http://localhost:8080'
      });

      const dockerDeployCall = {
        function: {
          name: 'deploy_application',
          arguments: JSON.stringify({
            provider: 'docker',
            config: {
              source: testAppDir,
              name: 'test-app-docker',
              port: 8080
            }
          })
        }
      };

      const dockerResult = await deployTool.execute(dockerDeployCall.function.arguments ? JSON.parse(dockerDeployCall.function.arguments) : {});
      expect(dockerResult.success).toBe(true);
      expect(dockerResult.data.deployment.provider).toBe('docker');

      // Step 3: List all deployments
      mockDeploymentManager.listDeployments.mockResolvedValue({
        success: true,
        deployments: [
          {
            id: localDeploymentId,
            name: 'test-app',
            provider: 'local',
            status: 'running'
          },
          {
            id: dockerDeploymentId,
            name: 'test-app-docker',
            provider: 'docker',
            status: 'running'
          }
        ]
      });

      const listAllCall = {
        function: {
          name: 'list_deployments',
          arguments: JSON.stringify({})
        }
      };

      const listResult = await listTool.execute(listAllCall.function.arguments ? JSON.parse(listAllCall.function.arguments) : {});
      expect(listResult.success).toBe(true);
      expect(listResult.data.deployments).toHaveLength(2);
      expect(listResult.data.deployments.map(d => d.provider)).toEqual(['local', 'docker']);

      // Step 4: Stop local deployment (migration complete)
      mockDeploymentManager.getDeployment.mockResolvedValue({
        id: localDeploymentId,
        provider: 'local',
        status: 'running'
      });

      mockDeploymentManager.stopDeployment.mockResolvedValue({
        success: true,
        id: localDeploymentId,
        status: 'stopped',
        graceful: true
      });

      const stopLocalCall = {
        function: {
          name: 'stop_deployment',
          arguments: JSON.stringify({
            deploymentId: localDeploymentId,
            graceful: true
          })
        }
      };

      const stopResult = await stopTool.execute(stopLocalCall.function.arguments ? JSON.parse(stopLocalCall.function.arguments) : {});
      expect(stopResult.success).toBe(true);
    });
  });

  describe('Error Scenarios', () => {
    test('should handle deployment failures gracefully', async () => {
      // Mock deployment failure
      mockDeploymentManager.deploy.mockResolvedValue({
        success: false,
        error: 'Port 3000 is already in use',
        details: {
          provider: 'local',
          port: 3000,
          conflict: true
        }
      });

      const failedDeployCall = {
        function: {
          name: 'deploy_application',
          arguments: JSON.stringify({
            provider: 'local',
            config: {
              source: testAppDir,
              name: 'conflicted-app',
              environment: { PORT: '3000' }
            }
          })
        }
      };

      const result = await deployTool.execute(failedDeployCall.function.arguments ? JSON.parse(failedDeployCall.function.arguments) : {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Port 3000 is already in use');
      expect(result.data.suggestions).toBeDefined();
      expect(Array.isArray(result.data.suggestions)).toBe(true);
    });

    test('should handle invalid deployment configurations', async () => {
      const invalidConfigCall = {
        function: {
          name: 'deploy_application',
          arguments: JSON.stringify({
            provider: 'invalid-provider',
            config: {
              source: '/nonexistent/path'
            }
          })
        }
      };

      const result = await deployTool.execute(invalidConfigCall.function.arguments ? JSON.parse(invalidConfigCall.function.arguments) : {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid provider');
    });

    test('should handle monitoring failures', async () => {
      const deploymentId = 'deploy-123';
      
      mockDeploymentManager.getDeployment.mockResolvedValue({
        id: deploymentId,
        provider: 'local',
        status: 'running'
      });

      mockMonitoringSystem.startMonitoring.mockRejectedValue(
        new Error('Failed to connect to deployment')
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

      const result = await monitorTool.execute(monitorCall.function.arguments ? JSON.parse(monitorCall.function.arguments) : {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to connect to deployment');
    });
  });

  describe('Performance and Concurrency', () => {
    test('should handle multiple concurrent tool operations', async () => {
      const deploymentIds = ['deploy-1', 'deploy-2', 'deploy-3'];
      
      // Setup mocks for multiple deployments
      mockDeploymentManager.getDeployment.mockImplementation((id) => {
        return Promise.resolve({
          id: id,
          provider: 'local',
          status: 'running'
        });
      });

      mockDeploymentManager.getDeploymentLogs.mockResolvedValue({
        success: true,
        logs: [{ timestamp: new Date().toISOString(), message: 'test log' }],
        totalLines: 1
      });

      // Create concurrent log requests
      const logCalls = deploymentIds.map(id => ({
        function: {
          name: 'get_deployment_logs',
          arguments: JSON.stringify({
            deploymentId: id,
            lines: 10
          })
        }
      }));

      // Execute all requests concurrently
      const results = await Promise.all(
        logCalls.map(call => logsTool.execute(call.function.arguments ? JSON.parse(call.function.arguments) : {}))
      );

      // All should succeed
      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      
      // Verify all deployments were queried
      expect(mockDeploymentManager.getDeployment).toHaveBeenCalledTimes(3);
      expect(mockDeploymentManager.getDeploymentLogs).toHaveBeenCalledTimes(3);
    });
  });
});