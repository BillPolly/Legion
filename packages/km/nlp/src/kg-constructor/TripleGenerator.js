/**
 * TripleGenerator - Converts validated extractions into KG triple format
 * 
 * Responsibilities:
 * - ID generation: Create consistent entity identifiers
 * - Triple formation: Convert extractions to [subject, predicate, object] format
 * - Namespace management: Apply appropriate namespaces and prefixes
 * - Type assertion: Generate type information triples
 */
export class TripleGenerator {
  constructor(options = {}) {
    this.options = {
      namespace: 'kg',
      entityPrefix: 'entity',
      generateMetadata: true,
      includeConfidence: true,
      includeSource: true,
      ...options
    };
    
    this.entityIdCounter = 1;
    this.entityIdMap = new Map(); // Maps entity text to generated IDs
    this.generatedTriples = [];
  }

  /**
   * Generate triples from entity and relationship extractions
   * @param {Object} extractions - Entity and relationship extractions
   * @param {Object} context - Processing context
   * @returns {Array} - Generated triples
   */
  generateTriples(extractions, context = {}) {
    this.generatedTriples = [];
    
    const { entities = [], relationships = [] } = extractions;
    
    // Generate entity triples
    for (const entity of entities) {
      this.generateEntityTriples(entity, context);
    }
    
    // Generate relationship triples
    for (const relationship of relationships) {
      this.generateRelationshipTriples(relationship, entities, context);
    }
    
    // Generate metadata triples if enabled
    if (this.options.generateMetadata) {
      this.generateMetadataTriples(context);
    }
    
    return [...this.generatedTriples];
  }

  /**
   * Generate triples for a single entity
   * @param {Object} entity - Entity extraction result
   * @param {Object} context - Processing context
   */
  generateEntityTriples(entity, context) {
    // Generate or retrieve entity ID
    const entityId = this.getOrCreateEntityId(entity);
    
    // Generate type triple
    const entityType = this.mapEntityTypeToOntology(entity.type);
    this.addTriple(entityId, 'rdf:type', entityType, {
      confidence: entity.confidence,
      source: 'entity_extraction',
      textSpan: entity.textSpan
    });
    
    // Generate property triples
    if (entity.properties) {
      for (const [propertyName, propertyValue] of Object.entries(entity.properties)) {
        if (propertyValue !== null && propertyValue !== undefined && propertyValue !== '') {
          const predicate = this.mapPropertyToOntology(propertyName);
          const object = this.formatPropertyValue(propertyValue, propertyName);
          
          this.addTriple(entityId, predicate, object, {
            confidence: entity.confidence,
            source: 'property_extraction',
            textSpan: entity.textSpan
          });
        }
      }
    }
    
    // Generate label triple for human readability
    if (entity.text) {
      this.addTriple(entityId, 'rdfs:label', `"${entity.text}"`, {
        confidence: entity.confidence,
        source: 'text_extraction'
      });
    }
  }

  /**
   * Generate triples for a relationship
   * @param {Object} relationship - Relationship extraction result
   * @param {Array} entities - All extracted entities
   * @param {Object} context - Processing context
   */
  generateRelationshipTriples(relationship, entities, context) {
    // Resolve subject and object entity IDs
    const subjectEntity = entities.find(e => e.id === relationship.subject);
    const objectEntity = entities.find(e => e.id === relationship.object);
    
    if (!subjectEntity || !objectEntity) {
      console.warn(`Cannot generate relationship triple: missing entity for ${relationship.subject} -> ${relationship.object}`);
      return;
    }
    
    const subjectId = this.getOrCreateEntityId(subjectEntity);
    const objectId = this.getOrCreateEntityId(objectEntity);
    
    // Map predicate to ontological relationship
    const predicate = this.mapRelationshipToOntology(relationship.predicate);
    
    // Generate main relationship triple
    this.addTriple(subjectId, predicate, objectId, {
      confidence: relationship.confidence,
      source: 'relationship_extraction',
      textSpan: relationship.textSpan,
      evidence: relationship.evidence,
      relationshipType: relationship.relationshipType
    });
    
    // Generate inverse relationship if applicable
    const inverseRelationship = this.getInverseRelationship(relationship.predicate);
    if (inverseRelationship) {
      this.addTriple(objectId, inverseRelationship, subjectId, {
        confidence: relationship.confidence,
        source: 'inverse_relationship',
        derivedFrom: `${subjectId} ${predicate} ${objectId}`
      });
    }
  }

