/**
 * Unit tests for AugmentedToolRegistry
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AugmentedToolRegistry } from '../../AugmentedToolRegistry.js';
import { SyntheticTool } from '../../SyntheticTool.js';

describe('AugmentedToolRegistry', () => {
  let registry;
  let mockRealRegistry;

  beforeEach(() => {
    // Mock real tool registry
    mockRealRegistry = {
      searchTools: jest.fn().mockResolvedValue([
        { name: 'file_write', confidence: 0.9, description: 'Write to file' },
        { name: 'file_read', confidence: 0.8, description: 'Read from file' }
      ]),
      getTool: jest.fn().mockImplementation(name => {
        if (name === 'file_write') {
          return { name: 'file_write', execute: jest.fn() };
        }
        if (name === 'file_read') {
          return { name: 'file_read', execute: jest.fn() };
        }
        return null;
      })
    };
    
    registry = new AugmentedToolRegistry(mockRealRegistry);
  });

  describe('initialization', () => {
    it('should create registry with real registry', () => {
      expect(registry.realTools).toBe(mockRealRegistry);
      expect(registry.syntheticTools).toBeInstanceOf(Map);
      expect(registry.syntheticTools.size).toBe(0);
    });
  });

  describe('synthetic tool registration', () => {
    it('should register synthetic tools', () => {
      const tool = new SyntheticTool({
        name: 'synthetic_task1',
        description: 'Synthetic tool 1',
        executionPlan: { type: 'action' }
      });
      
      registry.addSyntheticTool(tool);
      
      expect(registry.syntheticTools.has('synthetic_task1')).toBe(true);
      expect(registry.syntheticTools.get('synthetic_task1')).toBe(tool);
    });
    
    it('should register multiple synthetic tools', () => {
      const tool1 = new SyntheticTool({
        name: 'synthetic1',
        description: 'Tool 1',
        executionPlan: {}
      });
      
      const tool2 = new SyntheticTool({
        name: 'synthetic2',
        description: 'Tool 2',
        executionPlan: {}
      });
      
      registry.addSyntheticTool(tool1);
      registry.addSyntheticTool(tool2);
      
      expect(registry.syntheticTools.size).toBe(2);
    });
    
    it('should overwrite existing synthetic tool', () => {
      const tool1 = new SyntheticTool({
        name: 'synthetic1',
        description: 'Original',
        executionPlan: {}
      });
      
      const tool2 = new SyntheticTool({
        name: 'synthetic1',
        description: 'Updated',
        executionPlan: {}
      });
      
      registry.addSyntheticTool(tool1);
      registry.addSyntheticTool(tool2);
      
      expect(registry.syntheticTools.size).toBe(1);
      expect(registry.syntheticTools.get('synthetic1').description).toBe('Updated');
    });
  });

  describe('unified search', () => {
    it('should search both real and synthetic tools', async () => {
      // Add synthetic tools
      const synthetic = new SyntheticTool({
        name: 'process_csv',
        description: 'Process CSV files',
        executionPlan: {}
      });
      
      registry.addSyntheticTool(synthetic);
      
      const results = await registry.searchTools('file');
      
      // Should include real tools from mock
      expect(results.some(r => r.name === 'file_write')).toBe(true);
      expect(results.some(r => r.name === 'file_read')).toBe(true);
      
      // Should also search synthetic tools
      expect(mockRealRegistry.searchTools).toHaveBeenCalledWith('file', undefined);
    });
    
    it('should pass options to real registry search', async () => {
      const options = { limit: 5, threshold: 0.7 };
      
      await registry.searchTools('query', options);
      
      expect(mockRealRegistry.searchTools).toHaveBeenCalledWith('query', options);
    });
    
    it('should include matching synthetic tools', async () => {
      const synthetic1 = new SyntheticTool({
        name: 'database_setup',
        description: 'Set up database connection',
        executionPlan: {}
      });
      
      const synthetic2 = new SyntheticTool({
        name: 'api_create',
        description: 'Create REST API',
        executionPlan: {}
      });
      
      registry.addSyntheticTool(synthetic1);
      registry.addSyntheticTool(synthetic2);
      
      const results = await registry.searchTools('database');
      
      // Should find matching synthetic tool
      expect(results.some(r => r.name === 'database_setup')).toBe(true);
      expect(results.some(r => r.name === 'api_create')).toBe(false);
    });
    
    it('should assign confidence scores to synthetic tools', async () => {
      const synthetic = new SyntheticTool({
        name: 'exact_match',
        description: 'This is an exact match',
        executionPlan: {}
      });
      
      registry.addSyntheticTool(synthetic);
      
      const results = await registry.searchTools('exact match');
      
      const syntheticResult = results.find(r => r.name === 'exact_match');
      expect(syntheticResult).toBeDefined();
      expect(syntheticResult.confidence).toBeGreaterThan(0);
      expect(syntheticResult.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('tool retrieval', () => {
    it('should get real tool by name', async () => {
      const tool = await registry.getTool('file_write');
      
      expect(tool).toBeDefined();
      expect(tool.name).toBe('file_write');
      expect(mockRealRegistry.getTool).toHaveBeenCalledWith('file_write');
    });
    
    it('should get synthetic tool by name', async () => {
      const synthetic = new SyntheticTool({
        name: 'synthetic_tool',
        description: 'Test synthetic',
        executionPlan: { type: 'sequence' }
      });
      
      registry.addSyntheticTool(synthetic);
      
      const tool = await registry.getTool('synthetic_tool');
      
      expect(tool).toBe(synthetic);
      // Should not call real registry for synthetic tools
      expect(mockRealRegistry.getTool).not.toHaveBeenCalledWith('synthetic_tool');
    });
    
    it('should return null for non-existent tool', async () => {
      const tool = await registry.getTool('non_existent');
      
      expect(tool).toBeNull();
    });
    
    it('should prioritize synthetic over real if same name', async () => {
      const synthetic = new SyntheticTool({
        name: 'file_write', // Same as real tool
        description: 'Override file write',
        executionPlan: {}
      });
      
      registry.addSyntheticTool(synthetic);
      
      const tool = await registry.getTool('file_write');
      
      expect(tool).toBe(synthetic);
      expect(tool.description).toBe('Override file write');
    });
  });

  describe('synthetic tool search', () => {
    it('should search synthetic tools by query', () => {
      const tool1 = new SyntheticTool({
        name: 'create_database',
        description: 'Create and configure database',
        executionPlan: {}
      });
      
      const tool2 = new SyntheticTool({
        name: 'create_api',
        description: 'Create REST API endpoints',
        executionPlan: {}
      });
      
      const tool3 = new SyntheticTool({
        name: 'process_data',
        description: 'Process and transform data',
        executionPlan: {}
      });
      
      registry.addSyntheticTool(tool1);
      registry.addSyntheticTool(tool2);
      registry.addSyntheticTool(tool3);
      
      const results = registry.searchSynthetic('create');
      
      expect(results).toHaveLength(2);
      expect(results.some(r => r.name === 'create_database')).toBe(true);
      expect(results.some(r => r.name === 'create_api')).toBe(true);
    });
    
    it('should be case insensitive', () => {
      const tool = new SyntheticTool({
        name: 'TEST_TOOL',
        description: 'Test Tool Description',
        executionPlan: {}
      });
      
      registry.addSyntheticTool(tool);
      
      const results = registry.searchSynthetic('test');
      expect(results).toHaveLength(1);
    });
  });

  describe('clear synthetic tools', () => {
    it('should clear all synthetic tools', () => {
      registry.addSyntheticTool(new SyntheticTool({
        name: 'tool1',
        description: 'Tool 1',
        executionPlan: {}
      }));
      
      registry.addSyntheticTool(new SyntheticTool({
        name: 'tool2',
        description: 'Tool 2',
        executionPlan: {}
      }));
      
      expect(registry.syntheticTools.size).toBe(2);
      
      registry.clearSyntheticTools();
      
      expect(registry.syntheticTools.size).toBe(0);
    });
  });

  describe('get all tools', () => {
    it('should return all synthetic tools', () => {
      const tool1 = new SyntheticTool({
        name: 'tool1',
        description: 'Tool 1',
        executionPlan: {}
      });
      
      const tool2 = new SyntheticTool({
        name: 'tool2',
        description: 'Tool 2',
        executionPlan: {}
      });
      
      registry.addSyntheticTool(tool1);
      registry.addSyntheticTool(tool2);
      
      const allTools = registry.getAllSyntheticTools();
      
      expect(allTools).toHaveLength(2);
      expect(allTools).toContain(tool1);
      expect(allTools).toContain(tool2);
    });
  });
});