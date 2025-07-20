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
    if (frontendArchitecture) {
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
    
    // Generate main HTML file
    if (frontendArchitecture.htmlStructure) {
      const htmlContent = await this.htmlGenerator.generateHTML(frontendArchitecture.htmlStructure);
      await this.fileWriter.writeFile('index.html', htmlContent);
    }
    
    // Generate CSS styles
    if (frontendArchitecture.cssStyles) {
      for (const styleSpec of frontendArchitecture.cssStyles) {
        const cssContent = await this.cssGenerator.generateCSS(styleSpec);
        const filename = styleSpec.filename || 'styles.css';
        await this.fileWriter.writeFile(filename, cssContent);
      }
    }
    
    // Generate JavaScript components
    if (frontendArchitecture.jsComponents) {
      for (const component of frontendArchitecture.jsComponents) {
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
      dependencies: analysis.dependencies || {},
      devDependencies: {
        'jest': '^29.0.0',
        'eslint': '^8.0.0',
        '@jest/globals': '^29.0.0',
        ...analysis.devDependencies
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
}

export { GenerationPhase };