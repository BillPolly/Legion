/**
 * EntityFactory - Convert entity models to unified graph format
 *
 * Implements unified entity model where BOTH entities and relationships are first-class:
 * - Both have types/supertypes from ontology
 * - Both have attributes (properties)
 * - Both have provenance metadata
 * - Both have temporal validity
 * - Relationships are entities with from/to pointers
 */

export class EntityFactory {
  constructor(tripleStore, config = {}) {
    this.tripleStore = tripleStore;
    this.config = {
      generateProvenance: config.generateProvenance !== false,
      generateTemporal: config.generateTemporal !== false,
      ...config
    };
    this.relationshipCounter = 1;
  }

  /**
   * Convert entity model to unified graph format and store
   * @param {Object} entityModel - { entities: [...], relationships: [...] }
   * @param {Object} metadata - Optional metadata for provenance
   * @returns {Promise<Object>} - { entities: [...], relationships: [...] } in unified format
   */
  async create(entityModel, metadata = {}) {
    const now = new Date();

    // Convert entities to unified format
    const entities = entityModel.entities.map(entity => {
      return {
        uri: entity.uri,
        graphType: 'entity',
        ontologyType: entity.type,
        label: entity.label || entity.uri,
        from: null,
        to: null,
        attributes: entity.properties || {},
        provenance: this.config.generateProvenance ? {
          extractedBy: metadata.extractedBy || 'LLMEntityGenerator',
          extractionMethod: metadata.extractionMethod || 'llm',
          source: metadata.source || 'text',
          confidence: metadata.confidence || 1.0,
          timestamp: now.toISOString()
        } : {},
        temporal: this.config.generateTemporal ? {
          validFrom: now,
          validTo: null
        } : {},
        createdAt: now,
        updatedAt: now
      };
    });

    // Convert relationships to unified format (relationships ARE entities!)
    const relationships = entityModel.relationships.map(rel => {
      // Generate unique URI for relationship instance
      const relUri = this._generateRelationshipUri(rel);

      return {
        uri: relUri,
        graphType: 'relationship',
        ontologyType: rel.predicate,
        label: this._generateRelationshipLabel(rel, entityModel),
        from: rel.subject,
        to: rel.object,
        attributes: rel.properties || {},
        provenance: this.config.generateProvenance ? {
          extractedBy: metadata.extractedBy || 'LLMEntityGenerator',
          extractionMethod: metadata.extractionMethod || 'llm',
          source: metadata.source || 'text',
          confidence: metadata.confidence || 1.0,
          timestamp: now.toISOString()
        } : {},
        temporal: this.config.generateTemporal ? {
          validFrom: now,
          validTo: null
        } : {},
        createdAt: now,
        updatedAt: now
      };
    });

    // Store in triple store
    await this._storeInTripleStore(entities, relationships);

    return {
      entities,
      relationships
    };
  }

  /**
   * Generate unique URI for relationship instance
   * @private
   */
  _generateRelationshipUri(relationship) {
    // Extract local name from predicate (e.g., "poc:hasReserve" -> "hasReserve")
    const predicateName = relationship.predicate.split(':').pop();

    // Extract local names from subject and object
    const subjectName = relationship.subject.split(':').pop();
    const objectName = relationship.object.split(':').pop();

    // Create unique URI: {predicate}_{subject}_{object}_{counter}
    const uri = `poc:${predicateName}_${subjectName}_${objectName}_${this.relationshipCounter}`;
    this.relationshipCounter++;

    return uri;
  }

  /**
   * Generate human-readable label for relationship
   * @private
   */
  _generateRelationshipLabel(relationship, entityModel) {
    // Find subject and object entities for their labels
    const subjectEntity = entityModel.entities.find(e => e.uri === relationship.subject);
    const objectEntity = entityModel.entities.find(e => e.uri === relationship.object);

    const subjectLabel = subjectEntity?.label || relationship.subject;
    const objectLabel = objectEntity?.label || relationship.object;

    // Extract predicate name
    const predicateName = relationship.predicate.split(':').pop();

    return `${subjectLabel} ${predicateName} ${objectLabel}`;
  }

