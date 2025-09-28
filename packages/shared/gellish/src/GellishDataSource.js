/**
 * GellishDataSource - DataSource implementation for Gellish CNL
 * 
 * Wraps any base DataSource to add Gellish Controlled Natural Language capabilities.
 * Translates Gellish expressions to Handle queries and vice versa.
 * 
 * CRITICAL: All operations are synchronous following Handle pattern
 */

import { validateDataSourceInterface } from '@legion/handle';
import { GellishDictionary } from './GellishDictionary.js';

export class GellishDataSource {
  constructor(baseDataSource, options = {}) {
    // Validate the base DataSource
    validateDataSourceInterface(baseDataSource, 'Base DataSource');
    
    this.baseDataSource = baseDataSource;
    this.dictionary = options.dictionary || new GellishDictionary();
    this.options = options;
    
    // Track Gellish-specific data
    this._gellishTriples = new Map(); // Store triples indexed by subject
    this._inverseTriples = new Map(); // Store inverse relations
  }
  
  /**
   * Execute query - translates Gellish queries to base queries
   * CRITICAL: Must be synchronous - no await!
   */
  query(querySpec) {
    // Handle Gellish-specific queries
    if (querySpec.gellish) {
      return this.executeGellishQuery(querySpec.gellish);
    }
    
    // Handle triple pattern queries
    if (querySpec.triple) {
      const [subject, predicate, object] = querySpec.triple;
      return this.queryTriple(subject, predicate, object);
    }
    
    // Pass through to base DataSource
    return this.baseDataSource.query(querySpec);
  }
  
  /**
   * Set up subscription - supports Gellish patterns
   * CRITICAL: Must be synchronous - no await!
   */
  subscribe(querySpec, callback) {
    // Wrap callback to translate results if needed
    const wrappedCallback = (changes) => {
      if (querySpec.gellish) {
        // Translate changes to Gellish format
        const gellishChanges = this.translateToGellish(changes);
        callback(gellishChanges);
      } else {
        callback(changes);
      }
    };
    
    // Subscribe through base DataSource
    return this.baseDataSource.subscribe(querySpec, wrappedCallback);
  }
  
  /**
   * Get schema - extends base schema with Gellish capabilities
   * CRITICAL: Must be synchronous - no await!
   */
  getSchema() {
    const baseSchema = this.baseDataSource.getSchema();
    
    // Extend with Gellish-specific schema information
    return {
      ...baseSchema,
      gellish: {
        version: '1.0.0',
        relations: this.dictionary.getStats().totalRelations,
        domains: this.dictionary.getStats().domains,
        capabilities: {
          naturalLanguageAssertions: true,
          naturalLanguageQueries: true,
          relationInference: true,
          typeAwareQueries: true
        }
      }
    };
  }
  
  /**
   * Update data - handles Gellish assertions
   * CRITICAL: Must be synchronous - no await!
   */
  update(updateSpec) {
    // Handle Gellish assertion
    if (updateSpec.assert) {
      return this.storeGellishAssertion(updateSpec.assert);
    }
    
    // Handle batch assertions
    if (updateSpec.assertions) {
      const results = updateSpec.assertions.map(assertion => 
        this.storeGellishAssertion(assertion)
      );
      return {
        success: results.every(r => r.success),
        results: results
      };
    }
    
    // Pass through to base DataSource
    return this.baseDataSource.update(updateSpec);
  }
  
  /**
   * Create query builder for Gellish-aware queries
   * CRITICAL: Must be synchronous - no await!
   */
  queryBuilder(sourceHandle) {
    // Get base query builder
    const baseBuilder = this.baseDataSource.queryBuilder(sourceHandle);
    
    // Extend with Gellish-specific methods
    const gellishBuilder = Object.create(baseBuilder);
    
    // Add Gellish-specific query methods
    gellishBuilder.whereRelation = function(relationPhrase) {
      const uid = this.dictionary.findRelation(relationPhrase);
      if (!uid) {
        throw new Error(`Unknown relation: ${relationPhrase}`);
      }
      return this.where(entity => {
        // Check if entity has this relation
        const triples = this._getEntityTriples(entity.id);
        return triples.some(t => t.predicate === `gellish:${uid}`);
      });
    };
    
    gellishBuilder.withType = function(entityType) {
      return this.where(entity => entity.type === entityType);
    };
    
    return gellishBuilder;
  }
  
  // Gellish-specific methods
  
  /**
   * Store a Gellish assertion as a triple
   * @param {Array|Object} assertion - Triple array or parsed assertion object
   */
  storeGellishAssertion(assertion) {
    let triple;
    
    if (Array.isArray(assertion)) {
      triple = assertion;
    } else if (assertion.subject && assertion.predicate && assertion.object) {
      triple = [assertion.subject, assertion.predicate, assertion.object];
    } else {
      throw new Error('Invalid assertion format');
    }
    
    const [subject, predicate, object] = triple;
    
    // Store in triple map
    if (!this._gellishTriples.has(subject)) {
      this._gellishTriples.set(subject, []);
    }
    this._gellishTriples.get(subject).push({ predicate, object });
    
    // Store inverse for bidirectional queries
    if (!this._inverseTriples.has(object)) {
      this._inverseTriples.set(object, []);
    }
    this._inverseTriples.get(object).push({ predicate, subject });
    
    // Also store in base DataSource if it supports updates
    try {
      const baseResult = this.baseDataSource.update({
        entity: subject,
        attribute: predicate,
        value: object
      });
      
      return {
        success: true,
        triple: triple,
        baseResult: baseResult
      };
    } catch (error) {
      // Base DataSource doesn't support updates, just use local storage
      return {
        success: true,
        triple: triple,
        localOnly: true
      };
    }
  }
  
