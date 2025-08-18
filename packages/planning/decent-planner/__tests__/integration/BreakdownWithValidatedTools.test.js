/**
 * Test breakdown functionality with validated tools only
 */

import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import { PlanSynthesizer } from '../../src/core/PlanSynthesizer.js';
import { MockToolDiscovery } from '../mocks/MockToolDiscovery.js';
import { ResourceManager } from '../../../../resource-manager/src/ResourceManager.js';

describe('Breakdown with Validated Tools', () => {
  let synthesizer;
  let toolDiscovery;
  let resourceManager;
  
  // Define our validated tools with proper metadata
  const VALIDATED_TOOLS = {
    'file_read': { 
      name: 'file_read', 
      description: 'Read file from filesystem',
      inputSchema: { filepath: 'string' },
      outputSchema: { content: 'string' },
      execute: jest.fn(async (args) => ({ success: true, content: 'mock content' }))
    },
    'file_write': { 
      name: 'file_write', 
      description: 'Write content to a file',
      inputSchema: { filepath: 'string', content: 'string' },
      outputSchema: { success: 'boolean' },
      execute: jest.fn(async (args) => ({ success: true }))
    },
    'json_parse': { 
      name: 'json_parse', 
      description: 'Parse JSON string into object',
      inputSchema: { json_string: 'string' },
      outputSchema: { result: 'object' },
      execute: jest.fn(async (args) => ({ success: true, result: {} }))
    },
    'calculator': { 
      name: 'calculator', 
      description: 'Perform mathematical calculations',
      inputSchema: { expression: 'string' },
      outputSchema: { result: 'number' },
      execute: jest.fn(async (args) => ({ success: true, result: 42 }))
    }
  };
  
  beforeAll(async () => {
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    // Create mock provider that only returns our validated tools
    const mockProvider = {
      listTools: async () => Object.values(VALIDATED_TOOLS),
      getTool: async (name) => VALIDATED_TOOLS[name] || null
    };
    
    toolDiscovery = new MockToolDiscovery(mockProvider);
    await toolDiscovery.initialize();
    
    // Create mock LLM client for breakdown
    const mockLLMClient = {
      generateResponse: jest.fn(),
      complete: jest.fn(async () => JSON.stringify({
        type: 'sequence',
        children: []
      }))
    };
    
    // Configure LLM mock for realistic breakdowns
    mockLLMClient.generateResponse.mockImplementation(async ({ messages }) => {
      const content = messages[0].content;
      
      if (content.includes('Break this task down')) {
        // Scenario 1: Read and parse JSON config file
        if (content.includes('Read') && content.includes('JSON') && content.includes('config')) {
          return {
            content: JSON.stringify({
              operations: [
                'read file from filesystem',
                'parse JSON string into object'
              ]
            })
          };
        }
        
        // Scenario 2: Calculate and write result
        if (content.includes('Calculate') && content.includes('write')) {
          return {
            content: JSON.stringify({
              operations: [
                'perform mathematical calculation',
                'write result to file'
              ]
            })
          };
        }
        
        // Scenario 3: Read, parse, calculate from JSON
        if (content.includes('process') && content.includes('JSON')) {
          return {
            content: JSON.stringify({
              operations: [
                'read file from filesystem',
                'parse JSON data',
                'perform calculation on values'
              ]
            })
          };
        }
        
        // Default breakdown
        return {
          content: JSON.stringify({
            operations: ['read file', 'process data']
          })
        };
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
    
    synthesizer = new PlanSynthesizer({
      llmClient: mockLLMClient,
      toolDiscovery: toolDiscovery,
      contextHints: {
        getHints: () => ({ suggestedInputs: [], suggestedOutputs: [] }),
        addHints: () => {},
        getSiblingOutputs: () => []
      }
    });
  });
  
  describe('Tool discovery without breakdown', () => {
    it('should find limited tools with direct search', async () => {
      const node = {
        description: 'Read a JSON configuration file and extract settings'
      };
      
      const tools = await synthesizer._discoverTools(node, {});
      
      console.log('\n=== WITHOUT BREAKDOWN ===');
      console.log(`Task: "${node.description}"`);
      console.log(`Found ${tools.length} tools:`);
      tools.forEach(t => console.log(`  - ${t.name}`));
      
      // Direct search might miss some relevant tools
      expect(tools.length).toBeGreaterThanOrEqual(0);
      expect(tools.length).toBeLessThanOrEqual(4); // We only have 4 tools total
    });
  });
  
  describe('Tool discovery with breakdown', () => {
    it('should find more relevant tools with breakdown', async () => {
      const node = {
        description: 'Read a JSON configuration file and extract settings'
      };
      
      const tools = await synthesizer._discoverToolsWithBreakdown(node, {});
      
      console.log('\n=== WITH BREAKDOWN ===');
      console.log(`Task: "${node.description}"`);
      console.log(`Found ${tools.length} tools:`);
      tools.forEach(t => console.log(`  - ${t.name}`));
      
      // Should find both file_read and json_parse
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('file_read');
      expect(toolNames).toContain('json_parse');
      
      // Verify tools have proper metadata
      tools.forEach(tool => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.outputSchema).toBeDefined();
        expect(typeof tool.execute).toBe('function');
      });
    });
    
    it('should handle calculation and write task', async () => {
      const node = {
        description: 'Calculate the sum of numbers and write the result to output.txt'
      };
      
      const toolsWithout = await synthesizer._discoverTools(node, {});
      const toolsWith = await synthesizer._discoverToolsWithBreakdown(node, {});
      
      console.log('\n=== CALCULATION + WRITE TASK ===');
      console.log(`Task: "${node.description}"`);
      console.log(`Without breakdown: ${toolsWithout.length} tools`);
      console.log(`With breakdown: ${toolsWith.length} tools`);
      
      const toolNames = toolsWith.map(t => t.name);
      
      // Should find both calculator and file_write
      expect(toolNames).toContain('calculator');
      expect(toolNames).toContain('file_write');
      
      // Should find at least as many tools with breakdown
      expect(toolsWith.length).toBeGreaterThanOrEqual(toolsWithout.length);
    });
    
    it('should handle complex JSON processing task', async () => {
      const node = {
        description: 'Read data.json, process the values, and calculate statistics'
      };
      
      const toolsWith = await synthesizer._discoverToolsWithBreakdown(node, {});
      
      console.log('\n=== COMPLEX JSON PROCESSING ===');
      console.log(`Task: "${node.description}"`);
      console.log(`Found ${toolsWith.length} tools with breakdown:`);
      toolsWith.forEach(t => {
        console.log(`  - ${t.name}: ${t.description}`);
        console.log(`    Inputs: [${Object.keys(t.inputSchema).join(', ')}]`);
        console.log(`    Outputs: [${Object.keys(t.outputSchema).join(', ')}]`);
      });
      
      const toolNames = toolsWith.map(t => t.name);
      
      // Should find file_read, json_parse, and calculator
      expect(toolNames).toContain('file_read');
      expect(toolNames).toContain('json_parse');
      expect(toolNames).toContain('calculator');
      
      // All tools should be from our validated set
      toolNames.forEach(name => {
        expect(Object.keys(VALIDATED_TOOLS)).toContain(name);
      });
    });
  });
  
  describe('Breakdown quality', () => {
    it('should not duplicate tools in union', async () => {
      const node = {
        description: 'Read multiple files and parse JSON from each'
      };
      
      // Configure LLM to return operations that would discover same tools
      synthesizer.llmClient.generateResponse.mockImplementationOnce(async () => ({
        content: JSON.stringify({
          operations: [
            'read first file',
            'read second file', 
            'parse JSON from first file',
            'parse JSON from second file'
          ]
        })
      }));
      
      const tools = await synthesizer._discoverToolsWithBreakdown(node, {});
      
      console.log('\n=== DEDUPLICATION TEST ===');
      console.log(`Task: "${node.description}"`);
      console.log(`Found ${tools.length} unique tools:`);
      tools.forEach(t => console.log(`  - ${t.name}`));
      
      // Check for duplicates
      const toolNames = tools.map(t => t.name);
      const uniqueNames = [...new Set(toolNames)];
      
      expect(toolNames.length).toBe(uniqueNames.length);
      expect(tools.length).toBeLessThanOrEqual(4); // We only have 4 tools total
    });
    
    it('should preserve all tool metadata through breakdown', async () => {
      const node = {
        description: 'Parse JSON and calculate result'
      };
      
      const tools = await synthesizer._discoverToolsWithBreakdown(node, {});
      
      console.log('\n=== METADATA PRESERVATION ===');
      console.log(`Task: "${node.description}"`);
      
      tools.forEach(tool => {
        console.log(`\nTool: ${tool.name}`);
        console.log(`  Description: ${tool.description}`);
        console.log(`  Has inputSchema: ${!!tool.inputSchema}`);
        console.log(`  Has outputSchema: ${!!tool.outputSchema}`);
        console.log(`  Has execute: ${typeof tool.execute === 'function'}`);
        
        // Verify this matches our validated tool
        if (VALIDATED_TOOLS[tool.name]) {
          const original = VALIDATED_TOOLS[tool.name];
          expect(tool.description).toBe(original.description);
          expect(tool.inputSchema).toEqual(original.inputSchema);
          expect(tool.outputSchema).toEqual(original.outputSchema);
          expect(typeof tool.execute).toBe('function');
        }
      });
    });
  });
  
  describe('Improvement metrics', () => {
    it('should show measurable improvement with breakdown', async () => {
      const testCases = [
        'Read configuration.json and parse settings',
        'Calculate total from values and save to result.txt',
        'Load data.json, extract numbers, and compute average'
      ];
      
      let totalWithout = 0;
      let totalWith = 0;
      let improvements = 0;
      
      console.log('\n=== IMPROVEMENT METRICS ===');
      
      for (const description of testCases) {
        const node = { description };
        
        const toolsWithout = await synthesizer._discoverTools(node, {});
        const toolsWith = await synthesizer._discoverToolsWithBreakdown(node, {});
        
        totalWithout += toolsWithout.length;
        totalWith += toolsWith.length;
        
        if (toolsWith.length > toolsWithout.length) {
          improvements++;
        }
        
        console.log(`\n"${description}"`);
        console.log(`  Without: ${toolsWithout.length} tools [${toolsWithout.map(t => t.name).join(', ')}]`);
        console.log(`  With:    ${toolsWith.length} tools [${toolsWith.map(t => t.name).join(', ')}]`);
        console.log(`  Improvement: ${toolsWith.length - toolsWithout.length}`);
      }
      
      console.log('\n=== SUMMARY ===');
      console.log(`Test cases with improvement: ${improvements}/${testCases.length}`);
      console.log(`Average without breakdown: ${(totalWithout / testCases.length).toFixed(1)}`);
      console.log(`Average with breakdown: ${(totalWith / testCases.length).toFixed(1)}`);
      console.log(`Average improvement: +${((totalWith - totalWithout) / testCases.length).toFixed(1)} tools`);
      
      // Breakdown should generally find more or equal tools
      expect(totalWith).toBeGreaterThanOrEqual(totalWithout);
      expect(improvements).toBeGreaterThan(0);
    });
  });
});