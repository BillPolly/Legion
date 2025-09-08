/**
 * JSONRenderer
 * 
 * Specialized renderer for displaying JSON data with syntax highlighting,
 * expand/collapse functionality, and formatting controls
 */

export class JSONRenderer {
  constructor(config = {}) {
    // Default configuration
    this.config = {
      maxDisplayLength: 10000,
      maxDepth: 50,
      showControls: false,
      autoFormat: true,
      indentSize: 2,
      ...config
    };

    // Track circular references during rendering
    this.visited = new Set();

    // Apply syntax highlighting styles
    this.applySyntaxStyles();
  }

  /**
   * Get current configuration
   * @returns {Object} Configuration object
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Check if this renderer can handle the given asset
   * @param {*} asset - Asset to check
   * @returns {boolean} True if renderer can handle this asset
   */
  canRender(asset) {
    // Check for JSON objects (arrays and objects)
    if (typeof asset === 'object' && asset !== null) {
      return true;
    }

    // Check for valid JSON strings
    if (typeof asset === 'string') {
      try {
        JSON.parse(asset);
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Render JSON asset to DOM element
   * @param {*} asset - JSON asset to render
   * @returns {Object} Render result with element and metadata
   */
  render(asset) {
    if (asset === null || asset === undefined) {
      throw new Error('Invalid JSON data provided');
    }

    // Parse string JSON if needed
    let jsonData;
    if (typeof asset === 'string') {
      try {
        jsonData = JSON.parse(asset);
      } catch (error) {
        throw new Error('Invalid JSON data provided');
      }
    } else {
      jsonData = asset;
    }

    // Create container element
    const container = document.createElement('div');
    container.className = 'json-renderer';
    container.setAttribute('role', 'tree');
    container.style.cssText = `
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #fafafa;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    `;

    // Create controls if enabled
    if (this.config.showControls) {
      const controls = this.createControls(jsonData);
      container.appendChild(controls);
    }

    // Store original data for later formatting
    this.originalData = jsonData;

    // Create content area
    const contentArea = document.createElement('div');
    contentArea.className = 'json-content';
    contentArea.style.cssText = `
      flex: 1;
      overflow: auto;
      padding: 12px;
      background: #ffffff;
    `;

    // Check if content should be truncated (handle circular references)
    let jsonString;
    try {
      jsonString = JSON.stringify(jsonData, null, this.config.indentSize);
    } catch (error) {
      // Handle circular references by using a replacer function
      const seen = new Set();
      jsonString = JSON.stringify(jsonData, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular Reference]';
          }
          seen.add(value);
        }
        return value;
      }, this.config.indentSize);
    }
    const shouldTruncate = jsonString.length > this.config.maxDisplayLength;

    if (shouldTruncate) {
      this.renderTruncated(contentArea, jsonData, jsonString);
    } else {
      this.renderFullJSON(contentArea, jsonData);
    }

    container.appendChild(contentArea);

    // Create result object
    const result = {
      element: container,
      jsonData: jsonData,
      originalAsset: asset
    };

