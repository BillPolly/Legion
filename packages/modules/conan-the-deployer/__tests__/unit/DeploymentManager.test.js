import { jest } from '@jest/globals';

// Mock dependencies before importing
const mockLocalProvider = {
  deploy: jest.fn(),
  update: jest.fn(),
  stop: jest.fn(),
  remove: jest.fn(),
  getStatus: jest.fn(),
  getLogs: jest.fn(),
  getMetrics: jest.fn(),
  getCapabilities: jest.fn(() => ({
    supportsRollingUpdate: true,
    supportsBlueGreen: false,
    supportsHealthChecks: true,
    supportsMetrics: true,
    supportsCustomDomains: false
  }))
};

const mockDockerProvider = {
  deploy: jest.fn(),
  update: jest.fn(),
  stop: jest.fn(),
  remove: jest.fn(),
  getStatus: jest.fn(),
  getLogs: jest.fn(),
  getMetrics: jest.fn(),
  getCapabilities: jest.fn(() => ({
    supportsRollingUpdate: true,
    supportsBlueGreen: true,
    supportsHealthChecks: true,
    supportsMetrics: true,
    supportsCustomDomains: false
  }))
};

const mockRailwayProvider = {
  deploy: jest.fn(),
  update: jest.fn(),
  stop: jest.fn(),
  remove: jest.fn(),
  getStatus: jest.fn(),
  getLogs: jest.fn(),
  getMetrics: jest.fn(),
  getCapabilities: jest.fn(() => ({
    supportsRollingUpdate: false,
    supportsBlueGreen: false,
    supportsHealthChecks: true,
    supportsMetrics: true,
    supportsCustomDomains: true
  }))
};

const mockProviderFactory = {
  createProvider: jest.fn(),
  getAvailableProviders: jest.fn(() => ['local', 'docker', 'railway']),
  validateProviderConfig: jest.fn(() => true)
};

jest.unstable_mockModule('../../src/providers/LocalProvider.js', () => ({
  default: jest.fn(() => mockLocalProvider)
}));

jest.unstable_mockModule('../../src/providers/DockerProvider.js', () => ({
  default: jest.fn(() => mockDockerProvider)
}));

jest.unstable_mockModule('../../src/providers/RailwayProviderAdapter.js', () => ({
  default: jest.fn(() => mockRailwayProvider)
}));

jest.unstable_mockModule('../../src/providers/ProviderFactory.js', () => ({
  default: jest.fn(() => mockProviderFactory)
}));

jest.unstable_mockModule('../../src/models/DeploymentConfig.js', () => ({
  default: {
    validate: jest.fn((config) => ({ success: true, data: config }))
  }
}));

// Import after mocking
const DeploymentManager = (await import('../../src/DeploymentManager.js')).default;

