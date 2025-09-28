import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FileSystemProvider } from '../../../src/providers/FileSystemProvider.js';
import { ValidationError } from '../../../src/core/StorageError.js';

/**
 * MockFileSystemDataSource - Simple in-memory mock for testing
 * Implements the DataSource interface without any actual file I/O
 */
class MockFileSystemDataSource {
  constructor() {
    this.files = new Map();
    this.subscriptions = new Map();
    this.nextSubId = 1;
  }
  
  query(querySpec) {
    // Extract file path from query
    const filePath = this._extractPath(querySpec);
    
    // Check if we're querying for content
    if (querySpec.find && querySpec.find.includes('content')) {
      const content = this.files.get(filePath);
      return content ? [content] : [];
    }
    
    // Check if we're querying for metadata
    if (querySpec.find && querySpec.find.includes('metadata')) {
      return [{
        path: filePath,
        type: 'file',
        exists: this.files.has(filePath)
      }];
    }
    
    return [];
  }
  
  update(path, data) {
    try {
      if (data.operation === 'write') {
        this.files.set(path, data.content);
        // Notify subscribers
        this._notifySubscribers(path);
        return { success: true };
      }
      return { success: false, error: 'Unknown operation' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  subscribe(querySpec, callback) {
    const filePath = this._extractPath(querySpec);
    const subId = this.nextSubId++;
    
    if (!this.subscriptions.has(filePath)) {
      this.subscriptions.set(filePath, new Map());
    }
    this.subscriptions.get(filePath).set(subId, callback);
    
    return {
      unsubscribe: () => {
        const subs = this.subscriptions.get(filePath);
        if (subs) {
          subs.delete(subId);
        }
      }
    };
  }
  
  getSchema() {
    return {
      type: 'filesystem',
      operations: ['read', 'write', 'watch']
    };
  }
  
  _extractPath(querySpec) {
    if (querySpec.where && querySpec.where.length > 0) {
      const firstClause = querySpec.where[0];
      if (Array.isArray(firstClause) && firstClause.length >= 2) {
        return firstClause[1];
      }
    }
    return null;
  }
  
  _notifySubscribers(filePath) {
    const subs = this.subscriptions.get(filePath);
    if (subs) {
      subs.forEach(callback => {
        try {
          callback([{ event: 'change', path: filePath }]);
        } catch (error) {
          // Ignore callback errors
        }
      });
    }
  }
}

/**
 * Unit tests for FileSystemProvider
 * 
 * Tests are organized by functionality:
 * - Format detection
 * - JSON serialization/deserialization
 * - Turtle serialization/deserialization
 * - N-Triples serialization/deserialization
 * - Auto-save functionality
 * - File watching
 * 
 * Note: These tests use a mock DataSource, not real file I/O
 */
describe('FileSystemProvider', () => {
  let dataSource;

  beforeEach(() => {
    // Create fresh mock DataSource for each test
    dataSource = new MockFileSystemDataSource();
  });

  describe('Format Detection', () => {
    it('should detect JSON format from .json extension', () => {
      const filePath = '/test/data.json';
      const provider = new FileSystemProvider(dataSource, filePath);
      
      expect(provider.format).toBe('json');
    });

    it('should detect Turtle format from .ttl extension', () => {
      const filePath = '/test/data.ttl';
      const provider = new FileSystemProvider(dataSource, filePath);
      
      expect(provider.format).toBe('turtle');
    });

    it('should detect Turtle format from .turtle extension', () => {
      const filePath = '/test/data.turtle';
      const provider = new FileSystemProvider(dataSource, filePath);
      
      expect(provider.format).toBe('turtle');
    });

    it('should detect N-Triples format from .nt extension', () => {
      const filePath = '/test/data.nt';
      const provider = new FileSystemProvider(dataSource, filePath);
      
      expect(provider.format).toBe('ntriples');
    });

    it('should detect N-Triples format from .ntriples extension', () => {
      const filePath = '/test/data.ntriples';
      const provider = new FileSystemProvider(dataSource, filePath);
      
      expect(provider.format).toBe('ntriples');
    });

    it('should default to JSON for unknown extensions', () => {
      const filePath = '/test/data.txt';
      const provider = new FileSystemProvider(dataSource, filePath);
      
      expect(provider.format).toBe('json');
    });

    it('should default to JSON for no extension', () => {
      const filePath = '/test/data';
      const provider = new FileSystemProvider(dataSource, filePath);
      
      expect(provider.format).toBe('json');
    });

    it('should handle case-insensitive extensions', () => {
      const jsonPath = '/test/data.JSON';
      const jsonProvider = new FileSystemProvider(dataSource, jsonPath);
      expect(jsonProvider.format).toBe('json');

      const ttlPath = '/test/data.TTL';
      const ttlProvider = new FileSystemProvider(dataSource, ttlPath);
      expect(ttlProvider.format).toBe('turtle');

      const ntPath = '/test/data.NT';
      const ntProvider = new FileSystemProvider(dataSource, ntPath);
      expect(ntProvider.format).toBe('ntriples');
    });

    it('should allow explicit format override via options', () => {
      const filePath = '/test/data.txt';
      const provider = new FileSystemProvider(dataSource, filePath, { format: 'turtle' });
      
      expect(provider.format).toBe('turtle');
    });

    it('should validate format in options', () => {
      const filePath = '/test/data.json';
      
      expect(() => {
        new FileSystemProvider(dataSource, filePath, { format: 'invalid' });
      }).toThrow(ValidationError);
    });

    it('should accept all supported formats in options', () => {
      const filePath = '/test/data.dat';
      
      const jsonProvider = new FileSystemProvider(dataSource, filePath, { format: 'json' });
      expect(jsonProvider.format).toBe('json');

      const turtleProvider = new FileSystemProvider(dataSource, filePath, { format: 'turtle' });
      expect(turtleProvider.format).toBe('turtle');

      const ntriplesProvider = new FileSystemProvider(dataSource, filePath, { format: 'ntriples' });
      expect(ntriplesProvider.format).toBe('ntriples');
    });
  });

  describe('Constructor Validation', () => {
    it('should require a valid DataSource', () => {
      expect(() => {
        new FileSystemProvider(null, '/test/data.json');
      }).toThrow(ValidationError);

      expect(() => {
        new FileSystemProvider({}, '/test/data.json');
      }).toThrow(ValidationError);

      expect(() => {
        new FileSystemProvider({ query: 'not a function' }, '/test/data.json');
      }).toThrow(ValidationError);
    });
    
    it('should require a file path', () => {
      expect(() => {
        new FileSystemProvider(dataSource);
      }).toThrow(ValidationError);

      expect(() => {
        new FileSystemProvider(dataSource, '');
      }).toThrow(ValidationError);

      expect(() => {
        new FileSystemProvider(dataSource, '   ');
      }).toThrow(ValidationError);
    });

    it('should normalize paths to forward slashes', () => {
      const windowsPath = 'C:\\data\\test.json';
      const provider = new FileSystemProvider(dataSource, windowsPath);
      
      expect(provider.filePath).toBe('C:/data/test.json');
    });

    it('should accept forward slash paths', () => {
      const unixPath = '/data/test.json';
      const provider = new FileSystemProvider(dataSource, unixPath);
      
      expect(provider.filePath).toBe('/data/test.json');
    });
  });

  describe('Configuration Options', () => {
    it('should enable auto-save by default', () => {
      const filePath = '/test/data.json';
      const provider = new FileSystemProvider(dataSource, filePath);
      
      expect(provider.autoSave).toBe(true);
    });

    it('should allow disabling auto-save', () => {
      const filePath = '/test/data.json';
      const provider = new FileSystemProvider(dataSource, filePath, { autoSave: false });
      
      expect(provider.autoSave).toBe(false);
    });

    it('should disable file watching by default', () => {
      const filePath = '/test/data.json';
      const provider = new FileSystemProvider(dataSource, filePath);
      
      expect(provider.watchForChanges).toBe(false);
    });

    it('should allow enabling file watching', () => {
      const filePath = '/test/data.json';
      const provider = new FileSystemProvider(dataSource, filePath, { watchForChanges: true });
      
      expect(provider.watchForChanges).toBe(true);
    });

    it('should use utf8 encoding by default', () => {
      const filePath = '/test/data.json';
      const provider = new FileSystemProvider(dataSource, filePath);
      
      expect(provider.encoding).toBe('utf8');
    });

    it('should allow custom encoding', () => {
      const filePath = '/test/data.json';
      const provider = new FileSystemProvider(dataSource, filePath, { encoding: 'utf16le' });
      
      expect(provider.encoding).toBe('utf16le');
    });
  });

  describe('Metadata', () => {
    it('should provide correct metadata', () => {
      const filePath = '/test/data.json';
      const provider = new FileSystemProvider(dataSource, filePath, {
        autoSave: true,
        watchForChanges: true
      });
      
      const metadata = provider.getMetadata();
      
      expect(metadata.type).toBe('file');
      expect(metadata.supportsTransactions).toBe(false);
      expect(metadata.supportsPersistence).toBe(true);
      expect(metadata.supportsAsync).toBe(true);
      expect(metadata.filePath).toBe(filePath);
      expect(metadata.format).toBe('json');
      expect(metadata.autoSave).toBe(true);
      expect(metadata.watchForChanges).toBe(true);
    });
  });

  describe('Initial State', () => {
    it('should start with empty state', () => {
      const filePath = '/test/data.json';
      const provider = new FileSystemProvider(dataSource, filePath);
      
      expect(provider.loaded).toBe(false);
      expect(provider.dirty).toBe(false);
      expect(provider.saving).toBe(false);
      expect(provider.watcher).toBe(null);
    });
  });

  describe('JSON Serialization/Deserialization', () => {
    it('should serialize triples to JSON format', async () => {
      const filePath = '/test/data.json';
      const provider = new FileSystemProvider(dataSource, filePath);
      
      await provider.addTriple('user:1', 'hasName', 'Alice');
      await provider.addTriple('user:1', 'hasAge', 30);
      await provider.addTriple('user:2', 'hasName', 'Bob');
      
      // Trigger save to serialize
      await provider.save();
      
      // Check that data was written via DataSource
      const writtenContent = dataSource.files.get(filePath);
      expect(writtenContent).toBeDefined();
      
      const parsed = JSON.parse(writtenContent);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(3);
      expect(parsed).toContainEqual(['user:1', 'hasName', 'Alice']);
      expect(parsed).toContainEqual(['user:1', 'hasAge', 30]);
      expect(parsed).toContainEqual(['user:2', 'hasName', 'Bob']);
    });

    it('should deserialize JSON triples on load', async () => {
      const filePath = '/test/data.json';
      
      // Pre-populate file with JSON data
      const triples = [
        ['product:1', 'hasName', 'Widget'],
        ['product:1', 'hasPrice', 9.99],
        ['product:2', 'hasName', 'Gadget']
      ];
      dataSource.files.set(filePath, JSON.stringify(triples));
      
      const provider = new FileSystemProvider(dataSource, filePath);
      
      // Load should deserialize
      await provider.load();
      
      expect(provider.loaded).toBe(true);
      const size = await provider.size();
      expect(size).toBe(3);
      
      const results = await provider.query('product:1', null, null);
      expect(results).toHaveLength(2);
    });

    it('should handle empty JSON array', async () => {
      const filePath = '/test/empty.json';
      dataSource.files.set(filePath, '[]');
      
      const provider = new FileSystemProvider(dataSource, filePath);
      await provider.load();
      
      const size = await provider.size();
      expect(size).toBe(0);
    });

    it('should preserve data types through JSON serialization', async () => {
      const filePath = '/test/types.json';
      const provider = new FileSystemProvider(dataSource, filePath);
      
      await provider.addTriple('entity:1', 'stringProp', 'text value');
      await provider.addTriple('entity:1', 'numberProp', 42);
      await provider.addTriple('entity:1', 'booleanProp', true);
      
      await provider.save();
      
      // Reload and verify types
      const provider2 = new FileSystemProvider(dataSource, filePath);
      await provider2.load();
      
      const results = await provider2.query('entity:1', null, null);
      expect(results).toHaveLength(3);
      
      const stringResult = results.find(t => t[1] === 'stringProp');
      expect(typeof stringResult[2]).toBe('string');
      expect(stringResult[2]).toBe('text value');
      
      const numberResult = results.find(t => t[1] === 'numberProp');
      expect(typeof numberResult[2]).toBe('number');
      expect(numberResult[2]).toBe(42);
      
      const booleanResult = results.find(t => t[1] === 'booleanProp');
      expect(typeof booleanResult[2]).toBe('boolean');
      expect(booleanResult[2]).toBe(true);
    });

    it('should handle special characters in JSON strings', async () => {
      const filePath = '/test/special.json';
      const provider = new FileSystemProvider(dataSource, filePath);
      
      await provider.addTriple('quote:1', 'hasText', 'He said "hello"');
      await provider.addTriple('newline:1', 'hasText', 'Line 1\nLine 2');
      await provider.addTriple('tab:1', 'hasText', 'Column1\tColumn2');
      
      await provider.save();
      
      // Reload and verify
      const provider2 = new FileSystemProvider(dataSource, filePath);
      await provider2.load();
      
      const quoteResult = await provider2.query('quote:1', 'hasText', null);
      expect(quoteResult[0][2]).toBe('He said "hello"');
      
      const newlineResult = await provider2.query('newline:1', 'hasText', null);
      expect(newlineResult[0][2]).toBe('Line 1\nLine 2');
      
      const tabResult = await provider2.query('tab:1', 'hasText', null);
      expect(tabResult[0][2]).toBe('Column1\tColumn2');
    });
  });

  describe('Turtle Serialization/Deserialization', () => {
    it('should serialize triples to Turtle format', async () => {
      const filePath = '/test/data.ttl';
      const provider = new FileSystemProvider(dataSource, filePath);
      
      await provider.addTriple('http://example.org/user1', 'http://example.org/name', 'Alice');
      await provider.addTriple('http://example.org/user1', 'http://example.org/age', 30);
      await provider.addTriple('http://example.org/user2', 'http://example.org/name', 'Bob');
      
      await provider.save();
      
      const writtenContent = dataSource.files.get(filePath);
      expect(writtenContent).toBeDefined();
      
      // Verify Turtle format syntax
      expect(writtenContent).toContain('<http://example.org/user1>');
      expect(writtenContent).toContain('<http://example.org/name>');
      expect(writtenContent).toContain('"Alice"');
      expect(writtenContent).toContain('"30"^^xsd:integer');
      expect(writtenContent).toContain('"Bob"');
      expect(writtenContent).toMatch(/\.\s*$/m); // Should end with period
    });

    it('should deserialize Turtle format', async () => {
      const filePath = '/test/data.ttl';
      
      const turtleContent = `<http://example.org/product1> <http://example.org/name> "Widget" .
<http://example.org/product1> <http://example.org/price> "9.99"^^xsd:integer .
<http://example.org/product2> <http://example.org/name> "Gadget" .`;
      
      dataSource.files.set(filePath, turtleContent);
      
      const provider = new FileSystemProvider(dataSource, filePath);
      await provider.load();
      
      expect(provider.loaded).toBe(true);
      const size = await provider.size();
      expect(size).toBe(3);
      
      const results = await provider.query('http://example.org/product1', null, null);
      expect(results).toHaveLength(2);
    });

    it('should handle Turtle URIs with angle brackets', async () => {
      const filePath = '/test/uris.ttl';
      
      const turtleContent = `<http://example.org/subject> <http://example.org/predicate> <http://example.org/object> .`;
      dataSource.files.set(filePath, turtleContent);
      
      const provider = new FileSystemProvider(dataSource, filePath);
      await provider.load();
      
      const results = await provider.query('http://example.org/subject', null, null);
      expect(results).toHaveLength(1);
      expect(results[0][2]).toBe('http://example.org/object');
    });

    it('should handle Turtle string literals with quotes', async () => {
      const filePath = '/test/quotes.ttl';
      const provider = new FileSystemProvider(dataSource, filePath);
      
      await provider.addTriple('http://example.org/quote1', 'http://example.org/text', 'He said "hello"');
      await provider.save();
      
      // Reload and verify
      const provider2 = new FileSystemProvider(dataSource, filePath);
      await provider2.load();
      
      const results = await provider2.query('http://example.org/quote1', 'http://example.org/text', null);
      expect(results[0][2]).toBe('He said "hello"');
    });

    it('should handle Turtle comments and empty lines', async () => {
      const filePath = '/test/comments.ttl';
      
      const turtleContent = `# This is a comment
<http://example.org/user1> <http://example.org/name> "Alice" .

# Another comment
<http://example.org/user2> <http://example.org/name> "Bob" .`;
      
      dataSource.files.set(filePath, turtleContent);
      
      const provider = new FileSystemProvider(dataSource, filePath);
      await provider.load();
      
      const size = await provider.size();
      expect(size).toBe(2);
    });

    it('should handle Turtle boolean and number literals', async () => {
      const filePath = '/test/types.ttl';
      const provider = new FileSystemProvider(dataSource, filePath);
      
      await provider.addTriple('http://example.org/entity1', 'http://example.org/count', 42);
      await provider.addTriple('http://example.org/entity1', 'http://example.org/active', true);
      
      await provider.save();
      
      const writtenContent = dataSource.files.get(filePath);
      expect(writtenContent).toContain('"42"^^xsd:integer');
      expect(writtenContent).toContain('"true"^^xsd:boolean');
    });

    it('should round-trip Turtle data correctly', async () => {
      const filePath = '/test/roundtrip.ttl';
      const provider = new FileSystemProvider(dataSource, filePath);
      
      // Add various types of triples
      await provider.addTriple('http://example.org/user1', 'http://example.org/name', 'Alice Smith');
      await provider.addTriple('http://example.org/user1', 'http://example.org/age', 30);
      await provider.addTriple('http://example.org/user1', 'http://example.org/active', true);
      await provider.addTriple('http://example.org/user1', 'http://example.org/knows', 'http://example.org/user2');
      
      await provider.save();
      
      // Reload in new provider
      const provider2 = new FileSystemProvider(dataSource, filePath);
      await provider2.load();
      
      const results = await provider2.query('http://example.org/user1', null, null);
      expect(results).toHaveLength(4);
      
      // Verify each triple is preserved
      const nameTriple = results.find(t => t[1] === 'http://example.org/name');
      expect(nameTriple[2]).toBe('Alice Smith');
      
      const ageTriple = results.find(t => t[1] === 'http://example.org/age');
      expect(ageTriple[2]).toBe('30'); // Note: Numbers become strings in Turtle
      
      const activeTriple = results.find(t => t[1] === 'http://example.org/active');
      expect(activeTriple[2]).toBe('true'); // Note: Booleans become strings in Turtle
      
      const knowsTriple = results.find(t => t[1] === 'http://example.org/knows');
      expect(knowsTriple[2]).toBe('http://example.org/user2');
    });
  });

  describe('N-Triples Serialization/Deserialization', () => {
    it('should serialize triples to N-Triples format', async () => {
      const filePath = '/test/data.nt';
      const provider = new FileSystemProvider(dataSource, filePath);
      
      await provider.addTriple('http://example.org/user1', 'http://example.org/name', 'Alice');
      await provider.addTriple('http://example.org/user1', 'http://example.org/age', 30);
      await provider.addTriple('http://example.org/user2', 'http://example.org/name', 'Bob');
      
      await provider.save();
      
      const writtenContent = dataSource.files.get(filePath);
      expect(writtenContent).toBeDefined();
      
      // Verify N-Triples format syntax
      expect(writtenContent).toContain('<http://example.org/user1>');
      expect(writtenContent).toContain('<http://example.org/name>');
      expect(writtenContent).toContain('"Alice"');
      expect(writtenContent).toContain('"30"^^<http://www.w3.org/2001/XMLSchema#integer>');
      expect(writtenContent).toContain('"Bob"');
      expect(writtenContent).toMatch(/\.\s*$/m); // Should end with period
    });

    it('should deserialize N-Triples format', async () => {
      const filePath = '/test/data.nt';
      
      const ntriplesContent = `<http://example.org/product1> <http://example.org/name> "Widget" .
<http://example.org/product1> <http://example.org/price> "9.99"^^<http://www.w3.org/2001/XMLSchema#integer> .
<http://example.org/product2> <http://example.org/name> "Gadget" .`;
      
      dataSource.files.set(filePath, ntriplesContent);
      
      const provider = new FileSystemProvider(dataSource, filePath);
      await provider.load();
      
      expect(provider.loaded).toBe(true);
      const size = await provider.size();
      expect(size).toBe(3);
      
      const results = await provider.query('http://example.org/product1', null, null);
      expect(results).toHaveLength(2);
    });

    it('should handle N-Triples URI objects', async () => {
      const filePath = '/test/uris.nt';
      
      const ntriplesContent = `<http://example.org/subject> <http://example.org/predicate> <http://example.org/object> .`;
      dataSource.files.set(filePath, ntriplesContent);
      
      const provider = new FileSystemProvider(dataSource, filePath);
      await provider.load();
      
      const results = await provider.query('http://example.org/subject', null, null);
      expect(results).toHaveLength(1);
      expect(results[0][2]).toBe('http://example.org/object');
    });

    it('should handle N-Triples string literals with quotes', async () => {
      const filePath = '/test/quotes.nt';
      const provider = new FileSystemProvider(dataSource, filePath);
      
      await provider.addTriple('http://example.org/quote1', 'http://example.org/text', 'He said "hello"');
      await provider.save();
      
      // Reload and verify
      const provider2 = new FileSystemProvider(dataSource, filePath);
      await provider2.load();
      
      const results = await provider2.query('http://example.org/quote1', 'http://example.org/text', null);
      expect(results[0][2]).toBe('He said "hello"');
    });

    it('should handle N-Triples comments', async () => {
      const filePath = '/test/comments.nt';
      
      const ntriplesContent = `# This is a comment
<http://example.org/user1> <http://example.org/name> "Alice" .
# Another comment
<http://example.org/user2> <http://example.org/name> "Bob" .`;
      
      dataSource.files.set(filePath, ntriplesContent);
      
      const provider = new FileSystemProvider(dataSource, filePath);
      await provider.load();
      
      const size = await provider.size();
      expect(size).toBe(2);
    });

    it('should handle N-Triples typed literals', async () => {
      const filePath = '/test/types.nt';
      const provider = new FileSystemProvider(dataSource, filePath);
      
      await provider.addTriple('http://example.org/entity1', 'http://example.org/count', 42);
      await provider.addTriple('http://example.org/entity1', 'http://example.org/active', true);
      
      await provider.save();
      
      const writtenContent = dataSource.files.get(filePath);
      expect(writtenContent).toContain('"42"^^<http://www.w3.org/2001/XMLSchema#integer>');
      expect(writtenContent).toContain('"true"^^<http://www.w3.org/2001/XMLSchema#boolean>');
    });

    it('should round-trip N-Triples data correctly', async () => {
      const filePath = '/test/roundtrip.nt';
      const provider = new FileSystemProvider(dataSource, filePath);
      
      // Add various types of triples
      await provider.addTriple('http://example.org/user1', 'http://example.org/name', 'Alice Smith');
      await provider.addTriple('http://example.org/user1', 'http://example.org/age', 30);
      await provider.addTriple('http://example.org/user1', 'http://example.org/active', true);
      await provider.addTriple('http://example.org/user1', 'http://example.org/knows', 'http://example.org/user2');
      
      await provider.save();
      
      // Reload in new provider
      const provider2 = new FileSystemProvider(dataSource, filePath);
      await provider2.load();
      
      const results = await provider2.query('http://example.org/user1', null, null);
      expect(results).toHaveLength(4);
      
      // Verify each triple is preserved
      const nameTriple = results.find(t => t[1] === 'http://example.org/name');
      expect(nameTriple[2]).toBe('Alice Smith');
      
      const ageTriple = results.find(t => t[1] === 'http://example.org/age');
      expect(ageTriple[2]).toBe('30'); // Note: Numbers become strings in N-Triples
      
      const activeTriple = results.find(t => t[1] === 'http://example.org/active');
      expect(activeTriple[2]).toBe('true'); // Note: Booleans become strings in N-Triples
      
      const knowsTriple = results.find(t => t[1] === 'http://example.org/knows');
      expect(knowsTriple[2]).toBe('http://example.org/user2');
    });

    it('should handle empty N-Triples file', async () => {
      const filePath = '/test/empty.nt';
      dataSource.files.set(filePath, '');
      
      const provider = new FileSystemProvider(dataSource, filePath);
      await provider.load();
      
      const size = await provider.size();
      expect(size).toBe(0);
    });
  });
});