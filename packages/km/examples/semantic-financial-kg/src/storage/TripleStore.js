/**
 * TripleStore - RDF triple storage using @legion/triplestore InMemoryProvider
 *
 * Provides simple interface for storing and querying RDF triples
 * generated from entity models.
 */

import { InMemoryProvider } from '@legion/triplestore';

export class TripleStore {
  constructor(config = {}) {
    // Create InMemory provider (DataScriptProvider has a bug with imports)
    this.provider = new InMemoryProvider();
  }

  /**
   * Add a single triple to the store
   * @param {string} subject - Subject URI
   * @param {string} predicate - Predicate URI
   * @param {string|number} object - Object value or URI
   * @returns {Promise<boolean>} - True if added
   */
  async addTriple(subject, predicate, object) {
    return await this.provider.addTriple(subject, predicate, object);
  }

  /**
   * Add a single triple to the store (alias for addTriple)
   * @param {string} subject - Subject URI
   * @param {string} predicate - Predicate URI
   * @param {string|number} object - Object value or URI
   * @returns {Promise<boolean>} - True if added
   */
  async add(subject, predicate, object) {
    return await this.addTriple(subject, predicate, object);
  }

  /**
   * Add multiple triples at once
   * @param {Array<Array>} triples - Array of [subject, predicate, object] arrays
   * @returns {Promise<number>} - Number of triples added
   */
  async addTriples(triples) {
    let count = 0;
    for (const [subject, predicate, object] of triples) {
      const added = await this.provider.addTriple(subject, predicate, object);
      if (added) count++;
    }
    return count;
  }

  /**
   * Store entity model as RDF triples
   * @param {Object} entityModel - { entities: [...], relationships: [...] }
   * @returns {Promise<number>} - Number of triples stored
   */
  async storeEntityModel(entityModel) {
    const triples = [];

    // Entity type assertions
    for (const entity of entityModel.entities) {
      triples.push([entity.uri, 'rdf:type', entity.type]);

      // Store label
      if (entity.label) {
        triples.push([entity.uri, 'rdfs:label', entity.label]);
      }

      // Store datatype properties
      if (entity.properties) {
        for (const [propName, propValue] of Object.entries(entity.properties)) {
          triples.push([entity.uri, propName, propValue]);
        }
      }
    }

    // Relationships
    for (const rel of entityModel.relationships) {
      triples.push([rel.subject, rel.predicate, rel.object]);
    }

    return await this.addTriples(triples);
  }

  /**
   * Query triples by pattern
   * @param {string|null} subject - Subject pattern (null for wildcard)
   * @param {string|null} predicate - Predicate pattern (null for wildcard)
   * @param {string|null} object - Object pattern (null for wildcard)
   * @returns {Promise<Array<Array>>} - Matching triples
   */
  async query(subject, predicate, object) {
    return await this.provider.query(subject, predicate, object);
  }

  /**
   * Get all triples for an entity
   * @param {string} entityUri - Entity URI
   * @returns {Promise<Array<Array>>} - All triples with entity as subject
   */
  async getEntity(entityUri) {
    return await this.provider.query(entityUri, null, null);
  }

  /**
   * Get all entities of a specific type
   * @param {string} typeUri - Type/class URI
   * @returns {Promise<Array<string>>} - Array of entity URIs
   */
  async getEntitiesByType(typeUri) {
    const triples = await this.provider.query(null, 'rdf:type', typeUri);
    return triples.map(([subject, _predicate, _object]) => subject);
  }

  /**
   * Get all relationships using a specific property
   * @param {string} propertyUri - Property URI
   * @returns {Promise<Array<{subject: string, object: string}>>} - Array of subject-object pairs
   */
  async getRelationshipsByProperty(propertyUri) {
    const triples = await this.provider.query(null, propertyUri, null);
    return triples.map(([subject, _predicate, object]) => ({
      subject,
      object
    }));
  }

  /**
   * Get count of triples in store
   * @returns {Promise<number>} - Number of triples
   */
  async size() {
    return await this.provider.size();
  }

  /**
   * Clear all triples from store
   * @returns {Promise<void>}
   */
  async clear() {
    return await this.provider.clear();
  }

  /**
   * Remove a triple from the store
   * @param {string} subject - Subject URI
   * @param {string} predicate - Predicate URI
   * @param {string|number} object - Object value or URI
   * @returns {Promise<boolean>} - True if removed
   */
  async removeTriple(subject, predicate, object) {
    return await this.provider.removeTriple(subject, predicate, object);
  }

  /**
   * Remove a triple from the store (alias for removeTriple)
   * @param {string} subject - Subject URI
   * @param {string} predicate - Predicate URI
   * @param {string|number} object - Object value or URI
   * @returns {Promise<boolean>} - True if removed
   */
  async remove(subject, predicate, object) {
    return await this.removeTriple(subject, predicate, object);
  }

  /**
   * Get metadata about the store
   * @returns {Object} - Store metadata
   */
  getMetadata() {
    return this.provider.getMetadata();
  }
}
