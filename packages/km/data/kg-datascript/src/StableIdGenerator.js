import crypto from 'crypto';

/**
 * StableIdGenerator - Generates stable, deterministic IDs for objects
 * 
 * The generator creates consistent IDs based on object content, ensuring
 * that the same object always gets the same ID. This is crucial for
 * persistence and serialization.
 */
export class StableIdGenerator {
  constructor(options = {}) {
    this.options = {
      idField: options.idField || null, // Custom field to use as ID
      useUuid: options.useUuid || false, // Use UUID v4 instead of hash
      hashAlgorithm: options.hashAlgorithm || 'sha256',
      encoding: options.encoding || 'hex'
    };
    
    // Track seen objects to handle circular references
    this._processing = new WeakSet();
  }

  /**
   * Generate a stable ID for an object
   * @param {Object} obj - The object to generate an ID for
   * @returns {string} The stable ID
   */
  generateId(obj) {
    // Check for custom ID field first
    if (this.options.idField && obj[this.options.idField]) {
      return String(obj[this.options.idField]);
    }

    // If UUID mode, generate UUID v4
    if (this.options.useUuid) {
      return this._generateUuid();
    }

    // Generate hash-based ID
    return this._generateHashId(obj);
  }

  /**
   * Generate a hash-based ID for an object
   * @private
   */
  _generateHashId(obj) {
    const hash = crypto.createHash(this.options.hashAlgorithm);
    const normalized = this._normalizeObject(obj);
    const jsonString = JSON.stringify(normalized);
    hash.update(jsonString);
    return hash.digest(this.options.encoding);
  }

  /**
   * Normalize an object for consistent hashing
   * @private
   */
  _normalizeObject(obj, depth = 0) {
    // Prevent infinite recursion
    const maxDepth = 10;
    if (depth > maxDepth) {
      return '[MaxDepth]';
    }

    // Handle null
    if (obj === null) {
      return null;
    }

    // Handle undefined
    if (obj === undefined) {
      return undefined;
    }

    // Handle primitives
    if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    // Handle Dates
    if (obj instanceof Date) {
      return { _type: 'Date', _value: obj.toISOString() };
    }

    // Handle RegExp
    if (obj instanceof RegExp) {
      return { _type: 'RegExp', _value: obj.toString() };
    }

    // Handle Maps
    if (obj instanceof Map) {
      const entries = Array.from(obj.entries()).sort((a, b) => {
        const keyA = String(a[0]);
        const keyB = String(b[0]);
        return keyA.localeCompare(keyB);
      });
      return {
        _type: 'Map',
        _value: entries.map(([k, v]) => [k, this._normalizeObject(v, depth + 1)])
      };
    }

    // Handle Sets
    if (obj instanceof Set) {
      const values = Array.from(obj).map(v => this._normalizeObject(v, depth + 1));
      // Sort for consistency
      values.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      return { _type: 'Set', _value: values };
    }

    // Handle Arrays
    if (Array.isArray(obj)) {
      return obj.map(item => this._normalizeObject(item, depth + 1));
    }

    // Handle circular references
    if (this._processing.has(obj)) {
      return '[Circular]';
    }

    // Handle regular objects
    if (typeof obj === 'object') {
      this._processing.add(obj);
      
      try {
        // Sort keys for consistent ordering
        const keys = Object.keys(obj).sort();
        const normalized = {};
        
        for (const key of keys) {
          const value = obj[key];
          // Skip undefined values (treat as missing)
          if (value !== undefined) {
            normalized[key] = this._normalizeObject(value, depth + 1);
          }
        }
        
        return normalized;
      } finally {
        // Clean up circular reference tracking
        // Note: WeakSet will auto-cleanup, but we remove for immediate effect
        this._processing.delete(obj);
      }
    }

    // Default case
    return String(obj);
  }

  /**
   * Generate a UUID v4
   * @private
   */
  _generateUuid() {
    // Simple UUID v4 generation
    const bytes = crypto.randomBytes(16);
    
    // Set version (4) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    
    // Format as UUID string
    const hex = bytes.toString('hex');
    return [
      hex.substring(0, 8),
      hex.substring(8, 12),
      hex.substring(12, 16),
      hex.substring(16, 20),
      hex.substring(20, 32)
    ].join('-');
  }

  /**
   * Generate IDs for a batch of objects
   * @param {Array<Object>} objects - Array of objects
   * @returns {Map<Object, string>} Map of object to ID
   */
  generateBatch(objects) {
    const idMap = new Map();
    
    for (const obj of objects) {
      idMap.set(obj, this.generateId(obj));
    }
    
    return idMap;
  }

  /**
   * Check if an ID is valid
   * @param {string} id - The ID to validate
   * @returns {boolean} True if valid
   */
  isValidId(id) {
    if (typeof id !== 'string') {
      return false;
    }
    
    if (id.length === 0) {
      return false;
    }
    
    // Check for problematic characters
    if (/[\0\n\r]/.test(id)) {
      return false;
    }
    
    // Check max length
    if (id.length > 256) {
      return false;
    }
    
    return true;
  }

  /**
   * Create a short, human-readable ID from a longer hash
   * @param {string} fullId - The full hash ID
   * @param {number} length - Desired length (default 8)
   * @returns {string} Shortened ID
   */
  shortenId(fullId, length = 8) {
    if (!fullId || fullId.length <= length) {
      return fullId;
    }
    return fullId.substring(0, length);
  }
}