import { BaseQuery } from '../core/BaseQuery.js';
import { QueryResult } from '../execution/QueryResult.js';
import { VariableBinding } from '../core/QueryVariable.js';

/**
 * Sequential Query Composition
 */
export class SequentialQuery extends BaseQuery {
  constructor() {
    super();
    this.stages = [];
  }

  addStage(query) {
    if (query === null || query === undefined) {
      throw new Error('Stage cannot be null or undefined');
    }
    this.stages.push(query);
    return this;
  }

  async _executeInternal(kgEngine, context = {}) {
    if (this.stages.length === 0) {
      return new QueryResult(this, [], []);
    }

    // Add circular reference detection
    const executionStack = context.executionStack || new Set();
    const queryId = this.getId();
    
    if (executionStack.has(queryId)) {
      console.warn(`Circular reference detected in SequentialQuery ${queryId}, returning empty result`);
      return new QueryResult(this, [], []);
    }
    
    // Add this query to the execution stack
    const newContext = {
      ...context,
      executionStack: new Set([...executionStack, queryId])
    };

    let currentResult = await this.stages[0].execute(kgEngine, newContext);
    
    for (let i = 1; i < this.stages.length; i++) {
      // Pass previous results as context to next stage
      const stageContext = { ...newContext, previousResult: currentResult };
      const stageResult = await this.stages[i].execute(kgEngine, stageContext);
      
      // Filter stage results to only include bindings that are compatible with previous results
      const filteredBindings = this.filterCompatibleBindings(currentResult, stageResult);
      
      // Merge variable names from both results
      const allVariableNames = new Set([...currentResult.variableNames, ...stageResult.variableNames]);
      
      currentResult = new QueryResult(this, filteredBindings, Array.from(allVariableNames));
    }

    return currentResult;
  }

  /**
   * Filter bindings from stage result to only include those compatible with previous results
   */
  filterCompatibleBindings(previousResult, stageResult) {
    if (previousResult.bindings.length === 0) {
      return [];
    }

    const filteredBindings = [];

    for (const stageBinding of stageResult.bindings) {
      for (const prevBinding of previousResult.bindings) {
        const mergedBinding = this.tryMergeBindings(prevBinding, stageBinding);
        if (mergedBinding) {
          filteredBindings.push(mergedBinding);
        }
      }
    }

    return filteredBindings;
  }

  /**
   * Try to merge two bindings, return null if they conflict
   */
  tryMergeBindings(binding1, binding2) {
    const merged = new VariableBinding();
    
    // Copy all bindings from binding1
    binding1.forEach((value, variable) => {
      merged.bind(variable, value);
    });
    
    // Add bindings from binding2, checking for conflicts
    let hasConflict = false;
    binding2.forEach((value, variable) => {
      if (merged.has(variable) && merged.get(variable) !== value) {
        hasConflict = true;
      } else {
        merged.bind(variable, value);
      }
    });
    
    return hasConflict ? null : merged;
  }

  toTriples() {
    const triples = super.toTriples();
    const id = this.getId();

    this.stages.forEach((stage, index) => {
      const stageId = `${id}_stage_${index}`;
      triples.push([id, 'kg:hasStage', stageId]);
      triples.push([stageId, 'kg:stageOrder', index]);
      triples.push([stageId, 'kg:stageQuery', stage.getId()]);
      
      if (index > 0) {
        const prevStageId = `${id}_stage_${index - 1}`;
        triples.push([stageId, 'kg:inputFrom', prevStageId]);
      }
      
      triples.push(...stage.toTriples());
    });

    return triples;
  }
}

export default SequentialQuery;
