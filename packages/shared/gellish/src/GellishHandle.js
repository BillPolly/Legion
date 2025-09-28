/**
 * GellishHandle - Handle wrapper that adds Gellish CNL capabilities
 * 
 * Wraps any Handle to provide Controlled Natural Language interface.
 * Allows assertions and queries using Gellish expressions while
 * maintaining all Handle capabilities.
 * 
 * CRITICAL: All operations are synchronous following Handle pattern
 */

import { validateDataSourceInterface } from '@legion/handle';
import { GellishDataSource } from './GellishDataSource.js';
import { GellishDictionary } from './GellishDictionary.js';
import { EntityRecognizer } from './EntityRecognizer.js';

export class GellishHandle {
  constructor(baseHandle, options = {}) {
    if (!baseHandle) {
      throw new Error('Base Handle is required');
    }
    
    // Verify it's a Handle by checking for required properties
    if (!baseHandle.dataSource || typeof baseHandle.query !== 'function') {
      throw new Error('Invalid Handle: missing required Handle properties');
    }
    
    this.baseHandle = baseHandle;
    this.dictionary = options.dictionary || new GellishDictionary();
    this.recognizer = new EntityRecognizer(this.dictionary, baseHandle);
    
    // Wrap the Handle's DataSource with Gellish capabilities
    this.gellishDataSource = new GellishDataSource(
      baseHandle.dataSource,
      {
        dictionary: this.dictionary
      }
    );
    
    // Track assertions made through this handle
    this._assertions = [];
    this._queryHistory = [];
  }
  
  /**
   * Assert a fact using Gellish CNL
   * Examples:
   *   - "Pump P101 is part of System S200"
   *   - "System S200 is owned by Siemens"
   *   - "Pump P101 is manufactured by KSB"
   * 
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {string} gellishExpression - The Gellish assertion
   * @returns {Object} Assertion result with parsed triple and status
   */
  assert(gellishExpression) {
    if (!gellishExpression || typeof gellishExpression !== 'string') {
      throw new Error('Gellish expression must be a non-empty string');
    }
    
    // Parse the Gellish expression
    const parsed = this.recognizer.recognize(gellishExpression);
    
    if (!parsed.leftObject || !parsed.relation || !parsed.rightObject) {
      throw new Error(`Invalid Gellish expression: "${gellishExpression}"`);
    }
    
    // Get relation UID
    const relationUid = this.dictionary.findRelation(parsed.relation.text);
    if (!relationUid) {
      throw new Error(`Unknown relation: "${parsed.relation.text}"`);
    }
    
    // Create triple
    const triple = [
      parsed.leftObject.text,
      `gellish:${relationUid}`,
      parsed.rightObject.text
    ];
    
    // Store through Gellish DataSource
    const result = this.gellishDataSource.storeGellishAssertion({
      subject: parsed.leftObject.text,
      predicate: `gellish:${relationUid}`,
      object: parsed.rightObject.text,
      metadata: {
        originalExpression: gellishExpression,
        parsedAt: new Date().toISOString(),
        leftObjectType: parsed.leftObject.type,
        rightObjectType: parsed.rightObject.type,
        relationPhrase: parsed.relation.text
      }
    });
    
    // Track assertion
    this._assertions.push({
      expression: gellishExpression,
      triple: triple,
      timestamp: new Date().toISOString(),
      result: result
    });
    
    return {
      success: result.success,
      triple: triple,
      parsed: parsed,
      metadata: result
    };
  }
  
