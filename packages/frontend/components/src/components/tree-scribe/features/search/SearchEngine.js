/**
 * SearchEngine - Full-text search with relevance scoring and result highlighting
 */

export class SearchEngine {
  constructor(options = {}) {
    this.options = {
      caseSensitive: false,
      wholeWord: false,
      includeContent: true,
      includeTitle: true,
      maxResults: 100,
      highlightClass: 'search-highlight',
      supportRegex: false,
      supportWildcards: false,
      minQueryLength: 1,
      ...options
    };

    this.destroyed = false;
    this.index = new Map(); // nodeId -> indexed node data
    this.termIndex = new Map(); // term -> Set of nodeIds
    this.analytics = {
      totalSearches: 0,
      uniqueQueries: 0,
      queryCount: new Map(), // query -> count
      topQueries: []
    };

    // Scoring weights
    this.weights = {
      titleMatch: 3.0,
      contentMatch: 1.0,
      exactMatch: 2.0,
      partialMatch: 1.0,
      multipleTerms: 1.5
    };
  }

  /**
   * Index nodes for searching
   */
  indexNodes(nodes) {
    if (this.destroyed || !Array.isArray(nodes)) return 0;

    // Clear existing index
    this.clearIndex();

    let indexedCount = 0;
    nodes.forEach(node => {
      if (this._isValidNode(node)) {
        this._indexNode(node);
        indexedCount++;
      }
    });

    return indexedCount;
  }

  /**
   * Index tree structure for searching
   */
  indexTree(tree) {
    if (this.destroyed || !tree) return 0;
    
    // Handle both tree.nodes array and direct nodes array
    const nodes = tree.nodes || (Array.isArray(tree) ? tree : []);
    return this.indexNodes(nodes);
  }

  /**
   * Add single node to index
   */
  addToIndex(node) {
    if (this.destroyed || !this._isValidNode(node)) return false;

    this._indexNode(node);
    return true;
  }

  /**
   * Remove node from index
   */
  removeFromIndex(nodeId) {
    if (this.destroyed || !nodeId) return false;

    const indexedNode = this.index.get(nodeId);
    if (!indexedNode) return false;

    // Remove from term index
    indexedNode.terms.forEach(term => {
      const nodeSet = this.termIndex.get(term);
      if (nodeSet) {
        nodeSet.delete(nodeId);
        if (nodeSet.size === 0) {
          this.termIndex.delete(term);
        }
      }
    });

    // Remove from main index
    this.index.delete(nodeId);
    return true;
  }

  /**
   * Clear entire index
   */
  clearIndex() {
    if (this.destroyed) return;

    this.index.clear();
    this.termIndex.clear();
  }

  /**
   * Get index size
   */
  getIndexSize() {
    return this.destroyed ? 0 : this.index.size;
  }

  /**
   * Perform search query
   */
  search(query, searchOptions = {}) {
    if (this.destroyed) return [];

    // Validate and normalize query
    const normalizedQuery = this._normalizeQuery(query);
    if (!normalizedQuery) return [];

    // Update analytics
    this._updateAnalytics(query);

    // Apply search-specific options
    const searchContext = {
      ...this.options,
      caseSensitive: searchOptions.caseSensitive ?? this.options.caseSensitive,
      wholeWord: searchOptions.wholeWord ?? this.options.wholeWord
    };

    // Parse query terms
    const queryTerms = this._parseQuery(normalizedQuery, searchOptions);
    if (queryTerms.length === 0) return [];

    // Find matching nodes
    const candidates = this._findCandidates(queryTerms, searchContext);
    if (candidates.size === 0) return [];

    // Score and rank results
    let results = this._scoreResults(candidates, queryTerms, normalizedQuery, searchContext);

    // Apply filters if provided
    if (searchOptions.filters) {
      results = this._applyFilters(results, searchOptions.filters);
    }

    // Apply result limit
    const maxResults = searchOptions.maxResults || this.options.maxResults;
    return results.slice(0, maxResults);
  }

  /**
   * Highlight search terms in result
   */
  highlightResult(result, query) {
    if (this.destroyed || !result || !query) return { title: '', content: '' };

    const node = this.index.get(result.nodeId);
    if (!node) return { title: '', content: '' };

    const queryTerms = this._parseQuery(this._normalizeQuery(query));
    
    return {
      title: this._highlightText(node.originalTitle, queryTerms),
      content: this._highlightText(node.originalContent, queryTerms)
    };
  }

