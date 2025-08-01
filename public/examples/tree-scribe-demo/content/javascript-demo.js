/**
 * JavaScript Demo File for TreeScribe
 * 
 * This file demonstrates how TreeScribe parses JavaScript/TypeScript
 * code and extracts its structure including classes, functions, and modules.
 */

// ES6 imports demonstrate module structure
import { SomeUtility } from './utils/helpers.js';
import { BaseComponent } from './components/base.js';

/**
 * Configuration object for the application
 */
const CONFIG = {
  theme: 'dark',
  version: '1.0.0',
  features: {
    search: true,
    export: true,
    plugins: true
  }
};

/**
 * Main application class
 * Extends BaseComponent to provide core functionality
 */
export class TreeScribeApp extends BaseComponent {
  /**
   * Creates a new TreeScribe application instance
   * @param {Object} options - Configuration options
   * @param {HTMLElement} options.container - DOM container
   * @param {string} options.theme - UI theme ('light' or 'dark')
   */
  constructor(options = {}) {
    super(options);
    
    this.container = options.container;
    this.theme = options.theme || 'light';
    this.plugins = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize the application
   * Sets up the UI and loads default content
   */
  async initialize() {
    if (this.isInitialized) {
      throw new Error('Application already initialized');
    }

    this._setupUI();
    await this._loadDefaultContent();
    this._bindEvents();
    
    this.isInitialized = true;
    this.emit('initialized', { timestamp: Date.now() });
  }

  /**
   * Load content into the tree view
   * @param {string} content - The content to parse and display
   * @param {Object} options - Parsing options
   * @returns {Promise<Object>} Parsed tree structure
   */
  async loadContent(content, options = {}) {
    const startTime = performance.now();
    
    try {
      const parser = this._selectParser(content, options);
      const tree = await parser.parse(content);
      
      this._renderTree(tree);
      
      const loadTime = performance.now() - startTime;
      this._updateStatus({ loadTime, nodeCount: this._countNodes(tree) });
      
      return tree;
    } catch (error) {
      this._handleError(error);
      throw error;
    }
  }

  /**
   * Register a new parser plugin
   * @param {string} format - Format name (e.g., 'csv', 'toml')
   * @param {Object} plugin - Parser plugin object
   */
  registerPlugin(format, plugin) {
    if (!this._validatePlugin(plugin)) {
      throw new Error(`Invalid plugin for format: ${format}`);
    }

    this.plugins.set(format, plugin);
    this.emit('plugin-registered', { format, plugin });
  }

  /**
   * Private setup methods
   */
  _setupUI() {
    this.container.innerHTML = `
      <div class="app-header">
        <h1>TreeScribe Demo</h1>
        <div class="app-controls">
          <button id="theme-toggle">Toggle Theme</button>
          <button id="export-btn">Export</button>
        </div>
      </div>
      <div class="app-content">
        <div class="tree-container" id="tree-view"></div>
      </div>
    `;
  }

  _bindEvents() {
    const themeToggle = this.container.querySelector('#theme-toggle');
    const exportBtn = this.container.querySelector('#export-btn');

    themeToggle?.addEventListener('click', () => this._toggleTheme());
    exportBtn?.addEventListener('click', () => this._exportContent());

    // Keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'e':
            event.preventDefault();
            this._exportContent();
            break;
          case 't':
            event.preventDefault();
            this._toggleTheme();
            break;
        }
      }
    });
  }

  _selectParser(content, options) {
    if (options.format && this.plugins.has(options.format)) {
      return this.plugins.get(options.format);
    }

    // Auto-detect format based on content
    for (const [format, plugin] of this.plugins) {
      if (plugin.canParse && plugin.canParse(content) > 0.8) {
        return plugin;
      }
    }

    throw new Error('No suitable parser found');
  }

  _validatePlugin(plugin) {
    const requiredMethods = ['parse', 'canParse', 'getSupportedFormats'];
    return requiredMethods.every(method => typeof plugin[method] === 'function');
  }

  _countNodes(tree, count = 0) {
    if (!tree) return count;
    
    count++;
    if (tree.children && Array.isArray(tree.children)) {
      tree.children.forEach(child => {
        count = this._countNodes(child, count);
      });
    }
    
    return count;
  }

  /**
   * Utility functions
   */
  static create(options) {
    return new TreeScribeApp(options);
  }

  static async fromFile(file, options = {}) {
    const content = await file.text();
    const app = new TreeScribeApp(options);
    await app.initialize();
    await app.loadContent(content, { format: file.type });
    return app;
  }
}

/**
 * Helper function for creating parsers
 * @param {string} name - Parser name
 * @param {Function} parseFunction - Parse implementation
 * @returns {Object} Parser object
 */
export function createParser(name, parseFunction) {
  return {
    name,
    parse: parseFunction,
    canParse: (content) => 0.5, // Default confidence
    getSupportedFormats: () => [name.toLowerCase()],
    validate: async (content) => ({ valid: true, errors: [] })
  };
}

/**
 * Async generator for processing large datasets
 * @param {Array} data - Data to process
 * @param {number} batchSize - Items per batch
 */
export async function* processBatches(data, batchSize = 100) {
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    yield await processBatch(batch);
  }
}

/**
 * Modern async/await function example
 */
async function processBatch(batch) {
  return Promise.all(batch.map(async (item) => {
    // Simulate async processing
    await new Promise(resolve => setTimeout(resolve, 1));
    return { ...item, processed: true };
  }));
}

// ES6 arrow functions and destructuring
const utilities = {
  debounce: (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  },

  throttle: (func, limit) => {
    let inThrottle;
    return (...args) => {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
};

// Export default for module loading
export default TreeScribeApp;