/**
 * Core Handle Integration Test - Phase 1
 * 
 * Tests BaseHandle + TypeHandle + TypeHandleRegistry integration
 * NO MOCKS - uses real classes only
 */

import { BaseHandle } from '../../src/BaseHandle.js';
import { TypeHandle } from '../../src/TypeHandle.js';
import { TypeHandleRegistry } from '../../src/TypeHandleRegistry.js';

describe('Core Handle Integration', () => {
  let registry;
  let fileHandleMetadata;

  beforeAll(() => {
    // Set up global registry for tests
    registry = TypeHandleRegistry.getGlobalRegistry();
    
    // Define realistic file handle metadata
    fileHandleMetadata = {
      methods: {
        read: { 
          params: [], 
          returns: 'string', 
          cacheable: true,
          documentation: 'Read file contents as string'
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
          cacheable: true,
          documentation: 'Get file statistics'
        }
      },
      attributes: {
        path: { type: 'string', readonly: true },
        size: { type: 'number', computed: true },
        extension: { type: 'string', readonly: true }
      },
      documentation: {
        description: "File handle for reading and writing files",
        examples: [
          "const content = await fileHandle.read()",
          "await fileHandle.write('new content')"
        ]
      },
      version: '1.0.0'
    };
  });

  beforeEach(() => {
    // Clear registry before each test
    registry.clear();
  });

  describe('BaseHandle + TypeHandle Integration', () => {
    test('should create handle with proper type introspection', () => {
      // Register type first
      const fileType = registry.registerType('FileHandle', fileHandleMetadata);
      
      // Create handle
      const fileHandle = new BaseHandle('FileHandle', { path: '/test/file.txt' });
      
      // Verify Actor inheritance
      expect(fileHandle.isActor).toBe(true);
      
      // Verify type introspection works
      const type = fileHandle.type;
      expect(type).toBe(fileType);
      expect(type.name).toBe('FileHandle');
      expect(type.listMethods()).toEqual(['read', 'write', 'stat']);
      expect(type.listAttributes()).toEqual(['path', 'size', 'extension']);
    });

    test('should fail fast when type not registered', () => {
      // Clear global registry to simulate unregistered type
      const originalRegistry = global.TypeHandleRegistry;
      delete global.TypeHandleRegistry;
      
      const handle = new BaseHandle('UnregisteredType', {});
      expect(() => handle.type).toThrow('TypeHandleRegistry not available');
      
      // Restore for other tests
      global.TypeHandleRegistry = originalRegistry;
      
      // Also test when registry exists but type not registered
      const handle2 = new BaseHandle('UnregisteredType', {});
      expect(handle2.type).toBeNull(); // Should return null for missing type
    });
  });

  describe('TypeHandle + TypeHandleRegistry Integration', () => {
    test('should register and retrieve types correctly', () => {
      const fileType = registry.registerType('FileHandle', fileHandleMetadata);
      
      // Verify registration
      expect(registry.hasType('FileHandle')).toBe(true);
      expect(registry.getTypeHandle('FileHandle')).toBe(fileType);
      
      // Verify introspection works
      expect(fileType.name).toBe('FileHandle');
      expect(fileType.respondsTo('read')).toBe(true);
      expect(fileType.respondsTo('nonExistentMethod')).toBe(false);
    });

    test('should handle multiple type registrations', () => {
      const imageMetadata = {
        methods: {
          getUrl: { params: [], returns: 'string' },
          resize: { params: ['width:number', 'height:number'], returns: 'object' }
        },
        attributes: {
          path: { type: 'string', readonly: true },
          width: { type: 'number', readonly: true },
          height: { type: 'number', readonly: true }
        },
        documentation: {
          description: "Image handle for image operations"
        }
      };

      const fileType = registry.registerType('FileHandle', fileHandleMetadata);
      const imageType = registry.registerType('ImageHandle', imageMetadata);
      
      expect(registry.listTypeNames()).toEqual(['FileHandle', 'ImageHandle']);
      expect(registry.getTypeHandle('FileHandle')).toBe(fileType);
      expect(registry.getTypeHandle('ImageHandle')).toBe(imageType);
    });
  });

  describe('Complete Handle Lifecycle Integration', () => {
    test('should create handle, access type, and use introspection end-to-end', () => {
      // Register type
      registry.registerType('FileHandle', fileHandleMetadata);
      
      // Create handle
      const handle = new BaseHandle('FileHandle', { path: '/test/file.txt' });
      
      // Set attributes
      handle.setAttribute('path', '/test/file.txt');
      handle.setAttribute('size', 1024);
      
      // Use type introspection
      const type = handle.type;
      expect(type.name).toBe('FileHandle');
      
      // Check method availability via introspection
      const methods = type.listMethods();
      expect(methods).toContain('read');
      expect(methods).toContain('write');
      
      // Get method signatures
      const readSig = type.getMethodSignature('read');
      expect(readSig.cacheable).toBe(true);
      expect(readSig.documentation).toContain('Read file contents');
      
      // Check attribute types
      const pathType = type.getAttributeType('path');
      expect(pathType.type).toBe('string');
      expect(pathType.readonly).toBe(true);
      
      // Verify attributes work
      expect(handle.getAttribute('path')).toBe('/test/file.txt');
      expect(handle.getAttribute('size')).toBe(1024);
    });

    test('should support type compatibility checking', () => {
      // Register file type
      registry.registerType('FileHandle', fileHandleMetadata);
      
      // Register text type with overlapping interface
      const textMetadata = {
        methods: {
          read: { params: [], returns: 'string' },
          append: { params: ['content:string'], returns: 'boolean' }
        },
        attributes: {
          path: { type: 'string', readonly: true }
        }
      };
      registry.registerType('TextHandle', textMetadata);
      
      const fileType = registry.getTypeHandle('FileHandle');
      const textType = registry.getTypeHandle('TextHandle');
      
      // Should be compatible (both have read method)
      expect(fileType.isCompatibleWith(textType)).toBe(true);
      expect(textType.isCompatibleWith(fileType)).toBe(true);
    });
  });

  describe('Auto-Registration Integration', () => {
    test('should auto-register from properly structured handle class', () => {
      class TestFileHandle {
        static getTypeName() {
          return 'TestFileHandle';
        }
        
        static getTypeMetadata() {
          return fileHandleMetadata;
        }
      }

      const typeHandle = registry.autoRegisterFromClass(TestFileHandle);
      
      expect(typeHandle.name).toBe('TestFileHandle');
      expect(registry.hasType('TestFileHandle')).toBe(true);
      
      // Verify metadata was registered correctly
      const retrievedType = registry.getTypeHandle('TestFileHandle');
      expect(retrievedType).toBe(typeHandle);
      expect(retrievedType.listMethods()).toEqual(['read', 'write', 'stat']);
    });

    test('should auto-extract metadata when getTypeMetadata not provided', () => {
      class AutoExtractHandle {
        static getTypeName() {
          return 'AutoExtractHandle';
        }
        
        // Methods that should be auto-detected
        async read() { }
        async write(content) { }
        
        // Getters/setters that should become attributes
        get path() { return this._path; }
        set path(value) { this._path = value; }
        
        get size() { return this._size; }
      }

      const typeHandle = registry.autoRegisterFromClass(AutoExtractHandle);
      
      expect(typeHandle.name).toBe('AutoExtractHandle');
      expect(typeHandle.listMethods().length).toBeGreaterThan(0);
      expect(typeHandle.listAttributes()).toContain('path');
      expect(typeHandle.listAttributes()).toContain('size');
    });
  });

  describe('Global Registry Integration', () => {
    test('should maintain global registry across handle creations', () => {
      // Register type in global registry
      const globalRegistry = TypeHandleRegistry.getGlobalRegistry();
      globalRegistry.registerType('GlobalTestHandle', fileHandleMetadata);
      
      // Create handle using global registry
      const handle = new BaseHandle('GlobalTestHandle', {});
      
      // Should be able to access type via global registry
      expect(handle.type.name).toBe('GlobalTestHandle');
      expect(handle.type.listMethods()).toContain('read');
      
      // Verify same registry instance
      expect(global.TypeHandleRegistry).toBe(globalRegistry);
    });

    test('should maintain singleton behavior', () => {
      const registry1 = TypeHandleRegistry.getGlobalRegistry();
      const registry2 = TypeHandleRegistry.getGlobalRegistry();
      
      expect(registry1).toBe(registry2);
      expect(registry1).toBe(global.TypeHandleRegistry);
    });
  });

  describe('Error Handling Integration', () => {
    test('should fail fast on invalid type registration', () => {
      expect(() => {
        registry.registerType('InvalidHandle', null);
      }).toThrow('Type metadata is required');
      
      expect(() => {
        registry.registerType('InvalidHandle', { attributes: {} });
      }).toThrow('Type metadata must include methods');
    });

    test('should fail fast on duplicate registration', () => {
      registry.registerType('DuplicateHandle', fileHandleMetadata);
      
      expect(() => {
        registry.registerType('DuplicateHandle', fileHandleMetadata);
      }).toThrow('Type DuplicateHandle already registered');
    });

    test('should fail fast on invalid class auto-registration', () => {
      class InvalidClass {
        // Missing getTypeName static method
      }

      expect(() => {
        registry.autoRegisterFromClass(InvalidClass);
      }).toThrow('Handle class must implement getTypeName() static method');
    });
  });
});