  /**
   * Generate contextual snippet
   */
  generateSnippet(result, query, maxLength = 150) {
    if (this.destroyed || !result || !query) return '';

    const node = this.index.get(result.nodeId);
    if (!node) return '';

    const queryTerms = this._parseQuery(this._normalizeQuery(query));
    const content = node.originalContent || '';

    // Find best snippet around first match
    const firstMatch = result.matches.find(m => m.field === 'content');
    if (!firstMatch || firstMatch.positions.length === 0) {
      // Fallback to beginning of content
      const snippet = content.substring(0, maxLength);
      return this._highlightText(snippet, queryTerms);
    }

    const matchPos = firstMatch.positions[0].start;
    const snippetStart = Math.max(0, matchPos - Math.floor(maxLength / 2));
    const snippetEnd = Math.min(content.length, snippetStart + maxLength);
    const plainSnippet = content.substring(snippetStart, snippetEnd);

    // First get plain snippet, then apply highlighting
    const highlighted = this._highlightText(plainSnippet, queryTerms);
    
    // If highlighted version is too long, truncate the plain text and re-highlight
    if (highlighted.length > maxLength + 50) { // Allow some margin for highlighting tags
      const shorterSnippet = plainSnippet.substring(0, Math.floor(maxLength * 0.8));
      return this._highlightText(shorterSnippet, queryTerms);
    }
    
    return highlighted;
  }

  /**
   * Get search suggestions based on partial query
   */
  getSuggestions(partialQuery) {
    if (this.destroyed || !partialQuery || partialQuery.length < 2) return [];

    const normalizedQuery = this._normalizeQuery(partialQuery);
    const suggestions = new Set();

    // Find terms that start with the query
    this.termIndex.forEach((nodes, term) => {
      if (term.startsWith(normalizedQuery)) {
        suggestions.add(term);
      }
    });

    return Array.from(suggestions).slice(0, 10);
  }

  /**
   * Get search analytics
   */
  getAnalytics() {
    if (this.destroyed) {
      return {
        totalSearches: 0,
        uniqueQueries: 0,
        topQueries: []
      };
    }

    // Update top queries
    const sortedQueries = Array.from(this.analytics.queryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    return {
      totalSearches: this.analytics.totalSearches,
      uniqueQueries: this.analytics.uniqueQueries,
      topQueries: sortedQueries
    };
  }

  /**
   * Get search engine info
   */
  getInfo() {
    return {
      name: 'SearchEngine',
      version: '1.0.0',
      indexSize: this.getIndexSize(),
      termCount: this.termIndex.size,
      options: { ...this.options },
      destroyed: this.destroyed
    };
  }

  /**
   * Validate if node can be indexed
   * @private
   */
  _isValidNode(node) {
    return node && 
           typeof node === 'object' && 
           typeof node.id === 'string' && 
           node.id.length > 0 &&
           (node.title || node.content); // Must have either title or content
  }

  /**
   * Index a single node
   * @private
   */
  _indexNode(node) {
    const nodeId = node.id;
    const title = String(node.title || '');
    const content = this._extractContent(node.content);

    // Tokenize text - always lowercase for index
    const titleTerms = this._tokenize(title.toLowerCase());
    const contentTerms = this.options.includeContent ? this._tokenize(content.toLowerCase()) : [];
    const allTerms = new Set([...titleTerms, ...contentTerms]);

    // Store indexed node
    const indexedNode = {
      id: nodeId,
      originalTitle: title,
      originalContent: content,
      titleTerms: new Set(titleTerms),
      contentTerms: new Set(contentTerms),
      terms: allTerms,
      node: node // Store reference to original node
    };

    this.index.set(nodeId, indexedNode);

    // Update term index
    allTerms.forEach(term => {
      if (!this.termIndex.has(term)) {
        this.termIndex.set(term, new Set());
      }
      this.termIndex.get(term).add(nodeId);
    });
  }

  /**
   * Extract searchable content from various types
   * @private
   */
  _extractContent(content) {
    if (content === null || content === undefined) return '';
    
    if (typeof content === 'string') return content;
    
    if (typeof content === 'object') {
      // Handle YAML/JSON objects
      try {
        return JSON.stringify(content, null, 2);
      } catch (error) {
        return String(content);
      }
    }
    
    return String(content);
  }

  /**
   * Tokenize text into searchable terms
   * @private
   */
  _tokenize(text) {
    if (!text || typeof text !== 'string') return [];

    // Note: text should already be lowercased if needed by caller
    
    // Split on word boundaries and filter
    const terms = text
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .split(/\s+/)
      .filter(term => term.length >= this.options.minQueryLength);

    return terms;
  }

  /**
   * Normalize search query
   * @private
   */
  _normalizeQuery(query) {
    if (!query || typeof query !== 'string') return '';
    
    const trimmed = query.trim();
    if (trimmed.length < this.options.minQueryLength) return '';

    return this.options.caseSensitive ? trimmed : trimmed.toLowerCase();
  }

  /**
   * Parse query into search terms
   * @private
   */
  _parseQuery(query, options = {}) {
    if (!query) return [];

    // Handle regex queries
    if (options.useRegex && query instanceof RegExp) {
      return [{ type: 'regex', pattern: query }];
    }

    // Handle quoted phrases
    const phrases = [];
    const quotedRegex = /"([^"]+)"/g;
    let match;
    let remainingQuery = query;

