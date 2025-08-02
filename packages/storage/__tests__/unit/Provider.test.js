/**
 * Provider Base Class Unit Tests
 * Phase 1.3: Provider Base Class Tests
 */

import { Provider } from '../../src/core/Provider.js';

describe('Provider Base Class', () => {
  let provider;

  beforeEach(() => {
    provider = new Provider({ test: 'config' });
  });

  describe('Constructor and Basic Properties', () => {
    test('should initialize with config', () => {
      expect(provider.config).toEqual({ test: 'config' });
      expect(provider.connected).toBe(false);
      expect(provider.name).toBe('Provider');
    });

    test('should initialize with empty config if none provided', () => {
      const emptyProvider = new Provider();
      expect(emptyProvider.config).toEqual({});
      expect(emptyProvider.connected).toBe(false);
    });
  });

  describe('Abstract Methods', () => {
    test('connect() should throw error if not implemented', async () => {
      await expect(provider.connect()).rejects.toThrow('Provider: connect() method must be implemented');
    });

    test('disconnect() should throw error if not implemented', async () => {
      await expect(provider.disconnect()).rejects.toThrow('Provider: disconnect() method must be implemented');
    });

    test('find() should throw error if not implemented', async () => {
      await expect(provider.find('collection')).rejects.toThrow('Provider: find() method must be implemented');
    });

    test('insert() should throw error if not implemented', async () => {
      await expect(provider.insert('collection', {})).rejects.toThrow('Provider: insert() method must be implemented');
    });

    test('update() should throw error if not implemented', async () => {
      await expect(provider.update('collection', {}, {})).rejects.toThrow('Provider: update() method must be implemented');
    });

    test('delete() should throw error if not implemented', async () => {
      await expect(provider.delete('collection', {})).rejects.toThrow('Provider: delete() method must be implemented');
    });

    test('listCollections() should throw error if not implemented', async () => {
      await expect(provider.listCollections()).rejects.toThrow('Provider: listCollections() method must be implemented');
    });

    test('dropCollection() should throw error if not implemented', async () => {
      await expect(provider.dropCollection('collection')).rejects.toThrow('Provider: dropCollection() method must be implemented');
    });
  });

  describe('Connection State Management', () => {
    test('isConnected() should return connection state', () => {
      expect(provider.isConnected()).toBe(false);
      
      provider.connected = true;
      expect(provider.isConnected()).toBe(true);
    });
  });

  describe('Default Implementations', () => {
    test('findOne() should use find() with limit 1', async () => {
      // Mock find method
      provider.find = jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
      
      const result = await provider.findOne('collection', { test: true }, { sort: { id: 1 } });
      
      expect(provider.find).toHaveBeenCalledWith('collection', { test: true }, { sort: { id: 1 }, limit: 1 });
      expect(result).toEqual({ id: 1 });
    });

    test('findOne() should return null if no results', async () => {
      provider.find = jest.fn().mockResolvedValue([]);
      
      const result = await provider.findOne('collection', {});
      
      expect(result).toBeNull();
    });

    test('count() should use find() and return length', async () => {
      provider.find = jest.fn().mockResolvedValue([{}, {}, {}]);
      
      const count = await provider.count('collection', { active: true });
      
      expect(provider.find).toHaveBeenCalledWith('collection', { active: true }, {});
      expect(count).toBe(3);
    });

    test('aggregate() should return empty array by default', async () => {
      const result = await provider.aggregate('collection', []);
      expect(result).toEqual([]);
    });

    test('createIndex() should return not supported by default', async () => {
      const result = await provider.createIndex('collection', { field: 1 });
      expect(result).toEqual({
        acknowledged: false,
        message: 'Index creation not supported by this provider'
      });
    });

    test('watch() should return null by default', async () => {
      const result = await provider.watch('collection');
      expect(result).toBeNull();
    });
  });

  describe('Capability Reporting', () => {
    test('getCapabilities() should return base capabilities', () => {
      const capabilities = provider.getCapabilities();
      
      expect(capabilities).toContain('find');
      expect(capabilities).toContain('findOne');
      expect(capabilities).toContain('insert');
      expect(capabilities).toContain('update');
      expect(capabilities).toContain('delete');
      expect(capabilities).toContain('count');
      expect(capabilities).toContain('listCollections');
      expect(capabilities).toContain('dropCollection');
    });

    test('getMetadata() should return provider metadata', () => {
      const metadata = provider.getMetadata();
      
      expect(metadata.name).toBe('Provider');
      expect(metadata.connected).toBe(false);
      expect(metadata.config).toEqual({ test: 'config' });
      expect(metadata.capabilities).toEqual(provider.getCapabilities());
    });
  });
});