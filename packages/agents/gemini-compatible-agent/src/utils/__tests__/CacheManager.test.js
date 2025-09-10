import CacheManager from '../CacheManager.js';

describe('CacheManager', () => {
  let cacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager();
  });

  test('should store and retrieve values', () => {
    cacheManager.set('key1', 'value1');
    expect(cacheManager.get('key1')).toBe('value1');
  });

  test('should return null for expired entries', async () => {
    cacheManager.set('key2', 'value2', 0);
    // Add small delay to ensure expiration
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(cacheManager.get('key2')).toBeNull();
  });

  test('should clear all entries', () => {
    cacheManager.set('key3', 'value3');
    cacheManager.clear();
    expect(cacheManager.get('key3')).toBeNull();
  });
});
