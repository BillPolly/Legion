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
import open from 'open';

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
        '/assets': path.join(__dirname, '../../assets'),
        '/': path.join(__dirname, '../../apps/showme-ui'),
        '/src': path.join(__dirname, '../../apps/showme-ui/src'),
        '/showme-src': path.join(__dirname, '..')  // Serve the ShowMe module src directory
      },
      services: {
        'assetStorage': './services/AssetStorageService.js'
      },
      __dirname // Pass our directory for relative path resolution
    };

    super({ ...defaultConfig, ...config });

    this.isRunning = false;
    this.browserLaunched = false;
    this.browserOptions = config.browserOptions || {
      app: true,
      width: 1200,
      height: 800
    };
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
   * Launch browser in app mode
   * @param {string} url - URL to open
   * @param {Object} options - Browser launch options
   */
  async launchBrowser(url, options = {}) {
    // Merge with default browser options
    const launchOptions = { ...this.browserOptions, ...options };

    // Build Chrome app mode arguments
    const chromeArgs = [];

    // App mode (chromeless window)
    if (launchOptions.app) {
      chromeArgs.push(`--app=${url}`);
    }

    // Window size
    if (launchOptions.width && launchOptions.height) {
      chromeArgs.push(`--window-size=${launchOptions.width},${launchOptions.height}`);
    }

    // Window position
    if (launchOptions.x !== undefined && launchOptions.y !== undefined) {
      chromeArgs.push(`--window-position=${launchOptions.x},${launchOptions.y}`);
    }

    // Additional Chrome flags to disable unnecessary features
    chromeArgs.push('--disable-features=TranslateUI');
    chromeArgs.push('--disable-sync');
    chromeArgs.push('--no-first-run');
    chromeArgs.push('--no-default-browser-check');

    try {
      console.log(`Launching browser in app mode: ${url}`);
      console.log(`Chrome args: ${chromeArgs.join(' ')}`);

      // Launch browser with Chrome-specific arguments
      await open(url, {
        app: {
          name: 'google chrome',
          arguments: chromeArgs
        }
      });

      this.browserLaunched = true;
      console.log('Browser launched successfully');
    } catch (error) {
      throw new Error(`Failed to launch browser: ${error.message}`);
    }
  }

  /**
   * Trigger browser launch on first display
   * @param {string} path - Path to display (default: /showme)
   */
  async ensureBrowserLaunched(path = '/showme') {
    if (!this.browserLaunched && this.isRunning) {
      const url = `http://localhost:${this.config.port}${path}`;
      await this.launchBrowser(url);
    }
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      running: this.isRunning,
      port: this.config.port,
      url: this.isRunning ? `http://localhost:${this.config.port}` : null,
      browserLaunched: this.browserLaunched
    };
  }
}