# Best Practices Guide

This guide provides proven patterns and recommendations for building robust, maintainable, and user-friendly CLI applications with the LLM CLI Framework.

## Table of Contents

1. [Command Design](#command-design)
2. [Parameter Handling](#parameter-handling)
3. [Error Handling](#error-handling)
4. [Context Management](#context-management)
5. [Session State](#session-state)
6. [Performance Optimization](#performance-optimization)
7. [Testing Strategies](#testing-strategies)
8. [User Experience](#user-experience)
9. [Security Considerations](#security-considerations)
10. [Maintenance and Deployment](#maintenance-and-deployment)

## Command Design

### 1. Use Action-Oriented Names

**Good:**
```typescript
// Clear, specific actions
'create_project'
'list_tasks'
'delete_file'
'generate_report'
```

**Bad:**
```typescript
// Vague or noun-based names
'project'
'tasks'
'file'
'report'
```

### 2. Keep Commands Focused

Each command should do one thing well:

**Good:**
```typescript
framework.registerCommand('create_project', {
  description: 'Create a new project',
  parameters: [
    { name: 'name', type: 'string', required: true },
    { name: 'template', type: 'string', enum: ['react', 'vue', 'angular'] }
  ],
  handler: async ({ name, template }) => {
    // Single responsibility: create project
  }
});
```

**Bad:**
```typescript
framework.registerCommand('project_manager', {
  description: 'Manage projects - create, list, delete, update',
  parameters: [
    { name: 'action', type: 'string', required: true },
    { name: 'name', type: 'string' },
    { name: 'template', type: 'string' }
  ],
  handler: async ({ action, name, template }) => {
    // Multiple responsibilities - hard to maintain
    if (action === 'create') { /* ... */ }
    if (action === 'list') { /* ... */ }
    if (action === 'delete') { /* ... */ }
  }
});
```

### 3. Provide Rich Descriptions

Include examples and use cases:

**Good:**
```typescript
framework.registerCommand('search_files', {
  description: 'Search for files by name or content',
  parameters: [
    { 
      name: 'query', 
      type: 'string', 
      required: true,
      description: 'Search query (supports wildcards like *.js)'
    },
    { 
      name: 'path', 
      type: 'string', 
      description: 'Directory to search in (default: current directory)'
    }
  ],
  examples: [
    'search files for "config.json"',
    'find all javascript files in src/',
    'search for "TODO" in all files'
  ],
  handler: async ({ query, path }) => {
    // Implementation
  }
});
```

### 4. Use Consistent Naming Conventions

Establish and follow naming patterns:

```typescript
// File operations
'create_file', 'read_file', 'update_file', 'delete_file'

// Project operations
'create_project', 'list_projects', 'archive_project'

// User operations
'add_user', 'remove_user', 'list_users'
```

## Parameter Handling

### 1. Validate Early and Thoroughly

**Good:**
```typescript
framework.registerCommand('set_age', {
  description: 'Set user age',
  parameters: [
    {
      name: 'age',
      type: 'number',
      required: true,
      validator: (value) => value >= 0 && value <= 150,
      validationError: 'Age must be between 0 and 150'
    }
  ],
  handler: async ({ age }) => {
    // age is guaranteed to be valid
  }
});
```

### 2. Provide Sensible Defaults

**Good:**
```typescript
parameters: [
  { name: 'limit', type: 'number', default: 10 },
  { name: 'format', type: 'string', default: 'json', enum: ['json', 'csv', 'xml'] },
  { name: 'verbose', type: 'boolean', default: false }
]
```

### 3. Use Enums for Limited Options

**Good:**
```typescript
parameters: [
  {
    name: 'priority',
    type: 'string',
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  }
]
```

### 4. Handle Optional Parameters Gracefully

**Good:**
```typescript
handler: async ({ query, limit = 10, format = 'json' }, session) => {
  // Use defaults when parameters are undefined
  const results = await search(query, limit);
  return {
    success: true,
    output: formatResults(results, format)
  };
}
```

## Error Handling

### 1. Return Structured Error Responses

**Good:**
```typescript
handler: async ({ filename }) => {
  try {
    const content = await readFile(filename);
    return {
      success: true,
      output: content,
      data: { filename, size: content.length }
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to read file: ${error.message}`,
      suggestions: [
        'Check if the file exists',
        'Verify file permissions',
        'Try using an absolute path'
      ]
    };
  }
}
```

### 2. Provide Helpful Error Messages

**Good:**
```typescript
// Specific and actionable
error: 'File "config.json" not found in current directory'

// With suggestions
suggestions: [
  'Check if the file exists with "list_files"',
  'Create the file with "create_file config.json"',
  'Try searching with "search_files config.json"'
]
```

**Bad:**
```typescript
// Vague and unhelpful
error: 'Operation failed'
error: 'Invalid input'
error: 'Something went wrong'
```

### 3. Handle Common Error Scenarios

```typescript
handler: async ({ url }) => {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        suggestions: response.status === 404 
          ? ['Check the URL spelling', 'Verify the resource exists']
          : ['Check your internet connection', 'Try again later']
      };
    }
    
    return {
      success: true,
      output: await response.text()
    };
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      return {
        success: false,
        error: 'Connection refused - server may be down',
        suggestions: ['Check if the server is running', 'Verify the URL and port']
      };
    }
    
    return {
      success: false,
      error: `Network error: ${error.message}`,
      suggestions: ['Check your internet connection', 'Try again later']
    };
  }
}
```

## Context Management

### 1. Keep Context Relevant

**Good:**
```typescript
class ProjectContextProvider implements ContextProvider {
  name = 'project_context';
  description = 'Current project information';
  priority = 10;
  
  async getContext(session: SessionState): Promise<ContextData> {
    const project = session.state.get('currentProject');
    if (!project) {
      return {
        summary: 'No project selected',
        relevantCommands: ['create_project', 'list_projects']
      };
    }
    
    return {
      summary: `Working on: ${project.name}`,
      details: {
        name: project.name,
        tasksCount: project.tasks.length,
        status: project.status
      },
      relevantCommands: ['add_task', 'list_tasks', 'project_status']
    };
  }
  
  async isRelevant(session: SessionState, command?: string): Promise<boolean> {
    // Only provide context for project-related commands
    const projectCommands = ['add_task', 'list_tasks', 'project_status', 'create_project'];
    return !command || projectCommands.includes(command);
  }
}
```

### 2. Optimize Context Size

**Good:**
```typescript
async getContext(session: SessionState): Promise<ContextData> {
  const recentTasks = session.state.get('tasks')?.slice(-5) || [];
  
  return {
    summary: `${recentTasks.length} recent tasks`,
    details: {
      recentTasks: recentTasks.map(t => ({ id: t.id, title: t.title }))
      // Only include essential information
    }
  };
}
```

**Bad:**
```typescript
async getContext(session: SessionState): Promise<ContextData> {
  const allTasks = session.state.get('tasks') || [];
  
  return {
    summary: 'All tasks',
    details: {
      allTasks // Could be huge - wastes tokens
    }
  };
}
```

### 3. Use Context Priorities

```typescript
// High priority - always included
class UserContextProvider implements ContextProvider {
  priority = 100;
  // ...
}

// Medium priority - included when relevant
class ProjectContextProvider implements ContextProvider {
  priority = 50;
  // ...
}

// Low priority - only when specifically relevant
class HistoryContextProvider implements ContextProvider {
  priority = 10;
  // ...
}
```

## Session State

### 1. Keep State Minimal and Serializable

**Good:**
```typescript
// Simple, serializable data
session.state.set('user', {
  id: 123,
  name: 'Alice',
  preferences: { theme: 'dark', lang: 'en' }
});

session.state.set('recentFiles', [
  { path: '/home/user/doc.txt', lastAccessed: '2024-01-01' }
]);
```

**Bad:**
```typescript
// Complex objects that can't be serialized
session.state.set('database', new DatabaseConnection());
session.state.set('callback', () => console.log('test'));
```

### 2. Use Consistent Key Naming

```typescript
// Good - consistent naming
session.state.set('currentProject', project);
session.state.set('currentUser', user);
session.state.set('currentFile', file);

// Bad - inconsistent naming
session.state.set('project', project);
session.state.set('user_data', user);
session.state.set('active_file', file);
```

### 3. Clean Up State When Appropriate

```typescript
framework.registerCommand('logout', {
  description: 'Log out current user',
  handler: async (_, session) => {
    // Clean up user-specific state
    session.state.delete('currentUser');
    session.state.delete('userPreferences');
    session.state.delete('authToken');
    
    return {
      success: true,
      output: 'Logged out successfully'
    };
  }
});
```

### 4. Handle State Migrations

```typescript
// Handle state from older versions
const projectData = session.state.get('project');
if (projectData && !projectData.version) {
  // Migrate old format
  const migratedProject = {
    ...projectData,
    version: '1.0',
    createdAt: new Date().toISOString()
  };
  session.state.set('project', migratedProject);
}
```

## Performance Optimization

### 1. Use Caching Strategically

**Good:**
```typescript
// Cache expensive operations
const cache = new Map();

handler: async ({ query }) => {
  const cacheKey = `search:${query}`;
  
  if (cache.has(cacheKey)) {
    return {
      success: true,
      output: cache.get(cacheKey),
      cached: true
    };
  }
  
  const results = await expensiveSearchOperation(query);
  cache.set(cacheKey, results);
  
  return {
    success: true,
    output: results
  };
}
```

### 2. Implement Pagination for Large Results

**Good:**
```typescript
framework.registerCommand('list_items', {
  description: 'List items with pagination',
  parameters: [
    { name: 'page', type: 'number', default: 1 },
    { name: 'limit', type: 'number', default: 10 }
  ],
  handler: async ({ page, limit }, session) => {
    const allItems = session.state.get('items') || [];
    const totalPages = Math.ceil(allItems.length / limit);
    const startIndex = (page - 1) * limit;
    const pageItems = allItems.slice(startIndex, startIndex + limit);
    
    return {
      success: true,
      output: formatItemsList(pageItems, page, totalPages),
      data: {
        items: pageItems,
        pagination: { page, limit, totalPages, totalItems: allItems.length }
      }
    };
  }
});
```

### 3. Use Lazy Loading

```typescript
class DataContextProvider implements ContextProvider {
  private cache = new Map();
  
  async getContext(session: SessionState): Promise<ContextData> {
    const userId = session.state.get('userId');
    if (!userId) return { summary: 'No user logged in' };
    
    // Only load data when needed
    if (!this.cache.has(userId)) {
      const userData = await loadUserData(userId);
      this.cache.set(userId, userData);
    }
    
    const data = this.cache.get(userId);
    return {
      summary: `User: ${data.name}`,
      details: { preferences: data.preferences }
    };
  }
}
```

## Testing Strategies

### 1. Test Command Handlers Independently

**Good:**
```typescript
describe('add_task command', () => {
  let framework: LLMCLIFramework;
  let mockProvider: MockLLMProvider;
  
  beforeEach(() => {
    mockProvider = new MockLLMProvider();
    framework = new LLMCLIFramework({
      llmProvider: mockProvider,
      commands: { add_task: addTaskCommand }
    });
  });
  
  it('should add a task successfully', async () => {
    const session = framework.getSession();
    const result = await addTaskCommand.handler(
      { task: 'Write tests' },
      session
    );
    
    expect(result.success).toBe(true);
    expect(result.output).toContain('Write tests');
    
    const tasks = session.state.get('tasks');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].task).toBe('Write tests');
  });
  
  it('should handle invalid input', async () => {
    const session = framework.getSession();
    const result = await addTaskCommand.handler(
      { task: '' },
      session
    );
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Task cannot be empty');
  });
});
```

### 2. Test Context Providers

```typescript
describe('ProjectContextProvider', () => {
  let provider: ProjectContextProvider;
  let session: SessionState;
  
  beforeEach(() => {
    provider = new ProjectContextProvider();
    session = new SessionManager().getState();
  });
  
  it('should provide project context when project exists', async () => {
    session.state.set('currentProject', {
      id: 1,
      name: 'Test Project',
      tasks: [{ id: 1, title: 'Task 1' }]
    });
    
    const context = await provider.getContext(session);
    
    expect(context.summary).toContain('Test Project');
    expect(context.details.name).toBe('Test Project');
    expect(context.relevantCommands).toContain('add_task');
  });
  
  it('should handle no project selected', async () => {
    const context = await provider.getContext(session);
    
    expect(context.summary).toContain('No project selected');
    expect(context.relevantCommands).toContain('create_project');
  });
});
```

### 3. Test End-to-End Workflows

```typescript
describe('Task Management Workflow', () => {
  let framework: LLMCLIFramework;
  
  beforeEach(() => {
    const mockProvider = new MockLLMProvider();
    framework = new LLMCLIFramework({
      llmProvider: mockProvider,
      commands: { /* all commands */ }
    });
  });
  
  it('should handle complete task workflow', async () => {
    // Create project
    mockProvider.setStructuredResponse({
      command: 'create_project',
      parameters: { name: 'Test Project' }
    });
    
    let response = await framework.processInput('create a project called Test Project');
    expect(response.success).toBe(true);
    
    // Add task
    mockProvider.setStructuredResponse({
      command: 'add_task',
      parameters: { task: 'Write documentation' }
    });
    
    response = await framework.processInput('add task to write documentation');
    expect(response.success).toBe(true);
    
    // List tasks
    mockProvider.setStructuredResponse({
      command: 'list_tasks',
      parameters: {}
    });
    
    response = await framework.processInput('show my tasks');
    expect(response.success).toBe(true);
    expect(response.message).toContain('Write documentation');
  });
});
```

## User Experience

### 1. Provide Clear Feedback

**Good:**
```typescript
handler: async ({ filename, content }) => {
  try {
    await writeFile(filename, content);
    return {
      success: true,
      output: `Successfully saved ${content.length} characters to "${filename}"`,
      data: { filename, size: content.length }
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to save file: ${error.message}`,
      suggestions: ['Check file permissions', 'Verify the directory exists']
    };
  }
}
```

### 2. Support Natural Language Variations

```typescript
// Register multiple ways to express the same command
framework.registerCommand('list_files', {
  description: 'List files in a directory',
  aliases: ['ls', 'dir', 'show_files'],
  examples: [
    'list files',
    'show me the files',
    'what files are here?',
    'ls'
  ],
  handler: async ({ path = '.' }) => {
    // Implementation
  }
});
```

### 3. Provide Helpful Suggestions

```typescript
handler: async ({ command }) => {
  if (command === 'unknown') {
    const availableCommands = framework.listCommands();
    const suggestions = findSimilarCommands(command, availableCommands);
    
    return {
      success: false,
      error: `Unknown command: "${command}"`,
      suggestions: suggestions.length > 0 
        ? [`Did you mean: ${suggestions.join(', ')}?`]
        : ['Type "help" to see available commands']
    };
  }
}
```

### 4. Handle Ambiguous Input

```typescript
// When multiple commands could match
if (possibleCommands.length > 1) {
  return {
    success: false,
    error: 'Ambiguous command. Did you mean:',
    suggestions: possibleCommands.map(cmd => 
      `"${cmd.name}" - ${cmd.description}`
    )
  };
}
```

## Security Considerations

### 1. Validate and Sanitize Input

**Good:**
```typescript
parameters: [
  {
    name: 'filename',
    type: 'string',
    required: true,
    validator: (value) => {
      // Prevent directory traversal
      if (value.includes('..') || value.includes('/')) {
        return false;
      }
      // Only allow safe characters
      return /^[a-zA-Z0-9._-]+$/.test(value);
    },
    validationError: 'Filename must contain only letters, numbers, dots, hyphens, and underscores'
  }
]
```

### 2. Avoid Executing Arbitrary Code

**Bad:**
```typescript
handler: async ({ code }) => {
  // NEVER DO THIS
  const result = eval(code);
  return { success: true, output: result };
}
```

**Good:**
```typescript
handler: async ({ expression }) => {
  // Use a safe expression evaluator
  const result = safeEvaluate(expression, allowedOperations);
  return { success: true, output: result };
}
```

### 3. Handle Sensitive Data Carefully

```typescript
handler: async ({ password }) => {
  // Don't store sensitive data in session
  const hashedPassword = await hashPassword(password);
  
  // Don't log sensitive data
  console.log('User authentication attempt'); // Not: console.log(password);
  
  return {
    success: true,
    output: 'Authentication successful',
    // Don't return sensitive data
    data: { userId: user.id } // Not: { password: password }
  };
}
```

## Maintenance and Deployment

### 1. Use Semantic Versioning

```typescript
// In your plugin or CLI
const version = '1.2.3'; // Major.Minor.Patch

// Breaking changes: increment major
// New features: increment minor  
// Bug fixes: increment patch
```

### 2. Provide Migration Guides

Create clear documentation for breaking changes:

```typescript
// v2.0.0 Migration Guide
// BREAKING: Command parameter format changed
// Before: params: { name: { type: 'string' } }
// After: parameters: [{ name: 'name', type: 'string' }]
```

### 3. Monitor Performance

```typescript
const monitor = new PerformanceMonitor();

framework.updateConfig({
  performance: {
    monitor,
    enablePromptCache: true,
    enableResponseCache: true
  }
});

// Regularly check metrics
setInterval(() => {
  const metrics = monitor.getMetrics();
  if (metrics.averageLatency > 2000) {
    console.warn('High latency detected:', metrics.averageLatency);
  }
}, 60000);
```

### 4. Implement Health Checks

```typescript
framework.registerCommand('health', {
  description: 'Check system health',
  handler: async () => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version
    };
    
    return {
      success: true,
      output: 'System is healthy',
      data: health
    };
  }
});
```

## Summary

Following these best practices will help you build:

- **Maintainable** CLIs with clear, focused commands
- **Performant** applications with appropriate caching and optimization
- **User-friendly** interfaces with helpful error messages and suggestions
- **Secure** applications that properly validate input and handle sensitive data
- **Testable** code with comprehensive test coverage
- **Reliable** systems with proper error handling and monitoring

Remember: the best CLI is one that users can intuitively understand and that developers can easily maintain and extend.

Happy building! 🚀