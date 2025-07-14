/**
 * CodeGenerationPlanner - Plans detailed code generation
 * 
 * Handles planning for file creation, component structure, API design,
 * and code quality standards based on project requirements.
 */

class CodeGenerationPlanner {
  constructor(config = {}) {
    this.config = {
      generateComments: true,
      useTypescript: false,
      codeStyle: 'standard',
      includeTests: true,
      apiDocumentation: true,
      ...config
    };

    // File templates for code generation
    this.fileTemplates = {
      html: {
        basic: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div id="app">
        {{content}}
    </div>
    <script src="script.js"></script>
</body>
</html>`,
        withForm: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div id="app">
        <form id="main-form" class="form">
            <div class="form-group">
                <label for="name">Name:</label>
                <input type="text" id="name" name="name" required>
            </div>
            <div class="form-group">
                <label for="email">Email:</label>
                <input type="email" id="email" name="email" required>
            </div>
            <button type="submit">Submit</button>
        </form>
        {{content}}
    </div>
    <script src="script.js"></script>
</body>
</html>`
      },
      css: {
        basic: `/* Reset styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #333;
    background-color: #f4f4f4;
}

#app {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

{{additionalStyles}}`,
        withForm: `.form {
    max-width: 500px;
    margin: 2rem auto;
    padding: 2rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.form-group {
    margin-bottom: 1rem;
}

.form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
}

.form-group input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
}

.form-group input:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

button {
    background-color: #007bff;
    color: white;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
}

button:hover {
    background-color: #0056b3;
}`
      },
      javascript: {
        basic: `'use strict';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Application initialized');
    
    // Initialize app functionality
    initializeApp();
});

function initializeApp() {
    {{initCode}}
}`,
        withForm: `'use strict';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Application initialized');
    
    // Initialize form handling
    initializeForm();
    initializeApp();
});

function initializeForm() {
    const form = document.getElementById('main-form');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
}

function handleFormSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    
    // Validate form data
    if (validateFormData(data)) {
        submitForm(data);
    }
}

function validateFormData(data) {
    const errors = [];
    
    if (!data.name || data.name.trim().length < 2) {
        errors.push('Name must be at least 2 characters long');
    }
    
    if (!data.email || !isValidEmail(data.email)) {
        errors.push('Please enter a valid email address');
    }
    
    if (errors.length > 0) {
        displayErrors(errors);
        return false;
    }
    
    return true;
}

function isValidEmail(email) {
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    return emailRegex.test(email);
}

function displayErrors(errors) {
    // Display validation errors to user
    console.error('Form validation errors:', errors);
    alert('Please fix the following errors:\\n' + errors.join('\\n'));
}

function submitForm(data) {
    console.log('Submitting form data:', data);
    // Implement form submission logic here
}

function initializeApp() {
    {{initCode}}
}`
      },
      nodejs: {
        basic: `const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route
app.get('/', (req, res) => {
    res.json({ message: 'Server is running!' });
});

{{additionalRoutes}}

// Start server
app.listen(PORT, () => {
    console.log(\`Server running on port \${PORT}\`);
});

module.exports = app;`,
        withAuth: `const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.sendStatus(401);
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) {
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
};

// Auth routes
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    // Implement authentication logic here
    // This is a basic example - use proper user validation
    if (email && password) {
        const token = jwt.sign(
            { email: email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );
        res.json({ token });
    } else {
        res.status(400).json({ error: 'Email and password required' });
    }
});

// Protected route example
app.get('/protected', authenticateToken, (req, res) => {
    res.json({ message: 'Access granted', user: req.user });
});

{{additionalRoutes}}

// Start server
app.listen(PORT, () => {
    console.log(\`Server running on port \${PORT}\`);
});

module.exports = app;`,
        typescript: `import express, { Request, Response, NextFunction } from 'express';

interface ApiResponse {
    success: boolean;
    message?: string;
    data?: any;
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route
app.get('/', (req: Request, res: Response) => {
    const response: ApiResponse = { success: true, message: 'Server is running!' };
    res.json(response);
});

{{additionalRoutes}}

// Start server
app.listen(PORT, () => {
    console.log(\`Server running on port \${PORT}\`);
});

export default app;`
      }
    };

    // Component templates
    this.componentTypes = {
      form: {
        files: ['form.html', 'form.js', 'form.css'],
        features: ['validation', 'submission'],
        dependencies: []
      },
      navigation: {
        files: ['navigation.html', 'navigation.js', 'navigation.css'],
        features: ['routing', 'menu'],
        dependencies: []
      },
      auth: {
        files: ['auth.html', 'auth.js', 'auth.css'],
        features: ['authentication', 'authorization'],
        dependencies: ['form']
      },
      api: {
        files: ['routes.js', 'controller.js', 'middleware.js'],
        features: ['routing', 'handlers'],
        dependencies: []
      }
    };

    // API endpoint patterns
    this.apiPatterns = {
      rest: {
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        patterns: ['/{resource}', '/{resource}/{id}'],
        middleware: ['cors', 'auth', 'validation']
      },
      auth: {
        endpoints: [
          { path: '/auth/login', method: 'POST' },
          { path: '/auth/logout', method: 'POST' },
          { path: '/auth/refresh', method: 'POST' },
          { path: '/auth/me', method: 'GET' }
        ]
      }
    };
  }

