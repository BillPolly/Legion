/**
 * Tree Component - Main entry point
 * 
 * A hierarchical tree view component that follows the umbilical protocol
 * externally and uses MVVM pattern internally. Supports expand/collapse,
 * selection, drag & drop reordering, and keyboard navigation.
 */
import { UmbilicalUtils, UmbilicalError } from '../../umbilical/index.js';
import { TreeModel } from './model/TreeModel.js';
import { TreeView } from './view/TreeView.js';
import { TreeViewModel } from './viewmodel/TreeViewModel.js';

export const Tree = {
  /**
   * Create a Tree instance or provide introspection
   */
  create(umbilical) {
    // Introspection mode - describe requirements
    if (umbilical && umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      
      // Required capabilities
      requirements.add('data', 'array', 'Hierarchical data array to display in tree structure');
      requirements.add('dom', 'HTMLElement', 'DOM container element for the tree');
      
      // Node operations
      requirements.add('getChildren', 'function', 'Function to get children of a node (optional, defaults to node.children)');
      requirements.add('getNodeId', 'function', 'Function to get unique ID of a node (optional, defaults to node.id || node.name)');
      requirements.add('nodeRenderer', 'function', 'Function to render node content (optional, defaults to node.name)');
      
      // Tree behavior
      requirements.add('selectable', 'string', 'Selection mode: "none", "single", or "multiple" (optional, defaults to "single")');
      requirements.add('draggable', 'boolean', 'Enable drag & drop reordering (optional, defaults to false)');
      requirements.add('editable', 'boolean', 'Enable inline editing of node labels (optional, defaults to false)');
      requirements.add('expandable', 'boolean', 'Enable expand/collapse (optional, defaults to true)');
      requirements.add('searchable', 'boolean', 'Enable search functionality (optional, defaults to false)');
      
      // Event callbacks
      requirements.add('onExpand', 'function', 'Callback fired when node is expanded (optional)');
      requirements.add('onCollapse', 'function', 'Callback fired when node is collapsed (optional)');
      requirements.add('onSelectionChange', 'function', 'Callback fired when selection changes (optional)');
      requirements.add('onClick', 'function', 'Callback fired when node is clicked (optional)');
      requirements.add('onDoubleClick', 'function', 'Callback fired when node is double-clicked (optional)');
      requirements.add('onMove', 'function', 'Callback fired when node is moved via drag & drop (optional)');
      requirements.add('onDragStart', 'function', 'Callback fired when drag operation starts (optional)');
      requirements.add('onNodeEdit', 'function', 'Callback fired when node label is edited (optional)');
      requirements.add('onDataChange', 'function', 'Callback fired when tree data changes (optional)');
      
      // Styling and appearance
      requirements.add('className', 'string', 'Additional CSS class for the tree container (optional)');
      requirements.add('theme', 'string', 'Theme variant: "light" or "dark" (optional, defaults to "light")');
      requirements.add('showConnectingLines', 'boolean', 'Show connecting lines between nodes (optional, defaults to true)');
      requirements.add('getNodeIcon', 'function', 'Function to get icon for a node (optional)');
      
      // Advanced options
      requirements.add('initialExpanded', 'array', 'Array of node IDs to expand initially (optional)');
      requirements.add('initialSelected', 'array', 'Array of node IDs to select initially (optional)');
      requirements.add('allowDropIntoLeaves', 'boolean', 'Allow dropping into leaf nodes (optional, defaults to false)');
      requirements.add('animationDuration', 'number', 'Animation duration in ms (optional, defaults to 300)');
      
      // Lifecycle callbacks
      requirements.add('onMount', 'function', 'Callback fired after component is mounted (optional)');
      requirements.add('onDestroy', 'function', 'Callback fired before component is destroyed (optional)');
      
      umbilical.describe(requirements);
      return;
    }

    // Validation mode
    if (umbilical && umbilical.validate) {
      const testUmbilical = umbilical.validate;
      const hasData = Array.isArray(testUmbilical.data);
      const hasDOM = !!(testUmbilical.dom && testUmbilical.dom.nodeType === 1);
      
      return {
        valid: hasData && hasDOM,
        hasData,
        hasDOM,
        hasRequiredCapabilities: hasData && hasDOM
      };
    }

    // No umbilical - return component info
    if (!umbilical) {
      return {
        name: 'Tree',
        version: '1.0.0',
        description: 'Hierarchical tree view with expand/collapse, selection, and drag & drop',
        capabilities: [
          'hierarchical-display', 'expand-collapse', 'selection', 'drag-drop',
          'keyboard-navigation', 'search', 'custom-rendering', 'theming'
        ]
      };
    }

    // Instance mode - create actual tree instance
    const {
      // Required
      data = [],
      dom = null,
      
      // Node operations
      getChildren = (node) => node.children || [],
      getNodeId = (node) => node.id || node.name || JSON.stringify(node),
      nodeRenderer = null,
      
      // Tree behavior
      selectable = 'single',
      draggable = false,
      editable = false,
      expandable = true,
      searchable = false,
      
      // Event callbacks
      onExpand = null,
      onCollapse = null,
      onSelectionChange = null,
      onClick = null,
      onDoubleClick = null,
      onMove = null,
      onDragStart = null,
      onNodeEdit = null,
      onDataChange = null,
      
      // Styling and appearance
      className = '',
      theme = 'light',
      showConnectingLines = true,
      getNodeIcon = null,
      
      // Advanced options
      initialExpanded = [],
      initialSelected = [],
      allowDropIntoLeaves = false,
      animationDuration = 300,
      
      // Lifecycle callbacks
      onMount = null,
      onDestroy = null
    } = umbilical;

    // Validation
    if (!dom) {
      throw new UmbilicalError('Tree requires a DOM container element', 'Tree');
    }

    if (!Array.isArray(data)) {
      throw new UmbilicalError('Tree data must be an array', 'Tree');
    }

    if (!['none', 'single', 'multiple'].includes(selectable)) {
      throw new UmbilicalError('Tree selectable must be "none", "single", or "multiple"', 'Tree');
    }

    if (!['light', 'dark'].includes(theme)) {
      throw new UmbilicalError('Tree theme must be "light" or "dark"', 'Tree');
    }

    // Create configuration object
    const config = {
      selectable,
      draggable,
      editable,
      expandable,
      searchable,
      className,
      theme,
      showConnectingLines,
      allowDropIntoLeaves,
      animationDuration,
      getChildren,
      getNodeId,
      nodeRenderer,
      getNodeIcon,
      
      // Event callbacks
      onExpand,
      onCollapse,
      onSelectionChange,
      onClick,
      onDoubleClick,
      onMove,
      onDragStart,
      onNodeEdit,
      onDataChange
    };

    // Create MVVM components
    const model = new TreeModel(data, config);
    const view = new TreeView(dom, config);
    const viewModel = new TreeViewModel(model, view, config);

    // Apply initial state
    if (initialExpanded.length > 0) {
      initialExpanded.forEach(nodeId => {
        model.expand(nodeId);
      });
    }

    if (initialSelected.length > 0) {
      initialSelected.forEach(nodeId => {
        model.select(nodeId);
      });
    }

    // Initial render
    viewModel.render();

    // Create tree instance
    const treeInstance = {
      // Data operations
      getData() {
        return viewModel.getData();
      },

      setData(newData) {
        if (!Array.isArray(newData)) {
          throw new UmbilicalError('Tree data must be an array', 'Tree');
        }
        viewModel.setData(newData);
      },

      refresh() {
        viewModel.render();
      },

      // Node operations
      getNode(nodeId) {
        return model.getNode(nodeId);
      },

      hasChildren(nodeId) {
        return model.hasChildren(nodeId);
      },

      getChildren(nodeId) {
        return model.getNodeChildren(nodeId);
      },

      getParent(nodeId) {
        const parentId = model.getParentId(nodeId);
        return parentId ? model.getNode(parentId) : null;
      },

      getAncestors(nodeId) {
        return model.getAncestorIds(nodeId).map(id => model.getNode(id));
      },

      // Expansion operations
      isExpanded(nodeId) {
        return model.isExpanded(nodeId);
      },

      expand(nodeId) {
        viewModel.expandNode(nodeId);
      },

      collapse(nodeId) {
        viewModel.collapseNode(nodeId);
      },

      toggleExpansion(nodeId) {
        viewModel.toggleExpansion(nodeId);
      },

      expandAll() {
        viewModel.expandAll();
      },

      collapseAll() {
        viewModel.collapseAll();
      },

      expandToNode(nodeId) {
        const changed = model.expandToNode(nodeId);
        if (changed) {
          viewModel.render();
        }
        return changed;
      },

      // Selection operations
      isSelected(nodeId) {
        return model.isSelected(nodeId);
      },

      select(nodeId) {
        if (model.select(nodeId)) {
          viewModel.updateSelection();
          
          if (onSelectionChange) {
            onSelectionChange(
              model.getSelectedIds(),
              model.getSelectedNodes()
            );
          }
          return true;
        }
        return false;
      },

      deselect(nodeId) {
        if (model.deselect(nodeId)) {
          viewModel.updateSelection();
          
          if (onSelectionChange) {
            onSelectionChange(
              model.getSelectedIds(),
              model.getSelectedNodes()
            );
          }
          return true;
        }
        return false;
      },

      clearSelection() {
        if (model.clearSelection()) {
          viewModel.updateSelection();
          
          if (onSelectionChange) {
            onSelectionChange([], []);
          }
          return true;
        }
        return false;
      },

      getSelectedNodes() {
        return viewModel.getSelectedNodes();
      },

      getSelectedIds() {
        return viewModel.getSelectedIds();
      },

      // Focus and navigation
      focusNode(nodeId) {
        viewModel.focusNode(nodeId);
      },

      highlightNode(nodeId) {
        viewModel.highlightNode(nodeId);
      },

      getFocusedNode() {
        return viewModel.focusedNodeId ? model.getNode(viewModel.focusedNodeId) : null;
      },

      // Search operations
      search(searchTerm, options = {}) {
        if (!searchable) {
          console.warn('Tree: Search is not enabled. Set searchable: true to enable search.');
          return [];
        }
        return viewModel.search(searchTerm, options);
      },

      // Utility operations
      getVisibleNodes() {
        return model.getVisibleNodes();
      },

      getAllNodes() {
        return model.getAllNodes();
      },

      getStats() {
        return viewModel.getStats();
      },

      // State management
      exportState() {
        return viewModel.exportState();
      },

      importState(state) {
        viewModel.importState(state);
      },

      // Configuration
      getConfig() {
        return { ...config };
      },

      updateConfig(newConfig) {
        // Handle theme changes specially - no recreation needed
        if (newConfig.theme && newConfig.theme !== config.theme) {
          config.theme = newConfig.theme;
          view.updateTheme(newConfig.theme);
        }
        
        // Handle other config changes
        const otherChanges = Object.keys(newConfig).filter(key => key !== 'theme');
        if (otherChanges.length > 0) {
          Object.assign(config, newConfig);
          console.warn('Tree: Some configuration changes may require recreating the tree component.');
        }
      },

      // Validation
      validateStructure() {
        try {
          // Check for circular references
          const visited = new Set();
          const visiting = new Set();
          
          const checkNode = (node, depth = 0) => {
            // Prevent deep recursion even without explicit circular references
            if (depth > 100) {
              throw new Error('Maximum tree depth exceeded (possible circular reference)');
            }
            
            let nodeId;
            try {
              nodeId = getNodeId(node);
            } catch (error) {
              // JSON.stringify might fail on circular references
              throw new Error('Unable to get node ID (possible circular reference)');
            }
            
            if (visiting.has(nodeId)) {
              throw new Error(`Circular reference detected at node: ${nodeId}`);
            }
            
            if (visited.has(nodeId)) {
              return; // Already processed
            }
            
            visiting.add(nodeId);
            
            const children = getChildren(node);
            if (children && Array.isArray(children)) {
              children.forEach(child => checkNode(child, depth + 1));
            }
            
            visiting.delete(nodeId);
            visited.add(nodeId);
          };
          
          data.forEach(checkNode);
          
          return { valid: true, errors: [] };
        } catch (error) {
          return { valid: false, errors: [error.message] };
        }
      },

      // Inline editing (if enabled)
      ...(editable && {
        startEditing(nodeId) {
          return viewModel.startEditing(nodeId);
        },

        finishEditing(newValue = null) {
          return viewModel.finishEditing(newValue);
        },

        cancelEditing() {
          return viewModel.cancelEditing();
        },

        isEditing(nodeId = null) {
          return viewModel.isEditing(nodeId);
        }
      }),

      // Drag & Drop (if enabled)
      ...(draggable && {
        isDragging() {
          return model.isDragging;
        },

        getDraggedNode() {
          return model.draggedNode;
        },

        canDropAt(targetNodeId, position) {
          return model.canDrop(targetNodeId, position);
        }
      }),

      // Development helpers
      debug() {
        return {
          model: model,
          view: view,
          viewModel: viewModel,
          config: config,
          stats: viewModel.getStats(),
          expandedNodes: Array.from(model.expandedNodes),
          selectedNodes: Array.from(model.selectedNodes)
        };
      },

      // Cleanup
      destroy() {
        viewModel.destroy();
        view.destroy();
        
        if (onDestroy) {
          onDestroy(treeInstance);
        }
      }
    };

    // Call onMount callback
    if (onMount) {
      onMount(treeInstance);
    }

    return treeInstance;
  }
};

// Export individual components for advanced usage
export { TreeModel } from './model/TreeModel.js';
export { TreeView } from './view/TreeView.js';
export { TreeViewModel } from './viewmodel/TreeViewModel.js';