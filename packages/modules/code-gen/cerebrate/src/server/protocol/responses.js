import { v4 as uuidv4 } from 'uuid';
import { MessageProtocol } from '../../shared/protocol/MessageProtocol.js';
import { WebSocketProtocol } from '../../shared/protocol/WebSocketProtocol.js';

/**
 * Response Formatter for Cerebrate
 * Standardizes and formats all response types
 */
export class ResponseFormatter {

  constructor() {
    this.version = '1.0.0';
    
    // Error code categories
    this.errorCategories = {
      // Client errors (4xx equivalent)
      'INVALID_SELECTOR': 'client_error',
      'INVALID_COMMAND': 'client_error',
      'INVALID_PARAMETERS': 'client_error',
      'ELEMENT_NOT_FOUND': 'client_error',
      'INVALID_MESSAGE': 'client_error',
      'UNAUTHORIZED': 'client_error',
      
      // Server errors (5xx equivalent)
      'AGENT_CRASH': 'server_error',
      'AGENT_TIMEOUT': 'server_error',
      'INTERNAL_ERROR': 'server_error',
      'AGENT_UNAVAILABLE': 'server_error',
      'CONNECTION_LOST': 'server_error'
    };
  }

  /**
   * Format success response
   * @param {string} commandId - Original command ID
   * @param {string} command - Command name
   * @param {*} data - Response data
   * @param {Object} metadata - Response metadata
   * @param {string} sessionId - Session ID
   * @param {Object} options - Formatting options
   * @returns {Object} - Formatted response
   */
  formatSuccessResponse(commandId, command, data, metadata = {}, sessionId, options = {}) {
    const { includeSystemMetadata = false, maxPayloadSize, maxArrayLength } = options;

    let processedData = data;

    // Handle data truncation if needed
    if (maxPayloadSize || maxArrayLength) {
      processedData = this.truncateData(data, { maxPayloadSize, maxArrayLength });
    }

    // Build metadata
    let finalMetadata = { ...metadata };
    if (includeSystemMetadata) {
      finalMetadata = {
        ...finalMetadata,
        timestamp: new Date().toISOString(),
        formatter_version: this.version,
        node_version: process.version
      };
    }

    // Use WebSocketProtocol for consistent formatting
    const response = WebSocketProtocol.formatSuccessResponse(
      commandId,
      command,
      processedData,
      finalMetadata,
      sessionId
    );

    // Add command_id to payload for correlation
    response.payload.command_id = commandId;

    // Handle null data properly
    if (data === null) {
      response.payload.data = null;
    }

    // Add truncation info if data was truncated
    if (processedData !== data && typeof processedData === 'object' && processedData !== null) {
      if (processedData.data_truncated) {
        response.payload.data_truncated = true;
        response.payload.original_size = JSON.stringify(data).length;
      }
    }

    return response;
  }

  /**
   * Format error response
   * @param {string} commandId - Original command ID
   * @param {string} errorCode - Error code
   * @param {string} errorMessage - Error message
   * @param {string} sessionId - Session ID
   * @param {Object} errorDetails - Additional error details
   * @returns {Object} - Formatted error response
   */
  formatErrorResponse(commandId, errorCode, errorMessage, sessionId, errorDetails) {
    const response = WebSocketProtocol.formatErrorResponse(
      commandId,
      errorCode,
      errorMessage,
      errorDetails,
      null, // suggestions
      sessionId
    );

    // Add error category
    const category = this.errorCategories[errorCode] || 'unknown_error';
    response.payload.error_category = category;

    // Add command_id to payload for correlation
    response.payload.command_id = commandId || null;

    return response;
  }

  /**
   * Format progress event
   * @param {string} commandId - Command ID
   * @param {Object} progress - Progress information
   * @param {string} sessionId - Session ID
   * @returns {Object} - Formatted progress event
   */
  formatProgressEvent(commandId, progress, sessionId) {
    // Calculate percentage if not provided
    if (progress.current !== undefined && progress.total !== undefined && progress.percentage === undefined) {
      progress.percentage = Math.round((progress.current / progress.total) * 100);
    }

    return WebSocketProtocol.formatProgressEvent(
      {
        command_id: commandId,
        progress
      },
      sessionId
    );
  }

  /**
   * Format suggestion event
   * @param {string} commandId - Command ID
   * @param {Object} suggestion - Suggestion details
   * @param {string} sessionId - Session ID
   * @returns {Object} - Formatted suggestion event
   */
  formatSuggestionEvent(commandId, suggestion, sessionId) {
    return {
      id: `evt-${uuidv4()}`,
      type: 'event',
      timestamp: new Date().toISOString(),
      session: sessionId,
      payload: {
        event_type: 'suggestion',
        command_id: commandId,
        suggestion
      }
    };
  }

