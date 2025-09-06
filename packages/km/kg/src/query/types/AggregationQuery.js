import { BaseQuery } from '../core/BaseQuery.js';
import { QueryResult } from '../execution/QueryResult.js';

/**
 * Aggregation Query Implementation
 */
export class AggregationQuery extends BaseQuery {
  constructor(sourceQuery, aggregationType = 'COUNT') {
    super();
    
    if (sourceQuery === null || sourceQuery === undefined) {
      throw new Error('Source query cannot be null');
    }
    
    const validTypes = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COLLECT', 'CUSTOM', 'STDDEV', 'VARIANCE', 'MEDIAN', 'PERCENTILE_95', 'CORRELATION', 'MODE'];
    if (!validTypes.includes(aggregationType)) {
      throw new Error(`Invalid aggregation type: ${aggregationType}`);
    }
    
    this.sourceQuery = sourceQuery;
    this.aggregationType = aggregationType; // 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COLLECT'
    this.aggregateField = null;
    this.groupByFields = [];
  }

  setAggregateField(field) {
    this.aggregateField = field;
    return this;
  }

  groupBy(...fields) {
    this.groupByFields.push(...fields);
    return this;
  }

  async _executeInternal(kgEngine, context = {}) {
    // Add circular reference detection
    const executionStack = context.executionStack || new Set();
    const queryId = this.getId();
    
    console.log(`[AGGREGATION EXEC] ${queryId} - Type: ${this.aggregationType}, Source: ${this.sourceQuery.constructor.name} ${this.sourceQuery.getId()}`);
    
    if (executionStack.has(queryId)) {
      console.warn(`[AGGREGATION EXEC] Circular reference detected in AggregationQuery ${queryId}, returning empty result`);
      const binding = new Map();
      binding.set('aggregate_result', 0);
      return new QueryResult(this, [binding], ['aggregate_result']);
    }
    
    // Add this query to the execution stack
    const newContext = {
      ...context,
      executionStack: new Set([...executionStack, queryId])
    };

    console.log(`[AGGREGATION EXEC] ${queryId} - Executing source query`);
    const sourceResult = await this.sourceQuery.execute(kgEngine, newContext);
    console.log(`[AGGREGATION EXEC] ${queryId} - Source query completed with ${sourceResult.bindings.length} results`);
    
    if (this.groupByFields.length === 0) {
      // Simple aggregation without grouping
      const value = this.computeAggregate(sourceResult.bindings);
      const binding = new Map();
      binding.set('aggregate_result', value);
      return new QueryResult(this, [binding], ['aggregate_result']);
    } else {
      // Group by aggregation
      const groups = this.groupBindings(sourceResult.bindings);
      const aggregatedBindings = [];
      
      for (const [groupKey, groupBindings] of groups) {
        const aggregateValue = this.computeAggregate(groupBindings);
        const binding = new Map();
        
        // Add group by fields
        const groupKeyObj = JSON.parse(groupKey);
        for (const [field, value] of Object.entries(groupKeyObj)) {
          binding.set(field, value);
        }
        
        binding.set('aggregate_result', aggregateValue);
        aggregatedBindings.push(binding);
      }
      
      const variableNames = [...this.groupByFields, 'aggregate_result'];
      return new QueryResult(this, aggregatedBindings, variableNames);
    }
  }

  groupBindings(bindings) {
    const groups = new Map();
    
    for (const binding of bindings) {
      const groupKey = {};
      for (const field of this.groupByFields) {
        groupKey[field] = binding.get(field);
      }
      
      const keyStr = JSON.stringify(groupKey);
      if (!groups.has(keyStr)) {
        groups.set(keyStr, []);
      }
      groups.get(keyStr).push(binding);
    }
    
    return groups;
  }

  computeAggregate(bindings) {
    if (bindings.length === 0) {
      switch (this.aggregationType) {
        case 'COUNT':
          return 0;
        case 'SUM':
          return 0;
        case 'COLLECT':
          return [];
        default:
          return null;
      }
    }

    switch (this.aggregationType) {
      case 'COUNT':
        return bindings.length;
        
      case 'SUM':
        return bindings.reduce((sum, binding) => {
          const value = binding.get(this.aggregateField);
          return sum + (typeof value === 'number' ? value : 0);
        }, 0);
        
      case 'AVG':
        const sum = bindings.reduce((sum, binding) => {
          const value = binding.get(this.aggregateField);
          return sum + (typeof value === 'number' ? value : 0);
        }, 0);
        return sum / bindings.length;
        
      case 'MIN':
        return Math.min(...bindings.map(b => b.get(this.aggregateField)).filter(v => typeof v === 'number'));
        
      case 'MAX':
        return Math.max(...bindings.map(b => b.get(this.aggregateField)).filter(v => typeof v === 'number'));
        
      case 'COLLECT':
        return bindings.map(b => b.get(this.aggregateField));
        
      default:
        return bindings.length;
    }
  }

  toTriples() {
    const triples = super.toTriples();
    const id = this.getId();

    triples.push([id, 'kg:aggregationType', `kg:${this.aggregationType}`]);
    triples.push([id, 'kg:sourceQuery', this.sourceQuery.getId()]);
    
    if (this.aggregateField) {
      triples.push([id, 'kg:aggregateField', this.aggregateField]);
    }
    
    this.groupByFields.forEach(field => {
      triples.push([id, 'kg:groupByField', field]);
    });

    triples.push(...this.sourceQuery.toTriples());

    return triples;
  }
}

export default AggregationQuery;
