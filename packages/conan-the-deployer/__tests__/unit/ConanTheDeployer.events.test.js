import { jest } from '@jest/globals';
import ConanTheDeployer from '../../src/ConanTheDeployer.js';
import { DeploymentStatus } from '../../src/models/DeploymentStatus.js';

describe('ConanTheDeployer Events', () => {
  let deployer;
  let mockResourceManager;
  let eventHandlers;

  beforeEach(() => {
    mockResourceManager = {
      get: jest.fn((key) => {
        if (key === 'RAILWAY_API_TOKEN') return 'test-railway-token';
        if (key === 'DOCKER_HOST') return 'unix:///var/run/docker.sock';
        return null;
      })
    };
    
    eventHandlers = {
      info: jest.fn(),
      error: jest.fn(),
      progress: jest.fn()
    };
    
    deployer = new ConanTheDeployer({}, mockResourceManager);
    
    // Attach event handlers
    deployer.on('info', eventHandlers.info);
    deployer.on('error', eventHandlers.error);
    deployer.on('progress', eventHandlers.progress);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Deployment Events', () => {
    test('should emit deployment started event', async () => {
      await deployer.deployApplication({
        projectPath: '/test/path',
        provider: 'local',
        name: 'test-app'
      });

      expect(eventHandlers.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          message: 'Deployment started',
          data: {
            name: 'test-app',
            provider: 'local',
            projectPath: '/test/path'
          }
        })
      );
    });

    test('should emit deployment completed event', async () => {
      const deployment = await deployer.deployApplication({
        projectPath: '/test/path',
        provider: 'local',
        name: 'test-app'
      });

      expect(eventHandlers.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          message: 'Deployment completed',
          data: expect.objectContaining({
            deploymentId: expect.stringMatching(/^deployment-/),
            name: 'test-app',
            status: 'running'
          })
        })
      );
    });

    test('should emit deployment failed event', async () => {
      // Mock deployment failure
      deployer.deploymentManager.deploy = jest.fn().mockRejectedValue(new Error('Deployment failed'));

      await expect(deployer.deployApplication({
        projectPath: '/test/path',
        provider: 'local',
        name: 'test-app'
      })).rejects.toThrow('Deployment failed');

      expect(eventHandlers.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: 'Deployment failed',
          data: {
            name: 'test-app',
            provider: 'local',
            error: 'Deployment failed'
          }
        })
      );
    });
  });

  describe('Update Events', () => {
    test('should emit deployment updated event', async () => {
      await deployer.updateDeployment({
        deploymentId: 'dep-123',
        projectPath: '/test/path',
        strategy: 'rolling'
      });

      expect(eventHandlers.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          message: 'Deployment updated',
          data: {
            deploymentId: 'dep-123',
            strategy: 'rolling',
            newVersion: 'v2'
          }
        })
      );
    });

    test('should emit update failed event', async () => {
      deployer.deploymentManager.update = jest.fn().mockRejectedValue(new Error('Update failed'));

      await expect(deployer.updateDeployment({
        deploymentId: 'dep-123',
        projectPath: '/test/path'
      })).rejects.toThrow('Update failed');

      expect(eventHandlers.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: 'Update failed',
          data: {
            deploymentId: 'dep-123',
            error: 'Update failed'
          }
        })
      );
    });
  });

  describe('Stop Events', () => {
    test('should emit deployment stopped event', async () => {
      await deployer.stopDeployment({
        deploymentId: 'dep-123',
        graceful: true
      });

      expect(eventHandlers.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          message: 'Deployment stopped',
          data: {
            deploymentId: 'dep-123',
            graceful: true
          }
        })
      );
    });

    test('should emit stop failed event', async () => {
      deployer.deploymentManager.stop = jest.fn().mockRejectedValue(new Error('Stop failed'));

      await expect(deployer.stopDeployment({
        deploymentId: 'dep-123'
      })).rejects.toThrow('Stop failed');

      expect(eventHandlers.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: 'Failed to stop deployment',
          data: {
            deploymentId: 'dep-123',
            error: 'Stop failed'
          }
        })
      );
    });
  });

  describe('Remove Events', () => {
    test('should emit deployment removed event', async () => {
      await deployer.removeDeployment({
        deploymentId: 'dep-123',
        cleanup: true
      });

      expect(eventHandlers.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          message: 'Deployment removed',
          data: {
            deploymentId: 'dep-123',
            cleanedResources: []
          }
        })
      );
    });

    test('should emit remove failed event', async () => {
      deployer.deploymentManager.remove = jest.fn().mockRejectedValue(new Error('Remove failed'));

      await expect(deployer.removeDeployment({
        deploymentId: 'dep-123'
      })).rejects.toThrow('Remove failed');

      expect(eventHandlers.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: 'Failed to remove deployment',
          data: {
            deploymentId: 'dep-123',
            error: 'Remove failed'
          }
        })
      );
    });
  });

  describe('Monitoring Events', () => {
    test('should emit monitoring failed event', async () => {
      deployer.monitoringSystem.monitor = jest.fn().mockRejectedValue(new Error('Monitoring failed'));

      await expect(deployer.monitorDeployment({
        deploymentId: 'dep-123'
      })).rejects.toThrow('Monitoring failed');

      expect(eventHandlers.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: 'Monitoring failed',
          data: {
            deploymentId: 'dep-123',
            error: 'Monitoring failed'
          }
        })
      );
    });
  });

  describe('List Events', () => {
    test('should emit list failed event', async () => {
      deployer.deploymentManager.list = jest.fn().mockRejectedValue(new Error('List failed'));

      await expect(deployer.listDeployments()).rejects.toThrow('List failed');

      expect(eventHandlers.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: 'Failed to list deployments',
          data: {
            error: 'List failed'
          }
        })
      );
    });
  });

  describe('Logs Events', () => {
    test('should emit get logs failed event', async () => {
      deployer.deploymentManager.getLogs = jest.fn().mockRejectedValue(new Error('Get logs failed'));

      await expect(deployer.getDeploymentLogs({
        deploymentId: 'dep-123'
      })).rejects.toThrow('Get logs failed');

      expect(eventHandlers.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: 'Failed to get logs',
          data: {
            deploymentId: 'dep-123',
            error: 'Get logs failed'
          }
        })
      );
    });
  });
});