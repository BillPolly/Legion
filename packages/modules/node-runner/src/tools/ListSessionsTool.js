/**
 * @fileoverview ListSessionsTool - List and filter run sessions with statistics
 */

import { Tool } from '../base/Tool.js';
import { jsonSchemaToZod } from '@legion/schema';

export class ListSessionsTool extends Tool {
  constructor(module) {
    super({
      name: 'list_sessions',
      description: 'List and filter run sessions with optional statistics and sorting',
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'running', 'completed', 'failed', 'terminated'],
            description: 'Filter sessions by status'
          },
          projectPath: {
            type: 'string',
            description: 'Filter sessions by project path',
            minLength: 1
          },
          startedAfter: {
            type: 'string',
            format: 'date-time',
            description: 'Filter sessions started after this time (ISO 8601)'
          },
          startedBefore: {
            type: 'string',
            format: 'date-time',
            description: 'Filter sessions started before this time (ISO 8601)'
          },
          includeStatistics: {
            type: 'boolean',
            description: 'Include detailed statistics for each session',
            default: false
          },
          sortBy: {
            type: 'string',
            enum: ['startTime', 'endTime', 'status', 'projectPath'],
            description: 'Field to sort sessions by',
            default: 'startTime'
          },
          sortOrder: {
            type: 'string',
            enum: ['asc', 'desc'],
            description: 'Sort order (ascending or descending)',
            default: 'desc'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of sessions to return',
            minimum: 1,
            maximum: 1000,
            default: 100
          },
          offset: {
            type: 'number',
            description: 'Number of sessions to skip for pagination',
            minimum: 0,
            default: 0
          }
        },
        additionalProperties: false
      }
    });
    
    this.module = module;
    this.validator = jsonSchemaToZod(this.inputSchema);
  }

  async execute(args = {}) {
    // Validate input
    const validatedArgs = this.validator.parse(args);
    
    this.emit('progress', { percentage: 0, status: 'Retrieving sessions...' });
    
    try {
      // Get all sessions from SessionManager
      const allSessions = await this.module.sessionManager.listSessions();
      
      this.emit('progress', { percentage: 20, status: 'Filtering sessions...' });
      
      // Apply filters
      let filteredSessions = this.applyFilters(allSessions, validatedArgs);
      
      // Track applied filters for response
      const filters = {};
      if (validatedArgs.status) filters.status = validatedArgs.status;
      if (validatedArgs.projectPath) filters.projectPath = validatedArgs.projectPath;
      if (validatedArgs.startedAfter) filters.startedAfter = validatedArgs.startedAfter;
      if (validatedArgs.startedBefore) filters.startedBefore = validatedArgs.startedBefore;
      
      if (Object.keys(filters).length > 0) {
        this.emit('info', { 
          message: `Filtering sessions with: ${JSON.stringify(filters)}` 
        });
      }
      
      this.emit('progress', { percentage: 40, status: 'Sorting sessions...' });
      
      // Apply sorting
      const sortBy = validatedArgs.sortBy || 'startTime';
      const sortOrder = validatedArgs.sortOrder || 'desc';
      filteredSessions = this.sortSessions(filteredSessions, sortBy, sortOrder);
      
      // Store total count before pagination
      const totalCount = filteredSessions.length;
      
      this.emit('progress', { percentage: 60, status: 'Applying pagination...' });
      
      // Apply pagination
      const limit = validatedArgs.limit || 100;
      const offset = validatedArgs.offset || 0;
      const paginatedSessions = filteredSessions.slice(offset, offset + limit);
      
      this.emit('progress', { percentage: 80, status: 'Gathering statistics...' });
      
      // Add statistics if requested
      let sessionsWithStats = paginatedSessions;
      if (validatedArgs.includeStatistics) {
        sessionsWithStats = await this.addStatistics(paginatedSessions);
      }
      
      // Format dates as ISO strings
      const formattedSessions = sessionsWithStats.map(session => ({
        ...session,
        startTime: session.startTime instanceof Date ? 
          session.startTime.toISOString() : session.startTime,
        endTime: session.endTime instanceof Date ? 
          session.endTime.toISOString() : session.endTime
      }));
      
      this.emit('progress', { percentage: 100, status: 'Sessions retrieved' });
      this.emit('info', { 
        message: `Found ${totalCount} sessions, returning ${formattedSessions.length}` 
      });
      
      return {
        success: true,
        sessions: formattedSessions,
        totalCount,
        filters,
        pagination: {
          limit,
          offset,
          hasMore: totalCount > (offset + limit)
        }
      };
      
    } catch (error) {
      this.emit('error', {
        message: `Failed to list sessions: ${error.message}`,
        error: error.name
      });
      throw error;
    }
  }

  applyFilters(sessions, args) {
    let filtered = [...sessions];
    
    // Filter by status
    if (args.status) {
      filtered = filtered.filter(s => s.status === args.status);
    }
    
    // Filter by project path
    if (args.projectPath) {
      filtered = filtered.filter(s => s.projectPath === args.projectPath);
    }
    
    // Filter by start time range
    if (args.startedAfter) {
      const afterTime = new Date(args.startedAfter);
      filtered = filtered.filter(s => {
        const startTime = s.startTime instanceof Date ? s.startTime : new Date(s.startTime);
        return startTime >= afterTime;
      });
    }
    
    if (args.startedBefore) {
      const beforeTime = new Date(args.startedBefore);
      filtered = filtered.filter(s => {
        const startTime = s.startTime instanceof Date ? s.startTime : new Date(s.startTime);
        return startTime <= beforeTime;
      });
    }
    
    return filtered;
  }

  sortSessions(sessions, sortBy, sortOrder) {
    const sorted = [...sessions];
    
    sorted.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'startTime':
          aVal = a.startTime instanceof Date ? a.startTime : new Date(a.startTime);
          bVal = b.startTime instanceof Date ? b.startTime : new Date(b.startTime);
          break;
        case 'endTime':
          aVal = a.endTime instanceof Date ? a.endTime : new Date(a.endTime || 0);
          bVal = b.endTime instanceof Date ? b.endTime : new Date(b.endTime || 0);
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'projectPath':
          aVal = a.projectPath;
          bVal = b.projectPath;
          break;
        default:
          aVal = a.startTime instanceof Date ? a.startTime : new Date(a.startTime);
          bVal = b.startTime instanceof Date ? b.startTime : new Date(b.startTime);
      }
      
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }

  async addStatistics(sessions) {
    const sessionsWithStats = [];
    
    for (const session of sessions) {
      try {
        const statistics = await this.module.sessionManager.getSessionStatistics(session.sessionId);
        sessionsWithStats.push({
          ...session,
          statistics
        });
      } catch (error) {
        // If statistics retrieval fails, just skip adding them
        this.emit('warning', { 
          message: `Failed to get statistics for session ${session.sessionId}: ${error.message}` 
        });
        sessionsWithStats.push(session);
      }
    }
    
    return sessionsWithStats;
  }
}