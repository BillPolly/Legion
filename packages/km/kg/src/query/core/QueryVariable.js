/**
 * Query Variables and Bindings
 */

export class QueryVariable {
  constructor(name, type = null, constraints = []) {
    if (name === null || name === undefined) {
      throw new Error('Variable name cannot be null or undefined');
    }
    if (name === '') {
      throw new Error('Variable name cannot be empty');
    }
    this.name = name;
    this.type = type;
    this.constraints = Array.isArray(constraints) ? [...constraints] : [];
    this._kgId = `var_${name}_${Math.random().toString(36).substr(2, 6)}`;
  }

  getId() {
    return this._kgId;
  }

  addConstraint(constraint) {
    this.constraints.push(constraint);
    return this;
  }

  validateType(value) {
    if (!this.type) return true;
    
    switch (this.type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null;
      default:
        // For custom types, just check it's not null/undefined
        return value != null;
    }
  }

  validateValue(value) {
    // First check type
    if (!this.validateType(value)) {
      return false;
    }

    // Then check all constraints
    return this.constraints.every(constraint => {
      if (typeof constraint.evaluate === 'function') {
        try {
          return constraint.evaluate(value);
        } catch (error) {
          // Handle constraint evaluation errors gracefully
          console.warn(`Constraint evaluation error for ${this.name}:`, error.message);
          return false;
        }
      }
      return true;
    });
  }

  getValidationErrors(value) {
    const errors = [];

    // Check type
    if (!this.validateType(value)) {
      errors.push(`Value ${value} does not match expected type ${this.type}`);
    }

    // Check constraints
    this.constraints.forEach(constraint => {
      if (typeof constraint.evaluate === 'function' && !constraint.evaluate(value)) {
        const message = constraint.getErrorMessage ? 
          constraint.getErrorMessage(value) : 
          `Value ${value} violates constraint`;
        errors.push(message);
      }
    });

    return errors;
  }

  toTriples() {
    const id = this.getId();
    const triples = [];

    triples.push([id, 'rdf:type', 'kg:QueryVariable']);
    triples.push([id, 'kg:variableName', this.name]);
    
    if (this.type) {
      triples.push([id, 'kg:variableType', this.type]);
    }

    this.constraints.forEach((constraint, index) => {
      const constraintId = constraint.getId ? constraint.getId() : `${id}_constraint_${index}`;
      triples.push([id, 'kg:hasConstraint', constraintId]);
      if (constraint.toTriples) {
        triples.push(...constraint.toTriples());
      }
    });

    return triples;
  }
}

export class VariableBinding {
  constructor() {
    this.bindings = new Map();
    this._kgId = `binding_${Math.random().toString(36).substr(2, 9)}`;
  }

  getId() {
    return this._kgId;
  }

  bind(variable, value) {
    this.bindings.set(variable, value);
    return this;
  }

  unbind(variable) {
    this.bindings.delete(variable);
    return this;
  }

  get(variable) {
    return this.bindings.get(variable);
  }

  has(variable) {
    return this.bindings.has(variable);
  }

  size() {
    return this.bindings.size;
  }

  isEmpty() {
    return this.bindings.size === 0;
  }

  clear() {
    this.bindings.clear();
    return this;
  }

  getVariableNames() {
    return Array.from(this.bindings.keys());
  }

  forEach(callback) {
    this.bindings.forEach(callback);
  }

  static merge(binding1, binding2) {
    const merged = new VariableBinding();
    
    // Add all bindings from first binding
    binding1.forEach((value, variable) => {
      merged.bind(variable, value);
    });

    // Add bindings from second binding, checking for conflicts
    binding2.forEach((value, variable) => {
      if (merged.has(variable)) {
        const existingValue = merged.get(variable);
        if (existingValue !== value) {
          throw new Error(`Variable binding conflict for ${variable}: ${existingValue} vs ${value}`);
        }
      } else {
        merged.bind(variable, value);
      }
    });

    return merged;
  }

  toTriples() {
    const id = this.getId();
    const triples = [];

    triples.push([id, 'rdf:type', 'kg:VariableBinding']);

    let index = 0;
    this.bindings.forEach((value, variable) => {
      const bindingEntryId = `${id}_entry_${index}`;
      triples.push([id, 'kg:hasBinding', bindingEntryId]);
      triples.push([bindingEntryId, 'rdf:type', 'kg:BindingEntry']);
      triples.push([bindingEntryId, 'kg:bindsVariable', variable]);
      triples.push([bindingEntryId, 'kg:boundValue', value]);
      triples.push([bindingEntryId, 'kg:bindingIndex', index]);
      index++;
    });

    return triples;
  }
}

export default { QueryVariable, VariableBinding };
