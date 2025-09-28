/**
 * Parses RDF formats (Turtle, N-Triples, JSON-LD) into triples
 * 
 * Integrates with NamespaceManager for URI expansion/contraction
 * and RDFTypeMapper for type-aware parsing of literals.
 * 
 * All operations are synchronous (no async/await).
 */

import { RDFTypeMapper } from './RDFTypeMapper.js';

export class RDFParser {
  /**
   * @param {Object} tripleStore - Triple store with add(s, p, o) method
   * @param {NamespaceManager} namespaceManager - Namespace manager for URI handling
   */
  constructor(tripleStore, namespaceManager) {
    if (!tripleStore || !tripleStore.add) {
      throw new Error('RDFParser requires a triple store with add() method');
    }
    if (!namespaceManager) {
      throw new Error('RDFParser requires a NamespaceManager');
    }
    
    this.tripleStore = tripleStore;
    this.namespaceManager = namespaceManager;
  }

  /**
   * Parse Turtle format RDF
   * @param {string} turtleString - Turtle format RDF data
   */
  parseTurtle(turtleString) {
    if (!turtleString) return;
    
    const lines = turtleString.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    let currentStatement = '';
    
    for (const line of lines) {
      if (line.startsWith('@prefix')) {
        this._parsePrefix(line);
        continue;
      }
      
      // Accumulate lines until we reach a statement terminator (.)
      currentStatement += ' ' + line;
      
      // Check if statement is complete (ends with .)
      const cleanStatement = this._removeInlineComments(currentStatement);
      if (cleanStatement && cleanStatement.trim().endsWith('.')) {
        // Parse the complete statement (may contain multiple triples with ; or ,)
        this._parseTurtleStatement(currentStatement);
        currentStatement = '';
      }
    }
  }

  /**
   * Parse N-Triples format RDF
   * @param {string} ntriplesString - N-Triples format RDF data
   */
  parseNTriples(ntriplesString) {
    if (!ntriplesString) return;
    
    const lines = ntriplesString.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    for (const line of lines) {
      if (line.endsWith(' .')) {
        this._parseNTriple(line);
      }
    }
  }

  /**
   * Parse JSON-LD format RDF
   * @param {Object|string} jsonldData - JSON-LD data as object or JSON string
   */
  parseJsonLD(jsonldData) {
    if (!jsonldData) return;
    
    // Parse string to object if needed
    if (typeof jsonldData === 'string') {
      jsonldData = JSON.parse(jsonldData);
    }

    // Build context mapping for property expansion
    // Maps short property names to full URIs
    const contextMap = new Map();
    if (jsonldData['@context']) {
      for (const [key, value] of Object.entries(jsonldData['@context'])) {
        if (typeof value === 'string') {
          // Check if value is a full URI or a prefix definition
          if (value.includes('://') || value.startsWith('http')) {
            // This is a property mapping: 'name' -> 'http://xmlns.com/foaf/0.1/name'
            contextMap.set(key, value);
            
            // Also extract namespace if possible for registration
            const lastSlash = value.lastIndexOf('/');
            const lastHash = value.lastIndexOf('#');
            const splitPoint = Math.max(lastSlash, lastHash);
            if (splitPoint > 0) {
              const namespace = value.substring(0, splitPoint + 1);
              // Try to find existing prefix for this namespace
              if (!this.namespaceManager.contractUri(namespace).includes(':')) {
                // No existing prefix, register with key if it looks like a prefix
                if (!contextMap.has(key) || key.length < 10) {
                  this.namespaceManager.addNamespace(key, namespace);
                }
              }
            }
          } else {
            // This is a namespace prefix definition: 'foaf' -> 'http://xmlns.com/foaf/0.1/'
            this.namespaceManager.addNamespace(key, value);
          }
        }
      }
    }

    // Handle @graph or treat as single entity
    const entities = jsonldData['@graph'] || [jsonldData];
    
    for (const entity of entities) {
      const subject = entity['@id'];
      if (!subject) continue;

      for (const [property, value] of Object.entries(entity)) {
        // Skip JSON-LD keywords
        if (property.startsWith('@')) continue;

        // Expand property name to full URI if mapped in context
        let fullProperty = property;
        if (contextMap.has(property)) {
          // Property is mapped to a full URI in @context
          fullProperty = contextMap.get(property);
        } else if (!property.includes('://') && !property.includes(':')) {
          // Unmapped short name without URI - keep as-is
          fullProperty = property;
        }
        
        // Contract the full URI to a CURIE
        const predicate = this.namespaceManager.contractUri(fullProperty);
        
        // Handle arrays for multi-valued properties
        const values = Array.isArray(value) ? value : [value];

        for (const val of values) {
          const object = this._parseJsonLDValue(val);
          this.tripleStore.add(subject, predicate, object);
        }
      }
    }
  }

