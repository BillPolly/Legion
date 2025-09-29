// Minimal Datalog-like query engine.
import { pull as pullFn } from './pull.js';
// Usage:
//   const query = {
//     find: ['?e', '?n'],
//     where: [
//       ['?e', ':person/name', '?n'],
//       ['?e', ':person/age', 33]
//     ]
//   };
//   const results = q(query, db);
//   // => array of tuples matching find order

function isVar(x) { return typeof x === 'string' && x.startsWith('?'); }
function isSrcVar(x) { return typeof x === 'string' && x.startsWith('$'); }

function chooseIndex(db, clause, env) {
  // clause: [e, a, v]
  // Determine which parts are bound (constant or already bound var)
  const [e0, a0, v0] = clause;
  const e = isVar(e0) ? (env[e0] ?? undefined) : e0;
  const a = isVar(a0) ? (env[a0] ?? undefined) : a0;
  const v = isVar(v0) ? (env[v0] ?? undefined) : v0;
  if (e !== undefined && a !== undefined) return ['eavt', { e, a }];
  if (a !== undefined && v !== undefined) return ['avet', { a, v }];
  if (e !== undefined) return ['eavt', { e }];
  if (a !== undefined) return ['aevt', { a }];
  if (v !== undefined) return ['vaet', { v }];
  return ['eavt', {}];
}

function unify(env, clause, d) {
  // Attempt to extend env with values from datom d per clause
  const out = { ...env };
  const keys = ['e','a','v'];
  const equals = (a, b) => {
    if (a === b) return true;
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    return false;
  };
  for (let i = 0; i < 3; i++) {
    const term = clause[i];
    if (isVar(term)) {
      const cur = out[term];
      const val = d[keys[i]];
      if (cur === undefined) out[term] = val;
      else if (!equals(cur, val)) return null;
    } else {
      // constant must match
      if (!equals(term, d[keys[i]])) return null;
    }
  }
  return out;
}

const OPS = {
  '=': (a, b) => a === b,
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b,
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
};

function toAtom(term) { return (term && typeof term === 'object' && '$sym' in term) ? term.$sym : term; }

function isPredicateClause(clause) {
  if (!Array.isArray(clause) || clause.length < 1) return false;
  const head = toAtom(clause[0]);
  return typeof head === 'string' && OPS[head];
}

function valueOf(term, env) {
  const t = toAtom(term);
  return isVar(t) ? env[t] : t;
}

function valueOfSrc(term, env) {
  if (isSrcVar(term)) return env[term];
  return term;
}

const CALC = {
  '+': (...xs) => xs.reduce((a, b) => a + b, 0),
  '*': (...xs) => xs.reduce((a, b) => a * b, 1),
  '-': (a, b) => a - b,
  '/': (a, b) => a / b,
};

function isCalcClause(clause) {
  return Array.isArray(clause) && clause.length >= 4 && clause[0] === 'calc' && typeof clause[1] === 'string' && CALC[clause[1]];
}

// General function binding: ['call', op, ...args, outVar]
const FNS = {
  '+': (...xs) => xs.reduce((a, b) => a + b, 0),
  '*': (...xs) => xs.reduce((a, b) => a * b, 1),
  '-': (a, b) => a - b,
  '/': (a, b) => a / b,
  'inc': (a) => a + 1,
  'dec': (a) => a - 1,
  'str': (...xs) => xs.map(x => x == null ? '' : String(x)).join(''),
  'tuple': (...xs) => xs,
  'vector': (...xs) => xs,
};

function isCallClause(clause) {
  if (!Array.isArray(clause) || clause.length < 3) return false;
  if (clause[0] !== 'call') return false;
  const op = toAtom(clause[1]);
  return typeof op === 'string' && !!FNS[op];
}