describe('DeploymentManager', () => {
  let deploymentManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup provider factory mocks
    mockProviderFactory.createProvider.mockImplementation((type) => {
      switch (type) {
        case 'local': return mockLocalProvider;
        case 'docker': return mockDockerProvider;
        case 'railway': return mockRailwayProvider;
        default: throw new Error(`Unknown provider: ${type}`);
      }
    });
    
    deploymentManager = new DeploymentManager();
  });

  describe('Provider Management', () => {
    test('should initialize with available providers', () => {
      expect(mockProviderFactory.getAvailableProviders).toHaveBeenCalled();
      expect(deploymentManager.getAvailableProviders()).toEqual(['local', 'docker', 'railway']);
    });

    test('should create provider instances on demand', async () => {
      const provider = await deploymentManager.getProvider('local');
      
      expect(mockProviderFactory.createProvider).toHaveBeenCalledWith('local');
      expect(provider).toBe(mockLocalProvider);
    });

    test('should cache provider instances', async () => {
      const provider1 = await deploymentManager.getProvider('local');
      const provider2 = await deploymentManager.getProvider('local');
      
      expect(provider1).toBe(provider2);
      expect(mockProviderFactory.createProvider).toHaveBeenCalledTimes(1);
    });

    test('should throw error for unknown provider', async () => {
      mockProviderFactory.createProvider.mockImplementation(() => {
        throw new Error('Unknown provider: unknown');
      });

      await expect(deploymentManager.getProvider('unknown'))
        .rejects.toThrow('Unknown provider: unknown');
    });
  });

  describe('Deployment Queue', () => {
    test('should queue deployments and process them sequentially', async () => {
      const config1 = { name: 'app1', provider: 'local', projectPath: '/app1' };
      const config2 = { name: 'app2', provider: 'local', projectPath: '/app2' };

      mockLocalProvider.deploy
        .mockResolvedValueOnce({ id: 'deploy-1', status: 'running' })
        .mockResolvedValueOnce({ id: 'deploy-2', status: 'running' });

      const [result1, result2] = await Promise.all([
        deploymentManager.deploy(config1),
        deploymentManager.deploy(config2)
      ]);

      expect(result1.id).toBe('deploy-1');
      expect(result2.id).toBe('deploy-2');
      expect(mockLocalProvider.deploy).toHaveBeenCalledTimes(2);
    });

    test('should handle deployment failures in queue', async () => {
      // Disable retries for this test
      deploymentManager.setRetryConfig({ maxRetries: 0 });

      const config1 = { name: 'app1', provider: 'local', projectPath: '/app1' };
      const config2 = { name: 'app2', provider: 'local', projectPath: '/app2' };

      mockLocalProvider.deploy
        .mockRejectedValueOnce(new Error('Deployment failed'))
        .mockResolvedValueOnce({ id: 'deploy-2', status: 'running', name: 'app2' });

      const results = await Promise.allSettled([
        deploymentManager.deploy(config1),
        deploymentManager.deploy(config2)
      ]);

      expect(results[0].status).toBe('rejected');
      expect(results[0].reason.message).toBe('Deployment failed');
      expect(results[1].status).toBe('fulfilled');
      expect(results[1].value.id).toBe('deploy-2');
    });

    test('should track deployment queue status', () => {
      const status = deploymentManager.getQueueStatus();
      
      expect(status).toEqual({
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0
      });
    });
  });

  describe('Provider Selection', () => {
    test('should select provider based on config', async () => {
      const config = { name: 'app1', provider: 'docker', projectPath: '/app1' };
      
      mockDockerProvider.deploy.mockResolvedValue({ id: 'deploy-1', status: 'running' });

      await deploymentManager.deploy(config);

      expect(mockProviderFactory.createProvider).toHaveBeenCalledWith('docker');
      expect(mockDockerProvider.deploy).toHaveBeenCalledWith(config);
    });

    test('should auto-select best provider when not specified', async () => {
      const config = { name: 'app1', projectPath: '/app1' };
      
      mockLocalProvider.deploy.mockResolvedValue({ id: 'deploy-1', status: 'running' });

      await deploymentManager.deploy(config);

      expect(mockProviderFactory.createProvider).toHaveBeenCalledWith('local');
      expect(mockLocalProvider.deploy).toHaveBeenCalledWith(expect.objectContaining({
        ...config,
        provider: 'local'
      }));
    });

    test('should consider provider capabilities for auto-selection', async () => {
      const config = { 
        name: 'app1', 
        projectPath: '/app1', 
        requirements: { supportsBlueGreen: true } 
      };
      
      mockDockerProvider.deploy.mockResolvedValue({ id: 'deploy-1', status: 'running' });

      await deploymentManager.deploy(config);

      expect(mockProviderFactory.createProvider).toHaveBeenCalledWith('docker');
      expect(mockDockerProvider.deploy).toHaveBeenCalled();
    });
  });

  describe('Deployment State Machine', () => {
    test('should track deployment states', async () => {
      const config = { name: 'app1', provider: 'local', projectPath: '/app1' };
      
      mockLocalProvider.deploy.mockResolvedValue({ 
        id: 'deploy-1', 
        status: 'running',
        name: 'app1'
      });

      const deployment = await deploymentManager.deploy(config);
      
      expect(deploymentManager.getDeployment('deploy-1')).toEqual({
        id: 'deploy-1',
        status: 'running',
        name: 'app1',
        provider: 'local',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });
    });

    test('should update deployment state on operations', async () => {
      const config = { name: 'app1', provider: 'local', projectPath: '/app1' };
      
      mockLocalProvider.deploy.mockResolvedValue({ 
        id: 'deploy-1', 
        status: 'running',
        name: 'app1'
      });
      
      mockLocalProvider.stop.mockResolvedValue({ 
        success: true,
        deploymentId: 'deploy-1'
      });

      await deploymentManager.deploy(config);
      await deploymentManager.stop('deploy-1');

      const deployment = deploymentManager.getDeployment('deploy-1');
      expect(deployment.status).toBe('stopped');
      expect(deployment.updatedAt).toBeInstanceOf(Date);
    });

    test('should list deployments with filtering', async () => {
      const config1 = { name: 'app1', provider: 'local', projectPath: '/app1' };
      const config2 = { name: 'app2', provider: 'docker', projectPath: '/app2' };
      
      mockLocalProvider.deploy.mockResolvedValue({ 
        id: 'deploy-1', 
        status: 'running',
        name: 'app1'
      });
      
      mockDockerProvider.deploy.mockResolvedValue({ 
        id: 'deploy-2', 
        status: 'running',
        name: 'app2'
      });

      await deploymentManager.deploy(config1);
      await deploymentManager.deploy(config2);

      const allDeployments = deploymentManager.listDeployments();
      expect(allDeployments).toHaveLength(2);

      const localDeployments = deploymentManager.listDeployments({ provider: 'local' });
      expect(localDeployments).toHaveLength(1);
      expect(localDeployments[0].name).toBe('app1');

      const runningDeployments = deploymentManager.listDeployments({ status: 'running' });
      expect(runningDeployments).toHaveLength(2);
    });
  });

  describe('Concurrent Deployment Handling', () => {
    test('should handle multiple deployments concurrently', async () => {
      const configs = [
        { name: 'app1', provider: 'local', projectPath: '/app1' },
        { name: 'app2', provider: 'local', projectPath: '/app2' },
        { name: 'app3', provider: 'docker', projectPath: '/app3' }
      ];

      mockLocalProvider.deploy
        .mockResolvedValueOnce({ id: 'deploy-1', status: 'running', name: 'app1' })
        .mockResolvedValueOnce({ id: 'deploy-2', status: 'running', name: 'app2' });
      
      mockDockerProvider.deploy
        .mockResolvedValueOnce({ id: 'deploy-3', status: 'running', name: 'app3' });

      const deployments = await Promise.all(
        configs.map(config => deploymentManager.deploy(config))
      );

      expect(deployments).toHaveLength(3);
      expect(deployments.map(d => d.id)).toEqual(['deploy-1', 'deploy-2', 'deploy-3']);
      expect(deploymentManager.listDeployments()).toHaveLength(3);
    });

    test('should limit concurrent deployments per provider', async () => {
      deploymentManager.setProviderConcurrencyLimit('local', 1);

      const configs = [
        { name: 'app1', provider: 'local', projectPath: '/app1' },
        { name: 'app2', provider: 'local', projectPath: '/app2' }
      ];

      let resolveFirst;
      const firstDeployment = new Promise(resolve => { resolveFirst = resolve; });

      mockLocalProvider.deploy
        .mockImplementationOnce(() => firstDeployment)
        .mockResolvedValueOnce({ id: 'deploy-2', status: 'running', name: 'app2' });

      const deployPromise1 = deploymentManager.deploy(configs[0]);
      const deployPromise2 = deploymentManager.deploy(configs[1]);

      // Second deployment should wait for first to complete
      expect(deploymentManager.getQueueStatus().processing).toBe(1);
      expect(deploymentManager.getQueueStatus().pending).toBe(1);

      resolveFirst({ id: 'deploy-1', status: 'running', name: 'app1' });

      await Promise.all([deployPromise1, deployPromise2]);
      
      expect(mockLocalProvider.deploy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle provider errors gracefully', async () => {
      // Reset retry config for this test
      deploymentManager.setRetryConfig({ maxRetries: 0 });
      
      const config = { name: 'app1', provider: 'local', projectPath: '/app1' };
      
      mockLocalProvider.deploy.mockRejectedValue(new Error('Provider error'));

      await expect(deploymentManager.deploy(config))
        .rejects.toThrow('Provider error');

      const deployment = deploymentManager.getDeployment('app1');
      expect(deployment?.status).toBe('failed');
    });

    test('should retry failed deployments with exponential backoff', async () => {
      deploymentManager.setRetryConfig({ maxRetries: 2, initialDelay: 10 });

      const config = { name: 'app1', provider: 'local', projectPath: '/app1' };
      
      mockLocalProvider.deploy
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({ id: 'deploy-1', status: 'running', name: 'app1' });

      const deployment = await deploymentManager.deploy(config);

      expect(deployment.id).toBe('deploy-1');
      expect(mockLocalProvider.deploy).toHaveBeenCalledTimes(3);
    });

    test('should fail after max retries exceeded', async () => {
      deploymentManager.setRetryConfig({ maxRetries: 1, initialDelay: 10 });

      const config = { name: 'app1', provider: 'local', projectPath: '/app1' };
      
      mockLocalProvider.deploy.mockRejectedValue(new Error('Persistent error'));

      await expect(deploymentManager.deploy(config))
        .rejects.toThrow('Persistent error');

      expect(mockLocalProvider.deploy).toHaveBeenCalledTimes(2);
    });
  });
});