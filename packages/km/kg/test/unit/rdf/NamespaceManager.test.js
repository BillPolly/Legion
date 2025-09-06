import { NamespaceManager } from '../../../src/rdf/NamespaceManager.js';

describe('NamespaceManager', () => {
  let namespaceManager;

  beforeEach(() => {
    namespaceManager = new NamespaceManager();
  });

  describe('Default Prefixes', () => {
    test('should have standard RDF prefixes', () => {
      expect(namespaceManager.prefixes.get('rdf')).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
      expect(namespaceManager.prefixes.get('rdfs')).toBe('http://www.w3.org/2000/01/rdf-schema#');
      expect(namespaceManager.prefixes.get('owl')).toBe('http://www.w3.org/2002/07/owl#');
      expect(namespaceManager.prefixes.get('xsd')).toBe('http://www.w3.org/2001/XMLSchema#');
    });

    test('should have knowledge graph prefix', () => {
      expect(namespaceManager.prefixes.get('kg')).toBe('http://example.org/kg#');
    });

    test('should have common vocabulary prefixes', () => {
      expect(namespaceManager.prefixes.get('foaf')).toBe('http://xmlns.com/foaf/0.1/');
      expect(namespaceManager.prefixes.get('schema')).toBe('https://schema.org/');
    });

    test('should build reverse prefix mapping', () => {
      expect(namespaceManager.reversePrefixes.get('http://www.w3.org/1999/02/22-rdf-syntax-ns#')).toBe('rdf');
      expect(namespaceManager.reversePrefixes.get('http://example.org/kg#')).toBe('kg');
      expect(namespaceManager.reversePrefixes.get('https://schema.org/')).toBe('schema');
    });
  });

  describe('Prefix Management', () => {
    test('should add new prefix', () => {
      namespaceManager.addPrefix('ex', 'http://example.com/');
      
      expect(namespaceManager.prefixes.get('ex')).toBe('http://example.com/');
      expect(namespaceManager.reversePrefixes.get('http://example.com/')).toBe('ex');
    });

    test('should override existing prefix', () => {
      const originalKgNamespace = namespaceManager.prefixes.get('kg');
      expect(originalKgNamespace).toBe('http://example.org/kg#');
      
      namespaceManager.addPrefix('kg', 'http://mycompany.com/kg#');
      
      expect(namespaceManager.prefixes.get('kg')).toBe('http://mycompany.com/kg#');
      expect(namespaceManager.reversePrefixes.get('http://mycompany.com/kg#')).toBe('kg');
      expect(namespaceManager.reversePrefixes.has(originalKgNamespace)).toBe(false);
    });

    test('should handle multiple prefixes for same namespace', () => {
      namespaceManager.addPrefix('ex1', 'http://example.com/');
      namespaceManager.addPrefix('ex2', 'http://example.com/');
      
      // Last one wins in reverse mapping
      expect(namespaceManager.reversePrefixes.get('http://example.com/')).toBe('ex2');
      expect(namespaceManager.prefixes.get('ex1')).toBe('http://example.com/');
      expect(namespaceManager.prefixes.get('ex2')).toBe('http://example.com/');
    });

    test('should handle empty prefix', () => {
      namespaceManager.addPrefix('', 'http://default.example.com/');
      
      expect(namespaceManager.prefixes.get('')).toBe('http://default.example.com/');
      expect(namespaceManager.reversePrefixes.get('http://default.example.com/')).toBe('');
    });

    test('should handle special characters in prefix', () => {
      namespaceManager.addPrefix('my-prefix', 'http://example.com/my-namespace#');
      namespaceManager.addPrefix('my_prefix', 'http://example.com/my_namespace#');
      
      expect(namespaceManager.prefixes.get('my-prefix')).toBe('http://example.com/my-namespace#');
      expect(namespaceManager.prefixes.get('my_prefix')).toBe('http://example.com/my_namespace#');
    });
  });

  describe('Prefix Expansion', () => {
    test('should expand known prefixes', () => {
      expect(namespaceManager.expandPrefix('rdf:type')).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
      expect(namespaceManager.expandPrefix('kg:believes')).toBe('http://example.org/kg#believes');
      expect(namespaceManager.expandPrefix('foaf:name')).toBe('http://xmlns.com/foaf/0.1/name');
    });

    test('should handle unknown prefixes', () => {
      expect(namespaceManager.expandPrefix('unknown:property')).toBe('unknown:property');
      expect(namespaceManager.expandPrefix('xyz:test')).toBe('xyz:test');
    });

    test('should handle URIs without prefixes', () => {
      expect(namespaceManager.expandPrefix('http://example.com/property')).toBe('http://example.com/property');
      expect(namespaceManager.expandPrefix('https://schema.org/name')).toBe('https://schema.org/name');
    });

    test('should handle strings without colons', () => {
      expect(namespaceManager.expandPrefix('simpleProperty')).toBe('simpleProperty');
      expect(namespaceManager.expandPrefix('name')).toBe('name');
    });

    test('should handle empty strings', () => {
      expect(namespaceManager.expandPrefix('')).toBe('');
    });

    test('should handle multiple colons', () => {
      expect(namespaceManager.expandPrefix('rdf:type:subtype')).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#type:subtype');
    });

    test('should handle custom prefixes', () => {
      namespaceManager.addPrefix('custom', 'http://custom.example.com/');
      
      expect(namespaceManager.expandPrefix('custom:property')).toBe('http://custom.example.com/property');
      expect(namespaceManager.expandPrefix('custom:nested:property')).toBe('http://custom.example.com/nested:property');
    });
  });

  describe('URI Contraction', () => {
    test('should contract known URIs', () => {
      expect(namespaceManager.contractUri('http://www.w3.org/1999/02/22-rdf-syntax-ns#type')).toBe('rdf:type');
      expect(namespaceManager.contractUri('http://example.org/kg#believes')).toBe('kg:believes');
      expect(namespaceManager.contractUri('http://xmlns.com/foaf/0.1/name')).toBe('foaf:name');
    });

    test('should handle unknown URIs', () => {
      const unknownUri = 'http://unknown.example.com/property';
      expect(namespaceManager.contractUri(unknownUri)).toBe(unknownUri);
    });

    test('should handle partial matches', () => {
      // Should not contract if URI doesn't start with namespace
      expect(namespaceManager.contractUri('http://example.org/kg')).toBe('http://example.org/kg');
      expect(namespaceManager.contractUri('http://example.org/different#property')).toBe('http://example.org/different#property');
    });

    test('should handle empty local names', () => {
      expect(namespaceManager.contractUri('http://example.org/kg#')).toBe('kg:');
      expect(namespaceManager.contractUri('http://www.w3.org/1999/02/22-rdf-syntax-ns#')).toBe('rdf:');
    });

    test('should handle custom prefixes', () => {
      namespaceManager.addPrefix('custom', 'http://custom.example.com/');
      
      expect(namespaceManager.contractUri('http://custom.example.com/property')).toBe('custom:property');
      expect(namespaceManager.contractUri('http://custom.example.com/nested/property')).toBe('custom:nested/property');
    });

    test('should prefer longer namespace matches', () => {
      namespaceManager.addPrefix('base', 'http://example.com/');
      namespaceManager.addPrefix('extended', 'http://example.com/extended/');
      
      expect(namespaceManager.contractUri('http://example.com/extended/property')).toBe('extended:property');
      expect(namespaceManager.contractUri('http://example.com/property')).toBe('base:property');
    });
  });

  describe('Turtle Prefix Generation', () => {
    test('should generate turtle prefix declarations', () => {
      const turtlePrefixes = namespaceManager.getTurtlePrefixes();
      
      expect(turtlePrefixes).toContain('@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .');
      expect(turtlePrefixes).toContain('@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .');
      expect(turtlePrefixes).toContain('@prefix kg: <http://example.org/kg#> .');
      expect(turtlePrefixes).toContain('@prefix foaf: <http://xmlns.com/foaf/0.1/> .');
    });

    test('should include custom prefixes in turtle output', () => {
      namespaceManager.addPrefix('custom', 'http://custom.example.com/');
      
      const turtlePrefixes = namespaceManager.getTurtlePrefixes();
      expect(turtlePrefixes).toContain('@prefix custom: <http://custom.example.com/> .');
    });

    test('should handle empty prefix in turtle output', () => {
      namespaceManager.addPrefix('', 'http://default.example.com/');
      
      const turtlePrefixes = namespaceManager.getTurtlePrefixes();
      expect(turtlePrefixes).toContain('@prefix : <http://default.example.com/> .');
    });

    test('should generate valid turtle syntax', () => {
      const turtlePrefixes = namespaceManager.getTurtlePrefixes();
      const lines = turtlePrefixes.split('\n');
      
      lines.forEach(line => {
        if (line.trim()) {
          expect(line).toMatch(/^@prefix \w*: <[^>]+> \.$/);
        }
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle null and undefined inputs', () => {
      expect(namespaceManager.expandPrefix(null)).toBe(null);
      expect(namespaceManager.expandPrefix(undefined)).toBe(undefined);
      expect(namespaceManager.contractUri(null)).toBe(null);
      expect(namespaceManager.contractUri(undefined)).toBe(undefined);
    });

    test('should handle very long URIs', () => {
      const longNamespace = 'http://very.long.example.com/' + 'a'.repeat(1000) + '/';
      const longLocalName = 'b'.repeat(1000);
      const longUri = longNamespace + longLocalName;
      
      namespaceManager.addPrefix('long', longNamespace);
      
      expect(namespaceManager.expandPrefix(`long:${longLocalName}`)).toBe(longUri);
      expect(namespaceManager.contractUri(longUri)).toBe(`long:${longLocalName}`);
    });

    test('should handle special characters in URIs', () => {
      const specialNamespace = 'http://example.com/special-chars_123/';
      const specialLocalName = 'property-with_special.chars';
      
      namespaceManager.addPrefix('special', specialNamespace);
      
      expect(namespaceManager.expandPrefix(`special:${specialLocalName}`)).toBe(specialNamespace + specialLocalName);
      expect(namespaceManager.contractUri(specialNamespace + specialLocalName)).toBe(`special:${specialLocalName}`);
    });

    test('should handle Unicode characters', () => {
      const unicodeNamespace = 'http://example.com/unicode/';
      const unicodeLocalName = 'property_with_unicode_字符';
      
      namespaceManager.addPrefix('unicode', unicodeNamespace);
      
      expect(namespaceManager.expandPrefix(`unicode:${unicodeLocalName}`)).toBe(unicodeNamespace + unicodeLocalName);
      expect(namespaceManager.contractUri(unicodeNamespace + unicodeLocalName)).toBe(`unicode:${unicodeLocalName}`);
    });

    test('should handle URL encoded characters', () => {
      const encodedNamespace = 'http://example.com/encoded%20space/';
      const encodedLocalName = 'property%20with%20spaces';
      
      namespaceManager.addPrefix('encoded', encodedNamespace);
      
      expect(namespaceManager.expandPrefix(`encoded:${encodedLocalName}`)).toBe(encodedNamespace + encodedLocalName);
      expect(namespaceManager.contractUri(encodedNamespace + encodedLocalName)).toBe(`encoded:${encodedLocalName}`);
    });
  });

  describe('Performance', () => {
    test('should handle many prefixes efficiently', () => {
      const startTime = performance.now();
      
      // Add 1000 prefixes
      for (let i = 0; i < 1000; i++) {
        namespaceManager.addPrefix(`prefix${i}`, `http://example${i}.com/`);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
      expect(namespaceManager.prefixes.size).toBe(1007); // 7 default + 1000 added
    });

    test('should handle many expansions efficiently', () => {
      // Add some prefixes
      for (let i = 0; i < 100; i++) {
        namespaceManager.addPrefix(`prefix${i}`, `http://example${i}.com/`);
      }
      
      const startTime = performance.now();
      
      // Perform 1000 expansions
      for (let i = 0; i < 1000; i++) {
        const prefixIndex = i % 100;
        namespaceManager.expandPrefix(`prefix${prefixIndex}:property${i}`);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
    });

    test('should handle many contractions efficiently', () => {
      // Add some prefixes
      for (let i = 0; i < 100; i++) {
        namespaceManager.addPrefix(`prefix${i}`, `http://example${i}.com/`);
      }
      
      const startTime = performance.now();
      
      // Perform 1000 contractions
      for (let i = 0; i < 1000; i++) {
        const prefixIndex = i % 100;
        namespaceManager.contractUri(`http://example${prefixIndex}.com/property${i}`);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Integration Scenarios', () => {
    test('should support round-trip expansion and contraction', () => {
      const testCases = [
        'rdf:type',
        'kg:believes',
        'foaf:name',
        'schema:Person'
      ];
      
      testCases.forEach(curie => {
        const expanded = namespaceManager.expandPrefix(curie);
        const contracted = namespaceManager.contractUri(expanded);
        expect(contracted).toBe(curie);
      });
    });

    test('should support custom namespace round-trips', () => {
      namespaceManager.addPrefix('myapp', 'http://myapp.example.com/ontology#');
      
      const testCases = [
        'myapp:User',
        'myapp:hasPermission',
        'myapp:createdAt'
      ];
      
      testCases.forEach(curie => {
        const expanded = namespaceManager.expandPrefix(curie);
        const contracted = namespaceManager.contractUri(expanded);
        expect(contracted).toBe(curie);
      });
    });

    test('should work with knowledge graph triples', () => {
      const triples = [
        ['person1', 'rdf:type', 'foaf:Person'],
        ['person1', 'foaf:name', 'John Doe'],
        ['person1', 'kg:believes', 'belief1'],
        ['belief1', 'kg:confidence', '0.9']
      ];
      
      // Expand all prefixed values
      const expandedTriples = triples.map(([s, p, o]) => [
        s,
        namespaceManager.expandPrefix(p),
        namespaceManager.expandPrefix(o)
      ]);
      
      expect(expandedTriples[0][1]).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
      expect(expandedTriples[0][2]).toBe('http://xmlns.com/foaf/0.1/Person');
      expect(expandedTriples[1][1]).toBe('http://xmlns.com/foaf/0.1/name');
      expect(expandedTriples[2][1]).toBe('http://example.org/kg#believes');
      
      // Contract back
      const contractedTriples = expandedTriples.map(([s, p, o]) => [
        s,
        namespaceManager.contractUri(p),
        namespaceManager.contractUri(o)
      ]);
      
      expect(contractedTriples).toEqual(triples);
    });
  });
});
