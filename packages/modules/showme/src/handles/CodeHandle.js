/**
 * CodeHandle - Handle implementation for code/text file assets
 *
 * Extends Handle to provide code access through the Handle/DataSource pattern.
 * When serialized and sent to client, becomes a RemoteHandle that can call
 * getData() and other methods asynchronously through Actor messages.
 */

import { Handle } from '@legion/handle';

export class CodeHandle extends Handle {
  /**
   * Create a CodeHandle
   * @param {Object} codeData - Code asset data
   * @param {string} codeData.id - Code identifier
   * @param {string} codeData.title - Code title (usually filename)
   * @param {string} codeData.language - Programming language (javascript, python, etc.)
   * @param {string} codeData.data - Code content as string
   * @param {number} [codeData.lineCount] - Number of lines in code
   */
  constructor(codeData) {
    // Create a simple DataSource that serves this code's data
    const dataSource = {
      // Query returns the code data
      query: (querySpec) => {
        if (querySpec?.read) {
          // Return code data for read operations
          return Promise.resolve([codeData.data]);
        }
        // Return metadata for other queries
        return Promise.resolve([{
          id: codeData.id,
          title: codeData.title,
          language: codeData.language,
          lineCount: codeData.lineCount
        }]);
      },

      // Subscribe not needed for static code
      subscribe: () => {
        throw new Error('CodeHandle does not support subscriptions');
      },

      // queryBuilder for Handle-based queries
      queryBuilder: () => {
        throw new Error('CodeHandle does not support queryBuilder');
      },

      // Schema describes the code structure
      getSchema: () => ({
        type: 'code',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          language: { type: 'string' },
          data: { type: 'string' },
          lineCount: { type: 'number' }
        }
      })
    };

    // Call Handle constructor with DataSource
    super(dataSource);

    // Store code information
    this.codeData = codeData;
    this._handleType = 'CodeHandle';
  }

  /**
   * Get code data asynchronously
   * This method will be callable on RemoteHandle via Proxy
   * @returns {Promise<string>} Code content as string
   */
  async getData() {
    // On server: return data directly
    // On client (RemoteHandle): this call is proxied via _callRemote()
    return this.codeData.data;
  }

  /**
   * Get code metadata
   * @returns {Promise<Object>} Code metadata
   */
  async getMetadata() {
    return {
      id: this.codeData.id,
      title: this.codeData.title,
      language: this.codeData.language,
      lineCount: this.codeData.lineCount
    };
  }

  /**
   * Get programming language
   * @returns {Promise<string>} Language identifier
   */
  async getLanguage() {
    return this.codeData.language;
  }

  /**
   * Serialize for transmission
   * @returns {Object} Serialized representation
   */
  toJSON() {
    return {
      _handleType: 'CodeHandle',
      id: this.codeData.id,
      title: this.codeData.title,
      language: this.codeData.language,
      lineCount: this.codeData.lineCount,
      // Don't include data in JSON - getData() will be called remotely
      resourceType: 'code'
    };
  }
}
