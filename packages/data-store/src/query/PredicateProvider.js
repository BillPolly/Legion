/**
 * Predicate providers for computed predicates
 * Per design §5: Enumerable and pointwise predicate support
 * 
 * PredicateProviders implement computed relations that can be
 * integrated into the LFTJ kernel query execution.
 */

/**
 * Base class for predicate providers
 * Per design: predicates are relations with computed membership
 */
export class PredicateProvider {
  constructor(name) {
    if (new.target === PredicateProvider) {
      throw new Error('PredicateProvider is an abstract class');
    }
    if (!name) {
      throw new Error('Predicate name is required');
    }
    this._name = name;
    this._parameters = new Map();
  }

  /**
   * Get the predicate name
   */
  get name() {
    return this._name;
  }

  /**
   * Get predicate type (enumerable or pointwise)
   */
  get type() {
    throw new Error('type getter must be implemented by subclass');
  }

  /**
   * Set a parameter value
   */
  setParameter(name, value) {
    this._parameters.set(name, value);
    return this;
  }

  /**
   * Get a parameter value
   */
  getParameter(name) {
    return this._parameters.get(name);
  }

  /**
   * Check if predicate can be evaluated
   */
  canEvaluate() {
    return true; // Subclasses can override
  }

  /**
   * Convert to GraphSpec representation
   */
  toGraphSpec() {
    return {
      type: 'predicate',
      predicateType: this.type,
      name: this._name,
      parameters: Object.fromEntries(this._parameters)
    };
  }
}

/**
 * Enumerable predicate - can list all satisfying values
 * Per design: supports iteration over all valid bindings
 */
export class EnumerablePredicate extends PredicateProvider {
  constructor(name) {
    super(name);
  }

  get type() {
    return 'enumerable';
  }

  /**
   * Enumerate all values that satisfy the predicate
   * To be implemented by subclasses
   */
  enumerate(context = {}) {
    throw new Error('enumerate must be implemented by subclass');
  }

  /**
   * Check if a value satisfies the predicate
   * Default implementation checks enumeration
   */
  check(value, context = {}) {
    const values = this.enumerate(context);
    return values.includes(value);
  }

  /**
   * Get iterator interface for kernel integration
   */
  getIterator(context = {}) {
    const values = this.enumerate(context);
    let index = 0;
    
    return {
      hasNext: () => index < values.length,
      next: () => values[index++],
      seek: (target) => {
        // Binary search for efficiency
        let left = index;
        let right = values.length - 1;
        
        while (left <= right) {
          const mid = Math.floor((left + right) / 2);
          const val = values[mid];
          
          if (val < target) {
            left = mid + 1;
          } else {
            right = mid - 1;
          }
        }
        
        // Position at the found value
        index = left;
        
        // If found, return the value and advance index for next call
        if (index < values.length) {
          return values[index++];
        }
        return null;
      },
      reset: () => { index = 0; }
    };
  }
}

/**
 * Pointwise predicate - checks individual values
 * Per design: cannot enumerate, only test membership
 */
export class PointwisePredicate extends PredicateProvider {
  constructor(name) {
    super(name);
  }

  get type() {
    return 'pointwise';
  }

  /**
   * Check if a value satisfies the predicate
   * To be implemented by subclasses
   */
  check(value, context = {}) {
    throw new Error('check must be implemented by subclass');
  }

  /**
   * Pointwise predicates cannot enumerate
   */
  enumerate() {
    throw new Error('Pointwise predicates cannot enumerate values');
  }
}

/**
 * Common predicate: IsType
 * Checks if entity has a specific type
 */
export class IsTypePredicate extends EnumerablePredicate {
  constructor(typeName) {
    super('IsType');
    this.setParameter('type', typeName);
    this._entities = new Set();
  }

  /**
   * Register an entity as having this type
   */
  addEntity(entity) {
    this._entities.add(entity);
    return this;
  }

  /**
   * Remove an entity from this type
   */
  removeEntity(entity) {
    this._entities.delete(entity);
    return this;
  }

  enumerate() {
    return Array.from(this._entities).sort();
  }

  check(value) {
    return this._entities.has(value);
  }
}

/**
 * Common predicate: HasTag
 * Checks if entity has a specific tag
 */
export class HasTagPredicate extends EnumerablePredicate {
  constructor(tag) {
    super('HasTag');
    this.setParameter('tag', tag);
    this._taggedEntities = new Set();
  }

  /**
   * Add a tag to an entity
   */
  addTag(entity) {
    this._taggedEntities.add(entity);
    return this;
  }

  /**
   * Remove a tag from an entity
   */
  removeTag(entity) {
    this._taggedEntities.delete(entity);
    return this;
  }

  enumerate() {
    return Array.from(this._taggedEntities).sort();
  }

  check(value) {
    return this._taggedEntities.has(value);
  }
}

/**
 * Common predicate: InRange
 * Checks if value is in numeric range
 */
export class InRangePredicate extends PointwisePredicate {
  constructor(min, max) {
    super('InRange');
    this.setParameter('min', min);
    this.setParameter('max', max);
  }

