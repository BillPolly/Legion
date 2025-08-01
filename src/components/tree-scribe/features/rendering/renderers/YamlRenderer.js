/**
 * YamlRenderer - Renders YAML objects with recursive nested structure display
 */

import { BaseRenderer } from './PlaintextRenderer.js';

export class YamlRenderer extends BaseRenderer {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxArrayPreview: 5,
      maxObjectPreview: 5,
      showTypeAnnotations: false,
      maxDepth: 50,
      theme: 'light',
      ...options
    };
    
    this.supportedTypes = ['yaml', 'yml', 'text/yaml', 'application/yaml'];
    this.circularRefs = new WeakSet();
  }

  /**
   * Check if this renderer can handle the given content type
   */
  canRender(contentType) {
    if (!contentType || typeof contentType !== 'string') {
      return false;
    }
    
    return this.supportedTypes.includes(contentType.toLowerCase());
  }

  /**
   * Render YAML content into container
   */
  render(content, container) {
    // Validate container
    if (!container) {
      throw new Error('Container is required for rendering');
    }
    
    if (!container.nodeType || container.nodeType !== Node.ELEMENT_NODE) {
      throw new Error('Container must be a DOM element');
    }

    try {
      // Clear existing content
      container.innerHTML = '';

      // Create content wrapper
      const contentDiv = document.createElement('div');
      contentDiv.className = 'yaml-content renderer-content';
      
      // Apply theme
      if (this.options.theme) {
        contentDiv.classList.add(`theme-${this.options.theme}`);
      }
      
      // Reset circular reference tracking
      this.circularRefs = new WeakSet();
      
      // Handle content
      const processedContent = this._processContent(content);
      contentDiv.appendChild(processedContent);
      
      // Add interactive features
      this._addInteractiveFeatures(contentDiv);
      
      container.appendChild(contentDiv);
      
      return container;
    } catch (error) {
      throw new Error(`Failed to render YAML content: ${error.message}`);
    }
  }

  /**
   * Process content for YAML rendering
   * @private
   */
  _processContent(content) {
    // Handle null, undefined, or invalid content
    if (content === null) {
      return this._renderPrimitive(null, 'null', 0);
    }
    
    if (content === undefined) {
      return this._renderPrimitive(undefined, 'undefined', 0);
    }
    
    if (typeof content === 'function' || typeof content === 'symbol') {
      return this._renderPrimitive(`[${typeof content}]`, 'special', 0);
    }
    
    if (content instanceof Date) {
      return this._renderPrimitive(content.toISOString(), 'date', 0);
    }
    
    // Render the content recursively
    return this._renderValue(content, 0);
  }

  /**
   * Render a value based on its type
   * @private
   */
  _renderValue(value, depth) {
    if (depth > this.options.maxDepth) {
      return this._renderPrimitive('[Max Depth Exceeded]', 'error', depth);
    }

    // Check for circular references
    if (value && typeof value === 'object' && this.circularRefs.has(value)) {
      return this._renderPrimitive('[Circular Reference]', 'error', depth);
    }

    const type = this._getValueType(value);
    
    switch (type) {
      case 'object':
        return this._renderObject(value, depth);
      case 'array':
        return this._renderArray(value, depth);
      default:
        return this._renderPrimitive(value, type, depth);
    }
  }

  /**
   * Get the type of a value for rendering
   * @private
   */
  _getValueType(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'unknown';
  }

  /**
   * Render an object
   * @private
   */
  _renderObject(obj, depth) {
    if (obj && typeof obj === 'object') {
      this.circularRefs.add(obj);
    }

    const container = document.createElement('div');
    container.className = 'yaml-object';
    container.setAttribute('data-depth', depth);

    const keys = Object.keys(obj);
    
    if (keys.length === 0) {
      container.textContent = '{}';
      container.classList.add('yaml-empty');
      return container;
    }

    // Create toggle button for collapsible content
    const toggle = document.createElement('button');
    toggle.className = 'yaml-toggle';
    toggle.textContent = '▼';
    toggle.setAttribute('aria-expanded', 'true');
    container.appendChild(toggle);

    // Create collapsible content container
    const content = document.createElement('div');
    content.className = 'yaml-collapsible';
    
    keys.forEach((key, index) => {
      const property = document.createElement('div');
      property.className = 'yaml-property';
      property.setAttribute('data-depth', depth + 1);
      
      const keyElement = document.createElement('span');
      keyElement.className = 'yaml-key';
      keyElement.textContent = key + ':';
      property.appendChild(keyElement);
      
      const valueElement = this._renderValue(obj[key], depth + 1);
      valueElement.classList.add('yaml-value');
      property.appendChild(valueElement);
      
      content.appendChild(property);
    });

    container.appendChild(content);

    // Add count indicator for collapsed state
    const count = document.createElement('span');
    count.className = 'yaml-count hidden';
    count.textContent = `{${keys.length} properties}`;
    container.appendChild(count);

    return container;
  }

  /**
   * Render an array
   * @private
   */
  _renderArray(arr, depth) {
    const container = document.createElement('div');
    container.className = 'yaml-array';
    container.setAttribute('data-depth', depth);

    if (arr.length === 0) {
      container.textContent = '[]';
      container.classList.add('yaml-empty');
      return container;
    }

    // Create toggle button for collapsible content
    const toggle = document.createElement('button');
    toggle.className = 'yaml-toggle';
    toggle.textContent = '▼';
    toggle.setAttribute('aria-expanded', 'true');
    container.appendChild(toggle);

    // Create collapsible content container
    const content = document.createElement('div');
    content.className = 'yaml-array-items yaml-collapsible';
    
    arr.forEach((item, index) => {
      const itemElement = document.createElement('div');
      itemElement.className = 'yaml-array-item';
      itemElement.setAttribute('data-depth', depth + 1);
      itemElement.setAttribute('data-index', index);
      
      const indexElement = document.createElement('span');
      indexElement.className = 'yaml-array-index';
      indexElement.textContent = `[${index}]:`;
      itemElement.appendChild(indexElement);
      
      const valueElement = this._renderValue(item, depth + 1);
      valueElement.classList.add('yaml-value');
      itemElement.appendChild(valueElement);
      
      content.appendChild(itemElement);
    });

    container.appendChild(content);

    // Add count indicator for collapsed state
    const count = document.createElement('span');
    count.className = 'yaml-count hidden';
    count.textContent = `[${arr.length} items]`;
    container.appendChild(count);

    return container;
  }

  /**
   * Render a primitive value
   * @private
   */
  _renderPrimitive(value, type, depth) {
    const element = document.createElement('span');
    element.className = `yaml-${type}`;
    element.setAttribute('data-depth', depth);
    
    let displayValue;
    
    switch (type) {
      case 'string':
        displayValue = `"${this._escapeString(value)}"`;
        break;
      case 'number':
        if (isNaN(value)) {
          displayValue = 'NaN';
        } else if (!isFinite(value)) {
          displayValue = value > 0 ? 'Infinity' : '-Infinity';
        } else {
          displayValue = String(value);
        }
        break;
      case 'boolean':
        displayValue = String(value);
        break;
      case 'null':
        displayValue = 'null';
        break;
      case 'undefined':
        displayValue = 'undefined';
        break;
      default:
        displayValue = String(value);
    }
    
    element.textContent = displayValue;
    
    if (this.options.showTypeAnnotations) {
      const annotation = document.createElement('span');
      annotation.className = 'yaml-type-annotation';
      annotation.textContent = ` (${type})`;
      element.appendChild(annotation);
    }
    
    return element;
  }

  /**
   * Escape string values for display
   * @private
   */
  _escapeString(str) {
    if (typeof str !== 'string') return str;
    
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * Add interactive features to rendered content
   * @private
   */
  _addInteractiveFeatures(contentDiv) {
    // Add collapse/expand functionality
    const toggles = contentDiv.querySelectorAll('.yaml-toggle');
    toggles.forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._toggleCollapse(toggle);
      });
    });
  }

  /**
   * Toggle collapse state of a structure
   * @private
   */
  _toggleCollapse(toggle) {
    const container = toggle.parentElement;
    const collapsibleContent = container.querySelector('.yaml-collapsible');
    const countIndicator = container.querySelector('.yaml-count');
    
    if (!collapsibleContent) return;
    
    const isCollapsed = collapsibleContent.classList.contains('collapsed');
    
    if (isCollapsed) {
      // Expand
      collapsibleContent.classList.remove('collapsed');
      countIndicator.classList.add('hidden');
      toggle.textContent = '▼';
      toggle.setAttribute('aria-expanded', 'true');
    } else {
      // Collapse
      collapsibleContent.classList.add('collapsed');
      countIndicator.classList.remove('hidden');
      toggle.textContent = '▶';
      toggle.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * Get supported content types
   */
  getSupportedTypes() {
    return [...this.supportedTypes];
  }

  /**
   * Get renderer description
   */
  getDescription() {
    return 'Renders YAML objects with recursive nested structure display, collapsible sections, and type-specific formatting';
  }
}