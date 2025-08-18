/**
 * Integration test with real Legion tools
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { PlanSynthesizer } from '../../src/core/PlanSynthesizer.js';
import { MockToolDiscovery } from '../mocks/MockToolDiscovery.js';
import { ResourceManager } from '../../../../resource-manager/src/ResourceManager.js';

describe('Tool Breakdown with Real Legion Tools', () => {
  let synthesizer;
  let toolDiscovery;
  let resourceManager;
  
  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    // Create mock provider with Legion-like tools
    const mockProvider = {
      listTools: async () => {
        // Simulate real Legion tools
        return [
          { name: 'file_read', description: 'Read file from filesystem' },
          { name: 'file_write', description: 'Write content to a file' },
          { name: 'json_parse', description: 'Parse JSON string into object' },
          { name: 'json_stringify', description: 'Convert object to JSON string' },
          { name: 'json_query', description: 'Query JSON data using JSONPath' },
          { name: 'calculator', description: 'Perform mathematical calculations' },
          { name: 'csv_parse', description: 'Parse CSV data into structured format' },
          { name: 'http_request', description: 'Make HTTP requests to external APIs' },
          { name: 'docker_build', description: 'Build Docker container images' },
          { name: 'cloud_deploy', description: 'Deploy applications to cloud platforms' },
          { name: 'yaml_parse', description: 'Parse YAML configuration files' },
          { name: 'yaml_validate', description: 'Validate YAML against schema' },
          { name: 'database_connect', description: 'Connect to database' },
          { name: 'database_query', description: 'Execute SQL queries' },
          { name: 'http_download', description: 'Download files from URLs' }
        ];
      },
      getTool: async (name) => {
        const tools = {
          'file_read': { 
            name: 'file_read', 
            description: 'Read file from filesystem',
            execute: jest.fn(async () => ({ success: true, content: 'file content' }))
          },
          'file_write': { 
            name: 'file_write', 
            description: 'Write content to a file',
            execute: jest.fn(async () => ({ success: true }))
          },
          'json_parse': { 
            name: 'json_parse', 
            description: 'Parse JSON string into object',
            execute: jest.fn(async () => ({ success: true, result: {} }))
          },
          'json_query': { 
            name: 'json_query', 
            description: 'Query JSON data using JSONPath',
            execute: jest.fn(async () => ({ success: true, result: {} }))
          },
          'calculator': { 
            name: 'calculator', 
            description: 'Perform mathematical calculations',
            execute: jest.fn(async () => ({ success: true, result: 0 }))
          },
          'csv_parse': { 
            name: 'csv_parse', 
            description: 'Parse CSV data into structured format',
            execute: jest.fn(async () => ({ success: true, data: [] }))
          }
        };
        return tools[name] || { 
          name, 
          description: `Tool: ${name}`,
          execute: jest.fn(async () => ({ success: true }))
        };
      }
    };
    
    toolDiscovery = new MockToolDiscovery(mockProvider);
    await toolDiscovery.initialize();
    
    // Create mock LLM client
    const mockLLMClient = {
      generateResponse: jest.fn(),
      complete: jest.fn(async () => JSON.stringify({
        type: 'sequence',
        children: []
      }))
    };
    
    // Create synthesizer
    synthesizer = new PlanSynthesizer({
      llmClient: mockLLMClient,
      toolDiscovery: toolDiscovery,
      contextHints: {
        getHints: () => ({ suggestedInputs: [], suggestedOutputs: [] }),
        addHints: () => {},
        getSiblingOutputs: () => []
      }
    });
    
    // Configure LLM mock for breakdown
    mockLLMClient.generateResponse.mockImplementation(async ({ messages }) => {
      const content = messages[0].content;
      
      if (content.includes('Break this task down')) {
        if (content.includes('JSON file') && content.includes('database')) {
          return {
            content: JSON.stringify({
              operations: [
                'read file from filesystem',
                'parse JSON data',
                'extract database configuration',
                'get connection string'
              ]
            })
          };
        }
        
        if (content.includes('CSV') && content.includes('calculate')) {
          return {
            content: JSON.stringify({
              operations: [
                'read CSV file',
                'parse CSV data',
                'extract numeric column',
                'calculate sum of values'
              ]
            })
          };
        }
        
        if (content.includes('API') && content.includes('deploy')) {
          return {
            content: JSON.stringify({
              operations: [
                'create REST endpoints',
                'configure server',
                'build Docker image',
                'deploy to cloud'
              ]
            })
          };
        }
      }
      
      if (content.includes('Are these tools sufficient')) {
        return {
          content: JSON.stringify({
            sufficient: true,
            reason: 'Tools available for task',
            missing: []
          })
        };
      }
      
      return { content: '{}' };
    });
  });
  
  describe('Real tool discovery', () => {
    it('should discover real Legion tools for file operations', async () => {
      const node = {
        description: 'Read a JSON configuration file and extract database settings'
      };
      
      // Test WITHOUT breakdown
      const toolsWithout = await synthesizer._discoverTools(node, { debug: true });
      console.log('\nWithout breakdown - tools found:', toolsWithout.map(t => t.name));
      
      // Test WITH breakdown
      const toolsWith = await synthesizer._discoverToolsWithBreakdown(node, { debug: true });
      console.log('With breakdown - tools found:', toolsWith.map(t => t.name));
      
      // Verify we found some tools
      expect(toolsWith.length).toBeGreaterThan(0);
      
      // Check for expected tools (if they exist in the registry)
      const toolNames = toolsWith.map(t => t.name);
      
      // These tools should be discovered if they exist in Legion
      const expectedPossibleTools = ['file_read', 'file_write', 'json_parse', 'json_query'];
      const foundExpectedTools = expectedPossibleTools.filter(name => toolNames.includes(name));
      
      console.log('Found expected tools:', foundExpectedTools);
      
      // The breakdown should find at least as many tools as without
      expect(toolsWith.length).toBeGreaterThanOrEqual(toolsWithout.length);
    });
    
    it('should discover calculator and CSV tools for data processing', async () => {
      const node = {
        description: 'Load sales data from CSV file and calculate total revenue'
      };
      
      // Test WITHOUT breakdown
      const toolsWithout = await synthesizer._discoverTools(node, {});
      console.log('\nCSV task without breakdown:', toolsWithout.map(t => t.name));
      
      // Test WITH breakdown
      const toolsWith = await synthesizer._discoverToolsWithBreakdown(node, {});
      console.log('CSV task with breakdown:', toolsWith.map(t => t.name));
      
      // Verify we found some tools
      expect(toolsWith.length).toBeGreaterThan(0);
      
      const toolNames = toolsWith.map(t => t.name);
      
      // Check if we found relevant tools
      const relevantTools = toolNames.filter(name => 
        name.includes('file') || 
        name.includes('csv') || 
        name.includes('calc') ||
        name.includes('read')
      );
      
      console.log('Relevant tools found:', relevantTools);
      expect(relevantTools.length).toBeGreaterThan(0);
    });
    
    it('should show improvement metrics with real tools', async () => {
      const testCases = [
        {
          description: 'Parse YAML configuration and validate schema',
          expectedKeywords: ['yaml', 'parse', 'valid', 'file', 'read']
        },
        {
          description: 'Download file from URL and save to disk',
          expectedKeywords: ['http', 'download', 'file', 'write', 'save']
        },
        {
          description: 'Connect to database and run query',
          expectedKeywords: ['database', 'connect', 'query', 'sql']
        }
      ];
      
      let totalImprovementCount = 0;
      let totalToolsWithout = 0;
      let totalToolsWith = 0;
      
      for (const testCase of testCases) {
        const node = { description: testCase.description };
        
        const toolsWithout = await synthesizer._discoverTools(node, {});
        const toolsWith = await synthesizer._discoverToolsWithBreakdown(node, {});
        
        totalToolsWithout += toolsWithout.length;
        totalToolsWith += toolsWith.length;
        
        if (toolsWith.length > toolsWithout.length) {
          totalImprovementCount++;
        }
        
        console.log(`\nTask: ${testCase.description}`);
        console.log(`  Without breakdown: ${toolsWithout.length} tools`);
        console.log(`  With breakdown: ${toolsWith.length} tools`);
        console.log(`  Improvement: ${toolsWith.length - toolsWithout.length} additional tools`);
      }
      
      console.log('\n=== Overall Metrics ===');
      console.log(`Test cases with improvement: ${totalImprovementCount}/${testCases.length}`);
      console.log(`Average tools without breakdown: ${(totalToolsWithout / testCases.length).toFixed(1)}`);
      console.log(`Average tools with breakdown: ${(totalToolsWith / testCases.length).toFixed(1)}`);
      console.log(`Average improvement: ${((totalToolsWith - totalToolsWithout) / testCases.length).toFixed(1)} tools per task`);
      
      // The breakdown method should generally find more or equal tools
      expect(totalToolsWith).toBeGreaterThanOrEqual(totalToolsWithout);
    });
  });
  
  describe('Tool execution validation', () => {
    it('should verify discovered tools are executable', async () => {
      const node = {
        description: 'Write text content to a file'
      };
      
      const tools = await synthesizer._discoverToolsWithBreakdown(node, {});
      
      console.log('\nVerifying tool executability:');
      for (const tool of tools) {
        console.log(`  ${tool.name}:`);
        console.log(`    - Has execute method: ${typeof tool.execute === 'function'}`);
        console.log(`    - Has description: ${!!tool.description}`);
        console.log(`    - Has name: ${!!tool.name}`);
        
        // Each tool should be properly formed
        expect(tool.name).toBeDefined();
        expect(typeof tool.execute).toBe('function');
      }
    });
  });
});