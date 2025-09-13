import { Indexes } from './indexes.js';
import { datom } from './datom.js';

let nextEid = 1;
let nextTx = Date.now();

// Reset global entity ID counter (for test isolation)
export function resetEntityIdCounter() {
  nextEid = 1;
}

const ORDER = {
  eavt: ['e','a','v','tx','added'],
  aevt: ['a','e','v','tx','added'],
  avet: ['a','v','e','tx','added'],
  vaet: ['v','a','e','tx','added'],
};

export class DB {
  constructor(schema = {}, idx = new Indexes()) {
    this.schema = Object.freeze({ ...schema });
    this.idx = idx;
    Object.freeze(this);
  }

  static empty(schema = {}) { return new DB(schema); }

  empty() { return new DB(this.schema); }

  // read APIs
  datoms(index, ...components) {
    // Remove colon prefix if present to match property names
    const indexName = index.startsWith(':') ? index.slice(1) : index;
    const idx = this.idx[indexName];
    if (!idx) {
      throw new Error(`Unknown index: ${index}. Available: eavt, aevt, avet, vaet`);
    }
    const keys = ORDER[index] || ORDER[indexName];
    const prefix = {};
    for (let i = 0; i < components.length; i++) prefix[keys[i]] = components[i];
    return Array.from(idx.range(prefix));
  }

  entity(e) {
    // Support lookup refs and idents
    const resolve = (spec) => {
      if (typeof spec === 'number') return spec;
      if (typeof spec === 'string' && spec.startsWith(':')) {
        const d = this.idx.avet.range({ a: ':db/ident', v: spec })[Symbol.iterator]().next().value;
        return d ? d.e : undefined;
      }
      if (Array.isArray(spec) && spec.length === 2 && typeof spec[0] === 'string' && spec[0].startsWith(':')) {
        const attr = spec[0];
        const unique = this.schema[attr]?.unique;
        if (!unique) throw new Error(`Lookup ref attribute should be marked as :db/unique: [${attr} ${JSON.stringify(spec[1])}]`);
        const d = this.idx.avet.range({ a: spec[0], v: spec[1] })[Symbol.iterator]().next().value;
        return d ? d.e : undefined;
      }
      return spec;
    };
    e = resolve(e);
    if (!(typeof e === 'number' && Number.isFinite(e))) return null;
    const attrs = new Map();
    for (const d of this.datoms('eavt', e)) {
      const card = this.schema[d.a]?.card || 'one';
      const vt = this.schema[d.a]?.valueType;
      // If ref type and referenced entity missing, skip the value
      const keep = (vt === 'ref' && typeof d.v === 'number') ? this.datoms('eavt', d.v).length > 0 : true;
      if (!keep) continue;
      if (card === 'many') {
        if (!attrs.has(d.a)) attrs.set(d.a, new Set());
        attrs.get(d.a).add(d.v);
      } else {
        attrs.set(d.a, d.v);
      }
    }
    if (attrs.size === 0) return null;
    const obj = { id: e };
    for (const [k, v] of attrs) {
      if (v instanceof Set) {
        // Freeze returned arrays to ensure entity is deeply immutable
        obj[k] = Object.freeze(Array.from(v));
      } else {
        obj[k] = v;
      }
    }
    return Object.freeze(obj);
  }

