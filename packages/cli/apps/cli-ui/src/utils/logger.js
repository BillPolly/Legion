/**
 * Logger utility with smart base64 truncation
 * Prevents large image data from polluting logs and context
 */

/**
 * Sanitize data for logging by truncating base64 encoded data
 * @param {any} data - Data to sanitize
 * @param {WeakSet} [visited] - Track visited objects to prevent circular references
 * @returns {any} - Sanitized data safe for logging
 */
export function sanitizeForLogging(data, visited = new WeakSet()) {
  // Handle null/undefined
  if (data == null) {
    return data;
  }

  // Handle base64 data URLs (images)
  if (typeof data === 'string' && data.startsWith('data:')) {
    const colonIndex = data.indexOf(':');
    const commaIndex = data.indexOf(',');

    if (colonIndex !== -1 && commaIndex !== -1) {
      const mimeType = data.substring(colonIndex + 1, commaIndex);
      const dataLength = data.length - commaIndex - 1;
      const preview = data.substring(0, Math.min(50, data.length));

      return `[DATA_URL: ${mimeType}, ${dataLength} bytes] ${preview}...`;
    }
  }

  // Handle very long base64 strings (non-data URL)
  if (typeof data === 'string' && data.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(data.substring(0, 100))) {
    return `[BASE64_STRING: ${data.length} bytes] ${data.substring(0, 50)}...`;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    // Check for circular reference
    if (visited.has(data)) {
      return '[Circular Reference]';
    }
    visited.add(data);
    return data.map(item => sanitizeForLogging(item, visited));
  }

  // Handle objects (recursively sanitize all properties)
  if (typeof data === 'object') {
    // Check for circular reference
    if (visited.has(data)) {
      return '[Circular Reference]';
    }
    visited.add(data);

    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeForLogging(value, visited);
    }
    return sanitized;
  }

  // Return primitives as-is
  return data;
}

/**
 * Log safely with automatic base64 truncation
 * @param {string} label - Log label/prefix
 * @param {...any} args - Arguments to log
 */
export function logSafely(label, ...args) {
  const sanitizedArgs = args.map(arg => sanitizeForLogging(arg));
  console.log(label, ...sanitizedArgs);
}

/**
 * Warn safely with automatic base64 truncation
 * @param {string} label - Warning label/prefix
 * @param {...any} args - Arguments to log
 */
export function warnSafely(label, ...args) {
  const sanitizedArgs = args.map(arg => sanitizeForLogging(arg));
  console.warn(label, ...sanitizedArgs);
}

/**
 * Error safely with automatic base64 truncation
 * @param {string} label - Error label/prefix
 * @param {...any} args - Arguments to log
 */
export function errorSafely(label, ...args) {
  const sanitizedArgs = args.map(arg => sanitizeForLogging(arg));
  console.error(label, ...sanitizedArgs);
}