  /**
   * Plan file generation based on analysis
   * 
   * @param {Object} analysis - Project analysis
   * @returns {Array} Array of file generation steps
   */
  planFileGeneration(analysis) {
    if (!analysis) {
      throw new Error('Analysis is required');
    }

    if (!analysis.projectType) {
      throw new Error('Project type is required');
    }

    const fileSteps = [];

    // Plan frontend files
    if (analysis.projectType === 'frontend' || analysis.projectType === 'fullstack') {
      fileSteps.push(...this._planFrontendFiles(analysis));
    }

    // Plan backend files
    if (analysis.projectType === 'backend' || analysis.projectType === 'fullstack') {
      fileSteps.push(...this._planBackendFiles(analysis));
    }

    return fileSteps;
  }

  /**
   * Plan component structure based on analysis
   * 
   * @param {Object} analysis - Project analysis
   * @returns {Object} Component structure plan
   */
  planComponentStructure(analysis) {
    const components = [];
    const hierarchy = { root: 'App', children: [] };

    const allFeatures = [
      ...(analysis.components?.frontend?.features || []),
      ...(analysis.components?.backend?.features || [])
    ];

    // Plan frontend components
    if (analysis.projectType === 'frontend' || analysis.projectType === 'fullstack') {
      components.push(...this._planFrontendComponents(allFeatures));
    }

    // Plan backend components  
    if (analysis.projectType === 'backend' || analysis.projectType === 'fullstack') {
      components.push(...this._planBackendComponents(allFeatures));
    }

    // Build component hierarchy
    this._buildComponentHierarchy(hierarchy, components);

    return {
      components,
      hierarchy,
      metadata: {
        totalComponents: components.length,
        frontendComponents: components.filter(c => c.type !== 'api').length,
        backendComponents: components.filter(c => c.type === 'api').length
      }
    };
  }

