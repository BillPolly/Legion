import { jest } from '@jest/globals';
import path from 'path';
import fs from 'fs/promises';
import { tmpdir } from 'os';

// Mock all the complex dependencies that make integration testing difficult
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

// Import after mocking
const ConanTheDeployer = (await import('../../src/ConanTheDeployer.js')).default;

describe('Local Deployment Integration', () => {
  let deployer;
  let tempDir;
  let testAppDir;

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
    
    // Setup default successful responses
    mockDeploymentManager.deploy.mockResolvedValue({
      success: true,
      deployment: {
        id: 'deploy-123',
        name: 'test-app',
        provider: 'local',
        status: 'running',
        url: 'http://localhost:3000',
        pid: 12345,
        port: 3000
      }
    });
    
    mockDeploymentManager.getDeployment.mockResolvedValue({
      id: 'deploy-123',
      name: 'test-app',
      provider: 'local',
      status: 'running',
      url: 'http://localhost:3000'
    });
    
    mockDeploymentManager.listDeployments.mockResolvedValue({
      success: true,
      deployments: [{
        id: 'deploy-123',
        name: 'test-app',
        provider: 'local',
        status: 'running'
      }]
    });
    
    deployer = new ConanTheDeployer(mockResourceManager);
  });

  afterAll(async () => {
    // Cleanup temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error.message);
    }
  });

  describe('Complete Deployment Lifecycle', () => {
    test('should deploy, monitor, update, and stop a local application', async () => {
      // Step 1: Deploy application
      const deployConfig = {
        provider: 'local',
        source: testAppDir,
        environment: {
          NODE_ENV: 'production',
          PORT: '3000'
        },
        healthCheck: {
          path: '/health',
          interval: 5000
        }
      };

      const deployResult = await deployer.deploy(deployConfig);
      
      expect(deployResult.success).toBe(true);
      expect(deployResult.deployment.provider).toBe('local');
      expect(deployResult.deployment.status).toBe('running');
      expect(deployResult.deployment.url).toContain('localhost:3000');
      
      const deploymentId = deployResult.deployment.id;

      // Step 2: Monitor deployment
      const monitorResult = await deployer.monitor(deploymentId, {
        action: 'start',
        interval: 1000
      });
      
      expect(monitorResult.success).toBe(true);
      expect(monitorResult.monitoring.status).toBe('active');

      // Step 3: Get deployment status
      const statusResult = await deployer.getStatus(deploymentId);
      
      expect(statusResult.success).toBe(true);
      expect(statusResult.deployment.status).toBe('running');
      expect(statusResult.deployment.provider).toBe('local');

      // Step 4: Update deployment (environment variables)
      const updateResult = await deployer.update(deploymentId, {
        environment: {
          NODE_ENV: 'production',
          PORT: '3000',
          NEW_FEATURE: 'enabled'
        }
      }, {
        strategy: 'rolling',
        rollbackOnFailure: true
      });
      
      expect(updateResult.success).toBe(true);
      expect(updateResult.deployment.id).toBe(deploymentId);

      // Step 5: Get logs
      const logsResult = await deployer.getLogs(deploymentId, {
        lines: 50,
        format: 'structured'
      });
      
      expect(logsResult.success).toBe(true);
      expect(Array.isArray(logsResult.logs)).toBe(true);

      // Step 6: List deployments
      const listResult = await deployer.listDeployments({
        provider: 'local'
      });
      
      expect(listResult.success).toBe(true);
      expect(listResult.deployments.some(d => d.id === deploymentId)).toBe(true);

      // Step 7: Stop deployment
      const stopResult = await deployer.stop(deploymentId, {
        graceful: true,
        timeout: 10000
      });
      
      expect(stopResult.success).toBe(true);
      expect(stopResult.deployment.id).toBe(deploymentId);

      // Verify process was stopped
      expect(mockNodeProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    test('should handle deployment validation errors', async () => {
      const invalidConfig = {
        provider: 'local',
        source: '/nonexistent/path',
        environment: {}
      };

      const result = await deployer.deploy(invalidConfig);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Source path does not exist or is not accessible');
      expect(result.suggestions).toBeDefined();
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    test('should handle port conflicts gracefully', async () => {
      // Mock port already in use
      mockServer.listen.mockImplementation((port, callback) => {
        if (port === 3000) {
          const error = new Error('EADDRINUSE');
          error.code = 'EADDRINUSE';
          setTimeout(() => mockServer.on.mock.calls.find(call => call[0] === 'error')[1](error), 10);
        } else {
          setTimeout(() => callback && callback(), 10);
        }
        return mockServer;
      });

      const deployConfig = {
        provider: 'local',
        source: testAppDir,
        environment: { PORT: '3000' }
      };

      const result = await deployer.deploy(deployConfig);
      
      // Should automatically find next available port
      expect(result.success).toBe(true);
      expect(result.deployment.port).not.toBe(3000);
    });
  });

  describe('Error Recovery', () => {
    test('should recover from process crashes', async () => {
      const deployConfig = {
        provider: 'local',
        source: testAppDir,
        environment: { NODE_ENV: 'test' },
        restart: {
          enabled: true,
          maxRetries: 3,
          delay: 1000
        }
      };

      const deployResult = await deployer.deploy(deployConfig);
      expect(deployResult.success).toBe(true);
      
      const deploymentId = deployResult.deployment.id;

      // Simulate process crash
      const exitHandler = mockNodeProcess.on.mock.calls.find(call => call[0] === 'exit')[1];
      if (exitHandler) {
        exitHandler(1, 'SIGTERM'); // Exit with error code
      }

      // Should attempt restart
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check that spawn was called again for restart
      expect(mockChildProcess.spawn.mock.calls.length).toBeGreaterThan(1);
    });

    test('should handle missing dependencies', async () => {
      // Create app without package.json
      const invalidAppDir = path.join(tempDir, 'invalid-app');
      await fs.mkdir(invalidAppDir, { recursive: true });
      await fs.writeFile(path.join(invalidAppDir, 'server.js'), 'console.log("test");');

      const deployConfig = {
        provider: 'local',
        source: invalidAppDir,
        environment: {}
      };

      const result = await deployer.deploy(deployConfig);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('package.json not found');
    });
  });

  describe('Monitoring Integration', () => {
    test('should collect health check data', async () => {
      const deployConfig = {
        provider: 'local',
        source: testAppDir,
        environment: { PORT: '3000' },
        healthCheck: {
          path: '/health',
          interval: 1000,
          timeout: 5000
        }
      };

      const deployResult = await deployer.deploy(deployConfig);
      expect(deployResult.success).toBe(true);
      
      const deploymentId = deployResult.deployment.id;

      // Start monitoring
      await deployer.monitor(deploymentId, {
        action: 'start',
        healthChecks: true
      });

      // Wait for health checks to run
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get health metrics
      const healthResult = await deployer.monitor(deploymentId, {
        action: 'health'
      });
      
      expect(healthResult.success).toBe(true);
      expect(healthResult.health).toBeDefined();
    });

    test('should collect performance metrics', async () => {
      const deployConfig = {
        provider: 'local',
        source: testAppDir,
        environment: { PORT: '3000' }
      };

      const deployResult = await deployer.deploy(deployConfig);
      expect(deployResult.success).toBe(true);
      
      const deploymentId = deployResult.deployment.id;

      // Get metrics
      const metricsResult = await deployer.monitor(deploymentId, {
        action: 'metrics'
      });
      
      expect(metricsResult.success).toBe(true);
      expect(metricsResult.metrics).toBeDefined();
      expect(metricsResult.metrics.system).toBeDefined();
    });
  });
});