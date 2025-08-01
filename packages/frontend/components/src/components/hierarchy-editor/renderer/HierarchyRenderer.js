/**
 * HierarchyRenderer - Unified renderer for hierarchical data structures
 * Supports expansion/collapse for all formats
 */

export class HierarchyRenderer {
  constructor(config = {}) {
    this.config = config;
    this.expansionState = config.expansionState || null;
    this.theme = config.theme || 'light';
    this.enableEditing = config.enableEditing !== false;
    this.onEdit = config.onEdit || (() => {});
    this.onClick = config.onClick || (() => {});
    this.onExpand = config.onExpand || (() => {});
    this.onCollapse = config.onCollapse || (() => {});
    
    // DOM element cache for performance
    this.domCache = new WeakMap();
  }

  /**
   * Render a hierarchy node to DOM
   * @param {HierarchyNode} node - Node to render
   * @param {Object} options - Rendering options
   * @returns {HTMLElement} Rendered DOM element
   */
  render(node, options = {}) {
    if (!node) {
      return this._createEmptyElement();
    }

    const {
      depth = 0,
      parentPath = '',
      formatHandler = null,
      isLast = true
    } = options;

    const element = this._createElement('div', {
      className: 'hierarchy-node',
      'data-node-id': node.id,
      'data-node-type': node.type,
      'data-depth': depth,
      style: `margin-left: ${depth * 20}px;`
    });

    // Check if this node is expandable
    const isExpandable = this._isExpandable(node);
    const nodePath = this._getNodePath(node, parentPath);
    
    // Special handling for root object node
    if (depth === 0 && node.type === 'object' && node.name === 'root') {
      const rootContainer = this._createElement('div', {
        className: 'hierarchy-root'
      });
      
      // Render children of root directly
      if (node.children && node.children.length > 0) {
        node.children.forEach((child, index) => {
          // Ensure child has parent reference for proper rendering
          if (!child.parent) {
            child.parent = node;
          }
          const childElement = this.render(child, {
            depth: depth + 1,
            parentPath: nodePath,
            formatHandler,
            isLast: index === node.children.length - 1
          });
          rootContainer.appendChild(childElement);
        });
      }
      
      return rootContainer;
    }
    const isExpanded = this.expansionState ? this.expansionState.isExpanded(nodePath) : true;

    // Create node content container
    const nodeContent = this._createElement('div', {
      className: 'node-content'
    });

    // Add expansion control if needed
    if (isExpandable) {
      const expandControl = this._createExpandControl(node, nodePath, isExpanded);
      nodeContent.appendChild(expandControl);
    } else {
      // Add spacer for alignment
      const spacer = this._createElement('span', {
        className: 'expand-spacer'
      });
      nodeContent.appendChild(spacer);
    }

    // Render node based on type
    const nodeElement = this._renderNodeContent(node, {
      depth,
      formatHandler,
      isExpanded,
      nodePath
    });
    nodeContent.appendChild(nodeElement);

    element.appendChild(nodeContent);

    // Render children if expanded
    if (isExpandable && isExpanded && node.children && node.children.length > 0) {
      const childrenContainer = this._createElement('div', {
        className: 'node-children'
      });

      node.children.forEach((child, index) => {
        // Ensure child has parent reference for proper rendering
        if (!child.parent) {
          child.parent = node;
        }
        const childElement = this.render(child, {
          depth: depth + 1,
          parentPath: nodePath,
          formatHandler,
          isLast: index === node.children.length - 1
        });
        childrenContainer.appendChild(childElement);
      });

      element.appendChild(childrenContainer);
    }

    // Add collapsed indicator if needed
    if (isExpandable && !isExpanded) {
      const summary = this._createCollapsedSummary(node);
      if (summary) {
        nodeContent.appendChild(summary);
      }
    }

    // Cache the element for updates
    this.domCache.set(node, element);

    return element;
  }

