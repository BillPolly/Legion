/**
 * SimpleNodeServerStrategy - Strategy for creating simple Node.js server applications
 * 
 * Focused on generating Express/HTTP servers with clean, testable code.
 * Uses PromptFactory for all LLM interactions with data-driven prompts.
 */

import { TaskStrategy } from '@legion/tasks';
import PromptFactory from '../../utils/PromptFactory.js';
import path from 'path';

export default class SimpleNodeServerStrategy extends TaskStrategy {
  constructor(llmClient = null, toolRegistry = null, options = {}) {
    super();
    
    this.llmClient = llmClient;
    this.toolRegistry = toolRegistry;
    this.projectRoot = options.projectRoot || '/tmp/roma-projects';
    
    // Pre-instantiated tools
    this.tools = {
      fileWrite: null,
      directoryCreate: null
    };
    
    // Prompts will be created during initialization
    this.prompts = null;
  }
  
  getName() {
    return 'SimpleNodeServer';
  }
  
  /**
   * Initialize strategy components and prompts
   */
  async initialize(task) {
    // Get services from task context
    const context = this._getContextFromTask(task);
    this.llmClient = this.llmClient || context.llmClient;
    this.toolRegistry = this.toolRegistry || context.toolRegistry;
    
    if (!this.llmClient) {
      throw new Error('LLM client is required');
    }
    
    if (!this.toolRegistry) {
      throw new Error('ToolRegistry is required');
    }
    
    // Load required tools
    this.tools.fileWrite = await this.toolRegistry.getTool('file_write');
    this.tools.directoryCreate = await this.toolRegistry.getTool('directory_create');
    
    // Create prompts using PromptFactory
    this.prompts = PromptFactory.createPrompts(
      this._getPromptDefinitions(),
      this.llmClient
    );
  }
  
