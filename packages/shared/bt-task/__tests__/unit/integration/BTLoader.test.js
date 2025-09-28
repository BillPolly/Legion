/**
 * Unit tests for BTLoader
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { BTLoader } from '../../../src/integration/BTLoader.js';

describe('BTLoader', () => {
  let loader;
  let mockToolRegistry;
  
  beforeEach(async () => {
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
    
    loader = new BTLoader(mockToolRegistry);
  });
  
  describe('Loading JSON Configurations', () => {
    it('should load a simple action node configuration', async () => {
      const config = {
        type: 'action',
        name: 'Test Action',
        tool: 'mock_tool',
        params: { test: 'value' }
      };
      
      loader.loadConfig(config);
      const tree = loader.getTree();
      expect(tree).toEqual(config);
    });
    
    it('should load a sequence configuration', async () => {
      const config = {
        type: 'sequence',
        name: 'Test Sequence',
        children: [
          { type: 'action', tool: 'mock_tool', params: { step: 1 } },
          { type: 'action', tool: 'mock_tool', params: { step: 2 } }
        ]
      };
      
      loader.loadConfig(config);
      const tree = loader.getTree();
      expect(tree.children).toHaveLength(2);
    });
    
    it('should parse JSON string configurations', async () => {
      const jsonString = JSON.stringify({
        type: 'selector',
        name: 'Test Selector',
        children: []
      });
      
      loader.loadJSON(jsonString);
      const tree = loader.getTree();
      expect(tree.type).toBe('selector');
    });
  });
  
  describe('Validation of Configurations', () => {
    it('should validate required fields', async () => {
      const invalidConfig = {
        // Missing type
        name: 'Invalid'
      };
      
      expect(() => loader.loadConfig(invalidConfig)).toThrow('type is required');
    });
    
    it('should validate node types', async () => {
      const invalidConfig = {
        type: 'unknown_type',
        name: 'Invalid Type'
      };
      
      expect(() => loader.loadConfig(invalidConfig)).toThrow('Unknown node type');
    });
    
    it('should validate action nodes have tool property', async () => {
      const invalidAction = {
        type: 'action',
        name: 'Invalid Action'
        // Missing tool
      };
      
      expect(() => loader.loadConfig(invalidAction)).toThrow('Action nodes require tool');
    });
    
    it('should validate composite nodes have children', async () => {
      const invalidSequence = {
        type: 'sequence',
        name: 'Invalid Sequence'
        // Missing children
      };
      
      expect(() => loader.loadConfig(invalidSequence)).toThrow('Sequence nodes require children');
    });
    
    it('should validate condition nodes have condition property', async () => {
      const invalidCondition = {
        type: 'condition',
        name: 'Invalid Condition',
        children: []
        // Missing condition
      };
      
      expect(() => loader.loadConfig(invalidCondition)).toThrow('Condition nodes require condition');
    });
  });
  
  describe('Node Type Mapping', () => {
    it('should map all standard node types', async () => {
      const nodeTypes = [
        'action', 'sequence', 'selector', 
        'condition', 'retry'
      ];
      
      nodeTypes.forEach(type => {
        const config = { type, name: `Test ${type}` };
        if (type === 'action') config.tool = 'mock_tool';
        if (type !== 'action') config.children = [{ type: 'action', tool: 'mock_tool' }];
        if (type === 'condition') config.condition = 'true';
        
        loader.loadConfig(config);
        const tree = loader.getTree();
        expect(tree.type).toBe(type);
      });
    });
    
    it('should preserve custom properties', async () => {
      const config = {
        type: 'action',
        name: 'Test Action',
        tool: 'mock_tool',
        customProp: 'custom value',
        metadata: { key: 'value' }
      };
      
      loader.loadConfig(config);
      const tree = loader.getTree();
      expect(tree.customProp).toBe('custom value');
      expect(tree.metadata).toEqual({ key: 'value' });
    });
  });
  
  describe('Execution', () => {
    it('should execute loaded tree', async () => {
      const config = {
        type: 'action',
        name: 'Test Action',
        tool: 'mock_tool',
        params: { test: 'value' }
      };
      
      loader.loadConfig(config);
      const result = await loader.execute({ artifacts: {} });
      expect(result.status).toBe('SUCCESS');
    });
    
    it('should throw error when no tree loaded', async () => {
      await expect(loader.execute()).rejects.toThrow('No tree configuration loaded');
    });
  });
});