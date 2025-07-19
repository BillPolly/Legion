import { jest } from '@jest/globals';

// Mock dependencies before importing
const mockProcessManager = {
  start: jest.fn(),
  stop: jest.fn(),
  restart: jest.fn(),
  getStatus: jest.fn(),
  getLogs: jest.fn(),
  on: jest.fn()
};

const mockPortManager = {
  allocatePort: jest.fn(),
  releasePort: jest.fn(),
  isAllocated: jest.fn()
};

jest.unstable_mockModule('../../../src/utils/ProcessManager.js', () => ({
  default: jest.fn(() => mockProcessManager)
}));

jest.unstable_mockModule('../../../src/utils/PortManager.js', () => ({
  default: jest.fn(() => mockPortManager)
}));

jest.unstable_mockModule('fs/promises', () => {
  const mockFunctions = {
    access: jest.fn(),
    readFile: jest.fn()
  };
  return {
    ...mockFunctions,
    default: mockFunctions
  };
});

jest.unstable_mockModule('path', () => ({
  default: {
    join: jest.fn((...parts) => parts.join('/'))
  },
  join: jest.fn((...parts) => parts.join('/'))
}));

// Import after mocking
const LocalProvider = (await import('../../../src/providers/LocalProvider.js')).default;
const fs = await import('fs/promises');

