/**
 * SQLiteProvider Mock Tests - Verify implementation without sqlite3 dependency
 */

import { jest } from '@jest/globals';
import { SQLiteProvider } from '../../src/providers/sqlite/SQLiteProvider.js';

// Mock sqlite and sqlite3 modules
jest.mock('sqlite3', () => ({
  verbose: () => ({
    Database: class MockDatabase {
      constructor() {}
      close(cb) { cb && cb(); }
    }
  })
}), { virtual: true });

jest.mock('sqlite', () => {
  const mockDb = {
    db: { close: jest.fn() },
    all: jest.fn(),
    get: jest.fn(),
    run: jest.fn(),
    exec: jest.fn()
  };
  
  return {
    open: jest.fn().mockResolvedValue(mockDb)
  };
}, { virtual: true });

describe('SQLiteProvider (Mocked)', () => {
  let provider;
  let mockDb;

  beforeEach(async () => {
    // Get mock database reference
    const sqlite = await import('sqlite');
    mockDb = await sqlite.open();
    
    // Create provider
    provider = new SQLiteProvider({ filename: ':memory:' });
    
    // Set up mock responses
    mockDb.all.mockResolvedValue([]);
    mockDb.get.mockResolvedValue(null);
    mockDb.run.mockResolvedValue({ changes: 1, lastID: 1 });
    mockDb.exec.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should create provider instance', () => {
    expect(provider).toBeDefined();
    expect(provider.constructor.name).toBe('SQLiteProvider');
  });

  test('should connect to database', async () => {
    await provider.connect();
    expect(provider.connected).toBe(true);
    expect(provider.db).toBeDefined();
  });

  test('should insert document', async () => {
    await provider.connect();
    
    const doc = { name: 'Test', value: 42 };
    mockDb.run.mockResolvedValueOnce({ changes: 1, lastID: 1 });
    
    const result = await provider.insert('test_collection', doc);
    
    expect(result.acknowledged).toBe(true);
    expect(result.insertedCount).toBe(1);
    expect(mockDb.run).toHaveBeenCalled();
  });

  test('should find documents', async () => {
    await provider.connect();
    
    const mockDocs = [
      { id: 1, data: '{"_id":"1","name":"Doc1"}' },
      { id: 2, data: '{"_id":"2","name":"Doc2"}' }
    ];
    mockDb.all.mockResolvedValueOnce(mockDocs);
    
    const results = await provider.find('test_collection');
    
    expect(mockDb.all).toHaveBeenCalled();
    expect(results).toHaveLength(2);
    expect(results[0]._id).toBe('1');
    expect(results[0].name).toBe('Doc1');
  });

  test('should update document', async () => {
    await provider.connect();
    
    mockDb.run.mockResolvedValueOnce({ changes: 1 });
    
    const result = await provider.update(
      'test_collection',
      { _id: '1' },
      { $set: { name: 'Updated' } }
    );
    
    expect(result.acknowledged).toBe(true);
    expect(result.modifiedCount).toBe(1);
    expect(mockDb.run).toHaveBeenCalled();
  });

  test('should delete documents', async () => {
    await provider.connect();
    
    mockDb.run.mockResolvedValueOnce({ changes: 2 });
    
    const result = await provider.delete('test_collection', { type: 'temp' });
    
    expect(result.acknowledged).toBe(true);
    expect(result.deletedCount).toBe(2);
    expect(mockDb.run).toHaveBeenCalled();
  });

  test('should count documents', async () => {
    await provider.connect();
    
    mockDb.get.mockResolvedValueOnce({ count: 5 });
    
    const count = await provider.count('test_collection');
    
    expect(count).toBe(5);
    expect(mockDb.get).toHaveBeenCalled();
  });

  test('should list collections', async () => {
    await provider.connect();
    
    const mockTables = [
      { name: 'collection1' },
      { name: 'collection2' },
      { name: 'collection3' }
    ];
    mockDb.all.mockResolvedValueOnce(mockTables);
    
    const collections = await provider.listCollections();
    
    expect(collections).toEqual(['collection1', 'collection2', 'collection3']);
    expect(mockDb.all).toHaveBeenCalledWith(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
  });

  test('should handle MongoDB query operators', async () => {
    await provider.connect();
    
    // Test $gte operator
    await provider.find('test', { age: { $gte: 18 } });
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining("json_extract(data, '$.age') >= ?"),
      expect.arrayContaining([18])
    );
    
    // Test $in operator
    mockDb.all.mockClear();
    await provider.find('test', { status: { $in: ['active', 'pending'] } });
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining("json_extract(data, '$.status') IN (?, ?)"),
      expect.arrayContaining(['active', 'pending'])
    );
    
    // Test $regex operator
    mockDb.all.mockClear();
    await provider.find('test', { name: { $regex: 'test' } });
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining("json_extract(data, '$.name') LIKE ?"),
      expect.arrayContaining(['%test%'])
    );
  });

  test('should create index', async () => {
    await provider.connect();
    
    mockDb.exec.mockResolvedValueOnce(null);
    
    const indexName = await provider.createIndex('test', { name: 1, age: -1 });
    
    expect(indexName).toContain('idx_test');
    expect(mockDb.exec).toHaveBeenCalledWith(
      expect.stringContaining('CREATE INDEX')
    );
  });

  test('should execute raw SQL', async () => {
    await provider.connect();
    
    const mockResults = [{ count: 10 }];
    mockDb.all.mockResolvedValueOnce(mockResults);
    
    const results = await provider.executeSql('SELECT COUNT(*) as count FROM test');
    
    expect(results).toEqual(mockResults);
    expect(mockDb.all).toHaveBeenCalledWith('SELECT COUNT(*) as count FROM test', []);
  });

  test('should report capabilities', () => {
    const capabilities = provider.getCapabilities();
    
    expect(capabilities).toContain('find');
    expect(capabilities).toContain('insert');
    expect(capabilities).toContain('update');
    expect(capabilities).toContain('delete');
    expect(capabilities).toContain('createIndex');
    expect(capabilities).toContain('transactions');
    expect(capabilities).toContain('json-queries');
    expect(capabilities).toContain('sql-execution');
    expect(capabilities).toContain('vacuum');
  });
});