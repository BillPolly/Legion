/**
 * Unit tests for NamespaceManager
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { NamespaceManager } from '../../src/NamespaceManager.js';

describe('NamespaceManager', () => {
  let manager;

  beforeEach(() => {
    manager = new NamespaceManager();
  });

  describe('Constructor and built-in namespaces', () => {
    it('should initialize with standard RDF namespaces', () => {
      expect(manager.expandPrefix('rdf:type')).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
      expect(manager.expandPrefix('rdfs:label')).toBe('http://www.w3.org/2000/01/rdf-schema#label');
      expect(manager.expandPrefix('owl:Class')).toBe('http://www.w3.org/2002/07/owl#Class');
      expect(manager.expandPrefix('xsd:string')).toBe('http://www.w3.org/2001/XMLSchema#string');
    });

    it('should initialize with common vocabulary namespaces', () => {
      expect(manager.expandPrefix('foaf:Person')).toBe('http://xmlns.com/foaf/0.1/Person');
      expect(manager.expandPrefix('schema:name')).toBe('https://schema.org/name');
    });
  });

  describe('addNamespace()', () => {
    it('should add a new namespace', () => {
      manager.addNamespace('ex', 'http://example.org/');
      expect(manager.expandPrefix('ex:test')).toBe('http://example.org/test');
    });

    it('should replace existing namespace prefix', () => {
      manager.addNamespace('test', 'http://test1.org/');
      expect(manager.expandPrefix('test:foo')).toBe('http://test1.org/foo');

      manager.addNamespace('test', 'http://test2.org/');
      expect(manager.expandPrefix('test:foo')).toBe('http://test2.org/foo');
    });

    it('should update reverse mapping when replacing prefix', () => {
      manager.addNamespace('test', 'http://test1.org/');
      expect(manager.contractUri('http://test1.org/foo')).toBe('test:foo');

      manager.addNamespace('test', 'http://test2.org/');
      expect(manager.contractUri('http://test2.org/foo')).toBe('test:foo');
      // Old namespace should no longer contract
      expect(manager.contractUri('http://test1.org/foo')).toBe('http://test1.org/foo');
    });

    it('should throw on invalid prefix', () => {
      expect(() => manager.addNamespace('', 'http://example.org/')).toThrow();
      expect(() => manager.addNamespace(null, 'http://example.org/')).toThrow();
      expect(() => manager.addNamespace(123, 'http://example.org/')).toThrow();
    });

    it('should throw on invalid namespace', () => {
      expect(() => manager.addNamespace('ex', '')).toThrow();
      expect(() => manager.addNamespace('ex', null)).toThrow();
      expect(() => manager.addNamespace('ex', 123)).toThrow();
    });
  });

  describe('expandPrefix()', () => {
    it('should expand CURIE to full URI', () => {
      manager.addNamespace('ex', 'http://example.org/');
      expect(manager.expandPrefix('ex:Person')).toBe('http://example.org/Person');
    });

    it('should handle local names with special characters', () => {
      manager.addNamespace('ex', 'http://example.org/');
      expect(manager.expandPrefix('ex:foo-bar')).toBe('http://example.org/foo-bar');
      expect(manager.expandPrefix('ex:foo_bar')).toBe('http://example.org/foo_bar');
      expect(manager.expandPrefix('ex:foo.bar')).toBe('http://example.org/foo.bar');
    });

    it('should return original string if no colon present', () => {
      expect(manager.expandPrefix('nocolon')).toBe('nocolon');
      expect(manager.expandPrefix('http://example.org/full')).toBe('http://example.org/full');
    });

    it('should return original string if prefix not found', () => {
      expect(manager.expandPrefix('unknown:term')).toBe('unknown:term');
    });

    it('should handle null and undefined', () => {
      expect(manager.expandPrefix(null)).toBe(null);
      expect(manager.expandPrefix(undefined)).toBe(undefined);
    });

    it('should handle empty string', () => {
      expect(manager.expandPrefix('')).toBe('');
    });

    it('should handle colons in local name', () => {
      manager.addNamespace('ex', 'http://example.org/');
      expect(manager.expandPrefix('ex:has:colon')).toBe('http://example.org/has:colon');
    });
  });

  describe('contractUri()', () => {
    it('should contract full URI to CURIE', () => {
      manager.addNamespace('ex', 'http://example.org/');
      expect(manager.contractUri('http://example.org/Person')).toBe('ex:Person');
    });

    it('should use longest matching namespace', () => {
      manager.addNamespace('ex', 'http://example.org/');
      manager.addNamespace('exvoc', 'http://example.org/vocab/');
      
      expect(manager.contractUri('http://example.org/vocab/Person')).toBe('exvoc:Person');
      expect(manager.contractUri('http://example.org/Person')).toBe('ex:Person');
    });

    it('should return original URI if no namespace matches', () => {
      expect(manager.contractUri('http://unknown.org/term')).toBe('http://unknown.org/term');
    });

    it('should handle null and undefined', () => {
      expect(manager.contractUri(null)).toBe(null);
      expect(manager.contractUri(undefined)).toBe(undefined);
    });

    it('should handle empty string', () => {
      expect(manager.contractUri('')).toBe('');
    });

    it('should handle URIs with fragments', () => {
      manager.addNamespace('ex', 'http://example.org/');
      expect(manager.contractUri('http://example.org/Person#alice')).toBe('ex:Person#alice');
    });
  });

  describe('getTurtlePrefixes()', () => {
    it('should return Turtle prefix declarations', () => {
      const prefixes = manager.getTurtlePrefixes();
      
      expect(prefixes).toContain('@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .');
      expect(prefixes).toContain('@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .');
      expect(prefixes).toContain('@prefix owl: <http://www.w3.org/2002/07/owl#> .');
      expect(prefixes).toContain('@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .');
      expect(prefixes).toContain('@prefix foaf: <http://xmlns.com/foaf/0.1/> .');
      expect(prefixes).toContain('@prefix schema: <https://schema.org/> .');
    });

    it('should include custom namespaces', () => {
      manager.addNamespace('ex', 'http://example.org/');
      const prefixes = manager.getTurtlePrefixes();
      
      expect(prefixes).toContain('@prefix ex: <http://example.org/> .');
    });

    it('should return each prefix on separate line', () => {
      const prefixes = manager.getTurtlePrefixes();
      const lines = prefixes.split('\n');
      
      expect(lines.length).toBeGreaterThan(0);
      lines.forEach(line => {
        expect(line).toMatch(/^@prefix \w+: <.+> \.$/);
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should support round-trip expand and contract', () => {
      manager.addNamespace('ex', 'http://example.org/');
      
      const curie = 'ex:Person';
      const expanded = manager.expandPrefix(curie);
      const contracted = manager.contractUri(expanded);
      
      expect(contracted).toBe(curie);
    });

    it('should handle multiple namespaces', () => {
      manager.addNamespace('ex1', 'http://example1.org/');
      manager.addNamespace('ex2', 'http://example2.org/');
      manager.addNamespace('ex3', 'http://example3.org/');
      
      expect(manager.expandPrefix('ex1:A')).toBe('http://example1.org/A');
      expect(manager.expandPrefix('ex2:B')).toBe('http://example2.org/B');
      expect(manager.expandPrefix('ex3:C')).toBe('http://example3.org/C');
      
      expect(manager.contractUri('http://example1.org/A')).toBe('ex1:A');
      expect(manager.contractUri('http://example2.org/B')).toBe('ex2:B');
      expect(manager.contractUri('http://example3.org/C')).toBe('ex3:C');
    });
  });
});