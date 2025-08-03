/**
 * Basic validation tests using ES modules
 */

import { QueryBuilder } from '../src/model/QueryBuilder.js';
import { DataCache } from '../src/model/DataCache.js';

describe('StorageBrowser Basic Tests', () => {
  test('QueryBuilder should create valid queries', () => {
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

  test('QueryBuilder should validate queries', () => {
    const builder = QueryBuilder.create()
      .where('status', 'active')
      .greaterThan('age', 18);
    
    const validation = builder.validate();
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  test('DataCache should store and retrieve values', () => {
    const cache = new DataCache();
    
    cache.set('test-key', { data: 'test-value' });
    const result = cache.get('test-key');
    
    expect(result).toEqual({ data: 'test-value' });
    expect(cache.has('test-key')).toBe(true);
    expect(cache.has('non-existent')).toBe(false);
  });

  test('DataCache should handle TTL expiration', (done) => {
    const cache = new DataCache();
    
    cache.set('ttl-key', 'value', 50); // 50ms TTL
    
    setTimeout(() => {
      expect(cache.get('ttl-key')).toBeNull();
      done();
    }, 100);
  });

  test('DataCache should invalidate patterns', () => {
    const cache = new DataCache();
    
    cache.set('users:123', { name: 'John' });
    cache.set('users:456', { name: 'Jane' });
    cache.set('products:789', { name: 'Widget' });
    
    cache.invalidatePattern('users:');
    
    expect(cache.get('users:123')).toBeNull();
    expect(cache.get('users:456')).toBeNull();
    expect(cache.get('products:789')).not.toBeNull();
  });
});