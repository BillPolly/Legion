/**
 * Shared utilities for Legion framework
 */

/**
 * Generate a GUID (Globally Unique Identifier)
 * @returns {string} A UUID v4 compliant GUID
 */
export function generateGuid() {
  // UUID v4 implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Generate a short ID (useful for temporary identifiers)
 * @param {number} length - Length of the ID (default: 8)
 * @returns {string} A random alphanumeric string
 */
export function generateShortId(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a timestamp-based ID
 * @returns {string} An ID with timestamp and random component
 */
export function generateTimestampId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${timestamp}-${random}`;
}

/**
 * Serialize an object with support for circular references
 * @param {any} obj - The object to serialize
 * @returns {string} JSON string representation
 */
export function serialize(obj) {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  });
}

/**
 * Deserialize a JSON string back to an object
 * @param {string} str - The JSON string to deserialize
 * @returns {any} The deserialized object
 */
export function deserialize(str) {
  return JSON.parse(str);
}

// Export all functions as default object as well
export default {
  generateGuid,
  generateShortId,
  generateTimestampId,
  serialize,
  deserialize
};