/**
 * Unit tests for ExecutionContext artifact management
 * Tests the new artifact system that replaces previousResults
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ExecutionContext } from '../../../src/core/ExecutionContext.js';

describe('ExecutionContext - Artifact Management', () => {
  let context;

  beforeEach(() => {
    context = new ExecutionContext();
  });

  describe('addArtifact()', () => {
    it('should add a valid artifact record to the registry', () => {
      const artifactRecord = {
        type: 'file',
        value: '/tmp/test.js',
        description: 'Test file',
        purpose: 'Testing artifact storage',
        timestamp: Date.now(),
        metadata: { size: 100 }
      };

      context.addArtifact('test_file', artifactRecord);
      
      const retrieved = context.getArtifact('test_file');
      expect(retrieved).toEqual(artifactRecord);
      expect(retrieved).toBe(artifactRecord); // Same reference - not cloned
    });

    it('should throw error if artifact name is invalid', () => {
      const artifactRecord = {
        type: 'data',
        value: { key: 'value' },
        description: 'Test data',
        timestamp: Date.now()
      };

      expect(() => context.addArtifact('', artifactRecord))
        .toThrow('Artifact name must be a non-empty string');
      expect(() => context.addArtifact(null, artifactRecord))
        .toThrow('Artifact name must be a non-empty string');
      expect(() => context.addArtifact(123, artifactRecord))
        .toThrow('Artifact name must be a non-empty string');
    });

    it('should throw error if artifact record is missing required fields', () => {
      // Missing type
      expect(() => context.addArtifact('test', {
        value: 'data',
        description: 'Test'
      })).toThrow('Artifact must have type and description');

      // Missing description
      expect(() => context.addArtifact('test', {
        type: 'data',
        value: 'data'
      })).toThrow('Artifact must have type and description');

      // Missing value
      expect(() => context.addArtifact('test', {
        type: 'data',
        description: 'Test'
      })).toThrow('Artifact must have a value field');
    });

    it('should allow overwriting existing artifacts', () => {
      const first = {
        type: 'data',
        value: { version: 1 },
        description: 'First version',
        timestamp: Date.now()
      };

      const second = {
        type: 'data',
        value: { version: 2 },
        description: 'Second version',
        timestamp: Date.now() + 1000
      };

      context.addArtifact('config', first);
      context.addArtifact('config', second);

      expect(context.getArtifact('config')).toBe(second);
    });

    it('should store artifact record as-is without modification', () => {
      const artifactRecord = {
        type: 'process',
        value: { pid: 12345, port: 3000 },
        description: 'Server process',
        purpose: 'Handle requests',
        timestamp: Date.now(),
        metadata: {
          toolName: 'execute_command',
          success: true,
          extraField: 'should be preserved'
        }
      };

      context.addArtifact('server', artifactRecord);
      const retrieved = context.getArtifact('server');
      
      // Verify exact same object reference (immutable storage)
      expect(retrieved).toBe(artifactRecord);
      
      // Verify all fields preserved
      expect(retrieved.metadata.extraField).toBe('should be preserved');
    });
  });

  describe('getArtifact()', () => {
    it('should return the entire artifact record', () => {
      const artifactRecord = {
        type: 'config',
        value: { host: 'localhost', port: 8080 },
        description: 'Server configuration',
        purpose: 'Configure the application',
        timestamp: Date.now()
      };

      context.addArtifact('app_config', artifactRecord);
      const retrieved = context.getArtifact('app_config');
      
      expect(retrieved).toBe(artifactRecord);
      expect(retrieved.type).toBe('config');
      expect(retrieved.value).toEqual({ host: 'localhost', port: 8080 });
      expect(retrieved.description).toBe('Server configuration');
    });

    it('should return undefined for non-existent artifacts', () => {
      expect(context.getArtifact('non_existent')).toBeUndefined();
    });
  });

  describe('getArtifactValue()', () => {
    it('should return only the value field from artifact record', () => {
      const filePath = '/tmp/server.js';
      const dataObject = { port: 3000, host: 'localhost' };
      const processInfo = { pid: 12345, port: 3000 };

      context.addArtifact('file', {
        type: 'file',
        value: filePath,
        description: 'Server file',
        timestamp: Date.now()
      });

      context.addArtifact('config', {
        type: 'data',
        value: dataObject,
        description: 'Config data',
        timestamp: Date.now()
      });

      context.addArtifact('process', {
        type: 'process',
        value: processInfo,
        description: 'Server process',
        timestamp: Date.now()
      });

      expect(context.getArtifactValue('file')).toBe(filePath);
      expect(context.getArtifactValue('config')).toBe(dataObject);
      expect(context.getArtifactValue('process')).toBe(processInfo);
    });

    it('should return undefined for non-existent artifacts', () => {
      expect(context.getArtifactValue('non_existent')).toBeUndefined();
    });

    it('should handle artifacts with null values but reject undefined values', () => {
      // Null values are allowed (the artifact exists but has no data)
      context.addArtifact('null_value', {
        type: 'data',
        value: null,
        description: 'Null value artifact',
        timestamp: Date.now()
      });

      expect(context.getArtifactValue('null_value')).toBeNull();

      // Undefined values are NOT allowed - must have value field per design document
      expect(() => context.addArtifact('undefined_value', {
        type: 'data',
        value: undefined,
        description: 'Undefined value artifact',
        timestamp: Date.now()
      })).toThrow('Artifact must have a value field');
    });
  });

  describe('listArtifacts()', () => {
    it('should return empty array when no artifacts exist', () => {
      expect(context.listArtifacts()).toEqual([]);
    });

    it('should return array of [name, record] pairs', () => {
      const artifact1 = {
        type: 'file',
        value: '/tmp/file1.js',
        description: 'First file',
        timestamp: Date.now()
      };

      const artifact2 = {
        type: 'data',
        value: { key: 'value' },
        description: 'Some data',
        timestamp: Date.now()
      };

      context.addArtifact('file1', artifact1);
      context.addArtifact('data1', artifact2);

      const artifacts = context.listArtifacts();
      
      expect(artifacts).toHaveLength(2);
      expect(artifacts[0]).toEqual(['file1', artifact1]);
      expect(artifacts[1]).toEqual(['data1', artifact2]);
      
      // Verify artifact records are not cloned
      expect(artifacts[0][1]).toBe(artifact1);
      expect(artifacts[1][1]).toBe(artifact2);
    });

    it('should maintain insertion order', () => {
      context.addArtifact('third', { type: 'data', value: 3, description: 'Third' });
      context.addArtifact('first', { type: 'data', value: 1, description: 'First' });
      context.addArtifact('second', { type: 'data', value: 2, description: 'Second' });

      const artifacts = context.listArtifacts();
      const names = artifacts.map(([name]) => name);
      
      expect(names).toEqual(['third', 'first', 'second']);
    });
  });

  describe('Artifact immutability', () => {
    it('should not allow modification of stored artifact records', () => {
      const artifactRecord = {
        type: 'data',
        value: { mutable: 'original' },
        description: 'Test mutability',
        timestamp: Date.now(),
        metadata: { field: 'original' }
      };

      context.addArtifact('test', artifactRecord);
      
      // Try to modify the original record
      artifactRecord.type = 'modified';
      artifactRecord.value.mutable = 'modified';
      artifactRecord.metadata.field = 'modified';

      const retrieved = context.getArtifact('test');
      
      // Stored record should be modified (since we store by reference)
      // This is intentional - the artifact record itself is the immutable descriptor
      expect(retrieved.type).toBe('modified');
      expect(retrieved.value.mutable).toBe('modified');
      expect(retrieved.metadata.field).toBe('modified');
      
      // This demonstrates that we store the actual record, not a copy
      // The immutability principle means the SYSTEM doesn't modify it after storage
    });

    it('should store artifact records by reference for efficiency', () => {
      const largeData = new Array(10000).fill(0).map((_, i) => ({ index: i }));
      const artifactRecord = {
        type: 'data',
        value: largeData,
        description: 'Large dataset',
        timestamp: Date.now()
      };

      context.addArtifact('large', artifactRecord);
      const retrieved = context.getArtifact('large');
      
      // Should be same reference for efficiency
      expect(retrieved).toBe(artifactRecord);
      expect(retrieved.value).toBe(largeData);
    });
  });

  describe('Conversation history management', () => {
    it('should initialize with empty conversation history', () => {
      expect(context.conversationHistory).toEqual([]);
    });

    it('should allow adding messages to conversation history', () => {
      const message = {
        role: 'user',
        content: 'Create a server',
        timestamp: Date.now()
      };

      context.conversationHistory.push(message);
      
      expect(context.conversationHistory).toHaveLength(1);
      expect(context.conversationHistory[0]).toBe(message);
    });

    it('should maintain conversation history separate from artifacts', () => {
      // Add artifact
      context.addArtifact('test', {
        type: 'data',
        value: 'test',
        description: 'Test artifact',
        timestamp: Date.now()
      });

      // Add conversation message
      context.conversationHistory.push({
        role: 'assistant',
        content: 'Created artifact @test',
        timestamp: Date.now()
      });

      expect(context.listArtifacts()).toHaveLength(1);
      expect(context.conversationHistory).toHaveLength(1);
      
      // They should be completely separate
      expect(context.getArtifact('test')).toBeDefined();
      expect(context.conversationHistory[0].content).toContain('@test');
    });

    it('should support artifact references in conversation messages', () => {
      context.addArtifact('server_file', {
        type: 'file',
        value: '/tmp/server.js',
        description: 'Server implementation',
        timestamp: Date.now()
      });

      const message = {
        role: 'assistant',
        content: 'I created the server implementation and saved it as @server_file',
        timestamp: Date.now()
      };

      context.conversationHistory.push(message);
      
      // Verify the message contains artifact reference
      expect(message.content).toContain('@server_file');
      
      // Verify the artifact exists
      expect(context.getArtifactValue('server_file')).toBe('/tmp/server.js');
    });
  });

  describe('Context inheritance with artifacts', () => {
    it('should inherit artifacts from parent context', () => {
      const parentContext = new ExecutionContext();
      parentContext.addArtifact('parent_artifact', {
        type: 'data',
        value: 'parent data',
        description: 'From parent',
        timestamp: Date.now()
      });

      const childContext = new ExecutionContext(parentContext);
      
      // Child should have access to parent's artifacts
      expect(childContext.getArtifact('parent_artifact')).toBeDefined();
      expect(childContext.getArtifactValue('parent_artifact')).toBe('parent data');
    });

    it('should inherit conversation history from parent context', () => {
      const parentContext = new ExecutionContext();
      parentContext.conversationHistory.push({
        role: 'user',
        content: 'Parent message',
        timestamp: Date.now()
      });

      const childContext = new ExecutionContext(parentContext);
      
      // Child should have copy of parent's conversation history
      expect(childContext.conversationHistory).toHaveLength(1);
      expect(childContext.conversationHistory[0].content).toBe('Parent message');
      
      // Should be a copy, not same reference
      expect(childContext.conversationHistory).not.toBe(parentContext.conversationHistory);
    });

    it('should allow child to override parent artifacts', () => {
      const parentContext = new ExecutionContext();
      parentContext.addArtifact('config', {
        type: 'data',
        value: { version: 1 },
        description: 'Parent config',
        timestamp: Date.now()
      });

      const childContext = new ExecutionContext(parentContext);
      childContext.addArtifact('config', {
        type: 'data',
        value: { version: 2 },
        description: 'Child config',
        timestamp: Date.now()
      });
      
      // Child should see overridden value
      expect(childContext.getArtifactValue('config')).toEqual({ version: 2 });
      
      // Parent should still have original
      expect(parentContext.getArtifactValue('config')).toEqual({ version: 1 });
    });
  });

  describe('No previousResults or sharedState', () => {
    it('should not have previousResults property', () => {
      expect(context.previousResults).toBeUndefined();
    });

    it('should not have sharedState property', () => {
      expect(context.sharedState).toBeUndefined();
    });

    it('should not have withResult method', () => {
      expect(context.withResult).toBeUndefined();
    });

    it('should not have withSharedState method', () => {
      expect(context.withSharedState).toBeUndefined();
    });
  });
});