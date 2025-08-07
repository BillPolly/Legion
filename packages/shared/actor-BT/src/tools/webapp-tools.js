/**
 * Web App Generation Tools
 * Creates HTML, CSS, React components, and project structure for web applications
 */

import fs from 'fs/promises';
import path from 'path';

export class WebAppTools {
  constructor(workingDirectory = './generated-webapp') {
    this.workingDir = workingDirectory;
    this.appState = new Map(); // Track app state across generations
  }

  async ensureWebAppStructure() {
    try {
      // Create standard web app directory structure
      await fs.mkdir(this.workingDir, { recursive: true });
      await fs.mkdir(path.join(this.workingDir, 'src'), { recursive: true });
      await fs.mkdir(path.join(this.workingDir, 'public'), { recursive: true });
      await fs.mkdir(path.join(this.workingDir, 'src', 'components'), { recursive: true });
      await fs.mkdir(path.join(this.workingDir, 'src', 'pages'), { recursive: true });
      await fs.mkdir(path.join(this.workingDir, 'src', 'styles'), { recursive: true });
      await fs.mkdir(path.join(this.workingDir, 'src', 'utils'), { recursive: true });
      await fs.mkdir(path.join(this.workingDir, 'tests'), { recursive: true });
    } catch (error) {
      // Directories might already exist
    }
  }

  /**
   * Initialize or load app state
   */
  async initializeAppState(appName) {
    await this.ensureWebAppStructure();
    
    if (!this.appState.has(appName)) {
      const state = {
        appName,
        pages: [],
        components: [],
        styles: [],
        dependencies: new Set(['react', 'react-dom']),
        devDependencies: new Set(['vite', '@vitejs/plugin-react']),
        buildHistory: [],
        lastModified: Date.now()
      };
      this.appState.set(appName, state);
    }
    
    return this.appState.get(appName);
  }

  /**
   * Create HTML generator tool
   */
  createHtmlGenerator() {
    const self = this;
    return {
      name: 'htmlGenerator',
      async execute(params) {
        const { 
          appName, 
          title = 'Web App',
          description = 'A web application built with BT framework',
          favicon = '/favicon.ico',
          viewport = 'width=device-width, initial-scale=1.0',
          theme = 'light'
        } = params;

        if (!appName) {
          return {
            success: false,
            data: { error: 'appName is required' }
          };
        }

        const state = await self.initializeAppState(appName);

        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="${viewport}">
  <meta name="description" content="${description}">
  <meta name="theme-color" content="#000000">
  <title>${title}</title>
  <link rel="icon" type="image/x-icon" href="${favicon}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body class="theme-${theme}">
  <noscript>You need to enable JavaScript to run this app.</noscript>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>`;

        const filePath = path.join(self.workingDir, 'index.html');
        try {
          await fs.writeFile(filePath, htmlContent, 'utf-8');
          
          return {
            success: true,
            data: {
              html: htmlContent,
              filePath,
              title,
              description,
              theme,
              timestamp: Date.now()
            }
          };
        } catch (error) {
          return {
            success: false,
            data: { error: `Failed to write HTML file: ${error.message}` }
          };
        }
      },
      getMetadata() {
        return {
          name: 'htmlGenerator',
          description: 'Generates HTML index file for web applications',
          input: {
            appName: { type: 'string', required: true },
            title: { type: 'string', required: false },
            description: { type: 'string', required: false },
            favicon: { type: 'string', required: false },
            viewport: { type: 'string', required: false },
            theme: { type: 'string', required: false }
          },
          output: {
            html: { type: 'string' },
            filePath: { type: 'string' },
            title: { type: 'string' }
          }
        };
      }
    };
  }

  /**
   * Create CSS generator tool
   */
  createCssGenerator() {
    const self = this;
    return {
      name: 'cssGenerator',
      async execute(params) {
        const {
          appName,
          fileName = 'main.css',
          theme = 'modern',
          colorScheme = 'blue',
          includeReset = true,
          includeUtilities = true
        } = params;

        if (!appName) {
          return {
            success: false,
            data: { error: 'appName is required' }
          };
        }

        const state = await self.initializeAppState(appName);
        
        let cssContent = '';

        // CSS Reset
        if (includeReset) {
          cssContent += `/* CSS Reset */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  line-height: 1.6;
}

#root {
  min-height: 100vh;
}

`;
        }

        // Color Scheme Variables
        const colorSchemes = {
          blue: {
            primary: '#3b82f6',
            secondary: '#64748b',
            accent: '#06b6d4',
            background: '#ffffff',
            surface: '#f8fafc',
            text: '#1e293b',
            textMuted: '#64748b'
          },
          green: {
            primary: '#10b981',
            secondary: '#6b7280',
            accent: '#f59e0b',
            background: '#ffffff',
            surface: '#f0fdf4',
            text: '#1f2937',
            textMuted: '#6b7280'
          },
          purple: {
            primary: '#8b5cf6',
            secondary: '#64748b',
            accent: '#ec4899',
            background: '#ffffff',
            surface: '#faf5ff',
            text: '#374151',
            textMuted: '#6b7280'
          }
        };

        const colors = colorSchemes[colorScheme] || colorSchemes.blue;

        cssContent += `:root {
  /* Color Scheme: ${colorScheme} */
  --color-primary: ${colors.primary};
  --color-secondary: ${colors.secondary};
  --color-accent: ${colors.accent};
  --color-background: ${colors.background};
  --color-surface: ${colors.surface};
  --color-text: ${colors.text};
  --color-text-muted: ${colors.textMuted};
  
  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  --spacing-2xl: 3rem;
  
  /* Typography */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;
  --text-4xl: 2.25rem;
  
  /* Border Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
}

/* Theme Styles */
.theme-light {
  background-color: var(--color-background);
  color: var(--color-text);
}

.theme-dark {
  --color-background: #0f172a;
  --color-surface: #1e293b;
  --color-text: #f1f5f9;
  --color-text-muted: #94a3b8;
  background-color: var(--color-background);
  color: var(--color-text);
}

`;

        // Base Component Styles
        if (theme === 'modern') {
          cssContent += `/* Modern Component Styles */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--spacing-md);
}

.card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
}

