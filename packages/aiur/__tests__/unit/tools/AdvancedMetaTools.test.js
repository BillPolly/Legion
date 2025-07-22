/**
 * Tests for Advanced Meta-Tools
 * 
 * Tests enhanced tool suggestion, tool chaining, workflow management,
 * and performance tracking capabilities
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { AdvancedMetaTools } from '../../../src/tools/AdvancedMetaTools.js';
import { ToolRegistry } from '../../../src/tools/ToolRegistry.js';
import { HandleRegistry } from '../../../src/handles/HandleRegistry.js';
import { WorkingSet } from '../../../src/tools/WorkingSet.js';
import { ContextAwareLoader } from '../../../src/tools/ContextAwareLoader.js';

describe('AdvancedMetaTools', () => {
  let toolRegistry;
  let handleRegistry;
  let workingSet;
  let contextLoader;
  let metaTools;
  let mockTools;

  beforeEach(() => {
    toolRegistry = new ToolRegistry();
    handleRegistry = new HandleRegistry();
    workingSet = new WorkingSet(toolRegistry, { maxSize: 20 });
    contextLoader = new ContextAwareLoader(toolRegistry, handleRegistry, workingSet);
    
    // Register mock tools
    mockTools = [
      {
        name: 'file_read',
        description: 'Read file contents',
        tags: ['file', 'io', 'read'],
        category: 'file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          }
        },
        execute: async (params) => ({ 
          content: 'file data',
          saveAs: 'fileContent'
        })
      },
      {
        name: 'json_parse',
        description: 'Parse JSON data',
        tags: ['json', 'parse', 'data'],
        category: 'data',
        inputSchema: {
          type: 'object',
          properties: {
            json: { type: 'string' }
          }
        },
        execute: async (params) => ({ 
          data: { parsed: true },
          saveAs: 'parsedData'
        })
      },
      {
        name: 'api_fetch',
        description: 'Fetch API data',
        tags: ['api', 'network', 'fetch'],
        category: 'network',
        inputSchema: {
          type: 'object',
          properties: {
            endpoint: { type: 'string' },
            method: { type: 'string' }
          }
        },
        execute: async (params) => ({ 
          response: { status: 200 },
          saveAs: 'apiResponse'
        })
      },
      {
        name: 'data_transform',
        description: 'Transform data',
        tags: ['data', 'transform', 'process'],
        category: 'data',
        inputSchema: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            transformation: { type: 'string' }
          }
        },
        execute: async (params) => ({ 
          result: { transformed: true },
          saveAs: 'transformedData'
        })
      },
      {
        name: 'file_write',
        description: 'Write file contents',
        tags: ['file', 'io', 'write'],
        category: 'file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' }
          }
        },
        execute: async (params) => ({ success: true })
      }
    ];

    mockTools.forEach(tool => toolRegistry.registerTool(tool));
    
    metaTools = new AdvancedMetaTools(toolRegistry, handleRegistry, workingSet, contextLoader);
  });

  describe('Enhanced Tool Suggestion', () => {
    test('should provide context-aware suggestions with explanations', async () => {
      handleRegistry.create('inputFile', { path: 'data.json', type: 'file' });
      handleRegistry.create('apiKey', 'sk-123456');
      
      const result = await metaTools.suggestTools({
        query: 'process JSON data from file',
        includeReasoning: true,
        semanticSearch: true
      });
      
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0].tool).toBeDefined();
      expect(result.suggestions[0].confidence).toBeGreaterThan(0.5);
      expect(result.suggestions[0].reasoning).toBeDefined();
      
      // Check if any suggestion contains JSON in reasoning (case insensitive)
      const hasJsonReasoning = result.suggestions.some(s => 
        s.reasoning && s.reasoning.toLowerCase().includes('json')
      );
      expect(hasJsonReasoning).toBe(true);
    });

    test('should suggest based on semantic understanding', async () => {
      const result = await metaTools.suggestTools({
        query: 'I need to extract information from a web page and save it',
        semanticSearch: true
      });
      
      expect(result.suggestions.some(s => 
        s.tool === 'api_fetch' || s.tool === 'file_write'
      )).toBe(true);
      expect(result.queryInterpretation).toBeDefined();
    });

    test('should learn from usage patterns', async () => {
      // Record usage pattern
      metaTools.recordToolSequence(['file_read', 'json_parse', 'data_transform']);
      metaTools.recordToolSequence(['file_read', 'json_parse', 'data_transform']);
      
      workingSet.activateTool('file_read');
      
      const result = await metaTools.suggestNextTool();
      
      expect(result.suggestions[0].tool).toBe('json_parse');
      expect(result.suggestions[0].basedOn).toContain('pattern');
    });

    test('should provide multi-step suggestions', async () => {
      handleRegistry.create('csvFile', { path: 'data.csv' });
      
      const result = await metaTools.suggestToolChain({
        goal: 'Convert CSV to JSON and save',
        maxSteps: 5
      });
      
      expect(result.chain.length).toBeGreaterThan(1);
      expect(result.chain[0].tool).toBeDefined();
      expect(result.chain[result.chain.length - 1].tool).toBe('file_write');
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Tool Chain Management', () => {
    test('should create tool chains from goals', async () => {
      const chain = await metaTools.createToolChain({
        goal: 'Read JSON file and transform data',
        startingContext: {
          filePath: 'input.json'
        }
      });
      
      expect(chain.id).toBeDefined();
      expect(chain.steps.length).toBeGreaterThan(1);
      expect(chain.steps[0].tool).toBe('file_read');
      expect(chain.steps[1].tool).toBe('json_parse');
    });

    test('should validate tool chains', async () => {
      // Simple chain without complex handle dependencies
      const chain = {
        steps: [
          { tool: 'file_read', params: { path: 'test.json' } },
          { tool: 'json_parse', params: { json: 'some json' } },
          { tool: 'data_transform', params: { data: 'some data' } }
        ]
      };
      
      const validation = await metaTools.validateToolChain(chain);
      
      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(validation.dataFlow).toBeDefined();
    });

    test('should optimize tool chains', async () => {
      const chain = {
        steps: [
          { tool: 'file_read', params: { path: 'a.json' } },
          { tool: 'file_read', params: { path: 'b.json' } },
          { tool: 'json_parse', params: { json: '@fileContent' } }
        ]
      };
      
      const optimized = await metaTools.optimizeToolChain(chain);
      
      expect(optimized.parallelizable).toBeDefined();
      expect(optimized.parallelizable[0]).toEqual([0, 1]); // Both reads can be parallel
      expect(optimized.estimatedTime).toBeLessThan(chain.steps.length * 100);
    });

    test('should execute tool chains', async () => {
      const chain = {
        steps: [
          { tool: 'file_read', params: { path: 'test.json' } },
          { tool: 'json_parse', params: { json: '@fileContent' } }
        ]
      };
      
      const execution = await metaTools.executeToolChain(chain);
      
      expect(execution.status).toBe('completed');
      expect(execution.results).toHaveLength(2);
      expect(handleRegistry.getByName('fileContent')).toBeDefined();
      expect(handleRegistry.getByName('parsedData')).toBeDefined();
    });
  });

  describe('Workflow Templates', () => {
    test('should create workflow template from execution', async () => {
      // Execute a workflow
      await metaTools.executeToolChain({
        steps: [
          { tool: 'api_fetch', params: { endpoint: '/data' } },
          { tool: 'data_transform', params: { data: '@apiResponse' } },
          { tool: 'file_write', params: { path: 'output.json', content: '@transformedData' } }
        ]
      });
      
      const template = await metaTools.createWorkflowTemplate({
        name: 'API to File',
        description: 'Fetch API data and save to file',
        captureFromHistory: true
      });
      
      expect(template.id).toBeDefined();
      expect(template.steps).toHaveLength(3);
      expect(template.parameters).toBeDefined();
      expect(template.parameters).toContain('endpoint');
    });

    test('should instantiate workflow templates', async () => {
      const template = await metaTools.createWorkflowTemplate({
        name: 'Data Processing',
        steps: [
          { tool: 'file_read', params: { path: '{{inputFile}}' } },
          { tool: 'json_parse', params: { json: '@fileContent' } },
          { tool: 'file_write', params: { path: '{{outputFile}}', content: '@parsedData' } }
        ],
        parameters: ['inputFile', 'outputFile']
      });
      
      const instance = await metaTools.instantiateWorkflow(template.id, {
        inputFile: 'input.json',
        outputFile: 'output.json'
      });
      
      expect(instance.steps[0].params.path).toBe('input.json');
      expect(instance.steps[2].params.path).toBe('output.json');
    });

    test('should manage workflow library', async () => {
      // Create templates
      await metaTools.createWorkflowTemplate({
        name: 'Template 1',
        steps: [{ tool: 'file_read', params: {} }]
      });
      await metaTools.createWorkflowTemplate({
        name: 'Template 2',
        steps: [{ tool: 'api_fetch', params: {} }],
        tags: ['api', 'network']
      });
      
      const library = await metaTools.getWorkflowLibrary();
      
      expect(library.templates).toHaveLength(2);
      
      const apiTemplates = await metaTools.searchWorkflows({
        tags: ['api']
      });
      
      expect(apiTemplates).toHaveLength(1);
      expect(apiTemplates[0].name).toBe('Template 2');
    });

    test('should share workflow templates', async () => {
      const template = await metaTools.createWorkflowTemplate({
        name: 'Shareable Workflow',
        steps: [{ tool: 'file_read', params: {} }]
      });
      
      const exported = await metaTools.exportWorkflow(template.id);
      
      expect(exported.format).toBe('json');
      expect(exported.data).toContain('Shareable Workflow');
      expect(exported.checksum).toBeDefined();
      
      // Import in a new instance
      const imported = await metaTools.importWorkflow(exported.data);
      
      expect(imported.name).toBe('Shareable Workflow');
      expect(imported.id).not.toBe(template.id); // New ID assigned
    });
  });

  describe('Performance Analytics', () => {
    test('should track tool performance metrics', async () => {
      // Register a mock tool with small delay to ensure measurable execution time
      const mockTool = {
        name: 'test_read',
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 1));
          return { result: 'test' };
        }
      };
      toolRegistry.registerTool(mockTool);
      
      // Execute chains to trigger performance tracking
      for (let i = 0; i < 5; i++) {
        await metaTools.executeToolChain({
          steps: [
            { tool: 'test_read', params: { path: 'test.txt' } }
          ]
        });
      }
      
      const metrics = await metaTools.getToolPerformanceMetrics();
      
      expect(metrics['test_read']).toBeDefined();
      expect(metrics['test_read'].executionCount).toBe(5);
      expect(metrics['test_read'].averageTime).toBeGreaterThanOrEqual(0);
      expect(metrics['test_read'].successRate).toBe(1);
    });

    test('should identify performance bottlenecks', async () => {
      // Simulate slow tool
      const slowTool = {
        name: 'slow_operation',
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { result: 'done' };
        }
      };
      toolRegistry.registerTool(slowTool);
      
      await metaTools.executeToolChain({
        steps: [
          { tool: 'file_read', params: {} },
          { tool: 'slow_operation', params: {} },
          { tool: 'file_write', params: {} }
        ]
      });
      
      const analysis = await metaTools.analyzeChainPerformance();
      
      expect(analysis.bottlenecks).toContain('slow_operation');
      expect(analysis.recommendations).toBeDefined();
    });

    test('should provide optimization recommendations', async () => {
      // Create suboptimal chain
      const chain = {
        steps: [
          { tool: 'file_read', params: { path: 'a.txt' } },
          { tool: 'file_read', params: { path: 'b.txt' } },
          { tool: 'file_read', params: { path: 'c.txt' } },
          { tool: 'json_parse', params: { json: '@fileContent' } }
        ]
      };
      
      const recommendations = await metaTools.getOptimizationRecommendations(chain);
      
      expect(recommendations.parallelization).toBeDefined();
      expect(recommendations.parallelization.possible).toBe(true);
      expect(recommendations.caching).toBeDefined();
      expect(recommendations.alternativeTools).toBeDefined();
    });

    test('should generate performance reports', async () => {
      // Execute various operations
      await metaTools.executeToolChain({
        steps: [
          { tool: 'file_read', params: {} },
          { tool: 'json_parse', params: {} }
        ]
      });
      
      const report = await metaTools.generatePerformanceReport({
        period: 'session',
        includeRecommendations: true
      });
      
      expect(report.summary).toBeDefined();
      expect(report.toolMetrics).toBeDefined();
      expect(report.chainMetrics).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.exportFormat).toBe('markdown');
    });
  });

  describe('Advanced Features', () => {
    test('should support conditional tool execution', async () => {
      const chain = {
        steps: [
          { tool: 'file_read', params: { path: 'config.json' } },
          { 
            tool: 'api_fetch',
            params: { endpoint: '@parsedData.endpoint' },
            condition: '@parsedData.useApi === true'
          },
          {
            tool: 'file_write',
            params: { path: 'output.txt', content: '@apiResponse' }
          }
        ]
      };
      
      const execution = await metaTools.executeToolChain(chain);
      
      expect(execution.skippedSteps).toBeDefined();
      expect(execution.executionPath).toBeDefined();
    });

    test('should handle tool retries and fallbacks', async () => {
      const chain = {
        steps: [
          {
            tool: 'api_fetch',
            params: { endpoint: '/flaky' },
            retry: { attempts: 3, backoff: 100 },
            fallback: { tool: 'file_read', params: { path: 'cache.json' } }
          }
        ]
      };
      
      const execution = await metaTools.executeToolChain(chain);
      
      expect(execution.retries).toBeDefined();
      expect(execution.fallbacksUsed).toBeDefined();
    });

    test('should provide interactive tool suggestions', async () => {
      const interactive = await metaTools.startInteractiveSession();
      
      // Simulate user describing task with specific file name
      const response1 = await interactive.processInput(
        "I need to convert data/sales.csv to JSON format"
      );
      
      expect(response1.suggestedTools).toBeDefined();
      expect(response1.clarificationNeeded).toBe(false); // File path provided
      expect(response1.nextSteps).toBeDefined();
      expect(response1.readyToExecute).toBe(true);
      expect(response1.proposedChain).toBeDefined();
    });

    test('should integrate with external tool registries', async () => {
      const externalTools = await metaTools.discoverExternalTools({
        registries: ['npm', 'github'],
        query: 'data processing'
      });
      
      expect(externalTools.length).toBeGreaterThan(0);
      expect(externalTools[0].source).toBeDefined();
      expect(externalTools[0].installCommand).toBeDefined();
      
      const installed = await metaTools.installExternalTool(
        externalTools[0].id
      );
      
      expect(installed.success).toBe(true);
      expect(toolRegistry.hasTool(installed.toolName)).toBe(true);
    });
  });

  describe('Tool Learning and Adaptation', () => {
    test('should learn tool combinations from usage', async () => {
      // Record successful combinations
      metaTools.recordSuccessfulChain({
        steps: ['file_read', 'json_parse', 'data_transform'],
        context: { fileType: 'json', goal: 'transform' }
      });
      metaTools.recordSuccessfulChain({
        steps: ['file_read', 'json_parse', 'data_transform'],
        context: { fileType: 'json', goal: 'transform' }
      });
      
      const learned = await metaTools.getLearnedPatterns();
      
      expect(learned.patterns).toBeDefined();
      expect(learned.patterns[0].frequency).toBe(2);
      expect(learned.patterns[0].successRate).toBe(1);
    });

    test('should adapt suggestions based on feedback', async () => {
      const suggestion = await metaTools.suggestTools({ query: 'process data' });
      
      // Provide negative feedback
      await metaTools.provideFeedback({
        suggestionId: suggestion.id,
        helpful: false,
        correctTools: ['data_transform']
      });
      
      // Get new suggestions
      const newSuggestion = await metaTools.suggestTools({ query: 'process data' });
      
      expect(newSuggestion.suggestions[0].tool).toBe('data_transform');
      expect(newSuggestion.adapted).toBe(true);
    });

    test('should personalize tool recommendations', async () => {
      // Set user preferences
      await metaTools.setUserPreferences({
        preferredTools: ['file_read', 'file_write'],
        avoidTools: ['api_fetch'],
        skillLevel: 'intermediate'
      });
      
      const suggestions = await metaTools.suggestTools({
        query: 'save data',
        personalized: true
      });
      
      expect(suggestions.suggestions.some(s => s.tool === 'file_write')).toBe(true);
      expect(suggestions.suggestions.some(s => s.tool === 'api_fetch')).toBe(false);
      expect(suggestions.personalizedFor).toBeDefined();
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle tool execution failures gracefully', async () => {
      const failingTool = {
        name: 'failing_tool',
        execute: async () => {
          throw new Error('Tool execution failed');
        }
      };
      toolRegistry.registerTool(failingTool);
      
      const chain = {
        steps: [
          { tool: 'file_read', params: {} },
          { tool: 'failing_tool', params: {} },
          { tool: 'file_write', params: {} }
        ]
      };
      
      const execution = await metaTools.executeToolChain(chain, {
        continueOnError: true
      });
      
      expect(execution.status).toBe('partial');
      expect(execution.errors).toHaveLength(1);
      expect(execution.completedSteps).toBe(2); // file_read succeeded, file_write also ran
    });

    test('should suggest recovery strategies', async () => {
      const failedExecution = {
        chain: { steps: [{ tool: 'api_fetch' }, { tool: 'json_parse' }] },
        error: 'Network timeout',
        failedStep: 0
      };
      
      const recovery = await metaTools.suggestRecoveryStrategy(failedExecution);
      
      expect(recovery.strategies).toBeDefined();
      expect(recovery.strategies.some(s => s.type === 'retry')).toBe(true);
      expect(recovery.strategies.some(s => s.type === 'fallback')).toBe(true);
      expect(recovery.recommendedStrategy).toBeDefined();
    });
  });
});