  /**
   * Render node content based on type
   * @private
   */
  _renderNodeContent(node, options) {
    const container = this._createElement('div', {
      className: 'node-value-container'
    });

    // Render key/name if present
    if (node.name || node.type === 'property') {
      const keyElement = this._renderKey(node, options);
      container.appendChild(keyElement);
    }

    // Render value based on node type
    switch (node.type) {
      case 'value':
      case 'property':
        // For property nodes, render the value part
        const valueNode = node.type === 'property' ? node.value : node;
        if (valueNode && (valueNode.type === 'value' || typeof valueNode.value !== 'undefined')) {
          const valueElement = this._renderValue(valueNode, options);
          container.appendChild(valueElement);
        } else if (valueNode && valueNode.type) {
          // Nested object/array
          return this.render(valueNode, {
            ...options,
            depth: options.depth,
            parentPath: options.nodePath
          });
        }
        break;

      case 'object':
        if (!node.children || node.children.length === 0) {
          const emptyObject = this._createElement('span', {
            className: 'empty-object',
            textContent: '{}'
          });
          container.appendChild(emptyObject);
        }
        break;

      case 'array':
        if (!node.children || node.children.length === 0) {
          const emptyArray = this._createElement('span', {
            className: 'empty-array',
            textContent: '[]'
          });
          container.appendChild(emptyArray);
        }
        break;

      case 'element':
        // XML-style element
        const tagElement = this._renderXmlElement(node, options);
        container.appendChild(tagElement);
        break;

      case 'heading':
        // Markdown heading
        const headingElement = this._renderHeading(node, options);
        container.appendChild(headingElement);
        break;

      case 'content':
        // Markdown content block
        const contentElement = this._renderContent(node, options);
        container.appendChild(contentElement);
        break;

      default:
        // Generic rendering
        if (node.value !== null && node.value !== undefined) {
          const genericValue = this._renderValue(node, options);
          container.appendChild(genericValue);
        }
    }

    return container;
  }

  /**
   * Render key/property name
   * @private
   */
  _renderKey(node, options) {
    const keyElement = this._createElement('span', {
      className: 'node-key',
      'data-editable': this.enableEditing ? 'true' : 'false'
    });

    // Format key based on parent type
    const parentType = node.parent?.type;
    let keyText = node.name;

    if (parentType === 'array') {
      keyText = `[${node.name}]`;
      keyElement.classList.add('array-index');
    } else if (node.type === 'element') {
      keyText = `<${node.name}>`;
      keyElement.classList.add('xml-tag');
    }

    keyElement.textContent = keyText;

    if (this.enableEditing && options.formatHandler?.getEditableFields?.().keyEditable) {
      keyElement.addEventListener('click', (e) => {
        e.stopPropagation();
        this._startKeyEdit(node, keyElement, options);
      });
    }

    // Add separator for key-value pairs
    if (node.type === 'value' || (node.type === 'object' && node.children?.length === 0) ||
        (node.type === 'array' && node.children?.length === 0)) {
      const separator = this._createElement('span', {
        className: 'key-value-separator',
        textContent: ': '
      });
      keyElement.appendChild(separator);
    }

    return keyElement;
  }

  /**
   * Render value
   * @private
   */
  _renderValue(node, options) {
    const valueElement = this._createElement('span', {
      className: 'node-value',
      'data-value-type': typeof node.value,
      'data-editable': this.enableEditing ? 'true' : 'false'
    });

    // Format value based on type
    let displayValue = node.value;
    if (node.value === null) {
      displayValue = 'null';
      valueElement.classList.add('null-value');
    } else if (node.value === undefined) {
      displayValue = 'undefined';
      valueElement.classList.add('undefined-value');
    } else if (typeof node.value === 'string') {
      displayValue = `"${node.value}"`;
      valueElement.classList.add('string-value');
    } else if (typeof node.value === 'boolean') {
      displayValue = node.value.toString();
      valueElement.classList.add('boolean-value');
    } else if (typeof node.value === 'number') {
      displayValue = node.value.toString();
      valueElement.classList.add('number-value');
    } else {
      displayValue = JSON.stringify(node.value);
    }

    valueElement.textContent = displayValue;

    if (this.enableEditing && options.formatHandler?.getEditableFields?.().valueEditable) {
      valueElement.addEventListener('click', (e) => {
        e.stopPropagation();
        this._startValueEdit(node, valueElement, options);
      });
    }

    return valueElement;
  }

