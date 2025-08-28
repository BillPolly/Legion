/**
 * GenerationPhase - Handles code generation
 * 
 * Responsible for generating all project files including frontend,
 * backend, configuration files, and utilities.
 */

import { FileWriter } from '../utils/FileWriter.js';

class GenerationPhase {
  constructor(codeAgent) {
    this.codeAgent = codeAgent;
    this.fileWriter = new FileWriter(codeAgent);
    this.htmlGenerator = codeAgent.htmlGenerator;
    this.jsGenerator = codeAgent.jsGenerator;
    this.cssGenerator = codeAgent.cssGenerator;
  }

  /**
   * Generate all project code
   * @returns {Promise<void>}
   */
  async generateCode() {
    const { projectPlan } = this.codeAgent;
    if (!projectPlan) {
      throw new Error('No project plan available. Run planProject first.');
    }
    
    const { analysis, frontendArchitecture, backendArchitecture } = projectPlan;
    
    // Generate configuration files first
    await this._generateConfigFiles(analysis);
    
    // Generate based on project type
    if (frontendArchitecture && frontendArchitecture !== null && Object.keys(frontendArchitecture).length > 0) {
      await this._generateFrontendFiles(frontendArchitecture, analysis);
    }
    
    if (backendArchitecture) {
      await this._generateBackendFiles(backendArchitecture, analysis);
    }
    
    // Save state after generation
    this.codeAgent.currentTask.status = 'testing';
    await this.codeAgent.saveState();
    
    this.codeAgent.emit('phase-complete', {
      phase: 'generation',
      message: `Code generation complete: ${this.codeAgent.generatedFiles.size} files created`,
      filesGenerated: this.codeAgent.generatedFiles.size
    });
  }

  /**
   * Generate frontend files
   * @private
   */
  async _generateFrontendFiles(frontendArchitecture, analysis) {
    this.codeAgent.emit('progress', {
      phase: 'generation',
      step: 'frontend-files',
      message: '🎨 Generating frontend files...'
    });
    
    console.log('🔍 [DEBUG] frontendArchitecture:', JSON.stringify(frontendArchitecture, null, 2));
    
    // Generate main HTML file
    if (frontendArchitecture.htmlStructure) {
      console.log('🔍 [DEBUG] Generating HTML with structure:', JSON.stringify(frontendArchitecture.htmlStructure, null, 2));
      const htmlContent = await this.htmlGenerator.generateHTML(frontendArchitecture.htmlStructure);
      await this.fileWriter.writeFile('public/index.html', htmlContent);
    }
    
    // Generate default favicon
    await this._generateDefaultFavicon();
    
    // Generate CSS styles
    if (frontendArchitecture.cssStyles) {
      console.log('🔍 [DEBUG] cssStyles type:', typeof frontendArchitecture.cssStyles);
      console.log('🔍 [DEBUG] cssStyles value:', JSON.stringify(frontendArchitecture.cssStyles, null, 2));
      
      if (Array.isArray(frontendArchitecture.cssStyles)) {
        for (const styleSpec of frontendArchitecture.cssStyles) {
          console.log('🔍 [DEBUG] Generating CSS with spec:', JSON.stringify(styleSpec, null, 2));
          const cssContent = await this.cssGenerator.generateStylesheet(styleSpec);
          const filename = styleSpec.filename || 'styles.css';
          await this.fileWriter.writeFile(filename, cssContent);
        }
      } else {
        console.warn('⚠️ [WARNING] cssStyles is not an array:', frontendArchitecture.cssStyles);
      }
    }
    
    // Generate JavaScript components
    if (frontendArchitecture.jsComponents) {
      console.log('🔍 [DEBUG] jsComponents type:', typeof frontendArchitecture.jsComponents);
      console.log('🔍 [DEBUG] jsComponents value:', JSON.stringify(frontendArchitecture.jsComponents, null, 2));
      
      if (Array.isArray(frontendArchitecture.jsComponents)) {
        for (const component of frontendArchitecture.jsComponents) {
          console.log('🔍 [DEBUG] Generating JS component:', JSON.stringify(component, null, 2));
          let jsContent;
          
          if (component.type === 'class') {
            jsContent = await this.jsGenerator.generateClass(component);
          } else if (component.type === 'function') {
            jsContent = await this.jsGenerator.generateFunction(component);
          } else {
            jsContent = await this.jsGenerator.generateModule(component);
          }
          
          const filename = component.filename || `${component.name.toLowerCase()}.js`;
          await this.fileWriter.writeFile(filename, jsContent);
        }
      } else {
        console.warn('⚠️ [WARNING] jsComponents is not an array:', frontendArchitecture.jsComponents);
      }
    }
    
    // Generate main app.js
    if (frontendArchitecture.mainApp) {
      const appContent = await this.jsGenerator.generateModule(frontendArchitecture.mainApp);
      await this.fileWriter.writeFile('app.js', appContent);
    }
    
    this.codeAgent.emit('progress', {
      phase: 'generation',
      step: 'frontend-complete',
      message: '✅ Frontend files generated'
    });
  }