.button:hover {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.button:active {
  transform: translateY(0);
}

.button.secondary {
  background: var(--color-secondary);
}

.button.outline {
  background: transparent;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
}

.input {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-secondary);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  background: var(--color-background);
  color: var(--color-text);
  transition: border-color 0.2s ease;
}

.input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

`;
        }

        // Utility Classes
        if (includeUtilities) {
          cssContent += `/* Utility Classes */
.flex { display: flex; }
.flex-col { flex-direction: column; }
.items-center { align-items: center; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }

.p-xs { padding: var(--spacing-xs); }
.p-sm { padding: var(--spacing-sm); }
.p-md { padding: var(--spacing-md); }
.p-lg { padding: var(--spacing-lg); }
.p-xl { padding: var(--spacing-xl); }

.m-xs { margin: var(--spacing-xs); }
.m-sm { margin: var(--spacing-sm); }
.m-md { margin: var(--spacing-md); }
.m-lg { margin: var(--spacing-lg); }
.m-xl { margin: var(--spacing-xl); }

.text-xs { font-size: var(--text-xs); }
.text-sm { font-size: var(--text-sm); }
.text-base { font-size: var(--text-base); }
.text-lg { font-size: var(--text-lg); }
.text-xl { font-size: var(--text-xl); }
.text-2xl { font-size: var(--text-2xl); }
.text-3xl { font-size: var(--text-3xl); }

.font-light { font-weight: 300; }
.font-normal { font-weight: 400; }
.font-medium { font-weight: 500; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }

.rounded-sm { border-radius: var(--radius-sm); }
.rounded-md { border-radius: var(--radius-md); }
.rounded-lg { border-radius: var(--radius-lg); }
.rounded-xl { border-radius: var(--radius-xl); }

.shadow-sm { box-shadow: var(--shadow-sm); }
.shadow-md { box-shadow: var(--shadow-md); }
.shadow-lg { box-shadow: var(--shadow-lg); }

/* Responsive */
@media (max-width: 768px) {
  .container {
    padding: 0 var(--spacing-sm);
  }
  
  .hidden-mobile {
    display: none;
  }
}

