import { describe, test, expect, beforeEach, afterAll } from '@jest/globals';
import { StorageConfig } from '../../src/storage/StorageConfig.js';
import { InMemoryTripleStore } from '@legion/kg-storage-memory';
import { ValidationError } from '@legion/kg-storage-core';

describe('StorageConfig', () => {
  describe('createStore', () => {
    test('should create InMemoryTripleStore by default', () => {
      const store = StorageConfig.createStore();
      expect(store).toBeInstanceOf(InMemoryTripleStore);
      expect(store.getMetadata().type).toBe('memory');
    });

    test('should create InMemoryTripleStore for memory type', () => {
      const store = StorageConfig.createStore({ type: 'memory' });
      expect(store).toBeInstanceOf(InMemoryTripleStore);
      expect(store.getMetadata().type).toBe('memory');
    });

    test('should create FileSystemTripleStore for file type', () => {
      const store = StorageConfig.createStore({ type: 'file', path: './test.json' });
      expect(store.getMetadata().type).toBe('file');
    });

    test('should create all implemented storage types', () => {
      // GitHub storage
      const githubStore = StorageConfig.createStore({ 
        type: 'github', 
        repo: 'test/repo', 
        path: 'data.json', 
        token: 'ghp_test_token' 
      });
      expect(githubStore.getMetadata().type).toBe('github');

      // SQL storage
      const sqlStore = StorageConfig.createStore({ 
        type: 'sql', 
        connection: 'sqlite::memory:' 
      });
      expect(sqlStore.getMetadata().type).toBe('sql');

      // MongoDB storage
      const mongoStore = StorageConfig.createStore({ 
        type: 'mongo', 
        connection: 'mongodb://localhost/test' 
      });
      expect(mongoStore.getMetadata().type).toBe('mongodb');

      // GraphDB storage
      const graphStore = StorageConfig.createStore({ 
        type: 'graphdb', 
        connection: 'bolt://localhost:7687', 
        database: 'neo4j' 
      });
      expect(graphStore.getMetadata().type).toBe('graphdb');

      // Remote storage
      const remoteStore = StorageConfig.createStore({ 
        type: 'remote', 
        endpoint: 'http://localhost:3000/api' 
      });
      expect(remoteStore.getMetadata().type).toBe('remote');
    });

    test('should throw error for unknown storage type', () => {
      expect(() => {
        StorageConfig.createStore({ type: 'unknown' });
      }).toThrow(ValidationError);
      expect(() => {
        StorageConfig.createStore({ type: 'unknown' });
      }).toThrow('Unsupported storage type: unknown');
    });
  });

  describe('validateConfig', () => {
    test('should validate memory config', () => {
      expect(() => {
        StorageConfig.validateConfig({ type: 'memory' });
      }).not.toThrow();
    });

    test('should require config object', () => {
      expect(() => {
        StorageConfig.validateConfig(null);
      }).toThrow(ValidationError);
      expect(() => {
        StorageConfig.validateConfig(null);
      }).toThrow('Configuration must be an object');
    });

    test('should require type property', () => {
      expect(() => {
        StorageConfig.validateConfig({});
      }).toThrow(ValidationError);
      expect(() => {
        StorageConfig.validateConfig({});
      }).toThrow('Configuration must have a valid type string');
    });

    test('should validate file config requirements', () => {
      expect(() => {
        StorageConfig.validateConfig({ type: 'file' });
      }).toThrow(ValidationError);
      expect(() => {
        StorageConfig.validateConfig({ type: 'file' });
      }).toThrow('File storage requires a "path" property');

      expect(() => {
        StorageConfig.validateConfig({ type: 'file', path: './test.json', format: 'invalid' });
      }).toThrow(ValidationError);
      expect(() => {
        StorageConfig.validateConfig({ type: 'file', path: './test.json', format: 'invalid' });
      }).toThrow('File storage format must be one of: json, turtle, ntriples');

      expect(() => {
        StorageConfig.validateConfig({ type: 'file', path: './test.json', format: 'json' });
      }).not.toThrow();
    });

    test('should validate GitHub config requirements', () => {
      expect(() => {
        StorageConfig.validateConfig({ type: 'github' });
      }).toThrow(ValidationError);
      expect(() => {
        StorageConfig.validateConfig({ type: 'github' });
      }).toThrow('GitHub storage requires a "repo" property');

      expect(() => {
        StorageConfig.validateConfig({ type: 'github', repo: 'test/repo' });
      }).toThrow(ValidationError);
      expect(() => {
        StorageConfig.validateConfig({ type: 'github', repo: 'test/repo' });
      }).toThrow('GitHub storage requires a "path" property');

      expect(() => {
        StorageConfig.validateConfig({ type: 'github', repo: 'test/repo', path: 'data.json' });
      }).toThrow(ValidationError);
      expect(() => {
        StorageConfig.validateConfig({ type: 'github', repo: 'test/repo', path: 'data.json' });
      }).toThrow('GitHub storage requires a "token" property');

      expect(() => {
        StorageConfig.validateConfig({ 
          type: 'github', 
          repo: 'test/repo', 
          path: 'data.json', 
          token: 'token' 
        });
      }).not.toThrow();
    });

    test('should validate SQL config requirements', () => {
      expect(() => {
        StorageConfig.validateConfig({ type: 'sql' });
      }).toThrow(ValidationError);
      expect(() => {
        StorageConfig.validateConfig({ type: 'sql' });
      }).toThrow('SQL storage requires a "connection" property');

      expect(() => {
        StorageConfig.validateConfig({ type: 'sql', connection: 'sqlite::memory:' });
      }).not.toThrow();
    });

    test('should validate MongoDB config requirements', () => {
      expect(() => {
        StorageConfig.validateConfig({ type: 'mongo' });
      }).toThrow(ValidationError);
      expect(() => {
        StorageConfig.validateConfig({ type: 'mongo' });
      }).toThrow('MongoDB storage requires a "connection" property');

      expect(() => {
        StorageConfig.validateConfig({ type: 'mongo', connection: 'mongodb://localhost/test' });
      }).not.toThrow();
    });

    test('should validate GraphDB config requirements', () => {
      expect(() => {
        StorageConfig.validateConfig({ type: 'graphdb' });
      }).toThrow(ValidationError);
      expect(() => {
        StorageConfig.validateConfig({ type: 'graphdb' });
      }).toThrow('GraphDB storage requires a "connection" property');

      expect(() => {
        StorageConfig.validateConfig({ type: 'graphdb', connection: 'bolt://localhost' });
      }).toThrow(ValidationError);
      expect(() => {
        StorageConfig.validateConfig({ type: 'graphdb', connection: 'bolt://localhost' });
      }).toThrow('GraphDB storage requires a "database" property (neo4j or arangodb)');

      expect(() => {
        StorageConfig.validateConfig({ 
          type: 'graphdb', 
          connection: 'bolt://localhost', 
          database: 'invalid' 
        });
      }).toThrow(ValidationError);

      expect(() => {
        StorageConfig.validateConfig({ 
          type: 'graphdb', 
          connection: 'bolt://localhost', 
          database: 'neo4j' 
        });
      }).not.toThrow();
    });

    test('should validate Remote config requirements', () => {
      expect(() => {
        StorageConfig.validateConfig({ type: 'remote' });
      }).toThrow(ValidationError);
      expect(() => {
        StorageConfig.validateConfig({ type: 'remote' });
      }).toThrow('Remote storage requires an "endpoint" property');

      expect(() => {
        StorageConfig.validateConfig({ type: 'remote', endpoint: 'http://api.example.com' });
      }).not.toThrow();
    });
  });

  describe('getDefaultConfig', () => {
    test('should return default memory config', () => {
      const config = StorageConfig.getDefaultConfig('memory');
      expect(config).toEqual({ type: 'memory' });
    });

    test('should return default file config', () => {
      const config = StorageConfig.getDefaultConfig('file');
      expect(config.type).toBe('file');
      expect(config.path).toBe('./data/knowledge-graph.json');
      expect(config.format).toBe('json');
      expect(config.autoSave).toBe(true);
      expect(config.watchForChanges).toBe(false);
    });

    test('should return default GitHub config', () => {
      const config = StorageConfig.getDefaultConfig('github');
      expect(config.type).toBe('github');
      expect(config.repo).toBe('username/knowledge-graph');
      expect(config.path).toBe('data/kg.json');
      expect(config.branch).toBe('main');
      expect(config.conflictResolution).toBe('merge');
    });

    test('should return default SQL config', () => {
      const config = StorageConfig.getDefaultConfig('sql');
      expect(config.type).toBe('sql');
      expect(config.table).toBe('triples');
      expect(config.poolSize).toBe(10);
      expect(config.enableTransactions).toBe(true);
    });

    test('should return default MongoDB config', () => {
      const config = StorageConfig.getDefaultConfig('mongo');
      expect(config.type).toBe('mongo');
      expect(config.collection).toBe('triples');
      expect(config.enableSharding).toBe(false);
    });

    test('should return default GraphDB config', () => {
      const config = StorageConfig.getDefaultConfig('graphdb');
      expect(config.type).toBe('graphdb');
      expect(config.database).toBe('neo4j');
    });

    test('should return default Remote config', () => {
      const config = StorageConfig.getDefaultConfig('remote');
      expect(config.type).toBe('remote');
      expect(config.timeout).toBe(30000);
      expect(config.retries).toBe(3);
    });

    test('should throw error for unknown type', () => {
      expect(() => {
        StorageConfig.getDefaultConfig('unknown');
      }).toThrow(ValidationError);
      expect(() => {
        StorageConfig.getDefaultConfig('unknown');
      }).toThrow('Unknown storage type: unknown');
    });
  });

  describe('createFromEnvironment', () => {
    const originalEnv = process.env;

    afterAll(() => {
      process.env = originalEnv;
    });

    test('should create memory store by default', () => {
      const oldType = process.env.KG_STORAGE_TYPE;
      delete process.env.KG_STORAGE_TYPE;
      
      const store = StorageConfig.createFromEnvironment();
      expect(store).toBeInstanceOf(InMemoryTripleStore);
      
      // Restore
      if (oldType) process.env.KG_STORAGE_TYPE = oldType;
    });

    test('should create memory store when KG_STORAGE_TYPE is memory', () => {
      const oldType = process.env.KG_STORAGE_TYPE;
      process.env.KG_STORAGE_TYPE = 'memory';
      
      const store = StorageConfig.createFromEnvironment();
      expect(store).toBeInstanceOf(InMemoryTripleStore);
      
      // Restore
      if (oldType) {
        process.env.KG_STORAGE_TYPE = oldType;
      } else {
        delete process.env.KG_STORAGE_TYPE;
      }
    });

    test('should create file store when KG_STORAGE_TYPE is file', () => {
      const oldType = process.env.KG_STORAGE_TYPE;
      const oldPath = process.env.KG_FILE_PATH;
      process.env.KG_STORAGE_TYPE = 'file';
      process.env.KG_FILE_PATH = './test-env.json';
      
      const store = StorageConfig.createFromEnvironment();
      expect(store.getMetadata().type).toBe('file');
      expect(store.getMetadata().filePath).toContain('test-env.json');
      
      // Restore
      if (oldType) {
        process.env.KG_STORAGE_TYPE = oldType;
      } else {
        delete process.env.KG_STORAGE_TYPE;
      }
      if (oldPath) {
        process.env.KG_FILE_PATH = oldPath;
      } else {
        delete process.env.KG_FILE_PATH;
      }
    });

    test('should create GitHub store from environment', () => {
      const oldType = process.env.KG_STORAGE_TYPE;
      const oldRepo = process.env.KG_GITHUB_REPO;
      const oldPath = process.env.KG_GITHUB_PATH;
      const oldToken = process.env.GITHUB_TOKEN;
      
      process.env.KG_STORAGE_TYPE = 'github';
      process.env.KG_GITHUB_REPO = 'test/repo';
      process.env.KG_GITHUB_PATH = 'data.json';
      process.env.GITHUB_TOKEN = 'ghp_test_token';
      
      const store = StorageConfig.createFromEnvironment();
      expect(store.getMetadata().type).toBe('github');
      
      // Restore
      if (oldType) {
        process.env.KG_STORAGE_TYPE = oldType;
      } else {
        delete process.env.KG_STORAGE_TYPE;
      }
      if (oldRepo) {
        process.env.KG_GITHUB_REPO = oldRepo;
      } else {
        delete process.env.KG_GITHUB_REPO;
      }
      if (oldPath) {
        process.env.KG_GITHUB_PATH = oldPath;
      } else {
        delete process.env.KG_GITHUB_PATH;
      }
      if (oldToken) {
        process.env.GITHUB_TOKEN = oldToken;
      } else {
        delete process.env.GITHUB_TOKEN;
      }
    });
  });
});
