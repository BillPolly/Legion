// Utility functions for DataScript
// Ported from datascript.util

// Debug flag
export let debug = false;

export function setDebug(value) {
  debug = value;
}

// Error raising function
export function raise(message, data = {}) {
  const error = new Error(message);
  error.data = data;
  throw error;
}

// Logging function
export function log(...args) {
  if (debug) {
    console.log(...args);
  }
}

// UUID generation functions
function randBits(pow) {
  return Math.floor(Math.random() * Math.pow(2, pow));
}

function toHexString(n, length) {
  const s = n.toString(16);
  const diff = length - s.length;
  return diff > 0 ? '0'.repeat(diff) + s : s.substring(0, length);
}

// Sequential UUID (time-based for ordering)
export function squuid(msec) {
  const timestamp = msec || Date.now();
  const time = Math.floor(timestamp / 1000);
  
  return [
    toHexString(time, 8),
    toHexString(randBits(16), 4),
    toHexString(randBits(16) & 0x0FFF | 0x4000, 4), // Version 4
    toHexString(randBits(16) & 0x3FFF | 0x8000, 4), // Variant bits
    toHexString(randBits(16), 4) + 
    toHexString(randBits(16), 4) + 
    toHexString(randBits(16), 4)
  ].join('-');
}

// Extract timestamp from squuid
export function squuidTimeMillis(uuid) {
  const timeHex = uuid.substring(0, 8);
  return parseInt(timeHex, 16) * 1000;
}

// Collection utilities
export function distinctBy(keyFn, coll) {
  const seen = new Set();
  const result = [];
  
  for (const item of coll) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  
  return result;
}

export function find(predicate, coll) {
  for (const item of coll) {
    if (predicate(item)) {
      return item;
    }
  }
  return null;
}

// Assert single element
export function single(coll) {
  if (!coll || coll.length === 0) {
    throw new Error('Expected single element, got empty collection');
  }
  if (coll.length > 1) {
    throw new Error('Expected single element, got multiple elements');
  }
  return coll[0];
}

// Concatenate into vector
export function concatv(...colls) {
  const result = [];
  for (const coll of colls) {
    if (coll) {
      result.push(...coll);
    }
  }
  return result;
}

// Zip collections
export function zip(a, b, ...rest) {
  if (rest.length > 0) {
    return zipAll([a, b, ...rest]);
  }
  
  const result = [];
  const minLength = Math.min(a.length, b.length);
  for (let i = 0; i < minLength; i++) {
    result.push([a[i], b[i]]);
  }
  return result;
}

function zipAll(colls) {
  const result = [];
  const maxLength = Math.max(...colls.map(c => c.length));
  
  for (let i = 0; i < maxLength; i++) {
    result.push(colls.map(c => c[i]));
  }
  return result;
}

// Remove entries from map based on key predicate
export function removem(keyPred, map) {
  const result = {};
  for (const [key, value] of Object.entries(map)) {
    if (!keyPred(key)) {
      result[key] = value;
    }
  }
  return result;
}

// Conjoin with fallback to empty vector
export function conjv(coll, ...items) {
  const result = coll ? [...coll] : [];
  result.push(...items);
  return result;
}

// Conjoin with fallback to empty set
export function conjs(coll, ...items) {
  const result = coll ? new Set(coll) : new Set();
  for (const item of items) {
    result.add(item);
  }
  return result;
}

// Reduce with index
export function reduceIndexed(fn, init, coll) {
  let acc = init;
  let index = 0;
  
  for (const item of coll) {
    const result = fn(acc, item, index);
    if (result && result.__reduced) {
      return result.value;
    }
    acc = result;
    index++;
  }
  
  return acc;
}

// Reduced value wrapper (for early termination)
export function reduced(value) {
  return { __reduced: true, value };
}

export function isReduced(value) {
  return value && value.__reduced === true;
}

// Some-of macro equivalent
export function someOf(...values) {
  for (const value of values) {
    if (value != null) {
      return value;
    }
  }
  return null;
}

// Type checking utilities
export function isString(x) {
  return typeof x === 'string';
}

export function isNumber(x) {
  return typeof x === 'number' && !isNaN(x);
}

export function isBoolean(x) {
  return typeof x === 'boolean';
}

export function isArray(x) {
  return Array.isArray(x);
}

export function isObject(x) {
  return x && typeof x === 'object' && !Array.isArray(x);
}

export function isFunction(x) {
  return typeof x === 'function';
}

// Collection predicates
export function isEmpty(coll) {
  if (coll == null) return true;
  if (Array.isArray(coll)) return coll.length === 0;
  if (coll instanceof Set || coll instanceof Map) return coll.size === 0;
  if (typeof coll === 'object') return Object.keys(coll).length === 0;
  return !coll;
}

export function isSeq(x) {
  return x && (Array.isArray(x) || typeof x[Symbol.iterator] === 'function');
}

// Safe property access
export function getIn(obj, path, defaultValue) {
  let current = obj;
  for (const key of path) {
    if (current == null || typeof current !== 'object') {
      return defaultValue;
    }
    current = current[key];
  }
  return current === undefined ? defaultValue : current;
}

export function assocIn(obj, path, value) {
  if (path.length === 0) return value;
  if (path.length === 1) {
    return { ...obj, [path[0]]: value };
  }
  
  const [key, ...restPath] = path;
  const nested = obj[key] || {};
  return { ...obj, [key]: assocIn(nested, restPath, value) };
}

// Deep equality check
export function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => deepEqual(a[key], b[key]));
  }
  
  return false;
}