function seedEnvsFromIn(qin, inputs) {
  // Supports:
  //  - string var: '?x'
  //  - collection binding: ['?x', '...'] with input iterable
  //  - tuple binding: ['?x','?y'] with input array/iterable of same length
  if (qin.length && inputs.length < qin.length) throw new Error('Not enough inputs for :in');
  let envs = [{}];
  for (let i = 0; i < qin.length; i++) {
    const binding = qin[i];
    const value = inputs[i];
    if (typeof binding === 'string') {
      if (!(isVar(binding) || isSrcVar(binding))) throw new Error('Only variable or source names supported in :in');
      envs = envs.map(env => ({ ...env, [binding]: value }));
    } else if (Array.isArray(binding)) {
      if (binding.length >= 2 && binding[binding.length - 1] === '...') {
        // collection binding
        const varName = binding[0];
        if (!isVar(varName)) throw new Error('Collection binding must start with a variable');
        const coll = Array.isArray(value) ? value : (value && typeof value[Symbol.iterator] === 'function' ? Array.from(value) : null);
        if (!coll) throw new Error('Collection binding requires iterable input');
        const next = [];
        for (const env of envs) {
          for (const item of coll) next.push({ ...env, [varName]: item });
        }
        envs = next;
      } else {
        // tuple binding (single tuple or relation of tuples)
        const vars = binding;
        if (!Array.isArray(value)) throw new Error('Tuple binding requires array input');
        const isRelation = Array.isArray(value[0]);
        if (isRelation) {
          const next = [];
          for (const env of envs) {
            for (const tuple of value) {
              if (tuple.length < vars.length) throw new Error('Not enough elements for tuple binding');
              const out = { ...env };
              for (let k = 0; k < vars.length; k++) {
                const v = vars[k];
              if (isVar(v)) out[v] = tuple[k];
            }
            next.push(out);
          }
        }
        envs = next;
        } else {
          if (value.length < vars.length) throw new Error('Not enough elements for tuple binding');
          envs = envs.map(env => {
            const out = { ...env };
            for (let k = 0; k < vars.length; k++) {
              const v = vars[k];
              if (isVar(v)) out[v] = value[k];
            }
            return out;
          });
        }
      }
    } else {
      throw new Error('Unsupported :in binding form');
    }
  }
  return envs;
}