  /**
   * Render XML element
   * @private
   */
  _renderXmlElement(node, options) {
    const container = this._createElement('span', {
      className: 'xml-element'
    });

    // Render attributes if any
    if (node.attributes && Object.keys(node.attributes).length > 0) {
      const attrsContainer = this._createElement('span', {
        className: 'xml-attributes'
      });

      Object.entries(node.attributes).forEach(([key, value]) => {
        const attrElement = this._createElement('span', {
          className: 'xml-attribute'
        });

        const attrKey = this._createElement('span', {
          className: 'attr-key',
          textContent: key
        });

        const attrEquals = this._createElement('span', {
          className: 'attr-equals',
          textContent: '='
        });

        const attrValue = this._createElement('span', {
          className: 'attr-value',
          textContent: `"${value}"`
        });

        attrElement.appendChild(attrKey);
        attrElement.appendChild(attrEquals);
        attrElement.appendChild(attrValue);
        attrsContainer.appendChild(attrElement);
      });

      container.appendChild(attrsContainer);
    }

    return container;
  }

  /**
   * Render Markdown heading
   * @private
   */
  _renderHeading(node, options) {
    const level = node.metadata?.level || 1;
    const headingElement = this._createElement(`h${Math.min(level, 6)}`, {
      className: 'markdown-heading',
      textContent: node.name || node.value || ''
    });

    return headingElement;
  }

  /**
   * Render Markdown content
   * @private
   */
  _renderContent(node, options) {
    const contentElement = this._createElement('div', {
      className: 'markdown-content'
    });

    const contentType = node.metadata?.type || 'paragraph';
    contentElement.classList.add(`content-${contentType}`);

    if (contentType === 'code') {
      const codeElement = this._createElement('code', {
        className: 'code-block',
        textContent: node.value || ''
      });

      if (node.metadata?.language) {
        codeElement.classList.add(`language-${node.metadata.language}`);
      }

      contentElement.appendChild(codeElement);
    } else {
      contentElement.textContent = node.value || '';
    }

    return contentElement;
  }

