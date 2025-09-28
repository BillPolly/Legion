/**
 * RDFSchemaExtractor - Extract Handle-compatible schema from RDF ontologies
 * 
 * Responsibilities:
 * - Parse RDFS/OWL ontologies from triple store
 * - Extract entity types (owl:Class, rdfs:Class)
 * - Extract property definitions (owl:DatatypeProperty, owl:ObjectProperty)
 * - Map RDF properties to Handle attributes
 * - Extract cardinality constraints
 * - Build Handle schema format
 */

export class RDFSchemaExtractor {
  /**
   * Create an RDFSchemaExtractor
   * @param {Object} tripleStore - Triple store containing ontology data
   * @param {NamespaceManager} namespaceManager - Namespace manager for URI expansion/contraction
   */
  constructor(tripleStore, namespaceManager) {
    if (!tripleStore) {
      throw new Error('RDFSchemaExtractor requires a triple store');
    }
    
    if (!namespaceManager) {
      throw new Error('RDFSchemaExtractor requires a namespace manager');
    }
    
    this.tripleStore = tripleStore;
    this.namespaceManager = namespaceManager;
  }

  /**
   * Get all entity types defined in the ontology
   * 
   * Extracts entities defined as:
   * - owl:Class
   * - rdfs:Class
   * 
   * Returns full URIs (expanded from CURIEs) for all entity types.
   * Filters out property definitions and instances.
   * 
   * @returns {string[]} - Array of full URI strings for entity types, sorted alphabetically
   * 
   * Example:
   * // Ontology contains: ex:Person a owl:Class
   * getEntityTypes() // Returns: ['http://example.org/Person']
   */
  getEntityTypes() {
    const typeSet = new Set();
    
    // Query for owl:Class definitions
    const owlClasses = this.tripleStore.query(null, 'rdf:type', 'owl:Class');
    for (const [subject] of owlClasses) {
      const fullUri = this._expandToFullUri(subject);
      typeSet.add(fullUri);
    }
    
    // Query for rdfs:Class definitions
    const rdfsClasses = this.tripleStore.query(null, 'rdf:type', 'rdfs:Class');
    for (const [subject] of rdfsClasses) {
      const fullUri = this._expandToFullUri(subject);
      typeSet.add(fullUri);
    }
    
    // Convert Set to sorted array
    return Array.from(typeSet).sort();
  }

  /**
   * Get all properties for a specific entity type
   * 
   * Extracts properties defined with rdfs:domain matching the specified type.
   * Returns metadata including:
   * - Property URI and local name
   * - Property type (datatype or object)
   * - Range (target type)
   * - Cardinality (one or many)
   * 
   * @param {string} typeUri - Full URI or CURIE for the entity type
   * @returns {Object[]} - Array of property objects, sorted by name
   * 
   * Property object format:
   * {
   *   uri: 'http://example.org/name',
   *   name: 'name',
   *   type: 'datatype' | 'object',
   *   range: 'http://www.w3.org/2001/XMLSchema#string',
   *   cardinality: 'one' | 'many'
   * }
   * 
   * Example:
   * // Ontology contains:
   * // ex:name a owl:DatatypeProperty ; rdfs:domain ex:Person ; rdfs:range xsd:string
   * getPropertiesForType('ex:Person')
   * // Returns: [{ uri: 'http://example.org/name', name: 'name', type: 'datatype', range: '...', cardinality: 'many' }]
   */
  getPropertiesForType(typeUri) {
    if (!typeUri || typeof typeUri !== 'string') {
      throw new Error('Type URI must be a non-empty string');
    }
    
    // Normalize the type URI (expand CURIE if needed)
    const normalizedTypeUri = this._expandToFullUri(typeUri);
    
    // Also contract to CURIE for querying
    const contractedTypeUri = this.namespaceManager.contractUri(normalizedTypeUri);
    
    // Find all properties with this type as their domain
    const propertyMap = new Map();
    
    // Query with all possible representations:
    // 1. Original input (could be CURIE or full URI)
    // 2. Normalized full URI
    // 3. Contracted CURIE
    const queryUris = new Set([typeUri, normalizedTypeUri, contractedTypeUri]);
    
    for (const uri of queryUris) {
      const domainTriples = this.tripleStore.query(null, 'rdfs:domain', uri);
      
      for (const [propertyUri] of domainTriples) {
        // Skip if already processed
        const normalizedPropertyUri = this._expandToFullUri(propertyUri);
        if (propertyMap.has(normalizedPropertyUri)) {
          continue;
        }
        
        // Get property metadata
        const propertyMetadata = this._extractPropertyMetadata(propertyUri);
        
        // Only include if it's a valid property (has a type)
        if (propertyMetadata) {
          propertyMap.set(normalizedPropertyUri, propertyMetadata);
        }
      }
    }
    
    // Convert map to sorted array
    const properties = Array.from(propertyMap.values());
    properties.sort((a, b) => a.name.localeCompare(b.name));
    
    return properties;
  }

