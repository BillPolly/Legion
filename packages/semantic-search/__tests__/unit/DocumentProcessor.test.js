/**
 * Tests for DocumentProcessor
 */

import { describe, it, expect } from '@jest/globals';
import { DocumentProcessor } from '../../src/utils/DocumentProcessor.js';

describe('DocumentProcessor', () => {
  let processor;
  
  beforeEach(() => {
    processor = new DocumentProcessor();
  });
  
  describe('Document Processing', () => {
    it('should process basic documents', () => {
      const doc = {
        title: 'Test Title',
        content: 'Test content here',
        tags: ['tag1', 'tag2']
      };
      
      const result = processor.processDocument(doc);
      
      expect(result.searchText).toBeDefined();
      expect(result.searchText).toContain('Test Title');
      expect(result.searchText).toContain('Test content');
      expect(result._processedFields).toBeInstanceOf(Array);
      expect(result._processedAt).toBeDefined();
    });
    
    it('should detect text fields automatically', () => {
      const doc = {
        id: 123,
        name: 'Product Name',
        description: 'Product description',
        price: 99.99,
        inStock: true,
        metadata: { category: 'electronics' }
      };
      
      const result = processor.processDocument(doc);
      
      expect(result._processedFields).toContain('name');
      expect(result._processedFields).toContain('description');
      expect(result._processedFields).not.toContain('price');
      expect(result._processedFields).not.toContain('inStock');
    });
    
    it('should apply field weighting', () => {
      processor.config.weightedFields = {
        title: 3.0,
        content: 1.0
      };
      
      const doc = {
        title: 'Important',
        content: 'Less important'
      };
      
      const result = processor.processDocument(doc);
      
      // Title should appear multiple times due to weighting
      const titleCount = (result.searchText.match(/Important/g) || []).length;
      expect(titleCount).toBeGreaterThan(1);
    });
    
    it('should handle nested objects', () => {
      const doc = {
        title: 'Main Title',
        author: {
          name: 'John Doe',
          bio: 'Author biography'
        },
        metadata: {
          tags: ['tag1', 'tag2'],
          category: 'tutorial'
        }
      };
      
      const result = processor.processDocument(doc);
      
      expect(result.searchText).toContain('John Doe');
      expect(result.searchText).toContain('Author biography');
      expect(result.searchText).toContain('tutorial');
    });
  });
  
  describe('Text Cleaning', () => {
    it('should normalize whitespace', () => {
      const doc = {
        content: 'Text   with    multiple     spaces'
      };
      
      const result = processor.processDocument(doc);
      
      expect(result.searchText).not.toMatch(/\\s{2,}/);
    });
    
    it('should handle special characters', () => {
      const doc = {
        content: 'Text with @#$% special characters!'
      };
      
      const result = processor.processDocument(doc);
      
      expect(result.searchText).toContain('Text with');
      expect(result.searchText).toContain('special characters');
    });
    
    it('should truncate long text', () => {
      processor.config.maxTextLength = 100;
      
      const doc = {
        content: 'a'.repeat(200)
      };
      
      const result = processor.processDocument(doc);
      
      expect(result.searchText.length).toBeLessThanOrEqual(100);
    });
  });
  
  describe('Query Enhancement', () => {
    it('should expand common abbreviations', () => {
      const expanded = processor.processCapabilityQuery('db auth api');
      
      expect(expanded).toContain('database');
      expect(expanded).toContain('authentication');
      expect(expanded).toContain('application programming interface');
    });
    
    it('should handle ML/AI terms', () => {
      const expanded = processor.processCapabilityQuery('ML model');
      
      expect(expanded).toContain('machine learning');
      expect(expanded).toContain('model');
    });
    
    it('should add context words', () => {
      const expanded = processor.processCapabilityQuery('need user authentication');
      
      expect(expanded).toContain('tool');
      expect(expanded).toContain('function');
      expect(expanded).toContain('capability');
    });
  });
  
  describe('Tool Processing', () => {
    it('should process tool documents specially', () => {
      const tool = {
        name: 'file_reader',
        description: 'Reads files from disk',
        parameters: {
          filepath: { type: 'string', description: 'Path to file' }
        },
        module: 'file-ops',
        tags: ['file', 'io']
      };
      
      const result = processor.processToolForSearch(tool);
      
      expect(result.searchText).toContain('Tool: file_reader');
      expect(result.searchText).toContain('Description: Reads files');
      expect(result.searchText).toContain('Parameters: filepath');
      expect(result.searchText).toContain('Module: file-ops');
      expect(result.searchText).toContain('Tags: file, io');
      expect(result._toolProcessed).toBe(true);
    });
  });
  
  describe('Batch Processing', () => {
    it('should process multiple documents', () => {
      const docs = [
        { id: 1, title: 'Doc 1' },
        { id: 2, title: 'Doc 2' },
        { id: 3, title: 'Doc 3' }
      ];
      
      const results = processor.processDocuments(docs);
      
      expect(results).toHaveLength(3);
      results.forEach((result, i) => {
        expect(result.searchText).toContain(`Doc ${i + 1}`);
      });
    });
  });
  
  describe('Metadata Extraction', () => {
    it('should extract document metadata', () => {
      const doc = {
        name: 'Test',
        description: 'Description',
        content: 'Long content here',
        tags: ['tag1', 'tag2'],
        number: 42
      };
      
      const result = processor.processDocument(doc);
      
      expect(result._metadata).toBeDefined();
      expect(result._metadata.hasName).toBe(true);
      expect(result._metadata.hasDescription).toBe(true);
      expect(result._metadata.fieldCount).toBe(5);
      expect(result._metadata.dataTypes).toContain('string');
      expect(result._metadata.dataTypes).toContain('array');
      expect(result._metadata.dataTypes).toContain('number');
    });
  });
});