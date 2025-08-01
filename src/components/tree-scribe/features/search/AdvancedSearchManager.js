/**
 * AdvancedSearchManager - Enhanced search capabilities for TreeScribe
 * 
 * Provides navigation through search results, context extraction,
 * highlighting, and advanced search features.
 */

export class AdvancedSearchManager {
  constructor(options = {}) {
    this.options = {
      contextWindow: 100,
      highlightTag: 'mark',
      maxResults: 100,
      maxHistorySize: 50,
      ...options
    };

    if (!this.options.searchEngine) {
      throw new Error('SearchEngine is required');
    }

    this.searchEngine = this.options.searchEngine;
    this.destroyed = false;
    
    // Search state
    this.currentQuery = null;
    this.currentResults = [];
    this.currentIndex = -1;
    this.currentOptions = {};
    
    // Search history
    this.searchHistory = [];
    this.historyIndex = -1;
    
    // Async search state
    this.isSearching = false;
    this.searchAbortController = null;
    
    // Accessibility
    this.announcer = null;
  }

  /**
   * Perform search with advanced options
   */
  search(query, options = {}) {
    if (this.destroyed) return [];

    this.currentQuery = query;
    this.currentOptions = options;
    
    // Track search duration
    const startTime = Date.now();
    
    // Get base results from search engine
    const searchOptions = {
      maxResults: options.maxResults || this.options.maxResults,
      caseSensitive: options.caseSensitive || false,
      fuzzy: options.fuzzy !== false,
      wholeWord: options.wholeWord || false,
      useRegex: options.useRegex || false
    };
    
    let results = this.searchEngine.search(query, searchOptions);
    
    // Record search duration
    this._lastSearchDuration = Date.now() - startTime;
    
    // Apply additional filters
    results = this._applyFilters(results, options);
    
    // Apply result limit after filtering
    if (options.maxResults) {
      results = results.slice(0, options.maxResults);
    }
    
    // Enhance results with context
    results = results.map(result => this._enhanceResult(result, query, options));
    
    // Update state
    this.currentResults = results;
    this.currentIndex = results.length > 0 ? 0 : -1;
    
    // Add to history
    this._addToHistory(query, results.length, options);
    
    // Announce results
    if (this.announcer) {
      const message = results.length === 0
        ? 'No results found'
        : `${results.length} results found for "${query}"`;
      this.announcer.announce(message);
    }
    
    return results;
  }

