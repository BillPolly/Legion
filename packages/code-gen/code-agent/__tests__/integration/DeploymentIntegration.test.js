/**
 * Integration tests for DeploymentIntegration
 */

import { jest } from '@jest/globals';
import { DeploymentIntegration } from '../../src/integration/DeploymentIntegration.js';

describe('DeploymentIntegration', () => {
  let deploymentIntegration;
  let mockModuleLoader;
  let mockResourceManager;
  let mockDeployerModule;

  beforeEach(() => {
    // Create mock deployer module
    mockDeployerModule = {
      deployApplication: jest.fn().mockResolvedValue({
        success: true,
        id: 'deploy-123',
        name: 'test-app',
        provider: 'local',
        url: 'http://localhost:3000',
        status: 'running',
        startTime: new Date()
      }),
      monitorDeployment: jest.fn().mockResolvedValue({
        health: { status: 'healthy' },
        metrics: { cpu: 10, memory: 100 }
      }),
      getDeploymentLogs: jest.fn().mockResolvedValue({
        success: true,
        logs: [
          { timestamp: new Date(), message: 'Starting app' },
          { timestamp: new Date(), message: 'Listening on port 3000' }
        ]
      }),
      listDeployments: jest.fn().mockResolvedValue({
        success: true,
        deployments: [
          { id: 'deploy-123', name: 'test-app', status: 'running' }
        ]
      }),
      stopDeployment: jest.fn().mockResolvedValue({ success: true }),
      removeDeployment: jest.fn().mockResolvedValue({ success: true }),
      updateDeployment: jest.fn().mockResolvedValue({ success: true }),
      listProviders: jest.fn().mockReturnValue(['local', 'docker', 'railway'])
    };

    // Create mock module loader
    mockModuleLoader = {
      loadModule: jest.fn().mockResolvedValue({
        success: true,
        module: mockDeployerModule
      }),
      initialize: jest.fn().mockResolvedValue(undefined)
    };

    // Create mock resource manager
    mockResourceManager = {
      register: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockReturnValue(null)
    };

    deploymentIntegration = new DeploymentIntegration(mockModuleLoader, mockResourceManager);
  });

  describe('initialize', () => {
    it('should load conan-the-deployer module', async () => {
      await deploymentIntegration.initialize();

      expect(deploymentIntegration.initialized).toBe(true);
      expect(mockModuleLoader.loadModule).toHaveBeenCalledWith(
        '@jsenvoy/conan-the-deployer',
        expect.objectContaining({
          name: '@jsenvoy/conan-the-deployer',
          defaultProvider: 'local'
        })
      );
    });

    it('should register environment resources', async () => {
      process.env.RAILWAY_API_TOKEN = 'test-token';
      
      await deploymentIntegration.initialize();

      expect(mockResourceManager.register).toHaveBeenCalledWith(
        'RAILWAY_API_TOKEN',
        expect.objectContaining({
          type: 'config',
          value: 'test-token'
        })
      );

      delete process.env.RAILWAY_API_TOKEN;
    });

    it('should handle module loading failure gracefully', async () => {
      mockModuleLoader.loadModule.mockResolvedValue({
        success: false,
        error: 'Module not found'
      });

      // Should try direct import as fallback
      await deploymentIntegration.initialize();
      
      // Even if both fail, it should throw a meaningful error
      expect(deploymentIntegration.initialized).toBe(true);
    });
  });

  describe('deploy', () => {
    beforeEach(async () => {
      await deploymentIntegration.initialize();
    });

    it('should deploy application successfully', async () => {
      const deploymentConfig = {
        projectPath: '/test/project',
        provider: 'local',
        name: 'my-app',
        config: { port: 3000 }
      };

      const result = await deploymentIntegration.deploy(deploymentConfig);

      expect(result.success).toBe(true);
      expect(result.id).toBe('deploy-123');
      expect(deploymentIntegration.activeDeployments.has('deploy-123')).toBe(true);
      
      const activeDeployment = deploymentIntegration.activeDeployments.get('deploy-123');
      expect(activeDeployment.name).toBe('my-app');
      expect(activeDeployment.provider).toBe('local');
    });

    it('should handle deployment failure', async () => {
      mockDeployerModule.deployApplication.mockResolvedValue({
        success: false,
        error: 'Port already in use'
      });

      const result = await deploymentIntegration.deploy({
        projectPath: '/test/project',
        provider: 'local',
        name: 'my-app'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Port already in use');
      expect(result.errorCode).toBe('DEPLOYMENT_FAILED');
    });
  });

  describe('monitor', () => {
    beforeEach(async () => {
      await deploymentIntegration.initialize();
    });

    it('should monitor deployment', async () => {
      const result = await deploymentIntegration.monitor({
        deploymentId: 'deploy-123',
        duration: 60000
      });

      expect(result.health.status).toBe('healthy');
      expect(result.metrics).toHaveProperty('cpu');
      expect(result.metrics).toHaveProperty('memory');
    });
  });

  describe('getLogs', () => {
    beforeEach(async () => {
      await deploymentIntegration.initialize();
    });

    it('should retrieve deployment logs', async () => {
      const result = await deploymentIntegration.getLogs({
        deploymentId: 'deploy-123',
        lines: 50
      });

      expect(result.success).toBe(true);
      expect(result.logs).toHaveLength(2);
      expect(result.logs[0]).toHaveProperty('message');
    });
  });

  describe('stop', () => {
    beforeEach(async () => {
      await deploymentIntegration.initialize();
      // Add a deployment to active deployments
      await deploymentIntegration.deploy({
        projectPath: '/test/project',
        provider: 'local',
        name: 'my-app'
      });
    });

    it('should stop deployment and update status', async () => {
      const result = await deploymentIntegration.stop({
        deploymentId: 'deploy-123'
      });

      expect(result.success).toBe(true);
      const deployment = deploymentIntegration.activeDeployments.get('deploy-123');
      expect(deployment.status).toBe('stopped');
      expect(deployment.stoppedAt).toBeInstanceOf(Date);
    });
  });

  describe('remove', () => {
    beforeEach(async () => {
      await deploymentIntegration.initialize();
      // Add a deployment to active deployments
      await deploymentIntegration.deploy({
        projectPath: '/test/project',
        provider: 'local',
        name: 'my-app'
      });
    });

    it('should remove deployment from active deployments', async () => {
      const result = await deploymentIntegration.remove({
        deploymentId: 'deploy-123'
      });

      expect(result.success).toBe(true);
      expect(deploymentIntegration.activeDeployments.has('deploy-123')).toBe(false);
    });
  });

  describe('getSupportedProviders', () => {
    beforeEach(async () => {
      await deploymentIntegration.initialize();
    });

    it('should return list of supported providers', async () => {
      const providers = await deploymentIntegration.getSupportedProviders();
      
      expect(providers).toEqual(['local', 'docker', 'railway']);
    });

    it('should return defaults if module method not available', async () => {
      mockDeployerModule.listProviders = undefined;
      
      const providers = await deploymentIntegration.getSupportedProviders();
      
      expect(providers).toEqual(['local', 'docker', 'railway']);
    });
  });

  describe('createDeploymentConfig', () => {
    it('should create config for local provider', () => {
      const config = deploymentIntegration.createDeploymentConfig({
        name: 'my-app',
        provider: 'local',
        port: 8080,
        startCommand: 'npm run dev'
      });

      expect(config.name).toBe('my-app');
      expect(config.provider).toBe('local');
      expect(config.config.port).toBe(8080);
      expect(config.config.startCommand).toBe('npm run dev');
    });

    it('should create config for docker provider', () => {
      const config = deploymentIntegration.createDeploymentConfig({
        name: 'my-app',
        provider: 'docker',
        dockerfile: './custom.dockerfile'
      });

      expect(config.provider).toBe('docker');
      expect(config.config.dockerfile).toBe('./custom.dockerfile');
    });

    it('should create config for railway provider', () => {
      const config = deploymentIntegration.createDeploymentConfig({
        name: 'my-app',
        provider: 'railway',
        railwayProjectId: 'proj-123'
      });

      expect(config.provider).toBe('railway');
      expect(config.config.projectId).toBe('proj-123');
      expect(config.config.environmentName).toBe('production');
    });
  });

  describe('validateRequirements', () => {
    beforeEach(async () => {
      await deploymentIntegration.initialize();
    });

    it('should validate provider availability', async () => {
      const result = await deploymentIntegration.validateRequirements({
        provider: 'unsupported'
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Provider 'unsupported' is not available");
    });

    it('should check railway API key', async () => {
      const result = await deploymentIntegration.validateRequirements({
        provider: 'railway'
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Railway API key not found in environment');
    });

    it('should add docker warning', async () => {
      const result = await deploymentIntegration.validateRequirements({
        provider: 'docker'
      });

      expect(result.warnings).toContain('Ensure Docker daemon is running');
    });
  });

  describe('getDeploymentRecommendations', () => {
    it('should recommend docker for frontend', () => {
      const rec = deploymentIntegration.getDeploymentRecommendations({
        type: 'frontend'
      });

      expect(rec.provider).toBe('docker');
      expect(rec.configuration.dockerfile).toBe('nginx-based');
      expect(rec.notes).toContain('Frontend apps work well with nginx Docker containers');
    });

    it('should recommend railway for backend', () => {
      const rec = deploymentIntegration.getDeploymentRecommendations({
        type: 'backend'
      });

      expect(rec.provider).toBe('railway');
      expect(rec.configuration.healthCheckPath).toBe('/health');
    });

    it('should recommend docker for fullstack', () => {
      const rec = deploymentIntegration.getDeploymentRecommendations({
        type: 'fullstack'
      });

      expect(rec.provider).toBe('docker');
      expect(rec.configuration.dockerfile).toBe('multi-stage');
    });
  });
});