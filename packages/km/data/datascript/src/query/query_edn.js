import { parseEDN } from '../utils/edn.js';
import { q } from './query.js';
import { pull } from './pull.js';

function symToStr(x) {
  if (typeof x === 'string') return x; // keywords
  if (x && x.$sym) return x.$sym;
  return x;
}

function isSym(x, name) { return x && x.$sym === name; }

function asVar(x) {
  const s = symToStr(x);
  return typeof s === 'string' && (s.startsWith('?') || s.startsWith('$')) ? s : s;
}

function translateFind(findForms) {
  // find can be: symbols, (agg arg), (pull ?e pattern), or vector for tuple/coll
  // scalar: [:find ?e .]
  // coll: [:find [?e ...]]
  const out = { find: [], findType: 'rel' };
  // Handle trailing '.' scalar indicator
  const last = findForms[findForms.length - 1];
  const scalar = isSym(last, '.');
  const forms = scalar ? findForms.slice(0, -1) : findForms;
  for (const f of forms) {
    if (f && f.$list) {
      // (agg ?x) or (pull ?e pattern)
      const lst = f.$list;
      const head = symToStr(lst[0]);
      if (head === 'pull') {
        // (pull ?e pattern)
        out.find.push(['pull', asVar(lst[1]), translatePullPattern(lst[2])]);
      } else {
        // aggregate
        if (lst.length === 1) out.find.push([head]);
        else out.find.push([head, ...lst.slice(1).map(asVar)]);
      }
    } else if (Array.isArray(f)) {
      // vector form: tuple or coll
      const vs = f.map(symToStr);
      const hasDots = vs.includes('...');
      if (hasDots) {
        out.findType = 'coll';
        const v = vs.find(x => x !== '...');
        out.find = [v];
      } else {
        out.findType = 'tuple';
        out.find = vs.map(asVar);
      }
    } else {
      out.find.push(asVar(f));
    }
  }
  if (scalar) out.findType = 'scalar';
  return out;
}

function translatePullPattern(p) {
  if (Array.isArray(p)) return p.map(symToStr);
  return p;
}

function translateWhere(whereForms) {
  const out = [];
  for (const form of whereForms) {
    if (Array.isArray(form)) {
      // Binding call form: [(f ...args) ?out] or untuple destructuring: [(untuple ?tup) [?a ?b]]
      if (form.length === 2 && form[0] && form[0].$list) {
        const lst = form[0].$list;
        const head = symToStr(lst[0]);
        const args = lst.slice(1).map(asVar);
        if (head === 'untuple' && Array.isArray(form[1])) {
          out.push(['untuple', args[0], form[1].map(asVar)]);
        } else {
          out.push(['call', head, ...args, asVar(form[1])]);
        }
        continue;
      }
      // unwrap single-list clause like [(> ?v ?min)]
      if (form.length === 1 && form[0] && form[0].$list) {
        const lst = form[0].$list;
        const head = symToStr(lst[0]);
        const args = lst.slice(1).map(asVar);
        out.push([head, ...args]);
        continue;
      }
      // triple pattern [e a v]
      if (form.length === 3) {
        out.push([asVar(form[0]), symToStr(form[1]), asVar(form[2])]);
      } else if (form.length === 4 && (typeof form[0] === 'string' || (form[0] && form[0].$sym && String(form[0].$sym).startsWith('$')))) {
        out.push([asVar(form[0]), asVar(form[1]), symToStr(form[2]), asVar(form[3])]);
      } else if (form.$list) {
        // predicate like (> ?age 18)
        const lst = form.$list.map(symToStr);
        const op = lst[0];
        const args = form.$list.slice(1).map(asVar);
        out.push([op, ...args]);
      } else {
        // nested vector (e.g., for or branches)
        out.push(form.map(x => Array.isArray(x) ? x.map(symToStr) : symToStr(x)));
      }
    } else if (form && form.$list) {
      const lst = form.$list;
      const head = symToStr(lst[0]);
      if (head === 'or' || head === 'or-join') {
        const prefix = head === 'or-join' ? [head, lst[1].map(asVar)] : [head];
        const branches = lst.slice(head === 'or-join' ? 2 : 1).map(br => br.map(x => (Array.isArray(x) ? x.map(symToStr) : symToStr(x))));
        out.push([...prefix, ...branches]);
      } else if (head === 'not' || head === 'not-join') {
        const prefix = head === 'not-join' ? [head, lst[1].map(asVar)] : [head];
        const sub = lst.slice(head === 'not-join' ? 2 : 1).map(x => (Array.isArray(x) ? x.map(symToStr) : symToStr(x)));
        out.push([...prefix, ...sub]);
      } else if (head === 'calc') {
        const args = lst.slice(1).map(asVar);
        out.push(['calc', ...args]);
      } else {
        // predicate
        const args = lst.slice(1).map(asVar);
        out.push([head, ...args]);
      }
    } else {
      // unsupported atom in :where
    }
  }
  return out;
}

