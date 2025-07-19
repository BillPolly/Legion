import { jest } from '@jest/globals';

// Mock ResourceManager
const mockResourceManager = {
  get: jest.fn()
};

// Mock fetch for Railway API calls
global.fetch = jest.fn();

jest.unstable_mockModule('../../../src/core/ResourceManager.js', () => ({
  default: jest.fn(() => mockResourceManager)
}));

// Import after mocking
const RailwayProvider = (await import('../../../src/providers/RailwayProvider.js')).default;

describe('RailwayProvider', () => {
  let railwayProvider;
  const mockApiKey = '698a1371-00ad-40ff-a4ea-74ebefb4077a';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup resource manager to return Railway API key
    mockResourceManager.get.mockImplementation((key) => {
      if (key === 'railway-api-key') {
        return mockApiKey;
      }
      return null;
    });

    railwayProvider = new RailwayProvider(mockResourceManager);
  });

  describe('Provider Capabilities', () => {
    test('should declare correct capabilities', () => {
      const capabilities = railwayProvider.getCapabilities();
      
      expect(capabilities.name).toBe('railway');
      expect(capabilities.supports.hosting).toBe(true);
      expect(capabilities.supports.customDomains).toBe(true);
      expect(capabilities.supports.ssl).toBe(true);
      expect(capabilities.supports.scaling).toBe(true);
      expect(capabilities.supports.databases).toBe(true);
    });

    test('should validate deployment configuration', () => {
      const validConfig = {
        name: 'test-app',
        source: 'github',
        repo: 'user/repo',
        branch: 'main'
      };

      const result = railwayProvider.validateConfig(validConfig);
      expect(result.valid).toBe(true);
    });

    test('should reject invalid configuration', () => {
      const invalidConfig = {
        name: 'test-app'
        // Missing required source configuration
      };

      const result = railwayProvider.validateConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Source configuration is required');
    });
  });

  describe('Project Management', () => {
    test('should create new project', async () => {
      const mockResponse = {
        data: {
          projectCreate: {
            id: 'proj-123',
            name: 'test-app',
            createdAt: '2024-01-01T10:00:00Z'
          }
        }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await railwayProvider.createProject({
        name: 'test-app',
        description: 'Test application'
      });

      expect(result.success).toBe(true);
      expect(result.project.id).toBe('proj-123');
      expect(result.project.name).toBe('test-app');
    });

    test('should handle project creation failure', async () => {
      const mockResponse = {
        errors: [
          { message: 'Project name already exists' }
        ]
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await railwayProvider.createProject({
        name: 'test-app'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Project name already exists');
    });

    test('should list existing projects', async () => {
      const mockResponse = {
        data: {
          projects: {
            edges: [
              {
                node: {
                  id: 'proj-123',
                  name: 'test-app-1',
                  createdAt: '2024-01-01T10:00:00Z',
                  services: {
                    edges: []
                  }
                }
              },
              {
                node: {
                  id: 'proj-456',
                  name: 'test-app-2',
                  createdAt: '2024-01-02T10:00:00Z',
                  services: {
                    edges: []
                  }
                }
              }
            ]
          }
        }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await railwayProvider.listProjects();

      expect(result.success).toBe(true);
      expect(result.projects).toHaveLength(2);
      expect(result.projects[0].name).toBe('test-app-1');
    });
  });

  describe('Service Deployment', () => {
    test('should deploy service from GitHub', async () => {
      // Mock project creation
      const projectResponse = {
        data: {
          projectCreate: {
            id: 'proj-123',
            name: 'test-app'
          }
        }
      };

      // Mock service creation
      const serviceResponse = {
        data: {
          serviceCreate: {
            id: 'srv-456',
            name: 'test-service'
          }
        }
      };

      // Mock environment variables response
      const envResponse = {
        data: {
          variableCollectionUpsert: {
            id: 'var-collection-123'
          }
        }
      };

      // Mock deployment creation
      const deploymentResponse = {
        data: {
          serviceInstanceDeploy: {
            id: 'dep-789',
            status: 'BUILDING',
            url: 'https://test-app-production.up.railway.app'
          }
        }
      };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(projectResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(serviceResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(envResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(deploymentResponse)
        });

      const config = {
        name: 'test-app',
        source: 'github',
        repo: 'user/test-repo',
        branch: 'main',
        environment: {
          NODE_ENV: 'production',
          PORT: '3000'
        }
      };

      const result = await railwayProvider.deploy(config);

      expect(result.success).toBe(true);
      expect(result.projectId).toBe('proj-123');
      expect(result.serviceId).toBe('srv-456');
      expect(result.deploymentId).toBe('dep-789');
      expect(result.url).toBe('https://test-app-production.up.railway.app');
      expect(result.status).toBe('building');
    });

    test('should deploy from local source', async () => {
      const projectResponse = {
        data: {
          projectCreate: {
            id: 'proj-123',
            name: 'test-app'
          }
        }
      };

      const serviceResponse = {
        data: {
          serviceCreate: {
            id: 'srv-456',
            name: 'test-service'
          }
        }
      };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(projectResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(serviceResponse)
        });

      const config = {
        name: 'test-app',
        source: 'local',
        projectPath: '/path/to/project'
      };

      const result = await railwayProvider.deploy(config);

      expect(result.success).toBe(true);
      expect(result.projectId).toBe('proj-123');
      expect(result.serviceId).toBe('srv-456');
    });

    test('should handle deployment failure', async () => {
      const errorResponse = {
        errors: [
          { message: 'Repository not found' }
        ]
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(errorResponse)
      });

      const config = {
        name: 'test-app',
        source: 'github',
        repo: 'user/nonexistent-repo',
        branch: 'main'
      };

      const result = await railwayProvider.deploy(config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Repository not found');
    });
  });

  describe('Service Management', () => {
    test('should get deployment status', async () => {
      const mockResponse = {
        data: {
          deployment: {
            id: 'dep-789',
            status: 'SUCCESS',
            url: 'https://test-app-production.up.railway.app',
            createdAt: '2024-01-01T10:00:00Z',
            completedAt: '2024-01-01T10:05:00Z'
          }
        }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const status = await railwayProvider.getStatus('dep-789');

      expect(status.id).toBe('dep-789');
      expect(status.status).toBe('running');
      expect(status.url).toBe('https://test-app-production.up.railway.app');
    });

    test('should handle failed deployment status', async () => {
      const mockResponse = {
        data: {
          deployment: {
            id: 'dep-789',
            status: 'FAILED',
            createdAt: '2024-01-01T10:00:00Z',
            completedAt: '2024-01-01T10:02:00Z'
          }
        }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const status = await railwayProvider.getStatus('dep-789');

      expect(status.status).toBe('failed');
    });

    test('should get deployment logs', async () => {
      const mockResponse = {
        data: {
          deploymentLogs: [
            {
              timestamp: '2024-01-01T10:00:00Z',
              message: 'Starting build process...',
              severity: 'INFO'
            },
            {
              timestamp: '2024-01-01T10:01:00Z',
              message: 'Build completed successfully',
              severity: 'INFO'
            },
            {
              timestamp: '2024-01-01T10:02:00Z',
              message: 'Application started on port 3000',
              severity: 'INFO'
            }
          ]
        }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const logs = await railwayProvider.getLogs('dep-789');

      expect(logs.success).toBe(true);
      expect(logs.logs).toHaveLength(3);
      expect(logs.logs[0].message).toBe('Starting build process...');
    });

    test('should get service metrics', async () => {
      const mockResponse = {
        data: {
          serviceMetrics: {
            cpu: 45.2,
            memory: 512,
            requests: 1250,
            responseTime: 120
          }
        }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const metrics = await railwayProvider.getMetrics('srv-456');

      expect(metrics.cpu).toBe(45.2);
      expect(metrics.memory).toBe(512);
      expect(metrics.requests).toBe(1250);
    });
  });

  describe('Environment Variables', () => {
    test('should set environment variables', async () => {
      const mockResponse = {
        data: {
          variableCollectionUpsert: {
            id: 'var-collection-123'
          }
        }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await railwayProvider.setEnvironmentVariables('srv-456', {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://...',
        API_KEY: 'secret-key'
      });

      expect(result.success).toBe(true);
    });

    test('should get environment variables', async () => {
      const mockResponse = {
        data: {
          variables: [
            { name: 'NODE_ENV', value: 'production' },
            { name: 'PORT', value: '3000' },
            { name: 'DATABASE_URL', value: 'postgresql://...' }
          ]
        }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await railwayProvider.getEnvironmentVariables('srv-456');

      expect(result.success).toBe(true);
      expect(result.variables.NODE_ENV).toBe('production');
      expect(result.variables.PORT).toBe('3000');
    });
  });

  describe('Custom Domains', () => {
    test('should add custom domain', async () => {
      const mockResponse = {
        data: {
          customDomainCreate: {
            id: 'domain-123',
            domain: 'app.example.com',
            status: 'PENDING'
          }
        }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await railwayProvider.addCustomDomain('srv-456', {
        domain: 'app.example.com'
      });

      expect(result.success).toBe(true);
      expect(result.domain.domain).toBe('app.example.com');
      expect(result.domain.status).toBe('pending');
    });

    test('should list custom domains', async () => {
      const mockResponse = {
        data: {
          customDomains: [
            {
              id: 'domain-123',
              domain: 'app.example.com',
              status: 'ACTIVE'
            },
            {
              id: 'domain-456',
              domain: 'api.example.com',
              status: 'PENDING'
            }
          ]
        }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await railwayProvider.listCustomDomains('srv-456');

      expect(result.success).toBe(true);
      expect(result.domains).toHaveLength(2);
      expect(result.domains[0].domain).toBe('app.example.com');
    });
  });

  describe('Scaling and Updates', () => {
    test('should update service configuration', async () => {
      const envResponse = {
        data: {
          variableCollectionUpsert: {
            id: 'var-collection-123'
          }
        }
      };

      const redeployResponse = {
        data: {
          serviceInstanceDeploy: {
            id: 'dep-new-456',
            status: 'BUILDING',
            url: 'https://test-app-staging.up.railway.app'
          }
        }
      };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(envResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(redeployResponse)
        });

      const result = await railwayProvider.update('srv-456', {
        environment: {
          NODE_ENV: 'staging',
          DEBUG: 'true'
        },
        replicas: 2
      });

      expect(result.success).toBe(true);
    });

    test('should trigger new deployment', async () => {
      const mockResponse = {
        data: {
          serviceInstanceDeploy: {
            id: 'dep-new-123',
            status: 'BUILDING'
          }
        }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await railwayProvider.redeploy('srv-456');

      expect(result.success).toBe(true);
      expect(result.deploymentId).toBe('dep-new-123');
      expect(result.status).toBe('building');
    });

    test('should remove service', async () => {
      const mockResponse = {
        data: {
          serviceDelete: {
            id: 'srv-456'
          }
        }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await railwayProvider.remove('srv-456');

      expect(result.success).toBe(true);
    });
  });

  describe('Database Integration', () => {
    test('should create database service', async () => {
      const mockResponse = {
        data: {
          serviceCreate: {
            id: 'srv-db-123',
            name: 'postgres-db'
          }
        }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await railwayProvider.createDatabase('proj-123', {
        type: 'postgresql',
        name: 'main-db'
      });

      expect(result.success).toBe(true);
      expect(result.service.id).toBe('srv-db-123');
    });

    test('should get database connection details', async () => {
      const mockResponse = {
        data: {
          variables: [
            { name: 'DATABASE_URL', value: 'postgresql://user:pass@host:5432/db' },
            { name: 'PGHOST', value: 'host.railway.internal' },
            { name: 'PGPORT', value: '5432' }
          ]
        }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await railwayProvider.getDatabaseConnection('srv-db-123');

      expect(result.success).toBe(true);
      expect(result.connectionString).toBe('postgresql://user:pass@host:5432/db');
    });
  });

  describe('Error Handling', () => {
    test('should handle API authentication errors', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      const result = await railwayProvider.listProjects();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');
    });

    test('should handle network errors', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const result = await railwayProvider.listProjects();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    test('should validate resource manager has Railway API key', () => {
      mockResourceManager.get.mockReturnValue(null);

      expect(() => {
        new RailwayProvider(mockResourceManager);
      }).toThrow('Railway API key not available in ResourceManager');
    });
  });

  describe('List Operations', () => {
    test('should list all deployments', async () => {
      const mockResponse = {
        data: {
          projects: {
            edges: [
              {
                node: {
                  id: 'proj-123',
                  name: 'test-app',
                  services: {
                    edges: [
                      {
                        node: {
                          id: 'srv-456',
                          name: 'web-service',
                          deployments: {
                            edges: [
                              {
                                node: {
                                  id: 'dep-789',
                                  status: 'SUCCESS',
                                  url: 'https://test-app.up.railway.app'
                                }
                              }
                            ]
                          }
                        }
                      }
                    ]
                  }
                }
              }
            ]
          }
        }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await railwayProvider.listDeployments();

      expect(result.success).toBe(true);
      expect(result.deployments).toHaveLength(1);
      expect(result.deployments[0].id).toBe('dep-789');
      expect(result.deployments[0].projectName).toBe('test-app');
      expect(result.deployments[0].serviceName).toBe('web-service');
    });
  });
});