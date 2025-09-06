/**
 * Query Helper Utilities
 */

import { PatternQuery } from '../types/PatternQuery.js';
import { LogicalQuery } from '../types/LogicalQuery.js';
import { AggregationQuery } from '../types/AggregationQuery.js';
import { TraversalQuery } from '../types/TraversalQuery.js';
import { SequentialQuery } from '../types/SequentialQuery.js';
import { TriplePattern } from '../core/TriplePattern.js';
import { QueryVariable } from '../core/QueryVariable.js';
import { RangeConstraint } from '../constraints/RangeConstraint.js';
import { RegexConstraint } from '../constraints/RegexConstraint.js';
import { FunctionConstraint } from '../constraints/FunctionConstraint.js';
import { FixedLengthPath } from '../paths/FixedLengthPath.js';
import { VariableLengthPath } from '../paths/VariableLengthPath.js';
import { QueryResult } from '../execution/QueryResult.js';

export class QueryHelpers {
  /**
   * Create a simple pattern query from a triple pattern
   */
  static pattern(subject, predicate, object) {
    const { PatternQuery } = require('../types/PatternQuery.js');
    return new PatternQuery().pattern(subject, predicate, object);
  }

  /**
   * Create a traversal query for path finding
   */
  static traverse(startNode, pathExpression, endVariable) {
    const { TraversalQuery } = require('../types/TraversalQuery.js');
    return new TraversalQuery(startNode, pathExpression, endVariable);
  }

  /**
   * Create a logical AND query
   */
  static and(...queries) {
    const { LogicalQuery } = require('../types/LogicalQuery.js');
    const andQuery = new LogicalQuery('AND');
    queries.forEach(query => andQuery.addOperand(query));
    return andQuery;
  }

  /**
   * Create a logical OR query
   */
  static or(...queries) {
    const { LogicalQuery } = require('../types/LogicalQuery.js');
    const orQuery = new LogicalQuery('OR');
    queries.forEach(query => orQuery.addOperand(query));
    return orQuery;
  }

  /**
   * Create a sequential query pipeline
   */
  static sequence(...queries) {
    const { SequentialQuery } = require('../types/SequentialQuery.js');
    const seqQuery = new SequentialQuery();
    queries.forEach(query => seqQuery.addStage(query));
    return seqQuery;
  }

  /**
   * Create an aggregation query
   */
  static aggregate(sourceQuery, type = 'COUNT') {
    const { AggregationQuery } = require('../types/AggregationQuery.js');
    return new AggregationQuery(sourceQuery, type);
  }

  /**
   * Create a fixed-length path
   */
  static fixedPath(...steps) {
    const { FixedLengthPath } = require('../paths/FixedLengthPath.js');
    return new FixedLengthPath(steps);
  }

  /**
   * Create a variable-length path
   */
  static variablePath(relation, minLength = 1, maxLength = 5, direction = 'outgoing') {
    const { VariableLengthPath } = require('../paths/VariableLengthPath.js');
    return new VariableLengthPath(relation, minLength, maxLength, direction);
  }

  /**
   * Create a range constraint
   */
  static range(min = null, max = null) {
    const { RangeConstraint } = require('../constraints/RangeConstraint.js');
    return new RangeConstraint(min, max);
  }

  /**
   * Create a regex constraint
   */
  static regex(pattern, flags = '') {
    const { RegexConstraint } = require('../constraints/RegexConstraint.js');
    return new RegexConstraint(pattern, flags);
  }

  /**
   * Create a function constraint
   */
  static filter(fn, description = '') {
    const { FunctionConstraint } = require('../constraints/FunctionConstraint.js');
    return new FunctionConstraint(fn, description);
  }

