/**
 * Unit tests for BTTool
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { BTTool } from '../../../src/integration/BTTool.js';

describe('BTTool', () => {
  let btTool;
  let mockToolRegistry;
  
  beforeEach(() => {
    // Mock toolRegistry for testing
    mockToolRegistry = {
      getTool: async (name) => {
        if (name === 'mock_tool') {
          return {
            execute: async (params) => ({ success: true, data: params })
          };
        }
        return null;
      }
    };
    
    btTool = new BTTool(mockToolRegistry);
  });
  
  describe('Tool Metadata', () => {
    it('should provide tool metadata', () => {
      const metadata = btTool.getMetadata();
      
      expect(metadata.name).toBe('behavior_tree');
      expect(metadata.description).toContain('behavior tree');
      expect(metadata.inputSchema).toBeDefined();
      expect(metadata.outputSchema).toBeDefined();
    });
    
    it('should have correct input schema', () => {
      const metadata = btTool.getMetadata();
      const schema = metadata.inputSchema;
      
      expect(schema.type).toBe('object');
      expect(schema.properties.treeConfig).toBeDefined();
      expect(schema.properties.context).toBeDefined();
      expect(schema.required).toContain('treeConfig');
    });
    
    it('should have correct output schema', () => {
      const metadata = btTool.getMetadata();
      const schema = metadata.outputSchema;
      
      expect(schema.type).toBe('object');
      expect(schema.properties.success).toBeDefined();
      expect(schema.properties.status).toBeDefined();
      expect(schema.properties.data).toBeDefined();
      expect(schema.properties.error).toBeDefined();
    });
  });
  
  describe('Tool Execution', () => {
    it('should execute simple action tree', async () => {
      const params = {
        treeConfig: {
          type: 'action',
          tool: 'mock_tool',
          params: { test: 'value' }
        },
        context: { artifacts: {} }
      };
      
      const result = await btTool.execute(params);
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCESS');
      expect(result.data).toBeDefined();
    });
    
    it('should execute sequence tree', async () => {
      const params = {
        treeConfig: {
          type: 'sequence',
          children: [
            {
              type: 'action',
              tool: 'mock_tool',
              params: { step: 1 }
            },
            {
              type: 'action',
              tool: 'mock_tool',
              params: { step: 2 }
            }
          ]
        },
        context: { artifacts: {} }
      };
      
      const result = await btTool.execute(params);
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCESS');
    });
    
    it('should handle execution failures', async () => {
      // Add mock failure tool
      mockToolRegistry.getTool = async (name) => {
        if (name === 'fail_tool') {
          return {
            execute: async () => ({ success: false, error: 'Failed' })
          };
        }
        return null;
      };
      
      const params = {
        treeConfig: {
          type: 'action',
          tool: 'fail_tool',
          params: {}
        }
      };
      
      const result = await btTool.execute(params);
      
      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILURE');
      expect(result.error).toBeDefined();
    });
    
    it('should validate input parameters', async () => {
      const params = {
        // Missing required treeConfig
        context: {}
      };
      
      const result = await btTool.execute(params);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('treeConfig');
    });
    
    it('should pass context through execution', async () => {
      const params = {
        treeConfig: {
          type: 'action',
          tool: 'mock_tool',
          params: { value: '@testArtifact' }
        },
        context: {
          artifacts: {
            testArtifact: 'test-value'
          }
        }
      };
      
      const result = await btTool.execute(params);
      
      expect(result.success).toBe(true);
      expect(result.context.artifacts.testArtifact).toBe('test-value');
    });
  });
  
  describe('Tree Configuration Loading', () => {
    it('should accept JSON string configuration', async () => {
      const treeJson = JSON.stringify({
        type: 'action',
        tool: 'mock_tool',
        params: { test: 'json' }
      });
      
      const params = {
        treeConfig: treeJson,
        context: {}
      };
      
      const result = await btTool.execute(params);
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCESS');
    });
    
    it('should reject invalid JSON', async () => {
      const params = {
        treeConfig: 'invalid json {',
        context: {}
      };
      
      const result = await btTool.execute(params);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });
  });
  
  describe('Tool Protocol Compatibility', () => {
    it('should work as a standard tool', async () => {
      // Test that BTTool conforms to tool protocol
      expect(typeof btTool.execute).toBe('function');
      expect(typeof btTool.getMetadata).toBe('function');
      
      const metadata = btTool.getMetadata();
      expect(metadata.name).toBeDefined();
      expect(metadata.description).toBeDefined();
      expect(metadata.inputSchema).toBeDefined();
      expect(metadata.outputSchema).toBeDefined();
    });
    
    it('should support custom tool configuration', () => {
      const customTool = new BTTool(mockToolRegistry, {
        name: 'custom_bt',
        description: 'Custom behavior tree tool'
      });
      
      const metadata = customTool.getMetadata();
      expect(metadata.name).toBe('custom_bt');
      expect(metadata.description).toBe('Custom behavior tree tool');
    });
  });
  
  describe('Result Mapping', () => {
    it('should map BT results to tool format', async () => {
      const params = {
        treeConfig: {
          type: 'action',
          tool: 'mock_tool',
          params: { data: 'test' },
          outputVariable: 'result'
        },
        context: { artifacts: {} }
      };
      
      const result = await btTool.execute(params);
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCESS');
      expect(result.data).toBeDefined();
      expect(result.context.artifacts.result).toBeDefined();
    });
    
    it('should include node results in data', async () => {
      const params = {
        treeConfig: {
          type: 'sequence',
          id: 'main-seq',
          children: [
            {
              type: 'action',
              id: 'step1',
              tool: 'mock_tool',
              params: { step: 1 }
            },
            {
              type: 'action',
              id: 'step2',
              tool: 'mock_tool',
              params: { step: 2 }
            }
          ]
        },
        context: { artifacts: {} }
      };
      
      const result = await btTool.execute(params);
      
      expect(result.success).toBe(true);
      expect(result.data.nodeResults).toBeDefined();
      // Node results tracking would be a future enhancement
      // For now just ensure the structure exists
      expect(typeof result.data.nodeResults).toBe('object');
    });
  });
});