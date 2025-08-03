/**
 * Umbilical Protocol Compliance Tests
 */

import { StorageBrowser } from '../src/index.js';

describe('Umbilical Protocol Compliance', () => {
  test('should support introspection mode', () => {
    const introspection = StorageBrowser.create({
      describe: true
    });

    expect(introspection).toBeDefined();
    expect(introspection.name).toBe('StorageBrowser');
    expect(typeof introspection.version).toBe('string');
    expect(typeof introspection.description).toBe('string');
    expect(introspection.configSchema).toBeDefined();
    expect(introspection.configSchema.type).toBe('object');
    expect(introspection.configSchema.properties).toBeDefined();
  });

  test('should support validation mode with valid config', () => {
    // Mock DOM element
    const mockElement = {
      appendChild: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(),
      style: {},
      innerHTML: ''
    };

    const validation = StorageBrowser.create({
      validate: {
        dom: mockElement,
        serverUrl: 'ws://localhost:3700/storage',
        provider: 'memory',
        database: 'test'
      }
    });

    expect(validation).toBeDefined();
    expect(validation.valid).toBe(true);
    expect(Array.isArray(validation.errors)).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  test('should support validation mode with invalid config', () => {
    const validation = StorageBrowser.create({
      validate: {
        // Missing required dom
        serverUrl: 'ws://localhost:3700/storage'
      }
    });

    expect(validation).toBeDefined();
    expect(validation.valid).toBe(false);
    expect(Array.isArray(validation.errors)).toBe(true);
    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.errors.some(error => error.includes('dom'))).toBe(true);
  });

  test('should support validation mode with malformed serverUrl', () => {
    const mockElement = {
      appendChild: jest.fn(),
      querySelector: jest.fn(),
      style: {},
      innerHTML: ''
    };

    const validation = StorageBrowser.create({
      validate: {
        dom: mockElement,
        serverUrl: 'invalid-url',
        provider: 'memory'
      }
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.some(error => error.includes('serverUrl'))).toBe(true);
  });

  test('should support validation mode with invalid provider', () => {
    const mockElement = {
      appendChild: jest.fn(),
      querySelector: jest.fn(),
      style: {},
      innerHTML: ''
    };

    const validation = StorageBrowser.create({
      validate: {
        dom: mockElement,
        serverUrl: 'ws://localhost:3700/storage',
        provider: 'invalid-provider'
      }
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.some(error => error.includes('provider'))).toBe(true);
  });

  test('should create component instance with valid config', () => {
    const mockElement = {
      appendChild: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      style: {},
      innerHTML: '',
      children: []
    };

    const instance = StorageBrowser.create({
      dom: mockElement,
      serverUrl: 'ws://localhost:3700/storage',
      provider: 'memory',
      database: 'test'
    });

    expect(instance).toBeDefined();
    expect(typeof instance.connect).toBe('function');
    expect(typeof instance.disconnect).toBe('function');
    expect(typeof instance.getCollections).toBe('function');
    expect(typeof instance.executeQuery).toBe('function');
    expect(typeof instance.destroy).toBe('function');
  });

  test('should have required Umbilical interface methods', () => {
    expect(typeof StorageBrowser.create).toBe('function');
    
    // Test that create function can handle all three modes
    const introspection = StorageBrowser.create({ describe: true });
    expect(introspection.name).toBeDefined();

    const validation = StorageBrowser.create({ 
      validate: { serverUrl: 'invalid' } 
    });
    expect(validation.valid).toBeDefined();

    // Instance creation is tested in other tests
  });

  test('should expose proper configuration schema', () => {
    const introspection = StorageBrowser.create({ describe: true });
    const schema = introspection.configSchema;

    expect(schema.properties.dom).toBeDefined();
    expect(schema.properties.serverUrl).toBeDefined();
    expect(schema.properties.provider).toBeDefined();
    
    expect(schema.required).toContain('dom');
    expect(schema.required).toContain('serverUrl');
    
    // Check provider enum
    expect(schema.properties.provider.enum).toContain('mongodb');
    expect(schema.properties.provider.enum).toContain('sqlite');
    expect(schema.properties.provider.enum).toContain('memory');
  });

  test('should handle optional configuration parameters', () => {
    const mockElement = {
      appendChild: jest.fn(),
      querySelector: jest.fn(),
      style: {},
      innerHTML: ''
    };

    const validation = StorageBrowser.create({
      validate: {
        dom: mockElement,
        serverUrl: 'ws://localhost:3700/storage',
        provider: 'memory',
        // Optional parameters
        database: 'test',
        mode: 'split',
        theme: 'dark',
        features: {
          query: true,
          create: false
        }
      }
    });

    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  test('should validate nested configuration objects', () => {
    const mockElement = {
      appendChild: jest.fn(),
      querySelector: jest.fn(),
      style: {},
      innerHTML: ''
    };

    // Test invalid nested config
    const validation = StorageBrowser.create({
      validate: {
        dom: mockElement,
        serverUrl: 'ws://localhost:3700/storage',
        provider: 'memory',
        features: {
          query: 'invalid-boolean', // Should be boolean
          create: true
        }
      }
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.some(error => 
      error.includes('features') || error.includes('query')
    )).toBe(true);
  });

  test('should provide detailed error messages for validation failures', () => {
    const validation = StorageBrowser.create({
      validate: {
        serverUrl: 123, // Should be string
        provider: 'invalid',
        theme: 'invalid-theme'
      }
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(2);
    
    // Should have specific error messages
    expect(validation.errors.some(error => error.includes('dom'))).toBe(true);
    expect(validation.errors.some(error => error.includes('serverUrl'))).toBe(true);
    expect(validation.errors.some(error => error.includes('provider'))).toBe(true);
  });
});