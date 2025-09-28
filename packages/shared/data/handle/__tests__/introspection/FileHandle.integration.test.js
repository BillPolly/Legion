/**
 * Integration tests for Handle introspection with file system resources
 * 
 * Tests that the introspection system works correctly with File-backed
 * Handles, demonstrating that introspection is universal across resource types.
 * 
 * CRITICAL: All operations must be synchronous - no await in tests!
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { Handle } from '../../src/Handle.js';
import { PrototypeFactory } from '../../src/PrototypeFactory.js';
import { SelfDescribingPrototypeFactory } from '../../src/introspection/SelfDescribingPrototypeFactory.js';
import { MetaHandle } from '../../src/introspection/MetaHandle.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('File Handle Introspection Integration', () => {
  const testDir = path.join(__dirname, '../tmp/file-introspection-test');
  let fileDataSource;
  
  // Initialize introspection and create test directory once before all tests
  beforeAll(async () => {
    await Handle.initializeIntrospection();
    
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Create test files
    const configFile = path.join(testDir, 'config.json');
    fs.writeFileSync(configFile, JSON.stringify({
      app: 'TestApp',
      version: '1.0.0',
      settings: {
        debug: true,
        port: 3000
      }
    }, null, 2));
    
    const dataFile = path.join(testDir, 'users.json');
    fs.writeFileSync(dataFile, JSON.stringify([
      { id: 1, name: 'Alice', role: 'admin' },
      { id: 2, name: 'Bob', role: 'user' },
      { id: 3, name: 'Charlie', role: 'user' }
    ], null, 2));
    
    const schemaFile = path.join(testDir, 'schema.json');
    fs.writeFileSync(schemaFile, JSON.stringify({
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        role: { type: 'string', enum: ['admin', 'user', 'guest'] }
      },
      required: ['id', 'name']
    }, null, 2));
  });
  
  // Cleanup after all tests
  afterAll(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  describe('File DataSource with introspection', () => {
    beforeEach(() => {
      // Create a File DataSource
      fileDataSource = {
        basePath: testDir,
        
        query: function(querySpec) {
          if (querySpec.type === 'list-files') {
            // List files in directory
            const files = fs.readdirSync(this.basePath);
            return files.map(file => ({
              name: file,
              path: path.join(this.basePath, file),
              isFile: fs.statSync(path.join(this.basePath, file)).isFile()
            }));
          }
          
          if (querySpec.type === 'read-file' && querySpec.path) {
            // Read file content
            const filePath = path.isAbsolute(querySpec.path) 
              ? querySpec.path 
              : path.join(this.basePath, querySpec.path);
            
            if (fs.existsSync(filePath)) {
              const content = fs.readFileSync(filePath, 'utf8');
              const ext = path.extname(filePath);
              
              if (ext === '.json') {
                return JSON.parse(content);
              }
              return content;
            }
            return null;
          }
          
          if (querySpec.type === 'file-stats' && querySpec.path) {
            const filePath = path.isAbsolute(querySpec.path) 
              ? querySpec.path 
              : path.join(this.basePath, querySpec.path);
            
            if (fs.existsSync(filePath)) {
              const stats = fs.statSync(filePath);
              return {
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                isFile: stats.isFile(),
                isDirectory: stats.isDirectory()
              };
            }
            return null;
          }
          
          return [];
        },
        
        subscribe: function(querySpec, callback) {
          // Mock file system watcher
          const watchers = [];
          
          if (querySpec.type === 'watch-file' && querySpec.path) {
            const filePath = path.isAbsolute(querySpec.path) 
              ? querySpec.path 
              : path.join(this.basePath, querySpec.path);
            
            // Would use fs.watch in real implementation
            // For now, return mock subscription
          }
          
          return {
            unsubscribe: () => {
              watchers.forEach(w => w.close?.());
            }
          };
        },
        
        queryBuilder: function(sourceHandle) {
          return {
            path: null,
            operation: null,
            
            file: function(filePath) {
              this.path = filePath;
              return this;
            },
            
            read: function() {
              this.operation = 'read';
              return this;
            },
            
            list: function() {
              this.operation = 'list';
              return this;
            },
            
            build: function() {
              if (this.operation === 'read') {
                return { type: 'read-file', path: this.path };
              } else if (this.operation === 'list') {
                return { type: 'list-files', path: this.path };
              }
              return {};
            }
          };
        },
        
        getSchema: function() {
          return {
            type: 'file-system',
            operations: {
              'list-files': {
                description: 'List files in directory',
                returns: 'array'
              },
              'read-file': {
                description: 'Read file content',
                parameters: { path: 'string' },
                returns: 'string|object'
              },
              'write-file': {
                description: 'Write file content',
                parameters: { path: 'string', content: 'string|object' }
              },
              'file-stats': {
                description: 'Get file statistics',
                parameters: { path: 'string' },
                returns: 'object'
              }
            },
            fileTypes: {
              json: { parser: 'JSON', contentType: 'application/json' },
              txt: { parser: 'text', contentType: 'text/plain' },
              js: { parser: 'javascript', contentType: 'application/javascript' }
            }
          };
        }
      };
    });
    
    it('should create introspectable File Handle', () => {
      // Create File Handle
      const fileHandle = new Handle(fileDataSource);
      
      // Test introspection capability
      const prototype = fileHandle.getPrototype();
      expect(prototype).toBeDefined();
      expect(prototype).toBeInstanceOf(MetaHandle);
      
      // Query prototype information
      const result = prototype.query({ type: 'prototype-members', filter: 'methods' });
      expect(result.methods).toContain('query');
      expect(result.methods).toContain('subscribe');
      expect(result.methods).toContain('getPrototype');
    });
    
    it('should analyze file structure schema for type information', () => {
      // Create PrototypeFactory and analyze file system schema
      const factory = new PrototypeFactory(Handle);
      
      // Define schema for file system entities
      const schema = {
        ':file/path': { ':db/valueType': ':db.type/string', ':db/unique': ':db.unique/identity' },
        ':file/name': { ':db/valueType': ':db.type/string' },
        ':file/extension': { ':db/valueType': ':db.type/string' },
        ':file/size': { ':db/valueType': ':db.type/number' },
        ':file/content': { ':db/valueType': ':db.type/string' },
        ':directory/path': { ':db/valueType': ':db.type/string', ':db/unique': ':db.unique/identity' },
        ':directory/name': { ':db/valueType': ':db.type/string' },
        ':directory/files': { ':db/valueType': ':db.type/ref', ':db/cardinality': ':db.cardinality/many' }
      };
      
      const analysis = factory.analyzeSchema(schema, 'datascript');
      
      expect(analysis.types).toBeDefined();
      expect(analysis.types.has('file')).toBe(true);
      expect(analysis.types.has('directory')).toBe(true);
      
      // Get file type info
      const fileType = analysis.types.get('file');
      expect(fileType).toBeDefined();
      expect(fileType.attributes.has('path')).toBe(true);
      expect(fileType.attributes.has('name')).toBe(true);
      expect(fileType.attributes.has('extension')).toBe(true);
      expect(fileType.attributes.has('size')).toBe(true);
      expect(fileType.attributes.has('content')).toBe(true);
    });
    
    it('should create typed File Handles with introspection', () => {
      const factory = new PrototypeFactory(Handle);
      const introspectiveFactory = new SelfDescribingPrototypeFactory();
      
      // Analyze file schema
      const schema = {
        ':config/path': { ':db/valueType': ':db.type/string' },
        ':config/app': { ':db/valueType': ':db.type/string' },
        ':config/version': { ':db/valueType': ':db.type/string' },
        ':config/settings': { ':db/valueType': ':db.type/object' }
      };
      
      factory.analyzeSchema(schema, 'datascript');
      
      // Get config prototype
      const ConfigPrototype = factory.getEntityPrototype('config', Handle);
      
      // Wrap as MetaHandle for introspection
      const configMetaHandle = introspectiveFactory.wrapExistingPrototype('config', ConfigPrototype);
      
      // Create instance for specific config file
      const configPath = path.join(testDir, 'config.json');
      const configHandle = configMetaHandle.createInstance(fileDataSource, configPath);
      
      expect(configHandle).toBeDefined();
      expect(configHandle.entityId).toBe(configPath);
      expect(configHandle.typeName).toBe('config');
      
      // Test that it has typed methods
      expect(typeof configHandle.getAvailableAttributes).toBe('function');
      const attrs = configHandle.getAvailableAttributes();
      expect(attrs).toContain('path');
      expect(attrs).toContain('app');
      expect(attrs).toContain('version');
      expect(attrs).toContain('settings');
      
      // Test introspection on instance
      const instancePrototype = configHandle.getPrototype();
      expect(instancePrototype).toBeInstanceOf(MetaHandle);
      expect(instancePrototype.getTypeName()).toBe('config');
    });
    
    it('should support reading file data through typed Handles', () => {
      const factory = new PrototypeFactory(Handle);
      const introspectiveFactory = new SelfDescribingPrototypeFactory();
      
      // Set up schema and prototypes for data files
      const schema = {
        ':datafile/path': { ':db/valueType': ':db.type/string' },
        ':datafile/name': { ':db/valueType': ':db.type/string' },
        ':datafile/format': { ':db/valueType': ':db.type/string' },
        ':datafile/records': { ':db/valueType': ':db.type/array' }
      };
      
      factory.analyzeSchema(schema, 'datascript');
      const DataFilePrototype = factory.getEntityPrototype('datafile', Handle);
      const dataFileMetaHandle = introspectiveFactory.wrapExistingPrototype('datafile', DataFilePrototype);
      
      // Create data file handle
      const dataPath = path.join(testDir, 'users.json');
      const dataFileHandle = dataFileMetaHandle.createInstance(fileDataSource, dataPath);
      
      // Get introspection info
      const info = dataFileHandle.getIntrospectionInfo();
      expect(info.entityType).toBe('datafile');
      expect(info.entityId).toBe(dataPath);
      expect(info.availableAttributes).toContain('path');
      expect(info.availableAttributes).toContain('name');
      expect(info.availableAttributes).toContain('format');
      expect(info.availableAttributes).toContain('records');
    });
  });
  
  describe('File system schema evolution', () => {
    it('should detect and adapt to file format changes', () => {
      const factory = new PrototypeFactory(Handle);
      const introspectiveFactory = new SelfDescribingPrototypeFactory();
      
      // Initial schema for simple text files
      let currentSchema = {
        ':textfile/path': { ':db/valueType': ':db.type/string' },
        ':textfile/content': { ':db/valueType': ':db.type/string' }
      };
      
      factory.analyzeSchema(currentSchema, 'datascript');
      const TextFilePrototypeV1 = factory.getEntityPrototype('textfile', Handle);
      const textMetaV1 = introspectiveFactory.wrapExistingPrototype('textfile-v1', TextFilePrototypeV1);
      
      // Check initial attributes
      const instanceV1 = textMetaV1.createInstance(fileDataSource, 'test.txt');
      const attrsV1 = instanceV1.getAvailableAttributes();
      expect(attrsV1).toHaveLength(2);
      expect(attrsV1).toContain('path');
      expect(attrsV1).toContain('content');
      
      // Schema evolution - add metadata fields
      factory.clearCache(); // Clear to re-analyze
      
      const evolvedSchema = {
        ':textfile/path': { ':db/valueType': ':db.type/string' },
        ':textfile/content': { ':db/valueType': ':db.type/string' },
        ':textfile/encoding': { ':db/valueType': ':db.type/string' },
        ':textfile/lineCount': { ':db/valueType': ':db.type/number' },
        ':textfile/checksum': { ':db/valueType': ':db.type/string' },
        ':textfile/metadata': { ':db/valueType': ':db.type/object' }
      };
      
      factory.analyzeSchema(evolvedSchema, 'datascript');
      const TextFilePrototypeV2 = factory.getEntityPrototype('textfile', Handle);
      const textMetaV2 = introspectiveFactory.wrapExistingPrototype('textfile-v2', TextFilePrototypeV2);
      
      // Check evolved attributes
      const instanceV2 = textMetaV2.createInstance(fileDataSource, 'test.txt');
      const attrsV2 = instanceV2.getAvailableAttributes();
      expect(attrsV2).toHaveLength(6);
      expect(attrsV2).toContain('encoding');
      expect(attrsV2).toContain('lineCount');
      expect(attrsV2).toContain('checksum');
      expect(attrsV2).toContain('metadata');
    });
  });
  
  describe('File system relationships', () => {
    it('should handle directory-file relationships through introspection', () => {
      const factory = new PrototypeFactory(Handle);
      const introspectiveFactory = new SelfDescribingPrototypeFactory();
      
      // Schema with directory-file relationships
      const schema = {
        ':project/path': { ':db/valueType': ':db.type/string' },
        ':project/name': { ':db/valueType': ':db.type/string' },
        ':project/sourceFiles': { ':db/valueType': ':db.type/ref', ':db/cardinality': ':db.cardinality/many' },
        ':project/configFile': { ':db/valueType': ':db.type/ref' },
        ':project/outputDir': { ':db/valueType': ':db.type/ref' }
      };
      
      factory.analyzeSchema(schema, 'datascript');
      const ProjectPrototype = factory.getEntityPrototype('project', Handle);
      const projectMetaHandle = introspectiveFactory.wrapExistingPrototype('project', ProjectPrototype);
      
      // Create project handle
      const projectHandle = projectMetaHandle.createInstance(fileDataSource, testDir);
      
      // Get all attributes including refs
      const attrs = projectHandle.getAvailableAttributes();
      expect(attrs).toContain('sourceFiles');
      expect(attrs).toContain('configFile');
      expect(attrs).toContain('outputDir');
      
      // Get attribute info for reference fields
      const sourceFilesInfo = projectHandle.getAttributeInfo('sourceFiles');
      expect(sourceFilesInfo).toBeDefined();
      expect(sourceFilesInfo.type).toBe('ref');
      expect(sourceFilesInfo.cardinality).toBe('many');
      
      const configFileInfo = projectHandle.getAttributeInfo('configFile');
      expect(configFileInfo).toBeDefined();
      expect(configFileInfo.type).toBe('ref');
      expect(configFileInfo.cardinality).toBe('one');
    });
  });
  
  describe('File Handle metadata and statistics', () => {
    it('should track file operation statistics through introspection', () => {
      const factory = new PrototypeFactory(Handle);
      
      // Analyze schema for different file types
      const schema = {
        ':json/path': { ':db/valueType': ':db.type/string' },
        ':json/data': { ':db/valueType': ':db.type/object' },
        ':text/path': { ':db/valueType': ':db.type/string' },
        ':text/content': { ':db/valueType': ':db.type/string' },
        ':binary/path': { ':db/valueType': ':db.type/string' },
        ':binary/size': { ':db/valueType': ':db.type/number' }
      };
      
      factory.analyzeSchema(schema, 'datascript');
      
      // Get factory statistics
      const stats = factory.getStats();
      expect(stats.schemaTypes).toBe(3); // json, text, binary
      expect(stats.entityPrototypes).toBe(0); // None created yet
      
      // Create prototypes
      factory.getEntityPrototype('json', Handle);
      factory.getEntityPrototype('text', Handle);
      factory.getEntityPrototype('binary', Handle);
      
      const statsAfter = factory.getStats();
      expect(statsAfter.entityPrototypes).toBe(3);
    });
    
    it('should provide file system capabilities through introspection', () => {
      const factory = new PrototypeFactory(Handle);
      const introspectiveFactory = new SelfDescribingPrototypeFactory();
      
      // Create file prototype WITHOUT setting capabilities on factory
      // TypedHandle.getCapabilities() only returns base Handle capabilities 
      // plus any capabilities set on the specific type
      const schema = {
        ':file/path': { ':db/valueType': ':db.type/string' },
        ':file/content': { ':db/valueType': ':db.type/string' }
      };
      
      factory.analyzeSchema(schema, 'datascript');
      
      // Set capabilities AFTER analysis so the type exists
      factory.capabilities.set('file', ['read', 'write', 'delete', 'rename', 'stat']);
      
      const FilePrototype = factory.getEntityPrototype('file', Handle);
      const fileMetaHandle = introspectiveFactory.wrapExistingPrototype('file', FilePrototype);
      
      // Create file handle
      const fileHandle = fileMetaHandle.createInstance(fileDataSource, 'test.txt');
      
      // Check capabilities through introspection
      const capabilities = fileHandle.getCapabilities();
      expect(capabilities).toContain('read');
      expect(capabilities).toContain('write');
      expect(capabilities).toContain('query'); // From Handle
      expect(capabilities).toContain('introspect'); // From Handle
    });
  });
});