  /**
   * Perform async search with callbacks
   */
  searchAsync(query, options = {}) {
    if (this.destroyed) return;

    // Cancel any ongoing search
    this.cancelSearch();
    
    this.isSearching = true;
    this.searchAbortController = new AbortController();
    
    const performSearch = async () => {
      try {
        const results = this.search(query, options);
        
        // Process results in chunks
        const chunkSize = 10;
        for (let i = 0; i < results.length; i += chunkSize) {
          if (this.searchAbortController.signal.aborted) break;
          
          const chunk = results.slice(i, i + chunkSize);
          if (options.onResult) {
            chunk.forEach(result => options.onResult(result));
          }
          
          // Allow UI to update
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        if (!this.searchAbortController.signal.aborted && options.onComplete) {
          options.onComplete(results);
        }
      } catch (error) {
        if (options.onError) {
          options.onError(error);
        }
      } finally {
        this.isSearching = false;
        this.searchAbortController = null;
      }
    };
    
    performSearch();
  }

  /**
   * Cancel ongoing search
   */
  cancelSearch() {
    if (this.searchAbortController) {
      this.searchAbortController.abort();
      this.isSearching = false;
      this.searchAbortController = null;
    }
  }

  /**
   * Navigate to next search result
   */
  navigateNext() {
    if (this.destroyed || this.currentResults.length === 0) return null;
    
    this.currentIndex = (this.currentIndex + 1) % this.currentResults.length;
    const result = this.currentResults[this.currentIndex];
    
    if (this.announcer) {
      this.announcer.announce(
        `Result ${this.currentIndex + 1} of ${this.currentResults.length}: ${result.title}`
      );
    }
    
    return result;
  }

  /**
   * Navigate to previous search result
   */
  navigatePrevious() {
    if (this.destroyed || this.currentResults.length === 0) return null;
    
    this.currentIndex = this.currentIndex <= 0 
      ? this.currentResults.length - 1 
      : this.currentIndex - 1;
    
    const result = this.currentResults[this.currentIndex];
    
    if (this.announcer) {
      this.announcer.announce(
        `Result ${this.currentIndex + 1} of ${this.currentResults.length}: ${result.title}`
      );
    }
    
    return result;
  }

  /**
   * Jump to specific result
   */
  jumpToResult(index) {
    if (this.destroyed || index < 0 || index >= this.currentResults.length) {
      return null;
    }
    
    this.currentIndex = index;
    return this.currentResults[index];
  }

  /**
   * Get current result
   */
  getCurrentResult() {
    if (this.destroyed || this.currentIndex < 0) return null;
    return this.currentResults[this.currentIndex];
  }

  /**
   * Refresh current search
   */
  refreshSearch() {
    if (this.destroyed || !this.currentQuery) return [];
    
    const oldIndex = this.currentIndex;
    const oldResultId = this.currentResults[oldIndex]?.nodeId;
    
    const results = this.search(this.currentQuery, this.currentOptions);
    
    // Try to maintain position
    if (oldResultId) {
      const newIndex = results.findIndex(r => r.nodeId === oldResultId);
      if (newIndex >= 0) {
        this.currentIndex = newIndex;
      } else {
        this.currentIndex = Math.min(oldIndex, results.length - 1);
      }
    }
    
    return results;
  }

  /**
   * Get highlighted content for result
   */
  getHighlightedContent(result, options = {}) {
    if (!result || !result.content) return '';
    
    const tag = options.tag || this.options.highlightTag;
    const className = options.className || '';
    const classAttr = className ? ` class="${className}"` : '';
    
    let highlighted = result.content;
    
    // Sort matches by position (reverse to avoid position shifts)
    const sortedMatches = [...(result.matches || [])]
      .sort((a, b) => b.position - a.position);
    
    // Apply highlights
    sortedMatches.forEach(match => {
      const before = highlighted.substring(0, match.position);
      const matchText = highlighted.substring(match.position, match.position + match.length);
      const after = highlighted.substring(match.position + match.length);
      
      highlighted = `${before}<${tag}${classAttr}>${matchText}</${tag}>${after}`;
    });
    
    return highlighted;
  }

  /**
   * Export search results
   */
  exportResults(format = 'json') {
    if (this.destroyed) return '';
    
    switch (format.toLowerCase()) {
      case 'json':
        return this._exportJSON();
      
      case 'csv':
        return this._exportCSV();
      
      case 'html':
        return this._exportHTML();
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Get search statistics
   */
  getSearchStatistics() {
    if (this.destroyed) return {};
    
    const totalMatches = this.currentResults.reduce(
      (sum, result) => sum + (result.matches?.length || 0), 0
    );
    
    const scores = this.currentResults.map(r => r.score || 0);
    const averageScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;
    
    return {
      query: this.currentQuery,
      totalResults: this.currentResults.length,
      totalMatches,
      nodesWithMatches: this.currentResults.length,
      averageScore,
      highestScore: Math.max(...scores, 0),
      lowestScore: Math.min(...scores, 0),
      searchDuration: this._lastSearchDuration || 0
    };
  }

  /**
   * Get search history
   */
  getSearchHistory() {
    return [...this.searchHistory];
  }

  /**
   * Navigate to previous search in history
   */
  previousSearch() {
    if (this.destroyed || this.searchHistory.length < 2) return null;
    
    // Skip current search (index 0) and go to previous
    const previousIndex = 1;
    if (previousIndex >= this.searchHistory.length) return null;
    
    const historyItem = this.searchHistory[previousIndex];
    if (historyItem) {
      this.search(historyItem.query, historyItem.options);
    }
    
    return historyItem;
  }

  /**
   * Navigate to next search in history
   */
  nextSearch() {
    if (this.destroyed || this.searchHistory.length === 0) return null;
    
    // Can only go to next if we went to previous first
    if (this.historyIndex === -1 || this.historyIndex === 0) {
      return this.searchHistory[0];
    }
    
    this.historyIndex--;
    const historyItem = this.searchHistory[this.historyIndex];
    
    if (historyItem) {
      this.search(historyItem.query, historyItem.options);
    }
    
    return historyItem;
  }

  /**
   * Clear search history
   */
  clearHistory() {
    this.searchHistory = [];
    this.historyIndex = -1;
  }

  /**
   * Set announcer for accessibility
   */
  setAnnouncer(announcer) {
    this.announcer = announcer;
  }

  /**
   * Apply filters to search results
   * @private
   */
  _applyFilters(results, options) {
    let filtered = results;
    
    // Filter by node type
    if (options.nodeTypes && options.nodeTypes.length > 0) {
      filtered = filtered.filter(r => options.nodeTypes.includes(r.type));
    }
    
    // Filter by depth
    if (options.maxDepth !== undefined) {
      filtered = filtered.filter(r => r.depth <= options.maxDepth);
    }
    
    // Filter by path pattern
    if (options.pathPattern) {
      const pattern = new RegExp(options.pathPattern);
      filtered = filtered.filter(r => pattern.test(r.path?.join('/')));
    }
    
    // Apply custom filter
    if (options.filter) {
      filtered = filtered.filter(options.filter);
    }
    
    return filtered;
  }

  /**
   * Enhance search result with context
   * @private
   */
  _enhanceResult(result, query, options) {
    const enhanced = { ...result };
    
    // Extract contexts for each match
    if (result.matches && result.matches.length > 0) {
      const content = result.content || '';
      enhanced.contexts = result.matches.map(match => 
        this._extractContext(content, match, options)
      );
      
      // Use first match for main context
      enhanced.context = enhanced.contexts[0];
    } else {
      // No matches means no context
      enhanced.context = { before: '', match: '', after: '', position: 0 };
    }
    
    // Generate highlighted content
    enhanced.highlightedContent = this.getHighlightedContent(result);
    
    // Add breadcrumb
    if (result.path) {
      enhanced.breadcrumb = result.path.join(' > ');
    }
    
    return enhanced;
  }

  /**
   * Extract context around match
   * @private
   */
  _extractContext(content, match, options) {
    if (!content || !match) {
      return { before: '', match: '', after: '', position: 0 };
    }

    const contextWindow = options.contextWindow || this.options.contextWindow;
    const halfWindow = Math.floor(contextWindow / 2);
    
    // Handle both position and positions array
    const position = match.position !== undefined ? match.position : 
                    (match.positions && match.positions.length > 0 ? match.positions[0].start : 0);
    const length = match.length || match.match?.length || 0;
    
    const start = Math.max(0, position - halfWindow);
    const end = Math.min(content.length, position + length + halfWindow);
    
    let before = content.substring(start, position);
    let matchText = content.substring(position, position + length);
    let after = content.substring(position + length, end);
    
    // Trim to word boundaries
    if (start > 0) {
      const firstSpace = before.indexOf(' ');
      if (firstSpace > 0) before = '...' + before.substring(firstSpace);
    }
    
    if (end < content.length) {
      const lastSpace = after.lastIndexOf(' ');
      if (lastSpace >= 0) after = after.substring(0, lastSpace) + '...';
    }
    
    return {
      before: before.trim(),
      match: matchText,
      after: after.trim(),
      position: position
    };
  }

  /**
   * Add search to history
   * @private
   */
  _addToHistory(query, resultCount, options) {
    const historyItem = {
      query,
      resultCount,
      options: { ...options },
      timestamp: Date.now()
    };
    
    // Add to beginning of history
    this.searchHistory.unshift(historyItem);
    
    // Limit history size
    if (this.searchHistory.length > this.options.maxHistorySize) {
      this.searchHistory.pop();
    }
    
    // Reset history navigation
    this.historyIndex = -1;
  }

  /**
   * Export results as JSON
   * @private
   */
  _exportJSON() {
    const stats = this.getSearchStatistics();
    const data = {
      query: this.currentQuery,
      options: this.currentOptions,
      results: this.currentResults,
      statistics: stats,
      totalResults: stats.totalResults,
      timestamp: new Date().toISOString()
    };
    
    return JSON.stringify(data, null, 2);
  }

  /**
   * Export results as CSV
   * @private
   */
  _exportCSV() {
    const headers = ['Node ID', 'Title', 'Match', 'Context'];
    const rows = [headers];
    
    this.currentResults.forEach(result => {
      const firstMatch = result.matches?.[0];
      const context = result.context 
        ? `${result.context.before} [${result.context.match}] ${result.context.after}`
        : '';
      
      rows.push([
        result.nodeId,
        result.title || '',
        firstMatch?.match || '',
        context
      ]);
    });
    
    return rows.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
  }

  /**
   * Export results as HTML
   * @private
   */
  _exportHTML() {
    const html = [`
      <html>
      <head>
        <title>Search Results: ${this._escapeHTML(this.currentQuery)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          mark { background-color: yellow; }
          .context { font-style: italic; color: #666; }
        </style>
      </head>
      <body>
        <h1>Search Results</h1>
        <p>Query: <strong>${this._escapeHTML(this.currentQuery)}</strong></p>
        <p>Results: ${this.currentResults.length}</p>
        <table>
          <tr>
            <th>Title</th>
            <th>Type</th>
            <th>Score</th>
            <th>Matches</th>
            <th>Context</th>
          </tr>
    `];
    
    this.currentResults.forEach(result => {
      html.push(`
        <tr>
          <td>${this._escapeHTML(result.title || result.nodeId)}</td>
          <td>${this._escapeHTML(result.type || '')}</td>
          <td>${result.score?.toFixed(2) || '0'}</td>
          <td>${result.matches?.length || 0}</td>
          <td class="context">${result.highlightedContent || ''}</td>
        </tr>
      `);
    });
    
    html.push(`
        </table>
      </body>
      </html>
    `);
    
    return html.join('');
  }

  /**
   * Escape HTML characters
   * @private
   */
  _escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Destroy manager
   */
  destroy() {
    if (this.destroyed) return;
    
    this.destroyed = true;
    this.cancelSearch();
    
    this.currentQuery = null;
    this.currentResults = [];
    this.currentIndex = -1;
    this.searchHistory = [];
    this.historyIndex = -1;
    this.announcer = null;
  }
}