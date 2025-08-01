/**
 * IntelligentCache - Advanced caching system with predictive prefetching
 * 
 * Extends MemoryManager with intelligent caching strategies, predictive prefetching,
 * adaptive algorithms, and context-aware cache management for optimal performance.
 */

export class IntelligentCache {
  constructor(options = {}) {
    this.options = {
      maxCacheSize: 1000,
      predictivePrefetch: true,
      adaptiveEviction: true,
      contextAware: true,
      prefetchDistance: 3, // Prefetch nodes within 3 levels
      accessPatternWindow: 100, // Track last 100 accesses
      preloadThreshold: 0.7, // Preload when confidence > 70%
      thermalThrottling: true,
      compressionEnabled: true,
      ...options
    };

    this.destroyed = false;
    
    // Cache storage
    this.cache = new Map();
    this.renderCache = new Map();
    this.searchCache = new Map();
    this.prefetchCache = new Map();
    
    // Access patterns
    this.accessLog = [];
    this.accessFrequency = new Map();
    this.sequentialPatterns = new Map();
    this.contextPatterns = new Map();
    
    // Predictive models
    this.models = {
      sequential: new SequentialPredictor(),
      frequency: new FrequencyPredictor(),
      context: new ContextPredictor(),
      ml: new SimpleMLPredictor()
    };
    
    // Performance metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      prefetchHits: 0,
      prefetchMisses: 0,
      evictions: 0,
      compressionRatio: 1.0,
      predictions: 0,
      predictionAccuracy: 0
    };
    
    // Thermal management
    this.thermal = {
      temperature: 0,
      throttling: false,
      coolingRate: 0.95,
      heatingRate: 1.05
    };
    
    // Background tasks
    this.backgroundTasks = {
      prefetch: null,
      cleanup: null,
      optimization: null
    };
    