  // ===== Private Helper Methods =====

  /**
   * Parse @prefix declaration in Turtle
   * @private
   */
  _parsePrefix(line) {
    const match = line.match(/@prefix\s+(\w+):\s+<([^>]+)>\s*\./);
    if (match) {
      const [, prefix, namespace] = match;
      this.namespaceManager.addNamespace(prefix, namespace);
    }
  }

  /**
   * Parse a complete Turtle statement (may contain multiple triples with ; or ,)
   * @private
   */
  _parseTurtleStatement(statement) {
    // Remove inline comments
    const cleanStatement = this._removeInlineComments(statement);
    if (!cleanStatement || !cleanStatement.trim().endsWith('.')) return;
    
    // Remove trailing period
    const withoutPeriod = cleanStatement.trim().slice(0, -1).trim();
    
    // Split by semicolon to get predicate-object groups
    // Semicolon means "same subject, different predicate"
    const predicateObjectGroups = this._splitBySemicolon(withoutPeriod);
    
    if (predicateObjectGroups.length === 0) return;
    
    // First group contains the subject
    const firstGroup = predicateObjectGroups[0].trim();
    const firstParts = this._parseTripleParts(firstGroup + ' .');
    
    if (firstParts.length < 3) return;
    
    const subject = firstParts[0].trim();
    const s = this._parseResource(subject);
    
    // Process first predicate-object pair(s)
    const firstPredicate = firstParts[1].trim();
    const p1 = this._parseResource(firstPredicate);
    
    // Handle comma-separated objects in first group
    const firstObjects = this._splitByComma(firstParts[2].trim());
    for (const obj of firstObjects) {
      const o = this._parseValue(obj.trim());
      this.tripleStore.add(s, p1, o);
    }
    
    // Process remaining predicate-object pairs (same subject)
    for (let i = 1; i < predicateObjectGroups.length; i++) {
      const group = predicateObjectGroups[i].trim();
      if (!group) continue;
      
      // Parse predicate and object(s)
      const parts = this._parseTripleParts(group + ' .');
      if (parts.length < 2) continue;
      
      const predicate = parts[0].trim();
      const p = this._parseResource(predicate);
      
      // Handle comma-separated objects (same subject and predicate)
      // Combine all remaining parts (in case object contains spaces)
      const objectsPart = parts.slice(1).join(' ').trim();
      const objects = this._splitByComma(objectsPart);
      
      for (const obj of objects) {
        const o = this._parseValue(obj.trim());
        this.tripleStore.add(s, p, o);
      }
    }
  }
  
  /**
   * Split Turtle statement by semicolon (respecting quotes and brackets)
   * @private
   */
  _splitBySemicolon(text) {
    const groups = [];
    let current = '';
    let inQuotes = false;
    let inAngleBrackets = false;
    let escaped = false;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        current += char;
        escaped = true;
        continue;
      }
      
      if (char === '"') {
        current += char;
        inQuotes = !inQuotes;
        continue;
      }
      
      if (char === '<') {
        current += char;
        inAngleBrackets = true;
        continue;
      }
      
      if (char === '>') {
        current += char;
        inAngleBrackets = false;
        continue;
      }
      
      if (!inQuotes && !inAngleBrackets && char === ';') {
        groups.push(current.trim());
        current = '';
        continue;
      }
      
