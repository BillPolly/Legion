/**
 * SimplifiedTreeExample - Demonstrates how to use the new MVVM base classes
 * 
 * This is a simplified version of the Tree component that shows how the
 * base classes reduce boilerplate and standardize patterns.
 */

import { BaseModel, BaseView, BaseViewModel, createMVVMComponent } from '../src/components/base/index.js';

/**
 * TreeModel - Extends BaseModel with tree-specific functionality
 */
class TreeModel extends BaseModel {
  constructor(data, config) {
    super(data, config);
    this.rootNode = null;
    this.expandedNodes = new Set();
    this.selectedNodes = new Set();
    
    if (data) {
      this.setData(data);
    }
  }

  setData(data) {
    // Convert array data to tree structure
    this.rootNode = Array.isArray(data) ? { children: data } : data;
    this._buildNodeMap(this.rootNode);
    
    super.setData(data);
  }

  expandNode(nodeId) {
    this.expandedNodes.add(nodeId);
    this.setMetadata(nodeId, 'expanded', true);
  }

  collapseNode(nodeId) {
    this.expandedNodes.delete(nodeId);
    this.setMetadata(nodeId, 'expanded', false);
  }

  selectNode(nodeId) {
    if (this.config.selectable === 'single') {
      this.selectedNodes.clear();
    }
    this.selectedNodes.add(nodeId);
    this.setMetadata(nodeId, 'selected', true);
  }

  _buildNodeMap(node, parent = null) {
    if (node.id) {
      this.setItem(node.id, { ...node, parent });
    }
    
    if (node.children) {
      node.children.forEach(child => this._buildNodeMap(child, node));
    }
  }
}

/**
 * TreeView - Extends BaseView with tree-specific rendering
 */
class TreeView extends BaseView {
  _getContainerClasses() {
    return ['tree-component', 'tree-view', `theme-${this.currentTheme}`];
  }

  _setupAccessibility() {
    super._setupAccessibility();
    this.container.setAttribute('role', 'tree');
    this.container.setAttribute('aria-label', 'Tree view');
  }

  render() {
    if (!this.model || this.destroyed) return;
    
    this.container.innerHTML = '';
    
    const data = this.model.getData();
    if (data && data.children) {
      data.children.forEach(node => {
        this._renderNode(node, 0);
      });
    }
    
    super.render();
  }

  _renderNode(node, depth) {
    const nodeElement = document.createElement('div');
    nodeElement.className = 'tree-node';
    nodeElement.style.paddingLeft = `${depth * 20}px`;
    nodeElement.dataset.nodeId = node.id;
    
    // Create node content
    const content = document.createElement('span');
    content.textContent = node.name || node.title || 'Unnamed';
    content.className = 'tree-node-content';
    
    // Add expand/collapse arrow if node has children
    if (node.children && node.children.length > 0) {
      const arrow = document.createElement('span');
      arrow.className = 'tree-arrow';
      arrow.textContent = '▶';
      nodeElement.appendChild(arrow);
      
      // Click handler for arrow
      this.addEventListener(arrow, 'click', (e) => {
        e.stopPropagation();
        this._emitViewEvent('nodeToggle', { nodeId: node.id });
      });
    }
    
    nodeElement.appendChild(content);
    
    // Click handler for node selection
    this.addEventListener(nodeElement, 'click', () => {
      this._emitViewEvent('nodeSelect', { nodeId: node.id });
    });
    
    this.container.appendChild(nodeElement);
    this.addElement(`node_${node.id}`, nodeElement);
    
    // Render children if expanded
    if (node.children && this.isExpanded(node.id)) {
      node.children.forEach(child => {
        this._renderNode(child, depth + 1);
      });
    }
  }

  isExpanded(nodeId) {
    // This would be coordinated with the model via viewModel
    return this.expandedState && this.expandedState.has(nodeId);
  }

  updateNodeExpansion(nodeId, expanded) {
    if (!this.expandedState) {
      this.expandedState = new Set();
    }
    
    if (expanded) {
      this.expandedState.add(nodeId);
    } else {
      this.expandedState.delete(nodeId);
    }
    
    // Update arrow visual state
    const nodeElement = this.getElement(`node_${nodeId}`);
    if (nodeElement) {
      const arrow = nodeElement.querySelector('.tree-arrow');
      if (arrow) {
        arrow.textContent = expanded ? '▼' : '▶';
      }
    }
  }
}

/**
 * TreeViewModel - Extends BaseViewModel with tree-specific coordination
 */
