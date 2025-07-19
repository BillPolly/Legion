import ProviderFactory from '../../../src/providers/ProviderFactory.js';
import BaseProvider from '../../../src/providers/BaseProvider.js';
import LocalProvider from '../../../src/providers/LocalProvider.js';

import { jest } from '@jest/globals';

// Mock ResourceManager for Docker and Railway providers
const mockResourceManager = {
  get: jest.fn((key) => {
    if (key === 'docker-client') {
      return { ping: jest.fn() };
    }
    if (key === 'railway-api-key') {
      return 'mock-api-key';
    }
    return null;
  })
};

// Mock Docker and Railway providers since they need ResourceManager
jest.unstable_mockModule('../../../src/providers/DockerProvider.js', () => ({
  default: jest.fn().mockImplementation(() => ({
    getCapabilities: () => ({ supportsBlueGreen: true })
  }))
}));

jest.unstable_mockModule('../../../src/providers/RailwayProvider.js', () => ({
  default: jest.fn().mockImplementation(() => ({
    getCapabilities: () => ({ supportsCustomDomains: true })
  }))
}));

const { default: DockerProvider } = await import('../../../src/providers/DockerProvider.js');
const { default: RailwayProvider } = await import('../../../src/providers/RailwayProvider.js');

describe('ProviderFactory', () => {
  let factory;

  beforeEach(() => {
    factory = new ProviderFactory();
    jest.clearAllMocks();
  });

  describe('Provider Registration', () => {
    test('should register default providers', () => {
      expect(factory.hasProvider('local')).toBe(true);
      expect(factory.hasProvider('docker')).toBe(true);
      expect(factory.hasProvider('railway')).toBe(true);
    });

    test('should create local provider', () => {
      const provider = factory.createProvider('local');
      expect(provider).toBeInstanceOf(LocalProvider);
      expect(provider).toBeInstanceOf(BaseProvider);
    });

    test('should create docker provider', () => {
      const provider = factory.createProvider('docker', mockResourceManager);
      expect(DockerProvider).toHaveBeenCalledWith(mockResourceManager);
    });

    test('should create railway provider', () => {
      const provider = factory.createProvider('railway', mockResourceManager);
      expect(RailwayProvider).toHaveBeenCalledWith(mockResourceManager);
    });

    test('should throw error for unknown provider', () => {
      expect(() => factory.createProvider('unknown')).toThrow('Unknown provider: unknown');
    });
  });

  describe('Custom Provider Registration', () => {
    class CustomProvider extends BaseProvider {
      constructor(config) {
        super(config);
        this.name = 'custom';
      }
    }

    test('should register custom provider', () => {
      factory.registerProvider('custom', CustomProvider);
      expect(factory.hasProvider('custom')).toBe(true);
    });

    test('should create instance of custom provider', () => {
      factory.registerProvider('custom', CustomProvider);
      const provider = factory.createProvider('custom', { custom: true });
      expect(provider).toBeInstanceOf(CustomProvider);
      expect(provider.config).toEqual({ custom: true });
    });

    test('should not allow overwriting existing provider', () => {
      expect(() => factory.registerProvider('local', CustomProvider))
        .toThrow('Provider already registered: local');
    });

    test('should validate provider extends BaseProvider', () => {
      class InvalidProvider {}
      expect(() => factory.registerProvider('invalid', InvalidProvider))
        .toThrow('Provider must extend BaseProvider');
    });
  });

  describe('Provider Listing', () => {
    test('should list all registered providers', () => {
      const providers = factory.listProviders();
      expect(providers).toContain('local');
      expect(providers).toContain('docker');
      expect(providers).toContain('railway');
      expect(providers.length).toBe(3);
    });

    test('should include custom providers in list', () => {
      class CustomProvider extends BaseProvider {}
      factory.registerProvider('custom', CustomProvider);
      
      const providers = factory.listProviders();
      expect(providers).toContain('custom');
      expect(providers.length).toBe(4);
    });
  });

  describe('Provider Capabilities', () => {
    test('should get local provider capabilities', () => {
      const localCaps = factory.getProviderCapabilities('local');
      expect(localCaps.supportsHealthChecks).toBe(true);
      expect(localCaps.supportsMetrics).toBe(true);
      expect(localCaps.supportsCustomDomains).toBe(false);
    });

    test('should throw error for unknown provider capabilities', () => {
      expect(() => factory.getProviderCapabilities('unknown'))
        .toThrow('Unknown provider: unknown');
    });
  });
});