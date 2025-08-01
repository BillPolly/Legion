/**
 * TreeScribe - Main component class
 * 
 * A comprehensive YAML document viewer with interactive tree navigation, 
 * multiple content renderers, search functionality, and accessibility features.
 * Follows the Umbilical Component Protocol for dependency injection and isolation.
 * 
 * @class TreeScribeInstance
 * @example
 * // Basic usage
 * const container = document.getElementById('tree-container');
 * const treeScribe = new TreeScribeInstance({ 
 *   dom: container,
 *   theme: 'dark',
 *   onNodeToggle: (nodeId, expanded) => console.log(`Node ${nodeId} ${expanded ? 'expanded' : 'collapsed'}`)
 * });
 * 
 * // Load YAML content
 * await treeScribe.loadYaml(`
 *   title: My Document
 *   sections:
 *     - title: Section 1
 *       content: This is section 1
 * `);
 * 
 * @example
 * // Using umbilical protocol create method
 * const TreeScribe = { create: (umbilical) => new TreeScribeInstance(umbilical) };
 * const instance = TreeScribe.create({
 *   dom: document.getElementById('container'),
 *   enableSearch: true,
 *   enableFolding: true
 * });
 */

import { TreeScribeModel } from './core/model/TreeScribeModel.js';
import { TreeScribeView } from './core/view/TreeScribeView.js';
import { TreeScribeViewModel } from './core/viewmodel/TreeScribeViewModel.js';
import { FoldingManager } from './features/interaction/FoldingManager.js';
import { InteractionManager } from './features/interaction/InteractionManager.js';
import { KeyboardNavigation } from './features/interaction/KeyboardNavigation.js';
import { SearchEngine } from './features/search/SearchEngine.js';
import { AdvancedSearchManager } from './features/search/AdvancedSearchManager.js';
import { VirtualScrollManager } from './features/performance/VirtualScrollManager.js';
import { MemoryManager } from './features/performance/MemoryManager.js';
import { AccessibilityManager } from './features/accessibility/AccessibilityManager.js';
import { ExportManager } from './features/export/ExportManager.js';
import { RendererRegistry } from './features/rendering/RendererRegistry.js';
import { PlaintextRenderer } from './features/rendering/renderers/PlaintextRenderer.js';
import { MarkdownRenderer } from './features/rendering/renderers/MarkdownRenderer.js';

export class TreeScribeInstance {
  /**
   * Creates a new TreeScribe instance
   * 
   * @param {Object} umbilical - Umbilical object containing all dependencies and configuration
   * @param {HTMLElement} umbilical.dom - DOM container element (required)
   * @param {string} [umbilical.theme='light'] - Visual theme ('light' or 'dark')
   * @param {boolean} [umbilical.enableSearch=true] - Enable search functionality
   * @param {boolean} [umbilical.enableFolding=true] - Enable node folding/expansion
   * @param {boolean} [umbilical.enableKeyboard=true] - Enable keyboard navigation
   * @param {boolean} [umbilical.enableVirtualScroll=false] - Enable virtual scrolling for large documents
   * @param {boolean} [umbilical.enableAccessibility=true] - Enable accessibility features
   * @param {boolean} [umbilical.enableExport=true] - Enable export functionality
   * @param {Object} [umbilical.renderers={}] - Custom content renderers
   * @param {Function} [umbilical.onNodeToggle] - Callback when nodes are expanded/collapsed
   * @param {Function} [umbilical.onSearch] - Callback when search is performed
   * @param {Function} [umbilical.onMount] - Callback when component is mounted
   * @param {Function} [umbilical.onDestroy] - Callback when component is destroyed
   * @param {Object} [umbilical.options] - Additional configuration options
   * @throws {Error} Throws error if required umbilical parameters are missing or invalid
   */
  constructor(umbilical) {
    this.umbilical = umbilical;
    this.destroyed = false;
    
    // Extract options
    this.options = {
      theme: umbilical.theme || 'light',
      enableSearch: umbilical.enableSearch !== false,
      enableFolding: umbilical.enableFolding !== false,
      enableKeyboard: umbilical.enableKeyboard !== false,
      enableVirtualScroll: umbilical.enableVirtualScroll !== false,
      enableAccessibility: umbilical.enableAccessibility !== false,
      enableExport: umbilical.enableExport !== false,
      renderers: umbilical.renderers || {},
      ...umbilical.options
    };
    
    // Initialize subsystems
    this._initializeSubsystems();
    
    // Create MVVM components
    this._createComponents();
    
    // Wire up interactions
    this._setupInteractions();
    
    // Notify mount
    if (umbilical.onMount) {
      umbilical.onMount(this);
    }
  }

