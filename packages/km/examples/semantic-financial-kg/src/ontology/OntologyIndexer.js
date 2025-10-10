/**
 * OntologyIndexer - Index ontology in SemanticSearchProvider for retrieval
 *
 * Generates natural language descriptions for classes and properties,
 * then indexes them using embeddings for semantic search.
 */

export class OntologyIndexer {
  constructor(semanticSearchProvider) {
    if (!semanticSearchProvider) {
      throw new Error('SemanticSearchProvider is required');
    }
    this.semanticSearch = semanticSearchProvider;
  }

  /**
   * Generate natural language descriptions for all ontology entities
   * @param {Object} ontology - Parsed ontology from OntologyLoader
   * @returns {Array} Array of description objects
   */
  generateDescriptions(ontology) {
    const descriptions = [];

    // Generate descriptions for classes
    for (const [uri, classObj] of ontology.classes) {
      const description = this._generateClassDescription(classObj);
      descriptions.push({
        uri: uri,
        type: 'class',
        description: description,
        label: classObj.label,
        comment: classObj.comment
      });
    }

    // Generate descriptions for properties
    for (const [uri, propObj] of ontology.properties) {
      const description = this._generatePropertyDescription(propObj);
      descriptions.push({
        uri: uri,
        type: 'property',
        description: description,
        label: propObj.label,
        comment: propObj.comment,
        propertyType: propObj.type,
        domain: propObj.domain,
        range: propObj.range
      });
    }

    return descriptions;
  }

  /**
   * Generate natural language description for a class
   * @private
   */
  _generateClassDescription(classObj) {
    let desc = `${classObj.label}`;

    if (classObj.comment) {
      desc += `: ${classObj.comment}`;
    }

    desc += `. This is a class in the ontology representing a type of entity.`;

    return desc;
  }

  /**
   * Generate natural language description for a property
   * @private
   */
  _generatePropertyDescription(propObj) {
    let desc = `${propObj.label}`;

    if (propObj.comment) {
      desc += `: ${propObj.comment}`;
    }

    // Add domain and range information
    if (propObj.domain && propObj.range) {
      if (propObj.type === 'ObjectProperty') {
        desc += `. This is an object property connecting ${propObj.domain} to ${propObj.range}.`;
      } else if (propObj.type === 'DatatypeProperty') {
        desc += `. This is a datatype property of ${propObj.domain} with range ${propObj.range}.`;
      }
    }

    return desc;
  }

  /**
   * Index ontology in SemanticSearchProvider
   * @param {Object} ontology - Parsed ontology from OntologyLoader
   * @param {string} collectionName - Qdrant collection name
   * @returns {Object} Indexing result with counts
   */
  async index(ontology, collectionName = 'ontology') {
    // Generate descriptions
    const descriptions = this.generateDescriptions(ontology);

    // Ensure collection exists (createCollection handles if exists)
    await this.semanticSearch.createCollection(collectionName);

    // Prepare documents for indexing (flatten structure for easy access)
    const documents = descriptions.map(desc => ({
      id: desc.uri,
      content: desc.description,
      uri: desc.uri,
      type: desc.type,
      label: desc.label,
      comment: desc.comment,
      ...(desc.propertyType && { propertyType: desc.propertyType }),
      ...(desc.domain && { domain: desc.domain }),
      ...(desc.range && { range: desc.range })
    }));

    // Insert into semantic search
    await this.semanticSearch.insert(collectionName, documents);

    // Count results
    const classesIndexed = descriptions.filter(d => d.type === 'class').length;
    const propertiesIndexed = descriptions.filter(d => d.type === 'property').length;

    return {
      classesIndexed,
      propertiesIndexed,
      totalIndexed: descriptions.length,
      collectionName
    };
  }
}