  /**
   * Define all prompts as data
   */
  _getPromptDefinitions() {
    return {
      analyzeServerRequirements: {
        template: `Analyze this Node.js server request and extract requirements:

Task: "{{taskDescription}}"

Extract:
1. Server type (Express, HTTP, Fastify, Koa)
2. API endpoints needed
3. Middleware requirements
4. Database/storage needs
5. Authentication requirements`,
        responseSchema: PromptFactory.createJsonSchema({
          serverType: { type: 'string', enum: ['express', 'http', 'fastify', 'koa'] },
          endpoints: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                method: { type: 'string' },
                path: { type: 'string' },
                description: { type: 'string' }
              }
            }
          },
          middleware: { type: 'array', items: { type: 'string' } },
          database: { type: 'string' },
          authentication: { type: 'boolean' }
        }, ['serverType', 'endpoints']),
        examples: [
          {
            serverType: 'express',
            endpoints: [
              { method: 'GET', path: '/api/users', description: 'List all users' },
              { method: 'POST', path: '/api/users', description: 'Create a new user' },
              { method: 'GET', path: '/health', description: 'Health check endpoint' }
            ],
            middleware: ['cors', 'body-parser', 'helmet'],
            database: 'mongodb',
            authentication: true
          },
          {
            serverType: 'http',
            endpoints: [
              { method: 'GET', path: '/', description: 'Simple hello world' },
              { method: 'GET', path: '/ping', description: 'Ping endpoint' }
            ],
            middleware: [],
            database: 'none',
            authentication: false
          }
        ]
      },
      
      generateServerCode: {
        template: `Generate a simple Node.js {{serverType}} server with exactly these endpoints:

{{#each endpoints}}
- {{method}} {{path}}: {{description}}
{{/each}}

Requirements:
- Use {{serverType}} framework
- Include error handling
- Add basic logging
- Port from environment variable (default 3000)
- Graceful shutdown handling

Generate clean, production-ready code with ONLY the endpoints listed above.`,
        responseSchema: PromptFactory.createJsonSchema({
          code: { type: 'string' },
          dependencies: { type: 'array', items: { type: 'string' } }
        }, ['code', 'dependencies'], 'delimited'),  // Use delimited format for code generation
        examples: [
          {
            code: `import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// API endpoint
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello World' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});`,
            dependencies: ['express']
          }
        ]
      },
      
      generatePackageJson: {
        template: `Create package.json for a Node.js server:

Server type: {{serverType}}
Dependencies needed: {{dependencies}}

Include:
- Scripts: start, dev, test
- Type: module
- Node version: >=18`,
        responseSchema: PromptFactory.createJsonSchema({
          packageJson: { type: 'object' }
        }, ['packageJson']),
        examples: [
          {
            packageJson: {
              name: 'node-server',
              version: '1.0.0',
              description: 'Node.js Express server',
              type: 'module',
              main: 'server.js',
              scripts: {
                start: 'node server.js',
                dev: 'node --watch server.js',
                test: 'node --test'
              },
              engines: {
                node: '>=18.0.0'
              },
              dependencies: {
                express: '^4.18.2'
              },
              devDependencies: {}
            }
          },
          {
            packageJson: {
              name: 'fastify-api',
              version: '1.0.0',
              type: 'module',
              scripts: {
                start: 'node server.js',
                dev: 'node --watch server.js',
                test: 'node --test'
              },
              dependencies: {
                fastify: '^4.24.0',
                '@fastify/cors': '^8.4.0'
              }
            }
          }
        ]
      }
    };
  }
  
  /**
   * Handle parent messages
   */
  async onParentMessage(parentTask, message) {
    switch (message.type) {
      case 'start':
      case 'work':
        return await this._handleServerGeneration(parentTask);
      default:
        return { acknowledged: true };
    }
  }
  
  /**
   * Handle child messages (not used - leaf strategy)
   */
  async onChildMessage(childTask, message) {
    return { acknowledged: false, error: 'SimpleNodeServerStrategy does not handle child messages' };
  }
  
  /**
   * Main server generation handler
   */
  async _handleServerGeneration(task) {
    try {
      console.log(`🚀 Generating Node.js server for: ${task.description}`);
      
      // Initialize components
      await this.initialize(task);
      
      // Analyze requirements
      const requirements = await this._analyzeRequirements(task);
      task.addConversationEntry('system', `Server type: ${requirements.serverType}, Endpoints: ${requirements.endpoints.length}`);
      
      // Generate server code
      const serverCode = await this._generateServer(requirements);
      
      // Setup project structure
      const projectDir = await this._setupProject(task);
      
      // Write server file
      const serverPath = path.join(projectDir, 'server.js');
      await this.tools.fileWrite.execute({ 
        filepath: serverPath, 
        content: serverCode.code 
      });
      
      // Generate and write package.json
      const packageJson = await this._generatePackageJson(requirements.serverType, serverCode.dependencies);
      await this.tools.fileWrite.execute({ 
        filepath: path.join(projectDir, 'package.json'), 
        content: JSON.stringify(packageJson, null, 2) 
      });
      
      // Store artifacts
      task.storeArtifact('server.js', serverCode.code, 'Node.js server', 'file');
      task.storeArtifact('package.json', packageJson, 'Package configuration', 'json');
      
      const result = {
        success: true,
        message: `Created ${requirements.serverType} server with ${requirements.endpoints.length} endpoints`,
        projectDir: projectDir,
        artifacts: Object.values(task.getAllArtifacts())
      };
      
      task.complete(result);
      return result;
      
    } catch (error) {
      console.error(`❌ Server generation error:`, error);
      task.fail(error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Analyze server requirements from task description
   */
  async _analyzeRequirements(task) {
    const result = await PromptFactory.executePrompt(
      this.prompts.analyzeServerRequirements,
      { taskDescription: task.description }
    );
    
    if (!result.success) {
      const errorMsg = result.errors?.map(e => typeof e === 'object' ? JSON.stringify(e) : e).join(', ') || 'Unknown error';
      throw new Error(`Failed to analyze requirements: ${errorMsg}`);
    }
    
    return result.data;
  }
  
  /**
   * Generate server code based on requirements
   */
  async _generateServer(requirements) {
    const result = await PromptFactory.executePrompt(
      this.prompts.generateServerCode,
      {
        serverType: requirements.serverType,
        endpoints: requirements.endpoints
      }
    );
    
    if (!result.success) {
      throw new Error(`Failed to generate server: ${result.errors?.join(', ') || 'Unknown error'}`);
    }
    
    return result.data;
  }
  
  /**
   * Generate package.json
   */
  async _generatePackageJson(serverType, dependencies) {
    const result = await PromptFactory.executePrompt(
      this.prompts.generatePackageJson,
      {
        serverType: serverType,
        dependencies: dependencies.join(', ')
      }
    );
    
    if (!result.success) {
      throw new Error(`Failed to generate package.json: ${result.errors?.join(', ') || 'Unknown error'}`);
    }
    
    return result.data.packageJson;
  }
  
  /**
   * Setup project directory
   */
  async _setupProject(task) {
    const timestamp = Date.now();
    const projectName = `node-server-${timestamp}`;
    const projectDir = path.join(this.projectRoot, projectName);
    
    await this.tools.directoryCreate.execute({ path: this.projectRoot });
    await this.tools.directoryCreate.execute({ path: projectDir });
    
    return projectDir;
  }
  
  /**
   * Extract context from task
   */
  _getContextFromTask(task) {
    return {
      llmClient: (task.lookup && task.lookup('llmClient')) || task.context?.llmClient,
      toolRegistry: (task.lookup && task.lookup('toolRegistry')) || task.context?.toolRegistry,
      workspaceDir: (task.lookup && task.lookup('workspaceDir')) || task.context?.workspaceDir || this.projectRoot
    };
  }
}