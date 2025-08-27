/**
 * MetadataManager Unit Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MetadataManager } from '../../MetadataManager.js';
import { createTestMetadata } from '../setup.js';

describe('MetadataManager', () => {
  let manager;
  
  beforeEach(() => {
    manager = new MetadataManager();
  });
  
  describe('validateModuleMetadata', () => {
    it('should validate valid module metadata', () => {
      const metadata = {
        name: 'calculator',
        version: '1.0.0',
        description: 'A comprehensive calculator module providing basic arithmetic operations',
        author: 'Legion Framework',
        license: 'MIT',
        category: 'math',
        tags: ['calculation', 'math', 'arithmetic'],
        keywords: ['calculation', 'math', 'arithmetic'],
        stability: 'stable',
        documentation: {
          overview: 'Calculator module',
          examples: ['Add two numbers']
        }
      };
      
      const result = manager.validateModuleMetadata(metadata);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings.length).toBe(0);
      expect(result.score).toBeGreaterThanOrEqual(80);
    });
    
    it('should detect missing required fields', () => {
      const metadata = {
        name: 'calculator',
        version: '1.0.0'
      };
      
      const result = manager.validateModuleMetadata(metadata);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.path === 'description')).toBe(true);
    });
    
    it('should warn about missing optional fields', () => {
      const metadata = {
        name: 'calculator',
        version: '1.0.0',
        description: 'Basic calculator operations',
        author: 'Legion Framework',
        license: 'MIT'
      };
      
      const result = manager.validateModuleMetadata(metadata);
      
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('keywords'))).toBe(true);
    });
    
    it('should validate semantic version format', () => {
      const invalidVersion = {
        name: 'calculator',
        version: 'v1',
        description: 'Test',
        author: 'Test',
        license: 'MIT'
      };
      
      const result = manager.validateModuleMetadata(invalidVersion);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'version')).toBe(true);
    });
  });
  
  describe('validateToolMetadata', () => {
    
    it('should detect invalid JSON schemas', () => {
      const metadata = {
        name: 'add',
        description: 'Add two numbers',
        version: '1.0.0',
        inputSchema: {
          type: 'invalid-type'
        },
        outputSchema: {
          type: 'object'
        }
      };
      
      const result = manager.validateToolMetadata(metadata);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path && e.path.includes('inputSchema'))).toBe(true);
    });
    
  });
  
  describe('generateMissingMetadata', () => {
    it('should generate missing module metadata fields', () => {
      const partial = {
        name: 'calculator',
        description: 'Basic calculator'
      };
      
      const complete = manager.generateMissingMetadata('module', partial);
      
      expect(complete.version).toBe('1.0.0');
      expect(complete.author).toBe('Unknown');
      expect(complete.license).toBe('MIT');
      expect(complete.tags).toEqual(['untagged']);
      expect(complete.stability).toBe('experimental');
    });
    
    it('should preserve existing metadata', () => {
      const partial = {
        name: 'calculator',
        description: 'Basic calculator',
        version: '2.0.0',
        tags: ['math']
      };
      
      const complete = manager.generateMissingMetadata('module', partial);
      
      expect(complete.version).toBe('2.0.0');
      expect(complete.tags).toEqual(['math']);
    });
    
    it('should generate tool metadata defaults', () => {
      const partial = {
        name: 'add',
        description: 'Add numbers'
      };
      
      const complete = manager.generateMissingMetadata('tool', partial);
      
      expect(complete.version).toBe('1.0.0');
      expect(complete.category).toBe('general');
      expect(complete.tags).toEqual(['untagged']);
      expect(complete.examples).toEqual([]);
    });
  });
  
  describe('calculateComplianceScore', () => {
    it('should calculate 100% score for complete metadata', () => {
      const metadata = {
        name: 'calculator',
        version: '1.0.0',
        description: 'Full featured calculator with extensive documentation',
        author: 'Legion Framework Team',
        license: 'MIT',
        category: 'mathematics',
        tags: ['math', 'calculation', 'arithmetic', 'scientific'],
        stability: 'stable',
        documentation: {
          overview: 'Comprehensive calculator module',
          examples: ['Example 1', 'Example 2', 'Example 3'],
          api: 'Full API documentation',
          changelog: 'Version history'
        },
        repository: 'https://github.com/legion/calculator',
        homepage: 'https://legion.dev/calculator'
      };
      
      const score = manager.calculateComplianceScore('module', metadata);
      
      expect(score).toBeGreaterThanOrEqual(85);
    });
    
    it('should penalize missing required fields heavily', () => {
      const metadata = {
        name: 'calculator'
      };
      
      const score = manager.calculateComplianceScore('module', metadata);
      
      expect(score).toBeLessThan(60);
    });
    
    it('should give partial score for optional fields', () => {
      const metadata = {
        name: 'calculator',
        version: '1.0.0',
        description: 'Basic calculator',
        author: 'Legion',
        license: 'MIT'
      };
      
      const score = manager.calculateComplianceScore('module', metadata);
      
      expect(score).toBeGreaterThan(50);
      expect(score).toBeLessThanOrEqual(80);
    });
  });
  
  describe('compareMetadata', () => {
    it('should identify added fields', () => {
      const old = {
        name: 'calculator',
        version: '1.0.0'
      };
      
      const current = {
        name: 'calculator',
        version: '1.0.0',
        description: 'Calculator module'
      };
      
      const diff = manager.compareMetadata(old, current);
      
      expect(diff.added).toContain('description');
      expect(diff.modified).toEqual([]);
      expect(diff.removed).toEqual([]);
    });
    
    it('should identify modified fields', () => {
      const old = {
        name: 'calculator',
        version: '1.0.0'
      };
      
      const current = {
        name: 'calculator',
        version: '1.1.0'
      };
      
      const diff = manager.compareMetadata(old, current);
      
      expect(diff.modified).toContain('version');
      expect(diff.added).toEqual([]);
      expect(diff.removed).toEqual([]);
    });
    
    it('should identify removed fields', () => {
      const old = {
        name: 'calculator',
        version: '1.0.0',
        deprecated: true
      };
      
      const current = {
        name: 'calculator',
        version: '1.0.0'
      };
      
      const diff = manager.compareMetadata(old, current);
      
      expect(diff.removed).toContain('deprecated');
      expect(diff.added).toEqual([]);
      expect(diff.modified).toEqual([]);
    });
    
    it('should calculate compliance improvement', () => {
      const old = {
        name: 'calculator',
        version: '1.0.0'
      };
      
      const current = {
        name: 'calculator',
        version: '1.0.0',
        description: 'Calculator module',
        author: 'Legion',
        license: 'MIT',
        tags: ['math']
      };
      
      const diff = manager.compareMetadata(old, current);
      
      expect(diff.complianceImprovement).toBeGreaterThan(0);
    });
  });
});