  /**
   * Extract metadata for a property
   * 
   * @param {string} propertyUri - URI or CURIE of the property
   * @returns {Object|null} - Property metadata object or null if not a valid property
   * @private
   */
  _extractPropertyMetadata(propertyUri) {
    // Determine property type
    const propertyType = this._getPropertyType(propertyUri);
    if (!propertyType) {
      // Not a valid property
      return null;
    }
    
    // Get full URI
    const fullUri = this._expandToFullUri(propertyUri);
    
    // Extract local name
    const localName = this._extractLocalName(fullUri);
    
    // Get range
    const range = this._getPropertyRange(propertyUri);
    
    // Get cardinality
    const cardinality = this._getPropertyCardinality(propertyUri);
    
    return {
      uri: fullUri,
      name: localName,
      type: propertyType,
      range: range,
      cardinality: cardinality
    };
  }

  /**
   * Get the type of a property (datatype or object)
   * 
   * @param {string} propertyUri - URI or CURIE of the property
   * @returns {string|null} - 'datatype', 'object', or null if not a property
   * @private
   */
  _getPropertyType(propertyUri) {
    // Check for owl:DatatypeProperty
    const isDatatypeProperty = this.tripleStore.query(propertyUri, 'rdf:type', 'owl:DatatypeProperty').length > 0;
    if (isDatatypeProperty) {
      return 'datatype';
    }
    
    // Check for owl:ObjectProperty
    const isObjectProperty = this.tripleStore.query(propertyUri, 'rdf:type', 'owl:ObjectProperty').length > 0;
    if (isObjectProperty) {
      return 'object';
    }
    
    // Check for rdf:Property (treat as datatype by default)
    const isRdfProperty = this.tripleStore.query(propertyUri, 'rdf:type', 'rdf:Property').length > 0;
    if (isRdfProperty) {
      return 'datatype';
    }
    
    // Not a recognized property type
    return null;
  }

  /**
   * Get the range (target type) of a property
   * 
   * @param {string} propertyUri - URI or CURIE of the property
   * @returns {string|undefined} - Full URI of the range, or undefined if not specified
   * @private
   */
  _getPropertyRange(propertyUri) {
    const rangeTriples = this.tripleStore.query(propertyUri, 'rdfs:range', null);
    
    if (rangeTriples.length === 0) {
      return undefined;
    }
    
    // Get the first range (properties typically have one range)
    const [, , rangeValue] = rangeTriples[0];
    
    // Expand to full URI
    return this._expandToFullUri(rangeValue);
  }

  /**
   * Get the cardinality of a property (one or many)
   * 
   * Properties marked as owl:FunctionalProperty have cardinality 'one'.
   * All other properties default to cardinality 'many'.
   * 
   * This is a public method that can be called directly to check cardinality
   * for any property in the ontology.
   * 
   * @param {string} propertyUri - Full URI or CURIE for the property
   * @returns {string} - 'one' or 'many'
   * 
   * Example:
   * // Ontology contains: ex:email a owl:FunctionalProperty
   * getPropertyCardinality('ex:email') // Returns: 'one'
   * 
   * // Ontology contains: ex:hobby a owl:DatatypeProperty (no functional constraint)
   * getPropertyCardinality('ex:hobby') // Returns: 'many'
   */
  getPropertyCardinality(propertyUri) {
    if (!propertyUri || typeof propertyUri !== 'string') {
      throw new Error('Property URI must be a non-empty string');
    }
    
    // Normalize property URI (expand CURIE if needed)
    const normalizedPropertyUri = this._expandToFullUri(propertyUri);
    
    // Also contract to CURIE for querying
    const contractedPropertyUri = this.namespaceManager.contractUri(normalizedPropertyUri);
    
    // Check with all possible representations
    const queryUris = new Set([propertyUri, normalizedPropertyUri, contractedPropertyUri]);
    
    for (const uri of queryUris) {
      const isFunctional = this.tripleStore.query(uri, 'rdf:type', 'owl:FunctionalProperty').length > 0;
      if (isFunctional) {
        return 'one';
      }
    }
    
    // Default to many if not functional
    return 'many';
  }