@media (min-width: 769px) {
  .hidden-desktop {
    display: none;
  }
}
`;
        }

        const filePath = path.join(self.workingDir, 'src', 'styles', fileName);
        try {
          await fs.writeFile(filePath, cssContent, 'utf-8');
          
          state.styles.push({
            fileName,
            theme,
            colorScheme,
            filePath,
            timestamp: Date.now()
          });

          return {
            success: true,
            data: {
              css: cssContent,
              filePath,
              fileName,
              theme,
              colorScheme,
              timestamp: Date.now()
            }
          };
        } catch (error) {
          return {
            success: false,
            data: { error: `Failed to write CSS file: ${error.message}` }
          };
        }
      },
      getMetadata() {
        return {
          name: 'cssGenerator',
          description: 'Generates CSS stylesheets with modern design systems',
          input: {
            appName: { type: 'string', required: true },
            fileName: { type: 'string', required: false },
            theme: { type: 'string', required: false },
            colorScheme: { type: 'string', required: false },
            includeReset: { type: 'boolean', required: false },
            includeUtilities: { type: 'boolean', required: false }
          },
          output: {
            css: { type: 'string' },
            filePath: { type: 'string' },
            theme: { type: 'string' }
          }
        };
      }
    };
  }

  /**
   * Create React component generator tool
   */
  createReactComponentGenerator() {
    const self = this;
    return {
      name: 'reactComponentGenerator',
      async execute(params) {
        const {
          appName,
          componentName,
          componentType = 'functional', // functional, class, page
          props = [],
          hooks = ['useState'],
          styling = 'css', // css, styled-components, tailwind
          includeTests = true
        } = params;

        if (!appName || !componentName) {
          return {
            success: false,
            data: { error: 'appName and componentName are required' }
          };
        }

        const state = await self.initializeAppState(appName);
        
        // Generate component code
        let componentCode = '';
        let importStatements = [];
        let testCode = '';

        if (componentType === 'functional') {
          // Add React imports
          importStatements.push("import React from 'react';");
          
          // Add hooks if specified
          if (hooks.length > 0) {
            const hooksImport = hooks.filter(hook => hook !== 'useEffect' || hooks.includes('useEffect'));
            if (hooksImport.length > 0) {
              importStatements[0] = `import React, { ${hooksImport.join(', ')} } from 'react';`;
            }
          }

          // Add styling imports
          if (styling === 'css') {
            importStatements.push(`import './${componentName}.css';`);
          }

          // Generate props interface if TypeScript-like
          const propsInterface = props.length > 0 ? `
// Props interface
interface ${componentName}Props {
${props.map(prop => `  ${prop.name}: ${prop.type || 'any'};`).join('\n')}
}` : '';

          // Generate component
          const propsParam = props.length > 0 ? `{ ${props.map(p => p.name).join(', ')} }` : '';
          const propsType = props.length > 0 ? `: ${componentName}Props` : '';

          componentCode = `${importStatements.join('\n')}${propsInterface ? '\n' + propsInterface : ''}

const ${componentName} = (${propsParam}${propsType}) => {
${hooks.includes('useState') ? `  const [state, setState] = useState({});` : ''}
${hooks.includes('useEffect') ? `
  useEffect(() => {
    // Effect logic here
  }, []);` : ''}

  return (
    <div className="${componentName.toLowerCase()}-container">
      <h2>Welcome to ${componentName}</h2>
      ${props.map(prop => `<p>{${prop.name}}</p>`).join('\n      ')}
      <button 
        className="button"
        onClick={() => console.log('${componentName} clicked')}
      >
        Click Me
      </button>
    </div>
  );
};

