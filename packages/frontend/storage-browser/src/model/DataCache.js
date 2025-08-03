/**
 * Data Cache
 * Client-side caching with TTL and invalidation
 */

export class DataCache {
  constructor(options = {}) {
    this.options = {
      maxSize: 100,
      defaultTTL: 300000, // 5 minutes
      ...options
    };

    this.cache = new Map();
    this.timers = new Map();
  }

  set(key, value, ttl = this.options.defaultTTL) {
    // Clear existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Enforce size limit
    if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.delete(firstKey);
    }

    // Store value
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });

    // Set expiration timer
    if (ttl > 0) {
      const timer = setTimeout(() => {
        this.delete(key);
      }, ttl);
      this.timers.set(key, timer);
    }
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (entry.ttl > 0 && Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      return null;
    }

    return entry.value;
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    return this.cache.delete(key);
  }

  clear() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.cache.clear();
  }

  invalidatePattern(pattern) {
    const regex = new RegExp(pattern);
    const keysToDelete = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.delete(key));
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      keys: Array.from(this.cache.keys())
    };
  }

  // Collection-specific cache methods
  cacheCollection(collection, data) {
    this.set(`collections:${collection}`, data);
  }

  getCachedCollection(collection) {
    return this.get(`collections:${collection}`);
  }

  cacheQuery(collection, query, results) {
    const queryKey = this.getQueryKey(collection, query);
    this.set(`query:${queryKey}`, results);
  }

  getCachedQuery(collection, query) {
    const queryKey = this.getQueryKey(collection, query);
    return this.get(`query:${queryKey}`);
  }

  invalidateCollection(collection) {
    this.invalidatePattern(`^(collections|query):${collection}`);
  }

  getQueryKey(collection, query) {
    const normalized = this.normalizeQuery(query);
    return `${collection}:${JSON.stringify(normalized)}`;
  }

  normalizeQuery(query) {
    if (typeof query !== 'object' || query === null) {
      return query;
    }

    const normalized = {};
    const keys = Object.keys(query).sort();
    
    for (const key of keys) {
      normalized[key] = this.normalizeQuery(query[key]);
    }

    return normalized;
  }
}