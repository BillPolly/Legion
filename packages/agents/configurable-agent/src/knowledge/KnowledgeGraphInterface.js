/**
 * KnowledgeGraphInterface - Interface to the Legion knowledge graph system
 * 
 * CRITICAL: This module requires @legion/kg-storage-memory which is not currently available.
 * Following FAIL FAST principle - no fallbacks or mocks.
 */

// This import will fail immediately if package doesn't exist - NO FALLBACK
let InMemoryTripleStore;

try {
  const kgMemory = await import('@legion/kg-storage-memory');
  InMemoryTripleStore = kgMemory.InMemoryTripleStore;
} catch (error) {
  // FAIL FAST - No fallback implementations
  throw new Error(
    `CRITICAL: Required @legion/kg-storage-memory package is not installed. ` +
    `KnowledgeGraphInterface cannot function without this dependency. ` +
    `Install @legion/kg-storage-memory package. ` +
    `Error: ${error.message}`
  );
}

/**
 * Manages knowledge graph operations for the agent
 */
export class KnowledgeGraphInterface {
  constructor(config = {}) {
    this.config = this._validateConfig(config);
    this.namespace = config.namespace || 'agent';
    this.storageMode = config.storageMode || 'session';
    this.tripleStore = config.tripleStore || null;
    this.initialized = false;
  }

  /**
   * Validate configuration
   */
  _validateConfig(config) {
    if (config.storageMode && !['session', 'persistent'].includes(config.storageMode)) {
      throw new Error('Invalid storage mode: must be "session" or "persistent"');
    }
    return config;
  }

  /**
   * Initialize the knowledge graph interface
   */
  async initialize() {
    if (this.initialized) {
      throw new Error('KnowledgeGraphInterface already initialized');
    }

    // Create default in-memory store if none provided
    if (!this.tripleStore) {
      this.tripleStore = new InMemoryTripleStore();
    }

    this.initialized = true;
  }

  /**
   * Store an entity in the knowledge graph
   */
  async storeEntity(entity) {
    if (!entity.id) {
      throw new Error('Entity must have an id');
    }
    if (!entity.type) {
      throw new Error('Entity must have a type');
    }

    const subjectId = `${this.namespace}:${entity.id}`;

    try {
      // Store entity type
      await this.tripleStore.addTriple(subjectId, 'rdf:type', `${this.namespace}:${entity.type}`);

      // Store properties
      if (entity.properties) {
        for (const [key, value] of Object.entries(entity.properties)) {
          const objectValue = typeof value === 'string' ? `"${value}"` : String(value);
          await this.tripleStore.addTriple(subjectId, `${this.namespace}:${key}`, objectValue);
        }
      }
    } catch (error) {
      throw new Error(`Failed to store entity: ${error.message}`);
    }
  }

  /**
   * Retrieve an entity by ID
   */
  async getEntity(entityId) {
    const subjectId = `${this.namespace}:${entityId}`;
    const triples = await this.tripleStore.query(subjectId, null, null);

    if (triples.length === 0) {
      return null;
    }

    const entity = {
      id: entityId,
      type: null,
      properties: {}
    };

    for (const triple of triples) {
      // Handle both array and object format
      const [subject, predicate, object] = Array.isArray(triple) ? triple : [triple.subject, triple.predicate, triple.object];
      
      if (predicate === 'rdf:type') {
        // Extract type from namespace:Type format
        entity.type = object.replace(`${this.namespace}:`, '');
      } else if (predicate.startsWith(`${this.namespace}:`) && !object.startsWith(`${this.namespace}:`)) {
        // Extract property name (only if object is not an entity reference)
        const propName = predicate.replace(`${this.namespace}:`, '');
        // Parse value (remove quotes if string literal)
        let value = object;
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (!isNaN(value)) {
          value = Number(value);
        }
        entity.properties[propName] = value;
      }
    }

    return entity;
  }

  /**
   * Update an entity's properties
   */
  async updateEntity(entityId, updates) {
    const subjectId = `${this.namespace}:${entityId}`;

    for (const [key, value] of Object.entries(updates)) {
      const predicateUri = `${this.namespace}:${key}`;
      
      // Remove old values for this predicate
      const oldTriples = await this.tripleStore.query(subjectId, predicateUri, null);
      for (const triple of oldTriples) {
        const [s, p, o] = Array.isArray(triple) ? triple : [triple.subject, triple.predicate, triple.object];
        await this.tripleStore.removeTriple(s, p, o);
      }
      
      // Add new value
      const objectValue = typeof value === 'string' ? `"${value}"` : String(value);
      await this.tripleStore.addTriple(subjectId, predicateUri, objectValue);
    }
  }

