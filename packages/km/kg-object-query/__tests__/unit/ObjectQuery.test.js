/**
 * Unit tests for ObjectQuery class
 * Tests the main API interface and backward compatibility
 */

import { ObjectQuery } from '../../src/ObjectQuery.js';

describe('ObjectQuery', () => {
  const simpleQuery = {
    bindings: {
      userName: { path: 'user.name' },
      userAge: { path: 'user.age' }
    },
    contextVariables: {
      timestamp: { value: '2024-01-15' }
    }
  };

  const testObject = {
    user: {
      name: 'John Doe',
      age: 30,
      email: 'john@example.com'
    },
    settings: {
      theme: 'dark'
    }
  };

  test('should create ObjectQuery instance', () => {
    const query = new ObjectQuery(simpleQuery);
    expect(query).toBeInstanceOf(ObjectQuery);
    expect(query.querySpec).toBe(simpleQuery);
  });

  test('should throw error if no query specification provided', () => {
    expect(() => new ObjectQuery()).toThrow('Query specification is required');
    expect(() => new ObjectQuery(null)).toThrow('Query specification is required');
  });

  test('should execute simple query successfully', () => {
    const query = new ObjectQuery(simpleQuery);
    const result = query.execute(testObject);

    expect(result).toEqual({
      userName: 'John Doe',
      userAge: 30,
      timestamp: '2024-01-15'
    });
  });

  test('should throw error if root object is invalid', () => {
    const query = new ObjectQuery(simpleQuery);
    
    expect(() => query.execute(null)).toThrow('Root object must be a non-null object');
    expect(() => query.execute('string')).toThrow('Root object must be a non-null object');
    expect(() => query.execute(123)).toThrow('Root object must be a non-null object');
  });

  test('should handle missing paths gracefully in non-strict mode', () => {
    const queryWithMissingPath = {
      bindings: {
        existing: { path: 'user.name' },
        missing: { path: 'user.nonexistent' }
      }
    };

    const query = new ObjectQuery(queryWithMissingPath);
    const result = query.execute(testObject);

    expect(result.existing).toBe('John Doe');
    expect(result.missing).toBeUndefined();
  });

  test('should throw error for missing required path in strict mode', () => {
    const queryWithMissingRequired = {
      bindings: {
        existing: { path: 'user.name' },
        missing: { path: 'user.nonexistent', required: true }
      }
    };

    const query = new ObjectQuery(queryWithMissingRequired);
    expect(() => query.execute(testObject, { strict: true })).toThrow('Required binding path not found');
  });

  test('should analyze object structure', () => {
    const query = new ObjectQuery(simpleQuery);
    const analysis = query.analyzeObject(testObject);

    expect(analysis.type).toBe('object');
    expect(analysis.isArray).toBe(false);
    expect(analysis.keys).toEqual(['user', 'settings']);
    expect(analysis.depth).toBeGreaterThan(0);
    expect(analysis.size).toBeGreaterThan(0);
  });

  test('should get required paths from query', () => {
    const complexQuery = {
      bindings: {
        name: { path: 'user.name' },
        email: { path: 'user.email' },
        aggregated: {
          aggregate: [
            { path: 'user.profile' },
            { path: 'settings.theme' }
          ]
        }
      },
      contextVariables: {
        contextPath: { path: 'context.value' }
      }
    };

    const query = new ObjectQuery(complexQuery);
    const paths = query.getRequiredPaths();

    expect(paths).toContain('user.name');
    expect(paths).toContain('user.email');
    expect(paths).toContain('user.profile');
    expect(paths).toContain('settings.theme');
    expect(paths).toContain('context.value');
  });

  test('should validate query specification', () => {
    const validQuery = new ObjectQuery(simpleQuery);
    expect(() => validQuery.validateQuery()).not.toThrow();

    const invalidQuery = new ObjectQuery({ bindings: {} });
    expect(() => invalidQuery.validateQuery()).not.toThrow(); // Empty bindings are allowed

    // Invalid query spec is caught in constructor
    expect(() => new ObjectQuery({ /* no bindings */ })).toThrow();
  });

  test('should provide KG-enhanced statistics', () => {
    const query = new ObjectQuery(simpleQuery);
    const stats = query.getStats();

    expect(stats).toHaveProperty('optimizer');
    expect(stats).toHaveProperty('kgEngine');
    expect(stats.kgEngine).toHaveProperty('initialized');
  });

  test('should cleanup resources', () => {
    const query = new ObjectQuery(simpleQuery);
    
    // Execute to initialize KG engine
    query.execute(testObject);
    
    // Should not throw
    expect(() => query.cleanup()).not.toThrow();
  });
});