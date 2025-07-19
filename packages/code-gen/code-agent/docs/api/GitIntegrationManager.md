# GitIntegrationManager API Documentation

## Overview

The `GitIntegrationManager` is the central component that coordinates all Git operations within the code agent. It manages repository operations, branch strategies, commit orchestration, and GitHub integration while providing a unified interface for Git functionality.

## Class: GitIntegrationManager

### Constructor

```javascript
new GitIntegrationManager(resourceManager, config)
```

#### Parameters

- `resourceManager` (ResourceManager): The resource manager instance for dependency injection
- `config` (Object): Configuration object for Git integration

#### Configuration Options

```javascript
{
  // Core Git settings
  enabled: true,                    // Enable/disable Git integration
  repositoryStrategy: 'auto',       // 'new', 'existing', 'auto'
  branchStrategy: 'feature',        // 'main', 'feature', 'timestamp', 'phase'
  commitStrategy: 'phase',          // 'manual', 'phase', 'auto'
  pushStrategy: 'validation',       // 'never', 'validation', 'always'
  
  // Repository settings
  organization: 'AgentResults',     // GitHub organization
  repositoryUrl: null,              // Existing repository URL
  
  // Commit message settings
  commitMessage: {
    prefix: '[CodeAgent]',          // Commit message prefix
    includePhase: true,             // Include phase in commit message
    includeTimestamp: false,        // Include timestamp
    includeSummary: true            // Include change summary
  },
  
  // User configuration
  user: {
    name: 'Code Agent',             // Git user name
    email: 'agent@codeagent.dev'    // Git user email
  },
  
  // Advanced settings
  enableMetrics: true,              // Track Git metrics
  enableErrorRecovery: true,        // Enable automatic error recovery
  enableTransactions: true,         // Enable atomic operations
  enableBackups: true,              // Enable repository backups
  
  // Rate limiting
  githubRateLimit: {
    enabled: true,
    requestsPerHour: 5000,
    burstLimit: 100
  }
}
```

### Methods

#### `async initialize(repositoryPath)`

Initializes the Git integration manager and all its components.

**Parameters:**
- `repositoryPath` (string): Path to the repository directory

**Returns:**
- `Promise<Object>`: Initialization result

**Example:**
```javascript
const manager = new GitIntegrationManager(resourceManager, config);
const result = await manager.initialize('/path/to/repository');

console.log(result.success); // true
console.log(result.components); // Array of initialized components
```

#### `async initializeRepository(options = {})`

Initializes a new Git repository or configures an existing one.

**Parameters:**
- `options` (Object): Repository initialization options
  - `force` (boolean): Force initialization even if repository exists
  - `createRemote` (boolean): Create remote repository on GitHub
  - `templatePath` (string): Path to repository template

**Returns:**
- `Promise<Object>`: Repository initialization result

**Example:**
```javascript
const result = await manager.initializeRepository({
  createRemote: true,
  force: false
});

console.log(result.repositoryUrl); // GitHub repository URL
console.log(result.initialized); // true
```

#### `async createBranch(branchName, options = {})`

Creates a new branch using the configured branch strategy.

**Parameters:**
- `branchName` (string): Name of the branch to create
- `options` (Object): Branch creation options
  - `checkout` (boolean): Check out the branch after creation
  - `startPoint` (string): Starting point for the branch
  - `strategy` (string): Override default branch strategy

**Returns:**
- `Promise<Object>`: Branch creation result

**Example:**
```javascript
const result = await manager.createBranch('feature/new-component', {
  checkout: true,
  startPoint: 'main'
});

console.log(result.branchName); // Actual branch name created
console.log(result.checked_out); // true
```

#### `async commitFiles(files, message, options = {})`

Commits files to the repository with intelligent staging and message generation.

**Parameters:**
- `files` (Array<string>): Array of file paths to commit
- `message` (string): Commit message (optional if auto-generation enabled)
- `options` (Object): Commit options
  - `phase` (string): Current development phase
  - `metadata` (Object): Additional metadata to include
  - `generateMessage` (boolean): Auto-generate commit message
  - `validate` (boolean): Validate commit before executing

**Returns:**
- `Promise<Object>`: Commit result

**Example:**
```javascript
const result = await manager.commitFiles(
  ['src/component.js', 'tests/component.test.js'],
  'Add new component with tests',
  {
    phase: 'generation',
    metadata: { complexity: 'medium' },
    validate: true
  }
);

console.log(result.commitHash); // Git commit hash
console.log(result.filesCommitted); // Number of files committed
```

#### `async pushToRemote(branchName = null, options = {})`

Pushes commits to the remote repository.

**Parameters:**
- `branchName` (string): Branch to push (defaults to current branch)
- `options` (Object): Push options
  - `force` (boolean): Force push
  - `setUpstream` (boolean): Set upstream tracking
  - `createPullRequest` (boolean): Create pull request after push