  /**
   * Delete an entity
   */
  async deleteEntity(entityId) {
    const subjectId = `${this.namespace}:${entityId}`;
    // Get all triples for this entity
    const triples = await this.tripleStore.query(subjectId, null, null);
    // Remove each triple individually
    for (const triple of triples) {
      const [subject, predicate, object] = Array.isArray(triple) ? triple : [triple.subject, triple.predicate, triple.object];
      await this.tripleStore.removeTriple(subject, predicate, object);
    }
  }

  /**
   * List entities by type
   */
  async listEntitiesByType(type) {
    const typeUri = `${this.namespace}:${type}`;
    const triples = await this.tripleStore.query(null, 'rdf:type', typeUri);
    
    return triples.map(triple => {
      const [subject] = Array.isArray(triple) ? triple : [triple.subject];
      return subject.replace(`${this.namespace}:`, '');
    });
  }

  /**
   * Add a relationship between entities
   */
  async addRelationship(subjectId, predicate, objectId, properties = null) {
    const subjectUri = `${this.namespace}:${subjectId}`;
    const predicateUri = `${this.namespace}:${predicate}`;
    const objectUri = `${this.namespace}:${objectId}`;

    await this.tripleStore.addTriple(subjectUri, predicateUri, objectUri);

    // If properties provided, create reified statement
    if (properties) {
      const relId = `${this.namespace}:rel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Reification triples
      await this.tripleStore.addTriple(relId, 'rdf:subject', subjectUri);
      await this.tripleStore.addTriple(relId, 'rdf:predicate', predicateUri);
      await this.tripleStore.addTriple(relId, 'rdf:object', objectUri);
      
      // Add properties to reified statement
      for (const [key, value] of Object.entries(properties)) {
        const propValue = typeof value === 'string' ? `"${value}"` : String(value);
        await this.tripleStore.addTriple(relId, `${this.namespace}:${key}`, propValue);
      }
    }
  }

  /**
   * Get relationships for an entity
   */
  async getRelationships(entityId, predicateFilter = null) {
    const subjectUri = `${this.namespace}:${entityId}`;
    const triples = predicateFilter 
      ? await this.tripleStore.query(subjectUri, `${this.namespace}:${predicateFilter}`, null)
      : await this.tripleStore.query(subjectUri, null, null);

    return triples
      .filter(triple => {
        const [, predicate, object] = Array.isArray(triple) ? triple : [triple.subject, triple.predicate, triple.object];
        return predicate.startsWith(`${this.namespace}:`) && 
               object.startsWith(`${this.namespace}:`);
      })
      .map(triple => {
        const [, predicate, object] = Array.isArray(triple) ? triple : [triple.subject, triple.predicate, triple.object];
        return {
          predicate: predicate.replace(`${this.namespace}:`, ''),
          object: object.replace(`${this.namespace}:`, '')
        };
      });
  }

  /**
   * Remove a relationship
   */
  async removeRelationship(subjectId, predicate, objectId) {
    const subjectUri = `${this.namespace}:${subjectId}`;
    const predicateUri = `${this.namespace}:${predicate}`;
    const objectUri = `${this.namespace}:${objectId}`;

    await this.tripleStore.removeTriple(subjectUri, predicateUri, objectUri);
  }

  /**
   * Execute a SPARQL query
   * Note: InMemoryTripleStore doesn't support SPARQL, this is for future compatibility
   */
  async query(sparqlQuery) {
    // For now, we can't execute SPARQL on InMemoryTripleStore
    // This would require a SPARQL parser or different triple store
    throw new Error('SPARQL queries not supported with current triple store');
  }

  /**
   * Find entities with a specific property value
   */
  async findEntitiesWithProperty(propertyName, value) {
    const predicateUri = `${this.namespace}:${propertyName}`;
    const objectValue = typeof value === 'string' ? `"${value}"` : String(value);
    
    const triples = await this.tripleStore.query(null, predicateUri, objectValue);
    
    return triples.map(triple => {
      const [subject] = Array.isArray(triple) ? triple : [triple.subject];
      return subject.replace(`${this.namespace}:`, '');
    });
  }

  /**
   * Find all entities connected to a given entity
   */
  async findConnectedEntities(entityId) {
    const subjectUri = `${this.namespace}:${entityId}`;
    const connected = new Set();

    // Get outgoing connections
    const outgoing = await this.tripleStore.query(subjectUri, null, null);
    for (const triple of outgoing) {
      const [, predicate, object] = Array.isArray(triple) ? triple : [triple.subject, triple.predicate, triple.object];
      if (object.startsWith(`${this.namespace}:`) && 
          predicate !== 'rdf:type') {
        connected.add(object.replace(`${this.namespace}:`, ''));
      }
    }

    // Get incoming connections
    const incoming = await this.tripleStore.query(null, null, subjectUri);
    for (const triple of incoming) {
      const [subject] = Array.isArray(triple) ? triple : [triple.subject];
      if (subject.startsWith(`${this.namespace}:`)) {
        connected.add(subject.replace(`${this.namespace}:`, ''));
      }
    }

    return Array.from(connected);
  }

  /**
   * Extract context from conversation messages
   */
  async extractContext(messages) {
    const entities = [];
    const relationships = [];

    // Simple pattern-based extraction
    for (const message of messages) {
      if (message.role === 'user') {
        const content = message.content;

        // Extract person names (simple pattern)
        const nameMatch = content.match(/[Mm]y name is (\w+)/);
        if (nameMatch) {
          entities.push({ type: 'Person', value: nameMatch[1] });
        }

        // Extract organizations
        const orgMatch = content.match(/work(?:s)? at ([A-Z]\w+(?:\s+[A-Z]\w+)*)/);
        if (orgMatch) {
          entities.push({ type: 'Organization', value: orgMatch[1] });
          
          // Add relationship if we have a person
          const person = entities.find(e => e.type === 'Person');
          if (person) {
            relationships.push({
              subject: person.value,
              predicate: 'worksAt',
              object: orgMatch[1]
            });
          }
        }

        // Extract projects
        const projectMatch = content.match(/project (\w+)/i);
        if (projectMatch) {
          entities.push({ type: 'Project', value: projectMatch[1] });
          
          // Add relationship if context suggests need
          if (content.toLowerCase().includes('need') || content.toLowerCase().includes('help')) {
            const person = entities.find(e => e.type === 'Person');
            if (person) {
              relationships.push({
                subject: person.value,
                predicate: 'needsHelpWith',
                object: projectMatch[1]
              });
            }
          }
        }
      }
    }

    return { entities, relationships };
  }

  /**
   * Infer new facts from existing knowledge
   */
  async inferFacts(entityId) {
    const inferred = [];
    const subjectUri = `${this.namespace}:${entityId}`;

    // Get direct relationships
    const directRels = await this.tripleStore.query(subjectUri, null, null);

    for (const rel of directRels) {
      const [, predicate, object] = Array.isArray(rel) ? rel : [rel.subject, rel.predicate, rel.object];
      // If entity manages a team, check what the team owns
      if (predicate === `${this.namespace}:manages`) {
        const teamRels = await this.tripleStore.query(object, null, null);
        
        for (const teamRel of teamRels) {
          const [, teamPredicate, teamObject] = Array.isArray(teamRel) ? teamRel : [teamRel.subject, teamRel.predicate, teamRel.object];
          if (teamPredicate === `${this.namespace}:owns`) {
            // Infer that manager has access to team's resources
            inferred.push({
              subject: entityId,
              predicate: 'hasAccessTo',
              object: teamObject.replace(`${this.namespace}:`, ''),
              confidence: 0.8
            });
          }
        }
      }
    }

    return inferred;
  }

  /**
   * Export knowledge graph to JSON
   */
  async exportToJSON() {
    const allTriples = await this.tripleStore.query(null, null, null);
    
    return {
      namespace: this.namespace,
      triples: allTriples,
      metadata: {
        exportedAt: new Date().toISOString(),
        tripleCount: allTriples.length
      }
    };
  }

  /**
   * Import knowledge graph from JSON
   */
  async importFromJSON(data) {
    if (data.triples) {
      for (const triple of data.triples) {
        // Handle both array and object format
        const [subject, predicate, object] = Array.isArray(triple) 
          ? triple 
          : [triple.subject, triple.predicate, triple.object];
        
        await this.tripleStore.addTriple(subject, predicate, object);
      }
    }
  }

  /**
   * Clear all data
   */
  async clear() {
    await this.tripleStore.clear();
  }

  /**
   * Get statistics about the knowledge graph
   */
  async getStatistics() {
    const tripleCount = await this.tripleStore.size();
    const typeTriples = await this.tripleStore.query(null, 'rdf:type', null);
    
    const entityTypes = {};
    for (const triple of typeTriples) {
      const [, , object] = Array.isArray(triple) ? triple : [triple.subject, triple.predicate, triple.object];
      const type = object.replace(`${this.namespace}:`, '');
      entityTypes[type] = (entityTypes[type] || 0) + 1;
    }

    return {
      tripleCount,
      entityCount: typeTriples.length,
      entityTypes
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.initialized = false;
    this.tripleStore = null;
  }
}