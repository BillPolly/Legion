/**
 * Utility Functions for Jest Agent Wrapper
 * 
 * Common utility functions used across the application
 */

import { createHash } from 'crypto';

/**
 * Generates a unique ID based on content
 * @param {string} content - Content to hash
 * @returns {string} Unique identifier
 */
export function generateId(content) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return createHash('sha256').update(content + timestamp + random).digest('hex').substring(0, 16);
}

/**
 * Parses stack trace into structured format
 * @param {string} stackTrace - Raw stack trace
 * @returns {Object[]} Parsed stack frames
 */
export function parseStackTrace(stackTrace) {
  if (!stackTrace) return [];
  
  return stackTrace.split('\n')
    .filter(line => line.trim() && line.includes('at ')) // Only process lines with 'at '
    .map(line => {
      // Match: "at functionName (file:line:column)"
      const matchWithParens = line.match(/^\s*at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      if (matchWithParens) {
        return {
          function: matchWithParens[1],
          file: matchWithParens[2],
          line: parseInt(matchWithParens[3], 10),
          column: parseInt(matchWithParens[4], 10)
        };
      }
      
      // Match: "at file:line:column"
      const matchWithoutParens = line.match(/^\s*at\s+(.+?):(\d+):(\d+)$/);
      if (matchWithoutParens) {
        return {
          function: 'anonymous',
          file: matchWithoutParens[1],
          line: parseInt(matchWithoutParens[2], 10),
          column: parseInt(matchWithoutParens[3], 10)
        };
      }
      
      return { raw: line.trim() };
    });
}

/**
 * Extracts file location from error
 * @param {Error} error - Error object
 * @returns {Object} File location
 */
export function extractLocation(error) {
  const stack = parseStackTrace(error.stack);
  const frame = stack.find(f => f.file && !f.file.includes('node_modules'));
  
  return frame ? {
    file: frame.file,
    line: frame.line,
    column: frame.column
  } : null;
}
