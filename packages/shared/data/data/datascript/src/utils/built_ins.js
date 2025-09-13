// Built-in query functions and aggregates for DataScript
// Ported from datascript.built-ins

import { DB } from '../core/db.js';

// Helper function to compare values using database ordering
function valueCompare(a, b) {
  if (a === b) return 0;
  if (a == null && b != null) return -1;
  if (a != null && b == null) return 1;
  if (typeof a !== typeof b) {
    // Type ordering: null < boolean < number < string < array < object
    const typeOrder = { 'boolean': 0, 'number': 1, 'string': 2, 'object': 3 };
    return typeOrder[typeof a] - typeOrder[typeof b];
  }
  if (typeof a === 'number') return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === 'string') return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === 'boolean') return a < b ? -1 : a > b ? 1 : 0;
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const cmp = valueCompare(a[i], b[i]);
      if (cmp !== 0) return cmp;
    }
    return a.length - b.length;
  }
  return 0; // fallback for objects
}

// DataScript-specific functions
function differ(...xs) {
  const half = Math.floor(xs.length / 2);
  const first = xs.slice(0, half);
  const second = xs.slice(half);
  return !first.every((x, i) => x === second[i]);
}

function getElse(db, e, a, elseVal) {
  if (elseVal == null) {
    throw new Error("get-else: null default value is not supported");
  }
  const datoms = db.search([DB.prototype.entid.call(db, e), a]);
  return datoms.length > 0 ? datoms[0].v : elseVal;
}

function getSome(db, e, ...attrs) {
  const eid = DB.prototype.entid.call(db, e);
  for (const a of attrs) {
    const datoms = db.search([eid, a]);
    if (datoms.length > 0) {
      return [datoms[0].a, datoms[0].v];
    }
  }
  return null;
}

function missing(db, e, a) {
  const entity = db.entity(e);
  return entity == null || !(a in entity);
}

// Logical functions with proper behavior
function andFn(...args) {
  for (let i = 0; i < args.length; i++) {
    if (!args[i]) return args[i];
  }
  return args.length > 0 ? args[args.length - 1] : true;
}

function orFn(...args) {
  for (let i = 0; i < args.length; i++) {
    if (args[i]) return args[i];
  }
  return args.length > 0 ? args[args.length - 1] : null;
}

// Comparison functions using database ordering
function less(x, y, ...more) {
  if (arguments.length === 1) return true;
  if (valueCompare(x, y) < 0) {
    if (more.length === 0) return true;
    if (more.length === 1) return less(y, more[0]);
    return less(y, more[0], ...more.slice(1));
  }
  return false;
}

function greater(x, y, ...more) {
  if (arguments.length === 1) return true;
  if (valueCompare(x, y) > 0) {
    if (more.length === 0) return true;
    if (more.length === 1) return greater(y, more[0]);
    return greater(y, more[0], ...more.slice(1));
  }
  return false;
}

function lessEqual(x, y, ...more) {
  if (arguments.length === 1) return true;
  if (valueCompare(x, y) <= 0) {
    if (more.length === 0) return true;
    if (more.length === 1) return lessEqual(y, more[0]);
    return lessEqual(y, more[0], ...more.slice(1));
  }
  return false;
}

function greaterEqual(x, y, ...more) {
  if (arguments.length === 1) return true;
  if (valueCompare(x, y) >= 0) {
    if (more.length === 0) return true;
    if (more.length === 1) return greaterEqual(y, more[0]);
    return greaterEqual(y, more[0], ...more.slice(1));
  }
  return false;
}

// String functions
function blank(s) {
  return s == null || (typeof s === 'string' && s.trim() === '');
}

function includes(s, substr) {
  return s != null && substr != null && String(s).includes(String(substr));
}

function startsWith(s, prefix) {
  return s != null && prefix != null && String(s).startsWith(String(prefix));
}

function endsWith(s, suffix) {
  return s != null && suffix != null && String(s).endsWith(String(suffix));
}

// Math functions
function quot(a, b) {
  return Math.trunc(a / b);
}

function rem(a, b) {
  return a % b;
}

function mod(a, b) {
  const r = a % b;
  return r < 0 ? r + b : r;
}

// Aggregate functions
function aggregateSum(coll) {
  return coll.reduce((sum, x) => sum + x, 0);
}

function aggregateAvg(coll) {
  return coll.length > 0 ? aggregateSum(coll) / coll.length : 0;
}

function aggregateMedian(coll) {
  if (coll.length === 0) return null;
  const sorted = coll.slice().sort((a, b) => valueCompare(a, b));
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function aggregateVariance(coll) {
  if (coll.length === 0) return 0;
  const mean = aggregateAvg(coll);
  const sumSquares = coll.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0);
  return sumSquares / coll.length;
}

function aggregateStddev(coll) {
  return Math.sqrt(aggregateVariance(coll));
}

function aggregateMin(n, coll) {
  if (typeof n === 'number' && Array.isArray(coll)) {
    return coll.slice().sort((a, b) => valueCompare(a, b)).slice(0, n);
  }
  // Single argument case - n is actually coll
  const arr = typeof n === 'number' ? coll : n;
  return arr.length > 0 ? arr.reduce((min, x) => valueCompare(x, min) < 0 ? x : min) : null;
}

function aggregateMax(n, coll) {
  if (typeof n === 'number' && Array.isArray(coll)) {
    return coll.slice().sort((a, b) => valueCompare(b, a)).slice(0, n);
  }
  // Single argument case - n is actually coll
  const arr = typeof n === 'number' ? coll : n;
  return arr.length > 0 ? arr.reduce((max, x) => valueCompare(x, max) > 0 ? x : max) : null;
}