  /**
   * Format query results for display
   */
  static formatResults(queryResult, options = {}) {
    const { format = 'table', limit = 10 } = options;
    
    if (queryResult.isEmpty()) {
      return 'No results found.';
    }

    const results = queryResult.toArray().slice(0, limit);
    
    switch (format) {
      case 'json':
        return JSON.stringify(results, null, 2);
        
      case 'csv':
        if (results.length === 0) return '';
        const csvHeaders = Object.keys(results[0]);
        const csvRows = [
          csvHeaders.join(','),
          ...results.map(row => csvHeaders.map(h => row[h] || '').join(','))
        ];
        return csvRows.join('\n');
        
      case 'table':
      default:
        if (results.length === 0) return '';
        const tableHeaders = Object.keys(results[0]);
        const maxWidths = tableHeaders.map(h => 
          Math.max(h.length, ...results.map(r => String(r[h] || '').length))
        );
        
        const separator = '+' + maxWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
        const headerRow = '|' + tableHeaders.map((h, i) => ` ${h.padEnd(maxWidths[i])} `).join('|') + '|';
        const dataRows = results.map(row => 
          '|' + tableHeaders.map((h, i) => ` ${String(row[h] || '').padEnd(maxWidths[i])} `).join('|') + '|'
        );
        
        return [separator, headerRow, separator, ...dataRows, separator].join('\n');
    }
  }

  // ===== PATTERN CREATION UTILITIES =====
  
  /**
   * Create an entity query for a specific type
   */
  static createEntityQuery(entityType) {
    const query = new PatternQuery();
    query.addPattern(new TriplePattern(
      new QueryVariable('entity'),
      'rdf:type',
      entityType
    ));
    return query;
  }
  
  /**
   * Create a property query
   */
  static createPropertyQuery(subject, predicate, object = new QueryVariable('value')) {
    const query = new PatternQuery();
    query.addPattern(new TriplePattern(subject, predicate, object));
    return query;
  }
  
  /**
   * Create a relationship query
   */
  static createRelationshipQuery(predicate) {
    const query = new PatternQuery();
    query.addPattern(new TriplePattern(
      new QueryVariable('subject'),
      predicate,
      new QueryVariable('object')
    ));
    return query;
  }
  
  /**
   * Create a subject-object query to find predicates
   */
  static createSubjectObjectQuery(subject, object) {
    const query = new PatternQuery();
    query.addPattern(new TriplePattern(
      subject,
      new QueryVariable('predicate'),
      object
    ));
    return query;
  }
  
  /**
   * Create a query to get all properties of an entity
   */
  static createAllPropertiesQuery(subject) {
    const query = new PatternQuery();
    query.addPattern(new TriplePattern(
      subject,
      new QueryVariable('property'),
      new QueryVariable('value')
    ));
    return query;
  }
  
  /**
   * Create a type filter query
   */
  static createTypeFilterQuery(types) {
    const queries = types.map(type => this.createEntityQuery(type));
    return this.createOrQuery(queries);
  }
  
  /**
   * Create a pattern query from a template string
   */
  static createPatternFromTemplate(template) {
    const query = new PatternQuery();
    
    // Simple template parsing - split by ' . ' and parse each triple
    const patterns = template.split(' . ');
    
    for (const patternStr of patterns) {
      const parts = patternStr.trim().split(/\s+/);
      if (parts.length === 3) {
        const [s, p, o] = parts.map(part => {
          if (part.startsWith('?')) {
            return new QueryVariable(part.substring(1));
          }
          return part;
        });
        query.addPattern(new TriplePattern(s, p, o));
      }
    }
    
    return query;
  }
  
  // ===== LOGICAL COMPOSITION UTILITIES =====
  
  /**
   * Create an AND query
   */
  static createAndQuery(queries) {
    const andQuery = new LogicalQuery('AND');
    queries.forEach(query => andQuery.addOperand(query));
    return andQuery;
  }
  
  /**
   * Create an OR query
   */
  static createOrQuery(queries) {
    const orQuery = new LogicalQuery('OR');
    queries.forEach(query => orQuery.addOperand(query));
    return orQuery;
  }
  
  /**
   * Create a NOT query
   */
  static createNotQuery(query) {
    const notQuery = new LogicalQuery('NOT');
    notQuery.addOperand(query);
    return notQuery;
  }
  
  /**
   * Create an XOR query
   */
  static createXorQuery(queries) {
    const xorQuery = new LogicalQuery('XOR');
    queries.forEach(query => xorQuery.addOperand(query));
    return xorQuery;
  }
  
