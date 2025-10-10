/**
 * OntologyRetriever - Retrieve relevant ontology subset using semantic search
 *
 * Takes extracted concepts and retrieves matching ontology elements
 * Formats ontology as text for LLM consumption
 */
export class OntologyRetriever {
  constructor({ semanticSearch, tripleStore }) {
    if (!semanticSearch) {
      throw new Error('OntologyRetriever requires semanticSearch');
    }
    if (!tripleStore) {
      throw new Error('OntologyRetriever requires tripleStore');
    }

    this.semanticSearch = semanticSearch;
    this.tripleStore = tripleStore;
  }

  /**
   * Retrieve relevant ontology subset for given concepts
   * @param {Object} concepts - Extracted concepts (entities, relationships, attributes)
   * @param {Object} options - Retrieval options
   * @returns {Promise<Object>} Filtered ontology subset
   */
  async retrieveRelevantOntology(concepts, options = {}) {
    const { classLimit = 10, relationshipLimit = 20, threshold = 0.5 } = options;

    // Search for relevant classes using entities
    const classResults = [];
    for (const entity of concepts.entities) {
      const results = await this.semanticSearch.findSimilar('ontology-classes', {
        text: entity
      }, { limit: classLimit, threshold });

      classResults.push(...results);
    }

    // Deduplicate classes by URI
    const uniqueClasses = this.deduplicateByURI(classResults, 'classURI');

    // Search for relevant relationships using relationships + attributes
    const relationshipQueries = [...concepts.relationships, ...concepts.attributes];
    const relationshipResults = [];
    for (const query of relationshipQueries) {
      const results = await this.semanticSearch.findSimilar('ontology-relationships', {
        text: query
      }, { limit: relationshipLimit, threshold });

      relationshipResults.push(...results);
    }

    // Deduplicate relationships by URI
    const uniqueRelationships = this.deduplicateByURI(relationshipResults, 'relURI');

    // Build ontology subset
    return this.buildOntologySubset(uniqueClasses, uniqueRelationships);
  }

  /**
   * Deduplicate search results by URI
   * @param {Array} results - Search results
   * @param {string} uriField - Field name containing URI
   * @returns {Array} Deduplicated results
   */
  deduplicateByURI(results, uriField) {
    const seen = new Set();
    const unique = [];

    for (const result of results) {
      const payload = result.document || result.payload;
      if (payload && payload.metadata) {
        const uri = payload.metadata[uriField];
        if (uri && !seen.has(uri)) {
          seen.add(uri);
          unique.push(result);
        }
      }
    }

    return unique;
  }

  /**
   * Build ontology subset from search results
   * @param {Array} classes - Class search results
   * @param {Array} relationships - Relationship search results
   * @returns {Promise<Object>} Ontology subset with classes, properties, relationships
   */
  async buildOntologySubset(classes, relationships) {
    const ontology = {
      classes: [],
      properties: [],
      relationships: []
    };

    // Process classes
    for (const classResult of classes) {
      const payload = classResult.document || classResult.payload;
      if (payload && payload.metadata) {
        const classURI = payload.metadata.classURI;

        // Get class details from triple store
        const label = await this.tripleStore.query(classURI, 'rdfs:label', null);
        const definition = await this.tripleStore.query(classURI, 'skos:definition', null);

        ontology.classes.push({
          uri: classURI,
          label: label.length > 0 ? this.cleanLiteral(label[0][2]) : classURI,
          definition: definition.length > 0 ? this.cleanLiteral(definition[0][2]) : '',
          score: classResult._similarity || 0
        });
      }
    }

    // Process relationships
    for (const relResult of relationships) {
      const payload = relResult.document || relResult.payload;
      if (payload && payload.metadata) {
        const relURI = payload.metadata.relURI;

        // Get relationship details from triple store
        const label = await this.tripleStore.query(relURI, 'rdfs:label', null);
        const domain = await this.tripleStore.query(relURI, 'rdfs:domain', null);
        const range = await this.tripleStore.query(relURI, 'rdfs:range', null);
        const definition = await this.tripleStore.query(relURI, 'skos:definition', null);

        // Check if it's a datatype property or object property
        const isDatatypeProperty = await this.tripleStore.query(relURI, 'rdf:type', 'owl:DatatypeProperty');
        const isObjectProperty = await this.tripleStore.query(relURI, 'rdf:type', 'owl:ObjectProperty');

        const propData = {
          uri: relURI,
          label: label.length > 0 ? this.cleanLiteral(label[0][2]) : relURI,
          domain: domain.length > 0 ? domain[0][2] : '',
          range: range.length > 0 ? range[0][2] : '',
          definition: definition.length > 0 ? this.cleanLiteral(definition[0][2]) : '',
          score: relResult._similarity || 0
        };

        // Classify as datatype property or object property
        if (isDatatypeProperty.length > 0) {
          ontology.properties.push(propData);
        } else if (isObjectProperty.length > 0) {
          ontology.relationships.push(propData);
        } else {
          // Fallback: classify based on range
          const rangeValue = propData.range;
          if (rangeValue && rangeValue.startsWith('xsd:')) {
            // XSD types are datatype properties
            ontology.properties.push(propData);
          } else {
            // Everything else is an object property
            ontology.relationships.push(propData);
          }
        }
      }
    }

    return ontology;
  }

  /**
   * Format ontology subset as text for LLM
   * @param {Object} ontology - Ontology subset
   * @returns {string} Formatted text
   */
  formatOntologyAsText(ontology) {
    let text = 'CLASSES:\n';
    ontology.classes.forEach(c => {
      text += `- ${c.uri} (${c.label})\n`;
      if (c.definition) {
        text += `  Definition: ${c.definition}\n`;
      }
    });

    text += '\nDATATYPE PROPERTIES:\n';
    ontology.properties.forEach(p => {
      text += `- ${p.uri} (${p.label})\n`;
      text += `  Domain: ${p.domain}\n`;
      text += `  Range: ${p.range}\n`;
    });

    text += '\nOBJECT PROPERTIES (Relationships):\n';
    ontology.relationships.forEach(r => {
      text += `- ${r.uri} (${r.label})\n`;
      text += `  Domain: ${r.domain}\n`;
      text += `  Range: ${r.range}\n`;
    });

    return text;
  }

  /**
   * Clean RDF literal by removing quotes
   * @param {string} literal - RDF literal
   * @returns {string} Cleaned string
   */
  cleanLiteral(literal) {
    return String(literal).replace(/^"|"$/g, '');
  }
}
