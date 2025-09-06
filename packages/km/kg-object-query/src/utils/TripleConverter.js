/**
 * TripleConverter - Utilities for converting between objects and KG triples
 */

import { KGEngine } from '@legion/kg';
import { InMemoryTripleStore } from '@legion/kg-storage-memory';

export class TripleConverter {
  /**
   * Convert root object to Knowledge Graph and return engine with data
   * @param {Object} rootObject - Object to convert to KG
   * @returns {KGEngine} KG engine populated with object data
   */
  static objectToKG(rootObject) {
    // Create fresh KG engine with in-memory storage
    const kgEngine = new KGEngine(new InMemoryTripleStore());
    
    // Convert object to triples using KG's built-in serialization
    const rootId = 'root_object';
    
    // Deep copy to avoid mutating original
    const objectCopy = JSON.parse(JSON.stringify(rootObject));
    
    // Add root object ID
    objectCopy.setId(rootId);
    
    // Convert to triples recursively and add to KG
    this._convertObjectToTriples(objectCopy, kgEngine);
    
    return kgEngine;
  }
  
  /**
   * Convert object and all nested objects to triples
   * @private
   */
  static _convertObjectToTriples(obj, kgEngine, parentId = null) {
    if (!obj || typeof obj !== 'object') return;
    
    const objectId = obj._kgId || obj.getId();
    
    // Add direct property triples
    for (const [key, value] of Object.entries(obj)) {
      if (key.startsWith('_kg')) continue; // Skip internal KG properties
      
      const propertyId = `prop_${key}`;
      
      if (value === null || value === undefined) {
        continue;
      } else if (Array.isArray(value)) {
        // Handle arrays - add each item as a separate triple
        value.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            // Create ID for nested object
            const itemId = `${objectId}_${key}_${index}`;
            item.setId(itemId);
            kgEngine.addTriple(objectId, propertyId, itemId);
            // Recursively convert nested object
            this._convertObjectToTriples(item, kgEngine, objectId);
          } else {
            // Direct value in array
            kgEngine.addTriple(objectId, `${propertyId}_${index}`, item);
          }
        });
      } else if (typeof value === 'object') {
        // Handle nested objects
        const valueId = `${objectId}_${key}`;
        value.setId(valueId);
        kgEngine.addTriple(objectId, propertyId, valueId);
        // Recursively convert nested object
        this._convertObjectToTriples(value, kgEngine, objectId);
      } else {
        // Direct property value
        kgEngine.addTriple(objectId, propertyId, value);
      }
    }
  }
  
  /**
   * Extract values from KG back to object format
   * @param {KGEngine} kgEngine - KG engine with data
   * @param {string} entityId - Entity ID to extract
   * @param {string} property - Property to extract
   * @returns {*} Extracted value
   */
  static extractValue(kgEngine, entityId, property) {
    const triples = kgEngine.query(entityId, property, null);
    
    if (triples.length === 0) {
      return undefined;
    }
    
    if (triples.length === 1) {
      return triples[0][2]; // Return the object value
    }
    
    // Multiple triples - likely an array
    return triples.map(triple => triple[2]);
  }
  
  /**
   * Find entity by type in KG
   * @param {KGEngine} kgEngine - KG engine
   * @param {string} type - Entity type to find
   * @returns {string[]} Array of entity IDs
   */
  static findEntitiesByType(kgEngine, type) {
    const triples = kgEngine.query(null, 'rdf:type', type);
    return triples.map(triple => triple[0]);
  }
  
  /**
   * Get all properties for an entity
   * @param {KGEngine} kgEngine - KG engine  
   * @param {string} entityId - Entity ID
   * @returns {Object} Property-value pairs
   */
  static getEntityProperties(kgEngine, entityId) {
    const triples = kgEngine.query(entityId, null, null);
    const properties = {};
    
    triples.forEach(([subject, predicate, object]) => {
      if (predicate === 'rdf:type') return;
      
      if (properties[predicate]) {
        // Multiple values - convert to array
        if (!Array.isArray(properties[predicate])) {
          properties[predicate] = [properties[predicate]];
        }
        properties[predicate].push(object);
      } else {
        properties[predicate] = object;
      }
    });
    
    return properties;
  }
}