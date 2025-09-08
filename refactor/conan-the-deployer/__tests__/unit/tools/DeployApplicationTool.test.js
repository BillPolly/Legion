import { jest } from '@jest/globals';

// Mock dependencies
const mockDeploymentManager = {
  deploy: jest.fn(),
  getProvider: jest.fn()
};

const mockResourceManager = {
  get: jest.fn(),
  initialize: jest.fn(),
  register: jest.fn()
};

// Mock the ResourceManager class with getInstance static method
const MockResourceManager = jest.fn(() => mockResourceManager);
MockResourceManager.getInstance = jest.fn(async () => mockResourceManager);

jest.unstable_mockModule('../../../src/DeploymentManager.js', () => ({
  default: jest.fn(() => mockDeploymentManager)
}));

jest.unstable_mockModule('@legion/resource-manager', () => ({
  ResourceManager: MockResourceManager,
  default: MockResourceManager
}));

// Import after mocking
const DeployApplicationTool = (await import('../../../src/tools/DeployApplicationTool.js')).default;

describe('DeployApplicationTool', () => {
  let deployTool;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup resource manager
    mockResourceManager.get.mockImplementation((key) => {
      if (key === 'deployment-manager') {
        return mockDeploymentManager;
      }
      return null;
    });

    deployTool = new DeployApplicationTool();
  });

  describe('Tool Configuration', () => {
    test('should have correct tool name and description', () => {
      expect(deployTool.name).toBe('deploy_application');
      expect(deployTool.description).toContain('Deploy applications to various providers');
    });

    test('should declare correct tool description schema', () => {
      const description = deployTool.getToolDescription();
      
      expect(description.function.name).toBe('deploy_application');
      expect(description.function.parameters.type).toBe('object');
      expect(description.function.parameters.properties).toHaveProperty('provider');
      expect(description.function.parameters.properties).toHaveProperty('config');
      expect(description.function.parameters.required).toContain('provider');
      expect(description.function.parameters.required).toContain('config');
    });
  });

  describe('Parameter Validation', () => {
    test('should validate required parameters', async () => {
      const args = {
            // is requireds
          };
      const result = await deployTool.execute(args);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('provider and config are required');
    });

    test('should validate provider parameter', async () => {
      const args = {
            provider: 'invalid-provider',
            config: { name: 'test-app' }
          };
      const result = await deployTool.execute(args);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid provider');
    });

    test('should validate config parameter structure', async () => {
      const args = {
            provider: 'local',
            config: 'invalid-config' // Should be object
          };
      const result = await deployTool.execute(args);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Config must be an object');
    });
  });

  describe('Provider Routing', () => {
    test('should route to local provider successfully', async () => {
      const mockDeployment = {
        success: true,
        id: 'deploy-123',
        provider: 'local',
        status: 'running',
        url: 'http://localhost:3000'
      };

      mockDeploymentManager.deploy.mockResolvedValue(mockDeployment);

      const args = {
            provider: 'local',
            config: {
              name: 'test-app',
              command: 'npm start',
              port: 3000
            }
          };
      const result = await deployTool.execute(args);
      
      expect(result.success).toBe(true);
      expect(result.data.deployment.id).toBe('deploy-123');
      expect(result.data.deployment.provider).toBe('local');
      expect(result.data.deployment.url).toBe('http://localhost:3000');
      
      expect(mockDeploymentManager.deploy).toHaveBeenCalledWith('local', {
        name: 'test-app',
        command: 'npm start',
        port: 3000
      });
    });

    test('should route to docker provider successfully', async () => {
      const mockDeployment = {
        success: true,
        id: 'container-456',
        provider: 'docker',
        status: 'running',
        url: 'http://localhost:8080'
      };

      mockDeploymentManager.deploy.mockResolvedValue(mockDeployment);

      const args = {
            provider: 'docker',
            config: {
              name: 'test-container',
              image: 'node:18',
              port: 8080,
              environment: { NODE_ENV: 'production' }
            }
          };
      const result = await deployTool.execute(args);
      
      expect(result.success).toBe(true);
      expect(result.data.deployment.id).toBe('container-456');
      expect(result.data.deployment.provider).toBe('docker');
      
      expect(mockDeploymentManager.deploy).toHaveBeenCalledWith('docker', {
        name: 'test-container',
        image: 'node:18',
        port: 8080,
        environment: { NODE_ENV: 'production' }
      });
    });

    test('should route to railway provider successfully', async () => {
      const mockDeployment = {
        success: true,
        id: 'railway-789',
        provider: 'railway',
        status: 'building',
        url: 'https://test-app-production.up.railway.app'
      };

      mockDeploymentManager.deploy.mockResolvedValue(mockDeployment);

      const args = {
            provider: 'railway',
            config: {
              name: 'test-app',
              source: 'github',
              repo: 'user/test-repo',
              branch: 'main'
            }
          };
      const result = await deployTool.execute(args);
      
      expect(result.success).toBe(true);
      expect(result.data.deployment.id).toBe('railway-789');
      expect(result.data.deployment.provider).toBe('railway');
      expect(result.data.deployment.url).toBe('https://test-app-production.up.railway.app');
    });
  });

  describe('Response Formatting', () => {
    test('should format successful deployment response correctly', async () => {
      const mockDeployment = {
        success: true,
        id: 'deploy-123',
        provider: 'local',
        status: 'running',
        url: 'http://localhost:3000',
        createdAt: new Date('2024-01-01T10:00:00Z')
      };

      mockDeploymentManager.deploy.mockResolvedValue(mockDeployment);

      const args = {
            provider: 'local',
            config: { name: 'test-app', command: 'npm start' }
          };
      const result = await deployTool.execute(args);
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('deployment');
      expect(result.data).toHaveProperty('summary');
      expect(result.data).toHaveProperty('nextSteps');
      
      expect(result.data.deployment.id).toBe('deploy-123');
      expect(result.data.deployment.provider).toBe('local');
      expect(result.data.deployment.status).toBe('running');
      expect(result.data.summary).toContain('Successfully deployed');
      expect(result.data.nextSteps).toBeInstanceOf(Array);
    });

    test('should format deployment failure response correctly', async () => {
      const mockFailure = {
        success: false,
        error: 'Port 3000 is already in use',
        details: { port: 3000, provider: 'local' }
      };

      mockDeploymentManager.deploy.mockResolvedValue(mockFailure);

      const args = {
            provider: 'local',
            config: { name: 'test-app', command: 'npm start', port: 3000 }
          };
      const result = await deployTool.execute(args);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Port 3000 is already in use');
      expect(result.data.provider).toBe('local');
      expect(result.data.suggestions).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle deployment manager errors', async () => {
      mockDeploymentManager.deploy.mockRejectedValue(new Error('Deployment manager crashed'));

      const args = {
            provider: 'local',
            config: { name: 'test-app' }
          };
      const result = await deployTool.execute(args);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Deployment manager crashed');
    });

    test('should handle invalid JSON arguments', async () => {
      // Test with invalid arguments structure
      const args = {
        provider: null, // invalid provider
        config: {}
      };

      const result = await deployTool.execute(args);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('provider and config are required');
    });

    test('should handle missing deployment manager', async () => {
      mockResourceManager.get.mockReturnValue(null);

      const args = {
            provider: 'local',
            config: { name: 'test-app' }
          };
      const result = await deployTool.execute(args);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Deployment manager crashed');
    });
  });

  describe('Provider Capabilities', () => {
    test('should provide helpful error for unsupported provider features', async () => {
      const mockFailure = {
        success: false,
        error: 'Provider does not support custom domains',
        capabilities: { customDomains: false }
      };

      mockDeploymentManager.deploy.mockResolvedValue(mockFailure);

      const args = {
            provider: 'local',
            config: {
              name: 'test-app',
              customDomain: 'example.com'
            }
          };
      const result = await deployTool.execute(args);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not support custom domains');
      expect(result.data.suggestions).toContain('Use Docker or Railway provider for custom domain support');
    });
  });

  describe('Configuration Examples', () => {
    test('should provide configuration examples in error responses', async () => {
      const args = {
            provider: 'invalid-provider',
            config: {}
          };
      const result = await deployTool.execute(args);
      
      expect(result.success).toBe(false);
      expect(result.data.examples).toHaveProperty('local');
      expect(result.data.examples).toHaveProperty('docker');
      expect(result.data.examples).toHaveProperty('railway');
    });
  });
});