import { PathExpression } from './PathExpression.js';

/**
 * Variable Length Path Expression
 */
export class VariableLengthPath extends PathExpression {
  constructor(predicate, minLength, maxLength, direction = 'outgoing') {
    super('variable');
    this.predicate = predicate;
    this.minLength = minLength;
    this.maxLength = maxLength;
    this.direction = direction;
    this.constraints = new Map();
    this.metadata = new Map();
    this.executionStats = {
      optimizationTime: 0,
      executionCount: 0,
      totalExecutionTime: 0
    };
    this.optimized = false;
    
    // Set initial metadata
    this.metadata.set('predicate', predicate);
    this.metadata.set('minLength', minLength);
    this.metadata.set('maxLength', maxLength);
    this.metadata.set('direction', direction);
  }

  isUnbounded() {
    return this.maxLength === null;
  }

  includesIdentity() {
    return this.minLength === 0;
  }

  isOutgoing() {
    return this.direction === 'outgoing';
  }

  isIncoming() {
    return this.direction === 'incoming';
  }

  isBidirectional() {
    return this.direction === 'both';
  }

  reverse() {
    let newDirection;
    if (this.direction === 'outgoing') {
      newDirection = 'incoming';
    } else if (this.direction === 'incoming') {
      newDirection = 'outgoing';
    } else {
      newDirection = 'both'; // bidirectional stays the same
    }
    
    return new VariableLengthPath(this.predicate, this.minLength, this.maxLength, newDirection);
  }

  isCompatibleWith(otherPath) {
    // Bidirectional paths are compatible with any direction
    if (this.isBidirectional() || otherPath.isBidirectional()) {
      return true;
    }
    
    // Same direction paths are compatible
    return this.direction === otherPath.direction;
  }

  compose(otherPath) {
    if (!this.isCompatibleWith(otherPath)) {
      throw new Error(`Incompatible path directions: ${this.direction} and ${otherPath.direction}`);
    }
    
    // Create a composite path
    return {
      type: 'composite',
      steps: [this, otherPath],
      getId: () => `composite_${this.getId()}_${otherPath.getId()}`
    };
  }

  addConstraint(name, value) {
    this.constraints.set(name, value);
  }

  hasConstraint(name) {
    return this.constraints.has(name);
  }

  getConstraint(name) {
    return this.constraints.get(name);
  }

  getMetadata(key) {
    return this.metadata.get(key);
  }

  setMetadata(key, value) {
    this.metadata.set(key, value);
  }

  isValid() {
    try {
      const errors = this.getValidationErrors();
      return errors.length === 0;
    } catch (error) {
      return false;
    }
  }

  getValidationErrors() {
    const errors = [];
    
    if (this.minLength < 0) {
      errors.push('Minimum path length cannot be negative');
    }
    
    if (this.maxLength !== null && this.maxLength < 0) {
      errors.push('Maximum path length cannot be negative');
    }
    
    if (this.maxLength !== null && this.minLength > this.maxLength) {
      errors.push('Minimum length cannot be greater than maximum length');
    }
    
    if (!this.predicate || this.predicate.trim() === '') {
      errors.push('Path predicate cannot be empty');
    }
    
    if (!['outgoing', 'incoming', 'both'].includes(this.direction)) {
      errors.push('Invalid path direction. Must be "outgoing", "incoming", or "both"');
    }
    
    return errors;
  }

  getOptimizationHints(kgEngine) {
    const totalTriples = kgEngine.size();
    const predicateTriples = kgEngine.query(null, this.predicate, null).length;
    
    // Estimate complexity based on path length range and predicate frequency
    const avgLength = this.maxLength !== null ? 
      (this.minLength + this.maxLength) / 2 : 
      Math.min(this.minLength + 3, 5); // Assume reasonable max for unbounded
    
    const estimatedComplexity = Math.pow(predicateTriples, avgLength);
    
    // Calculate selectivity (higher = more selective, lower = less selective)
    // For path selectivity, we want inverse of frequency - rare predicates are more selective
    const selectivity = totalTriples > 0 ? 1 - (predicateTriples / totalTriples) : 0;
    
    // Determine recommended strategy
    let recommendedStrategy = 'breadth-first';
    if (this.isUnbounded() || (this.maxLength && this.maxLength > 3)) {
      recommendedStrategy = estimatedComplexity > 10000 ? 'bidirectional' : 'depth-first';
    }
    
    return {
      estimatedComplexity,
      selectivity,
      recommendedStrategy,
      indexUsage: ['predicate'],
      cachingRecommended: estimatedComplexity > 100,
      constraintCount: this.constraints.size,
      cycleDetectionRequired: this.hasConstraint('avoidCycles') || this.isUnbounded(),
      requiresCycleDetection: this.isUnbounded() || (this.maxLength && this.maxLength > 2),
      recommendedMaxDepth: this.maxLength !== null ? this.maxLength + 1 : 10
    };
  }

  getExecutionStats() {
    return { ...this.executionStats };
  }

  optimize(kgEngine) {
    const startTime = Date.now();
    
    // Perform optimization logic here
    // For now, just mark as optimized and record time
    
    this.executionStats.optimizationTime = Date.now() - startTime;
    this.optimized = true;
  }

  isOptimized() {
    return this.optimized;
  }

  toTriples() {
    const id = this.getId();
    const triples = [];

    triples.push([id, 'rdf:type', 'kg:VariableLengthPath']);
    triples.push([id, 'kg:predicate', this.predicate]);
    triples.push([id, 'kg:minLength', this.minLength]);
    triples.push([id, 'kg:maxLength', this.maxLength]);
    triples.push([id, 'kg:direction', this.direction]);

    // Add constraints
    for (const [name, value] of this.constraints) {
      triples.push([id, `kg:${name}`, value]);
    }

    // Add metadata
    for (const [key, value] of this.metadata) {
      if (!['predicate', 'minLength', 'maxLength', 'direction'].includes(key)) {
        triples.push([id, `kg:${key}`, value]);
      }
    }

    return triples;
  }
}

export default VariableLengthPath;
