/**
 * JsonRenderer Plugin - Example renderer plugin for JSON content
 * Demonstrates the plugin architecture for TreeScribe
 */

import { BaseRenderer } from '../renderers/PlaintextRenderer.js';

export class JsonRenderer extends BaseRenderer {
  getName() {
    return 'JsonRenderer';
  }

  getVersion() {
    return '1.0.0';
  }

  getInfo() {
    return {
      name: this.getName(),
      version: this.getVersion(),
      description: this.getDescription()
    };
  }

  getSupportedTypes() {
    return ['json', 'application/json'];
  }

  getDescription() {
    return 'Renders JSON content with syntax highlighting and collapsible sections';
  }

  canRender(contentType) {
    const supported = this.getSupportedTypes();
    const normalized = contentType ? contentType.toLowerCase() : '';
    return supported.includes(normalized) || normalized.endsWith('.json');
  }

  render(content, options = {}) {
    const container = document.createElement('div');
    container.className = 'json-renderer';
    
    try {
      const jsonData = typeof content === 'string' ? JSON.parse(content) : content;
      const rendered = this._renderValue(jsonData, '', options.collapsed || false);
      container.appendChild(rendered);
    } catch (error) {
      container.innerHTML = `
        <div class="json-error">
          <span class="error-label">JSON Parse Error:</span>
          <span class="error-message">${this._escapeHtml(error.message)}</span>
        </div>
      `;
    }
    
    this._applyStyles(container);
    return container;
  }

  _renderValue(value, key = '', collapsed = false) {
    if (value === null) {
      return this._createSpan('null', 'json-null');
    }
    
    if (value === undefined) {
      return this._createSpan('undefined', 'json-undefined');
    }
    
    const type = typeof value;
    
    switch (type) {
      case 'boolean':
        return this._createSpan(String(value), 'json-boolean');
        
      case 'number':
        return this._createSpan(String(value), 'json-number');
        
      case 'string':
        return this._createSpan(`"${this._escapeHtml(value)}"`, 'json-string');
        
      case 'object':
        if (Array.isArray(value)) {
          return this._renderArray(value, key, collapsed);
        } else {
          return this._renderObject(value, key, collapsed);
        }
        
      default:
        return this._createSpan(String(value), 'json-unknown');
    }
  }

  _renderObject(obj, key, collapsed) {
    const container = document.createElement('div');
    container.className = 'json-object';
    
    const entries = Object.entries(obj);
    const isEmpty = entries.length === 0;
    
    // Header with toggle
    const header = document.createElement('div');
    header.className = 'json-header';
    
    if (!isEmpty) {
      const toggle = this._createToggle(collapsed);
      header.appendChild(toggle);
    }
    
    if (key) {
      header.appendChild(this._createSpan(`"${key}": `, 'json-key'));
    }
    
    header.appendChild(this._createSpan('{', 'json-brace'));
    
    if (isEmpty) {
      header.appendChild(this._createSpan('}', 'json-brace'));
    }
    
    container.appendChild(header);
    
    if (!isEmpty) {
      // Content
      const content = document.createElement('div');
      content.className = 'json-content';
      if (collapsed) {
        content.style.display = 'none';
      }
      
      entries.forEach(([k, v], index) => {
        const item = document.createElement('div');
        item.className = 'json-item';
        
        const keySpan = this._createSpan(`"${k}": `, 'json-key');
        item.appendChild(keySpan);
        
        const valueElement = this._renderValue(v, '', false);
        item.appendChild(valueElement);
        
        if (index < entries.length - 1) {
          item.appendChild(this._createSpan(',', 'json-comma'));
        }
        
        content.appendChild(item);
      });
      
      container.appendChild(content);
      
      // Closing brace
      const footer = document.createElement('div');
      footer.className = 'json-footer';
      footer.appendChild(this._createSpan('}', 'json-brace'));
      container.appendChild(footer);
    }
    
    return container;
  }

