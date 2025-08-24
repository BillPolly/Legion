import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ResourceManager } from '@legion/tools-registry';
import RailwayDeployTool from '../../src/tools/RailwayDeployTool.js';

describe('RailwayDeployTool', () => {
  let tool;
  let resourceManager;
  let mockProvider;

  beforeEach(() => {
    mockProvider = {
      deployWithDomain: jest.fn()
    };

    resourceManager = ResourceManager.getInstance();
    resourceManager.register('railwayProvider', mockProvider);
    
    tool = new RailwayDeployTool(resourceManager);
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(tool.name).toBe('railway_deploy');
      expect(tool.description).toBe('Deploy an application to Railway from GitHub repository or Docker image');
      expect(tool.inputSchema).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should deploy GitHub repository successfully', async () => {
      const input = {
        projectName: 'test-project',
        source: {
          type: 'github',
          repository: 'user/repo',
          branch: 'main'
        },
        environmentVariables: {
          NODE_ENV: 'production'
        },
        serviceName: 'api'
      };

      mockProvider.deployWithDomain.mockResolvedValue({
        success: true,
        deploymentId: 'deploy123',
        projectId: 'proj123',
        serviceId: 'svc123',
        url: 'https://test.railway.app',
        status: 'running'
      });

      const result = await tool.execute(input);

      expect(mockProvider.deployWithDomain).toHaveBeenCalledWith({
        name: 'test-project',
        serviceName: 'api',
        environment: { NODE_ENV: 'production' },
        source: 'github',
        repo: 'user/repo',
        branch: 'main'
      });

      expect(result.deploymentId).toBe('deploy123');
      expect(result.projectId).toBe('proj123');
      expect(result.serviceId).toBe('svc123');
      expect(result.deploymentUrl).toBe('https://test.railway.app');
      expect(result.message).toBe('Successfully deployed test-project to Railway');
    });

    it('should deploy Docker image successfully', async () => {
      const input = {
        projectName: 'docker-app',
        source: {
          type: 'docker',
          repository: 'node:18-alpine'
        }
      };

      mockProvider.deployWithDomain.mockResolvedValue({
        success: true,
        deploymentId: 'deploy456',
        projectId: 'proj456',
        serviceId: 'svc456',
        status: 'building'
      });

      const result = await tool.execute(input);

      expect(mockProvider.deployWithDomain).toHaveBeenCalledWith({
        name: 'docker-app',
        serviceName: 'app',
        environment: {},
        image: 'node:18-alpine'
      });

      expect(result.deploymentId).toBe('deploy456');
      expect(result.deploymentUrl).toBe('Deployment deploy456 created');
    });

    it('should handle deployment failure', async () => {
      const input = {
        projectName: 'fail-project',
        source: {
          type: 'github',
          repository: 'user/repo'
        }
      };

      mockProvider.deployWithDomain.mockResolvedValue({
        success: false,
        error: 'Invalid repository'
      });

      await expect(tool.execute(input)).rejects.toThrow('Invalid repository');
    });

    it('should validate input schema', async () => {
      const invalidInput = {
        projectName: 'test',
        source: {
          type: 'invalid-type',
          repository: 'user/repo'
        }
      };

      await expect(tool.execute(invalidInput)).rejects.toThrow(/Invalid input/);
    });

    it('should throw error if provider not initialized', async () => {
      const rmWithoutProvider = ResourceManager.getInstance();
      const toolWithoutProvider = new RailwayDeployTool(rmWithoutProvider);

      await expect(toolWithoutProvider.execute({
        projectName: 'test',
        source: { type: 'github', repository: 'user/repo' }
      })).rejects.toThrow('Railway provider not initialized');
    });
  });
});