  /**
   * Query using Gellish CNL
   * Examples:
   *   - "What is part of System S200?"
   *   - "Which pumps are manufactured by KSB?"
   *   - "System S200 consists of what?"
   * 
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {string} gellishQuery - The Gellish query
   * @returns {Array} Query results
   */
  ask(gellishQuery) {
    if (!gellishQuery || typeof gellishQuery !== 'string') {
      throw new Error('Gellish query must be a non-empty string');
    }
    
    // Parse the query
    const parsed = this.recognizer.recognizeQuery(gellishQuery);
    
    if (!parsed.questionWord || !parsed.relation) {
      throw new Error(`Invalid Gellish query: "${gellishQuery}"`);
    }
    
    // Get relation UID
    const relationUid = this.dictionary.findRelation(parsed.relation.text);
    if (!relationUid) {
      throw new Error(`Unknown relation: "${parsed.relation.text}"`);
    }
    
    // Build triple pattern based on query structure
    let triplePattern;
    
    if (parsed.object) {
      // Pattern: "What/Which [type] relation object?"
      // Example: "What is part of System S200?"
      triplePattern = [null, `gellish:${relationUid}`, parsed.object.text];
    } else if (parsed.questionWord.text.toLowerCase().startsWith('which')) {
      // Pattern: "Which [type] relation?"
      // Example: "Which pumps are manufactured by KSB?"
      const entityType = parsed.questionWord.entityType || 'entity';
      triplePattern = [null, `gellish:${relationUid}`, null];
    } else {
      // General pattern with unknown
      triplePattern = [null, `gellish:${relationUid}`, null];
    }
    
    // Execute query through Gellish DataSource
    const results = this.gellishDataSource.executeGellishQuery({
      pattern: triplePattern,
      typeFilter: parsed.questionWord.entityType
    });
    
    // Track query
    this._queryHistory.push({
      query: gellishQuery,
      parsed: parsed,
      pattern: triplePattern,
      timestamp: new Date().toISOString(),
      resultCount: results.length
    });
    
    // Format results based on query type
    return this._formatQueryResults(results, parsed);
  }
  
  /**
   * Query for all facts about an entity
   * 
   * @param {string} entity - The entity to query about
   * @returns {Array} All triples involving the entity
   */
  factsAbout(entity) {
    if (!entity || typeof entity !== 'string') {
      throw new Error('Entity must be a non-empty string');
    }
    
    // Query all triples with entity as subject
    const subjectTriples = this.gellishDataSource.queryTriple(entity, null, null);
    
    // Query all triples with entity as object
    const objectTriples = this.gellishDataSource.queryTriple(null, null, entity);
    
    // Combine and deduplicate
    const allTriples = [...subjectTriples];
    objectTriples.forEach(triple => {
      if (!allTriples.some(t => 
        t[0] === triple[0] && t[1] === triple[1] && t[2] === triple[2]
      )) {
        allTriples.push(triple);
      }
    });
    
    // Convert to Gellish expressions
    return allTriples.map(triple => this._tripleToGellish(triple));
  }
  
  /**
   * Get all entities that have a specific relation to a given entity
   * 
   * @param {string} entity - The entity
   * @param {string} relationPhrase - The relation phrase
   * @returns {Array} Entities with the specified relation
   */
  relatedTo(entity, relationPhrase) {
    const relationUid = this.dictionary.findRelation(relationPhrase);
    if (!relationUid) {
      throw new Error(`Unknown relation: "${relationPhrase}"`);
    }
    
    // Query for entities with this relation
    const results = this.gellishDataSource.queryTriple(
      entity,
      `gellish:${relationUid}`,
      null
    );
    
    return results.map(triple => triple[2]);
  }
  
  /**
   * Get all entities that have the inverse relation to a given entity
   * 
   * @param {string} entity - The entity
   * @param {string} relationPhrase - The relation phrase (will use inverse)
   * @returns {Array} Entities with the inverse relation
   */
  inverseRelatedTo(entity, relationPhrase) {
    const relationUid = this.dictionary.findRelation(relationPhrase);
    if (!relationUid) {
      throw new Error(`Unknown relation: "${relationPhrase}"`);
    }
    
    // Query for entities with this relation as object
    const results = this.gellishDataSource.queryTriple(
      null,
      `gellish:${relationUid}`,
      entity
    );
    
    return results.map(triple => triple[0]);
  }
  
