// Simple immutable LRU cache structure and a memoizing cache helper

export class LRU {
  constructor(capacity, map = new Map(), order = []) {
    this.capacity = capacity;
    this.map = map; // Map<key, value>
    this.order = order; // array of keys from oldest -> newest
    Object.freeze(this);
  }
}

export function lru(capacity) {
  return new LRU(capacity);
}

export function lruGet(l, k) {
  return l.map.get(k);
}

export function lruAssoc(l, k, v) {
  const map = new Map(l.map);
  const order = l.order.slice();
  if (map.has(k)) {
    map.set(k, map.get(k)); // do not change value (matches CLJ test expectation)
    // Move key to newest position
    const idx = order.indexOf(k);
    if (idx >= 0) order.splice(idx, 1);
    order.push(k);
  } else {
    map.set(k, v);
    order.push(k);
    if (order.length > l.capacity) {
      const evict = order.shift();
      map.delete(evict);
    }
  }
  return new LRU(l.capacity, map, order);
}

// Memoizing cache with LRU eviction
export function cache(capacity) {
  return { lru: lru(capacity), store: new Map() };
}

export function _get(cacheObj, key, computeFn) {
  if (cacheObj.store.has(key)) {
    // touch in LRU
    cacheObj.lru = lruAssoc(cacheObj.lru, key, cacheObj.store.get(key));
    return cacheObj.store.get(key);
  }
  // compute
  const val = computeFn();
  // Insert and evict if needed
  const before = cacheObj.lru;
  cacheObj.lru = lruAssoc(cacheObj.lru, key, val);
  cacheObj.store.set(key, val);
  // Detect evicted keys by comparing order sets
  const prev = new Set(before.order);
  const now = new Set(cacheObj.lru.order);
  for (const k of prev) {
    if (!now.has(k)) { cacheObj.store.delete(k); }
  }
  return val;
}
