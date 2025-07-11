import { jest } from '@jest/globals';
import CLI from '../src/index.js';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const { ResourceManager, ModuleFactory } = require('@jsenvoy/modules');

describe('ModuleFactory Integration', () => {
  let cli;

  beforeEach(() => {
    cli = new CLI();
    cli.resourceManager = new ResourceManager();
    // Register some test resources
    cli.resourceManager.register('basePath', '/test/path');
    cli.resourceManager.register('encoding', 'utf8');
    cli.resourceManager.register('createDirectories', true);
    cli.resourceManager.register('permissions', 0o755);
  });

  describe('initializeModuleFactory', () => {
    it('should create a ModuleFactory instance', () => {
      cli.initializeModuleFactory();
      
      expect(cli.moduleFactory).toBeDefined();
      expect(cli.moduleFactory).toBeInstanceOf(ModuleFactory);
    });

    it('should pass ResourceManager to ModuleFactory', () => {
      cli.initializeModuleFactory();
      
      // The factory should have access to the resource manager
      expect(cli.moduleFactory.resourceManager).toBe(cli.resourceManager);
    });
  });

  describe('createModuleInstance', () => {
    beforeEach(async () => {
      await cli.loadModules();
      cli.initializeModuleFactory();
    });

    it('should create module instance for calculator module', () => {
      const module = cli.createModuleInstance('calculator');
      
      expect(module).toBeDefined();
      expect(module.name).toBe('calculator');
      expect(module.tools).toBeDefined();
      expect(Array.isArray(module.tools)).toBe(true);
    });

    it('should create module instance for file module with dependencies', () => {
      const module = cli.createModuleInstance('file');
      
      expect(module).toBeDefined();
      expect(module.name).toBe('file');
      expect(module.tools).toBeDefined();
      expect(module.tools.length).toBeGreaterThan(0);
    });

    it('should cache module instances', () => {
      const module1 = cli.createModuleInstance('calculator');
      const module2 = cli.createModuleInstance('calculator');
      
      expect(module1).toBe(module2); // Should be the same instance
    });

    it('should throw error for unknown module', () => {
      expect(() => {
        cli.createModuleInstance('unknown');
      }).toThrow();
    });

    it('should use module-specific resources if available', () => {
      // Register module-specific resources
      cli.resourceManager.register('file.basePath', '/file/specific');
      
      const module = cli.createModuleInstance('file');
      
      // The module should have received the module-specific resource
      // This would be validated by the FileModule constructor
      expect(module).toBeDefined();
    });
  });

  describe('getAllModuleInstances', () => {
    beforeEach(async () => {
      await cli.loadModules();
      cli.initializeModuleFactory();
    });

    it('should create instances for all discovered modules', () => {
      const modules = cli.getAllModuleInstances();
      
      expect(Array.isArray(modules)).toBe(true);
      expect(modules.length).toBeGreaterThan(0);
      expect(modules.every(m => m.name && m.tools)).toBe(true);
    });

    it('should handle module creation failures gracefully', () => {
      // Add a module that will fail to instantiate
      cli.moduleClasses.set('broken', class BrokenModule {
        constructor() {
          throw new Error('Module initialization failed');
        }
      });
      
      const modules = cli.getAllModuleInstances();
      
      // Should return successfully created modules
      expect(Array.isArray(modules)).toBe(true);
      expect(modules.length).toBeGreaterThan(0);
    });
  });

  describe('integration with run method', () => {
    it('should initialize ModuleFactory during run', async () => {
      // Mock methods to prevent actual execution
      jest.spyOn(cli, 'parseArgs').mockImplementation(() => {
        cli.command = 'help';
      });
      jest.spyOn(cli, 'loadConfiguration').mockResolvedValue();
      jest.spyOn(cli, 'initializeResourceManager').mockResolvedValue();
      jest.spyOn(cli, 'loadModules').mockResolvedValue();
      jest.spyOn(cli, 'executeCommand').mockResolvedValue();
      
      const initSpy = jest.spyOn(cli, 'initializeModuleFactory');
      
      await cli.run(['node', 'jsenvoy', 'help']);
      
      expect(initSpy).toHaveBeenCalled();
      expect(cli.moduleFactory).toBeDefined();
    });
  });

  describe('resolveModuleDependencies', () => {
    beforeEach(async () => {
      await cli.loadModules();
    });

    it('should resolve dependencies from ResourceManager', () => {
      cli.initializeModuleFactory();
      
      const dependencies = cli.resolveModuleDependencies('file');
      
      expect(dependencies).toBeDefined();
      expect(dependencies.basePath).toBeDefined();
      expect(dependencies.encoding).toBe('utf8');
      expect(dependencies.createDirectories).toBe(true);
      expect(dependencies.permissions).toBe(0o755);
    });

    it('should prefer module-specific resources', () => {
      cli.resourceManager.register('file.basePath', '/module/specific');
      cli.resourceManager.register('file.encoding', 'ascii');
      
      cli.initializeModuleFactory();
      
      const dependencies = cli.resolveModuleDependencies('file');
      
      expect(dependencies.basePath).toBe('/module/specific');
      expect(dependencies.encoding).toBe('ascii');
    });

    it('should return empty object for modules without dependencies', () => {
      cli.initializeModuleFactory();
      
      const dependencies = cli.resolveModuleDependencies('calculator');
      
      expect(dependencies).toEqual({});
    });
  });
});