function translateIn(inForms) {
  const out = [];
  let hasRules = false;
  for (const f of inForms) {
    if (f && f.$sym === '%') { hasRules = true; continue; }
    if (Array.isArray(f)) {
      if (Array.isArray(f[0])) {
        const tuple = f[0].map(symToStr).map(asVar);
        out.push(tuple);
      } else {
        const items = f.map(symToStr);
        if (items[items.length - 1] === '...') {
          out.push([asVar(items[0]), '...']);
        } else {
          out.push(items.map(asVar));
        }
      }
    } else {
      out.push(asVar(f));
    }
  }
  return { inputs: out, hasRules };
}

export function parseQueryEDN(ednStr) {
  // Simple LRU cache for parsed queries
  if (!parseQueryEDN._cache) parseQueryEDN._cache = new Map();
  const cache = parseQueryEDN._cache;
  if (typeof ednStr === 'string' && cache.has(ednStr)) {
    const entry = cache.get(ednStr);
    cache.delete(ednStr); cache.set(ednStr, entry);
    return entry;
  }
  const v = parseEDN(ednStr);
  if (!Array.isArray(v)) throw new Error('Query EDN must be a vector');
  let i = 0;
  const query = { find: [], where: [] };
  let hasRules = false;
  while (i < v.length) {
    const k = symToStr(v[i++]);
    if (k === ':find') {
      const forms = [];
      while (i < v.length && !String(symToStr(v[i])).startsWith(':')) { forms.push(v[i++]); }
      const { find, findType } = translateFind(forms);
      query.find = find;
      if (findType) query.findType = findType;
      // After :find, there may be return map directives like :keys/:syms/:strs NAME*
      if (i < v.length) {
        const peek = symToStr(v[i]);
        if (peek === ':keys' || peek === ':syms' || peek === ':strs') {
          i++;
          const names = [];
          while (i < v.length && !String(symToStr(v[i])).startsWith(':')) { names.push(symToStr(v[i++])); }
          query.return = { mode: peek.slice(1), keys: names };
        }
      }
    } else if (k === ':where') {
      // Accept either a single vector of clauses, or a sequence of forms until next keyword
      if (Array.isArray(v[i])) {
        const forms = v[i++];
        query.where = translateWhere(forms);
      } else {
        const forms = [];
        while (i < v.length && !String(symToStr(v[i])).startsWith(':')) { forms.push(v[i++]); }
        query.where = translateWhere(forms);
      }
    } else if (k === ':in') {
      const forms = [];
      while (i < v.length && !String(symToStr(v[i])).startsWith(':')) { forms.push(v[i++]); }
      const { inputs, hasRules: hr } = translateIn(forms);
      query.in = inputs;
      hasRules = hasRules || hr;
    } else if (k === ':with') {
      const arr = v[i++];
      if (Array.isArray(arr)) query.with = arr.map(asVar);
      else query.with = [asVar(arr)];
    } else {
      // skip unknowns for now
      i++;
    }
  }
  const result = { query, hasRules };
  if (typeof ednStr === 'string') {
    cache.set(ednStr, result);
    if (cache.size > 100) { const k = cache.keys().next().value; cache.delete(k); }
  }
  return result;
}

function translateRuleBodyClauses(clauses) {
  // clauses: vector of where-like forms
  return translateWhere(clauses);
}