      current += char;
    }
    
    if (current.trim()) {
      groups.push(current.trim());
    }
    
    return groups;
  }

  /**
   * Split Turtle objects by comma (respecting quotes and brackets)
   * Turtle allows comma-separated objects with same subject and predicate:
   * ex:mbox a owl:DatatypeProperty, owl:FunctionalProperty
   * @private
   */
  _splitByComma(text) {
    const objects = [];
    let current = '';
    let inQuotes = false;
    let inAngleBrackets = false;
    let escaped = false;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        current += char;
        escaped = true;
        continue;
      }
      
      if (char === '"') {
        current += char;
        inQuotes = !inQuotes;
        continue;
      }
      
      if (char === '<') {
        current += char;
        inAngleBrackets = true;
        continue;
      }
      
      if (char === '>') {
        current += char;
        inAngleBrackets = false;
        continue;
      }
      
      if (!inQuotes && !inAngleBrackets && char === ',') {
        objects.push(current.trim());
        current = '';
        continue;
      }
      
      current += char;
    }
    
    if (current.trim()) {
      objects.push(current.trim());
    }
    
    return objects;
  }

  /**
   * Parse a single N-Triple
   * @private
   */
  _parseNTriple(line) {
    const tripleMatch = line.match(/^<([^>]+)>\s+<([^>]+)>\s+(.+?)\s*\.$/);
    if (!tripleMatch) return;

    const [, subject, predicate, objectStr] = tripleMatch;
    
    // Contract URIs to CURIEs where possible
    const s = this.namespaceManager.contractUri(subject);
    const p = this.namespaceManager.contractUri(predicate);
    const o = this._parseValue(objectStr.trim());

    this.tripleStore.add(s, p, o);
  }

  /**
   * Remove inline comments from Turtle line (respecting quotes)
   * @private
   */
  _removeInlineComments(line) {
    let inQuotes = false;
    let escaped = false;
    let commentStart = -1;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (escaped) {
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        escaped = true;
        continue;
      }
      
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      
      if (!inQuotes && char === '#') {
        commentStart = i;
        break;
      }
    }
    
    return commentStart !== -1 ? line.substring(0, commentStart).trim() : line;
  }

  /**
   * Parse triple into [subject, predicate, object] parts
   * Respects quotes and angle brackets
   * @private
   */
  _parseTripleParts(line) {
    // Remove trailing dot
    const cleanLine = line.replace(/\s*\.\s*$/, '');
    const parts = [];
    let current = '';
    let inQuotes = false;
    let escaped = false;
    let inAngleBrackets = false;
    
    for (let i = 0; i < cleanLine.length; i++) {
      const char = cleanLine[i];
      
      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        current += char;
        escaped = true;
        continue;
      }
      
      if (char === '"') {
        current += char;
        inQuotes = !inQuotes;
        continue;
      }
      
      if (char === '<') {
        current += char;
        inAngleBrackets = true;
        continue;
      }
      
      if (char === '>') {
        current += char;
        inAngleBrackets = false;
        continue;
      }
      
      // Split on whitespace outside quotes and brackets
      if (!inQuotes && !inAngleBrackets && /\s/.test(char)) {
        if (current.trim()) {
          parts.push(current.trim());
          current = '';
          if (parts.length === 2) {
            // Rest is the object
            parts.push(cleanLine.substring(i + 1).trim());
            break;
          }
        }
      } else {
        current += char;
      }
    }
    
    if (current.trim() && parts.length < 3) {
      parts.push(current.trim());
    }
    
    return parts;
  }

  /**
   * Parse RDF resource (subject or predicate)
   * @private
   */
  _parseResource(resource) {
    // Handle Turtle shorthand 'a' for rdf:type
    if (resource === 'a') {
      return 'rdf:type';
    }
    
    if (resource.startsWith('<') && resource.endsWith('>')) {
      const uri = resource.slice(1, -1);
      return this.namespaceManager.contractUri(uri);
    }
    return resource; // Already in CURIE form
  }

  /**
   * Parse RDF value (object - can be resource or literal)
   * @private
   */
  _parseValue(value) {
    // Resource (URI)
    if (value.startsWith('<') && value.endsWith('>')) {
      const uri = value.slice(1, -1);
      return this.namespaceManager.contractUri(uri);
    }
    
    // Typed or plain literal
    if (value.startsWith('"')) {
      return this._parseLiteral(value);
    }
    
    // Already in CURIE form or unquoted literal
    return value;
  }

  /**
   * Parse literal value with type information
   * @private
   */
  _parseLiteral(literal) {
    // Typed literal: "value"^^type
    const typedMatch = literal.match(/^"(.+?)"\^\^(.+)$/);
    if (typedMatch) {
      const [, value, type] = typedMatch;
      return this._convertTypedLiteral(value, type);
    }

    // Language-tagged literal: "value"@lang (ignore language tag for now)
    const langMatch = literal.match(/^"(.+?)"@(.+)$/);
    if (langMatch) {
      return this._unescapeString(langMatch[1]);
    }

    // Plain string literal
    if (literal.startsWith('"') && literal.endsWith('"')) {
      return this._unescapeString(literal.slice(1, -1));
    }

    return literal;
  }

  /**
   * Convert typed literal to JavaScript value
   * @private
   */
  _convertTypedLiteral(value, type) {
    // Clean type (remove angle brackets for N-Triples format)
    const cleanType = type.startsWith('<') && type.endsWith('>') 
      ? type.slice(1, -1) 
      : type;
    
    // Expand type if it's a CURIE
    const fullType = this.namespaceManager.expandPrefix(cleanType);
    
    // Use RDFTypeMapper for reverse conversion
    const rdfLiteral = { value, datatype: fullType };
    return RDFTypeMapper.rdfToJSType(rdfLiteral);
  }

  /**
   * Unescape string literal characters
   * @private
   */
  _unescapeString(str) {
    return str
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\\\/g, '\\');
  }

  /**
   * Parse JSON-LD value (can be object with @id or primitive)
   * @private
   */
  _parseJsonLDValue(value) {
    // Object with @id is a resource reference
    if (typeof value === 'object' && value['@id']) {
      return this.namespaceManager.contractUri(value['@id']);
    }
    
    // Primitive values (numbers, booleans, strings) preserved as-is
    return value;
  }
}