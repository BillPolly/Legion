/**
 * TreeScribeModel - Core data model for TreeScribe component
 * Enhanced with multi-format support via ParserRegistry
 */

import { TreeNode } from './TreeNode.js';
import { YamlProcessor } from './YamlProcessor.js';
import { ParserRegistry } from '../../features/parsing/ParserRegistry.js';
import { YamlParser } from '../../features/parsing/parsers/YamlParser.js';
import { JsonParser } from '../../features/parsing/parsers/JsonParser.js';
import { MarkdownParser } from '../../features/parsing/parsers/MarkdownParser.js';
import { HtmlParser } from '../../features/parsing/parsers/HtmlParser.js';
import { JavaScriptParser } from '../../features/parsing/parsers/JavaScriptParser.js';
import { XmlParser } from '../../features/parsing/parsers/XmlParser.js';
import { FormatDetector } from '../../features/parsing/FormatDetector.js';

export class TreeScribeModel {
  constructor() {
    this.rootNode = null;
    this.nodeIndex = new Map(); // Fast node lookup by ID
    this.metadata = {};
    this.eventListeners = new Map();
    
    // Initialize parser registry and format detector
    this.parserRegistry = new ParserRegistry();
    this.formatDetector = new FormatDetector();
    this._initializeParsers();
  }

  /**
   * Initialize default parsers
   * @private
   */
  _initializeParsers() {
    // Register all core parsers
    const yamlParser = new YamlParser();
    const jsonParser = new JsonParser();
    const markdownParser = new MarkdownParser();
    const htmlParser = new HtmlParser();
    const jsParser = new JavaScriptParser();
    const xmlParser = new XmlParser();
    
    this.parserRegistry.registerParser(yamlParser);
    this.parserRegistry.registerParser(jsonParser);
    this.parserRegistry.registerParser(markdownParser);
    this.parserRegistry.registerParser(htmlParser);
    this.parserRegistry.registerParser(jsParser);
    this.parserRegistry.registerParser(xmlParser);
    
    // YAML remains the default for backward compatibility
    this.parserRegistry.setDefaultParser('YamlParser');
  }

