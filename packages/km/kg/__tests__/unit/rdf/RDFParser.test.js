import { RDFParser } from '../../../src/rdf/RDFParser.js';
import { KGEngine } from '../../../src/core/KGEngine.js';
import { NamespaceManager } from '../../../src/rdf/NamespaceManager.js';

describe('RDFParser', () => {
  let kgEngine, namespaceManager, parser;

  beforeEach(() => {
    kgEngine = new KGEngine();
    namespaceManager = new NamespaceManager();
    parser = new RDFParser(kgEngine, namespaceManager);
  });

  describe('Constructor', () => {
    test('should initialize with KG engine and namespace manager', () => {
      expect(parser.kg).toBe(kgEngine);
      expect(parser.ns).toBe(namespaceManager);
    });

    test('should work with different engines and namespace managers', () => {
      const newEngine = new KGEngine();
      const newNS = new NamespaceManager();
      const newParser = new RDFParser(newEngine, newNS);
      
      expect(newParser.kg).toBe(newEngine);
      expect(newParser.ns).toBe(newNS);
    });
  });

  describe('Turtle Parsing', () => {
    test('should parse basic turtle format', () => {
      const turtle = `
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        person1 rdf:type foaf:Person .
        person1 foaf:name "John Doe" .
        person1 foaf:age "30"^^xsd:integer .
      `;

      parser.parseTurtle(turtle);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(3);
      expect(triples).toContainEqual(['person1', 'rdf:type', 'foaf:Person']);
      expect(triples).toContainEqual(['person1', 'foaf:name', 'John Doe']);
      expect(triples).toContainEqual(['person1', 'foaf:age', 30]);
    });

    test('should handle prefixes correctly', () => {
      const turtle = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:person1 foaf:name "Alice" .
      `;

      parser.parseTurtle(turtle);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(1);
      expect(triples[0]).toEqual(['ex:person1', 'foaf:name', 'Alice']);
    });

    test('should handle different data types', () => {
      const turtle = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:test ex:string "hello world" .
        ex:test ex:integer "42"^^xsd:integer .
        ex:test ex:decimal "3.14"^^xsd:decimal .
        ex:test ex:boolean "true"^^xsd:boolean .
      `;

      parser.parseTurtle(turtle);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(4);
      expect(triples).toContainEqual(['ex:test', 'ex:string', 'hello world']);
      expect(triples).toContainEqual(['ex:test', 'ex:integer', 42]);
      expect(triples).toContainEqual(['ex:test', 'ex:decimal', 3.14]);
      expect(triples).toContainEqual(['ex:test', 'ex:boolean', true]);
    });

    test('should handle URI resources', () => {
      const turtle = `
        @prefix ex: <http://example.org/> .
        
        ex:person1 ex:knows ex:person2 .
        <http://example.org/person3> ex:knows ex:person1 .
      `;

      parser.parseTurtle(turtle);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(2);
      expect(triples).toContainEqual(['ex:person1', 'ex:knows', 'ex:person2']);
      expect(triples).toContainEqual(['http://example.org/person3', 'ex:knows', 'ex:person1']);
    });

    test('should handle escaped strings', () => {
      const turtle = `
        @prefix ex: <http://example.org/> .
        
        ex:test ex:quote "He said \\"Hello\\"" .
        ex:test ex:newline "Line 1\\nLine 2" .
      `;

      parser.parseTurtle(turtle);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(2);
      expect(triples).toContainEqual(['ex:test', 'ex:quote', 'He said "Hello"']);
      expect(triples).toContainEqual(['ex:test', 'ex:newline', 'Line 1\nLine 2']);
    });

    test('should handle comments and whitespace', () => {
      const turtle = `
        # This is a comment
        @prefix ex: <http://example.org/> .
        
        # Another comment
        ex:person1 ex:name "John" .  # End of line comment
        
        ex:person1 ex:age "25" .
      `;

      parser.parseTurtle(turtle);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(2);
      expect(triples).toContainEqual(['ex:person1', 'ex:name', 'John']);
      expect(triples).toContainEqual(['ex:person1', 'ex:age', 25]);
    });

    test('should handle empty turtle document', () => {
      const turtle = `
        @prefix ex: <http://example.org/> .
        # Just prefixes, no triples
      `;

      parser.parseTurtle(turtle);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(0);
    });
  });

  describe('N-Triples Parsing', () => {
    test('should parse basic N-Triples format', () => {
      const ntriples = `
        <http://example.org/person1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://xmlns.com/foaf/0.1/Person> .
        <http://example.org/person1> <http://xmlns.com/foaf/0.1/name> "John Doe" .
        <http://example.org/person1> <http://xmlns.com/foaf/0.1/age> "30"^^<http://www.w3.org/2001/XMLSchema#integer> .
      `;

      parser.parseNTriples(ntriples);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(3);
      expect(triples).toContainEqual(['http://example.org/person1', 'rdf:type', 'foaf:Person']);
      expect(triples).toContainEqual(['http://example.org/person1', 'foaf:name', 'John Doe']);
      expect(triples).toContainEqual(['http://example.org/person1', 'foaf:age', 30]);
    });

    test('should handle different literal types', () => {
      const ntriples = `
        <http://example.org/test> <http://example.org/string> "hello world" .
        <http://example.org/test> <http://example.org/integer> "42"^^<http://www.w3.org/2001/XMLSchema#integer> .
        <http://example.org/test> <http://example.org/decimal> "3.14"^^<http://www.w3.org/2001/XMLSchema#decimal> .
        <http://example.org/test> <http://example.org/boolean> "true"^^<http://www.w3.org/2001/XMLSchema#boolean> .
      `;

      parser.parseNTriples(ntriples);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(4);
      expect(triples).toContainEqual(['http://example.org/test', 'http://example.org/string', 'hello world']);
      expect(triples).toContainEqual(['http://example.org/test', 'http://example.org/integer', 42]);
      expect(triples).toContainEqual(['http://example.org/test', 'http://example.org/decimal', 3.14]);
      expect(triples).toContainEqual(['http://example.org/test', 'http://example.org/boolean', true]);
    });

    test('should handle escaped strings in N-Triples', () => {
      const ntriples = `
        <http://example.org/test> <http://example.org/quote> "He said \\"Hello\\"" .
        <http://example.org/test> <http://example.org/newline> "Line 1\\nLine 2" .
      `;

      parser.parseNTriples(ntriples);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(2);
      expect(triples).toContainEqual(['http://example.org/test', 'http://example.org/quote', 'He said "Hello"']);
      expect(triples).toContainEqual(['http://example.org/test', 'http://example.org/newline', 'Line 1\nLine 2']);
    });

    test('should handle comments in N-Triples', () => {
      const ntriples = `
        # This is a comment
        <http://example.org/person1> <http://xmlns.com/foaf/0.1/name> "John" .
        # Another comment
        <http://example.org/person1> <http://xmlns.com/foaf/0.1/age> "25"^^<http://www.w3.org/2001/XMLSchema#integer> .
      `;

      parser.parseNTriples(ntriples);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(2);
      expect(triples).toContainEqual(['http://example.org/person1', 'foaf:name', 'John']);
      expect(triples).toContainEqual(['http://example.org/person1', 'foaf:age', 25]);
    });

    test('should handle empty N-Triples document', () => {
      const ntriples = `
        # Just comments, no triples
      `;

      parser.parseNTriples(ntriples);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(0);
    });
  });

  describe('JSON-LD Parsing', () => {
    test('should parse basic JSON-LD format', () => {
      const jsonld = {
        "@context": {
          "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
          "foaf": "http://xmlns.com/foaf/0.1/"
        },
        "@graph": [
          {
            "@id": "person1",
            "rdf:type": { "@id": "foaf:Person" },
            "foaf:name": "John Doe",
            "foaf:age": 30
          }
        ]
      };

      parser.parseJsonLD(jsonld);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(3);
      expect(triples).toContainEqual(['person1', 'rdf:type', 'foaf:Person']);
      expect(triples).toContainEqual(['person1', 'foaf:name', 'John Doe']);
      expect(triples).toContainEqual(['person1', 'foaf:age', 30]);
    });

    test('should handle multiple values for same property', () => {
      const jsonld = {
        "@context": {
          "foaf": "http://xmlns.com/foaf/0.1/"
        },
        "@graph": [
          {
            "@id": "person1",
            "foaf:knows": [
              { "@id": "person2" },
              { "@id": "person3" }
            ]
          }
        ]
      };

      parser.parseJsonLD(jsonld);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(2);
      expect(triples).toContainEqual(['person1', 'foaf:knows', 'person2']);
      expect(triples).toContainEqual(['person1', 'foaf:knows', 'person3']);
    });

    test('should handle different data types in JSON-LD', () => {
      const jsonld = {
        "@context": {
          "ex": "http://example.org/"
        },
        "@graph": [
          {
            "@id": "test1",
            "ex:string": "hello world",
            "ex:integer": 42,
            "ex:decimal": 3.14,
            "ex:boolean": true
          }
        ]
      };

      parser.parseJsonLD(jsonld);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(4);
      expect(triples).toContainEqual(['test1', 'ex:string', 'hello world']);
      expect(triples).toContainEqual(['test1', 'ex:integer', 42]);
      expect(triples).toContainEqual(['test1', 'ex:decimal', 3.14]);
      expect(triples).toContainEqual(['test1', 'ex:boolean', true]);
    });

    test('should handle object references in JSON-LD', () => {
      const jsonld = {
        "@context": {
          "foaf": "http://xmlns.com/foaf/0.1/",
          "kg": "http://example.org/kg#"
        },
        "@graph": [
          {
            "@id": "person1",
            "foaf:name": "John",
            "kg:believes": { "@id": "belief1" }
          },
          {
            "@id": "belief1",
            "kg:confidence": 0.9
          }
        ]
      };

      parser.parseJsonLD(jsonld);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(3);
      expect(triples).toContainEqual(['person1', 'foaf:name', 'John']);
      expect(triples).toContainEqual(['person1', 'kg:believes', 'belief1']);
      expect(triples).toContainEqual(['belief1', 'kg:confidence', 0.9]);
    });

    test('should handle empty JSON-LD document', () => {
      const jsonld = {
        "@context": {
          "ex": "http://example.org/"
        },
        "@graph": []
      };

      parser.parseJsonLD(jsonld);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(0);
    });

    test('should handle JSON-LD without @graph', () => {
      const jsonld = {
        "@context": {
          "foaf": "http://xmlns.com/foaf/0.1/"
        },
        "@id": "person1",
        "foaf:name": "John Doe"
      };

      parser.parseJsonLD(jsonld);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(1);
      expect(triples).toContainEqual(['person1', 'foaf:name', 'John Doe']);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed Turtle gracefully', () => {
      const malformedTurtle = `
        @prefix ex: <http://example.org/> .
        ex:person1 ex:name "John .  # Missing closing quote
      `;

      expect(() => parser.parseTurtle(malformedTurtle)).not.toThrow();
      
      // Should parse what it can
      const triples = kgEngine.query(null, null, null);
      expect(triples.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle malformed N-Triples gracefully', () => {
      const malformedNTriples = `
        <http://example.org/person1> <http://xmlns.com/foaf/0.1/name> "John .  # Missing closing quote
      `;

      expect(() => parser.parseNTriples(malformedNTriples)).not.toThrow();
      
      const triples = kgEngine.query(null, null, null);
      expect(triples.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle invalid JSON-LD gracefully', () => {
      const invalidJsonLD = {
        "@context": "not an object or string",
        "@graph": "not an array"
      };

      expect(() => parser.parseJsonLD(invalidJsonLD)).not.toThrow();
      
      const triples = kgEngine.query(null, null, null);
      expect(triples.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle null and undefined inputs', () => {
      expect(() => parser.parseTurtle(null)).not.toThrow();
      expect(() => parser.parseTurtle(undefined)).not.toThrow();
      expect(() => parser.parseNTriples(null)).not.toThrow();
      expect(() => parser.parseNTriples(undefined)).not.toThrow();
      expect(() => parser.parseJsonLD(null)).not.toThrow();
      expect(() => parser.parseJsonLD(undefined)).not.toThrow();
    });

    test('should handle empty strings', () => {
      expect(() => parser.parseTurtle('')).not.toThrow();
      expect(() => parser.parseNTriples('')).not.toThrow();
      expect(() => parser.parseJsonLD({})).not.toThrow();
    });
  });

  describe('Namespace Integration', () => {
    test('should register new prefixes from Turtle', () => {
      const turtle = `
        @prefix custom: <http://custom.example.com/> .
        @prefix another: <http://another.example.com/> .
        
        custom:test another:property "value" .
      `;

      parser.parseTurtle(turtle);

      expect(namespaceManager.prefixes.has('custom')).toBe(true);
      expect(namespaceManager.prefixes.has('another')).toBe(true);
      expect(namespaceManager.prefixes.get('custom')).toBe('http://custom.example.com/');
      expect(namespaceManager.prefixes.get('another')).toBe('http://another.example.com/');
    });

    test('should register new prefixes from JSON-LD context', () => {
      const jsonld = {
        "@context": {
          "custom": "http://custom.example.com/",
          "another": "http://another.example.com/"
        },
        "@graph": [
          {
            "@id": "test1",
            "custom:property": "value"
          }
        ]
      };

      parser.parseJsonLD(jsonld);

      expect(namespaceManager.prefixes.has('custom')).toBe(true);
      expect(namespaceManager.prefixes.has('another')).toBe(true);
      expect(namespaceManager.prefixes.get('custom')).toBe('http://custom.example.com/');
      expect(namespaceManager.prefixes.get('another')).toBe('http://another.example.com/');
    });

    test('should contract URIs using existing prefixes', () => {
      const ntriples = `
        <http://xmlns.com/foaf/0.1/person1> <http://xmlns.com/foaf/0.1/name> "John" .
      `;

      parser.parseNTriples(ntriples);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(1);
      expect(triples[0]).toEqual(['foaf:person1', 'foaf:name', 'John']);
    });
  });

  describe('Data Type Conversion', () => {
    test('should convert XSD types correctly', () => {
      const turtle = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:test ex:int "42"^^xsd:int .
        ex:test ex:long "9223372036854775807"^^xsd:long .
        ex:test ex:float "3.14"^^xsd:float .
        ex:test ex:double "2.718281828"^^xsd:double .
        ex:test ex:bool "false"^^xsd:boolean .
      `;

      parser.parseTurtle(turtle);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(5);
      expect(triples).toContainEqual(['ex:test', 'ex:int', 42]);
      expect(triples).toContainEqual(['ex:test', 'ex:long', 9223372036854775807]);
      expect(triples).toContainEqual(['ex:test', 'ex:float', 3.14]);
      expect(triples).toContainEqual(['ex:test', 'ex:double', 2.718281828]);
      expect(triples).toContainEqual(['ex:test', 'ex:bool', false]);
    });

    test('should handle string literals without type annotation', () => {
      const turtle = `
        @prefix ex: <http://example.org/> .
        
        ex:test ex:plain "just a string" .
        ex:test ex:quoted "string with \\"quotes\\"" .
      `;

      parser.parseTurtle(turtle);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(2);
      expect(triples).toContainEqual(['ex:test', 'ex:plain', 'just a string']);
      expect(triples).toContainEqual(['ex:test', 'ex:quoted', 'string with "quotes"']);
    });

    test('should handle numeric literals without type annotation', () => {
      const turtle = `
        @prefix ex: <http://example.org/> .
        
        ex:test ex:integer 42 .
        ex:test ex:decimal 3.14 .
      `;

      parser.parseTurtle(turtle);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(2);
      expect(triples).toContainEqual(['ex:test', 'ex:integer', 42]);
      expect(triples).toContainEqual(['ex:test', 'ex:decimal', 3.14]);
    });
  });

  describe('Performance', () => {
    test('should handle large Turtle documents efficiently', () => {
      let turtle = '@prefix ex: <http://example.org/> .\n';
      
      // Generate 1000 triples
      for (let i = 0; i < 1000; i++) {
        turtle += `ex:subject${i} ex:predicate${i} "object${i}" .\n`;
      }

      const startTime = performance.now();
      parser.parseTurtle(turtle);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete in less than 1 second
      
      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(1000);
    });

    test('should handle large JSON-LD documents efficiently', () => {
      const jsonld = {
        "@context": {
          "ex": "http://example.org/"
        },
        "@graph": []
      };

      // Generate 1000 objects
      for (let i = 0; i < 1000; i++) {
        jsonld["@graph"].push({
          "@id": `subject${i}`,
          [`ex:property${i}`]: `value${i}`
        });
      }

      const startTime = performance.now();
      parser.parseJsonLD(jsonld);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete in less than 1 second
      
      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(1000);
    });
  });

  describe('Edge Cases', () => {
    test('should handle Unicode characters', () => {
      const turtle = `
        @prefix ex: <http://example.org/> .
        
        ex:test ex:unicode "Hello 世界 🌍" .
        ex:test ex:emoji "😀😃😄😁" .
      `;

      parser.parseTurtle(turtle);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(2);
      expect(triples).toContainEqual(['ex:test', 'ex:unicode', 'Hello 世界 🌍']);
      expect(triples).toContainEqual(['ex:test', 'ex:emoji', '😀😃😄😁']);
    });

    test('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      const turtle = `
        @prefix ex: <http://example.org/> .
        
        ex:test ex:longString "${longString}" .
      `;

      parser.parseTurtle(turtle);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(1);
      expect(triples[0][2]).toBe(longString);
    });

    test('should handle special characters in URIs', () => {
      const turtle = `
        @prefix ex: <http://example.org/> .
        
        <http://example.org/subject-with-dashes> ex:property "value" .
        <http://example.org/subject_with_underscores> ex:property "value" .
        <http://example.org/subject%20with%20spaces> ex:property "value" .
      `;

      parser.parseTurtle(turtle);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(3);
      expect(triples.some(t => t[0] === 'http://example.org/subject-with-dashes')).toBe(true);
      expect(triples.some(t => t[0] === 'http://example.org/subject_with_underscores')).toBe(true);
      expect(triples.some(t => t[0] === 'http://example.org/subject%20with%20spaces')).toBe(true);
    });

    test('should handle blank nodes', () => {
      const turtle = `
        @prefix ex: <http://example.org/> .
        
        _:blank1 ex:property "value1" .
        _:blank2 ex:property "value2" .
        ex:subject ex:references _:blank1 .
      `;

      parser.parseTurtle(turtle);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(3);
      expect(triples.some(t => t[0].startsWith('_:blank'))).toBe(true);
      expect(triples.some(t => t[2].startsWith('_:blank'))).toBe(true);
    });
  });

  describe('Integration with KG Engine', () => {
    test('should add triples to existing KG data', () => {
      // Add some initial data
      kgEngine.addTriple('existing1', 'ex:property', 'value1');
      
      const turtle = `
        @prefix ex: <http://example.org/> .
        
        ex:new1 ex:property "value2" .
      `;

      parser.parseTurtle(turtle);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(2);
      expect(triples).toContainEqual(['existing1', 'ex:property', 'value1']);
      expect(triples).toContainEqual(['ex:new1', 'ex:property', 'value2']);
    });

    test('should not duplicate existing triples', () => {
      // Add initial triple
      kgEngine.addTriple('subject1', 'ex:property', 'value1');
      
      const turtle = `
        @prefix ex: <http://example.org/> .
        
        subject1 ex:property "value1" .
        subject1 ex:property "value2" .
      `;

      parser.parseTurtle(turtle);

      const triples = kgEngine.query(null, null, null);
      expect(triples).toHaveLength(2);
      expect(triples).toContainEqual(['subject1', 'ex:property', 'value1']);
      expect(triples).toContainEqual(['subject1', 'ex:property', 'value2']);
    });
  });
});
