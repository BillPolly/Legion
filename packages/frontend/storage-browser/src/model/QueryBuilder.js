/**
 * Query Builder
 * MongoDB-style query construction and validation
 */

export class QueryBuilder {
  constructor() {
    this.query = {};
    this.operators = ['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin', '$regex', '$exists'];
  }

  static create() {
    return new QueryBuilder();
  }

  where(field, value) {
    this.query[field] = value;
    return this;
  }

  equals(field, value) {
    this.query[field] = value;
    return this;
  }

  greaterThan(field, value) {
    this.query[field] = { $gt: value };
    return this;
  }

  greaterThanOrEqual(field, value) {
    this.query[field] = { $gte: value };
    return this;
  }

  lessThan(field, value) {
    this.query[field] = { $lt: value };
    return this;
  }

  lessThanOrEqual(field, value) {
    this.query[field] = { $lte: value };
    return this;
  }

  in(field, values) {
    this.query[field] = { $in: values };
    return this;
  }

  notIn(field, values) {
    this.query[field] = { $nin: values };
    return this;
  }

  regex(field, pattern, flags = '') {
    this.query[field] = { $regex: pattern, $options: flags };
    return this;
  }

  exists(field, exists = true) {
    this.query[field] = { $exists: exists };
    return this;
  }

  range(field, min, max) {
    this.query[field] = { $gte: min, $lte: max };
    return this;
  }

  build() {
    return { ...this.query };
  }

  validate() {
    try {
      this.validateQuery(this.query);
      return { valid: true, errors: [] };
    } catch (error) {
      return { valid: false, errors: [error.message] };
    }
  }

  validateQuery(query) {
    for (const [field, value] of Object.entries(query)) {
      if (typeof value === 'object' && value !== null) {
        this.validateOperators(field, value);
      }
    }
  }

  validateOperators(field, operators) {
    for (const [op, value] of Object.entries(operators)) {
      if (!this.operators.includes(op)) {
        throw new Error(`Unknown operator: ${op}`);
      }
      
      if (op === '$in' || op === '$nin') {
        if (!Array.isArray(value)) {
          throw new Error(`${op} operator requires an array`);
        }
      }
    }
  }

  clear() {
    this.query = {};
    return this;
  }
}