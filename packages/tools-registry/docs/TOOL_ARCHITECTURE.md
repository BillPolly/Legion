# Tool Architecture Design Document

## Table of Contents
1. [Overview](#overview)
2. [Core Philosophy](#core-philosophy)
3. [Architecture Components](#architecture-components)
4. [The Focus Object Pattern](#the-focus-object-pattern)
5. [Implementation Details](#implementation-details)
6. [Concrete Module Examples](#concrete-module-examples)
7. [Tool Discovery & Metadata](#tool-discovery--metadata)
8. [Framework Integration](#framework-integration)
9. [Usage Patterns](#usage-patterns)
10. [Best Practices](#best-practices)
11. [Implementation Roadmap](#implementation-roadmap)

## Overview

This document outlines a comprehensive object-oriented architecture for tools in the Recursive Planning Agent Framework. The design treats tools not as independent functions, but as methods within stateful modules that operate on specific focus objects.

### Key Principles
- **Tools are methods**, not standalone functions
- **Modules group related tools** that share configuration and state
- **Focus objects provide context** for tool operations
- **Providers act as factories** for creating configured module instances
- **Discovery enables intelligent planning** through rich metadata

## The Facade Pattern: Wrapping Existing Functionality

**The primary value of this architecture is wrapping existing functionality**, not building tools from scratch. This is a **facade pattern** that makes existing libraries, services, APIs, and tools discoverable and composable within the agent framework.

### What Gets Wrapped

This architecture excels at wrapping:

- **Node.js Libraries**: `fs`, `axios`, `pg`, `mongodb`, `sharp`, etc.
- **CLI Tools**: `git`, `docker`, `kubectl`, `npm`, `python`, etc.  
- **MCP Servers**: Any MCP (Model Context Protocol) server
- **REST APIs**: GitHub API, AWS APIs, Stripe API, etc.
- **Database ORMs**: Sequelize, Prisma, TypeORM, etc.
- **Existing Classes**: Any JavaScript class with methods

### Data-Driven Wrapping

The architecture supports **data-driven configuration** where you can declaratively define how to wrap existing functionality:

```javascript
// Declarative wrapping of Node's fs module
const fsModuleConfig = {
  name: 'FileSystemModule',
  wraps: 'fs/promises',
  tools: {
    readFile: {
      method: 'readFile',
      description: 'Read file contents',
      inputMapping: { path: 'path', encoding: 'encoding' },
      outputTransform: (content) => ({ content, size: content.length })
    },
    writeFile: {
      method: 'writeFile', 
      description: 'Write file contents',
      inputMapping: { path: 'path', data: 'content', encoding: 'encoding' }
    }
  }
};
```

### Progressive Complexity

1. **Simple Method Wrapping** (most common): Direct method calls with parameter mapping
2. **Custom Parameter Transformation**: Transform inputs/outputs to match patterns
3. **Handle Management**: Create and pass opaque resource handles between tools
4. **Native Implementation** (advanced): Write tools from scratch when wrapping isn't suitable

### Why Wrapping Works Better

Wrapping existing functionality provides:
- **Instant capability**: Leverage thousands of existing libraries
- **Proven reliability**: Use battle-tested implementations
- **Consistent interface**: Expose everything through the same tool contract
- **Easy maintenance**: Updates to underlying libraries are automatically available
- **Rich ecosystem**: Access the entire JavaScript/Node.js ecosystem

## Core Philosophy

### Why Object-Oriented Tools?

Traditional tool architectures treat tools as independent functions, leading to:
- **Redundant configuration**: Each tool needs its own setup
- **Resource inefficiency**: Multiple connections, clients, handles
- **Lost context**: No state preservation between operations
- **Parameter repetition**: Same arguments passed repeatedly
- **Poor discoverability**: Hard to understand tool relationships

Our object-oriented approach solves these issues by recognizing that tools naturally cluster around:
1. **Shared resources** (connections, clients, sessions)
2. **Common configuration** (credentials, endpoints, settings)
3. **Operational context** (what they operate on)
4. **Related functionality** (CRUD operations, workflow steps)

### The Method Analogy

Consider Git operations:
```javascript
// Traditional approach - repetitive and stateless
git.clone({ repo: 'url', dir: '/path' });
git.checkout({ repo: '/path', branch: 'main' });
git.add({ repo: '/path', files: ['README.md'] });
git.commit({ repo: '/path', message: 'Update' });
git.push({ repo: '/path', remote: 'origin', branch: 'main' });

// Object-oriented approach - stateful and contextual
const repo = git.repository('/path');
await repo.clone('url');
await repo.checkout('main');
await repo.add(['README.md']);
await repo.commit('Update');
await repo.push('origin', 'main');
```

## Architecture Components

### 1. ModuleDefinition Class

A `ModuleDefinition` is a class with exactly two static methods that define a module type:

```javascript
class ModuleDefinition {
  /**
   * Create a configured ModuleInstance
   * @param {Object} config - Configuration (API keys, endpoints, etc.)
   * @returns {Promise<ModuleInstance>} Configured module instance
   */
  static async create(config) {
    throw new Error('Must be implemented by subclass');
  }
  
  /**
   * Get metadata about all tools in this module
   * @returns {Object} Module and tool metadata
   */
  static getMetadata() {
    throw new Error('Must be implemented by subclass');
  }
}

// Example concrete implementation
class GitModuleDefinition extends ModuleDefinition {
  static async create(config) {
    // Validate and set defaults
    const validatedConfig = {
      gitPath: config.gitPath || 'git',
      author: config.author,
      ...config
    };
    
    // Create the module instance
    const instance = new GitModuleInstance(this, validatedConfig);
    
    // Async initialization if needed
    await instance.initialize();
    
    return instance;
  }
  
  static getMetadata() {
    return {
      module: 'GitModule',
      description: 'Git version control operations',
      tools: {
        clone: {
          description: 'Clone a repository',
          input: { url: 'string', directory: 'string' },
          output: { repository: 'string', path: 'string' }
        },
        commit: {
          description: 'Commit changes',
          input: { repository: 'string', message: 'string' },
          output: { hash: 'string', timestamp: 'number' }
        }
      }
    };
  }
}
```

### 2. ModuleInstance Class

A `ModuleInstance` is created with the ModuleDefinition and config, and creates/wraps tools:

```javascript
class ModuleInstance {
  constructor(moduleDefinition, config) {
    this.moduleDefinition = moduleDefinition;
    this.config = config;
    this.tools = {};
    this.wrappedInstance = null; // Often wraps an existing class
    
    // Create tools (implemented by subclass or wrapper)
    this.createTools();
  }
  
  /**
   * Create the tools (to be implemented by subclass)
   */
  createTools() {
    throw new Error('Must be implemented by subclass');
  }
  
  /**
   * Async initialization (can be overridden)
   */
  async initialize() {
    // Override in subclass if async setup needed
  }
  
  /**
   * Get a tool by name
   * @param {string} name - Tool name
   * @returns {Tool} The requested tool
   */
  getTool(name) {
    const tool = this.tools[name];
    if (!tool) {
      throw new Error(`Tool '${name}' not found in module`);
    }
    return tool;
  }
  
  /**
   * List available tool names
   * @returns {string[]} Array of tool names
   */
  listTools() {
    return Object.keys(this.tools);
  }
  
  /**
   * Optional: cleanup resources
   */
  async cleanup() {
    // Close connections, cleanup resources
    if (this.wrappedInstance && this.wrappedInstance.close) {
      await this.wrappedInstance.close();
    }
  }
}

// Example: Wrapping an existing class
class GitModuleInstance extends ModuleInstance {
  createTools() {
    // Create the underlying git client
    this.wrappedInstance = new GitClient(this.config);
    
    // Create tools that wrap the client methods
    this.tools.clone = new Tool({
      name: 'clone',
      execute: this.wrappedInstance.clone.bind(this.wrappedInstance),
      getMetadata: () => ({
        description: 'Clone a repository',
        input: { url: 'string', directory: 'string' },
        output: { repository: 'object', path: 'string' }
      })
    });
    
    this.tools.commit = new Tool({
      name: 'commit', 
      execute: this.wrappedInstance.commit.bind(this.wrappedInstance),
      getMetadata: () => ({
        description: 'Commit changes',
        input: { repository: 'object', message: 'string' },
        output: { hash: 'string' }
      })
    });
  }
  
  async initialize() {
    // Async setup - authenticate, check git binary, etc.
    await this.wrappedInstance.initialize();
  }
}

// Example: Direct tool creation
class DatabaseModuleInstance extends ModuleInstance {
  createTools() {
    // Create database connection
    this.wrappedInstance = new DatabaseConnection(this.config);
    
    // Create tools directly
    this.tools.query = new Tool({
      name: 'query',
      execute: async (input) => {
        const result = await this.wrappedInstance.query(input.sql);
        return result;
      },
      getMetadata: () => ({
        description: 'Execute SQL query',
        input: { sql: 'string' },
        output: { rows: 'array' }
      })
    });
  }
}
```

### 3. Tool Class

A `Tool` is a class with exactly two methods:

```javascript
class Tool {
  constructor({ name, execute, getMetadata }) {
    this.name = name;
    this._execute = execute;
    this._getMetadata = getMetadata;
  }
  
  /**
   * Execute the tool
   * @param {Object} input - JSON input
   * @returns {Promise<Object>} JSON output with success/error
   */
  async execute(input) {
    try {
      // Call the provided execute function
      const result = await this._execute(input);
      
      // Ensure proper format
      if (!result || typeof result !== 'object') {
        throw new Error('Tool must return an object');
      }
      
      if (!('success' in result)) {
        throw new Error('Tool must return {success: boolean, ...}');
      }
      
      return result;
      
    } catch (error) {
      // If the tool throws, wrap in standard error format
      if (error.success === false) {
        return error; // Already in correct format
      }
      
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error.message || 'Tool execution failed',
          details: {
            tool: this.name,
            timestamp: Date.now()
          }
        }
      };
    }
  }
  
  /**
   * Get tool metadata
   * @returns {Object} Tool metadata
   */
  getMetadata() {
    return this._getMetadata();
  }
}

// Example usage
const cloneTool = new Tool({
  name: 'clone',
  async execute(input) {
    const { url, directory = '.' } = input;
    // Implementation
    // Return the opaque repository handle directly
    return { _id: 'repo_123', _repoHandle: true, path: directory };
  },
  getMetadata() {
    return {
      description: 'Clone a repository',
      input: {
        url: { type: 'string', required: true },
        directory: { type: 'string', default: '.' }
      },
      output: {
        success: { repository: 'string', path: 'string' },
        error: { codes: ['CLONE_FAILED'] }
      }
    };
  }
});
```

## Wrapping Examples: From Simple to Complex

### 1. Wrapping Node.js Built-in Modules (Simple)

The most common case - wrapping Node.js built-ins with minimal configuration:

```javascript
// Wrapping the fs module
class FileSystemModuleDefinition extends ModuleDefinition {
  static async create(config) {
    const fs = await import('fs/promises');
    return new FileSystemModuleInstance(this, config, fs);
  }
}

class FileSystemModuleInstance extends ModuleInstance {
  constructor(definition, config, fs) {
    super(definition, config);
    this.fs = fs;
    this.basePath = config.basePath || process.cwd();
  }
  
  createTools() {
    // Direct method wrapping
    this.tools.readFile = new Tool({
      name: 'readFile',
      execute: async (input) => {
        const { path, encoding = 'utf8' } = input;
        const fullPath = this.resolvePath(path);
        const content = await this.fs.readFile(fullPath, encoding);
        return { content, path: fullPath, size: content.length };
      },
      getMetadata: () => ({
        description: 'Read file contents',
        input: { path: 'string', encoding: 'string?' },
        output: { content: 'string', path: 'string', size: 'number' }
      })
    });
    
    this.tools.writeFile = new Tool({
      name: 'writeFile',
      execute: async (input) => {
        const { path, content, encoding = 'utf8' } = input;
        const fullPath = this.resolvePath(path);
        await this.fs.writeFile(fullPath, content, encoding);
        return { path: fullPath, size: content.length };
      },
      getMetadata: () => ({
        description: 'Write file contents',
        input: { path: 'string', content: 'string', encoding: 'string?' },
        output: { path: 'string', size: 'number' }
      })
    });
  }
  
  resolvePath(relativePath) {
    return require('path').resolve(this.basePath, relativePath);
  }
}
```

### 2. Wrapping NPM Libraries (Medium Complexity)

Wrapping third-party libraries with configuration and state:

```javascript
// Wrapping axios for HTTP requests
class HTTPModuleDefinition extends ModuleDefinition {
  static async create(config) {
    const axios = require('axios');
    return new HTTPModuleInstance(this, config, axios);
  }
}

class HTTPModuleInstance extends ModuleInstance {
  constructor(definition, config, axios) {
    super(definition, config);
    
    // Create configured axios instance
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: config.defaultHeaders || {}
    });
    
    // Add interceptors
    this.setupInterceptors();
  }
  
  createTools() {
    this.tools.get = new Tool({
      name: 'get',
      execute: async (input) => {
        const { url, params, headers } = input;
        const response = await this.client.get(url, { params, headers });
        return {
          data: response.data,
          status: response.status,
          headers: response.headers
        };
      },
      getMetadata: () => ({
        description: 'HTTP GET request',
        input: { url: 'string', params: 'object?', headers: 'object?' },
        output: { data: 'any', status: 'number', headers: 'object' }
      })
    });
    
    this.tools.post = new Tool({
      name: 'post',
      execute: async (input) => {
        const { url, data, headers } = input;
        const response = await this.client.post(url, data, { headers });
        return {
          data: response.data,
          status: response.status,
          headers: response.headers
        };
      },
      getMetadata: () => ({
        description: 'HTTP POST request',
        input: { url: 'string', data: 'any', headers: 'object?' },
        output: { data: 'any', status: 'number', headers: 'object' }
      })
    });
  }
  
  setupInterceptors() {
    // Add auth token if available
    this.client.interceptors.request.use(config => {
      if (this.config.authToken) {
        config.headers.Authorization = `Bearer ${this.config.authToken}`;
      }
      return config;
    });
  }
}
```

### 3. Wrapping CLI Tools (Handle-Based)

Wrapping command-line tools with opaque resource handles:

```javascript
// Wrapping git CLI with repository handles
class GitModuleDefinition extends ModuleDefinition {
  static async create(config) {
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const exec = promisify(execFile);
    return new GitModuleInstance(this, config, exec);
  }
}

class GitModuleInstance extends ModuleInstance {
  constructor(definition, config, exec) {
    super(definition, config);
    this.exec = exec;
    this.gitPath = config.gitPath || 'git';
    this.repositories = new Map(); // Track repository handles
  }
  
  createTools() {
    this.tools.clone = new Tool({
      name: 'clone',
      execute: async (input) => {
        const { url, directory = '.' } = input;
        await this.exec(this.gitPath, ['clone', url, directory]);
        
        // Create opaque repository handle
        const repoHandle = {
          _id: `repo_${Date.now()}`,
          _type: 'git_repository',
          path: require('path').resolve(directory),
          url: url
        };
        
        this.repositories.set(repoHandle._id, repoHandle);
        return repoHandle;
      },
      getMetadata: () => ({
        description: 'Clone a git repository',
        input: { url: 'string', directory: 'string?' },
        output: 'repository_handle'
      })
    });
    
    this.tools.commit = new Tool({
      name: 'commit', 
      execute: async (input) => {
        const { repository, message, author } = input;
        if (!repository || !repository._id) {
          throw new Error('Valid repository handle required');
        }
        
        const repoInfo = this.repositories.get(repository._id);
        if (!repoInfo) {
          throw new Error('Repository handle not found');
        }
        
        const args = ['commit', '-m', message];
        if (author) args.push('--author', author);
        
        await this.exec(this.gitPath, args, { cwd: repoInfo.path });
        
        // Get commit hash
        const { stdout } = await this.exec(this.gitPath, ['rev-parse', 'HEAD'], 
          { cwd: repoInfo.path });
        
        return {
          hash: stdout.trim(),
          message,
          timestamp: Date.now()
        };
      },
      getMetadata: () => ({
        description: 'Commit changes to repository',
        input: { repository: 'repository_handle', message: 'string', author: 'string?' },
        output: { hash: 'string', message: 'string', timestamp: 'number' }
      })
    });
  }
}
```

### 4. Wrapping REST APIs (Configuration-Heavy)

Wrapping external APIs with authentication and rate limiting:

```javascript
// Wrapping GitHub API
class GitHubModuleDefinition extends ModuleDefinition {
  static async create(config) {
    const axios = require('axios');
    return new GitHubModuleInstance(this, config, axios);
  }
}

class GitHubModuleInstance extends ModuleInstance {
  constructor(definition, config, axios) {
    super(definition, config);
    
    this.client = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Authorization': `token ${config.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    // Rate limiting
    this.rateLimiter = new RateLimiter(config.rateLimit || { requests: 5000, per: 3600000 });
  }
  
  createTools() {
    this.tools.getRepository = new Tool({
      name: 'getRepository',
      execute: async (input) => {
        const { owner, repo } = input;
        await this.rateLimiter.wait();
        
        const response = await this.client.get(`/repos/${owner}/${repo}`);
        
        // Return repository handle with API context
        return {
          _id: `github_repo_${owner}_${repo}`,
          _type: 'github_repository',
          owner,
          name: repo,
          fullName: response.data.full_name,
          apiData: response.data
        };
      },
      getMetadata: () => ({
        description: 'Get GitHub repository information',
        input: { owner: 'string', repo: 'string' },
        output: 'github_repository_handle'
      })
    });
    
    this.tools.createIssue = new Tool({
      name: 'createIssue',
      execute: async (input) => {
        const { repository, title, body, labels } = input;
        await this.rateLimiter.wait();
        
        const response = await this.client.post(
          `/repos/${repository.owner}/${repository.name}/issues`,
          { title, body, labels }
        );
        
        return {
          number: response.data.number,
          url: response.data.html_url,
          title: response.data.title
        };
      },
      getMetadata: () => ({
        description: 'Create GitHub issue',
        input: { 
          repository: 'github_repository_handle', 
          title: 'string', 
          body: 'string?',
          labels: 'string[]?'
        },
        output: { number: 'number', url: 'string', title: 'string' }
      })
    });
  }
}
```

### 5. Wrapping MCP Servers (Protocol Bridge)

Bridging MCP (Model Context Protocol) servers into the tool framework:

```javascript
// Wrapping an MCP server
class MCPModuleDefinition extends ModuleDefinition {
  static async create(config) {
    const { MCPClient } = require('@modelcontextprotocol/client');
    return new MCPModuleInstance(this, config, MCPClient);
  }
}

class MCPModuleInstance extends ModuleInstance {
  constructor(definition, config, MCPClient) {
    super(definition, config);
    this.client = new MCPClient(config.serverConfig);
    this.toolCache = new Map();
  }
  
  async initialize() {
    await this.client.connect();
    
    // Get available tools from MCP server
    const mcpTools = await this.client.listTools();
    
    // Create wrapper tools for each MCP tool
    for (const mcpTool of mcpTools) {
      this.wrapMCPTool(mcpTool);
    }
  }
  
  wrapMCPTool(mcpTool) {
    this.tools[mcpTool.name] = new Tool({
      name: mcpTool.name,
      execute: async (input) => {
        // Bridge to MCP protocol
        const mcpResult = await this.client.callTool(mcpTool.name, input);
        
        // Transform MCP result to our format
        if (mcpResult.isError) {
          throw new Error(mcpResult.content);
        }
        
        return mcpResult.content;
      },
      getMetadata: () => ({
        description: mcpTool.description,
        input: mcpTool.inputSchema,
        output: 'varies',
        source: 'mcp_server'
      })
    });
  }
  
  async cleanup() {
    if (this.client) {
      await this.client.disconnect();
    }
  }
}
```

### 6. Data-Driven Wrapping (Ultra-Simplified)

For simple cases, support completely data-driven configuration:

```javascript
// Configuration-only wrapping (no custom code needed)
const moduleConfigs = {
  fs: {
    type: 'node_module',
    module: 'fs/promises',
    tools: {
      readFile: { 
        method: 'readFile',
        description: 'Read file contents',
        transform: { output: (content, input) => ({ content, size: content.length, path: input.path }) }
      },
      writeFile: { 
        method: 'writeFile',
        description: 'Write file contents' 
      },
      mkdir: { 
        method: 'mkdir',
        description: 'Create directory' 
      }
    }
  },
  
  axios: {
    type: 'npm_library',
    module: 'axios',
    instanceConfig: (axios, config) => axios.create(config.axiosConfig),
    tools: {
      get: { method: 'get', description: 'HTTP GET request' },
      post: { method: 'post', description: 'HTTP POST request' },
      put: { method: 'put', description: 'HTTP PUT request' }
    }
  }
};

// Generic factory creates modules from config
const instance = await ModuleFactory.createFromConfig('fs', moduleConfigs.fs, {
  basePath: '/workspace'
});
```

## The Focus Object Pattern (Conceptual)

### Understanding Tools Through Focus

The "focus object" pattern is simply a **way of thinking** about how tools relate to resources. It's not an implementation detail - it's a mental model for understanding tool operations.

### The Concept

Many tools naturally operate on some "thing" - a file, a database, a repository, an API endpoint. We can think of this "thing" as the tool's focus. This is just a conceptual pattern that helps us understand:

- **What tools operate on**: Files, databases, repositories, etc.
- **How tools chain together**: One tool's output becomes another's input
- **Resource relationships**: Which tools create resources, which consume them

### How It Works in Practice

```javascript
// Tool 1 creates a resource (repository)
const repository = await git.clone({ url: 'https://github.com/user/repo' });
// Returns: <opaque-repository-handle> directly

// Tool 2 uses that repository - you don't look inside it!
const status = await git.status({ repository: repository });
// Returns: { modified: ['file1.js'], untracked: ['file2.js'] }

// Tool 3 uses the same repository object
const commit = await git.commit({ 
  repository: repository,  // Just pass the opaque object
  message: 'Update files' 
});
```

### Key Points

- **Opaque objects**: Don't inspect the internals - just pass them to other tools
- **Clean interfaces**: Tools that need a repository accept a repository object
- **Natural chaining**: `clone()` returns a repository, `commit()` accepts a repository
- **No magic**: Just objects passed between tools that understand them

### Benefits of Thinking This Way

1. **Mental clarity**: Easier to understand what each tool does
2. **Natural grouping**: Tools that work on the same resources belong together
3. **Clear dependencies**: You can see which tools need outputs from others
4. **Better planning**: AI agents can understand resource flow between tools

## Standard Tool Interface

### Input/Output Contract

All tools follow a strict JSON input/output contract:

```typescript
// Tool Input - Always a JSON object
interface ToolInput {
  [key: string]: any;  // Tool-specific parameters
}

// Tool Output - Always returns this structure
interface ToolOutput {
  success: boolean;
  data?: any;          // Present on success
  error?: ErrorObject; // Present on failure
}

// Standard Error Object
interface ErrorObject {
  code: string;        // Machine-readable error code
  message: string;     // Human-readable error message
  details?: {
    cause?: any;       // Original error if wrapped
    context?: any;     // Additional context
    stack?: string;    // Stack trace (development mode)
    timestamp: number; // When error occurred
    tool: string;      // Which tool failed
    input?: any;       // Input that caused failure (sanitized)
  };
  recoverable?: boolean; // Whether operation can be retried
  suggestions?: string[]; // Possible fixes
}
```

### Example Tool Implementation

```javascript
class FileSystemModule extends ToolModule {
  async readFile(input) {
    try {
      // Validate input
      const { path, encoding = 'utf8' } = input;
      if (!path) {
        return {
          success: false,
          error: {
            code: 'MISSING_PARAMETER',
            message: 'Required parameter "path" is missing',
            details: {
              tool: 'fs.readFile',
              timestamp: Date.now(),
              input: { encoding }
            },
            recoverable: false,
            suggestions: ['Provide a "path" parameter']
          }
        };
      }
      
      // Execute operation
      const content = await fs.readFile(path, encoding);
      
      // Return success
      return {
        content,
        path,
        encoding,
        size: content.length
      };
      
    } catch (error) {
      // Return failure
      return {
        success: false,
        error: {
          code: error.code || 'READ_ERROR',
          message: `Failed to read file: ${error.message}`,
          details: {
            cause: error,
            tool: 'fs.readFile',
            timestamp: Date.now(),
            input: { path: input.path },
            context: { encoding: input.encoding }
          },
          recoverable: error.code === 'ENOENT' ? false : true,
          suggestions: error.code === 'ENOENT' 
            ? ['Check if file exists', 'Verify the path is correct']
            : ['Check file permissions', 'Retry the operation']
        }
      };
    }
  }
}
```

### Standard Error Codes

Common error codes across all tools:

```javascript
const ErrorCodes = {
  // Input validation
  MISSING_PARAMETER: 'Required parameter is missing',
  INVALID_PARAMETER: 'Parameter value is invalid',
  TYPE_MISMATCH: 'Parameter type is incorrect',
  
  // Resource errors
  RESOURCE_NOT_FOUND: 'Resource does not exist',
  RESOURCE_UNAVAILABLE: 'Resource temporarily unavailable',
  RESOURCE_LOCKED: 'Resource is locked by another process',
  
  // Permission errors
  PERMISSION_DENIED: 'Insufficient permissions',
  AUTHENTICATION_REQUIRED: 'Authentication needed',
  AUTHORIZATION_FAILED: 'Not authorized for this operation',
  
  // Operation errors
  OPERATION_FAILED: 'Operation could not be completed',
  OPERATION_TIMEOUT: 'Operation timed out',
  OPERATION_CANCELLED: 'Operation was cancelled',
  
  // State errors
  INVALID_STATE: 'Operation not valid in current state',
  PRECONDITION_FAILED: 'Precondition for operation not met',
  
  // System errors
  INTERNAL_ERROR: 'Internal system error',
  NETWORK_ERROR: 'Network communication failed',
  RATE_LIMITED: 'Rate limit exceeded'
};
```

## Implementation Details

### Resource Management

Modules manage resources efficiently through lifecycle methods:

```javascript
class DatabaseModule extends ToolModule {
  async setupResources() {
    // Create connection pool
    this.resources.pool = await createPool({
      host: this.config.host,
      database: this.config.database,
      max: this.config.maxConnections || 10
    });
  }
  
  async teardownResources() {
    // Close connection pool
    if (this.resources.pool) {
      await this.resources.pool.end();
      delete this.resources.pool;
    }
  }
  
  async getConnection() {
    if (!this.resources.pool) {
      throw new Error('Module not initialized');
    }
    return this.resources.pool.acquire();
  }
}
```

### Error Handling

Comprehensive error handling with context preservation:

```javascript
class ToolError extends Error {
  constructor(message, context) {
    super(message);
    this.name = 'ToolError';
    this.module = context.module;
    this.method = context.method;
    this.focus = context.focus;
    this.params = context.params;
    this.timestamp = Date.now();
  }
}
```

### Tool Method Decoration

Methods can be decorated with metadata for automatic tool generation:

```javascript
class FileSystemModule extends ToolModule {
  getToolMethods() {
    return {
      readFile: {
        description: 'Read file contents',
        focusRequired: true,
        focusType: 'file',
        parameters: {
          encoding: { type: 'string', default: 'utf8' }
        },
        examples: [
          { params: { encoding: 'utf8' }, result: 'file contents...' }
        ]
      },
      writeFile: {
        description: 'Write content to file',
        focusRequired: true,
        focusType: 'file',
        parameters: {
          content: { type: 'string', required: true },
          encoding: { type: 'string', default: 'utf8' }
        }
      }
    };
  }
  
  async readFile(params = {}) {
    const { encoding = 'utf8' } = params;
    return await fs.readFile(this.focus.path, encoding);
  }
  
  async writeFile(params) {
    const { content, encoding = 'utf8' } = params;
    await fs.writeFile(this.focus.path, content, encoding);
  }
}
```

## Concrete Module Examples

### GitModule Example

A concrete module class that provides Git operations:

```javascript
class GitModule extends ToolModule {
  constructor(config) {
    super(config);
    this.gitPath = config.gitPath || 'git';
    this.defaultBranch = config.defaultBranch || 'main';
  }
  
  // Define which methods are tools
  getToolMethods() {
    return {
      clone: {
        description: 'Clone a repository',
        input: {
          url: { type: 'string', required: true },
          directory: { type: 'string', default: '.' }
        },
        output: {
          success: { repository: 'string', path: 'string' },
          error: { codes: ['CLONE_FAILED', 'INVALID_URL'] }
        }
      },
      commit: {
        description: 'Commit changes',
        input: {
          repository: { type: 'string', required: true },
          message: { type: 'string', required: true }
        },
        output: {
          success: { hash: 'string', timestamp: 'number' },
          error: { codes: ['NO_CHANGES', 'INVALID_REPO'] }
        }
      }
      // ... more tools
    };
  }
  
  // Repository operations
  async clone(input) {
    try {
      const { url, directory = '.' } = input;
      await this.exec(`clone ${url} ${directory}`);
      // Return opaque repository handle directly
      return { _id: `repo_${Date.now()}`, _repoHandle: true, path: directory, url };
    } catch (error) {
      return this.createError('CLONE_FAILED', error.message, input);
    }
  }
  
  async status(input) {
    try {
      const { repository } = input;
      if (!repository) {
        return this.createError('MISSING_PARAMETER', 'Repository handle required', input);
      }
      const result = await this.exec('status --porcelain', repository);
      return this.parseStatus(result);
    } catch (error) {
      return this.createError('STATUS_FAILED', error.message, input);
    }
  }
  
  async add(params) {
    this.requireFocus('repository');
    const { files = ['.'] } = params;
    return await this.exec(`add ${files.join(' ')}`);
  }
  
  async commit(params) {
    this.requireFocus('repository');
    const { message, author } = params;
    let cmd = `commit -m "${message}"`;
    if (author) cmd += ` --author="${author}"`;
    return await this.exec(cmd);
  }
  
  // Branch operations
  async checkout(input) {
    try {
      const { repository, branch, create = false } = input;
      if (!repository || !branch) {
        return this.createError('MISSING_PARAMETER', 'Repository and branch required', input);
      }
      const cmd = create ? `checkout -b ${branch}` : `checkout ${branch}`;
      await this.exec(cmd, repository);
      return { repository, branch, created: create };
    } catch (error) {
      return this.createError('CHECKOUT_FAILED', error.message, input);
    }
  }
  
  async merge(params) {
    this.requireFocus('branch');
    const { from, strategy = 'recursive' } = params;
    return await this.exec(`merge ${from} --strategy=${strategy}`);
  }
  
  // File operations
  async blame(params = {}) {
    this.requireFocus('file');
    const { lines } = params;
    let cmd = `blame ${this.focus.file}`;
    if (lines) cmd += ` -L ${lines}`;
    return await this.exec(cmd);
  }
  
  async diff(params = {}) {
    const { cached = false, branch } = params;
    let cmd = 'diff';
    if (cached) cmd += ' --cached';
    if (branch) cmd += ` ${branch}`;
    if (this.focus?.file) cmd += ` -- ${this.focus.file}`;
    return await this.exec(cmd);
  }
  
  // Helper methods
  async exec(command) {
    const cwd = this.focus?.path || process.cwd();
    return await execCommand(`${this.gitPath} ${command}`, { cwd });
  }
  
  requireFocus(type) {
    if (!this.focus || this.focus.type !== type) {
      throw new Error(`Operation requires ${type} focus`);
    }
  }
}
```

### FileSystemModule

File and directory operations with path-based focus:

```javascript
class FileSystemModule extends ToolModule {
  constructor(config) {
    super(config);
    this.basePath = config.basePath || process.cwd();
    this.permissions = config.permissions || 'read';
  }
  
  static getCapabilities() {
    return {
      tools: ['read', 'write', 'append', 'delete', 'copy', 'move',
              'list', 'create', 'stats', 'watch', 'glob'],
      requirements: ['file system access'],
      limitations: ['confined to basePath'],
      description: 'File system operations'
    };
  }
  
  // File operations
  async read(input) {
    try {
      const { path, encoding = 'utf8' } = input;
      if (!path) {
        return this.createError('MISSING_PARAMETER', 'Path required', input);
      }
      const content = await fs.readFile(this.resolvePath(path), encoding);
      return { content, path, encoding, size: content.length };
    } catch (error) {
      return this.createError('READ_FAILED', error.message, input);
    }
  }
  
  async write(params) {
    this.requireFocus('file');
    const { content, encoding = 'utf8', mode } = params;
    await fs.writeFile(this.focus.path, content, { encoding, mode });
  }
  
  async append(params) {
    this.requireFocus('file');
    const { content, encoding = 'utf8' } = params;
    await fs.appendFile(this.focus.path, content, encoding);
  }
  
  async delete() {
    this.requireFocus(['file', 'directory']);
    if (this.focus.type === 'directory') {
      await fs.rmdir(this.focus.path, { recursive: true });
    } else {
      await fs.unlink(this.focus.path);
    }
  }
  
  // Directory operations
  async list(params = {}) {
    this.requireFocus('directory');
    const { recursive = false, filter } = params;
    
    if (recursive) {
      return await this.walkDirectory(this.focus.path, filter);
    } else {
      const entries = await fs.readdir(this.focus.path, { withFileTypes: true });
      return entries.map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : 'file',
        path: path.join(this.focus.path, e.name)
      }));
    }
  }
  
  async create(params = {}) {
    this.requireFocus('directory');
    const { recursive = true } = params;
    await fs.mkdir(this.focus.path, { recursive });
  }
  
  async watch(params) {
    this.requireFocus(['file', 'directory']);
    const { events = ['change'], callback } = params;
    
    const watcher = fs.watch(this.focus.path, (eventType, filename) => {
      if (events.includes(eventType)) {
        callback({ event: eventType, file: filename, path: this.focus.path });
      }
    });
    
    return watcher;
  }
  
  // Helper methods
  resolvePath(relativePath) {
    return path.resolve(this.basePath, relativePath);
  }
  
  createError(code, message, input) {
    return {
      success: false,
      error: {
        code,
        message,
        details: { tool: 'FileSystemModule', input },
        recoverable: code !== 'MISSING_PARAMETER'
      }
    };
  }
  
  checkPermission(operation) {
    const required = operation === 'read' ? 'read' : 'write';
    if (this.permissions !== 'write' && required === 'write') {
      throw new Error('Write permission required');
    }
  }
}
```

### DatabaseModule

Database operations with connection pooling and transaction support:

```javascript
class DatabaseModule extends ToolModule {
  constructor(config) {
    super(config);
    this.dialect = config.dialect || 'postgres';
    this.pool = null;
    this.transaction = null;
  }
  
  async setupResources() {
    this.pool = await createPool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      max: this.config.maxConnections || 10
    });
  }
  
  async teardownResources() {
    if (this.transaction) {
      await this.rollback();
    }
    if (this.pool) {
      await this.pool.end();
    }
  }
  
  static getCapabilities() {
    return {
      focusTypes: ['database', 'table', 'row'],
      tools: ['query', 'select', 'insert', 'update', 'delete',
              'createTable', 'dropTable', 'alterTable',
              'beginTransaction', 'commit', 'rollback'],
      requirements: ['database connection'],
      limitations: ['dialect-specific features may vary']
    };
  }
  
  // Database operations
  async useDatabase(params) {
    const { name } = params;
    this.setFocus({ type: 'database', name });
    // Switch database context if supported
  }
  
  async query(params) {
    const { sql, values = [] } = params;
    const conn = this.transaction || await this.pool.acquire();
    try {
      return await conn.query(sql, values);
    } finally {
      if (!this.transaction) conn.release();
    }
  }
  
  // Table operations
  async select(params = {}) {
    this.requireFocus('table');
    const { columns = ['*'], where, orderBy, limit } = params;
    
    let sql = `SELECT ${columns.join(', ')} FROM ${this.focus.table}`;
    const values = [];
    
    if (where) {
      const whereClause = this.buildWhereClause(where, values);
      sql += ` WHERE ${whereClause}`;
    }
    
    if (orderBy) sql += ` ORDER BY ${orderBy}`;
    if (limit) sql += ` LIMIT ${limit}`;
    
    return await this.query({ sql, values });
  }
  
  async insert(params) {
    this.requireFocus('table');
    const { data, returning = ['id'] } = params;
    
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`);
    
    const sql = `
      INSERT INTO ${this.focus.table} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      ${returning.length ? `RETURNING ${returning.join(', ')}` : ''}
    `;
    
    return await this.query({ sql, values });
  }
  
  async update(params) {
    this.requireFocus('table');
    const { data, where, returning = [] } = params;
    
    const values = [];
    const setClauses = Object.entries(data).map(([col, val], i) => {
      values.push(val);
      return `${col} = $${values.length}`;
    });
    
    let sql = `UPDATE ${this.focus.table} SET ${setClauses.join(', ')}`;
    
    if (where) {
      const whereClause = this.buildWhereClause(where, values);
      sql += ` WHERE ${whereClause}`;
    }
    
    if (returning.length) {
      sql += ` RETURNING ${returning.join(', ')}`;
    }
    
    return await this.query({ sql, values });
  }
  
  async delete(params = {}) {
    this.requireFocus('table');
    const { where, returning = [] } = params;
    
    let sql = `DELETE FROM ${this.focus.table}`;
    const values = [];
    
    if (where) {
      const whereClause = this.buildWhereClause(where, values);
      sql += ` WHERE ${whereClause}`;
    }
    
    if (returning.length) {
      sql += ` RETURNING ${returning.join(', ')}`;
    }
    
    return await this.query({ sql, values });
  }
  
  // Transaction management
  async beginTransaction() {
    const conn = await this.pool.acquire();
    await conn.query('BEGIN');
    this.transaction = conn;
  }
  
  async commit() {
    if (!this.transaction) {
      throw new Error('No active transaction');
    }
    await this.transaction.query('COMMIT');
    this.transaction.release();
    this.transaction = null;
  }
  
  async rollback() {
    if (!this.transaction) {
      throw new Error('No active transaction');
    }
    await this.transaction.query('ROLLBACK');
    this.transaction.release();
    this.transaction = null;
  }
  
  // Helper methods
  buildWhereClause(conditions, values) {
    const clauses = [];
    for (const [column, value] of Object.entries(conditions)) {
      values.push(value);
      clauses.push(`${column} = $${values.length}`);
    }
    return clauses.join(' AND ');
  }
}
```

### HTTPModule

HTTP/REST API operations with request configuration:

```javascript
class HTTPModule extends ToolModule {
  constructor(config) {
    super(config);
    this.client = null;
  }
  
  async setupResources() {
    this.client = axios.create({
      baseURL: this.config.baseURL,
      headers: this.config.headers || {},
      timeout: this.config.timeout || 30000,
      auth: this.config.auth
    });
    
    // Add request/response interceptors
    this.setupInterceptors();
  }
  
  static getCapabilities() {
    return {
      focusTypes: ['endpoint', 'resource'],
      tools: ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'],
      requirements: ['network access'],
      limitations: ['subject to rate limits']
    };
  }
  
  // HTTP methods
  async get(params = {}) {
    const { path = this.focus?.path || '/', query, headers } = params;
    const response = await this.client.get(path, {
      params: query,
      headers
    });
    return this.extractResponse(response);
  }
  
  async post(params) {
    const { path = this.focus?.path || '/', data, headers, json = true } = params;
    const response = await this.client.post(path, data, {
      headers: {
        'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded',
        ...headers
      }
    });
    return this.extractResponse(response);
  }
  
  async put(params) {
    const { path = this.focus?.path || '/', data, headers } = params;
    const response = await this.client.put(path, data, { headers });
    return this.extractResponse(response);
  }
  
  async patch(params) {
    const { path = this.focus?.path || '/', data, headers } = params;
    const response = await this.client.patch(path, data, { headers });
    return this.extractResponse(response);
  }
  
  async delete(params = {}) {
    const { path = this.focus?.path || '/', headers } = params;
    const response = await this.client.delete(path, { headers });
    return this.extractResponse(response);
  }
  
  // GraphQL support
  async graphql(params) {
    const { query, variables = {}, operationName } = params;
    return await this.post({
      path: this.config.graphqlEndpoint || '/graphql',
      data: { query, variables, operationName }
    });
  }
  
  // Helper methods
  setupInterceptors() {
    // Request interceptor for auth tokens
    this.client.interceptors.request.use(
      config => {
        if (this.config.getAuthToken) {
          config.headers.Authorization = `Bearer ${this.config.getAuthToken()}`;
        }
        return config;
      },
      error => Promise.reject(error)
    );
    
    // Response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      async error => {
        if (error.response?.status === 401 && this.config.onAuthError) {
          await this.config.onAuthError();
        }
        throw this.wrapError(error);
      }
    );
  }
  
  extractResponse(response) {
    return {
      data: response.data,
      status: response.status,
      headers: response.headers
    };
  }
  
  wrapError(error) {
    if (error.response) {
      return new Error(
        `HTTP ${error.response.status}: ${error.response.statusText}\n` +
        `Response: ${JSON.stringify(error.response.data)}`
      );
    } else if (error.request) {
      return new Error('No response received from server');
    } else {
      return error;
    }
  }
}
```

## Tool Discovery & Metadata

### Tool Registry

The registry manages providers (metadata + factories) and module instances:

```javascript
class ToolRegistry {
  constructor() {
    this.providers = new Map();    // Provider objects (metadata + factory)
    this.modules = new Map();      // Active module instances
  }
  
  /**
   * Register a tool provider (metadata + factory)
   * @param {Object} provider - Provider object with name, create method, etc.
   */
  registerProvider(provider) {
    this.providers.set(provider.name, provider);
  }
  
  /**
   * Create a module instance using a provider's factory
   * @param {string} providerName - Name of provider
   * @param {Object} config - Module configuration
   * @returns {Promise<string>} Module instance ID
   */
  async createModule(providerName, config) {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider '${providerName}' not found`);
    }
    
    // Use the provider's factory to create a module instance
    const module = provider.create(config);
    
    // Initialize the module's resources
    await module.initialize();
    
    // Store the module instance with an ID
    const moduleId = `${providerName}_${Date.now()}`;
    this.modules.set(moduleId, module);
    
    return moduleId;
  }
  
  /**
   * Get tools from a module
   * @param {string} moduleId - Module instance ID
   * @returns {Array<Executable>} Available tools
   */
  async getTools(moduleId) {
    const entry = this.modules.get(moduleId);
    if (!entry) {
      throw new Error(`Module '${moduleId}' not found`);
    }
    
    const { module } = entry;
    return module.getTools();
  }
  
  /**
   * Search for tools by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Array<Object>} Matching tool metadata
   */
  searchTools(criteria) {
    const results = [];
    
    for (const [name, metadata] of this.metadata) {
      if (this.matchesCriteria(metadata, criteria)) {
        results.push({
          provider: metadata.provider,
          tool: name,
          ...metadata
        });
      }
    }
    
    return results;
  }
  
  /**
   * Get all available capabilities
   * @returns {Object} Map of provider capabilities
   */
  getCapabilities() {
    const capabilities = {};
    
    for (const [name, provider] of this.providers) {
      capabilities[name] = provider.moduleClass.getCapabilities();
    }
    
    return capabilities;
  }
  
  /**
   * Cleanup a module instance
   * @param {string} moduleId - Module to cleanup
   */
  async destroyModule(moduleId) {
    const entry = this.modules.get(moduleId);
    if (!entry) return;
    
    await entry.module.cleanup();
    this.modules.delete(moduleId);
  }
  
  /**
   * Cleanup all modules
   */
  async cleanup() {
    for (const moduleId of this.modules.keys()) {
      await this.destroyModule(moduleId);
    }
  }
}
```

### Tool Metadata Schema

Rich metadata enables intelligent tool selection and describes both success and error responses:

```javascript
{
  name: "git.commit",
  provider: "git",
  module: "GitModule",
  description: "Commit changes to repository",
  category: "version-control",
  
  // Resource pattern (conceptual)
  resource: "repository",  // What kind of resource this tool works with
  
  // Input schema
  input: {
    message: {
      type: "string",
      required: true,
      description: "Commit message"
    },
    author: {
      type: "string",
      required: false,
      description: "Commit author (name <email>)"
    },
    amend: {
      type: "boolean",
      required: false,
      default: false,
      description: "Amend previous commit"
    }
  },
  
  // Output schemas
  output: {
    success: {
      description: "Successful commit result",
      schema: {
        hash: "string",        // Commit hash
        author: "string",      // Commit author
        timestamp: "number",   // Commit timestamp
        message: "string",     // Commit message
        files: "array"         // Files in commit
      },
      example: {
        hash: "abc123def456",
        author: "dev@example.com",
        timestamp: 1634567890,
        message: "Fix authentication bug",
        files: ["auth.js", "login.js"]
      }
    },
    error: {
      description: "Possible error conditions",
      codes: {
        "NO_CHANGES": "No changes staged for commit",
        "INVALID_AUTHOR": "Author format is invalid",
        "REPOSITORY_NOT_FOUND": "Not in a git repository",
        "MERGE_CONFLICT": "Unresolved merge conflicts exist"
      },
      example: {
        success: false,
        error: {
          code: "NO_CHANGES",
          message: "No changes staged for commit",
          details: {
            tool: "git.commit",
            timestamp: 1634567890
          },
          recoverable: false,
          suggestions: ["Use git.add to stage changes first"]
        }
      }
    }
  },
  
  // Usage examples
  examples: [
    {
      description: "Simple commit",
      input: { message: "Fix bug in authentication" },
      output: {
        success: true,
        data: {
          hash: "abc123",
          author: "dev@example.com",
          timestamp: 1634567890,
          message: "Fix bug in authentication"
        }
      }
    },
    {
      description: "Commit with no staged changes",
      input: { message: "Update docs" },
      output: {
        success: false,
        error: {
          code: "NO_CHANGES",
          message: "No changes staged for commit",
          recoverable: false,
          suggestions: ["Use git.add to stage changes first"]
        }
      }
    }
  ],
  
  // Planning hints
  planning: {
    cost: "low",           // Computational cost
    reliability: "high",   // Success likelihood
    idempotent: false,     // Can be safely retried
    sideEffects: true,     // Has side effects
    dependencies: ["git.add"], // Often used after these tools
    produces: ["commit_handle"] // What this tool produces
  },
  
  // Requirements and limitations
  requirements: ["git binary", "repository access"],
  limitations: ["requires staged changes"],
  
  // Tags for discovery
  tags: ["git", "vcs", "commit", "save"]
}
```

## Framework Integration

### Integration with PlanningAgent

The planning agent uses tool metadata for intelligent planning:

```javascript
class PlanningAgent {
  async run(goal, tools, context) {
    // Tools can be module instances or individual tools
    const availableTools = await this.resolveTools(tools);
    
    // Plan generation considers tool metadata
    const plan = await this.planner.generatePlan(
      goal,
      availableTools,
      context
    );
    
    // Execute plan with proper focus management
    return await this.executePlan(plan, availableTools);
  }
  
  async resolveTools(tools) {
    const resolved = [];
    
    for (const tool of tools) {
      if (tool instanceof ToolModule) {
        // Get all tools from module
        resolved.push(...tool.getTools());
      } else if (tool instanceof Executable) {
        // Individual tool
        resolved.push(tool);
      } else if (typeof tool === 'string') {
        // Tool identifier - lookup in registry
        const found = await this.registry.getTool(tool);
        if (found) resolved.push(found);
      }
    }
    
    return resolved;
  }
}
```

### Integration with Planning Strategies

Planning strategies leverage tool metadata:

```javascript
class LLMPlanningStrategy extends PlanningStrategy {
  _buildPlanningPrompt(goal, tools, context) {
    const toolDescriptions = tools.map(tool => {
      const metadata = tool.getMetadata();
      return `
Tool: ${metadata.name}
Description: ${metadata.description}
Focus Required: ${metadata.focus?.required ? `Yes (${metadata.focus.type})` : 'No'}
Parameters: ${this.formatParameters(metadata.parameters)}
Cost: ${metadata.planning?.cost || 'unknown'}
Dependencies: ${metadata.planning?.dependencies?.join(', ') || 'none'}
      `.trim();
    }).join('\n\n');
    
    return `
Goal: ${goal}

Available Tools:
${toolDescriptions}

Context:
${JSON.stringify(context, null, 2)}

Generate a plan...
    `;
  }
}
```

## Usage Patterns

### Basic Usage

```javascript
// 1. Create ModuleInstances using ModuleDefinitions
const gitInstance = await GitModuleDefinition.create({
  gitPath: '/usr/bin/git',
  author: 'Agent <agent@example.com>'
});

const fsInstance = await FileSystemModuleDefinition.create({
  basePath: '/workspace',
  permissions: 'read-write'
});

// 2. Get Tools by name from ModuleInstance
const cloneTool = gitInstance.getTool('clone');
const commitTool = gitInstance.getTool('commit');
const readTool = fsInstance.getTool('read');
const writeTool = fsInstance.getTool('write');

// 3. Use Tools - execute with JSON input
const repository = await cloneTool.execute({ 
  url: 'https://github.com/user/repo',
  directory: './my-repo'
});
// Returns: <opaque-repository-handle> directly

// 4. Check Tool metadata
const cloneMetadata = cloneTool.getMetadata();
console.log(cloneMetadata.description); // "Clone a repository"
console.log(cloneMetadata.input); // { url: {...}, directory: {...} }

// 5. Chain Tools using outputs (opaque objects)
const commit = await commitTool.execute({
  repository: repository,  // Opaque - don't inspect it!
  message: 'Initial commit'
});
// Returns: { hash: 'abc123' }

// 6. Handle errors
const badResult = await cloneTool.execute({ url: 'invalid-url' });
if (!badResult.success) {
  console.error(badResult.error.code); // 'INVALID_URL'
  console.error(badResult.error.message); // Error description
}

// 7. Cleanup ModuleInstance when done
if (gitInstance.cleanup) await gitInstance.cleanup();
if (fsInstance.cleanup) await fsInstance.cleanup();
```

### Advanced Patterns

#### Pattern 1: Resource Handle Chaining

```javascript
// Pass resource handles between operations
const repository = await git.clone({ url: 'https://...' });
const checkout = await git.checkout({ 
  repository: repository, 
  branch: 'feature' 
});
const merge = await git.merge({ 
  repository: repository,
  from: 'main' 
});
const commit = await git.commit({ 
  repository: repository,
  message: 'Merge main into feature' 
});
const push = await git.push({ 
  repository: repository,
  remote: 'origin' 
});
```

#### Pattern 2: Multi-Module Workflows

```javascript
// Coordinate between multiple modules
async function deployProject(git, fs, http) {
  // Build project
  const buildResult = await shell.execute({ 
    command: 'npm run build',
    cwd: '/project'
  });
  
  if (!buildResult.success) {
    return buildResult; // Propagate error
  }
  
  // Commit changes  
  const repository = 'project_repo_handle'; // Assume we have the repo handle
  await git.add({ repository: repository, files: ['dist'] });
  const commit = await git.commit({ 
    repository: repository, 
    message: 'Build for deployment' 
  });
  await git.push({ repository: repository });
  
  // Deploy via API
  const deployment = await http.post({
    url: '/api/deploy',
    data: {
      project: 'my-app',
      version: commit.data.hash
    }
  });
  
  return deployment;
}
```

#### Pattern 3: Resource Handle Management

```javascript
// Manage resource handles across operations
class ResourceManager {
  constructor() {
    this.resources = new Map();
  }
  
  async createResource(tool, input) {
    const handle = await tool(input);
    if (handle && handle._handle) {
      this.resources.set(handle._id, handle);
    }
    return handle;
  }
  
  getResource(handle) {
    return this.resources.get(handle);
  }
  
  async cleanup() {
    // Clean up all resources
    for (const [handle, resource] of this.resources) {
      if (resource.cleanup) {
        await resource.cleanup();
      }
    }
    this.resources.clear();
  }
}

// Usage
const rm = new ResourceManager();
const repo = await rm.createResource(git.clone, { url: '...' });
const file = await rm.createResource(fs.open, { path: '...' });
// ... use resources
await rm.cleanup();
```

## Best Practices

### 1. Prioritize Wrapping Over Native Implementation

**Always consider wrapping existing functionality first** before writing native implementations:

#### When to Wrap (95% of cases)
- **Node.js built-ins**: `fs`, `path`, `crypto`, `http`, etc.
- **Popular libraries**: `axios`, `lodash`, `moment`, `sharp`, etc.
- **CLI tools**: `git`, `docker`, `kubectl`, `python`, `npm`, etc.
- **APIs**: GitHub, AWS, Stripe, OpenAI, etc.
- **MCP servers**: Any Model Context Protocol server
- **Databases**: PostgreSQL, MongoDB, Redis via their Node clients
- **Existing classes**: Any JavaScript class with useful methods

#### When to Write Native (5% of cases)
- **Framework-specific logic**: Planning strategies, artifact management
- **Complex orchestration**: Multi-step workflows that don't map to existing tools
- **Performance-critical paths**: Where wrapping overhead is significant
- **Novel functionality**: Truly new capabilities not available elsewhere

#### Wrapping Benefits
- **Speed**: Minutes to wrap vs hours/days to implement
- **Reliability**: Battle-tested implementations vs new bugs
- **Maintenance**: Automatic updates when underlying libraries improve
- **Ecosystem**: Instant access to thousands of capabilities
- **Documentation**: Existing docs and community knowledge

#### Example Decision Tree
```javascript
// ❌ Don't do this - writing file operations from scratch
class FileModule {
  async readFile(path) {
    // Custom file reading implementation...
  }
}

// ✅ Do this - wrap Node's fs module
class FileModuleDefinition extends ModuleDefinition {
  static async create(config) {
    const fs = await import('fs/promises');
    return new FileModuleInstance(this, config, fs);
  }
}
```

### 2. Module Design

- **Single Responsibility**: Each module should focus on one domain
- **Consistent Interface**: Follow naming conventions across modules
- **Resource Management**: Always implement cleanup methods
- **Error Context**: Include focus and parameters in error messages
- **Validation**: Validate inputs and focus requirements

### 2. Resource Management

- **Clear Handles**: Return clear resource handles from creation tools
- **Handle Documentation**: Document what handles each tool expects
- **Resource Lifecycle**: Be clear about resource creation and cleanup
- **Handle Validation**: Validate resource handles in tool inputs

### 3. Tool Implementation

- **Idempotency**: Make tools idempotent where possible
- **Atomicity**: Keep tool operations atomic
- **Logging**: Log all operations with context
- **Metrics**: Track execution time and success rates
- **Timeouts**: Implement reasonable timeouts

### 4. Configuration

- **Schema Validation**: Define and validate configuration schemas
- **Sensible Defaults**: Provide reasonable default values
- **Environment Variables**: Support environment-based config
- **Secrets Management**: Never log sensitive configuration

### 5. Testing

- **Mock Modules**: Create mock modules for testing
- **Focus Testing**: Test focus validation and requirements
- **Error Scenarios**: Test error handling thoroughly
- **Integration Tests**: Test module interactions

## Implementation Roadmap

### Phase 1: Core Infrastructure (Week 1)
- [ ] Implement ToolProvider base class
- [ ] Implement ToolModule base class
- [ ] Implement ToolAdapter for Executable interface
- [ ] Implement ToolRegistry with lifecycle management
- [ ] Create comprehensive test suite for core components

### Phase 2: Essential Modules (Week 2)
- [ ] Implement FileSystemModule with all operations
- [ ] Implement HTTPModule with REST support
- [ ] Implement ShellModule for command execution
- [ ] Create mock modules for testing
- [ ] Write integration tests for modules

### Phase 3: Advanced Modules (Week 3)
- [ ] Implement GitModule with full Git support
- [ ] Implement DatabaseModule with connection pooling
- [ ] Implement CloudModule for cloud services
- [ ] Add GraphQL support to HTTPModule
- [ ] Performance optimization and caching

### Phase 4: Framework Integration (Week 4)
- [ ] Integrate with PlanningAgent
- [ ] Update planning strategies to use metadata
- [ ] Implement tool discovery API
- [ ] Create tool selection algorithms
- [ ] Update examples to use new architecture

### Phase 5: Documentation & Polish (Week 5)
- [ ] Write comprehensive API documentation
- [ ] Create module development guide
- [ ] Build example workflows
- [ ] Performance benchmarking
- [ ] Security audit and hardening

## Conclusion

This tool architecture consists of three simple classes:

### Three Core Classes

1. **ModuleDefinition** - Defines a module type
   - `static async create(config)` → returns a ModuleInstance
   - `static getMetadata()` → returns metadata about all tools

2. **ModuleInstance** - Holds tools and provides them by name
   - `getTool(name)` → returns a Tool
   - `listTools()` → returns available tool names
   - `cleanup()` → optional resource cleanup

3. **Tool** - Executes operations
   - `async execute(input)` → takes JSON, returns JSON result
   - `getMetadata()` → returns metadata about this specific tool

### Clean Architecture

- **Clear separation of concerns**: Definition → Instance → Tool
- **Standard interfaces**: Every class has defined methods
- **Simple JSON contract**: Input and output are always JSON
- **Resource sharing**: Tools in a ModuleInstance share resources

Every tool takes JSON input and returns opaque handles or data directly. Error handling is managed by the framework layer.

The "focus object" pattern is just a conceptual way of thinking about how tools work with resources (like Git tools working on repositories). Tools return opaque handles that other tools consume - no need to inspect the internals.