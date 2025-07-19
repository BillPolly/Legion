import { jest } from '@jest/globals';

// Mock dependencies
const mockDeploymentManager = {
  listDeployments: jest.fn(),
  getProvider: jest.fn()
};

const mockResourceManager = {
  get: jest.fn(),
  initialize: jest.fn()
};

jest.unstable_mockModule('../../../src/DeploymentManager.js', () => ({
  default: jest.fn(() => mockDeploymentManager)
}));

jest.unstable_mockModule('../../../src/core/ResourceManager.js', () => ({
  default: jest.fn(() => mockResourceManager)
}));

// Import after mocking
const ListDeploymentsTool = (await import('../../../src/tools/ListDeploymentsTool.js')).default;

describe('ListDeploymentsTool', () => {
  let listTool;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup resource manager
    mockResourceManager.get.mockImplementation((key) => {
      if (key === 'deployment-manager') {
        return mockDeploymentManager;
      }
      return null;
    });

    listTool = new ListDeploymentsTool();
  });

  describe('Tool Configuration', () => {
    test('should have correct tool name and description', () => {
      expect(listTool.name).toBe('list_deployments');
      expect(listTool.description).toContain('List and filter deployments across all providers');
    });

    test('should declare correct tool description schema', () => {
      const description = listTool.getToolDescription();
      
      expect(description.function.name).toBe('list_deployments');
      expect(description.function.parameters.type).toBe('object');
      expect(description.function.parameters.properties).toHaveProperty('provider');
      expect(description.function.parameters.properties).toHaveProperty('status');
      expect(description.function.parameters.properties).toHaveProperty('format');
    });
  });

  describe('Cross-provider Listing', () => {
    test('should list all deployments across providers', async () => {
      const mockDeployments = [
        {
          id: 'local-123',
          name: 'dev-app',
          provider: 'local',
          status: 'running',
          url: 'http://localhost:3000',
          createdAt: '2024-01-01T10:00:00Z'
        },
        {
          id: 'docker-456',
          name: 'test-container',
          provider: 'docker',
          status: 'running',
          url: 'http://localhost:8080',
          createdAt: '2024-01-01T11:00:00Z'
        },
        {
          id: 'railway-789',
          name: 'prod-app',
          provider: 'railway',
          status: 'building',
          url: 'https://prod-app.up.railway.app',
          createdAt: '2024-01-01T12:00:00Z'
        }
      ];

      mockDeploymentManager.listDeployments.mockResolvedValue({
        success: true,
        deployments: mockDeployments
      });

      const toolCall = {
        function: {
          name: 'list_deployments',
          arguments: JSON.stringify({})
        }
      };

      const result = await listTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.deployments).toHaveLength(3);
      expect(result.data.summary.total).toBe(3);
      expect(result.data.summary.byProvider.local).toBe(1);
      expect(result.data.summary.byProvider.docker).toBe(1);
      expect(result.data.summary.byProvider.railway).toBe(1);
      expect(result.data.summary.byStatus.running).toBe(2);
      expect(result.data.summary.byStatus.building).toBe(1);
    });

    test('should filter deployments by provider', async () => {
      const mockDeployments = [
        {
          id: 'docker-123',
          name: 'container-1',
          provider: 'docker',
          status: 'running',
          createdAt: '2024-01-01T10:00:00Z'
        },
        {
          id: 'docker-456',
          name: 'container-2',
          provider: 'docker',
          status: 'stopped',
          createdAt: '2024-01-01T11:00:00Z'
        }
      ];

      mockDeploymentManager.listDeployments.mockResolvedValue({
        success: true,
        deployments: mockDeployments
      });

      const toolCall = {
        function: {
          name: 'list_deployments',
          arguments: JSON.stringify({
            provider: 'docker'
          })
        }
      };

      const result = await listTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.deployments).toHaveLength(2);
      expect(result.data.deployments.every(d => d.provider === 'docker')).toBe(true);
      expect(result.data.summary.total).toBe(2);
      
      expect(mockDeploymentManager.listDeployments).toHaveBeenCalledWith({ provider: 'docker' });
    });

    test('should filter deployments by status', async () => {
      const mockDeployments = [
        {
          id: 'app-123',
          name: 'running-app-1',
          provider: 'local',
          status: 'running',
          createdAt: '2024-01-01T10:00:00Z'
        },
        {
          id: 'app-456',
          name: 'running-app-2',
          provider: 'docker',
          status: 'running',
          createdAt: '2024-01-01T11:00:00Z'
        }
      ];

      mockDeploymentManager.listDeployments.mockResolvedValue({
        success: true,
        deployments: mockDeployments
      });

      const toolCall = {
        function: {
          name: 'list_deployments',
          arguments: JSON.stringify({
            status: 'running'
          })
        }
      };

      const result = await listTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.deployments).toHaveLength(2);
      expect(result.data.deployments.every(d => d.status === 'running')).toBe(true);
      
      expect(mockDeploymentManager.listDeployments).toHaveBeenCalledWith({ status: 'running' });
    });
  });

  describe('Output Formatting', () => {
    test('should format output as table by default', async () => {
      const mockDeployments = [
        {
          id: 'app-123',
          name: 'test-app',
          provider: 'local',
          status: 'running',
          url: 'http://localhost:3000',
          createdAt: '2024-01-01T10:00:00Z'
        }
      ];

      mockDeploymentManager.listDeployments.mockResolvedValue({
        success: true,
        deployments: mockDeployments
      });

      const toolCall = {
        function: {
          name: 'list_deployments',
          arguments: JSON.stringify({})
        }
      };

      const result = await listTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.format).toBe('table');
      expect(result.data.table).toBeDefined();
      expect(result.data.table.headers).toEqual(['ID', 'Name', 'Provider', 'Status', 'URL', 'Created']);
      expect(result.data.table.rows).toHaveLength(1);
    });

    test('should format output as JSON when requested', async () => {
      const mockDeployments = [
        {
          id: 'app-123',
          name: 'test-app',
          provider: 'local',
          status: 'running'
        }
      ];

      mockDeploymentManager.listDeployments.mockResolvedValue({
        success: true,
        deployments: mockDeployments
      });

      const toolCall = {
        function: {
          name: 'list_deployments',
          arguments: JSON.stringify({
            format: 'json'
          })
        }
      };

      const result = await listTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.format).toBe('json');
      expect(result.data.deployments).toEqual(mockDeployments);
    });

    test('should format output as summary when requested', async () => {
      const mockDeployments = [
        { provider: 'local', status: 'running' },
        { provider: 'docker', status: 'running' },
        { provider: 'docker', status: 'stopped' },
        { provider: 'railway', status: 'building' }
      ];

      mockDeploymentManager.listDeployments.mockResolvedValue({
        success: true,
        deployments: mockDeployments
      });

      const toolCall = {
        function: {
          name: 'list_deployments',
          arguments: JSON.stringify({
            format: 'summary'
          })
        }
      };

      const result = await listTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.format).toBe('summary');
      expect(result.data.summary.total).toBe(4);
      expect(result.data.summary.byProvider.docker).toBe(2);
      expect(result.data.summary.byStatus.running).toBe(2);
    });
  });

  describe('Sorting and Pagination', () => {
    test('should sort deployments by creation date', async () => {
      const mockDeployments = [
        {
          id: 'app-1',
          name: 'older-app',
          createdAt: '2024-01-01T09:00:00Z'
        },
        {
          id: 'app-2',
          name: 'newer-app',
          createdAt: '2024-01-01T11:00:00Z'
        },
        {
          id: 'app-3',
          name: 'middle-app',
          createdAt: '2024-01-01T10:00:00Z'
        }
      ];

      mockDeploymentManager.listDeployments.mockResolvedValue({
        success: true,
        deployments: mockDeployments
      });

      const toolCall = {
        function: {
          name: 'list_deployments',
          arguments: JSON.stringify({
            sortBy: 'createdAt',
            sortOrder: 'desc'
          })
        }
      };

      const result = await listTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.deployments[0].name).toBe('newer-app');
      expect(result.data.deployments[1].name).toBe('middle-app');
      expect(result.data.deployments[2].name).toBe('older-app');
    });

    test('should handle pagination', async () => {
      const mockDeployments = Array.from({ length: 25 }, (_, i) => ({
        id: `app-${i}`,
        name: `app-${i}`,
        provider: 'local',
        status: 'running',
        createdAt: new Date(Date.now() + i * 1000).toISOString()
      }));

      mockDeploymentManager.listDeployments.mockResolvedValue({
        success: true,
        deployments: mockDeployments
      });

      const toolCall = {
        function: {
          name: 'list_deployments',
          arguments: JSON.stringify({
            limit: 10,
            offset: 5
          })
        }
      };

      const result = await listTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.deployments).toHaveLength(10);
      expect(result.data.pagination.total).toBe(25);
      expect(result.data.pagination.limit).toBe(10);
      expect(result.data.pagination.offset).toBe(5);
      expect(result.data.pagination.hasMore).toBe(true);
    });
  });

  describe('Search and Filtering', () => {
    test('should search deployments by name', async () => {
      const mockDeployments = [
        { id: 'app-1', name: 'frontend-app', provider: 'docker' },
        { id: 'app-2', name: 'backend-service', provider: 'local' },
        { id: 'app-3', name: 'frontend-v2', provider: 'railway' }
      ];

      mockDeploymentManager.listDeployments.mockResolvedValue({
        success: true,
        deployments: mockDeployments
      });

      const toolCall = {
        function: {
          name: 'list_deployments',
          arguments: JSON.stringify({
            search: 'frontend'
          })
        }
      };

      const result = await listTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.deployments).toHaveLength(2);
      expect(result.data.deployments.every(d => d.name.includes('frontend'))).toBe(true);
    });

    test('should combine multiple filters', async () => {
      const mockDeployments = [
        { id: 'app-1', name: 'docker-app', provider: 'docker', status: 'running' }
      ];

      mockDeploymentManager.listDeployments.mockResolvedValue({
        success: true,
        deployments: mockDeployments
      });

      const toolCall = {
        function: {
          name: 'list_deployments',
          arguments: JSON.stringify({
            provider: 'docker',
            status: 'running',
            search: 'docker'
          })
        }
      };

      const result = await listTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.deployments).toHaveLength(1);
      
      expect(mockDeploymentManager.listDeployments).toHaveBeenCalledWith({
        provider: 'docker',
        status: 'running',
        search: 'docker'
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle deployment manager errors', async () => {
      mockDeploymentManager.listDeployments.mockRejectedValue(new Error('Database connection failed'));

      const toolCall = {
        function: {
          name: 'list_deployments',
          arguments: JSON.stringify({})
        }
      };

      const result = await listTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
    });

    test('should handle empty deployment list', async () => {
      mockDeploymentManager.listDeployments.mockResolvedValue({
        success: true,
        deployments: []
      });

      const toolCall = {
        function: {
          name: 'list_deployments',
          arguments: JSON.stringify({})
        }
      };

      const result = await listTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data.deployments).toHaveLength(0);
      expect(result.data.summary.total).toBe(0);
      expect(result.data.message).toContain('No deployments found');
    });

    test('should handle invalid JSON arguments', async () => {
      const toolCall = {
        function: {
          name: 'list_deployments',
          arguments: 'invalid-json'
        }
      };

      const result = await listTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });

    test('should validate invalid provider filter', async () => {
      const toolCall = {
        function: {
          name: 'list_deployments',
          arguments: JSON.stringify({
            provider: 'invalid-provider'
          })
        }
      };

      const result = await listTool.invoke(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid provider');
      expect(result.suggestions).toContain('Use one of: local, docker, railway');
    });
  });

  describe('Response Formatting', () => {
    test('should format successful response correctly', async () => {
      const mockDeployments = [
        {
          id: 'app-123',
          name: 'test-app',
          provider: 'local',
          status: 'running'
        }
      ];

      mockDeploymentManager.listDeployments.mockResolvedValue({
        success: true,
        deployments: mockDeployments
      });

      const toolCall = {
        function: {
          name: 'list_deployments',
          arguments: JSON.stringify({})
        }
      };

      const result = await listTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('deployments');
      expect(result.data).toHaveProperty('summary');
      expect(result.data).toHaveProperty('format');
      expect(result.data).toHaveProperty('nextSteps');
      
      expect(result.data.summary.total).toBe(1);
      expect(result.data.nextSteps).toBeInstanceOf(Array);
    });
  });
});