  /**
   * Plan API endpoints based on analysis
   * 
   * @param {Object} analysis - Project analysis
   * @returns {Object} API endpoint plan
   */
  planApiEndpoints(analysis) {
    if (analysis.projectType === 'frontend') {
      return { endpoints: [], message: 'Frontend-only project does not require API endpoints' };
    }

    const endpoints = [];
    const middleware = [];
    const documentation = {
      format: 'openapi',
      endpoints: []
    };

    const backendFeatures = analysis.components?.backend?.features || [];

    // Plan authentication endpoints
    if (backendFeatures.includes('auth') || backendFeatures.includes('authentication')) {
      endpoints.push(...this._planAuthEndpoints());
      middleware.push({ name: 'auth', type: 'authentication' });
    }

    // Plan CRUD endpoints
    if (backendFeatures.includes('api') || backendFeatures.includes('rest-api')) {
      endpoints.push(...this._planCrudEndpoints(analysis));
      middleware.push({ name: 'cors', type: 'cors' });
    }

    // Plan entity-specific endpoints
    const entities = this._extractEntities(analysis);
    for (const entity of entities) {
      endpoints.push(...this._planEntityEndpoints(entity));
    }

    // Generate documentation entries
    documentation.endpoints = endpoints.map(endpoint => ({
      path: endpoint.path,
      method: endpoint.method,
      description: endpoint.description || `${endpoint.method} ${endpoint.path}`,
      parameters: endpoint.parameters || [],
      responses: endpoint.responses || { 200: { description: 'Success' } }
    }));

    // Add client integration for fullstack projects
    let clientIntegration = {};
    if (analysis.projectType === 'fullstack') {
      clientIntegration = this._planClientIntegration(endpoints);
    }

    return {
      endpoints,
      middleware,
      documentation,
      clientIntegration,
      metadata: {
        totalEndpoints: endpoints.length,
        authEndpoints: endpoints.filter(e => e.path.includes('/auth')).length,
        crudEndpoints: endpoints.filter(e => !e.path.includes('/auth')).length
      }
    };
  }

  /**
   * Plan code quality standards and tools
   * 
   * @param {Object} analysis - Project analysis
   * @returns {Object} Code quality plan
   */
  planCodeQuality(analysis) {
    const qualityPlan = {
      linting: {
        tool: 'eslint',
        config: this.config.codeStyle,
        rules: []
      },
      testing: {
        framework: 'jest',
        testFiles: [],
        testTypes: ['unit']
      },
      formatting: {
        tool: 'prettier',
        config: {}
      },
      documentation: {
        includeJsdoc: this.config.generateComments,
        includeReadme: true,
        includeApi: analysis.projectType !== 'frontend'
      }
    };

    // Configure based on technologies
    const allTechnologies = [
      ...(analysis.components?.frontend?.technologies || []),
      ...(analysis.components?.backend?.technologies || [])
    ];

    if (allTechnologies.includes('typescript')) {
      qualityPlan.linting.tool = '@typescript-eslint';
      qualityPlan.testing.testFiles.push('**/*.test.ts');
    } else {
      qualityPlan.testing.testFiles.push('**/*.test.js');
    }

    // Add integration tests for fullstack projects
    if (analysis.projectType === 'fullstack') {
      qualityPlan.testing.testTypes.push('integration');
    }

    // Add API testing for backend projects
    if (analysis.projectType === 'backend' || analysis.projectType === 'fullstack') {
      qualityPlan.testing.testTypes.push('api');
    }

    return qualityPlan;
  }

  /**
   * Integrate with project structure plan
   * 
   * @param {Object} analysis - Project analysis
   * @param {Object} structurePlan - Project structure plan
   * @returns {Object} Integration plan
   */
  integrateWithStructure(analysis, structurePlan) {
    const fileMapping = {};
    const componentPlacement = {};

    // Map files to directories
    if (structurePlan.files.includes('index.html')) {
      fileMapping['index.html'] = '.';
    }

    if (structurePlan.files.includes('server.js')) {
      fileMapping['server.js'] = '.';
    }

    // Map components to directories
    if (structurePlan.directories.includes('components')) {
      componentPlacement['FormComponent'] = 'components';
      componentPlacement['NavigationComponent'] = 'components';
      componentPlacement['AuthComponent'] = 'components';
    }

    if (structurePlan.directories.includes('routes')) {
      componentPlacement['ApiRouterComponent'] = 'routes';
    }

    if (structurePlan.directories.includes('services')) {
      componentPlacement['ApiServiceComponent'] = 'services';
    }

    return {
      fileMapping,
      componentPlacement,
      recommendations: {
        useModularStructure: structurePlan.directories.length > 3,
        separateComponents: structurePlan.directories.includes('components'),
        separateServices: structurePlan.directories.includes('services')
      }
    };
  }

  // Private helper methods