  // write APIs
  withTx(txData) {
    let adds = [];
    let removes = [];
    let idx = this.idx;
    const tempids = new Map();
    const txInst = ++nextTx;
    // tuple attributes support
    const tupleSpecs = Object.entries(this.schema).filter(([, s]) => Array.isArray(s?.tupleAttrs));
    const tupleAttrSet = new Set(tupleSpecs.map(([t]) => t));
    const compToTuple = new Map();
    for (const [t, s] of tupleSpecs) {
      for (const comp of s.tupleAttrs) {
        if (!compToTuple.has(comp)) compToTuple.set(comp, new Set());
        compToTuple.get(comp).add(t);
      }
    }
    const touched = new Map(); // e -> Set(tupleAttr)
    const getUnique = (a) => this.schema[a]?.unique; // 'identity' | 'value' | undefined
    const getCard = (a) => this.schema[a]?.card || 'one';
    const findEidByLookup = (a, v) => {
      const d = this.idx.avet.range({ a, v })[Symbol.iterator]().next().value;
      return d ? d.e : undefined;
    };
    const findEidByIdent = (kw) => findEidByLookup(':db/ident', kw);
    const isKeyword = (s) => typeof s === 'string' && s.startsWith(':');
    const resolveLookupOrIdent = (x) => {
      if (typeof x === 'string' && x.startsWith(':')) {
        const e = findEidByIdent(x);
        if (e !== undefined) return e;
        return x;
      }
      if (Array.isArray(x) && x.length === 2 && isKeyword(x[0])) {
        const [a, v] = x;
        const e = findEidByLookup(a, v);
        if (e === undefined) throw new Error('Lookup ref not found: ' + JSON.stringify(x));
        return e;
      }
      return x;
    };
    const getValueType = (a) => this.schema[a]?.valueType;
    const assertAttr = (a) => {
      if (!isKeyword(a)) throw new Error('Bad entity attribute');
    };
    const assertNotNil = (v) => {
      if (v === null || v === undefined) throw new Error('Cannot store nil as a value');
    };
    const assertValidEidForAdd = (e) => {
      if (typeof e === 'number') return true;
      if (Array.isArray(e) && e.length === 2 && isKeyword(e[0])) return true;
      if (typeof e === 'string' && e.startsWith(':')) return true; // ident
      throw new Error('Expected number, ident or lookup ref for :db/id');
    };
    const assertValidEidForRetract = (e) => {
      if (typeof e === 'number') {
        if (e < 0) throw new Error('Tempids are allowed in :db/add only');
        return true;
      }
      if (Array.isArray(e) && e.length === 2 && isKeyword(e[0])) return true;
      throw new Error('Expected number or lookup ref for entity id');
    };

    const forwardAttr = (attr) => {
      if (typeof attr !== 'string') return attr;
      if (attr.startsWith(':_')) return ':' + attr.slice(2);
      if (attr.includes('/_')) return attr.replace('/_', '/');
      return attr;
    };
    const isIterable = (v) => v && typeof v !== 'string' && typeof v[Symbol.iterator] === 'function';

    const addEA = (eIn, aIn, vIn) => {
      if (tupleAttrSet.has(aIn)) throw new Error('Cannot modify tuple attrs directly: ' + aIn);
      let e = eIn; let a = aIn; let v = vIn;
      // Enforce cardinality one: retract existing values for (e,a)
      if (getCard(a) === 'one') {
        for (const cur of idx.eavt.range({ e, a })) removes.push(cur);
      }
      // Handle uniqueness
      const uq = getUnique(a);
      if (uq) {
        const found = idx.avet.range({ a, v })[Symbol.iterator]().next().value;
        if (found && found.e !== e) {
          if (uq === 'identity') {
            e = found.e;
          } else {
            throw new Error('Unique constraint violation on ' + a);
          }
        }
      }
      adds.push(datom(e, a, v, txInst, true));
      if (compToTuple.has(a)) {
        if (!touched.has(e)) touched.set(e, new Set());
        const set = touched.get(e);
        for (const t of compToTuple.get(a)) set.add(t);
      }
      return e;
    };

    const isEntityMap = (v) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).some(k => typeof k === 'string' && k.startsWith(':'));

