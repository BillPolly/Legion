import { RDFSerializer, NamespaceManager } from '@legion/kg-rdf';
import { KGEngine } from '../../../src/core/KGEngine.js';

describe('RDFSerializer', () => {
  let kgEngine, namespaceManager, serializer;

  beforeEach(() => {
    kgEngine = new KGEngine();
    namespaceManager = new NamespaceManager();
    serializer = new RDFSerializer(kgEngine, namespaceManager);

    // Add some test data
    kgEngine.addTriple('person1', 'rdf:type', 'foaf:Person');
    kgEngine.addTriple('person1', 'foaf:name', 'John Doe');
    kgEngine.addTriple('person1', 'foaf:age', 30);
    kgEngine.addTriple('person1', 'kg:believes', 'belief1');
    kgEngine.addTriple('belief1', 'rdf:type', 'kg:Belief');
    kgEngine.addTriple('belief1', 'kg:confidence', 0.9);
    kgEngine.addTriple('belief1', 'kg:subject', 'person2');
    kgEngine.addTriple('belief1', 'kg:predicate', 'knows');
    kgEngine.addTriple('belief1', 'kg:object', 'person3');
  });

  describe('Constructor', () => {
    test('should initialize with KG engine and namespace manager', () => {
      expect(serializer.kg).toBe(kgEngine);
      expect(serializer.ns).toBe(namespaceManager);
    });

    test('should work with different engines and namespace managers', () => {
      const newEngine = new KGEngine();
      const newNS = new NamespaceManager();
      const newSerializer = new RDFSerializer(newEngine, newNS);
      
      expect(newSerializer.kg).toBe(newEngine);
      expect(newSerializer.ns).toBe(newNS);
    });
  });

  describe('Turtle Serialization', () => {
    test('should generate valid turtle format', () => {
      const turtle = serializer.toTurtle();
      
      // Should include prefixes
      expect(turtle).toContain('@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .');
      expect(turtle).toContain('@prefix foaf: <http://xmlns.com/foaf/0.1/> .');
      expect(turtle).toContain('@prefix kg: <http://example.org/kg#> .');
      
      // Should include triples
      expect(turtle).toContain('person1 rdf:type foaf:Person .');
      expect(turtle).toContain('person1 foaf:name "John Doe" .');
      expect(turtle).toContain('person1 foaf:age "30"^^xsd:integer .');
    });

    test('should handle empty knowledge graph', () => {
      const emptyEngine = new KGEngine();
      const emptySerializer = new RDFSerializer(emptyEngine, namespaceManager);
      
      const turtle = emptySerializer.toTurtle();
      
      // Should still include prefixes
      expect(turtle).toContain('@prefix rdf:');
      expect(turtle).toContain('@prefix foaf:');
    });

    test('should format different data types correctly', () => {
      kgEngine.addTriple('test1', 'prop:string', 'hello world');
      kgEngine.addTriple('test1', 'prop:integer', 42);
      kgEngine.addTriple('test1', 'prop:decimal', 3.14);
      kgEngine.addTriple('test1', 'prop:boolean', true);
      
      const turtle = serializer.toTurtle();
      
      expect(turtle).toContain('"hello world"');
      expect(turtle).toContain('"42"^^xsd:integer');
      expect(turtle).toContain('"3.14"^^xsd:decimal');
      expect(turtle).toContain('"true"^^xsd:boolean');
    });

    test('should handle special characters in strings', () => {
      kgEngine.addTriple('test1', 'prop:quote', 'He said "Hello"');
      kgEngine.addTriple('test1', 'prop:newline', 'Line 1\nLine 2');
      
      const turtle = serializer.toTurtle();
      
      expect(turtle).toContain('\\"Hello\\"');
    });

    test('should use prefixes for known namespaces', () => {
      const turtle = serializer.toTurtle();
      
      // Should use prefixed form, not full URIs
      expect(turtle).toContain('rdf:type');
      expect(turtle).toContain('foaf:Person');
      expect(turtle).toContain('kg:believes');
      
      // Should not contain full URIs in triple bodies
      expect(turtle).not.toContain('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
    });

    test('should handle unknown namespaces with angle brackets', () => {
      kgEngine.addTriple('test1', 'http://unknown.example.com/property', 'value');
      
      const turtle = serializer.toTurtle();
      
      expect(turtle).toContain('<http://unknown.example.com/property>');
    });
  });

  describe('N-Triples Serialization', () => {
    test('should generate valid N-Triples format', () => {
      const ntriples = serializer.toNTriples();
      
      // Should use full URIs, no prefixes
      expect(ntriples).toContain('<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>');
      expect(ntriples).toContain('<http://xmlns.com/foaf/0.1/Person>');
      expect(ntriples).toContain('<http://xmlns.com/foaf/0.1/name>');
      
      // Should end each line with space-dot
      const lines = ntriples.split('\n').filter(line => line.trim());
      lines.forEach(line => {
        expect(line).toMatch(/\s+\.$$/);
      });
    });

    test('should expand all prefixes to full URIs', () => {
      const ntriples = serializer.toNTriples();
      
      // Should not contain any prefixed forms
      expect(ntriples).not.toContain('rdf:');
      expect(ntriples).not.toContain('foaf:');
      expect(ntriples).not.toContain('kg:');
      
      // Should contain full URIs
      expect(ntriples).toContain('http://example.org/kg#believes');
      expect(ntriples).toContain('http://xmlns.com/foaf/0.1/age');
    });

    test('should handle literals correctly', () => {
      kgEngine.addTriple('test1', 'prop:string', 'test value');
      kgEngine.addTriple('test1', 'prop:number', 123);
      
      const ntriples = serializer.toNTriples();
      
      expect(ntriples).toContain('"test value"');
      expect(ntriples).toContain('"123"^^xsd:integer');
    });

    test('should be one triple per line', () => {
      const ntriples = serializer.toNTriples();
      const lines = ntriples.split('\n').filter(line => line.trim());
      
      // Each line should be a complete triple
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        expect(parts.length).toBeGreaterThanOrEqual(4); // subject predicate object .
        expect(line.trim()).toMatch(/\s+\.$/);
      });
    });
  });

  describe('JSON-LD Serialization', () => {
    test('should generate valid JSON-LD structure', () => {
      const jsonld = serializer.toJsonLD();
      
      expect(jsonld).toHaveProperty('@context');
      expect(jsonld).toHaveProperty('@graph');
      expect(Array.isArray(jsonld['@graph'])).toBe(true);
    });

    test('should include namespace context', () => {
      const jsonld = serializer.toJsonLD();
      
      expect(jsonld['@context']).toHaveProperty('rdf');
      expect(jsonld['@context']).toHaveProperty('foaf');
      expect(jsonld['@context']).toHaveProperty('kg');
      expect(jsonld['@context']['rdf']).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
    });

    test('should group properties by subject', () => {
      const jsonld = serializer.toJsonLD();
      
      const person1 = jsonld['@graph'].find(item => item['@id'] === 'person1');
      expect(person1).toBeDefined();
      expect(person1['rdf:type']).toEqual({ '@id': 'foaf:Person' });
      expect(person1['foaf:name']).toBe('John Doe');
      expect(person1['foaf:age']).toBe(30);
    });

    test('should handle multiple values for same property', () => {
      kgEngine.addTriple('person1', 'foaf:knows', 'person2');
      kgEngine.addTriple('person1', 'foaf:knows', 'person3');
      
      const jsonld = serializer.toJsonLD();
      const person1 = jsonld['@graph'].find(item => item['@id'] === 'person1');
      
      expect(Array.isArray(person1['foaf:knows'])).toBe(true);
      expect(person1['foaf:knows']).toHaveLength(2);
      expect(person1['foaf:knows']).toContainEqual({ '@id': 'person2' });
      expect(person1['foaf:knows']).toContainEqual({ '@id': 'person3' });
    });

    test('should handle literal values correctly', () => {
      const jsonld = serializer.toJsonLD();
      const person1 = jsonld['@graph'].find(item => item['@id'] === 'person1');
      
      expect(person1['foaf:name']).toBe('John Doe');
      expect(person1['foaf:age']).toBe(30);
    });

    test('should handle object references', () => {
      const jsonld = serializer.toJsonLD();
      const person1 = jsonld['@graph'].find(item => item['@id'] === 'person1');
      
      expect(person1['kg:believes']).toEqual({ '@id': 'belief1' });
      expect(person1['rdf:type']).toEqual({ '@id': 'foaf:Person' });
    });
  });

  describe('RDF/XML Serialization', () => {
    test('should generate valid XML structure', () => {
      const rdfxml = serializer.toRDFXML();
      
      expect(rdfxml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(rdfxml).toContain('<rdf:RDF');
      expect(rdfxml).toContain('</rdf:RDF>');
      expect(rdfxml).toContain('<rdf:Description');
    });

    test('should include namespace declarations', () => {
      const rdfxml = serializer.toRDFXML();
      
      expect(rdfxml).toContain('xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"');
      expect(rdfxml).toContain('xmlns:foaf="http://xmlns.com/foaf/0.1/"');
      expect(rdfxml).toContain('xmlns:kg="http://example.org/kg#"');
    });

    test('should create Description elements for subjects', () => {
      const rdfxml = serializer.toRDFXML();
      
      expect(rdfxml).toContain('rdf:about="person1"');
      expect(rdfxml).toContain('rdf:about="belief1"');
    });

    test('should escape XML special characters', () => {
      kgEngine.addTriple('test1', 'prop:xml', '<tag>content & "quotes"</tag>');
      
      const rdfxml = serializer.toRDFXML();
      
      expect(rdfxml).toContain('&lt;tag&gt;');
      expect(rdfxml).toContain('&amp;');
      expect(rdfxml).toContain('&quot;');
    });

    test('should use prefixed property names', () => {
      const rdfxml = serializer.toRDFXML();
      
      expect(rdfxml).toContain('<rdf:type>');
      expect(rdfxml).toContain('<foaf:name>');
      expect(rdfxml).toContain('<kg:believes>');
    });
  });

  describe('Data Type Handling', () => {
    test('should detect and format literals correctly', () => {
      // Test the _isLiteral method indirectly
      kgEngine.addTriple('test1', 'prop:string', 'hello');
      kgEngine.addTriple('test1', 'prop:number', 42);
      kgEngine.addTriple('test1', 'prop:boolean', true);
      kgEngine.addTriple('test1', 'prop:object', 'object_id_123');
      
      const turtle = serializer.toTurtle();
      
      expect(turtle).toContain('"hello"');
      expect(turtle).toContain('"42"^^xsd:integer');
      expect(turtle).toContain('"true"^^xsd:boolean');
      expect(turtle).toContain('object_id_123'); // Should not be quoted
    });

    test('should handle decimal numbers', () => {
      kgEngine.addTriple('test1', 'prop:decimal', 3.14159);
      
      const turtle = serializer.toTurtle();
      expect(turtle).toContain('"3.14159"^^xsd:decimal');
    });

    test('should handle zero values', () => {
      kgEngine.addTriple('test1', 'prop:zero', 0);
      kgEngine.addTriple('test1', 'prop:false', false);
      
      const turtle = serializer.toTurtle();
      expect(turtle).toContain('"0"^^xsd:integer');
      expect(turtle).toContain('"false"^^xsd:boolean');
    });

    test('should handle empty strings', () => {
      kgEngine.addTriple('test1', 'prop:empty', '');
      
      const turtle = serializer.toTurtle();
      expect(turtle).toContain('""');
    });
  });

  describe('Edge Cases', () => {
    test('should handle subjects with special characters', () => {
      kgEngine.addTriple('subject-with-dashes', 'prop:test', 'value');
      kgEngine.addTriple('subject_with_underscores', 'prop:test', 'value');
      
      const turtle = serializer.toTurtle();
      expect(turtle).toContain('subject-with-dashes');
      expect(turtle).toContain('subject_with_underscores');
    });

    test('should handle predicates with special characters', () => {
      kgEngine.addTriple('test1', 'http://example.com/prop-with-dashes', 'value');
      
      const turtle = serializer.toTurtle();
      expect(turtle).toContain('<http://example.com/prop-with-dashes>');
    });

    test('should handle very long strings', () => {
      const longString = 'a'.repeat(1000);
      kgEngine.addTriple('test1', 'prop:long', longString);
      
      const turtle = serializer.toTurtle();
      expect(turtle).toContain(`"${longString}"`);
    });

    test('should handle Unicode characters', () => {
      kgEngine.addTriple('test1', 'prop:unicode', 'Hello 世界 🌍');
      
      const turtle = serializer.toTurtle();
      expect(turtle).toContain('"Hello 世界 🌍"');
    });

    test('should handle null and undefined values gracefully', async () => {
      // These shouldn't normally happen, but test robustness
      await kgEngine.addTriple('test1', 'prop:null', null);
      await kgEngine.addTriple('test1', 'prop:undefined', undefined);

      const turtle = serializer.toTurtle();
      expect(turtle).toContain('"null"');
      expect(turtle).toContain('"undefined"');
    });
  });

  describe('Performance', () => {
    test('should handle large datasets efficiently', () => {
      // Add 1000 triples
      for (let i = 0; i < 1000; i++) {
        kgEngine.addTriple(`subject${i}`, `predicate${i}`, `object${i}`);
      }
      
      const startTime = performance.now();
      const turtle = serializer.toTurtle();
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in less than 1 second
      expect(turtle.length).toBeGreaterThan(10000); // Should generate substantial output
    });

    test('should handle JSON-LD generation efficiently', () => {
      // Add many triples for same subject
      for (let i = 0; i < 100; i++) {
        kgEngine.addTriple('subject1', `prop${i}`, `value${i}`);
      }
      
      const startTime = performance.now();
      const jsonld = serializer.toJsonLD();
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
      expect(jsonld['@graph']).toBeDefined();
    });
  });

  describe('Format Consistency', () => {
    test('should produce consistent output across formats', () => {
      const turtle = serializer.toTurtle();
      const ntriples = serializer.toNTriples();
      const jsonld = serializer.toJsonLD();
      const rdfxml = serializer.toRDFXML();
      
      // All formats should represent the same data
      expect(turtle).toContain('person1');
      expect(ntriples).toContain('person1');
      expect(JSON.stringify(jsonld)).toContain('person1');
      expect(rdfxml).toContain('person1');
      
      expect(turtle).toContain('John Doe');
      expect(ntriples).toContain('John Doe');
      expect(JSON.stringify(jsonld)).toContain('John Doe');
      expect(rdfxml).toContain('John Doe');
    });

    test('should handle same data types consistently', () => {
      kgEngine.addTriple('test1', 'prop:number', 42);
      
      const turtle = serializer.toTurtle();
      const ntriples = serializer.toNTriples();
      const jsonld = serializer.toJsonLD();
      
      // Number should be handled consistently
      expect(turtle).toContain('42');
      expect(ntriples).toContain('42');
      
      const testObj = jsonld['@graph'].find(item => item['@id'] === 'test1');
      expect(testObj['prop:number']).toBe(42);
    });
  });

  describe('Integration with NamespaceManager', () => {
    test('should use custom prefixes', () => {
      namespaceManager.addPrefix('custom', 'http://custom.example.com/');
      kgEngine.addTriple('test1', 'custom:property', 'value');
      
      const turtle = serializer.toTurtle();
      expect(turtle).toContain('@prefix custom: <http://custom.example.com/> .');
      expect(turtle).toContain('custom:property');
    });

    test('should handle prefix changes', () => {
      namespaceManager.addPrefix('temp', 'http://temp.example.com/');
      kgEngine.addTriple('test1', 'temp:prop', 'value1');
      
      // Change the prefix
      namespaceManager.addPrefix('temp', 'http://newtemp.example.com/');
      kgEngine.addTriple('test2', 'temp:prop', 'value2');
      
      const turtle = serializer.toTurtle();
      expect(turtle).toContain('@prefix temp: <http://newtemp.example.com/> .');
    });
  });
});
