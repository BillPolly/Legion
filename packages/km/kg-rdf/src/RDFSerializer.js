/**
 * Serializes KG to various RDF formats
 */
export class RDFSerializer {
  constructor(kgEngine, namespaceManager) {
    this.kg = kgEngine;
    this.ns = namespaceManager;
  }

  /**
   * Export to Turtle format
   */
  toTurtle() {
    const triples = this.kg.query(null, null, null);
    const prefixes = this.ns.getTurtlePrefixes();
    
    const turtleTriples = triples
      .map(([s, p, o]) => this._formatTurtleTriple(s, p, o))
      .join('\n');

    return `${prefixes}\n\n${turtleTriples}`;
  }

  /**
   * Export to N-Triples format
   */
  toNTriples() {
    const triples = this.kg.query(null, null, null);
    return triples
      .map(([s, p, o]) => this._formatNTriple(s, p, o))
      .join('\n');
  }

  /**
   * Export to JSON-LD format
   */
  toJsonLD() {
    const triples = this.kg.query(null, null, null);
    const context = Object.fromEntries(this.ns.prefixes);
    const graph = {};

    // Group triples by subject
    triples.forEach(([s, p, o]) => {
      if (!graph[s]) {
        graph[s] = { '@id': s };
      }

      const property = this.ns.contractUri(p);
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
    });

    return {
      '@context': context,
      '@graph': Object.values(graph)
    };
  }

  /**
   * Export to RDF/XML format (simplified)
   */
  toRDFXML() {
    const triples = this.kg.query(null, null, null);
    const subjects = new Map();

    // Group by subject
    triples.forEach(([s, p, o]) => {
      if (!subjects.has(s)) {
        subjects.set(s, []);
      }
      subjects.get(s).push([p, o]);
    });

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<rdf:RDF';
    for (const [prefix, namespace] of this.ns.prefixes) {
      xml += ` xmlns:${prefix}="${namespace}"`;
    }
    xml += '>\n';

    for (const [subject, predicates] of subjects) {
      xml += `  <rdf:Description rdf:about="${subject}">\n`;
      for (const [predicate, object] of predicates) {
        const prop = this._xmlEscape(this.ns.contractUri(predicate));
        const value = this._xmlEscape(object);
        xml += `    <${prop}>${value}</${prop}>\n`;
      }
      xml += '  </rdf:Description>\n';
    }

    xml += '</rdf:RDF>';
    return xml;
  }

  // Helper methods
  _formatTurtleTriple(s, p, o) {
    const subject = this._formatTurtleResource(s);
    const predicate = this._formatTurtleResource(p);
    const object = this._formatTurtleValue(o);
    return `${subject} ${predicate} ${object} .`;
  }

  _formatNTriple(s, p, o) {
    const subject = this._formatNTriplesResource(s);
    const predicate = this._formatNTriplesResource(p);
    const object = this._formatNTriplesValue(o);
    return `${subject} ${predicate} ${object} .`;
  }

  _formatTurtleResource(resource) {
    if (!resource) return `"${resource}"`;
    
    const contracted = this.ns.contractUri(resource);
    // If it contracted to a prefixed form, use it without brackets
    if (contracted !== resource && contracted.includes(':')) {
      return contracted;
    }
    // If it starts with http, use angle brackets
    if (resource.startsWith('http')) {
      return `<${resource}>`;
    }
    // Otherwise, it's likely an ID, use as-is
    return resource;
  }

  _formatNTriplesResource(resource) {
    return `<${this.ns.expandPrefix(resource)}>`;
  }

  _formatTurtleValue(value) {
    if (this._isLiteral(value)) {
      return this._formatLiteral(value);
    }
    return this._formatTurtleResource(value);
  }

  _formatNTriplesValue(value) {
    if (this._isLiteral(value)) {
      return this._formatLiteral(value);
    }
    return this._formatNTriplesResource(value);
  }

  _formatJsonLDValue(value) {
    if (this._isLiteral(value)) {
      return this._parseLiteral(value);
    }
    return { '@id': value };
  }

  _formatLiteral(value) {
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 
        `"${value}"^^xsd:integer` : 
        `"${value}"^^xsd:decimal`;
    }
    if (typeof value === 'boolean') {
      return `"${value}"^^xsd:boolean`;
    }
    if (typeof value === 'string') {
      // Check if string represents a number
      if (/^-?\d+$/.test(value)) {
        return `"${value}"^^xsd:integer`;
      }
      if (/^-?\d*\.\d+$/.test(value)) {
        return `"${value}"^^xsd:decimal`;
      }
      // Check if string represents a boolean
      if (value === 'true' || value === 'false') {
        return `"${value}"^^xsd:boolean`;
      }
      // Regular string literal
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return `"${value}"`;
  }

  _parseLiteral(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      // Try to parse as number
      if (/^-?\d+$/.test(value)) {
        return parseInt(value, 10);
      }
      if (/^-?\d*\.\d+$/.test(value)) {
        return parseFloat(value);
      }
      // Try to parse as boolean
      if (value === 'true') return true;
      if (value === 'false') return false;
    }
    return value;
  }

  _isLiteral(value) {
    // Numbers and booleans are always literals
    if (typeof value === 'number' || typeof value === 'boolean') {
      return true;
    }
    
    // Strings that look like URIs or IDs are not literals
    if (typeof value === 'string') {
      // If it contains a colon (like rdf:type) or starts with http, it's not a literal
      if (value.includes(':') || value.startsWith('http')) {
        return false;
      }
      // Check if it looks like an ID (contains numbers and letters, possibly with underscores)
      if (/^[a-zA-Z][a-zA-Z0-9_]*[0-9]/.test(value) || 
          /^[a-zA-Z]+[0-9]+/.test(value) ||
          value.match(/^(person|belief|subject|object|test)\d*$/)) {
        return false;
      }
      // Otherwise it's a string literal
      return true;
    }
    
    return false;
  }

  _xmlEscape(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
