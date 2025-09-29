/**
 * HandleRenderer - Generic renderer for Legion Handles
 *
 * Provides introspection view for any Handle type with:
 * - Header (URI, type, server)
 * - Properties (from schema)
 * - Methods (callable functions)
 * - Capabilities (from metadata)
 * - Actions (interactive buttons)
 */

export class HandleRenderer {
  constructor() {
    this.name = 'HandleRenderer';
  }

  /**
   * Render Handle in container
   * @param {Object} handle - Handle instance to render
   * @param {HTMLElement} container - DOM element to render into
   * @returns {Promise<void>}
   */
  async render(handle, container) {
    // Validate inputs
    this._validateHandle(handle);
    this._validateContainer(container);

    // Extract Handle metadata (optional, not all Handles have this)
    let metadata = {};
    if (typeof handle.getMetadata === 'function') {
      try {
        metadata = await handle.getMetadata();
      } catch (error) {
        // Metadata is optional, continue without it
        console.warn('Failed to get Handle metadata:', error.message);
      }
    }

    // Extract Handle schema (optional)
    let schema = {};
    if (typeof handle.getSchema === 'function') {
      try {
        schema = await handle.getSchema();
      } catch (error) {
        // Schema is optional, continue without it
        console.warn('Failed to get Handle schema:', error.message);
      }
    }

    // Build introspection view
    const view = {
      header: this.renderHeader(handle),
      properties: this.renderProperties(handle, schema),
      methods: this.renderMethods(handle),
      capabilities: this.renderCapabilities(metadata),
      actions: this.renderActions(handle)
    };

    // Render to container
    await this.displayInWindow(view, container);

    // Setup live updates if Handle supports subscriptions
    if (typeof handle.subscribe === 'function') {
      try {
        handle.subscribe((changes) => {
          this.updateView(changes);
        });
      } catch (error) {
        // Subscriptions are optional
        console.warn('Handle does not support subscriptions:', error.message);
      }
    }
  }

  /**
   * Validate Handle parameter
   * @private
   */
  _validateHandle(handle) {
    if (!handle) {
      throw new Error('Handle is required for rendering');
    }

    if (typeof handle.toURI !== 'function') {
      throw new Error('Handle must have toURI() method');
    }

    if (!handle.resourceType) {
      throw new Error('Handle must have resourceType property');
    }
  }

  /**
   * Validate container parameter
   * @private
   */
  _validateContainer(container) {
    if (!container) {
      throw new Error('Container is required for rendering');
    }

    // Check if it's a DOM element
    if (!(container instanceof Element)) {
      throw new Error('Container must be a DOM element');
    }
  }

  /**
   * Render Handle header information
   * @param {Object} handle - Handle instance
   * @returns {Object} Header data
   */
  renderHeader(handle) {
    return {
      uri: handle.toURI(),
      type: handle.resourceType,
      server: handle.server || 'local'
    };
  }

  /**
   * Render Handle properties from schema
   * @param {Object} handle - Handle instance
   * @param {Object} schema - Handle schema
   * @returns {Array} Property list
   */
  renderProperties(handle, schema) {
    const props = [];
    const schemaProps = schema.properties || {};

    for (const [key, value] of Object.entries(schemaProps)) {
      props.push({
        name: key,
        value: handle[key],
        type: value.type,
        description: value.description
      });
    }

    return props;
  }

  /**
   * Render Handle methods
   * @param {Object} handle - Handle instance
   * @returns {Array} Method list
   */
  renderMethods(handle) {
    const methods = [];

    // Extract methods from handle (exclude private methods starting with _)
    for (const key in handle) {
      if (typeof handle[key] === 'function' && !key.startsWith('_')) {
        methods.push({
          name: key,
          callable: true
        });
      }
    }

    return methods;
  }

  /**
   * Render Handle capabilities from metadata
   * @param {Object} metadata - Handle metadata
   * @returns {Array} Capabilities list
   */
  renderCapabilities(metadata) {
    if (!metadata || !metadata.capabilities) {
      return [];
    }

    return Array.isArray(metadata.capabilities)
      ? metadata.capabilities
      : [metadata.capabilities];
  }

  /**
   * Render Handle actions (interactive buttons)
   * @param {Object} handle - Handle instance
   * @returns {Array} Action list
   */
  renderActions(handle) {
    const actions = [];

    // Common Handle actions
    actions.push({
      label: 'Copy URI',
      action: () => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(handle.toURI());
        }
      }
    });

    actions.push({
      label: 'View JSON',
      action: () => {
        if (typeof handle.toJSON === 'function') {
          this.showJSON(handle.toJSON());
        } else {
          this.showJSON({ uri: handle.toURI(), type: handle.resourceType });
        }
      }
    });

    return actions;
  }

  /**
   * Display view in window (to be overridden by subclasses or configured)
   * @param {Object} view - View data structure
   * @param {HTMLElement} container - Container element
   * @returns {Promise<void>}
   */
  async displayInWindow(view, container) {
    // Default implementation: render as simple HTML
    const html = this._buildHTML(view);
    container.innerHTML = html;
  }

  /**
   * Build HTML from view structure
   * @private
   */
  _buildHTML(view) {
    return `
      <div class="handle-view">
        <div class="handle-header">
          <h2>${view.header.type}</h2>
          <p class="uri">${view.header.uri}</p>
          <p class="server">Server: ${view.header.server}</p>
        </div>

        ${view.properties.length > 0 ? `
          <div class="handle-properties">
            <h3>Properties</h3>
            <ul>
              ${view.properties.map(prop => `
                <li>
                  <strong>${prop.name}</strong>: ${prop.value}
                  ${prop.description ? `<br><small>${prop.description}</small>` : ''}
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        ${view.methods.length > 0 ? `
          <div class="handle-methods">
            <h3>Methods</h3>
            <ul>
              ${view.methods.map(method => `
                <li>${method.name}()</li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        ${view.capabilities.length > 0 ? `
          <div class="handle-capabilities">
            <h3>Capabilities</h3>
            <ul>
              ${view.capabilities.map(cap => `<li>${cap}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${view.actions.length > 0 ? `
          <div class="handle-actions">
            <h3>Actions</h3>
            ${view.actions.map(action => `
              <button class="handle-action">${action.label}</button>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Update view with changes (for subscription support)
   * @param {Object} changes - Changes to apply
   */
  updateView(changes) {
    // To be implemented when subscription support is added
    console.log('View update:', changes);
  }

  /**
   * Show JSON in viewer (to be implemented by specific display logic)
   * @param {Object} json - JSON data to show
   */
  showJSON(json) {
    console.log('JSON view:', json);
  }
}