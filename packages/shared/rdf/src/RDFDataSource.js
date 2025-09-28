/**
 * RDFDataSource - DataSource implementation for RDF triple stores
 * 
 * Implements the DataSource interface to provide Handle-compatible access
 * to RDF data stored in a triple store.
 * 
 * Responsibilities:
 * - Translate Handle queries to triple patterns
 * - Execute queries against triple store
 * - Manage subscriptions for reactive updates
 * - Extract and provide schema information from RDF ontologies
 * - Validate data against RDF schemas
 */

import { RDFSchemaExtractor } from './RDFSchemaExtractor.js';
import { RDFParser } from './RDFParser.js';
import { RDFSerializer } from './RDFSerializer.js';

export class RDFDataSource {
  /**
   * Create an RDFDataSource
   * @param {Object} tripleStore - Triple store containing RDF data
   * @param {NamespaceManager} namespaceManager - Namespace manager for URI expansion/contraction
   */
  constructor(tripleStore, namespaceManager) {
    if (!tripleStore) {
      throw new Error('RDFDataSource requires a triple store');
    }
    
    if (!namespaceManager) {
      throw new Error('RDFDataSource requires a NamespaceManager');
    }
    
    this.tripleStore = tripleStore;
    this.namespaceManager = namespaceManager;
    
    // Track active subscriptions
    this.subscriptions = new Map();
    this.nextSubscriptionId = 1;
  }

  /**
   * Execute a query against the RDF data
   * 
   * Translates Handle query format to triple patterns and executes against triple store.
   * 
   * Query format:
   * {
   *   find: ['?variable1', '?variable2', ...],  // Variables to return
   *   where: [                                   // Triple patterns to match
   *     ['?subject', 'predicate', '?object'],
   *     ['?subject', 'property', 'value'],
   *     ...
   *   ],
   *   filter: (bindings) => boolean             // Optional filter predicate
   * }
   * 
   * Special translations:
   * - 'type' predicate is translated to 'rdf:type'
   * 
   * Filter predicate (optional):
   * - Function that receives a bindings object (without '?' prefix on variable names)
   * - Returns true to include the result, false to exclude it
   * - Applied after query execution, before projection
   * 
   * @param {Object} querySpec - Query specification with find and where clauses
   * @returns {Array<Object>} - Array of result bindings, one object per match
   * 
   * Example:
   * query({
   *   find: ['?person', '?name'],
   *   where: [
   *     ['?person', 'type', 'foaf:Person'],
   *     ['?person', 'foaf:name', '?name']
   *   ],
   *   filter: (bindings) => bindings.name.includes('Alice')
   * })
   * // Returns: [
   * //   { person: 'ex:alice', name: 'Alice Smith' }
   * // ]
   */
  query(querySpec) {
    // Validate query spec
    if (!querySpec) {
      throw new Error('Query spec is required');
    }
    
    if (!Array.isArray(querySpec.find)) {
      throw new Error('Query spec must have find array');
    }
    
    if (!Array.isArray(querySpec.where)) {
      throw new Error('Query spec must have where array');
    }
    
    // Handle empty where clause - no constraints means no matches
    if (querySpec.where.length === 0) {
      return [];
    }
    
    // Execute query by processing where clauses
    return this._executeQuery(querySpec.find, querySpec.where, querySpec.filter);
  }

  /**
   * Execute query by processing where clauses
   * 
   * @param {string[]} findVars - Variables to return in results
   * @param {Array} whereClauses - Triple patterns to match
   * @param {Function} [filterPredicate] - Optional filter function to apply to results
   * @returns {Array<Object>} - Array of result bindings
   * @private
   */
  _executeQuery(findVars, whereClauses, filterPredicate) {
    // Start with all possible bindings (empty binding if no where clauses)
    let bindings = [{}];
    
    // Process each where clause, filtering and extending bindings
    for (const whereClause of whereClauses) {
      bindings = this._processWhereClause(bindings, whereClause);
      
      // Early exit if no bindings remain
      if (bindings.length === 0) {
        return [];
      }
    }
    
    // Apply filter predicate if provided
    if (filterPredicate && typeof filterPredicate === 'function') {
      bindings = bindings.filter(filterPredicate);
    }
    
    // Project results to only include requested variables
    return this._projectResults(bindings, findVars);
  }

