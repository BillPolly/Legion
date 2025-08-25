/**
 * ResourceProvider - Abstract base class for resource providers
 * Follows Clean Architecture - defines interface for resource serving
 */

export class ResourceProvider {
  /**
   * Get a resource by path
   * @param {string} path - Resource path (e.g., '/styles.css', '/favicon.ico')
   * @param {Request} req - HTTP request object for context
   * @returns {Promise<ResourceResponse|null>} Resource response or null if not found
   */
  async getResource(path, req) {
    throw new Error('ResourceProvider.getResource() must be implemented');
  }

  /**
   * List available resources (optional)
   * @returns {Promise<Array<string>>} Array of available resource paths
   */
  async listResources() {
    return [];
  }
}

/**
 * ResourceResponse - Standard response format
 */
export class ResourceResponse {
  constructor(options = {}) {
    this.type = options.type || 'text/plain';  // MIME type
    this.content = options.content || null;    // String content
    this.file = options.file || null;          // File path to serve
    this.status = options.status || 200;       // HTTP status
    this.headers = options.headers || {};      // Additional headers
    this.cache = options.cache || false;       // Cache control
  }
}