  /**
   * Plan frontend file generation
   * @private
   */
  _planFrontendFiles(analysis) {
    const files = [];
    const features = analysis.components?.frontend?.features || [];
    const technologies = analysis.components?.frontend?.technologies || [];

    // HTML file
    if (technologies.includes('html')) {
      const hasForm = features.includes('form');
      const template = hasForm ? this.fileTemplates.html.withForm : this.fileTemplates.html.basic;
      
      files.push({
        fileName: 'index.html',
        content: template.replace('{{title}}', 'My App').replace('{{content}}', ''),
        type: 'html'
      });
    }

    // CSS file
    if (technologies.includes('css')) {
      const hasForm = features.includes('form');
      let content = this.fileTemplates.css.basic.replace('{{additionalStyles}}', '');
      
      if (hasForm) {
        content += '\\n\\n' + this.fileTemplates.css.withForm;
      }

      files.push({
        fileName: 'style.css',
        content: content,
        type: 'css'
      });
    }

    // JavaScript file
    if (technologies.includes('javascript')) {
      const hasForm = features.includes('form');
      const template = hasForm ? this.fileTemplates.javascript.withForm : this.fileTemplates.javascript.basic;
      
      let initCode = '// Add your initialization code here';
      if (features.includes('validation')) {
        initCode += '\\n    // Form validation is already set up';
      }

      files.push({
        fileName: 'script.js',
        content: template.replace('{{initCode}}', initCode),
        type: 'javascript'
      });
    }

    return files;
  }

  /**
   * Plan backend file generation
   * @private
   */
  _planBackendFiles(analysis) {
    const files = [];
    const features = analysis.components?.backend?.features || [];
    const technologies = analysis.components?.backend?.technologies || [];

    if (technologies.includes('nodejs')) {
      const hasAuth = features.includes('auth') || features.includes('authentication');
      const isTypescript = this.config.useTypescript || technologies.includes('typescript');
      
      let template;
      if (isTypescript) {
        template = this.fileTemplates.nodejs.typescript;
      } else {
        template = hasAuth ? this.fileTemplates.nodejs.withAuth : this.fileTemplates.nodejs.basic;
      }
      
      let additionalRoutes = '';
      if (features.includes('api')) {
        if (isTypescript) {
          additionalRoutes = `
// API routes
app.get('/api/items', (req: Request, res: Response) => {
    const response: ApiResponse = { success: true, data: { items: [] } };
    res.json(response);
});

app.post('/api/items', (req: Request, res: Response) => {
    const item = req.body;
    // Add item logic here
    const response: ApiResponse = { success: true, data: { item } };
    res.status(201).json(response);
});`;
        } else {
          additionalRoutes = `
// API routes
app.get('/api/items', (req, res) => {
    res.json({ items: [] });
});

app.post('/api/items', (req, res) => {
    const item = req.body;
    // Add item logic here
    res.status(201).json({ success: true, item });
});`;
        }
      }

      files.push({
        fileName: isTypescript ? 'server.ts' : 'server.js',
        content: template.replace('{{additionalRoutes}}', additionalRoutes),
        type: 'nodejs'
      });
    }

    return files;
  }

  /**
   * Plan frontend components
   * @private
   */
  _planFrontendComponents(features) {
    const components = [];

    if (features.includes('form')) {
      components.push({
        name: 'FormComponent',
        type: 'functional',
        files: ['form.html', 'form.js', 'form.css'],
        features: ['validation', 'submission'],
        dependencies: []
      });
    }

    if (features.includes('navigation') || features.includes('navbar')) {
      components.push({
        name: 'NavigationComponent',
        type: 'functional',
        files: ['navigation.html', 'navigation.js', 'navigation.css'],
        features: ['routing', 'menu'],
        dependencies: []
      });
    }

    if (features.includes('auth') || features.includes('login')) {
      components.push({
        name: 'AuthComponent',
        type: 'functional',
        files: ['auth.html', 'auth.js', 'auth.css'],
        features: ['authentication'],
        dependencies: ['FormComponent']
      });
    }

    return components;
  }