  _renderArray(arr, key, collapsed) {
    const container = document.createElement('div');
    container.className = 'json-array';
    
    const isEmpty = arr.length === 0;
    
    // Header
    const header = document.createElement('div');
    header.className = 'json-header';
    
    if (!isEmpty) {
      const toggle = this._createToggle(collapsed);
      header.appendChild(toggle);
    }
    
    if (key) {
      header.appendChild(this._createSpan(`"${key}": `, 'json-key'));
    }
    
    header.appendChild(this._createSpan('[', 'json-bracket'));
    
    if (isEmpty) {
      header.appendChild(this._createSpan(']', 'json-bracket'));
    }
    
    container.appendChild(header);
    
    if (!isEmpty) {
      // Content
      const content = document.createElement('div');
      content.className = 'json-content';
      if (collapsed) {
        content.style.display = 'none';
      }
      
      arr.forEach((item, index) => {
        const itemContainer = document.createElement('div');
        itemContainer.className = 'json-item';
        
        const valueElement = this._renderValue(item, '', false);
        itemContainer.appendChild(valueElement);
        
        if (index < arr.length - 1) {
          itemContainer.appendChild(this._createSpan(',', 'json-comma'));
        }
        
        content.appendChild(itemContainer);
      });
      
      container.appendChild(content);
      
      // Closing bracket
      const footer = document.createElement('div');
      footer.className = 'json-footer';
      footer.appendChild(this._createSpan(']', 'json-bracket'));
      container.appendChild(footer);
    }
    
    return container;
  }

  _createToggle(collapsed) {
    const toggle = document.createElement('button');
    toggle.className = 'json-toggle';
    toggle.textContent = collapsed ? '▶' : '▼';
    toggle.setAttribute('aria-expanded', !collapsed);
    toggle.setAttribute('aria-label', collapsed ? 'Expand' : 'Collapse');
    
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      const header = toggle.parentElement;
      const container = header.parentElement;
      const content = container.querySelector('.json-content');
      
      if (content) {
        const isCollapsed = content.style.display === 'none';
        content.style.display = isCollapsed ? '' : 'none';
        toggle.textContent = isCollapsed ? '▼' : '▶';
        toggle.setAttribute('aria-expanded', isCollapsed);
        toggle.setAttribute('aria-label', isCollapsed ? 'Collapse' : 'Expand');
      }
    });
    
    return toggle;
  }

  _createSpan(text, className) {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    return span;
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  _applyStyles(container) {
    // Apply inline styles for plugin isolation
    const style = document.createElement('style');
    style.textContent = `
      .json-renderer {
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        font-size: 13px;
        line-height: 1.5;
        color: #333;
      }
      
      .json-toggle {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0 4px;
        font-size: 10px;
        color: #666;
        user-select: none;
      }
      
      .json-toggle:hover {
        color: #000;
      }
      
      .json-key {
        color: #881391;
        font-weight: bold;
      }
      
      .json-string {
        color: #1a1aa6;
      }
      
      .json-number {
        color: #008000;
      }
      
      .json-boolean {
        color: #0000ff;
        font-weight: bold;
      }
      
      .json-null {
        color: #808080;
        font-weight: bold;
      }
      
      .json-undefined {
        color: #808080;
        font-style: italic;
      }
      
      .json-brace,
      .json-bracket {
        color: #000;
        font-weight: bold;
      }
      
      .json-comma {
        color: #000;
      }
      
      .json-content {
        padding-left: 20px;
      }
      
      .json-error {
        color: #d00;
        padding: 10px;
        background: #fee;
        border: 1px solid #fcc;
        border-radius: 3px;
      }
      
      .json-error .error-label {
        font-weight: bold;
        margin-right: 8px;
      }
    `;
    
    container.appendChild(style);
  }
}

// Plugin initialization function
export function init(context) {
  // Register renderer with the registry when plugin loads
  const renderer = new JsonRenderer();
  
  // If registry is available in context, auto-register
  if (context.registry) {
    context.registry.register(renderer);
  }
  
  return renderer;
}

// Export default for dynamic import
export default JsonRenderer;