/**
 * CLIServer - Server Mode for CLI
 *
 * This is Mode 2 (Server) - runs as a background server with WebSocket + HTTP API.
 * Multiple clients can connect, each gets their own CLISessionActor.
 *
 * Usage:
 *   const server = new CLIServer({ port: 4000 });
 *   await server.initialize();
 *   await server.start();
 */

import { ConfigurableActorServer } from '@legion/server-framework';
import { ShowMeController } from '@legion/showme';
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class CLIServer extends ConfigurableActorServer {
  constructor(config = {}) {
    // Default configuration
    const defaultConfig = {
      port: config.port || process.env.CLI_PORT || 4000,
      skipLegionPackages: false, // Always discover Legion packages for serving
      routes: [
        {
          path: '/cli',
          serverActor: '../actors/CLISessionActor.js',
          clientActor: '../../apps/cli-ui/src/client/BrowserCLIClientActor.js',
          services: ['showme', 'resourceManager'], // Services required by CLISessionActor
          importMap: {
            '@cli-ui/': '/src/'
          }
        }
      ],
      static: {
        '/src': path.resolve(__dirname, '../../apps/cli-ui/src')
      },
      __dirname // Pass our directory for relative path resolution
    };

    super({ ...defaultConfig, ...config });

    this.isRunning = false;

    // ShowMe controller for all sessions
    this.showme = null;
    this.showmePort = config.showmePort || 3700;

    // Resource manager
    this.resourceManager = null;
  }

  /**
   * Initialize the server
   */
  async initialize() {
    // Initialize parent FIRST - this sets up resourceManager and monorepoRoot
    await super.initialize();

    // Create ShowMeController - shared by all CLI sessions
    this.showme = new ShowMeController({ port: this.showmePort });
    await this.showme.initialize();
    await this.showme.start();

    // Add showme to services Map (resourceManager already added by super.initialize())
    this.services.set('showme', this.showme);

    console.log(`CLIServer initialized on port ${this.config.port}`);
    console.log(`ShowMe running on port ${this.showmePort}`);
  }

  /**
   * Start the server
   */
  async start() {
    if (this.isRunning) {
      console.log('CLIServer already running');
      return;
    }

    try {
      await super.start();
      this.isRunning = true;

      console.log(`CLIServer started on port ${this.config.port}`);
      console.log(`WebSocket endpoint: ws://localhost:${this.config.port}/ws?route=/cli`);
      console.log(`HTTP API: http://localhost:${this.config.port}/api/command`);
    } catch (error) {
      console.error('Failed to start CLIServer:', error);
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

      // Stop ShowMe
      if (this.showme && this.showme.isRunning) {
        await this.showme.stop();
      }

      console.log('CLIServer stopped');
    }
  }

  /**
   * Set up additional HTTP routes
   * @override
   */
  async setupCustomRoutes(app) {
    await super.setupCustomRoutes?.(app);

    // REST API endpoint for command execution
    app.post('/api/command', async (req, res) => {
      try {
        const { command, sessionId } = req.body;

        if (!command) {
          return res.status(400).json({
            success: false,
            error: 'Command is required'
          });
        }

        // For REST API, we need a way to route to specific session
        // For now, this is a simplified version - proper session management
        // would require session tokens or cookies
        res.json({
          success: false,
          error: 'REST API not yet implemented. Use WebSocket connection for stateful sessions.'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Status endpoint
    app.get('/api/status', async (req, res) => {
      res.json({
        success: true,
        status: this.getStatus()
      });
    });
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      mode: 'server',
      running: this.isRunning,
      port: this.config.port,
      url: this.isRunning ? `http://localhost:${this.config.port}` : null,
      showme: this.showme ? this.showme.getStatus() : null,
      activeSessions: this.actorManagers.get(this.config.port)?.connections.size || 0
    };
  }
}

export default CLIServer;