    while ((match = quotedRegex.exec(query)) !== null) {
      phrases.push(match[1]);
      remainingQuery = remainingQuery.replace(match[0], '');
    }

    // Tokenize remaining query
    const terms = this._tokenize(remainingQuery);

    // Combine phrases and terms
    return [...phrases, ...terms].filter(t => t.length > 0);
  }

  /**
   * Find candidate nodes for query terms
   * @private
   */
  _findCandidates(queryTerms, searchContext = {}) {
    const candidates = new Map(); // nodeId -> match count
    const context = { ...this.options, ...searchContext };

    queryTerms.forEach(term => {
      // Handle regex terms
      if (term.type === 'regex') {
        this._findRegexCandidates(term.pattern, candidates, context);
        return;
      }

      const searchTerm = context.caseSensitive ? term : term.toLowerCase();
      const matchingNodes = this.termIndex.get(searchTerm) || new Set();
      
      // Also check for partial matches if not whole word
      if (!context.wholeWord) {
        this.termIndex.forEach((nodes, indexedTerm) => {
          const compareIndexedTerm = context.caseSensitive ? indexedTerm : indexedTerm.toLowerCase();
          if (compareIndexedTerm.includes(searchTerm)) {
            nodes.forEach(nodeId => matchingNodes.add(nodeId));
          }
        });
      }

      matchingNodes.forEach(nodeId => {
        candidates.set(nodeId, (candidates.get(nodeId) || 0) + 1);
      });
    });

    return candidates;
  }

  /**
   * Find candidates using regex pattern
   * @private
   */
  _findRegexCandidates(pattern, candidates, context) {
    this.index.forEach((indexedNode, nodeId) => {
      let matches = 0;
      
      if (context.includeTitle && pattern.test(indexedNode.originalTitle)) {
        matches++;
      }
      
      if (context.includeContent && pattern.test(indexedNode.originalContent)) {
        matches++;
      }
      
      if (matches > 0) {
        candidates.set(nodeId, (candidates.get(nodeId) || 0) + matches);
      }
    });
  }

  /**
   * Score and rank search results
   * @private
   */
  _scoreResults(candidates, queryTerms, originalQuery, searchContext = {}) {
    const results = [];

    candidates.forEach((matchCount, nodeId) => {
      const indexedNode = this.index.get(nodeId);
      if (!indexedNode) return;

      const matches = this._findMatches(indexedNode, queryTerms, searchContext);
      const score = this._calculateScore(indexedNode, queryTerms, matches, matchCount);

      // Include node details in results
      const node = indexedNode.node;
      results.push({
        nodeId,
        score,
        matches,
        matchCount,
        title: node.title,
        content: node.content,
        type: node.type,
        path: node.path,
        depth: node.depth
      });
    });

    // Sort by score (descending)
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Find all matches for query terms in a node
   * @private
   */
  _findMatches(indexedNode, queryTerms, searchContext = {}) {
    const matches = [];
    const context = { ...this.options, ...searchContext };

    queryTerms.forEach(term => {
      // Handle regex terms
      if (term.type === 'regex') {
        this._findRegexMatches(indexedNode, term.pattern, matches, context);
        return;
      }

      // Check title matches
      if (context.includeTitle) {
        const titlePositions = this._findTermPositions(indexedNode.originalTitle, term, context);
        if (titlePositions.length > 0) {
          matches.push({
            field: 'title',
            term,
            positions: titlePositions,
            match: term,
            position: titlePositions[0].start,
            length: term.length
          });
        }
      }

      // Check content matches
      if (context.includeContent) {
        const contentPositions = this._findTermPositions(indexedNode.originalContent, term, context);
        if (contentPositions.length > 0) {
          matches.push({
            field: 'content',
            term,
            positions: contentPositions,
            match: term,
            position: contentPositions[0].start,
            length: term.length
          });
        }
      }
    });

    return matches;
  }

  /**
   * Find regex matches in a node
   * @private
   */
  _findRegexMatches(indexedNode, pattern, matches, context) {
    // Ensure pattern has global flag
    const globalPattern = pattern.global ? pattern : new RegExp(pattern.source, pattern.flags + 'g');
    
    if (context.includeTitle) {
      const titleMatches = [...indexedNode.originalTitle.matchAll(globalPattern)];
      titleMatches.forEach(match => {
        matches.push({
          field: 'title',
          term: match[0],
          match: match[0],
          position: match.index,
          length: match[0].length,
          positions: [{ start: match.index, end: match.index + match[0].length }]
        });
      });
    }

    if (context.includeContent) {
      const contentMatches = [...indexedNode.originalContent.matchAll(globalPattern)];
      contentMatches.forEach(match => {
        matches.push({
          field: 'content',
          term: match[0],
          match: match[0],
          position: match.index,
          length: match[0].length,
          positions: [{ start: match.index, end: match.index + match[0].length }]
        });
      });
    }
  }

  /**
   * Find positions of term in text
   * @private
   */
  _findTermPositions(text, term, context = {}) {
    if (!text || !term) return [];

    const positions = [];
    const searchText = context.caseSensitive ? text : text.toLowerCase();
    const searchTerm = context.caseSensitive ? term : term.toLowerCase();

    let index = 0;
    while ((index = searchText.indexOf(searchTerm, index)) !== -1) {
      // Check for whole word match if required
      if (context.wholeWord) {
        const beforeChar = index > 0 ? searchText[index - 1] : ' ';
        const afterChar = index + searchTerm.length < searchText.length ? 
          searchText[index + searchTerm.length] : ' ';
        
        if (!/\w/.test(beforeChar) && !/\w/.test(afterChar)) {
          positions.push({
            start: index,
            end: index + searchTerm.length
          });
        }
      } else {
        positions.push({
          start: index,
          end: index + searchTerm.length
        });
      }
      
      index += searchTerm.length;
    }

    return positions;
  }

  /**
   * Calculate relevance score for a result
   * @private
   */
  _calculateScore(indexedNode, queryTerms, matches, matchCount) {
    let score = 0;

    // Base score from match count
    score += matchCount;

    // Score individual matches
    matches.forEach(match => {
      let matchScore = match.positions.length;

      // Title matches score higher
      if (match.field === 'title') {
        matchScore *= this.weights.titleMatch;
      } else {
        matchScore *= this.weights.contentMatch;
      }

      // Exact matches score higher
      if (indexedNode.titleTerms.has(match.term) || indexedNode.contentTerms.has(match.term)) {
        matchScore *= this.weights.exactMatch;
      } else {
        matchScore *= this.weights.partialMatch;
      }

      score += matchScore;
    });

    // Bonus for multiple term matches
    if (queryTerms.length > 1 && matchCount > 1) {
      score *= this.weights.multipleTerms;
    }

    return score;
  }

  /**
   * Highlight search terms in text
   * @private
   */
  _highlightText(text, queryTerms) {
    if (!text || queryTerms.length === 0) return this._escapeHtml(text);

    const highlightClass = this.options.highlightClass;
    let result = this._escapeHtml(text);

    // Process each term
    queryTerms.forEach(term => {
      const regex = new RegExp(
        this._escapeRegex(term), 
        this.options.caseSensitive ? 'g' : 'gi'
      );
      
      result = result.replace(regex, (match) => {
        return `<mark class="${highlightClass}">${match}</mark>`;
      });
    });

    return result;
  }

  /**
   * Escape HTML characters
   * @private
   */
  _escapeHtml(text) {
    if (typeof text !== 'string') return '';
    
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Escape regex special characters
   * @private
   */
  _escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Apply search filters to results
   * @private
   */
  _applyFilters(results, filters) {
    return results.filter(result => {
      const indexedNode = this.index.get(result.nodeId);
      if (!indexedNode) return false;

      const node = indexedNode.node;

      // Apply contentType filter
      if (filters.contentType && node.contentType !== filters.contentType) {
        return false;
      }

      // Apply depth filter
      if (filters.depth) {
        const nodeDepth = node.depth || 0;
        if (filters.depth.min !== undefined && nodeDepth < filters.depth.min) {
          return false;
        }
        if (filters.depth.max !== undefined && nodeDepth > filters.depth.max) {
          return false;
        }
      }

      // Apply other filters as needed
      return true;
    });
  }

  /**
   * Update search analytics
   * @private
   */
  _updateAnalytics(query) {
    if (this.destroyed || !query) return;

    this.analytics.totalSearches++;

    const originalQuery = query.trim();
    if (!this.analytics.queryCount.has(originalQuery)) {
      this.analytics.uniqueQueries++;
      this.analytics.queryCount.set(originalQuery, 0);
    }
    
    this.analytics.queryCount.set(originalQuery, 
      this.analytics.queryCount.get(originalQuery) + 1);
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.destroyed) return;

    this.clearIndex();
    this.analytics = {
      totalSearches: 0,
      uniqueQueries: 0,
      queryCount: new Map(),
      topQueries: []
    };

    this.destroyed = true;
  }
}