  /**
   * Plan backend components
   * @private
   */
  _planBackendComponents(features) {
    const components = [];

    if (features.includes('api')) {
      components.push({
        name: 'ApiRouterComponent',
        type: 'api',
        files: ['routes.js', 'controller.js'],
        features: ['routing', 'handlers'],
        dependencies: []
      });
    }

    if (features.includes('auth')) {
      components.push({
        name: 'AuthComponent',
        type: 'api',
        files: ['auth.routes.js', 'auth.controller.js', 'auth.middleware.js'],
        features: ['authentication', 'authorization'],
        dependencies: []
      });
    }

    return components;
  }

  /**
   * Build component hierarchy
   * @private
   */
  _buildComponentHierarchy(hierarchy, components) {
    for (const component of components) {
      if (component.dependencies.length === 0) {
        hierarchy.children.push(component.name);
      }
    }
  }

  /**
   * Plan authentication endpoints
   * @private
   */
  _planAuthEndpoints() {
    return [
      {
        path: '/auth/login',
        method: 'POST',
        description: 'User login',
        parameters: ['email', 'password'],
        responses: { 200: { description: 'Login successful' } }
      },
      {
        path: '/auth/logout',
        method: 'POST',
        description: 'User logout',
        parameters: [],
        responses: { 200: { description: 'Logout successful' } }
      },
      {
        path: '/auth/me',
        method: 'GET',
        description: 'Get current user',
        parameters: [],
        responses: { 200: { description: 'User profile' } }
      }
    ];
  }

  /**
   * Plan CRUD endpoints
   * @private
   */
  _planCrudEndpoints(analysis) {
    return [
      {
        path: '/api/items',
        method: 'GET',
        description: 'Get all items',
        parameters: [],
        responses: { 200: { description: 'Items list' } }
      },
      {
        path: '/api/items',
        method: 'POST',
        description: 'Create new item',
        parameters: ['item data'],
        responses: { 201: { description: 'Item created' } }
      },
      {
        path: '/api/items/:id',
        method: 'GET',
        description: 'Get item by ID',
        parameters: ['id'],
        responses: { 200: { description: 'Item details' } }
      },
      {
        path: '/api/items/:id',
        method: 'PUT',
        description: 'Update item',
        parameters: ['id', 'item data'],
        responses: { 200: { description: 'Item updated' } }
      },
      {
        path: '/api/items/:id',
        method: 'DELETE',
        description: 'Delete item',
        parameters: ['id'],
        responses: { 200: { description: 'Item deleted' } }
      }
    ];
  }

  /**
   * Extract entities from analysis
   * @private
   */
  _extractEntities(analysis) {
    const entities = [];
    const taskText = (analysis.task || '').toLowerCase();
    
    // Common entity patterns
    const entityPatterns = ['users', 'products', 'orders', 'posts', 'comments'];
    
    for (const pattern of entityPatterns) {
      if (taskText.includes(pattern.slice(0, -1))) { // Check singular form
        entities.push(pattern);
      }
    }

    return entities.length > 0 ? entities : ['items']; // Default fallback
  }

  /**
   * Plan entity-specific endpoints
   * @private
   */
  _planEntityEndpoints(entity) {
    const entityName = entity.slice(0, -1); // Convert plural to singular
    
    return [
      {
        path: `/api/${entity}`,
        method: 'GET',
        description: `Get all ${entity}`,
        parameters: [],
        responses: { 200: { description: `${entity} list` } }
      },
      {
        path: `/api/${entity}`,
        method: 'POST',
        description: `Create new ${entityName}`,
        parameters: [`${entityName} data`],
        responses: { 201: { description: `${entityName} created` } }
      }
    ];
  }

  /**
   * Plan client integration for fullstack projects
   * @private
   */
  _planClientIntegration(endpoints) {
    const fetchMethods = {};
    
    for (const endpoint of endpoints) {
      const methodName = `${endpoint.method.toLowerCase()}${endpoint.path.replace(/[^a-zA-Z0-9]/g, '')}`;
      fetchMethods[methodName] = {
        url: endpoint.path,
        method: endpoint.method,
        description: endpoint.description
      };
    }

    return {
      fetchMethods,
      apiBaseUrl: '/api',
      authRequired: endpoints.some(e => e.path.includes('/auth'))
    };
  }
}

export { CodeGenerationPlanner };