class TreeViewModel extends BaseViewModel {
  _initializeCommands() {
    super._initializeCommands();
    
    // Tree-specific commands
    this.registerCommand('expandNode', this._expandNodeCommand.bind(this));
    this.registerCommand('collapseNode', this._collapseNodeCommand.bind(this));
    this.registerCommand('selectNode', this._selectNodeCommand.bind(this));
    this.registerCommand('toggleNode', this._toggleNodeCommand.bind(this));
  }

  _handleViewEvent(event) {
    super._handleViewEvent(event);
    
    switch (event.type) {
      case 'nodeToggle':
        this.executeCommand('toggleNode', { nodeId: event.data.nodeId });
        break;
      case 'nodeSelect':
        this.executeCommand('selectNode', { nodeId: event.data.nodeId });
        break;
    }
  }

  _handleModelEvent(event) {
    super._handleModelEvent(event);
    
    // Handle tree-specific model events
    if (event.type === 'metadataChanged') {
      const { id, key, value } = event.data;
      
      if (key === 'expanded') {
        this.view.updateNodeExpansion(id, value);
      }
    }
  }

  // Command implementations
  _expandNodeCommand({ nodeId }) {
    this.model.expandNode(nodeId);
    this.render(); // Re-render to show children
    return true;
  }

  _collapseNodeCommand({ nodeId }) {
    this.model.collapseNode(nodeId);
    this.render(); // Re-render to hide children
    return true;
  }

  _selectNodeCommand({ nodeId }) {
    this.model.selectNode(nodeId);
    return true;
  }

  _toggleNodeCommand({ nodeId }) {
    const isExpanded = this.model.getMetadata(nodeId, 'expanded');
    if (isExpanded) {
      return this.executeCommand('collapseNode', { nodeId });
    } else {
      return this.executeCommand('expandNode', { nodeId });
    }
  }
}

/**
 * Create the SimplifiedTree component using the factory
 */
export const SimplifiedTree = createMVVMComponent({
  ModelClass: TreeModel,
  ViewClass: TreeView,
  ViewModelClass: TreeViewModel,
  name: 'SimplifiedTree',
  defaults: {
    selectable: 'single',
    theme: 'light'
  },
  
  // Define component-specific requirements
  defineRequirements(requirements, config) {
    requirements.add('data', 'array', 'Hierarchical data array');
    requirements.add('selectable', 'string', 'Selection mode (none|single|multiple) - optional', false);
    requirements.add('onSelectionChange', 'function', 'Called when selection changes - optional', false);
    requirements.add('onExpansionChange', 'function', 'Called when node expansion changes - optional', false);
  },
  
  // Define component-specific validation
  validateCapabilities(umbilical, config) {
    return {
      hasValidData: Array.isArray(umbilical.data) || typeof umbilical.data === 'object',
      hasValidSelectable: !umbilical.selectable || ['none', 'single', 'multiple'].includes(umbilical.selectable)
    };
  }
});

/**
 * Example usage and comparison:
 * 
 * OLD WAY (lots of boilerplate):
 * ```javascript
 * export const Tree = {
 *   create(umbilical) {
 *     // 1. Introspection mode
 *     if (umbilical.describe) {
 *       const requirements = UmbilicalUtils.createRequirements();
 *       requirements.add('dom', 'HTMLElement', 'Parent DOM element');
 *       requirements.add('data', 'array', 'Hierarchical data');
 *       // ... more requirements
 *       umbilical.describe(requirements);
 *       return;
 *     }
 * 
 *     // 2. Validation mode
 *     if (umbilical.validate) {
 *       return umbilical.validate({
 *         hasDomElement: !!(umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE),
 *         hasValidData: Array.isArray(umbilical.data),
 *         // ... more validation
 *       });
 *     }
 * 
 *     // 3. Instance creation
 *     UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'Tree');
 *     
 *     const model = new TreeModel(umbilical.data, config);
 *     const view = new TreeView(umbilical.dom, config);
 *     const viewModel = new TreeViewModel(model, view, config);
 *     
 *     // ... lots more setup code
 *     
 *     return instance;
 *   }
 * };
 * ```
 * 
 * NEW WAY (declarative and clean):
 * ```javascript
 * export const SimplifiedTree = createMVVMComponent({
 *   ModelClass: TreeModel,
 *   ViewClass: TreeView,
 *   ViewModelClass: TreeViewModel,
 *   name: 'SimplifiedTree',
 *   defaults: { selectable: 'single' },
 *   defineRequirements(requirements) {
 *     requirements.add('data', 'array', 'Hierarchical data array');
 *   }
 * });
 * ```
 * 
 * The new approach:
 * - Eliminates 90% of boilerplate code
 * - Ensures consistent umbilical protocol implementation
 * - Provides standardized MVVM initialization
 * - Includes built-in lifecycle management
 * - Has consistent error handling
 * - Provides debugging utilities
 * - Includes comprehensive testing helpers
 */