// Pretty printing utilities for DataScript
// Ported from datascript.pprint

// Pretty print a datom
export function pprintDatom(datom, options = {}) {
  const { indent = 0, width = 80 } = options;
  const prefix = ' '.repeat(indent);
  
  if (!datom || typeof datom !== 'object') {
    return String(datom);
  }
  
  // Handle Datom objects
  if (datom.e !== undefined && datom.a !== undefined && datom.v !== undefined) {
    const tx = datom.tx || 'nil';
    const added = datom.added !== undefined ? datom.added : true;
    
    return `${prefix}#datascript/Datom [${datom.e} ${datom.a} ${JSON.stringify(datom.v)} ${tx} ${added}]`;
  }
  
  return `${prefix}${JSON.stringify(datom)}`;
}

// Pretty print a database
export function pprintDB(db, options = {}) {
  const { indent = 0, width = 80, maxDatoms = 100 } = options;
  const prefix = ' '.repeat(indent);
  
  if (!db || typeof db !== 'object') {
    return String(db);
  }
  
  let output = `${prefix}#datascript/DB {\n`;
  
  // Schema section
  output += `${prefix}  :schema ${JSON.stringify(db.schema, null, 2)}\n`;
  output += `${prefix}  ,\n`;
  
  // Datoms section
  output += `${prefix}  :datoms [\n`;
  
  let datoms = [];
  try {
    // Try to get datoms from the database
    if (typeof db.datoms === 'function') {
      datoms = Array.from(db.datoms(':eavt')).slice(0, maxDatoms);
    } else if (Array.isArray(db.datoms)) {
      datoms = db.datoms.slice(0, maxDatoms);
    }
  } catch (e) {
    // Fallback if datoms method fails
    datoms = [];
  }
  
  for (let i = 0; i < datoms.length; i++) {
    const datom = datoms[i];
    const tx = datom.tx || 'nil';
    output += `${prefix}    [${datom.e} ${datom.a} ${JSON.stringify(datom.v)} ${tx}]`;
    if (i < datoms.length - 1) {
      output += '\n';
    }
  }
  
  if (datoms.length === maxDatoms) {
    output += `\n${prefix}    ... (${maxDatoms}+ datoms, showing first ${maxDatoms})`;
  }
  
  output += `\n${prefix}  ]\n`;
  output += `${prefix}}`;
  
  return output;
}

// Pretty print any DataScript object
export function pprint(obj, options = {}) {
  const { indent = 0, width = 80 } = options;
  
  if (obj == null) {
    return 'nil';
  }
  
  // Check if it's a Datom
  if (obj.e !== undefined && obj.a !== undefined && obj.v !== undefined) {
    return pprintDatom(obj, options);
  }
  
  // Check if it's a DB
  if (obj && typeof obj === 'object' && (obj.schema || obj.datoms)) {
    return pprintDB(obj, options);
  }
  
  // Check if it's a filtered DB
  if (obj && obj.unfiltered && obj.pred) {
    return `#datascript/FilteredDB {\n  :unfiltered ${pprintDB(obj.unfiltered, { ...options, indent: indent + 2 })}\n  :pred ${obj.pred.toString()}\n}`;
  }
  
  // Default JSON pretty printing
  if (typeof obj === 'object') {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return String(obj);
    }
  }
  
  return String(obj);
}

// Console logging with pretty printing
export function pprintln(...args) {
  const formatted = args.map(arg => pprint(arg)).join(' ');
  console.log(formatted);
}

// Format datom for display
export function formatDatom(datom) {
  if (!datom || typeof datom !== 'object') {
    return String(datom);
  }
  
  const { e, a, v, tx, added = true } = datom;
  const txStr = tx !== undefined ? tx : 'nil';
  const vStr = typeof v === 'string' ? `"${v}"` : String(v);
  
  return `[${e} ${a} ${vStr} ${txStr} ${added}]`;
}

// Format database stats
export function formatDBStats(db) {
  if (!db || typeof db !== 'object') {
    return 'Invalid DB';
  }
  
  let datoms = 0;
  let entities = new Set();
  let attributes = new Set();
  
  try {
    if (typeof db.datoms === 'function') {
      for (const datom of db.datoms(':eavt')) {
        datoms++;
        entities.add(datom.e);
        attributes.add(datom.a);
      }
    } else if (Array.isArray(db.datoms)) {
      datoms = db.datoms.length;
      db.datoms.forEach(datom => {
        entities.add(datom.e);
        attributes.add(datom.a);
      });
    }
  } catch (e) {
    // Fallback
  }
  
  return {
    datoms,
    entities: entities.size,
    attributes: attributes.size,
    schema: Object.keys(db.schema || {}).length
  };
}

// Compact representation for logging
export function compactDB(db, maxItems = 10) {
  const stats = formatDBStats(db);
  let output = `DB{datoms: ${stats.datoms}, entities: ${stats.entities}, attrs: ${stats.attributes}}`;
  
  if (maxItems > 0) {
    try {
      let datoms = [];
      if (typeof db.datoms === 'function') {
        datoms = Array.from(db.datoms(':eavt')).slice(0, maxItems);
      } else if (Array.isArray(db.datoms)) {
        datoms = db.datoms.slice(0, maxItems);
      }
      
      if (datoms.length > 0) {
        const sampleDatoms = datoms.map(formatDatom).join(', ');
        output += ` [${sampleDatoms}${datoms.length < stats.datoms ? '...' : ''}]`;
      }
    } catch (e) {
      // Ignore errors in compact mode
    }
  }
  
  return output;
}

// Debug helper to inspect entity
export function inspectEntity(entity) {
  if (!entity || typeof entity !== 'object') {
    return `Not an entity: ${String(entity)}`;
  }
  
  const id = entity['db/id'];
  const keys = Object.keys(entity).filter(k => k !== 'db/id' && k !== 'db');
  
  let output = `Entity ${id}: {\n`;
  for (const key of keys) {
    const value = entity[key];
    const valueStr = Array.isArray(value) 
      ? `[${value.map(v => typeof v === 'object' && v['db/id'] ? `#${v['db/id']}` : JSON.stringify(v)).join(', ')}]`
      : typeof value === 'object' && value['db/id']
        ? `#${value['db/id']}`
        : JSON.stringify(value);
    output += `  ${key}: ${valueStr}\n`;
  }
  output += '}';
  
  return output;
}