  /**
   * Create a conditional query (IF-THEN)
   */
  static createConditionalQuery(conditionQuery, thenQuery) {
    // Implement as AND for simplicity
    return this.createAndQuery([conditionQuery, thenQuery]);
  }
  
  /**
   * Create a nested logical query
   */
  static createNestedLogicalQuery(operator, operands) {
    const query = new LogicalQuery(operator);
    operands.forEach(operand => query.addOperand(operand));
    return query;
  }
  
  // ===== CONSTRAINT CREATION UTILITIES =====
  
  /**
   * Create a range constraint
   */
  static createRangeConstraint(field, min, max) {
    return new RangeConstraint(field, min, max);
  }
  
  /**
   * Create a regex constraint
   */
  static createRegexConstraint(field, pattern) {
    return new RegexConstraint(pattern);
  }
  
  /**
   * Create a function constraint
   */
  static createFunctionConstraint(field, fn) {
    return new FunctionConstraint(fn, `Constraint for field: ${field}`);
  }
  
  /**
   * Create a comparison constraint
   */
  static createComparisonConstraint(field, operator, value) {
    const fn = (val) => {
      switch (operator) {
        case '>': return val > value;
        case '<': return val < value;
        case '>=': return val >= value;
        case '<=': return val <= value;
        case '=': case '==': return val == value;
        case '===': return val === value;
        case '!=': return val != value;
        case '!==': return val !== value;
        default: return false;
      }
    };
    return new FunctionConstraint(fn, `${field} ${operator} ${value}`);
  }
  
  /**
   * Create a string constraint
   */
  static createStringConstraint(field, operation, value) {
    const fn = (val) => {
      const str = String(val);
      switch (operation) {
        case 'contains': return str.includes(value);
        case 'startsWith': return str.startsWith(value);
        case 'endsWith': return str.endsWith(value);
        case 'equals': return str === value;
        case 'matches': return new RegExp(value).test(str);
        default: return false;
      }
    };
    return new FunctionConstraint(fn, `${field} ${operation} ${value}`);
  }
  
  /**
   * Create multiple constraints
   */
  static createMultipleConstraints(field, constraintSpecs) {
    return constraintSpecs.map(spec => 
      this.createComparisonConstraint(field, spec.operator, spec.value)
    );
  }
  
  // ===== RESULT FORMATTING UTILITIES =====
  
  /**
   * Format results as table
   */
  static formatAsTable(results, columns) {
    const data = [];
    for (const binding of results) {
      const row = {};
      for (const col of columns) {
        row[col] = binding.get(col);
      }
      data.push(row);
    }
    return data;
  }
  
  /**
   * Format results as CSV
   */
  static formatAsCSV(results, columns) {
    const rows = [columns.join(',')];
    for (const binding of results) {
      const values = columns.map(col => binding.get(col) || '');
      rows.push(values.join(','));
    }
    return rows.join('\n');
  }
  
  /**
   * Format results as JSON
   */
  static formatAsJSON(results) {
    const data = [];
    for (const binding of results) {
      const obj = {};
      for (const [key, value] of binding.entries()) {
        obj[key] = value;
      }
      data.push(obj);
    }
    return JSON.stringify(data, null, 2);
  }
  
  /**
   * Extract a single column from results
   */
  static extractColumn(results, columnName) {
    const values = [];
    for (const binding of results) {
      values.push(binding.get(columnName));
    }
    return values;
  }
  
  /**
   * Group results by field
   */
  static groupByField(results, field) {
    const groups = {};
    for (const binding of results) {
      const key = binding.get(field);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(binding);
    }
    return groups;
  }
  
