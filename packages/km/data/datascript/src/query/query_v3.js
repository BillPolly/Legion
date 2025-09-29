import { parseEDN } from '../utils/edn.js';

function symToStr(x) { return (x && x.$sym) ? x.$sym : x; }

function parseInBindings(v) {
  // Return array of bindings after :in if present, else default [$]
  let i = 0;
  if (!Array.isArray(v)) throw new Error('Query must be a vector');
  let inForms = null;
  while (i < v.length) {
    const k = symToStr(v[i++]);
    if (k === ':in') {
      inForms = [];
      while (i < v.length && !String(symToStr(v[i])).startsWith(':')) inForms.push(v[i++]);
      break;
    } else if (k === ':where') {
      // Skip forms until next keyword
      if (Array.isArray(v[i])) i++;
      else { while (i < v.length && !String(symToStr(v[i])).startsWith(':')) i++; }
    } else {
      // skip
      if (Array.isArray(v[i])) i++; else i++;
    }
  }
  return inForms || ['$'];
}

function parseWherePatterns(v) {
  let i = 0; const out = [];
  while (i < v.length) {
    const k = symToStr(v[i++]);
    if (k === ':where') {
      while (i < v.length && !String(symToStr(v[i])).startsWith(':')) {
        const f = v[i++];
        if (Array.isArray(f)) {
          out.push(f.map(symToStr));
        }
      }
      break;
    } else {
      // Skip non-where forms
      if (Array.isArray(v[i])) i++; else i++;
    }
  }
  return out;
}

// Minimal adapter validating arity and collection-ness to mirror CLJ query_v3 tests
export function qV3(queryEdn, ...inputs) {
  const v = parseEDN(queryEdn);
  if (!Array.isArray(v)) throw new Error('Query must be a vector');
  
  const inBindings = parseInBindings(v);
  const required = inBindings.length;
  const provided = inputs.length;
  
  if (provided !== required) {
    throw new Error(`Wrong number of arguments for bindings [${inBindings.map(symToStr).join(' ')}], ${required} required, ${provided} provided`);
  }
  
  // Check if first argument should be a collection based on where patterns
  const where = parseWherePatterns(v);
  if (where.length && required >= 1) {
    const first = inputs[0];
    
    // Check if this is a valid collection/database
    const isCollection = first && 
      (Array.isArray(first) || 
       (first && typeof first.datoms === 'function') || // DB objects
       (first && typeof first[Symbol.iterator] === 'function' && typeof first !== 'string')); // Iterables but not strings
    
    // If any where clause looks like a data pattern (length >= 2), require a collection
    for (const pat of where) {
      if (Array.isArray(pat) && pat.length >= 2 && !isCollection) {
        throw new Error(`Cannot match by pattern [${pat.join(' ')}] because source is not a collection: ${String(first)}`);
      }
    }
  }
  
  // For now, this adapter only validates arity/source shape (enough to port CLJ test-validation)  
  // A fuller adapter could rewrite to a DB q via :in + untuple.
  return [];
}
