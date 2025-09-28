/**
 * GellishSystem - Main interface integrating all components
 * 
 * Provides natural language interface for expressing facts and querying
 * resources using Gellish Controlled Natural Language. Works with Handle-based
 * DataSources instead of kg-engine.
 * 
 * CRITICAL: All operations are synchronous following Handle pattern
 */

import { GellishDictionary } from './GellishDictionary.js';
import { EntityRecognizer } from './EntityRecognizer.js';
import { GellishParser } from './GellishParser.js';
import { GellishQueryParser } from './GellishQueryParser.js';
import { GellishGenerator } from './GellishGenerator.js';
import { GellishValidator } from './GellishValidator.js';
import { GellishDataSource } from './GellishDataSource.js';

/**
 * Main Gellish system that integrates all components
 * Wraps any DataSource to provide CNL interface
 */
export class GellishSystem {
  constructor(baseDataSource, options = {}) {
    // Wrap the base DataSource with Gellish capabilities
    this.dataSource = new GellishDataSource(baseDataSource, options);
    
    // Initialize all components
    this.dictionary = this.dataSource.dictionary;
    this.entityRecognizer = new EntityRecognizer(this.dictionary);
    this.parser = new GellishParser(this.dictionary, this.entityRecognizer);
    this.queryParser = new GellishQueryParser(this.dictionary, this.entityRecognizer);
    this.generator = new GellishGenerator(this.dictionary);
    this.validator = new GellishValidator(this.dictionary);
  }

  /**
   * Assert a fact in natural language
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {string} expression - Gellish expression like "Pump P101 is part of System S200"
   * @returns {boolean} - True if successful
   * @throws {Error} - If expression is invalid
   */
  assert(expression) {
    // Validate the expression
    const validation = this.validator.validate(expression);
    if (!validation.valid) {
      throw new Error(`Invalid expression: ${validation.error}`);
    }

    // Parse the expression to a triple
    const triple = this.parser.parse(expression);
    
    // Store in the DataSource
    this.dataSource.assertTriple(triple[0], triple[1], triple[2]);
    
    return true;
  }

  /**
   * Query using natural language
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {string} query - Gellish query like "What is part of System S200?"
   * @returns {string} - Natural language response
   * @throws {Error} - If query cannot be parsed or executed
   */
  query(query) {
    try {
      // Try simple query first
      const pattern = this.queryParser.parseQuery(query);
      const results = this.dataSource.queryTriples(pattern[0], pattern[1], pattern[2]);
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
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {Object} typeQuery - Parsed type query structure
   * @returns {Array} - Query results
   */
  executeTypeFilteredQuery(typeQuery) {
    // Get base results (e.g., "What is manufactured by Siemens?")
    const baseResults = this.dataSource.queryTriples(
      typeQuery.basePattern[0], 
      typeQuery.basePattern[1], 
      typeQuery.basePattern[2]
    );
    
    // Get type results (e.g., "What has type Pump?")
    const typeResults = this.dataSource.queryTriples(
      null, 
      "rdf:type", 
      typeQuery.entityType
    );
    
    // Find intersection - entities that match both patterns
    const baseEntities = new Set(baseResults.map(r => r[0]));
    const typeEntities = new Set(typeResults.map(r => r[0]));
    
    const intersection = [...baseEntities].filter(entity => typeEntities.has(entity));
    return intersection.map(entity => [entity, null, null]);
  }

  /**
   * Generate triples from multiple expressions
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {Array<string>} expressions - Array of Gellish expressions
   * @returns {Array<Array>} - Array of triples
   */
  generateTriples(expressions) {
    if (!expressions || expressions.length === 0) {
      return [];
    }
    return expressions.map(expr => this.parser.parse(expr));
  }

  /**
   * Assert multiple facts at once
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {Array<string>} expressions - Array of Gellish expressions
   * @returns {number} - Number of expressions successfully asserted
   */
  assertMultiple(expressions) {
    if (!expressions || expressions.length === 0) {
      return 0;
    }
    
    let count = 0;
    for (const expr of expressions) {
      try {
        this.assert(expr);
        count++;
      } catch (error) {
        // Continue with other expressions even if one fails
        console.warn(`Failed to assert: ${expr}`, error.message);
      }
    }
    
    return count;
  }

  /**
   * Get all facts about a specific entity
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {string} entityId - Entity identifier (e.g., "pump_p101")
   * @returns {Array<string>} - Array of Gellish expressions
   */
  factsAbout(entityId) {
    const triples = this.dataSource.factsAboutEntity(entityId);
    return this.generator.generateMultiple(triples);
  }

  /**
   * Get all entities related to a specific entity
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {string} entityId - Entity identifier
   * @param {string} relationPhrase - Optional relation phrase to filter by
   * @returns {Array<string>} - Array of related entity IDs
   */
  relatedTo(entityId, relationPhrase = null) {
    let predicate = null;
    
    if (relationPhrase) {
      const relation = this.dictionary.findRelation(relationPhrase);
      if (relation) {
        predicate = `gellish:${relation.uid}`;
      }
    }
    
    const triples = predicate 
      ? this.dataSource.queryTriples(entityId, predicate, null)
      : this.dataSource.factsAboutEntity(entityId);
    
    return triples.map(triple => triple[2]);
  }

  /**
   * Get vocabulary statistics
   * CRITICAL: Synchronous operation - no await!
   * 
   * @returns {Object} - Statistics about the Gellish dictionary
   */
  getVocabularyStats() {
    return this.dictionary.getStats();
  }

  /**
   * Validate an expression without asserting it
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {string} expression - Expression to validate
   * @returns {Object} - Validation result
   */
  validateExpression(expression) {
    return this.validator.validate(expression);
  }

  /**
   * Validate a query without executing it
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {string} query - Query to validate
   * @returns {Object} - Validation result
   */
  validateQuery(query) {
    return this.validator.validateQuery(query);
  }

  /**
   * Get the underlying GellishDataSource
   * Use this to access lower-level DataSource functionality
   * CRITICAL: Synchronous operation - no await!
   * 
   * @returns {GellishDataSource} - The wrapped DataSource
   */
  getDataSource() {
    return this.dataSource;
  }

  /**
   * Clear all triples from the DataSource
   * CRITICAL: Synchronous operation - no await!
   * 
   * @returns {void}
   */
  clear() {
    this.dataSource.clear();
  }
}