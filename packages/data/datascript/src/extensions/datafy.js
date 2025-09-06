// Datafy protocol implementation for DataScript entities
// Ported from datascript.datafy

import { pull } from '../query/pull.js';

// Helper function to create reverse reference attribute name
function reverseRef(attr) {
  if (attr.includes('/')) {
    return attr.replace('/', '/_');
  }
  return ':_' + attr.slice(1); // Remove ':' and add ':_'
}

// Symbol for navigation metadata
const NAV_SYM = Symbol('nav');
const DATAFY_SYM = Symbol('datafy');

// Add navigation metadata to pulled entity
function navizePulledEntity(db, pulledEntity) {
  if (!pulledEntity || typeof pulledEntity !== 'object') {
    return pulledEntity;
  }
  
  const schema = db.schema;
  const refAttrs = new Set();
  const refRattrs = new Set();
  const manyAttrs = new Set();
  
  // Collect reference and cardinality info from schema
  for (const [attr, config] of Object.entries(schema)) {
    if (config['db/valueType'] === 'db.type/ref') {
      refAttrs.add(attr);
      refRattrs.add(reverseRef(attr));
    }
    if (config['db/cardinality'] === 'db.cardinality/many') {
      manyAttrs.add(attr);
    }
  }
  
  // Add navigation function as metadata
  const navigated = Object.create(pulledEntity);
  navigated[NAV_SYM] = function(coll, k, v) {
    // Handle many-valued reference attributes
    if (manyAttrs.has(k) && refAttrs.has(k)) {
      return datafyEntitySeq(db, v);
    }
    
    // Handle reverse reference attributes  
    if (refRattrs.has(k)) {
      return datafyEntitySeq(db, v);
    }
    
    // Handle single reference attributes
    if (refAttrs.has(k)) {
      return db.entity(v['db/id'] || v);
    }
    
    // Default case
    return v;
  };
  
  return navigated;
}

// Add navigation metadata to entity sequence
function navizePulledEntitySeq(db, entities) {
  if (!Array.isArray(entities)) {
    return entities;
  }
  
  const navigated = [...entities];
  navigated[NAV_SYM] = function(coll, k, v) {
    return db.entity(v['db/id'] || v);
  };
  
  return navigated;
}

// Create datafiable entity sequence
function datafyEntitySeq(db, entities) {
  if (!Array.isArray(entities)) {
    return entities;
  }
  
  const datafied = [...entities];
  datafied[DATAFY_SYM] = function(entities) {
    return navizePulledEntitySeq(db, entities);
  };
  
  return datafied;
}

// Main datafy function for entities
export function datafy(entity) {
  if (!entity || typeof entity !== 'object') {
    return entity;
  }
  
  // Check if this looks like a DataScript entity
  if (entity.db && entity['db/id'] != null) {
    const db = entity.db;
    const entityId = entity['db/id'];
    
    // Get schema info for building pull pattern
    const schema = db.schema;
    const refRattrs = [];
    
    for (const [attr, config] of Object.entries(schema)) {
      if (config['db/valueType'] === 'db.type/ref') {
        refRattrs.push(reverseRef(attr));
      }
    }
    
    // Build pull pattern with all attrs and reverse refs
    const pullPattern = ['*', ...refRattrs];
    
    // Pull the entity data and add navigation
    const pulled = pull(db, pullPattern, entityId);
    return navizePulledEntity(db, pulled);
  }
  
  return entity;
}

// Navigation function
export function nav(coll, k, v) {
  if (coll && typeof coll[NAV_SYM] === 'function') {
    return coll[NAV_SYM](coll, k, v);
  }
  return v;
}

// Check if object is datafiable
export function isDatafiable(obj) {
  return obj && (
    typeof obj[DATAFY_SYM] === 'function' ||
    (obj.db && obj['db/id'] != null)
  );
}

// Check if object is navigable
export function isNavigable(obj) {
  return obj && typeof obj[NAV_SYM] === 'function';
}

// Datafy with explicit db context
export function datafyWith(db, obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  // If it's an entity ID, convert to entity first
  if (typeof obj === 'number') {
    const entity = db.entity(obj);
    return datafy(entity);
  }
  
  // If it's already an entity-like object, datafy it
  if (obj['db/id'] != null) {
    const entityWithDb = { ...obj, db };
    return datafy(entityWithDb);
  }
  
  return obj;
}

// Helper to create navigable pull result
export function navigablePull(db, pattern, eid) {
  const pulled = pull(db, pattern, eid);
  return navizePulledEntity(db, pulled);
}

// Helper to create navigable pull-many result
export function navigablePullMany(db, pattern, eids) {
  const pulled = eids.map(eid => pull(db, pattern, eid));
  return navizePulledEntitySeq(db, pulled);
}