/**
 * @fileoverview SearchLogsTool - Search and retrieve logs with multiple search modes
 */

import { Tool } from '@legion/tools-registry';
import { jsonSchemaToZod } from '@legion/schema';

export class SearchLogsTool extends Tool {
  constructor(module) {
    super({
      name: 'search_logs',
      description: 'Search across all captured logs using keyword, semantic, or regex search with comprehensive filtering options',
      schema: {
        input: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query string',
            minLength: 1
          },
          sessionId: {
            type: 'string',
            description: 'Optional session ID to search within',
            minLength: 1
          },
          searchMode: {
            type: 'string',
            enum: ['keyword', 'semantic', 'regex', 'hybrid'],
            description: 'Search mode: keyword (default), semantic, regex, or hybrid (combines semantic and keyword)',
            default: 'keyword'
          },
          source: {
            type: 'string',
            enum: ['stdout', 'stderr', 'system', 'frontend'],
            description: 'Filter by log source type'
          },
          startTime: {
            type: 'string',
            format: 'date-time',
            description: 'Start time for filtering logs (ISO 8601 format)'
          },
          endTime: {
            type: 'string',
            format: 'date-time',
            description: 'End time for filtering logs (ISO 8601 format)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return',
            minimum: 1,
            maximum: 1000,
            default: 100
          },
          offset: {
            type: 'number',
            description: 'Number of results to skip for pagination',
            minimum: 0,
            default: 0
          }
        },
        required: ['query'],
        additionalProperties: false
        }
      }
    });
    
    this.module = module;
    this.validator = jsonSchemaToZod(this.inputSchema);
  }

  async _execute(args) {
    // Validate input
    const validatedArgs = this.validator.parse(args);
    
    this.emit('progress', { percentage: 0, status: 'Starting log search...' });
    
    try {
      let logs = [];
      let searchMode = validatedArgs.searchMode || 'keyword';
      const filters = {};
      
      // Validate session if specified
      if (validatedArgs.sessionId) {
        const session = await this.module.sessionManager.getSession(validatedArgs.sessionId);
        if (!session) {
          throw new Error(`Session not found: ${validatedArgs.sessionId}`);
        }
        filters.sessionId = validatedArgs.sessionId;
      }
      
      // Add time filters if specified
      if (validatedArgs.startTime) {
        filters.startTime = new Date(validatedArgs.startTime);
      }
      if (validatedArgs.endTime) {
        filters.endTime = new Date(validatedArgs.endTime);
      }
      
      // Add source filter if specified
      if (validatedArgs.source) {
        filters.source = validatedArgs.source;
      }
      
      this.emit('progress', { percentage: 20, status: `Performing ${searchMode} search...` });
      
      // Perform search based on mode
      if (searchMode === 'semantic') {
        this.emit('info', { message: `Performing semantic search for: ${validatedArgs.query}` });
        
        try {
          // Attempt semantic search
          logs = await this.module.logSearch.semanticSearch(
            validatedArgs.query,
            validatedArgs.sessionId,
            validatedArgs.limit
          );
        } catch (error) {
          // Fall back to keyword search if semantic search fails
          this.emit('warning', { message: 'Semantic search unavailable, falling back to keyword search' });
          searchMode = 'keyword';
          logs = await this.performKeywordSearch(validatedArgs, filters);
          
          return {
            logs: this.paginateLogs(logs, validatedArgs.limit, validatedArgs.offset),
            totalResults: logs.length,
            searchMode,
            sessionId: validatedArgs.sessionId,
            query: validatedArgs.query,
            filters,
            warning: 'Falling back to keyword search due to semantic search unavailability',
            pagination: {
              limit: validatedArgs.limit,
              offset: validatedArgs.offset,
              hasMore: logs.length > (validatedArgs.offset + validatedArgs.limit)
            }
          };
        }
      } else if (searchMode === 'regex') {
        this.emit('info', { message: `Performing regex search: ${validatedArgs.query}` });
        logs = await this.performRegexSearch(validatedArgs, filters);
      } else if (searchMode === 'hybrid') {
        this.emit('info', { message: `Performing hybrid search: ${validatedArgs.query}` });
        logs = await this.performHybridSearch(validatedArgs, filters);
      } else {
        // Default keyword search
        this.emit('info', { message: `Performing keyword search: ${validatedArgs.query}` });
        logs = await this.performKeywordSearch(validatedArgs, filters);
      }
      
      this.emit('progress', { percentage: 60, status: 'Processing search results...' });
      
      // Apply additional filters
      if (filters.source) {
        const sourceLogs = await this.module.logStorage.getLogsBySource(
          validatedArgs.sessionId || null,
          filters.source
        );
        // Intersect with search results
        const sourceLogIds = new Set(sourceLogs.map(log => log.logId));
        logs = logs.filter(log => sourceLogIds.has(log.logId));
      }
      
      if (filters.startTime || filters.endTime) {
        const timeRangeLogs = await this.module.logStorage.getLogsInTimeRange(
          validatedArgs.sessionId || null,
          filters.startTime || new Date(0),
          filters.endTime || new Date()
        );
        // Intersect with search results
        const timeLogIds = new Set(timeRangeLogs.map(log => log.logId));
        logs = logs.filter(log => timeLogIds.has(log.logId));
      }
      
      this.emit('progress', { percentage: 80, status: 'Formatting results...' });
      
      // Apply pagination
      const paginatedLogs = this.paginateLogs(logs, validatedArgs.limit, validatedArgs.offset);
      
      this.emit('progress', { percentage: 100, status: 'Search completed' });
      this.emit('info', { 
        message: `Found ${logs.length} matching logs, returning ${paginatedLogs.length}` 
      });
      
      return {
        logs: paginatedLogs,
        totalResults: logs.length,
        searchMode,
        sessionId: validatedArgs.sessionId,
        query: validatedArgs.query,
        filters,
        pagination: {
          limit: validatedArgs.limit,
          offset: validatedArgs.offset,
          hasMore: logs.length > (validatedArgs.offset + validatedArgs.limit)
        }
      };
      
    } catch (error) {
      this.emit('error', {
        message: `Search failed: ${error.message}`,
        error: error.name
      });
      throw error;
    }
  }

  async performKeywordSearch(args, filters) {
    // Use LogSearch for keyword search if available
    if (this.module.logSearch) {
      return await this.module.logSearch.keywordSearch(
        args.query,
        args.sessionId || null,
        args.limit
      );
    }
    
    // Fallback to direct storage search
    if (args.sessionId) {
      return await this.module.logStorage.searchLogs(args.sessionId, args.query);
    } else {
      // Search across all sessions
      const allSessions = await this.module.sessionManager.listSessions();
      const allLogs = [];
      
      for (const session of allSessions) {
        const sessionLogs = await this.module.logStorage.searchLogs(session.sessionId, args.query);
        allLogs.push(...sessionLogs);
      }
      
      return allLogs;
    }
  }

  async performRegexSearch(args, filters) {
    // Use LogSearch for regex search if available
    if (this.module.logSearch) {
      return await this.module.logSearch.regexSearch(
        args.query,
        args.sessionId || null,
        args.limit
      );
    }
    
    // Fallback to manual regex search
    let allLogs;
    
    if (args.sessionId) {
      allLogs = await this.module.logStorage.getLogsBySession(args.sessionId);
    } else {
      // Get all logs
      const allSessions = await this.module.sessionManager.listSessions();
      allLogs = [];
      
      for (const session of allSessions) {
        const sessionLogs = await this.module.logStorage.getLogsBySession(session.sessionId);
        allLogs.push(...sessionLogs);
      }
    }
    
    // Apply regex filter
    try {
      const regex = new RegExp(args.query);
      return allLogs.filter(log => regex.test(log.message));
    } catch (error) {
      throw new Error(`Invalid regex pattern: ${args.query}`);
    }
  }

  async performHybridSearch(args, filters) {
    // Use LogSearch for hybrid search if available
    if (this.module.logSearch) {
      return await this.module.logSearch.hybridSearch(
        args.query,
        args.sessionId || null,
        args.limit
      );
    }
    
    // Fallback to keyword search if LogSearch not available
    return await this.performKeywordSearch(args, filters);
  }

  paginateLogs(logs, limit, offset) {
    return logs.slice(offset, offset + limit);
  }
}