// Datom helpers

export function datom(e, a, v, tx, added) {
  const d = { e, a, v, tx, added };
  return Object.freeze(d);
}

function cmpVal(a, b) {
  if (a === b) return 0;
  // Dates
  if (a instanceof Date && b instanceof Date) {
    const ta = a.getTime(); const tb = b.getTime();
    return ta === tb ? 0 : (ta < tb ? -1 : 1);
  }
  // Arrays (tuples) — lexicographic
  if (Array.isArray(a) && Array.isArray(b)) {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const c = cmpVal(a[i], b[i]);
      if (c !== 0) return c;
    }
    return a.length === b.length ? 0 : (a.length < b.length ? -1 : 1);
  }
  // Keywords (':ns/name') — compare namespace then name for stability
  if (typeof a === 'string' && typeof b === 'string' && a.startsWith(':') && b.startsWith(':')) {
    const [na, la] = a.slice(1).split('/')
      .concat('');
    const [nb, lb] = b.slice(1).split('/')
      .concat('');
    if (na < nb) return -1; if (na > nb) return 1;
    if (la < lb) return -1; if (la > lb) return 1;
    return 0;
  }
  // Fallback
  return a < b ? -1 : 1;
}

// Compare two datoms by a tuple of keys
export function datomComparator(order) {
  return (d1, d2) => {
    for (const k of order) {
      const v1 = d1[k];
      const v2 = d2[k];
      if (v1 === v2) continue;
      return cmpVal(v1, v2);
    }
    return 0;
  };
}