export default ${componentName};`;

          // Generate CSS file
          const cssCode = `.${componentName.toLowerCase()}-container {
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.${componentName.toLowerCase()}-container h2 {
  margin-bottom: var(--spacing-md);
  color: var(--color-text);
  font-size: var(--text-xl);
  font-weight: 600;
}

.${componentName.toLowerCase()}-container p {
  margin-bottom: var(--spacing-sm);
  color: var(--color-text-muted);
}`;

          // Write component file
          const componentPath = path.join(self.workingDir, 'src', 'components', `${componentName}.jsx`);
          await fs.writeFile(componentPath, componentCode, 'utf-8');

          // Write CSS file if using CSS styling
          if (styling === 'css') {
            const cssPath = path.join(self.workingDir, 'src', 'components', `${componentName}.css`);
            await fs.writeFile(cssPath, cssCode, 'utf-8');
          }

          // Generate test file
          if (includeTests) {
            testCode = `import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ${componentName} from './${componentName}';

describe('${componentName}', () => {
  test('renders ${componentName} component', () => {
    render(<${componentName} />);
    
    const heading = screen.getByText(/Welcome to ${componentName}/i);
    expect(heading).toBeInTheDocument();
    
    const button = screen.getByText(/Click Me/i);
    expect(button).toBeInTheDocument();
  });

  test('handles button click', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    render(<${componentName} />);
    
    const button = screen.getByText(/Click Me/i);
    button.click();
    
    expect(consoleSpy).toHaveBeenCalledWith('${componentName} clicked');
    consoleSpy.mockRestore();
  });
});`;

            const testPath = path.join(self.workingDir, 'tests', `${componentName}.test.jsx`);
            await fs.writeFile(testPath, testCode, 'utf-8');
          }

          // Update app state
          state.components.push({
            name: componentName,
            type: componentType,
            props,
            hooks,
            styling,
            filePath: componentPath,
            testPath: includeTests ? path.join(self.workingDir, 'tests', `${componentName}.test.jsx`) : null,
            timestamp: Date.now()
          });

          // Add testing dependencies if needed
          if (includeTests) {
            state.devDependencies.add('@testing-library/react');
            state.devDependencies.add('@testing-library/jest-dom');
            state.devDependencies.add('@testing-library/user-event');
          }

          return {
            success: true,
            data: {
              componentCode,
              cssCode: styling === 'css' ? cssCode : null,
              testCode: includeTests ? testCode : null,
              componentName,
              componentType,
              filePath: componentPath,
              timestamp: Date.now()
            }
          };
        }

        return {
          success: false,
          data: { error: `Component type ${componentType} not yet implemented` }
        };
      },
      getMetadata() {
        return {
          name: 'reactComponentGenerator',
          description: 'Generates React components with props, hooks, and tests',
          input: {
            appName: { type: 'string', required: true },
            componentName: { type: 'string', required: true },
            componentType: { type: 'string', required: false },
            props: { type: 'array', required: false },
            hooks: { type: 'array', required: false },
            styling: { type: 'string', required: false },
            includeTests: { type: 'boolean', required: false }
          },
          output: {
            componentCode: { type: 'string' },
            cssCode: { type: 'string' },
            testCode: { type: 'string' }
          }
        };
      }
    };
  }

  /**
   * Create package.json generator tool
   */
  createPackageJsonGenerator() {
    const self = this;
    return {
      name: 'packageJsonGenerator',
      async execute(params) {
        const {
          appName,
          version = '0.1.0',
          description = 'Web application built with BT framework',
          author = 'BT Developer',
          buildTool = 'vite', // vite, webpack, create-react-app
          includeScripts = true,
          additionalDeps = [],
          additionalDevDeps = []
        } = params;

        if (!appName) {
          return {
            success: false,
            data: { error: 'appName is required' }
          };
        }

        const state = await self.initializeAppState(appName);

        // Add additional dependencies
        additionalDeps.forEach(dep => state.dependencies.add(dep));
        additionalDevDeps.forEach(dep => state.devDependencies.add(dep));

        // Build tool specific configuration
        const buildConfigs = {
          vite: {
            devDeps: ['vite', '@vitejs/plugin-react'],
            scripts: {
              "dev": "vite",
              "build": "vite build",
              "preview": "vite preview"
            }
          },
          webpack: {
            devDeps: ['webpack', 'webpack-cli', 'webpack-dev-server', '@babel/core', '@babel/preset-react', 'babel-loader', 'html-webpack-plugin'],
            scripts: {
              "start": "webpack serve --mode development",
              "build": "webpack --mode production",
              "dev": "webpack serve --mode development"
            }
          }
        };

        const config = buildConfigs[buildTool] || buildConfigs.vite;
        config.devDeps.forEach(dep => state.devDependencies.add(dep));

        const packageJson = {
          name: appName.toLowerCase().replace(/\s+/g, '-'),
          version,
          description,
          author,
          private: true,
          type: "module",
          scripts: includeScripts ? {
            ...config.scripts,
            "test": "jest",
            "test:watch": "jest --watch",
            "test:coverage": "jest --coverage"
          } : {},
          dependencies: Object.fromEntries([...state.dependencies].sort().map(dep => [dep, "^18.2.0"])),
          devDependencies: Object.fromEntries([...state.devDependencies].sort().map(dep => [dep, "latest"])),
          eslintConfig: {
            extends: ["react-app"]
          },
          browserslist: {
            production: [">0.2%", "not dead", "not op_mini all"],
            development: ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
          }
        };

        // Add Jest configuration for testing
        if (state.devDependencies.has('@testing-library/react')) {
          packageJson.jest = {
            testEnvironment: "jsdom",
            setupFilesAfterEnv: ["<rootDir>/src/setupTests.js"],
            moduleNameMapping: {
              "\\.(css|less|scss|sass)$": "identity-obj-proxy"
            }
          };
          state.devDependencies.add('jest');
          state.devDependencies.add('jest-environment-jsdom');
          state.devDependencies.add('identity-obj-proxy');
        }

        const filePath = path.join(self.workingDir, 'package.json');
        try {
          await fs.writeFile(filePath, JSON.stringify(packageJson, null, 2), 'utf-8');

          return {
            success: true,
            data: {
              packageJson,
              filePath,
              appName,
              buildTool,
              dependencies: [...state.dependencies],
              devDependencies: [...state.devDependencies],
              timestamp: Date.now()
            }
          };
        } catch (error) {
          return {
            success: false,
            data: { error: `Failed to write package.json: ${error.message}` }
          };
        }
      },
      getMetadata() {
        return {
          name: 'packageJsonGenerator',
          description: 'Generates package.json with dependencies and build configuration',
          input: {
            appName: { type: 'string', required: true },
            version: { type: 'string', required: false },
            description: { type: 'string', required: false },
            author: { type: 'string', required: false },
            buildTool: { type: 'string', required: false },
            includeScripts: { type: 'boolean', required: false },
            additionalDeps: { type: 'array', required: false },
            additionalDevDeps: { type: 'array', required: false }
          },
          output: {
            packageJson: { type: 'object' },
            filePath: { type: 'string' },
            buildTool: { type: 'string' }
          }
        };
      }
    };
  }

  /**
   * Create main entry point generator
   */
  createMainEntryGenerator() {
    const self = this;
    return {
      name: 'mainEntryGenerator',
      async execute(params) {
        const {
          appName,
          framework = 'react', // react, vanilla
          entryPoint = 'main.jsx',
          rootComponent = 'App'
        } = params;

        if (!appName) {
          return {
            success: false,
            data: { error: 'appName is required' }
          };
        }

        await self.initializeAppState(appName);

        let mainCode = '';
        let appCode = '';

        if (framework === 'react') {
          // Main entry file
          mainCode = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/main.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;

          // App component
          appCode = `import React from 'react';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Welcome to ${appName}</h1>
        <p>Built with BT Framework</p>
      </header>
      
      <main className="app-main">
        <section className="hero">
          <h2>Your Web App is Ready!</h2>
          <p>Start building amazing experiences.</p>
          <button className="button">Get Started</button>
        </section>
      </main>
      
      <footer className="app-footer">
        <p>&copy; 2024 ${appName}. Built with ❤️ and BT Framework.</p>
      </footer>
    </div>
  );
}

