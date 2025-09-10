/**
 * DiagramRenderer - Software Engineering Diagram Viewer Component
 * 
 * Renders data flow diagrams, data models, and architecture diagrams
 * with pan/zoom capabilities and element inspection
 */

import { DiagramViewModel } from './viewmodel/DiagramViewModel.js';
import { DiagramView } from './view/DiagramView.js';
import { DiagramLayoutEngine } from './layout/DiagramLayoutEngine.js';

export const DiagramRenderer = {
  /**
   * Create a DiagramRenderer instance following the Umbilical Component Protocol
   * @param {Object} umbilical - The umbilical object providing all dependencies
   * @returns {Object|undefined} - Component instance or undefined in describe/validate modes
   */
  create(umbilical) {
    // Validate umbilical exists
    if (!umbilical) {
      throw new Error('DiagramRenderer requires an umbilical');
    }

    // Introspection Mode
    if (umbilical.describe) {
      const requirements = {
        _requirements: {},
        add(name, type, description) {
          this._requirements[name] = { type, description };
        },
        getAll() {
          return this._requirements;
        }
      };
      
      // Required capabilities
      requirements.add('dom', 'HTMLElement', 'DOM element to render the diagram into');
      requirements.add('data', 'Object', 'Diagram data structure');
      
      // Optional capabilities
      requirements.add('onModelChange', 'function', 'Callback when the diagram model changes (optional)');
      requirements.add('onSelectionChange', 'function', 'Callback when selection changes (optional)');
      requirements.add('onNodeClick', 'function', 'Callback when a node is clicked (optional)');
      requirements.add('onEdgeClick', 'function', 'Callback when an edge is clicked (optional)');
      requirements.add('onError', 'function', 'Callback for error handling (optional)');
      requirements.add('theme', 'string', 'Color theme: "light" or "dark" (default: "light")');
      requirements.add('layout', 'Object', 'Layout configuration (optional)');
      requirements.add('interaction', 'Object', 'Interaction configuration (optional)');
      
      umbilical.describe(requirements);
      return;
    }

    // Validation Mode
    if (umbilical.validate) {
      const validation = {
        hasDomElement: Boolean(umbilical.dom && (umbilical.dom.nodeType === 1 || umbilical.dom.nodeType === Node.ELEMENT_NODE)),
        hasData: Boolean(umbilical.data && typeof umbilical.data === 'object'),
        isValid: true
      };
      
      // Check required capabilities
      if (!validation.hasDomElement || !validation.hasData) {
        validation.isValid = false;
      }
      
      // Check optional theme
      if (umbilical.theme !== undefined) {
        validation.hasValidTheme = ['light', 'dark'].includes(umbilical.theme);
        if (!validation.hasValidTheme) validation.isValid = false;
      }
      
      return umbilical.validate(validation);
    }

    // Instance Mode - Create the actual component
    // Validate required capabilities
    if (!umbilical.dom || (umbilical.dom.nodeType !== 1 && umbilical.dom.nodeType !== Node.ELEMENT_NODE)) {
      throw new Error('DiagramRenderer requires dom element');
    }
    
    if (!umbilical.data || typeof umbilical.data !== 'object') {
      throw new Error('DiagramRenderer requires data');
    }
    
    return new DiagramRendererInstance(umbilical);
  }
};

/**
 * DiagramRenderer instance implementation
 */
class DiagramRendererInstance {
  constructor(umbilical) {
    this.umbilical = umbilical;
    this._destroyed = false;
    
    // Extract configuration
    this.config = {
      theme: umbilical.theme || 'light',
      layout: umbilical.layout || {
        algorithm: 'dagre',
        direction: 'TB',
        spacing: { node: 50, rank: 100 }
      },
      interaction: umbilical.interaction || {
        enablePan: true,
        enableZoom: true,
        enableSelection: true,
        zoomLimits: { min: 0.1, max: 10 }
      }
    };

    try {
      // Validate diagram data
      this._validateDiagramData(umbilical.data);
      
      // Create container
      this._createContainer();
      
      // Initialize MVVM components
      this._initializeComponents();
      
      // Render initial data
      this.render(umbilical.data);
      
      // Call onMount if provided
      if (this.umbilical.onMount) {
        this.umbilical.onMount(this);
      }
    } catch (error) {
      // Only throw if there's no error handler
      if (!this.umbilical.onError) {
        throw error;
      }
      // Otherwise, handle the error and continue with safe defaults
      this.umbilical.onError(error);
      // Set up minimal structure to prevent further errors
      this._createContainer();
      this._initializeComponents();
    }
  }

