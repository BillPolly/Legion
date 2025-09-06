import { BaseQuery } from '../core/BaseQuery.js';
import { QueryVariable, VariableBinding } from '../core/QueryVariable.js';
import { TriplePattern } from '../core/TriplePattern.js';
import { RangeConstraint, RegexConstraint, FunctionConstraint } from '../constraints/index.js';
import { QueryResult } from '../execution/QueryResult.js';

/**
 * Pattern Query Implementation
 */
export class PatternQuery extends BaseQuery {
  constructor(id = null) {
    super(id);
    this.patterns = [];
    this.variables = new Map();
  }

  addPattern(triplePattern) {
    if (triplePattern === null || triplePattern === undefined) {
      throw new Error('Pattern cannot be null or undefined');
    }
    this.patterns.push(triplePattern);
    
    // Register variables and merge constraints
    triplePattern.getVariables().forEach(variable => {
      if (this.variables.has(variable.name)) {
        // Merge constraints from existing variable
        const existingVariable = this.variables.get(variable.name);
        variable.constraints.forEach(constraint => {
          existingVariable.addConstraint(constraint);
        });
        // Update the pattern to use the existing variable
        if (triplePattern.subject === variable) {
          triplePattern.subject = existingVariable;
        }
        if (triplePattern.predicate === variable) {
          triplePattern.predicate = existingVariable;
        }
        if (triplePattern.object === variable) {
          triplePattern.object = existingVariable;
        }
      } else {
        this.variables.set(variable.name, variable);
      }
    });

    return this;
  }

  pattern(subject, predicate, object) {
    // Convert string variables to QueryVariable objects
    if (typeof subject === 'string' && subject.startsWith('?')) {
      subject = this.getOrCreateVariable(subject.substring(1));
    }
    if (typeof predicate === 'string' && predicate.startsWith('?')) {
      predicate = this.getOrCreateVariable(predicate.substring(1));
    }
    if (typeof object === 'string' && object.startsWith('?')) {
      object = this.getOrCreateVariable(object.substring(1));
    }

    const triplePattern = new TriplePattern(subject, predicate, object);
    return this.addPattern(triplePattern);
  }

  getOrCreateVariable(name) {
    if (!this.variables.has(name)) {
      this.variables.set(name, new QueryVariable(name));
    }
    return this.variables.get(name);
  }

  getVariable(name) {
    return this.variables.get(name);
  }

  constraint(variableName, operator, value) {
    const variable = this.getOrCreateVariable(variableName.startsWith('?') ? variableName.substring(1) : variableName);
    
    let constraint;
    switch (operator) {
      case '>':
        constraint = new RangeConstraint(value, null);
        break;
      case '<':
        constraint = new RangeConstraint(null, value);
        break;
      case '>=':
        constraint = new RangeConstraint(value, null);
        break;
      case '<=':
        constraint = new RangeConstraint(null, value);
        break;
      case 'matches':
        constraint = new RegexConstraint(value);
        break;
      default:
        constraint = new FunctionConstraint((v) => {
          switch (operator) {
            case '=': case '==': case '===': return v === value;
            case '!=': case '!==': return v !== value;
            default: return false;
          }
        }, `${variableName} ${operator} ${value}`);
    }
    
    variable.addConstraint(constraint);
    return this;
  }

  async _executeInternal(kgEngine, context = {}) {
    const bindings = [];
    const variableNames = Array.from(this.variables.keys());
    const queryId = this.getId();
    
    console.log(`[PATTERN EXEC] ${queryId} - Patterns: ${this.patterns.length}, Variables: ${variableNames.length}`);
    
    if (this.patterns.length === 0) {
      console.log(`[PATTERN EXEC] ${queryId} - No patterns, returning empty result`);
      return new QueryResult(this, [], variableNames);
    }

    // Add circular reference detection
    const executionStack = context.executionStack || new Set();
    
    if (executionStack.has(queryId)) {
      console.warn(`[PATTERN EXEC] Circular reference detected in PatternQuery ${queryId}, returning empty result`);
      return new QueryResult(this, [], variableNames);
    }
    
    // Add execution timeout protection
    const maxPatterns = 1000;
    if (this.patterns.length > maxPatterns) {
      console.warn(`[PATTERN EXEC] PatternQuery ${queryId} has too many patterns (${this.patterns.length}), limiting to ${maxPatterns}`);
      this.patterns = this.patterns.slice(0, maxPatterns);
    }

    // Detect potential Cartesian product explosion
    this.detectCartesianExplosion(queryId);
    
    console.log(`[PATTERN EXEC] ${queryId} - Executing first pattern`);
    // Execute first pattern to get initial bindings
    let currentBindings = await this.executePattern(this.patterns[0], kgEngine, new Map());
    console.log(`[PATTERN EXEC] ${queryId} - First pattern completed with ${currentBindings.length} bindings`);
    
    // Join with remaining patterns
    let hitBindingLimit = false;
    for (let i = 1; i < this.patterns.length; i++) {
      console.log(`[PATTERN EXEC] ${queryId} - Processing pattern ${i + 1}/${this.patterns.length}, current bindings: ${currentBindings.length}`);
      
      const newBindings = [];
      const maxBindings = 10000; // Limit to prevent memory explosion
      
      for (const binding of currentBindings) {
        if (newBindings.length >= maxBindings) {
          console.warn(`[PATTERN EXEC] ${queryId} - Reached max bindings limit (${maxBindings}), stopping all pattern processing`);
          hitBindingLimit = true;
          break;
        }
        
        const patternBindings = await this.executePattern(this.patterns[i], kgEngine, binding);
        for (const patternBinding of patternBindings) {
          if (newBindings.length >= maxBindings) {
            hitBindingLimit = true;
            break;
          }
          // Merge bindings
          const mergedBinding = new Map([...binding, ...patternBinding]);
          newBindings.push(mergedBinding);
        }
        
        if (hitBindingLimit) {
          break;
        }
      }
      
      currentBindings = newBindings;
      
      // Early termination if no bindings remain or hit binding limit
      if (currentBindings.length === 0) {
        console.log(`[PATTERN EXEC] ${queryId} - No bindings remain after pattern ${i + 1}, terminating early`);
        break;
      }
      
      if (hitBindingLimit) {
        console.log(`[PATTERN EXEC] ${queryId} - Hit binding limit, terminating pattern processing at pattern ${i + 1}`);
        break;
      }
    }

    // Apply constraints
    const filteredBindings = currentBindings.filter(binding => {
      return this.evaluateConstraints(binding);
    });

    // Return Map bindings directly
    return new QueryResult(this, filteredBindings, variableNames);
  }

