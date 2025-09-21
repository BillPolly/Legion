/**
 * CreateExpressAPIStrategy - Specialized strategy for Express.js REST API development
 * 
 * This is a true SOP (Standard Operating Procedure) for creating Express.js APIs.
 * It knows exactly what files to create, what patterns to use, and how to structure
 * a production-ready Express.js application.
 */

import { TaskStrategy } from '@legion/tasks';
import fs from 'fs/promises';
import path from 'path';

export default class CreateExpressAPIStrategy extends TaskStrategy {
  constructor(llmClient = null, toolRegistry = null, options = {}) {
    super();
    
    this.llmClient = llmClient;
    this.toolRegistry = toolRegistry;
    this.currentTask = null;
    
    // Configurable project root directory
    this.projectRoot = options.projectRoot || process.env.PROJECT_ROOT || '/tmp';
    
    // Pre-instantiated tools (loaded during initialization)
    this.tools = {
      fileWrite: null,
      directoryCreate: null
    };
    
    // Express.js specific configuration
    this.expressConfig = {
      defaultPort: 3000,
      useTypeScript: false,
      includeAuth: true,
      includeCORS: true,
      includeHelmet: true,
      includeRateLimit: true,
      useESModules: true
    };
  }
  
  getName() {
    return 'CreateExpressAPI';
  }
  
  /**
   * Handle messages from parent task
   */
  async onParentMessage(parentTask, message) {
    switch (message.type) {
      case 'start':
      case 'work':
        this.currentTask = parentTask;
        return await this._handleExpressAPICreation(parentTask);
        
      case 'abort':
        console.log(`🛑 CreateExpressAPIStrategy received abort`);
        return { acknowledged: true, aborted: true };
        
      default:
        return { acknowledged: true };
    }
  }
  
  /**
   * Handle messages from child tasks (not applicable)
   */
  async onChildMessage(childTask, message) {
    return { acknowledged: false, error: 'CreateExpressAPIStrategy does not handle child messages' };
  }
  
  /**
   * Main Express API creation handler
   * @private
   */
  async _handleExpressAPICreation(task) {
    try {
      console.log(`🚀 CreateExpressAPIStrategy creating Express API: ${task.description}`);
      
      // Initialize components
      await this._initializeComponents(task);
      
      // Analyze the specific API requirements
      const apiSpec = await this._analyzeAPIRequirements(task);
      task.addConversationEntry('system', `Express API specification: ${JSON.stringify(apiSpec, null, 2)}`);
      
      // Create the complete Express.js project structure
      const result = await this._createExpressProject(task, apiSpec);
      
      if (result.success) {
        task.complete(result);
        return result;
      } else {
        task.fail(new Error(result.error || 'Express API creation failed'));
        return result;
      }
      
    } catch (error) {
      console.error(`❌ CreateExpressAPIStrategy error:`, error);
      task.fail(error);
      return {
        success: false,
        error: error.message,
        artifacts: Object.values(task.getAllArtifacts())
      };
    }
  }
  
  /**
   * Initialize strategy components
   * @private
   */
  async _initializeComponents(task) {
    const context = this._getContextFromTask(task);
    
    this.llmClient = this.llmClient || context.llmClient;
    this.toolRegistry = this.toolRegistry || context.toolRegistry;
    
    if (!this.llmClient) {
      throw new Error('LLM client is required for CreateExpressAPIStrategy');
    }
    
    if (!this.toolRegistry) {
      throw new Error('ToolRegistry is required for CreateExpressAPIStrategy');
    }
    
    // Load required tools
    await this._loadRequiredTools();
  }
  
  /**
   * Load required tools
   * @private
   */
  async _loadRequiredTools() {
    try {
      this.tools.fileWrite = await this.toolRegistry.getTool('file_write');
      this.tools.directoryCreate = await this.toolRegistry.getTool('directory_create');
      
      if (!this.tools.fileWrite || !this.tools.directoryCreate) {
        throw new Error('Required tools (file_write, directory_create) are not available');
      }
      
      console.log('🚀 CreateExpressAPIStrategy tools loaded successfully');
      
    } catch (error) {
      throw new Error(`Failed to load required tools: ${error.message}`);
    }
  }
  
