/**
 * Unit tests for TextSearch functionality
 * 
 * Tests text-based search capabilities for tools
 * Following TDD principles - these tests are written before implementation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TextSearch } from '../../src/search/TextSearch.js';
import { DatabaseStorage } from '../../src/core/DatabaseStorage.js';

describe('TextSearch', () => {
  let textSearch;
  let mockDatabaseStorage;
  let mockToolsCollection;
  
  beforeEach(() => {
    // Create mock tools collection
    mockToolsCollection = {
      find: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          {
            name: 'file-reader',
            description: 'Read files from the filesystem',
            moduleName: 'FileModule'
          },
          {
            name: 'file-writer',
            description: 'Write files to the filesystem',
            moduleName: 'FileModule'
          },
          {
            name: 'json-parser',
            description: 'Parse JSON strings into objects',
            moduleName: 'JsonModule'
          }
        ])
      }),
      createIndex: jest.fn().mockResolvedValue({ indexName: 'text_index' }),
      indexes: jest.fn().mockResolvedValue([
        { name: 'tool_text_index', key: { name: 'text', description: 'text' } }
      ]),
      dropIndex: jest.fn().mockResolvedValue(true)
    };
    
    // Create mock database storage
    mockDatabaseStorage = {
      getCollection: jest.fn(() => mockToolsCollection),
      isConnected: true
    };
    
    // Create text search instance
    textSearch = new TextSearch({
      databaseStorage: mockDatabaseStorage
    });
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('constructor', () => {
    it('should create a TextSearch instance', () => {
      expect(textSearch).toBeInstanceOf(TextSearch);
    });
    
    it('should accept options', () => {
      const search = new TextSearch({
        databaseStorage: mockDatabaseStorage,
        indexName: 'custom_index',
        verbose: true
      });
      
      expect(search.options.indexName).toBe('custom_index');
      expect(search.options.verbose).toBe(true);
    });
  });
  
  describe('initialize', () => {
    it('should create text index on initialization', async () => {
      // Mock that index doesn't exist initially
      mockToolsCollection.indexes.mockResolvedValueOnce([]);
      
      await textSearch.initialize();
      
      expect(mockToolsCollection.createIndex).toHaveBeenCalledWith(
        { name: 'text', description: 'text' },
        expect.objectContaining({ name: 'tool_text_index' })
      );
    });
    
    it('should check for existing index', async () => {
      await textSearch.initialize();
      
      expect(mockToolsCollection.indexes).toHaveBeenCalled();
    });
    
    it('should not create index if it already exists', async () => {
      mockToolsCollection.indexes.mockResolvedValue([
        { name: 'tool_text_index', key: { name: 'text', description: 'text' } }
      ]);
      
      await textSearch.initialize();
      
      // Should check for index but not create it
      expect(mockToolsCollection.indexes).toHaveBeenCalled();
      expect(mockToolsCollection.createIndex).not.toHaveBeenCalled();
    });
  });
  
  describe('search', () => {
    it('should search tools by text query', async () => {
      mockToolsCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          {
            name: 'file-reader',
            description: 'Read files from the filesystem',
            moduleName: 'FileModule'
          },
          {
            name: 'file-writer',
            description: 'Write files to the filesystem',
            moduleName: 'FileModule'
          }
        ])
      });
      
      const results = await textSearch.search('file');
      
      expect(results).toHaveLength(2);
      expect(mockToolsCollection.find).toHaveBeenCalledWith(
        { $text: { $search: 'file' } }
      );
    });
    
    it('should limit search results', async () => {
      mockToolsCollection.find.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            {
              name: 'file-reader',
              description: 'Read files from the filesystem'
            }
          ])
        })
      });
      
      const results = await textSearch.search('file', { limit: 1 });
      
      expect(results).toHaveLength(1);
      expect(mockToolsCollection.find).toHaveBeenCalledWith(
        { $text: { $search: 'file' } }
      );
    });
    
    it('should sort by text score', async () => {
      mockToolsCollection.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            {
              name: 'file-reader',
              description: 'Read files from the filesystem',
              score: 1.5
            },
            {
              name: 'file-writer',
              description: 'Write files to the filesystem',
              score: 1.2
            }
          ])
        })
      });
      
      const results = await textSearch.search('file', { sortByScore: true });
      
      expect(results).toHaveLength(2);
      expect(mockToolsCollection.find).toHaveBeenCalledWith(
        { $text: { $search: 'file' } },
        expect.objectContaining({ 
          projection: expect.objectContaining({ score: { $meta: 'textScore' } })
        })
      );
    });
    
    it('should return empty array for no matches', async () => {
      mockToolsCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([])
      });
      
      const results = await textSearch.search('nonexistent');
      
      expect(results).toEqual([]);
    });
    
    it('should handle search with multiple terms', async () => {
      const results = await textSearch.search('file json parser');
      
      expect(mockToolsCollection.find).toHaveBeenCalledWith(
        { $text: { $search: 'file json parser' } }
      );
    });
    
    it('should handle exact phrase search', async () => {
      const results = await textSearch.search('"file reader"');
      
      expect(mockToolsCollection.find).toHaveBeenCalledWith(
        { $text: { $search: '"file reader"' } }
      );
    });
  });
  
  describe('searchByField', () => {
    it('should search by specific field', async () => {
      mockToolsCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          {
            name: 'file-reader',
            description: 'Read files from the filesystem'
          }
        ])
      });
      
      const results = await textSearch.searchByField('description', 'filesystem');
      
      expect(results).toHaveLength(1);
      expect(mockToolsCollection.find).toHaveBeenCalledWith(
        { description: expect.objectContaining({ $regex: 'filesystem', $options: 'i' }) }
      );
    });
    
    it('should support regex search', async () => {
      const results = await textSearch.searchByField('name', /^file-.*/);
      
      expect(mockToolsCollection.find).toHaveBeenCalledWith(
        { name: /^file-.*/ }
      );
    });
  });
  
  describe('searchWithFilters', () => {
    it('should search with additional filters', async () => {
      mockToolsCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          {
            name: 'file-reader',
            description: 'Read files from the filesystem',
            moduleName: 'FileModule'
          }
        ])
      });
      
      const results = await textSearch.searchWithFilters('file', {
        moduleName: 'FileModule'
      });
      
      expect(results).toHaveLength(1);
      expect(mockToolsCollection.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $text: { $search: 'file' },
          moduleName: 'FileModule'
        })
      );
    });
    
    it('should combine text search with multiple filters', async () => {
      const results = await textSearch.searchWithFilters('json', {
        moduleName: 'JsonModule',
        hasInputSchema: true
      });
      
      expect(mockToolsCollection.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $text: { $search: 'json' },
          moduleName: 'JsonModule',
          hasInputSchema: true
        })
      );
    });
  });
  
  describe('rebuildIndex', () => {
    it('should rebuild text index', async () => {
      await textSearch.rebuildIndex();
      
      expect(mockToolsCollection.dropIndex).toHaveBeenCalledWith('tool_text_index');
      expect(mockToolsCollection.createIndex).toHaveBeenCalledWith(
        { name: 'text', description: 'text' },
        expect.objectContaining({ name: 'tool_text_index' })
      );
    });
  });
  
  describe('getIndexInfo', () => {
    it('should return index information', async () => {
      const info = await textSearch.getIndexInfo();
      
      expect(info).toHaveProperty('exists');
      expect(info).toHaveProperty('fields');
      expect(mockToolsCollection.indexes).toHaveBeenCalled();
    });
    
    it('should return false if index does not exist', async () => {
      mockToolsCollection.indexes.mockResolvedValue([]);
      
      const info = await textSearch.getIndexInfo();
      
      expect(info.exists).toBe(false);
      expect(info.fields).toEqual([]);
    });
  });
  
  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockToolsCollection.find.mockImplementation(() => {
        throw new Error('Database error');
      });
      
      await expect(textSearch.search('test')).rejects.toThrow('Database error');
    });
    
    it('should handle missing database connection', async () => {
      mockDatabaseStorage.isConnected = false;
      
      await expect(textSearch.search('test')).rejects.toThrow();
    });
  });
});