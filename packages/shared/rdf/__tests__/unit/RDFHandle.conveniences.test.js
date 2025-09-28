/**
 * Unit tests for RDFHandle RDF-specific convenience methods
 * 
 * Tests the convenience methods that provide RDF-specific functionality:
 * - getURI() - Get entity URI
 * - getType() - Get entity type (rdf:type)
 * - getProperties() - Get all entity properties
 * - followLink() - Follow link properties to create new RDFHandles
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RDFHandle } from '../../src/RDFHandle.js';

// Mock DataSource for testing Handle in isolation
class MockDataSource {
  constructor() {
    this.queryResults = [];
    this.schema = {};
  }

  // Set query results for testing
  setQueryResults(results) {
    this.queryResults = results;
  }

  // Mock DataSource.query() implementation
  query(querySpec) {
    if (!querySpec) {
      throw new Error('Query spec is required');
    }

    if (!querySpec.find || !Array.isArray(querySpec.find)) {
      throw new Error('Query spec must have find array');
    }

    if (!querySpec.where || !Array.isArray(querySpec.where)) {
      throw new Error('Query spec must have where array');
    }

    return this.queryResults;
  }

  // Mock DataSource.subscribe() implementation
  subscribe(querySpec, callback) {
    if (!querySpec) {
      throw new Error('Query spec is required');
    }

    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    const subscription = {
      id: Date.now() + Math.random(),
      querySpec,
      callback,
      unsubscribe: () => {}
    };

    return subscription;
  }

  // Mock DataSource.getSchema() implementation
  getSchema() {
    return this.schema;
  }

  // Mock DataSource.queryBuilder() implementation
  queryBuilder(sourceHandle) {
    return {
      _sourceHandle: sourceHandle,
      where: () => this,
      select: () => this,
      join: () => this,
      orderBy: () => this,
      limit: () => this,
      skip: () => this,
      groupBy: () => this,
      aggregate: () => this,
      first: () => null,
      last: () => null,
      count: () => 0,
      toArray: () => []
    };
  }
}

describe('RDFHandle RDF-specific convenience methods', () => {
  let mockDataSource;
  let handle;

  beforeEach(() => {
    mockDataSource = new MockDataSource();
    handle = new RDFHandle(mockDataSource, 'http://example.org/alice');
  });

  describe('getURI()', () => {
    it('should return the entity URI', () => {
      const uri = handle.getURI();
      expect(uri).toBe('http://example.org/alice');
    });

    it('should return different URIs for different handles', () => {
      const handle1 = new RDFHandle(mockDataSource, 'http://example.org/alice');
      const handle2 = new RDFHandle(mockDataSource, 'http://example.org/bob');

      expect(handle1.getURI()).toBe('http://example.org/alice');
      expect(handle2.getURI()).toBe('http://example.org/bob');
    });

    it('should work with relative URIs', () => {
      const relativeHandle = new RDFHandle(mockDataSource, 'alice');
      expect(relativeHandle.getURI()).toBe('alice');
    });

    it('should work with blank nodes', () => {
      const blankNodeHandle = new RDFHandle(mockDataSource, '_:blank1');
      expect(blankNodeHandle.getURI()).toBe('_:blank1');
    });

    it('should throw if handle is destroyed', () => {
      handle.destroy();

      expect(() => {
        handle.getURI();
      }).toThrow('Handle has been destroyed');
    });
  });

  describe('getType()', () => {
    it('should return type from rdf:type property', () => {
      // Set up entity data with rdf:type
      mockDataSource.setQueryResults([
        {
          s: 'http://example.org/alice',
          p: 'rdf:type',
          o: 'foaf:Person'
        },
        {
          s: 'http://example.org/alice',
          p: 'foaf:name',
          o: 'Alice Smith'
        }
      ]);

      const type = handle.getType();
      expect(type).toBe('foaf:Person');
    });

    it('should return type from type property', () => {
      // Set up entity data with simple type property
      mockDataSource.setQueryResults([
        {
          s: 'http://example.org/alice',
          p: 'type',
          o: 'Person'
        },
        {
          s: 'http://example.org/alice',
          p: 'name',
          o: 'Alice Smith'
        }
      ]);

      const type = handle.getType();
      expect(type).toBe('Person');
    });

    it('should prefer type over rdf:type when both exist', () => {
      // Set up entity data with both type and rdf:type
      mockDataSource.setQueryResults([
        {
          s: 'http://example.org/alice',
          p: 'type',
          o: 'Person'
        },
        {
          s: 'http://example.org/alice',
          p: 'rdf:type',
          o: 'foaf:Person'
        }
      ]);

      const type = handle.getType();
      expect(type).toBe('Person'); // Should prefer 'type' over 'rdf:type'
    });

    it('should return null if no type property exists', () => {
      // Set up entity data without type
      mockDataSource.setQueryResults([
        {
          s: 'http://example.org/alice',
          p: 'foaf:name',
          o: 'Alice Smith'
        },
        {
          s: 'http://example.org/alice',
          p: 'foaf:age',
          o: 30
        }
      ]);

      const type = handle.getType();
      expect(type).toBeNull();
    });

    it('should return null if entity does not exist', () => {
      // Set up empty query results
      mockDataSource.setQueryResults([]);

      const type = handle.getType();
      expect(type).toBeNull();
    });

    it('should handle multi-valued type properties', () => {
      // Set up entity data with multiple types
      mockDataSource.setQueryResults([
        {
          s: 'http://example.org/alice',
          p: 'rdf:type',
          o: 'foaf:Person'
        },
        {
          s: 'http://example.org/alice',
          p: 'rdf:type',
          o: 'schema:Person'
        }
      ]);

      const type = handle.getType();
      // Should return the array of types for multi-valued properties
      expect(Array.isArray(type)).toBe(true);
      expect(type).toHaveLength(2);
      expect(type).toContain('foaf:Person');
      expect(type).toContain('schema:Person');
    });

    it('should throw if handle is destroyed', () => {
      handle.destroy();

      expect(() => {
        handle.getType();
      }).toThrow('Handle has been destroyed');
    });
  });

  describe('getProperties()', () => {
    it('should return all property names for entity', () => {
      // Set up entity data with multiple properties
      mockDataSource.setQueryResults([
        {
          s: 'http://example.org/alice',
          p: 'foaf:name',
          o: 'Alice Smith'
        },
        {
          s: 'http://example.org/alice',
          p: 'foaf:age',
          o: 30
        },
        {
          s: 'http://example.org/alice',
          p: 'foaf:email',
          o: 'alice@example.com'
        }
      ]);

      const properties = handle.getProperties();
      expect(Array.isArray(properties)).toBe(true);
      expect(properties).toHaveLength(3);
      expect(properties).toContain('foaf:name');
      expect(properties).toContain('foaf:age');
      expect(properties).toContain('foaf:email');
    });

    it('should return empty array if entity has no properties', () => {
      // Set up entity data with no properties
      mockDataSource.setQueryResults([]);

      const properties = handle.getProperties();
      expect(Array.isArray(properties)).toBe(true);
      expect(properties).toHaveLength(0);
    });

    it('should not include duplicate property names', () => {
      // Set up entity data with duplicate properties (multi-valued)
      mockDataSource.setQueryResults([
        {
          s: 'http://example.org/alice',
          p: 'foaf:knows',
          o: 'http://example.org/bob'
        },
        {
          s: 'http://example.org/alice',
          p: 'foaf:knows',
          o: 'http://example.org/charlie'
        },
        {
          s: 'http://example.org/alice',
          p: 'foaf:name',
          o: 'Alice Smith'
        }
      ]);

      const properties = handle.getProperties();
      expect(Array.isArray(properties)).toBe(true);
      expect(properties).toHaveLength(2);
      expect(properties).toContain('foaf:knows');
      expect(properties).toContain('foaf:name');
    });

    it('should include type properties', () => {
      // Set up entity data with type properties
      mockDataSource.setQueryResults([
        {
          s: 'http://example.org/alice',
          p: 'rdf:type',
          o: 'foaf:Person'
        },
        {
          s: 'http://example.org/alice',
          p: 'foaf:name',
          o: 'Alice Smith'
        }
      ]);

      const properties = handle.getProperties();
      expect(Array.isArray(properties)).toBe(true);
      expect(properties).toContain('rdf:type');
      expect(properties).toContain('foaf:name');
    });

    it('should return empty array if entity does not exist', () => {
      // Set up empty query results
      mockDataSource.setQueryResults([]);

      const properties = handle.getProperties();
      expect(Array.isArray(properties)).toBe(true);
      expect(properties).toHaveLength(0);
    });

    it('should throw if handle is destroyed', () => {
      handle.destroy();

      expect(() => {
        handle.getProperties();
      }).toThrow('Handle has been destroyed');
    });
  });

  describe('followLink()', () => {
    beforeEach(() => {
      // Set up entity data with various properties
      mockDataSource.setQueryResults([
        {
          s: 'http://example.org/alice',
          p: 'foaf:name',
          o: 'Alice Smith'
        },
        {
          s: 'http://example.org/alice',
          p: 'foaf:age',
          o: 30
        },
        {
          s: 'http://example.org/alice',
          p: 'foaf:knows',
          o: 'http://example.org/bob'
        },
        {
          s: 'http://example.org/alice',
          p: 'foaf:email',
          o: 'alice@example.com'
        }
      ]);
    });

    it('should create new RDFHandle for URI property', () => {
      const bobHandle = handle.followLink('foaf:knows');

      expect(bobHandle).toBeInstanceOf(RDFHandle);
      expect(bobHandle.getURI()).toBe('http://example.org/bob');
      expect(bobHandle.dataSource).toBe(mockDataSource);
    });

    it('should return literal value for non-URI property', () => {
      const name = handle.followLink('foaf:name');
      expect(name).toBe('Alice Smith');

      const age = handle.followLink('foaf:age');
      expect(age).toBe(30);

      const email = handle.followLink('foaf:email');
      expect(email).toBe('alice@example.com');
    });

    it('should handle multi-valued properties with URIs', () => {
      // Set up entity with multiple foaf:knows values
      mockDataSource.setQueryResults([
        {
          s: 'http://example.org/alice',
          p: 'foaf:knows',
          o: 'http://example.org/bob'
        },
        {
          s: 'http://example.org/alice',
          p: 'foaf:knows',
          o: 'http://example.org/charlie'
        }
      ]);

      const friends = handle.followLink('foaf:knows');

      expect(Array.isArray(friends)).toBe(true);
      expect(friends).toHaveLength(2);
      
      expect(friends[0]).toBeInstanceOf(RDFHandle);
      expect(friends[0].getURI()).toBe('http://example.org/bob');
      
      expect(friends[1]).toBeInstanceOf(RDFHandle);
      expect(friends[1].getURI()).toBe('http://example.org/charlie');
    });

    it('should handle multi-valued properties with literals', () => {
      // Set up entity with multiple literal values
      mockDataSource.setQueryResults([
        {
          s: 'http://example.org/alice',
          p: 'foaf:nick',
          o: 'Ali'
        },
        {
          s: 'http://example.org/alice',
          p: 'foaf:nick',
          o: 'Allie'
        }
      ]);

      const nicks = handle.followLink('foaf:nick');

      expect(Array.isArray(nicks)).toBe(true);
      expect(nicks).toHaveLength(2);
      expect(nicks).toContain('Ali');
      expect(nicks).toContain('Allie');
    });

    it('should handle mixed multi-valued properties', () => {
      // Set up entity with mixed URI and literal values for same property
      mockDataSource.setQueryResults([
        {
          s: 'http://example.org/alice',
          p: 'foaf:topic_interest',
          o: 'http://example.org/topic/javascript'
        },
        {
          s: 'http://example.org/alice',
          p: 'foaf:topic_interest',
          o: 'photography'
        }
      ]);

      const interests = handle.followLink('foaf:topic_interest');

      expect(Array.isArray(interests)).toBe(true);
      expect(interests).toHaveLength(2);
      
      // One should be RDFHandle, one should be literal
      const uriResult = interests.find(item => item instanceof RDFHandle);
      const literalResult = interests.find(item => typeof item === 'string' && item === 'photography');
      
      expect(uriResult).toBeDefined();
      expect(uriResult.getURI()).toBe('http://example.org/topic/javascript');
      expect(literalResult).toBe('photography');
    });

    it('should recognize https URLs as URIs', () => {
      // Set up entity with https URL
      mockDataSource.setQueryResults([
        {
          s: 'http://example.org/alice',
          p: 'foaf:homepage',
          o: 'https://alice.example.com'
        }
      ]);

      const homepage = handle.followLink('foaf:homepage');

      expect(homepage).toBeInstanceOf(RDFHandle);
      expect(homepage.getURI()).toBe('https://alice.example.com');
    });

    it('should not treat non-HTTP URLs as URIs for Handle creation', () => {
      // Set up entity with non-HTTP URI
      mockDataSource.setQueryResults([
        {
          s: 'http://example.org/alice',
          p: 'foaf:mbox',
          o: 'mailto:alice@example.com'
        }
      ]);

      const mbox = handle.followLink('foaf:mbox');

      // Should return literal, not RDFHandle (since it's not http/https)
      expect(typeof mbox).toBe('string');
      expect(mbox).toBe('mailto:alice@example.com');
    });

    it('should return null for non-existent property', () => {
      const result = handle.followLink('foaf:nonexistent');
      expect(result).toBeNull();
    });

    it('should return null if entity does not exist', () => {
      // Set up empty query results
      mockDataSource.setQueryResults([]);

      const result = handle.followLink('foaf:knows');
      expect(result).toBeNull();
    });

    it('should throw if property name is missing', () => {
      expect(() => {
        handle.followLink();
      }).toThrow('Property name must be a string');

      expect(() => {
        handle.followLink(null);
      }).toThrow('Property name must be a string');
    });

    it('should throw if property name is not a string', () => {
      expect(() => {
        handle.followLink(123);
      }).toThrow('Property name must be a string');

      expect(() => {
        handle.followLink({});
      }).toThrow('Property name must be a string');
    });

    it('should throw if handle is destroyed', () => {
      handle.destroy();

      expect(() => {
        handle.followLink('foaf:knows');
      }).toThrow('Handle has been destroyed');
    });

    it('should preserve dataSource reference in created handles', () => {
      const bobHandle = handle.followLink('foaf:knows');

      expect(bobHandle.dataSource).toBe(mockDataSource);
      expect(bobHandle.dataSource).toBe(handle.dataSource);
    });

    it('should work with different entity URIs', () => {
      const bobHandle = new RDFHandle(mockDataSource, 'http://example.org/bob');
      
      // Set up Bob's data
      mockDataSource.setQueryResults([
        {
          s: 'http://example.org/bob',
          p: 'foaf:knows',
          o: 'http://example.org/charlie'
        }
      ]);

      const charlieHandle = bobHandle.followLink('foaf:knows');

      expect(charlieHandle).toBeInstanceOf(RDFHandle);
      expect(charlieHandle.getURI()).toBe('http://example.org/charlie');
    });
  });

  describe('Integration between convenience methods', () => {
    it('should work together for entity traversal', () => {
      // Set up Alice's data
      mockDataSource.setQueryResults([
        {
          s: 'http://example.org/alice',
          p: 'rdf:type',
          o: 'foaf:Person'
        },
        {
          s: 'http://example.org/alice',
          p: 'foaf:name',
          o: 'Alice Smith'
        },
        {
          s: 'http://example.org/alice',
          p: 'foaf:knows',
          o: 'http://example.org/bob'
        }
      ]);

      // Get Alice's info
      expect(handle.getURI()).toBe('http://example.org/alice');
      expect(handle.getType()).toBe('foaf:Person');
      expect(handle.getProperties()).toContain('foaf:knows');

      // Follow link to Bob
      const bobHandle = handle.followLink('foaf:knows');
      expect(bobHandle).toBeInstanceOf(RDFHandle);
      expect(bobHandle.getURI()).toBe('http://example.org/bob');
    });

    it('should maintain consistency across method calls', () => {
      // Set up entity data
      mockDataSource.setQueryResults([
        {
          s: 'http://example.org/alice',
          p: 'foaf:name',
          o: 'Alice Smith'
        },
        {
          s: 'http://example.org/alice',
          p: 'foaf:age',
          o: 30
        }
      ]);

      // Multiple calls should return consistent results
      const properties1 = handle.getProperties();
      const properties2 = handle.getProperties();
      expect(properties1).toEqual(properties2);

      const uri1 = handle.getURI();
      const uri2 = handle.getURI();
      expect(uri1).toBe(uri2);
    });

    it('should handle cache invalidation correctly', () => {
      // Set up initial data
      mockDataSource.setQueryResults([
        {
          s: 'http://example.org/alice',
          p: 'foaf:name',
          o: 'Alice Smith'
        }
      ]);

      const initialProps = handle.getProperties();
      expect(initialProps).toContain('foaf:name');

      // Change data (simulate cache invalidation)
      mockDataSource.setQueryResults([
        {
          s: 'http://example.org/alice',
          p: 'foaf:name',
          o: 'Alice Smith'
        },
        {
          s: 'http://example.org/alice',
          p: 'foaf:age',
          o: 30
        }
      ]);

      // Force cache invalidation
      handle._invalidateCache();

      const updatedProps = handle.getProperties();
      expect(updatedProps).toContain('foaf:name');
      expect(updatedProps).toContain('foaf:age');
    });
  });
});