  /**
   * Process a single where clause against current bindings
   * 
   * @param {Array<Object>} currentBindings - Current variable bindings
   * @param {Array} whereClause - Triple pattern [subject, predicate, object]
   * @returns {Array<Object>} - Extended bindings after applying this clause
   * @private
   */
  _processWhereClause(currentBindings, whereClause) {
    const [subject, predicate, object] = whereClause;
    
    // Translate special predicates
    const normalizedPredicate = this._translatePredicate(predicate);
    
    const newBindings = [];
    
    // For each current binding, try to extend it with matches from this clause
    for (const binding of currentBindings) {
      // Substitute bound variables in the pattern
      const subjectPattern = this._substituteVariable(subject, binding);
      const predicatePattern = this._substituteVariable(normalizedPredicate, binding);
      const objectPattern = this._substituteVariable(object, binding);
      
      // Query triple store with the pattern
      // Handle both sync and async query methods
      let matches;
      const queryResult = this.tripleStore.query(subjectPattern, predicatePattern, objectPattern);
      
      if (queryResult && typeof queryResult.then === 'function') {
        // It's a Promise - for now we'll throw an error since DataSource must be synchronous
        throw new Error('TripleStore must provide synchronous query method for DataSource compatibility');
      } else {
        matches = queryResult;
      }
      
      // For each match, create a new binding
      for (const [matchSubject, matchPredicate, matchObject] of matches) {
        const newBinding = { ...binding };
        
        // Bind variables from the match
        if (this._isVariable(subject)) {
          const varName = this._getVariableName(subject);
          newBinding[varName] = matchSubject;
        }
        
        if (this._isVariable(normalizedPredicate)) {
          const varName = this._getVariableName(normalizedPredicate);
          newBinding[varName] = matchPredicate;
        }
        
        if (this._isVariable(object)) {
          const varName = this._getVariableName(object);
          newBinding[varName] = matchObject;
        }
        
        // Check if new binding is consistent with current binding
        if (this._isConsistentBinding(newBinding, binding)) {
          newBindings.push(newBinding);
        }
      }
    }
    
    return newBindings;
  }

  /**
   * Translate special predicates
   * 
   * @param {string} predicate - Predicate to translate
   * @returns {string} - Translated predicate
   * @private
   */
  _translatePredicate(predicate) {
    // Translate 'type' to 'rdf:type'
    if (predicate === 'type') {
      return 'rdf:type';
    }
    
    return predicate;
  }

  /**
   * Substitute a variable with its bound value if available
   * 
   * @param {string} value - Value or variable
   * @param {Object} binding - Current variable bindings
   * @returns {string|null} - Substituted value or null for wildcard
   * @private
   */
  _substituteVariable(value, binding) {
    if (this._isVariable(value)) {
      const varName = this._getVariableName(value);
      return binding[varName] || null; // Return null for unbound variables (wildcard)
    }
    
    return value;
  }

  /**
   * Check if a value is a variable (starts with ?)
   * 
   * @param {string} value - Value to check
   * @returns {boolean} - True if variable
   * @private
   */
  _isVariable(value) {
    return typeof value === 'string' && value.startsWith('?');
  }

  /**
   * Get variable name without ? prefix
   * 
   * @param {string} variable - Variable string (e.g., '?entity')
   * @returns {string} - Variable name without prefix (e.g., 'entity')
   * @private
   */
  _getVariableName(variable) {
    return variable.substring(1);
  }