export function q(query, db, ...inputs) {
  const find = query.find || [];
  const where = query.where || [];
  const qin = query.in || [];
  const qwith = query.with || [];
  const rules = query.rules || {};
  const findType = query.findType || 'rel';
  if (!Array.isArray(find) || !Array.isArray(where)) throw new Error('query must have array find/where');
  if (!Array.isArray(qin)) throw new Error('query.in must be an array if provided');

  const envRows = [];

  // Seed initial envs from :in bindings
  const initialEnvs = seedEnvsFromIn(qin, inputs);

  function backtrack(i, env) {
    if (i === where.length) { envRows.push({ ...env }); return; }
    const clause = where[i];
    if (Array.isArray(clause) && clause[0] === 'or') {
      const branches = clause.slice(1);
      const simpleTriples = branches.every(br => Array.isArray(br) && br.length === 1 && Array.isArray(br[0]) && (br[0].length === 3 || br[0].length === 4));
      if (simpleTriples) {
        for (const br of branches) {
          const t = br[0];
          const hasSrc = t.length === 4;
          const srcDB = hasSrc ? valueOfSrc(t[0], env) : db;
          const triple = hasSrc ? t.slice(1) : t;
          const [idx, prefix] = chooseIndex(srcDB, triple, env);
          for (const d of srcDB.datoms(idx, ...Object.values(prefix))) {
            const next = unify(env, triple, d);
            if (next) backtrack(i + 1, next);
          }
        }
      } else {
        for (const br of branches) solveSubClauses(br, env, (envOut) => backtrack(i + 1, envOut));
      }
    } else if (Array.isArray(clause) && clause[0] === 'or-join') {
      for (let k = 2; k < clause.length; k++) solveSubClauses(clause[k], env, (envOut) => backtrack(i + 1, envOut));
    } else if (Array.isArray(clause) && clause[0] === 'not') {
      const sub = clause.slice(1);
      if (!existsSolution(sub, env)) backtrack(i + 1, env);
    } else if (Array.isArray(clause) && clause[0] === 'not-join') {
      const sub = clause.slice(2);
      if (!existsSolution(sub, env)) backtrack(i + 1, env);
    } else if (Array.isArray(clause) && (clause[0] === 'rule' || rules[clause[0]])) {
      const name = clause[0] === 'rule' ? clause[1] : clause[0];
      const callArgs = clause[0] === 'rule' ? clause.slice(2) : clause.slice(1);
      const def = rules[name];
      if (!def) throw new Error(`Unknown rule: ${name}`);
      for (const bodyDef of def.bodies || []) {
        const paramVars = Array.isArray(bodyDef) ? (def.args || []) : (bodyDef.args || def.args || []);
        const bodyClauses = Array.isArray(bodyDef) ? bodyDef : (bodyDef.clauses || bodyDef);
        const mapping = {};
        for (let k = 0; k < paramVars.length; k++) mapping[paramVars[k]] = callArgs[k];
        const sub = substituteParams(bodyClauses, mapping);
        solveSubClauses(sub, env, (envOut) => backtrack(i + 1, envOut));
      }
    } else if (isPredicateClause(clause)) {
      // boolean predicate: all vars must be bound
      const op = OPS[clause[0]];
      const args = clause.slice(1).map(a => valueOf(a, env));
      if (args.every(a => a !== undefined) && op(args[0], args[1])) {
        backtrack(i + 1, env);
      }
    } else if (isCalcClause(clause)) {
      const op = CALC[clause[1]];
      const outVar = clause[clause.length - 1];
      const args = clause.slice(2, clause.length - 1).map(a => valueOf(a, env));
      if (!isVar(outVar)) throw new Error('calc clause must end with an output variable');
      if (args.every(a => a !== undefined)) {
        const val = op(...args);
        const cur = env[outVar];
        if (cur === undefined) backtrack(i + 1, { ...env, [outVar]: val });
        else if (cur === val) backtrack(i + 1, env);
      }
    } else if (isCallClause(clause)) {
      const opName = toAtom(clause[1]);
      const fn = FNS[opName];
      const outVar = clause[clause.length - 1];
      const args = clause.slice(2, clause.length - 1).map(a => valueOf(a, env));
      if (!isVar(outVar)) throw new Error('call clause must end with an output variable');
      if (args.every(a => a !== undefined)) {
        const val = fn(...args);
        const cur = env[outVar];
        if (cur === undefined) backtrack(i + 1, { ...env, [outVar]: val });
        else if (cur === val) backtrack(i + 1, env);
      }
    } else if (Array.isArray(clause) && clause[0] === 'untuple') {
      const src = valueOf(clause[1], env);
      const outs = clause[2];
      if (Array.isArray(src) && Array.isArray(outs)) {
        const next = { ...env };
        for (let k = 0; k < outs.length; k++) {
          const v = outs[k];
          if (isVar(v)) next[v] = src[k];
        }
        backtrack(i + 1, next);
      }
    } else if (Array.isArray(clause) && (clause.length === 3 || clause.length === 4) && !isPredicateClause(clause) && !isCalcClause(clause)) {
      // triple pattern, possibly with explicit source as first element
      const hasSrc = clause.length === 4;
      const srcDB = hasSrc ? valueOfSrc(clause[0], env) : db;
      const triple = hasSrc ? clause.slice(1) : clause;
      const [idx, prefix] = chooseIndex(srcDB, triple, env);
      for (const d of srcDB.datoms(idx, ...Object.values(prefix))) {
        const next = unify(env, triple, d);
        if (next) backtrack(i + 1, next);
      }
    } else {
      throw new Error('Unsupported clause shape');
    }
  }

  function solveSubClauses(clauses, env, cont) {
    function step(j, env2) {
      if (j === clauses.length) { cont(env2); return; }
      const clause = clauses[j];
      if (Array.isArray(clause) && clause[0] === 'or') {
        for (let k = 1; k < clause.length; k++) {
          stepOrBranch(clause[k], env2, (eNext) => step(j + 1, eNext));
        }
      } else if (Array.isArray(clause) && clause[0] === 'or-join') {
        for (let k = 2; k < clause.length; k++) {
          stepOrBranch(clause[k], env2, (eNext) => step(j + 1, eNext));
        }
      } else if (Array.isArray(clause) && clause[0] === 'not') {
        const sub = clause.slice(1);
        if (!existsSolution(sub, env2)) step(j + 1, env2);
      } else if (Array.isArray(clause) && clause[0] === 'not-join') {
        const sub = clause.slice(2);
        if (!existsSolution(sub, env2)) step(j + 1, env2);
      } else if (Array.isArray(clause) && (clause[0] === 'rule' || rules[clause[0]])) {
        const name = clause[0] === 'rule' ? clause[1] : clause[0];
        const callArgs = clause[0] === 'rule' ? clause.slice(2) : clause.slice(1);
        const def = rules[name];
        if (!def) throw new Error(`Unknown rule: ${name}`);
        for (const bodyDef of def.bodies || []) {
          const paramVars = Array.isArray(bodyDef) ? (def.args || []) : (bodyDef.args || def.args || []);
          const bodyClauses = Array.isArray(bodyDef) ? bodyDef : (bodyDef.clauses || bodyDef);
          const mapping = {};
          for (let k = 0; k < paramVars.length; k++) mapping[paramVars[k]] = callArgs[k];
          const sub2 = substituteParams(bodyClauses, mapping);
          stepOrBranch(sub2, env2, (eNext) => step(j + 1, eNext));
        }
      } else if (Array.isArray(clause) && (clause.length === 3 || clause.length === 4) && !isPredicateClause(clause) && !isCalcClause(clause)) {
        const hasSrc = clause.length === 4;
        const srcDB = hasSrc ? valueOfSrc(clause[0], env2) : db;
        const triple = hasSrc ? clause.slice(1) : clause;
        const [idx, prefix] = chooseIndex(srcDB, triple, env2);
        for (const d of srcDB.datoms(idx, ...Object.values(prefix))) {
          const next = unify(env2, triple, d);
          if (next) step(j + 1, next);
        }
      } else if (isPredicateClause(clause)) {
        const op = OPS[clause[0]];
        const args = clause.slice(1).map(a => valueOf(a, env2));
        if (args.every(a => a !== undefined) && op(args[0], args[1])) step(j + 1, env2);
      } else if (isCalcClause(clause)) {
        const op = CALC[clause[1]];
        const outVar = clause[clause.length - 1];
        const args = clause.slice(2, clause.length - 1).map(a => valueOf(a, env2));
        if (!isVar(outVar)) throw new Error('calc clause must end with an output variable');
        if (args.every(a => a !== undefined)) {
          const val = op(...args);
          const cur = env2[outVar];
          if (cur === undefined) step(j + 1, { ...env2, [outVar]: val });
          else if (cur === val) step(j + 1, env2);
        }
      } else if (isCallClause(clause)) {
        const opName = toAtom(clause[1]);
        const fn = FNS[opName];
        const outVar = clause[clause.length - 1];
        const args = clause.slice(2, clause.length - 1).map(a => valueOf(a, env2));
        if (!isVar(outVar)) throw new Error('call clause must end with an output variable');
        if (args.every(a => a !== undefined)) {
          const val = fn(...args);
          const cur = env2[outVar];
          if (cur === undefined) step(j + 1, { ...env2, [outVar]: val });
          else if (cur === val) step(j + 1, env2);
        }
      } else if (Array.isArray(clause) && clause[0] === 'untuple') {
        const src = valueOf(clause[1], env2);
        const outs = clause[2];
        if (Array.isArray(src) && Array.isArray(outs)) {
          const next = { ...env2 };
          for (let k = 0; k < outs.length; k++) {
            const v = outs[k];
            if (isVar(v)) next[v] = src[k];
          }
          step(j + 1, next);
        }
      } else {
        throw new Error('Unsupported clause shape in sub');
      }
    }
    function stepOrBranch(clausesBranch, env2, cont2) {
      function walk(k, e) {
        if (k === clausesBranch.length) { cont2(e); return; }
        const c = clausesBranch[k];
        solveSubClauses([c], e, (e2) => walk(k + 1, e2));
      }
      walk(0, env2);
    }
    step(0, env);
  }

  function existsSolution(clauses, env) {
    let found = false;
    solveSubClauses(clauses, env, () => { found = true; });
    return found;
  }

  function substituteParams(clauses, mapping) {
    const subst = (term) => {
      if (typeof term === 'string' && mapping[term] !== undefined) return mapping[term];
      return term;
    };
    const mapClause = (c) => {
      if (Array.isArray(c)) return c.map(x => Array.isArray(x) ? x.map(y => subst(y)) : subst(x));
      return c;
    };
    return clauses.map(mapClause);
  }

  for (const env of initialEnvs) backtrack(0, env);

  const processed = processResults(envRows, find, qwith, db, findType);
  const ret = query.return;
  if (ret && ret.keys && ret.keys.length === find.length) {
    const rows = (findType === 'tuple') ? [processed] : processed;
    return shapeReturnMap(rows, ret.mode, ret.keys, findType);
  }
  return processed;
}