  /**
   * Analyze API requirements from task description
   * @private
   */
  async _analyzeAPIRequirements(task) {
    const prompt = `Analyze this Express.js API task and extract specific requirements:

Task: "${task.description}"

Extract the following information and return as JSON:
{
  "apiName": "descriptive name for the API",
  "port": 3000,
  "endpoints": [
    {
      "method": "GET|POST|PUT|DELETE",
      "path": "/endpoint/path",
      "description": "what this endpoint does",
      "requiresAuth": true/false,
      "parameters": ["param1", "param2"],
      "responseType": "json|html|text"
    }
  ],
  "dataModels": [
    {
      "name": "ModelName",
      "fields": {
        "fieldName": "string|number|boolean|date",
        "fieldName2": "string"
      },
      "description": "what this model represents"
    }
  ],
  "features": {
    "authentication": true/false,
    "cors": true/false,
    "rateLimit": true/false,
    "logging": true/false,
    "validation": true/false,
    "errorHandling": true/false,
    "database": "memory|file|mongodb|none",
    "testing": true/false
  },
  "middleware": ["cors", "helmet", "morgan", "rateLimit", "auth"],
  "dependencies": ["express", "cors", "helmet", "express-rate-limit"]
}

Focus on extracting specific, actionable requirements for Express.js API development.`;

    try {
      const response = await this.llmClient.generateResponse([{
        role: 'user',
        content: prompt
      }]);
      
      return JSON.parse(response);
    } catch (error) {
      console.log(`⚠️ API requirements analysis failed, using defaults: ${error.message}`);
      return this._getDefaultAPISpec(task);
    }
  }
  
  /**
   * Get default API specification
   * @private
   */
  _getDefaultAPISpec(task) {
    return {
      apiName: 'Express API',
      port: 3000,
      endpoints: [
        {
          method: 'GET',
          path: '/',
          description: 'Health check endpoint',
          requiresAuth: false,
          parameters: [],
          responseType: 'json'
        }
      ],
      dataModels: [],
      features: {
        authentication: false,
        cors: true,
        rateLimit: true,
        logging: true,
        validation: true,
        errorHandling: true,
        database: 'memory',
        testing: true
      },
      middleware: ['cors', 'helmet', 'morgan'],
      dependencies: ['express', 'cors', 'helmet', 'morgan']
    };
  }
  