  check(value) {
    const min = this.getParameter('min');
    const max = this.getParameter('max');
    
    if (typeof value !== 'number') {
      return false;
    }
    
    return value >= min && value <= max;
  }
}

/**
 * Common predicate: MatchesPattern
 * Checks if string matches regex pattern
 */
export class MatchesPatternPredicate extends PointwisePredicate {
  constructor(pattern) {
    super('MatchesPattern');
    
    if (typeof pattern === 'string') {
      this._regex = new RegExp(pattern);
    } else if (pattern instanceof RegExp) {
      this._regex = pattern;
    } else {
      throw new Error('Pattern must be string or RegExp');
    }
    
    this.setParameter('pattern', pattern.toString());
  }

  check(value) {
    if (typeof value !== 'string') {
      return false;
    }
    
    return this._regex.test(value);
  }
}

/**
 * Composite predicate: AND
 * Combines multiple predicates with AND logic
 */
export class AndPredicate extends PointwisePredicate {
  constructor(predicates = []) {
    super('And');
    this._predicates = predicates;
  }

  addPredicate(predicate) {
    this._predicates.push(predicate);
    return this;
  }

  check(value, context = {}) {
    return this._predicates.every(pred => pred.check(value, context));
  }

  canEvaluate() {
    return this._predicates.every(pred => pred.canEvaluate());
  }
}

/**
 * Composite predicate: OR
 * Combines multiple predicates with OR logic
 */
export class OrPredicate extends PointwisePredicate {
  constructor(predicates = []) {
    super('Or');
    this._predicates = predicates;
  }

  addPredicate(predicate) {
    this._predicates.push(predicate);
    return this;
  }

  check(value, context = {}) {
    return this._predicates.some(pred => pred.check(value, context));
  }

  canEvaluate() {
    return this._predicates.every(pred => pred.canEvaluate());
  }
}

/**
 * Composite predicate: NOT
 * Negates a predicate
 */
export class NotPredicate extends PointwisePredicate {
  constructor(predicate) {
    super('Not');
    if (!predicate) {
      throw new Error('Predicate is required for negation');
    }
    this._predicate = predicate;
  }

  check(value, context = {}) {
    return !this._predicate.check(value, context);
  }

  canEvaluate() {
    return this._predicate.canEvaluate();
  }
}

/**
 * Predicate registry for managing predicate providers
 */
export class PredicateRegistry {
  constructor() {
    this._predicates = new Map();
    this._typePredicates = new Map(); // type -> IsTypePredicate
    this._tagPredicates = new Map();  // tag -> HasTagPredicate
  }

  /**
   * Register a predicate provider
   */
  register(name, predicate) {
    if (!name) {
      throw new Error('Predicate name is required');
    }
    if (!predicate) {
      throw new Error('Predicate provider is required');
    }
    
    this._predicates.set(name, predicate);
    return this;
  }

  /**
   * Get a predicate provider
   */
  get(name) {
    return this._predicates.get(name);
  }

  /**
   * Check if predicate is registered
   */
  has(name) {
    return this._predicates.has(name);
  }

  /**
   * Get or create IsType predicate
   */
  getTypePredicate(typeName) {
    if (!this._typePredicates.has(typeName)) {
      const predicate = new IsTypePredicate(typeName);
      this._typePredicates.set(typeName, predicate);
      this.register(`IsType:${typeName}`, predicate);
    }
    return this._typePredicates.get(typeName);
  }

  /**
   * Get or create HasTag predicate
   */
  getTagPredicate(tag) {
    if (!this._tagPredicates.has(tag)) {
      const predicate = new HasTagPredicate(tag);
      this._tagPredicates.set(tag, predicate);
      this.register(`HasTag:${tag}`, predicate);
    }
    return this._tagPredicates.get(tag);
  }

  /**
   * Create predicate from specification
   */
  createFromSpec(spec) {
    if (!spec || typeof spec !== 'object') {
      throw new Error('Predicate specification is required');
    }

    switch (spec.type) {
      case 'isType':
        return this.getTypePredicate(spec.typeName);
        
      case 'hasTag':
        return this.getTagPredicate(spec.tag);
        
      case 'inRange':
        return new InRangePredicate(spec.min, spec.max);
        
      case 'matchesPattern':
        return new MatchesPatternPredicate(spec.pattern);
        
      case 'and':
        const andPreds = spec.predicates.map(p => this.createFromSpec(p));
        return new AndPredicate(andPreds);
        
      case 'or':
        const orPreds = spec.predicates.map(p => this.createFromSpec(p));
        return new OrPredicate(orPreds);
        
      case 'not':
        return new NotPredicate(this.createFromSpec(spec.predicate));
        
      default:
        // Try to find registered predicate
        if (this.has(spec.name)) {
          return this.get(spec.name);
        }
        throw new Error(`Unknown predicate type: ${spec.type}`);
    }
  }

  /**
   * Clear all predicates
   */
  clear() {
    this._predicates.clear();
    this._typePredicates.clear();
    this._tagPredicates.clear();
  }
}