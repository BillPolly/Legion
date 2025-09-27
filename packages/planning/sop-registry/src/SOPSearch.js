import { SOPSearchError } from './errors/index.js';

class LRUCache {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }
  
  get(key) {
    if (!this.cache.has(key)) return null;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }
  
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
  
  has(key) {
    return this.cache.has(key);
  }
  
  clear() {
    this.cache.clear();
  }
}

export class SOPSearch {
  constructor({ resourceManager, sopStorage }) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    if (!sopStorage) {
      throw new Error('sopStorage is required');
    }
    
    this.resourceManager = resourceManager;
    this.sopStorage = sopStorage;
    this.nomicService = null;
    this.queryCache = new LRUCache(1000);
    this.initialized = false;
    
    this.stats = {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }
  
  async initialize() {
    if (this.initialized) return;
    
    let nomicService = this.resourceManager.get('nomicService');
    if (!nomicService) {
      const { NomicEmbeddings } = await import('@legion/nomic');
      nomicService = new NomicEmbeddings();
      await nomicService.initialize();
      this.resourceManager.set('nomicService', nomicService);
    }
    this.nomicService = nomicService;
    
    this.initialized = true;
  }
  
  async searchSemantic(query, options = {}) {
    if (!this.initialized) await this.initialize();
    
    this._validateQuery(query);
    
    this.stats.totalQueries++;
    
    const queryEmbedding = await this._getQueryEmbedding(query);
    
    const perspectives = await this.sopStorage.findSOPPerspectives();
    
    const scored = perspectives.map(p => ({
      perspective: p,
      score: this._cosineSimilarity(queryEmbedding, p.embedding)
    }));
    
    const threshold = options.similarityThreshold || 0.3;
    const filtered = scored.filter(s => s.score >= threshold);
    filtered.sort((a, b) => b.score - a.score);
    
    const topK = options.topK || 10;
    const topResults = filtered.slice(0, topK);
    
    const sopMap = new Map();
    
    for (const item of topResults) {
      const sopId = item.perspective.sop_id.toString();
      
      if (!sopMap.has(sopId)) {
        const sop = await this.sopStorage.findSOP(item.perspective.sop_id);
        sopMap.set(sopId, {
          sop,
          score: 0,
          matchedPerspectives: []
        });
      }
      
      const entry = sopMap.get(sopId);
      entry.score = Math.max(entry.score, item.score);
      entry.matchedPerspectives.push({
        type: item.perspective.perspective_type_name,
        content: item.perspective.content,
        score: item.score,
        scope: item.perspective.scope,
        stepIndex: item.perspective.step_index
      });
    }
    
    const results = Array.from(sopMap.values());
    results.sort((a, b) => b.score - a.score);
    
    return results;
  }
  
  async searchText(query, options = {}) {
    this._validateQuery(query);
    
    const sops = await this.sopStorage.findSOPs({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { intent: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { tags: { $regex: query, $options: 'i' } }
      ]
    });
    
    const scored = sops.map(sop => ({
      ...sop,
      score: this._calculateTextScore(sop, query)
    }));
    
    scored.sort((a, b) => b.score - a.score);
    
    return scored;
  }
  
  async searchHybrid(query, options = {}) {
    if (!this.initialized) await this.initialize();
    
    this._validateQuery(query);
    
    const weight = options.hybridWeight || 0.6;
    
    const [semanticResults, textResults] = await Promise.all([
      this.searchSemantic(query, options),
      this.searchText(query, options)
    ]);
    
    const combined = new Map();
    
    for (const result of semanticResults) {
      const sopId = result.sop._id.toString();
      combined.set(sopId, {
        sop: result.sop,
        score: result.score * weight,
        matchedPerspectives: result.matchedPerspectives
      });
    }
    
    for (const textResult of textResults) {
      const sopId = textResult._id.toString();
      const existing = combined.get(sopId);
      
      if (existing) {
        existing.score += textResult.score * (1 - weight);
      } else {
        combined.set(sopId, {
          sop: textResult,
          score: textResult.score * (1 - weight),
          matchedPerspectives: []
        });
      }
    }
    
    const results = Array.from(combined.values());
    results.sort((a, b) => b.score - a.score);
    
    const topK = options.topK || 10;
    return results.slice(0, topK);
  }
  
  async searchSteps(query, options = {}) {
    if (!this.initialized) await this.initialize();
    
    this._validateQuery(query);
    
    const queryEmbedding = await this._getQueryEmbedding(query);
    
    const stepPerspectives = await this.sopStorage.findSOPPerspectives({ scope: 'step' });
    
    const scored = stepPerspectives.map(p => ({
      perspective: p,
      score: this._cosineSimilarity(queryEmbedding, p.embedding)
    }));
    
    const threshold = options.threshold || 0.3;
    const filtered = scored.filter(s => s.score >= threshold);
    filtered.sort((a, b) => b.score - a.score);
    
    const topK = options.topK || 10;
    const topResults = filtered.slice(0, topK);
    
    const results = [];
    for (const item of topResults) {
      const sop = await this.sopStorage.findSOP(item.perspective.sop_id);
      const step = sop.steps[item.perspective.step_index];
      
      results.push({
        sop,
        stepIndex: item.perspective.step_index,
        step,
        score: item.score,
        perspective: item.perspective.content
      });
    }
    
    return results;
  }
  
  async _getQueryEmbedding(query) {
    const cacheKey = this._createCacheKey(query);
    const cached = this.queryCache.get(cacheKey);
    
    if (cached) {
      this.stats.cacheHits++;
      return cached;
    }
    
    this.stats.cacheMisses++;
    
    const embedding = await this.nomicService.embed(query);
    this.queryCache.set(cacheKey, embedding);
    
    return embedding;
  }
  
  _cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;
    
    return dotProduct / denominator;
  }
  
  _calculateTextScore(sop, query) {
    const queryLower = query.toLowerCase();
    let score = 0;
    
    if (sop.title && sop.title.toLowerCase().includes(queryLower)) {
      score += 1.0;
    }
    
    if (sop.intent && sop.intent.toLowerCase().includes(queryLower)) {
      score += 0.8;
    }
    
    if (sop.description && sop.description.toLowerCase().includes(queryLower)) {
      score += 0.6;
    }
    
    if (sop.tags && sop.tags.some(t => t.toLowerCase().includes(queryLower))) {
      score += 0.4;
    }
    
    return Math.min(score, 1.0);
  }
  
  _createCacheKey(query) {
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `query_${Math.abs(hash)}`;
  }
  
  _validateQuery(query) {
    if (!query || typeof query !== 'string' || query.trim() === '') {
      throw new SOPSearchError(
        'Query must be non-empty string',
        query,
        new Error('Invalid query')
      );
    }
  }
  
  getSearchStats() {
    const totalRequests = this.stats.cacheHits + this.stats.cacheMisses;
    return {
      totalQueries: this.stats.totalQueries,
      cacheHitRate: totalRequests > 0 ? this.stats.cacheHits / totalRequests : 0
    };
  }
}