  /**
   * Get the cardinality of a property (one or many) - private helper
   * 
   * Properties marked as owl:FunctionalProperty have cardinality 'one'.
   * All other properties default to cardinality 'many'.
   * 
   * @param {string} propertyUri - URI or CURIE of the property
   * @returns {string} - 'one' or 'many'
   * @private
   */
  _getPropertyCardinality(propertyUri) {
    // Delegate to public method
    return this.getPropertyCardinality(propertyUri);
  }

  /**
   * Extract local name from full URI
   * 
   * @param {string} uri - Full URI or CURIE
   * @returns {string} - Local name (last part after # or / or :)
   * @private
   */
  _extractLocalName(uri) {
    // Handle CURIE format (prefix:localName)
    // Special case: :localName (default namespace)
    if (uri.startsWith(':')) {
      return uri.substring(1);
    }
    
    // Handle regular CURIE (prefix:localName)
    if (uri.includes(':') && !uri.startsWith('http://') && !uri.startsWith('https://')) {
      const colonIndex = uri.lastIndexOf(':');
      return uri.substring(colonIndex + 1);
    }
    
    // Handle full URI - find the last occurrence of # or /
    const hashIndex = uri.lastIndexOf('#');
    const slashIndex = uri.lastIndexOf('/');
    
    const splitIndex = Math.max(hashIndex, slashIndex);
    
    if (splitIndex >= 0 && splitIndex < uri.length - 1) {
      return uri.substring(splitIndex + 1);
    }
    
    // If no separator found, return the whole URI
    return uri;
  }

  /**
   * Extract complete Handle-compatible schema from RDF ontology
   * 
   * Combines all schema extraction methods to build a complete schema object:
   * - Discovers all entity types (owl:Class, rdfs:Class)
   * - Extracts properties for each type
   * - Maps RDF types to Handle types
   * - Preserves cardinality constraints
   * 
   * Returns a schema object in Handle format:
   * {
   *   'TypeName/propertyName': {
   *     type: 'string' | 'number' | 'boolean' | 'date' | 'ref',
   *     cardinality: 'one' | 'many',
   *     ref?: 'TargetTypeName'  // Only for type: 'ref'
   *   }
   * }
   * 
   * @returns {Object} - Handle-compatible schema object
   * 
   * Example:
   * // Ontology contains:
   * // ex:Person a owl:Class .
   * // ex:name a owl:DatatypeProperty ; rdfs:domain ex:Person ; rdfs:range xsd:string .
   * // ex:age a owl:DatatypeProperty ; rdfs:domain ex:Person ; rdfs:range xsd:integer .
   * 
   * extractSchema()
   * // Returns:
   * // {
   * //   'Person/name': { type: 'string', cardinality: 'many' },
   * //   'Person/age': { type: 'number', cardinality: 'many' }
   * // }
   */
  extractSchema() {
    const schema = {};
    
    // Get all entity types
    const entityTypes = this.getEntityTypes();
    
    // For each entity type, extract its properties
    for (const entityTypeUri of entityTypes) {
      // Extract local name for the type (e.g., "Person" from "http://example.org/Person")
      const typeName = this._extractLocalName(entityTypeUri);
      
      // Get all properties for this type
      const properties = this.getPropertiesForType(entityTypeUri);
      
      // Add each property to the schema
      for (const property of properties) {
        // Build schema key: TypeName/propertyName
        const schemaKey = `${typeName}/${property.name}`;
        
        // Map RDF type to Handle type
        const handleType = this._mapRdfTypeToHandle(property.type, property.range);
        
        // Build schema entry
        const schemaEntry = {
          type: handleType,
          cardinality: property.cardinality
        };
        
        // If it's a reference type, include the ref field
        if (handleType === 'ref' && property.range) {
          schemaEntry.ref = this._extractLocalName(property.range);
        }
        
        schema[schemaKey] = schemaEntry;
      }
    }
    
    return schema;
  }