    return result;
  }

  /**
   * Create control buttons for JSON interaction
   * @private
   * @param {*} jsonData - JSON data
   * @returns {HTMLElement} Controls element
   */
  createControls(jsonData) {
    const controls = document.createElement('div');
    controls.className = 'json-controls';
    controls.style.cssText = `
      display: flex;
      gap: 8px;
      padding: 8px;
      background: #f0f0f0;
      border-bottom: 1px solid #ddd;
    `;

    const buttons = [
      { class: 'expand-all', label: 'Expand All', text: '⊞', action: () => this.expandAll(controls.parentElement) },
      { class: 'collapse-all', label: 'Collapse All', text: '⊟', action: () => this.collapseAll(controls.parentElement) },
      { class: 'format-json', label: 'Format JSON', text: '{ }', action: () => this.formatJSON(controls.parentElement) },
      { class: 'copy-json', label: 'Copy JSON', text: '📋', action: () => this.copyJSON(jsonData) }
    ];

    buttons.forEach(({ class: className, label, text, action }) => {
      const button = document.createElement('button');
      button.className = className;
      button.textContent = text;
      button.title = label;
      button.setAttribute('aria-label', label);
      button.tabIndex = 0;
      
      button.style.cssText = `
        width: 32px;
        height: 32px;
        border: 1px solid #ccc;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
      `;

      button.addEventListener('click', action);
      controls.appendChild(button);
    });

    return controls;
  }

  /**
   * Render truncated JSON with expand option
   * @private
   * @param {HTMLElement} container - Container element
   * @param {*} jsonData - JSON data
   * @param {string} jsonString - Full JSON string
   */
  renderTruncated(container, jsonData, jsonString) {
    const truncated = jsonString.substring(0, this.config.maxDisplayLength);
    
    const truncatedDiv = document.createElement('div');
    truncatedDiv.className = 'json-truncated';
    truncatedDiv.style.cssText = `
      position: relative;
    `;

    // Render truncated content
    const preElement = document.createElement('pre');
    preElement.innerHTML = this.highlightJSON(truncated + '...');
    preElement.style.cssText = `
      margin: 0;
      white-space: pre-wrap;
      word-break: break-all;
    `;

    truncatedDiv.appendChild(preElement);

    // Add expand button
    const expandButton = document.createElement('button');
    expandButton.className = 'expand-full';
    expandButton.textContent = 'Show Full JSON';
    expandButton.style.cssText = `
      margin-top: 8px;
      padding: 8px 16px;
      background: #007acc;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;

    expandButton.addEventListener('click', () => {
      container.innerHTML = '';
      this.renderFullJSON(container, jsonData);
    });

    truncatedDiv.appendChild(expandButton);
    container.appendChild(truncatedDiv);
  }

  /**
   * Render full JSON with expand/collapse functionality
   * @private
   * @param {HTMLElement} container - Container element
   * @param {*} jsonData - JSON data
   */
  renderFullJSON(container, jsonData) {
    // Clear visited set for fresh rendering
    this.visited.clear();

    const jsonElement = this.renderValue(jsonData, 0);
    container.appendChild(jsonElement);
  }

  /**
   * Render individual JSON value with proper formatting
   * @private
   * @param {*} value - Value to render
   * @param {number} depth - Current nesting depth
   * @returns {HTMLElement} Rendered element
   */
  renderValue(value, depth = 0) {
    const wrapper = document.createElement('div');
    wrapper.className = 'json-node';
    wrapper.setAttribute('role', 'treeitem');

    // Handle depth limit
    if (depth > this.config.maxDepth) {
      wrapper.textContent = '[Max Depth Reached]';
      wrapper.style.color = '#666';
      return wrapper;
    }

    // Handle different value types
    if (value === null) {
      wrapper.innerHTML = '<span class="json-null">null</span>';
    } else if (typeof value === 'boolean') {
      wrapper.innerHTML = `<span class="json-boolean">${value}</span>`;
    } else if (typeof value === 'number') {
      wrapper.innerHTML = `<span class="json-number">${value}</span>`;
    } else if (typeof value === 'string') {
      wrapper.innerHTML = `<span class="json-string">"${this.escapeHTML(value)}"</span>`;
    } else if (Array.isArray(value)) {
      this.renderArray(wrapper, value, depth);
    } else if (typeof value === 'object') {
      // Check for circular reference
      if (this.visited.has(value)) {
        wrapper.innerHTML = '<span class="json-circular">[Circular Reference]</span>';
        wrapper.style.color = '#d73a49';
        return wrapper;
      }
      this.renderObject(wrapper, value, depth);
    }

    return wrapper;
  }

  /**
   * Render JSON array
   * @private
   * @param {HTMLElement} wrapper - Wrapper element
   * @param {Array} array - Array to render
   * @param {number} depth - Current depth
   */
  renderArray(wrapper, array, depth) {
    this.visited.add(array);

    if (array.length === 0) {
      wrapper.innerHTML = '<span class="json-punctuation">[]</span>';
      return;
    }

    const toggle = document.createElement('span');
    toggle.className = 'json-toggle expanded';
    toggle.textContent = '▼';
    toggle.style.cssText = `
      cursor: pointer;
      margin-right: 4px;
      user-select: none;
    `;

    const openBracket = document.createElement('span');
    openBracket.className = 'json-punctuation';
    openBracket.textContent = '[';

    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'json-items json-expanded';
    itemsContainer.style.cssText = `
      margin-left: 16px;
      border-left: 1px solid #eee;
      padding-left: 8px;
    `;

    // Render array items
    array.forEach((item, index) => {
      const itemElement = this.renderValue(item, depth + 1);
      
      if (index < array.length - 1) {
        const comma = document.createElement('span');
        comma.className = 'json-punctuation';
        comma.textContent = ',';
        itemElement.appendChild(comma);
      }
      
      itemsContainer.appendChild(itemElement);
    });

    const closeBracket = document.createElement('span');
    closeBracket.className = 'json-punctuation';
    closeBracket.textContent = ']';

    // Toggle functionality
    toggle.addEventListener('click', () => {
      this.toggleExpansion(toggle, itemsContainer);
    });

    wrapper.appendChild(toggle);
    wrapper.appendChild(openBracket);
    wrapper.appendChild(itemsContainer);
    wrapper.appendChild(closeBracket);
  }

  /**
   * Render JSON object
   * @private
   * @param {HTMLElement} wrapper - Wrapper element
   * @param {Object} obj - Object to render
   * @param {number} depth - Current depth
   */
  renderObject(wrapper, obj, depth) {
    this.visited.add(obj);

    const keys = Object.keys(obj);
    if (keys.length === 0) {
      wrapper.innerHTML = '<span class="json-punctuation">{}</span>';
      return;
    }

    const toggle = document.createElement('span');
    toggle.className = 'json-toggle expanded';
    toggle.textContent = '▼';
    toggle.style.cssText = `
      cursor: pointer;
      margin-right: 4px;
      user-select: none;
    `;

    const openBrace = document.createElement('span');
    openBrace.className = 'json-punctuation';
    openBrace.textContent = '{';

    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'json-items json-expanded';
    itemsContainer.style.cssText = `
      margin-left: 16px;
      border-left: 1px solid #eee;
      padding-left: 8px;
    `;

    // Render object properties
    keys.forEach((key, index) => {
      const itemElement = document.createElement('div');
      itemElement.className = 'json-property';
      
      const keyElement = document.createElement('span');
      keyElement.className = 'json-key';
      keyElement.innerHTML = `"${this.escapeHTML(key)}":`;
      keyElement.style.color = '#032f62';
      
      const valueElement = this.renderValue(obj[key], depth + 1);
      valueElement.style.marginLeft = '8px';
      valueElement.style.display = 'inline-block';
      
      itemElement.appendChild(keyElement);
      itemElement.appendChild(valueElement);
      
      if (index < keys.length - 1) {
        const comma = document.createElement('span');
        comma.className = 'json-punctuation';
        comma.textContent = ',';
        itemElement.appendChild(comma);
      }
      
      itemsContainer.appendChild(itemElement);
    });

    const closeBrace = document.createElement('span');
    closeBrace.className = 'json-punctuation';
    closeBrace.textContent = '}';

    // Toggle functionality
    toggle.addEventListener('click', () => {
      this.toggleExpansion(toggle, itemsContainer);
    });

    wrapper.appendChild(toggle);
    wrapper.appendChild(openBrace);
    wrapper.appendChild(itemsContainer);
    wrapper.appendChild(closeBrace);
  }

  /**
   * Toggle expand/collapse state
   * @private
   * @param {HTMLElement} toggle - Toggle element
   * @param {HTMLElement} container - Items container
   */
  toggleExpansion(toggle, container) {
    const isExpanded = toggle.classList.contains('expanded');
    
    if (isExpanded) {
      toggle.textContent = '▶';
      toggle.classList.remove('expanded');
      toggle.classList.add('collapsed');
      container.classList.remove('json-expanded');
      container.classList.add('json-collapsed');
      container.style.display = 'none';
    } else {
      toggle.textContent = '▼';
      toggle.classList.remove('collapsed');
      toggle.classList.add('expanded');
      container.classList.remove('json-collapsed');
      container.classList.add('json-expanded');
      container.style.display = 'block';
    }
  }

  /**
   * Expand all nodes
   * @private
   * @param {HTMLElement} container - Container element
   */
  expandAll(container) {
    const toggles = container.querySelectorAll('.json-toggle');
    toggles.forEach(toggle => {
      if (toggle.classList.contains('collapsed')) {
        toggle.click();
      }
    });
  }

  /**
   * Collapse all nodes
   * @private
   * @param {HTMLElement} container - Container element
   */
  collapseAll(container) {
    const toggles = container.querySelectorAll('.json-toggle');
    toggles.forEach(toggle => {
      if (toggle.classList.contains('expanded')) {
        toggle.click();
      }
    });
  }

  /**
   * Format JSON (re-render with proper formatting)
   * @private
   * @param {HTMLElement} container - Container element
   */
  formatJSON(container) {
    // Find the JSON content area and re-render with formatting
    const contentArea = container.querySelector('.json-content');
    if (contentArea && this.originalData !== undefined) {
      // Clear and re-render with proper formatting
      contentArea.innerHTML = '';
      
      // Ensure we're in pretty mode with newlines
      if (typeof this.originalData === 'string') {
        try {
          const parsed = JSON.parse(this.originalData);
          const formatted = JSON.stringify(parsed, null, 2);
          // Use a pre element to preserve formatting with actual newlines
          const pre = document.createElement('pre');
          pre.style.cssText = 'margin: 0; font-family: monospace;';
          pre.textContent = formatted;
          contentArea.appendChild(pre);
        } catch {
          // If it's not valid JSON, just re-render the tree
          const tree = this.renderValue(this.originalData, 0);
          contentArea.appendChild(tree);
        }
      } else {
        // For objects, convert to formatted JSON string
        const formatted = JSON.stringify(this.originalData, null, 2);
        const pre = document.createElement('pre');
        pre.style.cssText = 'margin: 0; font-family: monospace;';
        pre.textContent = formatted;
        contentArea.appendChild(pre);
      }
      
      // Visual feedback
      contentArea.style.backgroundColor = '#f0f8ff';
      setTimeout(() => {
        contentArea.style.backgroundColor = '#ffffff';
      }, 200);
    }
  }

  /**
   * Copy JSON to clipboard
   * @private
   * @param {*} jsonData - JSON data to copy
   */
  copyJSON(jsonData) {
    if (navigator.clipboard) {
      const jsonString = JSON.stringify(jsonData, null, 2);
      navigator.clipboard.writeText(jsonString).catch(() => {
        // Fallback: create temporary textarea
        this.fallbackCopyToClipboard(jsonString);
      });
    } else {
      // Fallback for older browsers
      this.fallbackCopyToClipboard(JSON.stringify(jsonData, null, 2));
    }
  }

  /**
   * Fallback clipboard copy method
   * @private
   * @param {string} text - Text to copy
   */
  fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-1000px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
    document.body.removeChild(textArea);
  }

  /**
   * Apply syntax highlighting to JSON string
   * @private
   * @param {string} json - JSON string
   * @returns {string} Highlighted HTML
   */
  highlightJSON(json) {
    return json
      .replace(/("(?:\\.|[^"\\])*")\s*:/g, '<span class="json-key">$1</span>:')
      .replace(/:\s*("(?:\\.|[^"\\])*")/g, ': <span class="json-string">$1</span>')
      .replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>')
      .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>')
      .replace(/:\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g, ': <span class="json-number">$1</span>')
      .replace(/([{}[\],])/g, '<span class="json-punctuation">$1</span>');
  }

  /**
   * Escape HTML in string values
   * @private
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Apply CSS styles for syntax highlighting
   * @private
   */
  applySyntaxStyles() {
    const styleId = 'json-renderer-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .json-string { color: #032f62; }
      .json-number { color: #005cc5; }
      .json-boolean { color: #d73a49; }
      .json-null { color: #6f42c1; }
      .json-key { color: #032f62; font-weight: bold; }
      .json-punctuation { color: #24292e; }
      .json-circular { color: #d73a49; font-style: italic; }
      
      .json-toggle {
        transition: transform 0.2s ease;
      }
      
      .json-collapsed {
        display: none !important;
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.visited.clear();
  }
}