  /**
   * Generate metadata triples about the extraction process
   * @param {Object} context - Processing context
   */
  generateMetadataTriples(context) {
    if (!context.extractionId) return;
    
    const extractionId = `extraction:${context.extractionId}`;
    
    // Basic extraction metadata
    this.addTriple(extractionId, 'rdf:type', 'kg:Extraction');
    this.addTriple(extractionId, 'kg:extractedAt', `"${new Date().toISOString()}"`);
    
    if (context.sourceText) {
      this.addTriple(extractionId, 'kg:sourceText', `"${this.escapeString(context.sourceText)}"`);
    }
    
    if (context.domain) {
      this.addTriple(extractionId, 'kg:domain', `"${context.domain}"`);
    }
    
    if (context.processingTime) {
      this.addTriple(extractionId, 'kg:processingTimeMs', context.processingTime);
    }
  }

  /**
   * Add a triple to the generated triples list
   * @param {string} subject - Subject URI/ID
   * @param {string} predicate - Predicate URI
   * @param {string} object - Object URI/ID or literal
   * @param {Object} metadata - Optional metadata
   */
  addTriple(subject, predicate, object, metadata = {}) {
    const triple = [subject, predicate, object];
    
    // Add metadata if enabled
    if (this.options.includeConfidence && metadata.confidence) {
      triple.confidence = metadata.confidence;
    }
    
    if (this.options.includeSource && metadata.source) {
      triple.source = metadata.source;
    }
    
    // Add other metadata
    Object.keys(metadata).forEach(key => {
      if (key !== 'confidence' && key !== 'source') {
        triple[key] = metadata[key];
      }
    });
    
    this.generatedTriples.push(triple);
  }

  /**
   * Get or create a consistent entity ID
   * @param {Object} entity - Entity object
   * @returns {string} - Entity ID
   */
  getOrCreateEntityId(entity) {
    // Try to use existing ID if available
    if (entity.id && entity.id.startsWith(this.options.entityPrefix)) {
      // Still add to map for statistics
      const entityKey = `${entity.text}:${entity.type}`;
      this.entityIdMap.set(entityKey, entity.id);
      return entity.id;
    }
    
    // Create ID based on entity text and type
    const entityKey = `${entity.text}:${entity.type}`;
    
    if (this.entityIdMap.has(entityKey)) {
      return this.entityIdMap.get(entityKey);
    }
    
    // Generate new ID
    let entityId;
    if (entity.properties && entity.properties.identifier) {
      // Use identifier if available
      const cleanId = this.cleanIdentifier(entity.properties.identifier);
      entityId = `${this.options.namespace}:${entity.type.toLowerCase()}_${cleanId}`;
    } else {
      // Generate sequential ID
      entityId = `${this.options.namespace}:${this.options.entityPrefix}_${this.entityIdCounter++}`;
    }
    
    this.entityIdMap.set(entityKey, entityId);
    return entityId;
  }

  /**
   * Map entity type to ontological class
   * @param {string} entityType - Extracted entity type
   * @returns {string} - Ontological class URI
   */
  mapEntityTypeToOntology(entityType) {
    const typeMapping = {
      'Equipment': 'kg:Equipment',
      'Pump': 'kg:Pump',
      'Tank': 'kg:Tank',
      'System': 'kg:System',
      'Component': 'kg:Component',
      'Person': 'kg:Person',
      'Organization': 'kg:Organization',
      'Document': 'kg:Document',
      'Procedure': 'kg:Procedure',
      'Measurement': 'kg:Measurement'
    };
    
    return typeMapping[entityType] || `kg:${entityType}`;
  }

  /**
   * Map property name to ontological property
   * @param {string} propertyName - Property name
   * @returns {string} - Ontological property URI
   */
  mapPropertyToOntology(propertyName) {
    const propertyMapping = {
      'name': 'kg:name',
      'identifier': 'kg:identifier',
      'description': 'kg:description',
      'manufacturer': 'kg:manufacturer',
      'model': 'kg:model',
      'capacity': 'kg:capacity',
      'pressure_rating': 'kg:pressureRating',
      'flow_rate': 'kg:flowRate',
      'temperature': 'kg:temperature',
      'material': 'kg:material',
      'volume': 'kg:volume',
      'role': 'kg:role',
      'department': 'kg:department',
      'location': 'kg:location',
      'contact_info': 'kg:contactInfo',
      'value': 'kg:value',
      'unit': 'kg:unit'
    };
    
    return propertyMapping[propertyName] || `kg:${propertyName}`;
  }

  /**
   * Map relationship predicate to ontological relationship
   * @param {string} predicate - Relationship predicate
   * @returns {string} - Ontological relationship URI
   */
  mapRelationshipToOntology(predicate) {
    const relationshipMapping = {
      'is_part_of': 'gellish:1230',
      'contains': 'gellish:1331',
      'connected_to': 'gellish:1456',
      'manufactured_by': 'kg:manufacturedBy',
      'operates_at': 'kg:operatesAt',
      'located_in': 'kg:locatedIn',
      'works_for': 'kg:worksFor',
      'manages': 'kg:manages',
      'related_to': 'kg:relatedTo'
    };
    
    return relationshipMapping[predicate] || `kg:${predicate}`;
  }