    // Initialize systems
    this._initializeBackgroundTasks();
  }

  /**
   * Get item with intelligent prefetching
   */
  async get(key, context = {}) {
    if (this.destroyed) return null;
    
    const startTime = performance.now();
    
    // Record access pattern
    this._recordAccess(key, context);
    
    // Check main cache
    let item = this.cache.get(key);
    if (item && !this._isExpired(item)) {
      this.metrics.hits++;
      item.lastAccess = Date.now();
      item.accessCount++;
      
      // Trigger predictive prefetching
      this._triggerPrefetch(key, context);
      
      return this._decompress(item.value);
    }
    
    // Check prefetch cache
    item = this.prefetchCache.get(key);
    if (item && !this._isExpired(item)) {
      this.metrics.prefetchHits++;
      
      // Promote to main cache
      this._promoteFromPrefetch(key, item);
      
      return this._decompress(item.value);
    }
    
    this.metrics.misses++;
    return null;
  }

  /**
   * Store item with compression and intelligence
   */
  async store(key, value, options = {}) {
    if (this.destroyed) return;
    
    const startTime = performance.now();
    
    // Compress if enabled
    const compressedValue = this._compress(value);
    const compressionSaved = this._calculateCompressionRatio(value, compressedValue);
    
    // Create cache entry
    const entry = {
      value: compressedValue,
      originalSize: this._estimateSize(value),
      compressedSize: this._estimateSize(compressedValue),
      created: Date.now(),
      lastAccess: Date.now(),
      accessCount: 1,
      priority: this._calculatePriority(key, value, options),
      metadata: options.metadata || {},
      ttl: options.ttl || 300000, // 5 minutes default
      compressed: compressedValue !== value
    };
    
    // Check if eviction needed
    if (this.cache.size >= this.options.maxCacheSize) {
      await this._intelligentEviction();
    }
    
    this.cache.set(key, entry);
    
    // Update metrics
    if (compressionSaved > 0) {
      this.metrics.compressionRatio = (this.metrics.compressionRatio + compressionSaved) / 2;
    }
    
    // Update predictive models
    this._updateModels(key, value, options);
    
    // Trigger related prefetching
    this._triggerRelatedPrefetch(key, value);
  }

  /**
   * Prefetch items based on predictions
   */
  async prefetch(keys, context = {}) {
    if (this.destroyed || this.thermal.throttling) return;
    
    const prefetchPromises = keys.map(async (key) => {
      if (this.cache.has(key) || this.prefetchCache.has(key)) {
        return; // Already cached
      }
      
      // Try to predict/fetch the value
      const predicted = await this._predictValue(key, context);
      if (predicted) {
        const entry = {
          value: this._compress(predicted),
          created: Date.now(),
          lastAccess: Date.now(),
          accessCount: 0,
          prefetched: true,
          confidence: predicted.confidence || 0.5
        };
        
        this.prefetchCache.set(key, entry);
      }
    });
    
    await Promise.all(prefetchPromises);
  }

  /**
   * Smart search with caching
   */
  async search(query, searchFunction, options = {}) {
    const cacheKey = this._generateSearchKey(query, options);
    
    // Check search cache
    const cached = this.searchCache.get(cacheKey);
    if (cached && !this._isExpired(cached)) {
      this.metrics.hits++;
      return cached.value;
    }
    
    // Perform search
    const results = await searchFunction(query, options);
    
    // Cache results
    this.searchCache.set(cacheKey, {
      value: results,
      created: Date.now(),
      query,
      options
    });
    
    // Prefetch related results
    this._prefetchRelatedSearches(query, results);
    
    return results;
  }

  /**
   * Get cache analytics and insights
   */
  getAnalytics() {
    const totalAccesses = this.metrics.hits + this.metrics.misses;
    const hitRate = totalAccesses > 0 ? this.metrics.hits / totalAccesses : 0;
    
    return {
      performance: {
        hitRate,
        prefetchEffectiveness: this._calculatePrefetchEffectiveness(),
        compressionRatio: this.metrics.compressionRatio,
        predictionAccuracy: this.metrics.predictionAccuracy
      },
      usage: {
        cacheSize: this.cache.size,
        prefetchCacheSize: this.prefetchCache.size,
        searchCacheSize: this.searchCache.size,
        memoryUsage: this._calculateMemoryUsage()
      },
      patterns: {
        topAccessedItems: this._getTopAccessedItems(),
        sequentialPatterns: this._analyzeSequentialPatterns(),
        contextualPatterns: this._analyzeContextualPatterns()
      },
      predictions: {
        totalPredictions: this.metrics.predictions,
        accuracy: this.metrics.predictionAccuracy,
        models: this._getModelPerformance()
      },
      thermal: {
        temperature: this.thermal.temperature,
        throttling: this.thermal.throttling
      }
    };
  }

  /**
   * Optimize cache based on usage patterns
   */
  async optimize() {
    if (this.destroyed) return;
    
    // Analyze access patterns
    const patterns = this._analyzeAccessPatterns();
    
    // Adjust cache sizes based on usage
    this._adjustCacheSizes(patterns);
    
    // Update predictive models
    this._trainModels(patterns);
    
    // Cleanup expired and low-value items
    await this._intelligentCleanup();
    
    // Optimize compression strategies
    this._optimizeCompression();
    
    // Cool down thermal system
    this._updateThermalState(false);
  }

  /**
   * Record access for pattern analysis
   * @private
   */
  _recordAccess(key, context) {
    const access = {
      key,
      timestamp: Date.now(),
      context: { ...context }
    };
    
    this.accessLog.push(access);
    
    // Trim access log
    if (this.accessLog.length > this.options.accessPatternWindow) {
      this.accessLog = this.accessLog.slice(-this.options.accessPatternWindow);
    }
    
    // Update frequency map
    this.accessFrequency.set(key, (this.accessFrequency.get(key) || 0) + 1);
    
    // Update thermal state
    this._updateThermalState(true);
  }

  /**
   * Trigger predictive prefetching
   * @private
   */
  async _triggerPrefetch(key, context) {
    if (!this.options.predictivePrefetch || this.thermal.throttling) return;
    
    // Get predictions from all models
    const predictions = await Promise.all([
      this.models.sequential.predict(key, this.accessLog),
      this.models.frequency.predict(key, this.accessFrequency),
      this.models.context.predict(key, context, this.contextPatterns),
      this.models.ml.predict(key, this._extractFeatures(key, context))
    ]);
    
    // Combine predictions
    const combinedPredictions = this._combinePredictions(predictions);
    
    // Filter high-confidence predictions
    const highConfidence = combinedPredictions.filter(p => 
      p.confidence > this.options.preloadThreshold
    );
    
    if (highConfidence.length > 0) {
      const keys = highConfidence.map(p => p.key);
      await this.prefetch(keys, context);
      
      this.metrics.predictions += keys.length;
    }
  }

  /**
   * Intelligent eviction using multiple strategies
   * @private
   */
  async _intelligentEviction() {
    const candidates = Array.from(this.cache.entries());
    
    // Score each candidate for eviction
    const scored = candidates.map(([key, entry]) => ({
      key,
      entry,
      score: this._calculateEvictionScore(key, entry)
    }));
    
    // Sort by eviction score (higher = more likely to evict)
    scored.sort((a, b) => b.score - a.score);
    
    // Evict items until under threshold
    const targetSize = Math.floor(this.options.maxCacheSize * 0.9);
    while (this.cache.size > targetSize && scored.length > 0) {
      const candidate = scored.shift();
      this.cache.delete(candidate.key);
      this.metrics.evictions++;
    }
  }

  /**
   * Calculate eviction score
   * @private
   */
  _calculateEvictionScore(key, entry) {
    const now = Date.now();
    const age = now - entry.created;
    const timeSinceAccess = now - entry.lastAccess;
    const frequency = this.accessFrequency.get(key) || 1;
    
    // Higher score = more likely to evict
    let score = 0;
    
    // Age factor (older items more likely to evict)
    score += age / 300000; // Normalize by 5 minutes
    
    // Recency factor (recently accessed less likely to evict)
    score += timeSinceAccess / 60000; // Normalize by 1 minute
    
    // Frequency factor (frequently accessed less likely to evict)
    score -= Math.log(frequency + 1);
    
    // Priority factor
    score -= (entry.priority || 1);
    
    // Size factor (larger items more likely to evict if not frequently used)
    const sizeRatio = entry.compressedSize / (1024 * 1024); // MB
    if (frequency < 5) {
      score += sizeRatio;
    }
    
    return score;
  }

  /**
   * Calculate priority for new items
   * @private
   */
  _calculatePriority(key, value, options) {
    let priority = options.priority || 1;
    
    // Increase priority for frequently accessed items
    const frequency = this.accessFrequency.get(key) || 0;
    priority += Math.log(frequency + 1) * 0.5;
    
    // Increase priority for items with metadata indicating importance
    if (options.metadata?.important) {
      priority += 2;
    }
    
    // Decrease priority for large items unless frequently accessed
    const size = this._estimateSize(value);
    if (size > 1024 * 1024 && frequency < 10) { // 1MB threshold
      priority -= 1;
    }
    
    return Math.max(0.1, priority);
  }

  /**
   * Compress value if beneficial
   * @private
   */
  _compress(value) {
    if (!this.options.compressionEnabled) return value;
    
    // Only compress strings and objects
    if (typeof value !== 'string' && typeof value !== 'object') {
      return value;
    }
    
    try {
      // Simple compression using JSON + deflate-like approach
      const jsonString = typeof value === 'string' ? value : JSON.stringify(value);
      
      // Only compress if it's worth it (>1KB)
      if (jsonString.length < 1024) {
        return value;
      }
      
      // Basic compression: remove whitespace and use shorter keys
      const compressed = this._basicCompress(jsonString);
      
      // Return compressed if it saves significant space
      if (compressed.length < jsonString.length * 0.8) {
        return {
          __compressed: true,
          data: compressed,
          originalType: typeof value
        };
      }
    } catch (error) {
      // Compression failed, return original
    }
    
    return value;
  }

  /**
   * Decompress value if needed
   * @private
   */
  _decompress(value) {
    if (!value || typeof value !== 'object' || !value.__compressed) {
      return value;
    }
    
    try {
      const decompressed = this._basicDecompress(value.data);
      
      if (value.originalType === 'string') {
        return decompressed;
      } else {
        return JSON.parse(decompressed);
      }
    } catch (error) {
      console.warn('Decompression failed:', error);
      return null;
    }
  }

  /**
   * Basic compression implementation
   * @private
   */
  _basicCompress(str) {
    // Simple run-length encoding + dictionary compression
    const dictionary = new Map();
    let dictId = 0;
    
    // Build dictionary of common patterns
    const patterns = str.match(/\b\w{3,}\b/g) || [];
    const freq = {};
    patterns.forEach(p => freq[p] = (freq[p] || 0) + 1);
    
    // Use dictionary for frequent patterns
    Object.entries(freq)
      .filter(([_, count]) => count > 2)
      .forEach(([pattern, _]) => {
        dictionary.set(pattern, `~${dictId++}~`);
      });
    
    // Replace patterns
    let compressed = str;
    dictionary.forEach((replacement, pattern) => {
      compressed = compressed.split(pattern).join(replacement);
    });
    
    return JSON.stringify({
      data: compressed,
      dict: Array.from(dictionary.entries())
    });
  }

  /**
   * Basic decompression implementation
   * @private
   */
  _basicDecompress(compressedStr) {
    const parsed = JSON.parse(compressedStr);
    let decompressed = parsed.data;
    
    // Restore dictionary patterns
    parsed.dict.forEach(([pattern, replacement]) => {
      decompressed = decompressed.split(replacement).join(pattern);
    });
    
    return decompressed;
  }

  /**
   * Update thermal state
   * @private
   */
  _updateThermalState(activity) {
    if (activity) {
      this.thermal.temperature = Math.min(100, this.thermal.temperature * this.thermal.heatingRate);
    } else {
      this.thermal.temperature = Math.max(0, this.thermal.temperature * this.thermal.coolingRate);
    }
    
    // Enable throttling if too hot
    const wasThrottling = this.thermal.throttling;
    this.thermal.throttling = this.thermal.temperature > 80;
    
    // Log thermal changes
    if (wasThrottling !== this.thermal.throttling) {
      console.log(`Cache thermal ${this.thermal.throttling ? 'throttling enabled' : 'throttling disabled'}`);
    }
  }

  /**
   * Initialize background tasks
   * @private
   */
  _initializeBackgroundTasks() {
    // Prefetch task
    this.backgroundTasks.prefetch = setInterval(() => {
      if (!this.destroyed && !this.thermal.throttling) {
        this._backgroundPrefetch();
      }
    }, 5000);
    
    // Cleanup task
    this.backgroundTasks.cleanup = setInterval(() => {
      if (!this.destroyed) {
        this._backgroundCleanup();
      }
    }, 30000);
    
    // Optimization task
    this.backgroundTasks.optimization = setInterval(() => {
      if (!this.destroyed) {
        this.optimize();
      }
    }, 60000);
  }

  /**
   * Background prefetch based on patterns
   * @private
   */
  async _backgroundPrefetch() {
    // Analyze recent access patterns
    const recentAccesses = this.accessLog.slice(-20);
    if (recentAccesses.length < 3) return;
    
    // Find potential next accesses
    const predictions = this.models.sequential.predict(
      recentAccesses[recentAccesses.length - 1].key,
      recentAccesses
    );
    
    const keys = predictions
      .filter(p => p.confidence > 0.6)
      .map(p => p.key);
    
    if (keys.length > 0) {
      await this.prefetch(keys);
    }
  }

  /**
   * Background cleanup of expired items
   * @private
   */
  _backgroundCleanup() {
    const now = Date.now();
    
    // Clean main cache
    for (const [key, entry] of this.cache.entries()) {
      if (this._isExpired(entry)) {
        this.cache.delete(key);
      }
    }
    
    // Clean prefetch cache
    for (const [key, entry] of this.prefetchCache.entries()) {
      if (now - entry.created > 60000) { // 1 minute TTL for prefetch
        this.prefetchCache.delete(key);
      }
    }
    
    // Clean search cache
    for (const [key, entry] of this.searchCache.entries()) {
      if (now - entry.created > 300000) { // 5 minutes TTL for search
        this.searchCache.delete(key);
      }
    }
  }

  /**
   * Check if cache entry is expired
   * @private
   */
  _isExpired(entry) {
    return Date.now() - entry.created > (entry.ttl || 300000);
  }

  /**
   * Estimate size of value
   * @private
   */
  _estimateSize(value) {
    if (typeof value === 'string') {
      return value.length * 2;
    } else if (typeof value === 'object' && value !== null) {
      try {
        return JSON.stringify(value).length * 2;
      } catch (e) {
        return 1000; // Default estimate
      }
    }
    return 8;
  }

  /**
   * Predict value for key
   * @private
   */
  async _predictValue(key, context) {
    // Simplified prediction - in reality would use more sophisticated ML
    // Look for similar keys in cache
    for (const [cacheKey, entry] of this.cache.entries()) {
      if (cacheKey.includes(key) || key.includes(cacheKey)) {
        return {
          ...entry.value,
          confidence: 0.6,
          predicted: true
        };
      }
    }
    
    return null;
  }

  /**
   * Update predictive models
   * @private
   */
  _updateModels(key, value, options) {
    // Update context patterns
    if (options.context) {
      const contextKey = JSON.stringify(options.context);
      const pattern = this.contextPatterns.get(contextKey) || [];
      if (!pattern.includes(key)) {
        pattern.push(key);
        this.contextPatterns.set(contextKey, pattern);
      }
    }
    
    // Update sequential patterns
    if (this.accessLog.length > 0) {
      const lastAccess = this.accessLog[this.accessLog.length - 1];
      const sequenceKey = `${lastAccess.key}->${key}`;
      this.sequentialPatterns.set(sequenceKey, (this.sequentialPatterns.get(sequenceKey) || 0) + 1);
    }
  }

  /**
   * Trigger related prefetching
   * @private
   */
  async _triggerRelatedPrefetch(key, value) {
    if (!this.options.predictivePrefetch) return;
    
    // Look for related items based on value structure
    const relatedKeys = this._findRelatedKeys(key, value);
    
    if (relatedKeys.length > 0) {
      await this.prefetch(relatedKeys.slice(0, 5)); // Limit to 5
    }
  }

  /**
   * Find related keys
   * @private
   */
  _findRelatedKeys(key, value) {
    const related = [];
    
    // Extract related IDs from value
    if (value && typeof value === 'object') {
      if (value.id) related.push(value.id);
      if (value.parentId) related.push(value.parentId);
      if (value.children) {
        value.children.forEach(child => {
          if (typeof child === 'string') related.push(child);
          else if (child && child.id) related.push(child.id);
        });
      }
    }
    
    return related;
  }

  /**
   * Promote from prefetch cache
   * @private
   */
  _promoteFromPrefetch(key, item) {
    // Move from prefetch to main cache
    this.prefetchCache.delete(key);
    this.cache.set(key, {
      ...item,
      promoted: true,
      accessCount: 1
    });
  }

  /**
   * Generate search cache key
   * @private
   */
  _generateSearchKey(query, options) {
    return `search:${JSON.stringify({ query, options })}`;
  }

  /**
   * Prefetch related searches
   * @private
   */
  _prefetchRelatedSearches(query, results) {
    // Extract related search terms from results
    if (results && results.length > 0) {
      const terms = this._extractSearchTerms(results);
      
      // Could trigger related searches here
      // For now, just store the relationship
      terms.forEach(term => {
        this.contextPatterns.set(`search:${query}`, [term]);
      });
    }
  }

  /**
   * Extract search terms from results
   * @private
   */
  _extractSearchTerms(results) {
    const terms = new Set();
    
    results.forEach(result => {
      if (result.title) {
        const words = result.title.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 3) terms.add(word);
        });
      }
    });
    
    return Array.from(terms);
  }

  /**
   * Calculate prefetch effectiveness
   * @private
   */
  _calculatePrefetchEffectiveness() {
    const total = this.metrics.prefetchHits + this.metrics.prefetchMisses;
    return total > 0 ? this.metrics.prefetchHits / total : 0;
  }

  /**
   * Get top accessed items
   * @private
   */
  _getTopAccessedItems(limit = 10) {
    return Array.from(this.accessFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key, count]) => ({ key, count }));
  }

  /**
   * Analyze sequential patterns
   * @private
   */
  _analyzeSequentialPatterns() {
    const patterns = Array.from(this.sequentialPatterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    return patterns.map(([pattern, count]) => {
      const [from, to] = pattern.split('->');
      return { from, to, count };
    });
  }

  /**
   * Analyze contextual patterns
   * @private
   */
  _analyzeContextualPatterns() {
    const patterns = [];
    
    this.contextPatterns.forEach((keys, context) => {
      patterns.push({
        context: JSON.parse(context),
        keys: keys.slice(0, 5),
        frequency: keys.length
      });
    });
    
    return patterns.sort((a, b) => b.frequency - a.frequency).slice(0, 10);
  }

  /**
   * Get model performance
   * @private
   */
  _getModelPerformance() {
    return {
      sequential: { enabled: true, patterns: this.sequentialPatterns.size },
      frequency: { enabled: true, entries: this.accessFrequency.size },
      context: { enabled: true, patterns: this.contextPatterns.size },
      ml: { enabled: false, trained: false }
    };
  }

  /**
   * Analyze access patterns
   * @private
   */
  _analyzeAccessPatterns() {
    const recent = this.accessLog.slice(-50);
    
    return {
      totalAccesses: this.accessLog.length,
      recentAccesses: recent.length,
      uniqueKeys: new Set(recent.map(a => a.key)).size,
      averageInterval: this._calculateAverageInterval(recent),
      topKeys: this._getTopAccessedItems(5)
    };
  }

  /**
   * Calculate average interval between accesses
   * @private
   */
  _calculateAverageInterval(accesses) {
    if (accesses.length < 2) return 0;
    
    let totalInterval = 0;
    for (let i = 1; i < accesses.length; i++) {
      totalInterval += accesses[i].timestamp - accesses[i - 1].timestamp;
    }
    
    return totalInterval / (accesses.length - 1);
  }

  /**
   * Adjust cache sizes based on patterns
   * @private
   */
  _adjustCacheSizes(patterns) {
    // Increase cache size if hit rate is high
    const hitRate = this.metrics.hits / (this.metrics.hits + this.metrics.misses);
    
    if (hitRate > 0.9 && this.cache.size === this.options.maxCacheSize) {
      // Could suggest increasing cache size
    } else if (hitRate < 0.5 && this.cache.size > 50) {
      // Could suggest decreasing cache size
    }
  }

  /**
   * Train models with patterns
   * @private
   */
  _trainModels(patterns) {
    // Update model parameters based on usage patterns
    this.models.sequential.patterns = this.sequentialPatterns;
    this.models.frequency.frequencies = this.accessFrequency;
    this.models.context.contexts = this.contextPatterns;
  }

  /**
   * Intelligent cleanup
   * @private
   */
  async _intelligentCleanup() {
    const now = Date.now();
    
    // Clean expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (this._isExpired(entry)) {
        this.cache.delete(key);
      }
    }
    
    // Clean old access logs
    this.accessLog = this.accessLog.filter(access => 
      now - access.timestamp < 3600000 // Keep last hour
    );
    
    // Clean pattern maps
    for (const [key, count] of this.sequentialPatterns.entries()) {
      if (count < 2) { // Remove weak patterns
        this.sequentialPatterns.delete(key);
      }
    }
  }

  /**
   * Optimize compression strategies
   * @private
   */
  _optimizeCompression() {
    // Analyze compression effectiveness
    let totalOriginal = 0;
    let totalCompressed = 0;
    
    this.cache.forEach(entry => {
      if (entry.compressed) {
        totalOriginal += entry.originalSize;
        totalCompressed += entry.compressedSize;
      }
    });
    
    const ratio = totalOriginal > 0 ? totalCompressed / totalOriginal : 1;
    this.metrics.compressionRatio = ratio;
    
    // Adjust compression threshold based on effectiveness
    if (ratio > 0.9) {
      // Compression not effective, might disable for small items
    }
  }

  /**
   * Calculate compression ratio
   * @private
   */
  _calculateCompressionRatio(original, compressed) {
    const originalSize = this._estimateSize(original);
    const compressedSize = this._estimateSize(compressed);
    
    return originalSize > 0 ? (originalSize - compressedSize) / originalSize : 0;
  }

  /**
   * Calculate memory usage
   * @private
   */
  _calculateMemoryUsage() {
    let total = 0;
    
    this.cache.forEach(entry => {
      total += entry.compressedSize || entry.originalSize || 0;
    });
    
    this.prefetchCache.forEach(entry => {
      total += this._estimateSize(entry.value);
    });
    
    this.searchCache.forEach(entry => {
      total += this._estimateSize(entry.value);
    });
    
    return total;
  }

  /**
   * Combine predictions from multiple models
   * @private
   */
  _combinePredictions(predictions) {
    const combined = new Map();
    
    // Flatten all predictions
    predictions.forEach(modelPredictions => {
      modelPredictions.forEach(prediction => {
        const existing = combined.get(prediction.key);
        if (existing) {
          // Average the confidence scores
          existing.confidence = (existing.confidence + prediction.confidence) / 2;
          existing.sources.push(prediction.type);
        } else {
          combined.set(prediction.key, {
            ...prediction,
            sources: [prediction.type]
          });
        }
      });
    });
    
    return Array.from(combined.values());
  }

  /**
   * Extract features for ML prediction
   * @private
   */
  _extractFeatures(key, context) {
    return {
      keyLength: key.length,
      hasNumbers: /\d/.test(key),
      hasSpecialChars: /[^a-zA-Z0-9]/.test(key),
      contextSize: Object.keys(context).length,
      recentAccess: this.accessLog.some(a => a.key === key),
      frequency: this.accessFrequency.get(key) || 0
    };
  }

  /**
   * Destroy cache and cleanup
   */
  destroy() {
    if (this.destroyed) return;
    
    this.destroyed = true;
    
    // Clear background tasks
    Object.values(this.backgroundTasks).forEach(task => {
      if (task) clearInterval(task);
    });
    
    // Clear all caches
    this.cache.clear();
    this.renderCache.clear();
    this.searchCache.clear();
    this.prefetchCache.clear();
    
    // Clear patterns
    this.accessLog = [];
    this.accessFrequency.clear();
    this.sequentialPatterns.clear();
    this.contextPatterns.clear();
    
    // Destroy models
    Object.values(this.models).forEach(model => {
      if (model.destroy) model.destroy();
    });
  }
}

