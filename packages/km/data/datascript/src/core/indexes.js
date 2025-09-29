import { datomComparator } from './datom.js';

export class Index {
  constructor(name, data = [], cmp = comparators[name]) {
    this.name = name;
    this.data = Object.freeze(data.slice());
    this.cmp = cmp;
    Object.freeze(this);
  }
  size() { return this.data.length; }
  has(d) {
    const i = this.#findInsertionIndex(d);
    const x = this.data[i];
    return !!(x && this.cmp(x, d) === 0);
  }
  add(d) {
    const i = this.#findInsertionIndex(d);
    if (this.data[i] && this.cmp(this.data[i], d) === 0) return this; // dedupe
    const newData = this.data.slice();
    newData.splice(i, 0, d);
    return new Index(this.name, newData, this.cmp);
  }
  remove(d) {
    const i = this.#findInsertionIndex(d);
    if (this.data[i] && this.cmp(this.data[i], d) === 0) {
      const newData = this.data.slice(0, i).concat(this.data.slice(i + 1));
      return new Index(this.name, newData, this.cmp);
    }
    return this;
  }
  addMany(datoms) {
    if (!datoms || datoms.length === 0) return this;
    // Sort and unique additions
    const adds = datoms.slice().sort(this.cmp);
    let i = 0;
    const uniqAdds = [];
    while (i < adds.length) {
      const a = adds[i++];
      while (i < adds.length && this.cmp(adds[i], a) === 0) i++;
      uniqAdds.push(a);
    }
    // Merge existing and additions
    const out = [];
    let p = 0, q = 0;
    while (p < this.data.length && q < uniqAdds.length) {
      const cmp = this.cmp(this.data[p], uniqAdds[q]);
      if (cmp < 0) { out.push(this.data[p++]); }
      else if (cmp > 0) { out.push(uniqAdds[q++]); }
      else { out.push(this.data[p]); p++; q++; }
    }
    while (p < this.data.length) out.push(this.data[p++]);
    while (q < uniqAdds.length) out.push(uniqAdds[q++]);
    return new Index(this.name, out, this.cmp);
  }
  removeMany(datoms) {
    if (!datoms || datoms.length === 0) return this;
    const rems = datoms.slice().sort(this.cmp);
    const out = [];
    let p = 0, q = 0;
    while (p < this.data.length && q < rems.length) {
      const cmp = this.cmp(this.data[p], rems[q]);
      if (cmp < 0) { out.push(this.data[p++]); }
      else if (cmp > 0) { q++; }
      else { p++; q++; }
    }
    while (p < this.data.length) out.push(this.data[p++]);
    return new Index(this.name, out, this.cmp);
  }
  #findInsertionIndex(d) {
    let lo = 0, hi = this.data.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const c = this.cmp(this.data[mid], d);
      if (c < 0) lo = mid + 1; else hi = mid;
    }
    return lo;
  }
  range(prefix) {
    const sample = { e: -Infinity, a: '', v: -Infinity, tx: -Infinity, added: false, ...prefix };
    const start = this.#findInsertionIndex(sample);
    const order = ORDER[this.name];
    const prefixLen = Object.keys(prefix).length;
    const self = this;
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
    return {
      [Symbol.iterator]() {
        let i = start;
        return {
          next() {
            if (i >= self.data.length) return { done: true, value: undefined };
            const d = self.data[i++];
            for (let k = 0; k < order.length && k < prefixLen; k++) {
              const key = order[k];
              if (prefix[key] !== undefined && !equals(d[key], prefix[key])) {
                return { done: true, value: undefined };
              }
            }
            return { done: false, value: d };
          }
        };
      }
    };
  }
  all() { return this.data.slice(); }
}

const ORDER = {
  eavt: ['e','a','v','tx','added'],
  aevt: ['a','e','v','tx','added'],
  avet: ['a','v','e','tx','added'],
  vaet: ['v','a','e','tx','added'],
};

const comparators = {
  eavt: datomComparator(ORDER.eavt),
  aevt: datomComparator(ORDER.aevt),
  avet: datomComparator(ORDER.avet),
  vaet: datomComparator(ORDER.vaet),
};

export class Indexes {
  constructor(eavt = new Index('eavt'), aevt = new Index('aevt'), avet = new Index('avet'), vaet = new Index('vaet')) {
    this.eavt = eavt;
    this.aevt = aevt;
    this.avet = avet;
    this.vaet = vaet;
    Object.freeze(this);
  }
  add(d) {
    return new Indexes(this.eavt.add(d), this.aevt.add(d), this.avet.add(d), this.vaet.add(d));
  }
  remove(d) {
    return new Indexes(this.eavt.remove(d), this.aevt.remove(d), this.avet.remove(d), this.vaet.remove(d));
  }
  addMany(datoms) {
    return new Indexes(
      this.eavt.addMany(datoms),
      this.aevt.addMany(datoms),
      this.avet.addMany(datoms),
      this.vaet.addMany(datoms)
    );
  }
  removeMany(datoms) {
    return new Indexes(
      this.eavt.removeMany(datoms),
      this.aevt.removeMany(datoms),
      this.avet.removeMany(datoms),
      this.vaet.removeMany(datoms)
    );
  }
}
