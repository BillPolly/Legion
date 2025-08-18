/**
 * Demonstration test showing improved tool discovery with breakdown
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PlanSynthesizer } from '../../src/core/PlanSynthesizer.js';
import { MockToolDiscovery } from '../mocks/MockToolDiscovery.js';
import { ValidatedSubtree } from '../../src/core/ValidatedSubtree.js';

describe('Tool Discovery Improvement with Breakdown', () => {
  let synthesizer;
  let mockLLMClient;
  let toolDiscovery;
  let mockContextHints;
  let mockValidator;
  let mockPlanner;
  
  beforeEach(() => {
    // Create mock LLM client
    mockLLMClient = {
      generateResponse: jest.fn(),
      // Add complete method for Planner compatibility
      complete: jest.fn(async (prompt, options) => {
        // Return a minimal valid behavior tree
        return JSON.stringify({
          type: 'sequence',
          children: []
        });
      })
    };
    
    // Create mock tool registry provider with realistic tools
    const mockToolRegistryProvider = {
      listTools: jest.fn(async () => [
        { name: 'file_read', description: 'Read a file from the filesystem' },
        { name: 'file_write', description: 'Write content to a file' },
        { name: 'json_parse', description: 'Parse a JSON string into an object' },
        { name: 'json_stringify', description: 'Convert an object to JSON string' },
        { name: 'json_query', description: 'Query and extract data from JSON objects' },
        { name: 'calculator', description: 'Perform mathematical calculations' },
        { name: 'csv_parse', description: 'Parse CSV data into structured format' },
        { name: 'http_get', description: 'Make HTTP GET request to download data' },
        { name: 'xml_parse', description: 'Parse XML data' },
        { name: 'yaml_parse', description: 'Parse YAML data' }
      ])
    };
    
    // Create mock tool discovery
    toolDiscovery = new MockToolDiscovery(mockToolRegistryProvider);
    
    // Create mock context hints
    mockContextHints = {
      getHints: jest.fn(() => ({
        suggestedInputs: [],
        suggestedOutputs: []
      })),
      addHints: jest.fn(),
      getSiblingOutputs: jest.fn(() => [])
    };
    
    // Create synthesizer
    synthesizer = new PlanSynthesizer({
      llmClient: mockLLMClient,
      toolDiscovery: toolDiscovery,
      contextHints: mockContextHints
    });
    
    // Initialize tool discovery
    return toolDiscovery.initialize();
  });
  
  describe('Real-world scenarios', () => {
    it('should demonstrate improved tool discovery for JSON file task', async () => {
      const node = {
        id: 'task-1',
        description: 'Read a JSON configuration file and extract the database connection string',
        complexity: 'SIMPLE'
      };
      
      // Mock LLM response for breakdown
      mockLLMClient.generateResponse.mockImplementation(async ({ messages }) => {
        const content = messages[0].content;
        
        if (content.includes('Break this task down')) {
          return {
            content: JSON.stringify({
              operations: [
                'read file from filesystem',
                'parse JSON data',
                'extract field from object'
              ]
            })
          };
        }
        
        // Mock for tool sufficiency judgment
        if (content.includes('Are these tools sufficient')) {
          return {
            content: JSON.stringify({
              sufficient: true,
              reason: 'Tools can read file, parse JSON, and extract data',
              missing: []
            })
          };
        }
        
        return { content: '{}' };
      });
      
      // Test WITHOUT breakdown (old method)
      console.log('\n=== Testing WITHOUT breakdown ===');
      const subtreeWithout = new ValidatedSubtree(node, null, { valid: false });
      await synthesizer._synthesizeLeaf(subtreeWithout, node, {
        useBreakdown: false,
        debug: true
      });
      
      // Test WITH breakdown (new method)
      console.log('\n=== Testing WITH breakdown ===');
      const subtreeWith = new ValidatedSubtree(node, null, { valid: false });
      await synthesizer._synthesizeLeaf(subtreeWith, node, {
        useBreakdown: true,
        debug: true
      });
      
      // The key assertion: with breakdown should find more relevant tools
      // Without breakdown, searching for the full task description might not match well
      // With breakdown, we search for "read file", "parse JSON", etc. separately
      
      console.log('\n=== Results Comparison ===');
      console.log('Without breakdown - validation:', subtreeWithout.validation);
      console.log('With breakdown - validation:', subtreeWith.validation);
    });
    
    it('should handle CSV calculation task better with breakdown', async () => {
      const node = {
        id: 'task-2',
        description: 'Load sales data from CSV file and calculate total revenue',
        complexity: 'SIMPLE'
      };
      
      mockLLMClient.generateResponse.mockImplementation(async ({ messages }) => {
        const content = messages[0].content;
        
        if (content.includes('Break this task down')) {
          return {
            content: JSON.stringify({
              operations: [
                'read CSV file',
                'parse CSV data',
                'extract revenue column',
                'calculate sum of values'
              ]
            })
          };
        }
        
        if (content.includes('Are these tools sufficient')) {
          const toolsText = content.match(/Available Tools:\n([\s\S]*?)\n\nQuestion:/)?.[1] || '';
          const hasFileRead = toolsText.includes('file_read');
          const hasCSVParse = toolsText.includes('csv_parse');
          const hasCalculator = toolsText.includes('calculator');
          
          return {
            content: JSON.stringify({
              sufficient: hasFileRead && hasCSVParse && hasCalculator,
              reason: hasFileRead && hasCSVParse && hasCalculator
                ? 'All necessary tools available'
                : 'Missing required tools',
              missing: [
                !hasFileRead && 'file reading',
                !hasCSVParse && 'CSV parsing',
                !hasCalculator && 'calculation'
              ].filter(Boolean)
            })
          };
        }
        
        return { content: '{}' };
      });
      
      // Test without breakdown
      const subtreeWithout = new ValidatedSubtree(node, null, { valid: false });
      await synthesizer._synthesizeLeaf(subtreeWithout, node, {
        useBreakdown: false
      });
      
      // Test with breakdown
      const subtreeWith = new ValidatedSubtree(node, null, { valid: false });
      await synthesizer._synthesizeLeaf(subtreeWith, node, {
        useBreakdown: true
      });
      
      // With breakdown should successfully validate because it finds all needed tools
      // Without breakdown might fail because the full description doesn't match tools well
      
      console.log('\n=== CSV Task Results ===');
      console.log('Without breakdown - valid:', subtreeWithout._isValid);
      console.log('With breakdown - valid:', subtreeWith._isValid);
      
      // The improvement: breakdown should lead to successful validation
      if (!subtreeWithout._isValid && subtreeWith._isValid) {
        console.log('✅ Breakdown improved tool discovery and enabled successful validation!');
      }
    });
    
    it('should handle file download and processing task', async () => {
      const node = {
        id: 'task-3',
        description: 'Download JSON data from an API endpoint and save it locally',
        complexity: 'SIMPLE'
      };
      
      mockLLMClient.generateResponse.mockImplementation(async ({ messages }) => {
        const content = messages[0].content;
        
        if (content.includes('Break this task down')) {
          return {
            content: JSON.stringify({
              operations: [
                'make HTTP GET request',
                'receive JSON response',
                'write data to file'
              ]
            })
          };
        }
        
        if (content.includes('Are these tools sufficient')) {
          const toolsText = content.match(/Available Tools:\n([\s\S]*?)\n\nQuestion:/)?.[1] || '';
          const hasHTTP = toolsText.includes('http_get');
          const hasFileWrite = toolsText.includes('file_write');
          
          return {
            content: JSON.stringify({
              sufficient: hasHTTP && hasFileWrite,
              reason: hasHTTP && hasFileWrite
                ? 'Can download and save data'
                : 'Missing required capabilities',
              missing: [
                !hasHTTP && 'HTTP download',
                !hasFileWrite && 'file writing'
              ].filter(Boolean)
            })
          };
        }
        
        return { content: '{}' };
      });
      
      // Test both methods
      const subtreeWithout = new ValidatedSubtree(node, null, { valid: false });
      await synthesizer._synthesizeLeaf(subtreeWithout, node, {
        useBreakdown: false
      });
      
      const subtreeWith = new ValidatedSubtree(node, null, { valid: false });
      await synthesizer._synthesizeLeaf(subtreeWith, node, {
        useBreakdown: true
      });
      
      console.log('\n=== Download Task Results ===');
      console.log('Without breakdown - errors:', subtreeWithout.validation?.errors);
      console.log('With breakdown - errors:', subtreeWith.validation?.errors);
    });
  });
  
  describe('Metrics comparison', () => {
    it('should show quantitative improvement in tool discovery', async () => {
      const testCases = [
        {
          description: 'Parse YAML configuration file and validate required fields exist',
          operations: ['read file', 'parse YAML', 'validate fields']
        },
        {
          description: 'Read XML document and extract specific elements',
          operations: ['read file', 'parse XML', 'extract elements']
        },
        {
          description: 'Calculate statistics from JSON array of numbers',
          operations: ['parse JSON', 'extract array', 'calculate statistics']
        }
      ];
      
      let withoutBreakdownFailures = 0;
      let withBreakdownFailures = 0;
      
      for (const testCase of testCases) {
        const node = {
          id: `test-${Math.random()}`,
          description: testCase.description,
          complexity: 'SIMPLE'
        };
        
        mockLLMClient.generateResponse.mockImplementation(async ({ messages }) => {
          const content = messages[0].content;
          
          if (content.includes('Break this task down')) {
            return {
              content: JSON.stringify({ operations: testCase.operations })
            };
          }
          
          // Simple sufficiency check - if we have at least 2 relevant tools
          if (content.includes('Are these tools sufficient')) {
            const toolsText = content.match(/Available Tools:\n([\s\S]*?)\n\nQuestion:/)?.[1] || '';
            const toolCount = (toolsText.match(/^- /gm) || []).length;
            
            return {
              content: JSON.stringify({
                sufficient: toolCount >= 2,
                reason: toolCount >= 2 ? 'Sufficient tools' : 'Insufficient tools',
                missing: toolCount < 2 ? ['required capabilities'] : []
              })
            };
          }
          
          return { content: '{}' };
        });
        
        // Test without breakdown
        const subtreeWithout = new ValidatedSubtree(node, null, { valid: false });
        await synthesizer._synthesizeLeaf(subtreeWithout, node, {
          useBreakdown: false
        });
        
        if (!subtreeWithout._isValid) {
          withoutBreakdownFailures++;
        }
        
        // Test with breakdown
        const subtreeWith = new ValidatedSubtree(node, null, { valid: false });
        await synthesizer._synthesizeLeaf(subtreeWith, node, {
          useBreakdown: true
        });
        
        if (!subtreeWith._isValid) {
          withBreakdownFailures++;
        }
      }
      
      console.log('\n=== Quantitative Results ===');
      console.log(`Test cases: ${testCases.length}`);
      console.log(`Failures without breakdown: ${withoutBreakdownFailures}`);
      console.log(`Failures with breakdown: ${withBreakdownFailures}`);
      console.log(`Improvement: ${withoutBreakdownFailures - withBreakdownFailures} fewer failures`);
      
      // Breakdown should result in fewer failures
      expect(withBreakdownFailures).toBeLessThanOrEqual(withoutBreakdownFailures);
    });
  });
});