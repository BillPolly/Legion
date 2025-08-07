/**
 * Tests for Library Integration Patterns
 * RED phase: Write failing tests first
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { 
  NodeModuleWrapper,
  NPMPackageWrapper,
  createModuleFromLibrary,
  wrapBuiltinModule,
  wrapNPMPackage
} from '../../src/utils/LibraryIntegration.js';

// Mock fs module for testing
const mockFs = {
  readFile: jest.fn((path, callback) => {
    callback(null, 'file content');
  }),
  writeFile: jest.fn((path, data, callback) => {
    callback(null);
  }),
  readFileSync: jest.fn((path) => 'sync content'),
  writeFileSync: jest.fn((path, data) => {}),
  promises: {
    readFile: jest.fn(async (path) => 'async content'),
    writeFile: jest.fn(async (path, data) => {})
  }
};

// Mock child_process module
const mockChildProcess = {
  exec: jest.fn((command, callback) => {
    callback(null, { stdout: 'output', stderr: '' });
  }),
  spawn: jest.fn((command, args) => ({
    on: jest.fn(),
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() }
  }))
};

describe('Library Integration Patterns', () => {
  describe('NodeModuleWrapper - Node.js built-in modules', () => {
    test('should wrap built-in module methods', async () => {
      const wrapper = new NodeModuleWrapper('fs', mockFs);
      const tools = wrapper.createTools();

      expect(tools.readFile).toBeDefined();
      expect(tools.writeFile).toBeDefined();
      expect(tools.readFileSync).toBeDefined();
    });

    test('should handle callback-based methods', async () => {
      const wrapper = new NodeModuleWrapper('fs', mockFs);
      const tools = wrapper.createTools();

      const result = await tools.readFile.execute({ 
        path: '/test/file.txt' 
      });

      expect(mockFs.readFile).toHaveBeenCalledWith(
        '/test/file.txt',
        expect.any(Function)
      );
      expect(result).toBe('file content');
    });

    test('should handle sync methods', async () => {
      const wrapper = new NodeModuleWrapper('fs', mockFs);
      const tools = wrapper.createTools();

      const result = await tools.readFileSync.execute({ 
        path: '/test/file.txt' 
      });

      expect(mockFs.readFileSync).toHaveBeenCalledWith('/test/file.txt');
      expect(result).toBe('sync content');
    });

    test('should handle promise-based methods', async () => {
      const wrapper = new NodeModuleWrapper('fs', mockFs);
      const tools = wrapper.createTools();

      const result = await tools.promises_readFile.execute({ 
        path: '/test/file.txt' 
      });

      expect(mockFs.promises.readFile).toHaveBeenCalledWith('/test/file.txt');
      expect(result).toBe('async content');
    });

    test('should skip non-function properties', () => {
      const moduleWithMixed = {
        method1: jest.fn(),
        property: 'value',
        method2: jest.fn(),
        constant: 42
      };

      const wrapper = new NodeModuleWrapper('mixed', moduleWithMixed);
      const tools = wrapper.createTools();

      expect(tools.method1).toBeDefined();
      expect(tools.method2).toBeDefined();
      expect(tools.property).toBeUndefined();
      expect(tools.constant).toBeUndefined();
    });

    test('should provide proper metadata for wrapped methods', () => {
      const wrapper = new NodeModuleWrapper('fs', mockFs);
      const tools = wrapper.createTools();

      const metadata = tools.readFile.getMetadata();
      expect(metadata.description).toContain('readFile');
      expect(metadata.module).toBe('fs');
      expect(metadata.type).toBe('callback');
    });

    test('should handle errors in callback methods', async () => {
      const errorFs = {
        readFile: jest.fn((path, callback) => {
          callback(new Error('File not found'), null);
        })
      };

      const wrapper = new NodeModuleWrapper('fs', errorFs);
      const tools = wrapper.createTools();

      const result = await tools.readFile.execute({ 
        path: '/nonexistent.txt' 
      });

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('File not found');
    });

    test('should support method filtering', () => {
      const wrapper = new NodeModuleWrapper('fs', mockFs, {
        include: ['readFile', 'writeFile']
      });
      const tools = wrapper.createTools();

      expect(tools.readFile).toBeDefined();
      expect(tools.writeFile).toBeDefined();
      expect(tools.readFileSync).toBeUndefined();
    });

    test('should support method exclusion', () => {
      const wrapper = new NodeModuleWrapper('fs', mockFs, {
        exclude: ['readFileSync', 'writeFileSync']
      });
      const tools = wrapper.createTools();

      expect(tools.readFile).toBeDefined();
      expect(tools.writeFile).toBeDefined();
      expect(tools.readFileSync).toBeUndefined();
      expect(tools.writeFileSync).toBeUndefined();
    });
  });

  describe('NPMPackageWrapper - NPM package integration', () => {
    let mockPackage;

    beforeEach(() => {
      mockPackage = {
        create: jest.fn(() => ({
          initialized: true,
          process: jest.fn(async (data) => ({ result: data }))
        })),
        Client: class {
          constructor(config) {
            this.config = config;
          }
          async connect() {
            this.connected = true;
          }
          async query(sql) {
            return { rows: [{ id: 1 }] };
          }
          async disconnect() {
            this.connected = false;
          }
        }
      };
    });

    test('should wrap NPM package with factory function', async () => {
      const wrapper = new NPMPackageWrapper('my-package', mockPackage, {
        factory: 'create',
        factoryConfig: { option: 'value' }
      });

      const instance = await wrapper.createInstance();
      expect(mockPackage.create).toHaveBeenCalledWith({ option: 'value' });
      expect(instance.initialized).toBe(true);
    });

    test('should wrap NPM package with constructor', async () => {
      const wrapper = new NPMPackageWrapper('my-package', mockPackage, {
        constructor: 'Client',
        constructorConfig: { host: 'localhost' }
      });

      const instance = await wrapper.createInstance();
      expect(instance.config).toEqual({ host: 'localhost' });
    });

    test('should create tools from instance methods', async () => {
      const wrapper = new NPMPackageWrapper('my-package', mockPackage, {
        factory: 'create'
      });

      const instance = await wrapper.createInstance();
      const tools = wrapper.createTools(instance);

      expect(tools.process).toBeDefined();
      const result = await tools.process.execute({ data: 'test' });
      expect(result).toEqual({ result: { data: 'test' } });
    });

    test('should bind methods with correct context', async () => {
      const wrapper = new NPMPackageWrapper('db-package', mockPackage, {
        constructor: 'Client',
        constructorConfig: { host: 'localhost' }
      });

      const instance = await wrapper.createInstance();
      const tools = wrapper.createTools(instance);

      await tools.connect.execute({});
      expect(instance.connected).toBe(true);

      const result = await tools.query.execute({ sql: 'SELECT * FROM users' });
      expect(result.rows).toHaveLength(1);
    });

    test('should handle initialization methods', async () => {
      const wrapper = new NPMPackageWrapper('db-package', mockPackage, {
        constructor: 'Client',
        initMethod: 'connect'
      });

      const instance = await wrapper.createInstance();
      expect(instance.connected).toBe(true);
    });

    test('should handle cleanup methods', async () => {
      const wrapper = new NPMPackageWrapper('db-package', mockPackage, {
        constructor: 'Client',
        cleanupMethod: 'disconnect'
      });

      const instance = await wrapper.createInstance();
      await instance.connect();
      
      await wrapper.cleanup(instance);
      expect(instance.connected).toBe(false);
    });

    test('should support singleton instances', async () => {
      const wrapper = new NPMPackageWrapper('my-package', mockPackage, {
        factory: 'create',
        singleton: true
      });

      const instance1 = await wrapper.createInstance();
      const instance2 = await wrapper.createInstance();

      expect(instance1).toBe(instance2);
      expect(mockPackage.create).toHaveBeenCalledTimes(1);
    });

    test('should support method transformation', async () => {
      const wrapper = new NPMPackageWrapper('my-package', mockPackage, {
        factory: 'create',
        methodTransforms: {
          process: {
            inputTransform: (input) => input.value,
            outputTransform: (output) => output.result
          }
        }
      });

      const instance = await wrapper.createInstance();
      const tools = wrapper.createTools(instance);

      const result = await tools.process.execute({ value: 'test' });
      expect(result).toBe('test');
    });
  });

  describe('Helper functions', () => {
    let mockPackage;

    beforeEach(() => {
      mockPackage = {
        create: jest.fn(() => ({
          initialized: true,
          process: jest.fn(async (data) => ({ result: data }))
        })),
        Client: class {
          constructor(config) {
            this.config = config;
          }
          async connect() {
            this.connected = true;
          }
          async query(sql) {
            return { rows: [{ id: 1 }] };
          }
          async disconnect() {
            this.connected = false;
          }
        }
      };
    });

    test('wrapBuiltinModule should create module wrapper', async () => {
      const tools = await wrapBuiltinModule('child_process', mockChildProcess);
      
      expect(tools.exec).toBeDefined();
      expect(tools.spawn).toBeDefined();

      const result = await tools.exec.execute({ 
        command: 'echo hello' 
      });
      
      expect(result.stdout).toBe('output');
    });

    test('wrapNPMPackage should create package wrapper', async () => {
      const tools = await wrapNPMPackage('my-package', mockPackage, {
        factory: 'create'
      });

      expect(tools.process).toBeDefined();
      const result = await tools.process.execute({ data: 'test' });
      expect(result).toEqual({ result: { data: 'test' } });
    });

    test('createModuleFromLibrary should auto-detect library type', async () => {
      // Test with built-in style module
      const builtinStyle = {
        readFile: jest.fn(),
        writeFile: jest.fn()
      };

      const builtinTools = await createModuleFromLibrary('fs-like', builtinStyle);
      expect(builtinTools.readFile).toBeDefined();

      // Test with class-based package
      const classPackage = {
        MyClass: class {
          method1() { return 'result1'; }
        }
      };

      const classTools = await createModuleFromLibrary('class-package', classPackage);
      expect(classTools.method1).toBeDefined();
    });
  });

  describe('Advanced patterns', () => {
    let mockPackage;

    beforeEach(() => {
      mockPackage = {
        Client: class {
          constructor(config) {
            this.config = config;
          }
          async connect() {
            this.connected = true;
          }
          async query(sql) {
            return { rows: [{ id: 1 }] };
          }
          async disconnect() {
            this.connected = false;
          }
        }
      };
    });

    test('should support streaming methods', async () => {
      const streamModule = {
        createReadStream: jest.fn((path) => ({
          on: jest.fn((event, handler) => {
            if (event === 'data') handler('chunk1');
            if (event === 'end') handler();
          })
        }))
      };

      const wrapper = new NodeModuleWrapper('stream', streamModule, {
        streamMethods: ['createReadStream']
      });
      const tools = wrapper.createTools();

      const result = await tools.createReadStream.execute({ 
        path: '/file.txt' 
      });

      expect(streamModule.createReadStream).toHaveBeenCalledWith('/file.txt');
      expect(result.type).toBe('stream');
      expect(result.handle).toBeDefined();
    });

    test('should support event emitter wrapping', async () => {
      const EventEmitter = class {
        constructor() {
          this.events = {};
        }
        on(event, handler) {
          this.events[event] = handler;
        }
        emit(event, data) {
          if (this.events[event]) {
            this.events[event](data);
          }
        }
      };

      const wrapper = new NPMPackageWrapper('events', { EventEmitter }, {
        constructor: 'EventEmitter',
        eventEmitter: true
      });

      const instance = await wrapper.createInstance();
      const tools = wrapper.createTools(instance);

      expect(tools.on).toBeDefined();
      expect(tools.emit).toBeDefined();
    });

    test('should support resource pooling', async () => {
      const poolConfig = {
        min: 2,
        max: 10
      };

      const wrapper = new NPMPackageWrapper('db-package', mockPackage, {
        constructor: 'Client',
        pooling: poolConfig
      });

      const pool = await wrapper.createPool();
      expect(pool.size).toBeGreaterThanOrEqual(poolConfig.min);
      
      const instance = await pool.acquire();
      expect(instance).toBeDefined();
      
      await pool.release(instance);
    });
  });
});