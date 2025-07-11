import { jest } from '@jest/globals';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Import from the core package
const { ResourceManager, ModuleFactory, OpenAIModule, OpenAITool } = require('@jsenvoy/modules');

describe('@jsenvoy/modules imports', () => {
  it('should import ResourceManager from @jsenvoy/modules', () => {
    expect(ResourceManager).toBeDefined();
    expect(typeof ResourceManager).toBe('function');
  });

  it('should import ModuleFactory from @jsenvoy/modules', () => {
    expect(ModuleFactory).toBeDefined();
    expect(typeof ModuleFactory).toBe('function');
  });

  it('should import OpenAIModule from @jsenvoy/modules', () => {
    expect(OpenAIModule).toBeDefined();
    expect(typeof OpenAIModule).toBe('function');
  });

  it('should import OpenAITool from @jsenvoy/modules', () => {
    expect(OpenAITool).toBeDefined();
    expect(typeof OpenAITool).toBe('function');
  });

  it('should be able to instantiate ResourceManager', () => {
    const resourceManager = new ResourceManager();
    expect(resourceManager).toBeInstanceOf(ResourceManager);
    expect(typeof resourceManager.register).toBe('function');
    expect(typeof resourceManager.get).toBe('function');
    expect(typeof resourceManager.has).toBe('function');
  });

  it('should be able to instantiate ModuleFactory with ResourceManager', () => {
    const resourceManager = new ResourceManager();
    const moduleFactory = new ModuleFactory(resourceManager);
    expect(moduleFactory).toBeInstanceOf(ModuleFactory);
    expect(typeof moduleFactory.createModule).toBe('function');
    expect(typeof moduleFactory.createAllModules).toBe('function');
  });
});