export default App;`;
        }

        // Write main entry file
        const mainPath = path.join(self.workingDir, 'src', entryPoint);
        await fs.writeFile(mainPath, mainCode, 'utf-8');

        // Write App component
        const appPath = path.join(self.workingDir, 'src', 'App.jsx');
        await fs.writeFile(appPath, appCode, 'utf-8');

        return {
          success: true,
          data: {
            mainCode,
            appCode,
            mainPath,
            appPath,
            entryPoint,
            rootComponent,
            timestamp: Date.now()
          }
        };
      },
      getMetadata() {
        return {
          name: 'mainEntryGenerator',
          description: 'Generates main entry point and root component',
          input: {
            appName: { type: 'string', required: true },
            framework: { type: 'string', required: false },
            entryPoint: { type: 'string', required: false },
            rootComponent: { type: 'string', required: false }
          },
          output: {
            mainCode: { type: 'string' },
            appCode: { type: 'string' },
            mainPath: { type: 'string' }
          }
        };
      }
    };
  }

  /**
   * Get current state of all tracked apps
   */
  getAllAppStates() {
    return Object.fromEntries(this.appState);
  }

  /**
   * Clear state for a specific app
   */
  clearAppState(appName) {
    this.appState.delete(appName);
  }

  /**
   * Clear all app states
   */
  clearAllAppStates() {
    this.appState.clear();
  }
}