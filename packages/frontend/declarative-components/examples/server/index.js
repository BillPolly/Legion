/**
 * Examples Server for Declarative Components
 * 
 * Uses BaseServer's static mode to serve examples with Legion packages
 * Clean, simple implementation without actor complexity
 */

import { BaseServer } from '@legion/server-framework';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ExamplesServer extends BaseServer {
  constructor(config = {}) {
    super();
    
    // Store configuration
    this.config = {
      port: config.port || process.env.EXAMPLES_PORT || 3800,
      host: 'localhost',
      ...config
    };
    
    this.isRunning = false;
  }

  /**
   * Initialize the examples server
   */
  async initialize() {
    // Call parent initialization to set up ResourceManager and Legion packages
    await super.initialize();
    console.log(`Examples Server initialized for port ${this.config.port}`);
  }

  /**
   * Start the examples server using BaseServer's static mode
   */
  async start() {
    if (this.isRunning) {
      console.log('Examples Server already running');
      return;
    }

    try {
      // Initialize if not already done
      await this.initialize();
      
      // Use BaseServer's new static server mode - much simpler!
      const { server, app } = await this.startStaticServer(this.config.port, {
        title: 'Legion Declarative Components - Interactive Examples',
        htmlFile: path.join(__dirname, '../public/index.html'),
        staticDirectory: path.join(__dirname, '../public')
      });
      
      // Add our custom API endpoints after the static server is running
      this.addExamplesAPIRoutes(app);
      
      this.isRunning = true;
      console.log(`\n🎉 Examples Server started successfully!`);
      console.log(`📖 Examples available at: http://${this.config.host}:${this.config.port}`);
      console.log(`🛠️ API endpoints available at: http://${this.config.host}:${this.config.port}/api`);
      console.log(`🚀 Legion packages served automatically with import rewriting`);
    } catch (error) {
      console.error('Failed to start Examples Server:', error);
      throw error;
    }
  }

  /**
   * Add API routes for examples functionality
   * @param {Express.Application} app - Express app instance from BaseServer
   */
  addExamplesAPIRoutes(app) {
    if (!app) {
      console.warn('Express app not provided, API routes not added');
      return;
    }

    // API endpoint to list available examples
    app.get('/api/examples', (req, res) => {
      res.json({
        categories: {
          basic: ['UserCard', 'Counter', 'SimpleForm'],
          forms: ['LoginForm', 'ContactForm'],
          lists: ['TodoApp', 'ShoppingCart'],
          advanced: ['Dashboard']
        }
      });
    });

    // API endpoint to get example source code
    app.get('/api/examples/:category/:name', (req, res) => {
      const { category, name } = req.params;
      try {
        res.json({
          name,
          category,
          dsl: this.loadExampleDSL(category, name),
          initialData: this.loadExampleData(category, name)
        });
      } catch (error) {
        res.status(404).json({ error: 'Example not found' });
      }
    });

    // API endpoint to validate DSL syntax
    app.post('/api/validate', async (req, res) => {
      const { dsl } = req.body;
      try {
        // Use ComponentCompiler to validate DSL
        const { ComponentCompiler } = await import('../../src/solver/ComponentCompiler.js');
        const compiler = new ComponentCompiler();
        const result = compiler.compile(dsl);
        res.json({ valid: true, result });
      } catch (error) {
        res.json({ valid: false, error: error.message });
      }
    });

    console.log('✅ Examples API routes added');
  }

  /**
   * Load example DSL code from file
   */
  loadExampleDSL(category, name) {
    // For now, return placeholder - will be implemented with actual file loading
    return `${name} :: data =>\n  div.example-${name.toLowerCase()} [\n    h1 { \"${name} Example\" }\n    p { \"Loading...\" }\n  ]`;
  }

  /**
   * Load example initial data
   */
  loadExampleData(category, name) {
    // Return basic data structure for examples
    return {
      data: {
        title: `${name} Example`,
        message: 'This is a sample component',
        counter: 0,
        active: true
      }
    };
  }

  /**
   * Stop the examples server
   */
  async stop() {
    if (this.isRunning) {
      await super.stop();
      this.isRunning = false;
      console.log('Examples Server stopped');
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

// Create and start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new ExamplesServer();
  
  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    console.log('\nShutting down Examples Server...');
    await server.stop();
    process.exit(0);
  });

  // Start server
  try {
    await server.initialize();
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

export default ExamplesServer;