  /**
   * Query triples by pattern
   * @param {string|null} subject - Subject pattern or null for wildcard
   * @param {string|null} predicate - Predicate pattern or null for wildcard
   * @param {string|null} object - Object pattern or null for wildcard
   */
  queryTriple(subject, predicate, object) {
    const results = [];
    
    // Query by subject
    if (subject && !predicate && !object) {
      const triples = this._gellishTriples.get(subject) || [];
      triples.forEach(t => {
        results.push([subject, t.predicate, t.object]);
      });
    }
    // Query by object (inverse)
    else if (!subject && !predicate && object) {
      const inverseTriples = this._inverseTriples.get(object) || [];
      inverseTriples.forEach(t => {
        results.push([t.subject, t.predicate, object]);
      });
    }
    // Query by subject and predicate
    else if (subject && predicate && !object) {
      const triples = this._gellishTriples.get(subject) || [];
      triples
        .filter(t => t.predicate === predicate)
        .forEach(t => {
          results.push([subject, t.predicate, t.object]);
        });
    }
    // Query by predicate and object
    else if (!subject && predicate && object) {
      const inverseTriples = this._inverseTriples.get(object) || [];
      inverseTriples
        .filter(t => t.predicate === predicate)
        .forEach(t => {
          results.push([t.subject, t.predicate, object]);
        });
    }
    // Full pattern match
    else if (subject && predicate && object) {
      const triples = this._gellishTriples.get(subject) || [];
      const match = triples.find(t => 
        t.predicate === predicate && t.object === object
      );
      if (match) {
        results.push([subject, predicate, object]);
      }
    }
    // Query all (null, null, null)
    else if (!subject && !predicate && !object) {
      for (const [subj, triples] of this._gellishTriples) {
        triples.forEach(t => {
          results.push([subj, t.predicate, t.object]);
        });
      }
    }
    // Query by predicate only
    else if (!subject && predicate && !object) {
      for (const [subj, triples] of this._gellishTriples) {
        triples
          .filter(t => t.predicate === predicate)
          .forEach(t => {
            results.push([subj, t.predicate, t.object]);
          });
      }
    }
    
    return results;
  }
  
  /**
   * Execute a Gellish-specific query
   * @param {Object} gellishQuery - Parsed Gellish query object
   */
  executeGellishQuery(gellishQuery) {
    if (gellishQuery.pattern) {
      // Triple pattern query
      return this.queryTriple(
        gellishQuery.pattern[0],
        gellishQuery.pattern[1],
        gellishQuery.pattern[2]
      );
    }
    
    if (gellishQuery.typeFilter) {
      // Type-filtered query
      const baseResults = this.queryTriple(
        gellishQuery.basePattern[0],
        gellishQuery.basePattern[1],
        gellishQuery.basePattern[2]
      );
      
      // Filter by type
      return baseResults.filter(triple => {
        const entityId = triple[0];
        const typeTriples = this.queryTriple(entityId, 'rdf:type', null);
        return typeTriples.some(t => t[2] === gellishQuery.typeFilter);
      });
    }
    
    // Default to empty results
    return [];
  }
  
  /**
   * Translate changes to Gellish format
   * @param {*} changes - Changes from base DataSource
   */
  translateToGellish(changes) {
    // This would translate base DataSource changes to Gellish triple format
    // Implementation depends on base DataSource format
    return changes;
  }
  
  /**
   * Get all triples for an entity
   * @param {string} entityId - Entity identifier
   */
  _getEntityTriples(entityId) {
    const triples = [];
    const directTriples = this._gellishTriples.get(entityId) || [];
    directTriples.forEach(t => {
      triples.push({
        subject: entityId,
        predicate: t.predicate,
        object: t.object
      });
    });
    return triples;
  }
  
  // Convenience methods for direct triple operations
  
  /**
   * Assert a triple directly
   * Convenience method that wraps storeGellishAssertion
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {string} subject - Subject entity ID
   * @param {string} predicate - Predicate (gellish:UID format)
   * @param {string} object - Object entity ID
   * @returns {Object} - Result with success flag
   */
  assertTriple(subject, predicate, object) {
    return this.storeGellishAssertion([subject, predicate, object]);
  }
  
  /**
   * Query triples with convenient parameter names
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {string|null} subject - Subject pattern or null
   * @param {string|null} predicate - Predicate pattern or null
   * @param {string|null} object - Object pattern or null
   * @returns {Array<Array>} - Array of matching triples
   */
  queryTriples(subject, predicate, object) {
    return this.queryTriple(subject, predicate, object);
  }
  
  /**
   * Get all facts about an entity
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {string} entityId - Entity identifier
   * @returns {Array<Array>} - Array of triples where entity is subject
   */
  factsAboutEntity(entityId) {
    return this.queryTriple(entityId, null, null);
  }
  
  /**
   * Clear all stored triples
   * CRITICAL: Synchronous operation - no await!
   */
  clear() {
    this._gellishTriples.clear();
    this._inverseTriples.clear();
  }
}