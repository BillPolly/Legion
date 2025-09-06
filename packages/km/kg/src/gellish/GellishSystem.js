import { GellishDictionary } from './GellishDictionary.js';
import { EntityRecognizer } from './EntityRecognizer.js';
import { GellishParser } from './GellishParser.js';
import { GellishQueryParser } from './GellishQueryParser.js';
import { GellishGenerator } from './GellishGenerator.js';
import { GellishValidator } from './GellishValidator.js';
import { PatternQuery, LogicalQuery } from '../query/index.js';

/**
 * GellishSystem - Main interface integrating all components
 * 
 * Provides natural language interface for expressing facts and querying
 * the knowledge graph using Gellish Controlled Natural Language.
 */
export class GellishSystem {
  constructor(kgEngine) {
    this.kg = kgEngine;
    this.dictionary = new GellishDictionary();
    this.entityRecognizer = new EntityRecognizer(this.dictionary);
    this.parser = new GellishParser(this.dictionary, this.entityRecognizer);
    this.queryParser = new GellishQueryParser(this.dictionary, this.entityRecognizer);
    this.generator = new GellishGenerator(this.dictionary);
    this.validator = new GellishValidator(this.dictionary);
  }

  /**
   * Assert a fact in natural language
   * @param {string} expression - Gellish expression like "Pump P101 is part of System S200"
   * @returns {boolean} - True if successful
   */
  assert(expression) {
    // Validate the expression
    const validation = this.validator.validate(expression);
    if (!validation.valid) {
      throw new Error(`Invalid expression: ${validation.error}`);
    }

    // Parse the expression to a triple
    const triple = this.parser.parse(expression);
    
    // Store in the knowledge graph
    this.kg.addTriple(triple[0], triple[1], triple[2]);
    
    // For symmetric relationships, also store the inverse
    // This enables queries like "System S200 consists of what?" to work
    const relationUid = this.extractUidFromPredicate(triple[1]);
    if (this.isSymmetricRelation(relationUid)) {
      // Store the inverse triple with the same predicate
      this.kg.addTriple(triple[2], triple[1], triple[0]);
    }
    
    return true;
  }

  /**
   * Check if a relation is symmetric (has meaningful inverse)
   * @param {number} uid - The Gellish relation UID
   * @returns {boolean} - True if the relation is symmetric
   */
  isSymmetricRelation(uid) {
    // Relations that have meaningful inverses
    const symmetricRelations = [
      1230, // is part of / consists of
      1331, // contains / is contained in
      1456, // is connected to / is connected to
      // Add more symmetric relations as needed
    ];
    return symmetricRelations.includes(uid);
  }

  /**
   * Extract UID from a Gellish predicate
   * @param {string} predicate - Predicate like "gellish:1230"
   * @returns {number} - The UID number
   */
  extractUidFromPredicate(predicate) {
    const match = predicate.match(/gellish:(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Query using natural language
   * @param {string} query - Gellish query like "What is part of System S200?"
   * @returns {string} - Natural language response
   */
  query(query) {
    try {
      // Try simple query first
      const pattern = this.queryParser.parseQuery(query);
      const results = this.kg.query(pattern[0], pattern[1], pattern[2]);
      return this.generator.generateQueryResults(results, query);
      
    } catch (error) {
      // Try type-filtered query
      try {
        const typeQuery = this.queryParser.parseTypeFilteredQuery(query);
        const results = this.executeTypeFilteredQuery(typeQuery);
        return this.generator.generateQueryResults(results, query);
        
      } catch (typeError) {
        throw new Error(`Could not parse query: ${query}`);
      }
    }
  }

  /**
   * Execute type-filtered queries like "Which pumps are manufactured by Siemens?"
   * @param {Object} typeQuery - Parsed type query structure
   * @returns {Array} - Query results
   */
  executeTypeFilteredQuery(typeQuery) {
    // Get base results (e.g., "What is manufactured by Siemens?")
    const baseResults = this.kg.query(typeQuery.basePattern[0], typeQuery.basePattern[1], typeQuery.basePattern[2]);
    
    // Get type results (e.g., "What has type Pump?")
    const typeResults = this.kg.query(null, "rdf:type", typeQuery.entityType);
    
    // Find intersection - entities that match both patterns
    const baseEntities = new Set(baseResults.map(r => r[0]));
    const typeEntities = new Set(typeResults.map(r => r[0]));
    
    const intersection = [...baseEntities].filter(entity => typeEntities.has(entity));
    return intersection.map(entity => [entity, null, null]);
  }

  /**
   * Generate triples from multiple expressions
   * @param {Array<string>} expressions - Array of Gellish expressions
   * @returns {Array<Array>} - Array of triples
   */
  generateTriples(expressions) {
    return expressions.map(expr => this.parser.parse(expr));
  }

  /**
   * Get vocabulary statistics
   * @returns {Object} - Statistics about the Gellish dictionary
   */
  getVocabularyStats() {
    return this.dictionary.getStats();
  }
}
