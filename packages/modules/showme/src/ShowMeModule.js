/**
 * ShowMeModule
 * 
 * Main module class for ShowMe - Generic asset display module for Legion framework
 * Provides tools for displaying any asset type in appropriate floating windows
 */

import { AssetTypeDetector } from './detection/AssetTypeDetector.js';
import { ShowAssetTool } from './tools/ShowAssetTool.js';

export class ShowMeModule {
  constructor(options = {}) {
    this.name = 'ShowMe';
    this.version = '1.0.0';
    this.description = 'Generic asset display module for Legion framework. Provides tools for displaying any asset type (images, JSON, code, tables, web content) in appropriate floating windows with intelligent type detection.';
    
    // Store configuration
    this.config = {
      serverPort: options.serverPort || process.env.SHOWME_PORT || 3700,
      testMode: options.testMode || false,
      ...options
    };
    
    // Initialize components
    this.assetDetector = new AssetTypeDetector();
    
    // Initialize tools
    this.tools = this.initializeTools();
  }

  /**
   * Get module name
   * @returns {string} Module name
   */
  getName() {
    return this.name;
  }

  /**
   * Get module version
   * @returns {string} Semantic version string
   */
  getVersion() {
    return this.version;
  }

  /**
   * Get module description
   * @returns {string} Module description
   */
  getDescription() {
    return this.description;
  }

  /**
   * Get all tools provided by this module
   * @returns {Array} Array of tool objects with Legion-compatible interface
   */
  getTools() {
    return this.tools;
  }

  /**
   * Initialize tools with proper Legion framework integration
   * @private
   * @returns {Array} Array of initialized tool objects
   */
  initializeTools() {
    const tools = [];

    // Create ShowAssetTool
    const showAssetTool = new ShowAssetTool({
      assetDetector: this.assetDetector,
      serverPort: this.config.serverPort,
      testMode: this.config.testMode
    });

    tools.push({
      name: 'show_asset',
      description: 'Display asset in appropriate floating window with intelligent type detection. Supports images, JSON, code, tables, web content, and text with automatic or hint-based type detection.',
      execute: showAssetTool.execute.bind(showAssetTool),
      inputSchema: {
        type: 'object',
        properties: {
          asset: {
            description: 'Asset to display - can be any type (object, string, Buffer, file path, URL)',
            oneOf: [
              { type: 'object' },
              { type: 'string' },
              { type: 'array' },
              { type: 'number' },
              { type: 'boolean' }
            ]
          },
          hint: {
            type: 'string',
            enum: ['image', 'code', 'json', 'data', 'web', 'text'],
            description: 'Optional hint for asset type. If provided and compatible, overrides automatic detection.'
          },
          title: {
            type: 'string',
            description: 'Optional title for the display window'
          },
          options: {
            type: 'object',
            description: 'Optional display options (window size, position, etc.)',
            properties: {
              width: { type: 'number' },
              height: { type: 'number' },
              x: { type: 'number' },
              y: { type: 'number' },
              resizable: { type: 'boolean' },
              closable: { type: 'boolean' }
            }
          }
        },
        required: ['asset']
      },
      outputSchema: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Whether the display operation succeeded'
          },
          window_id: {
            type: 'string',
            description: 'Unique identifier for the created display window (if successful)'
          },
          detected_type: {
            type: 'string',
            enum: ['image', 'code', 'json', 'data', 'web', 'text'],
            description: 'The asset type that was detected and used for display'
          },
          title: {
            type: 'string',
            description: 'The title used for the display window'
          },
          error: {
            type: 'string',
            description: 'Error message if operation failed'
          }
        },
        required: ['success']
      }
    });

    return tools;
  }
}