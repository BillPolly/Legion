/**
 * ShowMeServer
 * 
 * Server infrastructure for the ShowMe module
 * Extends ConfigurableActorServer to provide asset display services
 */

import { ConfigurableActorServer } from '@legion/server-framework';
import { ResourceManager } from '@legion/resource-manager';
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
    
    this.isRunning = false;
  }

  /**
   * Initialize the server
   */
  async initialize() {
    await super.initialize();
    
    // Initialize asset storage
    this.assets = new Map();
    this.assetCounter = 0;
    
    console.log(`ShowMeServer initialized on port ${this.config.port}`);
  }

  /**
   * Start the server
   */
  async start() {
    if (this.isRunning) {
      console.log('ShowMeServer already running');
      return;
    }

    try {
      // Ensure assets map is initialized
      if (!this.assets) {
        this.assets = new Map();
      }
      
      await super.start();
      this.isRunning = true;
      console.log(`ShowMeServer started on port ${this.config.port}`);
    } catch (error) {
      console.error('Failed to start ShowMeServer:', error);
      throw error;
    }
  }

  /**
   * Stop the server
   */
  async stop() {
    if (this.isRunning) {
      await super.stop();
      this.isRunning = false;
      
      // Clear assets on stop
      if (this.assets) {
        this.assets.clear();
      }
      
      console.log('ShowMeServer stopped');
    }
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      running: this.isRunning,
      port: this.config.port,
      url: this.isRunning ? `http://localhost:${this.config.port}` : null
    };
  }
}