  /**
   * Load content with automatic format detection or specified format
   * @param {string} content - Document content
   * @param {Object} options - Load options
   * @returns {Object} Load result with success status and node count
   */
  load(content, options = {}) {
    try {
      // Validate input
      if (content === null || content === undefined || typeof content !== 'string') {
        throw new Error('Invalid content: must be a string');
      }

      // Get parser based on content and hints
      const parser = this.parserRegistry.getParser(content, {
        format: options.format,
        mimeType: options.mimeType,
        filename: options.filename,
        ...options.hints
      });

      if (!parser) {
        throw new Error(`No parser found for content. Supported formats: ${this.parserRegistry.getFormats().join(', ')}`);
      }

      console.log(`[TreeScribeModel] Using parser: ${parser.getName()}`);

      // Parse content
      const parsed = parser.parse(content, options.parserOptions || {});
      
      // Validate parsed result
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid parsed structure: must contain valid document structure');
      }

      // Build tree from parsed data
      this.rootNode = this._buildTreeFromObject(parsed);
      
      // Validate root node was created
      if (!this.rootNode) {
        throw new Error('Failed to create tree structure from content');
      }
      
      // Store metadata about the load
      this.metadata = {
        ...this.metadata,
        sourceFormat: parsed.sourceFormat || parser.getSupportedFormats()[0],
        parser: parser.getName(),
        loadTime: new Date().toISOString(),
        nodeCount: this.getNodeCount()
      };
      
      // Create node index for fast lookup
      this._buildNodeIndex();
      
      // Emit change event
      this._emit('modelChanged', { 
        type: 'loaded', 
        rootNode: this.rootNode,
        metadata: this.metadata
      });
      
      return { 
        success: true, 
        nodeCount: this.getNodeCount(),
        format: this.metadata.sourceFormat,
        parser: this.metadata.parser
      };
      
    } catch (error) {
      console.error('Failed to load content:', error);
      
      // Clean up any partial state
      this.rootNode = null;
      this.nodeIndex.clear();
      this.metadata = {};
      
      throw error;
    }
  }

  /**
   * Load YAML content and build tree structure
   * @deprecated Use load() method instead
   */
  loadYaml(yamlString) {
    // Use the new load method with explicit YAML format
    return this.load(yamlString, { format: 'yaml' });
  }

  /**
   * Build tree structure from normalized object
   * @private
   */
  _buildTreeFromObject(obj, parent = null) {
    console.log('[TreeScribeModel] Building node from object:', {
      title: obj.title,
      contentType: obj.contentType,
      hasContent: !!obj.content
    });
    
    const node = new TreeNode({
      id: obj.id,
      title: obj.title,
      description: obj.content,
      contentType: obj.contentType,
      metadata: obj.metadata
    });

    node.parent = parent;
    
    // Process children recursively
    if (obj.children && Array.isArray(obj.children)) {
      obj.children.forEach(childData => {
        const childNode = this._buildTreeFromObject(childData, node);
        node.children.push(childNode);
      });
    }

    return node;
  }

  /**
   * Build node index for fast lookup
   * @private
   */
  _buildNodeIndex() {
    this.nodeIndex.clear();
    
    if (this.rootNode) {
      this._indexNode(this.rootNode);
    }
  }

  /**
   * Recursively index a node and its children
   * @private
   */
  _indexNode(node) {
    this.nodeIndex.set(node.id, node);
    
    node.children.forEach(child => {
      this._indexNode(child);
    });
  }

  /**
   * Get node by ID (O(1) lookup)
   */
  getNode(nodeId) {
    return this.nodeIndex.get(nodeId) || null;
  }

  /**
   * Get all nodes in the tree
   */
  getAllNodes() {
    const nodes = [];
    
    if (this.rootNode) {
      this._collectNodes(this.rootNode, nodes);
    }
    
    return nodes;
  }

  /**
   * Recursively collect all nodes
   * @private
   */
  _collectNodes(node, collection) {
    collection.push(node);
    
    node.children.forEach(child => {
      this._collectNodes(child, collection);
    });
  }

  /**
   * Get direct children of a node
   */
  getChildren(nodeId) {
    const node = this.getNode(nodeId);
    return node ? node.children : [];
  }

  /**
   * Get all descendants of a node
   */
  getDescendants(nodeId) {
    const node = this.getNode(nodeId);
    if (!node) return [];
    
    const descendants = [];
    node.children.forEach(child => {
      this._collectNodes(child, descendants);
    });
    
    return descendants;
  }

  /**
   * Get path from root to a specific node
   */
  getPathToNode(nodeId) {
    const node = this.getNode(nodeId);
    if (!node) return [];
    
    const path = [];
    let current = node;
    
    while (current) {
      path.unshift(current);
      current = current.parent;
    }
    
    return path;
  }

  /**
   * Export tree to JSON format
   */
  exportJson() {
    if (!this.rootNode) {
      return null;
    }
    
    return this._nodeToJson(this.rootNode);
  }

  /**
   * Convert node to JSON representation
   * @private
   */
  _nodeToJson(node) {
    const json = {
      id: node.id,
      title: node.title,
      content: node.content,
      contentType: node.contentType,
      metadata: node.metadata,
      children: node.children.map(child => this._nodeToJson(child))
    };
    
    return json;
  }

  /**
   * Add event listener
   */
  on(eventType, callback) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    
    const listeners = this.eventListeners.get(eventType);
    listeners.push(callback);
    
    // Return function to remove listener
    return () => {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit event to listeners
   * @private
   */
  _emit(eventType, data) {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Event listener error:', error);
        }
      });
    }
  }

  /**
   * Get node by ID (alias for getNode)
   */
  getNodeById(nodeId) {
    return this.getNode(nodeId);
  }

  /**
   * Get root node
   */
  getRoot() {
    return this.rootNode;
  }

  /**
   * Get total node count
   */
  getNodeCount() {
    return this.nodeIndex.size;
  }

  /**
   * Get maximum depth in tree
   */
  getMaxDepth() {
    if (!this.rootNode) return 0;
    
    let maxDepth = 0;
    const traverse = (node) => {
      maxDepth = Math.max(maxDepth, node.getDepth());
      node.children.forEach(child => traverse(child));
    };
    
    traverse(this.rootNode);
    return maxDepth;
  }

  /**
   * Register a parser with the model
   * @param {BaseParser} parser - Parser instance
   */
  registerParser(parser) {
    this.parserRegistry.registerParser(parser);
  }

  /**
   * Get supported formats
   * @returns {string[]} Array of format identifiers
   */
  getSupportedFormats() {
    return this.parserRegistry.getFormats();
  }

  /**
   * Detect format of content
   * @param {string} content - Document content
   * @param {Object} hints - Format hints
   * @returns {string|null} Detected format or null
   */
  detectFormat(content, hints = {}) {
    // Use the format detector for more intelligent detection
    const detection = this.formatDetector.detect(content, hints);
    
    if (detection.format && this.formatDetector.isReliable(detection)) {
      return detection.format;
    }
    
    // Fallback to parser registry detection
    const parser = this.parserRegistry.getParser(content, hints);
    if (parser) {
      return parser.getSupportedFormats()[0];
    }
    
    return null;
  }

  /**
   * Get detailed format analysis
   * @param {string} content - Document content
   * @param {Object} hints - Format hints
   * @returns {Object} Detailed format analysis
   */
  analyzeFormat(content, hints = {}) {
    return this.formatDetector.detect(content, hints);
  }

  /**
   * Get parser capabilities
   * @returns {Object} Map of parser capabilities
   */
  getParserCapabilities() {
    return this.parserRegistry.getAllCapabilities();
  }

  /**
   * Clean up model
   */
  destroy() {
    this.rootNode = null;
    this.nodeIndex.clear();
    this.eventListeners.clear();
    this.metadata = {};
    this.parserRegistry.clear();
  }
}