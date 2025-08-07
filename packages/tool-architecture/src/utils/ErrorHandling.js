/**
 * Error handling utilities for the tool architecture
 */

/**
 * Custom error class for tool execution errors
 */
export class ToolError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'ToolError';
    this.tool = context.tool;
    this.input = context.input;
    this.module = context.module;
    this.timestamp = Date.now();
  }
}

/**
 * Create a standard error object
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {string} toolName - Name of the tool (optional)
 * @param {Object} additionalDetails - Additional error details (optional)
 * @returns {Object} Standard error object
 */
export function createStandardError(code, message, toolName = null, additionalDetails = {}) {
  const details = {
    timestamp: Date.now(),
    ...additionalDetails
  };

  if (toolName) {
    details.tool = toolName;
  }

  return {
    success: false,
    error: {
      code,
      message,
      details
    }
  };
}

/**
 * Standard error codes used across all tools
 */
export const ERROR_CODES = {
  // Input validation
  MISSING_PARAMETER: 'MISSING_PARAMETER',
  INVALID_PARAMETER: 'INVALID_PARAMETER',
  TYPE_MISMATCH: 'TYPE_MISMATCH',
  
  // Resource errors
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_UNAVAILABLE: 'RESOURCE_UNAVAILABLE',
  RESOURCE_LOCKED: 'RESOURCE_LOCKED',
  
  // Permission errors
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  AUTHORIZATION_FAILED: 'AUTHORIZATION_FAILED',
  
  // Operation errors
  OPERATION_FAILED: 'OPERATION_FAILED',
  OPERATION_TIMEOUT: 'OPERATION_TIMEOUT',
  OPERATION_CANCELLED: 'OPERATION_CANCELLED',
  
  // State errors
  INVALID_STATE: 'INVALID_STATE',
  PRECONDITION_FAILED: 'PRECONDITION_FAILED',
  
  // System errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  EXECUTION_ERROR: 'EXECUTION_ERROR'
};