  /**
   * Generate backend files
   * @private
   */
  async _generateBackendFiles(backendArchitecture, analysis) {
    this.codeAgent.emit('progress', {
      phase: 'generation',
      step: 'backend-files',
      message: '⚙️ Generating backend files...'
    });
    
    // Generate server entry point
    if (backendArchitecture.server) {
      const serverContent = await this.jsGenerator.generateModule(backendArchitecture.server);
      await this.fileWriter.writeFile('server.js', serverContent);
    }
    
    // Generate routes
    if (backendArchitecture.routes) {
      for (const route of backendArchitecture.routes) {
        const routeContent = await this.jsGenerator.generateModule(route);
        const filename = route.filename || `routes/${route.name}.js`;
        await this.fileWriter.writeFile(filename, routeContent);
      }
    }
    
    // Generate controllers
    if (backendArchitecture.controllers) {
      for (const controller of backendArchitecture.controllers) {
        const controllerContent = await this.jsGenerator.generateClass(controller);
        const filename = controller.filename || `controllers/${controller.name}.js`;
        await this.fileWriter.writeFile(filename, controllerContent);
      }
    }
    
    // Generate models
    if (backendArchitecture.models) {
      for (const model of backendArchitecture.models) {
        const modelContent = await this.jsGenerator.generateClass(model);
        const filename = model.filename || `models/${model.name}.js`;
        await this.fileWriter.writeFile(filename, modelContent);
      }
    }
    
    // Generate services
    if (backendArchitecture.services) {
      for (const service of backendArchitecture.services) {
        const serviceContent = await this.jsGenerator.generateClass(service);
        const filename = service.filename || `services/${service.name}.js`;
        await this.fileWriter.writeFile(filename, serviceContent);
      }
    }
    
    // Generate middleware
    if (backendArchitecture.middleware) {
      for (const middleware of backendArchitecture.middleware) {
        const middlewareContent = await this.jsGenerator.generateFunction(middleware);
        const filename = middleware.filename || `middleware/${middleware.name}.js`;
        await this.fileWriter.writeFile(filename, middlewareContent);
      }
    }
    
    this.codeAgent.emit('progress', {
      phase: 'generation',
      step: 'backend-complete',
      message: '✅ Backend files generated'
    });
  }

