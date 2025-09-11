// Pull implementation supporting:
// - flat attributes: ':a'
// - nested refs: { ':friend': [ ...subpattern ] }
// - reverse refs: { ':ns/_attr': [ ...subpattern ] } or { ':_attr': [ ... ] }
// - wildcard '*': include all attributes (shallow)
export function pull(db, pattern, eidSpec, opts = {}) {
  const eid = resolveEid(db, eidSpec);
  const ent = db.entity(eid);
  if (!ent) return null;

  const out = { id: ent.id };

  function isReverse(attr) {
    return typeof attr === 'string' && (attr.startsWith(':_') || attr.includes('/_'));
  }
  function forwardAttr(attr) {
    if (attr.startsWith(':_')) return ':' + attr.slice(2);
    if (attr.includes('/_')) return attr.replace('/_', '/');
    return attr;
  }
  function isKeyword(x) { return typeof x === 'string' && x.startsWith(':'); }
  function isEid(x) { return typeof x === 'number' && Number.isFinite(x); }
  function resolveEid(db, spec) {
    if (typeof spec === 'number') return spec;
    if (typeof spec === 'string' && spec.startsWith(':')) {
      const d = db.datoms('avet', ':db/ident', spec)[0];
      return d ? d.e : null;
    }
    if (Array.isArray(spec) && spec.length === 2) {
      const [a, v] = spec;
      const d = db.datoms('avet', a, v)[0];
      return d ? d.e : null;
    }
    return spec;
  }
  function maybePullRef(val, subpat, seen, attr) {
    if (!subpat) return val;
    if (subpat === '...') {
      // Recurse along same attribute indefinitely, include all attributes at each level, avoid cycles
      const nextSeen = new Set(seen || []);
      const rec = (id) => {
        if (!isEid(id) || nextSeen.has(id)) return id;
        nextSeen.add(id);
        const base = pull(db, ['*', { [attr]: '...' }], id, opts);
        return base;
      };
      if (Array.isArray(val)) return val.map(v => rec(v));
      return rec(val);
    }
    if (typeof subpat === 'number') {
      const depth = subpat;
      const recN = (id, n) => {
        if (!isEid(id) || n <= 0) return id;
        const child = { id };
        const childVals = [];
        for (const d of db.datoms('eavt', id, attr)) childVals.push(d.v);
        if (childVals.length) {
          const card = db.schema[attr]?.card || 'one';
          const nested = card === 'many' ? childVals.map(v => recN(v, n - 1)) : recN(childVals[0], n - 1);
          child[attr] = nested;
        }
        return child;
      };
      if (Array.isArray(val)) return val.map(v => recN(v, depth));
      return recN(val, depth);
    }
    if (Array.isArray(val)) return val.map(v => (isEid(v) ? pull(db, subpat, v) : v));
    return isEid(val) ? pull(db, subpat, val) : val;
  }

  const includeAll = pattern && pattern.includes('*');

  function visit(type, e, a, v) {
    if (opts && typeof opts.visitor === 'function') opts.visitor(type, e, a, v);
  }

  function collectAttr(attr, subpat) {
    visit(':db.pull/attr', eid, attr, null);
    if (isReverse(attr)) {
      const fwd = forwardAttr(attr);
      const vals = [];
      for (const d of db.datoms('avet', fwd, eid)) vals.push(d.e);
      const isComp = db.schema[fwd]?.component === true;
      let res;
      if (!subpat) {
        res = vals;
      } else if (subpat === '...') {
        const pat = [ '*', { [attr]: '...' } ];
        res = vals.map(e => pull(db, pat, e, opts));
      } else if (typeof subpat === 'number') {
        const dleft = subpat - 1;
        const pat = dleft > 0 ? [ '*', { [attr]: dleft } ] : ['*'];
        res = vals.map(e => (pat.length ? pull(db, pat, e, opts) : ({ id: e })));
      } else if (typeof subpat === 'object' && subpat.__pullLimit !== undefined) {
        const lim = subpat.__pullLimit;
        const eff = (lim === null ? Infinity : lim);
        const v2 = vals.slice(0, eff);
        const sub = subpat.__pullSub;
        res = sub ? v2.map(e => pull(db, sub, e, opts)) : v2;
      } else {
        res = vals.map(e => pull(db, subpat, e, opts));
      }
      out[attr] = isComp ? (res[0] ?? null) : res;
      visit(':db.pull/reverse', null, fwd, eid);
      return;
    }
    // forward
    const vals = [];
    for (const d of db.datoms('eavt', eid, attr)) vals.push(d.v);
    if (subpat == null && vals.length > 1000) vals.length = 1000;
    if (vals.length === 0) return;
    const cardMany = (db.schema[attr]?.card === 'many') || (vals.length > 1);
    // Deduplicate values for many-cardinality attributes to handle duplicate datoms
    const val = cardMany ? [...new Set(vals)] : vals[0];
    const effectiveSub = (subpat && subpat.__pullSub !== undefined) ? subpat.__pullSub : (subpat ?? (db.schema[attr]?.component ? '...' : null));
    if (subpat && subpat.__pullLimit !== undefined && Array.isArray(val)) {
      const lim = subpat.__pullLimit;
      const eff = (lim === null ? Infinity : lim);
      const v2 = val.slice(0, eff);
      out[attr] = maybePullRef(v2, effectiveSub, new Set([eid]), attr);
    } else {
      out[attr] = maybePullRef(val, effectiveSub, new Set([eid]), attr);
    }
  }

  for (const p of pattern) {
    if (p === ':db/id' || p === 'db/id') { out['id'] = ent.id; continue; }
    if (p === '*') {
      visit(':db.pull/wildcard', eid, null, null);
      for (const d of db.datoms('eavt', eid)) {
        if (d.a === ':db/id') continue;
        if (out[d.a] === undefined) collectAttr(d.a, null);
      }
      continue;
    }
    if (Array.isArray(p) && isKeyword(p[0])) {
      const attr = p[0];
      let alias = attr;
      let limit = undefined;
      let defv;
      let xform;
      for (let i = 1; i < p.length; i += 2) {
        const k = p[i]; const v = p[i + 1];
        if (k === ':as') alias = v;
        else if (k === ':limit') limit = v;
        else if (k === ':default') defv = v;
        else if (k === ':xform') xform = v;
      }
      // collect with limit
      const vals = [];
      const isManySchema = db.schema[attr]?.card === 'many';
      const effLimit = (limit === null ? Infinity : (limit ?? 1000));
      if (isReverse(attr)) {
        const fwd = forwardAttr(attr);
        for (const d of db.datoms('avet', fwd, eid)) { vals.push(d.e); if (vals.length >= effLimit) break; }
        const isComp = db.schema[fwd]?.component === true;
        if (vals.length === 0 && defv !== undefined) out[alias] = defv;
        else {
          let v = isComp ? (vals[0] ?? null) : vals;
          if (xform && defv === undefined) v = xform(v);
          out[alias] = v;
        }
        visit(':db.pull/reverse', null, fwd, eid);
      } else {
        for (const d of db.datoms('eavt', eid, attr)) { vals.push(d.v); if (vals.length >= effLimit) break; }
        if (vals.length === 0 && defv !== undefined) out[alias] = defv;
        else {
          const many = isManySchema || vals.length > 1;
          let v = many ? vals : vals[0];
          if (xform && defv === undefined) v = xform(v);
          out[alias] = v;
        }
      }
    } else if (isKeyword(p)) {
      collectAttr(p, null);
    } else if (p && typeof p === 'object' && !Array.isArray(p)) {
      for (const [k, sub] of Object.entries(p)) {
        collectAttr(k, sub);
      }
    }
  }
  return Object.freeze(out);
}
