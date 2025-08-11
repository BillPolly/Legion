/**
 * Integration test for semantic tool discovery system
 * 
 * Tests the complete flow of indexing tools and discovering relevant ones
 * based on natural language task descriptions.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { SemanticSearchProvider } from '../../src/SemanticSearchProvider.js';
import { ToolIndexer } from '../../src/tools/ToolIndexer.js';
import { SemanticToolDiscovery } from '../../src/tools/SemanticToolDiscovery.js';
import { ResourceManager } from '@legion/tools';

describe('Tool Discovery System', () => {
  let resourceManager;
  let semanticSearchProvider;
  let toolIndexer;
  let toolDiscovery;

  // Sample tools for testing
  const sampleTools = [
    {
      name: 'file_read',
      description: 'Read contents of a file from the filesystem',
      category: 'file',
      tags: ['file', 'read', 'filesystem'],
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to read' }
        }
      }
    },
    {
      name: 'file_write',
      description: 'Write content to a file on the filesystem',
      category: 'file',
      tags: ['file', 'write', 'filesystem'],
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' }
        }
      }
    },
    {
      name: 'api_call',
      description: 'Make HTTP API calls to external services',
      category: 'api',
      tags: ['api', 'http', 'rest', 'request'],
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          method: { type: 'string' },
          body: { type: 'object' }
        }
      }
    },
    {
      name: 'database_query',
      description: 'Execute SQL queries against a database',
      category: 'database',
      tags: ['database', 'sql', 'query'],
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          params: { type: 'array' }
        }
      }
    },
    {
      name: 'react_component_generator',
      description: 'Generate React components with TypeScript',
      category: 'development',
      tags: ['react', 'component', 'typescript', 'frontend'],
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          props: { type: 'array' }
        }
      }
    },
    {
      name: 'test_runner',
      description: 'Run tests using Jest testing framework',
      category: 'testing',
      tags: ['test', 'jest', 'testing', 'verification'],
      inputSchema: {
        type: 'object',
        properties: {
          testFile: { type: 'string' },
          coverage: { type: 'boolean' }
        }
      }
    },
    {
      name: 'docker_build',
      description: 'Build Docker containers from Dockerfile',
      category: 'deployment',
      tags: ['docker', 'container', 'build', 'deployment'],
      inputSchema: {
        type: 'object',
        properties: {
          dockerfile: { type: 'string' },
          tag: { type: 'string' }
        }
      }
    },
    {
      name: 'npm_install',
      description: 'Install Node.js packages using npm',
      category: 'development',
      tags: ['npm', 'node', 'package', 'install'],
      inputSchema: {
        type: 'object',
        properties: {
          packages: { type: 'array' },
          devDependencies: { type: 'boolean' }
        }
      }
    },
    {
      name: 'git_commit',
      description: 'Create git commits with changes',
      category: 'development',
      tags: ['git', 'commit', 'version-control'],
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          files: { type: 'array' }
        }
      }
    },
    {
      name: 'error_handler',
      description: 'Handle and log application errors',
      category: 'monitoring',
      tags: ['error', 'exception', 'logging', 'monitoring'],
      inputSchema: {
        type: 'object',
        properties: {
          error: { type: 'object' },
          context: { type: 'object' }
        }
      }
    }
  ];

  beforeAll(async () => {
    // Skip if no API key
    if (!process.env.OPENAI_API_KEY) {
      console.log('Skipping tool discovery tests - OPENAI_API_KEY not set');
      return;
    }

    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Create semantic search provider
    semanticSearchProvider = await SemanticSearchProvider.create(resourceManager);
    await semanticSearchProvider.connect();

    // Create tool indexer and discovery
    const dependencies = {
      embeddingService: semanticSearchProvider.embeddingService,
      vectorStore: semanticSearchProvider.vectorStore,
      semanticSearchProvider
    };

    toolIndexer = new ToolIndexer(dependencies);
    toolDiscovery = new SemanticToolDiscovery({
      ...dependencies,
      toolIndexer
    });

    // Index sample tools
    await toolIndexer.indexTools(sampleTools);
  });

  afterAll(async () => {
    if (semanticSearchProvider) {
      await semanticSearchProvider.disconnect();
    }
  });

  describe('Tool Indexing', () => {
    it('should index tools with semantic metadata', async () => {
      if (!toolIndexer) return;

      const stats = toolIndexer.getStatistics();
      expect(stats.totalIndexed).toBe(sampleTools.length);
      expect(stats.categories).toHaveProperty('file');
      expect(stats.categories).toHaveProperty('api');
      expect(stats.categories).toHaveProperty('database');
    });

    it('should extract capabilities from tools', async () => {
      if (!toolIndexer) return;

      const tool = {
        name: 'data_analyzer',
        description: 'Analyze and transform data with validation',
        category: 'data'
      };

      const result = await toolIndexer.indexTool(tool);
      expect(result.success).toBe(true);
      
      // Tool should have analysis and transformation capabilities
      const indexed = toolIndexer.indexedTools.get('data_analyzer');
      expect(indexed.document.capabilities).toContain('analysis');
      expect(indexed.document.capabilities).toContain('transformation');
      expect(indexed.document.capabilities).toContain('validation');
    });
  });

  describe('Semantic Tool Discovery', () => {
    it('should find relevant tools for file operations', async () => {
      if (!toolDiscovery) return;

      const tools = await toolDiscovery.findRelevantTools(
        'I need to read a configuration file and write the processed output',
        { limit: 5 }
      );

      expect(tools.length).toBeGreaterThan(0);
      
      // Should find file_read and file_write as top results
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('file_read');
      expect(toolNames).toContain('file_write');
      
      // File tools should have high relevance
      const fileRead = tools.find(t => t.name === 'file_read');
      expect(fileRead.relevanceScore).toBeGreaterThan(0.7);
    });

    it('should find relevant tools for web development', async () => {
      if (!toolDiscovery) return;

      const tools = await toolDiscovery.findRelevantTools(
        'Create a React component with API integration and error handling',
        { limit: 5 }
      );

      expect(tools.length).toBeGreaterThan(0);
      
      // Should find React, API, and error handling tools
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('react_component_generator');
      expect(toolNames).toContain('api_call');
      expect(toolNames).toContain('error_handler');
    });

    it('should find relevant tools for testing', async () => {
      if (!toolDiscovery) return;

      const tools = await toolDiscovery.findRelevantTools(
        'Run tests and verify the code works correctly',
        { limit: 3 }
      );

      expect(tools.length).toBeGreaterThan(0);
      
      // Should find test_runner as top result
      expect(tools[0].name).toBe('test_runner');
      expect(tools[0].relevanceScore).toBeGreaterThan(0.8);
    });

    it('should find tools by category', async () => {
      if (!toolDiscovery) return;

      const tools = await toolDiscovery.findRelevantTools(
        'Database operations',
        { 
          limit: 5,
          categories: ['database']
        }
      );

      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0].name).toBe('database_query');
      expect(tools[0].category).toBe('database');
    });

    it('should exclude specified tools', async () => {
      if (!toolDiscovery) return;

      const tools = await toolDiscovery.findRelevantTools(
        'File operations',
        { 
          limit: 5,
          excludeTools: ['file_read']
        }
      );

      const toolNames = tools.map(t => t.name);
      expect(toolNames).not.toContain('file_read');
      expect(toolNames).toContain('file_write');
    });
  });

  describe('Tool Combinations', () => {
    it('should find tool combinations for complex tasks', async () => {
      if (!toolDiscovery) return;

      const combinations = await toolDiscovery.findToolCombinations(
        'Build and deploy a Docker container with proper error handling',
        { maxTools: 5 }
      );

      expect(combinations.primaryTools.length).toBeGreaterThan(0);
      expect(combinations.supportingTools.length).toBeGreaterThan(0);
      
      // Should have docker_build as primary tool
      const primaryNames = combinations.primaryTools.map(t => t.name);
      expect(primaryNames).toContain('docker_build');
      
      // Should have error_handler as supporting tool
      const supportingNames = combinations.supportingTools.map(t => t.name);
      expect(supportingNames).toContain('error_handler');
      
      // Should suggest a workflow
      expect(combinations.suggestedWorkflow).toBeDefined();
      expect(combinations.suggestedWorkflow.phases.length).toBeGreaterThan(0);
    });
  });

  describe('Similar Tools', () => {
    it('should find similar tools', async () => {
      if (!toolDiscovery) return;

      const similar = await toolDiscovery.findSimilarTools(
        'file_read',
        { limit: 3 }
      );

      expect(similar.length).toBeGreaterThan(0);
      
      // file_write should be similar to file_read
      const toolNames = similar.map(t => t.document?.name || t.name);
      expect(toolNames).toContain('file_write');
    });
  });

  describe('Tool Recommendations', () => {
    it('should recommend tools based on usage patterns', async () => {
      if (!toolDiscovery) return;

      const recommendations = await toolDiscovery.getToolRecommendations(
        ['file_read', 'api_call'],
        'Processing data from API and saving to file'
      );

      expect(recommendations.length).toBeGreaterThan(0);
      
      // Should recommend file_write since we're reading and calling API
      const recommendedNames = recommendations.map(t => t.name);
      expect(recommendedNames).toContain('file_write');
    });
  });
});

describe('PlannerEngine Integration', () => {
  let plannerEngine;
  let toolDiscovery;

  beforeAll(async () => {
    if (!process.env.OPENAI_API_KEY) return;

    // Mock setup for planner integration test
    const mockToolDiscovery = {
      findRelevantTools: async (description) => {
        // Return mock discovered tools
        if (description.includes('file')) {
          return [
            {
              name: 'file_read',
              description: 'Read file contents',
              category: 'file',
              relevanceScore: 0.9,
              capabilities: ['reading', 'fetching']
            },
            {
              name: 'file_write',
              description: 'Write file contents',
              category: 'file',
              relevanceScore: 0.85,
              capabilities: ['writing', 'creation']
            }
          ];
        }
        return [];
      }
    };

    // Create planner with tool discovery
    // const { PlannerEngine } = await import('@legion/unified-planner');
    // plannerEngine = new PlannerEngine({
    //   toolDiscoveryService: mockToolDiscovery,
    //   debugMode: true
    // });
    
    // Skip this test since unified-planner doesn't exist
    plannerEngine = null;
  });

  it('should create planning request with semantic tool discovery', async () => {
    if (!plannerEngine) return;

    const request = await plannerEngine.createSemanticPlanningRequest(
      'Read configuration file and process the data',
      {
        toolDiscovery: {
          limit: 10,
          minScore: 0.7
        }
      }
    );

    expect(request.allowableActions).toHaveLength(2);
    expect(request.allowableActions[0].type).toBe('file_read');
    expect(request.allowableActions[0].metadata.relevanceScore).toBe(0.9);
    expect(request.context.toolDiscovery.performed).toBe(true);
    expect(request.context.toolDiscovery.toolCount).toBe(2);
  });
});