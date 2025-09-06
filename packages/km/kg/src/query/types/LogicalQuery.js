import { BaseQuery } from '../core/BaseQuery.js';
import { QueryResult } from '../execution/QueryResult.js';
import { VariableBinding } from '../core/QueryVariable.js';

/**
 * Logical Query Composition
 */
export class LogicalQuery extends BaseQuery {
  constructor(operator = 'AND') {
    super();
    const validOperators = ['AND', 'OR', 'NOT', 'XOR'];
    if (!validOperators.includes(operator)) {
      throw new Error(`Invalid logical operator: ${operator}`);
    }
    this.operator = operator; // 'AND', 'OR', 'NOT', 'XOR'
    this.operands = [];
  }

  addOperand(query) {
    this.operands.push(query);
    return this;
  }

  leftOperand(query) {
    if (this.operands.length === 0) {
      this.operands.push(query);
    } else {
      this.operands[0] = query;
    }
    return this;
  }

  rightOperand(query) {
    if (this.operands.length <= 1) {
      this.operands.push(query);
    } else {
      this.operands[1] = query;
    }
    return this;
  }

  async _executeInternal(kgEngine, context = {}) {
    const queryId = this.getId();
    console.log(`[LOGICAL EXEC] ${queryId} - Operands: ${this.operands.length}, Operator: ${this.operator}`);
    
    if (this.operands.length === 0) {
      console.log(`[LOGICAL EXEC] ${queryId} - No operands, returning empty result`);
      return new QueryResult(this, [], []);
    }

    // Add circular reference detection
    const executionStack = context.executionStack || new Set();
    
    if (executionStack.has(queryId)) {
      console.warn(`[LOGICAL EXEC] Circular reference detected in LogicalQuery ${queryId}, returning empty result`);
      return new QueryResult(this, [], []);
    }
    
    // Add this query to the execution stack
    const newContext = {
      ...context,
      executionStack: new Set([...executionStack, queryId])
    };

    console.log(`[LOGICAL EXEC] ${queryId} - Executing ${this.operands.length} operands`);
    
    const results = await Promise.all(
      this.operands.map((operand, index) => {
        console.log(`[LOGICAL EXEC] ${queryId} - Executing operand ${index}: ${operand.constructor.name} ${operand.getId()}`);
        return operand.execute(kgEngine, newContext);
      })
    );
    
    console.log(`[LOGICAL EXEC] ${queryId} - All operands executed, processing results`);

    let finalBindings = [];
    const allVariables = new Set();

    // Collect all variable names
    results.forEach(result => {
      result.variableNames.forEach(name => allVariables.add(name));
    });

    switch (this.operator) {
      case 'AND':
        finalBindings = this.intersectResults(results);
        break;
      case 'OR':
        finalBindings = this.unionResults(results);
        break;
      case 'NOT':
        if (results.length >= 2) {
          finalBindings = this.subtractResults(results[0], results[1]);
        }
        break;
      case 'XOR':
        finalBindings = this.xorResults(results);
        break;
    }

    return new QueryResult(this, finalBindings, Array.from(allVariables));
  }

  intersectResults(results) {
    if (results.length === 0) return [];
    if (results.length === 1) return results[0].bindings;

    let intersection = results[0].bindings;
    
    for (let i = 1; i < results.length; i++) {
      const newIntersection = [];
      
      for (const binding1 of intersection) {
        for (const binding2 of results[i].bindings) {
          const merged = this.mergeBindings(binding1, binding2);
          if (merged) {
            newIntersection.push(merged);
          }
        }
      }
      
      intersection = newIntersection;
    }
    
    return intersection;
  }

  unionResults(results) {
    const union = [];
    const seen = new Set();
    
    for (const result of results) {
      for (const binding of result.bindings) {
        const key = this.bindingToKey(binding);
        if (!seen.has(key)) {
          seen.add(key);
          union.push(binding);
        }
      }
    }
    
    return union;
  }

  subtractResults(result1, result2) {
    const subtraction = [];
    
    for (const binding1 of result1.bindings) {
      let found = false;
      
      for (const binding2 of result2.bindings) {
        if (this.bindingsCompatible(binding1, binding2)) {
          found = true;
          break;
        }
      }
      
      if (!found) {
        subtraction.push(binding1);
      }
    }
    
    return subtraction;
  }

  xorResults(results) {
    // XOR: elements that appear in exactly one result set
    const counts = new Map();
    const bindingMap = new Map();
    
    for (const result of results) {
      for (const binding of result.bindings) {
        const key = this.bindingToKey(binding);
        counts.set(key, (counts.get(key) || 0) + 1);
        bindingMap.set(key, binding);
      }
    }
    
    const xor = [];
    for (const [key, count] of counts) {
      if (count === 1) {
        xor.push(bindingMap.get(key));
      }
    }
    
    return xor;
  }

  mergeBindings(binding1, binding2) {
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

  bindingsCompatible(binding1, binding2) {
    let compatible = true;
    binding1.forEach((value, variable) => {
      if (binding2.has(variable) && binding2.get(variable) !== value) {
        compatible = false;
      }
    });
    return compatible;
  }

  bindingToKey(binding) {
    const entries = [];
    binding.forEach((value, variable) => {
      entries.push([variable, value]);
    });
    const sorted = entries.sort();
    return JSON.stringify(sorted);
  }

  toTriples() {
    const triples = super.toTriples();
    const id = this.getId();

    triples.push([id, 'kg:operator', `kg:${this.operator}`]);

    this.operands.forEach((operand, index) => {
      triples.push([id, 'kg:hasOperand', operand.getId()]);
      triples.push(...operand.toTriples());
    });

    return triples;
  }
}

export default LogicalQuery;