  /**
   * Format state change event
   * @param {Object} stateChange - State change details
   * @param {string} sessionId - Session ID
   * @returns {Object} - Formatted state change event
   */
  formatStateChangeEvent(stateChange, sessionId) {
    return {
      id: `evt-${uuidv4()}`,
      type: 'event',
      timestamp: new Date().toISOString(),
      session: sessionId,
      payload: {
        event_type: 'state_change',
        state_change: stateChange
      }
    };
  }

  /**
   * Format debug event
   * @param {string} commandId - Command ID
   * @param {Object} debug - Debug information
   * @param {string} sessionId - Session ID
   * @returns {Object} - Formatted debug event
   */
  formatDebugEvent(commandId, debug, sessionId) {
    return {
      id: `evt-${uuidv4()}`,
      type: 'event',
      timestamp: new Date().toISOString(),
      session: sessionId,
      payload: {
        event_type: 'debug',
        command_id: commandId,
        debug
      }
    };
  }

  /**
   * Format batch response
   * @param {Array} results - Array of results
   * @param {string} batchCommand - Batch command name
   * @param {string} sessionId - Session ID
   * @returns {Object} - Formatted batch response
   */
  formatBatchResponse(results, batchCommand, sessionId) {
    const successResults = results.filter(r => r.success !== false);
    const errorResults = results.filter(r => r.success === false);

    const response = {
      id: `resp-${uuidv4()}`,
      type: 'response',
      timestamp: new Date().toISOString(),
      session: sessionId,
      payload: {
        status: 'success',
        command: batchCommand,
        batch_size: results.length,
        success_count: successResults.length,
        error_count: errorResults.length,
        partial_success: errorResults.length > 0 && successResults.length > 0,
        results: results
      }
    };

    return response;
  }

  /**
   * Extract metadata from agent result
   * @param {Object} agentResult - Agent execution result
   * @returns {Object} - Extracted metadata
   */
  extractMetadata(agentResult) {
    const metadata = {};

    if (agentResult.metrics) {
      metadata.metrics = agentResult.metrics;
      if (agentResult.metrics.total_time) {
        metadata.execution_time = agentResult.metrics.total_time;
      }
    }

    if (agentResult.execution_time) {
      metadata.execution_time = agentResult.execution_time;
    }

    return metadata;
  }

  /**
   * Merge multiple metadata sources
   * @param {...Object} sources - Metadata sources
   * @returns {Object} - Merged metadata
   */
  mergeMetadata(...sources) {
    return Object.assign({}, ...sources);
  }

  /**
   * Truncate data to fit size limits
   * @param {*} data - Data to truncate
   * @param {Object} options - Truncation options
   * @returns {*} - Truncated data
   * @private
   */
  truncateData(data, options = {}) {
    const { maxPayloadSize, maxArrayLength = 100 } = options;

    // Handle null or primitive data
    if (data === null || typeof data !== 'object') {
      return data;
    }

    // Deep clone to avoid modifying original
    let truncated = JSON.parse(JSON.stringify(data));
    let wasTruncated = false;

    // Truncate arrays
    const truncateArrays = (obj) => {
      for (const key in obj) {
        if (Array.isArray(obj[key]) && obj[key].length > maxArrayLength) {
          const originalLength = obj[key].length;
          obj[key] = obj[key].slice(0, maxArrayLength);
          obj[`${key}_truncated`] = true;
          obj[`total_${key}`] = originalLength;
          wasTruncated = true;
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          truncateArrays(obj[key]);
        }
      }
    };

    truncateArrays(truncated);

    // Check total size if maxPayloadSize is specified
    if (maxPayloadSize) {
      const currentSize = JSON.stringify(truncated).length;
      if (currentSize > maxPayloadSize) {
        // For large payloads, return a summary
        truncated = {
          data_truncated: true,
          summary: 'Data too large to include in response',
          original_type: Array.isArray(data) ? 'array' : 'object',
          original_size: JSON.stringify(data).length
        };
        wasTruncated = true;
      }
    }

    if (wasTruncated && typeof truncated === 'object' && !truncated.data_truncated) {
      truncated.data_truncated = true;
    }

    return truncated;
  }

  /**
   * Create a standardized error from exception
   * @param {Error} error - Error object
   * @param {string} commandId - Command ID
   * @param {string} sessionId - Session ID
   * @returns {Object} - Formatted error response
   */
  formatExceptionResponse(error, commandId, sessionId) {
    let errorCode = 'INTERNAL_ERROR';
    let errorDetails = {
      name: error.name,
      stack: error.stack
    };

    // Map common error types to codes
    if (error.code) {
      errorCode = error.code;
    } else if (error.name === 'TimeoutError') {
      errorCode = 'AGENT_TIMEOUT';
    } else if (error.name === 'NetworkError') {
      errorCode = 'CONNECTION_LOST';
    }

    return this.formatErrorResponse(
      commandId,
      errorCode,
      error.message,
      sessionId,
      errorDetails
    );
  }
}