  /**
   * Subscribe to changes involving specific entities or relations
   * 
   * @param {Object} pattern - Pattern to monitor
   * @param {Function} callback - Callback for changes
   * @returns {Object} Subscription object
   */
  watch(pattern, callback) {
    // Build query spec from pattern
    const querySpec = {};
    
    if (pattern.entity) {
      querySpec.gellish = {
        entity: pattern.entity
      };
    } else if (pattern.relation) {
      const relationUid = this.dictionary.findRelation(pattern.relation);
      if (relationUid) {
        querySpec.gellish = {
          relation: `gellish:${relationUid}`
        };
      }
    } else if (pattern.triple) {
      querySpec.triple = pattern.triple;
    }
    
    // Subscribe through Gellish DataSource
    return this.gellishDataSource.subscribe(querySpec, (changes) => {
      // Convert changes to Gellish format
      const gellishChanges = changes.map(change => {
        if (Array.isArray(change) && change.length === 3) {
          return this._tripleToGellish(change);
        }
        return change;
      });
      
      callback(gellishChanges);
    });
  }
  
  /**
   * Get schema extended with Gellish capabilities
   * 
   * @returns {Object} Extended schema
   */
  getSchema() {
    return this.gellishDataSource.getSchema();
  }
  
  /**
   * Get statistics about assertions and queries
   * 
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      assertionCount: this._assertions.length,
      queryCount: this._queryHistory.length,
      dictionaryStats: this.dictionary.getStats(),
      lastAssertion: this._assertions[this._assertions.length - 1],
      lastQuery: this._queryHistory[this._queryHistory.length - 1]
    };
  }
  
  /**
   * Clear all assertions (local cache only)
   */
  clearAssertions() {
    this._assertions = [];
    this._queryHistory = [];
  }
  
  // Access to underlying components
  
  /**
   * Get the underlying Handle
   * @returns {Handle} The base Handle
   */
  getHandle() {
    return this.baseHandle;
  }
  
  /**
   * Get the Gellish dictionary
   * @returns {GellishDictionary} The dictionary
   */
  getDictionary() {
    return this.dictionary;
  }
  
  /**
   * Get the entity recognizer
   * @returns {EntityRecognizer} The recognizer
   */
  getRecognizer() {
    return this.recognizer;
  }
  
  // Private helper methods
  
  /**
   * Convert a triple to Gellish expression
   */
  _tripleToGellish(triple) {
    const [subject, predicate, object] = triple;
    
    // Extract UID from predicate
    const uidMatch = predicate.match(/gellish:(\d+)/);
    if (!uidMatch) {
      return `${subject} ${predicate} ${object}`;
    }
    
    const uid = parseInt(uidMatch[1]);
    const relation = this.dictionary.getRelationByUid(uid);
    
    if (!relation) {
      return `${subject} ${predicate} ${object}`;
    }
    
    return `${subject} ${relation.phrase} ${object}`;
  }
  
  /**
   * Format query results based on the parsed query
   */
  _formatQueryResults(results, parsed) {
    // Format based on question type
    if (parsed.questionWord.text.toLowerCase() === 'what') {
      // Return just the entities
      return results.map(triple => triple[0] || triple[2]);
    } else if (parsed.questionWord.text.toLowerCase().startsWith('which')) {
      // Return entities with their types if available
      return results.map(triple => {
        const entity = triple[0] || triple[2];
        const type = this.recognizer.classifyEntityFromHandle(entity);
        return {
          entity: entity,
          type: type,
          triple: triple
        };
      });
    } else {
      // Return full triples
      return results;
    }
  }
}

/**
 * Factory function to create a GellishHandle from a base Handle
 * 
 * @param {Handle} baseHandle - The Handle to wrap
 * @param {Object} options - Options for GellishHandle
 * @returns {GellishHandle} The wrapped Handle with CNL capabilities
 */
export function wrapWithGellish(baseHandle, options = {}) {
  return new GellishHandle(baseHandle, options);
}