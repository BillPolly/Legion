/**
 * GraphEditor - Umbilical Component for node-link diagram visualization and editing
 * 
 * This component follows the Umbilical Component Protocol and implements a sophisticated
 * graph editor with MVVM architecture, custom scene graph, and pluggable layout system.
 */

import { UmbilicalUtils } from '@legion/components';
import { GraphEditorModel } from './model/GraphEditorModel.js';
import { GraphEditorViewModel } from './viewmodel/GraphEditorViewModel.js';
import { GraphEditorView } from './view/GraphEditorView.js';

export const GraphEditor = {
  /**
   * Create a GraphEditor instance following the Umbilical Component Protocol
   * @param {Object} umbilical - The umbilical object providing all dependencies
   * @returns {Object|undefined} - Component instance or undefined in describe/validate modes
   */
  create(umbilical) {
    // Validate umbilical exists
    if (!umbilical) {
      throw new Error('GraphEditor requires an umbilical');
    }

    // Introspection Mode
    if (umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      
      // Required capabilities
      requirements.add('dom', 'HTMLElement', 'DOM element to render the graph editor into');
      requirements.add('onModelChange', 'function', 'Callback when the graph model changes');
      
      // Optional capabilities
      requirements.add('width', 'number|string', 'Width of the editor in pixels or percent (default: 100%)');
      requirements.add('height', 'number|string', 'Height of the editor in pixels or percent (default: 400)');
      requirements.add('theme', 'string', 'Color theme: "light" or "dark" (default: "light")');
      
      // Event callbacks
      requirements.add('onSelectionChange', 'function', 'Callback when selection changes (optional)');
      requirements.add('onNodeClick', 'function', 'Callback when a node is clicked (optional)');
      requirements.add('onNodeDoubleClick', 'function', 'Callback when a node is double-clicked (optional)');
      requirements.add('onEdgeClick', 'function', 'Callback when an edge is clicked (optional)');
      requirements.add('onBackgroundClick', 'function', 'Callback when background is clicked (optional)');
      requirements.add('onHistoryChange', 'function', 'Callback when undo/redo history changes (optional)');
      requirements.add('onError', 'function', 'Callback for error handling (optional)');
      
      // Lifecycle callbacks
      requirements.add('onMount', 'function', 'Callback after component is mounted (optional)');
      requirements.add('onDestroy', 'function', 'Callback before component is destroyed (optional)');
      
      umbilical.describe(requirements);
      return;
    }

    // Validation Mode
    if (umbilical.validate) {
      const validation = {
        hasDomElement: umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE,
        hasModelChangeCallback: typeof umbilical.onModelChange === 'function',
        isValid: true
      };
      
      // Check required capabilities
      if (!validation.hasDomElement || !validation.hasModelChangeCallback) {
        validation.isValid = false;
      }
      
      // Check optional width/height types
      if (umbilical.width !== undefined) {
        validation.hasValidWidth = typeof umbilical.width === 'number' || typeof umbilical.width === 'string';
        if (!validation.hasValidWidth) validation.isValid = false;
      }
      
      if (umbilical.height !== undefined) {
        validation.hasValidHeight = typeof umbilical.height === 'number' || typeof umbilical.height === 'string';
        if (!validation.hasValidHeight) validation.isValid = false;
      }
      
      // Check theme
      if (umbilical.theme !== undefined) {
        validation.hasValidTheme = ['light', 'dark'].includes(umbilical.theme);
        if (!validation.hasValidTheme) validation.isValid = false;
      }
      
      return umbilical.validate(validation);
    }

    // Instance Mode - Create the actual component
    // Validate required capabilities
    UmbilicalUtils.validateCapabilities(umbilical, ['dom', 'onModelChange'], 'GraphEditor');
    
    return new GraphEditorInstance(umbilical);
  }
};

/**
 * GraphEditor instance implementation
 */
