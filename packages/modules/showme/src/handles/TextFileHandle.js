/**
 * TextFileHandle - Generic handle for text-based file assets
 *
 * Unified implementation for code, markup, and stylesheets.
 * Supports: JavaScript, TypeScript, Python, HTML, CSS, SVG, XML, JSON, YAML, Markdown, etc.
 *
 * The viewerType determines how the client renders the content:
 * - 'code': Syntax-highlighted code editor view
 * - 'markup': Rendered preview (HTML, SVG) with optional code view
 * - 'style': CSS preview with styled examples
 */

import { Handle } from '@legion/handle';

export class TextFileHandle extends Handle {
  /**
   * Create a TextFileHandle
   * @param {Object} fileData - File asset data
   * @param {string} fileData.id - File identifier
   * @param {string} fileData.title - File title (usually filename)
   * @param {string} fileData.content - File content as string
   * @param {string} fileData.language - Language/format (javascript, html, css, svg, etc.)
   * @param {string} fileData.viewerType - How to display: 'code', 'markup', or 'style'
   * @param {number} [fileData.lineCount] - Number of lines
   * @param {Object} [fileData.metadata] - Additional metadata
   */
  constructor(fileData) {
    // Validate required fields
    if (!fileData.content) throw new Error('TextFileHandle requires content');
    if (!fileData.language) throw new Error('TextFileHandle requires language');
    if (!fileData.viewerType) throw new Error('TextFileHandle requires viewerType');

    // Create DataSource
    const dataSource = {
      query: (querySpec) => {
        if (querySpec?.read) {
          return Promise.resolve([fileData.content]);
        }
        return Promise.resolve([{
          id: fileData.id,
          title: fileData.title,
          language: fileData.language,
          viewerType: fileData.viewerType,
          lineCount: fileData.lineCount,
          metadata: fileData.metadata
        }]);
      },

      subscribe: () => {
        throw new Error('TextFileHandle does not support subscriptions');
      },

      queryBuilder: () => {
        throw new Error('TextFileHandle does not support queryBuilder');
      },

      getSchema: () => ({
        type: 'text-file',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          language: { type: 'string' },
          viewerType: { type: 'string', enum: ['code', 'markup', 'style'] },
          content: { type: 'string' },
          lineCount: { type: 'number' },
          metadata: { type: 'object' }
        }
      })
    };

    super(dataSource);

    this.fileData = fileData;
    this._handleType = 'TextFileHandle';
  }

  /**
   * Get file content asynchronously
   * @returns {Promise<string>} File content
   */
  async getData() {
    return this.fileData.content;
  }

  /**
   * Get file metadata
   * @returns {Promise<Object>} File metadata
   */
  async getMetadata() {
    return {
      id: this.fileData.id,
      title: this.fileData.title,
      language: this.fileData.language,
      viewerType: this.fileData.viewerType,
      lineCount: this.fileData.lineCount,
      metadata: this.fileData.metadata || {}
    };
  }

  /**
   * Get language/format
   * @returns {Promise<string>} Language identifier
   */
  async getLanguage() {
    return this.fileData.language;
  }

  /**
   * Get viewer type
   * @returns {Promise<string>} Viewer type (code, markup, style)
   */
  async getViewerType() {
    return this.fileData.viewerType;
  }

  /**
   * Serialize for transmission
   * @returns {Object} Serialized representation
   */
  toJSON() {
    return {
      _handleType: 'TextFileHandle',
      id: this.fileData.id,
      title: this.fileData.title,
      language: this.fileData.language,
      viewerType: this.fileData.viewerType,
      lineCount: this.fileData.lineCount,
      metadata: this.fileData.metadata || {},
      resourceType: this.fileData.viewerType // 'code', 'markup', or 'style'
    };
  }
}
