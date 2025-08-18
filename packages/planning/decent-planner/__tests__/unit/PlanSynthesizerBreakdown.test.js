/**
 * Unit tests for PlanSynthesizer tool breakdown functionality
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PlanSynthesizer } from '../../src/core/PlanSynthesizer.js';

describe('PlanSynthesizer - Tool Breakdown', () => {
  let synthesizer;
  let mockLLMClient;
  let mockToolDiscovery;
  let mockContextHints;
  
  beforeEach(() => {
    // Create mock LLM client
    mockLLMClient = {
      generateResponse: jest.fn()
    };
    
    // Create mock tool discovery
    mockToolDiscovery = {
      discoverTools: jest.fn()
    };
    
    // Create mock context hints
    mockContextHints = {
      getHints: jest.fn(() => ({
        suggestedInputs: [],
        suggestedOutputs: []
      })),
      addHints: jest.fn(),
      getSiblingOutputs: jest.fn(() => [])
    };
    
    // Create synthesizer instance
    synthesizer = new PlanSynthesizer({
      llmClient: mockLLMClient,
      toolDiscovery: mockToolDiscovery,
      contextHints: mockContextHints
    });
  });
  
  describe('_breakdownToOperations', () => {
    it('should break down a task into elementary operations', async () => {
      const taskDescription = 'Read a JSON file and extract a specific field';
      
      mockLLMClient.generateResponse.mockResolvedValue({
        content: JSON.stringify({
          operations: ['read file', 'parse JSON', 'extract field from object']
        })
      });
      
      const operations = await synthesizer._breakdownToOperations(taskDescription);
      
      expect(operations).toEqual(['read file', 'parse JSON', 'extract field from object']);
      expect(mockLLMClient.generateResponse).toHaveBeenCalledWith({
        messages: [{ role: 'user', content: expect.stringContaining(taskDescription) }],
        temperature: 0.2,
        maxTokens: 500
      });
    });
    
    it('should handle LLM response with extra text around JSON', async () => {
      const taskDescription = 'Download a file and save it';
      
      mockLLMClient.generateResponse.mockResolvedValue({
        content: `Here are the operations:
        {
          "operations": ["download from URL", "write file to disk"]
        }
        These are the basic steps.`
      });
      
      const operations = await synthesizer._breakdownToOperations(taskDescription);
      
      expect(operations).toEqual(['download from URL', 'write file to disk']);
    });
    
    it('should fallback to original task if LLM fails', async () => {
      const taskDescription = 'Complex task';
      
      mockLLMClient.generateResponse.mockRejectedValue(new Error('LLM error'));
      
      const operations = await synthesizer._breakdownToOperations(taskDescription);
      
      expect(operations).toEqual([taskDescription]);
    });
    
    it('should fallback to original task if response is invalid JSON', async () => {
      const taskDescription = 'Complex task';
      
      mockLLMClient.generateResponse.mockResolvedValue({
        content: 'This is not JSON'
      });
      
      const operations = await synthesizer._breakdownToOperations(taskDescription);
      
      expect(operations).toEqual([taskDescription]);
    });
    
    it('should fallback to original task if operations array is missing', async () => {
      const taskDescription = 'Complex task';
      
      mockLLMClient.generateResponse.mockResolvedValue({
        content: JSON.stringify({ result: 'something else' })
      });
      
      const operations = await synthesizer._breakdownToOperations(taskDescription);
      
      expect(operations).toEqual([taskDescription]);
    });
  });
  
  describe('_discoverToolsWithBreakdown', () => {
    it('should discover tools for each operation and union results', async () => {
      const node = {
        description: 'Read a JSON file and extract a field'
      };
      const options = { debug: false };
      
      // Mock breakdown
      mockLLMClient.generateResponse.mockResolvedValue({
        content: JSON.stringify({
          operations: ['read file', 'parse JSON', 'extract field']
        })
      });
      
      // Mock tool discovery for each operation
      mockToolDiscovery.discoverTools
        .mockResolvedValueOnce([
          { name: 'file_read', description: 'Read file from disk' },
          { name: 'file_exists', description: 'Check if file exists' }
        ])
        .mockResolvedValueOnce([
          { name: 'json_parse', description: 'Parse JSON string' },
          { name: 'json_validate', description: 'Validate JSON' }
        ])
        .mockResolvedValueOnce([
          { name: 'json_query', description: 'Query JSON data' },
          { name: 'json_parse', description: 'Parse JSON string' } // Duplicate
        ]);
      
      const tools = await synthesizer._discoverToolsWithBreakdown(node, options);
      
      // Should have unique tools (json_parse should not be duplicated)
      expect(tools).toHaveLength(5);
      expect(tools.map(t => t.name)).toEqual(
        expect.arrayContaining(['file_read', 'file_exists', 'json_parse', 'json_validate', 'json_query'])
      );
      
      // Verify discovery was called for each operation
      expect(mockToolDiscovery.discoverTools).toHaveBeenCalledTimes(3);
      expect(mockToolDiscovery.discoverTools).toHaveBeenCalledWith(
        { description: 'read file' },
        expect.objectContaining({ maxTools: 5 })
      );
    });
    
    it('should handle empty tool results for some operations', async () => {
      const node = {
        description: 'Calculate sum from CSV'
      };
      const options = { debug: false };
      
      mockLLMClient.generateResponse.mockResolvedValue({
        content: JSON.stringify({
          operations: ['read file', 'parse CSV', 'calculate sum']
        })
      });
      
      mockToolDiscovery.discoverTools
        .mockResolvedValueOnce([{ name: 'file_read', description: 'Read file' }])
        .mockResolvedValueOnce([]) // No tools found for CSV parsing
        .mockResolvedValueOnce([{ name: 'calculator', description: 'Calculate' }]);
      
      const tools = await synthesizer._discoverToolsWithBreakdown(node, options);
      
      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.name)).toEqual(['file_read', 'calculator']);
    });
    
    it('should respect maxTools limit', async () => {
      const node = {
        description: 'Complex task with many operations'
      };
      const options = { maxTools: 3, debug: false };
      
      mockLLMClient.generateResponse.mockResolvedValue({
        content: JSON.stringify({
          operations: ['op1', 'op2']
        })
      });
      
      // Return many tools
      mockToolDiscovery.discoverTools
        .mockResolvedValueOnce([
          { name: 'tool1', description: 'Tool 1' },
          { name: 'tool2', description: 'Tool 2' }
        ])
        .mockResolvedValueOnce([
          { name: 'tool3', description: 'Tool 3' },
          { name: 'tool4', description: 'Tool 4' },
          { name: 'tool5', description: 'Tool 5' }
        ]);
      
      const tools = await synthesizer._discoverToolsWithBreakdown(node, options);
      
      expect(tools).toHaveLength(3); // Limited by maxTools
    });
    
    it('should fallback to regular discovery on error', async () => {
      const node = {
        description: 'Task that fails breakdown'
      };
      const options = { debug: false };
      
      // Make breakdown fail
      mockLLMClient.generateResponse.mockRejectedValue(new Error('LLM error'));
      
      // Mock regular discovery
      mockToolDiscovery.discoverTools.mockResolvedValue([
        { name: 'fallback_tool', description: 'Fallback' }
      ]);
      
      const tools = await synthesizer._discoverToolsWithBreakdown(node, options);
      
      // Should fallback to regular discovery
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('fallback_tool');
      
      // Regular discovery should be called with the full node
      // The discoverTools method is called with the node but without the maxToolsPerOperation
      expect(mockToolDiscovery.discoverTools).toHaveBeenCalledWith(
        node,
        expect.objectContaining({ threshold: 0.3 })
      );
    });
    
    it('should handle tool discovery errors for individual operations', async () => {
      const node = {
        description: 'Task with partial failures'
      };
      const options = { debug: true }; // Enable debug to test logging
      
      mockLLMClient.generateResponse.mockResolvedValue({
        content: JSON.stringify({
          operations: ['op1', 'op2', 'op3']
        })
      });
      
      // Mock console methods
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      mockToolDiscovery.discoverTools
        .mockResolvedValueOnce([{ name: 'tool1', description: 'Tool 1' }])
        .mockRejectedValueOnce(new Error('Discovery failed'))
        .mockResolvedValueOnce([{ name: 'tool3', description: 'Tool 3' }]);
      
      const tools = await synthesizer._discoverToolsWithBreakdown(node, options);
      
      // Should still return tools from successful operations
      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.name)).toEqual(['tool1', 'tool3']);
      
      // Should log the failure
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Tool discovery failed for operation "op2"')
      );
      
      consoleSpy.mockRestore();
    });
    
    it('should pass correct options to each discovery call', async () => {
      const node = {
        description: 'Test task'
      };
      const options = {
        maxToolsPerOperation: 3,
        threshold: 0.5,
        debug: false
      };
      
      mockLLMClient.generateResponse.mockResolvedValue({
        content: JSON.stringify({
          operations: ['op1', 'op2']
        })
      });
      
      mockToolDiscovery.discoverTools.mockResolvedValue([]);
      
      await synthesizer._discoverToolsWithBreakdown(node, options);
      
      // Check that correct options were passed
      expect(mockToolDiscovery.discoverTools).toHaveBeenCalledWith(
        { description: 'op1' },
        {
          maxTools: 3, // maxToolsPerOperation
          threshold: 0.5
        }
      );
    });
  });
  
  describe('Integration with _synthesizeLeaf', () => {
    it('should be callable from synthesizeLeaf context', async () => {
      const node = {
        id: 'test-1',
        description: 'Read JSON and extract data',
        complexity: 'SIMPLE'
      };
      const options = { useBreakdown: true };
      
      // Setup mocks for a complete flow
      mockLLMClient.generateResponse.mockResolvedValue({
        content: JSON.stringify({
          operations: ['read file', 'parse JSON']
        })
      });
      
      mockToolDiscovery.discoverTools
        .mockResolvedValueOnce([{ name: 'file_read', description: 'Read file' }])
        .mockResolvedValueOnce([{ name: 'json_parse', description: 'Parse JSON' }]);
      
      // This would be called in the actual _synthesizeLeaf method
      const tools = await synthesizer._discoverToolsWithBreakdown(node, options);
      
      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.name)).toEqual(['file_read', 'json_parse']);
    });
  });
});