function aggregateRand(n, coll) {
  if (typeof n === 'number' && Array.isArray(coll)) {
    return Array.from({length: n}, () => coll[Math.floor(Math.random() * coll.length)]);
  }
  // Single argument case - n is actually coll
  const arr = typeof n === 'number' ? coll : n;
  return arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : null;
}

function aggregateSample(n, coll) {
  const shuffled = coll.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function aggregateCountDistinct(coll) {
  return new Set(coll).size;
}

// Export the query functions map
export const queryFns = {
  '=': (a, b) => a === b,
  '==': (a, b) => a == b,
  'not=': (a, b) => a !== b,
  '!=': (a, b) => a !== b,
  '<': less,
  '>': greater,
  '<=': lessEqual,
  '>=': greaterEqual,
  '+': (a, b, ...rest) => rest.reduce((sum, x) => sum + x, a + b),
  '-': (a, b, ...rest) => rest.length > 0 ? rest.reduce((sum, x) => sum - x, a - b) : (b === undefined ? -a : a - b),
  '*': (a, b, ...rest) => rest.reduce((prod, x) => prod * x, a * b),
  '/': (a, b, ...rest) => rest.reduce((quot, x) => quot / x, a / b),
  'quot': quot,
  'rem': rem,
  'mod': mod,
  'inc': (a) => a + 1,
  'dec': (a) => a - 1,
  'max': Math.max,
  'min': Math.min,
  'zero?': (a) => a === 0,
  'pos?': (a) => a > 0,
  'neg?': (a) => a < 0,
  'even?': (a) => a % 2 === 0,
  'odd?': (a) => a % 2 !== 0,
  'compare': valueCompare,
  'rand': Math.random,
  'rand-int': (n) => Math.floor(Math.random() * n),
  'true?': (a) => a === true,
  'false?': (a) => a === false,
  'nil?': (a) => a == null,
  'some?': (a) => a != null,
  'not': (a) => !a,
  'and': andFn,
  'or': orFn,
  'complement': (f) => (...args) => !f(...args),
  'identical?': (a, b) => Object.is(a, b),
  'identity': (a) => a,
  'keyword': (a) => typeof a === 'string' ? (a.startsWith(':') ? a : ':' + a) : a,
  'meta': (a) => null, // JS doesn't have metadata
  'name': (a) => typeof a === 'string' && a.startsWith(':') ? a.slice(1) : String(a),
  'namespace': (a) => {
    if (typeof a === 'string' && a.includes('/')) {
      const [ns] = a.split('/');
      return ns.startsWith(':') ? ns.slice(1) : ns;
    }
    return null;
  },
  'type': (a) => typeof a,
  'vector': (...args) => args,
  'list': (...args) => args,
  'set': (coll) => new Set(coll || []),
  'hash-map': (...args) => {
    const obj = {};
    for (let i = 0; i < args.length; i += 2) {
      obj[args[i]] = args[i + 1];
    }
    return obj;
  },
  'array-map': (...args) => {
    const obj = {};
    for (let i = 0; i < args.length; i += 2) {
      obj[args[i]] = args[i + 1];
    }
    return obj;
  },
  'count': (coll) => coll ? (coll.length ?? coll.size ?? Object.keys(coll).length) : 0,
  'range': (start, end, step = 1) => {
    if (end === undefined) { end = start; start = 0; }
    const result = [];
    for (let i = start; i < end; i += step) result.push(i);
    return result;
  },
  'not-empty': (coll) => coll && coll.length > 0 ? coll : null,
  'empty?': (coll) => !coll || coll.length === 0,
  'contains?': (coll, key) => coll && (coll.hasOwnProperty ? coll.hasOwnProperty(key) : coll.has(key)),
  'str': (...args) => args.map(String).join(''),
  'subs': (s, start, end) => String(s).substring(start, end),
  'get': (coll, key, defaultVal) => coll && coll[key] !== undefined ? coll[key] : defaultVal,
  'pr-str': (...args) => args.map(a => JSON.stringify(a)).join(' '),
  'print-str': (...args) => args.map(String).join(' '),
  'println-str': (...args) => args.map(String).join(' ') + '\n',
  'prn-str': (...args) => args.map(a => JSON.stringify(a)).join(' ') + '\n',
  're-find': (pattern, s) => {
    const regex = new RegExp(pattern);
    return regex.exec(String(s))?.[0] || null;
  },
  're-matches': (pattern, s) => {
    const regex = new RegExp('^' + pattern + '$');
    return regex.test(String(s));
  },
  're-seq': (pattern, s) => {
    const regex = new RegExp(pattern, 'g');
    return Array.from(String(s).matchAll(regex), m => m[0]);
  },
  're-pattern': (s) => new RegExp(s),
  '-differ?': differ,
  'get-else': getElse,
  'get-some': getSome,
  'missing?': missing,
  'ground': (a) => a,
  'clojure.string/blank?': blank,
  'clojure.string/includes?': includes,
  'clojure.string/starts-with?': startsWith,
  'clojure.string/ends-with?': endsWith,
  'tuple': (...args) => args,
  'untuple': (a) => a
};

// Export the aggregates map
export const aggregates = {
  'sum': aggregateSum,
  'avg': aggregateAvg,
  'median': aggregateMedian,
  'variance': aggregateVariance,
  'stddev': aggregateStddev,
  'distinct': (coll) => Array.from(new Set(coll)),
  'min': aggregateMin,
  'max': aggregateMax,
  'rand': aggregateRand,
  'sample': aggregateSample,
  'count': (coll) => coll.length,
  'count-distinct': aggregateCountDistinct
};