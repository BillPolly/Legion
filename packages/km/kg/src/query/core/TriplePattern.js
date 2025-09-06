import { QueryVariable, VariableBinding } from './QueryVariable.js';

/**
 * Triple Pattern Implementation
 */
export class TriplePattern {
  constructor(subject, predicate, object) {
    // Allow null values for wildcard queries, but not undefined
    if (subject === undefined) {
      throw new Error('Subject cannot be undefined');
    }
    if (predicate === undefined) {
      throw new Error('Predicate cannot be undefined');
    }
    if (object === undefined) {
      throw new Error('Object cannot be undefined');
    }
    
    this.subject = subject;
    this.predicate = predicate;
    this.object = object;
    this._kgId = `pattern_${Math.random().toString(36).substr(2, 9)}`;
    this.constraints = [];
    this.variables = this._extractVariables();
  }

  getId() {
    return this._kgId;
  }

  addConstraint(constraint) {
    this.constraints.push(constraint);
    return this;
  }

  _extractVariables() {
    const variables = [];
    const variableMap = new Map();

    // Helper function to process a position
    const processPosition = (position) => {
      if (position instanceof QueryVariable) {
        return position;
      } else if (typeof position === 'string' && position.startsWith('?')) {
        const varName = position.substring(1);
        if (!variableMap.has(varName)) {
          const variable = new QueryVariable(varName);
          variableMap.set(varName, variable);
        }
        return variableMap.get(varName);
      }
      return position;
    };

    this.subject = processPosition(this.subject);
    this.predicate = processPosition(this.predicate);
    this.object = processPosition(this.object);

    // Collect all variables
    if (this.subject instanceof QueryVariable) variables.push(this.subject);
    if (this.predicate instanceof QueryVariable) variables.push(this.predicate);
    if (this.object instanceof QueryVariable) variables.push(this.object);

    return variables;
  }

  getVariables() {
    return this.variables;
  }

  getVariableNames() {
    return this.variables.map(v => v.name);
  }

  getAllConstraints() {
    const allConstraints = [...this.constraints];
    this.variables.forEach(variable => {
      allConstraints.push(...variable.constraints);
    });
    return allConstraints;
  }

  match(kgEngine) {
    const matches = [];
    
    // Convert pattern to query parameters
    const subjectQuery = this.subject instanceof QueryVariable ? null : this.subject;
    const predicateQuery = this.predicate instanceof QueryVariable ? null : this.predicate;
    const objectQuery = this.object instanceof QueryVariable ? null : this.object;
    
    // Query the knowledge graph
    const triples = kgEngine.query(subjectQuery, predicateQuery, objectQuery);
    
    // Process each matching triple
    for (const [s, p, o] of triples) {
      const binding = new VariableBinding();
      let validMatch = true;
      
      // Bind variables and check constraints
      if (this.subject instanceof QueryVariable) {
        if (this.subject.validateValue(s)) {
          binding.bind(this.subject.name, s);
        } else {
          validMatch = false;
        }
      }
      
      if (this.predicate instanceof QueryVariable && validMatch) {
        if (this.predicate.validateValue(p)) {
          binding.bind(this.predicate.name, p);
        } else {
          validMatch = false;
        }
      }
      
      if (this.object instanceof QueryVariable && validMatch) {
        if (this.object.validateValue(o)) {
          binding.bind(this.object.name, o);
        } else {
          validMatch = false;
        }
      }
      
      if (validMatch) {
        matches.push({
          triple: [s, p, o],
          bindings: binding
        });
      }
    }
    
    return matches;
  }

