/**
 * DisplayEngine - Unified Handle visualization
 * Routes rendering to terminal or browser based on format
 * Eliminates redundancy by providing single interface
 */

import chalk from 'chalk';

export class DisplayEngine {
  constructor(showme, outputHandler, resourceManager) {
    if (!showme) {
      throw new Error('ShowMeController is required');
    }
    if (!outputHandler) {
      throw new Error('OutputHandler is required');
    }
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }

    this.showme = showme;
    this.outputHandler = outputHandler;
    this.resourceManager = resourceManager;
    this.mode = 'auto'; // 'terminal', 'browser', 'auto'
  }

  /**
   * Render a Handle with specified format
   * @param {Handle} handle - Handle to render
   * @param {Object} options - Rendering options
   * @returns {Promise<Object>} Render result
   */
  async render(handle, options = {}) {
    const format = options.format || 'auto';

    // Determine rendering mode
    if (this.shouldUseTerminal(handle, format)) {
      return await this.renderTerminal(handle, format);
    }

    // Browser rendering
    return await this.renderBrowser(handle, options);
  }

  /**
   * Render Handle in terminal
   * @param {Handle} handle - Handle to render
   * @param {string} format - Format (table, tree, json, summary)
   * @returns {Promise<Object>} Render result
   */
  async renderTerminal(handle, format) {
    switch (format) {
      case 'table':
        return this.renderTable(handle);
      case 'tree':
        return this.renderTree(handle);
      case 'json':
        return this.renderJSON(handle);
      case 'summary':
      default:
        return this.renderSummary(handle);
    }
  }

  /**
   * Render Handle as table
   * @param {Handle} handle - Handle to render
   * @returns {Object} Render result
   */
  renderTable(handle) {
    const data = this.extractHandleData(handle);
    const table = this.outputHandler.formatTable([data]);

    this.outputHandler.print(table);

    return {
      success: true,
      format: 'table',
      rendered: 'terminal'
    };
  }

  /**
   * Render Handle as JSON
   * @param {Handle} handle - Handle to render
   * @returns {Object} Render result
   */
  renderJSON(handle) {
    const data = this.extractHandleData(handle);
    const json = this.outputHandler.formatJSON(data, 2);

    this.outputHandler.print(json);

    return {
      success: true,
      format: 'json',
      rendered: 'terminal'
    };
  }

  /**
   * Render Handle as tree
   * @param {Handle} handle - Handle to render
   * @returns {Object} Render result
   */
  renderTree(handle) {
    const data = this.extractHandleData(handle);

    this.outputHandler.heading(`Handle: ${data.uri || data.id || 'Unknown'}`);

    // Simple tree rendering
    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        this.outputHandler.print(`├─ ${key}:`);
        Object.entries(value).forEach(([k, v]) => {
          this.outputHandler.print(`│  ├─ ${k}: ${v}`);
        });
      } else {
        this.outputHandler.print(`├─ ${key}: ${value}`);
      }
    });

    return {
      success: true,
      format: 'tree',
      rendered: 'terminal'
    };
  }

  /**
   * Render Handle as summary
   * @param {Handle} handle - Handle to render
   * @returns {Object} Render result
   */
  renderSummary(handle) {
    const data = this.extractHandleData(handle);

    this.outputHandler.heading(`Handle Summary`);
    this.outputHandler.print(`Type: ${data.resourceType || data.type || 'Unknown'}`);
    this.outputHandler.print(`ID: ${data.id || 'N/A'}`);

    if (data.uri) {
      this.outputHandler.print(`URI: ${data.uri}`);
    }

    if (data.title) {
      this.outputHandler.print(`Title: ${data.title}`);
    }

    return {
      success: true,
      format: 'summary',
      rendered: 'terminal'
    };
  }

  /**
   * Render Handle in browser
   * @param {Handle} handle - Handle to render
   * @param {Object} options - Browser options
   * @returns {Promise<Object>} Render result with Handle data
   */
  async renderBrowser(handle, options = {}) {
    // Extract Handle data for browser client
    let assetData;

    // Try getData() method first (for ImageHandle, etc.)
    if (typeof handle.getData === 'function') {
      try {
        assetData = await handle.getData();
      } catch (error) {
        console.error('Error calling getData():', error);
        assetData = this.extractHandleData(handle);
      }
    } else {
      assetData = this.extractHandleData(handle);
    }

    return {
      success: true,
      format: 'browser',
      rendered: 'browser',
      handle: handle,
      assetData: assetData,
      title: options.title || handle.title || handle.toURI?.() || handle.id || 'Handle',
      assetType: handle.resourceType || handle.type || 'unknown'
    };
  }

  /**
   * Determine if terminal rendering should be used
   * @param {Handle} handle - Handle to check
   * @param {string} format - Requested format
   * @returns {boolean} True if terminal rendering
   */
  shouldUseTerminal(handle, format) {
    // Explicit terminal formats
    if (['table', 'tree', 'json', 'summary'].includes(format)) {
      return true;
    }

    // Explicit browser format
    if (format === 'browser') {
      return false;
    }

    // Auto mode - check handle type
    if (format === 'auto') {
      // Use browser for complex types
      const complexTypes = ['strategy', 'image', 'visual', 'code', 'markup', 'style', 'data'];
      if (handle.resourceType && complexTypes.includes(handle.resourceType)) {
        return false;
      }

      // Default to terminal for simple data
      return true;
    }

    // Respect mode setting
    return this.mode === 'terminal';
  }

  /**
   * Extract data from Handle for rendering
   * @param {Handle} handle - Handle to extract from
   * @returns {Object} Extracted data
   */
  extractHandleData(handle) {
    // Try to get Handle properties
    const data = {};

    // Common Handle properties
    if (handle.id) data.id = handle.id;
    if (handle.resourceType) data.resourceType = handle.resourceType;
    if (handle.type) data.type = handle.type;
    if (handle.title) data.title = handle.title;

    // Try toURI method
    if (typeof handle.toURI === 'function') {
      data.uri = handle.toURI();
    }

    // Try getData method
    if (typeof handle.getData === 'function') {
      try {
        const handleData = handle.getData();
        Object.assign(data, handleData);
      } catch (e) {
        // getData might not be available
      }
    }

    // If Handle has direct properties, include them
    if (Object.keys(data).length === 0) {
      // Copy enumerable properties
      for (const key in handle) {
        if (handle.hasOwnProperty(key) && typeof handle[key] !== 'function') {
          data[key] = handle[key];
        }
      }
    }

    return data;
  }

  /**
   * Set display mode
   * @param {string} mode - Mode ('terminal', 'browser', 'auto')
   */
  setMode(mode) {
    if (!['terminal', 'browser', 'auto'].includes(mode)) {
      throw new Error(`Invalid mode: ${mode}. Must be 'terminal', 'browser', or 'auto'`);
    }
    this.mode = mode;
  }

  /**
   * Get display mode
   * @returns {string} Current mode
   */
  getMode() {
    return this.mode;
  }
}

export default DisplayEngine;