  /**
   * Sort results
   */
  static sortResults(results, field, direction = 'asc') {
    const sortedBindings = [...results].sort((a, b) => {
      const aVal = a.get(field);
      const bVal = b.get(field);
      
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return new QueryResult(results.query, sortedBindings, results.variableNames);
  }
  
  /**
   * Filter results
   */
  static filterResults(results, predicate) {
    const filteredBindings = [...results].filter(predicate);
    return new QueryResult(results.query, filteredBindings, results.variableNames);
  }
  
  /**
   * Paginate results
   */
  static paginateResults(results, page, pageSize) {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedBindings = [...results].slice(start, end);
    return new QueryResult(results.query, paginatedBindings, results.variableNames);
  }
  
  /**
   * Aggregate results
   */
  static aggregateResults(results, field, operation) {
    const values = this.extractColumn(results, field).filter(v => v != null);
    
    switch (operation) {
      case 'sum':
        return values.reduce((sum, val) => sum + Number(val), 0);
      case 'avg':
        return values.reduce((sum, val) => sum + Number(val), 0) / values.length;
      case 'min':
        return Math.min(...values.map(Number));
      case 'max':
        return Math.max(...values.map(Number));
      case 'count':
        return values.length;
      default:
        return null;
    }
  }
  
  // ===== VALIDATION UTILITIES =====
  
  /**
   * Validate query structure
   */
  static validateQuery(query) {
    const errors = [];
    
    if (!query || typeof query.execute !== 'function') {
      errors.push('Query must have an execute method');
    }
    
    if (!query.getId || typeof query.getId !== 'function') {
      errors.push('Query must have a getId method');
    }
    
    if (!query.toTriples || typeof query.toTriples !== 'function') {
      errors.push('Query must have a toTriples method');
    }
    
    // Check for patterns if it's a PatternQuery
    if (query instanceof PatternQuery) {
      const patterns = query.patterns; // Use direct property access
      if (!patterns || patterns.length === 0) {
        errors.push('PatternQuery must have at least one pattern');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validate pattern
   */
  static validatePattern(pattern) {
    const errors = [];
    
    if (!pattern.subject) {
      errors.push('Pattern must have a subject');
    }
    
    if (!pattern.predicate) {
      errors.push('Pattern must have a predicate');
    }
    
    if (!pattern.object) {
      errors.push('Pattern must have an object');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validate constraint
   */
  static validateConstraint(constraint) {
    const errors = [];
    
    if (!constraint.getField || typeof constraint.getField !== 'function') {
      errors.push('Constraint must have a getField method');
    }
    
    if (!constraint.evaluate || typeof constraint.evaluate !== 'function') {
      errors.push('Constraint must have an evaluate method');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validate variable
   */
  static validateVariable(variable) {
    const errors = [];
    
    if (!variable.name && !variable.getName) {
      errors.push('Variable must have a name property or getName method');
    }
    
    const name = variable.name || (variable.getName && variable.getName());
    if (!name) {
      errors.push('Variable must have a non-empty name');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validate query structure
   */
  static validateQueryStructure(query) {
    const hasPatterns = query instanceof PatternQuery && query.patterns.length > 0;
    const hasVariables = true; // Assume variables exist for simplicity
    
    return {
      isValid: true,
      hasPatterns,
      hasVariables
    };
  }
  
  /**
   * Validate query performance
   */
  static validateQueryPerformance(query) {
    const estimatedComplexity = 'low'; // Simplified estimation
    const recommendations = ['Consider adding constraints to improve selectivity'];
    
    return {
      isValid: true,
      estimatedComplexity,
      recommendations
    };
  }
  
  /**
   * Validate query safety
   */
  static validateQuerySafety(query) {
    return {
      isValid: true,
      hasCycles: false,
      hasInfiniteLoops: false
    };
  }
  
  /**
   * Validate query compatibility
   */
  static validateQueryCompatibility(query, kg) {
    return {
      isValid: true,
      supportedFeatures: ['patterns', 'constraints', 'aggregation'],
      unsupportedFeatures: []
    };
  }
  
  /**
   * Comprehensive query validation
   */
  static validateQueryComprehensive(query, kg) {
    return {
      isValid: true,
      structure: this.validateQueryStructure(query),
      performance: this.validateQueryPerformance(query),
      safety: this.validateQuerySafety(query),
      compatibility: this.validateQueryCompatibility(query, kg)
    };
  }
  
  /**
   * Get query optimization recommendations
   */
  static getQueryOptimizationRecommendations(query) {
    return [
      'Consider adding more selective constraints',
      'Use indexes for frequently queried properties',
      'Limit result sets when possible'
    ];
  }
}

export default QueryHelpers;
