/**
 * Manages RDF namespaces and prefixes
 * 
 * Provides namespace management for RDF operations including:
 * - CURIE expansion (prefix:localName → full URI)
 * - URI contraction (full URI → prefix:localName)
 * - Standard RDF/RDFS/OWL/XSD namespaces pre-configured
 * - Common vocabularies (FOAF, Schema.org) pre-configured
 * - Turtle prefix declaration generation
 */
export class NamespaceManager {
  constructor() {
    // Standard RDF namespaces
    this.prefixes = new Map([
      ['rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'],
      ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#'],
      ['owl', 'http://www.w3.org/2002/07/owl#'],
      ['xsd', 'http://www.w3.org/2001/XMLSchema#'],
      // Common vocabularies
      ['foaf', 'http://xmlns.com/foaf/0.1/'],
      ['schema', 'https://schema.org/'],
      ['dc', 'http://purl.org/dc/elements/1.1/']
    ]);
    
    // Reverse mapping for URI contraction
    this.reversePrefixes = new Map();
    this._buildReversePrefixes();
  }

  /**
   * Add or update a namespace prefix
   * @param {string} prefix - The prefix (e.g., 'ex')
   * @param {string} namespace - The full namespace URI (e.g., 'http://example.org/')
   * @throws {Error} If prefix or namespace is invalid
   */
  addNamespace(prefix, namespace) {
    // Validate inputs
    if (!prefix || typeof prefix !== 'string') {
      throw new Error('Namespace prefix must be a non-empty string');
    }
    if (!namespace || typeof namespace !== 'string') {
      throw new Error('Namespace URI must be a non-empty string');
    }

    // Remove old reverse mapping if prefix existed
    const oldNamespace = this.prefixes.get(prefix);
    if (oldNamespace) {
      this.reversePrefixes.delete(oldNamespace);
    }
    
    // Add new mappings
    this.prefixes.set(prefix, namespace);
    this.reversePrefixes.set(namespace, prefix);
  }

  /**
   * Expand a CURIE (prefix:localName) to a full URI
   * @param {string} curie - The CURIE to expand (e.g., 'foaf:Person')
   * @returns {string} The full URI or original string if not a CURIE
   */
  expandPrefix(curie) {
    // Handle null/undefined
    if (curie === null || curie === undefined) {
      return curie;
    }

    // Handle non-string or empty string
    if (typeof curie !== 'string' || curie === '') {
      return curie;
    }

    // Check for colon (CURIE indicator)
    if (!curie.includes(':')) {
      return curie;
    }

    // Split at first colon only
    const colonIndex = curie.indexOf(':');
    const prefix = curie.substring(0, colonIndex);
    const localName = curie.substring(colonIndex + 1);
    
    // Lookup namespace
    const namespace = this.prefixes.get(prefix);
    
    // Return expanded URI or original if prefix not found
    return namespace ? namespace + localName : curie;
  }

  /**
   * Expand a CURIE (prefix:localName) to a full URI - alias for expandPrefix
   * @param {string} curie - The CURIE to expand (e.g., 'foaf:Person')
   * @returns {string} The full URI or original string if not a CURIE
   */
  expandURI(curie) {
    return this.expandPrefix(curie);
  }

  /**
   * Contract a full URI to a CURIE using the longest matching namespace
   * @param {string} uri - The full URI to contract
   * @returns {string} The CURIE or original URI if no namespace matches
   */
  contractUri(uri) {
    // Handle null/undefined
    if (uri === null || uri === undefined) {
      return uri;
    }

    // Handle non-string or empty string
    if (typeof uri !== 'string' || uri === '') {
      return uri;
    }
    
    // Find the longest matching namespace
    let longestMatch = '';
    let matchingPrefix = '';
    
    for (const [namespace, prefix] of this.reversePrefixes) {
      if (uri.startsWith(namespace) && namespace.length > longestMatch.length) {
        longestMatch = namespace;
        matchingPrefix = prefix;
      }
    }
    
    // Return contracted CURIE or original URI
    if (longestMatch) {
      return `${matchingPrefix}:${uri.substring(longestMatch.length)}`;
    }
    
    return uri;
  }

  /**
   * Get Turtle format prefix declarations for all namespaces
   * @returns {string} Turtle prefix declarations, one per line
   */
  getTurtlePrefixes() {
    return Array.from(this.prefixes.entries())
      .map(([prefix, namespace]) => `@prefix ${prefix}: <${namespace}> .`)
      .join('\n');
  }

  /**
   * Rebuild reverse prefix mappings (internal utility)
   * @private
   */
  _buildReversePrefixes() {
    this.reversePrefixes.clear();
    for (const [prefix, namespace] of this.prefixes) {
      this.reversePrefixes.set(namespace, prefix);
    }
  }
}