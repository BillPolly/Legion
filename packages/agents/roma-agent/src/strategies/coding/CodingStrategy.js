/**
 * CodingStrategy - TaskStrategy implementation for code generation tasks
 * 
 * Adapts CodeGenerationAgent's direct file generation approach to TaskStrategy interface.
 * Handles code generation tasks by creating files, writing code, and managing project structure.
 */

import { TaskStrategy } from '@legion/tasks';
import fs from 'fs/promises';
import path from 'path';

export default class CodingStrategy extends TaskStrategy {
  constructor(llmClient = null, toolRegistry = null, options = {}) {
    super();
    
    this.llmClient = llmClient;
    this.toolRegistry = toolRegistry;
    this.currentTask = null; // Track which task we're working on
    
    // Configurable project root directory - defaults to /tmp but can be overridden
    this.projectRoot = options.projectRoot || process.env.PROJECT_ROOT || '/tmp';
    
    // Pre-instantiated tools (will be loaded during initialization)
    this.tools = {
      fileWrite: null,
      directoryCreate: null, 
      generateJavaScript: null,
      generateCSS: null,
      generateHTML: null,
      validateJavaScript: null
    };
  }
  
  getName() {
    return 'Coding';
  }
  
  /**
   * Handle messages from parent task (start work requests)
   */
  async onParentMessage(parentTask, message) {
    switch (message.type) {
      case 'start':
      case 'work':
        this.currentTask = parentTask;
        return await this._handleCodingWork(parentTask);
        
      case 'abort':
        console.log(`🛑 CodingStrategy received abort`);
        return { acknowledged: true, aborted: true };
        
      default:
        return { acknowledged: true };
    }
  }
  
  /**
   * Handle messages from child tasks (not applicable for CodingStrategy - it doesn't create children)
   */
  async onChildMessage(childTask, message) {
    // CodingStrategy is a leaf strategy - it doesn't create child tasks
    // It directly executes code generation tools
    return { acknowledged: false, error: 'CodingStrategy does not handle child messages' };
  }
  