**Returns:**
- `Promise<Object>`: Push result

**Example:**
```javascript
const result = await manager.pushToRemote('feature/new-component', {
  setUpstream: true,
  createPullRequest: true
});

console.log(result.pushed); // true
console.log(result.pullRequestUrl); // URL of created PR
```

#### `async getStatus()`

Gets the current repository status and Git integration state.

**Returns:**
- `Promise<Object>`: Repository status

**Example:**
```javascript
const status = await manager.getStatus();

console.log(status.initialized); // true
console.log(status.currentBranch); // Current branch name
console.log(status.commits); // Number of commits
console.log(status.trackedFiles); // Array of tracked files
console.log(status.pendingChanges); // Array of pending changes
```

#### `async getMetrics()`

Gets comprehensive Git integration metrics.

**Returns:**
- `Promise<Object>`: Git metrics

**Example:**
```javascript
const metrics = await manager.getMetrics();

console.log(metrics.totalCommits); // Total number of commits
console.log(metrics.commitsByPhase); // Commits grouped by phase
console.log(metrics.branchesCreated); // Number of branches created
console.log(metrics.averageCommitSize); // Average files per commit
console.log(metrics.gitHubOperations); // GitHub API operations count
```

#### `async cleanup()`

Cleans up all Git integration resources and components.

**Returns:**
- `Promise<void>`

**Example:**
```javascript
await manager.cleanup();
console.log('Git integration cleaned up');
```

### Events

The GitIntegrationManager extends EventEmitter and emits the following events:

#### `initialized`
Emitted when the manager is successfully initialized.

```javascript
manager.on('initialized', (data) => {
  console.log('Git integration initialized:', data);
});
```

#### `repository-created`
Emitted when a new repository is created.

```javascript
manager.on('repository-created', (data) => {
  console.log('Repository created:', data.repositoryUrl);
});
```

#### `branch-created`
Emitted when a new branch is created.

```javascript
manager.on('branch-created', (data) => {
  console.log('Branch created:', data.branchName);
});
```

#### `commit-created`
Emitted when a commit is successfully created.

```javascript
manager.on('commit-created', (data) => {
  console.log('Commit created:', data.commitHash);
  console.log('Files committed:', data.files);
});
```

#### `push-completed`
Emitted when a push operation completes.

```javascript
manager.on('push-completed', (data) => {
  console.log('Push completed:', data.branch);
  console.log('Remote URL:', data.remoteUrl);
});
```

#### `error-recovered`
Emitted when an error is automatically recovered.

```javascript
manager.on('error-recovered', (data) => {
  console.log('Error recovered:', data.errorType);
  console.log('Recovery strategy:', data.strategy);
});
```

### Error Handling

The GitIntegrationManager includes comprehensive error handling with automatic recovery:

```javascript
try {
  await manager.commitFiles(['src/file.js'], 'Update file');
} catch (error) {
  if (error.name === 'GitError') {
    console.log('Git operation failed:', error.message);
    console.log('Error type:', error.type);
    console.log('Recovery suggestion:', error.recovery);
  }
}
```

### Integration with ResourceManager

The GitIntegrationManager integrates with the ResourceManager for dependency injection:

```javascript
// Register with ResourceManager
resourceManager.register('gitIntegration', manager);

// Access from other components
const gitManager = resourceManager.get('gitIntegration');
```

### Best Practices

1. **Always initialize before use:**
   ```javascript
   await manager.initialize(repositoryPath);
   ```

2. **Use appropriate branch strategies:**
   ```javascript
   // For phase-based development
   const config = { branchStrategy: 'phase' };
   
   // For feature development
   const config = { branchStrategy: 'feature' };
   ```

3. **Enable metrics for monitoring:**
   ```javascript
   const config = { enableMetrics: true };
   const metrics = await manager.getMetrics();
   ```

4. **Handle errors gracefully:**
   ```javascript
   manager.on('error-recovered', (data) => {
     console.log('Auto-recovered from:', data.errorType);
   });
   ```

5. **Clean up resources:**
   ```javascript
   process.on('exit', async () => {
     await manager.cleanup();
   });
   ```

### Thread Safety

The GitIntegrationManager is designed to handle concurrent operations safely:

- All Git operations are queued and executed sequentially
- Transaction support ensures atomic operations
- State is properly synchronized across components

### Performance Considerations

- Repository operations are optimized for large codebases
- GitHub API requests are rate-limited and cached
- Metrics collection has minimal performance impact
- Background operations don't block main execution

## See Also

- [BranchManager API](./BranchManager.md)
- [CommitOrchestrator API](./CommitOrchestrator.md)
- [GitHubOperations API](./GitHubOperations.md)
- [Configuration Guide](../configuration.md)
- [Usage Examples](../examples/)