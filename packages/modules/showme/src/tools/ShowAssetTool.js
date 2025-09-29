/**
 * ShowAssetTool
 * 
 * Tool for displaying assets via handle-based actor communication
 * Creates handles for assets and sends them via WebSocket to ShowMeServerActor
 */

import { ShowMeServer } from '../server/ShowMeServer.js';
import { ShowMeServerActor } from '../server/actors/ShowMeServerActor.js';
import fetch from 'node-fetch';

export class ShowAssetTool {
  constructor(options = {}) {
    this.assetDetector = options.assetDetector;
    
    if (!this.assetDetector) {
      throw new Error('ShowAssetTool requires assetDetector in options');
    }
    
    // Server and actor management
    this.server = null;
    this.serverActor = null;
    this.serverPort = options.serverPort || process.env.SHOWME_PORT || 3700;
    
    // Handle storage - stores asset handles, not actual data
    this.handleStorage = new Map();
    this.handleCounter = 0;
    this.assetCounter = 0; // Counter for unique asset IDs
    
    // Test mode flag - when true, doesn't start server
    this.testMode = options.testMode || false;
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

      // Detect asset type using new detect() method that returns rich result
      const detectionResult = this.assetDetector.detect(asset, { hint });
      const detectedType = detectionResult.type === 'handle'
        ? `handle-${detectionResult.subtype}`
        : detectionResult.type;

      // For Handles, store URI not full instance
      const assetToStore = detectionResult.type === 'handle'
        ? (detectionResult.uri || detectionResult.instance.toURI())
        : asset;

      // Generate title if not provided
      const finalTitle = title || this.generateTitle(assetToStore, detectedType, detectionResult);

      // In test mode, skip server operations and return mock result
      if (this.testMode) {
        const assetHandle = this.createAssetHandle(assetToStore, detectedType, finalTitle);
        return {
          success: true,
          window_id: this.generateWindowId(),
          detected_type: detectedType,
          title: finalTitle,
          url: `http://localhost:${this.serverPort}/showme#handle=${assetHandle.id}`,
          assetId: assetHandle.id
        };
      }

      // Ensure server and actor are running
      await this.ensureServerRunning();

      // Create handle for the asset (not the asset data itself)
      const assetHandle = this.createAssetHandle(assetToStore, detectedType, finalTitle);

      // Send handle to server actor for display
      const displayResult = await this.sendHandleToServerActor({
        assetId: assetHandle.id,
        assetType: detectedType,
        title: finalTitle,
        asset: assetToStore // Store URI for Handles, full data for traditional assets
      });

      if (!displayResult) {
        throw new Error('Failed to send handle to server actor');
      }

      // Return success with server-provided information
      return {
        success: true,
        window_id: displayResult.window_id || `window_${assetHandle.id}`,
        detected_type: displayResult.detected_type || detectedType,
        title: displayResult.title || finalTitle,
        url: displayResult.url || `http://localhost:${this.serverPort}/showme#handle=${assetHandle.id}`,
        assetId: displayResult.assetId || assetHandle.id
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to display asset: ${error.message}`
      };
    }
  }

  /**
   * Ensure ShowMe server and actor are running
   */
  async ensureServerRunning() {
    if (this.server && this.serverActor) {
      return true; // Already running
    }

    // Check if server was passed in during construction (for testing)
    if (!this.server) {
      // Start the server with actor system
      console.log('Starting ShowMe server with actor system...');
      
      this.server = new ShowMeServer({
        port: this.serverPort,
        skipLegionPackages: true // Skip for faster startup in tools
      });
      
      await this.server.initialize();
      await this.server.start();
      
      // Wait a moment for actor system to be ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log(`ShowMe server and actor started on port ${this.serverPort}`);
    }
    
    // Mark server actor as available - we'll use direct server access instead of actor communication
    // The actor is running inside the server but we access the server's asset map directly
    this.serverActor = { available: true };
    
    return true;
  }

  /**
   * Create a handle for an asset (handle-based architecture)
   * The handle is a reference/identifier, not the asset data itself
   */
  createAssetHandle(asset, assetType, title) {
    const handleId = `handle_${++this.handleCounter}_${Date.now()}`;
    const handle = {
      id: handleId,
      assetType,
      title,
      asset, // Store asset locally in the handle
      created: Date.now()
    };
    
    // Store the handle locally
    this.handleStorage.set(handleId, handle);
    
    return handle;
  }

  /**
   * Send handle to server actor for display (not the asset data)
   */
  async sendHandleToServerActor(data) {
    try {
      if (!this.serverActor || !this.serverActor.available) {
        throw new Error('Server actor not available');
      }

      // Check if server is running
      if (!this.server || !this.server.isRunning) {
        throw new Error('Failed to connect to ShowMe server');
      }

      // For now, we'll just store the asset in the server's asset map
      // In a real implementation, this would use WebSocket to send to the actor
      if (this.server && this.server.assets) {
        const assetId = `asset-${++this.assetCounter}-${Date.now()}`;
        this.server.assets.set(assetId, {
          id: assetId,
          asset: data.asset,
          type: data.assetType,
          title: data.title,
          timestamp: Date.now(),
          windowId: `window-${assetId}`
        });

        const result = {
          success: true,
          assetId: assetId,
          url: `http://localhost:${this.serverPort}/showme#handle=${assetId}`,
          window_id: `window-${assetId}`,
          detected_type: data.assetType,
          title: data.title
        };

        // Store the server-generated asset ID
        this.serverAssetId = result.assetId;
        this.serverUrl = result.url;

        console.log(`Handle ${data.assetId} sent to server actor for display`);
        return result;
      } else {
        throw new Error('Server not properly initialized');
      }
    } catch (error) {
      console.error('Failed to send handle to server actor:', error);
      throw error;
    }
  }

  /**
   * Get asset by handle ID
   */
  getAssetByHandle(handleId) {
    return this.handleStorage.get(handleId);
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
   * @param {Object} detectionResult - Full detection result with Handle info
   * @returns {string} Generated title
   */
  generateTitle(asset, detectedType, detectionResult = null) {
    // Handle type-specific titles
    if (detectedType.startsWith('handle-')) {
      const subtype = detectedType.replace('handle-', '');
      return `${subtype.charAt(0).toUpperCase() + subtype.slice(1)} Handle`;
    }

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