class GraphEditorInstance {
  constructor(umbilical) {
    this.umbilical = umbilical;
    this._destroyed = false;
    
    // Extract configuration
    this.config = {
      width: umbilical.width || '100%',
      height: umbilical.height || 400,
      theme: umbilical.theme || 'light'
    };

    try {
      // Create container
      this._createContainer();
      
      // Initialize MVVM components
      this._initializeComponents();
      
      // Wire up event handlers
      this._setupEventHandlers();
      
      // Call onMount if provided
      if (this.umbilical.onMount) {
        this.umbilical.onMount(this);
      }
    } catch (error) {
      this._handleError(error);
      throw error;
    }
  }

  /**
   * Create the container element
   * @private
   */
  _createContainer() {
    this.container = document.createElement('div');
    this.container.className = 'graph-editor';
    
    // Apply theme
    if (this.config.theme === 'dark') {
      this.container.classList.add('graph-editor--dark');
    }
    
    // Apply dimensions
    this.container.style.width = typeof this.config.width === 'number' 
      ? `${this.config.width}px` 
      : this.config.width;
    this.container.style.height = typeof this.config.height === 'number'
      ? `${this.config.height}px`
      : this.config.height;
    
    // Basic styles
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';
    this.container.style.border = '1px solid #ddd';
    this.container.style.backgroundColor = this.config.theme === 'dark' ? '#1e1e1e' : '#fff';
    
    // Append to umbilical DOM
    this.umbilical.dom.appendChild(this.container);
  }

  /**
   * Initialize MVVM components
   * @private
   */
  _initializeComponents() {
    // Create Model
    this.model = new GraphEditorModel({
      onChange: (changeType, data) => {
        if (this.umbilical.onModelChange) {
          this.umbilical.onModelChange(changeType, data);
        }
      }
    });

    // Create View
    this.view = new GraphEditorView(this.container, {
      theme: this.config.theme,
      onError: (error) => this._handleError(error)
    });

    // Create ViewModel (this wires up Model -> View listeners)
    this.viewModel = new GraphEditorViewModel(this.model, this.view, {
      onSelectionChange: this.umbilical.onSelectionChange,
      onNodeClick: this.umbilical.onNodeClick,
      onNodeDoubleClick: this.umbilical.onNodeDoubleClick,
      onEdgeClick: this.umbilical.onEdgeClick,
      onBackgroundClick: this.umbilical.onBackgroundClick,
      onHistoryChange: this.umbilical.onHistoryChange
    });

    // Load initial graph data AFTER ViewModel is set up
    // This ensures the Model->ViewModel->View pipeline is active
    if (this.umbilical.graphData) {
      this.model.fromJSON(this.umbilical.graphData);
    }
  }

  /**
   * Setup event handlers
   * @private
   */
  _setupEventHandlers() {
    // Additional event setup if needed
  }

  /**
   * Handle errors
   * @private
   */
  _handleError(error) {
    if (this.umbilical.onError) {
      this.umbilical.onError(error);
    } else {
      console.error('GraphEditor Error:', error);
    }
  }

  /**
   * Get the model instance
   * @returns {GraphEditorModel}
   */
  getModel() {
    if (this._destroyed) {
      throw new Error('Cannot access model of destroyed GraphEditor');
    }
    return this.model;
  }

  /**
   * Get the view model instance
   * @returns {GraphEditorViewModel}
   */
  getViewModel() {
    if (this._destroyed) {
      throw new Error('Cannot access view model of destroyed GraphEditor');
    }
    return this.viewModel;
  }

  /**
   * Get the view instance
   * @returns {GraphEditorView}
   */
  getView() {
    if (this._destroyed) {
      throw new Error('Cannot access view of destroyed GraphEditor');
    }
    return this.view;
  }

  /**
   * Destroy the component and clean up resources
   */
  destroy() {
    if (this._destroyed) {
      return;
    }

    this._destroyed = true;

    // Call onDestroy if provided
    if (this.umbilical.onDestroy) {
      this.umbilical.onDestroy();
    }

    // Destroy MVVM components in reverse order
    // ViewModel first (it depends on Model and View)
    if (this.viewModel) {
      this.viewModel.destroy();
      this.viewModel = null;
    }
    
    // Then View
    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
    
    // Finally Model
    if (this.model) {
      this.model.destroy();
      this.model = null;
    }

    // Remove container
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    // Clear references
    this.container = null;
    this.umbilical = null;
  }
}