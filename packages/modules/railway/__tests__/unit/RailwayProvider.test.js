import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import RailwayProvider from '../../src/providers/RailwayProvider.js';

// Mock fetch globally
global.fetch = jest.fn();

describe('RailwayProvider', () => {
  let provider;
  const mockApiKey = 'test-railway-api-key';

  beforeEach(() => {
    provider = new RailwayProvider(mockApiKey);
    fetch.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with API key', () => {
      expect(provider.apiKey).toBe(mockApiKey);
      expect(provider.name).toBe('railway');
      expect(provider.apiEndpoint).toBe('https://backboard.railway.app/graphql/v2');
      expect(provider.activeDeployments).toBeInstanceOf(Map);
    });

    it('should throw error if API key is not provided', () => {
      expect(() => new RailwayProvider()).toThrow('Railway API key is required');
      expect(() => new RailwayProvider('')).toThrow('Railway API key is required');
    });
  });

  describe('getCapabilities', () => {
    it('should return provider capabilities', () => {
      const capabilities = provider.getCapabilities();
      
      expect(capabilities.name).toBe('railway');
      expect(capabilities.displayName).toBe('Railway');
      expect(capabilities.supports.hosting).toBe(true);
      expect(capabilities.supports.customDomains).toBe(true);
      expect(capabilities.supports.ssl).toBe(true);
      expect(capabilities.supports.databases).toBe(true);
      expect(capabilities.requirements.railwayApiKey).toBe(true);
    });
  });

  describe('validateConfig', () => {
    it('should validate valid config', () => {
      const config = {
        name: 'test-app',
        source: 'github',
        repo: 'user/repo',
        branch: 'main'
      };
      
      const result = provider.validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate name format', () => {
      const config = {
        name: 'Test App!',
        source: 'github',
        repo: 'user/repo',
        branch: 'main'
      };
      
      const result = provider.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name must contain only lowercase letters, numbers, and hyphens');
    });

    it('should require name', () => {
      const config = {
        source: 'github',
        repo: 'user/repo',
        branch: 'main'
      };
      
      const result = provider.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name is required for Railway deployments');
    });
  });

  describe('makeGraphQLRequest', () => {
    it('should make successful GraphQL request', async () => {
      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({
          data: { test: 'result' }
        }))
      };
      fetch.mockResolvedValue(mockResponse);

      const query = 'query { test }';
      const result = await provider.makeGraphQLRequest(query);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ test: 'result' });
      expect(fetch).toHaveBeenCalledWith(
        'https://backboard.railway.app/graphql/v2',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json'
          }
        })
      );
    });

    it('should handle authentication error', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn().mockResolvedValue('Unauthorized')
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await provider.makeGraphQLRequest('query { test }');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication failed. Check your Railway API key.');
    });

    it('should handle GraphQL errors', async () => {
      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({
          errors: [{ message: 'GraphQL error occurred' }]
        }))
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await provider.makeGraphQLRequest('query { test }');

      expect(result.success).toBe(false);
      expect(result.error).toBe('GraphQL error occurred');
    });
  });

  describe('listProjects', () => {
    it('should list projects successfully', async () => {
      const mockProjects = {
        projects: {
          edges: [
            {
              node: {
                id: 'proj1',
                name: 'Test Project',
                description: 'Test Description',
                createdAt: '2023-01-01',
                services: { edges: [] }
              }
            }
          ]
        }
      };

      fetch.mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ data: mockProjects }))
      });

      const result = await provider.listProjects();

      expect(result.success).toBe(true);
      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].name).toBe('Test Project');
    });
  });

  describe('mapRailwayStatus', () => {
    it('should map Railway statuses correctly', () => {
      expect(provider.mapRailwayStatus('BUILDING')).toBe('building');
      expect(provider.mapRailwayStatus('DEPLOYING')).toBe('deploying');
      expect(provider.mapRailwayStatus('SUCCESS')).toBe('running');
      expect(provider.mapRailwayStatus('FAILED')).toBe('failed');
      expect(provider.mapRailwayStatus('CRASHED')).toBe('crashed');
      expect(provider.mapRailwayStatus('REMOVED')).toBe('removed');
      expect(provider.mapRailwayStatus('UNKNOWN')).toBe('unknown');
    });
  });

  describe('getDatabaseImage', () => {
    it('should return correct database images', () => {
      expect(provider.getDatabaseImage('postgresql')).toBe('postgres:15');
      expect(provider.getDatabaseImage('mysql')).toBe('mysql:8.0');
      expect(provider.getDatabaseImage('redis')).toBe('redis:7');
      expect(provider.getDatabaseImage('mongodb')).toBe('mongo:6');
      expect(provider.getDatabaseImage('unknown')).toBe('postgres:15');
    });
  });

  describe('buildSourceConfig', () => {
    it('should build GitHub source config', () => {
      const config = {
        source: 'github',
        repo: 'user/repo'
      };
      
      const result = provider.buildSourceConfig(config);
      expect(result).toEqual({ repo: 'user/repo' });
    });

    it('should build Docker image config', () => {
      const config = {
        image: 'node:18'
      };
      
      const result = provider.buildSourceConfig(config);
      expect(result).toEqual({ image: 'node:18' });
    });

    it('should use default for unknown source', () => {
      const config = {};
      
      const result = provider.buildSourceConfig(config);
      expect(result).toEqual({
        github: {
          repo: 'railwayapp-templates/express-starter',
          branch: 'main'
        }
      });
    });
  });
});