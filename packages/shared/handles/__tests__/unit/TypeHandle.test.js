/**
 * TypeHandle Unit Tests
 * Test Smalltalk-style introspection capabilities
 */

import { jest } from '@jest/globals';
import { TypeHandle } from '../../src/TypeHandle.js';

describe('TypeHandle', () => {
  let typeHandle;
  let mockMetadata;

  beforeEach(() => {
    mockMetadata = {
      methods: {
        read: { 
          params: [], 
          returns: 'string', 
          cacheable: true,
          documentation: 'Read file contents'
        },
        write: { 
          params: ['content:string'], 
          returns: 'boolean', 
          sideEffects: ['content-changed'],
          documentation: 'Write content to file'
        },
        stat: { 
          params: [], 
          returns: 'object', 
          cacheable: true 
        }
      },
      attributes: {
        path: { type: 'string', readonly: true },
        size: { type: 'number', computed: true },
        extension: { type: 'string', readonly: true }
      },
      documentation: {
        description: "Test file handle for unit testing",
        examples: ["handle.read()", "handle.write('content')"]
      },
      version: '1.0.0'
    };

    typeHandle = new TypeHandle('FileHandle', mockMetadata);
  });

  describe('Initialization', () => {
    test('should extend Actor class', () => {
      expect(typeHandle.isActor).toBe(true);
    });

    test('should initialize with type name and metadata', () => {
      expect(typeHandle.name).toBe('FileHandle');
      expect(typeHandle.methods).toBe(mockMetadata.methods);
      expect(typeHandle.attributes).toBe(mockMetadata.attributes);
      expect(typeHandle.documentation).toBe(mockMetadata.documentation);
      expect(typeHandle.version).toBe('1.0.0');
    });
  });

  describe('Smalltalk-style Introspection', () => {
    test('should list all method names', () => {
      const methods = typeHandle.listMethods();
      
      expect(methods).toEqual(['read', 'write', 'stat']);
    });

    test('should list all attribute names', () => {
      const attributes = typeHandle.listAttributes();
      
      expect(attributes).toEqual(['path', 'size', 'extension']);
    });

    test('should get method signature by name', () => {
      const readSignature = typeHandle.getMethodSignature('read');
      
      expect(readSignature).toEqual({
        params: [],
        returns: 'string',
        cacheable: true,
        documentation: 'Read file contents'
      });
    });

    test('should return undefined for non-existent method signature', () => {
      const signature = typeHandle.getMethodSignature('nonExistentMethod');
      
      expect(signature).toBeUndefined();
    });

    test('should get attribute type by name', () => {
      const pathType = typeHandle.getAttributeType('path');
      
      expect(pathType).toEqual({
        type: 'string',
        readonly: true
      });
    });

    test('should return undefined for non-existent attribute type', () => {
      const attrType = typeHandle.getAttributeType('nonExistentAttr');
      
      expect(attrType).toBeUndefined();
    });

    test('should get documentation for items', () => {
      const methodDoc = typeHandle.getDocumentation('read');
      expect(methodDoc).toBe('Read file contents');
      
      const typeDoc = typeHandle.getDocumentation();
      expect(typeDoc).toBe(mockMetadata.documentation);
    });
  });

  describe('Type Compatibility Checking', () => {
    test('should check if method exists', () => {
      expect(typeHandle.respondsTo('read')).toBe(true);
      expect(typeHandle.respondsTo('write')).toBe(true);
      expect(typeHandle.respondsTo('nonExistentMethod')).toBe(false);
    });

    test('should check compatibility with other types', () => {
      const otherType = new TypeHandle('OtherHandle', {
        methods: { read: { params: [], returns: 'string' } },
        attributes: { path: { type: 'string' } }
      });
      
      // Should be compatible if has overlapping interface
      expect(typeHandle.isCompatibleWith(otherType)).toBe(true);
      
      const incompatibleType = new TypeHandle('IncompatibleHandle', {
        methods: { process: { params: ['data'], returns: 'object' } },
        attributes: { id: { type: 'number' } }
      });
      
      // Should be incompatible if no overlapping methods
      expect(typeHandle.isCompatibleWith(incompatibleType)).toBe(false);
    });
  });

  describe('Actor Integration', () => {
    test('should inherit Actor message handling', () => {
      expect(typeof typeHandle.receive).toBe('function');
      expect(typeof typeHandle.call).toBe('function');
    });

    test('should handle introspection requests via actor messages', async () => {
      const methods = await typeHandle.receive('list-methods', {});
      expect(methods).toEqual(['read', 'write', 'stat']);
      
      const attributes = await typeHandle.receive('list-attributes', {});
      expect(attributes).toEqual(['path', 'size', 'extension']);
    });

    test('should handle method signature requests', async () => {
      const signature = await typeHandle.receive('get-method-signature', {
        method: 'write'
      });
      
      expect(signature).toEqual({
        params: ['content:string'],
        returns: 'boolean',
        sideEffects: ['content-changed'],
        documentation: 'Write content to file'
      });
    });
  });

  describe('Metadata Access', () => {
    test('should provide access to complete metadata', () => {
      expect(typeHandle.getMetadata()).toEqual(mockMetadata);
    });

    test('should provide version information', () => {
      expect(typeHandle.getVersion()).toBe('1.0.0');
    });

    test('should provide type description', () => {
      expect(typeHandle.getDescription()).toBe('Test file handle for unit testing');
    });

    test('should provide usage examples', () => {
      const examples = typeHandle.getExamples();
      expect(examples).toEqual(["handle.read()", "handle.write('content')"]);
    });
  });
});