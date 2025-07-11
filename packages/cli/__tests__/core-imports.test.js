import { jest } from '@jest/globals';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Import from the core package
const { ResourceManager, ModuleFactory, OpenAIModule, OpenAITool } = require('@jsenvoy/core');

describe('@jsenvoy/core imports', () => {
  it('should import ResourceManager from @jsenvoy/core', () => {
    expect(ResourceManager).toBeDefined();
    expect(typeof ResourceManager).toBe('function');
  });

  it('should import ModuleFactory from @jsenvoy/core', () => {
    expect(ModuleFactory).toBeDefined();
    expect(typeof ModuleFactory).toBe('function');
  });

  it('should import OpenAIModule from @jsenvoy/core', () => {
    expect(OpenAIModule).toBeDefined();
    expect(typeof OpenAIModule).toBe('function');
  });

  it('should import OpenAITool from @jsenvoy/core', () => {
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