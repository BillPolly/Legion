/**
 * ShowAssetTool
 * 
 * Tool for displaying assets in appropriate floating windows with intelligent type detection
 */

import { ShowMeServer } from '../server/ShowMeServer.js';
import fetch from 'node-fetch';

export class ShowAssetTool {
  constructor(options = {}) {
    this.assetDetector = options.assetDetector;
    
    if (!this.assetDetector) {
      throw new Error('ShowAssetTool requires assetDetector in options');
    }
    
    // Server management
    this.server = null;
    this.serverPort = options.serverPort || process.env.SHOWME_PORT || 3700;
    this.serverUrl = `http://localhost:${this.serverPort}`;
  }

  /**
   * Execute the show asset operation
   * @param {Object} params - Tool parameters
   * @param {*} params.asset - Asset to display (any type)
   * @param {string} [params.hint] - Optional type hint
   * @param {string} [params.title] - Optional window title
   * @param {Object} [params.options] - Optional display options
   * @returns {Promise<Object>} Execution result
   */
  async execute(params = {}) {
    try {
      // Validate required parameters
      if (params.asset === undefined || params.asset === null) {
        return {
          success: false,
          error: 'Missing required parameter: asset'
        };
      }

      const { asset, hint, title, options = {} } = params;

      // Detect asset type
      const detectedType = this.assetDetector.detectAssetType(asset, hint);

      // Generate title if not provided
      const finalTitle = title || this.generateTitle(asset, detectedType);

      // Ensure server is running
      await this.ensureServerRunning();

      // Send asset to server for display
      const response = await this.sendAssetToServer({
        asset: this.prepareAssetForTransmission(asset, detectedType),
        assetType: detectedType,
        title: finalTitle
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to display asset');
      }

      // Return success with display information
      return {
        success: true,
        window_id: response.windowId,
        detected_type: detectedType,
        title: finalTitle,
        url: response.url,
        assetId: response.assetId
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to display asset: ${error.message}`
      };
    }
  }

  /**
   * Ensure ShowMe server is running
   */
  async ensureServerRunning() {
    // Check if server is already running
    const isRunning = await this.checkServerStatus();
    
    if (isRunning) {
      return true;
    }

    // Start the server
    console.log('Starting ShowMe server...');
    
    if (!this.server) {
      this.server = new ShowMeServer({
        port: this.serverPort,
        skipLegionPackages: true // Skip for faster startup in tools
      });
      
      await this.server.initialize();
    }

    await this.server.start();
    
    // Wait a moment for server to be ready
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify server is running
    const running = await this.checkServerStatus();
    if (!running) {
      throw new Error('Failed to start ShowMe server');
    }

    console.log(`ShowMe server started on port ${this.serverPort}`);
    return true;
  }

  /**
   * Check if server is running
   */
  async checkServerStatus() {
    try {
      const response = await fetch(`${this.serverUrl}/api/assets`, {
        method: 'GET',
        timeout: 1000
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Send asset to server for display
   */
  async sendAssetToServer(data) {
    try {
      const response = await fetch(`${this.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Server error: ${error}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to send asset to server:', error);
      throw error;
    }
  }

  /**
   * Prepare asset for transmission to server
   */
  prepareAssetForTransmission(asset, detectedType) {
    // Handle different asset types for transmission
    if (Buffer.isBuffer(asset)) {
      // Convert Buffer to base64 for transmission
      return {
        type: 'buffer',
        data: asset.toString('base64'),
        encoding: 'base64'
      };
    } else if (typeof asset === 'string') {
      // Strings can be sent directly
      return asset;
    } else if (typeof asset === 'object') {
      // Objects are sent as-is (will be JSON stringified)
      return asset;
    } else {
      // Primitives
      return asset;
    }
  }

  /**
   * Generate unique window ID
   * @private
   * @returns {string} Unique window identifier
   */
  generateWindowId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `showme_${timestamp}_${random}`;
  }

  /**
   * Generate appropriate title for asset
   * @private
   * @param {*} asset - Asset being displayed
   * @param {string} detectedType - Detected asset type
   * @returns {string} Generated title
   */
  generateTitle(asset, detectedType) {
    switch (detectedType) {
      case 'image':
        if (typeof asset === 'string' && (asset.startsWith('http') || asset.includes('/'))) {
          return `Image: ${this.getFileName(asset)}`;
        }
        return 'Image Viewer';
      
      case 'code':
        if (typeof asset === 'string' && asset.includes('.')) {
          return `Code: ${this.getFileName(asset)}`;
        }
        return 'Code Viewer';
      
      case 'json':
        return 'JSON Viewer';
      
      case 'data':
        return 'Data Table';
      
      case 'web':
        if (typeof asset === 'string' && asset.startsWith('http')) {
          return `Web: ${asset}`;
        }
        return 'Web Content';
      
      case 'text':
      default:
        return 'Text Viewer';
    }
  }

  /**
   * Extract filename from path or URL
   * @private
   * @param {string} path - File path or URL
   * @returns {string} Filename
   */
  getFileName(path) {
    if (typeof path !== 'string') return 'Unknown';
    
    const parts = path.split('/');
    const filename = parts[parts.length - 1];
    return filename || 'Unknown';
  }

  /**
   * Get preview of asset for logging
   * @private
   * @param {*} asset - Asset to preview
   * @param {string} detectedType - Detected type
   * @returns {string} Asset preview
   */
  getAssetPreview(asset, detectedType) {
    switch (detectedType) {
      case 'image':
        if (Buffer.isBuffer(asset)) {
          return `Buffer(${asset.length} bytes)`;
        }
        return typeof asset === 'string' ? asset : 'Image data';
      
      case 'json':
        if (typeof asset === 'object') {
          try {
            return JSON.stringify(asset, null, 2).substring(0, 100) + '...';
          } catch (error) {
            // Handle circular references or other JSON.stringify errors
            return '[Complex Object - cannot stringify]';
          }
        }
        return asset.toString().substring(0, 100) + '...';
      
      case 'data':
        if (Array.isArray(asset)) {
          return `Array with ${asset.length} items`;
        }
        return asset.toString().substring(0, 100) + '...';
      
      case 'code':
      case 'web':
      case 'text':
      default:
        const str = asset.toString();
        return str.length > 100 ? str.substring(0, 100) + '...' : str;
    }
  }
}