  /**
   * Initialize all subsystems
   * @private
   */
  _initializeSubsystems() {
    // Renderer registry
    this.rendererRegistry = RendererRegistry.getInstance();
    this._registerCustomRenderers();
    
    // Memory management
    this.memoryManager = new MemoryManager({
      maxCacheSize: this.options.maxCacheSize || 500
    });
    
    // Search engine
    if (this.options.enableSearch) {
      this.searchEngine = new SearchEngine({
        caseSensitive: false,
        includeContent: true,
        includeTitle: true
      });
      
      this.searchManager = new AdvancedSearchManager({
        searchEngine: this.searchEngine
      });
    }
    
    // Accessibility
    if (this.options.enableAccessibility) {
      this.accessibilityManager = new AccessibilityManager({
        container: this.umbilical.dom,
        enableAnnouncements: true
      });
    }
    
    // Export manager
    if (this.options.enableExport) {
      this.exportManager = new ExportManager({
        includeMetadata: true,
        includeStyles: true
      });
    }
  }

  /**
   * Create MVVM components
   * @private
   */
  _createComponents() {
    // Model - TreeScribeModel constructor doesn't take options
    this.model = new TreeScribeModel();
    
    // View
    this.view = new TreeScribeView(this.umbilical.dom, {
      theme: this.options.theme,
      rendererRegistry: this.rendererRegistry
    });
    
    // ViewModel
    this.viewModel = new TreeScribeViewModel(this.model, this.view);
    
    // Folding manager
    if (this.options.enableFolding) {
      this.foldingManager = new FoldingManager(this.model);
    }
    
    // Virtual scroll
    if (this.options.enableVirtualScroll) {
      this.virtualScrollManager = new VirtualScrollManager({
        container: this.view.getScrollContainer(),
        itemHeight: 32,
        overscan: 5
      });
    }
  }

  /**
   * Setup interactions
   * @private
   */
  _setupInteractions() {
    // Interaction manager - needs the view and its nodeRenderer
    this.interactionManager = new InteractionManager(
      this.view,
      this.view.nodeRenderer || null
    );
    
    // Keyboard navigation
    if (this.options.enableKeyboard) {
      this.keyboardNavigation = new KeyboardNavigation(
        this.view,
        this.interactionManager,
        {
          searchManager: this.searchManager,
          accessibilityManager: this.accessibilityManager
        }
      );
    }
  }

  /**
   * Register custom renderers
   * @private
   */
  _registerCustomRenderers() {
    console.log('[TreeScribe] Registering renderers...');
    
    // Register default renderers
    const plaintextRenderer = new PlaintextRenderer();
    const plaintextRegistered = this.rendererRegistry.register(plaintextRenderer);
    console.log('[TreeScribe] PlaintextRenderer registered:', plaintextRegistered);
    
    const markdownRenderer = new MarkdownRenderer({
      theme: this.options.theme || 'light'
    });
    const markdownRegistered = this.rendererRegistry.register(markdownRenderer);
    console.log('[TreeScribe] MarkdownRenderer registered:', markdownRegistered);
    
    // Set plaintext as fallback
    this.rendererRegistry.setFallbackRenderer(plaintextRenderer);
    console.log('[TreeScribe] PlaintextRenderer set as fallback');
    
    // Log registry state
    console.log('[TreeScribe] Registered renderers:', this.rendererRegistry.getRegisteredRenderers());
    console.log('[TreeScribe] Supported content types:', this.rendererRegistry.getSupportedContentTypes());
    
    // Register custom renderers from options
    if (this.options.renderers) {
      Object.entries(this.options.renderers).forEach(([name, renderer]) => {
        if (typeof renderer === 'object' && renderer.render) {
          this.rendererRegistry.register(renderer);
        }
      });
    }
  }

