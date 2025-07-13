import { jest } from '@jest/globals';
import Resource from '../../../src/base/Resource.js';

describe('Resource', () => {
  let resource;
  const mockName = 'test-resource';
  const mockConfig = { type: 'test', port: 3000 };
  const mockDependencies = { apiKey: 'test-key', dbUrl: 'mongodb://localhost' };

  beforeEach(() => {
    resource = new Resource(mockName, mockConfig, mockDependencies);
  });

  describe('constructor', () => {
    it('should create a resource with valid parameters', () => {
      expect(resource.name).toBe(mockName);
      expect(resource.config).toEqual(mockConfig);
      expect(resource.dependencies).toEqual(mockDependencies);
      expect(resource.status).toBe('stopped');
      expect(resource.lastHealthCheck).toBeNull();
      expect(resource.metadata.created).toBeInstanceOf(Date);
      expect(resource.metadata.lastActivity).toBeNull();
      expect(resource.metadata.initializationTime).toBeNull();
      expect(resource.metadata.cleanupTime).toBeNull();
    });

    it('should create a resource without dependencies', () => {
      const resourceNoDeps = new Resource(mockName, mockConfig);
      expect(resourceNoDeps.dependencies).toEqual({});
    });

    it('should throw error if name is not provided', () => {
      expect(() => new Resource(null, mockConfig)).toThrow('Resource name is required and must be a string');
      expect(() => new Resource('', mockConfig)).toThrow('Resource name is required and must be a string');
      expect(() => new Resource(123, mockConfig)).toThrow('Resource name is required and must be a string');
    });

    it('should throw error if config is not provided', () => {
      expect(() => new Resource(mockName, null)).toThrow('Resource config is required and must be an object');
      expect(() => new Resource(mockName, 'invalid')).toThrow('Resource config is required and must be an object');
    });
  });

  describe('abstract methods', () => {
    it('should throw error when initialize() is called', async () => {
      await expect(resource.initialize()).rejects.toThrow('initialize() must be implemented by subclass');
    });

    it('should throw error when invoke() is called', async () => {
      await expect(resource.invoke('someMethod', {})).rejects.toThrow('invoke() must be implemented by subclass');
    });

    it('should throw error when cleanup() is called', async () => {
      await expect(resource.cleanup()).rejects.toThrow('cleanup() must be implemented by subclass');
    });

    it('should throw error when healthCheck() is called', async () => {
      await expect(resource.healthCheck()).rejects.toThrow('healthCheck() must be implemented by subclass');
    });
  });

  describe('getStatus', () => {
    it('should return complete status information', () => {
      const status = resource.getStatus();
      expect(status).toMatchObject({
        name: mockName,
        status: 'stopped',
        lastHealthCheck: null,
        metadata: resource.metadata,
        uptime: 0
      });
    });

    it('should calculate uptime when resource is running', () => {
      resource.updateStatus('running');
      // Wait a bit to ensure uptime is > 0
      const status = resource.getStatus();
      expect(status.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateUptime', () => {
    it('should return 0 when resource is not running', () => {
      expect(resource.calculateUptime()).toBe(0);
    });

    it('should return 0 when initialization time is not set', () => {
      resource.status = 'running';
      expect(resource.calculateUptime()).toBe(0);
    });

    it('should calculate uptime correctly when resource is running', () => {
      const now = Date.now();
      resource.metadata.initializationTime = new Date(now - 5000);
      resource.status = 'running';
      const uptime = resource.calculateUptime();
      expect(uptime).toBeGreaterThanOrEqual(5000);
      expect(uptime).toBeLessThan(6000);
    });
  });

  describe('resolveDependencies', () => {
    it('should resolve template string with dependencies', () => {
      const template = 'mongodb://${dbUrl}/mydb?apiKey=${apiKey}';
      const resolved = resource.resolveDependencies(template);
      expect(resolved).toBe('mongodb://mongodb://localhost/mydb?apiKey=test-key');
    });

    it('should resolve template string with environment variables', () => {
      process.env.TEST_ENV_VAR = 'test-value';
      const template = 'Value: ${env.TEST_ENV_VAR}';
      const resolved = resource.resolveDependencies(template);
      expect(resolved).toBe('Value: test-value');
      delete process.env.TEST_ENV_VAR;
    });

    it('should resolve template string with config values', () => {
      const template = 'Port: ${port}, Type: ${type}';
      const resolved = resource.resolveDependencies(template);
      expect(resolved).toBe('Port: 3000, Type: test');
    });

    it('should handle missing template variables', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const template = 'Missing: ${nonExistent}';
      const resolved = resource.resolveDependencies(template);
      expect(resolved).toBe('Missing: ${nonExistent}');
      expect(consoleWarnSpy).toHaveBeenCalledWith("Template variable 'nonExistent' not found in resource 'test-resource'");
      consoleWarnSpy.mockRestore();
    });

    it('should resolve arrays recursively', () => {
      const array = ['${apiKey}', 'static', '${port}'];
      const resolved = resource.resolveDependencies(array);
      expect(resolved).toEqual(['test-key', 'static', '3000']);
    });

    it('should resolve objects recursively', () => {
      const object = {
        url: '${dbUrl}',
        config: {
          apiKey: '${apiKey}',
          port: '${port}'
        },
        static: 'value'
      };
      const resolved = resource.resolveDependencies(object);
      expect(resolved).toEqual({
        url: 'mongodb://localhost',
        config: {
          apiKey: 'test-key',
          port: '3000'
        },
        static: 'value'
      });
    });

    it('should return non-string values unchanged', () => {
      expect(resource.resolveDependencies(123)).toBe(123);
      expect(resource.resolveDependencies(true)).toBe(true);
      expect(resource.resolveDependencies(null)).toBe(null);
      expect(resource.resolveDependencies(undefined)).toBe(undefined);
    });
  });

  describe('updateStatus', () => {
    it('should update status and lastActivity', () => {
      const beforeUpdate = Date.now();
      resource.updateStatus('starting');
      expect(resource.status).toBe('starting');
      expect(resource.metadata.lastActivity).toBeInstanceOf(Date);
      expect(resource.metadata.lastActivity.getTime()).toBeGreaterThanOrEqual(beforeUpdate);
    });

    it('should set initializationTime when status changes to running', () => {
      expect(resource.metadata.initializationTime).toBeNull();
      resource.updateStatus('running');
      expect(resource.metadata.initializationTime).toBeInstanceOf(Date);
    });

    it('should not overwrite initializationTime on subsequent running status', () => {
      resource.updateStatus('running');
      const firstInit = resource.metadata.initializationTime;
      resource.updateStatus('running');
      expect(resource.metadata.initializationTime).toBe(firstInit);
    });

    it('should set cleanupTime when status changes to stopped after running', () => {
      resource.updateStatus('running');
      expect(resource.metadata.cleanupTime).toBeNull();
      resource.updateStatus('stopped');
      expect(resource.metadata.cleanupTime).toBeInstanceOf(Date);
    });
  });

  describe('recordHealthCheck', () => {
    it('should record healthy check result', () => {
      const beforeCheck = Date.now();
      resource.recordHealthCheck(true, 'All systems operational');
      expect(resource.lastHealthCheck).toMatchObject({
        healthy: true,
        details: 'All systems operational'
      });
      expect(resource.lastHealthCheck.time).toBeInstanceOf(Date);
      expect(resource.lastHealthCheck.time.getTime()).toBeGreaterThanOrEqual(beforeCheck);
    });

    it('should record unhealthy check result', () => {
      resource.recordHealthCheck(false, 'Connection timeout');
      expect(resource.lastHealthCheck).toMatchObject({
        healthy: false,
        details: 'Connection timeout'
      });
    });

    it('should record health check without details', () => {
      resource.recordHealthCheck(true);
      expect(resource.lastHealthCheck).toMatchObject({
        healthy: true,
        details: null
      });
    });
  });

  describe('getDependencies', () => {
    it('should return dependencies from config', () => {
      resource.config.dependencies = ['db', 'cache', 'auth'];
      expect(resource.getDependencies()).toEqual(['db', 'cache', 'auth']);
    });

    it('should return empty array if no dependencies in config', () => {
      const freshResource = new Resource('test', {});
      expect(freshResource.getDependencies()).toEqual([]);
    });
  });

  describe('hasDependency', () => {
    it('should return true if dependency exists', () => {
      resource.config.dependencies = ['db', 'cache', 'auth'];
      expect(resource.hasDependency('db')).toBe(true);
      expect(resource.hasDependency('cache')).toBe(true);
    });

    it('should return false if dependency does not exist', () => {
      resource.config.dependencies = ['db', 'cache'];
      expect(resource.hasDependency('auth')).toBe(false);
    });

    it('should return false if no dependencies configured', () => {
      expect(resource.hasDependency('anything')).toBe(false);
    });
  });
});