  /**
   * Get inverse relationship for a predicate
   * @param {string} predicate - Original predicate
   * @returns {string|null} - Inverse predicate or null
   */
  getInverseRelationship(predicate) {
    const inverseMapping = {
      'is_part_of': 'kg:consistsOf',
      'contains': 'kg:isContainedIn',
      'connected_to': 'gellish:1456', // symmetric - same as original
      'manufactured_by': 'kg:manufactures',
      'located_in': 'kg:containsLocation',
      'works_for': 'kg:employs',
      'manages': 'kg:managedBy'
    };
    
    return inverseMapping[predicate] || null;
  }

  /**
   * Format property value for triple storage
   * @param {any} value - Property value
   * @param {string} propertyName - Property name for context
   * @returns {string} - Formatted value
   */
  formatPropertyValue(value, propertyName) {
    if (typeof value === 'string') {
      // Check if it's a numeric value with units
      const numericMatch = value.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z°]+)$/);
      if (numericMatch) {
        return `"${value}"`; // Keep as string literal for now
      }
      return `"${this.escapeString(value)}"`;
    }
    
    if (typeof value === 'number') {
      return value.toString();
    }
    
    if (typeof value === 'boolean') {
      return value.toString();
    }
    
    // Default to string representation
    return `"${this.escapeString(String(value))}"`;
  }

  /**
   * Clean identifier for use in URIs
   * @param {string} identifier - Raw identifier
   * @returns {string} - Cleaned identifier
   */
  cleanIdentifier(identifier) {
    return identifier
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Escape string for use in literals
   * @param {string} str - String to escape
   * @returns {string} - Escaped string
   */
  escapeString(str) {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * Get statistics about generated triples
   * @returns {Object} - Statistics
   */
  getStatistics() {
    const stats = {
      totalTriples: this.generatedTriples.length,
      entityTriples: 0,
      relationshipTriples: 0,
      propertyTriples: 0,
      metadataTriples: 0,
      uniqueEntities: this.entityIdMap.size,
      averageConfidence: 0
    };
    
    let confidenceSum = 0;
    let confidenceCount = 0;
    
    for (const triple of this.generatedTriples) {
      // Classify triple type - ensure predicate is a string
      const predicate = String(triple[1] || '');
      const subject = String(triple[0] || '');

      if (predicate === 'rdf:type') {
        stats.entityTriples++;
      } else if (predicate.startsWith('gellish:') || predicate.includes('relatedTo')) {
        stats.relationshipTriples++;
      } else if (predicate.startsWith('kg:')) {
        if (subject.startsWith('extraction:')) {
          stats.metadataTriples++;
        } else {
          stats.propertyTriples++;
        }
      }

      // Calculate average confidence
      if (triple.confidence) {
        confidenceSum += triple.confidence;
        confidenceCount++;
      }
    }
    
    if (confidenceCount > 0) {
      stats.averageConfidence = confidenceSum / confidenceCount;
    }
    
    return stats;
  }

  /**
   * Reset the generator state
   */
  reset() {
    this.entityIdCounter = 1;
    this.entityIdMap.clear();
    this.generatedTriples = [];
  }

  /**
   * Export triples in different formats
   * @param {string} format - Export format ('array', 'ntriples', 'turtle')
   * @returns {string|Array} - Formatted triples
   */
  exportTriples(format = 'array') {
    switch (format) {
      case 'array':
        return this.generatedTriples.map(triple => [triple[0], triple[1], triple[2]]);
      
      case 'ntriples':
        return this.generatedTriples
          .map(triple => `<${triple[0]}> <${triple[1]}> ${this.formatObject(triple[2])} .`)
          .join('\n');
      
      case 'turtle':
        // Basic Turtle format - could be enhanced
        return this.generatedTriples
          .map(triple => `<${triple[0]}> <${triple[1]}> ${this.formatObject(triple[2])} .`)
          .join('\n');
      
      default:
        return this.generatedTriples;
    }
  }

  /**
   * Format object for RDF serialization
   * @param {string} object - Object value
   * @returns {string} - Formatted object
   */
  formatObject(object) {
    if (object.startsWith('"') && object.endsWith('"')) {
      return object; // Already a literal
    }
    
    if (object.match(/^\d+(\.\d+)?$/)) {
      return object; // Numeric literal
    }
    
    return `<${object}>`; // URI
  }
}