  /**
   * Create the complete Express.js project
   * @private
   */
  async _createExpressProject(task, apiSpec) {
    console.log(`🏗️ Creating Express.js project with ${apiSpec.endpoints.length} endpoints`);
    
    try {
      // Setup project directory
      const outputDir = await this._setupProjectDirectory(task, apiSpec);
      
      // Create directory structure
      await this._createDirectoryStructure(outputDir);
      
      // Generate all project files
      const generatedFiles = {};
      
      // 1. Package.json
      const packageJson = await this._generatePackageJson(apiSpec);
      await this.tools.fileWrite.execute({
        filepath: path.join(outputDir, 'package.json'),
        content: JSON.stringify(packageJson, null, 2)
      });
      generatedFiles['package.json'] = packageJson;
      
      // 2. Main application file (index.js)
      const mainApp = await this._generateMainApp(apiSpec);
      await this.tools.fileWrite.execute({
        filepath: path.join(outputDir, 'src', 'index.js'),
        content: mainApp
      });
      generatedFiles['src/index.js'] = mainApp;
      
      // 3. Routes files
      const routes = await this._generateRoutes(apiSpec);
      for (const [filename, content] of Object.entries(routes)) {
        const routePath = path.join(outputDir, 'src', 'routes', filename);
        await this.tools.fileWrite.execute({ filepath: routePath, content });
        generatedFiles[`src/routes/${filename}`] = content;
      }
      
      // 4. Middleware files
      if (apiSpec.features.authentication || apiSpec.features.errorHandling) {
        const middleware = await this._generateMiddleware(apiSpec);
        for (const [filename, content] of Object.entries(middleware)) {
          const middlewarePath = path.join(outputDir, 'src', 'middleware', filename);
          await this.tools.fileWrite.execute({ filepath: middlewarePath, content });
          generatedFiles[`src/middleware/${filename}`] = content;
        }
      }
      
      // 5. Models (if data models are specified)
      if (apiSpec.dataModels.length > 0) {
        const models = await this._generateModels(apiSpec);
        for (const [filename, content] of Object.entries(models)) {
          const modelPath = path.join(outputDir, 'src', 'models', filename);
          await this.tools.fileWrite.execute({ filepath: modelPath, content });
          generatedFiles[`src/models/${filename}`] = content;
        }
      }
      
      // 6. Configuration file
      const config = await this._generateConfig(apiSpec);
      await this.tools.fileWrite.execute({
        filepath: path.join(outputDir, 'src', 'config.js'),
        content: config
      });
      generatedFiles['src/config.js'] = config;
      
      // 7. README.md
      const readme = await this._generateREADME(apiSpec);
      await this.tools.fileWrite.execute({
        filepath: path.join(outputDir, 'README.md'),
        content: readme
      });
      generatedFiles['README.md'] = readme;
      
      // Store all artifacts
      for (const [filename, content] of Object.entries(generatedFiles)) {
        task.storeArtifact(filename, content, `Generated ${filename}`, 'file');
      }
      
      return {
        success: true,
        result: {
          message: `Express.js API "${apiSpec.apiName}" created successfully`,
          outputDirectory: outputDir,
          filesGenerated: Object.keys(generatedFiles).length,
          files: Object.keys(generatedFiles),
          endpoints: apiSpec.endpoints.length,
          features: Object.keys(apiSpec.features).filter(f => apiSpec.features[f])
        },
        artifacts: Object.values(task.getAllArtifacts())
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Express.js project creation failed: ${error.message}`
      };
    }
  }
  
  /**
   * Create Express.js directory structure
   * @private
   */
  async _createDirectoryStructure(outputDir) {
    const directories = [
      'src',
      'src/routes',
      'src/middleware',
      'src/models',
      'src/utils',
      'tests',
      'tests/unit',
      'tests/integration'
    ];
    
    for (const dir of directories) {
      await this.tools.directoryCreate.execute({ path: path.join(outputDir, dir) });
    }
  }
  
  /**
   * Generate Express.js specific package.json
   * @private
   */
  async _generatePackageJson(apiSpec) {
    const dependencies = {
      express: '^4.18.2'
    };
    
    const devDependencies = {
      nodemon: '^3.0.1',
      jest: '^29.7.0',
      supertest: '^6.3.3'
    };
    
    // Add specified dependencies
    if (apiSpec.dependencies) {
      for (const dep of apiSpec.dependencies) {
        switch (dep) {
          case 'cors':
            dependencies.cors = '^2.8.5';
            break;
          case 'helmet':
            dependencies.helmet = '^7.1.0';
            break;
          case 'morgan':
            dependencies.morgan = '^1.10.0';
            break;
          case 'express-rate-limit':
            dependencies['express-rate-limit'] = '^7.1.5';
            break;
          case 'jsonwebtoken':
            dependencies.jsonwebtoken = '^9.0.2';
            break;
          case 'bcryptjs':
            dependencies.bcryptjs = '^2.4.3';
            break;
          case 'joi':
            dependencies.joi = '^17.11.0';
            break;
        }
      }
    }
    
    return {
      name: apiSpec.apiName.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: `Express.js API for ${apiSpec.apiName}`,
      main: 'src/index.js',
      type: 'module',
      scripts: {
        start: 'node src/index.js',
        dev: 'nodemon src/index.js',
        test: 'jest',
        'test:watch': 'jest --watch',
        'test:coverage': 'jest --coverage'
      },
      dependencies,
      devDependencies,
      jest: {
        testEnvironment: 'node',
        transform: {},
        extensionsToTreatAsEsm: ['.js'],
        globals: {
          'ts-jest': {
            useESM: true
          }
        }
      },
      engines: {
        node: '>=18.0.0'
      },
      keywords: ['express', 'api', 'rest', 'nodejs'],
      author: 'Generated by CreateExpressAPIStrategy',
      license: 'MIT'
    };
  }
  
  /**
   * Generate main Express application file
   * @private
   */
  async _generateMainApp(apiSpec) {
    const prompt = `Generate a production-ready Express.js main application file (index.js) with these specifications:

API Name: ${apiSpec.apiName}
Port: ${apiSpec.port}
Features: ${JSON.stringify(apiSpec.features, null, 2)}
Middleware: ${apiSpec.middleware.join(', ')}
Endpoints: ${apiSpec.endpoints.length} endpoints

Requirements:
1. Use ES6 modules (import/export)
2. Include proper error handling middleware
3. Include request logging
4. Include CORS if specified
5. Include security headers (helmet) if specified
6. Include rate limiting if specified
7. Include graceful shutdown handling
8. Include health check endpoint
9. Import and use route files
10. Include comprehensive error handling
11. Include request validation middleware
12. Include proper HTTP status codes
13. Include environment variable configuration

Structure:
- Import statements at top
- Middleware setup in logical order
- Route mounting
- Error handling middleware at end
- Server startup with graceful shutdown

Make this production-ready with proper error handling, logging, and best practices.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate route files
   * @private
   */
  async _generateRoutes(apiSpec) {
    const routes = {};
    
    // Group endpoints by base path
    const routeGroups = this._groupEndpointsByRoute(apiSpec.endpoints);
    
    for (const [routeName, endpoints] of Object.entries(routeGroups)) {
      const routeContent = await this._generateRouteFile(routeName, endpoints, apiSpec);
      routes[`${routeName}.js`] = routeContent;
    }
    
    return routes;
  }
  
  /**
   * Group endpoints by their base route
   * @private
   */
  _groupEndpointsByRoute(endpoints) {
    const groups = {};
    
    for (const endpoint of endpoints) {
      // Extract base route (first segment after /)
      const pathParts = endpoint.path.split('/').filter(Boolean);
      const basePath = pathParts[0] || 'index';
      
      if (!groups[basePath]) {
        groups[basePath] = [];
      }
      groups[basePath].push(endpoint);
    }
    
    return groups;
  }
  
  /**
   * Generate a specific route file
   * @private
   */
  async _generateRouteFile(routeName, endpoints, apiSpec) {
    const prompt = `Generate an Express.js route file for the "${routeName}" route with these endpoints:

Endpoints:
${endpoints.map(e => `${e.method} ${e.path} - ${e.description}`).join('\n')}

Route Details:
${JSON.stringify(endpoints, null, 2)}

Requirements:
1. Use Express Router
2. Use ES6 modules (import/export)
3. Include proper error handling for each endpoint
4. Include input validation where appropriate
5. Include proper HTTP status codes
6. Include JSDoc comments for each endpoint
7. Handle async operations properly
8. Include authentication middleware if required
9. Include proper request/response patterns
10. Handle edge cases and error conditions

Make this production-ready with comprehensive error handling and validation.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate middleware files
   * @private
   */
  async _generateMiddleware(apiSpec) {
    const middleware = {};
    
    if (apiSpec.features.authentication) {
      middleware['auth.js'] = await this._generateAuthMiddleware(apiSpec);
    }
    
    if (apiSpec.features.errorHandling) {
      middleware['errorHandler.js'] = await this._generateErrorMiddleware(apiSpec);
    }
    
    if (apiSpec.features.validation) {
      middleware['validation.js'] = await this._generateValidationMiddleware(apiSpec);
    }
    
    return middleware;
  }
  
  /**
   * Generate authentication middleware
   * @private
   */
  async _generateAuthMiddleware(apiSpec) {
    const prompt = `Generate Express.js authentication middleware with these requirements:

1. JWT token verification
2. Token extraction from Authorization header
3. Proper error handling for invalid/expired tokens
4. User context attachment to request object
5. ES6 modules (import/export)
6. Production-ready error handling
7. Security best practices

Include both the middleware function and helper functions for token generation/verification.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate error handling middleware
   * @private
   */
  async _generateErrorMiddleware(apiSpec) {
    const prompt = `Generate Express.js error handling middleware with these requirements:

1. Centralized error handling for all routes
2. Proper HTTP status code mapping
3. Environment-specific error responses (dev vs production)
4. Error logging
5. Validation error handling
6. Database error handling
7. Authentication error handling
8. Generic error fallback
9. ES6 modules (import/export)

Make this comprehensive and production-ready.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate validation middleware
   * @private
   */
  async _generateValidationMiddleware(apiSpec) {
    const prompt = `Generate Express.js validation middleware using Joi with these requirements:

1. Request body validation
2. Query parameter validation
3. URL parameter validation
4. Custom validation schemas
5. Proper error messages
6. ES6 modules (import/export)
7. Reusable validation functions

Data Models for validation:
${JSON.stringify(apiSpec.dataModels, null, 2)}

Create comprehensive validation middleware.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate model files
   * @private
   */
  async _generateModels(apiSpec) {
    const models = {};
    
    for (const model of apiSpec.dataModels) {
      const modelContent = await this._generateModelFile(model, apiSpec);
      models[`${model.name}.js`] = modelContent;
    }
    
    return models;
  }
  
  /**
   * Generate a specific model file
   * @private
   */
  async _generateModelFile(model, apiSpec) {
    const prompt = `Generate a data model class for this model:

Model: ${model.name}
Fields: ${JSON.stringify(model.fields, null, 2)}
Description: ${model.description}

Database type: ${apiSpec.features.database}

Requirements:
1. ES6 class with proper constructor
2. Field validation methods
3. Serialization methods (toJSON)
4. Static factory methods
5. Database interaction methods (if applicable)
6. Input sanitization
7. ES6 modules (import/export)
8. JSDoc documentation

Make this a complete, production-ready model class.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate configuration file
   * @private
   */
  async _generateConfig(apiSpec) {
    const prompt = `Generate an Express.js configuration file with these requirements:

1. Environment-based configuration (dev, test, prod)
2. Port configuration
3. Database configuration
4. JWT secret configuration
5. CORS configuration
6. Rate limiting configuration
7. Logging configuration
8. ES6 modules (import/export)
9. Environment variable handling
10. Configuration validation

API Specifications:
${JSON.stringify(apiSpec.features, null, 2)}

Make this comprehensive and production-ready.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate README.md file
   * @private
   */
  async _generateREADME(apiSpec) {
    const prompt = `Generate a comprehensive README.md for this Express.js API:

API Name: ${apiSpec.apiName}
Endpoints: ${apiSpec.endpoints.length} endpoints
Features: ${Object.keys(apiSpec.features).filter(f => apiSpec.features[f]).join(', ')}

Endpoints:
${apiSpec.endpoints.map(e => `${e.method} ${e.path} - ${e.description}`).join('\n')}

Include:
1. Project description
2. Installation instructions
3. Configuration setup
4. API endpoint documentation
5. Example requests/responses
6. Authentication (if applicable)
7. Development setup
8. Testing instructions
9. Deployment notes
10. Environment variables

Make this professional and comprehensive.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Extract context from task
   * @private
   */
  _getContextFromTask(task) {
    return {
      llmClient: (task.lookup && task.lookup('llmClient')) || task.context?.llmClient,
      toolRegistry: (task.lookup && task.lookup('toolRegistry')) || task.context?.toolRegistry,
      workspaceDir: (task.lookup && task.lookup('workspaceDir')) || task.context?.workspaceDir || this.projectRoot,
    };
  }
  
  /**
   * Setup project directory
   * @private
   */
  async _setupProjectDirectory(task, apiSpec) {
    const projectName = this._generateProjectName(apiSpec.apiName);
    const romaProjectsDir = '/tmp/roma-projects';
    const outputDir = path.join(romaProjectsDir, projectName);
    
    await this.tools.directoryCreate.execute({ path: romaProjectsDir });
    await this.tools.directoryCreate.execute({ path: outputDir });
    
    return outputDir;
  }
  
  /**
   * Generate project name
   * @private
   */
  _generateProjectName(apiName) {
    const cleanedName = apiName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(' ')
      .filter(word => word.length > 0)
      .join('-');
    
    const timestamp = new Date().toISOString().slice(0, 10);
    
    return `express-api-${cleanedName}-${timestamp}`;
  }
}