/**
 * Basic validation tests for StorageBrowser components
 */

import { QueryBuilder } from '../src/model/QueryBuilder.js';
import { DataCache } from '../src/model/DataCache.js';

describe('StorageBrowser Components Validation', () => {
  test('should load StorageBrowserModel', async () => {
    const { StorageBrowserModel } = await import('../src/model/StorageBrowserModel.js');
    expect(StorageBrowserModel).toBeDefined();
    expect(typeof StorageBrowserModel).toBe('function');
  });

  test('should load QueryBuilder', async () => {
    const { QueryBuilder } = await import('../src/model/QueryBuilder.js');
    expect(QueryBuilder).toBeDefined();
    expect(typeof QueryBuilder).toBe('function');
  });

  test('should load DataCache', async () => {
    const { DataCache } = await import('../src/model/DataCache.js');
    expect(DataCache).toBeDefined();
    expect(typeof DataCache).toBe('function');
  });

  test('should load WebSocketChannel', async () => {
    const { WebSocketChannel } = await import('../src/actors/WebSocketChannel.js');
    expect(WebSocketChannel).toBeDefined();
    expect(typeof WebSocketChannel).toBe('function');
  });

  test('should load StorageActorClient', async () => {
    const { StorageActorClient } = await import('../src/actors/StorageActorClient.js');
    expect(StorageActorClient).toBeDefined();
    expect(typeof StorageActorClient).toBe('function');
  });

  test('should load main StorageBrowser component', async () => {
    const { StorageBrowser } = await import('../src/index.js');
    expect(StorageBrowser).toBeDefined();
    expect(typeof StorageBrowser.create).toBe('function');
  });

  test('QueryBuilder should work correctly', () => {
    const query = QueryBuilder.create()
      .where('status', 'active')
      .greaterThan('age', 18)
      .in('role', ['user', 'admin'])
      .build();
    
    expect(query).toEqual({
      status: 'active',
      age: { $gt: 18 },
      role: { $in: ['user', 'admin'] }
    });
  });

  test('DataCache should cache and retrieve values', () => {
    const cache = new DataCache();
    cache.set('test-key', { data: 'test-value' });
    
    const result = cache.get('test-key');
    expect(result).toEqual({ data: 'test-value' });
    
    expect(cache.has('test-key')).toBe(true);
    expect(cache.has('non-existent')).toBe(false);
  });
});