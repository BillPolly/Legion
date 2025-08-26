/**
 * Unit tests for custom error classes
 * 
 * Tests error construction, inheritance, and properties
 */

import { describe, it, expect } from '@jest/globals';
import {
  ToolRegistryError,
  ModuleLoadError,
  ModuleValidationError,
  ToolExecutionError,
  ToolValidationError,
  DatabaseError,
  DiscoveryError,
  ResourceInitializationError,
  SemanticSearchError,
  VectorStoreError,
  LLMError,
  EmbeddingError,
  ConfigurationError,
  DependencyError,
  CacheError,
  ParameterValidationError
} from '../../src/errors/index.js';

describe('Custom Error Classes', () => {
  describe('ToolRegistryError', () => {
    it('should create base error with message and code', () => {
      const error = new ToolRegistryError('Test error', 'TEST_CODE');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ToolRegistryError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('ToolRegistryError');
      expect(error.timestamp).toBeDefined();
    });
    
    it('should use default code if not provided', () => {
      const error = new ToolRegistryError('Test error');
      expect(error.code).toBe('TOOL_REGISTRY_ERROR');
    });
  });
  
  describe('ModuleLoadError', () => {
    it('should include module path and original error', () => {
      const originalError = new Error('File not found');
      const error = new ModuleLoadError(
        'Failed to load module',
        '/path/to/module.js',
        originalError
      );
      
      expect(error).toBeInstanceOf(ToolRegistryError);
      expect(error.name).toBe('ModuleLoadError');
      expect(error.code).toBe('MODULE_LOAD_ERROR');
      expect(error.modulePath).toBe('/path/to/module.js');
      expect(error.originalError).toBe(originalError);
    });
  });
  
  describe('ModuleValidationError', () => {
    it('should include module name and validation errors', () => {
      const validationErrors = [
        'Missing getName method',
        'Missing getTools method'
      ];
      const error = new ModuleValidationError(
        'Module validation failed',
        'TestModule',
        validationErrors
      );
      
      expect(error.name).toBe('ModuleValidationError');
      expect(error.code).toBe('MODULE_VALIDATION_ERROR');
      expect(error.moduleName).toBe('TestModule');
      expect(error.validationErrors).toEqual(validationErrors);
    });
  });
  
  describe('ToolExecutionError', () => {
    it('should include tool name, parameters, and original error', () => {
      const originalError = new Error('Execution failed');
      const parameters = { input: 'test' };
      const error = new ToolExecutionError(
        'Tool execution failed',
        'testTool',
        parameters,
        originalError
      );
      
      expect(error.name).toBe('ToolExecutionError');
      expect(error.code).toBe('TOOL_EXECUTION_ERROR');
      expect(error.toolName).toBe('testTool');
      expect(error.parameters).toBe(parameters);
      expect(error.originalError).toBe(originalError);
    });
  });
  
  describe('ToolValidationError', () => {
    it('should include tool name and validation errors', () => {
      const validationErrors = ['Missing execute function'];
      const error = new ToolValidationError(
        'Tool validation failed',
        'testTool',
        validationErrors
      );
      
      expect(error.name).toBe('ToolValidationError');
      expect(error.code).toBe('TOOL_VALIDATION_ERROR');
      expect(error.toolName).toBe('testTool');
      expect(error.validationErrors).toEqual(validationErrors);
    });
  });
  
  describe('DatabaseError', () => {
    it('should include operation, collection, and original error', () => {
      const originalError = new Error('Connection failed');
      const error = new DatabaseError(
        'Database operation failed',
        'insert',
        'modules',
        originalError
      );
      
      expect(error.name).toBe('DatabaseError');
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.operation).toBe('insert');
      expect(error.collection).toBe('modules');
      expect(error.originalError).toBe(originalError);
    });
  });
  
  describe('DiscoveryError', () => {
    it('should include search path and original error', () => {
      const originalError = new Error('Permission denied');
      const error = new DiscoveryError(
        'Module discovery failed',
        '/search/path',
        originalError
      );
      
      expect(error.name).toBe('DiscoveryError');
      expect(error.code).toBe('DISCOVERY_ERROR');
      expect(error.searchPath).toBe('/search/path');
      expect(error.originalError).toBe(originalError);
    });
  });
  
  describe('ResourceInitializationError', () => {
    it('should include resource type and original error', () => {
      const originalError = new Error('Connection timeout');
      const error = new ResourceInitializationError(
        'Failed to initialize resource',
        'MongoDB',
        originalError
      );
      
      expect(error.name).toBe('ResourceInitializationError');
      expect(error.code).toBe('RESOURCE_INITIALIZATION_ERROR');
      expect(error.resourceType).toBe('MongoDB');
      expect(error.originalError).toBe(originalError);
    });
  });
  
  describe('SemanticSearchError', () => {
    it('should include operation and original error', () => {
      const originalError = new Error('Service unavailable');
      const error = new SemanticSearchError(
        'Semantic search failed',
        'query',
        originalError
      );
      
      expect(error.name).toBe('SemanticSearchError');
      expect(error.code).toBe('SEMANTIC_SEARCH_ERROR');
      expect(error.operation).toBe('query');
      expect(error.originalError).toBe(originalError);
    });
  });
  
  describe('VectorStoreError', () => {
    it('should include operation, collection, and original error', () => {
      const originalError = new Error('Collection not found');
      const error = new VectorStoreError(
        'Vector store operation failed',
        'VECTOR_STORE_ERROR',
        {
          operation: 'upsert',
          collection: 'tool_vectors',
          originalError: originalError
        }
      );
      
      expect(error.name).toBe('VectorStoreError');
      expect(error.code).toBe('VECTOR_STORE_ERROR');
      expect(error.details.operation).toBe('upsert');
      expect(error.details.collection).toBe('tool_vectors');
      expect(error.details.originalError).toBe(originalError);
    });
  });
  
  describe('LLMError', () => {
    it('should include operation and original error', () => {
      const originalError = new Error('Rate limit exceeded');
      const error = new LLMError(
        'LLM operation failed',
        'generatePerspectives',
        originalError
      );
      
      expect(error.name).toBe('LLMError');
      expect(error.code).toBe('LLM_ERROR');
      expect(error.operation).toBe('generatePerspectives');
      expect(error.originalError).toBe(originalError);
    });
  });
  
  describe('EmbeddingError', () => {
    it('should include truncated text and original error', () => {
      const originalError = new Error('Model not loaded');
      const longText = 'a'.repeat(200);
      const error = new EmbeddingError(
        'Embedding generation failed',
        longText,
        originalError
      );
      
      expect(error.name).toBe('EmbeddingError');
      expect(error.code).toBe('EMBEDDING_ERROR');
      expect(error.text).toHaveLength(100); // Should be truncated
      expect(error.originalError).toBe(originalError);
    });
    
    it('should handle undefined text', () => {
      const error = new EmbeddingError('Embedding failed', undefined, null);
      expect(error.text).toBeUndefined();
    });
  });
  
  describe('ConfigurationError', () => {
    it('should include config key and expected value', () => {
      const error = new ConfigurationError(
        'Invalid configuration',
        'MONGODB_URL',
        'mongodb://...'
      );
      
      expect(error.name).toBe('ConfigurationError');
      expect(error.code).toBe('CONFIGURATION_ERROR');
      expect(error.configKey).toBe('MONGODB_URL');
      expect(error.expectedValue).toBe('mongodb://...');
    });
  });
  
  describe('DependencyError', () => {
    it('should include dependency name and requiredBy', () => {
      const error = new DependencyError(
        'Missing dependency',
        'ResourceManager',
        'ModuleLoader'
      );
      
      expect(error.name).toBe('DependencyError');
      expect(error.code).toBe('DEPENDENCY_ERROR');
      expect(error.dependencyName).toBe('ResourceManager');
      expect(error.requiredBy).toBe('ModuleLoader');
    });
  });
  
  describe('CacheError', () => {
    it('should include operation, key, and original error', () => {
      const originalError = new Error('Memory limit exceeded');
      const error = new CacheError(
        'Cache operation failed',
        'set',
        'module:TestModule',
        originalError
      );
      
      expect(error.name).toBe('CacheError');
      expect(error.code).toBe('CACHE_ERROR');
      expect(error.operation).toBe('set');
      expect(error.key).toBe('module:TestModule');
      expect(error.originalError).toBe(originalError);
    });
  });
  
  describe('ParameterValidationError', () => {
    it('should include parameter details', () => {
      const error = new ParameterValidationError(
        'Invalid parameter type',
        'count',
        'number',
        'string'
      );
      
      expect(error.name).toBe('ParameterValidationError');
      expect(error.code).toBe('PARAMETER_VALIDATION_ERROR');
      expect(error.parameterName).toBe('count');
      expect(error.expectedType).toBe('number');
      expect(error.actualType).toBe('string');
    });
  });
  
  describe('Error inheritance', () => {
    it('should maintain proper prototype chain', () => {
      const errors = [
        new ModuleLoadError('test', '/path', null),
        new ToolExecutionError('test', 'tool', {}, null),
        new DatabaseError('test', 'op', 'col', null),
        new SemanticSearchError('test', 'op', null)
      ];
      
      errors.forEach(error => {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(ToolRegistryError);
        expect(error.timestamp).toBeDefined();
      });
    });
  });
});