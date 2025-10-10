/**
 * OntologyLoader - Parse Turtle ontology files
 *
 * Simple Turtle parser for extracting classes and properties
 * Supports the POC ontology format
 */

import { readFile } from 'fs/promises';

export class OntologyLoader {
  constructor() {
    this.prefixes = new Map();
  }

  /**
   * Load and parse ontology from Turtle file
   * @param {string} filePath - Path to .ttl file
   * @returns {Object} Parsed ontology with classes and properties
   */
  async load(filePath) {
    const content = await readFile(filePath, 'utf-8');
    return this.parse(content);
  }

  /**
   * Parse Turtle content
   * @param {string} content - Turtle file content
   * @returns {Object} Parsed ontology
   */
  parse(content) {
    this.prefixes.clear();
    const classes = new Map();
    const properties = new Map();

    // Parse prefixes
    const prefixRegex = /@prefix\s+(\w+):\s+<([^>]+)>\s+\./g;
    let match;
    while ((match = prefixRegex.exec(content)) !== null) {
      this.prefixes.set(match[1], match[2]);
    }

    // Split by blank lines to separate definitions
    const lines = content.split('\n');
    let currentSubject = null;
    let currentType = null;
    let currentDef = {};

    for (let line of lines) {
      line = line.trim();

      // Skip empty lines and comments
      if (!line || line.startsWith('#')) continue;

      // Skip prefix declarations
      if (line.startsWith('@prefix')) continue;

      // New subject definition
      if (line.includes('rdf:type')) {
        // Save previous definition
        if (currentSubject && currentType) {
          this._saveDefinition(classes, properties, currentSubject, currentType, currentDef);
        }

        // Extract subject and type
        const parts = line.split('rdf:type');
        currentSubject = parts[0].trim();
        const typePart = parts[1].trim().replace(/;$/, '').trim();

        if (typePart.includes('owl:Class')) {
          currentType = 'class';
        } else if (typePart.includes('owl:ObjectProperty')) {
          currentType = 'ObjectProperty';
        } else if (typePart.includes('owl:DatatypeProperty')) {
          currentType = 'DatatypeProperty';
        } else {
          currentType = null;
        }

        currentDef = { uri: currentSubject };
        continue;
      }

      // Property lines
      if (currentSubject && line.includes('rdfs:label')) {
        const labelMatch = line.match(/rdfs:label\s+"([^"]+)"/);
        if (labelMatch) {
          currentDef.label = labelMatch[1];
        }
      }

      if (currentSubject && line.includes('rdfs:comment')) {
        const commentMatch = line.match(/rdfs:comment\s+"([^"]+)"/);
        if (commentMatch) {
          currentDef.comment = commentMatch[1];
        }
      }

      if (currentSubject && line.includes('rdfs:domain')) {
        const domainMatch = line.match(/rdfs:domain\s+([^\s;]+)/);
        if (domainMatch) {
          currentDef.domain = domainMatch[1].trim();
        }
      }

      if (currentSubject && line.includes('rdfs:range')) {
        const rangeMatch = line.match(/rdfs:range\s+([^\s;.]+)/);
        if (rangeMatch) {
          currentDef.range = rangeMatch[1].trim();
        }
      }

      // End of definition (line ends with .)
      if (line.endsWith('.')) {
        if (currentSubject && currentType) {
          this._saveDefinition(classes, properties, currentSubject, currentType, currentDef);
        }
        currentSubject = null;
        currentType = null;
        currentDef = {};
      }
    }

    // Save last definition if exists
    if (currentSubject && currentType) {
      this._saveDefinition(classes, properties, currentSubject, currentType, currentDef);
    }

    return {
      classes,
      properties,
      prefixes: this.prefixes
    };
  }

  /**
   * Save parsed definition to appropriate map
   * @private
   */
  _saveDefinition(classes, properties, subject, type, def) {
    if (type === 'class') {
      classes.set(subject, {
        uri: subject,
        label: def.label || '',
        comment: def.comment || ''
      });
    } else if (type === 'ObjectProperty' || type === 'DatatypeProperty') {
      properties.set(subject, {
        uri: subject,
        type: type,
        label: def.label || '',
        comment: def.comment || '',
        domain: def.domain || '',
        range: def.range || ''
      });
    }
  }
}