    const processMap = (obj, parentE = undefined, asReverseFor = undefined) => {
      // Returns entity id for this object
      const e0 = obj[":db/id"];
      let e;
      if (typeof e0 === 'number' && e0 < 0) e = materializeTempid(e0, tempids);
      else if (typeof e0 === 'number') e = e0;
      else if (Array.isArray(e0) && e0.length === 2 && isKeyword(e0[0])) {
        const resolved = resolveLookupOrIdent(e0);
        if (typeof resolved === 'number') e = resolved; else throw new Error('Lookup ref not found: ' + JSON.stringify(e0));
      } else if (typeof e0 === 'string' && e0.startsWith(':')) {
        const resolved = resolveLookupOrIdent(e0);
        if (typeof resolved === 'number') e = resolved; else e = this.allocateEid();
      }
      if (e === undefined) {
        // Upsert by unique identity from attributes if present
        for (const [ka, kv] of Object.entries(obj)) {
          if (ka === ':db/id') continue;
          if (typeof ka === 'string' && ka.startsWith(':_')) continue;
          if (getUnique(ka) === 'identity') {
            let candidates = [];
            if (Array.isArray(kv) && !(kv.length === 2 && isKeyword(kv[0]))) candidates = kv;
            else candidates = [kv];
            for (let val of candidates) {
              if (typeof val === 'number' && val < 0) val = materializeTempid(val, tempids);
              val = resolveLookupOrIdent(val);
              const found = idx.avet.range({ a: ka, v: val })[Symbol.iterator]().next().value;
              if (found) { e = found.e; break; }
            }
            if (e !== undefined) break;
          }
        }
      }
      if (e === undefined) e = this.allocateEid();

      for (const [ka, kv] of Object.entries(obj)) {
        if (ka === ':db/id') continue;
        // Reverse attribute handling
        if (typeof ka === 'string' && ka.startsWith(':_')) {
          const fa = forwardAttr(ka);
          if (getValueType(fa) !== 'ref') throw new Error(`Bad attribute ${ka}: reverse attribute name requires {:db/valueType :db.type/ref} in schema`);
          if (isIterable(kv) && !Array.isArray(kv)) {
            for (const item of kv) {
              let vv = item;
              if (typeof vv === 'number' && vv < 0) vv = materializeTempid(vv, tempids);
              vv = resolveLookupOrIdent(vv);
              if (isEntityMap(vv)) {
                vv = processMap(vv);
              }
              addEA(vv, fa, e);
            }
          } else if (Array.isArray(kv) && !(kv.length === 2 && isKeyword(kv[0]))) {
            for (let vi of kv) {
              if (typeof vi === 'number' && vi < 0) vi = materializeTempid(vi, tempids);
              vi = resolveLookupOrIdent(vi);
              if (isEntityMap(vi)) {
                vi = processMap(vi);
              }
              addEA(vi, fa, e);
            }
          } else {
            let vv = kv;
            if (typeof vv === 'number' && vv < 0) vv = materializeTempid(vv, tempids);
            vv = resolveLookupOrIdent(vv);
            if (isEntityMap(vv)) vv = processMap(vv);
            addEA(vv, fa, e);
          }
          continue;
        }
        // Forward attribute
        const a = ka;
        assertAttr(a);
        const vt = getValueType(a);
        if (isIterable(kv) && !Array.isArray(kv)) {
          for (const item of kv) {
            let vi = item;
            assertNotNil(vi);
            if (typeof vi === 'number' && vi < 0) vi = materializeTempid(vi, tempids);
            vi = resolveLookupOrIdent(vi);
            if (vt === 'ref' && isEntityMap(vi)) vi = processMap(vi);
            if (vt === 'ref' && typeof vi !== 'number') throw new Error('Expected number or lookup ref for ref value');
            e = addEA(e, a, vi);
          }
        } else if (Array.isArray(kv) && !(kv.length === 2 && isKeyword(kv[0]))) {
          for (let vi of kv) {
            assertNotNil(vi);
            if (typeof vi === 'number' && vi < 0) vi = materializeTempid(vi, tempids);
            vi = resolveLookupOrIdent(vi);
            if (vt === 'ref' && isEntityMap(vi)) vi = processMap(vi);
            if (vt === 'ref' && typeof vi !== 'number') throw new Error('Expected number or lookup ref for ref value');
            e = addEA(e, a, vi);
          }
        } else {
          let vv = kv;
          assertNotNil(vv);
          if (typeof vv === 'number' && vv < 0) vv = materializeTempid(vv, tempids);
          vv = resolveLookupOrIdent(vv);
          if (vt === 'ref' && isEntityMap(vv)) vv = processMap(vv);
          if (vt === 'ref' && typeof vv !== 'number') throw new Error('Expected number or lookup ref for ref value');
          e = addEA(e, a, vv);
        }
      }
      return e;
    };

    for (const op of txData) {
      if (isAdd(op)) {
        let e = resolveE(op[1], tempids);
        assertValidEidForAdd(op[1]);
        e = resolveLookupOrIdent(e);
        const a = op[2]; let v = op[3];
        assertAttr(a);
        assertNotNil(v);
        if (tupleAttrSet.has(a)) throw new Error('Cannot modify tuple attrs directly: ' + a);
        if (typeof v === 'number' && v < 0) v = materializeTempid(v, tempids);
        v = resolveLookupOrIdent(v);
        // valueType checks
        const vt = getValueType(a);
        if (vt === 'ref') {
          if (isEntityMap(v)) v = processMap(v);
          if (typeof v !== 'number') throw new Error('Expected number or lookup ref for ref value');
        }
        e = addEA(e, a, v);
      } else if (isRetract(op)) {
        assertValidEidForRetract(op[1]);
        let e = resolveE(op[1], tempids);
        e = resolveLookupOrIdent(e);
        const a = op[2]; let v = op[3];
        assertAttr(a);
        if (tupleAttrSet.has(a)) throw new Error('Cannot modify tuple attrs directly: ' + a);
        v = resolveLookupOrIdent(v);
        for (const cur of idx.eavt.range({ e, a, v })) removes.push(cur);
        if (compToTuple.has(a)) {
          if (!touched.has(e)) touched.set(e, new Set());
          const set = touched.get(e);
          for (const t of compToTuple.get(a)) set.add(t);
        }
      } else if (isMapTx(op)) {
        // Upsert by unique identity from attributes if possible handled inside processMap by addEA uniqueness hits
        processMap(op);
      } else {
        throw new Error('Unknown tx op');
      }
    }
    if (removes.length) idx = idx.removeMany(removes);
    if (adds.length) idx = idx.addMany(adds);

