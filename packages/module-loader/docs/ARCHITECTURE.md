# jsEnvoy Module/Tool Architecture

## Overview

This document describes the proposed architecture for jsEnvoy's tool system, introducing a clean separation between Modules (containers) and Tools (individual LLM-callable functions).

## Core Concepts

### 1. **Tools**
- Individual functions that LLMs can call
- Single purpose, single function
- What the LLM sees and selects

### 2. **Modules**
- Containers that group related tools
- Declare their resource dependencies
- Never directly receive ResourceManager
- Instantiated by the factory with injected dependencies

### 3. **ResourceManager**
- Central registry for all resources (API keys, configs, clients, etc.)
- Resources are registered by name
- Used by the factory to resolve dependencies

### 4. **ModuleFactory**
- Reads module dependency declarations
- Fetches resources from ResourceManager
- Constructs modules with their required dependencies

## Architecture Flow

```
1. System starts
2. ResourceManager is populated with resources
3. ModuleFactory is created with ResourceManager
4. Modules are instantiated by factory
5. Modules create and register their tools
6. LLM receives flat list of all tools
```

## Implementation

### Base Classes

```javascript
// Base class for modules
class OpenAIModule {
  constructor() {
    this.name = '';
    this.tools = [];
  }
  
  getTools() {
    return this.tools;
  }
}

// Base class for individual tools
class OpenAITool {
  constructor() {
    this.name = '';
    this.description = '';
    this.parameters = {};
  }
  
  async execute(args) {
    throw new Error('execute() must be implemented by subclass');
  }
  
  getDescription() {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters
      }
    };
  }
}
```

### Resource Manager

```javascript
class ResourceManager {
  constructor() {
    this.resources = new Map();
  }
  
  register(name, resource) {
    this.resources.set(name, resource);
  }
  
  get(name) {
    if (!this.resources.has(name)) {
      throw new Error(`Resource '${name}' not found`);
    }
    return this.resources.get(name);
  }
  
  has(name) {
    return this.resources.has(name);
  }
}
```

### Module Factory

```javascript
class ModuleFactory {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
  }
  
  createModule(ModuleClass) {
    // Get declared dependencies
    const requiredResources = ModuleClass.dependencies || [];
    
    // Resolve dependencies from ResourceManager
    const resolvedDependencies = {};
    requiredResources.forEach(resourceName => {
      resolvedDependencies[resourceName] = this.resourceManager.get(resourceName);
    });
    
    // Construct module with resolved dependencies
    return new ModuleClass(resolvedDependencies);
  }
  
  createAllModules(moduleClasses) {
    return moduleClasses.map(ModuleClass => this.createModule(ModuleClass));
  }
}
```

### Example: GitHub Module

```javascript
class GitHubModule extends OpenAIModule {
  // Declare required dependencies
  static dependencies = ['githubPAT', 'githubUsername', 'githubApiClient'];
  
  // Constructor receives resolved dependencies as an object
  constructor({ githubPAT, githubUsername, githubApiClient }) {
    super();
    this.name = 'github';
    
    // Store injected dependencies
    this.githubPAT = githubPAT;
    this.githubUsername = githubUsername;
    this.apiClient = githubApiClient;
    
    // Create tools with dependencies
    this.tools = [
      new GitHubCreateRepoTool(this.githubPAT, this.apiClient),
      new GitHubPushToRepoTool(this.githubPAT, this.githubUsername),
      new GitHubCreateAndPushTool(this.githubPAT, this.githubUsername, this.apiClient)
    ];
  }
}

// Individual tool implementation
class GitHubCreateRepoTool extends OpenAITool {
  constructor(githubPAT, apiClient) {
    super();
    this.name = 'github_create_repo';
    this.description = 'Create a new GitHub repository';
    this.githubPAT = githubPAT;
    this.apiClient = apiClient;
    
    this.parameters = {
      type: 'object',
      properties: {
        repoName: {
          type: 'string',
          description: 'Name of the repository to create'
        },
        description: {
          type: 'string',
          description: 'Repository description'
        },
        private: {
          type: 'boolean',
          description: 'Whether the repository should be private'
        }
      },
      required: ['repoName']
    };
  }
  
  async execute({ repoName, description, private: isPrivate }) {
    // Implementation using this.githubPAT and this.apiClient
    const result = await this.apiClient.createRepo({
      name: repoName,
      description,
      private: isPrivate,
      token: this.githubPAT
    });
    
    return {
      success: true,
      url: result.html_url,
      cloneUrl: result.clone_url
    };
  }
}
```

### Example: File Module

```javascript
class FileModule extends OpenAIModule {
  // Different dependencies than GitHub
  static dependencies = ['fileSystemBasePath', 'fileSystemPermissions', 'fileSystemLogger'];
  
  constructor({ fileSystemBasePath, fileSystemPermissions, fileSystemLogger }) {
    super();
    this.name = 'file';
    
    this.basePath = fileSystemBasePath;
    this.permissions = fileSystemPermissions;
    this.logger = fileSystemLogger;
    
    this.tools = [
      new FileReaderTool(this.basePath, this.permissions, this.logger),
      new FileWriterTool(this.basePath, this.permissions, this.logger),
      new DirectoryCreatorTool(this.basePath, this.permissions, this.logger)
    ];
  }
}
```