  /**
   * Load and render YAML content in the tree view
   * 
   * @param {string|URL} content - YAML content string or URL to fetch from
   * @returns {Promise<Object>} Result object with success status and metadata
   * @returns {boolean} result.success - Whether the load operation succeeded
   * @returns {number} [result.nodeCount] - Number of nodes loaded (if successful)
   * @returns {string} [result.error] - Error message (if failed)
   * 
   * @example
   * // Load YAML string
   * const result = await treeScribe.loadYaml(`
   *   title: My Document
   *   sections:
   *     - title: Section 1
   *       description: Content here
   * `);
   * console.log(`Loaded ${result.nodeCount} nodes`);
   * 
   * @example
   * // Load from URL
   * const result = await treeScribe.loadYaml('https://example.com/document.yaml');
   * if (!result.success) {
   *   console.error('Load failed:', result.error);
   * }
   */
  /**
   * Load content with automatic format detection or specified format
   * @param {string} content - Document content or URL
   * @param {Object} options - Load options
   * @returns {Promise<Object>} Result with success status and metadata
   */
  async load(content, options = {}) {
    if (this.destroyed) {
      return { success: false, error: 'Component destroyed' };
    }
    
    try {
      // Show loading state
      this.view.showLoading();
      
      // Load content based on type
      let documentContent = content;
      let hints = { ...options };
      
      if (typeof content === 'string' && content.startsWith('http')) {
        // Load from URL
        const response = await fetch(content);
        if (!response.ok) {
          throw new Error(`Failed to load: ${response.statusText}`);
        }
        documentContent = await response.text();
        
        // Add URL as hint for format detection
        hints.filename = content;
        hints.mimeType = response.headers.get('content-type');
      }
      
      // Parse and load content
      let loadResult;
      try {
        loadResult = this.model.load(documentContent, hints);
      } catch (error) {
        this.view.showError(error.message);
        return { success: false, error: error.message };
      }
      
      // Update search index
      if (this.searchEngine) {
        const nodes = this.model.getAllNodes();
        this.searchEngine.indexNodes(nodes);
      }
      
      // Update view
      this.viewModel.render();
      
      // Hide loading state
      this.view.hideLoading();
      
      return loadResult;
      
    } catch (error) {
      console.error('[TreeScribe] Load error:', error);
      this.view.showError(error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load YAML content (deprecated - use load() instead)
   */
  async loadYaml(content) {
    return this.load(content, { format: 'yaml' });
  }

  /**
   * Search through the loaded document content
   * 
   * @param {string} query - Search query string
   * @param {Object} [options={}] - Search options
   * @param {boolean} [options.caseSensitive=false] - Whether search is case sensitive
   * @param {boolean} [options.includeContent=true] - Whether to search in content text
   * @param {boolean} [options.includeTitle=true] - Whether to search in node titles
   * @returns {Array<Object>} Array of search result objects
   * @returns {string} result.nodeId - ID of the matching node
   * @returns {Array<Object>} result.matches - Array of match details
   * 
   * @example
   * const results = treeScribe.search('introduction');
   * results.forEach(result => {
   *   console.log(`Found in node: ${result.nodeId}`);
   *   result.matches.forEach(match => {
   *     console.log(`Match: "${match.text}" at position ${match.position}`);
   *   });
   * });
   */
  search(query, options = {}) {
    if (!this.searchManager || this.destroyed) return [];
    
    const results = this.searchManager.search(query, options);
    
    // Highlight results in view
    this.view.clearHighlights();
    results.forEach(result => {
      this.view.highlightNode(result.nodeId, result.matches);
    });
    
    // Trigger search callback
    if (this.umbilical.onSearch) {
      this.umbilical.onSearch(query, results.length);
    }
    
    return results;
  }

  /**
   * Navigate search results
   */
  navigateSearchResults(direction = 'next') {
    if (!this.searchManager || this.destroyed) return null;
    
    const result = direction === 'next' 
      ? this.searchManager.navigateNext()
      : this.searchManager.navigatePrevious();
    
    if (result) {
      this.view.scrollToNode(result.nodeId);
      this.view.focusNode(result.nodeId);
    }
    
    return result;
  }

  /**
   * Clear search
   */
  clearSearch() {
    if (this.destroyed) return;
    
    this.view.clearHighlights();
    if (this.searchManager) {
      this.searchManager.clearHistory();
    }
  }

  /**
   * Expand all nodes in the tree
   * 
   * @example
   * treeScribe.expandAll();
   * // All nodes in the tree are now expanded and visible
   */
  expandAll() {
    if (!this.foldingManager || this.destroyed) return;
    
    this.foldingManager.expandAll();
    this.viewModel.render();
  }

  /**
   * Collapse all nodes in the tree
   * 
   * @example
   * treeScribe.collapseAll();
   * // All nodes in the tree are now collapsed, showing only root level
   */
  collapseAll() {
    if (!this.foldingManager || this.destroyed) return;
    
    this.foldingManager.collapseAll();
    this.viewModel.render();
  }

  /**
   * Expand to specific depth
   */
  expandToDepth(depth) {
    if (!this.foldingManager || this.destroyed) return;
    
    this.foldingManager.expandToDepth(depth);
    this.viewModel.render();
  }

  /**
   * Export the current document as HTML string
   * 
   * @param {Object} [options={}] - Export options
   * @param {boolean} [options.includeStyles=true] - Include CSS styles in output
   * @param {boolean} [options.includeMetadata=true] - Include node metadata
   * @param {string} [options.title] - Document title for HTML
   * @returns {string|null} HTML string representation or null if no document loaded
   * 
   * @example
   * const html = treeScribe.exportHTML({
   *   title: 'My Document Export',
   *   includeStyles: true
   * });
   * // Use html string for saving or displaying
   */
  exportHTML(options = {}) {
    if (!this.exportManager || this.destroyed) return null;
    if (!this.model.getRoot()) return null;
    
    const tree = {
      root: this.model.getRoot(),
      getNodeById: (id) => this.model.getNodeById(id)
    };
    
    return this.exportManager.exportHTML(tree, options);
  }

  /**
   * Export as JSON
   */
  exportJSON(options = {}) {
    if (!this.exportManager || this.destroyed) return null;
    if (!this.model.getRoot()) return null;
    
    const tree = {
      root: this.model.getRoot(),
      getNodeById: (id) => this.model.getNodeById(id)
    };
    
    return this.exportManager.exportJSON(tree, options);
  }

  /**
   * Export as Markdown
   */
  exportMarkdown(options = {}) {
    if (!this.exportManager || this.destroyed) return '';
    
    const tree = {
      root: this.model.getRoot(),
      getNodeById: (id) => this.model.getNodeById(id)
    };
    
    return this.exportManager.exportMarkdown(tree, options);
  }

  /**
   * Export as HTML (alias for exportHTML)
   */
  exportHtml(options = {}) {
    return this.exportHTML(options);
  }

  /**
   * Export the current document as JavaScript object
   * 
   * @param {Object} [options={}] - Export options (currently unused)
   * @returns {Object|null} JavaScript object representation or null if no document loaded
   * @returns {string} result.id - Root node ID
   * @returns {string} result.title - Document title
   * @returns {string} result.content - Root content
   * @returns {Array<Object>} result.children - Child nodes array
   * 
   * @example
   * const docObj = treeScribe.exportJson();
   * console.log(`Document "${docObj.title}" has ${docObj.children.length} sections`);
   * 
   * // Access nested structure
   * docObj.children.forEach(child => {
   *   console.log(`Section: ${child.title}`);
   * });
   */
  exportJson(options = {}) {
    if (this.destroyed) return null;
    if (!this.model.getRoot()) return null;
    
    return this.model.exportJson();
  }

  /**
   * Search content (alias for search)
   */
  searchContent(query, options = {}) {
    return this.search(query, options);
  }

  /**
   * Get the current state of a specific node
   * 
   * @param {string} nodeId - The ID of the node to query
   * @returns {Object|null} Node state object or null if node not found
   * @returns {boolean} result.expanded - Whether the node is expanded
   * @returns {boolean} result.visible - Whether the node is visible
   * @returns {boolean} result.selected - Whether the node is selected
   * @returns {boolean} result.highlighted - Whether the node is highlighted
   * 
   * @example
   * const state = treeScribe.getNodeState('node-123');
   * if (state?.expanded) {
   *   console.log('Node is expanded');
   * }
   */
  getNodeState(nodeId) {
    if (this.destroyed) return null;
    
    const node = this.model.getNodeById(nodeId);
    if (!node) return null;
    
    return {
      expanded: node.state?.expanded || false,
      visible: node.state?.visible !== false,
      selected: node.state?.selected || false,
      highlighted: node.state?.highlighted || false
    };
  }

  /**
   * Update the state of a specific node
   * 
   * @param {string} nodeId - The ID of the node to update
   * @param {Object} state - State properties to update
   * @param {boolean} [state.expanded] - Set expansion state
   * @param {boolean} [state.visible] - Set visibility state
   * @param {boolean} [state.selected] - Set selection state
   * @param {boolean} [state.highlighted] - Set highlight state
   * @returns {boolean} True if state was updated successfully, false otherwise
   * 
   * @example
   * // Expand a node
   * const success = treeScribe.setNodeState('node-123', { expanded: true });
   * if (success) {
   *   console.log('Node expanded successfully');
   * }
   * 
   * @example
   * // Update multiple state properties
   * treeScribe.setNodeState('node-456', {
   *   expanded: true,
   *   selected: true,
   *   highlighted: false
   * });
   */
  setNodeState(nodeId, state) {
    if (this.destroyed) return false;
    
    const node = this.model.getNodeById(nodeId);
    if (!node) return false;
    
    node.setState(state);
    
    // Trigger node toggle callback if expanded state changed
    if (state.expanded !== undefined && this.umbilical.onNodeToggle) {
      this.umbilical.onNodeToggle(nodeId, state.expanded);
    }
    
    // Re-render if necessary
    if (this.viewModel) {
      this.viewModel.render();
    }
    
    return true;
  }

  /**
   * Get folding state
   */
  getFoldingState() {
    if (this.destroyed || !this.foldingManager) return null;
    
    return this.foldingManager.getFoldingState();
  }

  /**
   * Register a renderer
   */
  registerRenderer(name, renderer) {
    if (this.destroyed) return false;
    
    return this.rendererRegistry.register(name, renderer);
  }

  /**
   * Register a parser
   * @param {BaseParser} parser - Parser instance
   */
  registerParser(parser) {
    if (this.destroyed) return false;
    
    this.model.registerParser(parser);
    return true;
  }

  /**
   * Get supported formats
   * @returns {string[]} Array of format identifiers
   */
  getSupportedFormats() {
    if (this.destroyed) return [];
    
    return this.model.getSupportedFormats();
  }

  /**
   * Detect format of content
   * @param {string} content - Document content
   * @param {Object} hints - Format hints
   * @returns {string|null} Detected format or null
   */
  detectFormat(content, hints = {}) {
    if (this.destroyed) return null;
    
    return this.model.detectFormat(content, hints);
  }

  /**
   * Get detailed format analysis
   * @param {string} content - Document content
   * @param {Object} hints - Format hints
   * @returns {Object} Detailed format analysis with confidence scores
   */
  analyzeFormat(content, hints = {}) {
    if (this.destroyed) return null;
    
    return this.model.analyzeFormat(content, hints);
  }

  /**
   * Set theme
   */
  setTheme(theme) {
    if (this.destroyed) return;
    
    this.view.setTheme(theme);
  }

  /**
   * Get tree statistics
   */
  getStatistics() {
    if (this.destroyed) return {};
    
    return {
      totalNodes: this.model.getNodeCount(),
      expandedNodes: this.foldingManager ? this.foldingManager.getExpandedCount() : 0,
      maxDepth: this.model.getMaxDepth(),
      memoryUsage: this.memoryManager.getMemoryInfo(),
      searchIndexSize: this.searchEngine ? this.searchEngine.getIndexSize() : 0
    };
  }

  /**
   * Destroy the TreeScribe instance and clean up all resources
   * 
   * This method:
   * - Removes all event listeners
   * - Cleans up DOM elements
   * - Destroys all subsystems (search, folding, accessibility, etc.)
   * - Calls the onDestroy callback if provided
   * - Prevents memory leaks
   * 
   * @example
   * // Clean up when component is no longer needed
   * treeScribe.destroy();
   * 
   * @example
   * // Safe to call multiple times
   * treeScribe.destroy();
   * treeScribe.destroy(); // No-op, already destroyed
   */
  destroy() {
    if (this.destroyed) return;
    
    // Notify before destroy
    if (this.umbilical.onDestroy) {
      this.umbilical.onDestroy(this);
    }
    
    // Cleanup subsystems
    if (this.virtualScrollManager) this.virtualScrollManager.destroy();
    if (this.keyboardNavigation) this.keyboardNavigation.destroy();
    if (this.interactionManager) this.interactionManager.destroy();
    if (this.foldingManager) this.foldingManager.destroy();
    if (this.accessibilityManager) this.accessibilityManager.destroy();
    if (this.searchManager) this.searchManager.destroy();
    if (this.searchEngine) this.searchEngine.destroy();
    if (this.exportManager) this.exportManager.destroy();
    if (this.memoryManager) this.memoryManager.destroy();
    
    // Cleanup MVVM
    if (this.viewModel) this.viewModel.destroy();
    if (this.view) this.view.destroy();
    if (this.model) this.model.destroy();
    
    this.destroyed = true;
  }
}