function compareVals(a, b) {
  // Keyword-like strings start with ':' and may contain namespace/name
  if (typeof a === 'string' && typeof b === 'string' && a.startsWith(':') && b.startsWith(':')) {
    const idxA = a.indexOf('/', 1); const idxB = b.indexOf('/', 1);
    const nsA = idxA > 0 ? a.slice(1, idxA) : a.slice(1);
    const nmA = idxA > 0 ? a.slice(idxA + 1) : '';
    const nsB = idxB > 0 ? b.slice(1, idxB) : b.slice(1);
    const nmB = idxB > 0 ? b.slice(idxB + 1) : '';
    if (nsA < nsB) return -1; if (nsA > nsB) return 1;
    if (nmA < nmB) return -1; if (nmA > nmB) return 1;
    return 0;
  }
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

const AGG = {
  'count': (vals) => vals.length,
  'count-distinct': (vals) => new Set(vals).size,
  'sum': (vals) => vals.reduce((a, b) => a + (Number(b) || 0), 0),
  'min': (vals, ...rest) => {
    if (rest.length && typeof rest[0] === 'number') {
      const k = rest[0];
      const arr = Array.from(new Set(vals)).sort((a,b)=> (a<b?-1:(a>b?1:0)));
      return arr.slice(0, k);
    }
    return vals.length ? vals.reduce((a, b) => (compareVals(a,b) <= 0 ? a : b)) : undefined;
  },
  'max': (vals, ...rest) => {
    if (rest.length && typeof rest[0] === 'number') {
      const k = rest[0];
      const arr = Array.from(new Set(vals)).sort((a,b)=> (a<b?-1:(a>b?1:0))).reverse();
      return arr.slice(0, k);
    }
    return vals.length ? vals.reduce((a, b) => (compareVals(a,b) >= 0 ? a : b)) : undefined;
  },
  'avg': (vals) => vals.length ? (vals.reduce((a, b) => a + (Number(b) || 0), 0) / vals.length) : undefined,
  'median': (vals) => {
    if (!vals.length) return undefined;
    const arr = vals.slice().sort((a,b)=> (a<b?-1:(a>b?1:0)));
    const m = Math.floor(arr.length/2);
    return arr.length % 2 === 1 ? arr[m] : (Number(arr[m-1]) + Number(arr[m]))/2;
  },
  'variance': (vals) => {
    if (!vals.length) return undefined;
    const nums = vals.map(Number);
    const mean = nums.reduce((a,b)=>a+b,0)/nums.length;
    const sse = nums.reduce((a,b)=> a + Math.pow(b-mean,2), 0);
    return sse/nums.length;
  },
  'stddev': (vals) => {
    const v = AGG['variance'](vals);
    return v === undefined ? undefined : Math.sqrt(v);
  },
  'distinct': (vals) => Array.from(new Set(vals)),
};

function isAggTerm(term) {
  return Array.isArray(term) && typeof term[0] === 'string' && (!!AGG[term[0]] || term[0] === 'aggregate');
}

function isPullTerm(term) {
  return Array.isArray(term) && term[0] === 'pull';
}

function processResults(envRows, find, qwith, defaultDB, findType) {
  const nonAggVars = [];
  for (const t of find) {
    if (!isAggTerm(t) && !isPullTerm(t) && typeof t === 'string' && isVar(t)) nonAggVars.push(t);
  }
  const hasAgg = find.some(isAggTerm);
  const hasPull = find.some(isPullTerm);
  const withVars = Array.isArray(qwith) ? qwith : [];

  // If no agg or pull, return projection directly
  if (!hasAgg && !hasPull) {
    const rows = envRows.map(env => find.map(v => (typeof v === 'string' && isVar(v)) ? env[v] : v));
    // With vars present means preserve multiplicity
    return shapeResults((withVars && withVars.length ? rows : dedupeRows(rows)), findType);
  }

  // Group by non-agg vars
  const groups = new Map();
  const groupKeyOf = (env) => JSON.stringify(nonAggVars.map(v => env[v]));
  for (const env of envRows) {
    const key = groupKeyOf(env);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(env);
  }

  // withVars already computed above

  function dedupeGroup(envs) {
    if (!withVars.length) return envs;
    const seen = new Set();
    const out = [];
    for (const e of envs) {
      const key = JSON.stringify(nonAggVars.concat(withVars).map(v => e[v]));
      if (!seen.has(key)) { seen.add(key); out.push(e); }
    }
    return out;
  }

  const outRows = [];
  for (const [key, envs0] of groups.entries()) {
    const envs = dedupeGroup(envs0);
    const baseVals = JSON.parse(key);
    const out = [];
    let basePtr = 0;
    for (const term of find) {
      if (isAggTerm(term)) {
        const fn = term[0];
        if (fn === 'aggregate') {
          const aggFnVar = term[1];
          const valVar = term[2];
          const aggFn = envs[0][aggFnVar];
          const values = envs.map(e => e[valVar]);
          out.push(typeof aggFn === 'function' ? aggFn(values) : values);
        } else {
          const args = term.slice(1);
          const varArgs = args.filter(a => typeof a === 'string' && isVar(a));
          const values = varArgs.length ? envs.map(e => e[varArgs[varArgs.length-1]]) : envs.map(() => 1);
          const extra = args.filter(a => !(typeof a === 'string' && isVar(a))).map(toAtom);
          out.push(AGG[fn](values, ...extra));
        }
      } else if (isPullTerm(term)) {
        // ['pull', '?e', pattern] or ['pull', '$src', '?e', pattern]
        if (term.length === 3) {
          let eid = envs[0][term[1]];
          if (eid === undefined) {
            for (const v of Object.values(envs[0])) { if (typeof v === 'number') { eid = v; break; } }
          }
          out.push(pullFn(defaultDB, term[2], eid));
        } else {
          const srcDB = envs[0][term[1]]; // bound source var
          let eid = envs[0][term[2]];
          if (eid === undefined) {
            for (const v of Object.values(envs[0])) { if (typeof v === 'number') { eid = v; break; } }
          }
          out.push(pullFn(srcDB, term[3], eid));
        }
      } else if (typeof term === 'string' && isVar(term)) {
        out.push(baseVals[basePtr++]);
      } else {
        out.push(term);
      }
    }
    outRows.push(out);
  }

  return shapeResults(dedupeRows(outRows), findType);
}

function dedupeRows(rows) {
  const out = [];
  const seen = new Set();
  for (const r of rows) {
    const key = JSON.stringify(r);
    if (!seen.has(key)) { seen.add(key); out.push(r); }
  }
  return out;
}

function shapeResults(rows, findType) {
  switch (findType) {
    case 'scalar':
      return rows.length ? rows[0][0] : undefined;
    case 'coll':
      return rows.map(r => r[0]);
    case 'tuple':
      return rows[0] || [];
    case 'rel':
    default:
      return rows;
  }
}

// Return map shaping — applied in q() after processResults
function shapeReturnMap(rows, mode, keys, findType) {
  const makeKey = (k) => {
    if (mode === 'strs') return String(k);
    if (mode === 'syms') return String(k); // no symbol type in JS; use string
    return k; // keys
  };
  const mapRow = (row) => {
    const obj = {};
    for (let i = 0; i < keys.length; i++) obj[makeKey(keys[i])] = row[i];
    return obj;
  };
  if (findType === 'tuple') return rows.length ? mapRow(rows[0]) : {};
  return rows.map(mapRow);
}