export function parseRulesEDN(rulesInput) {
  const v = typeof rulesInput === 'string' ? parseEDN(rulesInput) : rulesInput;
  if (!Array.isArray(v)) throw new Error('Rules EDN must be a vector');
  const out = {};
  for (const rule of v) {
    if (!Array.isArray(rule) || rule.length < 2) continue;
    const head = rule[0];
    if (!head || !head.$list) continue;
    const name = symToStr(head.$list[0]);
    const args = head.$list.slice(1).map(asVar);
    const bodyClauses = rule.slice(1);
    const clauses = translateRuleBodyClauses(bodyClauses);
    if (!out[name]) out[name] = { bodies: [] };
    out[name].bodies.push({ args, clauses });
  }
  return out;
}

export function qEdn(ednStr, db, ...inputs) {
  const parsed = parseQueryEDN(ednStr);
  const query = parsed.query || parsed; // backward compat
  let restInputs = inputs;
  if (parsed.hasRules) {
    const rulesInput = inputs[inputs.length - 1];
    const rules = parseRulesEDN(rulesInput);
    query.rules = rules;
    restInputs = inputs.slice(0, -1);
  }
  return q(query, db, ...restInputs);
}

// Pull EDN translator
function toJsVal(x) {
  if (x && x.$sym) return x.$sym;
  return x;
}

function translatePullPatternNode(node) {
  if (Array.isArray(node)) {
    // Vector of items
    const out = [];
    for (const el of node) {
      if (Array.isArray(el)) {
        // vector spec like [:aka :as :alias]
        out.push(el.map(toJsVal));
      } else if (typeof el === 'object' && el !== null && !el.$list) {
        // map spec
        for (const keyStr of Object.keys(el)) {
          const val = el[keyStr];
          if (keyStr.startsWith('[')) {
            // vector key serialized via JSON.stringify in EDN parser
            let vec;
            try { vec = JSON.parse(keyStr); } catch { vec = []; }
            const attr = toJsVal(vec[0]);
            const spec = [];
            for (let i = 1; i < vec.length; i += 2) {
              const k = toJsVal(vec[i]); const v = toJsVal(vec[i + 1]);
              spec.push(k, v);
            }
            if (spec.length) out.push([attr, ...spec]);
            // subpattern
            const sub = translatePullPatternNode(val);
            out.push({ [attr]: sub });
          } else if (keyStr.startsWith('{')) {
            // list key like (limit :friend 2) serialized by JSON.stringify
            let obj;
            try { obj = JSON.parse(keyStr); } catch { obj = null; }
            if (obj && obj.$list) {
              const lst = obj.$list;
              const head = toJsVal(lst[0]);
              if (head === 'limit' || head === 'default' || head === 'as') {
                const attr = toJsVal(lst[1]);
                if (head === 'limit') {
                  const sub = translatePullPatternNode(val);
                  out.push({ [attr]: { __pullLimit: toJsVal(lst[2]), __pullSub: sub } });
                } else {
                  const spec = head === 'default' ? [':default', toJsVal(lst[2])] : [':as', toJsVal(lst[2])];
                  out.push([attr, ...spec]);
                  const sub = translatePullPatternNode(val);
                  out.push({ [attr]: sub });
                }
              }
            }
          } else {
            const attr = keyStr;
            const sub = translatePullPatternNode(val);
            out.push({ [attr]: sub });
          }
        }
      } else if (el && el.$list) {
        const lst = el.$list;
        const head = toJsVal(lst[0]);
        if (head === 'limit' || head === 'default' || head === 'as') {
          const attr = toJsVal(lst[1]);
          const spec = head === 'limit' ? [':limit', toJsVal(lst[2])] : head === 'default' ? [':default', toJsVal(lst[2])] : [':as', toJsVal(lst[2])];
          out.push([attr, ...spec]);
        }
      } else {
        out.push(toJsVal(el));
      }
    }
    return out;
  }
  return toJsVal(node);
}

export function pullEdn(db, ednPattern, eid, opts) {
  const parsed = typeof ednPattern === 'string' ? parseEDN(ednPattern) : ednPattern;
  const pattern = translatePullPatternNode(parsed);
  return pull(db, pattern, eid, opts);
}