/**
 * Sequential access predictor
 */
class SequentialPredictor {
  predict(currentKey, accessLog) {
    const predictions = [];
    
    // Find patterns in access log
    for (let i = 1; i < accessLog.length; i++) {
      if (accessLog[i - 1].key === currentKey) {
        const nextKey = accessLog[i].key;
        predictions.push({
          key: nextKey,
          confidence: 0.8,
          type: 'sequential'
        });
      }
    }
    
    return predictions;
  }
}

/**
 * Frequency-based predictor
 */
class FrequencyPredictor {
  predict(currentKey, frequencyMap) {
    const predictions = [];
    
    // Sort by frequency
    const sorted = Array.from(frequencyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5); // Top 5
    
    sorted.forEach(([key, freq]) => {
      if (key !== currentKey) {
        predictions.push({
          key,
          confidence: Math.min(0.9, freq / 100),
          type: 'frequency'
        });
      }
    });
    
    return predictions;
  }
}

/**
 * Context-aware predictor
 */
class ContextPredictor {
  predict(currentKey, context, contextPatterns) {
    const predictions = [];
    
    // Simple context matching
    const contextKey = JSON.stringify(context);
    const pattern = contextPatterns.get(contextKey);
    
    if (pattern) {
      pattern.forEach(key => {
        if (key !== currentKey) {
          predictions.push({
            key,
            confidence: 0.7,
            type: 'context'
          });
        }
      });
    }
    
    return predictions;
  }
}

/**
 * Simple ML-based predictor
 */
class SimpleMLPredictor {
  predict(currentKey, features) {
    // Placeholder for ML-based prediction
    // In a real implementation, this would use a trained model
    return [];
  }
}