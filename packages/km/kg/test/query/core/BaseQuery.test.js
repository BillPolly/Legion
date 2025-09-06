import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { BaseQuery } from '../../../src/query/core/BaseQuery.js';
import { KGEngine } from '../../../src/core/KGEngine.js';

describe('Phase 1.1: Base Query Infrastructure', () => {
  let kg;
  let query;
  
  beforeEach(() => {
    kg = new KGEngine();
    query = new BaseQuery();
  });
  
  afterEach(() => {
    // Cleanup
  });
  
  test('Step 1.1.1: Test BaseQuery class instantiation and ID generation', () => {
    // Test basic instantiation
    expect(query).toBeDefined();
    expect(query).toBeInstanceOf(BaseQuery);
    
    // Test ID generation
    const id = query.getId();
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    expect(id).toMatch(/^query_[a-z0-9]+$/);
    
    // Test unique ID generation
    const query2 = new BaseQuery();
    expect(query2.getId()).not.toBe(query.getId());
    
    // Test custom ID
    const customQuery = new BaseQuery('custom_query_123');
    expect(customQuery.getId()).toBe('custom_query_123');
  });
  
  test('Step 1.1.2: Test query metadata storage and retrieval', () => {
    // Test metadata setting and getting
    query.setMetadata('author', 'test_user');
    query.setMetadata('description', 'Test query for validation');
    query.setMetadata('version', '1.0.0');
    
    expect(query.getMetadata('author')).toBe('test_user');
    expect(query.getMetadata('description')).toBe('Test query for validation');
    expect(query.getMetadata('version')).toBe('1.0.0');
    expect(query.getMetadata('nonexistent')).toBeUndefined();
    
    // Test method chaining
    const result = query.setMetadata('chained', 'value');
    expect(result).toBe(query);
    expect(query.getMetadata('chained')).toBe('value');
  });
  
  test('Step 1.1.3: Test execution statistics tracking', () => {
    // Test initial statistics
    expect(query.executionStats).toBeDefined();
    expect(query.executionStats.executionCount).toBe(0);
    expect(query.executionStats.totalExecutionTime).toBe(0);
    expect(query.executionStats.averageExecutionTime).toBe(0);
    expect(query.executionStats.lastExecuted).toBeNull();
    expect(query.executionStats.resultCount).toBe(0);
    
    // Test creation timestamp
    expect(query.createdAt).toBeDefined();
    expect(new Date(query.createdAt)).toBeInstanceOf(Date);
  });
  
  test('Step 1.1.4: Test query serialization to triples', () => {
    // Set up query with metadata
    query.setMetadata('author', 'test_user');
    query.setMetadata('description', 'Test query');
    
    // Test serialization
    const triples = query.toTriples();
    expect(Array.isArray(triples)).toBe(true);
    expect(triples.length).toBeGreaterThan(0);
    
    // Check for required triples
    const queryId = query.getId();
    const typeTriple = triples.find(([s, p, o]) => 
      s === queryId && p === 'rdf:type' && o === 'kg:Query'
    );
    expect(typeTriple).toBeDefined();
    
    const queryTypeTriple = triples.find(([s, p, o]) => 
      s === queryId && p === 'kg:queryType' && o === 'BaseQuery'
    );
    expect(queryTypeTriple).toBeDefined();
    
    const createdTriple = triples.find(([s, p, o]) => 
      s === queryId && p === 'kg:created' && o === query.createdAt
    );
    expect(createdTriple).toBeDefined();
    
    // Check metadata triples
    const authorTriple = triples.find(([s, p, o]) => 
      s === queryId && p === 'kg:author' && o === 'test_user'
    );
    expect(authorTriple).toBeDefined();
    
    // Check execution stats triples
    const statsTriples = triples.filter(([s, p, o]) => 
      s.startsWith(queryId + '_stats')
    );
    expect(statsTriples.length).toBeGreaterThan(0);
  });
  
  test('Step 1.1.5: Test query execution framework', async () => {
    // Create a mock query that implements _executeInternal
    class MockQuery extends BaseQuery {
      async _executeInternal(kgEngine, context) {
        // Simulate some execution time
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          bindings: [new Map([['test', 'value']])],
          variableNames: ['test']
        };
      }
    }
    
    const mockQuery = new MockQuery();
    
    // Test execution
    const result = await mockQuery.execute(kg);
    expect(result).toBeDefined();
    expect(result.bindings).toBeDefined();
    expect(result.bindings.length).toBe(1);
    
    // Test statistics update
    expect(mockQuery.executionStats.executionCount).toBe(1);
    expect(mockQuery.executionStats.totalExecutionTime).toBeGreaterThan(0);
    expect(mockQuery.executionStats.averageExecutionTime).toBeGreaterThan(0);
    expect(mockQuery.executionStats.lastExecuted).toBeDefined();
    expect(mockQuery.executionStats.resultCount).toBe(1);
    
    // Test multiple executions
    await mockQuery.execute(kg);
    expect(mockQuery.executionStats.executionCount).toBe(2);
    expect(mockQuery.executionStats.averageExecutionTime).toBeGreaterThan(0);
  });
  
  test('Step 1.1.6: Test query execution error handling', async () => {
    // Create a mock query that throws an error
    class ErrorQuery extends BaseQuery {
      async _executeInternal(kgEngine, context) {
        throw new Error('Test execution error');
      }
    }
    
    const errorQuery = new ErrorQuery();
    
    // Test error handling
    await expect(errorQuery.execute(kg)).rejects.toThrow('Test execution error');
    
    // Verify statistics are not updated on error
    expect(errorQuery.executionStats.executionCount).toBe(0);
  });
  
  test('Step 1.1.7: Test base query abstract method', async () => {
    // Test that base query throws error for unimplemented _executeInternal
    await expect(query.execute(kg)).rejects.toThrow('_executeInternal must be implemented by subclasses');
  });
});