  estimateSelectivity(kgEngine) {
    const totalTriples = kgEngine.size();
    if (totalTriples === 0) return 0;
    
    // Estimate based on how many positions are bound
    let boundPositions = 0;
    if (!(this.subject instanceof QueryVariable)) boundPositions++;
    if (!(this.predicate instanceof QueryVariable)) boundPositions++;
    if (!(this.object instanceof QueryVariable)) boundPositions++;
    
    // More bound positions = higher selectivity (fewer results)
    switch (boundPositions) {
      case 3: return 1.0; // Exact match
      case 2: return 0.8;
      case 1: return 0.4;
      case 0: return 0.1; // All variables
      default: return 0.5;
    }
  }

  getOptimizationHints(kgEngine) {
    const selectivity = this.estimateSelectivity(kgEngine);
    const totalTriples = kgEngine.size();
    const estimatedResultSize = Math.ceil(totalTriples * (1 - selectivity));
    
    return {
      estimatedResultSize,
      selectivity,
      recommendedExecutionOrder: this._getRecommendedExecutionOrder(),
      indexUsage: this._getIndexUsage(),
      constraints: this.getAllConstraints().length
    };
  }

  _getRecommendedExecutionOrder() {
    // Recommend executing more selective patterns first
    let boundPositions = 0;
    if (!(this.subject instanceof QueryVariable)) boundPositions++;
    if (!(this.predicate instanceof QueryVariable)) boundPositions++;
    if (!(this.object instanceof QueryVariable)) boundPositions++;
    
    return boundPositions >= 2 ? 'early' : 'late';
  }

  _getIndexUsage() {
    const indices = [];
    if (!(this.subject instanceof QueryVariable)) indices.push('subject');
    if (!(this.predicate instanceof QueryVariable)) indices.push('predicate');
    if (!(this.object instanceof QueryVariable)) indices.push('object');
    return indices;
  }

  isValid() {
    try {
      this.getValidationErrors();
      return true;
    } catch (error) {
      return false;
    }
  }

  getValidationErrors() {
    const errors = [];
    
    if (!this.subject) errors.push('Subject is required');
    if (!this.predicate) errors.push('Predicate is required');
    if (!this.object) errors.push('Object is required');
    
    // Check variable constraint conflicts
    const conflicts = this.detectConstraintConflicts();
    errors.push(...conflicts);
    
    return errors;
  }

  detectConstraintConflicts() {
    const conflicts = [];
    
    this.variables.forEach(variable => {
      const rangeConstraints = variable.constraints.filter(c => c.constructor.name === 'RangeConstraint');
      
      if (rangeConstraints.length > 1) {
        // Check for overlapping ranges
        for (let i = 0; i < rangeConstraints.length - 1; i++) {
          for (let j = i + 1; j < rangeConstraints.length; j++) {
            const c1 = rangeConstraints[i];
            const c2 = rangeConstraints[j];
            
            // Check if ranges don't overlap
            if ((c1.maxValue !== null && c2.minValue !== null && c1.maxValue < c2.minValue) ||
                (c2.maxValue !== null && c1.minValue !== null && c2.maxValue < c1.minValue)) {
              conflicts.push(`Conflicting range constraints on variable ${variable.name}`);
            }
          }
        }
      }
    });
    
    return conflicts;
  }

  toTriples() {
    const id = this.getId();
    const triples = [];

    triples.push([id, 'rdf:type', 'kg:TriplePattern']);
    triples.push([id, 'kg:subject', this.subject instanceof QueryVariable ? this.subject.name : this.subject]);
    triples.push([id, 'kg:predicate', this.predicate instanceof QueryVariable ? this.predicate.name : this.predicate]);
    triples.push([id, 'kg:object', this.object instanceof QueryVariable ? this.object.name : this.object]);

    // Add variable triples
    this.variables.forEach(variable => {
      triples.push([id, 'kg:hasVariable', variable.getId()]);
      triples.push(...variable.toTriples());
    });

    // Add pattern-level constraints
    this.constraints.forEach(constraint => {
      triples.push([id, 'kg:hasConstraint', constraint.getId()]);
      triples.push(...constraint.toTriples());
    });

    return triples;
  }
}

export default TriplePattern;
