/**
 * GellishParser - Converts Gellish expressions to KG triples
 * 
 * Parses Gellish natural language expressions into knowledge graph triples
 * using the existing EntityRecognizer and GellishDictionary components.
 */

export class GellishParser {
  constructor(dictionary, entityRecognizer) {
    this.dictionary = dictionary;
    this.entityRecognizer = entityRecognizer;
  }

  /**
   * Parse a Gellish expression into a KG triple
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
   * Parse multiple Gellish expressions into KG triples
   * @param {Array<string>} expressions - Array of Gellish expressions
   * @returns {Array<Array>} - Array of triple arrays
   */
  parseMultiple(expressions) {
    if (!expressions || expressions.length === 0) {
      return [];
    }
    
    return expressions.map(expr => this.parse(expr));
  }
}