  /**
   * Store entities and relationships in triple store
   * @private
   */
  async _storeInTripleStore(entities, relationships) {
    const triples = [];

    // Store entities
    for (const entity of entities) {
      // Type assertion
      triples.push([entity.uri, 'rdf:type', entity.ontologyType]);
      triples.push([entity.uri, 'graph:type', 'entity']);

      // Label
      triples.push([entity.uri, 'rdfs:label', entity.label]);

      // Attributes
      for (const [key, value] of Object.entries(entity.attributes)) {
        triples.push([entity.uri, key, value]);
      }

      // Provenance
      if (entity.provenance.extractedBy) {
        triples.push([entity.uri, 'prov:extractedBy', entity.provenance.extractedBy]);
        triples.push([entity.uri, 'prov:confidence', entity.provenance.confidence.toString()]);
      }

      // Temporal
      if (entity.temporal.validFrom) {
        triples.push([entity.uri, 'temporal:validFrom', entity.temporal.validFrom.toISOString()]);
      }
    }

    // Store relationships (as entities!)
    for (const rel of relationships) {
      // Type assertions
      triples.push([rel.uri, 'rdf:type', rel.ontologyType]);
      triples.push([rel.uri, 'graph:type', 'relationship']);

      // Label
      triples.push([rel.uri, 'rdfs:label', rel.label]);

      // From/To
      triples.push([rel.uri, 'graph:from', rel.from]);
      triples.push([rel.uri, 'graph:to', rel.to]);

      // Also store as traditional triple for SPARQL queries
      triples.push([rel.from, rel.ontologyType, rel.to]);

      // Attributes
      for (const [key, value] of Object.entries(rel.attributes)) {
        triples.push([rel.uri, key, value]);
      }

      // Provenance
      if (rel.provenance.extractedBy) {
        triples.push([rel.uri, 'prov:extractedBy', rel.provenance.extractedBy]);
        triples.push([rel.uri, 'prov:confidence', rel.provenance.confidence.toString()]);
      }

      // Temporal
      if (rel.temporal.validFrom) {
        triples.push([rel.uri, 'temporal:validFrom', rel.temporal.validFrom.toISOString()]);
      }
    }

    // Store all triples
    await this.tripleStore.addTriples(triples);
  }

  /**
   * Retrieve entity by URI
   * @param {string} uri - Entity URI
   * @returns {Promise<Object|null>} - Entity in unified format or null
   */
  async getEntity(uri) {
    const triples = await this.tripleStore.getEntity(uri);
    if (triples.length === 0) return null;

    return this._reconstructEntity(uri, triples);
  }

  /**
   * Retrieve relationship by URI
   * @param {string} uri - Relationship URI
   * @returns {Promise<Object|null>} - Relationship in unified format or null
   */
  async getRelationship(uri) {
    const triples = await this.tripleStore.getEntity(uri);
    if (triples.length === 0) return null;

    return this._reconstructRelationship(uri, triples);
  }

  /**
   * Get all entities of a specific type
   * @param {string} typeUri - Ontology type URI
   * @returns {Promise<Array>} - Array of entities
   */
  async getEntitiesByType(typeUri) {
    const uris = await this.tripleStore.getEntitiesByType(typeUri);
    const entities = [];

    for (const uri of uris) {
      const entity = await this.getEntity(uri);
      if (entity) entities.push(entity);
    }

    return entities;
  }

  /**
   * Get all relationships of a specific type
   * @param {string} typeUri - Ontology property URI
   * @returns {Promise<Array>} - Array of relationships
   */
  async getRelationshipsByType(typeUri) {
    const results = await this.tripleStore.query(null, 'rdf:type', typeUri);
    const relationships = [];

    for (const [uri, _pred, _type] of results) {
      // Check if it's a relationship (not just any entity with this type)
      const graphTypeTriples = await this.tripleStore.query(uri, 'graph:type', 'relationship');
      if (graphTypeTriples.length > 0) {
        const rel = await this.getRelationship(uri);
        if (rel) relationships.push(rel);
      }
    }

    return relationships;
  }

  /**
   * Reconstruct entity from triples
   * @private
   */
  _reconstructEntity(uri, triples) {
    const entity = {
      uri,
      graphType: 'entity',
      ontologyType: null,
      label: uri,
      from: null,
      to: null,
      attributes: {},
      provenance: {},
      temporal: {}
    };

    for (const [_subj, pred, obj] of triples) {
      if (pred === 'rdf:type') {
        entity.ontologyType = obj;
      } else if (pred === 'rdfs:label') {
        entity.label = obj;
      } else if (pred.startsWith('prov:')) {
        const key = pred.split(':')[1];
        entity.provenance[key] = obj;
      } else if (pred.startsWith('temporal:')) {
        const key = pred.split(':')[1];
        entity.temporal[key] = obj;
      } else if (pred !== 'graph:type') {
        entity.attributes[pred] = obj;
      }
    }

    return entity;
  }

  /**
   * Reconstruct relationship from triples
   * @private
   */
  _reconstructRelationship(uri, triples) {
    const rel = {
      uri,
      graphType: 'relationship',
      ontologyType: null,
      label: uri,
      from: null,
      to: null,
      attributes: {},
      provenance: {},
      temporal: {}
    };

    for (const [_subj, pred, obj] of triples) {
      if (pred === 'rdf:type') {
        rel.ontologyType = obj;
      } else if (pred === 'rdfs:label') {
        rel.label = obj;
      } else if (pred === 'graph:from') {
        rel.from = obj;
      } else if (pred === 'graph:to') {
        rel.to = obj;
      } else if (pred.startsWith('prov:')) {
        const key = pred.split(':')[1];
        rel.provenance[key] = obj;
      } else if (pred.startsWith('temporal:')) {
        const key = pred.split(':')[1];
        rel.temporal[key] = obj;
      } else if (pred !== 'graph:type') {
        rel.attributes[pred] = obj;
      }
    }

    return rel;
  }
}
