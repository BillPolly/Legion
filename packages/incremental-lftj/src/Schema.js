/**
 * Schema implementation per design §3
 * R[x₁:τ₁,…,x_k:τ_k] where τ_i is a type predicate over Atoms
 */

export class TypePredicate {
  static Boolean = (atomStr) => atomStr.startsWith('Boolean(');
  static Integer = (atomStr) => atomStr.startsWith('Integer(');
  static Float = (atomStr) => atomStr.startsWith('Float(');
  static String = (atomStr) => atomStr.startsWith('String(');
  static Symbol = (atomStr) => atomStr.startsWith('Symbol(');
  static ID = (atomStr) => atomStr.startsWith('ID(');
  static any = (_atomStr) => true;

  static get(typeName) {
    return TypePredicate[typeName] || TypePredicate.any;
  }
}

export class Schema {
  constructor(variableSpecs, enableTypeChecking = false) {
    if (!Array.isArray(variableSpecs)) {
      throw new Error('Variable specs must be an array');
    }

    // Validate unique variable names
    const names = new Set();
    for (const spec of variableSpecs) {
      if (names.has(spec.name)) {
        throw new Error('Variable names must be unique');
      }
      names.add(spec.name);
    }

    this._variables = variableSpecs.map(spec => spec.name);
    this._types = variableSpecs.map(spec => spec.type);
    this._typePredicates = variableSpecs.map(spec => TypePredicate.get(spec.type));
    this._arity = variableSpecs.length;
    this._enableTypeChecking = enableTypeChecking;
    this._nameToPosition = new Map();
    
    for (let i = 0; i < this._variables.length; i++) {
      this._nameToPosition.set(this._variables[i], i);
    }

    Object.freeze(this);
  }

  get arity() {
    return this._arity;
  }

  get variables() {
    return [...this._variables];
  }

  get types() {
    return [...this._types];
  }

  /**
   * Validate tuple against schema per design §3.3
   */
  validateTuple(atomStrs) {
    // Validate arity
    if (atomStrs.length !== this._arity) {
      throw new Error(`Tuple arity ${atomStrs.length} does not match schema arity ${this._arity}`);
    }

    // Type checking (host-optional)
    if (this._enableTypeChecking) {
      for (let i = 0; i < this._arity; i++) {
        if (!this._typePredicates[i](atomStrs[i])) {
          const expectedType = this._types[i];
          const actualType = atomStrs[i].split('(')[0];
          throw new Error(`Position ${i}: expected ${expectedType}, got ${actualType}`);
        }
      }
    }
  }

  /**
   * Get position of variable by name
   */
  getVariablePosition(variableName) {
    if (!this._nameToPosition.has(variableName)) {
      throw new Error(`Variable ${variableName} not found in schema`);
    }
    return this._nameToPosition.get(variableName);
  }

  /**
   * Project schema to subset of variables
   */
  project(variableNames) {
    const specs = [];
    for (const name of variableNames) {
      if (!this._nameToPosition.has(name)) {
        throw new Error(`Variable ${name} not found in schema`);
      }
      const position = this._nameToPosition.get(name);
      specs.push({
        name: name,
        type: this._types[position]
      });
    }
    return new Schema(specs, this._enableTypeChecking);
  }

  /**
   * Check if two schemas are compatible (same variables and types)
   */
  isCompatible(other) {
    if (!(other instanceof Schema)) return false;
    if (this._arity !== other._arity) return false;
    
    for (let i = 0; i < this._arity; i++) {
      if (this._variables[i] !== other._variables[i] || 
          this._types[i] !== other._types[i]) {
        return false;
      }
    }
    return true;
  }

  toString() {
    const specs = this._variables.map((name, i) => `${name}:${this._types[i]}`);
    return `Schema[${specs.join(', ')}]`;
  }
}