/**
 * Integration test for AugmentedToolRegistry with real ToolRegistry
 */

import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { AugmentedToolRegistry } from '../../AugmentedToolRegistry.js';
import { SyntheticTool } from '../../SyntheticTool.js';
import { ResourceManager } from '@legion/resource-manager';
import ToolRegistry from '@legion/tools-registry';

describe('AugmentedToolRegistry Integration', () => {
  let registry;
  let realRegistry;
  let resourceManager;

  beforeAll(async () => {
    // NEW API: getInstance() is now async and returns fully initialized instance
    resourceManager = await ResourceManager.getInstance();
    
    // Create real ToolRegistry and initialize it
    realRegistry = await ToolRegistry.getInstance();
    
    // Create augmented registry
    registry = new AugmentedToolRegistry(realRegistry);
  });
  
  beforeEach(() => {
    // Clear synthetic tools before each test
    registry.clearSyntheticTools();
  });

  it('should search real tools from actual registry', async () => {
    // Search for file-related tools
    const results = await registry.searchTools('file');
    
    console.log('Found tools matching "file":', results.map(r => r.name));
    
    // Should find some results (if file module loaded)
    expect(Array.isArray(results)).toBe(true);
    
    // Results should have expected structure
    // Note: Real tools from MongoDB may have different structure than synthetic
    for (const result of results) {
      expect(result).toHaveProperty('name');
      // Real tools may not have confidence, synthetic ones will
      if (result.type === 'synthetic') {
        expect(result).toHaveProperty('confidence');
      }
    }
  });
  
  it('should combine real and synthetic tools in search', async () => {
    // Add synthetic tools
    const syntheticFile = new SyntheticTool({
      name: 'batch_file_processor',
      description: 'Process multiple files in batch',
      executionPlan: { type: 'sequence' }
    });
    
    const syntheticData = new SyntheticTool({
      name: 'data_transformer',
      description: 'Transform data between formats',
      executionPlan: { type: 'action' }
    });
    
    registry.addSyntheticTool(syntheticFile);
    registry.addSyntheticTool(syntheticData);
    
    // Search for file tools
    const fileResults = await registry.searchTools('file');
    
    console.log('File search results:', fileResults.map(r => ({
      name: r.name,
      type: r.type || 'real',
      confidence: r.confidence
    })));
    
    // Should include synthetic tool
    expect(fileResults.some(r => r.name === 'batch_file_processor')).toBe(true);
    
    // Search for data tools
    const dataResults = await registry.searchTools('data');
    
    console.log('Data search results:', dataResults.map(r => ({
      name: r.name,
      type: r.type || 'real'
    })));
    
    // Should include synthetic tool
    expect(dataResults.some(r => r.name === 'data_transformer')).toBe(true);
  });
  
  it('should retrieve both real and synthetic tools by name', async () => {
    // Add a synthetic tool
    const synthetic = new SyntheticTool({
      name: 'custom_processor',
      description: 'Custom processing tool',
      executionPlan: { type: 'action' }
    });
    
    registry.addSyntheticTool(synthetic);
    
    // Get synthetic tool
    const syntheticResult = await registry.getTool('custom_processor');
    expect(syntheticResult).toBe(synthetic);
    
    // Try to get a real tool (if any registered)
    const allTools = await realRegistry.searchTools('');
    if (allTools.length > 0) {
      const realToolName = allTools[0].name;
      const realTool = await registry.getTool(realToolName);
      
      console.log('Retrieved real tool:', realToolName);
      expect(realTool).toBeDefined();
      expect(realTool.name).toBe(realToolName);
    }
  });
  
  it('should handle synthetic tool override of real tools', async () => {
    // Find a real tool to override
    const allTools = await realRegistry.searchTools('');
    
    if (allTools.length > 0) {
      const realToolName = allTools[0].name;
      console.log('Overriding real tool:', realToolName);
      
      // Create synthetic tool with same name
      const override = new SyntheticTool({
        name: realToolName,
        description: 'Synthetic override of ' + realToolName,
        executionPlan: { type: 'override' }
      });
      
      registry.addSyntheticTool(override);
      
      // Get tool - should return synthetic version
      const tool = await registry.getTool(realToolName);
      expect(tool).toBe(override);
      expect(tool.description).toContain('Synthetic override');
    } else {
      console.log('No real tools to override');
    }
  });
  
  it('should clear synthetic tools without affecting real tools', async () => {
    // Add synthetic tools
    registry.addSyntheticTool(new SyntheticTool({
      name: 'temp_tool_1',
      description: 'Temporary tool 1',
      executionPlan: {}
    }));
    
    registry.addSyntheticTool(new SyntheticTool({
      name: 'temp_tool_2',
      description: 'Temporary tool 2',
      executionPlan: {}
    }));
    
    // Verify synthetic tools exist
    expect(registry.getAllSyntheticTools()).toHaveLength(2);
    
    // Clear synthetic tools
    registry.clearSyntheticTools();
    
    // Synthetic tools should be gone
    expect(registry.getAllSyntheticTools()).toHaveLength(0);
    
    // Real tools should still be searchable
    const realResults = await registry.searchTools('');
    expect(Array.isArray(realResults)).toBe(true);
  });
});