  async executePattern(pattern, kgEngine, existingBinding) {
    // Substitute bound variables
    const subject = pattern.subject instanceof QueryVariable && existingBinding.has(pattern.subject.name) 
      ? existingBinding.get(pattern.subject.name) 
      : (pattern.subject instanceof QueryVariable ? null : pattern.subject);
    
    const predicate = pattern.predicate instanceof QueryVariable && existingBinding.has(pattern.predicate.name)
      ? existingBinding.get(pattern.predicate.name)
      : (pattern.predicate instanceof QueryVariable ? null : pattern.predicate);
    
    const object = pattern.object instanceof QueryVariable && existingBinding.has(pattern.object.name)
      ? existingBinding.get(pattern.object.name)
      : (pattern.object instanceof QueryVariable ? null : pattern.object);

    // Query the knowledge graph
    const triples = await kgEngine.query(subject, predicate, object);
    
    // Create bindings for variables
    const bindings = [];
    for (const [s, p, o] of triples) {
      const binding = new Map(existingBinding);
      
      if (pattern.subject instanceof QueryVariable && !existingBinding.has(pattern.subject.name)) {
        binding.set(pattern.subject.name, s);
      }
      if (pattern.predicate instanceof QueryVariable && !existingBinding.has(pattern.predicate.name)) {
        binding.set(pattern.predicate.name, p);
      }
      if (pattern.object instanceof QueryVariable && !existingBinding.has(pattern.object.name)) {
        binding.set(pattern.object.name, o);
      }
      
      bindings.push(binding);
    }
    
    return bindings;
  }

  evaluateConstraints(binding) {
    for (const [variableName, variable] of this.variables) {
      if (binding.has(variableName)) {
        const value = binding.get(variableName);
        for (const constraint of variable.constraints) {
          if (!constraint.evaluate(value, { binding })) {
            return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * Detect potential Cartesian product explosion by analyzing variable sharing between patterns
   */
  detectCartesianExplosion(queryId) {
    if (this.patterns.length <= 1) return;

    // Analyze variable sharing between patterns
    const patternVariables = this.patterns.map(pattern => {
      const vars = new Set();
      pattern.getVariables().forEach(v => vars.add(v.name));
      return vars;
    });

    // Count unrelated patterns (patterns that share no variables)
    let unrelatedPatterns = 0;
    for (let i = 0; i < patternVariables.length; i++) {
      let hasSharedVariable = false;
      for (let j = 0; j < patternVariables.length; j++) {
        if (i !== j) {
          // Check if patterns i and j share any variables
          for (const varName of patternVariables[i]) {
            if (patternVariables[j].has(varName)) {
              hasSharedVariable = true;
              break;
            }
          }
          if (hasSharedVariable) break;
        }
      }
      if (!hasSharedVariable) {
        unrelatedPatterns++;
      }
    }

    // Warn about potential explosion
    if (unrelatedPatterns > 5) {
      console.warn(`[PATTERN EXEC] ${queryId} - WARNING: Query has ${unrelatedPatterns} unrelated patterns that may cause exponential result explosion (Cartesian product)`);
      console.warn(`[PATTERN EXEC] ${queryId} - Consider adding shared variables between patterns to constrain results`);
    } else if (unrelatedPatterns > 0) {
      console.log(`[PATTERN EXEC] ${queryId} - INFO: Query has ${unrelatedPatterns} unrelated patterns, results will be Cartesian product`);
    }
  }

  toTriples() {
    const triples = super.toTriples();
    const id = this.getId();

    // Override the type to be PatternQuery
    const typeTripleIndex = triples.findIndex(([s, p, o]) => 
      s === id && p === 'rdf:type' && o === 'kg:Query'
    );
    if (typeTripleIndex !== -1) {
      triples[typeTripleIndex] = [id, 'rdf:type', 'kg:PatternQuery'];
    }

    // Add patterns
    this.patterns.forEach((pattern, index) => {
      triples.push([id, 'kg:hasPattern', pattern.getId()]);
      triples.push(...pattern.toTriples());
    });

    // Add variables
    for (const variable of this.variables.values()) {
      triples.push([id, 'kg:hasVariable', variable.getId()]);
      triples.push(...variable.toTriples());
    }

    return triples;
  }
}

export default PatternQuery;
