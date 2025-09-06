import crypto from 'crypto';

/**
 * Manages different ID generation strategies
 */
export class IDManager {
  constructor() {
    this.deterministicCache = new Map();
  }

  /**
   * Generate random ID for instances
   */
  generateRandomId(prefix = 'obj') {
    return `${prefix}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Generate deterministic ID from name (for classes, methods, etc.)
   */
  generateDeterministicId(name, namespace = '') {
    const key = `${namespace}:${name}`;
    if (this.deterministicCache.has(key)) {
      return this.deterministicCache.get(key);
    }

    const hash = crypto.createHash('sha256').update(key).digest('hex').substring(0, 8);
    const id = `${name}_${hash}`;
    this.deterministicCache.set(key, id);
    return id;
  }

  /**
   * Generate property ID from class and property name
   */
  generatePropertyId(className, propName) {
    return this.generateDeterministicId(`${className}.${propName}`);
  }

  /**
   * Generate method ID from class and method name
   */
  generateMethodId(className, methodName) {
    return this.generateDeterministicId(`${className}.${methodName}`);
  }
}

// Create singleton instance
export const idManager = new IDManager();
