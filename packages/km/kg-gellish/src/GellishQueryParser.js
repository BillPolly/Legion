/**
 * GellishQueryParser - Converts Gellish queries to KG query patterns
 * 
 * Parses Gellish natural language queries into knowledge graph query patterns
 * using the existing EntityRecognizer and GellishDictionary components.
 */

export class GellishQueryParser {
  constructor(dictionary, entityRecognizer) {
    this.dictionary = dictionary;
    this.entityRecognizer = entityRecognizer;
  }

  /**
   * Parse a Gellish query into a KG query pattern
   * @param {string} query - The Gellish query to parse
   * @returns {Array} - Query pattern array [subject, predicate, object] with null for variables
   * @throws {Error} - If the query cannot be parsed
   */
  parseQuery(query) {
    // Handle empty or whitespace-only queries
    if (!query || query.trim().length === 0) {
      throw new Error(`Could not parse query: ${query}`);
    }

    // Clean up the query (remove question marks, normalize whitespace)
    const cleanQuery = this.cleanQuery(query);
    
    // Use EntityRecognizer to identify query components
    const recognized = this.entityRecognizer.recognizeQuery(cleanQuery);
    
    // Check if we have a valid query structure
    if (!recognized.questionWord || !recognized.relation) {
      throw new Error(`Could not parse query: ${query}`);
    }

    // Determine query pattern based on question word position and relation
    return this.buildQueryPattern(recognized, cleanQuery);
  }

  /**
   * Parse a type-filtered query (e.g., "Which pumps are part of System S200?")
   * @param {string} query - The type-filtered query to parse
   * @returns {Object} - Type-filtered query structure
   * @throws {Error} - If the query cannot be parsed
   */
  parseTypeFilteredQuery(query) {
    // Handle empty or whitespace-only queries
    if (!query || query.trim().length === 0) {
      throw new Error(`Could not parse type-filtered query: ${query}`);
    }

    const tokens = this.tokenize(query.toLowerCase());
    
    // Must start with "which"
    if (tokens[0] !== 'which') {
      throw new Error(`Could not parse type-filtered query: ${query}`);
    }

    if (tokens.length < 2) {
      throw new Error(`Could not parse type-filtered query: ${query}`);
    }

    // Extract entity type (remove plural 's' and capitalize)
    let entityType = tokens[1].endsWith('s') ? tokens[1].slice(0, -1) : tokens[1];
    entityType = entityType.charAt(0).toUpperCase() + entityType.slice(1);
    
    // Build the rest of the query as a "What" query
    const restOfQuery = tokens.slice(2).join(' ');
    const whatQuery = `What ${restOfQuery}`;
    
    try {
      const basePattern = this.parseQuery(whatQuery);
      
      return {
        type: 'type-filtered',
        basePattern: basePattern,
        entityType: entityType,
        originalQuery: query
      };
    } catch (error) {
      throw new Error(`Could not parse type-filtered query: ${query}`);
    }
  }

  /**
   * Clean and normalize a query string
   * @param {string} query - The query to clean
   * @returns {string} - The cleaned query
   */
  cleanQuery(query) {
    return query
      .replace(/\?+$/, '') // Remove trailing question marks
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Tokenize a query string
   * @param {string} query - The query to tokenize
   * @returns {Array<string>} - Array of tokens
   */
  tokenize(query) {
    return query.split(/\s+/).filter(token => token.length > 0);
  }

  /**
   * Build a query pattern from recognized components
   * @param {Object} recognized - The recognized query components
   * @param {string} originalQuery - The original query string
   * @returns {Array} - Query pattern [subject, predicate, object]
   */
  buildQueryPattern(recognized, originalQuery) {
    const predicate = `gellish:${recognized.relation.uid}`;
    
    // Check if this is an inverse pattern by looking at the original query
    const tokens = this.tokenize(originalQuery.toLowerCase());
    const whatIndex = tokens.findIndex(token => ['what', 'who'].includes(token));
    
    if (whatIndex > 0) {
      // Inverse pattern: "System S200 consists of what?" → ["system_s200", "gellish:1230", null]
      // The object from EntityRecognizer is actually the subject in this case
      if (recognized.object) {
        return [recognized.object.id, predicate, null];
      }
    } else if (recognized.questionWord && recognized.object) {
      // Normal pattern: "What is part of System S200?" → [null, "gellish:1230", "system_s200"]
      return [null, predicate, recognized.object.id];
    }
    
    throw new Error(`Could not parse query: ${originalQuery}`);
  }
}
