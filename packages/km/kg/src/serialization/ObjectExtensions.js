import { idManager } from '../core/IDManager.js';

/**
 * Extend Object prototype with KG capabilities
 */
Object.prototype.getId = function() {
  // Handle primitive types that can't have properties
  if (typeof this === 'string' || typeof this === 'number' || typeof this === 'boolean') {
    return String(this);
  }
  
  if ('_kgId' in this) return this._kgId;
  
  // Use class name if available for deterministic ID
  if (this.constructor && this.constructor.name !== 'Object') {
    this._kgId = idManager.generateRandomId(this.constructor.name.toLowerCase());
  } else {
    this._kgId = idManager.generateRandomId();
  }
  
  return this._kgId;
};

Object.prototype.setId = function(id) {
  this._kgId = id;
  return this;
};

Object.prototype.toTriples = function() {
  const id = this.getId();
  const triples = [];

  // Add type information
  if (this.constructor && this.constructor.name !== 'Object') {
    triples.push([id, 'rdf:type', this.constructor.getId()]);
  }

  // Convert properties to triples
  for (const [key, value] of Object.entries(this)) {
    if (key.startsWith('_kg')) continue; // Skip internal KG properties
    
    const propId = idManager.generatePropertyId(this.constructor.name, key);
    
    if (value === null || value === undefined) {
      continue;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      triples.push([id, propId, value.getId()]);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object') {
          triples.push([id, propId, item.getId()]);
        } else {
          triples.push([id, `${propId}_${index}`, item]);
        }
      });
    } else {
      triples.push([id, propId, value]);
    }
  }

  return triples;
};

/**
 * Extend Function prototype for class capabilities
 */
Function.prototype.getId = function() {
  if (this.hasOwnProperty('_kgId')) return this._kgId;
  this._kgId = idManager.generateDeterministicId(this.name || 'anonymous');
  return this._kgId;
};