    // Recompute tuple attributes for touched entities
    if (touched.size) {
      const tupleAdds = [];
      const tupleRemoves = [];
      const equals = (a, b) => {
        if (a === b) return true;
        if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
        if (Array.isArray(a) && Array.isArray(b)) {
          if (a.length !== b.length) return false;
          for (let i = 0; i < a.length; i++) if (!equals(a[i], b[i])) return false;
          return true;
        }
        return false;
      };
      for (const [e, tset] of touched.entries()) {
        for (const t of tset.values()) {
          const spec = this.schema[t];
          const comps = spec.tupleAttrs || [];
          const vals = comps.map(ca => {
            const it = idx.eavt.range({ e, a: ca })[Symbol.iterator]();
            const d = it.next().value;
            return d ? d.v : null;
          });
          const allMissing = vals.every(v => v === null || v === undefined);
          const itOld = idx.eavt.range({ e, a: t })[Symbol.iterator]();
          const old = itOld.next().value; // existing tuple datom if any
          if (allMissing) {
            if (old) tupleRemoves.push(old);
          } else {
            // uniqueness on tuple
            const uq = getUnique(t);
            const existing = idx.avet.range({ a: t, v: vals })[Symbol.iterator]().next().value;
            if (existing && existing.e !== e) {
              if (uq === 'identity') {
                // For now, treat as violation – explicit upsert onto tuple not supported
                throw new Error('Unique identity conflict on tuple ' + t);
              } else if (uq === 'value') {
                throw new Error('Unique constraint violation on ' + t);
              }
            }
            if (!old || !equals(old.v, vals)) {
              if (old) tupleRemoves.push(old);
              tupleAdds.push(datom(e, t, vals, txInst, true));
            }
          }
        }
      }
      if (tupleRemoves.length) idx = idx.removeMany(tupleRemoves);
      if (tupleAdds.length) idx = idx.addMany(tupleAdds);
    }
    const db = new DB(this.schema, idx);
    
    // Create actual datoms for transaction report (like Clojure DataScript)
    const actualTxData = [...adds, ...removes.map(d => ({...d, added: false}))];
    
    return { db, tempids, tx: txInst, txData: actualTxData };
  }

  allocateEid() { return nextEid++; }

  // No clone that mutates; DB is immutable
}

// Tx helpers and type guards
function isAdd(x) { return Array.isArray(x) && x[0] === '+'; }
function isRetract(x) { return Array.isArray(x) && x[0] === '-'; }
function isMapTx(x) { return !Array.isArray(x) && typeof x === 'object'; }

function resolveE(e, tempids) {
  if (typeof e === 'number' && e < 0) return materializeTempid(e, tempids);
  return e;
}

function materializeTempid(tmp, tempids) {
  if (!tempids.has(tmp)) tempids.set(tmp, nextEid++);
  return tempids.get(tmp);
}

// Internal counters accessors for persistence
export function __getCounters() { return { nextEid, nextTx }; }
export function __setCounters({ nextEid: e, nextTx: t } = {}) {
  if (typeof e === 'number' && e > 0) nextEid = e;
  if (typeof t === 'number' && t > 0) nextTx = t;
}

// Retract entity with cascading over component attributes
export function retractEntity(db, rootSpec) {
  // Resolve rootSpec as number | ident | lookup-ref
  const resolve = (spec) => {
    if (typeof spec === 'number') return spec;
    if (typeof spec === 'string' && spec.startsWith(':')) {
      const d = db.idx.avet.range({ a: ':db/ident', v: spec })[Symbol.iterator]().next().value;
      return d ? d.e : undefined;
    }
    if (Array.isArray(spec) && spec.length === 2 && typeof spec[0] === 'string' && spec[0].startsWith(':')) {
      const d = db.idx.avet.range({ a: spec[0], v: spec[1] })[Symbol.iterator]().next().value;
      return d ? d.e : undefined;
    }
    return spec;
  };
  const root = resolve(rootSpec);
  if (typeof root !== 'number') return db;
  const toVisit = [root];
  const visited = new Set();
  const removes = [];
  while (toVisit.length) {
    const e = toVisit.pop();
    if (visited.has(e)) continue;
    visited.add(e);
    for (const d of db.datoms('eavt', e)) {
      removes.push(d);
      const isComp = db.schema[d.a]?.component === true;
      if (isComp && typeof d.v === 'number') {
        toVisit.push(d.v);
      }
    }
  }
  const newIdx = removes.length ? db.idx.removeMany(removes) : db.idx;
  return new DB(db.schema, newIdx);
}