  /**
   * Map RDF property type to Handle type
   * 
   * @param {string} rdfPropertyType - 'datatype' or 'object'
   * @param {string} [range] - RDF range URI (e.g., 'xsd:string', 'ex:Person')
   * @returns {string} - Handle type ('string', 'number', 'boolean', 'date', 'ref')
   * @private
   */
  _mapRdfTypeToHandle(rdfPropertyType, range) {
    // Object properties are references
    if (rdfPropertyType === 'object') {
      return 'ref';
    }
    
    // No range specified - default to string
    if (!range) {
      return 'string';
    }
    
    // Map XSD types to Handle types
    const rangeExpanded = this._expandToFullUri(range);
    
    // Check for XSD types
    if (rangeExpanded.startsWith('http://www.w3.org/2001/XMLSchema#')) {
      const xsdType = rangeExpanded.substring('http://www.w3.org/2001/XMLSchema#'.length);
      
      switch (xsdType) {
        case 'string':
        case 'normalizedString':
        case 'token':
        case 'language':
        case 'Name':
        case 'NCName':
        case 'anyURI':
          return 'string';
        
        case 'integer':
        case 'int':
        case 'long':
        case 'short':
        case 'byte':
        case 'nonNegativeInteger':
        case 'nonPositiveInteger':
        case 'positiveInteger':
        case 'negativeInteger':
        case 'unsignedLong':
        case 'unsignedInt':
        case 'unsignedShort':
        case 'unsignedByte':
        case 'decimal':
        case 'float':
        case 'double':
          return 'number';
        
        case 'boolean':
          return 'boolean';
        
        case 'dateTime':
        case 'date':
        case 'time':
        case 'gYear':
        case 'gYearMonth':
        case 'gMonth':
        case 'gMonthDay':
        case 'gDay':
          return 'date';
        
        default:
          // Unknown XSD type - default to string
          return 'string';
      }
    }
    
    // If range is not an XSD type, it might be an entity reference
    // Check if it's a defined class in the ontology (try all URI representations)
    const normalizedRange = this._expandToFullUri(range);
    const contractedRange = this.namespaceManager.contractUri(normalizedRange);
    const queryUris = new Set([range, normalizedRange, contractedRange]);
    
    for (const uri of queryUris) {
      const isClass = this.tripleStore.query(uri, 'rdf:type', 'owl:Class').length > 0 ||
                      this.tripleStore.query(uri, 'rdf:type', 'rdfs:Class').length > 0;
      
      if (isClass) {
        return 'ref';
      }
    }
    
    // Also check if the range looks like a class name (not an XSD type)
    // This handles cases like Schema.org where classes might not be explicitly defined
    // If it's not an XSD type and looks like a class URI, treat it as a reference
    if (!rangeExpanded.startsWith('http://www.w3.org/2001/XMLSchema#')) {
      // Check if it looks like a class (capitalized local name suggests a class)
      const localName = this._extractLocalName(rangeExpanded);
      if (localName && localName[0] === localName[0].toUpperCase()) {
        return 'ref';
      }
    }
    
    // Default to string for unknown types
    return 'string';
  }

  /**
   * Expand CURIE or URI to full URI
   * 
   * @param {string} uri - URI or CURIE to expand
   * @returns {string} - Full URI
   * @private
   */
  _expandToFullUri(uri) {
    // If it's already a full URI, return as-is
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      return uri;
    }
    
    // If it's a CURIE, expand it
    if (uri.includes(':')) {
      return this.namespaceManager.expandPrefix(uri);
    }
    
    // Return as-is if no expansion possible
    return uri;
  }
}