  /**
   * Validate diagram data structure
   * @private
   */
  _validateDiagramData(data) {
    if (!data.type || !['dataflow', 'datamodel', 'architecture'].includes(data.type)) {
      throw new Error('Invalid diagram data: missing or invalid type');
    }
    
    if (!Array.isArray(data.nodes)) {
      throw new Error('Invalid diagram data: nodes must be an array');
    }
    
    if (data.edges && !Array.isArray(data.edges)) {
      throw new Error('Invalid diagram data: edges must be an array');
    }
  }

  /**
   * Create the container element
   * @private
   */
  _createContainer() {
    this.container = document.createElement('div');
    this.container.className = 'diagram-renderer';
    
    // Apply theme
    if (this.config.theme === 'dark') {
      this.container.classList.add('diagram-renderer--dark');
    }
    
    // Basic styles
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';
    this.container.style.backgroundColor = this.config.theme === 'dark' ? '#1e1e1e' : '#fff';
    
    // Append to umbilical DOM
    this.umbilical.dom.appendChild(this.container);
  }

  /**
   * Initialize MVVM components
   * @private
   */
  _initializeComponents() {
    // Create Layout Engine
    this.layoutEngine = new DiagramLayoutEngine(this.config.layout);
    
    // Create View
    this.view = new DiagramView(this.container, {
      theme: this.config.theme,
      interaction: this.config.interaction,
      onError: (error) => this._handleError(error)
    });

    // Create ViewModel
    this.viewModel = new DiagramViewModel({
      layoutEngine: this.layoutEngine,
      view: this.view,
      onModelChange: this.umbilical.onModelChange,
      onSelectionChange: this.umbilical.onSelectionChange,
      onNodeClick: this.umbilical.onNodeClick,
      onEdgeClick: this.umbilical.onEdgeClick
    });
  }

  /**
   * Render diagram data
   * @param {Object} data - Diagram data to render
   */
  render(data) {
    if (this._destroyed) {
      throw new Error('Cannot render on destroyed DiagramRenderer');
    }

    try {
      // Validate new data
      if (data) {
        this._validateDiagramData(data);
      }
      
      // Update ViewModel with new data
      this.viewModel.setDiagramData(data || this.umbilical.data);
      
      // Compute layout
      this.viewModel.computeLayout();
      
      // Render view
      this.view.render(this.viewModel.getState());
      
    } catch (error) {
      // Only throw if there's no error handler
      if (!this.umbilical.onError) {
        throw error;
      }
      // Otherwise, just handle the error
      this.umbilical.onError(error);
    }
  }

  /**
   * Get the view model instance
   * @returns {DiagramViewModel}
   */
  getViewModel() {
    if (this._destroyed) {
      throw new Error('Cannot access view model of destroyed DiagramRenderer');
    }
    return this.viewModel;
  }

  /**
   * Get the view instance
   * @returns {DiagramView}
   */
  getView() {
    if (this._destroyed) {
      throw new Error('Cannot access view of destroyed DiagramRenderer');
    }
    return this.view;
  }

  /**
   * Zoom to fit all diagram elements
   */
  zoomToFit() {
    if (this._destroyed) {
      throw new Error('Cannot zoom on destroyed DiagramRenderer');
    }
    this.view.zoomToFit();
  }

  /**
   * Pan to specific position
   * @param {Object} position - { x, y } position to pan to
   */
  panTo(position) {
    if (this._destroyed) {
      throw new Error('Cannot pan on destroyed DiagramRenderer');
    }
    this.view.panTo(position);
  }

  /**
   * Select a node by ID
   * @param {string} nodeId - ID of node to select
   */
  selectNode(nodeId) {
    if (this._destroyed) {
      throw new Error('Cannot select on destroyed DiagramRenderer');
    }
    this.viewModel.selectElement(nodeId);
  }

  /**
   * Export diagram as SVG
   * @returns {string} SVG string
   */
  exportSVG() {
    if (this._destroyed) {
      throw new Error('Cannot export from destroyed DiagramRenderer');
    }
    return this.view.exportSVG();
  }

  /**
   * Export diagram as PNG
   * @returns {Promise<Blob>} PNG blob
   */
  async exportPNG() {
    if (this._destroyed) {
      throw new Error('Cannot export from destroyed DiagramRenderer');
    }
    return this.view.exportPNG();
  }

  /**
   * Handle errors
   * @private
   */
  _handleError(error) {
    if (this.umbilical.onError) {
      this.umbilical.onError(error);
    } else {
      throw error;
    }
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
    if (this.viewModel) {
      this.viewModel.destroy();
      this.viewModel = null;
    }
    
    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
    
    if (this.layoutEngine) {
      this.layoutEngine.destroy();
      this.layoutEngine = null;
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