  /**
   * Create expansion control
   * @private
   */
  _createExpandControl(node, nodePath, isExpanded) {
    const control = this._createElement('span', {
      className: 'expand-control',
      'data-expanded': isExpanded ? 'true' : 'false',
      'aria-label': isExpanded ? 'Collapse' : 'Expand',
      role: 'button',
      tabIndex: 0
    });

    control.textContent = isExpanded ? '▼' : '▶';

    control.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleExpansion(node, nodePath, control);
    });

    control.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        this._toggleExpansion(node, nodePath, control);
      }
    });

    return control;
  }

  /**
   * Toggle node expansion
   * @private
   */
  _toggleExpansion(node, nodePath, control) {
    const isExpanded = control.getAttribute('data-expanded') === 'true';
    const newState = !isExpanded;

    // Update control
    control.setAttribute('data-expanded', newState ? 'true' : 'false');
    control.setAttribute('aria-label', newState ? 'Collapse' : 'Expand');
    control.textContent = newState ? '▼' : '▶';

    // Update expansion state
    if (this.expansionState) {
      if (newState) {
        this.expansionState.expand(nodePath);
      } else {
        this.expansionState.collapse(nodePath);
      }
    }

    // Notify listeners
    if (newState) {
      this.onExpand(node, nodePath);
    } else {
      this.onCollapse(node, nodePath);
    }

    // Re-render the node's parent to update children visibility
    const nodeElement = control.closest('.hierarchy-node');
    if (nodeElement && nodeElement.parentElement) {
      // This would typically trigger a re-render in the parent component
      nodeElement.dispatchEvent(new CustomEvent('expansion-changed', {
        detail: { node, nodePath, isExpanded: newState },
        bubbles: true
      }));
    }
  }

  /**
   * Create collapsed summary
   * @private
   */
  _createCollapsedSummary(node) {
    const childCount = node.children?.length || 0;
    if (childCount === 0) return null;

    const summary = this._createElement('span', {
      className: 'collapsed-summary'
    });

    let summaryText = '';
    switch (node.type) {
      case 'object':
        summaryText = `${childCount} ${childCount === 1 ? 'property' : 'properties'}`;
        break;
      case 'array':
        summaryText = `${childCount} ${childCount === 1 ? 'item' : 'items'}`;
        break;
      case 'element':
        summaryText = `${childCount} ${childCount === 1 ? 'child' : 'children'}`;
        break;
      default:
        summaryText = `${childCount} ${childCount === 1 ? 'node' : 'nodes'}`;
    }

    summary.textContent = ` // ${summaryText}`;
    return summary;
  }

  /**
   * Start editing a key
   * @private
   */
  _startKeyEdit(node, keyElement, options) {
    const currentKey = node.name;
    const input = this._createElement('input', {
      type: 'text',
      className: 'edit-input key-edit',
      value: currentKey
    });

    // Replace key element with input
    keyElement.style.display = 'none';
    keyElement.parentElement.insertBefore(input, keyElement);
    input.focus();
    input.select();

    const finishEdit = () => {
      const newKey = input.value.trim();
      if (newKey && newKey !== currentKey) {
        this.onEdit({
          type: 'key',
          node,
          oldValue: currentKey,
          newValue: newKey,
          path: options.nodePath
        });
      }
      input.remove();
      keyElement.style.display = '';
    };

    input.addEventListener('blur', finishEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finishEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        input.value = currentKey;
        finishEdit();
      }
    });
  }

  /**
   * Start editing a value
   * @private
   */
  _startValueEdit(node, valueElement, options) {
    const currentValue = node.value;
    const valueType = typeof currentValue;
    
    const input = this._createElement('input', {
      type: 'text',
      className: 'edit-input value-edit',
      value: valueType === 'string' ? currentValue : JSON.stringify(currentValue)
    });

    // Replace value element with input
    valueElement.style.display = 'none';
    valueElement.parentElement.insertBefore(input, valueElement);
    input.focus();
    input.select();

    const finishEdit = () => {
      const newValueStr = input.value.trim();
      let newValue;

      try {
        // Try to parse as JSON first
        if (newValueStr === 'null') {
          newValue = null;
        } else if (newValueStr === 'true') {
          newValue = true;
        } else if (newValueStr === 'false') {
          newValue = false;
        } else if (/^-?\d+$/.test(newValueStr)) {
          newValue = parseInt(newValueStr, 10);
        } else if (/^-?\d*\.\d+$/.test(newValueStr)) {
          newValue = parseFloat(newValueStr);
        } else {
          // Treat as string
          newValue = newValueStr;
        }

        if (newValue !== currentValue) {
          this.onEdit({
            type: 'value',
            node,
            oldValue: currentValue,
            newValue,
            path: options.nodePath
          });
        }
      } catch (e) {
        // Invalid input, ignore
      }

      input.remove();
      valueElement.style.display = '';
    };

    input.addEventListener('blur', finishEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finishEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        input.value = valueType === 'string' ? currentValue : JSON.stringify(currentValue);
        finishEdit();
      }
    });
  }

  /**
   * Check if node is expandable
   * @private
   */
  _isExpandable(node) {
    return node.children && node.children.length > 0;
  }

  /**
   * Get node path for expansion state
   * @private
   */
  _getNodePath(node, parentPath) {
    if (!node.name && node.id) {
      return parentPath ? `${parentPath}.${node.id}` : node.id;
    }
    return parentPath ? `${parentPath}.${node.name}` : node.name || node.id;
  }

  /**
   * Create empty element
   * @private
   */
  _createEmptyElement() {
    return this._createElement('div', {
      className: 'hierarchy-empty',
      textContent: 'No data to display'
    });
  }

  /**
   * Create DOM element helper
   * @private
   */
  _createElement(tag, attributes = {}) {
    const element = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'textContent') {
        element.textContent = value;
      } else if (key.startsWith('data-')) {
        element.setAttribute(key, value);
      } else if (key === 'role' || key === 'tabIndex' || key === 'aria-label') {
        element.setAttribute(key, value);
      } else {
        element[key] = value;
      }
    });

    return element;
  }

  /**
   * Update configuration
   */
  updateConfig(config) {
    Object.assign(this.config, config);
    if (config.expansionState) {
      this.expansionState = config.expansionState;
    }
    if (config.theme) {
      this.theme = config.theme;
    }
    if (config.enableEditing !== undefined) {
      this.enableEditing = config.enableEditing;
    }
  }

  /**
   * Clear DOM cache
   */
  clearCache() {
    this.domCache = new WeakMap();
  }
}