  /**
   * Main coding work handler - generates code based on task description
   * @private
   */
  async _handleCodingWork(task) {
    try {
      console.log(`🔧 CodingStrategy handling: ${task.description}`);
      
      // Initialize components
      await this._initializeComponents(task);
      
      // Classify the coding task type
      const codingType = await this._classifyCodeTask(task);
      task.addConversationEntry('system', `Classified as coding task: ${codingType.type} - ${codingType.reasoning}`);
      
      // Execute based on coding task type
      let result;
      switch (codingType.type) {
        case 'PROJECT_CREATION':
          result = await this._generateProject(task, codingType);
          break;
          
        case 'FILE_CREATION':
          result = await this._generateFiles(task, codingType);
          break;
          
        case 'CODE_MODIFICATION':
          result = await this._modifyCode(task, codingType);
          break;
          
        case 'COMPONENT_CREATION':
          result = await this._generateComponent(task, codingType);
          break;
          
        default:
          result = await this._generateGenericCode(task, codingType);
      }
      
      if (result.success) {
        task.complete(result);
        return result;
      } else {
        task.fail(new Error(result.error || 'Code generation failed'));
        return result;
      }
      
    } catch (error) {
      console.error(`❌ CodingStrategy error:`, error);
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
    // Get services from task context
    const context = this._getContextFromTask(task);
    
    this.llmClient = this.llmClient || context.llmClient;
    this.toolRegistry = this.toolRegistry || context.toolRegistry;
    
    if (!this.llmClient) {
      throw new Error('LLM client is required for CodingStrategy');
    }
    
    if (!this.toolRegistry) {
      throw new Error('ToolRegistry is required for CodingStrategy');
    }
    
    // Load required tools if not already loaded
    await this._loadRequiredTools();
  }
  
  /**
   * Load and cache required tools during initialization
   * @private
   */
  async _loadRequiredTools() {
    if (!this.toolRegistry) {
      throw new Error('ToolRegistry is required to load tools');
    }
    
    try {
      // Load file operations tools
      this.tools.fileWrite = await this.toolRegistry.getTool('file_write');
      this.tools.directoryCreate = await this.toolRegistry.getTool('directory_create');
      
      // Load code generation tools
      this.tools.generateJavaScript = await this.toolRegistry.getTool('generate_javascript');
      this.tools.generateCSS = await this.toolRegistry.getTool('generate_css');
      this.tools.generateHTML = await this.toolRegistry.getTool('generate_html');
      
      // Load validation tools
      this.tools.validateJavaScript = await this.toolRegistry.getTool('validate_javascript');
      
      // Validate that essential tools are available
      const requiredTools = ['fileWrite', 'directoryCreate'];
      for (const toolName of requiredTools) {
        if (!this.tools[toolName]) {
          throw new Error(`Required tool ${toolName} is not available`);
        }
      }
      
      console.log('🔧 CodingStrategy tools loaded successfully');
      
    } catch (error) {
      throw new Error(`Failed to load required tools: ${error.message}`);
    }
  }
  
  /**
   * Extract context from task
   * @private
   */
  _getContextFromTask(task) {
    // Use ambient project root variable - prioritize task context, then strategy config, then default
    const workspaceDir = (task.lookup && task.lookup('workspaceDir')) || 
                        task.context?.workspaceDir || 
                        this.projectRoot;
    
    return {
      llmClient: (task.lookup && task.lookup('llmClient')) || task.context?.llmClient,
      toolRegistry: (task.lookup && task.lookup('toolRegistry')) || task.context?.toolRegistry,
      workspaceDir: workspaceDir,
    };
  }
  
  /**
   * Classify the type of coding task
   * @private
   */
  async _classifyCodeTask(task) {
    const prompt = `Classify this coding task into one of these categories:

Task: "${task.description}"

Categories:
1. PROJECT_CREATION - Creating a new project with multiple files and structure
2. FILE_CREATION - Creating specific files (classes, modules, components)
3. CODE_MODIFICATION - Modifying existing code files
4. COMPONENT_CREATION - Creating a single component or module
5. GENERIC_CODE - Other code generation tasks

Artifacts available: ${task.getArtifactsContext()}

Return JSON:
{
  "type": "PROJECT_CREATION|FILE_CREATION|CODE_MODIFICATION|COMPONENT_CREATION|GENERIC_CODE",
  "reasoning": "explanation of classification",
  "language": "javascript|typescript|python|java|other",
  "complexity": "simple|medium|complex"
}`;

    try {
      const response = await this.llmClient.generateResponse([{
        role: 'user',
        content: prompt
      }]);
      
      return JSON.parse(response);
    } catch (error) {
      console.log(`⚠️ Task classification failed, defaulting to GENERIC_CODE: ${error.message}`);
      return {
        type: 'GENERIC_CODE',
        reasoning: 'Classification failed, using default',
        language: 'javascript',
        complexity: 'medium'
      };
    }
  }
  
  /**
   * Generate a complete project with multiple files
   * @private
   */
  async _generateProject(task, codingType) {
    console.log(`🏗️ Generating project for: ${task.description}`);
    
    const context = this._getContextFromTask(task);
    
    try {
      // Setup organized project directory
      const outputDir = await this._setupProjectDirectory(task, codingType);
      
      // Create project structure using tools
      await this.tools.directoryCreate.execute({ path: path.join(outputDir, 'src') });
      await this.tools.directoryCreate.execute({ path: path.join(outputDir, 'tests') });
      
      // Generate package.json
      const packageJson = await this._generatePackageJson(task, codingType);
      await this.tools.fileWrite.execute({ 
        filepath: path.join(outputDir, 'package.json'), 
        content: JSON.stringify(packageJson, null, 2) 
      });
      
      // Generate main application files
      const mainFiles = await this._generateMainFiles(task, codingType, outputDir);
      
      // Store artifacts
      task.storeArtifact('project_directory', outputDir, 'Generated project directory', 'directory');
      task.storeArtifact('package_json', packageJson, 'Generated package.json', 'json');
      
      for (const [filename, content] of Object.entries(mainFiles)) {
        task.storeArtifact(filename, content, `Generated ${filename}`, 'file');
      }
      
      return {
        success: true,
        result: {
          message: 'Project generated successfully',
          outputDirectory: outputDir,
          filesGenerated: Object.keys(mainFiles).length + 1, // +1 for package.json
          files: Object.keys(mainFiles)
        },
        artifacts: Object.values(task.getAllArtifacts())
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Project generation failed: ${error.message}`
      };
    }
  }
  
  /**
   * Generate specific files based on task description
   * @private
   */
  async _generateFiles(task, codingType) {
    console.log(`📝 Generating files for: ${task.description}`);
    
    const context = this._getContextFromTask(task);
    
    // Setup organized project directory
    const outputDir = await this._setupProjectDirectory(task, codingType);
    
    // Get file generation plan from LLM
    const plan = await this._getFileGenerationPlan(task, codingType);
    
    const generatedFiles = {};
    
    for (const fileSpec of plan.files) {
      try {
        const content = await this._generateFileContent(task, fileSpec, codingType);
        const filepath = path.join(outputDir, fileSpec.filename);
        
        // Ensure directory exists using tool
        const dirPath = path.dirname(filepath);
        await this.tools.directoryCreate.execute({ path: dirPath });
        
        // Write file using tool
        await this.tools.fileWrite.execute({ filepath, content });
        
        generatedFiles[fileSpec.filename] = content;
        task.storeArtifact(fileSpec.filename, content, `Generated ${fileSpec.filename}`, 'file');
        
        console.log(`✅ Generated ${fileSpec.filename} (${content.length} chars)`);
        
      } catch (error) {
        console.log(`❌ Failed to generate ${fileSpec.filename}: ${error.message}`);
      }
    }
    
    return {
      success: Object.keys(generatedFiles).length > 0,
      result: {
        message: `Generated ${Object.keys(generatedFiles).length} files`,
        files: Object.keys(generatedFiles)
      },
      artifacts: Object.values(task.getAllArtifacts())
    };
  }
  
  /**
   * Modify existing code files
   * @private
   */
  async _modifyCode(task, codingType) {
    console.log(`✏️ Modifying code for: ${task.description}`);
    
    // This would read existing files, analyze them, and make modifications
    // For now, return a placeholder implementation
    return {
      success: true,
      result: {
        message: 'Code modification completed',
        modifications: ['Placeholder: Code modification logic to be implemented']
      },
      artifacts: Object.values(task.getAllArtifacts())
    };
  }
  
  /**
   * Generate a single component
   * @private
   */
  async _generateComponent(task, codingType) {
    console.log(`🧩 Generating component for: ${task.description}`);
    
    const context = this._getContextFromTask(task);
    
    // Setup organized project directory
    const outputDir = await this._setupProjectDirectory(task, codingType);
    
    // Generate component based on description
    const componentCode = await this._generateComponentCode(task, codingType);
    const filename = this._extractFilename(task.description) || 'Component.js';
    const filepath = path.join(outputDir, filename);
    
    try {
      await this.tools.fileWrite.execute({ filepath, content: componentCode });
      task.storeArtifact(filename, componentCode, `Generated component ${filename}`, 'file');
      
      return {
        success: true,
        result: {
          message: `Component ${filename} generated successfully`,
          filename: filename,
          size: componentCode.length
        },
        artifacts: Object.values(task.getAllArtifacts())
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Component generation failed: ${error.message}`
      };
    }
  }
  
  /**
   * Generate generic code
   * @private
   */
  async _generateGenericCode(task, codingType) {
    console.log(`📄 Generating generic code for: ${task.description}`);
    
    const context = this._getContextFromTask(task);
    
    // Setup organized project directory
    const outputDir = await this._setupProjectDirectory(task, codingType);
    
    // Generate code based on task description
    const codeContent = await this._generateCodeFromDescription(task, codingType);
    const filename = this._extractFilename(task.description) || 'generated_code.js';
    const filepath = path.join(outputDir, filename);
    
    try {
      await this.tools.fileWrite.execute({ filepath, content: codeContent });
      task.storeArtifact(filename, codeContent, `Generated ${filename}`, 'file');
      
      return {
        success: true,
        result: {
          message: `Code generated successfully`,
          filename: filename,
          size: codeContent.length
        },
        artifacts: Object.values(task.getAllArtifacts())
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Code generation failed: ${error.message}`
      };
    }
  }
  
  /**
   * Generate package.json for a project
   * @private
   */
  async _generatePackageJson(task, codingType) {
    const prompt = `You are an expert Node.js developer. Generate a comprehensive package.json for this project:

## Project Description
"${task.description}"

## Requirements
- Language: ${codingType.language}
- Type: ${codingType.type}
- Complexity: ${codingType.complexity}

## Package.json Requirements
1. **Basic Info**: Appropriate name, version, description
2. **Scripts**: Include start, test, dev, build scripts as appropriate
3. **Dependencies**: Include necessary runtime dependencies based on project type
4. **DevDependencies**: Include development tools (testing, linting, etc.)
5. **Engine Requirements**: Specify Node.js version requirements
6. **Repository Info**: Basic repository structure
7. **Keywords**: Relevant keywords for the project

## Guidelines by Project Type
- **API/Server**: Express, cors, helmet, dotenv, nodemon
- **CLI Tool**: Commander, inquirer, chalk
- **Library/Module**: Minimal dependencies, proper exports
- **Testing**: Jest, mocha, or appropriate testing framework
- **Build Tools**: Webpack, babel, or appropriate build tools

## Modern Best Practices
- Use semantic versioning
- Include proper license
- Add author information
- Include homepage and bugs URLs
- Specify proper main/module entry points
- Include type: "module" if using ES modules

Return ONLY the JSON object, properly formatted:`;

    try {
      const response = await this.llmClient.generateResponse([{
        role: 'user',
        content: prompt
      }]);
      
      return JSON.parse(response);
    } catch (error) {
      // Default package.json
      return {
        name: 'generated-project',
        version: '1.0.0',
        description: task.description,
        main: 'src/index.js',
        type: 'module',
        scripts: {
          start: 'node src/index.js',
          test: 'jest',
          dev: 'nodemon src/index.js'
        },
        dependencies: {},
        devDependencies: {
          jest: '^29.0.0',
          nodemon: '^3.0.0'
        }
      };
    }
  }

  /**
   * Generate main application files
   * @private
   */
  async _generateMainFiles(task, codingType, outputDir) {
    const prompt = `You are an expert ${codingType.language} developer. Generate complete main application files for this project:

## Project Description
"${task.description}"

## Project Structure Requirements
- Language: ${codingType.language}
- Type: ${codingType.type}
- Complexity: ${codingType.complexity}
- Output Directory: ${outputDir}

## File Generation Guidelines
1. **Entry Point**: Create a main entry file (index.js/app.js)
2. **Module Structure**: Organize code into logical modules
3. **Configuration**: Include configuration files if needed
4. **Documentation**: Add README-style comments in main files
5. **Dependencies**: Consider what external libraries might be needed

## Required Files Based on Project Type
- **Entry Point**: Main application file with startup logic
- **Core Logic**: Business logic modules
- **Utilities**: Helper functions and utilities
- **Configuration**: Config files for different environments
- **Documentation**: Inline documentation and usage examples

## Code Quality Standards
- Production-ready code with error handling
- Clear module boundaries and exports
- Comprehensive logging and debugging support
- Environment variable support
- Graceful shutdown handling
- Input validation throughout

## Output Format
Return a JSON object with filename as key and complete file content as value.
Example:
{
  "index.js": "complete file content here",
  "config.js": "configuration file content",
  "utils.js": "utility functions"
}

## Implementation Notes
- Include proper error handling in all files
- Add meaningful comments explaining complex logic
- Use modern ${codingType.language} features
- Ensure files work together as a cohesive system
- Include example usage where appropriate

Generate the complete file structure now:`;

    try {
      const response = await this.llmClient.generateResponse([{
        role: 'user',
        content: prompt
      }]);
      
      // Try to parse as JSON, fallback to single file
      try {
        return JSON.parse(response);
      } catch {
        return {
          'index.js': response
        };
      }
    } catch (error) {
      return {
        'index.js': `// Generated placeholder file\nconsole.log('Hello World');\n`
      };
    }
  }
  
  /**
   * Get file generation plan from LLM
   * @private
   */
  async _getFileGenerationPlan(task, codingType) {
    const prompt = `Create a file generation plan for this task:

Task: "${task.description}"
Language: ${codingType.language}

Return JSON with files to generate:
{
  "files": [
    {
      "filename": "example.js",
      "type": "module|class|function|config",
      "description": "what this file does"
    }
  ]
}`;

    try {
      const response = await this.llmClient.generateResponse([{
        role: 'user',
        content: prompt
      }]);
      
      return JSON.parse(response);
    } catch (error) {
      return {
        files: [
          {
            filename: 'generated_file.js',
            type: 'module',
            description: 'Generated file based on task description'
          }
        ]
      };
    }
  }
  
  /**
   * Generate content for a specific file
   * @private
   */
  async _generateFileContent(task, fileSpec, codingType) {
    const prompt = `Generate ${codingType.language} code for this file:

File: ${fileSpec.filename}
Type: ${fileSpec.type}
Description: ${fileSpec.description}

Task Context: "${task.description}"
Available Artifacts: ${task.getArtifactsContext()}

Generate clean, well-documented code that follows best practices.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate component code
   * @private
   */
  async _generateComponentCode(task, codingType) {
    const prompt = `Generate a ${codingType.language} component for this task:

Task: "${task.description}"
Language: ${codingType.language}

Generate a well-structured, documented component with proper exports.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate code from task description
   * @private
   */
  async _generateCodeFromDescription(task, codingType) {
    const prompt = `You are an expert ${codingType.language} developer. Generate production-quality code for this task:

## Task Description
"${task.description}"

## Requirements
- Language: ${codingType.language}
- Complexity: ${codingType.complexity}
- Type: ${codingType.type}

## Available Context
${task.getArtifactsContext()}

## Code Generation Guidelines
1. **Structure**: Use proper module structure with clear imports/exports
2. **Documentation**: Include comprehensive JSDoc comments for all functions
3. **Error Handling**: Implement robust error handling with descriptive messages
4. **Best Practices**: Follow ${codingType.language} best practices and conventions
5. **Testing Considerations**: Write code that is easily testable with clear interfaces
6. **Performance**: Consider performance implications and optimize where appropriate
7. **Security**: Follow security best practices (input validation, etc.)

## Expected Output
- Complete, runnable code
- Clear function/class definitions
- Proper variable naming
- Comments explaining complex logic
- Error handling for edge cases
- Export statements for main functionality

## Code Style
- Use ES6+ features where appropriate
- Prefer const/let over var
- Use arrow functions for simple operations
- Include proper spacing and indentation
- Add descriptive variable and function names

Generate the complete code now:`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Extract filename from task description
   * @private
   */
  _extractFilename(description) {
    // Simple regex to find filename patterns
    const patterns = [
      /create (\w+\.js)/i,
      /generate (\w+\.js)/i,
      /write (\w+\.js)/i,
      /(\w+\.js)/i
    ];
    
    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }
  
  /**
   * Setup organized project directory with descriptive name
   * @private
   */
  async _setupProjectDirectory(task, codingType) {
    const projectName = this._generateProjectName(task.description, codingType);
    const romaProjectsDir = '/tmp/roma-projects';
    const outputDir = path.join(romaProjectsDir, projectName);
    
    // Ensure roma-projects directory exists
    await this.tools.directoryCreate.execute({ path: romaProjectsDir });
    await this.tools.directoryCreate.execute({ path: outputDir });
    
    return outputDir;
  }
  
  /**
   * Generate a descriptive project name from task description
   * @private
   */
  _generateProjectName(description, codingType) {
    // Extract key words from description and create a clean project name
    const cleanedDescription = description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .split(' ')
      .filter(word => word.length > 2) // Remove short words
      .slice(0, 4) // Take first 4 meaningful words
      .join('-');
    
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format
    const projectType = codingType.type.toLowerCase().replace('_', '-');
    
    return `${projectType}-${cleanedDescription}-${timestamp}`;
  }
}