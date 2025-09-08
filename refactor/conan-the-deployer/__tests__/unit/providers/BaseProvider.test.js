import BaseProvider from '../../../src/providers/BaseProvider.js';

describe('BaseProvider', () => {
  describe('Abstract Class', () => {
    test('should not be instantiable directly', () => {
      expect(() => new BaseProvider()).toThrow('BaseProvider is an abstract class and cannot be instantiated directly');
    });

    test('should be extendable', () => {
      class TestProvider extends BaseProvider {
        constructor(config) {
          super(config);
        }
      }
      
      const provider = new TestProvider({ test: true });
      expect(provider).toBeInstanceOf(BaseProvider);
      expect(provider.config).toEqual({ test: true });
    });
  });

  describe('Abstract Methods', () => {
    class TestProvider extends BaseProvider {}
    let provider;

    beforeEach(() => {
      provider = new TestProvider();
    });

    test('deploy() should throw not implemented error', async () => {
      await expect(provider.deploy({})).rejects.toThrow('deploy() must be implemented by provider');
    });

    test('update() should throw not implemented error', async () => {
      await expect(provider.update('id', {})).rejects.toThrow('update() must be implemented by provider');
    });

    test('stop() should throw not implemented error', async () => {
      await expect(provider.stop('id')).rejects.toThrow('stop() must be implemented by provider');
    });

    test('remove() should throw not implemented error', async () => {
      await expect(provider.remove('id')).rejects.toThrow('remove() must be implemented by provider');
    });

    test('getStatus() should throw not implemented error', async () => {
      await expect(provider.getStatus('id')).rejects.toThrow('getStatus() must be implemented by provider');
    });

    test('getLogs() should throw not implemented error', async () => {
      await expect(provider.getLogs('id', {})).rejects.toThrow('getLogs() must be implemented by provider');
    });

    test('getMetrics() should throw not implemented error', async () => {
      await expect(provider.getMetrics('id')).rejects.toThrow('getMetrics() must be implemented by provider');
    });
  });

  describe('Default Capabilities', () => {
    class TestProvider extends BaseProvider {}
    let provider;

    beforeEach(() => {
      provider = new TestProvider();
    });

    test('should return default capabilities', () => {
      const capabilities = provider.getCapabilities();
      expect(capabilities).toEqual({
        supportsRollingUpdate: false,
        supportsBlueGreen: false,
        supportsHealthChecks: false,
        supportsMetrics: false,
        supportsCustomDomains: false
      });
    });

    test('should allow overriding capabilities', () => {
      class CustomProvider extends BaseProvider {
        getCapabilities() {
          return {
            ...super.getCapabilities(),
            supportsHealthChecks: true,
            supportsMetrics: true
          };
        }
      }

      const provider = new CustomProvider();
      const capabilities = provider.getCapabilities();
      expect(capabilities.supportsHealthChecks).toBe(true);
      expect(capabilities.supportsMetrics).toBe(true);
      expect(capabilities.supportsRollingUpdate).toBe(false);
    });
  });

  describe('Provider Configuration', () => {
    class TestProvider extends BaseProvider {}

    test('should store configuration', () => {
      const config = {
        apiKey: 'test-key',
        endpoint: 'https://api.example.com',
        timeout: 5000
      };
      const provider = new TestProvider(config);
      expect(provider.config).toEqual(config);
    });

    test('should handle empty configuration', () => {
      const provider = new TestProvider();
      expect(provider.config).toEqual({});
    });
  });
});