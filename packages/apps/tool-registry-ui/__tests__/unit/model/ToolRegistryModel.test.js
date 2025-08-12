/**
 * Unit tests for ToolRegistryModel
 */

import { ToolRegistryModel } from '../../../src/model/ToolRegistryModel.js';

describe('ToolRegistryModel', () => {
  let model;
  
  beforeEach(() => {
    model = new ToolRegistryModel();
  });
  
  afterEach(() => {
    if (model) {
      model.destroy();
      model = null;
    }
  });
  
  describe('Initialization', () => {
    test('should initialize with default state', () => {
      expect(model.tools).toEqual([]);
      expect(model.filteredTools).toEqual([]);
      expect(model.selectedTool).toBeNull();
      expect(model.searchQuery).toBe('');
      expect(model.collections).toEqual([]);
      expect(model.selectedCollection).toBeNull();
      expect(model.documents).toEqual([]);
      expect(model.vectorCollections).toEqual([]);
      expect(model.searchResults).toEqual([]);
    });
    
    test('should have event emitter capabilities', () => {
      expect(typeof model.on).toBe('function');
      expect(typeof model.off).toBe('function');
      expect(typeof model.emit).toBe('function');
    });
  });
  
  describe('Tool Management', () => {
    const mockTools = [
      { name: 'file_write', module: 'file', description: 'Write to file' },
      { name: 'file_read', module: 'file', description: 'Read from file' },
      { name: 'calculator', module: 'calculator', description: 'Calculate expressions' }
    ];
    
    test('should set tools and update filtered tools', () => {
      const listener = jest.fn();
      model.on('tools:updated', listener);
      
      model.setTools(mockTools);
      
      expect(model.tools).toEqual(mockTools);
      expect(model.filteredTools).toEqual(mockTools);
      expect(listener).toHaveBeenCalledWith(mockTools);
    });
    
    test('should filter tools by search query', () => {
      model.setTools(mockTools);
      
      const listener = jest.fn();
      model.on('tools:filtered', listener);
      
      model.filterTools('file');
      
      expect(model.searchQuery).toBe('file');
      expect(model.filteredTools).toHaveLength(2);
      expect(model.filteredTools.every(t => t.name.includes('file'))).toBe(true);
      expect(listener).toHaveBeenCalledWith(model.filteredTools);
    });
    
    test('should filter tools by module', () => {
      model.setTools(mockTools);
      
      model.filterTools('', 'file');
      
      expect(model.filteredTools).toHaveLength(2);
      expect(model.filteredTools.every(t => t.module === 'file')).toBe(true);
    });
    
    test('should filter tools by both query and module', () => {
      model.setTools(mockTools);
      
      model.filterTools('write', 'file');
      
      expect(model.filteredTools).toHaveLength(1);
      expect(model.filteredTools[0].name).toBe('file_write');
    });
    
    test('should select a tool', () => {
      model.setTools(mockTools);
      
      const listener = jest.fn();
      model.on('tool:selected', listener);
      
      model.selectTool('calculator');
      
      expect(model.selectedTool).toBe('calculator');
      expect(listener).toHaveBeenCalledWith('calculator');
    });
    
    test('should get tool by name', () => {
      model.setTools(mockTools);
      
      const tool = model.getToolByName('file_write');
      expect(tool).toEqual(mockTools[0]);
      
      const notFound = model.getToolByName('nonexistent');
      expect(notFound).toBeUndefined();
    });
    
    test('should clear search', () => {
      model.setTools(mockTools);
      model.filterTools('file');
      
      model.clearSearch();
      
      expect(model.searchQuery).toBe('');
      expect(model.filteredTools).toEqual(mockTools);
    });
  });
  
  describe('Collection Management', () => {
    const mockCollections = [
      { name: 'tools', count: 45 },
      { name: 'modules', count: 12 },
      { name: 'tool_perspectives', count: 180 }
    ];
    
    test('should set collections', () => {
      const listener = jest.fn();
      model.on('collections:updated', listener);
      
      model.setCollections(mockCollections);
      
      expect(model.collections).toEqual(mockCollections);
      expect(listener).toHaveBeenCalledWith(mockCollections);
    });
    
    test('should select collection', () => {
      model.setCollections(mockCollections);
      
      const listener = jest.fn();
      model.on('collection:selected', listener);
      
      model.selectCollection('modules');
      
      expect(model.selectedCollection).toBe('modules');
      expect(listener).toHaveBeenCalledWith('modules');
    });
    
    test('should set documents for collection', () => {
      const mockDocs = [
        { _id: '1', name: 'doc1' },
        { _id: '2', name: 'doc2' }
      ];
      
      const listener = jest.fn();
      model.on('documents:updated', listener);
      
      model.setDocuments(mockDocs, 100);
      
      expect(model.documents).toEqual(mockDocs);
      expect(model.documentCount).toBe(100);
      expect(listener).toHaveBeenCalledWith({ documents: mockDocs, total: 100 });
    });
  });
  
  describe('Vector Search Management', () => {
    const mockVectorCollections = [
      { name: 'tool_perspectives', vectors_count: 180, dimension: 384 }
    ];
    
    const mockSearchResults = [
      { id: '1', score: 0.95, payload: { toolName: 'file_write' } },
      { id: '2', score: 0.87, payload: { toolName: 'file_read' } }
    ];
    
    test('should set vector collections', () => {
      const listener = jest.fn();
      model.on('vectors:updated', listener);
      
      model.setVectorCollections(mockVectorCollections);
      
      expect(model.vectorCollections).toEqual(mockVectorCollections);
      expect(listener).toHaveBeenCalledWith(mockVectorCollections);
    });
    
    test('should set search results', () => {
      const listener = jest.fn();
      model.on('search:results', listener);
      
      model.setSearchResults(mockSearchResults);
      
      expect(model.searchResults).toEqual(mockSearchResults);
      expect(listener).toHaveBeenCalledWith(mockSearchResults);
    });
    
    test('should clear search results', () => {
      model.setSearchResults(mockSearchResults);
      
      const listener = jest.fn();
      model.on('search:results', listener);
      
      model.clearSearchResults();
      
      expect(model.searchResults).toEqual([]);
      expect(listener).toHaveBeenCalledWith([]);
    });
  });
  
  describe('State Persistence', () => {
    test('should save state to localStorage', () => {
      const mockTools = [{ name: 'test_tool' }];
      model.setTools(mockTools);
      model.selectTool('test_tool');
      
      model.saveState();
      
      const saved = localStorage.getItem('tool-registry-state');
      expect(saved).toBeTruthy();
      
      const parsed = JSON.parse(saved);
      expect(parsed.tools).toEqual(mockTools);
      expect(parsed.selectedTool).toBe('test_tool');
    });
    
    test('should load state from localStorage', () => {
      const savedState = {
        tools: [{ name: 'saved_tool' }],
        selectedTool: 'saved_tool',
        searchQuery: 'saved'
      };
      
      localStorage.setItem('tool-registry-state', JSON.stringify(savedState));
      
      model.loadState();
      
      expect(model.tools).toEqual(savedState.tools);
      expect(model.selectedTool).toBe('saved_tool');
      expect(model.searchQuery).toBe('saved');
    });
    
    test('should handle corrupted localStorage data', () => {
      localStorage.setItem('tool-registry-state', 'invalid json');
      
      // Should not throw
      expect(() => model.loadState()).not.toThrow();
      
      // Should maintain default state
      expect(model.tools).toEqual([]);
    });
  });
  
  describe('Event Management', () => {
    test('should emit and listen to events', () => {
      const listener = jest.fn();
      model.on('test:event', listener);
      
      model.emit('test:event', { data: 'test' });
      
      expect(listener).toHaveBeenCalledWith({ data: 'test' });
    });
    
    test('should remove event listeners', () => {
      const listener = jest.fn();
      model.on('test:event', listener);
      
      model.emit('test:event', 'first');
      expect(listener).toHaveBeenCalledTimes(1);
      
      model.off('test:event', listener);
      model.emit('test:event', 'second');
      expect(listener).toHaveBeenCalledTimes(1);
    });
    
    test('should support multiple listeners for same event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      model.on('test:event', listener1);
      model.on('test:event', listener2);
      
      model.emit('test:event', 'data');
      
      expect(listener1).toHaveBeenCalledWith('data');
      expect(listener2).toHaveBeenCalledWith('data');
    });
  });
  
  describe('Cleanup', () => {
    test('should clean up on destroy', () => {
      const listener = jest.fn();
      model.on('test:event', listener);
      
      model.destroy();
      
      // Should not emit after destroy
      model.emit('test:event', 'data');
      expect(listener).not.toHaveBeenCalled();
      
      // Should clear data
      expect(model.tools).toEqual([]);
      expect(model.collections).toEqual([]);
    });
  });
  
  describe('Module Statistics', () => {
    test('should calculate module statistics', () => {
      const mockTools = [
        { name: 'file_write', module: 'file' },
        { name: 'file_read', module: 'file' },
        { name: 'file_delete', module: 'file' },
        { name: 'calculator', module: 'calculator' },
        { name: 'json_parse', module: 'json' }
      ];
      
      model.setTools(mockTools);
      
      const stats = model.getModuleStats();
      
      expect(stats).toEqual({
        file: 3,
        calculator: 1,
        json: 1
      });
    });
    
    test('should get unique modules', () => {
      const mockTools = [
        { name: 'tool1', module: 'module1' },
        { name: 'tool2', module: 'module1' },
        { name: 'tool3', module: 'module2' }
      ];
      
      model.setTools(mockTools);
      
      const modules = model.getUniqueModules();
      
      expect(modules).toEqual(['module1', 'module2']);
    });
  });
});