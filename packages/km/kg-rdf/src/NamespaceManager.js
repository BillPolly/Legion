/**
 * Manages RDF namespaces and prefixes
 */
export class NamespaceManager {
  constructor() {
    this.prefixes = new Map([
      ['rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'],
      ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#'],
      ['owl', 'http://www.w3.org/2002/07/owl#'],
      ['xsd', 'http://www.w3.org/2001/XMLSchema#'],
      ['kg', 'http://example.org/kg#'],
      ['foaf', 'http://xmlns.com/foaf/0.1/'],
      ['schema', 'https://schema.org/']
    ]);
    this.reversePrefixes = new Map();
    this._buildReversePrefixes();
  }

  addPrefix(prefix, namespace) {
    // Remove old reverse mapping if prefix existed
    const oldNamespace = this.prefixes.get(prefix);
    if (oldNamespace) {
      this.reversePrefixes.delete(oldNamespace);
    }
    
    this.prefixes.set(prefix, namespace);
    this.reversePrefixes.set(namespace, prefix);
  }

  expandPrefix(curie) {
    if (!curie || typeof curie !== 'string' || !curie.includes(':')) return curie;
    const colonIndex = curie.indexOf(':');
    const prefix = curie.substring(0, colonIndex);
    const localName = curie.substring(colonIndex + 1);
    const namespace = this.prefixes.get(prefix);
    return namespace ? namespace + localName : curie;
  }

  contractUri(uri) {
    if (!uri || typeof uri !== 'string') return uri;
    
    // Find the longest matching namespace
    let longestMatch = '';
    let matchingPrefix = '';
    
    for (const [namespace, prefix] of this.reversePrefixes) {
      if (uri.startsWith(namespace) && namespace.length > longestMatch.length) {
        longestMatch = namespace;
        matchingPrefix = prefix;
      }
    }
    
    if (longestMatch) {
      return `${matchingPrefix}:${uri.substring(longestMatch.length)}`;
    }
    
    return uri;
  }

  getTurtlePrefixes() {
    return Array.from(this.prefixes.entries())
      .map(([prefix, namespace]) => `@prefix ${prefix}: <${namespace}> .`)
      .join('\n');
  }

  _buildReversePrefixes() {
    this.reversePrefixes.clear();
    for (const [prefix, namespace] of this.prefixes) {
      this.reversePrefixes.set(namespace, prefix);
    }
  }
}