  /**
   * Generate configuration files
   * @private
   */
  async _generateConfigFiles(analysis) {
    this.codeAgent.emit('progress', {
      phase: 'generation',
      step: 'config-files',
      message: '⚙️ Generating configuration files...'
    });
    
    // Generate package.json
    const packageJson = {
      name: analysis.projectName || 'generated-project',
      version: '1.0.0',
      description: analysis.description || 'Generated project',
      main: analysis.projectType === 'backend' ? 'server.js' : 'index.js',
      scripts: {
        start: analysis.projectType === 'backend' ? 'node server.js' : 'npm run dev',
        dev: 'node server.js',
        test: 'jest',
        'test:watch': 'jest --watch',
        'test:coverage': 'jest --coverage',
        lint: 'eslint .',
        'lint:fix': 'eslint . --fix'
      },
      dependencies: {
        ...(analysis.projectType === 'backend' || analysis.projectType === 'fullstack' ? {
          'express': '^4.18.0',
          'cors': '^2.8.5'
        } : {}),
        ...(typeof analysis.dependencies === 'object' && analysis.dependencies && !Array.isArray(analysis.dependencies) ? analysis.dependencies : {})
      },
      devDependencies: {
        'jest': '^29.0.0',
        'eslint': '^8.0.0',
        '@jest/globals': '^29.0.0',
        ...(analysis.projectType === 'backend' || analysis.projectType === 'fullstack' ? {
          'nodemon': '^3.0.0'
        } : {}),
        ...(typeof analysis.devDependencies === 'object' && analysis.devDependencies && !Array.isArray(analysis.devDependencies) ? analysis.devDependencies : {})
      },
      type: 'module'
    };
    
    await this.fileWriter.writeFile('package.json', JSON.stringify(packageJson, null, 2));
    
    // Generate .gitignore
    const gitignore = [
      'node_modules/',
      'coverage/',
      '.env',
      '*.log',
      '.DS_Store',
      'dist/',
      'build/'
    ].join('\n');
    
    await this.fileWriter.writeFile('.gitignore', gitignore);
    
    // Generate README.md
    const readme = `# ${analysis.projectName || 'Generated Project'}

${analysis.description || 'A generated project'}

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

\`\`\`bash
npm start
\`\`\`

## Testing

\`\`\`bash
npm test
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`
`;
    
    await this.fileWriter.writeFile('README.md', readme);
    
    // Generate ESLint config
    await this._generateESLintConfig();
    
    // Generate Jest config
    await this._generateJestConfig(analysis);
    
    this.codeAgent.emit('progress', {
      phase: 'generation',
      step: 'config-complete',
      message: '✅ Configuration files generated'
    });
  }

  /**
   * Generate ESLint configuration
   * @private
   */
  async _generateESLintConfig() {
    const eslintConfig = this.codeAgent.eslintManager.buildConfiguration(
      this.codeAgent.config.projectType
    );
    
    await this.fileWriter.writeFile('.eslintrc.json', JSON.stringify(eslintConfig, null, 2));
  }

  /**
   * Generate Jest configuration
   * @private
   */
  async _generateJestConfig(analysis) {
    const jestConfig = this.codeAgent.jestManager.buildConfiguration(
      this.codeAgent.config.projectType
    );
    
    // Update coverage threshold if specified
    if (this.codeAgent.config.testCoverage?.threshold) {
      const threshold = this.codeAgent.config.testCoverage.threshold;
      jestConfig.coverageThreshold = {
        global: {
          branches: threshold,
          functions: threshold,
          lines: threshold,
          statements: threshold
        }
      };
    }
    
    await this.fileWriter.writeFile('jest.config.js', `export default ${JSON.stringify(jestConfig, null, 2)};`);
    
    // Generate test utilities if needed
    if (analysis.testUtils) {
      await this._generateTestUtils();
    }
  }

  /**
   * Generate test utility files
   * @private
   */
  async _generateTestUtils() {
    this.codeAgent.emit('progress', {
      phase: 'generation',
      step: 'test-utilities',
      message: '🔧 Generating test utilities...'
    });
    
    // Mock data generator
    const mockDataContent = `/**
 * Test utility for generating mock data
 */

export function createMockData(type, count = 1) {
  const items = [];
  
  for (let i = 0; i < count; i++) {
    switch (type) {
      case 'user':
        items.push({
          id: i + 1,
          name: \`User \${i + 1}\`,
          email: \`user\${i + 1}@example.com\`
        });
        break;
      case 'product':
        items.push({
          id: i + 1,
          name: \`Product \${i + 1}\`,
          price: Math.random() * 100
        });
        break;
      default:
        items.push({ id: i + 1, type });
    }
  }
  
  return count === 1 ? items[0] : items;
}

export function createMockRequest(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    ...overrides
  };
}

export function createMockResponse() {
  const res = {
    statusCode: 200,
    data: null,
    headers: {},
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.data = data;
      return this;
    },
    send: function(data) {
      this.data = data;
      return this;
    },
    setHeader: function(key, value) {
      this.headers[key] = value;
      return this;
    }
  };
  return res;
}
`;
    
    await this.fileWriter.writeFile('__tests__/utils/mockData.js', mockDataContent);
    
    // Test setup
    const setupContent = `/**
 * Global test setup
 */

// Add any global test configuration here
global.testTimeout = 10000;

// Mock console methods during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};
`;
    
    await this.fileWriter.writeFile('__tests__/setup.js', setupContent);
    
    this.codeAgent.emit('progress', {
      phase: 'generation',
      step: 'test-utilities-complete',
      message: '✅ Test utilities generated'
    });
  }

  /**
   * Generate a default favicon.ico file
   * @private
   */
  async _generateDefaultFavicon() {
    try {
      // Create a simple 16x16 favicon using base64 encoded data
      // This is a simple blue square favicon
      const faviconBase64 = 'AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7u7u/+7u7v/u7u7/7u7u/+7u7v/u7u7/7u7u/+7u7v8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7u7u/1VVVf9VVVX/VVVV/1VVVf9VVVX/VVVV/1VVVf/u7u7/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7u7u/1VVVf8AAAD/AAAA/wAAAP8AAAD/AAAA/1VVVf/u7u7/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7u7u/1VVVf8AAAD/AAAA/wAAAP8AAAD/AAAA/1VVVf/u7u7/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7u7u/1VVVf8AAAD/AAAA/wAAAP8AAAD/AAAA/1VVVf/u7u7/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7u7u/1VVVf8AAAD/AAAA/wAAAP8AAAD/AAAA/1VVVf/u7u7/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7u7u/1VVVf8AAAD/AAAA/wAAAP8AAAD/AAAA/1VVVf/u7u7/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7u7u/1VVVf8AAAD/AAAA/wAAAP8AAAD/AAAA/1VVVf/u7u7/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7u7u/1VVVf9VVVX/VVVV/1VVVf9VVVX/VVVV/1VVVf/u7u7/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7u7u/+7u7v/u7u7/7u7u/+7u7v/u7u7/7u7u/+7u7v8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//AAD//wAAgAEAAIABAACAAQAAgAEAAIABAACAAQAAgAEAAIABAACAAQAAgAEAAP//AAD//wAA//8AAP//AAA=';
      
      // Convert base64 to buffer
      const buffer = Buffer.from(faviconBase64, 'base64');
      
      // Write favicon to public directory
      await this.fileWriter.writeFile('public/favicon.ico', buffer);
      
      this.codeAgent.emit('progress', {
        phase: 'generation',
        step: 'favicon-generated',
        message: '🎨 Default favicon generated'
      });
    } catch (error) {
      console.warn('⚠️ Failed to generate favicon:', error.message);
      // Don't fail the entire generation if favicon fails
    }
  }
}

export { GenerationPhase };