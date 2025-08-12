/**
 * LogSearchEngine - Fast search optimized for FullStackMonitor agent data
 * Provides efficient searching across Sidewinder and Browser agent logs
 * Silent operation to prevent infinite recursion
 */

import { EventEmitter } from 'events';

export class LogSearchEngine extends EventEmitter {
  constructor(storageProvider) {
    super();
    this.storageProvider = storageProvider;
    this.searchStats = {
      totalSearches: 0,
      averageSearchTime: 0,
      lastSearchTime: null
    };
  }

  /**
   * Search agent logs with optimized queries
   */
  async searchAgentLogs(agentType, query, options = {}) {
    const startTime = Date.now();
    this.searchStats.totalSearches++;

    try {
      let results;

      if (this.storageProvider && this.storageProvider.search) {
        // Use storage provider's search if available
        results = await this.storageProvider.search(query, {
          ...options,
          agentType: agentType // Filter by agent type
        });
      } else if (this.storageProvider && this.storageProvider.getLogs) {
        // Fallback to manual filtering
        const sessionId = options.sessionId;
        const allLogs = await this.storageProvider.getLogs(sessionId);
        results = this._filterLogs(allLogs, agentType, query, options);
      } else {
        // No storage provider available
        results = { matches: [], total: 0 };
      }

      // Update search stats
      const searchTime = Date.now() - startTime;
      this._updateSearchStats(searchTime);

      // Emit search event
      this.emit('search-completed', {
        agentType,
        query,
        resultCount: results.matches ? results.matches.length : results.total || 0,
        searchTime
      });

      return results;

    } catch (error) {
      // Emit error event instead of console logging
      this.emit('search-error', {
        agentType,
        query,
        error: error.message,
        searchTime: Date.now() - startTime
      });

      return { matches: [], total: 0, error: error.message };
    }
  }

  /**
   * Search for logs related to a correlation ID
   */
  async searchCorrelated(correlationId, options = {}) {
    const startTime = Date.now();

    try {
      // Search in both agent types
      const [sidewinderResults, browserResults] = await Promise.all([
        this.searchAgentLogs('sidewinder', correlationId, options),
        this.searchAgentLogs('browser', correlationId, options)
      ]);

      const combinedResults = {
        correlationId,
        backend: sidewinderResults.matches || [],
        frontend: browserResults.matches || [],
        total: (sidewinderResults.matches?.length || 0) + (browserResults.matches?.length || 0),
        searchTime: Date.now() - startTime
      };

      this.emit('correlation-search-completed', combinedResults);
      
      return combinedResults;

    } catch (error) {
      this.emit('correlation-search-error', {
        correlationId,
        error: error.message
      });

      return {
        correlationId,
        backend: [],
        frontend: [],
        total: 0,
        error: error.message
      };
    }
  }

  /**
   * Search with advanced filters for agent-specific data
   */
  async searchWithFilters(filters = {}) {
    const {
      agentTypes = ['sidewinder', 'browser'],
      levels = [],
      timeRange = {},
      correlationId = null,
      processId = null,
      sessionId = null,
      query = '',
      limit = 100
    } = filters;

    const results = {
      matches: [],
      total: 0,
      agentBreakdown: {}
    };

    try {
      // Search each agent type
      for (const agentType of agentTypes) {
        const agentResults = await this.searchAgentLogs(agentType, query, {
          sessionId,
          levels,
          timeRange,
          correlationId,
          processId,
          limit
        });

        if (agentResults.matches) {
          results.matches.push(...agentResults.matches);
          results.agentBreakdown[agentType] = agentResults.matches.length;
        }
      }

      // Sort combined results by timestamp
      results.matches.sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );

      // Apply final limit
      if (limit && results.matches.length > limit) {
        results.matches = results.matches.slice(0, limit);
      }

      results.total = results.matches.length;

      return results;

    } catch (error) {
      this.emit('advanced-search-error', {
        filters,
        error: error.message
      });

      return {
        matches: [],
        total: 0,
        agentBreakdown: {},
        error: error.message
      };
    }
  }

  /**
   * Get recent logs from specific agent
   */
  async getRecentAgentLogs(agentType, count = 50, sessionId = null) {
    try {
      const results = await this.searchAgentLogs(agentType, '', {
        sessionId,
        limit: count,
        sortBy: 'timestamp',
        sortOrder: 'desc'
      });

      return results.matches || [];

    } catch (error) {
      this.emit('recent-logs-error', {
        agentType,
        error: error.message
      });

      return [];
    }
  }

  /**
   * Manual log filtering when storage provider doesn't support advanced search
   */
  _filterLogs(logs, agentType, query, options = {}) {
    let filtered = logs;

    // Filter by agent type (based on source or metadata)
    if (agentType) {
      filtered = filtered.filter(log => {
        return log.source === agentType || 
               log.agentType === agentType ||
               log.metadata?.agentType === agentType;
      });
    }

    // Filter by query string
    if (query) {
      const queryLower = query.toLowerCase();
      filtered = filtered.filter(log => {
        const searchText = `${log.message || ''} ${JSON.stringify(log.metadata || {})}`.toLowerCase();
        return searchText.includes(queryLower);
      });
    }

    // Filter by log levels
    if (options.levels && options.levels.length > 0) {
      filtered = filtered.filter(log => 
        options.levels.includes(log.level)
      );
    }

    // Filter by time range
    if (options.timeRange) {
      const { start, end } = options.timeRange;
      filtered = filtered.filter(log => {
        const logTime = new Date(log.timestamp);
        if (start && logTime < start) return false;
        if (end && logTime > end) return false;
        return true;
      });
    }

    // Filter by correlation ID
    if (options.correlationId) {
      filtered = filtered.filter(log => {
        return log.correlationId === options.correlationId ||
               log.metadata?.correlationId === options.correlationId ||
               (log.message && log.message.includes(options.correlationId));
      });
    }

    // Filter by process ID
    if (options.processId) {
      filtered = filtered.filter(log => 
        log.processId === options.processId
      );
    }

    // Sort results
    const sortBy = options.sortBy || 'timestamp';
    const sortOrder = options.sortOrder || 'asc';
    
    filtered.sort((a, b) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      
      if (sortOrder === 'desc') {
        return bVal > aVal ? 1 : -1;
      } else {
        return aVal > bVal ? 1 : -1;
      }
    });

    // Apply limit
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return {
      matches: filtered,
      total: filtered.length
    };
  }

  /**
   * Update search performance statistics
   */
  _updateSearchStats(searchTime) {
    this.searchStats.lastSearchTime = Date.now();
    
    // Update average search time using exponential moving average
    if (this.searchStats.averageSearchTime === 0) {
      this.searchStats.averageSearchTime = searchTime;
    } else {
      this.searchStats.averageSearchTime = 
        (this.searchStats.averageSearchTime * 0.8) + (searchTime * 0.2);
    }
  }

  /**
   * Get search performance statistics
   */
  getSearchStats() {
    return {
      ...this.searchStats,
      averageSearchTime: Math.round(this.searchStats.averageSearchTime)
    };
  }

  /**
   * Clear search statistics
   */
  clearStats() {
    this.searchStats = {
      totalSearches: 0,
      averageSearchTime: 0,
      lastSearchTime: null
    };
  }
}