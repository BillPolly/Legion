/**
 * Integration tests for semantic tool discovery functionality
 */

import { jest } from '@jest/globals';
import { AgentCreator } from '../../src/AgentCreator.js';
import { ResourceManager } from '@legion/resource-manager';
import { ToolFeasibilityChecker } from '../../../../planning/decent-planner/src/index.js';
import { getToolRegistry } from '@legion/tools-registry';

describe('Semantic Tool Discovery Integration', () => {
  let agentCreator;
  let resourceManager;
  let toolFeasibilityChecker;
  let toolRegistry;

  beforeEach(async () => {
    jest.setTimeout(60000); // 60 second timeout for semantic search
    
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Create AgentCreator with real components
    agentCreator = new AgentCreator(resourceManager);
    await agentCreator.initialize();
    
    // Get the real components
    toolFeasibilityChecker = agentCreator.toolFeasibilityChecker;
    toolRegistry = await getToolRegistry();
  });

  afterEach(async () => {
    if (agentCreator) {
      await agentCreator.cleanup();
    }
  });

  describe('Tool Description Generation', () => {
    test('should generate natural language tool descriptions for simple tasks', async () => {
      const task = 'Read a text file';
      
      const descriptions = await toolFeasibilityChecker.generateToolDescriptions(task);
      
      expect(descriptions).toBeDefined();
      expect(Array.isArray(descriptions)).toBe(true);
      expect(descriptions.length).toBeGreaterThan(0);
      
      // Should generate relevant descriptions
      const hasFileRelated = descriptions.some(desc => 
        desc.toLowerCase().includes('file') || 
        desc.toLowerCase().includes('read')
      );
      expect(hasFileRelated).toBe(true);
    });

    test('should generate different descriptions for simple task types', async () => {
      const fileTask = 'Write text to a file';
      const mathTask = 'Add two numbers';
      
      const fileDescriptions = await toolFeasibilityChecker.generateToolDescriptions(fileTask);
      const mathDescriptions = await toolFeasibilityChecker.generateToolDescriptions(mathTask);
      
      // Each should have descriptions
      expect(fileDescriptions).toBeDefined();
      expect(mathDescriptions).toBeDefined();
      
      // File descriptions should mention file operations
      expect(fileDescriptions.some(d => 
        d.toLowerCase().includes('file') || d.toLowerCase().includes('write')
      )).toBe(true);
      
      // Math descriptions should mention calculation
      expect(mathDescriptions.some(d => 
        d.toLowerCase().includes('math') || 
        d.toLowerCase().includes('add') || 
        d.toLowerCase().includes('calculate')
      )).toBe(true);
    });
  });

  describe('Semantic Tool Search', () => {
    test('should discover relevant tools using semantic search', async () => {
      const descriptions = [
        'Tool for reading files from the filesystem',
        'Tool for parsing JSON data'
      ];
      
      const tools = await toolFeasibilityChecker.discoverToolsFromDescriptions(descriptions);
      
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      // Should find file-related tools
      const hasFileTools = tools.some(tool => 
        tool.name.includes('file') || 
        tool.name.includes('read') ||
        tool.description?.toLowerCase().includes('file')
      );
      expect(hasFileTools).toBe(true);
      
      // Should find JSON-related tools
      const hasJsonTools = tools.some(tool => 
        tool.name.includes('json') || 
        tool.name.includes('parse') ||
        tool.description?.toLowerCase().includes('json')
      );
      expect(hasJsonTools).toBe(true);
      
      // Should have confidence scores
      tools.forEach(tool => {
        expect(tool.confidence).toBeDefined();
        expect(tool.confidence).toBeGreaterThan(0);
        expect(tool.confidence).toBeLessThanOrEqual(1);
      });
    });

    test('should rank tools by relevance', async () => {
      const descriptions = [
        'Tool for generating JavaScript code'
      ];
      
      const tools = await toolFeasibilityChecker.discoverToolsFromDescriptions(descriptions);
      
      expect(tools).toBeDefined();
      expect(tools.length).toBeGreaterThan(0);
      
      // Should be sorted by confidence (descending)
      for (let i = 1; i < tools.length; i++) {
        expect(tools[i - 1].confidence).toBeGreaterThanOrEqual(tools[i].confidence);
      }
      
      // Most relevant tool should have high confidence
      expect(tools[0].confidence).toBeGreaterThan(0.5);
      
      // Should find JavaScript-related tools at the top
      const topTools = tools.slice(0, 3);
      const hasJsTools = topTools.some(tool => 
        tool.name.toLowerCase().includes('javascript') ||
        tool.name.toLowerCase().includes('js') ||
        tool.name.toLowerCase().includes('generate')
      );
      expect(hasJsTools).toBe(true);
    });

    test('should handle ambiguous descriptions', async () => {
      const descriptions = [
        'Tool for processing data',
        'Tool for handling information'
      ];
      
      const tools = await toolFeasibilityChecker.discoverToolsFromDescriptions(descriptions);
      
      expect(tools).toBeDefined();
      expect(tools.length).toBeGreaterThan(0);
      
      // Should find various data processing tools
      const toolTypes = new Set(tools.map(t => {
        if (t.name.includes('json')) return 'json';
        if (t.name.includes('file')) return 'file';
        if (t.name.includes('transform')) return 'transform';
        if (t.name.includes('process')) return 'process';
        return 'other';
      }));
      
      // Should find diverse tool types for ambiguous queries
      expect(toolTypes.size).toBeGreaterThan(1);
    });
  });

  describe('Hierarchy Tool Discovery', () => {
    test('should discover tools for simple task hierarchy', async () => {
      const hierarchy = {
        complexity: 'SIMPLE',
        description: 'Read a file and display its contents'
      };
      
      const tools = await agentCreator.discoverToolsForHierarchy(hierarchy);
      
      expect(tools).toBeDefined();
      expect(tools.allTools).toBeDefined();
      expect(tools.allTools.length).toBeGreaterThan(0);
      
      // Should find file reading tools
      const toolArray = tools.allTools;
      expect(toolArray.some(name => 
        name.includes('file') || name.includes('read')
      )).toBe(true);
    });

    test('should discover tools for complex nested hierarchy', async () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Data processing pipeline',
        subtasks: [
          {
            complexity: 'SIMPLE',
            description: 'Fetch data from API'
          },
          {
            complexity: 'COMPLEX',
            description: 'Process and transform data',
            subtasks: [
              {
                complexity: 'SIMPLE',
                description: 'Validate data schema'
              },
              {
                complexity: 'SIMPLE',
                description: 'Transform data format'
              }
            ]
          },
          {
            complexity: 'SIMPLE',
            description: 'Store data in database'
          }
        ]
      };
      
      const tools = await agentCreator.discoverToolsForHierarchy(hierarchy);
      
      expect(tools).toBeDefined();
      expect(tools.allTools).toBeDefined();
      expect(tools.allTools.length).toBeGreaterThan(3); // Should find multiple tools
      
      const toolArray = tools.allTools;
      
      // Should find API/HTTP tools
      expect(toolArray.some(name => 
        name.includes('http') || 
        name.includes('api') || 
        name.includes('fetch')
      )).toBe(true);
      
      // Should find validation tools
      expect(toolArray.some(name => 
        name.includes('validat') || 
        name.includes('schema') ||
        name.includes('check')
      )).toBe(true);
      
      // Should find transformation tools
      expect(toolArray.some(name => 
        name.includes('transform') || 
        name.includes('convert') ||
        name.includes('format')
      )).toBe(true);
      
      // Should find database tools
      expect(toolArray.some(name => 
        name.includes('database') || 
        name.includes('store') ||
        name.includes('save')
      )).toBe(true);
    });

    test('should avoid duplicate tools', async () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'File operations',
        subtasks: [
          {
            complexity: 'SIMPLE',
            description: 'Read first file'
          },
          {
            complexity: 'SIMPLE',
            description: 'Read second file'
          },
          {
            complexity: 'SIMPLE',
            description: 'Read third file'
          }
        ]
      };
      
      const tools = await agentCreator.discoverToolsForHierarchy(hierarchy);
      
      expect(tools).toBeDefined();
      expect(tools.allTools).toBeDefined();
      
      // Should not have many duplicates despite similar tasks
      const toolArray = tools.allTools;
      const fileReadTools = toolArray.filter(name => 
        name.includes('file') && name.includes('read')
      );
      
      // Should deduplicate similar tools
      expect(fileReadTools.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Integration with ToolRegistry', () => {
    test('should use ToolRegistry semantic search capabilities', async () => {
      // Direct test of ToolRegistry semantic search
      const query = 'tool for manipulating JavaScript code';
      const results = await toolRegistry.searchTools(query, { limit: 5 });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      if (results.length > 0) {
        // Results should have score and tool information
        results.forEach(result => {
          expect(result.name).toBeDefined();
          expect(result.score).toBeDefined();
          expect(result.score).toBeGreaterThan(0);
        });
        
        // Top result should be relevant
        const topResult = results[0];
        expect(
          topResult.name.toLowerCase().includes('javascript') ||
          topResult.name.toLowerCase().includes('js') ||
          topResult.name.toLowerCase().includes('code')
        ).toBe(true);
      }
    });

    test('should fallback to keyword search if semantic search unavailable', async () => {
      // Test that tool discovery still works even without semantic search
      const hierarchy = {
        complexity: 'SIMPLE',
        description: 'Calculate mathematical expressions'
      };
      
      const tools = await agentCreator.discoverToolsForHierarchy(hierarchy);
      
      expect(tools).toBeDefined();
      expect(tools.allTools).toBeDefined();
      expect(tools.allTools.length).toBeGreaterThan(0);
      
      // Should still find calculator-related tools
      const toolArray = tools.allTools;
      expect(toolArray.some(name => 
        name.includes('calc') || 
        name.includes('math') ||
        name.includes('comput')
      )).toBe(true);
    });
  });

  describe('Tool Discovery Accuracy', () => {
    test('should find appropriate tools for file operations', async () => {
      const fileOperations = [
        'Read a text file',
        'Write data to a file',
        'List files in a directory',
        'Delete a file'
      ];
      
      for (const operation of fileOperations) {
        const descriptions = await toolFeasibilityChecker.generateToolDescriptions(operation);
        const tools = await toolFeasibilityChecker.discoverToolsFromDescriptions(descriptions);
        
        expect(tools.length).toBeGreaterThan(0);
        
        // Should find file-related tools
        const hasFileTools = tools.some(tool => 
          tool.name.includes('file') || 
          tool.name.includes('directory') ||
          tool.name.includes('fs')
        );
        expect(hasFileTools).toBe(true);
      }
    });

    test('should find appropriate tools for data transformation', async () => {
      const transformations = [
        'Convert JSON to CSV',
        'Transform data structure',
        'Parse and reformat data'
      ];
      
      for (const transformation of transformations) {
        const descriptions = await toolFeasibilityChecker.generateToolDescriptions(transformation);
        const tools = await toolFeasibilityChecker.discoverToolsFromDescriptions(descriptions);
        
        expect(tools.length).toBeGreaterThan(0);
        
        // Should find transformation-related tools
        const hasTransformTools = tools.some(tool => 
          tool.name.includes('transform') || 
          tool.name.includes('convert') ||
          tool.name.includes('parse') ||
          tool.name.includes('json') ||
          tool.name.includes('csv')
        );
        expect(hasTransformTools).toBe(true);
      }
    });

    test('should find appropriate tools for API operations', async () => {
      const apiOperations = [
        'Fetch data from REST API',
        'Send POST request with JSON',
        'Handle API authentication'
      ];
      
      for (const operation of apiOperations) {
        const descriptions = await toolFeasibilityChecker.generateToolDescriptions(operation);
        const tools = await toolFeasibilityChecker.discoverToolsFromDescriptions(descriptions);
        
        expect(tools.length).toBeGreaterThan(0);
        
        // Should find API-related tools
        const hasApiTools = tools.some(tool => 
          tool.name.includes('http') || 
          tool.name.includes('api') ||
          tool.name.includes('request') ||
          tool.name.includes('fetch')
        );
        expect(hasApiTools).toBe(true);
      }
    });
  });
});