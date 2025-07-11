const { ResourceManager } = require('../src/ResourceManager');

describe('ResourceManager', () => {
  let resourceManager;

  beforeEach(() => {
    // Create ResourceManager without loading .env for tests
    resourceManager = new ResourceManager({ loadEnv: false });
  });

  describe('constructor', () => {
    it('should initialize with empty resources', () => {
      expect(resourceManager.resources).toBeDefined();
      expect(resourceManager.resources.size).toBe(0);
    });
  });

  describe('register()', () => {
    it('should register a string resource', () => {
      resourceManager.register('apiKey', 'test-key-123');
      expect(resourceManager.has('apiKey')).toBe(true);
      expect(resourceManager.get('apiKey')).toBe('test-key-123');
    });

    it('should register an object resource', () => {
      const config = { host: 'localhost', port: 3000 };
      resourceManager.register('serverConfig', config);
      expect(resourceManager.get('serverConfig')).toEqual(config);
    });

    it('should register a function resource', () => {
      const logger = jest.fn();
      resourceManager.register('logger', logger);
      expect(resourceManager.get('logger')).toBe(logger);
    });

    it('should overwrite existing resource with same name', () => {
      resourceManager.register('apiKey', 'first-key');
      resourceManager.register('apiKey', 'second-key');
      expect(resourceManager.get('apiKey')).toBe('second-key');
    });

    it('should handle null and undefined values', () => {
      resourceManager.register('nullResource', null);
      resourceManager.register('undefinedResource', undefined);
      expect(resourceManager.get('nullResource')).toBe(null);
      expect(resourceManager.get('undefinedResource')).toBe(undefined);
    });
  });

  describe('get()', () => {
    it('should return registered resource', () => {
      resourceManager.register('testResource', 'test-value');
      expect(resourceManager.get('testResource')).toBe('test-value');
    });

    it('should throw error for missing resource', () => {
      expect(() => {
        resourceManager.get('nonExistent');
      }).toThrow("Resource 'nonExistent' not found");
    });

    it('should return the exact same object reference', () => {
      const obj = { data: 'test' };
      resourceManager.register('sharedObject', obj);
      const retrieved = resourceManager.get('sharedObject');
      expect(retrieved).toBe(obj); // Same reference
    });
  });

  describe('has()', () => {
    it('should return true for existing resource', () => {
      resourceManager.register('exists', 'value');
      expect(resourceManager.has('exists')).toBe(true);
    });

    it('should return false for non-existing resource', () => {
      expect(resourceManager.has('doesNotExist')).toBe(false);
    });

    it('should return true even for null/undefined values', () => {
      resourceManager.register('nullResource', null);
      expect(resourceManager.has('nullResource')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string as resource name', () => {
      resourceManager.register('', 'empty-name-value');
      expect(resourceManager.has('')).toBe(true);
      expect(resourceManager.get('')).toBe('empty-name-value');
    });

    it('should handle special characters in resource names', () => {
      const specialName = 'resource.with-special_chars$123';
      resourceManager.register(specialName, 'special-value');
      expect(resourceManager.get(specialName)).toBe('special-value');
    });

    it('should maintain resource count correctly', () => {
      expect(resourceManager.resources.size).toBe(0);
      
      resourceManager.register('resource1', 'value1');
      expect(resourceManager.resources.size).toBe(1);
      
      resourceManager.register('resource2', 'value2');
      expect(resourceManager.resources.size).toBe(2);
      
      resourceManager.register('resource1', 'updated');
      expect(resourceManager.resources.size).toBe(2); // Should not increase
    });
  });
});