/**
 * Serializes triples to various RDF formats (Turtle, N-Triples, JSON-LD)
 * 
 * Integrates with NamespaceManager for URI expansion/contraction
 * and RDFTypeMapper for type-aware serialization of literals.
 * 
 * All operations are synchronous (no async/await).
 */

import { RDFTypeMapper } from './RDFTypeMapper.js';

export class RDFSerializer {
  /**
   * @param {Object} tripleStore - Triple store with query(s, p, o) method
   * @param {NamespaceManager} namespaceManager - Namespace manager for URI handling
   */
  constructor(tripleStore, namespaceManager) {
    if (!tripleStore || !tripleStore.query) {
      throw new Error('RDFSerializer requires a triple store with query() method');
    }
    if (!namespaceManager) {
      throw new Error('RDFSerializer requires a NamespaceManager');
    }
    
    this.tripleStore = tripleStore;
    this.namespaceManager = namespaceManager;
  }

  /**
   * Serialize to Turtle format
   * @returns {string} Turtle-formatted RDF
   */
  toTurtle() {
    const triples = this.tripleStore.query(null, null, null);
    const prefixes = this.namespaceManager.getTurtlePrefixes();
    
    const turtleTriples = triples
      .map(([s, p, o]) => this._formatTurtleTriple(s, p, o))
      .join('\n');

    return `${prefixes}\n\n${turtleTriples}`;
  }

  /**
   * Serialize to N-Triples format
   * @returns {string} N-Triples-formatted RDF
   */
  toNTriples() {
    const triples = this.tripleStore.query(null, null, null);
    return triples
      .map(([s, p, o]) => this._formatNTriple(s, p, o))
      .join('\n');
  }

  /**
   * Serialize to JSON-LD format
   * @returns {Object} JSON-LD object
   */
  toJsonLD() {
    const triples = this.tripleStore.query(null, null, null);
    
    // Build context from all registered namespaces
    const context = {};
    for (const [prefix, namespace] of this.namespaceManager.prefixes) {
      context[prefix] = namespace;
    }
    
    // Group triples by subject
    const graph = {};

    for (const [s, p, o] of triples) {
      if (!graph[s]) {
        graph[s] = { '@id': s };
      }

      // Keep property as CURIE
      const property = p;
      const value = this._formatJsonLDValue(o);

      if (graph[s][property]) {
        // Convert to array if multiple values
        if (!Array.isArray(graph[s][property])) {
          graph[s][property] = [graph[s][property]];
        }
        graph[s][property].push(value);
      } else {
        graph[s][property] = value;
      }
    }

    return {
      '@context': context,
      '@graph': Object.values(graph)
    };
  }

  // ===== Private Helper Methods =====

  /**
   * Format a triple in Turtle syntax
   * @private
   */
  _formatTurtleTriple(s, p, o) {
    const subject = this._formatTurtleResource(s);
    const predicate = this._formatTurtleResource(p);
    const object = this._formatTurtleValue(o);
    return `${subject} ${predicate} ${object} .`;
  }

  /**
   * Format a triple in N-Triples syntax
   * @private
   */
  _formatNTriple(s, p, o) {
    const subject = this._formatNTriplesResource(s);
    const predicate = this._formatNTriplesResource(p);
    const object = this._formatNTriplesValue(o);
    return `${subject} ${predicate} ${object} .`;
  }

  /**
   * Format resource for Turtle (as CURIE or <URI>)
   * @private
   */
  _formatTurtleResource(resource) {
    if (!resource) return `"${resource}"`;
    
    // If it's already a CURIE (contains :), use as-is
    if (resource.includes(':') && !resource.startsWith('http')) {
      return resource;
    }
    
    // If it's a full URI, try to contract it
    if (resource.startsWith('http')) {
      const contracted = this.namespaceManager.contractUri(resource);
      // If contraction succeeded (resulted in CURIE), use it
      if (contracted !== resource && contracted.includes(':')) {
        return contracted;
      }
      // Otherwise use angle brackets
      return `<${resource}>`;
    }
    
    // Otherwise, it's likely an ID, use as-is
    return resource;
  }

  /**
   * Format resource for N-Triples (always full URI in angle brackets)
   * @private
   */
  _formatNTriplesResource(resource) {
    const fullUri = this.namespaceManager.expandPrefix(resource);
    return `<${fullUri}>`;
  }

  /**
   * Format value (object) for Turtle
   * @private
   */
  _formatTurtleValue(value) {
    if (this._isLiteral(value)) {
      return this._formatLiteral(value, false);
    }
    return this._formatTurtleResource(value);
  }

  /**
   * Format value (object) for N-Triples
   * @private
   */
  _formatNTriplesValue(value) {
    if (this._isLiteral(value)) {
      return this._formatLiteral(value, true);
    }
    return this._formatNTriplesResource(value);
  }

  /**
   * Format value for JSON-LD
   * @private
   */
  _formatJsonLDValue(value) {
    // Preserve primitive types directly in JSON-LD
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    
    // Strings that are not URIs/CURIEs are literals
    if (typeof value === 'string' && !this._isResourceString(value)) {
      return value;
    }
    
    // Resource references (URIs/CURIEs) stay as strings in JSON-LD
    // The @context will define how they should be interpreted
    return value;
  }

  /**
   * Format literal value with type annotation
   * @private
   */
  _formatLiteral(value, forNTriples = false) {
    // Use RDFTypeMapper to convert JS type to RDF literal
    const rdfLiteral = RDFTypeMapper.jsTypeToRDF(value);
    
    // Format based on type
    if (rdfLiteral.datatype) {
      const typeUri = rdfLiteral.datatype;
      
      // For N-Triples, use full URI in angle brackets
      // For Turtle, use CURIE
      const typeSpec = forNTriples 
        ? `<${typeUri}>`
        : this.namespaceManager.contractUri(typeUri);
      
      // Only add type annotation for non-string types
      // Plain strings don't need ^^xsd:string annotation in RDF
      if (typeUri === 'http://www.w3.org/2001/XMLSchema#string') {
        return `"${this._escapeString(rdfLiteral.value)}"`;
      }
      
      return `"${rdfLiteral.value}"^^${typeSpec}`;
    }
    
    // Plain string literal - escape quotes
    return `"${this._escapeString(String(value))}"`;
  }

  /**
   * Escape special characters in string literals
   * @private
   */
  _escapeString(str) {
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * Check if value is a literal (not a resource reference)
   * @private
   */
  _isLiteral(value) {
    // Numbers and booleans are always literals
    if (typeof value === 'number' || typeof value === 'boolean') {
      return true;
    }
    
    // Check if string is a resource or literal
    if (typeof value === 'string') {
      return !this._isResourceString(value);
    }
    
    return false;
  }

  /**
   * Check if string value represents a resource (URI or CURIE)
   * @private
   */
  _isResourceString(value) {
    // Full URIs
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return true;
    }
    
    // CURIEs (prefix:localName)
    if (value.includes(':')) {
      return true;
    }
    
    // Otherwise it's a literal string
    return false;
  }
}