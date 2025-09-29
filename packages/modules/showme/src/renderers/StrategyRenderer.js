/**
 * StrategyRenderer - Specialized renderer for strategy Handles
 *
 * Extends HandleRenderer with strategy-specific features:
 * - Strategy metadata (name, type, capabilities)
 * - Requirements (tools, prompts)
 * - File information
 * - Strategy-specific actions (instantiate, view source, search similar)
 */

import { HandleRenderer } from './HandleRenderer.js';

export class StrategyRenderer extends HandleRenderer {
  constructor(options = {}) {
    super();
    this.name = 'StrategyRenderer';
    this.options = options;
  }

  /**
   * Render strategy Handle in container
   * @param {Object} strategyHandle - Strategy Handle instance
   * @param {HTMLElement} container - DOM element to render into
   * @returns {Promise<void>}
   */
  async render(strategyHandle, container) {
    // Validate inputs
    this._validateHandle(strategyHandle);
    this._validateContainer(container);

    // Validate it's a strategy Handle
    if (strategyHandle.resourceType !== 'strategy') {
      throw new Error('Handle must be a strategy Handle. Received: ' + strategyHandle.resourceType);
    }

    // Get strategy metadata
    let metadata = {};
    try {
      metadata = await strategyHandle.getMetadata();
    } catch (error) {
      throw new Error(`Failed to get strategy metadata: ${error.message}`);
    }

    // Build strategy-specific view
    const view = this.buildStrategyView(strategyHandle, metadata);

    // Render to container
    await this.displayStrategyView(view, container);
  }

  /**
   * Build strategy-specific view structure
   * @param {Object} strategyHandle - Strategy Handle
   * @param {Object} metadata - Strategy metadata
   * @returns {Object} View structure
   */
  buildStrategyView(strategyHandle, metadata) {
    return {
      header: {
        name: metadata.strategyName || 'Unknown Strategy',
        type: metadata.strategyType || 'unknown',
        uri: strategyHandle.toURI()
      },
      requirements: this.renderRequirements(metadata),
      capabilities: metadata.capabilities || [],
      file: this.renderFileInfo(metadata),
      actions: this.renderStrategyActions(strategyHandle, metadata)
    };
  }

  /**
   * Render requirements section (tools and prompts)
   * @param {Object} metadata - Strategy metadata
   * @returns {Object} Requirements data
   */
  renderRequirements(metadata) {
    return {
      tools: metadata.requiredTools || [],
      prompts: metadata.promptSchemas || []
    };
  }

  /**
   * Render file information section
   * @param {Object} metadata - Strategy metadata
   * @returns {Object} File information
   */
  renderFileInfo(metadata) {
    return {
      path: metadata.filePath || 'Unknown',
      size: metadata.fileSize || null,
      modified: metadata.lastModified || null
    };
  }

  /**
   * Render strategy-specific actions
   * @param {Object} strategyHandle - Strategy Handle
   * @param {Object} metadata - Strategy metadata
   * @returns {Array} Action list
   */
  renderStrategyActions(strategyHandle, metadata) {
    const actions = [];

    // Instantiate Strategy action
    actions.push({
      label: 'Instantiate Strategy',
      action: async () => {
        await this.instantiateStrategy(strategyHandle);
      }
    });

    // View Source action
    actions.push({
      label: 'View Source',
      action: async () => {
        await this.viewSource(metadata);
      }
    });

    // Search Similar action
    actions.push({
      label: 'Search Similar',
      action: async () => {
        await this.searchSimilar(metadata);
      }
    });

    // Include common Handle actions from parent
    const commonActions = super.renderActions(strategyHandle);
    return [...actions, ...commonActions];
  }

  /**
   * Display strategy view in container
   * @param {Object} view - View structure
   * @param {HTMLElement} container - Container element
   * @returns {Promise<void>}
   */
  async displayStrategyView(view, container) {
    const html = this._buildStrategyHTML(view);
    container.innerHTML = html;
  }

  /**
   * Build HTML for strategy view
   * @private
   */
  _buildStrategyHTML(view) {
    return `
      <div class="strategy-view">
        <div class="strategy-header">
          <h2>${view.header.name}</h2>
          <p class="strategy-type">Type: ${view.header.type}</p>
          <p class="uri">${view.header.uri}</p>
        </div>

        <div class="strategy-requirements">
          <h3>Requirements</h3>
          ${view.requirements.tools.length > 0 ? `
            <div class="required-tools">
              <h4>Required Tools</h4>
              <ul>
                ${view.requirements.tools.map(tool => `<li>${tool}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${view.requirements.prompts.length > 0 ? `
            <div class="prompt-schemas">
              <h4>Prompt Schemas</h4>
              <ul>
                ${view.requirements.prompts.map(prompt => `<li>${prompt}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>

        ${view.capabilities.length > 0 ? `
          <div class="strategy-capabilities">
            <h3>Capabilities</h3>
            <ul>
              ${view.capabilities.map(cap => `<li>${cap}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <div class="strategy-file-info">
          <h3>File Information</h3>
          <p><strong>Path:</strong> ${view.file.path}</p>
          ${view.file.size ? `<p><strong>Size:</strong> ${view.file.size} bytes</p>` : ''}
          ${view.file.modified ? `<p><strong>Modified:</strong> ${view.file.modified}</p>` : ''}
        </div>

        <div class="strategy-actions">
          <h3>Actions</h3>
          ${view.actions.map(action => `
            <button class="strategy-action">${action.label}</button>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Instantiate strategy (action handler)
   * @private
   */
  async instantiateStrategy(strategyHandle) {
    // To be implemented with ResourceManager integration
    console.log('Instantiate strategy:', strategyHandle.toURI());
  }

  /**
   * View source code (action handler)
   * @private
   */
  async viewSource(metadata) {
    // To be implemented with file loading
    console.log('View source:', metadata.filePath);
  }

  /**
   * Search for similar strategies (action handler)
   * @private
   */
  async searchSimilar(metadata) {
    // To be implemented with semantic search
    console.log('Search similar to:', metadata.strategyName);
  }
}