/**
 * ShowMeServer
 * 
 * Server infrastructure for the ShowMe module
 * Extends ConfigurableActorServer to provide asset display services
 */

import { ConfigurableActorServer } from '@legion/server-framework';
import { ResourceManager } from '@legion/resource-manager';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ShowMeServer extends ConfigurableActorServer {
  constructor(config = {}) {
    // Default configuration
    const defaultConfig = {
      port: config.port || process.env.SHOWME_PORT || 3700,
      skipLegionPackages: config.skipLegionPackages || false, // Skip Legion package discovery for tests
      routes: [
        {
          path: '/showme',
          serverActor: './actors/ShowMeServerActor.js',
          clientActor: '../client/actors/ShowMeClientActor.js'
        }
      ],
      static: {
        '/legion/components': '@legion/components/src',
        '/assets': path.join(__dirname, '../../assets')
      },
      services: {
        'assetStorage': './services/AssetStorageService.js'
      },
      __dirname // Pass our directory for relative path resolution
    };

    super({ ...defaultConfig, ...config });
    
    // Asset storage for session
    this.assetStorage = new Map();
    this.assetCounter = 0;
    this.serverInstance = null;
  }

  /**
   * Initialize the server
   */
  async initialize() {
    await super.initialize();
    
    // Add API endpoints for asset operations
    this.setupAssetEndpoints();
    
    console.log(`ShowMeServer initialized on port ${this.config.port}`);
  }

  /**
   * Set up asset-specific API endpoints
   */
  setupAssetEndpoints() {
    // Endpoint to receive and store assets
    this.app.post('/api/display-asset', express.json({ limit: '50mb' }), this.handleDisplayAsset.bind(this));
    
    // Endpoint to retrieve stored assets
    this.app.get('/api/asset/:id', this.handleGetAsset.bind(this));
    
    // Endpoint to list all assets
    this.app.get('/api/assets', this.handleListAssets.bind(this));
    
    // Endpoint to clear assets
    this.app.delete('/api/assets/:id', this.handleDeleteAsset.bind(this));
  }

  /**
   * Handle display asset request
   */
  async handleDisplayAsset(req, res) {
    try {
      const { asset, assetType, title } = req.body;
      
      if (!asset) {
        return res.status(400).json({
          success: false,
          error: 'Asset is required'
        });
      }

      // Generate unique asset ID
      const assetId = `asset_${++this.assetCounter}_${Date.now()}`;
      
      // Store asset with metadata
      this.assetStorage.set(assetId, {
        id: assetId,
        asset,
        assetType,
        title,
        timestamp: Date.now(),
        windowId: null // Will be set when window is created
      });

      // Notify connected clients via actor system
      if (this.actorSpace) {
        await this.actorSpace.sendMessage('showme-server', 'asset-ready', {
          assetId,
          assetType,
          title
        });
      }

      // Return success response
      res.json({
        success: true,
        assetId,
        windowId: `window_${assetId}`,
        url: `http://localhost:${this.config.port}/showme#asset=${assetId}`
      });

    } catch (error) {
      console.error('Error handling display asset:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Handle get asset request
   */
  async handleGetAsset(req, res) {
    try {
      const { id } = req.params;
      const assetData = this.assetStorage.get(id);
      
      if (!assetData) {
        return res.status(404).json({
          success: false,
          error: 'Asset not found'
        });
      }

      res.json({
        success: true,
        data: assetData
      });

    } catch (error) {
      console.error('Error getting asset:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Handle list assets request
   */
  async handleListAssets(req, res) {
    try {
      const assets = Array.from(this.assetStorage.values()).map(asset => ({
        id: asset.id,
        assetType: asset.assetType,
        title: asset.title,
        timestamp: asset.timestamp
      }));

      res.json({
        success: true,
        assets
      });

    } catch (error) {
      console.error('Error listing assets:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Handle delete asset request
   */
  async handleDeleteAsset(req, res) {
    try {
      const { id } = req.params;
      
      if (!this.assetStorage.has(id)) {
        return res.status(404).json({
          success: false,
          error: 'Asset not found'
        });
      }

      this.assetStorage.delete(id);

      // Notify clients of deletion
      if (this.actorSpace) {
        await this.actorSpace.sendMessage('showme-server', 'asset-deleted', {
          assetId: id
        });
      }

      res.json({
        success: true,
        message: 'Asset deleted'
      });

    } catch (error) {
      console.error('Error deleting asset:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Start the server
   */
  async start() {
    if (this.serverInstance) {
      console.log('ShowMeServer already running');
      return this.serverInstance;
    }

    try {
      this.serverInstance = await super.start();
      console.log(`ShowMeServer started on port ${this.config.port}`);
      return this.serverInstance;
    } catch (error) {
      console.error('Failed to start ShowMeServer:', error);
      throw error;
    }
  }

  /**
   * Stop the server
   */
  async stop() {
    if (this.serverInstance) {
      await super.stop();
      this.serverInstance = null;
      console.log('ShowMeServer stopped');
    }
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      running: !!this.serverInstance,
      port: this.config.port,
      assetsStored: this.assetStorage.size,
      url: this.serverInstance ? `http://localhost:${this.config.port}` : null
    };
  }
}