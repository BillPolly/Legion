// Filtered DB view: wraps a DB and only exposes datoms matching predicate
export function filteredDB(db, predicate) {
  const view = {
    schema: db.schema,
    datoms(index, ...components) {
      const all = db.datoms(index, ...components);
      return all.filter(d => predicate(d));
    },
    entity(e) {
      // Reconstruct entity from filtered datoms
      const attrs = new Map();
      for (const d of this.datoms('eavt', e)) {
        const card = db.schema[d.a]?.card || 'one';
        if (card === 'many') {
          if (!attrs.has(d.a)) attrs.set(d.a, new Set());
          attrs.get(d.a).add(d.v);
        } else {
          attrs.set(d.a, d.v);
        }
      }
      if (attrs.size === 0) return null;
      const obj = { id: e };
      for (const [k, v] of attrs) obj[k] = (v instanceof Set) ? Object.freeze(Array.from(v)) : v;
      return Object.freeze(obj);
    }
  };
  return view;
}

