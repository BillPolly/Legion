/**
 * GellishParser - Converts Gellish expressions to triples
 * 
 * Parses Gellish natural language expressions into [subject, predicate, object] triples
 * using EntityRecognizer and GellishDictionary components.
 * 
 * CRITICAL: All operations are synchronous following Handle pattern
 */

export class GellishParser {
  constructor(dictionary, entityRecognizer) {
    if (!dictionary) {
      throw new Error('GellishDictionary is required');
    }
    if (!entityRecognizer) {
      throw new Error('EntityRecognizer is required');
    }
    
    this.dictionary = dictionary;
    this.entityRecognizer = entityRecognizer;
  }

  /**
   * Parse a Gellish expression into a triple
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {string} expression - The Gellish expression to parse
   * @returns {Array} - Triple array [subject, predicate, object]
   * @throws {Error} - If the expression cannot be parsed
   */
  parse(expression) {
    // Handle empty or whitespace-only expressions
    if (!expression || expression.trim().length === 0) {
      throw new Error(`Could not parse expression: ${expression}`);
    }

    // Use EntityRecognizer to identify components
    const recognized = this.entityRecognizer.recognize(expression);
    
    // Validate that all required components are present
    if (!recognized.leftObject || !recognized.relation || !recognized.rightObject) {
      throw new Error(`Could not parse expression: ${expression}`);
    }

    // Extract components
    const subject = recognized.leftObject.id;
    const predicate = `gellish:${recognized.relation.uid}`;
    const object = recognized.rightObject.id;
    
    return [subject, predicate, object];
  }

  /**
   * Parse multiple Gellish expressions into triples
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {Array<string>} expressions - Array of Gellish expressions
   * @returns {Array<Array>} - Array of triple arrays
   */
  parseMultiple(expressions) {
    if (!expressions || expressions.length === 0) {
      return [];
    }
    
    return expressions.map(expr => this.parse(expr));
  }
  
  /**
   * Parse expression and return detailed parse result
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {string} expression - The Gellish expression to parse
   * @returns {Object} - Detailed parse result with triple and metadata
   */
  parseDetailed(expression) {
    const recognized = this.entityRecognizer.recognize(expression);
    
    if (!recognized.leftObject || !recognized.relation || !recognized.rightObject) {
      return {
        success: false,
        error: `Could not parse expression: ${expression}`,
        recognized: recognized
      };
    }
    
    const triple = [
      recognized.leftObject.id,
      `gellish:${recognized.relation.uid}`,
      recognized.rightObject.id
    ];
    
    return {
      success: true,
      triple: triple,
      leftObject: recognized.leftObject,
      relation: recognized.relation,
      rightObject: recognized.rightObject,
      originalExpression: expression
    };
  }
}