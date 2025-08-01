/**
 * Tests for ToolsPanelModel
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('ToolsPanelModel', () => {
  let ToolsPanelModel;
  let model;
  
  beforeEach(async () => {
    ({ ToolsPanelModel } = await import('../../../../src/components/tools-panel/ToolsPanelModel.js'));
    model = new ToolsPanelModel();
  });

  describe('Tool Management', () => {
    test('should initialize with empty tools list', () => {
      expect(model.tools).toEqual([]);
      expect(model.selectedToolId).toBeNull();
      expect(model.searchQuery).toBe('');
    });

    test('should set tools list', () => {
      const tools = [
        { id: 'file_read', name: 'Read File', description: 'Read file contents' },
        { id: 'file_write', name: 'Write File', description: 'Write to file' }
      ];
      
      model.setTools(tools);
      
      expect(model.tools).toEqual(tools);
      expect(model.getTools()).toEqual(tools);
    });

    test('should emit event when tools are set', () => {
      const listener = jest.fn();
      model.subscribe(listener);
      
      const tools = [{ id: 'test', name: 'Test Tool' }];
      model.setTools(tools);
      
      expect(listener).toHaveBeenCalledWith('toolsChanged', { tools });
    });

    test('should handle empty tools array', () => {
      model.setTools([]);
      expect(model.tools).toEqual([]);
    });
  });

  describe('Tool Selection', () => {
    beforeEach(() => {
      model.setTools([
        { id: 'tool1', name: 'Tool 1' },
        { id: 'tool2', name: 'Tool 2' },
        { id: 'tool3', name: 'Tool 3' }
      ]);
    });

    test('should select tool by id', () => {
      model.selectTool('tool2');
      
      expect(model.selectedToolId).toBe('tool2');
      expect(model.getSelectedTool()).toEqual({ id: 'tool2', name: 'Tool 2' });
    });

    test('should emit event when tool is selected', () => {
      const listener = jest.fn();
      model.subscribe(listener);
      
      model.selectTool('tool1');
      
      expect(listener).toHaveBeenCalledWith('toolSelected', {
        toolId: 'tool1',
        tool: { id: 'tool1', name: 'Tool 1' }
      });
    });

    test('should deselect tool when null is passed', () => {
      model.selectTool('tool1');
      model.selectTool(null);
      
      expect(model.selectedToolId).toBeNull();
      expect(model.getSelectedTool()).toBeNull();
    });

    test('should not select non-existent tool', () => {
      model.selectTool('invalid-id');
      
      expect(model.selectedToolId).toBeNull();
      expect(model.getSelectedTool()).toBeNull();
    });

    test('should not emit event when selecting already selected tool', () => {
      model.selectTool('tool1');
      
      const listener = jest.fn();
      model.subscribe(listener);
      
      model.selectTool('tool1');
      
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      model.setTools([
        { id: 'file_read', name: 'Read File', description: 'Read file contents' },
        { id: 'file_write', name: 'Write File', description: 'Write to file' },
        { id: 'http_get', name: 'HTTP GET', description: 'Make HTTP GET request' },
        { id: 'json_parse', name: 'Parse JSON', description: 'Parse JSON string' }
      ]);
    });

    test('should set search query', () => {
      model.setSearchQuery('file');
      
      expect(model.searchQuery).toBe('file');
    });

    test('should emit event when search query changes', () => {
      const listener = jest.fn();
      model.subscribe(listener);
      
      model.setSearchQuery('http');
      
      expect(listener).toHaveBeenCalledWith('searchQueryChanged', { query: 'http' });
    });

    test('should filter tools by name', () => {
      model.setSearchQuery('file');
      
      const filtered = model.getFilteredTools();
      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe('file_read');
      expect(filtered[1].id).toBe('file_write');
    });

    test('should filter tools by description', () => {
      model.setSearchQuery('request');
      
      const filtered = model.getFilteredTools();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('http_get');
    });

    test('should filter case-insensitively', () => {
      model.setSearchQuery('FILE');
      
      const filtered = model.getFilteredTools();
      expect(filtered).toHaveLength(2);
    });

    test('should return all tools when search is empty', () => {
      model.setSearchQuery('');
      
      const filtered = model.getFilteredTools();
      expect(filtered).toHaveLength(4);
    });

    test('should trim search query', () => {
      model.setSearchQuery('  file  ');
      
      expect(model.searchQuery).toBe('file');
      const filtered = model.getFilteredTools();
      expect(filtered).toHaveLength(2);
    });
  });

  describe('Tool Categories', () => {
    test('should group tools by category', () => {
      model.setTools([
        { id: 'file_read', name: 'Read File', category: 'File' },
        { id: 'file_write', name: 'Write File', category: 'File' },
        { id: 'http_get', name: 'HTTP GET', category: 'Network' },
        { id: 'json_parse', name: 'Parse JSON', category: 'Data' }
      ]);
      
      const grouped = model.getToolsByCategory();
      
      expect(Object.keys(grouped)).toEqual(['File', 'Network', 'Data']);
      expect(grouped.File).toHaveLength(2);
      expect(grouped.Network).toHaveLength(1);
      expect(grouped.Data).toHaveLength(1);
    });

    test('should handle tools without category', () => {
      model.setTools([
        { id: 'tool1', name: 'Tool 1', category: 'Category A' },
        { id: 'tool2', name: 'Tool 2' }, // No category
        { id: 'tool3', name: 'Tool 3' }  // No category
      ]);
      
      const grouped = model.getToolsByCategory();
      
      expect(grouped['Category A']).toHaveLength(1);
      expect(grouped['Uncategorized']).toHaveLength(2);
    });
  });

  describe('Tool State', () => {
    test('should track tool execution state', () => {
      model.setTools([
        { id: 'tool1', name: 'Tool 1' }
      ]);
      
      model.setToolExecuting('tool1', true);
      expect(model.isToolExecuting('tool1')).toBe(true);
      
      model.setToolExecuting('tool1', false);
      expect(model.isToolExecuting('tool1')).toBe(false);
    });

    test('should emit event when execution state changes', () => {
      model.setTools([{ id: 'tool1', name: 'Tool 1' }]);
      
      const listener = jest.fn();
      model.subscribe(listener);
      
      model.setToolExecuting('tool1', true);
      
      expect(listener).toHaveBeenCalledWith('toolExecutionStateChanged', {
        toolId: 'tool1',
        executing: true
      });
    });

    test('should not track state for non-existent tools', () => {
      model.setToolExecuting('invalid', true);
      expect(model.isToolExecuting('invalid')).toBe(false);
    });
  });

  describe('Tool Details', () => {
    test('should get tool by id', () => {
      const tools = [
        { id: 'tool1', name: 'Tool 1' },
        { id: 'tool2', name: 'Tool 2' }
      ];
      model.setTools(tools);
      
      expect(model.getToolById('tool1')).toEqual(tools[0]);
      expect(model.getToolById('tool2')).toEqual(tools[1]);
      expect(model.getToolById('invalid')).toBeNull();
    });

    test('should update tool details', () => {
      model.setTools([
        { id: 'tool1', name: 'Tool 1', lastUsed: null }
      ]);
      
      model.updateToolDetails('tool1', { lastUsed: '2024-01-01' });
      
      const tool = model.getToolById('tool1');
      expect(tool.lastUsed).toBe('2024-01-01');
    });

    test('should emit event when tool details update', () => {
      model.setTools([{ id: 'tool1', name: 'Tool 1' }]);
      
      const listener = jest.fn();
      model.subscribe(listener);
      
      model.updateToolDetails('tool1', { description: 'Updated' });
      
      expect(listener).toHaveBeenCalledWith('toolDetailsUpdated', {
        toolId: 'tool1',
        updates: { description: 'Updated' }
      });
    });
  });

  describe('Cleanup', () => {
    test('should clear all data on destroy', () => {
      model.setTools([{ id: 'test', name: 'Test' }]);
      model.selectTool('test');
      model.setSearchQuery('query');
      
      model.destroy();
      
      expect(model.tools).toEqual([]);
      expect(model.selectedToolId).toBeNull();
      expect(model.searchQuery).toBe('');
    });
  });
});