describe('LocalProvider', () => {
  let provider;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    provider = new LocalProvider();
  });

  describe('Capabilities', () => {
    test('should return correct capabilities', () => {
      const capabilities = provider.getCapabilities();
      
      expect(capabilities).toEqual({
        supportsRollingUpdate: true,
        supportsBlueGreen: false,
        supportsHealthChecks: true,
        supportsMetrics: true,
        supportsCustomDomains: false
      });
    });
  });

  describe('Deploy', () => {
    test('should deploy a Node.js application', async () => {
      const config = {
        projectPath: '/test/app',
        name: 'test-app',
        env: { NODE_ENV: 'production' },
        port: 3000,
        startCommand: 'node server.js'
      };
      
      // Mock file system checks
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-app',
        scripts: { start: 'node server.js' }
      }));
      
      // Mock port allocation
      mockPortManager.allocatePort.mockResolvedValue(3000);
      
      // Mock process start
      mockProcessManager.start.mockResolvedValue({
        id: 'proc-123',
        pid: 12345,
        status: 'running',
        startTime: new Date()
      });
      
      const deployment = await provider.deploy(config);
      
      expect(deployment).toEqual({
        id: expect.stringMatching(/^local-/),
        name: 'test-app',
        projectPath: '/test/app',
        port: 3000,
        pid: 12345,
        processId: 'proc-123',
        status: 'running',
        url: 'http://localhost:3000',
        startTime: expect.any(Date),
        env: { NODE_ENV: 'production' },
        command: 'node server.js',
        healthCheckPath: '/health'
      });
      
      expect(mockPortManager.allocatePort).toHaveBeenCalledWith(3000);
      expect(mockProcessManager.start).toHaveBeenCalledWith({
        command: 'node server.js',
        cwd: '/test/app',
        env: expect.objectContaining({
          NODE_ENV: 'production',
          PORT: '3000'
        }),
        captureOutput: true
      });
    });

    test('should validate project path exists', async () => {
      const config = {
        projectPath: '/invalid/path',
        name: 'test-app'
      };
      
      fs.access.mockRejectedValue(new Error('ENOENT'));
      
      await expect(provider.deploy(config)).rejects.toThrow('Project path does not exist');
    });

    test('should validate package.json exists', async () => {
      const config = {
        projectPath: '/test/app',
        name: 'test-app'
      };
      
      fs.access.mockImplementation((path) => {
        if (path.endsWith('package.json')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.resolve();
      });
      
      await expect(provider.deploy(config)).rejects.toThrow('No package.json found');
    });

    test('should use npm start if no start command provided', async () => {
      const config = {
        projectPath: '/test/app',
        name: 'test-app'
      };
      
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-app',
        scripts: { start: 'node index.js' }
      }));
      
      mockPortManager.allocatePort.mockResolvedValue(3001);
      mockProcessManager.start.mockResolvedValue({
        id: 'proc-124',
        pid: 12346,
        status: 'running'
      });
      
      await provider.deploy(config);
      
      expect(mockProcessManager.start).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'npm start'
        })
      );
    });

    test('should handle deployment failure', async () => {
      const config = {
        projectPath: '/test/app',
        name: 'test-app'
      };
      
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify({ name: 'test-app' }));
      mockPortManager.allocatePort.mockResolvedValue(3000);
      mockProcessManager.start.mockRejectedValue(new Error('Failed to start process'));
      
      await expect(provider.deploy(config)).rejects.toThrow('Failed to start process');
      
      // Should release port on failure
      expect(mockPortManager.releasePort).toHaveBeenCalledWith(3000);
    });
  });

  describe('Update', () => {
    test('should update deployment with rolling strategy', async () => {
      const deploymentId = 'local-123';
      const config = {
        env: { NODE_ENV: 'staging' }
      };
      
      // Setup existing deployment
      provider.deployments.set(deploymentId, {
        id: deploymentId,
        processId: 'proc-123',
        port: 3000,
        projectPath: '/test/app',
        env: { NODE_ENV: 'production' }
      });
      
      mockProcessManager.restart.mockResolvedValue({
        id: 'proc-123',
        pid: 12347,
        status: 'running'
      });
      
      const result = await provider.update(deploymentId, config);
      
      expect(result).toEqual({
        success: true,
        deploymentId,
        strategy: 'rolling',
        previousConfig: expect.objectContaining({ env: { NODE_ENV: 'production' } }),
        newConfig: expect.objectContaining({ env: { NODE_ENV: 'staging' } })
      });
      
      expect(mockProcessManager.restart).toHaveBeenCalledWith('proc-123');
    });

    test('should throw error for non-existent deployment', async () => {
      await expect(provider.update('invalid-id', {}))
        .rejects.toThrow('Deployment not found');
    });
  });

  describe('Stop', () => {
    test('should stop deployment gracefully', async () => {
      const deploymentId = 'local-123';
      
      provider.deployments.set(deploymentId, {
        id: deploymentId,
        processId: 'proc-123',
        port: 3000,
        status: 'running'
      });
      
      mockProcessManager.stop.mockResolvedValue({
        exitCode: 0,
        signal: null
      });
      
      const result = await provider.stop(deploymentId);
      
      expect(result).toEqual({
        success: true,
        deploymentId,
        exitCode: 0,
        signal: null
      });
      
      expect(mockProcessManager.stop).toHaveBeenCalledWith('proc-123', { graceful: true });
      expect(mockPortManager.releasePort).toHaveBeenCalledWith(3000);
      
      const deployment = provider.deployments.get(deploymentId);
      expect(deployment.status).toBe('stopped');
    });
  });

  describe('Remove', () => {
    test('should remove deployment and clean up resources', async () => {
      const deploymentId = 'local-123';
      
      provider.deployments.set(deploymentId, {
        id: deploymentId,
        processId: 'proc-123',
        port: 3000,
        status: 'stopped'
      });
      
      const result = await provider.remove(deploymentId);
      
      expect(result).toEqual({
        success: true,
        deploymentId,
        cleanedResources: ['process', 'port']
      });
      
      expect(mockPortManager.releasePort).toHaveBeenCalledWith(3000);
      expect(provider.deployments.has(deploymentId)).toBe(false);
    });

    test('should stop running deployment before removal', async () => {
      const deploymentId = 'local-123';
      
      provider.deployments.set(deploymentId, {
        id: deploymentId,
        processId: 'proc-123',
        port: 3000,
        status: 'running'
      });
      
      mockProcessManager.stop.mockResolvedValue({ exitCode: 0 });
      
      await provider.remove(deploymentId);
      
      expect(mockProcessManager.stop).toHaveBeenCalledWith('proc-123', { graceful: true });
    });
  });

  describe('Monitoring', () => {
    test('should get deployment status', async () => {
      const deploymentId = 'local-123';
      
      provider.deployments.set(deploymentId, {
        id: deploymentId,
        processId: 'proc-123',
        status: 'running'
      });
      
      mockProcessManager.getStatus.mockReturnValue({
        status: 'running',
        uptime: 3600000,
        pid: 12345
      });
      
      const status = await provider.getStatus(deploymentId);
      
      expect(status).toEqual({
        deploymentId,
        status: 'running',
        uptime: 3600000,
        pid: 12345,
        health: { status: 'healthy' }
      });
    });

    test('should get deployment logs', async () => {
      const deploymentId = 'local-123';
      
      provider.deployments.set(deploymentId, {
        id: deploymentId,
        processId: 'proc-123'
      });
      
      mockProcessManager.getLogs.mockReturnValue({
        stdout: 'Server started\n',
        stderr: '',
        truncated: false
      });
      
      const logs = await provider.getLogs(deploymentId, { lines: 50 });
      
      expect(logs).toEqual({
        deploymentId,
        logs: [
          {
            timestamp: expect.any(Date),
            level: 'info',
            message: 'Server started',
            source: 'stdout'
          }
        ],
        hasMore: false
      });
    });

    test('should get deployment metrics', async () => {
      const deploymentId = 'local-123';
      
      provider.deployments.set(deploymentId, {
        id: deploymentId,
        processId: 'proc-123',
        port: 3000
      });
      
      mockProcessManager.getStatus.mockReturnValue({
        pid: 12345
      });
      
      // Mock process metrics (in real implementation would use systeminformation or similar)
      const metrics = await provider.getMetrics(deploymentId);
      
      expect(metrics).toEqual({
        deploymentId,
        timestamp: expect.any(Date),
        cpu: expect.objectContaining({
          usage: expect.any(Number)
        }),
        memory: expect.objectContaining({
          usage: expect.any(Number),
          limit: expect.any(Number)
        }),
        network: expect.objectContaining({
          rx: expect.any(Number),
          tx: expect.any(Number)
        })
      });
    });
  });

  describe('Health Checks', () => {
    test('should perform HTTP health check', async () => {
      const deploymentId = 'local-123';
      
      provider.deployments.set(deploymentId, {
        id: deploymentId,
        port: 3000,
        healthCheckPath: '/health',
        status: 'running'
      });
      
      // Mock successful health check
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200
      });
      
      const health = await provider.checkHealth(deploymentId);
      
      expect(health).toEqual({
        status: 'healthy',
        checks: [{
          name: 'http',
          status: 'healthy',
          responseTime: expect.any(Number)
        }]
      });
      
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/health', {
        signal: expect.any(AbortSignal)
      });
    });

    test('should handle health check failure', async () => {
      const deploymentId = 'local-123';
      
      provider.deployments.set(deploymentId, {
        id: deploymentId,
        port: 3000,
        healthCheckPath: '/health',
        status: 'running'
      });
      
      global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));
      
      const health = await provider.checkHealth(deploymentId);
      
      expect(health).toEqual({
        status: 'unhealthy',
        checks: [{
          name: 'http',
          status: 'unhealthy',
          error: 'Connection refused'
        }]
      });
    });
  });
});