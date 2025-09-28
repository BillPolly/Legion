/**
 * ID generation utilities - pure JavaScript implementation
 * Replaces uuid package dependency
 */

/**
 * Generate a unique ID using timestamp and random string
 * Format: timestamp-randomstring
 * @returns {string} Unique identifier
 */
export function generateId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `${timestamp}-${random}`;
}

/**
 * Generate a short ID (just random part)
 * @returns {string} Short unique identifier
 */
export function generateShortId() {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Generate a prefixed ID
 * @param {string} prefix - Prefix for the ID
 * @returns {string} Prefixed unique identifier
 */
export function generatePrefixedId(prefix) {
  return `${prefix}-${generateId()}`;
}

// Default export
export default generateId;