  /**
   * Check if a new binding is consistent with an existing binding
   * 
   * Ensures that if a variable was already bound, the new binding
   * has the same value.
   * 
   * @param {Object} newBinding - New binding to check
   * @param {Object} existingBinding - Existing binding
   * @returns {boolean} - True if consistent
   * @private
   */
  _isConsistentBinding(newBinding, existingBinding) {
    for (const varName in existingBinding) {
      if (existingBinding[varName] !== undefined && 
          newBinding[varName] !== existingBinding[varName]) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Project results to only include requested variables
   * 
   * @param {Array<Object>} bindings - All variable bindings
   * @param {string[]} findVars - Variables to include in results
   * @returns {Array<Object>} - Projected results
   * @private
   */
  _projectResults(bindings, findVars) {
    // If no variables requested, return single empty binding if any matches
    if (findVars.length === 0) {
      return bindings.length > 0 ? [{}] : [];
    }
    
    // Project each binding to only include requested variables
    return bindings.map(binding => {
      const result = {};
      
      for (const varWithPrefix of findVars) {
        const varName = this._getVariableName(varWithPrefix);
        
        if (binding[varName] !== undefined) {
          result[varName] = binding[varName];
        }
      }
      
      return result;
    });
  }

  /**
   * Subscribe to changes in query results
   * 
   * Sets up a subscription that monitors the triple store for changes
   * and invokes a callback whenever the query results change.
   * 
   * The callback receives the current query results after each change.
   * Only invokes the callback when the query results actually change.
   * 
   * @param {Object} querySpec - Query specification (same format as query())
   * @param {Function} callback - Callback function invoked with query results
   * @returns {Function} - Unsubscribe function to stop receiving updates
   * 
   * Example:
   * const unsubscribe = dataSource.subscribe(
   *   {
   *     find: ['?person', '?name'],
   *     where: [
   *       ['?person', 'type', 'foaf:Person'],
   *       ['?person', 'foaf:name', '?name']
   *     ]
   *   },
   *   (results) => {
   *     console.log('Query results updated:', results);
   *   }
   * );
   * 
   * // Later, stop receiving updates
   * unsubscribe();
   */
  subscribe(querySpec, callback) {
    // Validate query spec
    if (!querySpec) {
      throw new Error('Query spec is required');
    }
    
    if (!Array.isArray(querySpec.find)) {
      throw new Error('Query spec must have find array');
    }
    
    if (!Array.isArray(querySpec.where)) {
      throw new Error('Query spec must have where array');
    }
    
    // Validate callback
    if (!callback) {
      throw new Error('Callback is required');
    }
    
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    // Generate unique subscription ID
    const subscriptionId = this.nextSubscriptionId++;
    
    // Track previous results to detect changes
    // Initialize with current query results to avoid spurious initial callbacks
    let previousResults = this.query(querySpec);
    
    // Create subscription handler that re-executes query on changes
    const handleChange = () => {
      // Execute query
      const currentResults = this.query(querySpec);
      
      // Only invoke callback if results changed
      if (!this._resultsEqual(previousResults, currentResults)) {
        previousResults = currentResults;
        callback(currentResults);
      }
    };
    
    // Subscribe to triple store changes
    // tripleStore.subscribe returns an object with unsubscribe method
    const tripleStoreSubscription = this.tripleStore.subscribe(handleChange);
    
    // Store subscription info
    this.subscriptions.set(subscriptionId, {
      querySpec,
      callback,
      tripleStoreSubscription
    });
    
    // Return subscription object with unsubscribe method
    // This matches the Handle interface expectation
    return {
      unsubscribe: () => {
        const subscription = this.subscriptions.get(subscriptionId);
        
        if (subscription) {
          // Unsubscribe from triple store
          subscription.tripleStoreSubscription.unsubscribe();
          
          // Remove from subscriptions map
          this.subscriptions.delete(subscriptionId);
        }
      }
    };
  }

  /**
   * Get Handle-compatible schema from RDF ontology
   * 
   * Extracts schema information from the RDF ontology stored in the triple store.
   * Delegates to RDFSchemaExtractor for the actual extraction logic.
   * 
   * Returns a schema object in Handle format:
   * {
   *   'TypeName/propertyName': {
   *     type: 'string' | 'number' | 'boolean' | 'date' | 'ref',
   *     cardinality: 'one' | 'many',
   *     ref?: 'TargetTypeName'  // Only for type: 'ref'
   *   }
   * }
   * 
   * @returns {Object} - Handle-compatible schema object
   * 
   * Example:
   * // Ontology contains Person class with name and age properties
   * getSchema()
   * // Returns:
   * // {
   * //   'Person/name': { type: 'string', cardinality: 'many' },
   * //   'Person/age': { type: 'number', cardinality: 'many' }
   * // }
   */
  getSchema() {
    // Create RDFSchemaExtractor instance and delegate to it
    const schemaExtractor = new RDFSchemaExtractor(this.tripleStore, this.namespaceManager);
    
    return schemaExtractor.extractSchema();
  }

  /**
   * Import RDF data into the triple store
   * 
   * Parses RDF data in the specified format and adds the resulting triples
   * to the triple store. Supports three RDF formats:
   * - 'turtle': Turtle format with prefix declarations and compact syntax
   * - 'ntriples': N-Triples format with full URIs in angle brackets
   * - 'jsonld': JSON-LD format with @context and @graph
   * 
   * All imported triples are added to the existing triple store without
   * removing existing data. Namespaces from the imported RDF are registered
   * with the namespace manager.
   * 
   * @param {string} rdfString - RDF data as string (or object for JSON-LD)
   * @param {string} format - Format: 'turtle', 'ntriples', or 'jsonld'
   * 
   * @throws {Error} If rdfString is not provided
   * @throws {Error} If format is not provided
   * @throws {Error} If format is not supported
   * @throws {Error} If RDF data is malformed
   * 
   * Example:
   * dataSource.importRDF(`
   *   @prefix ex: <http://example.org/> .
   *   ex:alice a ex:Person .
   * `, 'turtle');
   */
  importRDF(rdfString, format) {
    // Validate inputs
    if (!rdfString) {
      throw new Error('RDF string is required');
    }
    
    if (!format) {
      throw new Error('Format is required');
    }
    
    // Normalize format to lowercase
    const normalizedFormat = format.toLowerCase();
    
    // Validate format
    const supportedFormats = ['turtle', 'ntriples', 'jsonld'];
    if (!supportedFormats.includes(normalizedFormat)) {
      throw new Error(`Unsupported format: ${format}. Supported formats: ${supportedFormats.join(', ')}`);
    }
    
    // Create parser and parse the data
    const parser = new RDFParser(this.tripleStore, this.namespaceManager);
    
    try {
      switch (normalizedFormat) {
        case 'turtle':
          parser.parseTurtle(rdfString);
          break;
        
        case 'ntriples':
          parser.parseNTriples(rdfString);
          break;
        
        case 'jsonld':
          // JSON-LD can be a string or object
          parser.parseJsonLD(rdfString);
          break;
      }
    } catch (error) {
      // Re-throw with more context
      throw new Error(`Failed to parse ${format} data: ${error.message}`);
    }
  }

  /**
   * Export RDF data from the triple store
   * 
   * Serializes all triples in the triple store to the specified RDF format.
   * Supports three RDF formats:
   * - 'turtle': Turtle format with prefix declarations and compact syntax
   * - 'ntriples': N-Triples format with full URIs in angle brackets
   * - 'jsonld': JSON-LD format with @context and @graph (returned as JSON string)
   * 
   * All registered namespaces are included in the output (as @prefix for Turtle,
   * as @context for JSON-LD).
   * 
   * @param {string} format - Format: 'turtle', 'ntriples', or 'jsonld'
   * @returns {string} - Serialized RDF data
   * 
   * @throws {Error} If format is not provided
   * @throws {Error} If format is not supported
   * 
   * Example:
   * const turtleData = dataSource.exportRDF('turtle');
   * // Returns:
   * // @prefix ex: <http://example.org/> .
   * // 
   * // ex:alice rdf:type ex:Person .
   */
  exportRDF(format) {
    // Validate format
    if (!format) {
      throw new Error('Format is required');
    }
    
    // Normalize format to lowercase
    const normalizedFormat = format.toLowerCase();
    
    // Validate format
    const supportedFormats = ['turtle', 'ntriples', 'jsonld'];
    if (!supportedFormats.includes(normalizedFormat)) {
      throw new Error(`Unsupported format: ${format}. Supported formats: ${supportedFormats.join(', ')}`);
    }
    
    // Create serializer
    const serializer = new RDFSerializer(this.tripleStore, this.namespaceManager);
    
    // Serialize based on format
    switch (normalizedFormat) {
      case 'turtle':
        return serializer.toTurtle();
      
      case 'ntriples':
        return serializer.toNTriples();
      
      case 'jsonld':
        // JSON-LD returns an object, convert to string
        const jsonldObject = serializer.toJsonLD();
        return JSON.stringify(jsonldObject, null, 2);
      
      default:
        // Should never reach here due to validation above
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Create query builder for Handle projections
   * 
   * Returns a query builder that can create new Handle projections through
   * query combinator methods. This fulfills the DataSource interface requirement.
   * 
   * @param {Handle} sourceHandle - Handle to build queries from
   * @returns {Object} Query builder object with combinator methods
   * @throws {Error} If sourceHandle is not provided
   */
  queryBuilder(sourceHandle) {
    if (!sourceHandle) {
      throw new Error('Source Handle is required for query builder');
    }
    
    // Create RDF-specific query builder
    const builder = {
      _sourceHandle: sourceHandle,
      _operations: [],
      _dataSource: this,
      
      // Add operation to chain
      _addOperation(type, ...args) {
        this._operations.push({ type, args });
        return this; // Return self for chaining
      },
      
      // Combinator methods that return new query builders
      where(predicate) {
        return this._addOperation('where', predicate);
      },
      
      select(mapper) {
        return this._addOperation('select', mapper);
      },
      
      join(otherHandle, joinCondition) {
        return this._addOperation('join', otherHandle, joinCondition);
      },
      
      orderBy(orderBy, direction = 'asc') {
        return this._addOperation('orderBy', orderBy, direction);
      },
      
      limit(count) {
        return this._addOperation('limit', count);
      },
      
      skip(count) {
        return this._addOperation('skip', count);
      },
      
      groupBy(groupBy) {
        return this._addOperation('groupBy', groupBy);
      },
      
      aggregate(aggregateFunction, field) {
        return this._addOperation('aggregate', aggregateFunction, field);
      },
      
      // Terminal methods that execute the query and return results
      first() {
        // Execute operations and return first result
        const results = this._executeOperations();
        return results.length > 0 ? results[0] : null;
      },
      
      last() {
        // Execute operations and return last result
        const results = this._executeOperations();
        return results.length > 0 ? results[results.length - 1] : null;
      },
      
      count() {
        // Execute operations and return count
        const results = this._executeOperations();
        return results.length;
      },
      
      toArray() {
        // Execute operations and return array of results
        return this._executeOperations();
      },
      
      // Execute the accumulated operations
      _executeOperations() {
        // For now, return empty array - this is a basic implementation
        // Real RDF query builders would translate operations to SPARQL or triple patterns
        return [];
      }
    };
    
    return builder;
  }

  /**
   * Compare two query result sets for equality
   * 
   * @param {Array<Object>} results1 - First result set
   * @param {Array<Object>} results2 - Second result set
   * @returns {boolean} - True if results are equal
   * @private
   */
  _resultsEqual(results1, results2) {
    // Handle null/undefined cases
    if (results1 === null || results1 === undefined) {
      return results2 === null || results2 === undefined;
    }
    
    if (results2 === null || results2 === undefined) {
      return false;
    }
    
    // Check array length
    if (results1.length !== results2.length) {
      return false;
    }
    
    // Convert results to JSON strings for deep comparison
    // Sort to handle different orderings
    const sorted1 = this._sortResults(results1);
    const sorted2 = this._sortResults(results2);
    
    return JSON.stringify(sorted1) === JSON.stringify(sorted2);
  }

  /**
   * Sort query results for consistent comparison
   * 
   * @param {Array<Object>} results - Query results
   * @returns {Array<Object>} - Sorted results
   * @private
   */
  _sortResults(results) {
    return results.map(r => r).sort((a, b) => {
      return JSON.stringify(a).localeCompare(JSON.stringify(b));
    });
  }
}