### System Initialization

```javascript
// 1. Create and populate ResourceManager
const resourceManager = new ResourceManager();

// Register resources from various sources
resourceManager.register('githubPAT', process.env.GITHUB_PAT);
resourceManager.register('githubUsername', await fetchGitHubUsername());
resourceManager.register('githubApiClient', new GitHubAPIClient({
  baseUrl: 'https://api.github.com'
}));

resourceManager.register('fileSystemBasePath', config.filesystem.basePath || process.cwd());
resourceManager.register('fileSystemPermissions', {
  read: true,
  write: true,
  execute: false
});
resourceManager.register('fileSystemLogger', new Logger('filesystem'));

resourceManager.register('serperApiKey', process.env.SERPER_API_KEY);
resourceManager.register('serperRateLimit', config.serper.rateLimit || 100);

// 2. Create ModuleFactory
const moduleFactory = new ModuleFactory(resourceManager);

// 3. Define available modules
const availableModules = [
  GitHubModule,
  FileModule,
  CalculatorModule,
  CommandExecutorModule,
  SerperModule,
  // ... etc
];

// 4. Create all module instances
const modules = moduleFactory.createAllModules(availableModules);

// 5. Collect all tools from modules
const allTools = modules.flatMap(module => module.getTools());

// 6. Register tools for LLM access
const toolRegistry = new ToolRegistry();
allTools.forEach(tool => {
  toolRegistry.register(tool.name, tool);
});
```

### LLM Integration

```javascript
// Get tool descriptions for OpenAI
function getAllToolDescriptions() {
  return allTools.map(tool => tool.getDescription());
}

// Execute tool by name
async function executeToolByName(toolName, args) {
  const tool = toolRegistry.get(toolName);
  if (!tool) {
    throw new Error(`Tool ${toolName} not found`);
  }
  
  return await tool.execute(args);
}

// OpenAI integration
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const completion = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [...],
  tools: getAllToolDescriptions(),
  tool_choice: "auto"
});

// Handle tool calls
if (completion.choices[0].message.tool_calls) {
  for (const toolCall of completion.choices[0].message.tool_calls) {
    const args = JSON.parse(toolCall.function.arguments);
    const result = await executeToolByName(toolCall.function.name, args);
    // Send result back to OpenAI...
  }
}
```

## Benefits

1. **Clean Separation of Concerns**
   - Modules group related functionality
   - Tools are individual, focused functions
   - Resources are centrally managed

2. **Declarative Dependencies**
   - Modules declare what they need
   - No knowledge of how to obtain resources
   - Easy to see module requirements

3. **Testability**
   - Mock ResourceManager for testing
   - Test modules in isolation
   - Test tools individually

4. **Flexibility**
   - Add new modules without changing core
   - Resources can come from anywhere
   - Easy to reconfigure

5. **Type Safety**
   - Module constructors have clear signatures
   - Dependencies are explicit
   - No magic strings in module code

## Migration Path

1. Create new base classes (OpenAIModule, OpenAITool)
2. Implement ResourceManager and ModuleFactory
3. Refactor existing tools one module at a time
4. Update initialization code
5. Maintain backward compatibility during transition

## Example Module Structures

### Simple Module (Calculator)
```javascript
class CalculatorModule extends OpenAIModule {
  static dependencies = []; // No external dependencies
  
  constructor({}) {
    super();
    this.name = 'calculator';
    this.tools = [
      new CalculatorEvaluateTool()
    ];
  }
}
```

### Complex Module (Serper/Google Search)
```javascript
class SerperModule extends OpenAIModule {
  static dependencies = ['serperApiKey', 'serperRateLimit', 'httpClient', 'logger'];
  
  constructor({ serperApiKey, serperRateLimit, httpClient, logger }) {
    super();
    this.name = 'serper';
    
    // Create tools with dependencies
    this.tools = [
      new GoogleSearchTool(serperApiKey, httpClient, logger),
      new GoogleImageSearchTool(serperApiKey, httpClient, logger),
      new GoogleNewsSearchTool(serperApiKey, httpClient, logger)
    ];
    
    // Apply rate limiting to all tools
    this.tools.forEach(tool => {
      tool.setRateLimit(serperRateLimit);
    });
  }
}
```

## Summary

This architecture provides:
- Clear conceptual model (Modules contain Tools)
- Clean dependency injection
- Flexibility and testability
- Alignment with LLM expectations
- Easy extensibility

The key insight is that Modules are just containers that:
1. Declare their dependencies
2. Receive resolved dependencies in constructor
3. Create and configure their Tools
4. Never know about ResourceManager or Factory