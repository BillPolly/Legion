/**
 * Unit tests for RDFDataSource.importRDF() and exportRDF()
 * 
 * Tests import and export functionality:
 * - Import RDF data in various formats (Turtle, N-Triples, JSON-LD)
 * - Export RDF data in various formats
 * - Validate data is correctly stored in triple store
 * - Test format conversions (import one format, export another)
 * - Handle empty triple stores
 * - Handle invalid input
 * - Preserve namespaces during import/export
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RDFDataSource } from '../../src/RDFDataSource.js';
import { NamespaceManager } from '../../src/NamespaceManager.js';
import { SimpleTripleStore } from '../../src/SimpleTripleStore.js';

describe('RDFDataSource import/export', () => {
  let dataSource;
  let tripleStore;
  let namespaceManager;

  beforeEach(() => {
    tripleStore = new SimpleTripleStore();
    namespaceManager = new NamespaceManager();
    namespaceManager.addNamespace('ex', 'http://example.org/');
    namespaceManager.addNamespace('foaf', 'http://xmlns.com/foaf/0.1/');
    
    dataSource = new RDFDataSource(tripleStore, namespaceManager);
  });

  describe('importRDF()', () => {
    describe('Turtle format', () => {
      it('should import simple Turtle data', () => {
        const turtleData = `
          @prefix ex: <http://example.org/> .
          @prefix foaf: <http://xmlns.com/foaf/0.1/> .
          
          ex:alice a foaf:Person ;
            foaf:name "Alice Smith" ;
            foaf:age 30 .
        `;
        
        dataSource.importRDF(turtleData, 'turtle');
        
        // Verify data was imported
        const typeTriples = tripleStore.query('ex:alice', 'rdf:type', 'foaf:Person');
        expect(typeTriples).toHaveLength(1);
        
        const nameTriples = tripleStore.query('ex:alice', 'foaf:name', null);
        expect(nameTriples).toHaveLength(1);
        // RDFParser converts string literals to JavaScript strings (no quotes)
        expect(nameTriples[0][2]).toBe('Alice Smith');
      });

      it('should import Turtle with multiple entities', () => {
        const turtleData = `
          @prefix ex: <http://example.org/> .
          @prefix foaf: <http://xmlns.com/foaf/0.1/> .
          
          ex:alice a foaf:Person ;
            foaf:name "Alice Smith" .
          
          ex:bob a foaf:Person ;
            foaf:name "Bob Jones" .
        `;
        
        dataSource.importRDF(turtleData, 'turtle');
        
        // Verify both entities imported
        const aliceTriples = tripleStore.query('ex:alice', 'foaf:name', null);
        expect(aliceTriples).toHaveLength(1);
        
        const bobTriples = tripleStore.query('ex:bob', 'foaf:name', null);
        expect(bobTriples).toHaveLength(1);
      });

      it('should import Turtle with relationships', () => {
        const turtleData = `
          @prefix ex: <http://example.org/> .
          @prefix foaf: <http://xmlns.com/foaf/0.1/> .
          
          ex:alice a foaf:Person ;
            foaf:knows ex:bob .
          
          ex:bob a foaf:Person .
        `;
        
        dataSource.importRDF(turtleData, 'turtle');
        
        // Verify relationship imported
        const knowsTriples = tripleStore.query('ex:alice', 'foaf:knows', 'ex:bob');
        expect(knowsTriples).toHaveLength(1);
      });

      it('should preserve namespaces from Turtle prefixes', () => {
        const turtleData = `
          @prefix custom: <http://custom.example.com/> .
          
          custom:entity a custom:Type .
        `;
        
        dataSource.importRDF(turtleData, 'turtle');
        
        // Verify namespace was added to manager
        const expanded = namespaceManager.expandPrefix('custom:entity');
        expect(expanded).toBe('http://custom.example.com/entity');
      });
    });

    describe('N-Triples format', () => {
      it('should import simple N-Triples data', () => {
        const ntriplesData = `
          <http://example.org/alice> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://xmlns.com/foaf/0.1/Person> .
          <http://example.org/alice> <http://xmlns.com/foaf/0.1/name> "Alice Smith" .
        `;
        
        dataSource.importRDF(ntriplesData, 'ntriples');
        
        // Verify data was imported (with contracted URIs)
        const typeTriples = tripleStore.query('ex:alice', 'rdf:type', 'foaf:Person');
        expect(typeTriples).toHaveLength(1);
      });

      it('should import N-Triples with typed literals', () => {
        const ntriplesData = `
          <http://example.org/alice> <http://xmlns.com/foaf/0.1/age> "30"^^<http://www.w3.org/2001/XMLSchema#integer> .
        `;
        
        dataSource.importRDF(ntriplesData, 'ntriples');
        
        // Verify typed literal imported
        // RDFParser converts typed literals to JavaScript types
        const ageTriples = tripleStore.query('ex:alice', 'foaf:age', null);
        expect(ageTriples).toHaveLength(1);
        expect(ageTriples[0][2]).toBe(30);
      });
    });

    describe('JSON-LD format', () => {
      it('should import simple JSON-LD data', () => {
        const jsonldData = `
          {
            "@context": {
              "foaf": "http://xmlns.com/foaf/0.1/",
              "ex": "http://example.org/"
            },
            "@id": "ex:alice",
            "foaf:name": "Alice Smith",
            "foaf:age": 30
          }
        `;
        
        dataSource.importRDF(jsonldData, 'jsonld');
        
        // Verify data was imported
        const nameTriples = tripleStore.query('ex:alice', 'foaf:name', null);
        expect(nameTriples).toHaveLength(1);
        expect(nameTriples[0][2]).toBe('Alice Smith');
        
        const ageTriples = tripleStore.query('ex:alice', 'foaf:age', null);
        expect(ageTriples).toHaveLength(1);
        expect(ageTriples[0][2]).toBe(30);
      });

      it('should import JSON-LD with nested objects', () => {
        const jsonldData = `
          {
            "@context": {
              "foaf": "http://xmlns.com/foaf/0.1/",
              "ex": "http://example.org/"
            },
            "@id": "ex:alice",
            "foaf:knows": {
              "@id": "ex:bob"
            }
          }
        `;
        
        dataSource.importRDF(jsonldData, 'jsonld');
        
        // Verify relationship imported
        const knowsTriples = tripleStore.query('ex:alice', 'foaf:knows', 'ex:bob');
        expect(knowsTriples).toHaveLength(1);
      });
    });

    describe('Error handling', () => {
      it('should throw if RDF string is not provided', () => {
        expect(() => {
          dataSource.importRDF(null, 'turtle');
        }).toThrow('RDF string is required');
      });

      it('should throw if format is not provided', () => {
        expect(() => {
          dataSource.importRDF('data', null);
        }).toThrow('Format is required');
      });

      it('should throw if format is not supported', () => {
        expect(() => {
          dataSource.importRDF('data', 'unsupported-format');
        }).toThrow('Unsupported format');
      });

      it('should handle malformed Turtle data gracefully', () => {
        // RDFParser is lenient and doesn't throw on malformed data
        // It simply ignores lines it cannot parse
        expect(() => {
          dataSource.importRDF('this is not valid turtle', 'turtle');
        }).not.toThrow();
        
        // Verify that no triples were added (malformed data was ignored)
        const allTriples = tripleStore.query(null, null, null);
        expect(allTriples).toHaveLength(0);
      });
    });

    describe('Import to existing data', () => {
      it('should append to existing triples without replacing', () => {
        // Add initial data
        tripleStore.add('ex:alice', 'foaf:name', '"Alice"');
        
        // Import additional data
        const turtleData = `
          @prefix ex: <http://example.org/> .
          @prefix foaf: <http://xmlns.com/foaf/0.1/> .
          
          ex:alice foaf:age 30 .
        `;
        
        dataSource.importRDF(turtleData, 'turtle');
        
        // Both triples should exist
        const nameTriples = tripleStore.query('ex:alice', 'foaf:name', null);
        expect(nameTriples).toHaveLength(1);
        
        const ageTriples = tripleStore.query('ex:alice', 'foaf:age', null);
        expect(ageTriples).toHaveLength(1);
      });
    });
  });

  describe('exportRDF()', () => {
    beforeEach(() => {
      // Setup some test data
      tripleStore.add('ex:alice', 'rdf:type', 'foaf:Person');
      tripleStore.add('ex:alice', 'foaf:name', '"Alice Smith"');
      tripleStore.add('ex:alice', 'foaf:age', '"30"^^xsd:integer');
    });

    describe('Turtle format', () => {
      it('should export to Turtle format', () => {
        const turtleOutput = dataSource.exportRDF('turtle');
        
        expect(turtleOutput).toBeDefined();
        expect(typeof turtleOutput).toBe('string');
        expect(turtleOutput.length).toBeGreaterThan(0);
      });

      it('should include prefixes in Turtle output', () => {
        const turtleOutput = dataSource.exportRDF('turtle');
        
        expect(turtleOutput).toContain('@prefix');
        expect(turtleOutput).toContain('ex:');
        expect(turtleOutput).toContain('foaf:');
      });

      it('should include all triples in Turtle output', () => {
        const turtleOutput = dataSource.exportRDF('turtle');
        
        expect(turtleOutput).toContain('alice');
        expect(turtleOutput).toContain('Person');
        expect(turtleOutput).toContain('Alice Smith');
      });
    });

    describe('N-Triples format', () => {
      it('should export to N-Triples format', () => {
        const ntriplesOutput = dataSource.exportRDF('ntriples');
        
        expect(ntriplesOutput).toBeDefined();
        expect(typeof ntriplesOutput).toBe('string');
        expect(ntriplesOutput.length).toBeGreaterThan(0);
      });

      it('should use full URIs in N-Triples output', () => {
        const ntriplesOutput = dataSource.exportRDF('ntriples');
        
        expect(ntriplesOutput).toContain('<http://example.org/alice>');
        expect(ntriplesOutput).toContain('<http://xmlns.com/foaf/0.1/Person>');
      });

      it('should end each line with period in N-Triples', () => {
        const ntriplesOutput = dataSource.exportRDF('ntriples');
        
        const lines = ntriplesOutput.trim().split('\n').filter(l => l.trim());
        for (const line of lines) {
          expect(line.trim()).toMatch(/\.$/);
        }
      });
    });

    describe('JSON-LD format', () => {
      it('should export to JSON-LD format', () => {
        const jsonldOutput = dataSource.exportRDF('jsonld');
        
        expect(jsonldOutput).toBeDefined();
        expect(typeof jsonldOutput).toBe('string');
        expect(jsonldOutput.length).toBeGreaterThan(0);
      });

      it('should produce valid JSON in JSON-LD output', () => {
        const jsonldOutput = dataSource.exportRDF('jsonld');
        
        expect(() => {
          JSON.parse(jsonldOutput);
        }).not.toThrow();
      });

      it('should include @context in JSON-LD output', () => {
        const jsonldOutput = dataSource.exportRDF('jsonld');
        const parsed = JSON.parse(jsonldOutput);
        
        expect(parsed).toHaveProperty('@context');
      });
    });

    describe('Error handling', () => {
      it('should throw if format is not provided', () => {
        expect(() => {
          dataSource.exportRDF(null);
        }).toThrow('Format is required');
      });

      it('should throw if format is not supported', () => {
        expect(() => {
          dataSource.exportRDF('unsupported-format');
        }).toThrow('Unsupported format');
      });
    });

    describe('Empty triple store', () => {
      it('should export empty Turtle for empty triple store', () => {
        const emptyDataSource = new RDFDataSource(new SimpleTripleStore(), namespaceManager);
        const turtleOutput = emptyDataSource.exportRDF('turtle');
        
        expect(turtleOutput).toBeDefined();
        expect(typeof turtleOutput).toBe('string');
        // Should have at least the prefix definitions
        expect(turtleOutput).toContain('@prefix');
      });

      it('should export empty N-Triples for empty triple store', () => {
        const emptyDataSource = new RDFDataSource(new SimpleTripleStore(), namespaceManager);
        const ntriplesOutput = emptyDataSource.exportRDF('ntriples');
        
        expect(ntriplesOutput).toBeDefined();
        expect(typeof ntriplesOutput).toBe('string');
      });
    });
  });

  describe('Round-trip conversions', () => {
    it('should preserve data through Turtle import/export cycle', () => {
      const originalTurtle = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:alice a foaf:Person ;
          foaf:name "Alice Smith" ;
          foaf:age 30 .
      `;
      
      // Import
      dataSource.importRDF(originalTurtle, 'turtle');
      
      // Export
      const exportedTurtle = dataSource.exportRDF('turtle');
      
      // Import exported data into new data source
      const newTripleStore = new SimpleTripleStore();
      const newDataSource = new RDFDataSource(newTripleStore, namespaceManager);
      newDataSource.importRDF(exportedTurtle, 'turtle');
      
      // Verify data matches
      const nameTriples = newTripleStore.query('ex:alice', 'foaf:name', null);
      expect(nameTriples).toHaveLength(1);
      expect(nameTriples[0][2]).toContain('Alice Smith');
    });

    it('should preserve data through N-Triples import/export cycle', () => {
      const originalNTriples = `
        <http://example.org/alice> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://xmlns.com/foaf/0.1/Person> .
        <http://example.org/alice> <http://xmlns.com/foaf/0.1/name> "Alice Smith" .
      `;
      
      // Import
      dataSource.importRDF(originalNTriples, 'ntriples');
      
      // Export
      const exportedNTriples = dataSource.exportRDF('ntriples');
      
      // Verify data can be re-imported
      const newTripleStore = new SimpleTripleStore();
      const newDataSource = new RDFDataSource(newTripleStore, namespaceManager);
      newDataSource.importRDF(exportedNTriples, 'ntriples');
      
      const typeTriples = newTripleStore.query('ex:alice', 'rdf:type', 'foaf:Person');
      expect(typeTriples).toHaveLength(1);
    });

    it('should support cross-format conversion (Turtle → N-Triples)', () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:alice foaf:name "Alice Smith" .
      `;
      
      // Import Turtle
      dataSource.importRDF(turtleData, 'turtle');
      
      // Export N-Triples
      const ntriplesOutput = dataSource.exportRDF('ntriples');
      
      // Verify output is valid N-Triples
      expect(ntriplesOutput).toContain('<http://example.org/alice>');
      expect(ntriplesOutput).toContain('"Alice Smith"');
    });

    it('should support cross-format conversion (N-Triples → Turtle)', () => {
      const ntriplesData = `
        <http://example.org/alice> <http://xmlns.com/foaf/0.1/name> "Alice Smith" .
      `;
      
      // Import N-Triples
      dataSource.importRDF(ntriplesData, 'ntriples');
      
      // Export Turtle
      const turtleOutput = dataSource.exportRDF('turtle');
      
      // Verify output is valid Turtle with prefixes
      expect(turtleOutput).toContain('@prefix');
      expect(turtleOutput).toContain('Alice Smith');
    });

    it('should support cross-format conversion (JSON-LD → Turtle)', () => {
      const jsonldData = `
        {
          "@context": {
            "foaf": "http://xmlns.com/foaf/0.1/",
            "ex": "http://example.org/"
          },
          "@id": "ex:alice",
          "foaf:name": "Alice Smith"
        }
      `;
      
      // Import JSON-LD
      dataSource.importRDF(jsonldData, 'jsonld');
      
      // Export Turtle
      const turtleOutput = dataSource.exportRDF('turtle');
      
      // Verify conversion worked
      expect(turtleOutput).toContain('Alice Smith');
    });
  });
});