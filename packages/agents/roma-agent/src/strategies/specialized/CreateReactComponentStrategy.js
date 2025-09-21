/**
 * CreateReactComponentStrategy - Specialized strategy for React component development
 * 
 * This is a true SOP (Standard Operating Procedure) for creating React components.
 * It knows exactly what files to create, what patterns to use, and how to structure
 * production-ready React components with hooks, styling, and testing.
 */

import { TaskStrategy } from '@legion/tasks';
import path from 'path';

export default class CreateReactComponentStrategy extends TaskStrategy {
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
    
    // React specific configuration
    this.reactConfig = {
      useTypeScript: false,
      useHooks: true,
      includeCSS: true,
      includeStorybook: false,
      includeTests: true,
      componentType: 'functional', // functional | class
      stylingApproach: 'css-modules' // css-modules | styled-components | css
    };
  }
  
  getName() {
    return 'CreateReactComponent';
  }
  
  /**
   * Handle messages from parent task
   */
  async onParentMessage(parentTask, message) {
    switch (message.type) {
      case 'start':
      case 'work':
        this.currentTask = parentTask;
        return await this._handleReactComponentCreation(parentTask);
        
      case 'abort':
        console.log(`🛑 CreateReactComponentStrategy received abort`);
        return { acknowledged: true, aborted: true };
        
      default:
        return { acknowledged: true };
    }
  }
  
  /**
   * Handle messages from child tasks (not applicable)
   */
  async onChildMessage(childTask, message) {
    return { acknowledged: false, error: 'CreateReactComponentStrategy does not handle child messages' };
  }
  
  /**
   * Main React component creation handler
   * @private
   */
  async _handleReactComponentCreation(task) {
    try {
      console.log(`⚛️ CreateReactComponentStrategy creating React component: ${task.description}`);
      
      // Initialize components
      await this._initializeComponents(task);
      
      // Analyze the specific component requirements
      const componentSpec = await this._analyzeComponentRequirements(task);
      task.addConversationEntry('system', `React component specification: ${JSON.stringify(componentSpec, null, 2)}`);
      
      // Create the complete React component structure
      const result = await this._createReactComponent(task, componentSpec);
      
      if (result.success) {
        task.complete(result);
        return result;
      } else {
        task.fail(new Error(result.error || 'React component creation failed'));
        return result;
      }
      
    } catch (error) {
      console.error(`❌ CreateReactComponentStrategy error:`, error);
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
      throw new Error('LLM client is required for CreateReactComponentStrategy');
    }
    
    if (!this.toolRegistry) {
      throw new Error('ToolRegistry is required for CreateReactComponentStrategy');
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
      
      console.log('⚛️ CreateReactComponentStrategy tools loaded successfully');
      
    } catch (error) {
      throw new Error(`Failed to load required tools: ${error.message}`);
    }
  }
  
  /**
   * Analyze component requirements from task description
   * @private
   */
  async _analyzeComponentRequirements(task) {
    const prompt = `Analyze this React component task and extract specific requirements:

Task: "${task.description}"

Extract the following information and return as JSON:
{
  "componentName": "ComponentName",
  "componentType": "functional|class",
  "props": [
    {
      "name": "propName",
      "type": "string|number|boolean|object|array|function",
      "required": true/false,
      "description": "what this prop does"
    }
  ],
  "state": [
    {
      "name": "stateName",
      "type": "string|number|boolean|object|array",
      "defaultValue": "default value",
      "description": "what this state represents"
    }
  ],
  "hooks": ["useState", "useEffect", "useContext", "custom hooks"],
  "events": [
    {
      "name": "onClick",
      "description": "what happens when clicked",
      "parameters": ["event", "other params"]
    }
  ],
  "styling": {
    "approach": "css-modules|styled-components|css",
    "hasCustomStyles": true/false,
    "responsive": true/false,
    "theme": "light|dark|custom"
  },
  "features": {
    "accessibility": true/false,
    "animations": true/false,
    "dataFetching": true/false,
    "formHandling": true/false,
    "routing": true/false,
    "testing": true/false,
    "storybook": true/false
  },
  "dependencies": ["react-router-dom", "styled-components", "framer-motion"],
  "description": "detailed description of component functionality"
}

Focus on extracting specific, actionable requirements for React component development.`;

    try {
      const response = await this.llmClient.generateResponse([{
        role: 'user',
        content: prompt
      }]);
      
      return JSON.parse(response);
    } catch (error) {
      console.log(`⚠️ Component requirements analysis failed, using defaults: ${error.message}`);
      return this._getDefaultComponentSpec();
    }
  }
  
  /**
   * Get default component specification
   * @private
   */
  _getDefaultComponentSpec() {
    return {
      componentName: 'MyComponent',
      componentType: 'functional',
      props: [
        {
          name: 'children',
          type: 'object',
          required: false,
          description: 'Child components to render'
        }
      ],
      state: [],
      hooks: ['useState'],
      events: [
        {
          name: 'onClick',
          description: 'Handle click events',
          parameters: ['event']
        }
      ],
      styling: {
        approach: 'css-modules',
        hasCustomStyles: true,
        responsive: false,
        theme: 'light'
      },
      features: {
        accessibility: true,
        animations: false,
        dataFetching: false,
        formHandling: false,
        routing: false,
        testing: true,
        storybook: false
      },
      dependencies: [],
      description: 'A reusable React component'
    };
  }
  
  /**
   * Create the complete React component
   * @private
   */
  async _createReactComponent(task, componentSpec) {
    console.log(`🏗️ Creating React component: ${componentSpec.componentName}`);
    
    try {
      // Setup project directory
      const outputDir = await this._setupProjectDirectory(task, componentSpec);
      
      // Create directory structure
      await this._createDirectoryStructure(outputDir, componentSpec);
      
      // Generate all component files
      const generatedFiles = {};
      
      // 1. Main component file
      const componentFile = await this._generateMainComponent(componentSpec);
      const componentFilename = `${componentSpec.componentName}.jsx`;
      await this.tools.fileWrite.execute({
        filepath: path.join(outputDir, 'src', 'components', componentFilename),
        content: componentFile
      });
      generatedFiles[`src/components/${componentFilename}`] = componentFile;
      
      // 2. CSS/Styling file
      if (componentSpec.styling.hasCustomStyles) {
        const stylesFile = await this._generateStylesFile(componentSpec);
        const stylesFilename = this._getStylesFilename(componentSpec);
        await this.tools.fileWrite.execute({
          filepath: path.join(outputDir, 'src', 'components', stylesFilename),
          content: stylesFile
        });
        generatedFiles[`src/components/${stylesFilename}`] = stylesFile;
      }
      
      // 3. Component test file
      if (componentSpec.features.testing) {
        const testFile = await this._generateTestFile(componentSpec);
        const testFilename = `${componentSpec.componentName}.test.jsx`;
        await this.tools.fileWrite.execute({
          filepath: path.join(outputDir, 'src', 'components', '__tests__', testFilename),
          content: testFile
        });
        generatedFiles[`src/components/__tests__/${testFilename}`] = testFile;
      }
      
      // 4. Storybook stories (if enabled)
      if (componentSpec.features.storybook) {
        const storiesFile = await this._generateStoriesFile(componentSpec);
        const storiesFilename = `${componentSpec.componentName}.stories.jsx`;
        await this.tools.fileWrite.execute({
          filepath: path.join(outputDir, 'src', 'stories', storiesFilename),
          content: storiesFile
        });
        generatedFiles[`src/stories/${storiesFilename}`] = storiesFile;
      }
      
      // 5. Index file for exports
      const indexFile = await this._generateIndexFile(componentSpec);
      await this.tools.fileWrite.execute({
        filepath: path.join(outputDir, 'src', 'components', 'index.js'),
        content: indexFile
      });
      generatedFiles['src/components/index.js'] = indexFile;
      
      // 6. Package.json for dependencies
      const packageJson = await this._generatePackageJson(componentSpec);
      await this.tools.fileWrite.execute({
        filepath: path.join(outputDir, 'package.json'),
        content: JSON.stringify(packageJson, null, 2)
      });
      generatedFiles['package.json'] = packageJson;
      
      // 7. README.md
      const readme = await this._generateREADME(componentSpec);
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
          message: `React component "${componentSpec.componentName}" created successfully`,
          outputDirectory: outputDir,
          filesGenerated: Object.keys(generatedFiles).length,
          files: Object.keys(generatedFiles),
          componentType: componentSpec.componentType,
          features: Object.keys(componentSpec.features).filter(f => componentSpec.features[f])
        },
        artifacts: Object.values(task.getAllArtifacts())
      };
      
    } catch (error) {
      return {
        success: false,
        error: `React component creation failed: ${error.message}`
      };
    }
  }
  
  /**
   * Create React component directory structure
   * @private
   */
  async _createDirectoryStructure(outputDir, componentSpec) {
    const directories = [
      'src',
      'src/components',
      'src/components/__tests__',
      'src/hooks',
      'src/utils',
      'public'
    ];
    
    if (componentSpec.features.storybook) {
      directories.push('src/stories');
    }
    
    for (const dir of directories) {
      await this.tools.directoryCreate.execute({ path: path.join(outputDir, dir) });
    }
  }
  
  /**
   * Generate main React component file
   * @private
   */
  async _generateMainComponent(componentSpec) {
    const prompt = `Generate a production-ready React ${componentSpec.componentType} component with these specifications:

Component Name: ${componentSpec.componentName}
Component Type: ${componentSpec.componentType}
Props: ${JSON.stringify(componentSpec.props, null, 2)}
State: ${JSON.stringify(componentSpec.state, null, 2)}
Hooks: ${componentSpec.hooks.join(', ')}
Events: ${JSON.stringify(componentSpec.events, null, 2)}
Features: ${JSON.stringify(componentSpec.features, null, 2)}
Styling: ${JSON.stringify(componentSpec.styling, null, 2)}

Requirements:
1. Use modern React patterns and best practices
2. Include PropTypes for prop validation
3. Include proper JSDoc documentation
4. Implement all specified props and events
5. Use appropriate hooks for state management
6. Include accessibility features if specified
7. Follow React naming conventions
8. Include error boundaries if needed
9. Implement responsive design if specified
10. Include proper imports and exports

Structure:
- Import statements at top
- PropTypes definition
- Component implementation
- Default props (if applicable)
- Export statement

Make this production-ready with proper error handling, accessibility, and performance optimizations.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate styles file
   * @private
   */
  async _generateStylesFile(componentSpec) {
    const prompt = `Generate CSS styles for the React component with these specifications:

Component Name: ${componentSpec.componentName}
Styling Approach: ${componentSpec.styling.approach}
Responsive: ${componentSpec.styling.responsive}
Theme: ${componentSpec.styling.theme}
Features: ${JSON.stringify(componentSpec.features, null, 2)}

Requirements:
1. Use ${componentSpec.styling.approach} methodology
2. Include base component styles
3. Include responsive breakpoints if specified
4. Include theme colors and variables
5. Include hover and focus states
6. Include animations if specified
7. Follow BEM naming convention for CSS classes
8. Include accessibility styles
9. Use CSS custom properties for theming
10. Include print styles if applicable

Generate comprehensive, production-ready styles.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate test file
   * @private
   */
  async _generateTestFile(componentSpec) {
    const prompt = `Generate comprehensive Jest/React Testing Library tests for this component:

Component Name: ${componentSpec.componentName}
Component Type: ${componentSpec.componentType}
Props: ${JSON.stringify(componentSpec.props, null, 2)}
Events: ${JSON.stringify(componentSpec.events, null, 2)}
Features: ${JSON.stringify(componentSpec.features, null, 2)}

Requirements:
1. Use React Testing Library and Jest
2. Test component rendering with different props
3. Test all user interactions and events
4. Test accessibility features
5. Test responsive behavior if applicable
6. Test error states and edge cases
7. Include snapshot tests
8. Test custom hooks if used
9. Mock external dependencies
10. Include performance tests if needed

Generate thorough, production-ready tests.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate Storybook stories file
   * @private
   */
  async _generateStoriesFile(componentSpec) {
    const prompt = `Generate Storybook stories for this React component:

Component Name: ${componentSpec.componentName}
Props: ${JSON.stringify(componentSpec.props, null, 2)}
Features: ${JSON.stringify(componentSpec.features, null, 2)}

Requirements:
1. Use Storybook 7+ format
2. Include default story
3. Include stories for different prop combinations
4. Include interactive controls for props
5. Include accessibility addon
6. Include responsive design stories
7. Include error state stories
8. Use proper Storybook decorators
9. Include documentation
10. Include action logging for events

Generate comprehensive Storybook stories.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate index file for exports
   * @private
   */
  async _generateIndexFile(componentSpec) {
    return `// Component exports
export { default as ${componentSpec.componentName} } from './${componentSpec.componentName}';

// Re-export everything for convenience
export * from './${componentSpec.componentName}';
`;
  }
  
  /**
   * Generate package.json
   * @private
   */
  async _generatePackageJson(componentSpec) {
    const dependencies = {
      react: '^18.2.0',
      'react-dom': '^18.2.0'
    };
    
    const devDependencies = {
      '@testing-library/react': '^13.4.0',
      '@testing-library/jest-dom': '^5.16.5',
      '@testing-library/user-event': '^14.4.3',
      'jest': '^29.7.0',
      'prop-types': '^15.8.1'
    };
    
    // Add specified dependencies
    if (componentSpec.dependencies) {
      for (const dep of componentSpec.dependencies) {
        switch (dep) {
          case 'styled-components':
            dependencies['styled-components'] = '^6.1.1';
            break;
          case 'framer-motion':
            dependencies['framer-motion'] = '^10.16.4';
            break;
          case 'react-router-dom':
            dependencies['react-router-dom'] = '^6.8.1';
            break;
        }
      }
    }
    
    if (componentSpec.features.storybook) {
      devDependencies['@storybook/react'] = '^7.6.3';
      devDependencies['@storybook/addon-essentials'] = '^7.6.3';
    }
    
    return {
      name: componentSpec.componentName.toLowerCase().replace(/([A-Z])/g, '-$1').substring(1),
      version: '1.0.0',
      description: componentSpec.description,
      main: 'src/components/index.js',
      scripts: {
        test: 'jest',
        'test:watch': 'jest --watch',
        'test:coverage': 'jest --coverage',
        ...(componentSpec.features.storybook ? {
          storybook: 'storybook dev -p 6006',
          'build-storybook': 'storybook build'
        } : {})
      },
      dependencies,
      devDependencies,
      peerDependencies: {
        react: '>=16.8.0',
        'react-dom': '>=16.8.0'
      },
      keywords: ['react', 'component', 'ui'],
      author: 'Generated by CreateReactComponentStrategy',
      license: 'MIT'
    };
  }
  
  /**
   * Generate README.md
   * @private
   */
  async _generateREADME(componentSpec) {
    const prompt = `Generate a comprehensive README.md for this React component:

Component Name: ${componentSpec.componentName}
Description: ${componentSpec.description}
Props: ${JSON.stringify(componentSpec.props, null, 2)}
Features: ${JSON.stringify(componentSpec.features, null, 2)}

Include:
1. Component description and purpose
2. Installation instructions
3. Usage examples with code
4. Props documentation table
5. Styling customization guide
6. Accessibility information
7. Browser compatibility
8. Contributing guidelines
9. Testing instructions
10. Storybook link (if applicable)

Make this professional and comprehensive.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Get styles filename based on approach
   * @private
   */
  _getStylesFilename(componentSpec) {
    switch (componentSpec.styling.approach) {
      case 'css-modules':
        return `${componentSpec.componentName}.module.css`;
      case 'styled-components':
        return `${componentSpec.componentName}.styles.js`;
      default:
        return `${componentSpec.componentName}.css`;
    }
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
  async _setupProjectDirectory(task, componentSpec) {
    const projectName = this._generateProjectName(componentSpec.componentName);
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
  _generateProjectName(componentName) {
    const cleanedName = componentName
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .substring(1);
    
    const timestamp = new Date().toISOString().slice(0, 10);
    
    return `react-component-${cleanedName}-${timestamp}`;
  }
}