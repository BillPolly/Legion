/**
 * GellishGenerator - Converts triples back to Gellish expressions
 * 
 * Converts triples back to natural language Gellish expressions
 * and formats query results for human consumption.
 * 
 * CRITICAL: All operations are synchronous following Handle pattern
 */

export class GellishGenerator {
  constructor(dictionary) {
    if (!dictionary) {
      throw new Error('GellishDictionary is required');
    }
    
    this.dictionary = dictionary;
  }

  /**
   * Generate a Gellish expression from a triple
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {string} subject - Subject entity ID
   * @param {string} predicate - Predicate (should be gellish:UID format)
   * @param {string} object - Object entity ID
   * @returns {string} - Natural language Gellish expression
   */
  generate(subject, predicate, object) {
    // Validate inputs
    if (!subject || !predicate || !object) {
      throw new Error("Subject, predicate, and object are required");
    }

    // Extract UID from predicate
    const uid = this.extractUidFromPredicate(predicate);
    if (!uid) {
      throw new Error(`Invalid predicate format: ${predicate}`);
    }

    // Get relation from dictionary
    const relation = this.dictionary.getRelationByUid(uid);
    if (!relation) {
      throw new Error(`Unknown relation UID: ${uid}`);
    }

    // Format entity names
    const subjectText = this.formatEntityName(subject);
    const objectText = this.formatEntityName(object);

    // Generate expression
    return `${subjectText} ${relation.phrase} ${objectText}`;
  }
  
  /**
   * Generate from triple array
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {Array} triple - Triple array [subject, predicate, object]
   * @returns {string} - Natural language Gellish expression
   */
  generateFromTriple(triple) {
    if (!Array.isArray(triple) || triple.length !== 3) {
      throw new Error('Triple must be an array with 3 elements');
    }
    
    return this.generate(triple[0], triple[1], triple[2]);
  }
  
  /**
   * Generate from multiple triples
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {Array<Array>} triples - Array of triple arrays
   * @returns {Array<string>} - Array of Gellish expressions
   */
  generateMultiple(triples) {
    if (!triples || triples.length === 0) {
      return [];
    }
    
    return triples.map(triple => this.generateFromTriple(triple));
  }

  /**
   * Format query results back to natural language
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {Array} results - Array of query result triples
   * @param {string} originalQuery - The original query for context
   * @returns {string} - Formatted natural language results
   */
  generateQueryResults(results, originalQuery) {
    if (results.length === 0) {
      return "No results found.";
    }

    if (results.length === 1) {
      return this.formatEntityName(results[0][0]);
    }

    // Format multiple results
    const entities = results.map(result => this.formatEntityName(result[0]));
    return entities.join(', ');
  }

  /**
   * Extract UID from gellish predicate
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {string} predicate - Predicate in format "gellish:UID"
   * @returns {number|null} - Extracted UID or null if invalid
   */
  extractUidFromPredicate(predicate) {
    if (!predicate || typeof predicate !== 'string') {
      return null;
    }

    const match = predicate.match(/^gellish:(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Format entity ID to human-readable name
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {string} entityId - Entity ID (e.g., "pump_p101")
   * @returns {string} - Formatted name (e.g., "Pump P101")
   */
  formatEntityName(entityId) {
    if (!entityId || typeof entityId !== 'string') {
      return entityId || '';
    }

    // Handle special characters by preserving them
    if (entityId.includes('-') || entityId.includes('/')) {
      // For entities with special chars, only capitalize first letter
      return entityId.charAt(0).toUpperCase() + entityId.slice(1);
    }

    // Split by underscores and capitalize each word
    return entityId
      .split('_')
      .map(word => {
        if (word.length === 0) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }
  
  /**
   * Format entity ID to identifier format (inverse of formatEntityName)
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {string} entityName - Human-readable name (e.g., "Pump P101")
   * @returns {string} - Entity ID (e.g., "pump_p101")
   */
  formatEntityId(entityName) {
    if (!entityName || typeof entityName !== 'string') {
      return entityName || '';
    }
    
    // Convert to lowercase and replace spaces with underscores
    return entityName.toLowerCase().replace(/\s+/g, '_');
  }
}